/**
 * PwaEmbeddedContext — Wallet provider for PWA-embedded mode
 *
 * When the /wallet page is loaded inside the PWA's iframe
 * (detected via ?embedded=pwa), this provider replaces the relay
 * flow with direct postMessage communication to the PWA parent.
 *
 * - The PWA sends the wallet address after unlock
 * - Signature requests are forwarded to the PWA which signs locally
 * - No QR codes, no relay polling — everything is instantaneous
 * - The seed NEVER leaves the PWA — only signed tx_blobs are returned
 *
 * Exposes the EXACT same interface as useNativeWallet().
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import wsClient from "@/lib/xcannesWebSocket";
import {
  listCachedStatementKeys,
  setCachedStatement,
} from "@/lib/walletStatementCache";
import { decodeXrplCurrencyCode } from "@/utils/xrpl";

const PwaEmbeddedContext = createContext();

/** Detect if we are running inside the PWA iframe */
export function isPwaEmbedded() {
  if (typeof window === "undefined") return false;
  try {
    // Check URL param
    const params = new URLSearchParams(window.location.search);
    if (params.get("embedded") === "pwa") return true;
    // Check injected flag
    if (window.__XCANNES_PWA_EMBEDDED__) return true;
    return false;
  } catch {
    return false;
  }
}

/** Send a message to the PWA parent */
function postToPwa(msg) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, "*");
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
  const [wallet, setWallet] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [balance, setBalance] = useState(null);
  const [isWalletActivated, setIsWalletActivated] = useState(null);
  const [walletAddresses, setWalletAddresses] = useState([]);
  const walletRef = useRef("");

  // --- Balance ---
  const fetchBalance = useCallback(async (address) => {
    try {
      const res = await fetch(apiUrl(`/wallet/balance?address=${address}`));
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIsWalletActivated(true);
        const tokens = Array.isArray(data?.tokens)
          ? data.tokens.map((token) => ({
              ...token,
              currency: decodeXrplCurrencyCode(token?.currency),
            }))
          : [];
        setBalance({
          xrp: data.xrp,
          xrpReserved: data.xrpReserved ?? 0,
          xrpAvailable: data.xrpAvailable ?? 0,
          xrpLowAlert: Boolean(data.xrpLowAlert),
          tokens,
        });
        return;
      }
      if (
        res.status === 404 &&
        String(data?.message || "")
          .toLowerCase()
          .includes("not activated")
      ) {
        setIsWalletActivated(false);
        setBalance({ xrp: 0, xrpReserved: 0, xrpAvailable: 0, xrpLowAlert: false, tokens: [] });
      }
    } catch (error) {
      console.error("[PwaEmbedded] Fetch balance error:", error);
    }
  }, []);

  // --- Statement cache warming (same as NativeWalletContext) ---
  const warmFullReplay = useCallback(async (address) => {
    if (!address) return;
    try {
      const params = new URLSearchParams();
      params.set("address", address);
      params.set("limit", "100");
      params.set("forceFullReplay", "true");
      params.set("includeRaw", "true");
      params.set("source", "onchain");
      const url = apiUrl(`/wallet/statement?${params.toString()}`);
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCachedStatement(url, data);
        const rawlessParams = new URLSearchParams(params);
        rawlessParams.delete("includeRaw");
        setCachedStatement(
          apiUrl(`/wallet/statement?${rawlessParams.toString()}`),
          data
        );
      }
    } catch {
      // best-effort
    }
  }, []);

  const refreshCachedStatementsForAddress = useCallback(async (address) => {
    if (!address) return;
    const cacheKeys = listCachedStatementKeys();
    const targetKeys = cacheKeys.filter((key) => {
      if (!key.includes("/wallet/statement")) return false;
      if (!key.includes(`address=${encodeURIComponent(address)}`)) return false;
      if (key.includes("cursor=")) return false;
      return true;
    });
    const urls =
      targetKeys.length > 0
        ? targetKeys
        : (() => {
            const p = new URLSearchParams();
            p.set("address", address);
            p.set("limit", "100");
            p.set("source", "onchain");
            return [apiUrl(`/wallet/statement?${p.toString()}`)];
          })();
    for (const url of urls) {
      const fetchUrl = (() => {
        try {
          const parsed = new URL(url);
          if (!parsed.searchParams.has("includeRaw"))
            parsed.searchParams.set("includeRaw", "true");
          return parsed.toString();
        } catch {
          return url;
        }
      })();
      try {
        const res = await fetch(fetchUrl);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setCachedStatement(url, data);
      } catch {
        /* best-effort */
      }
    }
  }, []);

  // --- Update wallet state ---
  const updateWallet = useCallback(
    (account) => {
      if (account) {
        walletRef.current = account;
        setWallet(account);
        setIsConnected(true);
        setIsWalletActivated(null);
        fetchBalance(account);
        warmFullReplay(account);
      } else {
        walletRef.current = "";
        setWallet("");
        setIsConnected(false);
        setBalance(null);
        setIsWalletActivated(null);
      }
    },
    [fetchBalance, warmFullReplay]
  );

  // --- WebSocket real-time updates ---
  const walletWsRefreshRef = useRef(0);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    const address = wallet;
    const channelKey = `wallet:${address}`;

    wsClient
      .connect()
      .then(() => {
        if (cancelled) return;
        wsClient.subscribe("wallet", address);
      })
      .catch(() => {});

    const handleWalletUpdate = (message) => {
      if (cancelled) return;
      const channel = message?.channel;
      const data = message?.data || {};
      if (channel && channel !== channelKey) return;
      if (data?.address && data.address !== address) return;
      const now = Date.now();
      if (now - walletWsRefreshRef.current < 5000) return;
      walletWsRefreshRef.current = now;
      refreshCachedStatementsForAddress(address);
      fetchBalance(address);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("xcannes:wallet:refresh", { detail: { address } })
        );
      }
    };

    wsClient.on("wallet", handleWalletUpdate);
    return () => {
      cancelled = true;
      wsClient.off("wallet", handleWalletUpdate);
      wsClient.unsubscribe("wallet", address);
    };
  }, [fetchBalance, refreshCachedStatementsForAddress, wallet]);

  // --- Listen for messages from PWA parent ---
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
          // PWA sends wallet address + publicKey after unlock
          if (data.address) {
            updateWallet(data.address);
          }
          setIsSessionReady(true);
          // Request the full wallet list from the PWA
          postToPwa({ type: "GET_WALLETS" });
          break;
        }
        case "LOCK": {
          // PWA locked — clear wallet state
          updateWallet(null);
          setWalletAddresses([]);
          break;
        }
        case "SWITCH_WALLET": {
          // PWA switched active wallet
          if (data.address) {
            updateWallet(data.address);
          }
          break;
        }
        case "WALLET_LIST": {
          // PWA sends the full list of stored wallets
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

    // Tell the PWA we're ready to receive the wallet address
    postToPwa({ type: "READY" });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [updateWallet]);

  // --- Connect (no-op in embedded mode — already connected via INIT) ---
  const connect = useCallback(async () => {
    // In embedded mode, the wallet is already provided by the PWA.
    // If not connected, ask the PWA to re-send init.
    postToPwa({ type: "REQUEST_INIT" });
  }, []);

  // --- Disconnect ---
  const disconnect = useCallback(async () => {
    postToPwa({ type: "DISCONNECT" });
    updateWallet(null);
  }, [updateWallet]);

  // --- Sign Transaction via PWA bridge ---
  const signTransaction = useCallback(
    async (txjson, { action } = {}) => {
      if (!walletRef.current) {
        console.error("[PwaEmbedded] Cannot sign — no wallet connected");
        return null;
      }

      const requestId = nextRequestId();
      setIsConnecting(true);

      try {
        // Ask the PWA to sign the transaction
        postToPwa({
          type: "SIGN_TX",
          txjson,
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
    [fetchBalance, refreshCachedStatementsForAddress]
  );

  const refreshBalance = useCallback(() => {
    if (walletRef.current) fetchBalance(walletRef.current);
  }, [fetchBalance]);

  // --- Switch wallet (multi-wallet) ---
  const switchWallet = useCallback((address) => {
    if (!address || address === walletRef.current) return;
    // Ask the PWA to switch to this wallet
    postToPwa({ type: "SWITCH_WALLET", address });
  }, []);

  // No QR modal in embedded mode
  const qrModalData = null;
  const closeQrModal = useCallback(() => {}, []);

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
