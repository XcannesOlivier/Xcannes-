import { useEffect, useMemo, useState } from "react";

export function useUsdTotalLabel({
  augmentedTokens,
  isPreviewMode,
  stableUsd,
  xrpAmount,
  demoTotalUsd,
  isStablecoin,
  fiatRates,
  rlusdOnChain,
} = {}) {
  const [usdRates, setUsdRates] = useState({});

  const rateCodesKey = useMemo(() => {
    const codes = (augmentedTokens || [])
      .filter((token) => {
        const code = String(token.currency || "").toUpperCase();
        if (code === "XRP") return false;
        const value = Number(token.value || 0);
        return Number.isFinite(value) && value > 0;
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

  const totalUsdLabel =
    Number.isFinite(totalUsd) && totalUsd > 0
      ? `${totalUsd.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} USD`
      : null;

  // En mode réel, le total exact = rlusdOnChain (source de vérité on-chain).
  // En mode preview, utilise demoTotalUsd ; fallback sur stableUsd si FX non chargés.
  const rlusdOnChainTotal = Number(rlusdOnChain);
  const rlusdOnChainLabel =
    !isPreviewMode &&
    Number.isFinite(rlusdOnChainTotal) &&
    rlusdOnChainTotal >= 0
      ? `${rlusdOnChainTotal.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} USD`
      : null;

  const fallbackTotalLabel = isPreviewMode
    ? `${Number(demoTotalUsd || 0).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} USD`
    : stableUsd > 0
      ? `${Number(stableUsd || 0).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} USD`
      : `0.00 USD`;

  // Priorité : rlusdOnChain (exact) > FX-based total > fallback
  const totalLabel = rlusdOnChainLabel || totalUsdLabel || fallbackTotalLabel;

  return {
    usdRates,
    totalUsd,
    totalUsdLabel,
    fallbackTotalLabel,
    totalLabel,
  };
}
