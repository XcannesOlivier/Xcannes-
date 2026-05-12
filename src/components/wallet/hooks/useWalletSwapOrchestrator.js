import { useEffect, useMemo, useState } from "react";
import { useSwapConversion } from "./useSwapConversion";
import { normalizeCurrencyCode } from "../utils/normalizeCurrencyCode";

/**
 * useWalletSwapOrchestrator — Groups all swap / convert / cash state,
 * guard effects, and the swap-conversion hook into a single orchestrator.
 */
export function useWalletSwapOrchestrator({
  isConnected,
  backendWalletAddress,
  wallet,
  signTransaction,
  refreshBalance,
  hasOnChainRlusd,
  swapCurrencyOptions,
  currencyLinesSummary,
  allocatedRlusdByCurrency,
  refreshCurrencyLines,
  toast,
}) {
  // ── View state ─────────────────────────────────────────────
  const [swapDefaultView, setSwapDefaultView] = useState("convert");
  const [swapLockedView, setSwapLockedView] = useState(null);

  // ── Cash (MoonPay) state ───────────────────────────────────
  const [cashBuyPrefill, setCashBuyPrefill] = useState(null);
  const [cashModalTab, setCashModalTab] = useState("buy");
  const [cashSellSelectTitleOverride, setCashSellSelectTitleOverride] =
    useState("");
  const [cashSellDestinationMode, setCashSellDestinationMode] = useState("");

  // ── Convert form ───────────────────────────────────────────
  const [convertBaseCurrency, setConvertBaseCurrency] = useState("USD");
  const [convertQuoteCurrency, setConvertQuoteCurrency] = useState("EUR");
  const [convertAmount, setConvertAmount] = useState("");
  const [convertProcessing, setConvertProcessing] = useState(false);

  const resetSwapForm = () => {
    setSwapDefaultView("convert");
    setSwapLockedView(null);
    setConvertBaseCurrency("USD");
    setConvertQuoteCurrency("EUR");
    setConvertAmount("");
    setConvertProcessing(false);
  };

  const resetCashForm = () => {
    setCashBuyPrefill(null);
    setCashModalTab("buy");
    setCashSellSelectTitleOverride("");
    setCashSellDestinationMode("");
  };

  // Guard: prevent XRP/RLUSD in convert selectors.
  useEffect(() => {
    const baseUpper = normalizeCurrencyCode(convertBaseCurrency);
    const quoteUpper = normalizeCurrencyCode(convertQuoteCurrency);
    if (baseUpper === "XRP" || baseUpper === "RLUSD") {
      setConvertBaseCurrency("USD");
    }
    if (quoteUpper === "XRP" || quoteUpper === "RLUSD") {
      setConvertQuoteCurrency("USD");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convertBaseCurrency, convertQuoteCurrency]);

  // ── Swap currency options for modal ────────────────────────
  const swapCurrencyOptionsForModal = useMemo(() => {
    const candidates = new Set(
      (swapCurrencyOptions || [])
        .map((c) => normalizeCurrencyCode(c))
        .filter(Boolean),
    );
    if (convertBaseCurrency)
      candidates.add(normalizeCurrencyCode(convertBaseCurrency));
    if (convertQuoteCurrency)
      candidates.add(normalizeCurrencyCode(convertQuoteCurrency));

    const weight = (code) => {
      if (code === "USD") return 0;
      return 3;
    };

    return Array.from(candidates).sort((a, b) => {
      const wa = weight(a);
      const wb = weight(b);
      if (wa !== wb) return wa - wb;
      return a.localeCompare(b);
    });
  }, [convertBaseCurrency, convertQuoteCurrency, swapCurrencyOptions]);

  // ── Swap conversion engine ─────────────────────────────────
  const { handleDemoConvert } = useSwapConversion({
    isPreviewMode: false,
    isConnected,
    backendWalletAddress,
    walletAddress: wallet,
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
    currencyLinesSummary,
    allocatedRlusdByCurrency,
    refreshCurrencyLines,
    toast,
  });

  return {
    // View
    swapDefaultView,
    setSwapDefaultView,
    swapLockedView,
    setSwapLockedView,
    // Cash
    cashBuyPrefill,
    setCashBuyPrefill,
    cashModalTab,
    setCashModalTab,
    cashSellSelectTitleOverride,
    setCashSellSelectTitleOverride,
    cashSellDestinationMode,
    setCashSellDestinationMode,
    // Convert form
    convertBaseCurrency,
    setConvertBaseCurrency,
    convertQuoteCurrency,
    setConvertQuoteCurrency,
    convertAmount,
    setConvertAmount,
    convertProcessing,
    handleDemoConvert,
    // Options
    swapCurrencyOptionsForModal,
    // Reset
    resetSwapForm,
    resetCashForm,
  };
}
