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
  const [isXrplPair, setIsXrplPair] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applyTicker = (ticker) => {
      if (!ticker || cancelled) {
        return;
      }

      const high24h = ticker.high24h ?? ticker.high;
      const low24h = ticker.low24h ?? ticker.low;
      const volume24h = ticker.volume24h ?? ticker.volume;

      const convertToNumber = (value) => {
        if (value == null) return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };

      const finalStats = {
        high24h: convertToNumber(high24h),
        low24h: convertToNumber(low24h),
        volume24h: convertToNumber(volume24h),
      };

      setStats(finalStats);
    };

    const load = async () => {
      const book = getBookIdFromPair(pair);
      if (!book?.backendPair) {
        setStats({ high24h: null, low24h: null, volume24h: null });
        setIsXrplPair(false);
        return;
      }

      const isEODPair = book.backendPair.startsWith('USD_');
      setIsXrplPair(book.source === 'xrpl' && !isEODPair);

      const map = tickers instanceof Map ? tickers : new Map();
      const fromWs = map.get(book.backendPair);
      
      const hasValidData = fromWs && (
        fromWs.high24h != null || 
        fromWs.high != null
      );
      
      if (hasValidData) {
        applyTicker(fromWs);
        return;
      }
      
      try {
        
        if (isEODPair) {
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
          } else {
            setStats({ high24h: null, low24h: null, volume24h: null });
          }
          return;
        }
        
        const ticker = await xcannesApi.getTicker(book.backendPair);
        applyTicker(ticker);
      } catch (err) {
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

  const formatPrice = (value) => {
    if (!Number.isFinite(value)) return "-";
    
    const valueStr = value.toString();
    const decimalPart = valueStr.split('.')[1];
    const decimals = decimalPart ? decimalPart.length : 0;
    
    const precision = Math.min(Math.max(decimals, 6), 8);
    return value.toFixed(precision);
  };

  return (
    <div className={`w-full p-4 max-sm:p-2 border-t border-white/10 grid gap-4 max-sm:gap-2 ${
      isXrplPair ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'
    }`}>
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
      {isXrplPair && (
        <>
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
        </>
      )}
    </div>
  );
}

