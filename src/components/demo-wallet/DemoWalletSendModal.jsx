"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { bankButtonClassName } from "@/components/ui/bankButtonClassName";
import { Buffer } from "buffer";
import DemoWalletModalShell from "./DemoWalletModalShell";

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function base64UrlDecode(value) {
  const raw = String(value || "").trim();
  const token = raw.startsWith("xcannes-demo:payreq:") ?
  raw.slice("xcannes-demo:payreq:".length) :
  raw;
  const padded = token.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "===".slice((padded.length + 3) % 4);
  return Buffer.from(withPadding, "base64").toString("utf8");
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

export default function DemoWalletSendModal({
  open,
  onClose,
  activeWalletLabel,
  counterpartyLabel,
  currencyOptions,
  defaultCurrency,
  sendTab,
  setSendTab,
  activeWalletId,
  onSubmit
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  const [currency, setCurrency] = useState(defaultCurrency || "EUR");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [requestText, setRequestText] = useState("");
  const [requestParsed, setRequestParsed] = useState(null);

  const normalizedAmount = useMemo(
    () => safeNumber(String(amount).replace(",", ".")),
    [amount]
  );

  if (!open) return null;

  return (
    <DemoWalletModalShell
      open={open}
      onClose={() => {
        onClose?.();
        setError("");
      }}
      title={sendTab === "manual" ? t("demo_send_title", "Envoyer (démo)") : t("demo_pay_title", "Pay Request")}>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSendTab?.("manual")}
          title={t("demo_tt_send_manual", "Envoi manuel d'une transaction.")}
          className={[
          "flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors border",
          sendTab === "manual" ?
          "bg-xcannes-green text-black font-semibold border-xcannes-green/40" :
          "bg-white/5 text-white/60 hover:bg-white/10 border-white/10"].
          join(" ")}>

          {t("demo_send_tab_manual", "Manual Send")}
        </button>
        <button
          type="button"
          onClick={() => setSendTab?.("scan-request")}
          title={t("demo_tt_send_request", "Payer via un code de demande.")}
          className={[
          "flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors border",
          sendTab === "scan-request" ?
          "bg-xcannes-green text-black font-semibold border-xcannes-green/40" :
          "bg-white/5 text-white/60 hover:bg-white/10 border-white/10"].
          join(" ")}>

          {t("demo_send_tab_scan", "Scan Request")}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-[11px] text-white/60">
          <div>
            {t("demo_from", "De")}{" "}
            <span className="text-white/80">{activeWalletLabel}</span>
          </div>
          <div>
            {t("demo_to", "Vers")}{" "}
            <span className="text-white/80">{counterpartyLabel}</span>
          </div>
        </div>
      </div>

      {sendTab === "manual" ?
      <>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1">
              <div className="text-[11px] text-white/55">
                {t("demo_send_amount", "Montant")}
              </div>
              <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
              placeholder={t("demo_amount_placeholder", "e.g. 25")} />

              {normalizedAmount != null && normalizedAmount > 0 ?
            <div className="text-[11px] text-white/45">
                  {t("demo_send_preview", "Aperçu")}:{" "}
                  {formatUnits(locale, normalizedAmount)} {currency}
                </div> :
            null}
            </div>

            <div className="space-y-1">
              <div className="text-[11px] text-white/55">
                {t("demo_send_currency", "Devise")}
              </div>
              <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40">

                {currencyOptions.map((code) =>
              <option key={code} value={code}>
                    {code}
                  </option>
              )}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-white/55">
              {t("demo_send_memo", "Note (optionnel)")}
            </div>
            <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
            placeholder={t("demo_send_memo_placeholder", "e.g. lunch")} />

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
            const result = onSubmit?.({
              amount: parsed,
              currency,
              memo
            });
            if (result?.error) {
              setError(result.error);
              return;
            }
            onClose?.();
            setAmount("");
            setMemo("");
          }}
          className={bankButtonClassName({
            tone: "green",
            variant: "soft",
            size: "md",
            className: "w-full"
          })}
          title={t("demo_tt_send_cta", "Valider l'envoi.")}>

            {t("demo_send_cta", "Envoyer (démo)")} → {counterpartyLabel}
          </button>
        </> :

      <>
          <p className="text-xs text-white/55">
            {t("demo_scan_desc", "Collez un token de demande de paiement (démo).")}
          </p>
          <textarea
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          className="w-full min-h-[120px] rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/85 placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40 font-mono"
          placeholder={t("ui_xcannes_demo_payreq_fd58f93304", "xcannes-demo:payreq:...")} />


          <button
          type="button"
          onClick={() => {
            setError("");
            setRequestParsed(null);
            try {
              const decoded = base64UrlDecode(requestText);
              const json = JSON.parse(decoded);
              if (json?.schema !== "xcannes-demo-payreq-v1") {
                setError(t("demo_error_generic", "Action impossible (démo)."));
                return;
              }
              setRequestParsed(json);
            } catch {
              setError(t("demo_error_generic", "Action impossible (démo)."));
            }
          }}
          title={t("demo_tt_request_cta", "Charger une demande de paiement.")}
          className="w-full px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs transition-colors">

            {t("demo_scan_parse", "Charger la demande")}
          </button>

          {requestParsed ?
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 space-y-2">
              <div className="text-[11px] text-white/60">
                {t("demo_payreq_to", "To")}:{" "}
                <span className="text-white/85 font-semibold">
                  {t("demo_wallet_label", "Wallet")} {requestParsed.toWalletId}
                </span>
              </div>
              <div className="text-[11px] text-white/60">
                {t("demo_payreq_amount", "Amount")}:{" "}
                <span className="text-white/85 font-semibold">
                  {formatUnits(locale, requestParsed.amount)}{" "}
                  {String(requestParsed.displayCurrency || "").toUpperCase()}
                </span>
              </div>
              {requestParsed.memo ?
          <div className="text-[11px] text-white/50 truncate">
                  {t("demo_send_memo", "Note")}: {requestParsed.memo}
                </div> :
          null}
            </div> :
        null}

          {error ? <div className="text-xs text-red-300">{error}</div> : null}

          <button
          type="button"
          onClick={() => {
            setError("");
            if (!requestParsed) {
              setError(t("demo_error_generic", "Action impossible (démo)."));
              return;
            }
            const toWalletId = String(requestParsed.toWalletId || "").toUpperCase();
            const currencyReq = String(requestParsed.displayCurrency || "").toUpperCase();
            const amountReq = safeNumber(requestParsed.amount);
            if (!toWalletId || toWalletId === String(activeWalletId || "").toUpperCase()) {
              setError(t("demo_error_generic", "Action impossible (démo)."));
              return;
            }
            if (!amountReq || amountReq <= 0 || !currencyReq) {
              setError(t("demo_error_amount", "Montant invalide (démo)."));
              return;
            }
            const result = onSubmit?.({
              amount: amountReq,
              currency: currencyReq,
              memo: requestParsed.memo || "",
              toWalletId
            });
            if (result?.error) {
              setError(result.error);
              return;
            }
            onClose?.();
            setRequestText("");
            setRequestParsed(null);
          }}
          className={bankButtonClassName({
            tone: "green",
            variant: "soft",
            size: "md",
            className: "w-full"
          })}
          title={t("demo_tt_pay_cta", "Valider le paiement.")}>

            {t("demo_pay_cta", "Payer (démo)")} →
            {" "}
            {requestParsed ? `${t("demo_wallet_label", "Wallet")} ${requestParsed.toWalletId}` : counterpartyLabel}
          </button>
        </>
      }
    </DemoWalletModalShell>);

}
