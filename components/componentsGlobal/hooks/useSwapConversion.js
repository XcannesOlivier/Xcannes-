"use client";

import { useCallback, useEffect } from "react";

export function useSwapConversion({
  isPreviewMode,
  effectiveIsConnected,
  backendWalletAddress,
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
  convertCurrencyAllocation,
  getTicker,
  getFxEod,
}) {
  useEffect(() => {
    if (!swapCurrencyOptions?.length) return;
    if (!convertBaseCurrency) {
      const preferredBase = swapCurrencyOptions.includes("RLUSD")
        ? "RLUSD"
        : swapCurrencyOptions.includes("XRP")
          ? "XRP"
          : swapCurrencyOptions[0];
      setConvertBaseCurrency(preferredBase);
    }
    if (!convertQuoteCurrency) {
      const preferredQuotes = ["RLUSD", "USD", "USDT", "USDC"];
      const fromWallet =
        preferredQuotes.find((c) => swapCurrencyOptions.includes(c)) ||
        (swapCurrencyOptions.length > 1
          ? swapCurrencyOptions[1]
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

      const existing = demoLines?.[code];
      if (existing && Number(existing.units || 0) > 0) {
        const rlusd = Number(existing.rlusd || 0);
        const units = Number(existing.units || 0);
        if (rlusd > 0 && units > 0) {
          return rlusd / units;
        }
      }

      if (code === "XCS" || code === "XRP") {
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
    [demoLines, getTicker, getFxEod]
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

        const rlusdValue = amountBase * rlusdPerBase;
        const quoteUnits = rlusdValue / rlusdPerQuote;

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

          const newBaseRlusd = Math.max(0, Number(baseLineNext.rlusd || 0) - rlusdValue);
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
            rlusd: Number(quoteLine.rlusd || 0) + rlusdValue,
            units: Number(quoteLine.units || 0) + quoteUnits,
            rate:
              Number(quoteLine.rlusd || 0) + rlusdValue > 0 &&
              Number(quoteLine.units || 0) + quoteUnits > 0
                ? (Number(quoteLine.units || 0) + quoteUnits) /
                  (Number(quoteLine.rlusd || 0) + rlusdValue)
                : quoteLine.rate || 0,
          };

          return next;
        });

        setConvertPreview(
          `Démo: ${amountBase.toLocaleString("en-US", {
            maximumFractionDigits: 4,
          })} ${base} ≈ ${quoteUnits.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })} ${quote} (${priceSource})`
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

      const rlusdValue = amountBase * rlusdPerBase;
      const epsilon = 1e-9;

      if (base === "RLUSD") {
        const unallocated = Number(currencyLinesSummary?.unallocatedRlusd);
        if (Number.isFinite(unallocated) && unallocated + epsilon < rlusdValue) {
          alert(
            `Insufficient unallocated RLUSD. Available: ${unallocated.toLocaleString(
              "en-US",
              { maximumFractionDigits: 6 }
            )} RLUSD.`
          );
          return;
        }
      } else {
        const availableAllocated = allocatedRlusdByCurrency?.get(base) || 0;
        if (availableAllocated + epsilon < rlusdValue) {
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

      const result = await convertCurrencyAllocation?.({
        fromCurrencyCode: base,
        toCurrencyCode: quote,
        amountRlusd: rlusdValue,
        fromFxRate: rlusdPerBase,
        toFxRate: rlusdPerQuote,
      });

      if (!result || result.error) {
        throw new Error(result?.error || "Conversion failed");
      }

      if (quote === "RLUSD") {
        setConvertPreview(
          `Deallocated: ${amountBase.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} ${base} → ${rlusdValue.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} RLUSD (unallocated)`
        );
      } else {
        const quoteUnits = rlusdValue / rlusdPerQuote;
        setConvertPreview(
          `Allocation: ${amountBase.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} ${base} → ${quoteUnits.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} ${quote} (≈ ${rlusdValue.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} RLUSD)`
        );
      }

      setConvertAmount("");
    } catch (error) {
      console.error("Convert error:", error);
      alert("Conversion error: " + (error?.message || String(error)));
    } finally {
      setConvertProcessing(false);
    }
  }, [
    allocatedRlusdByCurrency,
    backendWalletAddress,
    convertAmount,
    convertBaseCurrency,
    convertCurrencyAllocation,
    convertQuoteCurrency,
    currencyLinesSummary,
    demoLines,
    demoRlusdTotal,
    effectiveIsConnected,
    getRlusdPerUnit,
    isPreviewMode,
    setConvertAmount,
    setConvertPreview,
    setConvertProcessing,
    setDemoLines,
  ]);

  return { handleDemoConvert };
}

