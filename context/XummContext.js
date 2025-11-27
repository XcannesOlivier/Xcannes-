/**
 * XummContext - Gestion connexion wallet XUMM
 * Version 2.0 avec vrai SDK et QR code
 */

import { createContext, useContext, useEffect, useState } from "react";

const XummContext = createContext();
const API_BASE = (process.env.NEXT_PUBLIC_XCANNES_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;

export const XummProvider = ({ children }) => {
  const [wallet, setWallet] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState(null);
  const [qrModalData, setQrModalData] = useState(null);

  const updateWallet = (account) => {
    if (account) {
      setWallet(account);
      setIsConnected(true);
      sessionStorage.setItem("xumm_wallet", account);
      // Charger le solde
      fetchBalance(account);
    } else {
      setWallet("");
      setIsConnected(false);
      setBalance(null);
      sessionStorage.removeItem("xumm_wallet");
    }
  };

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
        } else if (data.expired) {
          clearInterval(interval);
          setIsConnecting(false);
          setQrModalData(null);
          alert('Connection expired. Please try again.');
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  };

  /**
   * Récupérer les soldes XRPL
   */
  const fetchBalance = async (address) => {
    try {
      const res = await fetch(apiUrl(`/xumm/balance?address=${address}`));
      const data = await res.json();

      if (res.ok) {
        setBalance({
          xrp: data.xrp,
          tokens: data.tokens,
        });
      }
    } catch (error) {
      console.error('Fetch balance error:', error);
    }
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
  const signTransaction = async (txjson) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return null;
    }

    setIsConnecting(true);
    try {
      const res = await fetch(apiUrl('/xumm/sign'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txjson }),
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
            resolve(data);
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
  }, []);

  return (
    <XummContext.Provider value={{ 
      wallet, 
      isConnected, 
      isConnecting,
      balance,
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
