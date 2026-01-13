"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { QRCodeCanvas } from "qrcode.react";
import { Buffer } from "buffer";
import DemoWalletModalShell from "./DemoWalletModalShell";

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function base64UrlEncode(value) {
  const b64 = Buffer.from(String(value || ""), "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

export default function DemoWalletReceiveModal({
  open,
  onClose,
  receiveTab,
  setReceiveTab,
  walletLabel,
  walletId,
  walletAddress,
  currencyOptions,
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  const [requestAmount, setRequestAmount] = useState("");
  const [requestCurrency, setRequestCurrency] = useState(
    currencyOptions?.[0] || "USD"
  );
  const [requestMemo, setRequestMemo] = useState("");
  const [generatedRequest, setGeneratedRequest] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const normalizedAmount = useMemo(
    () => safeNumber(String(requestAmount).replace(",", ".")),
    [requestAmount]
  );

  const requestPayload = useMemo(() => {
    if (!generatedRequest) return "";
    try {
      return JSON.stringify(generatedRequest);
    } catch {
      return "";
    }
  }, [generatedRequest]);

  const requestToken = useMemo(() => {
    if (!requestPayload) return "";
    const encoded = base64UrlEncode(requestPayload);
    return `xcannes-demo:payreq:${encoded}`;
  }, [requestPayload]);

  const handleCopy = async (value) => {
    setCopied(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // noop
    }
  };

  const handleGenerate = () => {
    setError("");
    const amount = normalizedAmount;
    if (!amount || amount <= 0) {
      setError(t("demo_error_amount", "Montant invalide (démo)."));
      return;
    }
    const currency = String(requestCurrency || "").toUpperCase();
    if (!currency) {
      setError(t("demo_error_unsupported", "Devise non supportée (démo)."));
      return;
    }

    setGeneratedRequest({
      schema: "xcannes-demo-payreq-v1",
      toWalletId: walletId,
      to: walletAddress,
      displayCurrency: currency,
      amount,
      memo: String(requestMemo || "").slice(0, 80),
      createdAt: new Date().toISOString(),
      note: "DEMO_ONLY",
    });
  };

  return (
    <DemoWalletModalShell
      open={open}
      onClose={() => {
        onClose?.();
        setError("");
      }}
      title={
        receiveTab === "receive"
          ? t("demo_receive_title", "Receive assets (demo)")
          : t("demo_payreq_title", "Request payment (demo)")
      }
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setReceiveTab?.("receive")}
          title={t("demo_tt_receive_tab", "Afficher l'adresse pour recevoir.")}
          className={[
            "flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors border",
            receiveTab === "receive"
              ? "bg-xcannes-green text-black font-semibold border-xcannes-green/40"
              : "bg-white/5 text-white/60 hover:bg-white/10 border-white/10",
          ].join(" ")}
        >
          {t("demo_receive_tab_receive", "Receive")}
        </button>
        <button
          type="button"
          onClick={() => setReceiveTab?.("request")}
          title={t("demo_tt_request_tab", "Créer une demande de paiement.")}
          className={[
            "flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors border",
            receiveTab === "request"
              ? "bg-xcannes-green text-black font-semibold border-xcannes-green/40"
              : "bg-white/5 text-white/60 hover:bg-white/10 border-white/10",
          ].join(" ")}
        >
          {t("demo_receive_tab_request", "Request Payment")}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="text-[11px] text-white/60">
          {t("demo_wallet_label", "Wallet")}:{" "}
          <span className="text-white/85 font-semibold">{walletLabel}</span>
        </div>
      </div>

      {receiveTab === "receive" ? (
        <>
          <div className="flex items-center justify-center">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <QRCodeCanvas
                value={walletAddress || ""}
                size={180}
                includeMargin
                bgColor="#0B1220"
                fgColor="#FFFFFF"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] text-white/55">
              {t("demo_receive_address", "Address")}
            </div>
            <div className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/80 font-mono break-all">
              {walletAddress}
            </div>
            <button
              type="button"
              onClick={() => handleCopy(walletAddress)}
              title={t("demo_tt_copy_address", "Copier l'adresse du wallet.")}
              className="w-full px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs transition-colors"
            >
              {copied
                ? t("demo_copied", "Copié")
                : t("demo_copy_address", "Copy address")}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1">
              <div className="text-[11px] text-white/55">
                {t("demo_send_amount", "Montant")}
              </div>
              <input
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
                placeholder={t("demo_amount_placeholder", "e.g. 25")}
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-white/55">
                {t("demo_send_currency", "Devise")}
              </div>
              <select
                value={requestCurrency}
                onChange={(e) => setRequestCurrency(e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
              >
                {(currencyOptions || ["USD"]).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-white/55">
              {t("demo_send_memo", "Note (optionnel)")}
            </div>
            <input
              value={requestMemo}
              onChange={(e) => setRequestMemo(e.target.value)}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
              placeholder={t("demo_send_memo_placeholder", "e.g. lunch")}
            />
          </div>

          {error ? <div className="text-xs text-red-300">{error}</div> : null}

          <button
            type="button"
            onClick={handleGenerate}
            title={t("demo_tt_generate_request", "Générer un code de demande.")}
            className="w-full px-4 py-2 rounded-lg bg-xcannes-green/20 hover:bg-xcannes-green/30 border border-xcannes-green/25 text-xcannes-green text-sm font-semibold transition-colors"
          >
            {t("demo_payreq_generate", "Generate Request")}
          </button>

          {generatedRequest ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
              <div className="text-[11px] text-white/60">
                {t("demo_quote", "Aperçu")}:{" "}
                <span className="text-white/85 font-semibold">
                  {formatMoney(locale, generatedRequest.amount, generatedRequest.displayCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <QRCodeCanvas
                    value={requestToken}
                    size={170}
                    includeMargin
                    bgColor="#0B1220"
                    fgColor="#FFFFFF"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[11px] text-white/55">
                  {t("demo_payreq_token", "Request token")}
                </div>
                <div className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-[11px] text-white/75 font-mono break-all">
                  {requestToken}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(requestToken)}
                  title={t("demo_tt_copy_request", "Copier le code de demande.")}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs transition-colors"
                >
                  {copied
                    ? t("demo_copied", "Copié")
                    : t("demo_copy_token", "Copy request")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </DemoWalletModalShell>
  );
}
