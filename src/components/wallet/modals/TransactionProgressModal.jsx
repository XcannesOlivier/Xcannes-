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
  errorMessage = "",
  details = null,
  autoCloseMs = null,
  onClose,
}) {
  const { t } = useTranslation("common");
  const [closing, setClosing] = useState(false);

  const label = actionLabel || t("ui_tx_progress_label", "Transaction");

  const isPending = status === "pending";
  const isSuccess = status === "success";
  const isError = status === "error";

  const trimmed = (v) => String(v || "").trim();
  const amountLabel = trimmed(details?.amountLabel);
  const beneficiaryLabel = trimmed(details?.beneficiaryLabel);
  const beneficiaryAddress = trimmed(details?.beneficiaryAddress);
  const showDetailsCard =
    Boolean(amountLabel) ||
    Boolean(beneficiaryAddress) ||
    Boolean(beneficiaryLabel);
  const pendingTitle = beneficiaryAddress
    ? t("ui_tx_sending_eta", "Envoi en cours (≈3 secondes)")
    : t("ui_tx_verifying", "En cours de vérification");

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose?.(), 220);
  }, [onClose]);

  useEffect(() => {
    if (visible) setClosing(false);
  }, [visible]);

  // Optional auto-close (used for some actions like conversion).
  useEffect(() => {
    if (!visible) return;
    if (!Number.isFinite(Number(autoCloseMs)) || Number(autoCloseMs) <= 0) return;
    if (status !== "success") return;
    const id = setTimeout(() => handleClose(), Number(autoCloseMs));
    return () => clearTimeout(id);
  }, [autoCloseMs, handleClose, status, visible]);

  const statusPill = useMemo(() => {
    if (isSuccess) return { label: t("ui_sent", "Envoyé"), tone: "success" };
    if (isError) return { label: t("ui_error", "Erreur"), tone: "error" };
    return { label: t("ui_sent", "Envoyé"), tone: "pending" };
  }, [isError, isSuccess, t]);

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
        {/* status pill */}
        <div
          className={[
            "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 border",
            statusPill.tone === "success"
              ? "border-xcannes-green/30 bg-xcannes-green/10 text-xcannes-green"
              : statusPill.tone === "error"
                ? "border-red-400/25 bg-red-400/10 text-red-200"
                : "border-xcannes-green/30 bg-xcannes-green/10 text-xcannes-green",
          ].join(" ")}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            {statusPill.tone === "error" ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            )}
          </svg>
          <span className="text-[18px] font-semibold">{statusPill.label}</span>
          {isPending ? (
            <span className="text-[18px] font-semibold opacity-90">✓</span>
          ) : null}
        </div>

        {/* main */}
        <div className="mt-7 w-full max-w-[440px] flex-1 flex flex-col items-center">
          {isPending ? (
            <>
              <h1 className="mt-1 text-center text-[34px] leading-tight font-bold text-white">
                {pendingTitle}
              </h1>
              <div className="mt-6 text-white/70">{label}</div>

              {showDetailsCard ? (
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
                        {beneficiaryLabel || t("ui_no_name_found", "Aucun nom trouvé")}
                      </div>
                      <div className="mt-1 font-mono text-[12px] text-white/55 break-all">
                        {beneficiaryAddress}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-6">
                <svg
                  className="h-9 w-9 text-white/70 animate-spin"
                  viewBox="0 0 24 24"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    opacity="0.25"
                  />
                  <path
                    d="M22 12a10 10 0 0 1-10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="mt-6 text-center text-[13px] text-white/55 leading-relaxed">
                {t(
                  "ui_tx_verifying_hint",
                  "Envoi de votre transaction au registre XRP Ledger.\nCela va prendre quelques secondes…",
                )}
              </p>
            </>
          ) : null}

          {isSuccess ? (
            <>
              <h1 className="mt-1 text-center text-[34px] leading-tight font-bold text-xcannes-green">
                {t("ui_tx_sent_success", "Envoyé avec succès!")}
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

              {showDetailsCard ? (
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
                        {beneficiaryLabel || t("ui_no_name_found", "Aucun nom trouvé")}
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
