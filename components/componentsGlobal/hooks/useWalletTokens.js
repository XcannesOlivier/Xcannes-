"use client";

import { useMemo } from "react";

export function useWalletTokens({ displayTokens, walletLines, currencyLines }) {
  const augmentedTokens = useMemo(() => {
    const byCurrency = new Map();
    (displayTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      if (!byCurrency.has(code)) {
        byCurrency.set(code, { ...token, currency: code });
      }
    });

    (walletLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (!code || byCurrency.has(code)) return;
      byCurrency.set(code, {
        key: `TL:${code}`,
        currency: code,
        issuer: "Trustline",
        value: 0,
        isTrustlineOnly: true,
      });
    });

    return Array.from(byCurrency.values());
  }, [displayTokens, walletLines]);

  const walletCurrencyOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code || seen.has(code)) return;
      seen.add(code);
      list.push(code);
    });
    return list;
  }, [augmentedTokens]);

  const allocatedRlusdByCurrency = useMemo(() => {
    const map = new Map();
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (!code) return;
      const allocated = Number.parseFloat(line?.allocatedRlusd ?? 0);
      map.set(code, Number.isFinite(allocated) ? allocated : 0);
    });
    return map;
  }, [currencyLines]);

  const swapCurrencyOptions = useMemo(() => {
    const candidates = new Set();
    (walletCurrencyOptions || []).forEach((code) => {
      const upper = String(code || "").toUpperCase();
      if (upper) candidates.add(upper);
    });
    candidates.add("RLUSD");
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (code) candidates.add(code);
    });

    const weight = (code) => {
      if (code === "RLUSD") return 0;
      if (code === "XRP") return 1;
      if (code === "XCS") return 2;
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

