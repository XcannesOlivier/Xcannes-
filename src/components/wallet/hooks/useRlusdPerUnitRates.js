"use client";

import { useEffect, useMemo, useState } from "react";
import xcannesApi from "@/lib/xcannesApi";

// Crypto/XRPL assets that should never go through the Fawaz FX endpoint.
const CRYPTO_CODES = new Set(["XRP", "BTC", "ETH", "SOL", "DOGE", "LTC", "ADA", "DOT", "AVAX", "MATIC"]);

async function resolveUsdPerUnit(code, fawazSet) {
  const upper = String(code || "").toUpperCase();
  if (!upper) return { rate: Number.NaN, source: null };
  if (upper === "USD" || upper === "RLUSD") return { rate: 1, source: "FAWAZ" };

  // Skip crypto assets — Fawaz only has forex/fiat pairs
  if (CRYPTO_CODES.has(upper)) return { rate: Number.NaN, source: null };

  // Skip Fawaz si la devise n'est pas dans la liste supportée
  if (!fawazSet || !fawazSet.has(upper)) {
    return { rate: Number.NaN, source: null };
  }

  try {
    const fxData = await xcannesApi.getFxRate("USD", upper);
    const rate = Number(fxData?.rate);

    // API returns USD->QUOTE (QUOTE per USD), so USD per 1 QUOTE is 1/rate.
    if (Number.isFinite(rate) && rate > 0)
      return { rate: 1 / rate, source: "FAWAZ" };
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
