import { buildRlusdPaymentTxjson } from "@/utils/walletSpread";
import {
  buildMoonpayMemo,
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

const isMoonpaySellDestination = (address) => {
  const dest = String(address || "").trim();
  return dest && MOONPAY_SELL_WALLETS.has(dest);
};

const buildMoonpaySellMemos = (
  destination,
  { currency, amount, amountRlusd } = {},
) => {
  if (!isMoonpaySellDestination(destination)) return null;
  const payload = buildMoonpayMemo({
    side: "sell",
    provider: "moonpay",
    currencyCode: currency || null,
    amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    amountRlusd: Number.isFinite(Number(amountRlusd))
      ? Number(amountRlusd)
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
  setSendProcessing,
  setSendAmount,
  setSendDestination,
  setSendPaymentRequest,
  // useSavedAddresses()
  savedAddresses,
  saveAddress,
  // Local UI state setters
  setActiveAction,
  setAddressToSave,
  setShowSaveAddressPrompt,
  // Layout
  isDesktopPanel,
  // useRlusdPerUnitRates()
  rlusdPerUnitRates,
  rlusdPerUnitSources,
  // useWalletTokens()
  allocatedRlusdByCurrency,
  // useWalletToast()
  toast,
  confirm,
  // usePayreqStorage()
  removePayreq,
  pendingPayreqs,
}) {
  // ------------------------------------------------------------------
  // handleSendSubmit
  // ------------------------------------------------------------------
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
    // USD (pool non alloué) est envoyé comme RLUSD natif, pas comme une conversion FX.
    const isFxSend =
      selectedSendToken?.isTrustlineOnly &&
      currency !== "XRP" &&
      currency !== "RLUSD" &&
      currency !== "USD";

    setSendProcessing(true);
    if (!isDesktopPanel) {
      setActiveAction(null);
    }

    try {
      if (isFxSend) {
        return await handleFxSend({
          amountNum,
          dest,
          currency,
          handleAddressSave,
          normalizedSaveDestination,
          saveLabel,
        });
      }

      return await handleDirectSend({
        amountNum,
        dest,
        currency,
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

  // ------------------------------------------------------------------
  // FX send — single RLUSD transaction (no spread fee on sends)
  // ------------------------------------------------------------------
  async function handleFxSend({
    amountNum,
    dest,
    currency,
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
            maximumFractionDigits: 6,
          })} RLUSD\n` +
          `Maximum: ≈ ${maxFx.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${currency}`,
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
      }),
    );
    appendMemos(
      payTx,
      buildAddressBookMemos(normalizedSaveDestination, saveLabel),
    );

    const savedEntry = (savedAddresses || []).find(
      (a) => String(a?.address || "").trim() === String(dest || "").trim(),
    );
    const beneficiaryLabel =
      String(sendDestinationLabel || "").trim() ||
      String(savedEntry?.onChainLabel || savedEntry?.label || "").trim() ||
      "";

    const payResult = await signTransaction(payTx, {
      action: "wallet:send",
      progressDetails: {
        amountLabel: `${amountNum.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })} ${currency}`,
        beneficiaryLabel: beneficiaryLabel || null,
        beneficiaryAddress: dest,
      },
    });
    if (payResult?.signed) {
      toast.success("✅ Payment submitted.");
      handleAddressSave(dest);
      setSendAmount("");
      setSendDestination("");
      // Auto-suppression de la payreq des demandes en attente
      if (sendPaymentRequest && removePayreq && pendingPayreqs?.length) {
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
      setSendPaymentRequest(null);
      // Balance refresh is handled automatically via WebSocket wallet:address channel
      return { ok: true };
    } else {
      toast.warn("Transaction cancelled or expired.");
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
      }),
    );
    appendMemos(
      txjson,
      buildAddressBookMemos(normalizedSaveDestination, saveLabel),
    );

    const savedEntry = (savedAddresses || []).find(
      (a) => String(a?.address || "").trim() === String(dest || "").trim(),
    );
    const beneficiaryLabel =
      String(sendDestinationLabel || "").trim() ||
      String(savedEntry?.onChainLabel || savedEntry?.label || "").trim() ||
      "";

    const amountLabel = (() => {
      if (currency === "XRP") {
        return `${amountNum.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })} XRP`;
      }
      if (currency === "USD") {
        // USD is paid on-chain as RLUSD, but keep the user's selected currency for UI.
        return `${amountNum.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })} USD`;
      }
      if (currency === "RLUSD") {
        return `${amountNum.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })} RLUSD`;
      }
      return `${amountNum.toLocaleString("en-US", {
        maximumFractionDigits: 6,
      })} ${currency}`;
    })();

    const result = await signTransaction(txjson, {
      action: "wallet:send",
      progressDetails: {
        amountLabel,
        beneficiaryLabel: beneficiaryLabel || null,
        beneficiaryAddress: dest,
      },
    });
    if (result && result.signed) {
      toast.success("✅ Payment submitted.");
      handleAddressSave(dest);

      setSendAmount("");
      setSendDestination("");
      // Auto-suppression de la payreq des demandes en attente
      if (sendPaymentRequest && removePayreq && pendingPayreqs?.length) {
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
      setSendPaymentRequest(null);
      // Balance refresh is handled automatically via WebSocket wallet:address channel
      return { ok: true };
    } else {
      toast.warn("Transaction cancelled or expired.");
      return { ok: false };
    }
  }

  return { handleSendSubmit };
}
