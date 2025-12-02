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
      if (!ticker || cancelled) return;

      const high24h = Number(ticker.high24h ?? ticker.high ?? null);
      const low24h = Number(ticker.low24h ?? ticker.low ?? null);
      const volume24h = Number(ticker.volume24h ?? ticker.volume ?? null);

      setStats({
        high24h: Number.isFinite(high24h) ? high24h : null,
        low24h: Number.isFinite(low24h) ? low24h : null,
        volume24h: Number.isFinite(volume24h) ? volume24h : null,
      });
    };

    const load = async () => {
      const book = getBookIdFromPair(pair);
      if (!book?.backendPair) {
        setStats({ high24h: null, low24h: null, volume24h: null });
        return;
      }

      const map = tickers instanceof Map ? tickers : new Map();
      const fromWs = map.get(book.backendPair);
      if (fromWs) {
        applyTicker(fromWs);
        return;
      }

      try {
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

  return (
    <div className="w-full p-4 max-sm:p-2 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 max-sm:gap-2">
      <div>
        <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
          24h High
        </p>
        <p className="text-sm max-sm:text-xs font-semibold text-white">
          {stats.high24h != null ? stats.high24h.toFixed(6) : "-"}
        </p>
      </div>
      <div>
        <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
          24h Low
        </p>
        <p className="text-sm max-sm:text-xs font-semibold text-white">
          {stats.low24h != null ? stats.low24h.toFixed(6) : "-"}
        </p>
      </div>
      <div>
        <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
          24h Volume
        </p>
        <p className="text-sm max-sm:text-xs font-semibold text-white">
          {stats.volume24h != null
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
        <p className="text-sm max-sm:text-xs font-semibold text-white">-</p>
      </div>
    </div>
  );
}

