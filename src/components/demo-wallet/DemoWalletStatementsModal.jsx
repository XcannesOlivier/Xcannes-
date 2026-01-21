"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import DemoWalletModalShell from "./DemoWalletModalShell";
import DemoWalletDemoNotice from "./DemoWalletDemoNotice";
import {
  listWalletCurrencyEvents,
  listWalletEvents
} from "./DemoWalletModel";

const EMPTY_ALLOCATIONS = Object.freeze({});

function formatMoney(locale, amount, currency) {
  const safeLocale = locale || "en";
  try {
    return new Intl.NumberFormat(safeLocale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency}`;
  }
}

function formatUnits(locale, amount) {
  const safeLocale = locale || "en";
  try {
    return new Intl.NumberFormat(safeLocale, {
      maximumFractionDigits: 6,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

function formatShortDate(locale, ts) {
  try {
    return new Intl.DateTimeFormat(locale || "en", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

function getEventTypeForWallet(evt, walletId) {
  if (!evt) return "other";
  if (evt.kind === "convert") return "conversion";
  if (evt.kind === "buy") return "credit";
  if (evt.kind === "sell") return "debit";
  if (evt.kind === "send") {
    if (evt.from === walletId) return "debit";
    if (evt.to === walletId) return "credit";
  }
  return "other";
}

export default function DemoWalletStatementsModal({
  open,
  onClose,
  state,
  walletId,
  ratesUsdPerUnit,
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  const [view, setView] = useState("global"); // global | currency
  const [currency, setCurrency] = useState("USD");
  const [tab, setTab] = useState("all"); // all | credits | debits | conversions

  const wallet = state?.wallets?.[walletId] || null;
  const allocations = wallet?.allocations ?? EMPTY_ALLOCATIONS;

  const assetRows = useMemo(() => {
    return Object.entries(allocations)
      .map(([code, units]) => {
        const upper = String(code).toUpperCase();
        const unitsNum = Number(units) || 0;
        const usdPerUnit = ratesUsdPerUnit?.[upper] ?? null;
        const usdValue = usdPerUnit ? unitsNum * usdPerUnit : null;
        const type =
          upper === "USD"
            ? t("demo_stmt_type_usd", "USD stablecoin")
            : t("demo_stmt_type_fx", "Exchange Rate");
        return { code: upper, units: unitsNum, usdValue, type };
      })
      .sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));
  }, [allocations, ratesUsdPerUnit, t]);

  const walletEvents = useMemo(
    () => listWalletEvents(state, walletId),
    [state, walletId]
  );

  const currencyEvents = useMemo(
    () => listWalletCurrencyEvents(state, walletId, currency),
    [state, walletId, currency]
  );

  const filteredCurrencyEvents = useMemo(() => {
    if (tab === "all") return currencyEvents;
    if (tab === "credits") {
      return currencyEvents.filter(
        (evt) => getEventTypeForWallet(evt, walletId) === "credit"
      );
    }
    if (tab === "debits") {
      return currencyEvents.filter(
        (evt) => getEventTypeForWallet(evt, walletId) === "debit"
      );
    }
    if (tab === "conversions") {
      return currencyEvents.filter((evt) => evt.kind === "convert");
    }
    return currencyEvents;
  }, [currencyEvents, tab, walletId]);

  const title =
    view === "global"
      ? t("demo_global_statement_title", "Global Statement")
      : t("demo_currency_statement_title", "Statement");

  const subtitle =
    view === "global"
      ? t("demo_global_statement_subtitle", "Relevé fictif (démo).")
      : `${currency} · ${t("demo_currency_statement_subtitle", "Relevé fictif (démo).")}`;

  return (
    <DemoWalletModalShell
      open={open}
      onClose={() => {
        onClose?.();
        setView("global");
        setTab("all");
      }}
      title={title}
      subtitle={subtitle}
      maxWidthClassName="max-w-4xl"
    >
      <DemoWalletDemoNotice className="mb-1" />

      {view === "currency" ? (
        <button
          type="button"
          onClick={() => setView("global")}
          className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
        >
          <span aria-hidden>←</span> {t("demo_back_to_global", "Retour")}
        </button>
      ) : null}

      {view === "global" ? (
        <>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-white/70">
                <div className="text-white/85 font-semibold">
                  {t("demo_stmt_account_holder", "Account Holder")}:{" "}
                  <span className="text-white">{wallet?.label || "Wallet"}</span>
                </div>
                <div className="mt-1 text-[11px] text-white/45">
                  {t("demo_stmt_demo_note", "Toutes les données sont fictives.")}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-black/15">
            <div className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.5fr] gap-3 px-4 py-3 border-b border-white/10 text-[11px] text-white/55">
              <div>{t("demo_stmt_col_asset", "Asset")}</div>
              <div>{t("demo_stmt_col_type", "Type")}</div>
              <div className="text-right">{t("demo_stmt_col_balance", "Balance")}</div>
              <div className="text-right">{t("demo_stmt_col_action", "Action")}</div>
            </div>
            <div className="max-h-[46vh] overflow-y-auto">
              {assetRows.map((row) => (
                <div
                  key={row.code}
                  className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.5fr] gap-3 px-4 py-3 border-b border-white/5 items-center"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-white/90 font-semibold">
                      {row.code}
                    </div>
                    <div className="text-[11px] text-white/45">
                      {row.code === "USD"
                        ? t("demo_stmt_asset_usd", "USD base")
                        : t("demo_stmt_asset_fx", "Currency line")}
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70">
                      {row.type}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] text-white/85 font-mono">
                      {formatUnits(locale, row.units)} {row.code}
                    </div>
                    <div className="text-[11px] text-white/45">
                      {row.usdValue == null
                        ? "—"
                        : `≈ ${formatMoney(locale, row.usdValue, "USD")}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrency(row.code);
                        setView("currency");
                        setTab("all");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-xcannes-green/15 border border-xcannes-green/25 text-xcannes-green text-[11px] hover:bg-xcannes-green/20 transition-colors"
                    >
                      {t("demo_stmt_view", "View Statement")}
                    </button>
                  </div>
                </div>
              ))}

              {assetRows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-white/50">
                  {t("demo_stmt_empty", "No assets yet.")}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-white/40">
              {t("demo_stmt_generated", "Generated")}:{" "}
              {formatShortDate(locale, Date.now())}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs cursor-not-allowed"
                title={t("demo_stmt_export_disabled", "Disponible dans le wallet réel")}
              >
                {t("demo_stmt_export", "Export PDF")}
              </button>
              <button
                type="button"
                disabled
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs cursor-not-allowed"
                title={t("demo_stmt_print_disabled", "Disponible dans le wallet réel")}
              >
                {t("demo_stmt_print", "Print")}
              </button>
            </div>
          </div>

          {walletEvents.length ? (
            <div className="rounded-xl border border-white/10 bg-black/15 p-4">
              <div
                className="text-[12px] text-white/70 font-semibold"
                title={t("demo_tt_recent_activity", "Voir les dernières opérations.")}
              >
                {t("demo_stmt_recent_activity", "Recent activity")}
              </div>
              <div className="mt-2 space-y-2">
                {walletEvents.slice(0, 3).map((evt) => (
                  <div
                    key={evt.id}
                    title={t("demo_tt_recent_item", "Voir le détail de l'opération.")}
                    className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] text-white/80">
                        {evt.kind === "send"
                          ? `${t("demo_evt_send", "Envoi")} · ${evt.from} → ${evt.to}`
                          : evt.kind === "convert"
                            ? `${t("demo_evt_convert", "Conversion")} · ${evt.fromCurrency} → ${evt.toCurrency}`
                            : evt.kind === "buy"
                              ? `${t("demo_evt_buy", "Buy")} · ${String(evt.currency || "USD").toUpperCase()}`
                              : evt.kind === "sell"
                                ? `${t("demo_evt_sell", "Sell")} · ${String(evt.currency || "USD").toUpperCase()}`
                                : evt.kind}
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/45 truncate">
                        {evt.kind === "send"
                          ? `${formatUnits(locale, evt.amount)} ${evt.currency}${evt.memo ? ` · ${evt.memo}` : ""}`
                          : evt.kind === "convert"
                            ? `${formatUnits(locale, evt.fromAmount)} ${evt.fromCurrency} → ${formatUnits(locale, evt.toAmount)} ${evt.toCurrency}`
                            : evt.amount
                              ? `${formatUnits(locale, evt.amount)} ${evt.currency}`
                              : ""}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-white/45">
                      {formatShortDate(locale, evt.ts)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] text-white/55">
                  {t("demo_stmt_wallet", "Wallet")}
                </div>
                <div className="text-sm font-semibold text-white">
                  {wallet?.label || "Wallet"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-white/55">
                  {t("demo_stmt_balance", "Balance")}
                </div>
                <div className="text-sm font-semibold text-white">
                  {formatUnits(locale, allocations?.[currency] || 0)} {currency}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { key: "all", label: t("demo_stmt_tab_all", "All") },
                { key: "credits", label: t("demo_stmt_tab_credits", "Credits") },
                { key: "debits", label: t("demo_stmt_tab_debits", "Debits") },
                {
                  key: "conversions",
                  label: t("demo_stmt_tab_conversions", "Conversions"),
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  title={t(`demo_tt_stmt_tab_${item.key}`, "Filtrer les opérations.")}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs transition-colors border",
                    tab === item.key
                      ? "bg-xcannes-green/20 border-xcannes-green/30 text-xcannes-green"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-black/15">
            <div className="grid grid-cols-[0.8fr_1.6fr_0.8fr] gap-3 px-4 py-3 border-b border-white/10 text-[11px] text-white/55">
              <div>{t("demo_stmt_col_date", "Date")}</div>
              <div>{t("demo_stmt_col_desc", "Description")}</div>
              <div className="text-right">{t("demo_stmt_col_amount", "Amount")}</div>
            </div>
            <div className="max-h-[46vh] overflow-y-auto">
              {filteredCurrencyEvents.map((evt) => {
                const type = getEventTypeForWallet(evt, walletId);
                const sign =
                  type === "credit" ? "+" : type === "debit" ? "-" : "";
                const amount =
                  evt.kind === "convert"
                    ? evt.fromCurrency?.toUpperCase() === currency
                      ? evt.fromAmount
                      : evt.toAmount
                    : evt.amount;
                const amountText = `${sign}${formatUnits(locale, amount || 0)} ${
                  currency
                }`;
                const desc =
                  evt.kind === "send"
                    ? type === "credit"
                      ? t("demo_stmt_desc_receive", "Receive")
                      : t("demo_stmt_desc_send", "Send")
                    : evt.kind === "convert"
                      ? t("demo_stmt_desc_convert", "Exchange")
                      : evt.kind === "buy"
                        ? t("demo_stmt_desc_buy", "Buy")
                        : evt.kind === "sell"
                          ? t("demo_stmt_desc_sell", "Sell")
                          : String(evt.kind || "—");
                const meta =
                  evt.kind === "send"
                    ? type === "credit"
                      ? `${t("demo_stmt_from", "from")} ${evt.from}`
                      : `${t("demo_stmt_to", "to")} ${evt.to}`
                    : evt.kind === "convert"
                      ? `${evt.fromCurrency} → ${evt.toCurrency}`
                      : evt.memo
                        ? evt.memo
                        : "";
                const color =
                  type === "credit"
                    ? "text-emerald-300"
                    : type === "debit"
                      ? "text-red-300"
                      : "text-white/70";
                return (
                  <div
                    key={evt.id}
                    className="grid grid-cols-[0.8fr_1.6fr_0.8fr] gap-3 px-4 py-3 border-b border-white/5 items-center"
                  >
                    <div className="text-[11px] text-white/50">
                      {formatShortDate(locale, evt.ts)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] text-white/85 font-semibold">
                        {desc}
                      </div>
                      <div className="text-[11px] text-white/45 truncate">
                        {meta || "—"}
                      </div>
                    </div>
                    <div className={["text-right text-[12px] font-mono", color].join(" ")}>
                      {amountText}
                    </div>
                  </div>
                );
              })}

              {filteredCurrencyEvents.length === 0 ? (
                <div className="px-4 py-6 text-sm text-white/50">
                  {t("demo_stmt_no_activity", "No activity yet.")}
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </DemoWalletModalShell>
  );
}
