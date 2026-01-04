"use client";

	import { useEffect } from "react";
	import xcannesApi from "@/lib/xcannesApi";
	import { extractPercentChange } from "@/utils/marketStats";

// Gère la mise à jour live via ticker (prix, stats 24h, %)
export function useLiveTickerData({
  tickerKey,
  pair,
  isXRPL,
  isFxMode,
  tickers,
  updateCurrentCandle,
  setCurrentPrice,
  setStats24h,
  setPriceChange,
  setPercent24h,
}) {
  useEffect(() => {
    if (!tickerKey) return undefined;

    let tickerInterval;

    const updateFromTicker = async () => {
      const ticker = tickerKey ? tickers?.get?.(tickerKey) : null;

      const applyFromSource = (src) => {
        if (!src) return null;

        // Prix courant – pour XRPL on suit le ticker backend
        if (isXRPL && !isFxMode) {
          const priceSource =
            src.lastPrice ??
            src.price ??
            src.midPrice ??
            src.bidPrice ??
            src.askPrice;
          const priceNum =
            priceSource !== undefined && priceSource !== null
              ? Number(priceSource)
              : null;
          if (Number.isFinite(priceNum) && priceNum > 0) {
            setCurrentPrice(priceNum);
            updateCurrentCandle(priceNum);
          }
        }

        // Stats 24h si disponibles dans le ticker
        const highSource =
          src.high24h ??
          src.high_price ??
          src.highPrice ??
          src.high;
        const lowSource =
          src.low24h ??
          src.low_price ??
          src.lowPrice ??
          src.low;
        const volumeSource =
          src.volume24h ??
          src.volume ??
          src.quoteVolume ??
          src.quote_volume;

        const highNum =
          highSource !== undefined && highSource !== null
            ? Number(highSource)
            : null;
        const lowNum =
          lowSource !== undefined && lowSource !== null
            ? Number(lowSource)
            : null;
        const volumeNum =
          volumeSource !== undefined && volumeSource !== null
            ? Number(volumeSource)
            : null;

        if (
          Number.isFinite(highNum) ||
          Number.isFinite(lowNum) ||
          Number.isFinite(volumeNum)
        ) {
          // Pour éviter les clignotements dans le footer,
          // on laisse les stats 24h principales (high/low/volume)
          // provenir de l'historique de bougies (useMarketData).
          // Ici on ne met plus à jour setStats24h pour les marchés live.
          // setStats24h reste disponible pour des cas spécifiques si besoin.
        }

        const change = extractPercentChange(src);
        if (!change) return null;

        setPriceChange({
          value: change.value,
          percent: change.percent,
        });

        setPercent24h((prev) => {
          if (
            prev &&
            typeof prev.percent === "number" &&
            Math.abs(prev.percent) > 0.05 &&
            Math.abs(change.percent) < 0.01
          ) {
            return prev;
          }
          return {
            value: change.value,
            percent: change.percent,
          };
        });
        return true;
      };

      if (applyFromSource(ticker)) {
        return;
      }
      try {
        const res = await xcannesApi.getTicker(tickerKey || pair);
        applyFromSource(res);
      } catch {
        // silencieux
      }
    };

    updateFromTicker();
    // Rafraîchissement plus réactif des tickers (0.2s)
    tickerInterval = setInterval(updateFromTicker, 200);

    return () => clearInterval(tickerInterval);
  }, [
    tickerKey,
    pair,
    tickers,
    isXRPL,
    isFxMode,
    updateCurrentCandle,
    setCurrentPrice,
    setStats24h,
    setPriceChange,
    setPercent24h,
  ]);
}
