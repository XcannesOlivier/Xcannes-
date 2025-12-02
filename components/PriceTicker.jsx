"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "next-i18next";
import xcannesApi from "../lib/xcannesApi";
import { useXcannesWS } from "../context/XcannesWSContext";
import { getBookIdFromPair } from "../utils/xrpl";

// 🗄️ Cache global partagé entre instances
const globalCache = {
  data: new Map(), // Map<backendPair, { ticker, timestamp }>
  ttl: 5000, // 5 secondes
};

export default function PriceTicker({ pairs = [], fixed = false }) {
  const { t } = useTranslation("common");
  const { connected, tickers, orderbooks, subscribe, unsubscribe } = useXcannesWS();
  const [pricesData, setPricesData] = useState([]);
  const isMountedRef = useRef(true);

  // 📊 Récupérer depuis le cache ou API
  const getCachedOrFetch = useCallback(async (backendPair) => {
    // Vérifier cache
    const cached = globalCache.data.get(backendPair);
    if (cached && Date.now() - cached.timestamp < globalCache.ttl) {
      return cached.ticker;
    }

    // Fetch depuis API
    const ticker = await xcannesApi.getTicker(backendPair);
    
    // Mettre en cache
    if (ticker) {
      globalCache.data.set(backendPair, {
        ticker,
        timestamp: Date.now()
      });
    }
    
    return ticker;
  }, []);

  // 🔄 Récupérer les prix avec cache
  const fetchPrices = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const pricesPromises = pairs.map(async (pair) => {
        try {
          const bookData = getBookIdFromPair(pair);
          if (!bookData?.backendPair) {
            return null;
          }

          const ticker = await getCachedOrFetch(bookData.backendPair);
          if (!ticker) return null;

          const changeSource =
            ticker.changePercent24h ??
            ticker.changePercent ??
            ticker.change ??
            0;
          const change = Number.parseFloat(changeSource) || 0;

          const sparklineData =
            Array.isArray(ticker.sparkline24h) && ticker.sparkline24h.length > 0
              ? ticker.sparkline24h
              : [Number.parseFloat(ticker.lastPrice || 0)];

          return {
            pair,
            backendPair: bookData.backendPair,
            price: parseFloat(ticker.lastPrice || 0).toFixed(6),
            change: change.toFixed(2),
            sparkline: sparklineData,
            isPositive: change >= 0,
            volume24h: ticker.volume24h || '0.0000'
          };
        } catch (error) {
          console.error(`[PriceTicker] Erreur ${pair}:`, error);
          return null;
        }
      });

      const results = await Promise.all(pricesPromises);
      const validResults = results.filter((r) => r !== null);

      if (validResults.length > 0 && isMountedRef.current) {
        setPricesData(validResults);
      }
    } catch (error) {
      console.error("[PriceTicker] Erreur fetch prices:", error);
    }
  }, [pairs, getCachedOrFetch]);

  // 🌐 S'abonner aux tickers ET orderbooks via WebSocket centralisé
  useEffect(() => {
    if (!connected || pairs.length === 0) return;

    const backendPairs = pairs
      .map((p) => {
        const bookData = getBookIdFromPair(p);
        return bookData?.backendPair;
      })
      .filter(Boolean)
      .slice(0, 20);

    backendPairs.forEach((backendPair) => {
      subscribe("ticker", backendPair);
      subscribe("orderbook", backendPair);
    });

    console.log(`✅ [PriceTicker] ${backendPairs.length} paires abonnées (ticker + orderbook)`);

    return () => {
      backendPairs.forEach((backendPair) => {
        unsubscribe("ticker", backendPair);
        unsubscribe("orderbook", backendPair);
      });
    };
  }, [connected, pairs, subscribe, unsubscribe]);

  // 📡 Mise à jour des prix via WebSocket (tickers + orderbooks)
  useEffect(() => {
    if (!pricesData.length) return;

    const tickerMap = tickers instanceof Map ? tickers : new Map();
    const orderbookMap = orderbooks instanceof Map ? orderbooks : new Map();

    setPricesData((prev) =>
      prev.map((item) => {
        const updated = { ...item };
        const tickerData = tickerMap.get(item.backendPair);

        if (tickerData) {
          const lastPrice =
            tickerData.lastPrice ?? tickerData.price ?? tickerData.bidPrice ?? tickerData.askPrice;
          const parsedPrice = parseFloat(lastPrice);
          if (Number.isFinite(parsedPrice)) {
            updated.price = parsedPrice.toFixed(6);
          }

          if (tickerData.changePercent24h !== undefined) {
            const percent = parseFloat(tickerData.changePercent24h);
            if (Number.isFinite(percent)) {
              updated.change = percent.toFixed(2);
              updated.isPositive = percent >= 0;
            }
          } else if (tickerData.change !== undefined) {
            const percent = parseFloat(tickerData.change);
            if (Number.isFinite(percent)) {
              updated.change = percent.toFixed(2);
              updated.isPositive = percent >= 0;
            }
          }

          if (Array.isArray(tickerData.sparkline24h) && tickerData.sparkline24h.length > 0) {
            updated.sparkline = tickerData.sparkline24h;
          }

          if (tickerData.volume24h !== undefined) {
            updated.volume24h = tickerData.volume24h;
          }

          globalCache.data.set(item.backendPair, {
            ticker: tickerData,
            timestamp: Date.now(),
          });
        }

        const orderbookData = orderbookMap.get(item.backendPair);
        if (orderbookData?.asks?.[0] && orderbookData?.bids?.[0]) {
          const bestAsk = parseFloat(orderbookData.asks[0].price);
          const bestBid = parseFloat(orderbookData.bids[0].price);
          if (Number.isFinite(bestAsk) && Number.isFinite(bestBid)) {
            const midPrice = (bestAsk + bestBid) / 2;
            if (Number.isFinite(midPrice)) {
              updated.price = midPrice.toFixed(6);
            }
          }
        }

        return updated;
      })
    );
  }, [tickers, orderbooks, pricesData.length]);

  // 📡 HTTP Polling pour charger les données initiales
  useEffect(() => {
    // Fetch initial
    fetchPrices();

    // Rafraîchir toutes les 30 secondes (le WebSocket gère le temps réel)
    const interval = setInterval(fetchPrices, 30000);

    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Mini sparkline SVG
  const Sparkline = ({ data, isPositive }) => {
    if (!data || data.length === 0) return null;

    const width = 40;
    const height = 20;
    const padding = 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
        const y =
          height - padding - ((value - min) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} className="inline-block">
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? "#16b303" : "#dc2626"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div
      className={`w-full backdrop-blur-xl overflow-hidden ${
        fixed
          ? "fixed top-16 left-0 border-b border-white/5 z-40"
          : "border-y border-white/5"
      }`}
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.02)",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
      }}
    >
      <div className="relative h-2 md:h-16 flex items-center py-4">
        <div
          className="flex items-center gap-8 animate-scroll-left whitespace-nowrap"
          style={{
            animation: "scroll-left 120s linear infinite",
          }}
        >
          {/* Dupliquer pour un défilement continu */}
          {[...pricesData, ...pricesData, ...pricesData].map((item, index) => (
            <div
              key={`${item.pair}-${index}`}
              className="flex items-center gap-3 px-6 py-2"
            >
              <Sparkline data={item.sparkline} isPositive={item.isPositive} />
              <div className="flex items-center gap-2">
                <span className="text-white/80 font-semibold text-base">
                  {item.pair}
                </span>
                <span className="text-white text-base font-medium">
                  {item.price}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    item.isPositive ? "text-xcannes-green" : "text-red-500"
                  }`}
                >
                  {item.isPositive ? "+" : ""}
                  {item.change}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        /* Use only standard + -webkit prefixed keyframes to avoid legacy -o/-moz/-ms at-rules
           which can trigger parsing errors in some tools. Modern browsers support standard keyframes. */
        @-webkit-keyframes scroll-left {
          0% {
            -webkit-transform: translateX(0);
            transform: translateX(0);
          }
          100% {
            -webkit-transform: translateX(-33.333%);
            transform: translateX(-33.333%);
          }
        }
        @keyframes scroll-left {
          0% {
            -webkit-transform: translateX(0);
            transform: translateX(0);
          }
          100% {
            -webkit-transform: translateX(-33.333%);
            transform: translateX(-33.333%);
          }
        }
        .animate-scroll-left {
          -webkit-animation: scroll-left 120s linear infinite;
          animation: scroll-left 120s linear infinite;
        }
      `}</style>
    </div>
  );
}
