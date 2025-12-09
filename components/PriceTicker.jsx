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

          // ✅ Récupérer le % avec validation stricte (comme Chart)
          const changeSource =
            ticker.changePercent24h ??
            ticker.changePercent ??
            ticker.change;
          
          // ✅ Ne convertir QUE si on a une valeur valide
          // Sinon on garde null pour conserver l'ancienne valeur dans le merge
          let change = null;
          if (changeSource !== undefined && changeSource !== null) {
            const parsed = Number.parseFloat(changeSource);
            if (Number.isFinite(parsed)) {
              change = parsed;
            }
          }

          const sparklineData =
            Array.isArray(ticker.sparkline24h) && ticker.sparkline24h.length > 0
              ? ticker.sparkline24h
              : [Number.parseFloat(ticker.lastPrice || 0)];

          return {
            pair,
            backendPair: bookData.backendPair,
            price: parseFloat(ticker.lastPrice || 0).toFixed(4),
            change: change !== null ? change.toFixed(2) : '0.00', // Default initial seulement
            sparkline: sparklineData,
            isPositive: change !== null ? change >= 0 : true,
            volume24h: ticker.volume24h || '0.0000',
            hasValidChange: change !== null // ✅ Flag pour savoir si on a un % valide
          };
        } catch (error) {
          console.error(`[PriceTicker] Erreur ${pair}:`, error);
          return null;
        }
      });

      const results = await Promise.all(pricesPromises);
      const validResults = results.filter((r) => r !== null);

      if (validResults.length > 0 && isMountedRef.current) {
        // ✅ Merge intelligent : conserver % et sparkline existants pour éviter les clignotements
        setPricesData((prevData) => {
          if (prevData.length === 0) {
            return validResults; // Premier chargement
          }
          
          // Merge avec conservation du % et sparkline si nécessaire
          return validResults.map((newItem) => {
            const existingItem = prevData.find(p => p.backendPair === newItem.backendPair);
            
            if (!existingItem) {
              return newItem; // Nouvelle paire
            }
            
            const merged = { ...newItem };
            
            // ✅ Conserver le % si le nouveau n'est pas valide
            if (!newItem.hasValidChange && existingItem.change !== '0.00') {
              merged.change = existingItem.change;
              merged.isPositive = existingItem.isPositive;
              merged.hasValidChange = true;
            }
            
            // ✅ Conserver la sparkline existante pour éviter le clignotement
            // La sparkline sera mise à jour uniquement via WebSocket (temps réel)
            if (existingItem.sparkline && existingItem.sparkline.length > 0) {
              merged.sparkline = existingItem.sparkline;
            }
            
            return merged;
          });
        });
      }
    } catch (error) {
      console.error("[PriceTicker] Erreur fetch prices:", error);
    }
  }, [pairs, getCachedOrFetch]);

  // 🌐 S'abonner aux tickers ET orderbooks via WebSocket centralisé
  useEffect(() => {
    if (!connected || pairs.length === 0) return;

    const channels = pairs
      .map((p) => {
        const bookData = getBookIdFromPair(p);
        if (!bookData?.backendPair) return null;
        return {
          backendPair: bookData.backendPair,
          source: bookData.source || "xrpl",
        };
      })
      .filter(Boolean)
      .slice(0, 20);

    channels.forEach(({ backendPair, source }) => {
      // Toujours s'abonner au ticker (XRPL + Pyth)
      subscribe("ticker", backendPair);
      // Ne demander l'orderbook qu'aux paires XRPL
      if (source === "xrpl") {
        subscribe("orderbook", backendPair);
      }
    });

    console.log(
      `✅ [PriceTicker] ${channels.length} paires abonnées (ticker + orderbook XRPL uniquement)`
    );

    return () => {
      channels.forEach(({ backendPair, source }) => {
        unsubscribe("ticker", backendPair);
        if (source === "xrpl") {
          unsubscribe("orderbook", backendPair);
        }
      });
    };
  }, [connected, pairs, subscribe, unsubscribe]);

  // 📡 Mise à jour des prix via WebSocket (tickers + orderbooks)
  useEffect(() => {
    if (!pricesData.length) return;

    const tickerMap = tickers instanceof Map ? tickers : new Map();
    const orderbookMap = orderbooks instanceof Map ? orderbooks : new Map();

    // ✅ Ne mettre à jour que si on a réellement des tickers ou orderbooks
    if (tickerMap.size === 0 && orderbookMap.size === 0) return;

    setPricesData((prev) =>
      prev.map((item) => {
        const updated = { ...item };
        const tickerData = tickerMap.get(item.backendPair);

        if (tickerData) {
          const lastPrice =
            tickerData.lastPrice ?? tickerData.price ?? tickerData.bidPrice ?? tickerData.askPrice;
          const parsedPrice = parseFloat(lastPrice);
          if (Number.isFinite(parsedPrice)) {
            updated.price = parsedPrice.toFixed(4);
          }

          // ✅ Mise à jour du % SEULEMENT si on a une valeur valide et finite
          // On garde TOUJOURS le dernier % valide connu, jamais de reset à 0
          const percentSource = 
            tickerData.changePercent24h ?? 
            tickerData.changePercent ?? 
            tickerData.change;
          
          if (percentSource !== undefined && percentSource !== null) {
            const percent = parseFloat(percentSource);
            // Ne mettre à jour QUE si c'est un nombre valide et finite
            if (Number.isFinite(percent)) {
              updated.change = percent.toFixed(2);
              updated.isPositive = percent >= 0;
            }
            // Sinon on garde updated.change tel quel (pas de reset)
          }
          // Si percentSource est undefined/null, on garde la valeur existante

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
              updated.price = midPrice.toFixed(4);
            }
          }
        }

        return updated;
      })
    );
  }, [tickers, orderbooks]); // ✅ Retiré pricesData.length de la dépendance

  // 📡 HTTP Polling pour charger les données initiales et rafraîchir le %
  useEffect(() => {
    // Fetch initial
    fetchPrices();

    // ✅ Polling moins fréquent (30s) car WebSocket gère le temps réel
    // On poll juste pour garder le % à jour et avoir un fallback si WS déconnecté
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
          stroke={isPositive ? "#10b981ff" : "#dc2626"}
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
