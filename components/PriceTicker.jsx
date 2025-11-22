"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "next-i18next";
import xcannesApi from "../lib/xcannesApi";
import { useXcannesWS } from "../context/XcannesWSContext";
import { getBookIdFromPair } from "../utils/xrpl";
import { compute24hPercentChange } from "../hooks/useCandles1m"; // ✅ Même logique que le chart

// 🗄️ Cache global partagé entre instances
const globalCache = {
  data: new Map(), // Map<backendPair, { ticker, timestamp }>
  ttl: 5000, // 5 secondes
};

export default function PriceTicker({ pairs = [], fixed = false }) {
  const { t } = useTranslation("common");
  const { connected, ticker, orderbooks, subscribe, unsubscribe } = useXcannesWS();
  const [pricesData, setPricesData] = useState([]);
  const tickerRef = useRef(null);
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

          // Récupérer ticker ET bougies 1m pour calculer le % sur 24h
          const [ticker, candles1m] = await Promise.all([
            getCachedOrFetch(bookData.backendPair),
            xcannesApi.getKlines(bookData.backendPair, '1m', 1440).catch(() => null) // ✅ 1440 bougies 1m = 24h
          ]);

          if (!ticker) return null;

          // ✅ Calculer le % 24h avec la même logique que le chart (bougies 1m)
          let change = 0;
          const sparklineData = [];
          
          if (candles1m && candles1m.length > 0) {
            // Utiliser compute24hPercentChange pour cohérence avec le chart
            const currentPrice = parseFloat(ticker.lastPrice || 0);
            if (currentPrice > 0) {
              const result = compute24hPercentChange(candles1m, currentPrice);
              change = result.percent;
            }
            
            // Créer sparkline depuis les bougies 1m (prendre 1 point tous les ~144 min pour avoir 10 points)
            const step = Math.max(1, Math.floor(candles1m.length / 10));
            for (let i = 0; i < candles1m.length; i += step) {
              if (sparklineData.length < 10) {
                sparklineData.push(parseFloat(candles1m[i].close));
              }
            }
            // Ajouter dernier point
            if (candles1m.length > 0) {
              const lastCandle = candles1m[candles1m.length - 1];
              if (sparklineData.length < 10 || sparklineData[sparklineData.length - 1] !== parseFloat(lastCandle.close)) {
                sparklineData.push(parseFloat(lastCandle.close));
              }
            }
          }
          
          // Fallback: générer sparkline depuis high/low si pas de bougies
          if (sparklineData.length === 0) {
            const high = parseFloat(ticker.high24h || ticker.lastPrice || 0);
            const low = parseFloat(ticker.low24h || ticker.lastPrice || 0);
            const current = parseFloat(ticker.lastPrice || 0);
            
            if (current > 0) {
              const hasVariation = Math.abs(high - low) > current * 0.0001;
              
              if (hasVariation) {
                for (let i = 0; i < 10; i++) {
                  const progress = i / 9;
                  const targetValue = low + (current - low) * progress;
                  const variation = (Math.random() - 0.5) * (high - low) * 0.1;
                  sparklineData.push(Math.max(low, Math.min(high, targetValue + variation)));
                }
              } else {
                for (let i = 0; i < 10; i++) {
                  const microVariation = (Math.random() - 0.5) * current * 0.001;
                  sparklineData.push(current + microVariation);
                }
              }
            }
          }

          return {
            pair,
            backendPair: bookData.backendPair,
            price: parseFloat(ticker.lastPrice || 0).toFixed(6),
            change: change.toFixed(2),
            sparkline: sparklineData,
            isPositive: change >= 0,
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
      .map(p => {
        const bookData = getBookIdFromPair(p);
        return bookData?.backendPair;
      })
      .filter(Boolean)
      .slice(0, 20); // Limiter à 20 paires max

    // S'abonner aux tickers ET orderbooks pour avoir bid/ask
    backendPairs.forEach(backendPair => {
      subscribe('ticker', backendPair);
      subscribe('orderbook', backendPair); // ✅ Ajouter orderbook pour mid-price
    });

    console.log(`✅ [PriceTicker] ${backendPairs.length} paires abonnées (ticker + orderbook)`);

    // Cleanup: se désabonner
    return () => {
      backendPairs.forEach(backendPair => {
        unsubscribe('ticker', backendPair);
        unsubscribe('orderbook', backendPair);
      });
    };
  }, [connected, pairs]); // ✅ Pas subscribe/unsubscribe dans les deps

  // 📡 Écouter les mises à jour ticker + orderbook du WebSocket pour calculer mid-price ET % 24h
  useEffect(() => {
    if (!ticker && orderbooks.size === 0) return;

    // Mise à jour depuis ticker
    if (ticker) {
      const backendPair = ticker.symbol || ticker.pair;
      if (!backendPair) return;

      // Mettre à jour le cache
      globalCache.data.set(backendPair, {
        ticker,
        timestamp: Date.now()
      });
    }

    // Calculer mid-price depuis orderbook ET recalculer % 24h en temps réel
    setPricesData(prev => {
      return prev.map(item => {
        // Récupérer l'orderbook pour cette paire
        const orderbookData = orderbooks.get(item.backendPair);
        
        if (orderbookData?.asks?.[0] && orderbookData?.bids?.[0]) {
          // ✅ Calculer mid-price comme dans TradingPanel
          const bestAsk = parseFloat(orderbookData.asks[0].price);
          const bestBid = parseFloat(orderbookData.bids[0].price);
          const midPrice = (bestAsk + bestBid) / 2;
          
          // ✅ Le % reste celui calculé avec les bougies 1m (pas recalculé ici)
          // On garde le change% existant qui vient des bougies 1m
          
          return {
            ...item,
            price: midPrice.toFixed(6), // ✅ Mid-price exact (bid+ask)/2
            // change et isPositive gardent les valeurs des bougies 1m
          };
        }
        
        // Fallback sur ticker si pas d'orderbook
        if (ticker && (ticker.symbol === item.backendPair || ticker.pair === item.backendPair)) {
          const wsPrice = parseFloat(ticker.lastPrice || ticker.bidPrice || 0);
          
          return {
            ...item,
            price: wsPrice.toFixed(6),
            // change et isPositive gardent les valeurs des bougies 1m
          };
        }
        
        return item;
      });
    });
  }, [ticker, orderbooks]);

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
      <div className="relative h-16 flex items-center py-4">
        <div
          ref={tickerRef}
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
