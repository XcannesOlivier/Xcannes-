"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createChart } from "lightweight-charts";
import xcannesApi from "@/lib/xcannesApi";
import { MARKET_STRUCTURE } from "@/utils/marketStructure";
import ChartHeader from "./components/ChartHeader";
import useMarketData from "./hooks/useMarketData";
import ChartFooter from "./components/ChartFooter";
import ChartCanvas from "./components/ChartCanvas";
import { useTranslation } from "next-i18next";

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
  availableIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"]
}) {
  const { t } = useTranslation("common");
  // ✅ Guard: S'assurer qu'on est côté client
  const [isClient, setIsClient] = useState(typeof window !== "undefined");

  useEffect(() => {
    setIsClient(true);
  }, []);

  const chartRef = useRef();
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const timeScaleRef = useRef(null);
  const initialVisibleRangeRef = useRef(null);
  const containerRef = useRef(null);
  const oldestTimeRef = useRef(null);
  const newestTimeRef = useRef(null);
  const [statusBar, setStatusBar] = useState(null);
  const [crosshairPoint, setCrosshairPoint] = useState(null);
  const crosshairRafRef = useRef(null);
  const lastCrosshairParamRef = useRef(null);

  // États pour les fonctionnalités modernes
  const [chartType, setChartType] = useState("candle"); // "candle" ou "line"
  const showTooltips = true;

  // États pour les paramètres du graphique
  const [showSettings, setShowSettings] = useState(false);
  const [chartSettings, setChartSettings] = useState({
    showGrid: true,
    showCrosshair: true,
    autoScale: true
  });

  // Sur smartphone, démarrer en mode "line" pour un look plus lisible
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) {
      setChartType("line");
    }
  }, []);

  // FX EOD mode (Fawaz)
  const [fxBase, setFxBase] = useState("EUR");
  const [fxQuote, setFxQuote] = useState("USD");
  const [fxInfo, setFxInfo] = useState({ price: null, changePercent: null });
  const [, setFxLoading] = useState(false);
  const [isFxMode, setIsFxMode] = useState(false);

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
    updateCurrentCandle
  } = useMarketData({ pair, interval, isFxMode, fxBase, fxQuote });

  // Normalisation défensive des données de bougies pour le chart
  const sanitizeCandles = useCallback((source) => {
    if (!Array.isArray(source)) return [];
    const normalizeTimeSeconds = (value) => {
      if (value == null) return null;
      if (value instanceof Date) return Math.floor(value.getTime() / 1000);
      if (typeof value === "number") {
        if (!Number.isFinite(value)) return null;
        if (value > 1e12) return Math.floor(value / 1000);
        if (value > 1e10) return Math.floor(value / 1000);
        return Math.floor(value);
      }
      const raw = String(value);
      const asNumber = Number(raw);
      if (Number.isFinite(asNumber)) return normalizeTimeSeconds(asNumber);
      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
      return null;
    };
    return source.
    map((c) => {
      if (!c) return null;
      const time = normalizeTimeSeconds(c.time);
      if (time == null) return null;
      const open = Number.isFinite(Number(c.open)) ? Number(c.open) : 0;
      const high = Number.isFinite(Number(c.high)) ? Number(c.high) : open;
      const low = Number.isFinite(Number(c.low)) ? Number(c.low) : open;
      const close = Number.isFinite(Number(c.close)) ? Number(c.close) : open;
      const volume = Number.isFinite(Number(c.volume)) ? Number(c.volume) : 0;
      return { time, open, high, low, close, volume };
    }).
    filter(Boolean).
    map((c) => {
      // Enlever les valeurs négatives aberrantes, sans casser les 0.
      return {
        ...c,
        open: c.open < 0 ? 0 : c.open,
        high: c.high < 0 ? 0 : c.high,
        low: c.low < 0 ? 0 : c.low,
        close: c.close < 0 ? 0 : c.close,
        volume: c.volume < 0 ? 0 : c.volume
      };
    });
  }, []);

  // Ancien système de lazy-load de l'historique retiré pour simplifier:
  // le chart affiche simplement les bougies fournies par useMarketData
  // sans tenter de charger plus d'historique au scroll.
  // États pour le dropdown en cascade
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fermer le dropdown si on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdownNode = dropdownRef.current;
      const menuNode = document.getElementById("pair-dropdown");
      if (dropdownNode && dropdownNode.contains(event.target)) return;
      if (menuNode && menuNode.contains(event.target)) return;
      setDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniquePairs = useMemo(
    () => Array.from(new Set(availablePairs)),
    [availablePairs]
  );

  const handlePairSelect = (selectedPair) => {
    const isLivePair = uniquePairs.includes(selectedPair);

    if (!isLivePair) {
      const [base, quote] = selectedPair.split("/");
      if (base && quote) {
        setFxBase(base);
        setFxQuote(quote);
      }
      setIsFxMode(true);
    } else {
      setIsFxMode(false);
    }

    if (onPairChange) {
      onPairChange(selectedPair);
    }
    setDropdownOpen(false);
  };

  // Filtrer les paires disponibles par marché et devise
  const filteredMarketStructure = useMemo(() => {
    const filtered = {};

    Object.entries(MARKET_STRUCTURE).forEach(([marketKey, market]) => {
      const filteredCurrencies = {};

      Object.entries(market.currencies).forEach(([currency, pairs]) => {
        const availablePairsForCurrency = pairs.filter((p) => uniquePairs.includes(p));
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
          changePct = (lastClose - prevClose) / prevClose * 100;
        }
        setFxInfo({
          price: lastClose,
          changePercent: changePct
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
      }chart = createChart(chartRef.current, {
        width: containerWidth,
        height: containerHeight,
        layout: {
          background: { color: bgColor },
          textColor
        },
        grid: {
          vertLines: {
            color: chartSettings.showGrid ? gridColor : "transparent"
          },
          horzLines: {
            color: chartSettings.showGrid ? gridColor : "transparent"
          }
        },
        crosshair: {
          mode: chartSettings.showCrosshair ? 1 : 0,
          vertLine: {
            color: "#16a34a",
            width: 1,
            style: 3,
            labelBackgroundColor: "#16a34a"
          },
          horzLine: {
            color: "#16a34a",
            width: 1,
            style: 3,
            labelBackgroundColor: "#16a34a"
          }
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
          shiftVisibleRangeOnNewBar: true
        },
        handleScale: {
          axisPressedMouseMove: {
            time: true,
            price: true
          },
          mouseWheel: true,
          pinch: true
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true
        },
        rightPriceScale: {
          borderColor,
          scaleMargins: {
            top: 0.1, // Marge haute raisonnable
            bottom: 0.1
          },
          autoScale: true, // ✅ Activé
          mode: 0, // Mode normal (pas logarithmique)
          // ✅ Formatter personnalisé pour afficher 5 digits sur la price scale
          // Les données restent en pleine précision, seul l'affichage change
          tickMarkFormatter: (price) => {
            return price.toFixed(5);
          }
        }
      });

      chartInstanceRef.current = chart;
      timeScaleRef.current = chart.timeScale();

      // Créer la série selon le type de graphique
      if (chartType === "candle") {
        candleSeriesRef.current = chart.addCandlestickSeries({
          // Même palette : vert xcannes-green, rouge xcannes-red
          upColor: "rgba(22, 163, 74, 0.75)",
          downColor: "rgba(220, 38, 38, 0.75)",
          borderUpColor: "rgba(22, 163, 74, 0.75)",
          borderDownColor: "rgba(220, 38, 38, 0.75)",
          wickUpColor: "rgba(22, 163, 74, 0.75)",
          wickDownColor: "rgba(220, 38, 38, 0.75)",
          priceLineVisible: priceLineVisibleMain,
          lastValueVisible: lastValueVisibleMain,
          priceFormat: {
            type: "price",
            precision: 5,
            minMove: 0.00001
          }
        });

        // Données bougies
        candleSeriesRef.current.setData(data);
      } else {
        // Mode ligne : une seule série area (ligne + ombre)
        const lineData = data.map((d) => ({
          time: d.time,
          value: d.close
        }));

        candleSeriesRef.current = chart.addAreaSeries({
          lineColor: "rgba(22, 163, 74, 0.75)",
          topColor: isMobileScreen ?
          "rgba(22, 163, 74, 0.18)" :
          "rgba(22, 163, 74, 0.10)",
          bottomColor: "rgba(16, 185, 129, 0.0)",
          lineWidth: 2,
          priceLineVisible: priceLineVisibleMain,
          lastValueVisible: lastValueVisibleMain,
          priceFormat: {
            type: "price",
            precision: 5,
            minMove: 0.00001
          }
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
            isUp: numericClose >= numericOpen
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
          const isMobileScreen =
          typeof window !== "undefined" && window.innerWidth < 768;

          if (isMobileScreen) {
            if (chartSettings.showCrosshair) {
              setChartSettings((prev) => ({ ...prev, showCrosshair: false }));
              return;
            }

            setChartSettings((prev) => ({ ...prev, showCrosshair: true }));
            updateStatusFromParam(param);
            return;
          }

          updateStatusFromParam(param);
        };

        chart.subscribeCrosshairMove(crosshairHandler);
        chart.subscribeClick(clickHandler);
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
          }}
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
                isUp: midClose >= midOpen
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
          height: chartRef.current.clientHeight
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
  }, [pair, interval, chartType, chartSettings]);

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
        value: d.close
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
        horzLines: { color: chartSettings.showGrid ? "#1a1f1d" : "transparent" }
      },
      crosshair: {
        mode: chartSettings.showCrosshair ? 1 : 0
      },
      rightPriceScale: {
        autoScale: chartSettings.autoScale
      }
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
      </div>);

  }

  const mobileWatermark = null;

  const noDataContent = (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-4">⚠️</div>
        <p className="text-lg font-semibold text-white mb-2">
          {t("ui_service_de_donn_es_indisponi_42cacb1f89", "Service de données indisponible")}
        </p>
        <p className="text-sm text-white/60 mb-4">{noDataMessage}</p>
      </div>
    </div>
  );


  return (
    <div
      ref={containerRef}
      className="rounded-xl md:rounded-none flex flex-col h-full">

      {/* Bouton retour flottant mobile uniquement */}
      <Link
        href="/"
        className="md:hidden fixed top-0 left-0 z-50 text-white hover:text-xcannes-green transition-colors">

        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}>

          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7" />

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
        isFxMode={isFxMode}
        fxBase={fxBase}
        fxQuote={fxQuote}
        fxInfo={fxInfo}
        setFxBase={setFxBase}
        setFxQuote={setFxQuote}
        currentPrice={currentPrice}
        percent24h={percent24h}
        showTooltips={showTooltips}
        dropdownOpen={dropdownOpen}
        setDropdownOpen={setDropdownOpen}
        handlePairSelect={handlePairSelect}
        dropdownRef={dropdownRef}
        chartType={chartType}
        setChartType={setChartType}
        timeScaleRef={timeScaleRef}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        chartSettings={chartSettings}
        setChartSettings={setChartSettings} />


      {/* Modal overlay pour fermer le menu settings en cliquant en dehors */}
      {showSettings &&
      <div
        className="fixed inset-0 z-30"
        onClick={() => setShowSettings(false)} />

      }

      <div className="flex flex-1 min-h-0">
        <ChartCanvas
          chartRef={chartRef}
          statusBar={statusBar}
          crosshairPoint={crosshairPoint}
          loading={loading}
          noDataMessage={noDataMessage}
          noDataContent={noDataMessage ? noDataContent : null}
          interval={interval}
          chartClassName="w-full relative z-0 dex-chart-container"
          watermark={mobileWatermark} />
      </div>

      {/* Timeframes mobile sous le chart */}
      {!isFxMode &&
      availableIntervals.length > 0 &&
      typeof onIntervalChange === "function" &&
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
                isActive ?
                "bg-black/50 text-white text-[20px]" :
                "text-muted text-[16px]"}`
                }>

                    {int}
                  </button>);

          })}
            </div>
          </div>
      }

      {/* Footer Stats (hide on small screens) */}
      <div className="mt-0 hidden sm:block">
        <ChartFooter
          pair={pair}
          fxMode={isFxMode}
          fxBase={fxBase}
          fxQuote={fxQuote}
          stats24h={stats24h} />

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
    </div>);

}
