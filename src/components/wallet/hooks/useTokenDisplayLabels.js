import { useMemo } from "react";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import {
  getCurrencyFlag,
  getDisplayCurrencyCode,
  getTokenIcon,
  formatAmountWithSymbol,
} from "../walletDashboardConfig";

/**
 * useTokenDisplayLabels — Derives all display-related computed values
 * from augmented tokens + currency line allocations + FX rates.
 *
 * Returns:
 *   displayTokensWithCurrencyLines — tokens with FX-converted values
 *   selectLabelByAssetKey          — { [key]: "EUR" }
 *   selectLabelRightByAssetKey     — { [key]: "1 234,56 €" }
 *   selectLabelMobileByAssetKey    — { [key]: "EUR (1 234,56 €)" }
 *   selectIconByAssetKey           — { [key]: { src, alt } | flagObj }
 *   tokenListTokens                — filtered list (no XRP/RLUSD)
 */
export function useTokenDisplayLabels({
  augmentedTokens,
  allocatedRlusdByCurrency,
  rlusdPerUnitRates,
  locale,
}) {
  // ─── Enrich tokens with FX-converted value ────────────────────────────

  const displayTokensWithCurrencyLines = useMemo(() => {
    return (augmentedTokens || []).map((token) => {
      const currency = String(token?.currency || "").toUpperCase();
      if (!currency) return token;

      // Pour les devises "UX" (off-chain), on affiche:
      // - valeur principale en devise (units), basée sur l'allocation RLUSD et un taux indicatif
      // - valeur secondaire "≈ RLUSD" = allocation RLUSD
      if (!token?.isTrustlineOnly) return token;
      if (currency === "XRP") return token;

      const allocated =
        allocatedRlusdByCurrency?.get?.(currency) ??
        (Number.isFinite(Number(token?.allocatedRlusd))
          ? Number(token.allocatedRlusd)
          : 0);

      // USD et RLUSD ont un taux fixe de 1 (stablecoin pegged 1:1).
      const rawRate =
        currency === "USD" || currency === "RLUSD"
          ? 1
          : Number(rlusdPerUnitRates?.[currency]);
      const units =
        Number.isFinite(rawRate) &&
        rawRate > 0 &&
        Number.isFinite(allocated) &&
        allocated > 0
          ? allocated / rawRate
          : 0;

      return {
        ...token,
        value: units,
      };
    });
  }, [allocatedRlusdByCurrency, augmentedTokens, rlusdPerUnitRates]);

  // ─── Selector labels ─────────────────────────────────────────────────

  const selectLabelByAssetKey = useMemo(() => {
    const labels = {};
    (displayTokensWithCurrencyLines || augmentedTokens || []).forEach(
      (token) => {
        const code = String(token?.currency || "").toUpperCase();
        if (!code) return;
        const display = getDisplayCurrencyCode(code);
        if (token?.key) labels[token.key] = display;
        labels[code] = display;
      },
    );
    return labels;
  }, [displayTokensWithCurrencyLines, augmentedTokens]);

  const selectLabelRightByAssetKey = useMemo(() => {
    const labels = {};
    (displayTokensWithCurrencyLines || augmentedTokens || []).forEach(
      (token) => {
        const code = String(token?.currency || "").toUpperCase();
        if (!code) return;
        const display = getDisplayCurrencyCode(code);
        const amount = Number(token?.value || 0);
        const amountLabel = Number.isFinite(amount)
          ? formatAmountWithSymbol(locale, amount, display, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : formatAmountWithSymbol(locale, 0, display, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
        if (token?.key) labels[token.key] = amountLabel;
        labels[code] = amountLabel;
      },
    );
    return labels;
  }, [displayTokensWithCurrencyLines, augmentedTokens, locale]);

  const selectLabelMobileByAssetKey = useMemo(() => {
    const labels = {};
    (displayTokensWithCurrencyLines || augmentedTokens || []).forEach(
      (token) => {
        const code = String(token?.currency || "").toUpperCase();
        if (!code) return;
        const display = getDisplayCurrencyCode(code);
        const amount = Number(token?.value || 0);
        const amountLabel = Number.isFinite(amount)
          ? formatAmountWithSymbol(locale, amount, display, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : formatAmountWithSymbol(locale, 0, display, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
        const label = `${display} (${amountLabel})`;
        if (token?.key) labels[token.key] = label;
        labels[code] = label;
      },
    );
    return labels;
  }, [displayTokensWithCurrencyLines, augmentedTokens, locale]);

  // ─── Selector icons ──────────────────────────────────────────────────

  const selectIconByAssetKey = useMemo(() => {
    const icons = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const display = getDisplayCurrencyCode(code);
      const icon = CRYPTO_ICONS?.[display]
        ? { src: CRYPTO_ICONS[display], alt: display }
        : token?.isTrustlineOnly || display !== code
          ? getCurrencyFlag(display)
          : getTokenIcon(code);
      if (token?.key) icons[token.key] = icon;
      icons[code] = icon;
    });
    return icons;
  }, [augmentedTokens]);

  // ─── Filtered token list (no XRP / RLUSD) ────────────────────────────

  const tokenListTokens = useMemo(() => {
    const tokens = displayTokensWithCurrencyLines;
    // XRP n'apparaît pas dans les lignes de devises du wallet.
    // Il est visible uniquement dans le relevé global (dernière ligne).
    // RLUSD est masqué (décomposé en USD + lignes).
    return (tokens || []).filter((token) => {
      const code = String(token?.currency || "").toUpperCase();
      return code !== "XRP" && code !== "RLUSD";
    });
  }, [displayTokensWithCurrencyLines]);

  return {
    displayTokensWithCurrencyLines,
    selectLabelByAssetKey,
    selectLabelRightByAssetKey,
    selectLabelMobileByAssetKey,
    selectIconByAssetKey,
    tokenListTokens,
  };
}
