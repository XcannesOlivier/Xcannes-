"use client";

import { useEffect, useState } from "react";
import xcannesApi from "../lib/xcannesApi";
import { useXcannesWS } from "../context/XcannesWSContext";
import { getBookIdFromPair } from "../utils/xrpl";

export default function ChartFooter({ pair }) {
  const { tickers } = useXcannesWS();
  const [stats, setStats] = useState({
    high24h: null,
    low24h: null,
    volume24h: null,
  });

  useEffect(() => {
    let cancelled = false;

    const applyTicker = (ticker) => {
      if (!ticker || cancelled) {
        console.log('[ChartFooter] ❌ Ticker invalide ou annulé:', { ticker, cancelled });
        return;
      }

      console.log('[ChartFooter] Ticker brut reçu:', JSON.stringify(ticker, null, 2));

      // ✅ Conversion sécurisée : vérifier d'abord si la valeur existe
      const high24h = ticker.high24h ?? ticker.high;
      const low24h = ticker.low24h ?? ticker.low;
      const volume24h = ticker.volume24h ?? ticker.volume;

      console.log('[ChartFooter] Valeurs extraites:', { 
        high24h, 
        low24h, 
        volume24h,
        'typeof high24h': typeof high24h,
        'typeof low24h': typeof low24h,
        'typeof volume24h': typeof volume24h
      });

      // ✅ Conversion avec validation NaN - ACCEPTE 0 !
      const convertToNumber = (value) => {
        if (value == null) return null;
        const num = Number(value);
        // ⚠️ isFinite accepte 0, donc pas de problème
        return Number.isFinite(num) ? num : null;
      };

      const finalStats = {
        high24h: convertToNumber(high24h),
        low24h: convertToNumber(low24h),
        volume24h: convertToNumber(volume24h),
      };

      console.log('[ChartFooter] Stats finales après Number():', finalStats);
      console.log('[ChartFooter] Validation:', {
        'high24h isFinite': Number.isFinite(finalStats.high24h),
        'low24h isFinite': Number.isFinite(finalStats.low24h),
        'volume24h isFinite': Number.isFinite(finalStats.volume24h),
        'volume24h === 0': finalStats.volume24h === 0,
      });

      setStats(finalStats);
    };

    const load = async () => {
      const book = getBookIdFromPair(pair);
      if (!book?.backendPair) {
        setStats({ high24h: null, low24h: null, volume24h: null });
        return;
      }

      console.log('[ChartFooter] Recherche ticker pour:', {
        pair,
        backendPair: book.backendPair,
        tickersKeys: Array.from(tickers instanceof Map ? tickers.keys() : []),
        tickersSize: tickers instanceof Map ? tickers.size : 0
      });

      const map = tickers instanceof Map ? tickers : new Map();
      const fromWs = map.get(book.backendPair);
      
      // ✅ Vérifier que le ticker WebSocket a les données nécessaires
      const hasValidData = fromWs && (
        fromWs.high24h != null || 
        fromWs.high != null
      );
      
      if (hasValidData) {
        console.log('[ChartFooter] ✅ Ticker trouvé dans WebSocket avec données valides');
        applyTicker(fromWs);
        return;
      }

      if (fromWs) {
        console.log('[ChartFooter] ⚠️ Ticker WebSocket incomplet, utilisation HTTP à la place');
      } else {
        console.log('[ChartFooter] ⚠️ Pas de ticker WebSocket, fetch HTTP...');
      }
      
      try {
        // ✅ Vérifier si c'est une paire EOD (commence par USD/)
        const isEODPair = book.backendPair.startsWith('USD_');
        
        if (isEODPair) {
          console.log('[ChartFooter] Paire EOD détectée:', book.backendPair);
          const eodData = await xcannesApi.getEODData(book.backendPair, 1);
          if (eodData && eodData.length > 0) {
            const lastCandle = eodData[eodData.length - 1];
            applyTicker({
              symbol: book.backendPair,
              high: lastCandle.high,
              low: lastCandle.low,
              volume: lastCandle.volume || 0,
              source: 'eod'
            });
            console.log('[ChartFooter] ✅ Données EOD récupérées:', { high: lastCandle.high, low: lastCandle.low });
          } else {
            setStats({ high24h: null, low24h: null, volume24h: null });
          }
          return;
        }
        
        // Pour les autres paires (Pyth, XRPL)
        const ticker = await xcannesApi.getTicker(book.backendPair);
        applyTicker(ticker);
      } catch (err) {
        console.error("[ChartFooter] Failed to load ticker:", err);
        if (!cancelled) {
          setStats({ high24h: null, low24h: null, volume24h: null });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [pair, tickers]);

  // ✅ Formatter intelligent qui détecte la précision nécessaire
  const formatPrice = (value) => {
    if (!Number.isFinite(value)) return "-";
    
    // Déterminer le nombre de décimales significatives
    const valueStr = value.toString();
    const decimalPart = valueStr.split('.')[1];
    const decimals = decimalPart ? decimalPart.length : 0;
    
    // Utiliser 8 décimales max (pour XRP) ou le nombre de décimales d'origine
    const precision = Math.min(Math.max(decimals, 6), 8);
    return value.toFixed(precision);
  };

  return (
    <div className="w-full p-4 max-sm:p-2 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 max-sm:gap-2">
      <div>
        <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
          24h High
        </p>
        <p className="text-sm max-sm:text-xs font-semibold text-white">
          {formatPrice(stats.high24h)}
        </p>
      </div>
      <div>
        <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
          24h Low
        </p>
        <p className="text-sm max-sm:text-xs font-semibold text-white">
          {formatPrice(stats.low24h)}
        </p>
      </div>
      <div>
        <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
          24h Volume
        </p>
        <p className="text-sm max-sm:text-xs font-semibold text-white">
          {Number.isFinite(stats.volume24h)
            ? stats.volume24h.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })
            : "-"}
        </p>
      </div>
      <div>
        <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
          Market Cap
        </p>
        <p className="text-sm max-sm:text-xs font-semibold text-white/60 italic">N/A</p>
      </div>
    </div>
  );
}

