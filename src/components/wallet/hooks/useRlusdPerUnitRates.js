"use client";

import { useEffect, useMemo, useState } from "react";
import xcannesApi from "@/lib/xcannesApi";

function extractTickerPrice(ticker) {
  const priceSource =
    ticker?.lastPrice ??
    ticker?.price ??
    ticker?.midPrice ??
    ticker?.bidPrice ??
    ticker?.askPrice;
  const price = Number(priceSource);
  return Number.isFinite(price) && price > 0 ? price : Number.NaN;
}

async function resolveUsdPerUnit(code, pythPairsMap) {
  const upper = String(code || "").toUpperCase();
  if (!upper) return { rate: Number.NaN, source: null };
  if (upper === "USD" || upper === "RLUSD") return { rate: 1, source: "PYTH" };

  try {
    const directKey = `${upper}_USD`;
    const inverseKey = `USD_${upper}`;

    if (pythPairsMap?.has?.(directKey)) {
      const meta = pythPairsMap.get(directKey);
      const ticker = await xcannesApi.getTicker(meta?.symbol || directKey);
      const price = extractTickerPrice(ticker);
      if (Number.isFinite(price)) return { rate: price, source: "PYTH" };
    }

    if (pythPairsMap?.has?.(inverseKey)) {
      const meta = pythPairsMap.get(inverseKey);
      const ticker = await xcannesApi.getTicker(meta?.symbol || inverseKey);
      const price = extractTickerPrice(ticker);
      if (Number.isFinite(price) && price > 0) return { rate: 1 / price, source: "PYTH" };
    }
  } catch (_err) {
    // fallback below
  }

  try {
    const fxResult = await xcannesApi.getFxEod("USD", upper, 30);
    const candles = Array.isArray(fxResult?.candles) ? fxResult.candles : [];
    const last = candles[candles.length - 1];
    const close =
      last && last.close != null
        ? Number(last.close)
        : last && last.price != null
          ? Number(last.price)
          : Number.NaN;

    // API returns USD->QUOTE (QUOTE per USD), so USD per 1 QUOTE is 1/close.
    if (Number.isFinite(close) && close > 0) return { rate: 1 / close, source: "FAWAZ" };
  } catch (_err) {
    // ignore
  }

  return { rate: Number.NaN, source: null };
}

export function useRlusdPerUnitRates(currencyCodes = []) {
  const codesKey = useMemo(() => {
    const normalized = (currencyCodes || [])
      .map((c) => String(c || "").toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(normalized)).sort().join("|");
  }, [currencyCodes]);

  const [usdPerUnit, setUsdPerUnit] = useState({});
  const [sourceByCode, setSourceByCode] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadRates = async () => {
      if (!codesKey) {
        setUsdPerUnit({});
        setSourceByCode({});
        return;
      }

      setLoading(true);
      try {
        const markets = await xcannesApi.getAllMarkets();
        const pythPairs = Array.isArray(markets?.pyth) ? markets.pyth : [];
        const pythPairsMap = new Map();
        pythPairs.forEach((pair) => {
          const base = String(pair?.base || "").toUpperCase();
          const quote = String(pair?.quote || "").toUpperCase();
          if (!base || !quote) return;
          pythPairsMap.set(`${base}_${quote}`, pair);
        });

        const codes = codesKey.split("|").filter(Boolean);
        const next = {};
        const nextSources = {};

        await Promise.all(
          codes.map(async (code) => {
            const resolved = await resolveUsdPerUnit(code, pythPairsMap);
            next[code] = resolved?.rate;
            nextSources[code] = resolved?.source || null;
          })
        );

        if (!cancelled) {
          setUsdPerUnit(next);
          setSourceByCode(nextSources);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[useRlusdPerUnitRates] Failed to load rates:", err?.message || err);
          setUsdPerUnit({});
          setSourceByCode({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRates();
    return () => {
      cancelled = true;
    };
  }, [codesKey]);

  return { usdPerUnit, sourceByCode, loading };
}
