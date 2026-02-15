"use client";

import { useCallback, useEffect } from "react";
import { buildXrplJsonMemo, buildConversionMemo } from "@/utils/xrplMemo";
import {
  buildRlusdPaymentTxjson,
  computeSpreadQuote,
  XCANNES_ACTIVATION_WALLET_ADDRESS
} from "@/utils/walletSpread";

export function useSwapConversion({
  isPreviewMode,
  effectiveIsConnected,
  backendWalletAddress,
  walletAddress,
  signTransaction,
  refreshBalance,
  hasOnChainRlusd,
  swapCurrencyOptions,
  convertBaseCurrency,
  convertQuoteCurrency,
  convertAmount,
  setConvertBaseCurrency,
  setConvertQuoteCurrency,
  setConvertAmount,
  setConvertPreview,
  setConvertProcessing,
  demoLines,
  setDemoLines,
  demoRlusdTotal,
  currencyLinesSummary,
  allocatedRlusdByCurrency,
  refreshCurrencyLines,
  getAllMarkets,
  getTicker,
  getFxEod,
}) {
  useEffect(() => {
    if (!swapCurrencyOptions?.length) return;
    const baseCandidate = swapCurrencyOptions.includes("RLUSD")
      ? "RLUSD"
      : swapCurrencyOptions.includes("XRP")
        ? "XRP"
        : swapCurrencyOptions[0];
    const effectiveBase = convertBaseCurrency || baseCandidate;
    if (!convertBaseCurrency) {
      setConvertBaseCurrency(baseCandidate);
    }
    if (!convertQuoteCurrency) {
      const preferredQuotes = ["RLUSD", "RLUSD", "USD", "USDT", "USDC"];
      const firstPreferred =
        preferredQuotes.find(
          (c) => swapCurrencyOptions.includes(c) && c !== effectiveBase
        ) ||
        preferredQuotes.find((c) => swapCurrencyOptions.includes(c));
      const fromWallet =
        firstPreferred ||
        (swapCurrencyOptions.length > 1
          ? swapCurrencyOptions.find((c) => c !== effectiveBase) ||
            swapCurrencyOptions[0]
          : swapCurrencyOptions[0]);
      setConvertQuoteCurrency(fromWallet);
    }
  }, [
    swapCurrencyOptions,
    convertBaseCurrency,
    convertQuoteCurrency,
    setConvertBaseCurrency,
    setConvertQuoteCurrency,
  ]);

  const getRlusdPerUnit = useCallback(
    async (currencyCode) => {
      const code = String(currencyCode || "").toUpperCase();
      if (!code) return Number.NaN;
      if (code === "RLUSD") return 1;

      let pythPairsMap = null;
      try {
        const markets = await getAllMarkets?.();
        const pythPairs = Array.isArray(markets?.pyth) ? markets.pyth : [];
        const map = new Map();
        pythPairs.forEach((pair) => {
          const base = String(pair?.base || "").toUpperCase();
          const quote = String(pair?.quote || "").toUpperCase();
          if (!base || !quote) return;
          map.set(`${base}_${quote}`, pair);
        });
        pythPairsMap = map;
      } catch (_err) {
        // ignore, fallback below
      }

      const existing = demoLines?.[code];
      if (existing && Number(existing.units || 0) > 0) {
        const rlusd = Number(existing.rlusd || 0);
        const units = Number(existing.units || 0);
        if (rlusd > 0 && units > 0) {
          return rlusd / units;
        }
      }

      if (code === "RLUSD" || code === "XRP") {
        try {
          const pairSymbol = `${code}_RLUSD`;
          const ticker = await getTicker?.(pairSymbol);
          const lastPrice = ticker?.lastPrice ? Number(ticker.lastPrice) : Number.NaN;
          if (Number.isFinite(lastPrice) && lastPrice > 0) {
            return lastPrice;
          }
        } catch (error) {
          console.warn("getRlusdPerUnit XRPL error:", error);
        }
        return 1;
      }

      if (pythPairsMap) {
        try {
          const directKey = `${code}_USD`;
          const inverseKey = `USD_${code}`;
          const direct = pythPairsMap.get(directKey);
          const inverse = pythPairsMap.get(inverseKey);

          const extractTickerPrice = (ticker) => {
            const priceSource =
              ticker?.lastPrice ??
              ticker?.price ??
              ticker?.midPrice ??
              ticker?.bidPrice ??
              ticker?.askPrice;
            const price = Number(priceSource);
            return Number.isFinite(price) && price > 0 ? price : Number.NaN;
          };

          if (direct) {
            const ticker = await getTicker?.(direct.symbol || directKey);
            const price = extractTickerPrice(ticker);
            if (Number.isFinite(price) && price > 0) return price;
          }
          if (inverse) {
            const ticker = await getTicker?.(inverse.symbol || inverseKey);
            const price = extractTickerPrice(ticker);
            if (Number.isFinite(price) && price > 0) return 1 / price;
          }
        } catch (error) {
          console.warn("getRlusdPerUnit Pyth error:", error);
        }
      }

      try {
        const baseForFx = "USD";
        const fxResult = await getFxEod?.(baseForFx, code, 30);
        const candles = Array.isArray(fxResult?.candles) ? fxResult.candles : [];
        const last = candles[candles.length - 1];
        const close =
          last && last.close != null
            ? Number(last.close)
            : last && last.price != null
              ? Number(last.price)
              : Number.NaN;

        if (Number.isFinite(close) && close > 0) {
          return 1 / close;
        }
      } catch (error) {
        console.warn("getRlusdPerUnit FX error:", error);
      }

      return 1;
    },
    [demoLines, getAllMarkets, getFxEod, getTicker]
  );

  const getFxSource = useCallback(
    async (currencyCode) => {
      const code = String(currencyCode || "").toUpperCase();
      if (!code) return null;
      if (code === "RLUSD" || code === "USD") return "PYTH";
      if (code === "XRP" || code === "RLUSD") return "XRPL";

      try {
        const markets = await getAllMarkets?.();
        const pythPairs = Array.isArray(markets?.pyth) ? markets.pyth : [];
        const keys = new Set(
          pythPairs
            .map((p) => `${String(p?.base || "").toUpperCase()}_${String(p?.quote || "").toUpperCase()}`)
            .filter(Boolean)
        );
        const hasUsdPair = keys.has(`${code}_USD`) || keys.has(`USD_${code}`);
        return hasUsdPair ? "PYTH" : "FAWAZ";
      } catch (_err) {
        return "FAWAZ";
      }
    },
    [getAllMarkets]
  );

  const handleDemoConvert = useCallback(async () => {
    if (isPreviewMode) {
      const base = String(convertBaseCurrency || "").toUpperCase();
      const quote = String(convertQuoteCurrency || "").toUpperCase();
      const amountBase = Number(convertAmount || "0");

      if (!base || !quote || base === quote) {
        alert("Choisissez deux devises différentes.");
        return;
      }

      if (!Number.isFinite(amountBase) || amountBase <= 0) {
        alert("Entrez un montant valide dans la devise de base.");
        return;
      }

      const baseLine = demoLines?.[base] || (base === "RLUSD" ? demoLines?.RLUSD : null);

      if (!baseLine || !Number.isFinite(Number(baseLine.units || 0))) {
        alert("Aucun solde démo disponible dans la devise de base sélectionnée.");
        return;
      }

      const availableBaseUnits = Number(baseLine.units || 0);
      if (amountBase > availableBaseUnits + 1e-8) {
        alert(
          `Montant trop élevé. Solde disponible en ${base}: ${availableBaseUnits.toLocaleString(
            "en-US",
            { maximumFractionDigits: 4 }
          )}.`
        );
        return;
      }

      setConvertProcessing(true);
      try {
        const rlusdPerBase = await getRlusdPerUnit(base);
        const rlusdPerQuote = await getRlusdPerUnit(quote);

        if (
          !Number.isFinite(rlusdPerBase) ||
          rlusdPerBase <= 0 ||
          !Number.isFinite(rlusdPerQuote) ||
          rlusdPerQuote <= 0
        ) {
          alert("Impossible de récupérer les taux de conversion pour cette paire.");
          return;
        }

        const grossRlusd = amountBase * rlusdPerBase;
        const spread = computeSpreadQuote({ base, quote, amountRlusd: grossRlusd });
        const spreadFee = Number(spread?.spreadFeeRlusd || 0);
        const netRlusd = Math.max(0, grossRlusd - spreadFee);
        const quoteUnits = netRlusd / rlusdPerQuote;

        const priceSource =
          base === "RLUSD"
            ? `1 RLUSD ≈ ${(1 / rlusdPerQuote).toLocaleString("en-US", {
                maximumFractionDigits: 4,
              })} ${quote}`
            : `Prix implicite via RLUSD (base=${base}, quote=${quote})`;

        setDemoLines((prev) => {
          const next = { ...prev };
          const baseLineNext =
            next[base] ||
            (base === "RLUSD"
              ? next.RLUSD || {
                  currency: "RLUSD",
                  rlusd: demoRlusdTotal,
                  units: demoRlusdTotal,
                  rate: 1,
                }
              : null);

          if (!baseLineNext) {
            return next;
          }

          const quoteLine = next[quote] || {
            currency: quote,
            rlusd: 0,
            units: 0,
            rate: 0,
          };

          const newBaseRlusd = Math.max(0, Number(baseLineNext.rlusd || 0) - grossRlusd);
          const newBaseUnits = Math.max(0, Number(baseLineNext.units || 0) - amountBase);

          next[base] = {
            ...baseLineNext,
            rlusd: newBaseRlusd,
            units: newBaseUnits,
            rate:
              newBaseRlusd > 0 && newBaseUnits > 0
                ? newBaseUnits / newBaseRlusd
                : base === "RLUSD"
                  ? 1
                  : baseLineNext.rate || 0,
          };

          next[quote] = {
            ...quoteLine,
            rlusd: Number(quoteLine.rlusd || 0) + netRlusd,
            units: Number(quoteLine.units || 0) + quoteUnits,
            rate:
              Number(quoteLine.rlusd || 0) + netRlusd > 0 &&
              Number(quoteLine.units || 0) + quoteUnits > 0
                ? (Number(quoteLine.units || 0) + quoteUnits) /
                  (Number(quoteLine.rlusd || 0) + netRlusd)
                : quoteLine.rate || 0,
          };

          return next;
        });

        const spreadLabel =
          spread?.isFx && spreadFee > 0
            ? `, frais ${(Number(spread.spreadFraction) * 100).toFixed(2)}% (≈ ${spreadFee.toLocaleString(
                "en-US",
                { maximumFractionDigits: 6 }
              )} RLUSD)`
            : "";
        setConvertPreview(
          `Démo: ${amountBase.toLocaleString("en-US", {
            maximumFractionDigits: 4,
          })} ${base} ≈ ${quoteUnits.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })} ${quote}${spreadLabel} (${priceSource})`
        );
        setConvertAmount("");
      } catch (error) {
        console.error("Demo convert error:", error);
        alert("Erreur lors de la conversion démo: " + (error?.message || String(error)));
      } finally {
        setConvertProcessing(false);
      }

      return;
    }

    if (!effectiveIsConnected || !backendWalletAddress) {
      alert("Please connect your Xumm wallet first.");
      return;
    }
    if (!walletAddress || !signTransaction) {
      alert("Please connect your Xumm wallet first.");
      return;
    }
    if (!hasOnChainRlusd) {
      alert("RLUSD trustline is not installed yet.");
      return;
    }

    const base = String(convertBaseCurrency || "").toUpperCase();
    const quote = String(convertQuoteCurrency || "").toUpperCase();
    const amountBase = Number(convertAmount || "0");

    if (!base || !quote || base === quote) {
      alert("Choisissez deux devises différentes.");
      return;
    }

    if (!Number.isFinite(amountBase) || amountBase <= 0) {
      alert("Entrez un montant valide dans la devise de base.");
      return;
    }

    setConvertProcessing(true);
    try {
      const rlusdPerBase = await getRlusdPerUnit(base);
      const rlusdPerQuote = quote === "RLUSD" ? 1 : await getRlusdPerUnit(quote);

      if (
        !Number.isFinite(rlusdPerBase) ||
        rlusdPerBase <= 0 ||
        !Number.isFinite(rlusdPerQuote) ||
        rlusdPerQuote <= 0
      ) {
        alert("Impossible de récupérer les taux de conversion pour cette paire.");
        return;
      }

      const grossRlusd = amountBase * rlusdPerBase;
      const spread = computeSpreadQuote({ base, quote, amountRlusd: grossRlusd });
      const spreadFee = Number(spread?.spreadFeeRlusd || 0);
      const netRlusd = Math.max(0, grossRlusd - spreadFee);
      const amountQuote = netRlusd / rlusdPerQuote;
      const epsilon = 1e-9;

      const unallocated = Number(currencyLinesSummary?.unallocatedRlusd);
      if (base === "RLUSD") {
        if (Number.isFinite(unallocated) && unallocated + epsilon < grossRlusd) {
          alert(
            `Insufficient unallocated RLUSD. Available: ${unallocated.toLocaleString(
              "en-US",
              { maximumFractionDigits: 6 }
            )} RLUSD.`
          );
          return;
        }
      }

      if (base !== "RLUSD") {
        const availableAllocated = allocatedRlusdByCurrency?.get(base) || 0;
        if (availableAllocated + epsilon < grossRlusd) {
          const maxUnits = availableAllocated > 0 ? availableAllocated / rlusdPerBase : 0;
          alert(
            `Montant trop élevé. Allocation disponible en ${base}: ${maxUnits.toLocaleString(
              "en-US",
              { maximumFractionDigits: 6 }
            )} ${base} (≈ ${availableAllocated.toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })} RLUSD).`
          );
          return;
        }
      }

      const fxSource = await getFxSource(base);
      const destination = String(XCANNES_ACTIVATION_WALLET_ADDRESS || "").trim();
      if (!destination) {
        throw new Error("Missing activation wallet address");
      }

      if (!Number.isFinite(netRlusd) || netRlusd <= 0) {
        alert("Montant trop faible après frais.");
        return;
      }
      if (!Number.isFinite(spreadFee) || spreadFee <= 0) {
        alert("Frais de conversion invalides.");
        return;
      }

      const lineStates = [];
      const baseAllocated = allocatedRlusdByCurrency?.get(base);
      const quoteAllocated = allocatedRlusdByCurrency?.get(quote);
      if (base !== "RLUSD" && Number.isFinite(baseAllocated)) {
        const after = Math.max(0, Number(baseAllocated) - grossRlusd);
        lineStates.push({ currencyCode: base, allocatedRlusdAfter: after });
      }
      if (quote !== "RLUSD" && Number.isFinite(quoteAllocated)) {
        const after = Math.max(0, Number(quoteAllocated) + netRlusd);
        lineStates.push({ currencyCode: quote, allocatedRlusdAfter: after });
      }

      const memoPayload = buildConversionMemo({
        base,
        quote,
        amountBase,
        amountQuote,
        amountRlusd: netRlusd,
        amountRlusdGross: grossRlusd,
        fxRate: rlusdPerBase,
        fxSource: fxSource || null,
        spreadRlusd: spreadFee > 0 ? spreadFee : null,
        spreadTier: spread?.tier || null,
        lineStates: lineStates.length > 0 ? lineStates : null,
      });
      if (!memoPayload) {
        throw new Error("Invalid conversion memo payload");
      }

      const txjson = buildRlusdPaymentTxjson({
        account: walletAddress,
        destination,
        amountRlusd: spreadFee,
      });
      if (!txjson) {
        throw new Error("Invalid RLUSD fee payment");
      }

      const memos = buildXrplJsonMemo(memoPayload);
      if (!memos) {
        throw new Error("Invalid conversion memo");
      }
      txjson.Memos = memos;

      const result = await signTransaction(txjson, {
        action: "wallet:convert",
      });
      if (!result?.signed) {
        alert("Conversion cancelled or expired.");
        return;
      }

      const spreadLabel =
        spread?.isFx && spreadFee > 0
          ? `, frais ${(Number(spread.spreadFraction) * 100).toFixed(2)}% (≈ ${spreadFee.toLocaleString(
              "en-US",
              { maximumFractionDigits: 6 }
            )} RLUSD)`
          : "";
      setConvertPreview(
        `Conversion envoyée: ${amountBase.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })} ${base} → ${amountQuote.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })} ${quote} (≈ ${netRlusd.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })} RLUSD${spreadLabel})`
      );

      setConvertAmount("");
      if (refreshBalance) setTimeout(() => refreshBalance(), 2000);
      if (refreshCurrencyLines) setTimeout(() => refreshCurrencyLines(), 2500);
    } catch (error) {
      console.error("Convert error:", error);
      const message = error?.message || String(error);
      alert("Conversion error: " + message);
    } finally {
      setConvertProcessing(false);
    }
  }, [
    allocatedRlusdByCurrency,
    backendWalletAddress,
    convertAmount,
    convertBaseCurrency,
    convertQuoteCurrency,
    currencyLinesSummary,
    demoLines,
    demoRlusdTotal,
    effectiveIsConnected,
    getFxSource,
    getRlusdPerUnit,
    hasOnChainRlusd,
    isPreviewMode,
    refreshBalance,
    refreshCurrencyLines,
    setConvertAmount,
    setConvertPreview,
    setConvertProcessing,
    setDemoLines,
    signTransaction,
    walletAddress,
  ]);

  return { handleDemoConvert };
}
