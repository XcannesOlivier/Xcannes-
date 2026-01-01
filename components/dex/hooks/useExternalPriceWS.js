"use client";

import { useState, useEffect } from "react";
import { useXcannesWS } from "../../../context/XcannesWSContext";

/**
 * 🌐 Prix externe en temps réel (Pyth) via WebSocket.
 * @param {string|null} pair - "EUR/USD", "BTC/USD", "XAU/USD" ou "EUR_USD"
 */
export function useExternalPriceWS(pair) {
  const { externalPrices, externalPricesVersion, connected } = useXcannesWS();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const symbol = pair ? pair.replace("/", "_").toUpperCase() : null;

  useEffect(() => {
    if (!symbol) {
      setLoading(false);
      setError("Symbole manquant");
      return;
    }

    if (!connected) {
      setError("WebSocket déconnecté");
      return;
    }

    if (externalPrices instanceof Map && externalPrices.has(symbol)) {
      setLoading(false);
      setError(null);
      return;
    }

    const timeout = setTimeout(() => {
      if (!externalPrices.has(symbol)) {
        setError("Prix non disponible");
        setLoading(false);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [symbol, connected, externalPrices, externalPricesVersion]);

  const priceData =
    symbol && externalPrices instanceof Map
      ? externalPrices.get(symbol)
      : null;

  const price = priceData
    ? Number(priceData.midPrice || priceData.price || 0)
    : null;

  return {
    price,
    loading: loading && !priceData,
    error: priceData ? null : error,
    data: priceData,
    connected,
    symbol,
  };
}

/**
 * Prix multiples externes en temps réel.
 * @param {Array<{pair: string}>} pairs
 */
export function useMultipleExternalPricesWS(pairs) {
  const { externalPrices, connected } = useXcannesWS();
  const [prices, setPrices] = useState(new Map());

  useEffect(() => {
    if (!pairs || pairs.length === 0) {
      setPrices(new Map());
      return;
    }

    const next = new Map();
    pairs.forEach(({ pair }) => {
      const symbol = pair.replace("/", "_").toUpperCase();
      const data =
        externalPrices instanceof Map ? externalPrices.get(symbol) : null;
      if (data) {
        next.set(symbol, {
          ...data,
          price: Number(data.midPrice || data.price || 0),
        });
      }
    });

    setPrices(next);
  }, [pairs, externalPrices, connected]);

  return { prices, connected, count: prices.size };
}

export default useExternalPriceWS;
