/**
 * XummContext - Gestion connexion wallet XUMM
 * Version 2.0 avec vrai SDK et QR code
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import { decodeXrplCurrencyCode } from "@/utils/xrpl";

const XummContext = createContext();
const XUMM_PENDING_CONNECT_KEY = "xcannes_xumm_pending_connect";

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

export const XummProvider = ({ children }) => {
  const [wallet, setWallet] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState(null);
  const [isWalletActivated, setIsWalletActivated] = useState(null); // null | boolean
  const [qrModalData, setQrModalData] = useState(null);

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

  const updateWallet = useCallback(
    (account) => {
      if (account) {
        setWallet(account);
        setIsConnected(true);
        setIsWalletActivated(null);
        sessionStorage.setItem("xumm_wallet", account);
        fetchBalance(account);
      } else {
        setWallet("");
        setIsConnected(false);
        setBalance(null);
        setIsWalletActivated(null);
        sessionStorage.removeItem("xumm_wallet");
      }
    },
    [fetchBalance]
  );

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
        updateWallet(data.wallet);
        clearPendingConnectUuid();
        setIsConnecting(false);
        setQrModalData(null);
        return;
      }

      if (data.expired) {
        clearPendingConnectUuid();
        setIsConnecting(false);
        setQrModalData(null);
      }
    } catch (error) {
      console.error("Pending connect check error:", error);
    }
  }, [isConnected, updateWallet]);

  /**
   * Connecter via QR code XUMM (nouvelle méthode)
   */
  const connect = async () => {
    setIsConnecting(true);
    try {
      // Appeler l'API pour créer un payload XUMM
      const res = await fetch(apiUrl('/xumm/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create XUMM connection');
      }

      // Afficher le modal QR code
      setQrModalData({
        uuid: data.uuid,
        qrUrl: data.qrUrl,
        deepLink: data.deepLink,
        type: 'connect',
      });
      setPendingConnectUuid(data.uuid);

      // Attendre la signature
      pollConnection(data.uuid);
    } catch (error) {
      console.error('XUMM connect error:', error);
      alert(`Connection failed: ${error.message}`);
      setIsConnecting(false);
    }
  };

  /**
   * Polling pour vérifier la connexion
   */
  const pollConnection = async (uuid) => {
    const maxAttempts = 150; // 5 minutes (2s interval)
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setIsConnecting(false);
        setQrModalData(null);
        return;
      }

      try {
        const res = await fetch(apiUrl(`/xumm/check?uuid=${uuid}`));
        const data = await res.json();

        if (data.signed && data.wallet) {
          clearInterval(interval);
          updateWallet(data.wallet);
          setIsConnecting(false);
          setQrModalData(null);
          clearPendingConnectUuid();
        } else if (data.expired) {
          clearInterval(interval);
          setIsConnecting(false);
          setQrModalData(null);
          clearPendingConnectUuid();
          alert('Connection expired. Please try again.');
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  };

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
      setQrModalData({
        uuid: data.uuid,
        qrUrl: data.qrUrl,
        deepLink: data.deepLink,
        type: 'sign',
      });

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

      const interval = setInterval(async () => {
        attempts++;

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsConnecting(false);
          setQrModalData(null);
          resolve(null);
          return;
        }

        try {
          const res = await fetch(apiUrl(`/xumm/check?uuid=${uuid}`));
          const data = await res.json();

          if (data.signed) {
            clearInterval(interval);
            setIsConnecting(false);
            setQrModalData(null);
            resolve({ ...data, uuid });
          } else if (data.expired) {
            clearInterval(interval);
            setIsConnecting(false);
            setQrModalData(null);
            alert('Signature expired. Please try again.');
            resolve(null);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 2000);
    });
  };

  const disconnect = () => {
    clearPendingConnectUuid();
    updateWallet(null);
  };

  const closeQrModal = () => {
    setQrModalData(null);
    setIsConnecting(false);
  };

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
