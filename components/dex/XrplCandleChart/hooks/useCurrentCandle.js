"use client";

import { useCallback, useEffect, useRef } from "react";
import { getIntervalSeconds } from "./timeframes";

// Gère la bougie courante basée sur le prix live et fusionne dans les candles.
export function useCurrentCandle(interval, setCandles) {
  const currentCandleRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const intervalSecondsRef = useRef(getIntervalSeconds(interval));

  useEffect(() => {
    intervalSecondsRef.current = getIntervalSeconds(interval);
  }, [interval]);

  const updateCurrentCandle = useCallback(
    (midPrice) => {
      if (!midPrice) return;
      const now = Math.floor(Date.now() / 1000);
      const intervalSeconds = intervalSecondsRef.current;
      const currentCandleTime =
        Math.floor(now / intervalSeconds) * intervalSeconds;
      const lastUpdate = lastUpdateTimeRef.current;

      const existing = currentCandleRef.current;

      if (!existing || existing.time !== currentCandleTime) {
        currentCandleRef.current = {
          time: currentCandleTime,
          open: midPrice,
          high: midPrice,
          low: midPrice,
          close: midPrice,
        };
      } else {
        currentCandleRef.current = {
          ...existing,
          high: Math.max(existing.high, midPrice),
          low: Math.min(existing.low, midPrice),
          close: midPrice,
        };
      }

      lastUpdateTimeRef.current = now;

      if (currentCandleRef.current) {
        const current = currentCandleRef.current;
        setCandles((prev) => {
          if (!prev.length) {
            return [current];
          }

          const last = prev[prev.length - 1];
          if (!last || last.time == null) {
            return prev;
          }

          const withoutLast = prev.slice(0, -1);

          if (last.time === current.time) {
            return [...withoutLast, current];
          }

          return [...prev, current];
        });
      }
    },
    [setCandles]
  );

  return {
    currentCandleRef,
    intervalSecondsRef,
    updateCurrentCandle,
  };
}

