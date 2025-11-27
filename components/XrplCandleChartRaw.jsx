"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createChart } from "lightweight-charts";
import { getBookIdFromPair } from "../utils/xrpl";
import xcannesApi from "../lib/xcannesApi";
import { useXcannesWS } from "../context/XcannesWSContext"; // ✅ Hook WebSocket centralisé
import { useCandles1m, compute24hPercentChange } from "../hooks/useCandles1m"; // ✅ Hook pour calcul % 24h
import { useExternalPrice } from "../hooks/useExternalPrice"; // ✅ Hook pour prix live Pyth (crypto, forex, commodities)
import { MARKET_STRUCTURE, getPairCategory } from "../utils/marketStructure"; // ✅ Structure des marchés

export default function XrplCandleChartRaw({
  pair = "XCS/XRP",
  interval = "1m",
  onPairChange,
  onIntervalChange,
  availablePairs = [],
  availableIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"],
}) {
  const chartRef = useRef();
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const timeScaleRef = useRef(null);
  const initialVisibleRangeRef = useRef(null);
  const rsiChartRef = useRef(null);
  const rsiSeriesRef = useRef(null);
  const macdChartRef = useRef(null);
  const macdSeriesRef = useRef({
    macd: null,
    signal: null,
    histogram: null,
  });
  const vwapSeriesRef = useRef(null);
  const smaSeriesRef = useRef({
    sma20: null,
    sma50: null,
    sma200: null,
  });
  const emaSeriesRef = useRef({
    ema20: null,
    ema50: null,
    ema200: null,
  });
  const bollingerSeriesRef = useRef({
    upper: null,
    middle: null,
    lower: null,
  });
  const containerRef = useRef(null);
  
  // ✅ Détecter la catégorie de la paire
  const pairCategory = useMemo(() => getPairCategory(pair), [pair]);
  const isXRPL = pairCategory === 'xrpl';
  const isExternal = pairCategory && ['crypto', 'forex', 'commodity'].includes(pairCategory);
  const isExotic = pairCategory === 'exotic';
  
  // ✅ WebSocket centralisé (XRPL uniquement)
  const { connected, orderbooks, subscribe, unsubscribe } = useXcannesWS();
  
  // ✅ Hook pour prix live Pyth (crypto, forex, commodities - pas exotic)
  const { price: externalPrice, loading: loadingExternalPrice } = useExternalPrice(
    isExternal && !isExotic ? pair : null,
    pairCategory
  );
  
  // ✅ Hook pour les bougies 1m (toujours 24h, indépendant du timeframe)
  const { candles1m, loading: loadingCandles1m } = useCandles1m(pair);
  
  // ✅ Refs pour le temps réel
  const currentCandleRef = useRef(null); // Bougie en cours de formation
  const lastUpdateTimeRef = useRef(0); // Dernier timestamp de mise à jour
  const intervalSecondsRef = useRef(60); // Durée de l'intervalle en secondes

  // États pour les fonctionnalités modernes
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState({ value: 0, percent: 0 });
  const [percent24h, setPercent24h] = useState({ value: 0, percent: 0 }); // ✅ Nouveau: % 24h indépendant
  const [showVolume, setShowVolume] = useState(true);
  const [chartType, setChartType] = useState("candle"); // "candle" ou "line"
  const [showBollinger, setShowBollinger] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);
  const [showSMA, setShowSMA] = useState({ sma20: false, sma50: false, sma200: false });
  const [showEMA, setShowEMA] = useState({ ema20: false, ema50: false, ema200: false });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartHeight, setChartHeight] = useState("500px");
  const [loading, setLoading] = useState(true);
  const [noDataMessage, setNoDataMessage] = useState(null);
  const [hideAllIndicators, setHideAllIndicators] = useState(false);
  const [showTooltips, setShowTooltips] = useState(true);
  
  // États pour les paramètres du graphique
  const [showSettings, setShowSettings] = useState(false);
  const [chartSettings, setChartSettings] = useState({
    showGrid: true,
    showCrosshair: true,
    autoScale: true,
  });
  
  const [stats24h, setStats24h] = useState({
    high: null,
    low: null,
    volume: null,
  });
  
  // États pour le dropdown en cascade
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedMarkets, setExpandedMarkets] = useState({});
  const [expandedCurrencies, setExpandedCurrencies] = useState({});
  const dropdownRef = useRef(null);
  
  // Fermer le dropdown si on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
        setExpandedMarkets({});
        setExpandedCurrencies({});
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const toggleMarket = (marketKey) => {
    setExpandedMarkets(prev => ({
      ...prev,
      [marketKey]: !prev[marketKey]
    }));
  };
  
  const toggleCurrency = (marketKey, currency) => {
    const key = `${marketKey}-${currency}`;
    setExpandedCurrencies(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  const handlePairSelect = (selectedPair) => {
    if (onPairChange) {
      onPairChange(selectedPair);
    }
    setDropdownOpen(false);
    setExpandedMarkets({});
    setExpandedCurrencies({});
  };

  const uniquePairs = useMemo(
    () => Array.from(new Set(availablePairs)),
    [availablePairs]
  );
  
  // Filtrer les paires disponibles par marché et devise
  const filteredMarketStructure = useMemo(() => {
    const filtered = {};
    
    Object.entries(MARKET_STRUCTURE).forEach(([marketKey, market]) => {
      const filteredCurrencies = {};
      
      Object.entries(market.currencies).forEach(([currency, pairs]) => {
        const availablePairsForCurrency = pairs.filter(p => uniquePairs.includes(p));
        if (availablePairsForCurrency.length > 0) {
          filteredCurrencies[currency] = availablePairsForCurrency;
        }
      });
      
      if (Object.keys(filteredCurrencies).length > 0) {
        filtered[marketKey] = {
          label: market.label,
          currencies: filteredCurrencies
        };
      }
    });
    
    return filtered;
  }, [uniquePairs]);

  const intervalMap = useMemo(() => ({
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
  }), []);
  
  // ✅ Convertir interval en secondes
  const getIntervalSeconds = useCallback((interval) => {
    const map = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
    return map[interval] || 60;
  }, []);
  
  // ✅ Fonction pour mettre à jour la bougie en cours avec le prix mid de l'orderbook
  const updateCurrentCandle = useCallback((midPrice) => {
    if (!candleSeriesRef.current || !midPrice) return;
    
    const now = Math.floor(Date.now() / 1000);
    const intervalSeconds = intervalSecondsRef.current;
    const candleTime = Math.floor(now / intervalSeconds) * intervalSeconds;
    
    // Si nouvelle bougie (changement d'intervalle)
    if (!currentCandleRef.current || currentCandleRef.current.time !== candleTime) {
      currentCandleRef.current = {
        time: candleTime,
        open: midPrice,
        high: midPrice,
        low: midPrice,
        close: midPrice,
      };
      
      // Créer nouvelle bougie
      try {
        if (chartType === "candle") {
          candleSeriesRef.current.update(currentCandleRef.current);
        } else {
          candleSeriesRef.current.update({ time: candleTime, value: midPrice });
        }
      } catch (error) {
        console.error('[Chart] Erreur update nouvelle bougie:', error);
      }
    } else {
      // Mise à jour bougie existante avec nouveau prix
      currentCandleRef.current.high = Math.max(currentCandleRef.current.high, midPrice);
      currentCandleRef.current.low = Math.min(currentCandleRef.current.low, midPrice);
      currentCandleRef.current.close = midPrice;
      
      try {
        if (chartType === "candle") {
          candleSeriesRef.current.update(currentCandleRef.current);
        } else {
          candleSeriesRef.current.update({ time: candleTime, value: midPrice });
        }
      } catch (error) {
        console.error('[Chart] Erreur update bougie:', error);
      }
    }
    
    // Mettre à jour le prix affiché
    setCurrentPrice(midPrice);
    lastUpdateTimeRef.current = now;
    
  }, [chartType]);
  
  // ✅ Écouter les mises à jour de l'orderbook via le WebSocket centralisé (XRPL UNIQUEMENT)
  useEffect(() => {
    if (!isXRPL) return; // Ignorer si ce n'est pas une paire XRPL
    if (!connected || !orderbooks) return;
    
    const book = getBookIdFromPair(pair);
    if (!book) return;
    
    // Récupérer l'orderbook pour cette paire depuis la Map
    const orderbookData = orderbooks.get(book.backendPair);
    if (!orderbookData) return;
    
    const { bids, asks } = orderbookData;
    
    if (bids?.[0] && asks?.[0]) {
      const bestBid = parseFloat(bids[0].price);
      const bestAsk = parseFloat(asks[0].price);
      const midPrice = (bestBid + bestAsk) / 2;
      
      // ✅ Mettre à jour la bougie en cours
      updateCurrentCandle(midPrice);
    }
  }, [orderbooks, connected, pair, updateCurrentCandle, isXRPL]);
  
  // ✅ Écouter les prix externes Pyth (CRYPTO, FOREX, COMMODITIES - pas EXOTIC)
  useEffect(() => {
    if (!isExternal || isExotic) return; // Seulement pour paires externes non-exotiques
    if (!externalPrice) return;
    
    console.log(`[Chart] 📈 Prix live Pyth reçu pour ${pair}:`, externalPrice);
    
    // Mettre à jour la bougie en cours avec le prix Pyth
    updateCurrentCandle(externalPrice);
  }, [externalPrice, pair, updateCurrentCandle, isExternal, isExotic]);
  
  // ✅ S'abonner/désabonner au changement de paire (XRPL UNIQUEMENT)
  useEffect(() => {
    if (!isXRPL) return; // Ignorer si ce n'est pas une paire XRPL
    
    const book = getBookIdFromPair(pair);
    if (!book || !connected) return;
    
    console.log('[Chart] 🔌 Abonnement à:', book.backendPair);
    subscribe('orderbook', book.backendPair);
    
    return () => {
      console.log('[Chart] 🔌 Désabonnement de:', book.backendPair);
      unsubscribe('orderbook', book.backendPair);
    };
  }, [pair, connected, subscribe, unsubscribe, isXRPL]);

  // ✅ Calculer le % 24h à chaque mise à jour du prix live ou des bougies 1m
  useEffect(() => {
    if (!currentPrice || !candles1m || candles1m.length === 0) return;
    
    const result = compute24hPercentChange(candles1m, currentPrice);
    setPercent24h({
      value: result.value,
      percent: result.percent,
    });
    
    console.log('[Chart] 📊 % 24h calculé:', {
      openPrice24h: result.openPrice24h,
      currentPrice,
      percent: result.percent.toFixed(2) + '%',
      periodCovered: result.periodHours + 'h',
      candlesCount: candles1m.length,
    });
  }, [currentPrice, candles1m]);

  // Calculer Bollinger Bands (SMA + écart-type)
  const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
    if (data.length < period) return { upper: [], middle: [], lower: [] };

    const upper = [];
    const middle = [];
    const lower = [];

    for (let i = period - 1; i < data.length; i++) {
      // Calculer SMA (middle band)
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += parseFloat(data[i - j].close);
      }
      const sma = sum / period;

      // Calculer écart-type
      let variance = 0;
      for (let j = 0; j < period; j++) {
        const diff = parseFloat(data[i - j].close) - sma;
        variance += diff * diff;
      }
      const std = Math.sqrt(variance / period);

      upper.push({ time: data[i].time, value: sma + stdDev * std });
      middle.push({ time: data[i].time, value: sma });
      lower.push({ time: data[i].time, value: sma - stdDev * std });
    }

    return { upper, middle, lower };
  };

  // Calculer EMA (Exponential Moving Average)
  const calculateEMA = (data, period) => {
    if (data.length < period) return [];

    const ema = [];
    const multiplier = 2 / (period + 1);

    // Première EMA = SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += parseFloat(data[i].close);
    }
    let emaValue = sum / period;
    ema.push({ time: data[period - 1].time, value: emaValue });

    // EMA suivantes
    for (let i = period; i < data.length; i++) {
      emaValue = (parseFloat(data[i].close) - emaValue) * multiplier + emaValue;
      ema.push({ time: data[i].time, value: emaValue });
    }

    return ema;
  };

  // Calculer SMA (Simple Moving Average)
  const calculateSMA = (data, period) => {
    if (data.length < period) return [];

    const sma = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += parseFloat(data[i - j].close);
      }
      const average = sum / period;
      sma.push({ time: data[i].time, value: average });
    }
    return sma;
  };

  // Calculer RSI (Relative Strength Index)
  const calculateRSI = (data, period = 14) => {
    if (data.length < period + 1) return [];

    const rsi = [];
    let gains = 0;
    let losses = 0;

    // Première moyenne sur la période initiale
    for (let i = 1; i <= period; i++) {
      const change = parseFloat(data[i].close) - parseFloat(data[i - 1].close);
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    let rs = avgGain / avgLoss;
    rsi.push({ time: data[period].time, value: 100 - 100 / (1 + rs) });

    // RSI pour les périodes suivantes (moyenne mobile exponentielle)
    for (let i = period + 1; i < data.length; i++) {
      const change = parseFloat(data[i].close) - parseFloat(data[i - 1].close);
      const gain = change >= 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      rs = avgGain / avgLoss;
      rsi.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
    }

    return rsi;
  };

  // Calculer MACD (Moving Average Convergence Divergence)
  const calculateMACD = useCallback((data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    if (data.length < slowPeriod + signalPeriod) return { macd: [], signal: [], histogram: [] };

    // Calculer EMA rapide et lente
    const fastEMA = calculateEMA(data, fastPeriod);
    const slowEMA = calculateEMA(data, slowPeriod);

    // Calculer la ligne MACD (différence entre les deux EMA)
    const macdLine = [];
    const startIndex = slowPeriod - fastPeriod;
    
    for (let i = 0; i < slowEMA.length; i++) {
      const fastIndex = i + startIndex;
      if (fastIndex < fastEMA.length) {
        macdLine.push({
          time: slowEMA[i].time,
          value: fastEMA[fastIndex].value - slowEMA[i].value,
        });
      }
    }

    // Calculer la ligne de signal (EMA du MACD)
    if (macdLine.length < signalPeriod) return { macd: [], signal: [], histogram: [] };

    const signalLine = [];
    const multiplier = 2 / (signalPeriod + 1);
    
    // Première signal = SMA des premières valeurs MACD
    let sum = 0;
    for (let i = 0; i < signalPeriod; i++) {
      sum += macdLine[i].value;
    }
    let signalValue = sum / signalPeriod;
    signalLine.push({ time: macdLine[signalPeriod - 1].time, value: signalValue });

    // Signal suivants (EMA)
    for (let i = signalPeriod; i < macdLine.length; i++) {
      signalValue = (macdLine[i].value - signalValue) * multiplier + signalValue;
      signalLine.push({ time: macdLine[i].time, value: signalValue });
    }

    // Calculer l'histogramme (différence MACD - Signal)
    const histogram = [];
    const signalStartIndex = signalPeriod - 1;
    
    for (let i = 0; i < signalLine.length; i++) {
      const macdIndex = i + signalStartIndex;
      histogram.push({
        time: signalLine[i].time,
        value: macdLine[macdIndex].value - signalLine[i].value,
        color: macdLine[macdIndex].value >= signalLine[i].value ? "#16b303" : "#dc2626",
      });
    }

    return {
      macd: macdLine.slice(signalStartIndex),
      signal: signalLine,
      histogram: histogram,
    };
  }, []);

  // Calculer VWAP (Volume Weighted Average Price)
  const calculateVWAP = (data) => {
    if (data.length === 0) return [];

    const vwap = [];
    let cumulativeTPV = 0; // Cumulative Typical Price × Volume
    let cumulativeVolume = 0;

    for (let i = 0; i < data.length; i++) {
      const typical = (parseFloat(data[i].high) + parseFloat(data[i].low) + parseFloat(data[i].close)) / 3;
      const volume = parseFloat(data[i].volume || 0);

      cumulativeTPV += typical * volume;
      cumulativeVolume += volume;

      const vwapValue = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typical;
      vwap.push({ time: data[i].time, value: vwapValue });
    }

    return vwap;
  };

  const fetchMarketData = useCallback(async () => {
    try {
      const book = getBookIdFromPair(pair);
      if (!book?.backendPair) {
        console.error(`Paire ${pair} non supportée`);
        return [];
      }

      console.log(`[XrplCandleChart] Fetching data for ${pair} (${book.backendPair}), interval: ${intervalMap[interval]}`);

      // Limites adaptées selon le timeframe pour profiter de l'historique MongoDB
      const limits = {
        "1m": 500,   // ~8 heures
        "5m": 500,   // ~1.7 jours
        "15m": 500,  // ~5 jours
        "1h": 1000,  // ~42 jours (historique complet!)
        "4h": 500,   // ~2.7 mois
        "1d": 365    // ~1 an
      };

      // Appel au backend Xcannes pour récupérer les klines
      const klines = await xcannesApi.getKlines(
        book.backendPair,
        intervalMap[interval] || "1h",
        limits[intervalMap[interval]] || 100
      );

      console.log(`[XrplCandleChart] Received ${klines?.length || 0} candles:`, klines?.slice(0, 2));

      if (!klines || !Array.isArray(klines) || klines.length === 0) {
        console.warn(`[XrplCandleChart] No data returned for ${pair}`);
        return [];
      }

      // Formater les données pour lightweight-charts
      const formattedData = klines.map((candle) => ({
        time: candle.time, // Timestamp déjà en secondes depuis l'API
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume || 0), // Ajouter le volume
      }));

      console.log(`[XrplCandleChart] Formatted data (first 2):`, formattedData.slice(0, 2));

      return formattedData.sort((a, b) => a.time - b.time);
    } catch (error) {
      console.error("[XrplCandleChart] Erreur fetchMarketData:", error);
      return [];
    }
  }, [pair, interval, intervalMap]);

  // Fonction pour gérer le fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Erreur fullscreen:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // Écouter les changements de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      
      // Redimensionner tous les graphiques après le changement de fullscreen
      setTimeout(() => {
        if (chartInstanceRef.current && chartRef.current) {
          const newHeight = document.fullscreenElement ? window.innerHeight - 100 : 500;
          chartInstanceRef.current.applyOptions({ 
            width: chartRef.current.clientWidth,
            height: newHeight
          });
        }
        if (rsiChartRef.current) {
          const container = document.getElementById("rsi-chart-container");
          if (container) {
            rsiChartRef.current.applyOptions({ width: container.clientWidth });
          }
        }
        if (macdChartRef.current) {
          const container = document.getElementById("macd-chart-container");
          if (container) {
            macdChartRef.current.applyOptions({ width: container.clientWidth });
          }
        }
      }, 100);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Recalculer la hauteur du graphique quand les indicateurs changent
  useEffect(() => {
    if (!isFullscreen) {
      setChartHeight("500px");
      return;
    }

    // Calculer combien de panels sont affichés
    let panelsHeight = 0;
    if (showRSI) panelsHeight += 180; // 150px + borders/padding
    if (showMACD) panelsHeight += 180;

    // Recalculer la hauteur du graphique principal
    const newHeight = window.innerHeight - 100 - panelsHeight;
    setChartHeight(`${Math.max(newHeight, 300)}px`);
    
    setTimeout(() => {
      if (chartInstanceRef.current && chartRef.current) {
        chartInstanceRef.current.applyOptions({ 
          width: chartRef.current.clientWidth,
          height: Math.max(newHeight, 300)
        });
      }
    }, 50);
  }, [isFullscreen, showRSI, showMACD]);
  
  // ✅ Effet pour gérer l'intervalle et le WebSocket temps réel
  useEffect(() => {
    intervalSecondsRef.current = getIntervalSeconds(interval);
  }, [interval, getIntervalSeconds]);
  
  // ✅ Effet pour recharger les bougies 1m depuis MongoDB à chaque minute
  useEffect(() => {
    if (interval !== "1m") return; // Seulement pour l'intervalle 1m
    
    const reloadCandles = async () => {
      try {
        console.log('[Chart] 🔄 Rechargement des bougies 1m depuis MongoDB...');
        const data = await fetchMarketData();
        
        if (!data.length || !candleSeriesRef.current) return;
        
        // Remplacer toutes les bougies avec les données MongoDB
        if (chartType === "candle") {
          candleSeriesRef.current.setData(data);
        } else {
          const lineData = data.map(d => ({ time: d.time, value: d.close }));
          candleSeriesRef.current.setData(lineData);
        }
        
        // Mettre à jour la bougie courante
        const lastCandle = data[data.length - 1];
        const now = Math.floor(Date.now() / 1000);
        const intervalSeconds = intervalSecondsRef.current;
        const currentCandleTime = Math.floor(now / intervalSeconds) * intervalSeconds;
        
        if (lastCandle.time === currentCandleTime) {
          currentCandleRef.current = { ...lastCandle };
        } else {
          currentCandleRef.current = {
            time: currentCandleTime,
            open: lastCandle.close,
            high: lastCandle.close,
            low: lastCandle.close,
            close: lastCandle.close,
          };
        }
        
        console.log('[Chart] ✅ Bougies 1m rechargées depuis MongoDB');
      } catch (error) {
        console.error('[Chart] ❌ Erreur rechargement bougies 1m:', error);
      }
    };
    
    // Calculer le délai jusqu'à la prochaine minute
    const now = Date.now();
    const msUntilNextMinute = 60000 - (now % 60000);
    
    // Premier rechargement après la première minute complète
    const initialTimeout = setTimeout(() => {
      reloadCandles();
      
      // Puis rechargement toutes les minutes
      const intervalId = setInterval(reloadCandles, 60000);
      
      return () => clearInterval(intervalId);
    }, msUntilNextMinute);
    
    return () => clearTimeout(initialTimeout);
  }, [interval, fetchMarketData, chartType]);
  
  // ✅ Effet pour connecter/déconnecter le WebSocket
  // ✅ Le WebSocket est maintenant géré par XcannesWSContext, pas besoin de l'effet ci-dessous
  
  useEffect(() => {
    let chart;
    let observer;

    const setupChart = async () => {
      setLoading(true);
      setNoDataMessage(null);
      const data = await fetchMarketData();
      if (!data.length) {
        setLoading(false);
        setNoDataMessage(
          `Aucune donnée de trading disponible pour ${pair}. L&rsquo;API de données historiques (data.xrplf.org) semble actuellement indisponible. Nous travaillons à implémenter une source de données alternative.`
        );
        return;
      }

      chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth || 800,
        height: 500,
        layout: {
          background: { color: "#0a0f0d" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: chartSettings.showGrid ? "#1a1f1d" : "transparent" },
          horzLines: { color: chartSettings.showGrid ? "#1a1f1d" : "transparent" },
        },
        crosshair: {
          mode: chartSettings.showCrosshair ? 1 : 0,
          vertLine: {
            color: "#16b303",
            width: 1,
            style: 3,
            labelBackgroundColor: "#16b303",
          },
          horzLine: {
            color: "#16b303",
            width: 1,
            style: 3,
            labelBackgroundColor: "#16b303",
          },
        },
        timeScale: {
          borderColor: "#2a2f2d",
          timeVisible: true,
          secondsVisible: interval === "1m",
          rightOffset: 1, // ✅ Réduit pour permettre autoScale
          barSpacing: 8,
          // ✅ minBarSpacing supprimé (dynamique)
          // ✅ fixLeftEdge supprimé (bloquait le recalcul)
          lockVisibleTimeRangeOnResize: true,
          rightBarStaysOnScroll: true,
          shiftVisibleRangeOnNewBar: true,
        },
        handleScale: {
          axisPressedMouseMove: {
            time: false,
            price: true,
          },
          mouseWheel: true,
          pinch: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        rightPriceScale: {
          borderColor: "#2a2f2d",
          scaleMargins: {
            top: 0.1, // Marge haute raisonnable
            bottom: showVolume ? 0.25 : 0.1, // Espace pour volume si activé
          },
          autoScale: true, // ✅ Activé
          mode: 0, // Mode normal (pas logarithmique)
        },
      });

      chartInstanceRef.current = chart;
      timeScaleRef.current = chart.timeScale();

      // Créer la série selon le type de graphique
      if (chartType === "candle") {
        candleSeriesRef.current = chart.addCandlestickSeries({
          upColor: "#16b303",
          downColor: "#dc2626",
          borderUpColor: "#16b303",
          borderDownColor: "#dc2626",
          wickUpColor: "#16b303",
          wickDownColor: "#dc2626",
        });
      } else {
        // Mode ligne
        candleSeriesRef.current = chart.addLineSeries({
          color: "#16b303",
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
        });
      }

      // Préparer les données selon le type
      if (chartType === "candle") {
        candleSeriesRef.current.setData(data);
      } else {
        // Pour line chart, utiliser seulement close price
        const lineData = data.map(d => ({
          time: d.time,
          value: d.close
        }));
        candleSeriesRef.current.setData(lineData);
      }
      
      // ✅ Initialiser la bougie courante avec la dernière bougie
      if (data.length > 0) {
        const lastCandle = data[data.length - 1];
        const now = Math.floor(Date.now() / 1000);
        const intervalSeconds = intervalSecondsRef.current;
        const currentCandleTime = Math.floor(now / intervalSeconds) * intervalSeconds;
        
        // Si la dernière bougie est de l'intervalle actuel, l'utiliser
        if (lastCandle.time === currentCandleTime) {
          currentCandleRef.current = { ...lastCandle };
        } else {
          // Sinon créer une nouvelle bougie avec le prix de fermeture de la dernière
          currentCandleRef.current = {
            time: currentCandleTime,
            open: lastCandle.close,
            high: lastCandle.close,
            low: lastCandle.close,
            close: lastCandle.close,
          };
        }
        
        // ✅ NE PAS override le prix temps réel avec le prix historique de la bougie
        // Le prix temps réel vient de l'orderbook WebSocket (ligne 150)
        
        // Calculer les stats 24h
        const h24ago = now - 86400;
        const candles24h = data.filter(c => c.time >= h24ago);
        if (candles24h.length > 0) {
          const high = Math.max(...candles24h.map(c => c.high));
          const low = Math.min(...candles24h.map(c => c.low));
          const volume = candles24h.reduce((sum, c) => sum + c.volume, 0);
          const firstPrice = candles24h[0].open;
          const change = lastCandle.close - firstPrice;
          const changePercent = (change / firstPrice) * 100;
          
          setStats24h({ high, low, volume });
          setPriceChange({ value: change, percent: changePercent });
        }
      }

      // Masquer le loading dès que le graphique a les données
      setLoading(false);
      
      // ✅ Forcer le recalcul de l'échelle des prix après chargement des données
      setTimeout(() => {
        if (chart && chart.timeScale) {
          chart.timeScale().fitContent();
        }
      }, 100);

      // Ajouter le volume si activé (toujours afficher même si volume = 0)
      if (showVolume) {
        volumeSeriesRef.current = chart.addHistogramSeries({
          color: "#16b303",
          priceFormat: { type: "volume" },
          priceScaleId: "",
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        const volumeData = data.map((d) => ({
          time: d.time,
          value: d.volume || 0,
          color: d.close >= d.open ? "#16b30340" : "#dc262640",
        }));
        volumeSeriesRef.current.setData(volumeData);
      }

      // Ajouter Bollinger Bands si activé
      if (showBollinger) {
        const bollinger = calculateBollingerBands(data, 20, 2);

        // Bande supérieure (rouge semi-transparent)
        bollingerSeriesRef.current.upper = chart.addLineSeries({
          color: "rgba(239, 83, 80, 0.8)",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        bollingerSeriesRef.current.upper.setData(bollinger.upper);

        // Bande moyenne (blanc semi-transparent)
        bollingerSeriesRef.current.middle = chart.addLineSeries({
          color: "rgba(255, 255, 255, 0.5)",
          lineWidth: 1,
          lineStyle: 2, // Dashed
          priceLineVisible: false,
          lastValueVisible: false,
        });
        bollingerSeriesRef.current.middle.setData(bollinger.middle);

        // Bande inférieure (vert semi-transparent)
        bollingerSeriesRef.current.lower = chart.addLineSeries({
          color: "rgba(22, 179, 3, 0.8)",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        bollingerSeriesRef.current.lower.setData(bollinger.lower);
      }

      // Ajouter le VWAP si activé
      if (showVWAP && data.length > 0) {
        const vwapData = calculateVWAP(data);
        vwapSeriesRef.current = chart.addLineSeries({
          color: "#fbbf24", // Jaune/Or
          lineWidth: 2,
          lineStyle: 0, // Solid
          priceLineVisible: false,
          lastValueVisible: true,
          title: "VWAP",
        });
        vwapSeriesRef.current.setData(vwapData);
      }

      // Ajouter les SMA si activés
      if (showSMA.sma20 && data.length >= 20) {
        const sma20Data = calculateSMA(data, 20);
        smaSeriesRef.current.sma20 = chart.addLineSeries({
          color: "#3b82f6", // Bleu
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: "SMA 20",
        });
        smaSeriesRef.current.sma20.setData(sma20Data);
      }

      if (showSMA.sma50 && data.length >= 50) {
        const sma50Data = calculateSMA(data, 50);
        smaSeriesRef.current.sma50 = chart.addLineSeries({
          color: "#f59e0b", // Orange
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: "SMA 50",
        });
        smaSeriesRef.current.sma50.setData(sma50Data);
      }

      if (showSMA.sma200 && data.length >= 200) {
        const sma200Data = calculateSMA(data, 200);
        smaSeriesRef.current.sma200 = chart.addLineSeries({
          color: "#ef4444", // Rouge
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: "SMA 200",
        });
        smaSeriesRef.current.sma200.setData(sma200Data);
      }

      // Ajouter les EMA si activés
      if (showEMA.ema20 && data.length >= 20) {
        const ema20Data = calculateEMA(data, 20);
        emaSeriesRef.current.ema20 = chart.addLineSeries({
          color: "#06b6d4", // Cyan
          lineWidth: 2,
          lineStyle: 0, // Solid
          priceLineVisible: false,
          lastValueVisible: true,
          title: "EMA 20",
        });
        emaSeriesRef.current.ema20.setData(ema20Data);
      }

      if (showEMA.ema50 && data.length >= 50) {
        const ema50Data = calculateEMA(data, 50);
        emaSeriesRef.current.ema50 = chart.addLineSeries({
          color: "#a855f7", // Violet
          lineWidth: 2,
          lineStyle: 0, // Solid
          priceLineVisible: false,
          lastValueVisible: true,
          title: "EMA 50",
        });
        emaSeriesRef.current.ema50.setData(ema50Data);
      }

      if (showEMA.ema200 && data.length >= 200) {
        const ema200Data = calculateEMA(data, 200);
        emaSeriesRef.current.ema200 = chart.addLineSeries({
          color: "#ec4899", // Rose
          lineWidth: 2,
          lineStyle: 0, // Solid
          priceLineVisible: false,
          lastValueVisible: true,
          title: "EMA 200",
        });
        emaSeriesRef.current.ema200.setData(ema200Data);
      }

      // Ajouter le RSI si activé (panneau séparé)
      if (showRSI && data.length > 15) {
        const rsiContainer = document.getElementById("rsi-chart-container");
        if (rsiContainer) {
          rsiChartRef.current = createChart(rsiContainer, {
            width: rsiContainer.clientWidth || 800,
            height: 150,
            layout: {
              background: { color: "#0a0f0d" },
              textColor: "#9ca3af",
            },
            grid: {
              vertLines: { color: "#1a1f1d" },
              horzLines: { color: "#1a1f1d" },
            },
            timeScale: {
              borderColor: "#2a2f2d",
              visible: false,
            },
            rightPriceScale: {
              borderColor: "#2a2f2d",
              scaleMargins: {
                top: 0.1,
                bottom: 0.1,
              },
            },
          });

          rsiSeriesRef.current = rsiChartRef.current.addLineSeries({
            color: "#9333ea",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
          });

          const rsiData = calculateRSI(data, 14);
          rsiSeriesRef.current.setData(rsiData);

          // Lignes de référence RSI (30 et 70)
          const overboughtLine = rsiChartRef.current.addLineSeries({
            color: "rgba(220, 38, 38, 0.5)",
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          overboughtLine.setData(
            data.map((d) => ({ time: d.time, value: 70 }))
          );

          const oversoldLine = rsiChartRef.current.addLineSeries({
            color: "rgba(34, 197, 94, 0.5)",
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          oversoldLine.setData(
            data.map((d) => ({ time: d.time, value: 30 }))
          );

          // Synchroniser les échelles de temps
          chart.timeScale().subscribeVisibleTimeRangeChange(() => {
            const timeRange = chart.timeScale().getVisibleRange();
            if (timeRange && rsiChartRef.current) {
              rsiChartRef.current.timeScale().setVisibleRange(timeRange);
            }
          });

          // Capturer la plage initiale après le premier rendu
          setTimeout(() => {
            const initialRange = chart.timeScale().getVisibleRange();
            if (initialRange) {
              initialVisibleRangeRef.current = initialRange;
            }
          }, 100);

          // Bloquer le zoom-out au-delà de la vue initiale
          chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
            if (!initialVisibleRangeRef.current || !logicalRange) return;

            const currentRange = chart.timeScale().getVisibleRange();
            if (!currentRange) return;

            const initialSpan = initialVisibleRangeRef.current.to - initialVisibleRangeRef.current.from;
            const currentSpan = currentRange.to - currentRange.from;

            // Si on essaie de zoomer plus loin que la vue initiale, bloquer
            if (currentSpan > initialSpan * 1.05) {
              chart.timeScale().setVisibleRange(initialVisibleRangeRef.current);
            }
          });
        }
      }

      // Ajouter le MACD si activé (panneau séparé)
      if (showMACD && data.length > 35) {
        const macdContainer = document.getElementById("macd-chart-container");
        if (macdContainer) {
          macdChartRef.current = createChart(macdContainer, {
            width: macdContainer.clientWidth || 800,
            height: 150,
            layout: {
              background: { color: "#0a0f0d" },
              textColor: "#9ca3af",
            },
            grid: {
              vertLines: { color: "#1a1f1d" },
              horzLines: { color: "#1a1f1d" },
            },
            timeScale: {
              borderColor: "#2a2f2d",
              visible: false,
            },
            rightPriceScale: {
              borderColor: "#2a2f2d",
              scaleMargins: {
                top: 0.1,
                bottom: 0.1,
              },
            },
          });

          const macdData = calculateMACD(data, 12, 26, 9);

          // Ligne MACD (bleu)
          macdSeriesRef.current.macd = macdChartRef.current.addLineSeries({
            color: "#2196f3",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          macdSeriesRef.current.macd.setData(macdData.macd);

          // Ligne Signal (orange)
          macdSeriesRef.current.signal = macdChartRef.current.addLineSeries({
            color: "#ff9800",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          macdSeriesRef.current.signal.setData(macdData.signal);

          // Histogramme (vert/rouge)
          macdSeriesRef.current.histogram = macdChartRef.current.addHistogramSeries({
            priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
            priceScaleId: "",
          });
          macdSeriesRef.current.histogram.setData(macdData.histogram);

          // Ligne zéro de référence
          const zeroLine = macdChartRef.current.addLineSeries({
            color: "rgba(255, 255, 255, 0.3)",
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          zeroLine.setData(
            macdData.macd.map((d) => ({ time: d.time, value: 0 }))
          );

          // Synchroniser les échelles de temps
          chart.timeScale().subscribeVisibleTimeRangeChange(() => {
            const timeRange = chart.timeScale().getVisibleRange();
            if (timeRange && macdChartRef.current) {
              macdChartRef.current.timeScale().setVisibleRange(timeRange);
            }
          });
        }
      }

      // Calculer les statistiques
      const realData = data.filter(
        (c) => c.open !== 0 || c.high !== 0 || c.low !== 0 || c.close !== 0
      );

      if (realData.length > 0) {
        const lastCandle = realData[realData.length - 1];
        
        // ⚠️ DEPRECATED: L'ancien calcul de % basé sur le timeframe affiché n'est plus utilisé
        // Le % 24h est maintenant calculé avec useCandles1m() et compute24hPercentChange()
        // qui utilisent TOUJOURS les bougies 1m indépendamment du timeframe sélectionné
        
        // Stats 24h (dernières 24h de données du timeframe actuel - pour high/low/volume uniquement)
        const last24hData = realData.slice(-Math.min(realData.length, 1440)); // 1440 = 24h en minutes
        const high24h = Math.max(...last24hData.map((d) => d.high));
        const low24h = Math.min(...last24hData.map((d) => d.low));
        const volume24h = last24hData.reduce(
          (sum, d) => sum + (d.volume || 0),
          0
        );

        setStats24h({
          high: high24h,
          low: low24h,
          volume: volume24h,
        });
      }

      // 📅 Autozoom horizontal seulement (pas vertical)
      const first = realData[0]?.time;
      const last = realData[realData.length - 1]?.time;

      if (first && last && chart?.timeScale) {
        const margin = Math.floor((last - first) * 0.05);
        chart.timeScale().setVisibleRange({
          from: first - margin,
          to: last + margin,
        });
      }

      // ✅ SUPPRIMÉ: setVisibleRange sur priceScale (bloquait autoScale)
      // L'autoScale gérera automatiquement les prix visibles

      observer = new ResizeObserver(() => {
        chart.applyOptions({ width: chartRef.current.clientWidth });
        if (rsiChartRef.current) {
          rsiChartRef.current.applyOptions({ width: chartRef.current.clientWidth });
        }
        if (macdChartRef.current) {
          macdChartRef.current.applyOptions({ width: chartRef.current.clientWidth });
        }
      });
      observer.observe(chartRef.current);
    };

    setupChart();

    return () => {
      if (observer) observer.disconnect();
      if (chart) {
        chart.remove();
        chartInstanceRef.current = null;
      }
      if (rsiChartRef.current) rsiChartRef.current.remove();
      if (macdChartRef.current) macdChartRef.current.remove();
    };
  }, [
    pair,
    interval,
    showVolume,
    chartType,
    showBollinger,
    showRSI,
    showMACD,
    showVWAP,
    showSMA,
    showEMA,
    chartSettings,
    fetchMarketData,
    calculateMACD,
  ]);

  // Effet pour appliquer les changements de paramètres au graphique existant
  useEffect(() => {
    if (!chartInstanceRef.current) return;

    chartInstanceRef.current.applyOptions({
      grid: {
        vertLines: { color: chartSettings.showGrid ? "#1a1f1d" : "transparent" },
        horzLines: { color: chartSettings.showGrid ? "#1a1f1d" : "transparent" },
      },
      crosshair: {
        mode: chartSettings.showCrosshair ? 1 : 0,
      },
      rightPriceScale: {
        autoScale: chartSettings.autoScale,
      },
    });
  }, [chartSettings]);

  return (
    <div 
      ref={containerRef}
      className={`bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden mb-6 ${
        isFullscreen ? "!fixed inset-0 z-50 !m-0 rounded-none !bg-black" : ""
      }`}
    >
      {/* Header compact avec prix et contrôles globaux uniquement */}
      <div className={`border-b border-white/10 ${isFullscreen ? "p-2" : "p-3"}`}>
        <div className="flex items-center justify-between gap-3">
          {/* Prix actuel */}
          <div className="flex items-center gap-3">
            <h2 className={`font-orbitron font-bold text-white ${isFullscreen ? "text-base" : "text-lg"}`}>
              {pair}
            </h2>
            {currentPrice && (
              <div className="flex items-baseline gap-2">
                <span className={`font-semibold text-white ${isFullscreen ? "text-sm" : "text-base"}`}>
                  {currentPrice.toFixed(6)}
                </span>
                <span
                  className={`text-xs font-medium ${
                    percent24h.value >= 0
                      ? "text-xcannes-green"
                      : "text-red-500"
                  }`}
                  title="Évolution sur 24h (basée sur bougies 1m)"
                >
                  {percent24h.value >= 0 ? "+" : ""}
                  {percent24h.percent.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {/* Contrôles globaux uniquement */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {uniquePairs.length > 0 && onPairChange && (
              <div ref={dropdownRef} className="relative">
                {/* Bouton principal - affiche la paire actuelle */}
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="bg-black/60 border border-white/10 px-3 py-1.5 rounded text-xs text-white font-medium hover:border-white/20 transition-all flex items-center gap-2 min-w-[120px]"
                >
                  <span>{pair}</span>
                  <svg 
                    className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Menu déroulant en cascade */}
                {dropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-black/95 border border-white/20 rounded-lg shadow-2xl z-50 min-w-[220px] max-h-[500px] overflow-y-auto">
                    {Object.entries(filteredMarketStructure).map(([marketKey, market]) => {
                      const isXrpl = marketKey === 'xrpl';
                      const isExpanded = expandedMarkets[marketKey];
                      
                      return (
                        <div key={marketKey} className="border-b border-white/10 last:border-b-0">
                          {isXrpl ? (
                            // XRPL: affichage direct sans sous-menu
                            <div className="p-2">
                              <div className="text-[10px] font-semibold text-white/60 px-2 py-1 uppercase tracking-wider">
                                {market.label}
                              </div>
                              {Object.entries(market.currencies).map(([currency, pairs]) =>
                                pairs.map((p) => (
                                  <button
                                    key={p}
                                    onClick={() => handlePairSelect(p)}
                                    className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/10 transition-all ${
                                      pair === p ? 'bg-xcannes-green/20 text-xcannes-green' : 'text-white/80'
                                    }`}
                                  >
                                    {p}
                                  </button>
                                ))
                              )}
                            </div>
                          ) : (
                            // Autres marchés: avec menu en cascade
                            <>
                              <button
                                onClick={() => toggleMarket(marketKey)}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/5 transition-all"
                              >
                                <span>{market.label}</span>
                                <svg 
                                  className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              
                              {isExpanded && (
                                <div className="bg-black/40 px-2 pb-2">
                                  {Object.entries(market.currencies).map(([currency, pairs]) => {
                                    const currencyKey = `${marketKey}-${currency}`;
                                    const isCurrencyExpanded = expandedCurrencies[currencyKey];
                                    
                                    return (
                                      <div key={currency} className="mb-1">
                                        <button
                                          onClick={() => toggleCurrency(marketKey, currency)}
                                          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 rounded transition-all"
                                        >
                                          <span className="font-medium">{currency}</span>
                                          <svg 
                                            className={`w-2.5 h-2.5 transition-transform ${isCurrencyExpanded ? 'rotate-180' : ''}`}
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                        
                                        {isCurrencyExpanded && (
                                          <div className="ml-2 mt-1 space-y-0.5">
                                            {pairs.map((p) => (
                                              <button
                                                key={p}
                                                onClick={() => handlePairSelect(p)}
                                                className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/10 transition-all ${
                                                  pair === p ? 'bg-xcannes-green/20 text-xcannes-green' : 'text-white/70'
                                                }`}
                                              >
                                                {p}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {availableIntervals.length > 0 && onIntervalChange && (
              <select
                value={interval}
                onChange={(e) => onIntervalChange(e.target.value)}
                className="bg-black/60 border border-white/10 px-3 py-1.5 rounded text-xs text-white font-medium hover:border-white/20 transition-all"
              >
                {availableIntervals.map((int) => (
                  <option key={int} value={int}>
                    {int}
                  </option>
                ))}
              </select>
            )}

            {/* Type de chart */}
            <div className="relative group">
              <button
                onClick={() => setChartType(chartType === "candle" ? "line" : "candle")}
                className="p-2 transition-all flex items-center justify-center text-white/60 hover:text-white/80"
              >
                {chartType === "candle" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="M7 14l4-4 3 3 5-6" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
                    <path d="M18 17V9"/>
                    <path d="M13 17V5"/>
                    <path d="M8 17v-3"/>
                  </svg>
                )}
              </button>
              {showTooltips && (
                <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] font-semibold text-white/90">{chartType === "candle" ? "Mode Ligne" : "Mode Bougies"}</div>
                  <div className="text-[9px] text-white/50 mt-0.5">{chartType === "candle" ? "Afficher en ligne" : "Afficher en chandeliers"}</div>
                </div>
              )}
            </div>

            {/* Reset */}
            <div className="relative group">
              <button
                onClick={() => {
                  if (timeScaleRef.current) timeScaleRef.current.fitContent();
                }}
                className="p-2 transition-all flex items-center justify-center text-white/60 hover:text-white/80"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M3 21v-5h5"/>
                </svg>
              </button>
              {showTooltips && (
                <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] font-semibold text-white/90">Réinitialiser</div>
                  <div className="text-[9px] text-white/50 mt-0.5">Ajuster le zoom automatiquement</div>
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <div className="relative group">
              <button
                onClick={toggleFullscreen}
                className="p-2 transition-all flex items-center justify-center text-white/60 hover:text-white/80"
              >
                {isFullscreen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
                    <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                    <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
                    <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                    <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                    <rect width="10" height="8" x="7" y="8" rx="1"/>
                  </svg>
                )}
              </button>
              {showTooltips && (
                <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] font-semibold text-white/90">{isFullscreen ? "Quitter" : "Plein écran"}</div>
                  <div className="text-[9px] text-white/50 mt-0.5">{isFullscreen ? "Appuyez sur Échap" : "Agrandir le graphique"}</div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="relative group">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 transition-all flex items-center justify-center ${
                  showSettings ? "text-xcannes-green" : "text-white/60 hover:text-white/80"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              {showTooltips && (
                <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] font-semibold text-white/90">Paramètres</div>
                  <div className="text-[9px] text-white/50 mt-0.5">Configuration du graphique</div>
                </div>
              )}
              
              {/* Dropdown menu des paramètres */}
              {showSettings && (
                <div className="absolute top-full mt-2 right-0 bg-black/95 border border-white/20 rounded-lg p-2.5 shadow-xl z-40 min-w-[170px]">
                  <div className="text-[10px] font-semibold text-white/90 mb-2 pb-1.5 border-b border-white/10">
                    Paramètres
                  </div>
                  
                  {/* Option Grille */}
                  <button
                    onClick={() => setChartSettings({ ...chartSettings, showGrid: !chartSettings.showGrid })}
                    className="flex items-center justify-between w-full px-1.5 py-1.5 text-[10px] rounded hover:bg-white/5 transition-all mb-0.5"
                  >
                    <span className="text-white/80">Grille</span>
                    <div className={`w-7 h-3.5 rounded-full transition-all relative ${
                      chartSettings.showGrid ? "bg-xcannes-green" : "bg-white/20"
                    }`}>
                      <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${
                        chartSettings.showGrid ? "left-3.5" : "left-0.5"
                      }`}></div>
                    </div>
                  </button>
                  
                  {/* Option Crosshair */}
                  <button
                    onClick={() => setChartSettings({ ...chartSettings, showCrosshair: !chartSettings.showCrosshair })}
                    className="flex items-center justify-between w-full px-1.5 py-1.5 text-[10px] rounded hover:bg-white/5 transition-all mb-0.5"
                  >
                    <span className="text-white/80">Crosshair</span>
                    <div className={`w-7 h-3.5 rounded-full transition-all relative ${
                      chartSettings.showCrosshair ? "bg-xcannes-green" : "bg-white/20"
                    }`}>
                      <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${
                        chartSettings.showCrosshair ? "left-3.5" : "left-0.5"
                      }`}></div>
                    </div>
                  </button>
                  
                  {/* Option Auto-scale */}
                  <button
                    onClick={() => setChartSettings({ ...chartSettings, autoScale: !chartSettings.autoScale })}
                    className="flex items-center justify-between w-full px-1.5 py-1.5 text-[10px] rounded hover:bg-white/5 transition-all"
                  >
                    <span className="text-white/80">Auto-scale</span>
                    <div className={`w-7 h-3.5 rounded-full transition-all relative ${
                      chartSettings.autoScale ? "bg-xcannes-green" : "bg-white/20"
                    }`}>
                      <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${
                        chartSettings.autoScale ? "left-3.5" : "left-0.5"
                      }`}></div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal overlay pour fermer le menu settings en cliquant en dehors */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* Container avec barre latérale gauche */}
      <div className="flex">
        {/* Barre verticale gauche - Indicateurs et Overlays */}
        <div className="w-12 border-r border-white/10 flex flex-col gap-3 p-1.5">
          {/* Toggle Tooltips */}
          <div className="relative group border-b border-white/10 pb-3">
            <button
              onClick={() => setShowTooltips(!showTooltips)}
              className={`w-full aspect-square transition-all flex items-center justify-center ${
                showTooltips ? "text-white/60 hover:text-white/80" : "text-red-500"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showTooltips ? (
                  <>
                    {/* Bulle de dialogue */}
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </>
                ) : (
                  <>
                    {/* Bulle de dialogue barrée */}
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </>
                )}
              </svg>
            </button>
            {showTooltips && (
              <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                <div className="text-[11px] font-semibold text-white/90">Masquer les tooltips</div>
                <div className="text-[9px] text-white/50 mt-0.5">Désactiver les infobulles</div>
              </div>
            )}
          </div>

          {/* Hide/Show All Indicators */}
          <div className="relative group border-b border-white/10 pb-3">
            <button
              onClick={() => {
                const newState = !hideAllIndicators;
                setHideAllIndicators(newState);
                if (newState) {
                  // Masquer tous les indicateurs
                  setShowVolume(false);
                  setShowRSI(false);
                  setShowMACD(false);
                  setShowBollinger(false);
                  setShowVWAP(false);
                  setShowSMA({ sma20: false, sma50: false, sma200: false });
                  setShowEMA({ ema20: false, ema50: false, ema200: false });
                } else {
                  // Réafficher le volume par défaut
                  setShowVolume(true);
                }
              }}
              className={`w-full aspect-square transition-all flex items-center justify-center ${
                hideAllIndicators
                  ? "text-red-500"
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {hideAllIndicators ? (
                  <>
                    {/* Œil barré */}
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </>
                ) : (
                  <>
                    {/* Œil normal */}
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </>
                )}
              </svg>
            </button>
            {showTooltips && (
              <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                <div className="text-[11px] font-semibold text-white/90">{hideAllIndicators ? "Afficher" : "Masquer"} tout</div>
                <div className="text-[9px] text-white/50 mt-0.5">{hideAllIndicators ? "Réafficher les indicateurs" : "Cacher tous les indicateurs"}</div>
              </div>
            )}
          </div>

          {/* Volume */}
          <div className="relative group">
            <button
              onClick={() => setShowVolume(!showVolume)}
              className={`w-full aspect-square transition-all flex items-center justify-center ${
                showVolume
                  ? "text-xcannes-green"
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17v-4" />
                <path d="M7 17v-8" />
                <path d="M11 17V9" />
                <path d="M15 17v-6" />
                <path d="M19 17v-10" />
                <path d="M2 17h20" />
              </svg>
            </button>
            {showTooltips && (
              <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                <div className="text-[11px] font-semibold text-white/90">Volume</div>
                <div className="text-[9px] text-white/50 mt-0.5">Histogramme des volumes</div>
              </div>
            )}
          </div>
          
          {/* RSI */}
          <div className="relative group">
            <button
              onClick={() => setShowRSI(!showRSI)}
              className={`w-full aspect-square transition-all flex items-center justify-center ${
                showRSI
                  ? "text-xcannes-green"
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17c2-3 4-6 7-6s5 3 7 3 4-3 4-3" />
                <path d="M3 21h18" />
                <path d="M3 3h18" />
              </svg>
            </button>
            {showTooltips && (
              <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                <div className="text-[11px] font-semibold text-white/90">RSI</div>
                <div className="text-[9px] text-white/50 mt-0.5">Relative Strength Index</div>
              </div>
            )}
          </div>
          
          {/* MACD */}
          <div className="relative group">
            <button
              onClick={() => setShowMACD(!showMACD)}
              className={`w-full aspect-square text-[10px] font-bold transition-all flex items-center justify-center ${
                showMACD
                  ? "text-xcannes-green"
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              MACD
            </button>
            {showTooltips && (
              <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                <div className="text-[11px] font-semibold text-white/90">MACD</div>
                <div className="text-[9px] text-white/50 mt-0.5">Moving Average Convergence Divergence</div>
              </div>
            )}
          </div>
          
          {/* Bollinger Bands */}
          <div className="relative group">
            <button
              onClick={() => setShowBollinger(!showBollinger)}
              className={`w-full aspect-square text-[10px] font-bold transition-all flex items-center justify-center ${
                showBollinger
                  ? "text-xcannes-green"
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              BB
            </button>
            {showTooltips && (
              <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                <div className="text-[11px] font-semibold text-white/90">Bollinger Bands</div>
                <div className="text-[9px] text-white/50 mt-0.5">Bandes de volatilité</div>
              </div>
            )}
          </div>
          
          {/* SMA avec dropdown */}
          <div className="relative group">
            <button
              className={`w-full aspect-square text-[10px] font-bold transition-all flex items-center justify-center ${
                showSMA.sma20 || showSMA.sma50 || showSMA.sma200
                  ? "text-xcannes-green"
                  : "text-white/60 hover:text-white/80"
              }`}
              title="Simple Moving Average"
            >
              SMA
            </button>
            {showTooltips && (
              <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 min-w-[110px]">
                <button
                  onClick={() => setShowSMA({ ...showSMA, sma20: !showSMA.sma20 })}
                  className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all mb-1 ${
                    showSMA.sma20
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>
                  SMA 20
                </button>
                <button
                  onClick={() => setShowSMA({ ...showSMA, sma50: !showSMA.sma50 })}
                  className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all mb-1 ${
                    showSMA.sma50
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1.5"></span>
                  SMA 50
                </button>
                <button
                  onClick={() => setShowSMA({ ...showSMA, sma200: !showSMA.sma200 })}
                  className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all ${
                    showSMA.sma200
                      ? "bg-red-500/20 text-red-400"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5"></span>
                  SMA 200
                </button>
              </div>
            )}
          </div>
          
          {/* EMA avec dropdown */}
          <div className="relative group">
            <button
              className={`w-full aspect-square text-[10px] font-bold transition-all flex items-center justify-center ${
                showEMA.ema20 || showEMA.ema50 || showEMA.ema200
                  ? "text-xcannes-green"
                  : "text-white/60 hover:text-white/80"
              }`}
              title="Exponential Moving Average"
            >
              EMA
            </button>
            {showTooltips && (
              <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 min-w-[110px]">
                <button
                  onClick={() => setShowEMA({ ...showEMA, ema20: !showEMA.ema20 })}
                  className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all mb-1 ${
                    showEMA.ema20
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-500 mr-1.5"></span>
                  EMA 20
                </button>
                <button
                  onClick={() => setShowEMA({ ...showEMA, ema50: !showEMA.ema50 })}
                  className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all mb-1 ${
                    showEMA.ema50
                      ? "bg-purple-500/20 text-purple-400"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1.5"></span>
                  EMA 50
                </button>
                <button
                  onClick={() => setShowEMA({ ...showEMA, ema200: !showEMA.ema200 })}
                  className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all ${
                    showEMA.ema200
                      ? "bg-pink-500/20 text-pink-400"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-pink-500 mr-1.5"></span>
                  EMA 200
                </button>
              </div>
            )}
          </div>
          
          {/* VWAP */}
          <div className="relative group">
            <button
              onClick={() => setShowVWAP(!showVWAP)}
              className={`w-full aspect-square text-[10px] font-bold transition-all flex items-center justify-center ${
                showVWAP
                  ? "text-xcannes-green"
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              VWAP
            </button>
            {showTooltips && (
              <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                <div className="text-[11px] font-semibold text-white/90">VWAP</div>
                <div className="text-[9px] text-white/50 mt-0.5">Volume Weighted Average Price</div>
              </div>
            )}
          </div>
        </div>

        {/* Zone du graphique */}
        <div className="flex-1">
          {/* Chart Container */}
          <div className="relative w-full">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-white/60 text-sm">Chargement des données...</p>
            </div>
          </div>
        )}

        {noDataMessage && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <div className="text-center max-w-md px-6">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-lg font-semibold text-white mb-2">
                Service de données indisponible
              </p>
              <p className="text-sm text-white/60 mb-4">{noDataMessage}</p>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                <p className="text-xs text-white/60 leading-relaxed">
                  L&rsquo;API data.xrplf.org ne répond plus correctement. Le Order
                  Book en temps réel fonctionne toujours via
                  wss://xrplcluster.com
                </p>
              </div>
              <div className="text-xs text-white/40">
                En attendant, consultez l&rsquo;Order Book ci-dessous pour les prix en
                temps réel
              </div>
            </div>
          </div>
        )}

        <div
          ref={chartRef}
          className="w-full relative z-0"
          style={{ 
            height: chartHeight, 
            minHeight: chartHeight 
          }}
        />

        {/* RSI Chart Container */}
        {showRSI && (
          <div className="w-full border-t border-white/10">
            <div className="px-4 py-2 bg-black/20">
              <span className="text-xs text-white/60 font-medium">RSI (14)</span>
            </div>
            <div
              id="rsi-chart-container"
              className="w-full relative z-0"
              style={{ height: "150px", minHeight: "150px" }}
            />
          </div>
        )}

        {/* MACD Chart Container */}
        {showMACD && (
          <div className="w-full border-t border-white/10">
            <div className="px-4 py-2 bg-black/20">
              <span className="text-xs text-white/60 font-medium">MACD (12, 26, 9)</span>
            </div>
            <div
              id="macd-chart-container"
              className="w-full relative z-0"
              style={{ height: "150px", minHeight: "150px" }}
            />
          </div>
        )}
        </div>
        </div>
      </div>

      {/* Footer Stats */}
      {!isFullscreen && (
        <div className="p-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-white/40 mb-1">24h High</p>
            <p className="text-sm font-semibold text-white">
              {stats24h.high ? stats24h.high.toFixed(6) : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">24h Low</p>
            <p className="text-sm font-semibold text-white">
              {stats24h.low ? stats24h.low.toFixed(6) : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">24h Volume</p>
            <p className="text-sm font-semibold text-white">
              {stats24h.volume
                ? stats24h.volume.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1">Market Cap</p>
            <p className="text-sm font-semibold text-white">-</p>
          </div>
        </div>
      )}
    </div>
  );
}
