"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import xcannesApi from "@/lib/xcannesApi";

/**
 * usePreferredCurrency — manages the user's preferred display currency.
 *
 * Sources (priority order):
 *   1. Local override (user changed via selector during the session)
 *   2. On-chain defaultCurrency (from wallet_label memo)
 *   3. Fallback "USD"
 *
 * Also provides the list of available Fawaz currencies for the selector,
 * grouped into "top 5" and "all" for search.
 *
 * When the user changes currency, the hook:
 *   - Immediately updates local state (instant UX)
 *   - Calls onCurrencyChange(code) so the parent can persist on-chain
 */

const TOP_CURRENCIES = ["USD", "EUR", "GBP", "CHF", "CAD"];

export function usePreferredCurrency({
  defaultCurrency = null,
  onCurrencyChange,
} = {}) {
  const [localOverride, setLocalOverride] = useState(null);
  const [fawazCurrencies, setFawazCurrencies] = useState([]);
  const [fawazLoading, setFawazLoading] = useState(false);

  // Effective preferred currency
  const preferredCurrency = useMemo(() => {
    const code = localOverride || defaultCurrency || "USD";
    return String(code).toUpperCase();
  }, [localOverride, defaultCurrency]);

  // When on-chain defaultCurrency arrives, sync local if no override
  useEffect(() => {
    if (defaultCurrency && !localOverride) {
      // No-op: preferredCurrency already picks defaultCurrency
    }
  }, [defaultCurrency, localOverride]);

  // Load Fawaz currencies (lazy — only when selector opens)
  const loadFawazCurrencies = useCallback(async () => {
    if (fawazCurrencies.length > 0) return; // already loaded
    setFawazLoading(true);
    try {
      const currencies = await xcannesApi.getFxCurrencies();
      const list = (Array.isArray(currencies) ? currencies : [])
        .map((c) => {
          if (typeof c === "string") return { code: c.toUpperCase(), name: "" };
          return {
            code: String(c?.code || "").toUpperCase(),
            name: String(c?.name || ""),
            symbol: String(c?.symbol || ""),
          };
        })
        .filter((c) => c.code);

      // Ensure USD is always present
      if (!list.some((c) => c.code === "USD")) {
        list.unshift({ code: "USD", name: "US Dollar", symbol: "$" });
      }

      // Sort alphabetically
      list.sort((a, b) => a.code.localeCompare(b.code));
      setFawazCurrencies(list);
    } catch (err) {
      console.warn("[usePreferredCurrency] Failed to load currencies:", err);
    } finally {
      setFawazLoading(false);
    }
  }, [fawazCurrencies.length]);

  // Top currencies (always available, no API needed)
  const topCurrencies = useMemo(() => {
    return TOP_CURRENCIES.map((code) => {
      const match = fawazCurrencies.find((c) => c.code === code);
      return match || { code, name: "", symbol: "" };
    });
  }, [fawazCurrencies]);

  // Change preferred currency
  const setPreferredCurrency = useCallback(
    (code) => {
      const upper = String(code || "USD").toUpperCase();
      setLocalOverride(upper);
      onCurrencyChange?.(upper);
    },
    [onCurrencyChange],
  );

  return {
    preferredCurrency,
    setPreferredCurrency,
    topCurrencies,
    fawazCurrencies,
    fawazLoading,
    loadFawazCurrencies,
  };
}
