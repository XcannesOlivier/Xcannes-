import { useState, useCallback, useEffect, useMemo } from "react";
import { useXumm } from "../context/XummContext";

/**
 * Hook personnalisé pour gérer toute la logique de trading (TradeBox)
 * Version 2.0 avec vrais soldes XRPL
 */
export default function useTrade(pair, currentPrice = 0.00001) {
  const { isConnected, wallet, balance, refreshBalance, signTransaction } = useXumm();

  // États de la TradeBox
  const [mode, setMode] = useState("BUY");
  const [orderType, setOrderType] = useState("market");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState(currentPrice);
  const [isProcessing, setIsProcessing] = useState(false);

  // Balance : utiliser le vrai solde du contexte XUMM
  const getBalance = useCallback(() => {
    if (!balance) return 0;

    // En mode BUY : retourner le solde XRP
    if (mode === "BUY") {
      return balance.xrp || 0;
    }

    // En mode SELL : retourner le solde du token (ex: XCS)
    if (pair && balance.tokens) {
      const token = balance.tokens.find(t => 
        t.currency === pair.base // ex: "XCS"
      );
      return token ? parseFloat(token.value) : 0;
    }

    return 0;
  }, [balance, mode, pair]);

  const userBalance = getBalance();

  // Synchronisation automatique : si orderType = "market", le prix suit currentPrice
  useEffect(() => {
    if (orderType === "market") {
      setPrice(currentPrice);
    }
  }, [currentPrice, orderType]);

  /**
   * Calcule le total de l'ordre (memoized pour performance)
   * Total se recalcule automatiquement quand amount ou price change
   */
  const total = useMemo(() => {
    const val = parseFloat(amount);
    if (!val || isNaN(val)) return "0.00";
    const currentPriceValue = orderType === "market" ? currentPrice : price;
    return (val * currentPriceValue).toFixed(6);
  }, [amount, price, currentPrice, orderType]);

  /**
   * Définit le montant basé sur un pourcentage du solde
   */
  const setPercent = useCallback(
    (percentage) => {
      const val = ((userBalance * percentage) / 100).toFixed(2);
      setAmount(val);
    },
    [userBalance]
  );

  /**
   * Place un ordre (market ou limit)
   * Version 2.0 avec vraie signature XUMM
   */
  const placeOrder = useCallback(async () => {
    if (!isConnected) {
      alert("Veuillez connecter votre wallet XUMM");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert("Veuillez entrer un montant valide");
      return;
    }

    if (parseFloat(amount) > userBalance) {
      alert(`Solde insuffisant. Vous avez ${userBalance.toFixed(2)}`);
      return;
    }

    setIsProcessing(true);

    try {
      const orderData = {
        mode,
        orderType,
        amount: parseFloat(amount),
        price: orderType === "limit" ? parseFloat(price) : currentPrice,
        pair,
        wallet,
        timestamp: new Date().toISOString(),
      };

      console.log("📊 Ordre placé:", orderData);

      // Créer la transaction XRPL OfferCreate
      const txjson = {
        TransactionType: "OfferCreate",
        Account: wallet,
        TakerPays: mode === "BUY" ? {
          currency: pair.base, // ex: "XCS"
          value: orderData.amount.toString(),
          issuer: pair.baseIssuer,
        } : (orderData.amount * orderData.price * 1000000).toString(), // XRP en drops
        TakerGets: mode === "BUY" ? 
          (orderData.amount * orderData.price * 1000000).toString() : // XRP en drops
          {
            currency: pair.base,
            value: orderData.amount.toString(),
            issuer: pair.baseIssuer,
          },
      };

      // Signer avec XUMM
      const result = await signTransaction(txjson);

      if (result && result.signed) {
        alert("✅ Ordre placé avec succès!");
        setAmount("");
        // Rafraîchir le solde
        if (refreshBalance) {
          refreshBalance();
        }
      } else {
        alert("❌ Transaction annulée ou expirée");
      }
    } catch (error) {
      console.error("Erreur ordre:", error);
      alert("❌ Erreur: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  }, [isConnected, amount, userBalance, mode, orderType, price, currentPrice, pair, wallet, signTransaction, refreshBalance]);

  /**
   * Change le mode (BUY/SELL)
   */
  const toggleMode = useCallback((newMode) => {
    setMode(newMode);
  }, []);

  /**
   * Change le type d'ordre (market/limit)
   */
  const toggleOrderType = useCallback((newType) => {
    setOrderType(newType);
  }, []);

  /**
   * Met à jour le prix (pour les ordres limit)
   */
  const updatePrice = useCallback((newPrice) => {
    setPrice(newPrice);
  }, []);

  /**
   * Met à jour le montant
   */
  const updateAmount = useCallback((newAmount) => {
    setAmount(newAmount);
  }, []);

  /**
   * Reset tous les champs
   */
  const reset = useCallback(() => {
    setAmount("");
    setPrice(currentPrice);
    setOrderType("market");
  }, [currentPrice]);

  return {
    // États
    mode,
    orderType,
    amount,
    price,
    total, // Total calculé automatiquement
    isProcessing,
    isConnected,
    balance: userBalance, // Vrai solde XRPL

    // Fonctions
    setPercent,
    placeOrder,
    toggleMode,
    toggleOrderType,
    updatePrice,
    updateAmount,
    reset,
  };
}
