/**
 * useDemoActions — all demo-wallet transactional handlers.
 *
 * Encapsulates:
 * - submitSend (FX spread, payreq validation, address normalization)
 * - handleSendSubmit (full UI-level send flow with address save)
 * - submitConvert / handleDemoConvert
 * - handleDemoBuy / handleDemoSell
 * - convert preview useEffect
 */

import { useEffect } from "react";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import {
  applyDemoBuySell,
  applyDemoConvert,
  applyDemoSend,
  ensureAllocation,
  isDemoNativeCurrency,
} from "../DemoWalletModel";
import { computeSpreadQuote } from "../utils/demoWalletSpread";
import {
  clone,
  getDemoLatencyMs,
  getMinUnitsForCurrency,
  sleep,
} from "../utils/demoWalletHelpers";

export function useDemoActions({
  state,
  setState,
  activeWalletId,
  walletAddress,
  effectiveUsdPerUnitRates,
  rlusdPerUnitRates,
  recordStatementHighlight,
  // send
  selectedSendToken,
  sendAmount,
  sendDestination,
  setSendDestination,
  sendPaymentRequest,
  setSendProcessing,
  setSendPaymentRequest,
  setActiveAction,
  demoSavedAddresses,
  saveDemoAddress,
  // convert
  convertBaseCurrency,
  convertQuoteCurrency,
  convertAmount,
  setConvertPreview,
  setConvertProcessing,
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  // ── Convert preview ──────────────────────────────────────────
  useEffect(() => {
    const amt = Number.parseFloat(convertAmount || "0");
    if (!Number.isFinite(amt) || amt <= 0) {
      setConvertPreview("");
      return;
    }
    const base = String(convertBaseCurrency || "").toUpperCase();
    const quote = String(convertQuoteCurrency || "").toUpperCase();
    if (!base || !quote || base === quote) {
      setConvertPreview("");
      return;
    }
    const baseUsd = Number(rlusdPerUnitRates?.[base] || 0);
    const quoteUsd = Number(rlusdPerUnitRates?.[quote] || 0);
    if (!baseUsd || !quoteUsd) {
      setConvertPreview("");
      return;
    }
    const usdGross = amt * baseUsd;
    const feeUsd = (usdGross * 100) / 10_000;
    const usdNet = Math.max(0, usdGross - feeUsd);
    const toAmount = usdNet / quoteUsd;
    const amountLabel = toAmount.toLocaleString(locale, {
      maximumFractionDigits: 6,
    });
    const usdLabel = usdNet.toLocaleString(locale, {
      maximumFractionDigits: 2,
    });
    const feeLabel = feeUsd.toLocaleString(locale, {
      maximumFractionDigits: 2,
    });
    const baseLabel = t("demo_quote_backed", "USD base");
    const feeLabelText = t("demo_quote_fee", "fee");
    setConvertPreview(
      `≈ ${amountLabel} ${quote} · ${baseLabel} ${usdLabel} · ${feeLabelText} ${feeLabel}`,
    );
  }, [
    convertAmount,
    convertBaseCurrency,
    convertQuoteCurrency,
    locale,
    rlusdPerUnitRates,
    setConvertPreview,
    t,
  ]);

  // ── Submit send (core logic) ─────────────────────────────────
  const submitSend = ({
    amount,
    currency,
    memo,
    toAddress,
    isFxSend,
    paymentRequest,
  }) => {
    const minUnits = getMinUnitsForCurrency(currency);
    if (!Number.isFinite(Number(amount)) || Number(amount) < minUnits) {
      return {
        error: t("demo_error_amount_too_small", "Amount too small (demo)."),
      };
    }

    let spreadFeeRlusd = 0;
    let fxRate = null;

    if (isFxSend) {
      const requestedFxRate =
        paymentRequest?.fxRate != null
          ? Number(paymentRequest.fxRate)
          : Number.NaN;
      const rawRate = Number(effectiveUsdPerUnitRates?.[currency]);
      const effectiveRate =
        Number.isFinite(requestedFxRate) && requestedFxRate > 0
          ? requestedFxRate
          : rawRate;
      if (!Number.isFinite(effectiveRate) || effectiveRate <= 0) {
        return {
          error: t(
            "demo_error_rates_stale",
            "Rates temporarily unavailable (demo). Please retry.",
          ),
        };
      }

      fxRate = effectiveRate;
      const paymentRlusd = Number(amount) * effectiveRate;
      const requestedRlusd =
        paymentRequest?.amountRlusd != null
          ? Number(paymentRequest.amountRlusd)
          : Number.NaN;
      if (Number.isFinite(requestedRlusd) && requestedRlusd > 0) {
        const diff = Math.abs(paymentRlusd - requestedRlusd);
        if (diff > Math.max(0.01, requestedRlusd * 0.005)) {
          const requestedLabel = requestedRlusd.toLocaleString(locale, {
            maximumFractionDigits: 6,
          });
          const computedLabel = paymentRlusd.toLocaleString(locale, {
            maximumFractionDigits: 6,
          });
          return {
            error: t("demo_error_payment_request_mismatch", {
              defaultValue:
                "Demande de paiement incohérente (démo).\n\nDemandé : ≈ {{requested}} USD\nCalculé : ≈ {{computed}} USD\n\nResscanez la demande ou réessayez.",
              requested: requestedLabel,
              computed: computedLabel,
            }),
          };
        }
      }

      const spread = computeSpreadQuote({
        base: currency,
        quote: "RLUSD",
        amountRlusd: paymentRlusd,
      });
      spreadFeeRlusd = Number(spread?.spreadFeeRlusd || 0);
    }

    const nextState = clone(state);

    if (isFxSend && spreadFeeRlusd > 0) {
      const fromWallet = nextState.wallets?.[activeWalletId];
      const availableUsd = Number(fromWallet?.allocations?.[currency] || 0);
      const amountUsd = Number(amount) * Number(fxRate || 0);
      const totalDebitUsd = amountUsd + Number(spreadFeeRlusd || 0);
      if (
        !Number.isFinite(availableUsd) ||
        availableUsd + 1e-9 < totalDebitUsd
      ) {
        return {
          error: t("demo_error_insufficient", "Solde insuffisant (démo)."),
        };
      }
    }

    const toWalletId =
      toAddress &&
      walletAddress &&
      String(toAddress).trim() === String(walletAddress).trim()
        ? activeWalletId
        : null;

    const result = applyDemoSend({
      state: nextState,
      fromWalletId: activeWalletId,
      toWalletId,
      toAddress,
      currencyCode: currency,
      amountUnits: amount,
      memo,
      ratesUsdPerUnit: effectiveUsdPerUnitRates,
    });
    if (!result.ok) {
      const message =
        result.error === "insufficient_funds"
          ? t("demo_error_insufficient", "Solde insuffisant (démo).")
          : result.error === "unsupported_currency"
            ? t("demo_error_unsupported", "Devise non supportée (démo).")
            : t("demo_error_generic", "Action impossible (démo).");
      return { error: message };
    }
    const sendEvent = result?.event || null;
    if (sendEvent?.id) {
      recordStatementHighlight(activeWalletId, currency, sendEvent.id);
    }

    if (isFxSend && spreadFeeRlusd > 0) {
      const fromWallet = nextState.wallets?.[activeWalletId];
      if (fromWallet) {
        ensureAllocation(fromWallet, currency);
        fromWallet.allocations[currency] = Number(
          (
            Number(fromWallet.allocations[currency] || 0) -
            Number(spreadFeeRlusd)
          ).toFixed(6),
        );
        ensureAllocation(fromWallet, "RLUSD");
        fromWallet.allocations.RLUSD = Number(
          (
            Number(fromWallet.allocations.RLUSD || 0) - Number(spreadFeeRlusd)
          ).toFixed(6),
        );
      }
    }

    setState(nextState);
    return { ok: true };
  };

  // ── Submit convert (core logic) ──────────────────────────────
  const submitConvert = ({ amount, from, to }) => {
    const minUnits = getMinUnitsForCurrency(from);
    if (!Number.isFinite(Number(amount)) || Number(amount) < minUnits) {
      return {
        error: t("demo_error_amount_too_small", "Amount too small (demo)."),
      };
    }
    const nextState = clone(state);
    const result = applyDemoConvert({
      state: nextState,
      walletId: activeWalletId,
      fromCurrencyCode: from,
      toCurrencyCode: to,
      amountUnits: amount,
      ratesUsdPerUnit: effectiveUsdPerUnitRates,
    });
    if (!result.ok) {
      const message =
        result.error === "insufficient_funds"
          ? t("demo_error_insufficient", "Solde insuffisant (démo).")
          : result.error === "invalid_pair"
            ? t("demo_error_pair", "Paire invalide (démo).")
            : t("demo_error_generic", "Action impossible (démo).");
      return { error: message };
    }
    setState(nextState);
    return { ok: true, event: result?.event || nextState?.events?.[0] || null };
  };

  // ── UI-level send handler ────────────────────────────────────
  const handleSendSubmit = async ({
    saveDestination = "",
    saveLabel = "",
  } = {}) => {
    if (!selectedSendToken) return { ok: false };
    const amountNum = Number.parseFloat(sendAmount || "0");
    if (!Number.isFinite(amountNum) || amountNum <= 0) return { ok: false };

    const normalizeDestination = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      if (/^xrpl:/i.test(raw)) {
        const cleaned = raw
          .replace(/^xrpl:\/\//i, "xrpl://")
          .replace(/^xrpl:/i, "xrpl://");
        try {
          const url = new URL(cleaned);
          const candidate =
            url.searchParams.get("to") ||
            url.searchParams.get("destination") ||
            (url.hostname && url.hostname !== "xrpl" ? url.hostname : "") ||
            (url.pathname || "").replace(/^\/+/, "");
          if (candidate) return candidate;
        } catch {
          // fall back to stripping prefix
        }
        return raw.replace(/^xrpl:\/*/i, "");
      }
      if (/^https?:/i.test(raw)) {
        try {
          const url = new URL(raw);
          const candidate =
            url.searchParams.get("to") ||
            url.searchParams.get("destination") ||
            "";
          if (candidate) return candidate;
          const host = url.hostname || "";
          const path = (url.pathname || "").replace(/^\/+/, "");
          if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(host)) return host;
          if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(path)) return path;
        } catch {
          // ignore
        }
      }
      return raw;
    };
    const dest = normalizeDestination(sendDestination);
    if (dest && dest !== String(sendDestination || "").trim()) {
      setSendDestination(dest);
    }
    if (!dest) {
      alert(
        t(
          "demo_error_destination_required",
          "Veuillez saisir une adresse de destination (démo).",
        ),
      );
      return { ok: false };
    }
    if (
      sendPaymentRequest?.to &&
      dest !== String(sendPaymentRequest.to).trim()
    ) {
      alert(
        t(
          "demo_error_request_destination_mismatch",
          "La destination de la demande de paiement ne correspond pas (démo).",
        ),
      );
      return { ok: false };
    }

    const currency = String(selectedSendToken.currency || "").toUpperCase();
    const requestTargetCurrency = String(
      sendPaymentRequest?.targetCurrencyCode || "",
    )
      .trim()
      .toUpperCase();
    if (requestTargetCurrency && requestTargetCurrency !== currency) {
      alert(
        t("demo_error_request_currency_mismatch", {
          defaultValue:
            "Cette demande est en {{currency}}.\nVeuillez sélectionner {{currency}} pour payer.",
          currency: requestTargetCurrency,
        }),
      );
      return { ok: false };
    }

    const isFxSend =
      selectedSendToken?.isTrustlineOnly && !isDemoNativeCurrency(currency);

    setSendProcessing(true);
    try {
      await sleep(getDemoLatencyMs());
      const res = submitSend({
        amount: amountNum,
        currency,
        memo: sendPaymentRequest?.memo || "",
        toAddress: dest,
        isFxSend,
        paymentRequest: sendPaymentRequest,
      });
      if (res?.error) {
        alert(res.error);
        return { ok: false };
      }
      const normalizedSaveDestination = String(saveDestination || "").trim();
      if (normalizedSaveDestination && normalizedSaveDestination === dest) {
        const isAlreadySaved = (demoSavedAddresses || []).some(
          (entry) => entry.address === normalizedSaveDestination,
        );
        if (!isAlreadySaved) {
          saveDemoAddress(
            normalizedSaveDestination,
            String(saveLabel || "").trim(),
          );
        }
      }
      setActiveAction(null);
      setSendPaymentRequest(null);
      return { ok: true };
    } finally {
      setSendProcessing(false);
    }
  };

  // ── Convert handler ──────────────────────────────────────────
  const handleDemoConvert = () => {
    void (async () => {
      const amt = Number.parseFloat(convertAmount || "0");
      if (!Number.isFinite(amt) || amt <= 0) return;
      const from = String(convertBaseCurrency || "").toUpperCase();
      const to = String(convertQuoteCurrency || "").toUpperCase();
      if (!from || !to || from === to) return;
      setConvertProcessing(true);
      try {
        await sleep(getDemoLatencyMs());
        const res = submitConvert({ amount: amt, from, to });
        if (res?.error) alert(res.error);
        if (res?.ok) {
          const event = res.event || {};
          if (event?.id) {
            const fromCode = event.fromCurrency || from;
            const toCode = event.toCurrency || to;
            if (fromCode)
              recordStatementHighlight(activeWalletId, fromCode, event.id);
            if (toCode)
              recordStatementHighlight(activeWalletId, toCode, event.id);
          }
        }
        setActiveAction(null);
      } finally {
        setConvertProcessing(false);
      }
    })();
  };

  // ── Cash (buy / sell) ────────────────────────────────────────
  const handleDemoBuy = async ({ amount }) => {
    await sleep(getDemoLatencyMs());
    const nextState = clone(state);
    const res = applyDemoBuySell({
      state: nextState,
      walletId: activeWalletId,
      side: "buy",
      amountUsd: Number(amount),
      memo: "MoonPay (demo)",
    });
    if (!res.ok)
      return {
        error: t("demo_error_generic", "Action impossible (démo)."),
      };
    const event = res?.event || null;
    if (event?.id) {
      recordStatementHighlight(activeWalletId, "RLUSD", event.id);
    }
    setState(nextState);
    return { ok: true };
  };

  const handleDemoSell = async ({ amount }) => {
    await sleep(getDemoLatencyMs());
    const nextState = clone(state);
    const res = applyDemoBuySell({
      state: nextState,
      walletId: activeWalletId,
      side: "sell",
      amountUsd: Number(amount),
      memo: "MoonPay (demo)",
    });
    if (!res.ok) {
      return {
        error:
          res.error === "insufficient_funds"
            ? t("demo_error_insufficient", "Solde insuffisant (démo).")
            : t("demo_error_generic", "Action impossible (démo)."),
      };
    }
    const event = res?.event || null;
    if (event?.id) {
      recordStatementHighlight(activeWalletId, "RLUSD", event.id);
    }
    setState(nextState);
    return { ok: true };
  };

  return {
    handleSendSubmit,
    handleDemoConvert,
    handleDemoBuy,
    handleDemoSell,
  };
}
