'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSendForm } from './useSendForm';
import { useSavedAddresses } from './useSavedAddresses';
import { usePayreqStorage } from './usePayreqStorage';
import { usePaymentRequestScanner } from './usePaymentRequestScanner';
import { useSendTransaction } from './useSendTransaction';

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
  const resolvedWalletAddress = typeof wallet === 'string' ? wallet : wallet?.address || '';

  // ── Send form ──────────────────────────────────────────────
  const {
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
  const { pendingPayreqs, savePayreq, removePayreq, pendingCount } = usePayreqStorage({
    walletAddress: resolvedWalletAddress || null,
  });

  const [showSaveAddressPrompt, setShowSaveAddressPrompt] = useState(false);
  const [addressToSave, setAddressToSave] = useState('');
  const [moonpaySellRequest, setMoonpaySellRequest] = useState(null);
  const activeMoonpaySourceCurrency = useMemo(() => {
    const sourceCurrency = String(moonpaySellRequest?.sourceCurrencyCode || '')
      .trim()
      .toUpperCase();
    const baseCurrency = String(moonpaySellRequest?.baseCurrencyCode || '')
      .trim()
      .toUpperCase();
    if (sourceCurrency && sourceCurrency !== baseCurrency) return sourceCurrency;
    return baseCurrency;
  }, [moonpaySellRequest]);

  // ── Receive form ───────────────────────────────────────────
  // "choice" | "share" | "request"
  const [receiveTab, setReceiveTab] = useState('choice');

  // ── Payment-request creation form ──────────────────────────
  const [requestAmount, setRequestAmount] = useState('');
  const [requestCurrency, setRequestCurrency] = useState('USD');
  const [requestMemo, setRequestMemo] = useState('');

  const resetReceiveForm = () => {
    setReceiveTab('choice');
    setRequestAmount('');
    setRequestCurrency('USD');
    setRequestMemo('');
  };

  // Guard: prevent XRP/RLUSD as payment-request currency.
  useEffect(() => {
    const upper = String(requestCurrency || '')
      .trim()
      .toUpperCase();
    if (upper === 'XRP' || upper === 'RLUSD') {
      setRequestCurrency('USD');
    }
  }, [requestCurrency, setRequestCurrency]);

  // ── Selected send token ────────────────────────────────────
  const selectedSendToken = useMemo(() => {
    const activeCurrency = activeMoonpaySourceCurrency;
    const activePool = moonpaySellRequest ? augmentedTokens : selectableTokens;
    const byKey = (activePool || []).find(tok => tok.key === sendAssetKey);
    if (byKey) return byKey;
    if (activeCurrency) {
      const byCurrency = (augmentedTokens || []).find(
        tok =>
          String(tok?.currency || '')
            .trim()
            .toUpperCase() === activeCurrency,
      );
      if (byCurrency) return byCurrency;
    }
    return (activePool || [])[0] || null;
  }, [activeMoonpaySourceCurrency, augmentedTokens, moonpaySellRequest, selectableTokens, sendAssetKey]);

  // ── Send FX info ───────────────────────────────────────────
  const sendFxInfo = useMemo(() => {
    const code = String(selectedSendToken?.currency || '').toUpperCase();
    if (!code) return null;
    if (code === 'XRP' || code === 'RLUSD' || code === 'USD') return null;
    if (!selectedSendToken?.isTrustlineOnly) return null;

    const amountFx = Number.parseFloat(sendAmount || '0');
    if (!Number.isFinite(amountFx) || amountFx <= 0) return null;

    const rawRate = Number(rlusdPerUnitRates?.[code]);
    const rlusdPerUnit = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : Number.NaN;
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

    const targetCurrency = String(sendPaymentRequest?.targetCurrencyCode || '')
      .trim()
      .toUpperCase();
    const selectedCurrency = String(selectedSendToken?.currency || '').toUpperCase();
    if (!selectedCurrency) return;

    const rawRate = Number(rlusdPerUnitRates?.[selectedCurrency]);
    const fallbackRate = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : Number.NaN;

    let nextAmount = null;

    if (selectedCurrency === 'RLUSD') {
      nextAmount = requestedRlusd;
    } else if (targetCurrency && selectedCurrency === targetCurrency) {
      const displayAmount = Number(sendPaymentRequest?.displayAmount);
      if (Number.isFinite(displayAmount) && displayAmount > 0) {
        nextAmount = displayAmount;
      } else {
        const requestedFxRate = Number(sendPaymentRequest?.fxRate);
        const rate = Number.isFinite(requestedFxRate) && requestedFxRate > 0 ? requestedFxRate : fallbackRate;
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

    const formatted = nextAmount.toFixed(6).replace(/\.?0+$/, '');
    setSendAmount(formatted);
  }, [rlusdPerUnitRates, sendPaymentRequest, selectedSendToken, setSendAmount]);

  // ── QR scanner ─────────────────────────────────────────────
  const { qrScannerOpen, setQrScannerOpen, handleAddressScan, handlePaymentRequestScan } = usePaymentRequestScanner({
    augmentedTokens,
    setSendDestination,
    setSendDestinationLabel,
    setSendAmount,
    setSendAssetKey,
    setSendPaymentRequest,
    toast,
  });

  // ── Close inline QR (desktop) ──────────────────────────────
  const closeInlineQr = useCallback(() => {
    if (!isDesktopPanel) return;
    setQrScannerOpen(false);
    closeQrModal?.();
  }, [closeQrModal, isDesktopPanel, setQrScannerOpen]);

  // ── Shared form-fill helper ────────────────────────────────
  const applyPaymentToSendForm = useCallback(
    ({ destination, label, assetKey, amount, paymentRequest }) => {
      if (destination !== undefined) setSendDestination(destination);
      if (label !== undefined) setSendDestinationLabel(label);
      if (assetKey !== undefined) setSendAssetKey(assetKey);
      if (amount !== undefined) setSendAmount(amount);
      setSendPaymentRequest(paymentRequest ?? null);
    },
    [setSendDestination, setSendDestinationLabel, setSendAssetKey, setSendAmount, setSendPaymentRequest],
  );

  // ── Resume a saved payment request ─────────────────────────
  const handleResumePayreq = useCallback(
    entry => {
      if (!entry?.payreq) return;
      const pr = entry.payreq;
      setMoonpaySellRequest(null);
      const targetCurrency = String(pr.targetCurrencyCode || '').toUpperCase();
      const matchingToken = (augmentedTokens || []).find(
        tok => String(tok.currency || '').toUpperCase() === targetCurrency,
      );
      let assetKey, amount;
      if (matchingToken) {
        assetKey = matchingToken.key;
        if (pr.displayAmount != null) amount = String(pr.displayAmount);
      } else if (pr.amountRlusd != null) {
        // Fallback: utiliser le montant RLUSD brut avec le premier token disponible.
        const fallbackToken = (augmentedTokens || [])[0];
        if (fallbackToken) assetKey = fallbackToken.key;
        amount = String(pr.amountRlusd);
      }
      applyPaymentToSendForm({ destination: pr.to || undefined, label: '', assetKey, amount, paymentRequest: pr });
      setActiveAction('send');
    },
    [augmentedTokens, applyPaymentToSendForm, setActiveAction],
  );

  const startMoonpaySellRequest = useCallback(
    request => {
      if (!request) return false;
      const baseCurrency = String(request?.baseCurrencyCode || '')
        .trim()
        .toUpperCase();
      const sourceCurrency = String(request?.sourceCurrencyCode || '')
        .trim()
        .toUpperCase();
      const currency = sourceCurrency && sourceCurrency !== baseCurrency ? sourceCurrency : baseCurrency;
      const destination = String(request?.depositWalletAddress || '').trim();
      const amount = String(
        sourceCurrency && sourceCurrency !== baseCurrency ? request?.sourceAmount : request?.baseCurrencyAmount,
      ).trim();
      if (!currency || !destination || !amount) return false;

      const matchingToken = (augmentedTokens || []).find(
        tok =>
          String(tok?.currency || '')
            .trim()
            .toUpperCase() === currency,
      );
      if (!matchingToken) return false;

      setMoonpaySellRequest({
        ...request,
        baseCurrencyCode: currency,
        beneficiaryLabel: 'MoonPay',
      });
      applyPaymentToSendForm({ destination, label: 'MoonPay', assetKey: matchingToken.key, amount, paymentRequest: null });
      return true;
    },
    [augmentedTokens, applyPaymentToSendForm],
  );

  const clearMoonpaySellRequest = useCallback(() => {
    setMoonpaySellRequest(null);
  }, []);

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
    moonpaySellRequest,
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
    clearMoonpaySellRequest,
  });

  return {
    // Send form
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
    moonpaySellRequest,
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
    // QR
    qrScannerOpen,
    setQrScannerOpen,
    handleAddressScan,
    handlePaymentRequestScan,
    // Handlers
    closeInlineQr,
    handleResumePayreq,
    startMoonpaySellRequest,
    clearMoonpaySellRequest,
    handleSendSubmit,
    resetSendForm,
    resetReceiveForm,
  };
}
