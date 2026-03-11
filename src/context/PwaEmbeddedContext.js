/**
 * PwaEmbeddedContext — Wallet provider for PWA-embedded mode
 *
 * When /wallet is loaded inside the PWA's iframe (?embedded=pwa),
 * this provider replaces the relay flow with direct postMessage
 * communication to the PWA parent.
 *
 * - PWA sends wallet address after unlock
 * - Signature requests forwarded to PWA which signs locally
 * - No QR codes, no relay — everything is instantaneous
 * - The seed NEVER leaves the PWA — only signed tx_blobs are returned
 *
 * Shared wallet logic (balance, statement cache, WebSocket updates) lives
 * in useWalletCore. This file only handles PWA postMessage transport.
 *
 * Exposes the EXACT same interface as useNativeWallet().
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import { useWalletCore } from "@/hooks/useWalletCore";

const PwaEmbeddedContext = createContext();

/** Detect if we are running inside the PWA iframe */
export function isPwaEmbedded() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("embedded") === "pwa") return true;
    if (window.__XCANNES_PWA_EMBEDDED__) return true;
    return false;
  } catch {
    return false;
  }
}

const APP_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://xcannes.com";

/** Send a message to the PWA parent */
function postToPwa(msg) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, APP_ORIGIN);
    }
  } catch {
    // cross-origin safety
  }
}

/** Wait for a reply from the PWA matching a requestId, with timeout */
function waitForPwaReply(requestId, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("PWA bridge timeout"));
    }, timeoutMs);

    function handler(event) {
      const data = event.data;
      if (!data || data.requestId !== requestId) return;
      window.removeEventListener("message", handler);
      clearTimeout(timer);
      resolve(data);
    }

    window.addEventListener("message", handler);
  });
}

let _requestCounter = 0;
function nextRequestId() {
  return `pwa_req_${Date.now()}_${++_requestCounter}`;
}

export const PwaEmbeddedProvider = ({ children }) => {
  // ─── Shared wallet state & actions ────────────────────────────────
  const {
    wallet,
    isConnected,
    isConnecting,
    isSessionReady,
    balance,
    isWalletActivated,
    walletAddresses,
    walletRef,
    setIsConnecting,
    setIsSessionReady,
    setWalletAddresses,
    fetchBalance,
    refreshCachedStatementsForAddress,
    activateWallet,
    deactivateWallet,
    refreshBalance,
    autofillTransaction,
  } = useWalletCore({ logPrefix: "PwaEmbedded" });

  // ─── PWA wallet state management ──────────────────────────────────
  const updateWallet = useCallback(
    (account) => {
      if (account) {
        activateWallet(account);
      } else {
        deactivateWallet();
      }
    },
    [activateWallet, deactivateWallet]
  );

  // ─── Listen for messages from PWA parent ──────────────────────────
  useEffect(() => {
    if (!isPwaEmbedded()) {
      setIsSessionReady(true);
      return;
    }

    function handleMessage(event) {
      const data = event.data;
      if (!data || !data.type) return;

      switch (data.type) {
        case "INIT": {
          if (data.address) {
            updateWallet(data.address);
          }
          setIsSessionReady(true);
          postToPwa({ type: "GET_WALLETS" });
          break;
        }
        case "LOCK": {
          updateWallet(null);
          setWalletAddresses([]);
          break;
        }
        case "SWITCH_WALLET": {
          if (data.address) {
            updateWallet(data.address);
          }
          break;
        }
        case "WALLET_LIST": {
          if (Array.isArray(data.wallets)) {
            setWalletAddresses(data.wallets);
          }
          break;
        }
        default:
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    postToPwa({ type: "READY" });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [updateWallet, setIsSessionReady, setWalletAddresses]);

  // ─── Connect (no-op in embedded mode — already connected via INIT) ─
  const connect = useCallback(async () => {
    postToPwa({ type: "REQUEST_INIT" });
  }, []);

  // ─── Disconnect ───────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    postToPwa({ type: "DISCONNECT" });
    updateWallet(null);
  }, [updateWallet]);

  // ─── Sign Transaction via PWA bridge ──────────────────────────────
  const signTransaction = useCallback(
    async (txjson, { action } = {}) => {
      if (!walletRef.current) {
        console.error("[PwaEmbedded] Cannot sign — no wallet connected");
        return null;
      }

      const requestId = nextRequestId();
      setIsConnecting(true);

      try {
        const filledTx = await autofillTransaction(txjson, walletRef.current);

        // Ask the PWA to sign the transaction
        postToPwa({
          type: "SIGN_TX",
          txjson: filledTx,
          action: action || null,
          requestId,
          address: walletRef.current,
        });

        // Wait for the signed result from the PWA
        const reply = await waitForPwaReply(requestId, 120000);

        if (reply.type === "TX_SIGNED" && reply.tx_blob) {
          setIsConnecting(false);

          // Submit the signed tx_blob to XRPL via our backend
          try {
            const submitRes = await fetch(apiUrl("/wallet-relay/submit-blob"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tx_blob: reply.tx_blob,
                hash: reply.hash,
                address: walletRef.current,
              }),
            });
            const submitData = await submitRes.json().catch(() => ({}));

            // Refresh balance after tx
            setTimeout(() => {
              fetchBalance(walletRef.current);
              refreshCachedStatementsForAddress(walletRef.current);
            }, 2000);

            return {
              signed: true,
              tx_blob: reply.tx_blob,
              hash: reply.hash,
              txResult: submitData?.txResult || submitData,
              uuid: requestId,
            };
          } catch (submitError) {
            console.error("[PwaEmbedded] Submit error:", submitError);
            return {
              signed: true,
              tx_blob: reply.tx_blob,
              hash: reply.hash,
              txResult: null,
              uuid: requestId,
            };
          }
        }

        // Signature refused or error
        setIsConnecting(false);
        if (reply.type === "SIGN_ERROR") {
          console.error("[PwaEmbedded] Sign error:", reply.error);
        }
        return null;
      } catch (error) {
        console.error("[PwaEmbedded] Sign timeout/error:", error);
        setIsConnecting(false);
        return null;
      }
    },
    [walletRef, setIsConnecting, autofillTransaction, fetchBalance, refreshCachedStatementsForAddress]
  );

  // ─── Switch wallet (multi-wallet) ─────────────────────────────────
  const switchWallet = useCallback((address) => {
    if (!address || address === walletRef.current) return;
    postToPwa({ type: "SWITCH_WALLET", address });
  }, [walletRef]);

  // Navigate to create/import wallet screen in PWA
  const goToChoice = useCallback(() => {
    postToPwa({ type: "GO_TO_CHOICE" });
  }, []);

  // No QR modal in embedded mode
  const qrModalData = null;
  const closeQrModal = useCallback(() => {}, []);

  // ─── Context value ────────────────────────────────────────────────
  const contextValue = useMemo(() => ({
    wallet,
    isConnected,
    isConnecting,
    isSessionReady,
    balance,
    isWalletActivated,
    qrModalData,
    walletAddresses,
    connect,
    disconnect,
    refreshBalance,
    signTransaction,
    closeQrModal,
    switchWallet,
    goToChoice,
  }), [
    wallet,
    isConnected,
    isConnecting,
    isSessionReady,
    balance,
    isWalletActivated,
    qrModalData,
    walletAddresses,
    connect,
    disconnect,
    refreshBalance,
    signTransaction,
    closeQrModal,
    switchWallet,
    goToChoice,
  ]);

  return (
    <PwaEmbeddedContext.Provider
      value={contextValue}
    >
      {children}
    </PwaEmbeddedContext.Provider>
  );
};

export const usePwaEmbedded = () => useContext(PwaEmbeddedContext);
