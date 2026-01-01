"use client";

import React, { useEffect, useRef, useState, useMemo, useReducer, useCallback } from "react";
import Link from "next/link";
import { createChart } from "lightweight-charts";
import xcannesApi from "../../../lib/xcannesApi";
import { MARKET_STRUCTURE, getPairCategory } from "../../../utils/marketStructure"; // ✅ Structure des marchés
import { useXcannesWS } from "../../../context/XcannesWSContext";
import PriceTicker from "../../marketGlobal/PriceTicker";
import {
  calculateBollingerBands,
  calculateEMA,
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateVWAP,
} from "./indicators";
import ChartHeader from "./components/ChartHeader";
import useMarketData from "./hooks/useMarketData";
import IndicatorsToolbar from "./components/IndicatorsToolbar";
import ChartFooter from "./components/ChartFooter";
import ChartCanvas from "./components/ChartCanvas";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const logError = (...args) => {
  if (DEBUG_LOGS) console.error(...args);
};

export default function XrplCandleChartRaw({
  pair = "XCS/XRP",
  interval = "1m",
  onPairChange,
  onIntervalChange,
  availablePairs = [],
  availableIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"],
}) {
  // ✅ Guard: S'assurer qu'on est côté client
  const [isClient, setIsClient] = useState(typeof window !== "undefined");
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const chartRef = useRef();
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const timeScaleRef = useRef(null);
  const initialVisibleRangeRef = useRef(null);
  const rsiChartRef = useRef(null); // legacy (plus utilisé pour un chart séparé)
  const rsiSeriesRef = useRef({
    main: null,
    overbought: null,
    oversold: null,
  });
  const macdChartRef = useRef(null); // legacy (plus utilisé pour un chart séparé)
  const macdSeriesRef = useRef({
    macd: null,
    signal: null,
    histogram: null,
    zeroLine: null,
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
  const oldestTimeRef = useRef(null);
  const newestTimeRef = useRef(null);
  const [statusBar, setStatusBar] = useState(null);
  const [crosshairPoint, setCrosshairPoint] = useState(null);
  const crosshairRafRef = useRef(null);
  const lastCrosshairParamRef = useRef(null);

  // États pour les fonctionnalités modernes
  const [chartType, setChartType] = useState("candle"); // "candle" ou "line"
  const [indicatorsState, dispatchIndicators] = useReducer(
    (state, action) => {
      switch (action.type) {
        case "SET":
          return { ...state, [action.key]: action.value };
        case "SET_SMA":
          return { ...state, showSMA: { ...state.showSMA, ...action.value } };
        case "SET_EMA":
          return { ...state, showEMA: { ...state.showEMA, ...action.value } };
        default:
          return state;
      }
    },
    {
      showVolume: false,
      showBollinger: false,
      showRSI: false,
      showMACD: false,
      showVWAP: false,
      showSMA: { sma20: false, sma50: false, sma200: false },
      showEMA: { ema20: false, ema50: false, ema200: false },
      hideAllIndicators: false,
      showTooltips: true,
    }
  );
  const { showVolume, showBollinger, showRSI, showMACD, showVWAP, showSMA, showEMA, hideAllIndicators, showTooltips } =
    indicatorsState;

  const setIndicator = useCallback((key) => (value) => dispatchIndicators({ type: "SET", key, value }), []);
  const setShowVolume = useCallback((v) => dispatchIndicators({ type: "SET", key: "showVolume", value: v }), []);
  const setShowBollinger = useCallback((v) => dispatchIndicators({ type: "SET", key: "showBollinger", value: v }), []);
  const setShowRSI = useCallback((v) => dispatchIndicators({ type: "SET", key: "showRSI", value: v }), []);
  const setShowMACD = useCallback((v) => dispatchIndicators({ type: "SET", key: "showMACD", value: v }), []);
  const setShowVWAP = useCallback((v) => dispatchIndicators({ type: "SET", key: "showVWAP", value: v }), []);
  const setShowTooltips = useCallback((v) => dispatchIndicators({ type: "SET", key: "showTooltips", value: v }), []);
  const setHideAllIndicators = useCallback(
    (v) => dispatchIndicators({ type: "SET", key: "hideAllIndicators", value: v }),
    []
  );
  const setShowSMA = useCallback((obj) => dispatchIndicators({ type: "SET_SMA", value: obj }), []);
  const setShowEMA = useCallback((obj) => dispatchIndicators({ type: "SET_EMA", value: obj }), []);
  
  // États pour les paramètres du graphique
  const [showSettings, setShowSettings] = useState(false);
  const [chartSettings, setChartSettings] = useState({
    showGrid: true,
    showCrosshair: true,
    autoScale: true,
  });

  // Sur smartphone, démarrer en mode "line" pour un look plus lisible
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) {
      setChartType("line");
      // Sur smartphone: désactiver la crosshair par défaut
      setChartSettings((prev) => ({ ...prev, showCrosshair: false }));
    }
  }, []);

  // FX EOD mode (Fawaz)
  const [fxBase, setFxBase] = useState("EUR");
  const [fxQuote, setFxQuote] = useState("USD");
  const [fxInfo, setFxInfo] = useState({ price: null, changePercent: null });
  const [fxLoading, setFxLoading] = useState(false);
  const [isFxMode, setIsFxMode] = useState(false);
  const [pairMode, setPairMode] = useState("live"); // 'live' | 'eod'

  // Données marché centralisées (historiques + live + stats)
  const {
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
  } = useMarketData({ pair, interval, isFxMode, fxBase, fxQuote });

  // Normalisation défensive des données de bougies pour le chart
  const sanitizeCandles = useCallback((source) => {
    if (!Array.isArray(source)) return [];
    return source
      .filter((c) => c && c.time != null && Number.isFinite(Number(c.time)))
      .map((c) => {
        const time = Number(c.time);
        const open = Number.isFinite(Number(c.open)) ? Number(c.open) : 0;
        const high = Number.isFinite(Number(c.high)) ? Number(c.high) : open;
        const low = Number.isFinite(Number(c.low)) ? Number(c.low) : open;
        const close = Number.isFinite(Number(c.close)) ? Number(c.close) : open;
        const volume = Number.isFinite(Number(c.volume)) ? Number(c.volume) : 0;
        return { time, open, high, low, close, volume };
      });
  }, []);

  // Réinitialiser les moyennes mobiles (SMA/EMA)
  // quand on change de paire, pour éviter qu'une ligne
  // reste affichée "par défaut" sur un nouveau marché.
  useEffect(() => {
    dispatchIndicators({
      type: "SET_SMA",
      value: { sma20: false, sma50: false, sma200: false },
    });
    dispatchIndicators({
      type: "SET_EMA",
      value: { ema20: false, ema50: false, ema200: false },
    });
  }, [pair]);

  // Ancien système de lazy-load de l'historique retiré pour simplifier:
  // le chart affiche simplement les bougies fournies par useMarketData
  // sans tenter de charger plus d'historique au scroll.
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

  // Lorsque le menu est ouvert, ouvrir par défaut la bonne section:
  // - Live => marché XRPL
  // - EOD (isFxMode) => marché Devises (Pyth)
  useEffect(() => {
    if (!dropdownOpen) return;

    setExpandedMarkets((prev) => {
      const next = { ...prev };
      Object.keys(MARKET_STRUCTURE).forEach((marketKey) => {
        if (isFxMode) {
          // En mode EOD, on met en avant les Devises
          next[marketKey] = marketKey === "pyth";
        } else {
          // En mode Live, on met en avant XRPL
          next[marketKey] = marketKey === "xrpl";
        }
      });
      return next;
    });
  }, [dropdownOpen, isFxMode]);
  
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
    const category = getPairCategory(selectedPair);
    const isFxPair = category !== "xrpl";

    if (pairMode === "eod" && isFxPair) {
      const [base, quote] = selectedPair.split("/");
      if (base && quote) {
        setFxBase(base);
        setFxQuote(quote);
        setIsFxMode(true);
      } else {
        setIsFxMode(true);
      }
    } else {
      setIsFxMode(false);
    }

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

  // ✅ Charger les données FX EOD (Fawaz) pour la paire sélectionnée dans le header FX
  useEffect(() => {
    let cancelled = false;

    const loadFx = async () => {
      setFxLoading(true);
      try {
        const data = await xcannesApi.getFxEod(fxBase, fxQuote, 365);
        if (cancelled || !data || !Array.isArray(data.candles) || data.candles.length === 0) {
          setFxInfo({ price: null, changePercent: null });
          return;
        }
        const candles = data.candles;
        const last = candles[candles.length - 1];
        const prev = candles.length > 1 ? candles[candles.length - 2] : null;
        const lastClose = Number(last.close) || 0;
        const prevClose = prev ? Number(prev.close) || 0 : null;
        let changePct = null;
        if (prevClose && prevClose !== 0) {
          changePct = ((lastClose - prevClose) / prevClose) * 100;
        }
        setFxInfo({
          price: lastClose,
          changePercent: changePct,
        });
      } catch (err) {
        logError("[Chart FX] Erreur FX EOD:", err);
        setFxInfo({ price: null, changePercent: null });
      } finally {
        if (!cancelled) setFxLoading(false);
      }
    };

    loadFx();

    return () => {
      cancelled = true;
    };
  }, [fxBase, fxQuote]);

  useEffect(() => {
    oldestTimeRef.current = null;
    newestTimeRef.current = null;
  }, [pair, interval, isFxMode, fxBase, fxQuote]);

  // ✅ Effet pour connecter/déconnecter le WebSocket
  // ✅ Le WebSocket est maintenant géré par XcannesWSContext, pas besoin de l'effet ci-dessous

  useEffect(() => {
    let chart;
    let observer;
    let fitContentTimeout = null;
    let isActive = true;
    const timeRangeHandlers = [];
    const logicalRangeHandlers = [];
    let crosshairHandler = null;
    let clickHandler = null;

    const unsubscribeTimeHandlers = () => {
      if (!chartInstanceRef.current) return;
      const timeScale = chartInstanceRef.current.timeScale?.();
      if (!timeScale) return;
      timeRangeHandlers.forEach((handler) => {
        try {
          timeScale.unsubscribeVisibleTimeRangeChange(handler);
        } catch (_) {}
      });
      logicalRangeHandlers.forEach((handler) => {
        try {
          timeScale.unsubscribeVisibleLogicalRangeChange(handler);
        } catch (_) {}
      });
      timeRangeHandlers.length = 0;
      logicalRangeHandlers.length = 0;
    };

    const disposeCharts = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (fitContentTimeout) {
        clearTimeout(fitContentTimeout);
        fitContentTimeout = null;
      }
      if (crosshairRafRef.current) {
        cancelAnimationFrame(crosshairRafRef.current);
        crosshairRafRef.current = null;
        lastCrosshairParamRef.current = null;
      }
      unsubscribeTimeHandlers();
      if (rsiChartRef.current) {
        try {
          rsiChartRef.current.remove();
        } catch (_) {}
        rsiChartRef.current = null;
      }
      if (macdChartRef.current) {
        try {
          macdChartRef.current.remove();
        } catch (_) {}
        macdChartRef.current = null;
      }
      if (chartInstanceRef.current) {
        try {
          if (crosshairHandler) {
            try {
              chartInstanceRef.current.unsubscribeCrosshairMove(crosshairHandler);
            } catch (_) {}
          }
          if (clickHandler) {
            try {
              chartInstanceRef.current.unsubscribeClick(clickHandler);
            } catch (_) {}
          }
          chartInstanceRef.current.remove();
        } catch (_) {}
        chartInstanceRef.current = null;
      }
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      vwapSeriesRef.current = null;
      smaSeriesRef.current = { sma20: null, sma50: null, sma200: null };
      emaSeriesRef.current = { ema20: null, ema50: null, ema200: null };
      bollingerSeriesRef.current = { upper: null, middle: null, lower: null };
      macdSeriesRef.current = { macd: null, signal: null, histogram: null, zeroLine: null };
      rsiSeriesRef.current = { main: null, overbought: null, oversold: null };
      currentCandleRef.current = null;
    };

    const setupChart = () => {
      disposeCharts();
      const data = sanitizeCandles(candles || []);
      if (!isActive) return;

      const containerWidth = chartRef.current?.clientWidth || 800;
      const containerHeight = chartRef.current?.clientHeight || 500;

      const isMobileScreen =
        typeof window !== "undefined" && window.innerWidth < 768;
      // Garder la ligne de prix actuelle visible sur tous les écrans
      const priceLineVisibleMain = true;
      const lastValueVisibleMain = true;

      // Harmoniser les couleurs avec le design XCANNES (tokens CSS)
      let bgColor = "#0b1017";
      let textColor = "#e5e7eb";
      let gridColor = "#111827";
      let borderColor = "rgba(148, 163, 184, 0.35)";

      try {
        if (typeof window !== "undefined" && window.getComputedStyle) {
          const root = window.getComputedStyle(document.documentElement);
          bgColor =
            root.getPropertyValue("--bg-elevated")?.trim() || bgColor;
          textColor =
            root.getPropertyValue("--text-secondary")?.trim() || textColor;
          gridColor =
            root.getPropertyValue("--bg-subtle")?.trim() || gridColor;
          borderColor =
            root.getPropertyValue("--border-subtle")?.trim() || borderColor;
        }
      } catch (_) {
        // Fallback silencieux si les tokens ne sont pas disponibles
      }

      chart = createChart(chartRef.current, {
        width: containerWidth,
        height: containerHeight,
        layout: {
          background: { color: bgColor },
          textColor,
        },
        grid: {
          vertLines: {
            color: chartSettings.showGrid ? gridColor : "transparent",
          },
          horzLines: {
            color: chartSettings.showGrid ? gridColor : "transparent",
          },
        },
        crosshair: {
          mode: chartSettings.showCrosshair ? 1 : 0,
          vertLine: {
            color: "#10b981ff",
            width: 1,
            style: 3,
            labelBackgroundColor: "#10b981ff",
          },
          horzLine: {
            color: "#10b981ff",
            width: 1,
            style: 3,
            labelBackgroundColor: "#10b981ff",
          },
        },
        timeScale: {
          borderColor,
          timeVisible: true,
          secondsVisible: interval === "1m",
          rightOffset: 0.5, // Légèrement réduit pour coller plus le prix au bord droit
          barSpacing: 8,
          // ✅ minBarSpacing supprimé (dynamique)
          // ✅ fixLeftEdge supprimé (bloquait le recalcul)
          lockVisibleTimeRangeOnResize: true,
          rightBarStaysOnScroll: true,
          shiftVisibleRangeOnNewBar: true,
        },
        handleScale: {
          axisPressedMouseMove: {
            time: true,
            price: true,
          },
          mouseWheel: true,
          pinch: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        rightPriceScale: {
          borderColor,
          scaleMargins: {
            top: 0.1, // Marge haute raisonnable
            bottom: showVolume ? 0.25 : 0.1, // Espace pour volume si activé
          },
          autoScale: true, // ✅ Activé
          mode: 0, // Mode normal (pas logarithmique)
          // ✅ Formatter personnalisé pour afficher 5 digits sur la price scale
          // Les données restent en pleine précision, seul l'affichage change
          tickMarkFormatter: (price) => {
            return price.toFixed(5);
          },
        },
      });

      chartInstanceRef.current = chart;
      timeScaleRef.current = chart.timeScale();

      // Créer la série selon le type de graphique
      if (chartType === "candle") {
        candleSeriesRef.current = chart.addCandlestickSeries({
          // Même palette que l'orderbook : vert xcannes-green, rouge xcannes-red
          upColor: "#10b981c0",
          downColor: "#f16262ff",
          borderUpColor: "#10b981c0",
          borderDownColor: "#f16262ff",
          wickUpColor: "#10b981c0",
          wickDownColor: "#f16262ff",
          priceLineVisible: priceLineVisibleMain,
          lastValueVisible: lastValueVisibleMain,
          priceFormat: {
            type: "price",
            precision: 5,
            minMove: 0.00001,
          },
        });

        // Données bougies
        candleSeriesRef.current.setData(data);
      } else {
        // Mode ligne : une seule série area (ligne + ombre)
        const lineData = data.map((d) => ({
          time: d.time,
          value: d.close,
        }));

        candleSeriesRef.current = chart.addAreaSeries({
          lineColor: "#10b981c0",
          topColor: isMobileScreen
            ? "rgba(16, 185, 129, 0.18)"
            : "rgba(16, 185, 129, 0.10)",
          bottomColor: "rgba(16, 185, 129, 0.0)",
          lineWidth: 2,
          priceLineVisible: priceLineVisibleMain,
          lastValueVisible: lastValueVisibleMain,
          priceFormat: {
            type: "price",
            precision: 5,
            minMove: 0.00001,
          },
        });
        candleSeriesRef.current.setData(lineData);
      }

      // Barre de statut OHLC (type Binance) + crosshair custom (utile sur mobile)
      if (chart && candleSeriesRef.current) {
        const updateStatusFromParam = (param) => {
          const series = candleSeriesRef.current;
          if (!series || !param) return;

          // Mettre à jour la position de la crosshair uniquement
          // si l'option crosshair est activée.
          // Même si aucun "bar" n'est trouvé (zone vide à droite du chart, etc.).
          if (chartSettings.showCrosshair && param.point) {
            setCrosshairPoint({ x: param.point.x, y: param.point.y });
          }

          const bar = param.seriesData.get(series);
          if (!bar || !bar.time) {
            // Ne rien effacer: garder la dernière valeur pour que la status line reste visible
            return;
          }

          const { time, open, high, low, close } = bar;
          const numericClose = Number(close ?? bar.value ?? 0);
          const numericOpen = Number(open ?? numericClose);

          setStatusBar({
            time,
            open: Number(open ?? numericClose),
            high: Number(high ?? numericClose),
            low: Number(low ?? numericClose),
            close: numericClose,
            isUp: numericClose >= numericOpen,
          });
        };

        const scheduleStatusUpdate = (param) => {
          lastCrosshairParamRef.current = param;
          if (crosshairRafRef.current) return;
          crosshairRafRef.current = requestAnimationFrame(() => {
            crosshairRafRef.current = null;
            const latest = lastCrosshairParamRef.current;
            lastCrosshairParamRef.current = null;
            if (latest) {
              updateStatusFromParam(latest);
            }
          });
        };

        crosshairHandler = (param) => {
          scheduleStatusUpdate(param);
        };

        clickHandler = (param) => {
          updateStatusFromParam(param);
        };

        chart.subscribeCrosshairMove(crosshairHandler);
        chart.subscribeClick(clickHandler);
      }
      
      // Ajouter le volume si activé (XRPL uniquement, pas FX/Pyth)
      if (showVolume && !isFxMode && !isExternal) {
        volumeSeriesRef.current = chart.addHistogramSeries({
          color: "#10b981c0",
          priceFormat: { type: "volume" },
          priceScaleId: "",
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        const volumeData = data.map((d) => ({
          time: d.time,
          value: d.volume || 0,
          color: d.close >= d.open ? "#10b98136" : "#f1626238",
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
          color: "#10b981ff",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        bollingerSeriesRef.current.lower.setData(bollinger.lower);
      }

      // Ajouter le VWAP si activé (XRPL uniquement)
      if (showVWAP && data.length > 0 && !isFxMode && !isExternal) {
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

      // Ajouter le RSI en overlay dans le même chart (plus de panneau séparé)
      if (showRSI && data.length > 15) {
        const rsiData = calculateRSI(data, 14);

        // Série principale RSI
        if (!rsiSeriesRef.current.main) {
          rsiSeriesRef.current.main = chart.addLineSeries({
            color: "#9333ea",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            priceScaleId: "rsi",
          });

          // Price scale dédiée au RSI, en bas du chart
          chart.priceScale("rsi").applyOptions({
            position: "right",
            scaleMargins: {
              top: 0.75,
              bottom: 0.02,
            },
          });
        }
        rsiSeriesRef.current.main.setData(rsiData);

        // Lignes 30 / 70
        const boundsData = data.map((d) => ({ time: d.time, value: 70 }));
        const lowerData = data.map((d) => ({ time: d.time, value: 30 }));

        if (!rsiSeriesRef.current.overbought) {
          rsiSeriesRef.current.overbought = chart.addLineSeries({
            color: "rgba(220, 38, 38, 0.5)",
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            priceScaleId: "rsi",
          });
        }
        if (!rsiSeriesRef.current.oversold) {
          rsiSeriesRef.current.oversold = chart.addLineSeries({
            color: "rgba(34, 197, 94, 0.5)",
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            priceScaleId: "rsi",
          });
        }

        rsiSeriesRef.current.overbought.setData(boundsData);
        rsiSeriesRef.current.oversold.setData(lowerData);
      }

      // Ajouter le MACD en overlay dans le même chart (plus de panneau séparé)
      if (showMACD && data.length > 35) {
        const macdData = calculateMACD(data, 12, 26, 9);

        // Price scale dédiée au MACD, entre le prix et le RSI
        if (!macdSeriesRef.current.macd) {
          chart.priceScale("macd").applyOptions({
            position: "right",
            scaleMargins: {
              top: 0.55,
              bottom: 0.25,
            },
          });

          macdSeriesRef.current.macd = chart.addLineSeries({
            color: "#2196f3",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            priceScaleId: "macd",
          });

          macdSeriesRef.current.signal = chart.addLineSeries({
            color: "#ff9800",
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            priceScaleId: "macd",
          });

          macdSeriesRef.current.histogram = chart.addHistogramSeries({
            priceFormat: { type: "price", precision: 5, minMove: 0.00001 },
            priceScaleId: "macd",
          });

          macdSeriesRef.current.zeroLine = chart.addLineSeries({
            color: "rgba(255, 255, 255, 0.3)",
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            priceScaleId: "macd",
          });
        }

        macdSeriesRef.current.macd.setData(macdData.macd);
        macdSeriesRef.current.signal.setData(macdData.signal);
        macdSeriesRef.current.histogram.setData(macdData.histogram);
        macdSeriesRef.current.zeroLine.setData(
          macdData.macd.map((d) => ({ time: d.time, value: 0 }))
        );
      }

      // Calculer les statistiques
      const realData = data.filter(
        (c) => c.open !== 0 || c.high !== 0 || c.low !== 0 || c.close !== 0
      );

      // 📅 Autozoom horizontal seulement (pas vertical) - limiter à ~60 bougies visibles
      const total = realData.length;
      const visibleCount = Math.min(60, total);
      const lastIndex = total - 1;
      const firstIndex = Math.max(0, lastIndex - visibleCount + 1);
      const first = realData[firstIndex]?.time;
      const last = realData[lastIndex]?.time;

      if (first && last && chart?.timeScale) {
        const rawSpan = last - first;
        const intervalSeconds = intervalSecondsRef.current || 60;
        const fallbackSpan = intervalSeconds * visibleCount;
        const span = rawSpan > 0 ? rawSpan : fallbackSpan;

        // Marge asymétrique pour "pousser" les bougies vers le centre :
        // un peu d'espace à gauche, plus d'espace à droite.
        const leftMargin = Math.floor(span * 0.1);
        const rightMargin = Math.floor(span * 0.3);

        const from = first - leftMargin;
        const to = last + rightMargin;

        // Sécurité: n'appeler setVisibleRange que si la fenêtre est valide
        if (Number.isFinite(from) && Number.isFinite(to) && to >= from) {
          try {
            chart.timeScale().setVisibleRange({ from, to });
          } catch (_) {
            // Ignorer les erreurs internes de lightweight-charts si la lib rejette la plage
          }
        }

        // Initialiser la status line + crosshair au milieu de la fenêtre visible
        const midIndex = Math.floor((firstIndex + lastIndex) / 2);
        const midCandle = realData[midIndex];

        if (midCandle && candleSeriesRef.current) {
          const midClose = Number(midCandle.close ?? midCandle.value ?? 0);
          const midOpen = Number(midCandle.open ?? midClose);

          setTimeout(() => {
            if (!isActive || !chart) return;
            // Si la crosshair est désactivée, ne pas initialiser
            // la crosshair custom au centre.
            if (!chartSettings.showCrosshair) {
              return;
            }
            const ts = chart.timeScale();
            const x = ts.timeToCoordinate(midCandle.time);
            const y = candleSeriesRef.current.priceToCoordinate(midClose);

            if (typeof x === "number" && typeof y === "number") {
              setStatusBar({
                time: midCandle.time,
                open: midOpen,
                high: Number(midCandle.high ?? midClose),
                low: Number(midCandle.low ?? midClose),
                close: midClose,
                isUp: midClose >= midOpen,
              });
              setCrosshairPoint({ x, y });
            }
          }, 60);
        }
      }

      // 🔒 Empêcher le scroll au-delà de la première / dernière bougie disponibles
      const firstTime = realData[0]?.time;
      const lastTime = realData[realData.length - 1]?.time;

      if (firstTime && lastTime && chart?.timeScale) {
        const timeScale = chart.timeScale();
        const clampVisibleRange = (range) => {
          if (!range) return;
          const attemptedFrom = range.from;
          let from = range.from;
          let to = range.to;
          let changed = false;

          const intervalSeconds = intervalSecondsRef.current || 60;
          const minTime = oldestTimeRef.current ?? firstTime;
          const maxBaseTime = newestTimeRef.current ?? lastTime;
          // ✅ Réduire à 2 bougies futures max pour éviter les bougies vides/aberrantes
          const maxTo = maxBaseTime + intervalSeconds * 2; // autoriser ~2 bougies de "future" seulement

          // Limite côté gauche : ne pas aller avant la première bougie
          if (from < minTime) {
            from = minTime;
            changed = true;
          }

          // Limite côté droit : ne pas aller plus loin que 2 bougies après la dernière
          if (to > maxTo) {
            const shift = to - maxTo;
            to = maxTo;
            from = from - shift;
            changed = true;
          }

          // Si en décalant on repasse avant la première bougie, on recale sur le début
          if (from < minTime) {
            from = minTime;
          }

          if (changed) {
            try {
              timeScale.setVisibleRange({ from, to });
            } catch (_) {}
          }
        };

        // Sur certains gestes (pinch/drag), seule la logical range change.
        // On écoute donc à la fois la time range et la logical range et on recalcule à partir de la time range courante.
        timeScale.subscribeVisibleTimeRangeChange(clampVisibleRange);
        timeRangeHandlers.push(clampVisibleRange);

        const logicalHandler = (logicalRange) => {
          if (!logicalRange) return;
          const currentRange = timeScale.getVisibleRange();
          if (currentRange) {
            clampVisibleRange(currentRange);
          }
        };

        timeScale.subscribeVisibleLogicalRangeChange(logicalHandler);
        logicalRangeHandlers.push(logicalHandler);
      }

      // ✅ SUPPRIMÉ: setVisibleRange sur priceScale (bloquait autoScale)
      // L'autoScale gérera automatiquement les prix visibles

      observer = new ResizeObserver(() => {
        if (!chartRef.current || !chart) return;
        chart.applyOptions({
          width: chartRef.current.clientWidth,
          height: chartRef.current.clientHeight,
        });
      });
      observer.observe(chartRef.current);
    };

    setupChart();

    return () => {
      isActive = false;
      disposeCharts();
    };
    // Note: candles, currentCandleRef, intervalSecondsRef, isExternal, isFxMode et sanitizeCandles
    // sont volontairement omis car ils sont soit des refs (stables), soit utilisés via closures.
    // Ajouter ces dépendances causerait des re-renders inutiles du chart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  ]);

  // Mettre à jour les séries lorsque les données changent sans recréer le chart
  useEffect(() => {
    if (!chartInstanceRef.current || !candleSeriesRef.current) return;
    if (!candles || !candles.length) return;

    const data = sanitizeCandles(candles);
    if (!data.length) return;

    oldestTimeRef.current = data[0].time;
    newestTimeRef.current = data[data.length - 1].time;

    if (chartType === "candle") {
      candleSeriesRef.current.setData(data);
    } else {
      const lineData = data.map((d) => ({
        time: d.time,
        value: d.close,
      }));

      // Mettre à jour la série area (ligne + ombre)
      candleSeriesRef.current.setData(lineData);
    }
  }, [candles, chartType, sanitizeCandles]);

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

    // Si la crosshair est désactivée (par ex. sur smartphone),
    // on cache aussi la crosshair custom overlay.
    if (!chartSettings.showCrosshair) {
      setCrosshairPoint(null);
    }
  }, [chartSettings]);

  // ✅ Guard: Ne pas render tant qu'on n'est pas côté client
  if (!isClient) {
    return (
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="h-10 bg-white/5 rounded-lg border border-white/10 animate-pulse" />
          <div className="h-64 md:h-80 bg-white/5 rounded-lg border border-white/10 animate-pulse" />
        </div>
      </div>
    );
  }

  const mobileWatermark = null;

  const noDataContent = (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-4">⚠️</div>
        <p className="text-lg font-semibold text-white mb-2">Service de données indisponible</p>
        <p className="text-sm text-white/60 mb-4">{noDataMessage}</p>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
          <p className="text-xs text-white/60 leading-relaxed">
            L&rsquo;API data.xrplf.org ne répond plus correctement. Le Order Book en temps réel fonctionne toujours via
            wss://xrplcluster.com
          </p>
        </div>
        <div className="text-xs text-white/40">
          En attendant, consultez l&rsquo;Order Book ci-dessous pour les prix en temps réel
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="rounded-xl md:rounded-none flex flex-col h-full"
    >
      {/* Bouton retour flottant mobile uniquement */}
      <Link
        href="/"
        className="md:hidden fixed top-0 left-0 z-50 text-white hover:text-xcannes-green transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </Link>

      <ChartHeader
        pair={pair}
        interval={interval}
        onPairChange={onPairChange}
        onIntervalChange={onIntervalChange}
        availableIntervals={availableIntervals}
        uniquePairs={uniquePairs}
        filteredMarketStructure={filteredMarketStructure}
        pairMode={pairMode}
        setPairMode={setPairMode}
        isFxMode={isFxMode}
        setIsFxMode={setIsFxMode}
        fxBase={fxBase}
        fxQuote={fxQuote}
        fxInfo={fxInfo}
        fxLoading={fxLoading}
        setFxBase={setFxBase}
        setFxQuote={setFxQuote}
        currentPrice={currentPrice}
        percent24h={percent24h}
        showTooltips={showTooltips}
        dropdownOpen={dropdownOpen}
        setDropdownOpen={setDropdownOpen}
        expandedMarkets={expandedMarkets}
        expandedCurrencies={expandedCurrencies}
        toggleMarket={toggleMarket}
        toggleCurrency={toggleCurrency}
        handlePairSelect={handlePairSelect}
        dropdownRef={dropdownRef}
        chartType={chartType}
        setChartType={setChartType}
        timeScaleRef={timeScaleRef}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        chartSettings={chartSettings}
        setChartSettings={setChartSettings}
      />

      {/* Modal overlay pour fermer le menu settings en cliquant en dehors */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* Container avec barre latérale gauche (masquée sur mobile) */}
      <div className="flex flex-1 min-h-0">
        <div className="hidden md:block">
          <IndicatorsToolbar
            showTooltips={showTooltips}
            setShowTooltips={setShowTooltips}
            hideAllIndicators={hideAllIndicators}
            setHideAllIndicators={setHideAllIndicators}
            showVolume={showVolume}
            setShowVolume={setShowVolume}
            showRSI={showRSI}
            setShowRSI={setShowRSI}
            showMACD={showMACD}
            setShowMACD={setShowMACD}
            showBollinger={showBollinger}
            setShowBollinger={setShowBollinger}
            showVWAP={showVWAP}
            setShowVWAP={setShowVWAP}
            showSMA={showSMA}
            setShowSMA={setShowSMA}
            showEMA={showEMA}
            setShowEMA={setShowEMA}
            isFxMode={isFxMode}
          />
        </div>
        <ChartCanvas
          chartRef={chartRef}
          statusBar={statusBar}
          crosshairPoint={crosshairPoint}
          loading={loading}
          noDataMessage={noDataMessage}
          noDataContent={noDataMessage ? noDataContent : null}
          interval={interval}
          chartClassName="w-full relative z-0 dex-chart-container"
          watermark={mobileWatermark}
        />
      </div>

      {/* Timeframes mobile sous le chart */}
      {pairMode === "live" &&
        availableIntervals.length > 0 &&
        typeof onIntervalChange === "function" && (
          <div className="sm:hidden px-3 py-2 bg-elevated">
            <div className="flex gap-2 justify-center overflow-x-auto no-scrollbar">
              {availableIntervals.map((int) => {
                const isActive = interval === int;
                return (
                  <button
                    key={int}
                    type="button"
                    onClick={() => !isFxMode && onIntervalChange(int)}
                    className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${
                      isActive
                        ? "bg-black/50 text-white text-[20px]"
                        : "text-muted text-[16px]"
                    }`}
                  >
                    {int}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {/* Footer Stats: desktop / tablette uniquement (mobile l'a déjà dans OrderbookSidebar) */}
      <div className="mt-0 hidden md:block">
        <ChartFooter 
          pair={pair} 
          fxMode={isFxMode}
          fxBase={fxBase}
          fxQuote={fxQuote}
          stats24h={stats24h}
        />
      </div>

      <style jsx>{`
        @keyframes liveSweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes eodSweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
