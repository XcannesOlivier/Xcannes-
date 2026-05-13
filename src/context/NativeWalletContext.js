/**
 * NativeWalletContext — Connexion wallet via Xcannes Wallet Relay
 *
 * Uses the relay (/wallet-relay/*) for signature:
 * Desktop creates challenge → shows QR → mobile scans → signs locally →
 * submits tx_blob via relay.
 *
 * Shared wallet logic (balance, statement cache, WebSocket updates) lives
 * in useWalletCore. This file only handles relay-specific transport.
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
import { isMobileDevice } from "@/utils/deviceDetect";
import { useWalletCore } from "@/hooks/useWalletCore";

const NativeWalletContext = createContext();
const NATIVE_WALLET_STORAGE_KEY = "xcannes_native_wallet";

export const NativeWalletProvider = ({ children }) => {
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
    activateWallet,
    deactivateWallet,
    switchToWallet,
    refreshBalance,
    autofillTransaction,
  } = useWalletCore({ logPrefix: "NativeWallet" });

  // ─── Relay-specific state ─────────────────────────────────────────
  const [qrModalData, setQrModalData] = useState(null);
  const relayCleanupRef = useRef(null);
  const autoCloseTimeoutRef = useRef(null);
  const pendingSignatureResolveRef = useRef(null);

  // --- WebSocket relay cleanup ---
  const cleanupRelaySubscription = useCallback(() => {
    if (relayCleanupRef.current) {
      relayCleanupRef.current();
      relayCleanupRef.current = null;
    }
  }, []);

  const clearAutoClose = useCallback(() => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
  }, []);

  const resolvePendingSignature = useCallback((payload) => {
    if (!pendingSignatureResolveRef.current) return;
    const resolve = pendingSignatureResolveRef.current;
    pendingSignatureResolveRef.current = null;
    resolve(payload);
  }, []);

  const updateQrStatus = useCallback((status) => {
    setQrModalData((prev) => (prev ? { ...prev, status } : prev));
  }, []);

  const closeQrModal = useCallback(() => {
    cleanupRelaySubscription();
    clearAutoClose();
    resolvePendingSignature(null);
    setQrModalData(null);
    setIsConnecting(false);
  }, [clearAutoClose, cleanupRelaySubscription, resolvePendingSignature, setIsConnecting]);

  const scheduleQrClose = useCallback(
    (delayMs = 2000) => {
      clearAutoClose();
      autoCloseTimeoutRef.current = setTimeout(() => {
        closeQrModal();
      }, delayMs);
    },
    [clearAutoClose, closeQrModal]
  );

  // ─── Session-storage–backed wallet activation ─────────────────────
  const updateWallet = useCallback(
    (account, addresses) => {
      if (account) {
        activateWallet(account);
        sessionStorage.setItem(NATIVE_WALLET_STORAGE_KEY, account);
        // Store multi-wallet list if provided
        if (Array.isArray(addresses) && addresses.length > 0) {
          setWalletAddresses(addresses);
          try {
            sessionStorage.setItem(
              NATIVE_WALLET_STORAGE_KEY + "_addresses",
              JSON.stringify(addresses)
            );
          } catch { /* ignore */ }
        }
      } else {
        deactivateWallet();
        setWalletAddresses([]);
        sessionStorage.removeItem(NATIVE_WALLET_STORAGE_KEY);
        sessionStorage.removeItem(NATIVE_WALLET_STORAGE_KEY + "_addresses");
      }
    },
    [activateWallet, deactivateWallet, setWalletAddresses]
  );

  // --- Restore saved session ---
  useEffect(() => {
    const savedWallet =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(NATIVE_WALLET_STORAGE_KEY)
        : null;
    if (savedWallet) {
      let savedAddresses = [];
      try {
        const raw = sessionStorage.getItem(NATIVE_WALLET_STORAGE_KEY + "_addresses");
        if (raw) savedAddresses = JSON.parse(raw);
      } catch { /* ignore */ }
      updateWallet(savedWallet, savedAddresses);
    }
    setIsSessionReady(true);
  }, [updateWallet, setIsSessionReady]);

  // ─── Relay challenge subscription ─────────────────────────────────
  const subscribeToChallengeStatus = useCallback(
    async (challengeId, mode) => {
      cleanupRelaySubscription();

      const timeoutId = setTimeout(() => {
        cleanupRelaySubscription();
        setIsConnecting(false);
        updateQrStatus("error");
        if (mode === "sign") resolvePendingSignature(null);
      }, 5 * 60 * 1000);

      const handleRelayEvent = (message) => {
        if (message?.challengeId !== challengeId) return;
        const eventType = message?.event;

        if (eventType === "connected" || eventType === "signed") {
          cleanupRelaySubscription();
          setIsConnecting(false);
          updateQrStatus("signed");

          if (mode === "connect" && message?.address) {
            const addr = message.address;
            const addrs = message.addresses;
            setTimeout(() => {
              updateWallet(addr, addrs);
              closeQrModal();
            }, 1800);
          } else if (mode === "sign") {
            scheduleQrClose(2000);
            resolvePendingSignature({
              signed: true,
              address: message.address,
              hash: message.hash,
              txResult: message.txResult,
              uuid: challengeId,
            });
          } else {
            scheduleQrClose(2000);
          }
        } else if (eventType === "rejected") {
          // XRPL rejected the transaction (tem*, tef*, tel*)
          cleanupRelaySubscription();
          setIsConnecting(false);
          updateQrStatus("error");
          if (mode === "sign") {
            scheduleQrClose(1500);
            resolvePendingSignature({
              signed: false,
              rejected: true,
              engineResult: message?.engineResult || "",
              engineMessage: message?.engineMessage || "Transaction rejetée par le XRPL",
              hash: message?.hash || "",
            });
          }
        } else if (eventType === "expired" || eventType === "error") {
          cleanupRelaySubscription();
          setIsConnecting(false);
          updateQrStatus("error");
          if (mode === "sign") resolvePendingSignature(null);
        }
      };

      // ── HTTP polling fallback ────────────────────────────────────────────
      // Polls GET /wallet-relay/status/:id every 3s as a safety net when
      // Redis pub/sub is unavailable and the WebSocket push never arrives.
      // Stopped immediately when cleanupRelaySubscription() is called
      // (which happens as soon as either WS or poll delivers an event).
      const pollStatus = async () => {
        try {
          const res = await fetch(apiUrl(`/wallet-relay/status/${challengeId}`), {
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) return;
          const { status, result } = await res.json();
          if (status === "signed" || status === "submitted") {
            handleRelayEvent({
              challengeId,
              event: mode === "connect" ? "connected" : "signed",
              address: result?.address,
              hash: result?.hash,
              txResult: result?.txResult,
              addresses: result?.addresses,
            });
          } else if (status === "rejected") {
            handleRelayEvent({
              challengeId,
              event: "rejected",
              engineResult: result?.engineResult || "",
              engineMessage: result?.engineMessage || "Transaction rejetée par le XRPL",
              hash: result?.hash || "",
            });
          } else if (status === "expired") {
            handleRelayEvent({ challengeId, event: "expired" });
          }
          // "pending" → no action, next poll will retry
        } catch {
          // Network error or timeout — next poll will retry
        }
      };
      const pollIntervalId = setInterval(pollStatus, 5000);

      try {
        await wsClient.connect();
        wsClient.subscribe("wallet-relay", challengeId);
        wsClient.on("wallet-relay", handleRelayEvent);

        relayCleanupRef.current = () => {
          clearTimeout(timeoutId);
          clearInterval(pollIntervalId);
          wsClient.off("wallet-relay", handleRelayEvent);
          wsClient.unsubscribe("wallet-relay", challengeId);
        };
      } catch (error) {
        console.error("[NativeWallet] WebSocket subscription error:", error);
        clearTimeout(timeoutId);
        clearInterval(pollIntervalId);
      }
    },
    [
      cleanupRelaySubscription,
      closeQrModal,
      resolvePendingSignature,
      scheduleQrClose,
      setIsConnecting,
      updateQrStatus,
      updateWallet,
    ]
  );

  // ─── CONNECT via relay ────────────────────────────────────────────
  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const res = await fetch(apiUrl("/wallet-relay/challenge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "connect",
          origin: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create challenge");

      const { challengeId, qrData } = data;

      cleanupRelaySubscription();
      clearAutoClose();

      setQrModalData({
        uuid: challengeId,
        qrUrl: null,
        qrData: qrData,
        deepLink: null,
        type: "connect",
        status: "waiting",
        visible: true,
      });

      subscribeToChallengeStatus(challengeId, "connect");
    } catch (error) {
      console.error("[NativeWallet] Connect error:", error);
      alert(`Connection failed: ${error.message}`);
      setIsConnecting(false);
    }
  }, [cleanupRelaySubscription, clearAutoClose, setIsConnecting, subscribeToChallengeStatus]);

  // ─── SIGN TRANSACTION via relay ───────────────────────────────────
  const signTransaction = useCallback(async (txjson, { action } = {}) => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return null;
    }

    const mobile = isMobileDevice();

    setIsConnecting(true);
    try {
      const filledTx = await autofillTransaction(txjson, walletRef.current);

      const payload = {
        type: "sign",
        origin: window.location.origin,
        txjson: filledTx,
        ...(action ? { action } : {}),
      };

      const res = await fetch(apiUrl("/wallet-relay/challenge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create sign challenge");

      const { challengeId, qrData } = data;

      cleanupRelaySubscription();
      clearAutoClose();

      if (mobile) {
        setQrModalData({
          uuid: challengeId,
          qrUrl: null,
          qrData: qrData,
          deepLink: null,
          type: "sign",
          status: "waiting",
          visible: true,
          mobile: true,
          walletAppUrl: `/wallet-app/?sign=${challengeId}`,
        });
      } else {
        setQrModalData({
          uuid: challengeId,
          qrUrl: null,
          qrData: qrData,
          deepLink: null,
          type: "sign",
          status: "waiting",
          visible: true,
          mobile: false,
        });
      }

      return await new Promise((resolve) => {
        resolvePendingSignature(null);
        pendingSignatureResolveRef.current = resolve;
        subscribeToChallengeStatus(challengeId, "sign");
      });
    } catch (error) {
      console.error("[NativeWallet] Sign error:", error);
      alert(`Signature failed: ${error.message}`);
      setIsConnecting(false);
      return null;
    }
  }, [isConnected, walletRef, autofillTransaction, cleanupRelaySubscription, clearAutoClose, setIsConnecting, resolvePendingSignature, subscribeToChallengeStatus]);

  // ─── Switch active wallet (multi-wallet) ──────────────────────────
  const switchWallet = useCallback(
    (address) => {
      if (!address) return;
      const found = walletAddresses.find((w) =>
        typeof w === "string" ? w === address : w?.address === address
      );
      if (!found && address !== wallet) return;
      switchToWallet(address);
      sessionStorage.setItem(NATIVE_WALLET_STORAGE_KEY, address);
    },
    [switchToWallet, wallet, walletAddresses]
  );

  const disconnect = useCallback(async () => {
    updateWallet(null);
  }, [updateWallet]);

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
    <NativeWalletContext.Provider
      value={contextValue}
    >
      {children}
    </NativeWalletContext.Provider>
  );
};

export const useNativeWallet = () => useContext(NativeWalletContext);
