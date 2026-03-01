/**
 * useDemoStatementData — wallet events, global movements, per-currency
 * transactions, statement balance & transaction-highlight tracking.
 *
 * Encapsulates the heavy statement-building logic that was inline in the
 * Dashboard so the main component stays focused on orchestration.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import {
  getWalletAddress,
  isDemoNativeCurrency,
} from "../DemoWalletModel";
import {
  formatDemoAddressShort,
} from "../utils/demoWalletHelpers";
import {
  getDisplayCurrencyCode,
} from "../demoWalletDashboardConfig";

export function useDemoStatementData({
  state,
  activeWalletId,
  activeWallet,
  rlusdPerUnitRates,
  selectedStatementToken,
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  const rlusdPerUnitRatesRef = useRef(rlusdPerUnitRates);
  useEffect(() => {
    rlusdPerUnitRatesRef.current = rlusdPerUnitRates;
  }, [rlusdPerUnitRates]);

  // ── Statement highlight tracking ──
  const [statementHighlightByWallet, setStatementHighlightByWallet] = useState(
    {},
  );

  const recordStatementHighlight = useCallback(
    (walletId, currency, eventId) => {
      if (!walletId || !currency || !eventId) return;
      const walletKey = String(walletId).trim().toUpperCase();
      const currencyKey = String(currency).trim().toUpperCase();
      setStatementHighlightByWallet((prev) => {
        const next = { ...prev };
        const walletMap = { ...(next[walletKey] || {}) };
        walletMap[currencyKey] = { eventId, ts: Date.now() };
        next[walletKey] = walletMap;
        return next;
      });
    },
    [],
  );

  const resetStatementHighlights = useCallback(() => {
    setStatementHighlightByWallet({});
  }, []);

  // ── Wallet events (newest → oldest) ──
  const walletEvents = useMemo(() => {
    return (state.events || []).filter((evt) => {
      if (!evt) return false;
      if (evt.kind === "send") {
        return evt.from === activeWalletId || evt.to === activeWalletId;
      }
      if (evt.wallet) return evt.wallet === activeWalletId;
      return false;
    });
  }, [activeWalletId, state.events]);

  // ── Global movements (for the global statement modal) ──
  const previewGlobalMovements = useMemo(() => {
    const resolveEventUsdValue = (evt) => {
      const usdValue = Number(evt?.usdValue);
      if (Number.isFinite(usdValue)) return usdValue;
      const code = String(evt?.currency || "").toUpperCase();
      const rate = Number(rlusdPerUnitRates?.[code] || 0);
      const amount = Number(evt?.amount || 0);
      if (code === "RLUSD") return amount;
      return rate > 0 ? amount * rate : amount;
    };

    return (walletEvents || []).map((evt) => {
      if (evt.kind === "convert") {
        return {
          movementId: evt.id,
          createdAt: new Date(evt.ts).toISOString(),
          fromCurrencyCode: evt.fromCurrency,
          toCurrencyCode: evt.toCurrency,
          amountRlusd: evt.usdNet ?? evt.usdGross ?? 0,
        };
      }
      if (evt.kind === "send") {
        const rate = Number(rlusdPerUnitRates?.[evt.currency] || 0);
        const amountRlusd =
          String(evt.currency).toUpperCase() === "RLUSD"
            ? evt.amount
            : rate > 0
              ? Number(evt.amount || 0) * rate
              : 0;
        return {
          movementId: evt.id,
          createdAt: new Date(evt.ts).toISOString(),
          fromCurrencyCode: evt.currency,
          toCurrencyCode: evt.currency,
          amountRlusd,
        };
      }
      if (evt.kind === "buy" || evt.kind === "sell") {
        const evtCurrency = String(evt.currency || "RLUSD").toUpperCase();
        const amountRlusd = resolveEventUsdValue(evt);
        return {
          movementId: evt.id,
          createdAt: new Date(evt.ts).toISOString(),
          fromCurrencyCode: evt.kind === "buy" ? "USD" : evtCurrency,
          toCurrencyCode: evt.kind === "buy" ? evtCurrency : "USD",
          amountRlusd,
        };
      }
      return {
        movementId: evt.id,
        createdAt: new Date(evt.ts).toISOString(),
        fromCurrencyCode: evt.currency || "RLUSD",
        toCurrencyCode: evt.currency || "RLUSD",
        amountRlusd: evt.amount || 0,
      };
    });
  }, [rlusdPerUnitRates, walletEvents]);

  // ── Per-currency transactions (for the currency statement modal) ──
  const [previewCurrencyTransactions, setPreviewCurrencyTransactions] =
    useState([]);

  useEffect(() => {
    if (!selectedStatementToken) {
      setPreviewCurrencyTransactions([]);
      return;
    }
    const currency = String(
      selectedStatementToken.currency || "",
    ).toUpperCase();
    const events = walletEvents || [];
    const ratesSnapshot = rlusdPerUnitRatesRef.current || {};
    let running = Number(activeWallet?.allocations?.[currency]) || 0;
    const runningRate = Number(ratesSnapshot?.[currency] || 0);
    if (!isDemoNativeCurrency(currency) && runningRate > 0) {
      running = running / runningRate;
    }
    const txs = [];

    events.forEach((evt) => {
      const createdAt = new Date(evt.ts).toISOString();
      const runningSnapshot = running;
      let amount = 0;
      let delta = 0;
      let type = "credit";
      let category = "other";
      let description = t("demo_statement_movement", "Mouvement");
      let counterparty = "";
      let postEventTx = null;

      if (
        evt.kind === "send" &&
        String(evt.currency).toUpperCase() === currency
      ) {
        amount = Number(evt.amount || 0);
        if (evt.from === activeWalletId) {
          delta = -amount;
          type = "debit";
          const destAddress = String(
            evt.toAddress || (evt.to ? getWalletAddress(state, evt.to) : ""),
          ).trim();
          const destLabel =
            String(evt.toLabel || "").trim() ||
            formatDemoAddressShort(destAddress) ||
            (evt.to ? String(evt.to) : "");
          counterparty = destAddress || destLabel;
          description = evt.to
            ? t("demo_statement_send_to_wallet", {
                defaultValue: "Envoyé à {{walletId}}",
                walletId: evt.to,
              })
            : t("demo_statement_send_to", {
                defaultValue: "Envoyé à {{to}}",
                to: destLabel || t("demo_counterparty_unknown", "Destination"),
              });
        } else if (evt.to === activeWalletId) {
          delta = amount;
          type = "credit";
          const srcAddress = String(
            evt.fromAddress ||
              (evt.from ? getWalletAddress(state, evt.from) : ""),
          ).trim();
          const srcLabel =
            String(evt.fromLabel || "").trim() ||
            formatDemoAddressShort(srcAddress) ||
            (evt.from ? String(evt.from) : "");
          counterparty = srcAddress || srcLabel;
          description = evt.from
            ? t("demo_statement_receive_from_wallet", {
                defaultValue: "Recevoir depuis le wallet {{walletId}}",
                walletId: evt.from,
              })
            : t("demo_statement_receive_from", {
                defaultValue: "Reçu de {{from}}",
                from: srcLabel || t("demo_counterparty_unknown", "Source"),
              });
        } else {
          return;
        }
      } else if (evt.kind === "convert") {
        category = "exchange";
        if (String(evt.fromCurrency).toUpperCase() === currency) {
          type = "debit";
          amount = Number(evt.fromAmount || 0);
          delta = -amount;
          description = t("demo_statement_exchange", {
            defaultValue: "Conversion {{fromCurrency}} → {{toCurrency}}",
            fromCurrency: evt.fromCurrency,
            toCurrency: evt.toCurrency,
          });
        } else if (String(evt.toCurrency).toUpperCase() === currency) {
          type = "credit";
          amount = Number(evt.toAmount || 0);
          delta = amount;
          description = t("demo_statement_exchange", {
            defaultValue: "Conversion {{fromCurrency}} → {{toCurrency}}",
            fromCurrency: evt.fromCurrency,
            toCurrency: evt.toCurrency,
          });
          const feeUsd = Number(evt.feeUsd || 0);
          const quoteRate = Number(ratesSnapshot?.[currency] || 0);
          const fromLabel = getDisplayCurrencyCode(evt.fromCurrency);
          const toLabel = getDisplayCurrencyCode(evt.toCurrency);
          const feeQuote =
            Number.isFinite(feeUsd) && feeUsd > 0 && quoteRate > 0
              ? feeUsd / quoteRate
              : 0;
          if (Number.isFinite(feeQuote) && feeQuote > 0) {
            const feeUsdLabel = feeUsd.toLocaleString(locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            postEventTx = {
              id: `${evt.id}_fee`,
              date: createdAt,
              createdAt,
              category: "fee",
              type: "debit",
              description: t("demo_statement_fee_spread_pair", {
                defaultValue:
                  "Frais conversion {{fromCurrency}} → {{toCurrency}} ({{fee}} USD)",
                fromCurrency: fromLabel,
                toCurrency: toLabel,
                fee: feeUsdLabel,
              }),
              counterparty: "",
              amount: feeQuote,
              runningBalance: runningSnapshot,
              displayRunningBalance: runningSnapshot,
              suppressDescriptionFlags: true,
            };
          }
        } else {
          return;
        }
      } else if (
        evt.kind === "buy" &&
        String(evt.currency || "").toUpperCase() === currency
      ) {
        category = "buy";
        type = "credit";
        amount = Number(evt.amount || 0);
        delta = amount;
        description = t(
          "demo_statement_buy_moonpay",
          "Achat via MoonPay (démo)",
        );
      } else if (
        evt.kind === "sell" &&
        String(evt.currency || "").toUpperCase() === currency
      ) {
        category = "sell";
        type = "debit";
        amount = Number(evt.amount || 0);
        delta = -amount;
        description = t(
          "demo_statement_sell_moonpay",
          "Vente via MoonPay (démo)",
        );
      } else if (
        evt.kind === "spread_fee" &&
        String(evt.currency).toUpperCase() === currency &&
        evt.wallet === activeWalletId
      ) {
        category = "fee";
        type = "debit";
        amount = Number(evt.amount || 0);
        delta = -amount;
        description = t(
          "demo_statement_fee_spread",
          "Frais de conversion (1 %)",
        );
      } else if (
        evt.kind === "trustline_add" &&
        String(evt.currency).toUpperCase() === currency &&
        evt.wallet === activeWalletId
      ) {
        category = "operation";
        type = "credit";
        amount = 0;
        delta = 0;
        description = t("demo_statement_trustline_add", {
          defaultValue: "Activation de ligne {{currency}}",
          currency,
        });
      } else if (
        evt.kind === "trustline_remove" &&
        String(evt.currency).toUpperCase() === currency &&
        evt.wallet === activeWalletId
      ) {
        category = "operation";
        type = "debit";
        amount = 0;
        delta = 0;
        description = t("demo_statement_trustline_remove", {
          defaultValue: "Désactivation de ligne {{currency}}",
          currency,
        });
      } else {
        return;
      }

      if (!Number.isFinite(amount) || (amount <= 0 && category !== "operation"))
        return;

      txs.push({
        id: evt.id,
        date: createdAt,
        createdAt,
        category,
        type,
        description,
        counterparty,
        amount,
        runningBalance: running,
      });
      running -= delta;

      if (postEventTx) {
        txs.push(postEventTx);
      }
    });

    setPreviewCurrencyTransactions(txs);
  }, [
    activeWallet?.allocations,
    activeWalletId,
    locale,
    selectedStatementToken,
    state,
    t,
    walletEvents,
  ]);

  // ── Statement balance ──
  const statementBalance = useMemo(() => {
    if (!selectedStatementToken) return null;
    const currency = String(
      selectedStatementToken.currency || "",
    ).toUpperCase();
    const isDerivedUsd = Boolean(selectedStatementToken?.isDerivedUsd);
    let currentBalance = 0;
    if (currency === "USD" || (currency === "RLUSD" && isDerivedUsd)) {
      const allocations = activeWallet?.allocations || {};
      const rlusdOnChain = Number(allocations?.RLUSD || 0);
      const totalAllocatedUsd = Object.entries(allocations).reduce(
        (sum, [code, value]) => {
          const upper = String(code || "").toUpperCase();
          if (upper === "RLUSD" || upper === "XRP" || upper === "USD")
            return sum;
          return sum + (Number(value) || 0);
        },
        0,
      );
      currentBalance = Math.max(0, rlusdOnChain - totalAllocatedUsd);
    } else {
      const stored = Number(activeWallet?.allocations?.[currency] || 0);
      if (isDemoNativeCurrency(currency)) {
        currentBalance = stored;
      } else {
        const rate = Number(rlusdPerUnitRates?.[currency] || 0);
        if (!Number.isFinite(rate) || rate <= 0) return null;
        currentBalance = stored / rate;
      }
    }
    return Number.isFinite(currentBalance) ? currentBalance : null;
  }, [activeWallet?.allocations, rlusdPerUnitRates, selectedStatementToken]);

  // ── Patch first transaction's running balance when statement opens ──
  useEffect(() => {
    if (statementBalance == null) return;
    setPreviewCurrencyTransactions((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const first = prev[0];
      if (!first) return prev;
      if (Number(first.displayRunningBalance) === Number(statementBalance))
        return prev;
      const next = [...prev];
      next[0] = { ...first, displayRunningBalance: statementBalance };
      return next;
    });
  }, [statementBalance]);

  // ── Highlight transaction ID (for statement modal scroll-to) ──
  const highlightTransactionId = useMemo(() => {
    if (!selectedStatementToken) return null;
    const walletKey = String(activeWalletId || "")
      .trim()
      .toUpperCase();
    const currencyKey = String(selectedStatementToken.currency || "")
      .trim()
      .toUpperCase();
    const walletMap = statementHighlightByWallet[walletKey] || {};
    return walletMap?.[currencyKey]?.eventId || null;
  }, [activeWalletId, selectedStatementToken, statementHighlightByWallet]);

  return {
    recordStatementHighlight,
    resetStatementHighlights,
    previewGlobalMovements,
    previewCurrencyTransactions,
    statementBalance,
    highlightTransactionId,
  };
}
