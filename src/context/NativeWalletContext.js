/**
 * NativeWalletContext — Connexion wallet via Xcannes Wallet Relay
 *
 * Fournit la même interface que les autres wallet providers, mais utilise
 * le protocole relay (/wallet-relay/*) pour la signature.
 *
 * Le desktop crée un challenge → affiche QR → le mobile scanne →
 * signe localement → soumet le tx_blob signé via le relay.
 *
 * Aucun seed ni clé privée ne transite par ce contexte ou le serveur.
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

const NativeWalletContext = createContext();
const NATIVE_WALLET_STORAGE_KEY = "xcannes_native_wallet";

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /android|iphone|ipad|ipod|mobile/i.test(ua) ||
    (/Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1);
}

export const NativeWalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [balance, setBalance] = useState(null);
  const [isWalletActivated, setIsWalletActivated] = useState(null);
  const [qrModalData, setQrModalData] = useState(null);
  const [walletAddresses, setWalletAddresses] = useState([]); // Multi-wallet list
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
  }, [clearAutoClose, cleanupRelaySubscription, resolvePendingSignature]);

  const scheduleQrClose = useCallback(
    (delayMs = 2000) => {
      clearAutoClose();
      autoCloseTimeoutRef.current = setTimeout(() => {
        closeQrModal();
      }, delayMs);
    },
    [clearAutoClose, closeQrModal]
  );

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
      console.error("[NativeWallet] Fetch balance error:", error);
    }
  }, []);

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
    } catch (error) {
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
      } catch (_) {
        /* best-effort */
      }
    }
  }, []);

  // --- Wallet state ---
  const updateWallet = useCallback(
    (account, addresses) => {
      if (account) {
        setWallet(account);
        setIsConnected(true);
        setIsWalletActivated(null);
        sessionStorage.setItem(NATIVE_WALLET_STORAGE_KEY, account);
        fetchBalance(account);
        warmFullReplay(account);
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
        setWallet("");
        setIsConnected(false);
        setBalance(null);
        setIsWalletActivated(null);
        setWalletAddresses([]);
        sessionStorage.removeItem(NATIVE_WALLET_STORAGE_KEY);
        sessionStorage.removeItem(NATIVE_WALLET_STORAGE_KEY + "_addresses");
      }
    },
    [fetchBalance, warmFullReplay]
  );

  // --- WebSocket real-time updates (reuses same wallet:address channel) ---
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

  // --- Restore saved session ---
  useEffect(() => {
    const savedWallet =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(NATIVE_WALLET_STORAGE_KEY)
        : null;
    if (savedWallet) {
      // Restore addresses list from session
      let savedAddresses = [];
      try {
        const raw = sessionStorage.getItem(NATIVE_WALLET_STORAGE_KEY + "_addresses");
        if (raw) savedAddresses = JSON.parse(raw);
      } catch { /* ignore */ }
      updateWallet(savedWallet, savedAddresses);
    }
    setIsSessionReady(true);
  }, [updateWallet]);

  // --- Subscribe to challenge status via WebSocket (replaces polling) ---
  const subscribeToChallengeStatus = useCallback(
    async (challengeId, mode) => {
      // Cleanup any previous subscription
      cleanupRelaySubscription();

      // Timeout after 5 minutes
      const timeoutId = setTimeout(() => {
        cleanupRelaySubscription();
        setIsConnecting(false);
        updateQrStatus("error");
        if (mode === "sign") resolvePendingSignature(null);
      }, 5 * 60 * 1000);

      // Handler for WebSocket relay events
      const handleRelayEvent = (message) => {
        if (message?.challengeId !== challengeId) return;
        const eventType = message?.event;

        if (eventType === "connected" || eventType === "signed") {
          cleanupRelaySubscription();
          setIsConnecting(false);
          updateQrStatus("signed");

          if (mode === "connect" && message?.address) {
            // Brief delay so user sees "Connecté !" before dashboard swap
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
        } else if (eventType === "expired" || eventType === "error") {
          cleanupRelaySubscription();
          setIsConnecting(false);
          updateQrStatus("error");
          if (mode === "sign") resolvePendingSignature(null);
        }
      };

      // Subscribe via WebSocket
      try {
        await wsClient.connect();
        wsClient.subscribe("wallet-relay", challengeId);
        wsClient.on("wallet-relay", handleRelayEvent);

        // Store cleanup function
        relayCleanupRef.current = () => {
          clearTimeout(timeoutId);
          wsClient.off("wallet-relay", handleRelayEvent);
          wsClient.unsubscribe("wallet-relay", challengeId);
        };
      } catch (error) {
        console.error("[NativeWallet] WebSocket subscription error:", error);
        clearTimeout(timeoutId);
      }
    },
    [
      cleanupRelaySubscription,
      closeQrModal,
      resolvePendingSignature,
      scheduleQrClose,
      updateQrStatus,
      updateWallet,
    ]
  );

  // --- CONNECT via relay ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        qrData: qrData, // Raw QR payload for the QR component to render
        deepLink: null,
        type: "connect",
        status: "waiting",
        visible: true,
      });

      // Subscribe to challenge status via WebSocket
      subscribeToChallengeStatus(challengeId, "connect");
    } catch (error) {
      console.error("[NativeWallet] Connect error:", error);
      alert(`Connection failed: ${error.message}`);
      setIsConnecting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupRelaySubscription, clearAutoClose, subscribeToChallengeStatus]);

  // --- SIGN TRANSACTION via relay ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const signTransaction = useCallback(async (txjson, { action } = {}) => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return null;
    }

    const mobile = isMobileDevice();

    setIsConnecting(true);
    try {
      const payload = {
        type: "sign",
        origin: window.location.origin,
        txjson,
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
        // Mobile: redirect to wallet-app for biometric/PIN sign
        setQrModalData({
          uuid: challengeId,
          qrUrl: null,
          qrData: qrData,
          deepLink: null,
          type: "sign",
          status: "waiting",
          visible: true,
          mobile: true, // Flag for mobile-aware QR modal
          walletAppUrl: `/wallet-app/?sign=${challengeId}`,
        });
      } else {
        // Desktop: show QR code for mobile to scan
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

      // Wait for signature result via WebSocket
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, cleanupRelaySubscription, clearAutoClose, subscribeToChallengeStatus, resolvePendingSignature]);

  const refreshBalance = useCallback(() => {
    if (wallet) fetchBalance(wallet);
  }, [wallet, fetchBalance]);

  // --- Switch active wallet (multi-wallet) ---
  const switchWallet = useCallback(
    (address) => {
      if (!address) return;
      // Verify the address is in our walletAddresses list
      const found = walletAddresses.find((w) => w.address === address);
      if (!found && address !== wallet) return;
      // Switch: update active wallet but keep the addresses list
      setWallet(address);
      setIsWalletActivated(null);
      setBalance(null);
      sessionStorage.setItem(NATIVE_WALLET_STORAGE_KEY, address);
      fetchBalance(address);
      warmFullReplay(address);
    },
    [fetchBalance, warmFullReplay, wallet, walletAddresses]
  );

  const disconnect = useCallback(async () => {
    updateWallet(null);
  }, [updateWallet]);

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
