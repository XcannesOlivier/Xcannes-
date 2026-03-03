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

/** Generate a QR code data URL using a simple inline canvas renderer */
function generateQRDataUrl(text) {
  // We return the raw JSON/URL — the QR rendering is handled by the
  // QR modal component. The modal receives qrData as
  // a plain string and renders it.
  return text;
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
  const pollIntervalRef = useRef(null);
  const autoCloseTimeoutRef = useRef(null);
  const pendingSignatureResolveRef = useRef(null);

  // --- Polling helpers ---
  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
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
    clearPolling();
    clearAutoClose();
    resolvePendingSignature(null);
    setQrModalData(null);
    setIsConnecting(false);
  }, [clearAutoClose, clearPolling, resolvePendingSignature]);

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
        setBalance({ xrp: data.xrp, tokens });
        return;
      }
      if (
        res.status === 404 &&
        String(data?.message || "")
          .toLowerCase()
          .includes("not activated")
      ) {
        setIsWalletActivated(false);
        setBalance({ xrp: 0, tokens: [] });
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

  // --- CONNECT via relay ---
  const connect = async () => {
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

      clearPolling();
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

      // Poll for connection result
      pollChallengeStatus(challengeId, "connect");
    } catch (error) {
      console.error("[NativeWallet] Connect error:", error);
      alert(`Connection failed: ${error.message}`);
      setIsConnecting(false);
    }
  };

  // --- SIGN TRANSACTION via relay ---
  const signTransaction = async (txjson, { action } = {}) => {
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

      clearPolling();
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

      // Wait for signature result (polling works for both desktop and mobile)
      return await new Promise((resolve) => {
        resolvePendingSignature(null);
        pendingSignatureResolveRef.current = resolve;
        pollChallengeStatus(challengeId, "sign");
      });
    } catch (error) {
      console.error("[NativeWallet] Sign error:", error);
      alert(`Signature failed: ${error.message}`);
      setIsConnecting(false);
      return null;
    }
  };

  // --- Poll challenge status (shared for connect and sign) ---
  const pollChallengeStatus = useCallback(
    (challengeId, mode) => {
      const maxAttempts = 150; // 5 minutes at 2s interval
      let attempts = 0;

      clearPolling();
      pollIntervalRef.current = setInterval(async () => {
        attempts++;
        if (attempts >= maxAttempts) {
          clearPolling();
          setIsConnecting(false);
          updateQrStatus("error");
          if (mode === "sign") resolvePendingSignature(null);
          return;
        }

        try {
          const res = await fetch(
            apiUrl(`/wallet-relay/status/${challengeId}`)
          );
          const data = await res.json();

          if (data.status === "completed" || data.status === "signed") {
            clearPolling();
            setIsConnecting(false);
            updateQrStatus("signed");

            if (mode === "connect" && data.result?.address) {
              // Brief delay so the user sees "Connecté !" before the
              // dashboard swap (updateWallet flips isConnected → wallet.jsx
              // swaps WalletConnectScreen for WalletDashboard).
              const addr = data.result.address;
              const addrs = data.result.addresses;
              setTimeout(() => {
                updateWallet(addr, addrs);
                closeQrModal();
              }, 1800);
            } else if (mode === "sign") {
              scheduleQrClose(2000);
              resolvePendingSignature({
                signed: true,
                ...data.result,
                uuid: challengeId,
              });
            } else {
              scheduleQrClose(2000);
            }
          } else if (data.status === "expired" || data.status === "error") {
            clearPolling();
            setIsConnecting(false);
            updateQrStatus("error");
            if (mode === "sign") resolvePendingSignature(null);
          }
        } catch (error) {
          console.error("[NativeWallet] Polling error:", error);
        }
      }, 2000);
    },
    [
      clearPolling,
      closeQrModal,
      resolvePendingSignature,
      scheduleQrClose,
      updateQrStatus,
      updateWallet,
    ]
  );

  const refreshBalance = () => {
    if (wallet) fetchBalance(wallet);
  };

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
