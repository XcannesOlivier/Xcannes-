"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";

/**
 * TransactionProgressModal — full-screen XRPL transaction progress overlay.
 *
 * Visual states:
 *   1. "pending"  – full screen "verification" page
 *   2. "success"  – full screen success page + optional details card
 *   3. "error"    – red message
 */
export default function TransactionProgressModal({
  visible = false,
  status = "pending",
  actionLabel = "",
  actionKey = "",
  errorMessage = "",
  details = null,
  autoCloseMs = null,
  onClose,
}) {
  const { t } = useTranslation("common");
  const [closing, setClosing] = useState(false);
  const [pendingStep, setPendingStep] = useState(0);
  const [renderStatus, setRenderStatus] = useState(status);

  const label = actionLabel || t("ui_tx_progress_label", "Transaction");

  const isPending = renderStatus === "pending";
  const isSuccess = renderStatus === "success";
  const isError = renderStatus === "error";

  const trimmed = (v) => String(v || "").trim();
  const amountLabel = trimmed(details?.amountLabel);
  const beneficiaryLabel = trimmed(details?.beneficiaryLabel);
  const beneficiaryAddress = trimmed(details?.beneficiaryAddress);
  const conversionFromLabel = trimmed(details?.fromLabel);
  const conversionToLabel = trimmed(details?.toLabel);
  const conversionFeeLabel = trimmed(details?.feeLabel);

  const showSendDetailsCard =
    Boolean(amountLabel) ||
    Boolean(beneficiaryAddress) ||
    Boolean(beneficiaryLabel);
  const showConversionDetailsCard =
    Boolean(conversionFromLabel) ||
    Boolean(conversionToLabel) ||
    Boolean(conversionFeeLabel);
  const normalizedActionKey = String(actionKey || "").trim();
  const isConversionAction = normalizedActionKey === "wallet:convert";
  const pendingTitle = isConversionAction
    ? t("ui_tx_conversion_in_progress", "Conversion en cours")
    : beneficiaryAddress
    ? t("ui_tx_sending_eta", "Envoi en cours")
    : t("ui_tx_verifying", "En cours de vérification");
  const successTitle = isConversionAction
    ? t("ui_tx_convert_success", "Converti avec succès !")
    : t("ui_tx_sent_success", "Envoyé avec succès!");

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose?.(), 220);
  }, [onClose]);

  useEffect(() => {
    if (visible) setClosing(false);
  }, [visible]);

  // Keep a tiny "final confirmation" beat before switching to success.
  useEffect(() => {
    if (!visible) return;
    if (status === "success" && renderStatus === "pending") {
      setPendingStep(4);
      const id = setTimeout(() => setRenderStatus("success"), 420);
      return () => clearTimeout(id);
    }
    setRenderStatus(status);
  }, [status, visible, renderStatus]);

  // Pending timeline progression: each step becomes validated over time.
  useEffect(() => {
    if (!visible || renderStatus !== "pending") return;
    setPendingStep(0);
    const id = setInterval(() => {
      setPendingStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1600);
    return () => clearInterval(id);
  }, [visible, renderStatus]);

  // Optional auto-close (used for some actions like conversion).
  useEffect(() => {
    if (!visible) return;
    if (!Number.isFinite(Number(autoCloseMs)) || Number(autoCloseMs) <= 0) return;
    if (renderStatus !== "success") return;
    const id = setTimeout(() => handleClose(), Number(autoCloseMs));
    return () => clearTimeout(id);
  }, [autoCloseMs, handleClose, renderStatus, visible]);

  const timelineTimes = useMemo(() => {
    const base = new Date();
    const plusTwo = new Date(base.getTime() + 2000);
    const fmt = new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return {
      signedAt: fmt.format(base),
      checkedAt: fmt.format(plusTwo),
    };
  }, [visible]);

  const networkLabel = t("ui_xrp_ledger", "XRP Ledger");
  const progressByStep = [0.22, 0.42, 0.62, 0.82, 1];
  const spinnerProgress = progressByStep[Math.max(0, Math.min(pendingStep, 4))] || 0.22;
  const spinnerDashOffset = (1 - spinnerProgress) * 301.6;
  const txHash = trimmed(details?.txHash || details?.hash);
  const txHashShort = txHash ? `${txHash.slice(0, 8)}...${txHash.slice(-8)}` : "";
  const parseAmountCurrency = useCallback((label) => {
    const m = String(label || "")
      .trim()
      .match(/^([0-9]+(?:[\s.,][0-9]+)?)\s*([A-Za-z0-9]{2,10})$/);
    if (!m) return null;
    const amountNum = Number(String(m[1]).replace(/\s/g, "").replace(",", "."));
    return {
      amountText: m[1],
      currency: String(m[2] || "").toUpperCase(),
      amountNum: Number.isFinite(amountNum) ? amountNum : null,
    };
  }, []);
  const fromParsed = parseAmountCurrency(conversionFromLabel);
  const toParsed = parseAmountCurrency(conversionToLabel);
  const feeParsed = parseAmountCurrency(conversionFeeLabel);
  const rateBadge =
    fromParsed?.amountNum && toParsed?.amountNum
      ? `~ ${(toParsed.amountNum / fromParsed.amountNum).toLocaleString("fr-FR", {
          maximumFractionDigits: 4,
        })} ${toParsed.currency}/${fromParsed.currency}`
      : "";
  const feeCurrencyBadge = feeParsed?.currency || "RLUSD";
  const conversionCurrencyNames = {
    USD: "Dollar américain",
    EUR: "Euro",
    CHF: "Franc suisse",
    RLUSD: "RLUSD",
    XRP: "XRP",
  };
  const fromCurrencyName = fromParsed?.currency
    ? conversionCurrencyNames[fromParsed.currency] || fromParsed.currency
    : "";
  const toCurrencyName = toParsed?.currency
    ? conversionCurrencyNames[toParsed.currency] || toParsed.currency
    : "";
  const successDateTime = useMemo(() => {
    const d = new Date();
    const date = d.toLocaleDateString("fr-FR");
    const time = d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return `${date}, ${time}`;
  }, [visible, renderStatus]);
  const [copiedTx, setCopiedTx] = useState(false);

  const handleCopyTx = useCallback(async () => {
    if (!txHash) return;
    try {
      await navigator.clipboard.writeText(txHash);
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 1400);
    } catch {
      setCopiedTx(false);
    }
  }, [txHash]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[10200] bg-black transition-opacity duration-200 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full bg-xcannes-green/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative h-full w-full flex flex-col items-center px-6 pt-6 pb-8">
        {/* main */}
        <div className="mt-[30px] w-full max-w-[440px] flex-1 flex flex-col items-center">
          {isPending ? (
            <>
              <img
                src="/symbols/logoxcannestransaparent.png"
                alt="XCANNES"
                className="w-[168px] max-w-[72%] h-auto opacity-95"
                draggable={false}
              />

              <h1 className="mt-6 text-center text-[40px] max-md:text-[30px] leading-[0.95] font-bold text-white tracking-[-0.02em]">
                {pendingTitle}
              </h1>

              <p className="mt-5 text-center text-[18px] max-md:text-[14px] text-white/75 leading-snug max-w-[520px]">
                {isConversionAction ? (
                  <>
                    Votre conversion est en cours de traitement sur le réseau{" "}
                    <span className="text-xcannes-green">{networkLabel}</span>.
                  </>
                ) : (
                  <>
                    Votre transaction est en cours de traitement sur le réseau{" "}
                    <span className="text-xcannes-green">{networkLabel}</span>.
                  </>
                )}
              </p>

              <div className="mt-9 w-full rounded-2xl border border-white/5 bg-[#070b10]/82 px-5 py-5 backdrop-blur-sm max-w-[560px]">
                <div className="relative">
                  <div className="absolute left-[12px] top-[16px] bottom-[16px] w-px bg-white/16" />

                  <div className="relative flex items-start gap-4 pb-4">
                    {pendingStep > 0 ? (
                      <div className="mt-0.5 h-7 w-7 rounded-full bg-xcannes-green border border-xcannes-green flex items-center justify-center text-[14px] font-bold text-white">
                        ✓
                      </div>
                    ) : (
                      <div className="mt-0.5 h-6 w-6 rounded-full border-2 border-xcannes-green shadow-[0_0_12px_rgba(18,198,104,0.55)] bg-[#03130a]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[15px] max-md:text-[12px] font-semibold text-white">Signature</p>
                        <span className="text-[12px] max-md:text-[10px] text-white/50">
                          {pendingStep > 0 ? timelineTimes.signedAt : "..."}
                        </span>
                      </div>
                      <p className={`mt-0.5 text-[13px] max-md:text-[11px] ${pendingStep > 0 ? "text-white/60" : "text-xcannes-green"}`}>
                        Transaction signée avec succès
                      </p>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-4 pb-4">
                    {pendingStep > 1 ? (
                      <div className="mt-0.5 h-7 w-7 rounded-full bg-xcannes-green border border-xcannes-green flex items-center justify-center text-[14px] font-bold text-white">
                        ✓
                      </div>
                    ) : pendingStep === 1 ? (
                      <div className="mt-0.5 h-6 w-6 rounded-full border-2 border-xcannes-green shadow-[0_0_12px_rgba(18,198,104,0.55)] bg-[#03130a]" />
                    ) : (
                      <div className="mt-0.5 h-6 w-6 rounded-full border border-white/35 bg-transparent" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[15px] max-md:text-[12px] font-semibold text-white">Vérification</p>
                        <span className="text-[12px] max-md:text-[10px] text-white/50">
                          {pendingStep > 1 ? timelineTimes.checkedAt : pendingStep === 1 ? "..." : ""}
                        </span>
                      </div>
                      <p className={`mt-0.5 text-[13px] max-md:text-[11px] ${pendingStep === 1 ? "text-xcannes-green" : "text-white/60"}`}>
                        Vérification des paramètres
                      </p>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-4 pb-4">
                    {pendingStep > 2 ? (
                      <div className="mt-0.5 h-7 w-7 rounded-full bg-xcannes-green border border-xcannes-green flex items-center justify-center text-[14px] font-bold text-white">
                        ✓
                      </div>
                    ) : pendingStep === 2 ? (
                      <div className="mt-0.5 h-6 w-6 rounded-full border-2 border-xcannes-green shadow-[0_0_12px_rgba(18,198,104,0.55)] bg-[#03130a]" />
                    ) : (
                      <div className="mt-0.5 h-6 w-6 rounded-full border border-white/35 bg-transparent" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[15px] max-md:text-[12px] font-semibold text-white">Diffusion sur le XRPL</p>
                        <span className={`text-[20px] font-black leading-none tracking-[0.2em] ${pendingStep === 2 ? "text-xcannes-green animate-pulse" : "text-white/30"}`}>
                          {pendingStep === 2 ? "..." : ""}
                        </span>
                      </div>
                      <p className={`mt-0.5 text-[13px] max-md:text-[11px] ${pendingStep === 2 ? "text-xcannes-green" : "text-white/60"}`}>
                        Envoi de la transaction au réseau
                      </p>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-4">
                    {pendingStep >= 4 ? (
                      <div className="mt-0.5 h-7 w-7 rounded-full bg-xcannes-green border border-xcannes-green flex items-center justify-center text-[14px] font-bold text-white">
                        ✓
                      </div>
                    ) : pendingStep >= 3 ? (
                      <div className="mt-0.5 h-6 w-6 rounded-full border-2 border-xcannes-green shadow-[0_0_12px_rgba(18,198,104,0.55)] bg-[#03130a]" />
                    ) : (
                      <div className="mt-0.5 h-6 w-6 rounded-full border border-white/35 bg-transparent" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] max-md:text-[12px] font-semibold text-white/88">Confirmation</p>
                      <p className={`mt-0.5 text-[13px] max-md:text-[11px] ${pendingStep >= 3 ? "text-xcannes-green" : "text-white/52"}`}>
                        {pendingStep >= 4 ? "Validation réseau confirmée" : "En attente de validation par le réseau"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex items-center justify-center">
                <div className="relative h-[120px] w-[120px]">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" fill="none" aria-hidden="true">
                    <circle cx="60" cy="60" r="48" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      stroke="rgba(18,198,104,0.95)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray="301.6"
                      strokeDashoffset={spinnerDashOffset}
                      style={{ transition: "stroke-dashoffset 420ms ease" }}
                      className="drop-shadow-[0_0_12px_rgba(18,198,104,0.45)]"
                    />
                  </svg>
                  <div className="absolute inset-[20px] rounded-full bg-[#010307] flex items-center justify-center">
                    <img src="/symbols/xlogovert.png" alt="XCANNES" className="h-12 w-12 opacity-95" draggable={false} />
                  </div>
                </div>
              </div>

              <p className="mt-7 text-center text-[16px] max-md:text-[12px] text-white/75 leading-snug max-w-[560px]">
                {isConversionAction ? (
                  <>
                    Diffusion de votre conversion sur le réseau <span className="text-xcannes-green">{networkLabel}</span>. Cela prend quelques secondes...
                  </>
                ) : (
                  <>
                    Diffusion de votre transaction sur le réseau <span className="text-xcannes-green">{networkLabel}</span>. Cela prend quelques secondes...
                  </>
                )}
              </p>
            </>
          ) : null}

          {isSuccess ? (
            <>
              {!isConversionAction ? (
                <>
                  <img
                    src="/symbols/logoxcannestransaparent.png"
                    alt="XCANNES"
                    className="w-[164px] max-w-[70%] h-auto opacity-95"
                    draggable={false}
                  />

                  <div className="mt-6 relative w-full flex items-center justify-center">
                    {/* Keep existing check animation/illustration style */}
                    <svg
                      className="h-40 w-40 text-xcannes-green drop-shadow-[0_0_22px_rgba(0,255,166,0.22)]"
                      viewBox="0 0 120 120"
                      fill="none"
                    >
                      <path
                        d="M20 64 L50 88 L100 34"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M60 10a50 50 0 1 0 0 100a50 50 0 1 0 0-100Z"
                        stroke="currentColor"
                        strokeOpacity="0.12"
                        strokeWidth="8"
                      />
                    </svg>
                  </div>

                  <h1 className="mt-2 text-center text-[50px] max-md:text-[36px] leading-[0.95] font-bold text-xcannes-green tracking-[-0.02em]">
                    Paiement envoyé
                    <br />
                    avec succès
                  </h1>
                  <p className="mt-4 text-center text-[18px] max-md:text-[14px] text-white/75 leading-snug max-w-[520px]">
                    Votre paiement a été confirmé sur le réseau <span className="text-xcannes-green">{networkLabel}</span>.
                  </p>

                  <div className="mt-7 w-full rounded-2xl border border-white/8 bg-[#070b10]/86 px-5 py-4 backdrop-blur-sm max-w-[560px]">
                    <div className="flex items-start gap-3 pb-3 border-b border-white/8">
                      <span className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#061a12] border border-xcannes-green/45 flex items-center justify-center text-xcannes-green">
                        ↗
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] text-white/55">Montant envoyé</p>
                        <p className="mt-0.5 text-[34px] max-md:text-[28px] font-semibold text-white leading-none">{amountLabel || "-"}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 py-3 border-b border-white/8">
                      <span className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#08101a] border border-sky-300/35 flex items-center justify-center text-sky-300">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 21a8 8 0 0 0-16 0" />
                          <circle cx="12" cy="8" r="4" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] text-white/55">Bénéficiaire</p>
                        <p className="mt-0.5 text-[26px] max-md:text-[22px] font-semibold text-sky-300 leading-none">{beneficiaryLabel || t("ui_no_name_found", "Aucun nom trouvé")}</p>
                        {beneficiaryAddress ? (
                          <p className="mt-1 font-mono text-[12px] text-white/50 break-all">{beneficiaryAddress}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 py-3 border-b border-white/8">
                      <span className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#0f1317] border border-white/20 flex items-center justify-center text-white/80">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="8" />
                          <path d="M12 8v4l2.5 2" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] text-white/55">Date et heure</p>
                        <p className="mt-0.5 text-[15px] text-white/85">{successDateTime}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-3">
                      <span className="h-9 w-9 shrink-0 rounded-full bg-[#061a12] border border-xcannes-green/45 flex items-center justify-center text-xcannes-green">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="8" />
                          <path d="M9 12l2 2l4-4" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-white/55">Transaction ID</p>
                        <p className="mt-0.5 text-[15px] text-white/85 font-mono">{txHashShort || "-"}</p>
                      </div>
                      {txHash ? (
                        <button
                          type="button"
                          onClick={handleCopyTx}
                          className="h-9 px-4 rounded-full border border-xcannes-green/45 bg-[#061a12] text-xcannes-green text-[14px] font-medium hover:bg-[#0a2319] transition-colors"
                        >
                          {copiedTx ? "Copié" : "Copier"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-8 w-full">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="w-full h-12 rounded-xl bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold transition-colors"
                    >
                      {t("ui_close", "Fermer")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img
                    src="/symbols/logoxcannestransaparent.png"
                    alt="XCANNES"
                    className="w-[164px] max-w-[70%] h-auto opacity-95"
                    draggable={false}
                  />

                  <div className="mt-6 relative w-full flex items-center justify-center">
                    <svg
                      className="h-40 w-40 text-xcannes-green drop-shadow-[0_0_22px_rgba(0,255,166,0.22)]"
                      viewBox="0 0 120 120"
                      fill="none"
                    >
                      <path
                        d="M20 64 L50 88 L100 34"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M60 10a50 50 0 1 0 0 100a50 50 0 1 0 0-100Z"
                        stroke="currentColor"
                        strokeOpacity="0.12"
                        strokeWidth="8"
                      />
                    </svg>
                  </div>

                  <h1 className="mt-2 text-center text-[50px] max-md:text-[36px] leading-[0.95] font-bold text-xcannes-green tracking-[-0.02em]">
                    Conversion réussie !
                  </h1>
                  <p className="mt-4 text-center text-[18px] max-md:text-[14px] text-white/75 leading-snug max-w-[520px]">
                    Votre conversion a été confirmée sur le réseau <span className="text-xcannes-green">{networkLabel}</span>.
                  </p>

                  <div className="mt-7 w-full rounded-2xl border border-white/8 bg-[#070b10]/86 px-5 py-4 backdrop-blur-sm max-w-[560px]">
                    <div className="pb-3 border-b border-white/8">
                      <p className="text-center text-[14px] text-white/55">Vous avez converti</p>
                      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="min-w-0 text-center">
                          <p className="text-[38px] max-md:text-[30px] leading-none font-semibold text-white">{conversionFromLabel || "-"}</p>
                          <p className="mt-1 text-[12px] text-white/50">{fromCurrencyName || "-"}</p>
                        </div>
                        <span className="h-10 w-10 rounded-full bg-[#061a12] border border-xcannes-green/45 flex items-center justify-center text-xcannes-green text-[20px]">→</span>
                        <div className="min-w-0 text-center">
                          <p className="text-[38px] max-md:text-[30px] leading-none font-semibold text-white">{conversionToLabel || "-"}</p>
                          <p className="mt-1 text-[12px] text-white/50">{toCurrencyName || "-"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 py-3 border-b border-white/8">
                      <span className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#061a12] border border-xcannes-green/45 flex items-center justify-center text-xcannes-green">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="8" />
                          <path d="M9 12l2 2l4-4" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-white/55">Montant converti</p>
                        <p className="mt-0.5 text-[15px] text-white/85">{conversionFromLabel && conversionToLabel ? `${conversionFromLabel} → ${conversionToLabel}` : "-"}</p>
                      </div>
                      {rateBadge ? (
                        <span className="h-7 px-3 rounded-full border border-xcannes-green/45 bg-[#061a12] text-xcannes-green text-[12px] font-medium inline-flex items-center">
                          {rateBadge}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-start gap-3 py-3 border-b border-white/8">
                      <span className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#061a12] border border-xcannes-green/45 flex items-center justify-center text-xcannes-green">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14" />
                          <path d="M12 5v14" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-white/55">Frais réseau</p>
                        <p className="mt-0.5 text-[15px] text-white/85">{conversionFeeLabel || "-"}</p>
                      </div>
                      <span className="h-7 px-3 rounded-full border border-sky-300/35 bg-[#08101a] text-sky-300 text-[12px] font-medium inline-flex items-center">
                        {feeCurrencyBadge}
                      </span>
                    </div>

                    <div className="flex items-start gap-3 py-3 border-b border-white/8">
                      <span className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#0f1317] border border-white/20 flex items-center justify-center text-white/80">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="8" />
                          <path d="M12 8v4l2.5 2" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] text-white/55">Date et heure</p>
                        <p className="mt-0.5 text-[15px] text-white/85">{successDateTime}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-3">
                      <span className="h-9 w-9 shrink-0 rounded-full bg-[#061a12] border border-xcannes-green/45 flex items-center justify-center text-xcannes-green">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 5v14" />
                          <path d="M5 12h14" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-white/55">Transaction ID</p>
                        <p className="mt-0.5 text-[15px] text-white/85 font-mono">{txHashShort || "-"}</p>
                      </div>
                      {txHash ? (
                        <button
                          type="button"
                          onClick={handleCopyTx}
                          className="h-9 px-4 rounded-full border border-xcannes-green/45 bg-[#061a12] text-xcannes-green text-[14px] font-medium hover:bg-[#0a2319] transition-colors"
                        >
                          {copiedTx ? "Copié" : "Copier"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-8 w-full">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="w-full h-12 rounded-xl bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold transition-colors"
                    >
                      {t("ui_close", "Fermer")}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : null}

          {isError ? (
            <>
              <h1 className="mt-1 text-center text-[34px] leading-tight font-bold text-red-300">
                {t("ui_tx_failed", "Transaction échouée")}
              </h1>
              <p className="mt-2 text-center text-[13px] text-red-200/70">
                {label}
              </p>
              {errorMessage ? (
                <div className="mt-6 w-full rounded-2xl bg-red-500/10 border border-red-400/20 px-4 py-3 text-[12px] text-red-100/80 break-words">
                  {errorMessage}
                </div>
              ) : null}
              <div className="mt-8 w-full">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full h-12 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
                >
                  {t("ui_close", "Fermer")}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Keyframes ──────────────────────────────────────────── */}
      <style jsx global>{`
        /* keep file local: no keyframes needed beyond tailwind's spin */
      `}</style>

      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-[10210]">
        <span className="block h-[5px] w-[132px] rounded-full bg-white/95" aria-hidden="true" />
      </div>
    </div>
  );
}
