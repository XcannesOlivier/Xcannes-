"use client";

import { useMemo } from "react";

export function useWalletTokens({ displayTokens, currencyLines }) {
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

    return withAllocations;
  }, [allocatedRlusdByCurrency, currencyLines, displayTokens]);

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
