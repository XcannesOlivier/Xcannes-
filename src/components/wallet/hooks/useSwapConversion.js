"use client";

import { useCallback, useEffect } from "react";
import { buildRlusdPaymentTxjson, computeSpreadQuote, isFxConversion, XCANNES_SPREAD_WALLET_ADDRESS } from "@/utils/walletSpread";

export function useSwapConversion({
  isPreviewMode,
  effectiveIsConnected,
  backendWalletAddress,
  walletAddress,
  signTransaction,
  refreshBalance,
  hasOnChainRlusd,
  spreadDestination,
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
  refreshCurrencyLines,
  getAllMarkets,
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
      if (code === "XRP" || code === "XCS") return "XRPL";

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

  const paySpreadRlusd = useCallback(
    async (amountRlusd) => {
      const destination = String(spreadDestination || XCANNES_SPREAD_WALLET_ADDRESS).trim();
      if (!destination) {
        throw new Error("Missing spread destination address");
      }
      if (!walletAddress || !signTransaction) {
        throw new Error("Wallet not connected");
      }
      if (!hasOnChainRlusd) {
        throw new Error("RLUSD trustline is not installed yet");
      }

      const txjson = buildRlusdPaymentTxjson({
        account: walletAddress,
        destination,
        amountRlusd,
      });
      if (!txjson) throw new Error("Invalid RLUSD spread payment");

      const result = await signTransaction(txjson);
      if (!result?.signed) {
        throw new Error("Spread payment cancelled or expired");
      }

      // Best effort refresh
      if (refreshBalance) setTimeout(() => refreshBalance(), 2000);
      if (refreshCurrencyLines) setTimeout(() => refreshCurrencyLines(), 2500);

      return result;
    },
    [hasOnChainRlusd, refreshBalance, refreshCurrencyLines, signTransaction, spreadDestination, walletAddress]
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
        const spreadFee = spread?.spreadFeeRlusd || 0;
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

        const spreadLabel = spread?.isFx
          ? `, spread ${(Number(spread.spreadFraction) * 100).toFixed(2)}% (tier ${spread.tier})`
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
    let spreadPaid = false;
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
      const spreadFee = spread?.spreadFeeRlusd || 0;
      const netRlusd = Math.max(0, grossRlusd - spreadFee);
      const epsilon = 1e-9;

      if (base === "RLUSD") {
        const unallocated = Number(currencyLinesSummary?.unallocatedRlusd);
        // Must cover both the net allocation and the on-chain spread payment.
        if (Number.isFinite(unallocated) && unallocated + epsilon < grossRlusd) {
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

      const fxSourceFrom = await getFxSource(base);
      const fxSourceTo = await getFxSource(quote);

      if (isFxConversion(base, quote) && spreadFee > 0) {
        // Spread always gets paid on-chain first, then allocations are updated.
        // This prevents backend allocation changes if the user cancels the Xumm signature.
        const spreadSignature = await paySpreadRlusd(spreadFee);
        spreadPaid = true;
        const xummUuid = spreadSignature?.uuid || null;

        if (quote === "RLUSD") {
          // Sell FX -> RLUSD (unallocated). Gross deallocation includes the spread we just paid on-chain,
          // so the user ends up with net = gross - spread.
          const result = await convertCurrencyAllocation?.({
            fromCurrencyCode: base,
            toCurrencyCode: "RLUSD",
            amountRlusd: grossRlusd,
            fromFxRate: rlusdPerBase,
            fromFxSource: fxSourceFrom,
            toFxRate: 1,
            toFxSource: "PYTH",
            xummUuid,
          });
          if (!result || result.error) {
            throw new Error(result?.error || "Conversion failed");
          }
        } else if (base === "RLUSD") {
          // Buy FX with RLUSD: allocate net amount.
          const result = await convertCurrencyAllocation?.({
            fromCurrencyCode: "RLUSD",
            toCurrencyCode: quote,
            amountRlusd: netRlusd,
            fromFxRate: 1,
            fromFxSource: "PYTH",
            toFxRate: rlusdPerQuote,
            toFxSource: fxSourceTo,
            xummUuid,
          });
          if (!result || result.error) {
            throw new Error(result?.error || "Conversion failed");
          }
        } else {
          // FX -> FX: move net to quote, and remove spread from base (to RLUSD pool).
          const result1 = await convertCurrencyAllocation?.({
            fromCurrencyCode: base,
            toCurrencyCode: quote,
            amountRlusd: netRlusd,
            fromFxRate: rlusdPerBase,
            fromFxSource: fxSourceFrom,
            toFxRate: rlusdPerQuote,
            toFxSource: fxSourceTo,
            xummUuid,
          });
          if (!result1 || result1.error) {
            throw new Error(result1?.error || "Conversion failed");
          }
          const result2 = await convertCurrencyAllocation?.({
            fromCurrencyCode: base,
            toCurrencyCode: "RLUSD",
            amountRlusd: spreadFee,
            fromFxRate: rlusdPerBase,
            fromFxSource: fxSourceFrom,
            toFxRate: 1,
            toFxSource: "PYTH",
            xummUuid,
          });
          if (!result2 || result2.error) {
            throw new Error(result2?.error || "Conversion failed");
          }
        }
      } else {
        const result = await convertCurrencyAllocation?.({
          fromCurrencyCode: base,
          toCurrencyCode: quote,
          amountRlusd: grossRlusd,
          fromFxRate: rlusdPerBase,
          fromFxSource: fxSourceFrom,
          toFxRate: rlusdPerQuote,
          toFxSource: fxSourceTo,
        });

        if (!result || result.error) {
          throw new Error(result?.error || "Conversion failed");
        }
      }

      if (quote === "RLUSD") {
        const effectiveRlusd = isFxConversion(base, quote)
          ? Math.max(0, grossRlusd - spreadFee)
          : grossRlusd;
        const spreadLabel =
          isFxConversion(base, quote) && spreadFee > 0
            ? `, spread ${(Number(spread.spreadFraction) * 100).toFixed(2)}% (≈ ${spreadFee.toLocaleString(
                "en-US",
                { maximumFractionDigits: 6 }
              )} RLUSD)`
            : "";
        setConvertPreview(
          `Deallocated: ${amountBase.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} ${base} → ${effectiveRlusd.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} RLUSD (unallocated${spreadLabel})`
        );
      } else {
        const quoteUnits = (isFxConversion(base, quote) ? netRlusd : grossRlusd) / rlusdPerQuote;
        const spreadLabel =
          isFxConversion(base, quote) && spreadFee > 0
            ? `, spread ${(Number(spread.spreadFraction) * 100).toFixed(2)}% (≈ ${spreadFee.toLocaleString(
                "en-US",
                { maximumFractionDigits: 6 }
              )} RLUSD)`
            : "";
        setConvertPreview(
          `Allocation: ${amountBase.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} ${base} → ${quoteUnits.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} ${quote} (≈ ${grossRlusd.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} RLUSD${spreadLabel})`
        );
      }

      setConvertAmount("");
    } catch (error) {
      console.error("Convert error:", error);
      const message = error?.message || String(error);
      alert(
        spreadPaid
          ? `Conversion backend échouée après paiement du spread.\n\nDétail: ${message}`
          : "Conversion error: " + message
      );
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
    getFxSource,
    getRlusdPerUnit,
    isPreviewMode,
    paySpreadRlusd,
    setConvertAmount,
    setConvertPreview,
    setConvertProcessing,
    setDemoLines,
  ]);

  return { handleDemoConvert };
}
