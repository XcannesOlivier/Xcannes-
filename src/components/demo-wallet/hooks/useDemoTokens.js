/**
 * useDemoTokens — derived token lists, allocation summaries and select-label maps.
 *
 * Pure computation (all useMemo), no side-effects.
 */

import { useMemo } from "react";
import Image from "next/image";
import { isDemoNativeCurrency } from "../DemoWalletModel";
import { CRYPTO_ICONS } from "../utils/demoMarketConstants";
import { getCurrencyDescription } from "../utils/demoCurrencyDescriptions";
import {
  DEMO_TOKEN_PRIORITY,
  formatUnitsWithSymbol,
} from "../utils/demoWalletHelpers";
import {
  DEMO_CURRENCY_LINE_ORDER,
  getCurrencyFlag,
  getDisplayCurrencyCode,
  USD_STABLECOINS,
} from "../demoWalletDashboardConfig";

// ── Standalone helpers (no hooks) ─────────────────────────────────
export function renderDemoTokenIcon(code) {
  const upper = String(code || "").toUpperCase();
  const display = getDisplayCurrencyCode(upper);
  const iconSrc = CRYPTO_ICONS?.[display];
  if (iconSrc) {
    return (
      <Image
        src={iconSrc}
        alt={display}
        width={20}
        height={20}
        className="w-5 h-5 object-contain"
      />
    );
  }
  return getCurrencyFlag(display);
}

export function getDemoCurrencyLabel(code) {
  const upper = String(code || "").toUpperCase();
  if (upper === "XRP") return "XRP · Native";
  if (upper === "USD") return "US Dollar";
  if (upper === "RLUSD") return "US Dollar";
  if (USD_STABLECOINS.includes(upper)) return "XRPL Stablecoin";
  return getCurrencyDescription(upper) || upper;
}

// ── Hook ──────────────────────────────────────────────────────────
export function useDemoTokens({
  activeWallet,
  effectiveUsdPerUnitRates,
  rlusdPerUnitRates,
  locale,
}) {
  // ── Currency order ──
  const currencyOrderIndex = useMemo(() => {
    const entries = Array.isArray(DEMO_CURRENCY_LINE_ORDER)
      ? DEMO_CURRENCY_LINE_ORDER
      : [];
    const index = new Map();
    entries.forEach((code, idx) => {
      const upper = String(code || "").toUpperCase();
      if (!upper) return;
      if (!index.has(upper)) index.set(upper, idx);
    });
    return index;
  }, []);

  // ── Allocation summary ──
  const allocationSummary = useMemo(() => {
    const allocations = activeWallet?.allocations || {};
    const rlusdOnChain = Number(allocations?.RLUSD || 0);
    const totalAllocatedUsd = Object.entries(allocations).reduce(
      (sum, [code, value]) => {
        const upper = String(code || "").toUpperCase();
        if (upper === "RLUSD" || upper === "XRP" || upper === "USD") return sum;
        return sum + (Number(value) || 0);
      },
      0,
    );
    const unallocatedRlusd = Math.max(0, rlusdOnChain - totalAllocatedUsd);
    return { rlusdOnChain, totalAllocatedUsd, unallocatedRlusd };
  }, [activeWallet?.allocations]);

  // ── Display token rows (for TokenList) ──
  const tokens = useMemo(() => {
    const allocations = activeWallet?.allocations || {};
    const unallocatedUsd = allocationSummary.unallocatedRlusd;

    const entries = Object.entries(allocations)
      .map(([code, storedValue]) => {
        const upper = String(code || "").toUpperCase();
        const storedNum = Number(storedValue) || 0;
        const rate = Number(effectiveUsdPerUnitRates?.[upper] ?? 0);
        const isNative = isDemoNativeCurrency(upper);
        const allocationUsd = isNative
          ? upper === "XRP"
            ? storedNum * rate
            : storedNum
          : storedNum;
        const units = isNative ? storedNum : rate > 0 ? storedNum / rate : 0;
        const usdValue = Number.isFinite(allocationUsd) ? allocationUsd : null;
        return { code: upper, units, usdValue, allocationUsd };
      })
      .filter((entry) => entry.code !== "RLUSD" && entry.code !== "USD");

    entries.push({
      code: "USD",
      units: unallocatedUsd,
      usdValue: unallocatedUsd,
      allocationUsd: unallocatedUsd,
      isDerived: true,
    });

    return entries.sort((a, b) => {
      const aPriority = Object.prototype.hasOwnProperty.call(
        DEMO_TOKEN_PRIORITY,
        a.code,
      )
        ? DEMO_TOKEN_PRIORITY[a.code]
        : Number.POSITIVE_INFINITY;
      const bPriority = Object.prototype.hasOwnProperty.call(
        DEMO_TOKEN_PRIORITY,
        b.code,
      )
        ? DEMO_TOKEN_PRIORITY[b.code]
        : Number.POSITIVE_INFINITY;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aOrder = currencyOrderIndex.get(a.code) ?? Number.POSITIVE_INFINITY;
      const bOrder = currencyOrderIndex.get(b.code) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.code.localeCompare(b.code);
    });
  }, [
    activeWallet?.allocations,
    allocationSummary.unallocatedRlusd,
    currencyOrderIndex,
    effectiveUsdPerUnitRates,
  ]);

  // ── Augmented tokens (full metadata per currency) ──
  const augmentedTokens = useMemo(() => {
    const allocations = activeWallet?.allocations || {};
    const entries = Object.entries(allocations).map(([code, units]) => {
      const currency = String(code || "").toUpperCase();
      const storedValue = Number(units) || 0;
      const isTrustlineOnly = !isDemoNativeCurrency(currency);
      const rlusdPerUnit = Number(rlusdPerUnitRates?.[currency] || 0);
      const allocationUsd = isTrustlineOnly
        ? storedValue
        : currency === "XRP"
          ? storedValue * rlusdPerUnit
          : storedValue;
      const displayUnits = isTrustlineOnly
        ? rlusdPerUnit > 0
          ? storedValue / rlusdPerUnit
          : 0
        : storedValue;
      const demoRlusdValue = allocationUsd;

      return {
        key: currency,
        currency,
        value: displayUnits,
        allocationUsd,
        issuer: undefined,
        isTrustlineOnly,
        isMissingTrustline: false,
        demoRlusdValue,
      };
    });
    return entries.sort((a, b) => {
      const aPriority = Object.prototype.hasOwnProperty.call(
        DEMO_TOKEN_PRIORITY,
        a.currency,
      )
        ? DEMO_TOKEN_PRIORITY[a.currency]
        : Number.POSITIVE_INFINITY;
      const bPriority = Object.prototype.hasOwnProperty.call(
        DEMO_TOKEN_PRIORITY,
        b.currency,
      )
        ? DEMO_TOKEN_PRIORITY[b.currency]
        : Number.POSITIVE_INFINITY;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aOrder =
        currencyOrderIndex.get(a.currency) ?? Number.POSITIVE_INFINITY;
      const bOrder =
        currencyOrderIndex.get(b.currency) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.currency || "").localeCompare(String(b.currency || ""));
    });
  }, [activeWallet?.allocations, currencyOrderIndex, rlusdPerUnitRates]);

  // ── Statement-level token list (excludes XRP/USD/RLUSD, adds derived USD row) ──
  const globalStatementTokens = useMemo(() => {
    const base = (augmentedTokens || []).filter((token) => {
      const code = String(token?.currency || "").toUpperCase();
      return code && code !== "XRP" && code !== "USD" && code !== "RLUSD";
    });
    base.push({
      currency: "USD",
      value: allocationSummary.unallocatedRlusd,
      issuer: undefined,
      isTrustlineOnly: true,
      isDerivedUsd: true,
    });
    return base;
  }, [allocationSummary.unallocatedRlusd, augmentedTokens]);

  // ── Selectable tokens (for send/swap dropdowns — excludes XRP & USD) ──
  const selectableTokens = useMemo(() => {
    return (augmentedTokens || []).filter((token) => {
      const code = String(token?.currency || "").toUpperCase();
      return code !== "XRP" && code !== "USD";
    });
  }, [augmentedTokens]);

  // ── Select-label maps (for asset dropdowns across modals) ──
  const selectLabelByAssetKey = useMemo(() => {
    const labels = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const display = getDisplayCurrencyCode(code);
      if (token.key) labels[token.key] = display;
      labels[code] = display;
    });
    return labels;
  }, [augmentedTokens]);

  const selectLabelRightByAssetKey = useMemo(() => {
    const labels = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const amountValue =
        code === "RLUSD"
          ? allocationSummary.unallocatedRlusd
          : token.value || 0;
      const display = getDisplayCurrencyCode(code);
      const amountLabel = formatUnitsWithSymbol(locale, amountValue, display);
      if (token.key) labels[token.key] = amountLabel;
      labels[code] = amountLabel;
    });
    return labels;
  }, [allocationSummary.unallocatedRlusd, augmentedTokens, locale]);

  const selectLabelMobileByAssetKey = useMemo(() => {
    const labels = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const amountValue =
        code === "RLUSD"
          ? allocationSummary.unallocatedRlusd
          : token.value || 0;
      const display = getDisplayCurrencyCode(code);
      const amountLabel = formatUnitsWithSymbol(locale, amountValue, display);
      const label = `${display} (${amountLabel})`;
      if (token.key) labels[token.key] = label;
      labels[code] = label;
    });
    return labels;
  }, [allocationSummary.unallocatedRlusd, augmentedTokens, locale]);

  const selectIconByAssetKey = useMemo(() => {
    const icons = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const display = getDisplayCurrencyCode(code);
      const icon = CRYPTO_ICONS?.[display]
        ? { src: CRYPTO_ICONS[display], alt: display }
        : getCurrencyFlag(display);
      if (token.key) icons[token.key] = icon;
      icons[code] = icon;
    });
    return icons;
  }, [augmentedTokens]);

  return {
    currencyOrderIndex,
    allocationSummary,
    tokens,
    augmentedTokens,
    globalStatementTokens,
    selectableTokens,
    selectLabelByAssetKey,
    selectLabelRightByAssetKey,
    selectLabelMobileByAssetKey,
    selectIconByAssetKey,
  };
}
