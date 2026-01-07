"use client";

	import { useEffect, useState, useRef, useCallback } from "react";
	import { useTranslation } from "next-i18next";
	import xcannesApi from "@/lib/xcannesApi";
	import { extractPercentChange } from "@/utils/marketStats";
	import SparklineMini from "./SparklineMini";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
	import { getBookIdFromPair } from "@/utils/xrpl";

// 🔄 REST Polling interval (4 secondes)
const POLLING_INTERVAL_MS = 4000;

// 🗄️ Cache global partagé entre instances
const globalCache = {
  data: new Map(), // Map<backendPair, { ticker, timestamp }>
  ttl: 4000, // 4 secondes (sync avec polling)
};

export default function PriceTicker({
  pairs = [],
  fixed = false,
  backgroundClass,
  mobileVariant = "marquee", // "marquee" | "scroll"
}) {
  const { t } = useTranslation("common");
  const [pricesData, setPricesData] = useState([]);
  const isMountedRef = useRef(true);
  const [isPaused, setIsPaused] = useState(false);
  const pollingIntervalRef = useRef(null);

  // � Récupérer les prix via REST API (polling toutes les 4s)
  const fetchPrices = useCallback(async () => {
    if (!isMountedRef.current || isPaused) return;
    
    try {
      // Limiter le nombre de paires traitées côté frontend
      const limitedPairs = pairs.slice(0, 20);

      const pricesPromises = limitedPairs.map(async (pair) => {
        try {
          const bookData = getBookIdFromPair(pair);
          if (!bookData?.backendPair) {
            return null;
          }

          const backendPair = bookData.backendPair;

          // ✅ REST : Vérifier cache puis fetch
          const cached = globalCache.data.get(backendPair);
          let ticker = null;
          
          if (cached && Date.now() - cached.timestamp < globalCache.ttl) {
            ticker = cached.ticker;
          } else {
            ticker = await xcannesApi.getTicker(backendPair);
            
            if (ticker) {
              globalCache.data.set(backendPair, {
                ticker,
                timestamp: Date.now()
              });
            }
          }

          if (!ticker) return null;

          const changeObj = extractPercentChange(ticker);
          const changePercent = changeObj ? changeObj.percent : null;

          const sparklineData =
            Array.isArray(ticker.sparkline24h) && ticker.sparkline24h.length > 0
              ? ticker.sparkline24h
              : [Number.parseFloat(ticker.lastPrice || 0)];

          return {
            pair,
            backendPair: bookData.backendPair,
            source: bookData.source || "xrpl",
            price: parseFloat(ticker.lastPrice || 0).toFixed(5),
            change: changePercent !== null ? changePercent.toFixed(2) : "0.00",
            sparkline: sparklineData,
            isPositive: changePercent !== null ? changePercent >= 0 : true,
            volume24h: ticker.volume24h || '0.0000',
            hasValidChange: changePercent !== null,
            basePrice24h: changeObj?.basePrice24h || null,
            lastPrice24h: changeObj?.lastPrice24h || null,
          };
        } catch (error) {
          console.error(`[PriceTicker] Erreur ${pair}:`, error);
          return null;
        }
      });

      const results = await Promise.all(pricesPromises);
      const validResults = results.filter((r) => r !== null);

      if (validResults.length > 0 && isMountedRef.current) {
        setPricesData((prevData) => {
          if (prevData.length === 0) {
            return validResults; // Premier chargement
          }
          
          let hasChanges = false;

          // Merge intelligent avec conservation des données
          const mergedResults = validResults.map((newItem) => {
            const existingItem = prevData.find(p => p.backendPair === newItem.backendPair);
            
            if (!existingItem) {
              hasChanges = true;
              return newItem;
            }
            
            const merged = { ...newItem };
            
            // Conserver le % si le nouveau n'est pas valide
            if (!newItem.hasValidChange && existingItem.change !== '0.00') {
              merged.change = existingItem.change;
              merged.isPositive = existingItem.isPositive;
              merged.hasValidChange = true;
            }
            
            // Conserver la sparkline existante pour éviter le clignotement
            if (existingItem.sparkline && existingItem.sparkline.length > 0) {
              merged.sparkline = existingItem.sparkline;
            }

            // Détecter les changements réels
            if (
              merged.price !== existingItem.price ||
              merged.change !== existingItem.change ||
              merged.isPositive !== existingItem.isPositive ||
              merged.volume24h !== existingItem.volume24h
            ) {
              hasChanges = true;
            }
            
            return merged;
          });

          if (!hasChanges && prevData.length === mergedResults.length) {
            return prevData;
          }

          return mergedResults;
        });
      }
    } catch (error) {
      console.error("[PriceTicker] Erreur fetch prices:", error);
    }
  }, [pairs, isPaused]);

  // 🔄 REST Polling : Charger les prix toutes les 4 secondes
  useEffect(() => {
    if (pairs.length === 0) return;

    // Fetch initial
    fetchPrices();

    // Setup polling
    pollingIntervalRef.current = setInterval(() => {
      fetchPrices();
    }, POLLING_INTERVAL_MS);

    if (DEBUG_LOGS) {
      console.log(`✅ [PriceTicker] REST polling activé (${POLLING_INTERVAL_MS}ms) pour ${pairs.length} paires`);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [pairs, fetchPrices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Dupliquer les données pour un défilement continu (marquee)
  const displayData = (() => {
    if (!pricesData || pricesData.length === 0) return [];
    // Dupliquer la liste pour un défilement continu sans trou
    if (pricesData.length <= 3) return pricesData;
    return [...pricesData, ...pricesData];
  })();

  const resolvedBgClass = backgroundClass || "bg-black/60";
  const resolvedMobileVariant = mobileVariant === "scroll" ? "scroll" : "marquee";

  return (
    <div
      className={`w-full min-w-0 max-w-full backdrop-blur-xl overflow-x-hidden ${
        fixed
          ? "fixed top-16 left-0 z-30"
          : ""
      } ${resolvedBgClass}`}
    >
      {resolvedMobileVariant === "scroll" && (
        <div
          className="md:hidden w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="inline-flex items-center gap-3 whitespace-nowrap px-3 py-2 w-max">
            {pricesData.slice(0, 20).map((item) => (
              <div
                key={item.backendPair || item.pair}
                className="flex flex-none items-center gap-2 px-1 py-1"
              >
                <span className="hidden sm:inline-block">
                  <SparklineMini
                    values={item.sparkline}
                    strokeColor={item.isPositive ? "#10b981ff" : "#dc2626"}
                    width={40}
                    height={18}
                    className="inline-block"
                  />
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-white/80 font-semibold text-[10px]">
                    {item.pair}
                  </span>
                  <span className="text-white text-[10px] font-medium font-mono tabular-nums max-w-[72px] truncate text-right">
                    {item.price}
                  </span>
                  <span
                    className={`text-[10px] font-semibold font-mono tabular-nums w-11 text-right ${
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
      )}

      <div
        className={`relative flex items-center py-2 md:py-2 ${
          resolvedMobileVariant === "scroll" ? "hidden md:flex" : ""
        }`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <div className="price-ticker-viewport w-full px-4">
          <div
            className={`price-ticker-track flex items-center gap-6 whitespace-nowrap ${
              isPaused ? "paused" : ""
            }`}
          >
            {displayData.map((item) => (
              <div
                key={item.backendPair || item.pair}
                className="flex items-center gap-3 px-2 py-1"
              >
                <SparklineMini
                  values={item.sparkline}
                  strokeColor={item.isPositive ? "#10b981ff" : "#dc2626"}
                  width={40}
                  height={20}
                  className="inline-block"
                />
                <div className="flex items-center gap-2">
                  <span className="text-white/80 font-semibold text-sm">
                    {item.pair}
                  </span>
                  <span className="text-white text-sm font-medium font-mono w-20 text-right">
                    {item.price}
                  </span>
                  <span
                    className={`text-xs font-semibold font-mono w-14 text-right ${
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
      </div>
    </div>
  );
}
