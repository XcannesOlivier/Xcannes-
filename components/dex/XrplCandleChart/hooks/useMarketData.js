"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBookIdFromPair } from "../../../../utils/xrpl";
import xcannesApi from "../../../../lib/xcannesApi";
import { getPairCategory } from "../../../../utils/marketStructure";
import { useXcannesWS } from "../../../../context/XcannesWSContext";
import {
  compute24hStatsFromCandles,
  extractPercentChange,
} from "../../../../utils/marketStats";
import { getBackendInterval, getIntervalSeconds } from "./timeframes";
import { useCurrentCandle } from "./useCurrentCandle";
import { fetchFxEodCandles } from "./fxEod";
import { useLiveTickerData } from "./useLiveTickerData";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const logError = (...args) => {
  if (DEBUG_LOGS) console.error(...args);
};

const candlesCache = new Map();

// Hook responsable des données: fetch historique, live, FX EOD, stats 24h, bougie courante
export default function useMarketData({ pair, interval, isFxMode, fxBase, fxQuote }) {
  const [loading, setLoading] = useState(true);
  const [noDataMessage, setNoDataMessage] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState({ value: 0, percent: 0 });
  const [percent24h, setPercent24h] = useState({ value: 0, percent: 0 });
  const [stats24h, setStats24h] = useState({ high: null, low: null, volume: null });
  const [candles, setCandles] = useState([]);
  const requestIdRef = useRef(0);

  const { connected, externalPrices, externalPricesVersion, subscribe, unsubscribe, tickers } =
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

  // Bougie courante (hook dédié)
  const {
    currentCandleRef,
    intervalSecondsRef,
    updateCurrentCandle,
  } = useCurrentCandle(interval, setCandles);
  const reloadIntervalRef = useRef(null);

  const getCacheKey = useCallback(() => {
    const resolvedInterval = getBackendInterval(interval);
    if (isFxMode) {
      if (!fxBase || !fxQuote) return null;
      return `fx:${fxBase}/${fxQuote}:${resolvedInterval}`;
    }
    if (!backendBook?.backendPair) return null;
    return `${backendBook.backendPair}:${resolvedInterval}`;
  }, [backendBook, fxBase, fxQuote, interval, isFxMode]);

  // Abonnement WS Pyth
  useEffect(() => {
    if (!isExternal || isFawaz || !connected || isFxMode) return;
    const symbol = pair.replace("/", "_");
    subscribe("pyth", symbol);
    return () => unsubscribe("pyth", symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, isExternal, isFawaz, connected, isFxMode]); // Ne pas inclure subscribe/unsubscribe

  // Abonnement WS Ticker (XRPL + marchés externes) pour le prix et les stats
  useEffect(() => {
    if (isFxMode) return;
    if (!tickerKey || !connected) return;
    
    subscribe("ticker", tickerKey);
    return () => {
      unsubscribe("ticker", tickerKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey, isFxMode, connected]); // Ne pas inclure subscribe/unsubscribe

  // Mise à jour des prix live via WS (Pyth Hermes uniquement)
  useEffect(() => {
    if (isFxMode) return;

    if (isExternal && externalPrices && !isFawaz) {
      const symbol = pair.replace("/", "_");
      const price = externalPrices.get(symbol);
      const midPrice = price?.midPrice;
      if (midPrice && midPrice > 0) {
        setCurrentPrice(midPrice);
        updateCurrentCandle(midPrice);
      }
    }
  }, [externalPrices, externalPricesVersion, isFxMode, isExternal, isFawaz, pair, updateCurrentCandle]);

  const fetchMarketData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      if (isFxMode) {
        const formattedFx = await fetchFxEodCandles(fxBase, fxQuote, 365);
        if (requestId === requestIdRef.current) {
          setCandles(formattedFx);
          setLoading(false);
          const cacheKey = getCacheKey();
          if (cacheKey) {
            candlesCache.set(cacheKey, { candles: formattedFx });
          }
        }
        return;
      }

      if (!backendBook?.backendPair) {
        setNoDataMessage(`Paire ${pair} non supportée`);
        setCandles([]);
        setLoading(false);
        return;
      }

      const backendInterval = getBackendInterval(interval);
      const klines = await xcannesApi.getKlines(
        backendBook.backendPair,
        backendInterval,
        0 // 0 = aucune limite: récupérer toutes les bougies disponibles
      );

      if (!klines || !Array.isArray(klines) || klines.length === 0) {
        if (requestId === requestIdRef.current) {
          setNoDataMessage(`No data for ${pair}`);
          setCandles([]);
          setLoading(false);
        }
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

      let sorted = formatted.sort((a, b) => a.time - b.time);
      if (requestId !== requestIdRef.current) {
        return;
      }

      // Initialisation de la bougie courante pour 1m :
      // dès que l'historique est chargé, on crée une bougie "live"
      // en partant du dernier close, afin que le graphique soit actif
      // même si aucun tick WS n'est encore arrivé.
      if (!isFxMode && (isXRPL || isExternal) && interval === "1m" && sorted.length > 0) {
        const now = Math.floor(Date.now() / 1000);
        const intervalSeconds = getIntervalSeconds("1m");
        const currentCandleTime = Math.floor(now / intervalSeconds) * intervalSeconds;
        const last = sorted[sorted.length - 1];

        // Si le backend ne fournit pas déjà une bougie pour la minute en cours,
        // on crée une bougie synthétique qui sera ensuite mise à jour par le flux WS.
        if (last.time < currentCandleTime) {
          const baseClose = Number.isFinite(last.close) ? last.close : last.open;
          const liveCandle = {
            time: currentCandleTime,
            open: baseClose,
            high: baseClose,
            low: baseClose,
            close: baseClose,
            volume: 0,
          };
          currentCandleRef.current = liveCandle;
          sorted = [...sorted, liveCandle];
        } else {
          // Si la dernière bougie couvre déjà la minute en cours,
          // on la considère comme bougie courante.
          currentCandleRef.current = { ...last };
        }
      } else {
        // Pour les autres cas, la bougie courante sera créée uniquement à l’arrivée d’un prix live
        currentCandleRef.current = null;
      }

      setCandles(sorted);
      const cacheKey = getCacheKey();
      if (cacheKey && requestId === requestIdRef.current) {
        candlesCache.set(cacheKey, { candles: sorted });
      }

      // Stats 24h basées sur l'historique.
      // Pour les paires XRPL et PYTH, on force l'utilisation de bougies 1m
      // pour garder un fallback cohérent quel que soit le timeframe affiché.
      let statsCandles = sorted;
      if (isXRPL || isExternal) {
        let klines1m = klines;

        if (interval !== "1m") {
          const klinesRaw1m = await xcannesApi.getKlines(
            backendBook.backendPair,
            "1m",
            0 // récupérer toutes les bougies 1m disponibles pour les stats 24h
          );

          if (Array.isArray(klinesRaw1m) && klinesRaw1m.length > 0) {
            klines1m = klinesRaw1m;
          }
        }

        statsCandles = klines1m.map((candle) => ({
          time: candle.time,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.volume || 0),
        }));
      }

      const stats = compute24hStatsFromCandles(statsCandles);
      if (stats && requestId === requestIdRef.current) {
        const { high, low, volume, change, changePercent } = stats;
        setStats24h({ high, low, volume });
        // Pour les marchés Pyth, on laisse le % 24h venir du ticker backend
        // (pour rester indépendant du timeframe). On n'initialise via les bougies
        // que les marchés non-XRPL non-Pyth (ex: Fawaz/EOD).
        if (!isXRPL && !isExternal) {
          setPriceChange({ value: change, percent: changePercent });
          setPercent24h({
            value: change,
            percent: changePercent,
          });
        }
      }

      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    } catch (error) {
      logError("[XrplCandleChart] fetchMarketData error", error);
      if (requestId === requestIdRef.current) {
        setNoDataMessage("Error loading data");
        setLoading(false);
      }
    }
  }, [fxBase, fxQuote, getCacheKey, interval, isFxMode, pair, isXRPL, isExternal, currentCandleRef, backendBook]);

  // Fetch initial + on deps change
  useEffect(() => {
    setNoDataMessage(null);
    const cacheKey = getCacheKey();
    if (cacheKey) {
      const cached = candlesCache.get(cacheKey);
      if (cached && Array.isArray(cached.candles) && cached.candles.length > 0) {
        setCandles(cached.candles);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else {
      setLoading(true);
      setCandles([]);
    }
    fetchMarketData();
  }, [fetchMarketData, getCacheKey]);

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

  // Polling prix/%/stats via ticker REST/WS (live)
  useLiveTickerData({
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
  });

  // ✅ Correctif ciblé pour les paires PYTH :
  // si percent24h reste à 0 (pas de variation fournie par le tickerKey),
  // on récupère le ticker en utilisant le backendPair réel de la paire
  // (même logique que EODExchangeSection) et on applique uniquement le %
  useEffect(() => {
    if (!isExternal || isFxMode) return;
    if (Math.abs(percent24h?.percent || 0) > 0.0001) return;

    const book = getBookIdFromPair(pair);
    if (!book?.backendPair) return;

    let cancelled = false;

    const loadFallbackPercent = async () => {
      try {
        const ticker = await xcannesApi.getTicker(book.backendPair);
        if (!ticker || cancelled) return;
        const change = extractPercentChange(ticker);
        if (!change) return;

        setPercent24h((prev) =>
          Math.abs(prev?.percent || 0) > 0.0001 ? prev : change
        );
      } catch {
        // silencieux : si le backend ne fournit rien, on garde 0% ou la valeur actuelle
      }
    };

    loadFallbackPercent();

    return () => {
      cancelled = true;
    };
  }, [pair, isExternal, isFxMode, percent24h?.percent, setPercent24h]);

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
