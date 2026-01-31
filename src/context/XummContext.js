/**
 * XummContext - Gestion connexion wallet XUMM
 * Version 2.0 avec vrai SDK et QR code
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import wsClient from "@/lib/xcannesWebSocket";
import { listCachedStatementKeys, setCachedStatement } from "@/lib/walletStatementCache";
import { decodeXrplCurrencyCode } from "@/utils/xrpl";

const XummContext = createContext();
const XUMM_PENDING_CONNECT_KEY = "xcannes_xumm_pending_connect";
const XUMM_TICKET_QUERY_KEY = "xummTicket";
const WALLET_SESSION_TOKEN_KEY = "xcannes_wallet_session_token";

function generateXummTicket() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `xumm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function appendTicketToUrl(url, ticket) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(XUMM_TICKET_QUERY_KEY, ticket);
    return parsed.toString();
  } catch (err) {
    return url;
  }
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobileUa = /android|iphone|ipad|ipod|mobile/i.test(ua);
  const isIpadOs = /Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
  return isMobileUa || isIpadOs;
}

function resolveXummLinks({ deepLink, uuid } = {}) {
  const raw = deepLink || (uuid ? `https://xumm.app/sign/${uuid}` : "");
  if (!raw) return { appLink: "", webLink: "" };

  const isScheme = /^xumm:\/\//i.test(raw) || /^xaman:\/\//i.test(raw);
  if (isScheme) {
    const webLink = raw.replace(/^xumm:\/\//i, "https://").replace(/^xaman:\/\//i, "https://");
    return { appLink: raw, webLink };
  }
  const scheme = /xaman/i.test(raw) ? "xaman://" : "xumm://";
  const appLink = raw.replace(/^https?:\/\//i, scheme);
  return { appLink, webLink: raw };
}

function preloadQrImage(url) {
  if (!url || typeof Image === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve(true);
    img.onload = done;
    img.onerror = done;
    img.src = url;
  });
}

async function tryOpenXummApp({ deepLink, uuid, timeoutMs = 3000 } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const { appLink } = resolveXummLinks({ deepLink, uuid });
  if (!appLink) return false;

  let didHide = false;
  const onVisibility = () => {
    if (document.hidden) {
      didHide = true;
    }
  };

  document.addEventListener("visibilitychange", onVisibility, { once: true });
  window.location.href = appLink;

  return new Promise((resolve) => {
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibility);
      resolve(didHide || document.hidden);
    }, timeoutMs);
  });
}

function getPendingConnectUuid() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(XUMM_PENDING_CONNECT_KEY);
  } catch (err) {
    return null;
  }
}

function setPendingConnectUuid(uuid) {
  if (typeof window === "undefined") return;
  try {
    if (uuid) {
      localStorage.setItem(XUMM_PENDING_CONNECT_KEY, uuid);
    }
  } catch (err) {
    // Ignore storage errors (private mode, etc.)
  }
}

function clearPendingConnectUuid() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(XUMM_PENDING_CONNECT_KEY);
  } catch (err) {
    // Ignore storage errors (private mode, etc.)
  }
}

function getSessionToken() {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(WALLET_SESSION_TOKEN_KEY);
  } catch (err) {
    return null;
  }
}

function setSessionToken(token) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      sessionStorage.setItem(WALLET_SESSION_TOKEN_KEY, token);
    }
  } catch (err) {
    // Ignore storage errors (private mode, etc.)
  }
}

function clearSessionToken() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(WALLET_SESSION_TOKEN_KEY);
  } catch (err) {
    // Ignore storage errors (private mode, etc.)
  }
}

export const XummProvider = ({ children }) => {
  const [wallet, setWallet] = useState("");
  const [walletSessionToken, setWalletSessionTokenState] = useState(() => getSessionToken());
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState(null);
  const [isWalletActivated, setIsWalletActivated] = useState(null); // null | boolean
  const [qrModalData, setQrModalData] = useState(null);
  const pollIntervalRef = useRef(null);
  const autoCloseTimeoutRef = useRef(null);
  const pendingSignatureResolveRef = useRef(null);
  const qrPreloadTokenRef = useRef(null);

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
    qrPreloadTokenRef.current = null;
    setQrModalData(null);
    setIsConnecting(false);
  }, [clearAutoClose, clearPolling, resolvePendingSignature]);

  const scheduleQrClose = useCallback((delayMs = 2000) => {
    clearAutoClose();
    autoCloseTimeoutRef.current = setTimeout(() => {
      closeQrModal();
    }, delayMs);
  }, [clearAutoClose, closeQrModal]);

  const showQrModalNow = useCallback(() => {
    setQrModalData((prev) => (prev ? { ...prev, visible: true } : prev));
  }, []);

  const showQrModalWhenReady = useCallback(
    async (qrUrl) => {
      if (!qrUrl) {
        showQrModalNow();
        return;
      }

      const token = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      qrPreloadTokenRef.current = token;
      await preloadQrImage(qrUrl);
      if (qrPreloadTokenRef.current !== token) return;
      showQrModalNow();
    },
    [showQrModalNow]
  );

  const fetchBalance = useCallback(
    async (address) => {
      try {
        const res = await fetch(apiUrl(`/xumm/balance?address=${address}`));
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
            tokens,
          });
          return;
        }

        // Backend returns 404 when XRPL account is not activated (actNotFound).
        if (
          res.status === 404 &&
          String(data?.message || "").toLowerCase().includes("not activated")
        ) {
          setIsWalletActivated(false);
          setBalance({ xrp: 0, tokens: [] });
          return;
        }
      } catch (error) {
        console.error("Fetch balance error:", error);
      }
    },
    []
  );

  const warmFullReplay = useCallback(async (address, sessionToken) => {
    if (!address || !sessionToken) return;
    try {
      const params = new URLSearchParams();
      params.set("address", address);
      params.set("limit", "100");
      params.set("forceFullReplay", "true");
      params.set("includeRaw", "true");
      params.set("source", "onchain");
      const url = apiUrl(`/wallet/statement?${params.toString()}`);
      const res = await fetch(url, {
        headers: { "x-wallet-session": sessionToken },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCachedStatement(url, data);
        const rawlessParams = new URLSearchParams(params);
        rawlessParams.delete("includeRaw");
        const rawlessUrl = apiUrl(`/wallet/statement?${rawlessParams.toString()}`);
        setCachedStatement(rawlessUrl, data);
      }
    } catch (error) {
      if (process.env.NEXT_PUBLIC_DEBUG_LOGS === "true") {
        console.warn("[wallet] full replay warmup failed:", error?.message || error);
      }
    }
  }, []);

  const refreshCachedStatementsForAddress = useCallback(async (address, sessionToken) => {
    if (!address || !sessionToken) return;
    const cacheKeys = listCachedStatementKeys();
    const targetKeys = cacheKeys.filter((key) => {
      if (!key.includes("/wallet/statement")) return false;
      if (!key.includes(`address=${encodeURIComponent(address)}`)) return false;
      if (key.includes("cursor=")) return false;
      return true;
    });

    const urls = targetKeys.length > 0
      ? targetKeys
      : (() => {
          const params = new URLSearchParams();
          params.set("address", address);
          params.set("limit", "100");
          params.set("source", "onchain");
          return [apiUrl(`/wallet/statement?${params.toString()}`)];
        })();

    for (const url of urls) {
      const fetchUrl = (() => {
        try {
          const parsed = new URL(url);
          if (!parsed.searchParams.has("includeRaw")) {
            parsed.searchParams.set("includeRaw", "true");
          }
          return parsed.toString();
        } catch {
          return url;
        }
      })();
      try {
        const res = await fetch(fetchUrl, {
          headers: { "x-wallet-session": sessionToken },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setCachedStatement(url, data);
        }
      } catch (error) {
        if (process.env.NEXT_PUBLIC_DEBUG_LOGS === "true") {
          console.warn("[wallet] cache refresh failed:", error?.message || error);
        }
      }
    }
  }, []);

  const updateWalletSession = useCallback(async (address, active, { xummUuid } = {}) => {
    if (!address) return;
    const endpoint = active ? "/wallet/session/connect" : "/wallet/session/disconnect";
    const payload = active
      ? { address, xummUuid: xummUuid || getPendingConnectUuid() }
      : { address, sessionToken: getSessionToken() };
    if (active && !payload.xummUuid) return;
    if (!active && !payload.sessionToken) return;
    try {
      const res = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && active && data.sessionToken) {
        setSessionToken(data.sessionToken);
        setWalletSessionTokenState(data.sessionToken);
        warmFullReplay(address, data.sessionToken);
      }
      if (res.ok && !active) {
        clearSessionToken();
        setWalletSessionTokenState(null);
      }
    } catch (error) {
      console.warn("Wallet session update failed:", error);
    }
  }, [warmFullReplay]);

  const updateWallet = useCallback(
    (account) => {
      if (account) {
        setWallet(account);
        setIsConnected(true);
        setIsWalletActivated(null);
        sessionStorage.setItem("xumm_wallet", account);
        fetchBalance(account);
        updateWalletSession(account, true);
      } else {
        setWallet("");
        setIsConnected(false);
        setBalance(null);
        setIsWalletActivated(null);
        sessionStorage.removeItem("xumm_wallet");
      }
    },
    [fetchBalance, updateWalletSession]
  );

  const walletWsRefreshRef = useRef(0);

  useEffect(() => {
    if (!wallet || !walletSessionToken) return;
    let cancelled = false;
    const address = wallet;
    const channelKey = `wallet:${address}`;

    wsClient
      .connect()
      .then(() => {
        if (cancelled) return;
        wsClient.subscribe("wallet", address);
      })
      .catch(() => {
        // best-effort only
      });

    const handleWalletUpdate = (message) => {
      if (cancelled) return;
      const channel = message?.channel;
      const data = message?.data || {};
      if (channel && channel !== channelKey) return;
      if (data?.address && data.address !== address) return;

      const now = Date.now();
      if (now - walletWsRefreshRef.current < 5000) return;
      walletWsRefreshRef.current = now;

      refreshCachedStatementsForAddress(address, walletSessionToken);
      fetchBalance(address);
    };

    wsClient.on("wallet", handleWalletUpdate);

    return () => {
      cancelled = true;
      wsClient.off("wallet", handleWalletUpdate);
      wsClient.unsubscribe("wallet", address);
    };
  }, [fetchBalance, refreshCachedStatementsForAddress, wallet, walletSessionToken]);

  const checkPendingConnect = useCallback(async () => {
    if (isConnected) {
      clearPendingConnectUuid();
      return;
    }

    const pendingUuid = getPendingConnectUuid();
    if (!pendingUuid) return;

    try {
      const res = await fetch(apiUrl(`/xumm/check?uuid=${pendingUuid}`));
      const data = await res.json();

      if (data.signed && data.wallet) {
        clearPolling();
        updateWallet(data.wallet);
        clearPendingConnectUuid();
        setIsConnecting(false);
        updateQrStatus("signed");
        scheduleQrClose(2000);
        return;
      }

      if (data.expired) {
        clearPolling();
        clearPendingConnectUuid();
        setIsConnecting(false);
        updateQrStatus("error");
        showQrModalNow();
        return;
      }

      if (qrModalData?.visible === false) {
        showQrModalWhenReady(qrModalData?.qrUrl);
      }
    } catch (error) {
      console.error("Pending connect check error:", error);
    }
  }, [
    clearPolling,
    isConnected,
    qrModalData?.qrUrl,
    qrModalData?.visible,
    scheduleQrClose,
    showQrModalNow,
    showQrModalWhenReady,
    updateQrStatus,
    updateWallet,
  ]);

  /**
   * Connecter via QR code XUMM (nouvelle méthode)
   */
  const connect = async () => {
    setIsConnecting(true);
    try {
      const ticket = generateXummTicket();
      const returnUrl = appendTicketToUrl(window.location.href, ticket);
      // Appeler l'API pour créer un payload XUMM
      const res = await fetch(apiUrl('/xumm/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "wallet:session:connect",
          returnUrl,
          ticket,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create XUMM connection');
      }

      const isMobile = isMobileDevice();

      // Préparer les données pour le QR (affichage si besoin)
      clearPolling();
      clearAutoClose();
      setQrModalData({
        uuid: data.uuid,
        qrUrl: data.qrUrl,
        deepLink: data.deepLink,
        type: 'connect',
        status: 'waiting',
        visible: false,
      });
      setPendingConnectUuid(data.uuid);

      // Attendre la signature
      pollConnection(data.uuid);

      if (isMobile) {
        const opened = await tryOpenXummApp({ deepLink: data.deepLink, uuid: data.uuid });
        if (!opened) {
          showQrModalWhenReady(data.qrUrl);
        }
      } else {
        showQrModalWhenReady(data.qrUrl);
      }
    } catch (error) {
      console.error('XUMM connect error:', error);
      alert(`Connection failed: ${error.message}`);
      setIsConnecting(false);
    }
  };

  /**
   * Polling pour vérifier la connexion
   */
  const pollConnection = useCallback(async (uuid) => {
    const maxAttempts = 150; // 5 minutes (2s interval)
    let attempts = 0;

    clearPolling();
    pollIntervalRef.current = setInterval(async () => {
      attempts++;

      if (attempts >= maxAttempts) {
        clearPolling();
        setIsConnecting(false);
        clearPendingConnectUuid();
        updateQrStatus("error");
        return;
      }

      try {
        const res = await fetch(apiUrl(`/xumm/check?uuid=${uuid}`));
        const data = await res.json();

        if (data.signed && data.wallet) {
          clearPolling();
          updateWallet(data.wallet);
          clearPendingConnectUuid();
          setIsConnecting(false);
          updateQrStatus("signed");
          scheduleQrClose(2000);
        } else if (data.expired) {
          clearPolling();
          clearPendingConnectUuid();
          setIsConnecting(false);
          updateQrStatus("error");
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  }, [clearPolling, scheduleQrClose, updateQrStatus, updateWallet]);

  /**
   * Rafraîchir le solde
   */
  const refreshBalance = () => {
    if (wallet) {
      fetchBalance(wallet);
    }
  };

  /**
   * Signer une transaction
   */
  const signTransaction = async (txjson, { action } = {}) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return null;
    }

    setIsConnecting(true);
    try {
      const payload = {
        txjson,
        ...(action ? { action } : {}),
      };

      const res = await fetch(apiUrl('/xumm/sign'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create signature request');
      }

      // Afficher le modal QR code
      clearPolling();
      clearAutoClose();
      setQrModalData({
        uuid: data.uuid,
        qrUrl: data.qrUrl,
        deepLink: data.deepLink,
        type: 'sign',
        status: 'waiting',
        visible: false,
      });

      showQrModalWhenReady(data.qrUrl);

      // Attendre la signature
      return await pollSignature(data.uuid);
    } catch (error) {
      console.error('Sign transaction error:', error);
      alert(`Signature failed: ${error.message}`);
      setIsConnecting(false);
      return null;
    }
  };

  /**
   * Polling pour vérifier la signature
   */
  const pollSignature = async (uuid) => {
    return new Promise((resolve) => {
      const maxAttempts = 150;
      let attempts = 0;

      resolvePendingSignature(null);
      pendingSignatureResolveRef.current = resolve;
      clearPolling();
      pollIntervalRef.current = setInterval(async () => {
        attempts++;

        if (attempts >= maxAttempts) {
          clearPolling();
          setIsConnecting(false);
          updateQrStatus("error");
          resolvePendingSignature(null);
          return;
        }

        try {
          const res = await fetch(apiUrl(`/xumm/check?uuid=${uuid}`));
          const data = await res.json();

          if (data.signed) {
            clearPolling();
            setIsConnecting(false);
            updateQrStatus("signed");
            scheduleQrClose(2000);
            resolvePendingSignature({ ...data, uuid });
          } else if (data.expired) {
            clearPolling();
            setIsConnecting(false);
            updateQrStatus("error");
            resolvePendingSignature(null);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 2000);
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const ticket = url.searchParams.get(XUMM_TICKET_QUERY_KEY);
    if (!ticket || isConnected) {
      if (ticket) {
        url.searchParams.delete(XUMM_TICKET_QUERY_KEY);
        window.history.replaceState({}, document.title, url.toString());
      }
      return;
    }

    url.searchParams.delete(XUMM_TICKET_QUERY_KEY);
    window.history.replaceState({}, document.title, url.toString());

    const resolveTicket = async () => {
      setIsConnecting(true);
      clearPolling();
      clearAutoClose();
      updateQrStatus("waiting");

      try {
        const res = await fetch(
          apiUrl(`/xumm/resolve?ticket=${encodeURIComponent(ticket)}`)
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.uuid) {
          setIsConnecting(false);
          return;
        }

        setPendingConnectUuid(data.uuid);
        setQrModalData({
          uuid: data.uuid,
          qrUrl: null,
          deepLink: null,
          type: "connect",
          status: "waiting",
          visible: false,
        });

        const statusRes = await fetch(
          apiUrl(`/xumm/check?uuid=${encodeURIComponent(data.uuid)}`)
        );
        const statusData = await statusRes.json().catch(() => ({}));

        if (statusRes.ok && statusData.signed && statusData.wallet) {
          updateWallet(statusData.wallet);
          clearPendingConnectUuid();
          setIsConnecting(false);
          updateQrStatus("signed");
          scheduleQrClose(2000);
          return;
        }

        if (statusData.expired) {
          clearPendingConnectUuid();
          setIsConnecting(false);
          updateQrStatus("error");
          showQrModalNow();
          return;
        }

        showQrModalNow();
        pollConnection(data.uuid);
      } catch (error) {
        console.error("Ticket resolve error:", error);
        setIsConnecting(false);
        showQrModalNow();
      }
    };

    resolveTicket();
  }, [
    clearAutoClose,
    clearPolling,
    isConnected,
    pollConnection,
    scheduleQrClose,
    showQrModalNow,
    showQrModalWhenReady,
    updateQrStatus,
    updateWallet,
  ]);

  const disconnect = useCallback(async () => {
    if (wallet) {
      await updateWalletSession(wallet, false);
    }
    clearPendingConnectUuid();
    clearSessionToken();
    setWalletSessionTokenState(null);
    updateWallet(null);
  }, [updateWallet, updateWalletSession, wallet]);

  useEffect(() => {
    // Récupère le wallet sauvegardé si existe
    const savedWallet = sessionStorage.getItem("xumm_wallet");
    if (savedWallet) {
      updateWallet(savedWallet);
    }
  }, [updateWallet]);

  useEffect(() => {
    checkPendingConnect();

    const handleVisibility = () => {
      if (document.hidden) return;
      checkPendingConnect();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }
  }, [checkPendingConnect]);

  return (
    <XummContext.Provider value={{ 
      wallet, 
      walletSessionToken,
      isConnected, 
      isConnecting,
      balance,
      isWalletActivated,
      qrModalData,
      connect, 
      disconnect,
      refreshBalance,
      signTransaction,
      closeQrModal,
    }}>
      {children}
    </XummContext.Provider>
  );
};

export const useXumm = () => useContext(XummContext);
