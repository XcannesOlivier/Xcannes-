import {
  buildRlusdPaymentTxjson,
  computeSpreadQuote,
  XCANNES_SPREAD_WALLET_ADDRESS,
} from "@/utils/walletSpread";
import {
  buildMoonpayMemo,
  buildPayreqMemo,
  buildXrplJsonMemo,
} from "@/utils/xrplMemo";

// ---------------------------------------------------------------------------
// Helpers (module-level, pure)
// ---------------------------------------------------------------------------

const MOONPAY_SELL_WALLETS = new Set(
  String(process.env.NEXT_PUBLIC_MOONPAY_WALLETS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
);

const isMoonpaySellDestination = (address) => {
  const dest = String(address || "").trim();
  return dest && MOONPAY_SELL_WALLETS.has(dest);
};

const buildMoonpaySellMemos = (destination, { currency, amount, amountRlusd } = {}) => {
  if (!isMoonpaySellDestination(destination)) return null;
  const payload = buildMoonpayMemo({
    side: "sell",
    provider: "moonpay",
    currencyCode: currency || null,
    amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    amountRlusd: Number.isFinite(Number(amountRlusd)) ? Number(amountRlusd) : null,
  });
  if (!payload) return null;
  return buildXrplJsonMemo(payload);
};

const appendMemos = (txjson, extraMemos) => {
  if (!txjson || !Array.isArray(extraMemos) || extraMemos.length === 0) return;
  const existing = Array.isArray(txjson.Memos) ? txjson.Memos : [];
  txjson.Memos = [...existing, ...extraMemos];
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Encapsulates the full "send" flow: validation, FX spread double-signature,
 * trustline-based payments, RLUSD/USD native payments, XRP drops, memos,
 * MoonPay sell detection, and post-send cleanup.
 *
 * Returns `{ handleSendSubmit }` — drop-in replacement for the 412-line
 * inline handler that was in WalletDashboard.
 */
export function useSendTransaction({
  // useWallet()
  isConnected,
  wallet,
  signTransaction,
  refreshBalance,
  // Computed booleans / values
  hasOnChainRlusd,
  backendWalletAddress,
  selectedSendToken,
  // useSendForm()
  sendAmount,
  sendDestination,
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
  // useRlusdPerUnitRates()
  rlusdPerUnitRates,
  rlusdPerUnitSources,
  // useWalletTokens()
  allocatedRlusdByCurrency,
  // useWalletCurrencyLines()
  refreshCurrencyLines,
}) {
  // ------------------------------------------------------------------
  // handleSendSubmit
  // ------------------------------------------------------------------
  const handleSendSubmit = async ({ saveDestination = "", saveLabel = "" } = {}) => {
    const normalizedSaveDestination = String(saveDestination || "").trim();

    const handleAddressSave = (dest) => {
      const normalizedDest = String(dest || "").trim();
      if (!normalizedDest) return;
      const isAlreadySaved = savedAddresses.some((a) => a.address === normalizedDest);
      if (!isAlreadySaved && normalizedSaveDestination === normalizedDest) {
        saveAddress(normalizedDest, saveLabel);
        return;
      }
      if (!isAlreadySaved) {
        setAddressToSave(normalizedDest);
        setShowSaveAddressPrompt(true);
      }
    };

    if (!isConnected || !wallet) {
      alert("Please connect your Xumm wallet first.");
      return { ok: false };
    }
    if (!selectedSendToken) {
      alert("No asset selected.");
      return { ok: false };
    }
    if (
      (selectedSendToken?.currency === "RLUSD" || selectedSendToken?.currency === "USD") &&
      !hasOnChainRlusd
    ) {
      alert("RLUSD trustline is not installed yet. Please install it first.");
      return { ok: false };
    }

    const amountNum = parseFloat(sendAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount.");
      return { ok: false };
    }

    const dest = (sendDestination || "").trim();
    if (!dest || !dest.startsWith("r") || dest.length < 25) {
      alert("Please enter a valid XRPL destination address.");
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
    setActiveAction(null);

    try {
      if (isFxSend) {
        return await handleFxSend({
          amountNum,
          dest,
          currency,
          handleAddressSave,
        });
      }

      return await handleDirectSend({
        amountNum,
        dest,
        currency,
        handleAddressSave,
      });
    } catch (err) {
      console.error("Send payment error:", err);
      alert("Error while preparing payment: " + (err?.message || String(err)));
      return { ok: false };
    } finally {
      setSendProcessing(false);
    }
  };

  // ------------------------------------------------------------------
  // FX send — double-signature (spread fee → XCANNES, payment → dest)
  // ------------------------------------------------------------------
  async function handleFxSend({ amountNum, dest, currency, handleAddressSave }) {
    if (!backendWalletAddress) {
      alert("Please connect your Xumm wallet first.");
      return { ok: false };
    }
    if (!hasOnChainRlusd) {
      alert("RLUSD trustline is not installed yet. Please install it first.");
      return { ok: false };
    }

    const requestTargetCurrency = String(
      sendPaymentRequest?.targetCurrencyCode || ""
    )
      .trim()
      .toUpperCase();

    const requestedFxRate =
      sendPaymentRequest?.fxRate != null
        ? Number(sendPaymentRequest.fxRate)
        : Number.NaN;

    const rawRate = Number(rlusdPerUnitRates?.[currency]);
    const effectiveRate =
      requestTargetCurrency && requestTargetCurrency === currency &&
      Number.isFinite(requestedFxRate) && requestedFxRate > 0
        ? requestedFxRate
        : rawRate;

    const rlusdPerUnit = Number.isFinite(effectiveRate) && effectiveRate > 0
      ? effectiveRate
      : Number.NaN;
    if (!Number.isFinite(rlusdPerUnit) || rlusdPerUnit <= 0) {
      alert(`Impossible de récupérer le taux pour ${currency}.`);
      return { ok: false };
    }

    const requestedRlusd =
      sendPaymentRequest?.amountRlusd != null &&
      Number.isFinite(Number(sendPaymentRequest.amountRlusd))
        ? Number(sendPaymentRequest.amountRlusd)
        : null;

    let paymentRlusd = amountNum * rlusdPerUnit;
    let effectiveAmountNum = amountNum;
    let isAlternateCurrency = false;

    if (requestTargetCurrency && requestTargetCurrency !== currency) {
      if (!Number.isFinite(requestedRlusd) || requestedRlusd <= 0) {
        alert("Montant RLUSD demandé manquant pour cette demande.");
        return { ok: false };
      }
      isAlternateCurrency = true;
      paymentRlusd = requestedRlusd;
      effectiveAmountNum = paymentRlusd / rlusdPerUnit;
      if (!Number.isFinite(effectiveAmountNum) || effectiveAmountNum <= 0) {
        alert("Impossible de calculer le montant dans la devise sélectionnée.");
        return { ok: false };
      }
    }

    if (Number.isFinite(requestedRlusd)) {
      const diff = Math.abs(paymentRlusd - requestedRlusd);
      if (diff > Math.max(0.01, requestedRlusd * 0.005)) {
        alert(
          `Montant RLUSD différent de la demande.\n\n` +
            `Demandé: ≈ ${requestedRlusd.toLocaleString("en-US", { maximumFractionDigits: 6 })} RLUSD\n` +
            `Calculé: ≈ ${paymentRlusd.toLocaleString("en-US", { maximumFractionDigits: 6 })} RLUSD\n\n` +
            `Scannez à nouveau la demande ou vérifiez le taux.`
        );
        return { ok: false };
      }
    }

    // Same-currency payreq → no spread, 1 single transaction.
    const isSameCurrencyPayreq =
      sendPaymentRequest && requestTargetCurrency && requestTargetCurrency === currency;
    const spread = isSameCurrencyPayreq
      ? { isFx: false, spreadFraction: 0, halfSpreadFraction: 0, spreadFeeRlusd: 0, tier: null }
      : computeSpreadQuote({ base: currency, quote: "RLUSD", amountRlusd: paymentRlusd });
    const spreadFeeRlusd = Number(spread?.spreadFeeRlusd || 0);
    const totalToSpendRlusd = paymentRlusd + spreadFeeRlusd;
    const epsilon = 1e-9;

    const availableAllocatedRlusd =
      allocatedRlusdByCurrency?.get?.(currency) ??
      (Number.isFinite(Number(selectedSendToken?.allocatedRlusd))
        ? Number(selectedSendToken.allocatedRlusd)
        : Number.NaN);
    if (Number.isFinite(availableAllocatedRlusd) && availableAllocatedRlusd + epsilon < totalToSpendRlusd) {
      const maxPaymentRlusd =
        spread?.halfSpreadFraction != null && Number(spread.halfSpreadFraction) > 0
          ? availableAllocatedRlusd / (1 + Number(spread.halfSpreadFraction))
          : availableAllocatedRlusd;
      const maxFx = maxPaymentRlusd > 0 ? maxPaymentRlusd / rlusdPerUnit : 0;
      alert(
        `Allocation insuffisante en ${currency} pour couvrir paiement + frais de conversion.\n\n` +
          `Disponible: ≈ ${availableAllocatedRlusd.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} RLUSD\n` +
          `Maximum: ≈ ${maxFx.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${currency}`
      );
      return { ok: false };
    }

    const requestedDisplayAmount =
      sendPaymentRequest?.displayAmount ??
      (Number.isFinite(requestedRlusd) &&
      Number.isFinite(Number(sendPaymentRequest?.fxRate)) &&
      Number(sendPaymentRequest?.fxRate) > 0
        ? requestedRlusd / Number(sendPaymentRequest.fxRate)
        : null);
    const requestedDisplayCurrency =
      sendPaymentRequest?.displayCurrency || requestTargetCurrency || null;

    const ok = confirm(
      `Paiement en RLUSD (affiché en ${currency}).\n\n` +
        (isAlternateCurrency && requestedDisplayCurrency
          ? `Demande: ${requestedDisplayAmount != null
              ? Number(requestedDisplayAmount).toLocaleString("en-US", { maximumFractionDigits: 6 })
              : "-"} ${requestedDisplayCurrency}\n`
          : "") +
        `Montant: ${effectiveAmountNum.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${currency}\n` +
        `≈ ${paymentRlusd.toLocaleString("en-US", { maximumFractionDigits: 6 })} RLUSD au destinataire\n` +
        (spreadFeeRlusd > 0
          ? `Frais de conversion (1 %) : ≈ ${spreadFeeRlusd.toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })} RLUSD\n`
          : "") +
        `Total RLUSD à débiter: ≈ ${totalToSpendRlusd.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })} RLUSD\n\n` +
        (spreadFeeRlusd > 0
          ? `2 signatures Xumm seront demandées (frais de conversion → XCANNES, puis paiement → destinataire).`
          : `1 signature Xumm sera demandée (paiement → destinataire).`)
    );
    if (!ok) return { ok: false };

    // 1) Paiement des frais de conversion → wallet entreprise XCANNES
    const fxSource =
      (sendPaymentRequest?.fxSource ? String(sendPaymentRequest.fxSource) : null) ||
      rlusdPerUnitSources?.[currency] ||
      null;
    if (spreadFeeRlusd > 0) {
      const spreadAllocatedBefore = allocatedRlusdByCurrency?.get(currency);
      const spreadAllocatedAfter = Number.isFinite(spreadAllocatedBefore)
        ? Math.max(0, Number(spreadAllocatedBefore) - spreadFeeRlusd)
        : null;
      const spreadTx = buildRlusdPaymentTxjson({
        account: wallet,
        destination: XCANNES_SPREAD_WALLET_ADDRESS,
        amountRlusd: spreadFeeRlusd,
      });
      if (!spreadTx) {
        throw new Error("Invalid RLUSD conversion fee payment");
      }
      const spreadMemoPayload = buildPayreqMemo({
        origin: "spread",
        targetCurrencyCode: currency,
        displayAmount: spreadFeeRlusd,
        displayCurrencyCode: "RLUSD",
        amountRlusd: spreadFeeRlusd,
        allocatedRlusdAfter: spreadAllocatedAfter,
        fxRate: rlusdPerUnit,
        fxSource,
        note: "spread",
      });
      if (!spreadMemoPayload) {
        throw new Error("Invalid conversion fee memo payload");
      }
      const spreadMemos = buildXrplJsonMemo(spreadMemoPayload);
      if (!spreadMemos) {
        throw new Error("Invalid conversion fee memo");
      }
      spreadTx.Memos = spreadMemos;

      const spreadResult = await signTransaction(spreadTx, {
        action: "wallet:convert",
      });
      if (!spreadResult?.signed) {
        alert("Conversion fee payment cancelled or expired.");
        return { ok: false };
      }
    }

    // 2) Paiement principal → destinataire
    const payTx = buildRlusdPaymentTxjson({
      account: wallet,
      destination: dest,
      amountRlusd: paymentRlusd,
    });
    if (!payTx) {
      throw new Error("Invalid RLUSD payment");
    }

    const targetCurrencyForMemo = sendPaymentRequest?.targetCurrencyCode
      ? requestTargetCurrency || currency
      : currency;
    const displayAmountForMemo = sendPaymentRequest
      ? sendPaymentRequest?.displayAmount ?? effectiveAmountNum
      : effectiveAmountNum;
    const displayCurrencyForMemo = sendPaymentRequest
      ? sendPaymentRequest?.displayCurrency ?? targetCurrencyForMemo ?? currency
      : currency;
    const targetAllocatedBefore = allocatedRlusdByCurrency?.get(targetCurrencyForMemo);
    const paymentDebitRlusd =
      targetCurrencyForMemo === currency ? totalToSpendRlusd : paymentRlusd;
    const paymentAllocatedAfter = Number.isFinite(targetAllocatedBefore)
      ? Math.max(0, Number(targetAllocatedBefore) - paymentDebitRlusd)
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
        amount: effectiveAmountNum,
        amountRlusd: paymentRlusd,
      })
    );

    const payResult = await signTransaction(payTx, {
      action: "wallet:convert",
    });
    if (payResult?.signed) {
      alert("✅ Payment submitted via Xumm.");

      handleAddressSave(dest);

      setSendAmount("");
      setSendDestination("");
      setSendPaymentRequest(null);
      if (refreshBalance) setTimeout(() => refreshBalance(), 3000);
      if (refreshCurrencyLines) setTimeout(() => refreshCurrencyLines(), 3000);
      return { ok: true };
    } else {
      alert(
        spreadFeeRlusd > 0
          ? "Payment cancelled or expired. (Conversion fee was already paid.)"
          : "Transaction cancelled or expired."
      );
      return { ok: false };
    }
  }

  // ------------------------------------------------------------------
  // Direct send — XRP drops, RLUSD/USD native, or trustline tokens
  // ------------------------------------------------------------------
  async function handleDirectSend({ amountNum, dest, currency, handleAddressSave }) {
    let Amount;
    if (selectedSendToken.currency === "XRP" && selectedSendToken.issuer === "Native") {
      Amount = Math.round(amountNum * 1_000_000).toString();
    } else if (currency === "USD" || currency === "RLUSD") {
      // USD (pool non alloué) et RLUSD sont envoyés comme RLUSD on-chain.
      const rlusdTxjson = buildRlusdPaymentTxjson({
        account: wallet,
        destination: dest,
        amountRlusd: amountNum,
      });
      if (!rlusdTxjson) {
        alert("Failed to build RLUSD payment.");
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
    if ((currency === "RLUSD" || currency === "USD") && sendPaymentRequest?.targetCurrencyCode) {
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
        displayCurrencyCode: (sendPaymentRequest?.displayCurrency ?? target) || null,
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
      })
    );

    const result = await signTransaction(txjson);
    if (result && result.signed) {
      alert("✅ Payment submitted via Xumm.");
      handleAddressSave(dest);

      setSendAmount("");
      setSendDestination("");
      setSendPaymentRequest(null);
      if (refreshBalance) {
        setTimeout(() => refreshBalance(), 3000);
      }
      return { ok: true };
    } else {
      alert("Transaction cancelled or expired.");
      return { ok: false };
    }
  }

  return { handleSendSubmit };
}
