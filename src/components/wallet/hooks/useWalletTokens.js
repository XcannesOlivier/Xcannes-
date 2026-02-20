"use client";

import { useMemo } from "react";
import { WALLET_CURRENCY_LINE_ORDER } from "../walletDashboardConfig";

const WALLET_TOKEN_PRIORITY = { XRP: 0, RLUSD: 1, USD: 2 };

export function useWalletTokens({ displayTokens, currencyLines }) {
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

  const allocatedRlusdByCurrency = useMemo(() => {
    const map = new Map();
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").trim().toUpperCase();
      if (!code) return;
      const allocated = Number.parseFloat(line?.allocatedRlusd ?? 0);
      map.set(code, Number.isFinite(allocated) ? allocated : 0);
    });
    return map;
  }, [currencyLines]);

  const augmentedTokens = useMemo(() => {
    const byCurrency = new Map();
    (displayTokens || []).forEach((token) => {
      const code = String(token?.currency || "").trim().toUpperCase();
      if (!code) return;
      if (!byCurrency.has(code)) {
        byCurrency.set(code, { ...token, currency: code });
      }
    });

    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").trim().toUpperCase();
      if (code === "USD") return;
      if (!code || byCurrency.has(code)) return;
      byCurrency.set(code, {
        key: `CL:${code}`,
        currency: code,
        issuer: "Allocation",
        value: 0,
        isTrustlineOnly: true,
      });
    });

    // Injecter l'allocation RLUSD connue (utile pour affichage "≈ RLUSD" côté UI)
    const withAllocations = Array.from(byCurrency.values()).map((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return token;
      const allocated = allocatedRlusdByCurrency.get(code);
      if (allocated == null) return token;
      return { ...token, allocatedRlusd: allocated };
    });

    return withAllocations.sort((a, b) => {
      const aCode = String(a?.currency || "").toUpperCase();
      const bCode = String(b?.currency || "").toUpperCase();
      const aPriority = Object.prototype.hasOwnProperty.call(WALLET_TOKEN_PRIORITY, aCode)
        ? WALLET_TOKEN_PRIORITY[aCode]
        : Number.POSITIVE_INFINITY;
      const bPriority = Object.prototype.hasOwnProperty.call(WALLET_TOKEN_PRIORITY, bCode)
        ? WALLET_TOKEN_PRIORITY[bCode]
        : Number.POSITIVE_INFINITY;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aOrder = currencyOrderIndex.get(aCode) ?? Number.POSITIVE_INFINITY;
      const bOrder = currencyOrderIndex.get(bCode) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return aCode.localeCompare(bCode);
    });
  }, [allocatedRlusdByCurrency, currencyLines, currencyOrderIndex, displayTokens]);

  const walletCurrencyOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").trim().toUpperCase();
      if (code === "XRP" || code === "USD") return;
      if (!code || seen.has(code)) return;
      seen.add(code);
      list.push(code);
    });
    return list;
  }, [augmentedTokens]);

  const swapCurrencyOptions = useMemo(() => {
    const candidates = new Set();
    (walletCurrencyOptions || []).forEach((code) => {
      const upper = String(code || "").toUpperCase();
      if (upper) candidates.add(upper);
    });
    candidates.add("RLUSD");
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").trim().toUpperCase();
      if (code && code !== "USD") candidates.add(code);
    });
    candidates.delete("USD");

    const weight = (code) => {
      if (code === "RLUSD") return 0;
      return 3;
    };

    return Array.from(candidates).sort((a, b) => {
      const wa = weight(a);
      const wb = weight(b);
      if (wa !== wb) return wa - wb;
      return a.localeCompare(b);
    });
  }, [walletCurrencyOptions, currencyLines]);

  return {
    augmentedTokens,
    walletCurrencyOptions,
    allocatedRlusdByCurrency,
    swapCurrencyOptions,
  };
}
