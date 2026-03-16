/**
 * useDemoRates — price-rate fetching for the demo wallet.
 *
 * Fetches Fawaz EOD rates **once at mount** (no polling, no staleness tracking).
 * Falls back to static rates from DemoWalletModel if the fetch fails.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { getDemoRatesUsdPerUnit } from "../DemoWalletModel";
import { resolveUsdPerUnit } from "../utils/demoWalletHelpers";

export function useDemoRates({
  wallets,
  convertBaseCurrency,
  convertQuoteCurrency,
  requestCurrency,
  preferredCurrency,
}) {
  const fallbackUsdPerUnit = useMemo(() => getDemoRatesUsdPerUnit(), []);

  const [usdPerUnitRates, setUsdPerUnitRates] = useState(() => ({
    USD: 1,
    RLUSD: 1,
    ...fallbackUsdPerUnit,
  }));
  const [usdPerUnitSources, setUsdPerUnitSources] = useState(() => ({
    USD: "FAWAZ",
    RLUSD: "FAWAZ",
  }));
  const fetchedRef = useRef(false);
  const cancelledRef = useRef(false);

  // ── Collect every currency code that needs a rate ──
  const requiredRateCodes = useMemo(() => {
    const codes = new Set(["USD", "RLUSD"]);
    Object.values(wallets || {}).forEach((wallet) => {
      Object.keys(wallet?.allocations || {}).forEach((code) => {
        const upper = String(code || "").toUpperCase();
        if (upper) codes.add(upper);
      });
    });
    if (convertBaseCurrency) {
      const upper = String(convertBaseCurrency).toUpperCase();
      if (upper) codes.add(upper);
    }
    if (convertQuoteCurrency) {
      const upper = String(convertQuoteCurrency).toUpperCase();
      if (upper) codes.add(upper);
    }
    if (requestCurrency) {
      const upper = String(requestCurrency).toUpperCase();
      if (upper) codes.add(upper);
    }
    if (preferredCurrency) {
      const upper = String(preferredCurrency).toUpperCase();
      if (upper) codes.add(upper);
    }
    return Array.from(codes)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [
    convertBaseCurrency,
    convertQuoteCurrency,
    preferredCurrency,
    requestCurrency,
    wallets,
  ]);

  // ── Single fetch at mount — no polling ──
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    cancelledRef.current = false;

    (async () => {
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

        if (cancelledRef.current) return;
        setUsdPerUnitRates((prev) => ({ ...prev, ...nextRates }));
        setUsdPerUnitSources((prev) => ({ ...prev, ...nextSources }));
      } catch (err) {
        if (!cancelledRef.current) {
          console.warn(
            "[demo-wallet] initial rates fetch failed, using static fallback:",
            err?.message || err,
          );
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Aliases used by the rest of the wallet ──
  const rlusdPerUnitRates = usdPerUnitRates;

  // ── Fetch any newly-required codes that are missing ──
  // Use a stable string key to avoid re-triggers when the array reference changes.
  const requiredCodesKey = useMemo(
    () => (requiredRateCodes || []).join("|"),
    [requiredRateCodes],
  );
  // Track already-attempted codes to avoid retrying failed resolutions every render.
  const attemptedCodesRef = useRef(new Set());

  useEffect(() => {
    const missing = (requiredRateCodes || []).filter(
      (code) => !usdPerUnitRates[code] && !attemptedCodesRef.current.has(code),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const patch = {};
      const srcPatch = {};
      await Promise.all(
        missing.map(async (code) => {
          attemptedCodesRef.current.add(code);
          const resolved = await resolveUsdPerUnit(code);
          const num = Number(resolved?.rate);
          if (!Number.isFinite(num) || num <= 0) return;
          patch[code] = num;
          srcPatch[code] = resolved?.source || null;
        }),
      );
      if (cancelled || Object.keys(patch).length === 0) return;
      setUsdPerUnitRates((prev) => ({ ...prev, ...patch }));
      setUsdPerUnitSources((prev) => ({ ...prev, ...srcPatch }));
    })();
    return () => { cancelled = true; };
  }, [requiredCodesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rlusdPerUnitSources = useMemo(
    () => ({ ...usdPerUnitSources }),
    [usdPerUnitSources],
  );

  return {
    effectiveUsdPerUnitRates: usdPerUnitRates,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
  };
}
