import { useEffect, useMemo, useState } from "react";
import { useSwapConversion } from "./useSwapConversion";

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
}) {
  // ── View state ─────────────────────────────────────────────
  const [swapDefaultView, setSwapDefaultView] = useState("convert");
  const [swapLockedView, setSwapLockedView] = useState(null);

  // ── Cash (MoonPay) state ───────────────────────────────────
  const [cashBuyPrefill, setCashBuyPrefill] = useState(null);
  const [cashModalTab, setCashModalTab] = useState("buy");

  // ── Convert form ───────────────────────────────────────────
  const [convertBaseCurrency, setConvertBaseCurrency] = useState("USD");
  const [convertQuoteCurrency, setConvertQuoteCurrency] = useState("EUR");
  const [convertAmount, setConvertAmount] = useState("");
  const [convertPreview, setConvertPreview] = useState("");
  const [convertProcessing, setConvertProcessing] = useState(false);

  // Guard: prevent XRP/RLUSD in convert selectors.
  useEffect(() => {
    const baseUpper = String(convertBaseCurrency || "")
      .trim()
      .toUpperCase();
    const quoteUpper = String(convertQuoteCurrency || "")
      .trim()
      .toUpperCase();
    if (baseUpper === "XRP" || baseUpper === "RLUSD") {
      setConvertBaseCurrency("USD");
    }
    if (quoteUpper === "XRP" || quoteUpper === "RLUSD") {
      setConvertQuoteCurrency("USD");
    }
  }, [
    convertBaseCurrency,
    convertQuoteCurrency,
    setConvertBaseCurrency,
    setConvertQuoteCurrency,
  ]);

  // ── Swap currency options for modal ────────────────────────
  const swapCurrencyOptionsForModal = useMemo(() => {
    const candidates = new Set(
      (swapCurrencyOptions || [])
        .map((c) => String(c || "").toUpperCase())
        .filter(Boolean),
    );
    if (convertBaseCurrency)
      candidates.add(String(convertBaseCurrency || "").toUpperCase());
    if (convertQuoteCurrency)
      candidates.add(String(convertQuoteCurrency || "").toUpperCase());

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
    setConvertPreview,
    setConvertProcessing,
    currencyLinesSummary,
    allocatedRlusdByCurrency,
    refreshCurrencyLines,
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
    // Convert form
    convertBaseCurrency,
    setConvertBaseCurrency,
    convertQuoteCurrency,
    setConvertQuoteCurrency,
    convertAmount,
    setConvertAmount,
    convertPreview,
    convertProcessing,
    handleDemoConvert,
    // Options
    swapCurrencyOptionsForModal,
  };
}
