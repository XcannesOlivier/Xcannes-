import { useEffect, useMemo, useState } from "react";
import { formatAmountWithSymbol } from "../walletDashboardConfig";

export function useUsdTotalLabel({
  augmentedTokens,
  isPreviewMode,
  stableUsd,
  demoTotalUsd,
  isStablecoin,
  fiatRates,
  rlusdOnChain,
  preferredCurrency = "USD",
  locale = "en",
} = {}) {
  const [usdRates, setUsdRates] = useState({});
  const prefCode = String(preferredCurrency || "USD").toUpperCase();

  const rateCodesKey = useMemo(() => {
    const codes = (augmentedTokens || [])
      .filter((token) => {
        const code = String(token.currency || "").toUpperCase();
        if (code === "XRP") return false;
        const value = Number(token.value || 0);
        // Include tokens with a positive value OR with an RLUSD allocation
        // (currency-line tokens like EUR/GBP have value=0 but allocatedRlusd>0;
        // their rate is needed by CurrencyStatement to convert transaction amounts).
        const allocated = Number(token.allocatedRlusd || 0);
        return (
          (Number.isFinite(value) && value > 0) ||
          (Number.isFinite(allocated) && allocated > 0)
        );
      })
      .map((t) => String(t.currency || "").toUpperCase())
      .filter(Boolean);
    const unique = Array.from(new Set(codes)).sort();
    return unique.join("|");
  }, [augmentedTokens]);

  useEffect(() => {
    let cancelled = false;

    const resolveUsdRate = async (code) => {
      const upper = String(code || "").toUpperCase();
      if (!upper) return NaN;
      if (upper === "USD" || upper === "RLUSD") return 1;

      if (isStablecoin?.(upper)) return 1;

      // Utiliser les taux fiat pré-chargés (useRlusdPerUnitRates / Fawaz EOD)
      const rate = Number(fiatRates?.[upper]);
      if (Number.isFinite(rate) && rate > 0) return rate;

      return NaN;
    };

    const loadUsdRates = async () => {
      if (!rateCodesKey) {
        setUsdRates({});
        return;
      }

      try {
        const codes = rateCodesKey.split("|").filter(Boolean);
        const rates = {};
        await Promise.all(
          codes.map(async (code) => {
            rates[code] = await resolveUsdRate(code);
          }),
        );

        if (!cancelled) {
          setUsdRates(rates);
        }
      } catch (err) {
        console.error("USD rates loading error:", err);
      }
    };

    loadUsdRates();
    return () => {
      cancelled = true;
    };
  }, [
    fiatRates,
    isStablecoin,
    rateCodesKey,
  ]);

  const totalUsd = useMemo(() => {
    const total = (augmentedTokens || []).reduce((sum, token) => {
      const code = String(token.currency || "").toUpperCase();
      if (code === "XRP") return sum;
      const rate = usdRates[code];
      const value = Number(token.value || 0);
      if (!Number.isFinite(rate) || !Number.isFinite(value)) return sum;
      return sum + value * rate;
    }, 0);
    return Number.isFinite(total) ? total : 0;
  }, [augmentedTokens, usdRates]);

  // ── Compute the RLUSD/USD total (source of truth) ──────────
  const rlusdOnChainTotal = Number(rlusdOnChain);
  const totalInUsd =
    !isPreviewMode && Number.isFinite(rlusdOnChainTotal) && rlusdOnChainTotal >= 0
      ? rlusdOnChainTotal
      : totalUsd > 0
        ? totalUsd
        : isPreviewMode
          ? Number(demoTotalUsd || 0)
          : Number(stableUsd || 0);

  // ── Convert total to preferred currency ────────────────────
  // rlusdPerUnitRate = how many RLUSD (≈ USD) per 1 unit of preferred currency.
  // So: totalInPreferredCurrency = totalInUsd / rlusdPerUnitRate
  const rlusdPerUnitRate = useMemo(() => {
    if (prefCode === "USD" || prefCode === "RLUSD") return 1;
    const rate = Number(fiatRates?.[prefCode]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }, [prefCode, fiatRates]);

  const totalInPreferred = useMemo(() => {
    if (!Number.isFinite(totalInUsd) || totalInUsd <= 0) return 0;
    if (prefCode === "USD" || prefCode === "RLUSD") return totalInUsd;
    if (rlusdPerUnitRate === null) return null; // rate not available
    return totalInUsd / rlusdPerUnitRate;
  }, [totalInUsd, prefCode, rlusdPerUnitRate]);

  // ── Build the label ────────────────────────────────────────
  const totalLabel = useMemo(() => {
    // If preferred currency rate is available, show in that currency
    if (totalInPreferred !== null && Number.isFinite(totalInPreferred)) {
      const displayCode = prefCode === "RLUSD" ? "USD" : prefCode;
      return formatAmountWithSymbol(locale, totalInPreferred, displayCode, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    // Fallback to USD if preferred rate unavailable
    if (Number.isFinite(totalInUsd) && totalInUsd > 0) {
      return formatAmountWithSymbol(locale, totalInUsd, "USD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    return formatAmountWithSymbol(locale, 0, prefCode === "RLUSD" ? "USD" : prefCode, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [totalInPreferred, totalInUsd, prefCode, locale]);

  return {
    usdRates,
    totalLabel,
    totalInUsd,
    totalInPreferred,
    preferredCurrencyCode: prefCode,
  };
}
