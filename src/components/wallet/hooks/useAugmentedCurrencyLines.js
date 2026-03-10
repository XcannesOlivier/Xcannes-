import { useEffect, useMemo } from "react";
import { WALLET_CURRENCY_LINE_ORDER } from "../walletDashboardConfig";

/**
 * useAugmentedCurrencyLines — Augments raw currency lines from the backend
 * with default lines (USD, EUR, CHF…), sorts them by configured priority,
 * and computes adjustment deficit and currency-line codes for FX rates.
 */
export function useAugmentedCurrencyLines({
  currencyLines,
  currencyLinesSummary,
  backendWalletAddress,
  refreshCurrencyLines,
}) {
  const currencyOrderIndex = useMemo(() => {
    const entries = Array.isArray(WALLET_CURRENCY_LINE_ORDER)
      ? WALLET_CURRENCY_LINE_ORDER
      : [];
    const index = new Map();
    entries.forEach((code, idx) => {
      const upper = String(code || "").toUpperCase();
      if (!upper) return;
      if (!index.has(upper)) index.set(upper, idx);
    });
    return index;
  }, []);

  const augmentedCurrencyLines = useMemo(() => {
    const lines = Array.isArray(currencyLines) ? [...currencyLines] : [];
    const existing = new Set(
      lines
        .map((l) => String(l?.currencyCode || "").toUpperCase())
        .filter(Boolean),
    );

    // Lignes par défaut affichées dans tout wallet (même nouveau).
    const DEFAULT_LINES = ["USD", "EUR", "CHF", "GBP", "CAD", "JPY", "AED"];

    // Injecter la ligne USD synthétique avec le montant non alloué.
    const unallocatedRaw = currencyLinesSummary?.unallocatedRlusd;
    const unallocated = Number(unallocatedRaw);
    if (
      !existing.has("USD") &&
      unallocatedRaw != null &&
      Number.isFinite(unallocated)
    ) {
      lines.push({
        currencyCode: "USD",
        allocatedRlusd: unallocated,
        isDerived: true,
        active: false,
      });
      existing.add("USD");
    } else if (!existing.has("USD")) {
      lines.push({
        currencyCode: "USD",
        allocatedRlusd: 0,
        isDerived: true,
        active: false,
      });
      existing.add("USD");
    }

    // Injecter les autres lignes par défaut (allocation 0) si absentes.
    DEFAULT_LINES.forEach((code) => {
      if (!existing.has(code)) {
        lines.push({
          currencyCode: code,
          allocatedRlusd: 0,
          isDerived: true,
          active: false,
        });
        existing.add(code);
      }
    });

    return lines.sort((a, b) => {
      const aCode = String(a?.currencyCode || "").toUpperCase();
      const bCode = String(b?.currencyCode || "").toUpperCase();
      const aOrder = currencyOrderIndex.get(aCode) ?? Number.POSITIVE_INFINITY;
      const bOrder = currencyOrderIndex.get(bCode) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return aCode.localeCompare(bCode);
    });
  }, [currencyLines, currencyOrderIndex, currencyLinesSummary]);

  // Listen for wallet refresh events to update currency lines.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!backendWalletAddress || !refreshCurrencyLines) return;

    const handleWalletRefresh = (event) => {
      const address = event?.detail?.address;
      if (!address || address !== backendWalletAddress) return;
      refreshCurrencyLines();
    };

    window.addEventListener("xcannes:wallet:refresh", handleWalletRefresh);
    return () =>
      window.removeEventListener("xcannes:wallet:refresh", handleWalletRefresh);
  }, [backendWalletAddress, refreshCurrencyLines]);

  const currencyLineCodes = useMemo(() => {
    const codes = new Set();
    // Utiliser augmentedCurrencyLines (inclut les lignes par défaut
    // USD, EUR, CHF, GBP, CAD, JPY, AED…) pour que useRlusdPerUnitRates
    // récupère les taux de TOUTES les devises affichées.
    (augmentedCurrencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "")
        .trim()
        .toUpperCase();
      if (code) codes.add(code);
    });
    // Exclure les actifs XRPL (affichés on-chain), garder les devises "UX".
    ["XRP", "RLUSD", "USD"].forEach((c) => codes.delete(c));
    return Array.from(codes);
  }, [augmentedCurrencyLines]);

  return {
    augmentedCurrencyLines,
    currencyLineCodes,
  };
}
