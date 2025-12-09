"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBookIdFromPair } from "../../../utils/xrpl";
import xcannesApi from "../../../lib/xcannesApi";
import { getPairCategory } from "../../../utils/marketStructure";
import { useXcannesWS } from "../../../context/XcannesWSContext";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const logError = (...args) => {
  if (DEBUG_LOGS) console.error(...args);
};

// Hook responsable des données: fetch historique, live, FX EOD, stats 24h, bougie courante
export default function useMarketData({ pair, interval, isFxMode, fxBase, fxQuote }) {
  const [loading, setLoading] = useState(true);
  const [noDataMessage, setNoDataMessage] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState({ value: 0, percent: 0 });
  const [percent24h, setPercent24h] = useState({ value: 0, percent: 0 });
  const [stats24h, setStats24h] = useState({ high: null, low: null, volume: null });
  const [candles, setCandles] = useState([]);

  const { connected, orderbooks, externalPrices, externalPricesVersion, subscribe, unsubscribe, tickers } =
    useXcannesWS();

  const pairCategory = useMemo(() => getPairCategory(pair), [pair]);
  const isXRPL = pairCategory === "xrpl";
  const isExternal = pairCategory === "pyth";
  const isFawaz = pairCategory === "fawaz";
  const backendBook = useMemo(() => getBookIdFromPair(pair), [pair]);
  const tickerKey = useMemo(() => {
    if (isExternal || isFawaz) return pair?.replace("/", "_");
    return backendBook?.backendPair || pair;
  }, [backendBook, isExternal, isFawaz, pair]);

  // Refs pour la bougie courante
  const currentCandleRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const intervalSecondsRef = useRef(60);
  const reloadIntervalRef = useRef(null);

  const intervalMap = useMemo(
    () => ({
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "1h",
      "4h": "4h",
      "1d": "1d",
    }),
    []
  );

  const getIntervalSeconds = useCallback((itv) => {
    const map = {
      "1m": 60,
      "5m": 300,
      "15m": 900,
      "1h": 3600,
      "4h": 14400,
      "1d": 86400,
    };
    return map[itv] || 3600;
  }, []);

  // Mise à jour de l’intervalle en secondes pour la bougie courante
  useEffect(() => {
    intervalSecondsRef.current = getIntervalSeconds(interval);
  }, [interval, getIntervalSeconds]);

  const updateCurrentCandle = useCallback(
    (midPrice) => {
      if (!midPrice) return;
      const now = Math.floor(Date.now() / 1000);
      const intervalSeconds = intervalSecondsRef.current;
      const currentCandleTime = Math.floor(now / intervalSeconds) * intervalSeconds;
      const lastUpdate = lastUpdateTimeRef.current;

      const existing = currentCandleRef.current;

      // Si on change d’intervalle ou qu’aucune bougie courante n’existe, créer une nouvelle bougie
      if (!existing || existing.time !== currentCandleTime) {
        currentCandleRef.current = {
          time: currentCandleTime,
          open: midPrice,
          high: midPrice,
          low: midPrice,
          close: midPrice,
        };
      } else {
        currentCandleRef.current = {
          ...existing,
          high: Math.max(existing.high, midPrice),
          low: Math.min(existing.low, midPrice),
          close: midPrice,
        };
      }

      lastUpdateTimeRef.current = now;

      // Fusionner dans les données affichées
      if (currentCandleRef.current) {
        const current = currentCandleRef.current;
        setCandles((prev) => {
          if (!prev.length) return prev;
          const last = prev[prev.length - 1];
          if (!last || last.time == null) return prev;
          const withoutLast = prev.slice(0, -1);
          if (last.time === current.time) {
            return [...withoutLast, current];
          }
          return [...prev, current];
        });
      }
    },
    []
  );

  // Abonnement WS XRPL
  useEffect(() => {
    if (!isXRPL || isFxMode) return;
    if (!backendBook || !connected) return;
    subscribe("orderbook", backendBook.backendPair);
    return () => unsubscribe("orderbook", backendBook.backendPair);
  }, [backendBook, isXRPL, isFxMode, connected, subscribe, unsubscribe]);

  // Abonnement WS Pyth
  useEffect(() => {
    if (!isExternal || isFawaz || !connected || isFxMode) return;
    const symbol = pair.replace("/", "_");
    subscribe("pyth", symbol);
    return () => unsubscribe("pyth", symbol);
  }, [pair, isExternal, isFawaz, connected, subscribe, unsubscribe, isFxMode]);

  // Mise à jour des prix live via WS
  useEffect(() => {
    if (isFxMode) return;

    if (isXRPL && orderbooks) {
      const ob = backendBook ? orderbooks.get(backendBook.backendPair) : null;
      const bestAsk = ob?.asks?.[0]?.price;
      const bestBid = ob?.bids?.[0]?.price;
      const askNum = bestAsk != null ? parseFloat(bestAsk) : null;
      const bidNum = bestBid != null ? parseFloat(bestBid) : null;
      const midPrice =
        askNum != null && bidNum != null && askNum > 0 && bidNum > 0 ? (askNum + bidNum) / 2 : null;
      if (midPrice && midPrice > 0) {
        setCurrentPrice(midPrice);
        updateCurrentCandle(midPrice);
      }
    }

    if (isExternal && externalPrices && !isFawaz) {
      const symbol = pair.replace("/", "_");
      const price = externalPrices.get(symbol);
      const midPrice = price?.midPrice;
      if (midPrice && midPrice > 0) {
        setCurrentPrice(midPrice);
        updateCurrentCandle(midPrice);
      }
    }
  }, [orderbooks, externalPrices, externalPricesVersion, isFxMode, isXRPL, isExternal, isFawaz, pair, updateCurrentCandle]);

  const fetchMarketData = useCallback(async () => {
    try {
      if (isFxMode) {
        const data = await xcannesApi.getFxEod(fxBase, fxQuote, 365);
        const candlesEod = data?.candles || [];
        const formattedFx = candlesEod
          .map((c) => ({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume || 0),
          }))
          .sort((a, b) => a.time - b.time);
        setCandles(formattedFx);
        setLoading(false);
        return;
      }

      if (!backendBook?.backendPair) {
        setNoDataMessage(`Paire ${pair} non supportée`);
        setCandles([]);
        setLoading(false);
        return;
      }

      const limits = {
        "1m": 3000,
        "5m": 3000,
        "15m": 3000,
        "1h": 5000,
        "4h": 2000,
        "1d": 400,
      };

      const klines = await xcannesApi.getKlines(
        backendBook.backendPair,
        intervalMap[interval] || "1h",
        limits[intervalMap[interval]] || 100
      );

      if (!klines || !Array.isArray(klines) || klines.length === 0) {
        setNoDataMessage(`No data for ${pair}`);
        setCandles([]);
        setLoading(false);
        return;
      }

      const formatted = klines.map((candle) => ({
        time: candle.time,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume || 0),
      }));

      const sorted = formatted.sort((a, b) => a.time - b.time);
      setCandles(sorted);
      // Bougie courante sera créée uniquement à l’arrivée d’un prix live
      currentCandleRef.current = null;

      // Stats 24h basées sur l'historique
      const now = Math.floor(Date.now() / 1000);
      const h24ago = now - 86400;
      const candles24h = sorted.filter((c) => c.time >= h24ago);
      if (candles24h.length > 0) {
        const high = Math.max(...candles24h.map((c) => c.high));
        const low = Math.min(...candles24h.map((c) => c.low));
        const volume = candles24h.reduce((sum, c) => sum + c.volume, 0);
        const firstPrice = candles24h[0].open;
        const lastPrice = candles24h[candles24h.length - 1].close;
        const change = lastPrice - firstPrice;
        const changePercent = (change / firstPrice) * 100;
        setStats24h({ high, low, volume });
        setPriceChange({ value: change, percent: changePercent });
      }

      setLoading(false);
    } catch (error) {
      logError("[XrplCandleChart] fetchMarketData error", error);
      setNoDataMessage("Error loading data");
      setLoading(false);
    }
  }, [fxBase, fxQuote, interval, intervalMap, isFxMode, pair]);

  // Fetch initial + on deps change
  useEffect(() => {
    setLoading(true);
    setNoDataMessage(null);
    fetchMarketData();
  }, [fetchMarketData]);

  // Reload 1m depuis MongoDB avec cleanup
  useEffect(() => {
    if (interval !== "1m" || isFxMode) return;

    const intervalMs = 60 * 1000 * 5; // toutes les 5 minutes
    const timeoutId = setTimeout(() => {
      reloadIntervalRef.current = setInterval(() => {
        fetchMarketData();
      }, intervalMs);
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      if (reloadIntervalRef.current) {
        clearInterval(reloadIntervalRef.current);
        reloadIntervalRef.current = null;
      }
    };
  }, [interval, isFxMode, fetchMarketData]);

  // Polling %24h via ticker REST/WS toutes 30s (au lieu de 3s)
  useEffect(() => {
    let tickerInterval;
    const updateFromTicker = async () => {
      const ticker = tickerKey ? tickers?.get?.(tickerKey) : null;

      const extractChange = (src) => {
        if (!src) return null;
        const valueSource =
          src.change24h ??
          src.change_24h ??
          src.change;
        const percentSource =
          src.changePercent24h ??
          src.percent_change_24h ??
          src.change_percent_24h ??
          src.changePercent;

        const valueNum = valueSource != null ? Number(valueSource) : null;
        const percentNum = percentSource != null ? Number(percentSource) : null;

        if (!Number.isFinite(percentNum)) return null;

        setPercent24h({
          value: Number.isFinite(valueNum) ? valueNum : 0,
          percent: percentNum,
        });
        return true;
      };

      if (extractChange(ticker)) {
        return;
      }
      try {
        const res = await xcannesApi.getTicker(tickerKey || pair);
        extractChange(res);
      } catch (e) {
        // silencieux
      }
    };

    updateFromTicker();
    tickerInterval = setInterval(updateFromTicker, 30000);
    return () => clearInterval(tickerInterval);
  }, [tickerKey, pair, tickers]);

  return {
    loading,
    noDataMessage,
    currentPrice,
    priceChange,
    percent24h,
    stats24h,
    candles,
    setCandles,
    isXRPL,
    isExternal,
    isFawaz,
    currentCandleRef,
    intervalSecondsRef,
    updateCurrentCandle,
  };
}
