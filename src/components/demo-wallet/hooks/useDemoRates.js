/**
 * useDemoRates — live price-rate fetching for the demo wallet.
 *
 * Handles:
 * - Building the list of required currency codes from wallet allocations + form selections.
 * - Periodic fetch via resolveUsdPerUnit() (Fawaz EOD).
 * - Staleness detection (if we haven't refreshed within DEMO_RATES_STALE_AFTER_MS, blend fallback rates).
 * - Derived rlusdPerUnitRates / rlusdPerUnitSources aliases.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDemoRatesUsdPerUnit } from "../DemoWalletModel";
import {
  DEMO_RATES_REFRESH_MS,
  DEMO_RATES_STALE_AFTER_MS,
  resolveUsdPerUnit,
} from "../utils/demoWalletHelpers";

export function useDemoRates({
  wallets,
  convertBaseCurrency,
  convertQuoteCurrency,
  requestCurrency,
}) {
  const fallbackUsdPerUnit = useMemo(() => getDemoRatesUsdPerUnit(), []);
  const fallbackRates = useMemo(
    () => ({
      USD: 1,
      RLUSD: 1,
      ...fallbackUsdPerUnit,
    }),
    [fallbackUsdPerUnit],
  );

  const [usdPerUnitRates, setUsdPerUnitRates] = useState(() => ({
    USD: 1,
    RLUSD: 1,
    ...fallbackUsdPerUnit,
  }));
  const [usdPerUnitSources, setUsdPerUnitSources] = useState(() => ({
    USD: "FAWAZ",
    RLUSD: "FAWAZ",
  }));
  const [ratesLastOkTs, setRatesLastOkTs] = useState(() => Date.now());
  const [ratesNowTs, setRatesNowTs] = useState(() => Date.now());
  const ratesCancelledRef = useRef(false);

  // ── Tick the "now" timestamp every 5 s so staleness can react ──
  useEffect(() => {
    const id = setInterval(() => setRatesNowTs(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // ── Cleanup on unmount ──
  useEffect(() => {
    ratesCancelledRef.current = false;
    return () => {
      ratesCancelledRef.current = true;
    };
  }, []);

  // ── Collect every currency code that needs a rate ──
  const requiredRateCodes = useMemo(() => {
    const codes = new Set(["USD", "RLUSD"]);
    Object.values(wallets || {}).forEach((wallet) => {
      Object.keys(wallet?.allocations || {}).forEach((code) => {
        const upper = String(code || "").toUpperCase();
        if (upper && upper !== "XRP") codes.add(upper);
      });
    });
    if (convertBaseCurrency) {
      const upper = String(convertBaseCurrency).toUpperCase();
      if (upper && upper !== "XRP") codes.add(upper);
    }
    if (convertQuoteCurrency) {
      const upper = String(convertQuoteCurrency).toUpperCase();
      if (upper && upper !== "XRP") codes.add(upper);
    }
    if (requestCurrency) {
      const upper = String(requestCurrency).toUpperCase();
      if (upper && upper !== "XRP") codes.add(upper);
    }
    return Array.from(codes)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [convertBaseCurrency, convertQuoteCurrency, requestCurrency, wallets]);

  // ── Fetch rates from backend ──
  const refreshRates = useCallback(async () => {
    try {
      const nextRates = { USD: 1, RLUSD: 1 };
      const nextSources = { USD: "FAWAZ", RLUSD: "FAWAZ" };

      await Promise.all(
        (requiredRateCodes || []).map(async (code) => {
          const resolved = await resolveUsdPerUnit(code);
          const num = Number(resolved?.rate);
          if (!Number.isFinite(num) || num <= 0) return;
          const upper = String(code || "").toUpperCase();
          if (!upper) return;
          nextRates[upper] = num;
          nextSources[upper] = resolved?.source || null;
        }),
      );

      if (ratesCancelledRef.current) return;
      setUsdPerUnitRates((prev) => ({ ...prev, ...nextRates }));
      setUsdPerUnitSources((prev) => ({ ...prev, ...nextSources }));
      setRatesLastOkTs(Date.now());
    } catch (err) {
      if (!ratesCancelledRef.current) {
        console.warn(
          "[demo-wallet] rates refresh failed:",
          err?.message || err,
        );
      }
    }
  }, [requiredRateCodes]);

  // ── Auto-refresh on mount + interval ──
  useEffect(() => {
    refreshRates();
    const id = setInterval(refreshRates, DEMO_RATES_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshRates]);

  // ── Staleness ──
  const ratesAreStale = ratesNowTs - ratesLastOkTs > DEMO_RATES_STALE_AFTER_MS;
  const effectiveUsdPerUnitRates = useMemo(
    () =>
      ratesAreStale
        ? { ...fallbackRates, ...usdPerUnitRates }
        : usdPerUnitRates,
    [fallbackRates, ratesAreStale, usdPerUnitRates],
  );

  // ── Aliases used by the rest of the wallet ──
  const rlusdPerUnitRates = useMemo(
    () => effectiveUsdPerUnitRates,
    [effectiveUsdPerUnitRates],
  );
  const rlusdPerUnitSources = useMemo(
    () => ({ ...usdPerUnitSources }),
    [usdPerUnitSources],
  );

  return {
    effectiveUsdPerUnitRates,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    ratesAreStale,
  };
}
