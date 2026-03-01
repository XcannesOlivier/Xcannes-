"use client";

import { useEffect, useMemo, useState } from "react";
import xcannesApi from "@/lib/xcannesApi";

export function useUsdTotalLabel({
  augmentedTokens,
  isPreviewMode,
  stableUsd,
  xrpAmount,
  demoTotalUsd,
  isStablecoin,
  cryptoIcons,
  getAllMarkets,
  getTicker,
  getFxEod,
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

    const getTickerPrice = (ticker) => {
      const priceSource =
        ticker?.lastPrice ??
        ticker?.price ??
        ticker?.midPrice ??
        ticker?.bidPrice ??
        ticker?.askPrice;
      const price = Number(priceSource);
      return Number.isFinite(price) && price > 0 ? price : NaN;
    };

    const resolveUsdRate = async (code, fawazSet) => {
      const upper = String(code || "").toUpperCase();
      if (!upper) return NaN;
      if (upper === "USD" || upper === "RLUSD") return 1;

      if (isStablecoin?.(upper)) return 1;

      if (
        (cryptoIcons && cryptoIcons[upper]) ||
        ["XRP", "RLUSD", "BTC", "ETH"].includes(upper)
      ) {
        try {
          const ticker = await getTicker?.(`${upper}_RLUSD`);
          const price = getTickerPrice(ticker);
          if (Number.isFinite(price)) return price;
        } catch (err) {
          console.warn("USD rate XRPL error:", err);
        }
        return NaN;
      }

      // Skip Fawaz si la devise n'est pas dans la liste supportée
      if (!fawazSet || !fawazSet.has(upper)) return NaN;

      try {
        const fxResult = await getFxEod?.("USD", upper, 30);
        const candles = Array.isArray(fxResult?.candles)
          ? fxResult.candles
          : [];
        const last = candles[candles.length - 1];
        const close =
          last && last.close != null
            ? Number(last.close)
            : last && last.price != null
              ? Number(last.price)
              : NaN;

        if (Number.isFinite(close) && close > 0) {
          return 1 / close;
        }
      } catch (err) {
        console.warn("USD rate Fawaz error:", err);
      }

      return NaN;
    };

    const loadUsdRates = async () => {
      if (!rateCodesKey) {
        setUsdRates({});
        return;
      }

      try {
        const fxCurrencies = getFxEod ? await xcannesApi.getFxCurrencies() : [];
        const fawazSet = new Set(
          (Array.isArray(fxCurrencies) ? fxCurrencies : [])
            .map((c) => String(c?.code || c || "").toUpperCase())
            .filter(Boolean),
        );

        const codes = rateCodesKey.split("|").filter(Boolean);
        const rates = {};
        await Promise.all(
          codes.map(async (code) => {
            rates[code] = await resolveUsdRate(code, fawazSet);
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
    cryptoIcons,
    getFxEod,
    getTicker,
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
