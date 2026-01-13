"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatUnits(locale, amount) {
  const safeLocale = locale || "en";
  try {
    return new Intl.NumberFormat(safeLocale, { maximumFractionDigits: 2 }).format(
      amount
    );
  } catch {
    return String(amount);
  }
}

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

export default function DemoWalletConvertModal({
  open,
  onClose,
  walletLabel,
  currencyOptions,
  defaultFrom,
  defaultTo,
  ratesUsdPerUnit,
  spreadBps = 60,
  onSubmit,
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  const [from, setFrom] = useState(defaultFrom || "EUR");
  const [to, setTo] = useState(defaultTo || "MXN");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const normalizedAmount = useMemo(
    () => safeNumber(String(amount).replace(",", ".")),
    [amount]
  );

  const quote = useMemo(() => {
    if (!normalizedAmount || normalizedAmount <= 0) return null;
    const fromUsd = ratesUsdPerUnit?.[String(from || "").toUpperCase()] ?? null;
    const toUsd = ratesUsdPerUnit?.[String(to || "").toUpperCase()] ?? null;
    if (!fromUsd || !toUsd) return null;
    if (!from || !to || String(from).toUpperCase() === String(to).toUpperCase()) return null;
    const usdGross = normalizedAmount * fromUsd;
    const feeUsd = (usdGross * spreadBps) / 10_000;
    const usdNet = Math.max(0, usdGross - feeUsd);
    const toAmount = usdNet / toUsd;
    return { toAmount, usdGross, feeUsd, usdNet };
  }, [from, normalizedAmount, ratesUsdPerUnit, spreadBps, to]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-elevated border border-white/10 rounded-2xl p-4 md:p-5 space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto demo-wallet-tooltip-scope"
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl"
            aria-label={t("demo_close", "Fermer")}
          >
            ✕
          </button>

          <div className="pr-6">
            <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
              {t("demo_convert_title", "Convertir (démo)")}
            </h3>
            <p className="mt-1 text-xs text-white/60">
              {t("demo_convert_subtitle", "Simulation de conversion entre lignes de devises.")}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-white/60">
            {t("demo_wallet_label", "Wallet")}{" "}
            <span className="text-white/80">{walletLabel}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-[11px] text-white/55">{t("demo_convert_from", "De")}</div>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
              >
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-white/55">{t("demo_convert_to", "Vers")}</div>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
              >
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-white/55">{t("demo_convert_amount", "Montant")}</div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
              placeholder={t("demo_amount_placeholder", "e.g. 25")}
            />
            {normalizedAmount != null && normalizedAmount > 0 ? (
              <div className="text-[11px] text-white/45">
                {t("demo_send_preview", "Aperçu")}: {formatUnits(locale, normalizedAmount)} {from}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl bg-black/25 border border-white/10 px-4 py-3">
            <div className="text-[11px] text-white/55">{t("demo_quote", "Aperçu")}</div>
            <div className="mt-1 text-sm text-white/90">
              {quote
                ? `${formatUnits(locale, quote.toAmount)} ${to}`
                : "—"}
            </div>
            <div className="mt-1 text-[11px] text-white/45">
              {quote
                ? `${t("demo_quote_backed", "Base USD")} ${formatMoney(
                    locale,
                    quote.usdNet,
                    "USD"
                  )} · ${t("demo_quote_fee", "frais")} ${formatMoney(
                    locale,
                    quote.feeUsd,
                    "USD"
                  )}`
                : t("demo_quote_hint", "Saisissez un montant pour voir l’estimation.")}
            </div>
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
              if (!from || !to || from === to) {
                setError(t("demo_error_pair", "Paire invalide (démo)."));
                return;
              }
              const result = onSubmit?.({ amount: parsed, from, to });
              if (result?.error) {
                setError(result.error);
                return;
              }
              onClose?.();
              setAmount("");
            }}
            className={bankButtonClassName({
              tone: "blue",
              variant: "soft",
              size: "md",
              className: "w-full",
            })}
            title={t("demo_tt_convert_cta", "Confirmer la conversion.")}
          >
            {t("demo_convert_cta", "Convertir (démo)")} →
          </button>
        </div>
      </div>
    </>
  );
}
