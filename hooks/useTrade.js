import { useState, useCallback, useEffect, useMemo } from "react";
import { useXumm } from "../context/XummContext";
import { getBookIdFromPair } from "../utils/xrpl";

/**
 * Hook personnalisé pour gérer toute la logique de trading (TradeBox)
 * Version 2.0 avec vrais soldes XRPL
 */
export default function useTrade(pair, currentPrice = 0.00001) {
  const { isConnected, wallet, balance, refreshBalance, signTransaction } = useXumm();
  const [baseSymbol, counterSymbol] = useMemo(() => {
    if (!pair) return ["", ""];
    const [base, counter] = pair.split("/");
    return [base || "", counter || ""];
  }, [pair]);

  const pairMetadata = useMemo(() => {
    if (!pair) return null;
    return getBookIdFromPair(pair);
  }, [pair]);

  const baseAsset = pairMetadata?.taker_gets || null;
  const counterAsset = pairMetadata?.taker_pays || null;

  const [mode, setMode] = useState("BUY");
  const [orderType, setOrderType] = useState("market");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState(currentPrice);
  const [isProcessing, setIsProcessing] = useState(false);

  const normalizeCurrencyCode = useCallback((code) => {
    if (!code || code === "XRP") return code;
    if (code.length === 40 && /^[0-9A-F]+$/i.test(code)) {
      try {
        let ascii = "";
        for (let i = 0; i < code.length; i += 2) {
          const chunk = code.substring(i, i + 2);
          const value = parseInt(chunk, 16);
          if (!Number.isFinite(value) || value === 0) continue;
          ascii += String.fromCharCode(value);
        }
        return ascii.trim() || code;
      } catch (error) {
        console.warn("Impossible de décoder la devise XRPL:", error);
        return code;
      }
    }
    return code;
  }, []);

  const findTokenBalance = useCallback(
    (symbol, issuer) => {
      if (!balance?.tokens || !symbol) return 0;
      return balance.tokens.reduce((acc, token) => {
        const tokenCurrency = normalizeCurrencyCode(token.currency);
        const tokenIssuer = token.issuer || null;
        if (tokenCurrency === symbol && (!issuer || issuer === tokenIssuer)) {
          const value = parseFloat(token.value);
          return Number.isFinite(value) ? value : acc;
        }
        return acc;
      }, 0);
    },
    [balance, normalizeCurrencyCode]
  );

  const spendableBalance = useMemo(() => {
    if (!balance) return 0;
    if (mode === "BUY") {
      if (counterSymbol === "XRP") {
        return balance.xrp || 0;
      }
      return findTokenBalance(counterSymbol, counterAsset?.issuer || null);
    }
    // SELL mode
    if (baseSymbol === "XRP") {
      return balance.xrp || 0;
    }
    return findTokenBalance(baseSymbol, baseAsset?.issuer || null);
  }, [balance, mode, baseSymbol, counterSymbol, baseAsset, counterAsset, findTokenBalance]);

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
  const effectivePrice = useMemo(() => {
    const value = orderType === "market" ? currentPrice : price;
    return Number.isFinite(value) ? value : 0;
  }, [currentPrice, orderType, price]);

  const total = useMemo(() => {
    const baseAmount = parseFloat(amount);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) return "0.00";
    if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) return "0.00";
    return (baseAmount * effectivePrice).toFixed(6);
  }, [amount, effectivePrice]);

  /**
   * Définit le montant basé sur un pourcentage du solde
   */
  const setPercent = useCallback(
    (percentage) => {
      if (percentage <= 0) {
        setAmount("");
        return;
      }
      const ratio = percentage / 100;
      if (mode === "BUY") {
        if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) return;
        const counterValue = spendableBalance * ratio;
        const baseValue = counterValue / effectivePrice;
        if (!Number.isFinite(baseValue) || baseValue <= 0) {
          setAmount("");
          return;
        }
        setAmount(baseValue.toFixed(4));
      } else {
        const baseValue = spendableBalance * ratio;
        if (!Number.isFinite(baseValue) || baseValue <= 0) {
          setAmount("");
          return;
        }
        setAmount(baseValue.toFixed(4));
      }
    },
    [mode, spendableBalance, effectivePrice]
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

    if (!pairMetadata || !baseAsset || !counterAsset) {
      alert("Paire non supportée pour la création d'ordre.");
      return;
    }

    if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) {
      alert("Prix invalide pour cette paire.");
      return;
    }

    const baseAmount = parseFloat(amount);
    const counterAmount = baseAmount * effectivePrice;
    if (!Number.isFinite(baseAmount) || !Number.isFinite(counterAmount)) {
      alert("Montant invalide.");
      return;
    }

    const requiredBalance = mode === "BUY" ? counterAmount : baseAmount;
    if (requiredBalance > spendableBalance + 1e-12) {
      alert(`Solde insuffisant. Disponible: ${spendableBalance.toFixed(4)}`);
      return;
    }

    setIsProcessing(true);

    try {
      const orderData = {
        mode,
        orderType,
        amount: baseAmount,
        price: effectivePrice,
        pair,
        wallet,
        timestamp: new Date().toISOString(),
      };

      console.log("📊 Ordre placé:", orderData);

      const formatAmount = (asset, value) => {
        if (!asset) return null;
        if (asset.currency === "XRP" && !asset.issuer) {
          return Math.round(value * 1_000_000).toString();
        }
        const normalizedValue = Number.isFinite(value) ? value : 0;
        const decimalString = normalizedValue
          .toFixed(8)
          .replace(/\.?0+$/, "");
        return {
          currency: asset.currency,
          issuer: asset.issuer,
          value: decimalString === "" ? "0" : decimalString,
        };
      };

      const txjson = {
        TransactionType: "OfferCreate",
        Account: wallet,
        TakerPays:
          mode === "BUY"
            ? formatAmount(counterAsset, counterAmount)
            : formatAmount(baseAsset, baseAmount),
        TakerGets:
          mode === "BUY"
            ? formatAmount(baseAsset, baseAmount)
            : formatAmount(counterAsset, counterAmount),
      };

      if (!txjson.TakerPays || !txjson.TakerGets) {
        throw new Error("Impossible de construire la transaction XRPL pour cette paire.");
      }

      // Signer avec XUMM
      const result = await signTransaction(txjson);

      if (result && result.signed) {
        alert("✅ Ordre placé avec succès!");
        setAmount("");
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
  }, [
    isConnected,
    amount,
    pair,
    pairMetadata,
    baseAsset,
    counterAsset,
    effectivePrice,
    mode,
    spendableBalance,
    wallet,
    signTransaction,
    refreshBalance,
  ]);

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
    balance: spendableBalance, // Solde dans la devise pertinente

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
