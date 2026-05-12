import { useCallback, useEffect } from "react";
import xcannesApi from "@/lib/xcannesApi";
import { buildXrplJsonMemo, buildConversionMemo } from "@/utils/xrplMemo";
import {
  buildRlusdPaymentTxjson,
  computeSpreadQuote,
  XCANNES_ACTIVATION_WALLET_ADDRESS,
} from "@/utils/walletSpread";

const RLUSD_USD_RATE = 1;
const EPSILON = 1e-9;

export function useSwapConversion({
  isPreviewMode,
  isConnected,
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
  setConvertProcessing,
  demoLines,
  setDemoLines,
  demoRlusdTotal,
  currencyLinesSummary,
  allocatedRlusdByCurrency,
  refreshCurrencyLines,
  onDemoConvert,
  toast,
}) {
  useEffect(() => {
    if (!swapCurrencyOptions?.length) return;
    const baseCandidate = swapCurrencyOptions.includes("USD")
      ? "USD"
      : swapCurrencyOptions[0];
    const effectiveBase = convertBaseCurrency || baseCandidate;
    if (!convertBaseCurrency) {
      setConvertBaseCurrency(baseCandidate);
    }
    if (!convertQuoteCurrency) {
      const preferredQuotes = ["USD", "EUR", "GBP", "CHF"];
      const firstPreferred =
        preferredQuotes.find(
          (c) => swapCurrencyOptions.includes(c) && c !== effectiveBase,
        ) || preferredQuotes.find((c) => swapCurrencyOptions.includes(c));
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
      if (code === "RLUSD" || code === "USD") return RLUSD_USD_RATE;

      const existing = demoLines?.[code];
      if (existing && Number(existing.units || 0) > 0) {
        const rlusd = Number(existing.rlusd || 0);
        const units = Number(existing.units || 0);
        if (rlusd > 0 && units > 0) {
          return rlusd / units;
        }
      }

      try {
        const fxData = await xcannesApi.getFxRate("USD", code);
        const rate = Number(fxData?.rate);

        if (Number.isFinite(rate) && rate > 0) {
          return 1 / rate;
        }
      } catch (error) {
        console.warn("getRlusdPerUnit FX error:", error);
      }

      return RLUSD_USD_RATE;
    },
    [demoLines],
  );

  const handleDemoConvert = useCallback(async () => {
    if (isPreviewMode) {
      const base = String(convertBaseCurrency || "").toUpperCase();
      const quote = String(convertQuoteCurrency || "").toUpperCase();
      const amountBase = Number(convertAmount || "0");

      if (!base || !quote || base === quote) {
        toast?.error("Please select two different currencies.");
        return;
      }

      if (!Number.isFinite(amountBase) || amountBase <= 0) {
        toast?.error("Please enter a valid amount.");
        return;
      }

      const baseLine =
        demoLines?.[base] || (base === "RLUSD" ? demoLines?.RLUSD : null);

      if (!baseLine || !Number.isFinite(Number(baseLine.units || 0))) {
        toast?.error("No demo balance available for the selected currency.");
        return;
      }

      const availableBaseUnits = Number(baseLine.units || 0);
      if (amountBase > availableBaseUnits + 1e-8) {
        toast?.error(
          `Amount too high. Available ${base}: ${availableBaseUnits.toLocaleString("en-US", { maximumFractionDigits: 2 })}.`,
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
          toast?.error("Unable to fetch conversion rates for this pair.");
          return;
        }

        const grossRlusd = amountBase * rlusdPerBase;
        const spread = computeSpreadQuote({
          base,
          quote,
          amountRlusd: grossRlusd,
        });
        const spreadFee = Number(spread?.spreadFeeRlusd || 0);
        const netRlusd = Math.max(0, grossRlusd - spreadFee);
        const quoteUnits = netRlusd / rlusdPerQuote;

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

          const newBaseRlusd = Math.max(
            0,
            Number(baseLineNext.rlusd || 0) - grossRlusd,
          );
          const newBaseUnits = Math.max(
            0,
            Number(baseLineNext.units || 0) - amountBase,
          );

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

        onDemoConvert?.({
          base,
          quote,
          amountBase,
          amountQuote: quoteUnits,
          amountRlusdGross: grossRlusd,
          amountRlusdNet: netRlusd,
          spreadFeeRlusd: spreadFee,
          ts: Date.now(),
        });

        setConvertAmount("");
      } catch (error) {
        console.error("Demo convert error:", error);
        toast?.error("Demo conversion error: " + (error?.message || String(error)));
      } finally {
        setConvertProcessing(false);
      }

      return;
    }

    if (!isConnected || !backendWalletAddress) {
      toast?.error("Please connect your wallet first.");
      return;
    }
    if (!walletAddress || !signTransaction) {
      toast?.error("Please connect your wallet first.");
      return;
    }
    if (!hasOnChainRlusd) {
      toast?.error("RLUSD trustline is not installed yet.");
      return;
    }

    const base = String(convertBaseCurrency || "").toUpperCase();
    const quote = String(convertQuoteCurrency || "").toUpperCase();
    const amountBase = Number(convertAmount || "0");

    if (!base || !quote || base === quote) {
      toast?.error("Please select two different currencies.");
      return;
    }

    if (!Number.isFinite(amountBase) || amountBase <= 0) {
      toast?.error("Please enter a valid amount.");
      return;
    }

    setConvertProcessing(true);
    try {
      const rlusdPerBase = await getRlusdPerUnit(base);
      const rlusdPerQuote =
        quote === "RLUSD" ? RLUSD_USD_RATE : await getRlusdPerUnit(quote);

      if (
        !Number.isFinite(rlusdPerBase) ||
        rlusdPerBase <= 0 ||
        !Number.isFinite(rlusdPerQuote) ||
        rlusdPerQuote <= 0
      ) {
        toast?.error("Unable to fetch conversion rates for this pair.");
        return;
      }

      const grossRlusd = amountBase * rlusdPerBase;
      const spread = computeSpreadQuote({
        base,
        quote,
        amountRlusd: grossRlusd,
      });
      const spreadFee = Number(spread?.spreadFeeRlusd || 0);
      const netRlusd = Math.max(0, grossRlusd - spreadFee);
      const amountQuote = netRlusd / rlusdPerQuote;
      const unallocated = Number(currencyLinesSummary?.unallocatedRlusd);
      if (base === "RLUSD") {
        if (
          Number.isFinite(unallocated) &&
          unallocated + EPSILON < grossRlusd
        ) {
          toast?.error(
            `Insufficient unallocated RLUSD. Available: ${unallocated.toLocaleString("en-US", { maximumFractionDigits: 2 })} RLUSD.`,
          );
          return;
        }
      }

      if (base !== "RLUSD") {
        const availableAllocated = allocatedRlusdByCurrency?.get(base) || 0;
        if (availableAllocated + EPSILON < grossRlusd) {
          const maxUnits =
            availableAllocated > 0 ? availableAllocated / rlusdPerBase : 0;
          toast?.error(
            `Amount too high. Available ${base}: ${maxUnits.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${base} (≈ ${availableAllocated.toLocaleString("en-US", { maximumFractionDigits: 2 })} RLUSD).`,
          );
          return;
        }
      }

      const fxSource = "FAWAZ";
      const destination = String(
        XCANNES_ACTIVATION_WALLET_ADDRESS || "",
      ).trim();
      if (!destination) {
        throw new Error("Missing activation wallet address");
      }

      if (!Number.isFinite(netRlusd) || netRlusd <= 0) {
        toast?.error("Amount too small after fees.");
        return;
      }
      if (!Number.isFinite(spreadFee) || spreadFee <= 0) {
        toast?.error("Invalid conversion fees.");
        return;
      }

      // 🆕 Construction de lineStates : inclut les lignes existantes ET les nouvelles
      const lineStates = [];
      const baseAllocated = allocatedRlusdByCurrency?.get(base);
      const quoteAllocated = allocatedRlusdByCurrency?.get(quote);

      // Base currency (source de la conversion)
      if (base !== "RLUSD") {
        if (Number.isFinite(baseAllocated)) {
          // Ligne existante : débit
          const after = Math.max(0, Number(baseAllocated) - grossRlusd);
          lineStates.push({ currencyCode: base, allocatedRlusdAfter: after });
        } else {
          // 🆕 Nouvelle ligne : activation automatique avec allocation 0 (car débit complet)
          lineStates.push({ currencyCode: base, allocatedRlusdAfter: 0 });
        }
      }

      // Quote currency (destination de la conversion)
      if (quote !== "RLUSD") {
        if (Number.isFinite(quoteAllocated)) {
          // Ligne existante : crédit
          const after = Math.max(0, Number(quoteAllocated) + netRlusd);
          lineStates.push({ currencyCode: quote, allocatedRlusdAfter: after });
        } else {
          // 🆕 Nouvelle ligne : activation automatique avec allocation du montant converti
          lineStates.push({
            currencyCode: quote,
            allocatedRlusdAfter: netRlusd,
          });
        }
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
        progressDetails: {
          fromLabel: `${amountBase.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })} ${base}`,
          toLabel: `${amountQuote.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })} ${quote}`,
          feeLabel:
            Number.isFinite(spreadFee) && spreadFee > 0
              ? `${spreadFee.toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })} RLUSD`
              : null,
        },
      });
      if (!result?.signed) {
        toast?.error("Conversion cancelled or expired.");
        return;
      }

      setConvertAmount("");
      if (refreshBalance) setTimeout(() => refreshBalance(), 10000);
      if (refreshCurrencyLines) setTimeout(() => refreshCurrencyLines({ bustCache: true }), 10000);
    } catch (error) {
      console.error("Convert error:", error);
      const message = error?.message || String(error);
      toast?.error("Conversion error: " + message);
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
    isConnected,
    getRlusdPerUnit,
    hasOnChainRlusd,
    isPreviewMode,
    refreshBalance,
    refreshCurrencyLines,
    onDemoConvert,
    setConvertAmount,
    setConvertProcessing,
    setDemoLines,
    signTransaction,
    toast,
    walletAddress,
  ]);

  return { handleDemoConvert };
}
