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

      <div className="relative h-full w-full flex flex-col items-center px-6 pt-14 pb-8">
        {/* main */}
        <div className="mt-7 w-full max-w-[440px] flex-1 flex flex-col items-center">
          {isPending ? (
            <>
              <img
                src="/symbols/logoxcannestransaparent4.png"
                alt="XCANNES"
                className="w-[168px] max-w-[72%] h-auto opacity-95"
                draggable={false}
              />

              <h1 className="mt-6 text-center text-[52px] max-md:text-[42px] leading-[0.95] font-bold text-white tracking-[-0.02em]">
                {pendingTitle}
              </h1>

              <p className="mt-5 text-center text-[22px] max-md:text-[18px] text-white/75 leading-snug max-w-[520px]">
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

              <div className="mt-9 w-full rounded-2xl border border-white/12 bg-[#070b10]/82 px-5 py-5 backdrop-blur-sm max-w-[560px]">
                <div className="relative">
                  <div className="absolute left-[12px] top-[16px] bottom-[16px] w-px bg-white/16" />

                  <div className="relative flex items-start gap-4 pb-4">
                    {pendingStep > 0 ? (
                      <div className="mt-0.5 h-6 w-6 rounded-full bg-xcannes-green/25 border border-xcannes-green/50 flex items-center justify-center text-[12px] text-xcannes-green">
                        ✓
                      </div>
                    ) : (
                      <div className="mt-0.5 h-6 w-6 rounded-full border-2 border-xcannes-green shadow-[0_0_12px_rgba(18,198,104,0.55)] bg-[#03130a]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[19px] max-md:text-[16px] font-semibold text-white">Signature</p>
                        <span className="text-[14px] max-md:text-[12px] text-white/50">
                          {pendingStep > 0 ? timelineTimes.signedAt : "..."}
                        </span>
                      </div>
                      <p className={`mt-0.5 text-[15px] max-md:text-[13px] ${pendingStep > 0 ? "text-white/60" : "text-xcannes-green"}`}>
                        Transaction signée avec succès
                      </p>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-4 pb-4">
                    {pendingStep > 1 ? (
                      <div className="mt-0.5 h-6 w-6 rounded-full bg-xcannes-green/25 border border-xcannes-green/50 flex items-center justify-center text-[12px] text-xcannes-green">
                        ✓
                      </div>
                    ) : pendingStep === 1 ? (
                      <div className="mt-0.5 h-6 w-6 rounded-full border-2 border-xcannes-green shadow-[0_0_12px_rgba(18,198,104,0.55)] bg-[#03130a]" />
                    ) : (
                      <div className="mt-0.5 h-6 w-6 rounded-full border border-white/35 bg-transparent" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[19px] max-md:text-[16px] font-semibold text-white">Vérification</p>
                        <span className="text-[14px] max-md:text-[12px] text-white/50">
                          {pendingStep > 1 ? timelineTimes.checkedAt : pendingStep === 1 ? "..." : ""}
                        </span>
                      </div>
                      <p className={`mt-0.5 text-[15px] max-md:text-[13px] ${pendingStep === 1 ? "text-xcannes-green" : "text-white/60"}`}>
                        Vérification des paramètres
                      </p>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-4 pb-4">
                    {pendingStep > 2 ? (
                      <div className="mt-0.5 h-6 w-6 rounded-full bg-xcannes-green/25 border border-xcannes-green/50 flex items-center justify-center text-[12px] text-xcannes-green">
                        ✓
                      </div>
                    ) : pendingStep === 2 ? (
                      <div className="mt-0.5 h-6 w-6 rounded-full border-2 border-xcannes-green shadow-[0_0_12px_rgba(18,198,104,0.55)] bg-[#03130a]" />
                    ) : (
                      <div className="mt-0.5 h-6 w-6 rounded-full border border-white/35 bg-transparent" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[19px] max-md:text-[16px] font-semibold text-white">Diffusion sur le XRPL</p>
                        <span className={`text-[20px] leading-none tracking-[0.2em] ${pendingStep === 2 ? "text-xcannes-green animate-pulse" : "text-white/30"}`}>
                          {pendingStep === 2 ? "..." : ""}
                        </span>
                      </div>
                      <p className={`mt-0.5 text-[15px] max-md:text-[13px] ${pendingStep === 2 ? "text-xcannes-green" : "text-white/60"}`}>
                        Envoi de la transaction au réseau
                      </p>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-4">
                    {pendingStep >= 4 ? (
                      <div className="mt-0.5 h-6 w-6 rounded-full bg-xcannes-green/25 border border-xcannes-green/50 flex items-center justify-center text-[12px] text-xcannes-green">
                        ✓
                      </div>
                    ) : pendingStep >= 3 ? (
                      <div className="mt-0.5 h-6 w-6 rounded-full border-2 border-xcannes-green shadow-[0_0_12px_rgba(18,198,104,0.55)] bg-[#03130a]" />
                    ) : (
                      <div className="mt-0.5 h-6 w-6 rounded-full border border-white/35 bg-transparent" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[19px] max-md:text-[16px] font-semibold text-white/88">Confirmation</p>
                      <p className={`mt-0.5 text-[15px] max-md:text-[13px] ${pendingStep >= 3 ? "text-xcannes-green" : "text-white/52"}`}>
                        {pendingStep >= 4 ? "Validation réseau confirmée" : "En attente de validation par le réseau"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex items-center justify-center">
                <div className="relative h-[120px] w-[120px]">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" fill="none" aria-hidden="true">
                    <circle cx="60" cy="60" r="48" stroke="rgba(255,255,255,0.09)" strokeWidth="10" />
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
                  <div className="absolute inset-[20px] rounded-full bg-[#03070b] border border-white/8 flex items-center justify-center">
                    <img src="/symbols/xcs.svg" alt="XCANNES" className="h-8 w-8 opacity-95" draggable={false} />
                  </div>
                </div>
              </div>

              <p className="mt-7 text-center text-[20px] max-md:text-[16px] text-white/75 leading-snug max-w-[560px]">
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
              <h1 className="mt-1 text-center text-[34px] leading-tight font-bold text-xcannes-green">
                {successTitle}
              </h1>
              <p className="mt-2 text-center text-[13px] text-xcannes-green/70">
                {t(
                  "ui_tx_sent_success_hint",
                  "Votre transaction a été enregistrée avec succès sur le XRP Ledger.",
                )}
              </p>

              <div className="mt-8 relative w-full flex items-center justify-center">
                {/* Big check illustration */}
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

              {isConversionAction && showConversionDetailsCard ? (
                <div className="mt-6 w-full rounded-2xl bg-white/7 border border-white/10 px-5 py-4">
                  {conversionFromLabel ? (
                    <div className="mb-3">
                      <div className="text-[12px] text-white/55">
                        {t("ui_from", "From")}:
                      </div>
                      <div className="mt-1 text-[20px] font-semibold text-white">
                        {conversionFromLabel}
                      </div>
                    </div>
                  ) : null}
                  {conversionToLabel ? (
                    <div className="mb-3">
                      <div className="text-[12px] text-white/55">
                        {t("ui_to", "To")}:
                      </div>
                      <div className="mt-1 text-[20px] font-semibold text-white">
                        {conversionToLabel}
                      </div>
                    </div>
                  ) : null}
                  {conversionFeeLabel ? (
                    <div>
                      <div className="text-[12px] text-white/55">
                        {t("ui_fees", "Frais")}:
                      </div>
                      <div className="mt-1 text-[14px] text-white/80">
                        {conversionFeeLabel}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : !isConversionAction && showSendDetailsCard ? (
                <div className="mt-6 w-full rounded-2xl bg-white/7 border border-white/10 px-5 py-4">
                  {amountLabel ? (
                    <div className="mb-3">
                      <div className="text-[12px] text-white/55">
                        {t("ui_amount", "Montant")}:
                      </div>
                      <div className="mt-1 text-[20px] font-semibold text-white">
                        {amountLabel}
                      </div>
                    </div>
                  ) : null}

                  {beneficiaryAddress ? (
                    <div>
                      <div className="text-[12px] text-white/55">
                        {t("ui_beneficiary", "Bénéficiaire")}:
                      </div>
                      <div className="mt-1 text-[14px] text-sky-300">
                        {beneficiaryLabel ||
                          t("ui_no_name_found", "Aucun nom trouvé")}
                      </div>
                      <div className="mt-1 font-mono text-[12px] text-white/55 break-all">
                        {beneficiaryAddress}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

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
    </div>
  );
}
