import { buildRlusdPaymentTxjson } from "@/utils/walletSpread";
import xcannesApi from "@/lib/xcannesApi";
import {
  buildMoonpayMemo,
  buildSimpleSwapMemo,
  buildPayreqMemo,
  buildAddressBookMemo,
  buildXrplJsonMemo,
} from "@/utils/xrplMemo";

// ---------------------------------------------------------------------------
// Helpers (module-level, pure)
// ---------------------------------------------------------------------------

const MOONPAY_SELL_WALLETS = new Set(
  String(process.env.NEXT_PUBLIC_MOONPAY_WALLETS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
);

const SIMPLESWAP_DEPOSITS_STORAGE_KEY = "xcannes_simpleswap_deposits_v1";

const readSimpleSwapDeposits = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage?.getItem(SIMPLESWAP_DEPOSITS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSimpleSwapDeposits = (list) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.setItem(
      SIMPLESWAP_DEPOSITS_STORAGE_KEY,
      JSON.stringify(Array.isArray(list) ? list : []),
    );
  } catch {
    // ignore
  }
};

const consumeSimpleSwapDeposit = (depositAddress) => {
  const addr = String(depositAddress || "").trim();
  if (!addr) return;
  const prev = readSimpleSwapDeposits();
  const next = prev.filter(
    (item) => String(item?.depositAddress || "").trim() !== addr,
  );
  if (next.length !== prev.length) writeSimpleSwapDeposits(next);
};

const isMoonpaySellDestination = (address) => {
  const dest = String(address || "").trim();
  return dest && MOONPAY_SELL_WALLETS.has(dest);
};

const buildXrpPaymentTxjson = ({ account, destination, amountXrp }) => {
  const normalizedAmount = Number(amountXrp);
  if (!account || !destination) return null;
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) return null;
  return {
    TransactionType: "Payment",
    Account: account,
    Destination: destination,
    Amount: String(Math.round(normalizedAmount * 1_000_000)),
  };
};

const requiresMoonpaySwap = (request) => {
  const baseCurrency = String(request?.baseCurrencyCode || "")
    .trim()
    .toUpperCase();
  const sourceCurrency = String(request?.sourceCurrencyCode || "")
    .trim()
    .toUpperCase();
  return Boolean(baseCurrency === "XRP" && sourceCurrency && sourceCurrency !== "XRP");
};

const buildSimpleSwapOutMemos = (
  destination,
  { amountRlusd, targetCurrencyCode = "USD", sourceCurrencyCode = null, sourceAmount = null } = {},
) => {
  const dest = String(destination || "").trim();
  if (!dest) return null;
  const deposits = readSimpleSwapDeposits();
  const hit = deposits.find(
    (item) => String(item?.depositAddress || "").trim() === dest,
  );
  if (!hit) return null;

  const payload = buildSimpleSwapMemo({
    side: "out",
    provider: "simpleswap",
    exchangeId: hit?.exchangeId || null,
    targetCurrencyCode,
    amountRlusd: Number.isFinite(Number(amountRlusd)) ? Number(amountRlusd) : null,
    sourceCurrencyCode:
      String(sourceCurrencyCode || hit?.sourceCurrencyCode || "")
        .trim()
        .toUpperCase() || null,
    sourceAmount:
      Number.isFinite(Number(sourceAmount || hit?.sourceAmount)) &&
      Number(sourceAmount || hit?.sourceAmount) > 0
        ? Number(sourceAmount || hit?.sourceAmount)
        : null,
  });
  if (!payload && Number.isFinite(Number(hit?.amountRlusd)) && Number(hit?.amountRlusd) > 0) {
    return buildXrplJsonMemo(
      buildSimpleSwapMemo({
        side: "out",
        provider: "simpleswap",
        exchangeId: hit?.exchangeId || null,
        targetCurrencyCode:
          String(targetCurrencyCode || hit?.targetCurrencyCode || "USD")
            .trim()
            .toUpperCase() || "USD",
        amountRlusd: Number(hit.amountRlusd),
        sourceCurrencyCode:
          String(sourceCurrencyCode || hit?.sourceCurrencyCode || "")
            .trim()
            .toUpperCase() || null,
        sourceAmount:
          Number.isFinite(Number(sourceAmount || hit?.sourceAmount)) &&
          Number(sourceAmount || hit?.sourceAmount) > 0
            ? Number(sourceAmount || hit?.sourceAmount)
            : null,
      }),
    );
  }
  if (!payload) return null;
  return buildXrplJsonMemo(payload);
};

const resolveMoonpaySellSourceAmountRlusd = ({
  request,
  currency,
  amountNum,
  selectedSendToken,
  rlusdPerUnitRates,
} = {}) => {
  const fromRequest = Number(request?.sourceAmountRlusd);
  if (Number.isFinite(fromRequest) && fromRequest > 0) return fromRequest;
  const upperCurrency = String(currency || "").trim().toUpperCase();
  if (upperCurrency === "RLUSD" || upperCurrency === "USD") {
    return Number.isFinite(amountNum) && amountNum > 0 ? amountNum : Number.NaN;
  }
  if (!selectedSendToken?.isTrustlineOnly) return Number.NaN;
  const rate = Number(rlusdPerUnitRates?.[upperCurrency]);
  if (!Number.isFinite(rate) || rate <= 0) return Number.NaN;
  return Number.isFinite(amountNum) && amountNum > 0 ? amountNum * rate : Number.NaN;
};

const buildMoonpaySellDestinationPayment = ({
  wallet,
  destination,
  amountXrp,
  moonpaySellRequest,
} = {}) => {
  const txjson = buildXrpPaymentTxjson({
    account: wallet,
    destination,
    amountXrp,
  });
  if (!txjson) return null;
  appendMemos(
    txjson,
    buildMoonpaySellMemos(
      destination,
      {
        currency: "XRP",
        amount: amountXrp,
        amountRlusd: null,
        sourceCurrencyCode: moonpaySellRequest?.sourceCurrencyCode ?? "RLUSD",
        sourceAmount:
          moonpaySellRequest?.sourceAmount ??
          moonpaySellRequest?.sourceAmountRlusd ??
          null,
      },
      { force: true },
    ),
  );
  return txjson;
};

const buildMoonpaySellMemos = (
  destination,
  { currency, amount, amountRlusd, sourceCurrencyCode, sourceAmount } = {},
  { force = false } = {},
) => {
  if (!force && !isMoonpaySellDestination(destination)) return null;
  const effectiveSourceCurrency =
    String(sourceCurrencyCode || currency || "")
      .trim()
      .toUpperCase() || null;
  const effectiveSourceAmount = Number.isFinite(Number(sourceAmount))
    ? Number(sourceAmount)
    : Number.isFinite(Number(amount))
      ? Number(amount)
      : null;
  const payload = buildMoonpayMemo({
    side: "sell",
    provider: "moonpay",
    currencyCode: currency || null,
    amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    amountRlusd: Number.isFinite(Number(amountRlusd))
      ? Number(amountRlusd)
      : null,
    sourceCurrencyCode: effectiveSourceCurrency,
    sourceAmount:
      Number.isFinite(effectiveSourceAmount) && effectiveSourceAmount > 0
        ? effectiveSourceAmount
        : null,
  });
  if (!payload) return null;
  return buildXrplJsonMemo(payload);
};

const appendMemos = (txjson, extraMemos) => {
  if (!txjson || !Array.isArray(extraMemos) || extraMemos.length === 0) return;
  const existing = Array.isArray(txjson.Memos) ? txjson.Memos : [];
  txjson.Memos = [...existing, ...extraMemos];
};

const buildAddressBookMemos = (address, label) => {
  const normalized = String(address || "").trim();
  if (!normalized) return null;
  const payload = buildAddressBookMemo({
    address: normalized,
    label: String(label || "").trim() || null,
  });
  if (!payload) return null;
  return buildXrplJsonMemo(payload);
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Encapsulates the full "send" flow: validation, FX rate conversion,
 * trustline-based payments, RLUSD/USD native payments, XRP drops, memos,
 * MoonPay sell detection, and post-send cleanup.
 *
 * No spread fee is charged on sends. Users handle currency conversion
 * themselves via the Convert modal (which charges the 1% spread).
 *
 * Returns `{ handleSendSubmit }` — single-signature send handler.
 */
export function useSendTransaction({
  // useWallet()
  isConnected,
  wallet,
  signTransaction,
  // Computed booleans / values
  hasOnChainRlusd,
  backendWalletAddress,
  selectedSendToken,
  // useSendForm()
  sendAmount,
  sendDestination,
  sendDestinationLabel,
  sendPaymentRequest,
  moonpaySellRequest,
  setSendProcessing,
  setSendAmount,
  setSendDestination,
  setSendPaymentRequest,
  // useSavedAddresses()
  savedAddresses,
  saveAddress,
  // useRlusdPerUnitRates()
  rlusdPerUnitRates,
  rlusdPerUnitSources,
  // useWalletTokens()
  allocatedRlusdByCurrency,
  // useWalletToast()
  toast,
  // usePayreqStorage()
  removePayreq,
  pendingPayreqs,
  clearMoonpaySellRequest,
}) {
  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function removeMatchingPayreq() {
    if (!sendPaymentRequest || !removePayreq || !pendingPayreqs?.length) return;
    const matchDest = String(sendPaymentRequest.to || "").trim();
    const matchAmount = Number(
      sendPaymentRequest.amountRlusd ||
        sendPaymentRequest.displayAmount ||
        0,
    );
    const matchCurrency = String(
      sendPaymentRequest.targetCurrencyCode ||
        sendPaymentRequest.displayCurrency ||
        "",
    ).toUpperCase();
    const match = pendingPayreqs.find((p) => {
      const pd = String(p.payreq?.to || "").trim();
      const pa = Number(
        p.payreq?.amountRlusd || p.payreq?.displayAmount || 0,
      );
      const pc = String(
        p.payreq?.targetCurrencyCode || p.payreq?.displayCurrency || "",
      ).toUpperCase();
      return pd === matchDest && pa === matchAmount && pc === matchCurrency;
    });
    if (match) removePayreq(match.id);
  }
  const handleSendSubmit = async ({
    saveDestination = "",
    saveLabel = "",
  } = {}) => {
    const normalizedSaveDestination = String(saveDestination || "").trim();

    const handleAddressSave = (dest) => {
      const normalizedDest = String(dest || "").trim();
      if (!normalizedDest) return;
      const isAlreadySaved = savedAddresses.some(
        (a) => a.address === normalizedDest,
      );
      if (!isAlreadySaved && normalizedSaveDestination === normalizedDest) {
        saveAddress(normalizedDest, saveLabel);
        return;
      }
      // No automatic "save this address?" prompt after sending.
    };

    if (!isConnected || !wallet) {
      toast.error("Please connect your wallet first.");
      return { ok: false };
    }
    if (!selectedSendToken) {
      toast.error("No asset selected.");
      return { ok: false };
    }
    if (
      (selectedSendToken?.currency === "RLUSD" ||
        selectedSendToken?.currency === "USD") &&
      !hasOnChainRlusd
    ) {
      toast.error(
        "RLUSD trustline is not installed yet. Please install it first.",
      );
      return { ok: false };
    }

    const amountNum = parseFloat(sendAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount.");
      return { ok: false };
    }

    const dest = (sendDestination || "").trim();
    if (!dest || !dest.startsWith("r") || dest.length < 25) {
      toast.error("Please enter a valid XRPL destination address.");
      return { ok: false };
    }
    const walletAddress =
      typeof wallet === "string" ? String(wallet).trim() : String(wallet?.address || "").trim();
    if (walletAddress && dest === walletAddress) {
      toast.error("You can't send to your own wallet.");
      return { ok: false };
    }

    const currency = String(selectedSendToken.currency || "").toUpperCase();
    const isMoonpaySell = Boolean(moonpaySellRequest?.depositWalletAddress);
    const shouldPrepareMoonpaySwap = isMoonpaySell && requiresMoonpaySwap(moonpaySellRequest);
    // USD (pool non alloué) est envoyé comme RLUSD natif, pas comme une conversion FX.
    const isFxSend =
      !isMoonpaySell &&
      selectedSendToken?.isTrustlineOnly &&
      currency !== "XRP" &&
      currency !== "RLUSD" &&
      currency !== "USD";

    setSendProcessing(true);
    // Keep the originating modal/action open during auth. If the user cancels
    // biometric/PIN in the embedded PWA, we must return to this same context.

    try {
      if (shouldPrepareMoonpaySwap) {
        return await handleMoonpaySellWithSwap({
          amountNum,
          dest,
          currency,
          handleAddressSave,
        });
      }

      if (isFxSend) {
        return await handleFxSend({
          amountNum,
          dest,
          currency,
          isMoonpaySell,
          handleAddressSave,
          normalizedSaveDestination,
          saveLabel,
        });
      }

      return await handleDirectSend({
        amountNum,
        dest,
        currency,
        isMoonpaySell,
        handleAddressSave,
        normalizedSaveDestination,
        saveLabel,
      });
    } catch (err) {
      console.error("Send payment error:", err);
      toast.error(
        "Error while preparing payment: " + (err?.message || String(err)),
      );
      return { ok: false };
    } finally {
      setSendProcessing(false);
    }
  };

  async function handleMoonpaySellWithSwap({
    amountNum,
    dest,
    currency,
    handleAddressSave,
  }) {
    const sourceAmountRlusd = resolveMoonpaySellSourceAmountRlusd({
      request: moonpaySellRequest,
      currency,
      amountNum,
      selectedSendToken,
      rlusdPerUnitRates,
    });
    if (!Number.isFinite(sourceAmountRlusd) || sourceAmountRlusd <= 0) {
      toast.error("Impossible de calculer le montant RLUSD à swapper pour MoonPay.");
      return { ok: false };
    }

    const preparedSwap = await xcannesApi.prepareRlusdXrpSwap({
      address: typeof wallet === "string" ? wallet : wallet?.address || "",
      direction: "RLUSD_TO_XRP",
      amountRlusd: sourceAmountRlusd,
    });
    const payoutXrp = Number(preparedSwap?.quote?.xrpAmount);
    if (!Number.isFinite(payoutXrp) || payoutXrp <= 0) {
      throw new Error("MoonPay swap preparation returned an invalid XRP amount.");
    }

    const swapResult = await signTransaction(preparedSwap.txjson, {
      action: "wallet:swap",
      progressDetails: {
        amountLabel: `${sourceAmountRlusd.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })} RLUSD → XRP`,
        beneficiaryLabel: "MoonPay",
        beneficiaryAddress: dest,
      },
    });
    if (!swapResult?.signed) {
      toast.warn("Swap XRPL annulé ou expiré.");
      return { ok: false };
    }

    const paymentTx = buildMoonpaySellDestinationPayment({
      wallet,
      destination: dest,
      amountXrp:
        Number.isFinite(Number(moonpaySellRequest?.baseCurrencyAmount)) &&
        Number(moonpaySellRequest?.baseCurrencyAmount) > 0
          ? Number(moonpaySellRequest.baseCurrencyAmount)
          : payoutXrp,
      moonpaySellRequest,
    });
    if (!paymentTx) {
      throw new Error("Failed to build MoonPay XRP payment.");
    }

    const result = await signTransaction(paymentTx, {
      action: "moonpay:sell",
      progressDetails: {
        amountLabel: `${Number(moonpaySellRequest?.baseCurrencyAmount || payoutXrp).toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })} XRP`,
        beneficiaryLabel: "MoonPay",
        beneficiaryAddress: dest,
        moonpayReturnUrl: String(moonpaySellRequest?.returnUrl || "").trim(),
      },
    });

    if (result?.signed) {
      toast.success("✅ Paiement MoonPay soumis.");
      handleAddressSave(dest);
      setSendAmount("");
      setSendDestination("");
      setSendPaymentRequest(null);
      clearMoonpaySellRequest?.();
      return { ok: true };
    }

    toast.warn("Paiement MoonPay annulé ou expiré après le swap XRPL.");
    return { ok: false };
  }

  // ------------------------------------------------------------------
  // FX send — single RLUSD transaction (no spread fee on sends)
  // ------------------------------------------------------------------
  async function handleFxSend({
    amountNum,
    dest,
    currency,
    isMoonpaySell,
    handleAddressSave,
    normalizedSaveDestination,
    saveLabel,
  }) {
    if (!backendWalletAddress) {
      toast.error("Please connect your wallet first.");
      return { ok: false };
    }
    if (!hasOnChainRlusd) {
      toast.error(
        "RLUSD trustline is not installed yet. Please install it first.",
      );
      return { ok: false };
    }

    // --- FX rate resolution ---
    const rawRate = Number(rlusdPerUnitRates?.[currency]);
    const rlusdPerUnit =
      Number.isFinite(rawRate) && rawRate > 0 ? rawRate : Number.NaN;
    if (!Number.isFinite(rlusdPerUnit) || rlusdPerUnit <= 0) {
      toast.error(`Impossible de récupérer le taux pour ${currency}.`);
      return { ok: false };
    }

    const paymentRlusd = amountNum * rlusdPerUnit;

    // --- Balance check ---
    const availableAllocatedRlusd =
      allocatedRlusdByCurrency?.get?.(currency) ??
      (Number.isFinite(Number(selectedSendToken?.allocatedRlusd))
        ? Number(selectedSendToken.allocatedRlusd)
        : Number.NaN);
    const epsilon = 1e-9;
    if (
      Number.isFinite(availableAllocatedRlusd) &&
      availableAllocatedRlusd + epsilon < paymentRlusd
    ) {
      const maxFx =
        availableAllocatedRlusd > 0
          ? availableAllocatedRlusd / rlusdPerUnit
          : 0;
      toast.warn(
          `Allocation insuffisante en ${currency}.\n\n` +
          `Disponible: ≈ ${availableAllocatedRlusd.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })} RLUSD\n` +
          `Maximum: ≈ ${maxFx.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`,
      );
      return { ok: false };
    }

    // --- Build & sign single RLUSD payment ---
    const fxSource =
      (sendPaymentRequest?.fxSource
        ? String(sendPaymentRequest.fxSource)
        : null) ||
      rlusdPerUnitSources?.[currency] ||
      null;

    const payTx = buildRlusdPaymentTxjson({
      account: wallet,
      destination: dest,
      amountRlusd: paymentRlusd,
    });
    if (!payTx) {
      throw new Error("Invalid RLUSD payment");
    }

    const targetCurrencyForMemo = sendPaymentRequest?.targetCurrencyCode
      ? String(sendPaymentRequest.targetCurrencyCode).trim().toUpperCase() ||
        currency
      : currency;
    const displayAmountForMemo = sendPaymentRequest
      ? (sendPaymentRequest?.displayAmount ?? amountNum)
      : amountNum;
    const displayCurrencyForMemo = sendPaymentRequest
      ? (sendPaymentRequest?.displayCurrency ??
        targetCurrencyForMemo ??
        currency)
      : currency;
    const targetAllocatedBefore = allocatedRlusdByCurrency?.get(
      targetCurrencyForMemo,
    );
    const paymentAllocatedAfter = Number.isFinite(targetAllocatedBefore)
      ? Math.max(0, Number(targetAllocatedBefore) - paymentRlusd)
      : null;

    const memoPayload = buildPayreqMemo({
      origin: sendPaymentRequest ? "payreq" : "manual",
      targetCurrencyCode: targetCurrencyForMemo,
      displayAmount: displayAmountForMemo,
      displayCurrencyCode: displayCurrencyForMemo,
      amountRlusd: paymentRlusd,
      allocatedRlusdAfter: paymentAllocatedAfter,
      fxRate: rlusdPerUnit,
      fxSource,
      note: sendPaymentRequest?.memo || null,
    });
    if (!memoPayload) {
      throw new Error("Invalid payment memo payload");
    }
    const memos = buildXrplJsonMemo(memoPayload);
    if (!memos) {
      throw new Error("Invalid payment memo");
    }
    payTx.Memos = memos;
    appendMemos(
      payTx,
      buildMoonpaySellMemos(dest, {
        currency,
        amount: amountNum,
        amountRlusd: paymentRlusd,
        sourceCurrencyCode: moonpaySellRequest?.sourceCurrencyCode ?? currency,
        sourceAmount: moonpaySellRequest?.sourceAmount ?? amountNum,
      }, { force: isMoonpaySell }),
    );
    const simpleSwapMemo = buildSimpleSwapOutMemos(dest, {
      amountRlusd: paymentRlusd,
      targetCurrencyCode: "USD",
      sourceCurrencyCode: currency,
      sourceAmount: amountNum,
    });
    const usedSimpleSwap = Boolean(simpleSwapMemo);
    appendMemos(payTx, simpleSwapMemo);
    appendMemos(
      payTx,
      buildAddressBookMemos(normalizedSaveDestination, saveLabel),
    );

    const savedEntry = (savedAddresses || []).find(
      (a) => String(a?.address || "").trim() === String(dest || "").trim(),
    );
    const moonpayBeneficiaryLabel = isMoonpaySell
      ? String(moonpaySellRequest?.beneficiaryLabel || "MoonPay").trim()
      : "";
    const beneficiaryLabel =
      moonpayBeneficiaryLabel ||
      String(sendDestinationLabel || "").trim() ||
      String(savedEntry?.onChainLabel || savedEntry?.label || "").trim() ||
      "";

	    const payResult = await signTransaction(payTx, {
	      action: isMoonpaySell ? "moonpay:sell" : "wallet:send",
	      progressDetails: {
	        amountLabel: `${amountNum.toLocaleString("en-US", {
	          maximumFractionDigits: 2,
	        })} ${currency}`,
	        beneficiaryLabel: beneficiaryLabel || null,
	        beneficiaryAddress: dest,
	        memo: sendPaymentRequest?.memo || null,
	        moonpayReturnUrl: isMoonpaySell
	          ? String(moonpaySellRequest?.returnUrl || "").trim()
	          : "",
	      },
	    });

    if (usedSimpleSwap) {
      consumeSimpleSwapDeposit(dest);
    }
    if (payResult?.signed) {
      toast.success("✅ Payment submitted.");
      handleAddressSave(dest);
      setSendAmount("");
      setSendDestination("");
      // Auto-suppression de la payreq des demandes en attente
      removeMatchingPayreq();
      setSendPaymentRequest(null);
      clearMoonpaySellRequest?.();
      // Balance refresh is handled automatically via WebSocket wallet:address channel
      return { ok: true };
    } else {
      toast.warn("Paiement annulé. Vous pouvez reprendre la validation quand vous voulez.");
      return { ok: false };
    }
  }

  // ------------------------------------------------------------------
  // Direct send — XRP drops, RLUSD/USD native, or trustline tokens
  // ------------------------------------------------------------------
  async function handleDirectSend({
    amountNum,
    dest,
    currency,
    isMoonpaySell,
    handleAddressSave,
    normalizedSaveDestination,
    saveLabel,
  }) {
    let Amount;
    if (
      selectedSendToken.currency === "XRP" &&
      selectedSendToken.issuer === "Native"
    ) {
      Amount = Math.round(amountNum * 1_000_000).toString();
    } else if (currency === "USD" || currency === "RLUSD") {
      // USD (pool non alloué) et RLUSD sont envoyés comme RLUSD on-chain.
      const rlusdTxjson = buildRlusdPaymentTxjson({
        account: wallet,
        destination: dest,
        amountRlusd: amountNum,
      });
      if (!rlusdTxjson) {
        toast.error("Failed to build RLUSD payment.");
        return { ok: false };
      }
      Amount = rlusdTxjson.Amount;
    } else {
      const normalized = amountNum.toFixed(8).replace(/\.?0+$/, "") || "0";
      Amount = {
        currency: selectedSendToken.currency,
        issuer: selectedSendToken.issuer,
        value: normalized,
      };
    }

    const txjson = {
      TransactionType: "Payment",
      Account: wallet,
      Destination: dest,
      Amount,
    };

    // If this payment comes from a XCANNES request, attach a memo so the receiver
    // can auto-credit the right currency line (only meaningful for RLUSD payments).
    if (
      (currency === "RLUSD" || currency === "USD") &&
      sendPaymentRequest?.targetCurrencyCode
    ) {
      const target = String(sendPaymentRequest.targetCurrencyCode || "")
        .trim()
        .toUpperCase();
      const targetAllocatedBefore = allocatedRlusdByCurrency?.get(target);
      const paymentAllocatedAfter = Number.isFinite(targetAllocatedBefore)
        ? Math.max(0, Number(targetAllocatedBefore) - amountNum)
        : null;
      const memoPayload = buildPayreqMemo({
        origin: "payreq",
        targetCurrencyCode: target || null,
        displayAmount: sendPaymentRequest?.displayAmount ?? null,
        displayCurrencyCode:
          (sendPaymentRequest?.displayCurrency ?? target) || null,
        amountRlusd: amountNum,
        allocatedRlusdAfter: paymentAllocatedAfter,
        fxRate: sendPaymentRequest?.fxRate ?? null,
        fxSource: sendPaymentRequest?.fxSource ?? null,
        note: sendPaymentRequest?.memo || null,
      });
      if (!memoPayload) {
        throw new Error("Invalid payreq memo payload");
      }
      const memos = buildXrplJsonMemo(memoPayload);
      if (!memos) {
        throw new Error("Invalid payreq memo");
      }
      txjson.Memos = memos;
    }

    appendMemos(
      txjson,
      buildMoonpaySellMemos(dest, {
        currency,
        amount: amountNum,
        amountRlusd: currency === "RLUSD" ? amountNum : null,
        sourceCurrencyCode: moonpaySellRequest?.sourceCurrencyCode ?? currency,
        sourceAmount: moonpaySellRequest?.sourceAmount ?? amountNum,
      }, { force: isMoonpaySell }),
    );
    const directSimpleSwapMemo = buildSimpleSwapOutMemos(dest, {
      amountRlusd: currency === "RLUSD" || currency === "USD" ? amountNum : null,
      targetCurrencyCode: "USD",
      sourceCurrencyCode: currency,
      sourceAmount: amountNum,
    });
    const usedDirectSimpleSwap = Boolean(directSimpleSwapMemo);
    appendMemos(txjson, directSimpleSwapMemo);
    appendMemos(
      txjson,
      buildAddressBookMemos(normalizedSaveDestination, saveLabel),
    );

    const savedEntry = (savedAddresses || []).find(
      (a) => String(a?.address || "").trim() === String(dest || "").trim(),
    );
    const moonpayBeneficiaryLabel = isMoonpaySell
      ? String(moonpaySellRequest?.beneficiaryLabel || "MoonPay").trim()
      : "";
    const beneficiaryLabel =
      moonpayBeneficiaryLabel ||
      String(sendDestinationLabel || "").trim() ||
      String(savedEntry?.onChainLabel || savedEntry?.label || "").trim() ||
      "";

    const amountLabel = (() => {
      if (currency === "XRP") {
        return `${amountNum.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        })} XRP`;
      }
      if (currency === "USD") {
        // USD is paid on-chain as RLUSD, but keep the user's selected currency for UI.
        return `${amountNum.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        })} USD`;
      }
      if (currency === "RLUSD") {
        return `${amountNum.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        })} RLUSD`;
      }
      return `${amountNum.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })} ${currency}`;
    })();

    const result = await signTransaction(txjson, {
      action: isMoonpaySell ? "moonpay:sell" : "wallet:send",
      progressDetails: {
        amountLabel,
        beneficiaryLabel: beneficiaryLabel || null,
        beneficiaryAddress: dest,
        memo: sendPaymentRequest?.memo || null,
        moonpayReturnUrl: isMoonpaySell
          ? String(moonpaySellRequest?.returnUrl || "").trim()
          : "",
      },
    });
    if (result && result.signed) {
      if (usedDirectSimpleSwap) {
        consumeSimpleSwapDeposit(dest);
      }
      toast.success("✅ Payment submitted.");
      handleAddressSave(dest);

      setSendAmount("");
      setSendDestination("");
      // Auto-suppression de la payreq des demandes en attente
      removeMatchingPayreq();
      setSendPaymentRequest(null);
      clearMoonpaySellRequest?.();
      // Balance refresh is handled automatically via WebSocket wallet:address channel
      return { ok: true };
    } else {
      toast.warn("Paiement annulé. Vous pouvez reprendre la validation quand vous voulez.");
      return { ok: false };
    }
  }

  return { handleSendSubmit };
}
