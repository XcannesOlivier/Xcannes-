"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSendForm } from "./useSendForm";
import { useSavedAddresses } from "./useSavedAddresses";
import { usePayreqStorage } from "./usePayreqStorage";
import { usePaymentRequestScanner } from "./usePaymentRequestScanner";
import { useSendTransaction } from "./useSendTransaction";

/**
 * useWalletSendOrchestrator — Groups all send / receive / payment-request
 * state, derived values, and handlers into a single hook.
 */
export function useWalletSendOrchestrator({
  wallet,
  isConnected,
  isDesktopPanel,
  backendWalletAddress,
  signTransaction,
  hasOnChainRlusd,
  augmentedTokens,
  selectableTokens,
  rlusdPerUnitRates,
  rlusdPerUnitSources,
  allocatedRlusdByCurrency,
  closeQrModal,
  toast,
  confirm,
  setActiveAction,
}) {
  const resolvedWalletAddress =
    typeof wallet === "string" ? wallet : wallet?.address || "";

  // ── Send form ──────────────────────────────────────────────
  const {
    sendTab,
    setSendTab,
    sendAssetKey,
    setSendAssetKey,
    sendDestination,
    setSendDestination,
    sendDestinationLabel,
    setSendDestinationLabel,
    sendAmount,
    setSendAmount,
    sendProcessing,
    setSendProcessing,
    sendPaymentRequest,
    setSendPaymentRequest,
    resetSendForm,
  } = useSendForm();

  // ── Saved addresses ────────────────────────────────────────
  const { savedAddresses, saveAddress } = useSavedAddresses({
    walletAddress: resolvedWalletAddress,
  });

  // ── Pending payment requests (local storage) ───────────────
  const { pendingPayreqs, savePayreq, removePayreq, pendingCount } =
    usePayreqStorage({ walletAddress: resolvedWalletAddress || null });

  const [showSaveAddressPrompt, setShowSaveAddressPrompt] = useState(false);
  const [addressToSave, setAddressToSave] = useState("");

  // ── Receive form ───────────────────────────────────────────
  const [receiveTab, setReceiveTab] = useState("receive");

  // ── Payment-request creation form ──────────────────────────
  const [requestAmount, setRequestAmount] = useState("");
  const [requestCurrency, setRequestCurrency] = useState("USD");
  const [requestMemo, setRequestMemo] = useState("");

  const resetReceiveForm = () => {
    setReceiveTab("receive");
    setRequestAmount("");
    setRequestCurrency("USD");
    setRequestMemo("");
  };

  // Guard: prevent XRP/RLUSD as payment-request currency.
  useEffect(() => {
    const upper = String(requestCurrency || "")
      .trim()
      .toUpperCase();
    if (upper === "XRP" || upper === "RLUSD") {
      setRequestCurrency("USD");
    }
  }, [requestCurrency, setRequestCurrency]);

  // ── Selected send token ────────────────────────────────────
  const selectedSendToken =
    selectableTokens.find((tok) => tok.key === sendAssetKey) ||
    selectableTokens[0] ||
    null;

  // ── Send FX info ───────────────────────────────────────────
  const sendFxInfo = useMemo(() => {
    const code = String(selectedSendToken?.currency || "").toUpperCase();
    if (!code) return null;
    if (code === "XRP" || code === "RLUSD" || code === "USD") return null;
    if (!selectedSendToken?.isTrustlineOnly) return null;

    const amountFx = Number.parseFloat(sendAmount || "0");
    if (!Number.isFinite(amountFx) || amountFx <= 0) return null;

    const rawRate = Number(rlusdPerUnitRates?.[code]);
    const rlusdPerUnit =
      Number.isFinite(rawRate) && rawRate > 0 ? rawRate : Number.NaN;
    if (!Number.isFinite(rlusdPerUnit) || rlusdPerUnit <= 0) return null;

    const paymentRlusd = amountFx * rlusdPerUnit;

    return {
      currency: code,
      fxSource: rlusdPerUnitSources?.[code] || null,
      rlusdPerUnit,
      amountFx,
      paymentRlusd,
    };
  }, [rlusdPerUnitRates, rlusdPerUnitSources, selectedSendToken, sendAmount]);

  // ── Pre-fill sendAmount from a payment request ─────────────
  useEffect(() => {
    if (!sendPaymentRequest || !selectedSendToken) return;
    const requestedRlusd = Number(sendPaymentRequest?.amountRlusd);
    if (!Number.isFinite(requestedRlusd) || requestedRlusd <= 0) return;

    const targetCurrency = String(sendPaymentRequest?.targetCurrencyCode || "")
      .trim()
      .toUpperCase();
    const selectedCurrency = String(
      selectedSendToken?.currency || "",
    ).toUpperCase();
    if (!selectedCurrency) return;

    const rawRate = Number(rlusdPerUnitRates?.[selectedCurrency]);
    const fallbackRate =
      Number.isFinite(rawRate) && rawRate > 0 ? rawRate : Number.NaN;

    let nextAmount = null;

    if (selectedCurrency === "RLUSD") {
      nextAmount = requestedRlusd;
    } else if (targetCurrency && selectedCurrency === targetCurrency) {
      const displayAmount = Number(sendPaymentRequest?.displayAmount);
      if (Number.isFinite(displayAmount) && displayAmount > 0) {
        nextAmount = displayAmount;
      } else {
        const requestedFxRate = Number(sendPaymentRequest?.fxRate);
        const rate =
          Number.isFinite(requestedFxRate) && requestedFxRate > 0
            ? requestedFxRate
            : fallbackRate;
        if (Number.isFinite(rate) && rate > 0) {
          nextAmount = requestedRlusd / rate;
        }
      }
    } else {
      if (Number.isFinite(fallbackRate) && fallbackRate > 0) {
        nextAmount = requestedRlusd / fallbackRate;
      }
    }

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return;

    const formatted = nextAmount.toFixed(6).replace(/\.?0+$/, "");
    setSendAmount(formatted);
  }, [rlusdPerUnitRates, sendPaymentRequest, selectedSendToken, setSendAmount]);

  // ── QR scanner ─────────────────────────────────────────────
  const {
    qrScannerOpen,
    setQrScannerOpen,
    handleAddressScan,
    handlePaymentRequestScan,
  } = usePaymentRequestScanner({
    augmentedTokens,
    setSendDestination,
    setSendDestinationLabel,
    setSendAmount,
    setSendAssetKey,
    setSendTab,
    setSendPaymentRequest,
    toast,
  });

  // ── Close inline QR (desktop) ──────────────────────────────
  const closeInlineQr = useCallback(() => {
    if (!isDesktopPanel) return;
    setQrScannerOpen(false);
    closeQrModal?.();
  }, [closeQrModal, isDesktopPanel, setQrScannerOpen]);

  // ── Resume a saved payment request ─────────────────────────
  const handleResumePayreq = useCallback(
    (entry) => {
      if (!entry?.payreq) return;
      const pr = entry.payreq;
      if (pr.to) setSendDestination(pr.to);
      setSendDestinationLabel("");
      const targetCurrency = String(pr.targetCurrencyCode || "").toUpperCase();
      const matchingToken = (augmentedTokens || []).find(
        (tok) => String(tok.currency || "").toUpperCase() === targetCurrency,
      );
      if (matchingToken) {
        setSendAssetKey(matchingToken.key);
        if (pr.displayAmount != null) setSendAmount(String(pr.displayAmount));
      } else if (pr.amountRlusd != null) {
        // Fallback: utiliser le montant RLUSD brut avec le premier token disponible.
        const fallbackToken = (augmentedTokens || [])[0];
        if (fallbackToken) setSendAssetKey(fallbackToken.key);
        setSendAmount(String(pr.amountRlusd));
      }
      setSendPaymentRequest(pr);
      setSendTab("manual");
      setActiveAction("send");
    },
    [
      augmentedTokens,
      setSendDestination,
      setSendDestinationLabel,
      setSendAssetKey,
      setSendAmount,
      setSendPaymentRequest,
      setSendTab,
      setActiveAction,
    ],
  );

  // ── Send transaction handler ───────────────────────────────
  const { handleSendSubmit } = useSendTransaction({
    isConnected,
    wallet,
    signTransaction,
    hasOnChainRlusd,
    backendWalletAddress,
    selectedSendToken,
    sendAmount,
    sendDestination,
    sendDestinationLabel,
    sendPaymentRequest,
    setSendProcessing,
    setSendAmount,
    setSendDestination,
    setSendPaymentRequest,
    savedAddresses,
    saveAddress,
    setActiveAction,
    setAddressToSave,
    setShowSaveAddressPrompt,
    isDesktopPanel,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    allocatedRlusdByCurrency,
    toast,
    confirm,
    removePayreq,
    pendingPayreqs,
  });

  return {
    // Send form
    sendTab,
    setSendAssetKey,
    sendDestination,
    setSendDestination,
    sendDestinationLabel,
    setSendDestinationLabel,
    sendAmount,
    setSendAmount,
    sendProcessing,
    sendPaymentRequest,
    setSendPaymentRequest,
    // Addresses
    savedAddresses,
    saveAddress,
    // Payment requests
    pendingPayreqs,
    savePayreq,
    removePayreq,
    pendingCount,
    showSaveAddressPrompt,
    setShowSaveAddressPrompt,
    addressToSave,
    setAddressToSave,
    // Receive
    receiveTab,
    setReceiveTab,
    // Request form
    requestAmount,
    setRequestAmount,
    requestCurrency,
    setRequestCurrency,
    requestMemo,
    setRequestMemo,
    // Derived
    selectedSendToken,
    sendFxInfo,
    hasPayreq: Boolean(sendPaymentRequest),
    // QR
    qrScannerOpen,
    setQrScannerOpen,
    handleAddressScan,
    handlePaymentRequestScan,
    // Handlers
    closeInlineQr,
    handleResumePayreq,
    handleSendSubmit,
    resetSendForm,
    resetReceiveForm,
  };
}
