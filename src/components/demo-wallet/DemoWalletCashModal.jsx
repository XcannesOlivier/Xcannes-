"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import DemoWalletModalShell from "./DemoWalletModalShell";
import DemoWalletDemoNotice from "./DemoWalletDemoNotice";
import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatMoney(locale, amount, currency) {
  try {
    return new Intl.NumberFormat(locale || "en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency}`;
  }
}

export default function DemoWalletCashModal({
  open,
  onClose,
  walletLabel,
  usdBalance,
  tab,
  setTab,
  onSubmit, // ({ side, amountUsd, memo }) => { ok?: true, error?: string }
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");

  const normalizedAmount = useMemo(
    () => safeNumber(String(amount).replace(",", ".")),
    [amount]
  );

  return (
    <DemoWalletModalShell
      open={open}
      onClose={() => {
        onClose?.();
        setError("");
      }}
      title={t("demo_cash_title", "Fiat Gateway (demo)")}
      subtitle={t(
        "demo_cash_subtitle",
        "Simulation d’achat/vente en USD — aucune redirection MoonPay."
      )}
    >
      <DemoWalletDemoNotice className="mb-1" />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab?.("buy")}
          className={[
            "flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors border",
            tab === "buy"
              ? "bg-xcannes-green text-black font-semibold border-xcannes-green/40"
              : "bg-white/5 text-white/60 hover:bg-white/10 border-white/10",
          ].join(" ")}
        >
          {t("demo_cash_tab_buy", "Buy USD")}
        </button>
        <button
          type="button"
          onClick={() => setTab?.("sell")}
          className={[
            "flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors border",
            tab === "sell"
              ? "bg-orange-500 text-black font-semibold border-orange-500/40"
              : "bg-white/5 text-white/60 hover:bg-white/10 border-white/10",
          ].join(" ")}
        >
          {t("demo_cash_tab_sell", "Sell USD")}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <div>
            {t("demo_stmt_wallet", "Wallet")}:{" "}
            <span className="text-white/85 font-semibold">{walletLabel}</span>
          </div>
          <div className="text-right">
            {t("demo_cash_usd_balance", "USD balance")}:{" "}
            <span className="text-white/85 font-semibold">
              {formatMoney(locale, usdBalance || 0, "USD")}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-[11px] text-white/55">
          {t("demo_cash_amount_usd", "Amount in USD")}
        </div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
          placeholder={t("demo_cash_amount_placeholder", "e.g. 100")}
        />
        {normalizedAmount != null && normalizedAmount > 0 ? (
          <div className="text-[11px] text-white/45">
            {t("demo_quote", "Aperçu")}: {formatMoney(locale, normalizedAmount, "USD")}
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <div className="text-[11px] text-white/55">{t("demo_send_memo", "Note (optionnel)")}</div>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
          placeholder={t("demo_send_memo_placeholder", "e.g. lunch")}
        />
      </div>

      {error ? <div className="text-xs text-red-300">{error}</div> : null}

      <button
        type="button"
        onClick={() => {
          setError("");
          const parsed = safeNumber(String(amount).replace(",", "."));
          if (!parsed || parsed <= 0) {
            setError(t("demo_error_amount", "Montant invalide (démo)."));
            return;
          }
          const side = tab === "sell" ? "sell" : "buy";
          const result = onSubmit?.({ side, amountUsd: parsed, memo });
          if (result?.error) {
            setError(result.error);
            return;
          }
          onClose?.();
          setAmount("");
          setMemo("");
        }}
        className={bankButtonClassName({
          tone: tab === "sell" ? "orange" : "green",
          variant: "soft",
          size: "md",
          className: "w-full",
        })}
      >
        {tab === "sell"
          ? t("demo_cash_cta_sell", "Sell (demo)")
          : t("demo_cash_cta_buy", "Buy (demo)")}
      </button>

      <div className="text-[11px] text-white/45">
        {t(
          "demo_cash_note",
          "Dans le wallet réel, l’achat/vente est géré par MoonPay (selon disponibilité)."
        )}
      </div>
    </DemoWalletModalShell>
  );
}
