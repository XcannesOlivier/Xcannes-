"use client";

import { useEffect, useMemo, useState } from "react";
import xcannesApi from "@/lib/xcannesApi";

async function resolveUsdPerUnit(code, fawazSet) {
  const upper = String(code || "").toUpperCase();
  if (!upper) return { rate: Number.NaN, source: null };
  if (upper === "USD" || upper === "RLUSD") return { rate: 1, source: "FAWAZ" };

  // Skip Fawaz si la devise n'est pas dans la liste supportée
  if (!fawazSet || !fawazSet.has(upper)) {
    return { rate: Number.NaN, source: null };
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
    if (Number.isFinite(close) && close > 0)
      return { rate: 1 / close, source: "FAWAZ" };
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
        const fxCurrencies = await xcannesApi.getFxCurrencies();
        const fawazSet = new Set(
          (Array.isArray(fxCurrencies) ? fxCurrencies : [])
            .map((c) => String(c?.code || c || "").toUpperCase())
            .filter(Boolean),
        );

        const codes = codesKey.split("|").filter(Boolean);
        const next = {};
        const nextSources = {};

        await Promise.all(
          codes.map(async (code) => {
            const resolved = await resolveUsdPerUnit(code, fawazSet);
            next[code] = resolved?.rate;
            nextSources[code] = resolved?.source || null;
          }),
        );

        if (!cancelled) {
          setUsdPerUnit(next);
          setSourceByCode(nextSources);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(
            "[useRlusdPerUnitRates] Failed to load rates:",
            err?.message || err,
          );
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
