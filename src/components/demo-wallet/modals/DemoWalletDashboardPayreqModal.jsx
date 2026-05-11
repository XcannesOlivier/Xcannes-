"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { formatAmountWithSymbol } from "../demoWalletDashboardConfig";

export default function DemoWalletDashboardPayreqModal({
  open,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  renderWalletMeta,
  selectedSendToken,
  sendPaymentRequest,
  sendDestination,
  sendAmount,
  sendProcessing,
  handleSendSubmit,
  savedAddresses,
  enableSaveAddress = false,
  inline = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";

  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [showFullAccountNumber, setShowFullAccountNumber] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | processing | success | error
  const [submitError, setSubmitError] = useState("");

  const normalizedDestination = useMemo(
    () => String(sendDestination || "").trim(),
    [sendDestination],
  );
  const isSavedDestination = useMemo(() => {
    return (savedAddresses || []).some(
      (addr) => addr.address === normalizedDestination,
    );
  }, [savedAddresses, normalizedDestination]);
  const canSaveDestination =
    enableSaveAddress && normalizedDestination && !isSavedDestination;
  const normalizedSendAmount = Number(String(sendAmount || "").trim());
  const canManualSend =
    Boolean(selectedSendToken) &&
    Boolean(normalizedDestination) &&
    Number.isFinite(normalizedSendAmount) &&
    normalizedSendAmount > 0;

  const requestCurrencyCode = String(
    sendPaymentRequest?.displayCurrency ||
      sendPaymentRequest?.targetCurrencyCode ||
      selectedSendToken?.currency ||
      "",
  )
    .trim()
    .toUpperCase();
  const requestAmountValue =
    sendPaymentRequest?.displayAmount ??
    sendPaymentRequest?.amountRlusd ??
    (Number.isFinite(normalizedSendAmount) && normalizedSendAmount > 0
      ? normalizedSendAmount
      : null);
  const requestAmountLabel =
    requestAmountValue != null && requestCurrencyCode
      ? formatAmountWithSymbol(
          locale,
          Number(requestAmountValue),
          requestCurrencyCode,
          {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
          },
        )
      : null;
  const requestBeneficiaryLabel = sendPaymentRequest?.beneficiaryLabel
    ? String(sendPaymentRequest.beneficiaryLabel)
    : "";
  const requestDestination = String(
    sendPaymentRequest?.to || normalizedDestination || "",
  ).trim();
  const requestDestinationLabel =
    requestDestination.length > 14
      ? `${requestDestination.slice(0, 6)}...${requestDestination.slice(-4)}`
      : requestDestination;

  const handleManualSend = async () => {
    if (submitStatus === "processing") return;
    setSubmitStatus("processing");
    setSubmitError("");
    const result = await handleSendSubmit?.({
      saveDestination:
        saveNewAddress && canSaveDestination ? normalizedDestination : "",
      saveLabel: "",
      closeOnSuccess: false,
    });
    if (result?.ok) {
      setSaveNewAddress(false);
      setSubmitStatus("success");
      window.setTimeout(() => {
        onClose?.();
      }, 650);
      return;
    }
    if (result?.error) {
      setSubmitError(String(result.error));
    } else {
      setSubmitError(t("demo_error_generic", "Action impossible (démo)."));
    }
    setSubmitStatus("error");
  };

  useEffect(() => {
    if (!open) {
      setSaveNewAddress(false);
      setShowFullAccountNumber(false);
      setSubmitStatus("idle");
      setSubmitError("");
    }
  }, [open]);

  useEffect(() => {
    if (!canSaveDestination) {
      setSaveNewAddress(false);
    }
  }, [canSaveDestination]);

  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end justify-center pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-send-modal wallet-payreq-modal wallet-modal-no-top-highlight-mobile p-4 pt-0 space-y-3 overflow-y-auto flex flex-col min-h-0 overscroll-contain pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-screen rounded-none",
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const sendButtonDisabled = sendProcessing || !canManualSend;
  const sendButtonLabel = sendProcessing
    ? t("ui_sending_3b8c1a7d5e", "Sending...")
    : t("ui_confirm_payment_button", "Confirmer le paiement");

  const content = (
    <>
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={onClose}
        />
      ) : null}

      <div className={wrapperClass}>
        <div
          className={panelClass}
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}
        >
          {!inline ? (
            <div className="flex justify-center -mt-1 pt-1 pb-2" aria-hidden>
              <span className="block w-12 h-1.5 rounded-full bg-white/20" />
            </div>
          ) : null}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="sr-only"
          >
            {t("close", "Fermer")}
          </button>

          <div className={inline ? "flex-1 min-h-0 flex flex-col" : ""}>
            <div className="space-y-6">
              <div className="text-center space-y-2 pt-1">
                <h3 className="text-[26px] font-semibold text-white/95 tracking-tight">
                  {t("ui_payreq_summary_title", "Résumé de la demande")}
                </h3>
                <p className="text-[14px] text-white/60 max-w-[34ch] mx-auto leading-relaxed">
                  {t(
                    "ui_payreq_summary_subtitle",
                    "Vérifiez les détails avant de confirmer le paiement.",
                  )}
                </p>

                {noticeVariant === "demo" ? (
                  <span className="mt-2 inline-flex items-center text-white/80 text-sm font-semibold px-2 py-1 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}

                <div className="mt-[40px] flex justify-center">
                  {renderWalletMeta?.({
                    variant: "pill-column",
                    className: "flex justify-center",
                    prefix: t("moonpay_from_account", "Compte source"),
                    pillClassName:
                      "bg-elevated shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]",
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px] text-white/50">
                    {t("ui_payreq_requested_by_label", "Demandé par")}
                  </span>
                  <span className="text-[22px] font-semibold text-white truncate text-right">
                    {requestBeneficiaryLabel ||
                      t("ui_wallet_unknown", "Unknown wallet")}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px] text-white/50">
                    {t("ui_address", "Adresse")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFullAccountNumber((prev) => !prev)}
                    className="font-mono text-[15px] text-white/70 text-right underline decoration-white/25 underline-offset-2 hover:decoration-white/60 transition-colors truncate max-w-[60%]"
                    title={t(
                      "ui_toggle_full_account_number",
                      "Afficher/masquer l'adresse complète",
                    )}
                  >
                    {showFullAccountNumber
                      ? requestDestination
                      : requestDestinationLabel || requestDestination || "—"}
                  </button>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px] text-white/50">
                    {t("ui_currency_label", "Devise")}
                  </span>
                  <span className="text-[17px] text-white/90">
                    {requestCurrencyCode || "—"}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[20px] text-white/90">
                    {t("ui_total_to_send_label", "Total à envoyer")}
                  </span>
                  <span className="text-3xl font-semibold text-white">
                    {requestAmountLabel || "—"}
                  </span>
                </div>
              </div>

              {canSaveDestination ? (
                <div className="rounded-lg bg-gradient-to-b from-white/[0.08] to-white/[0.03] px-3 py-2 space-y-2 ring-1 ring-white/10 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={saveNewAddress}
                      onChange={(e) => setSaveNewAddress(e.target.checked)}
                      className="accent-xcannes-green"
                    />
                    {t("ui_save_this_address_7ef65aa11c", "Save this address?")}
                  </label>
                </div>
              ) : null}

              <div className="pt-6 pb-[env(safe-area-inset-bottom)]">
                {submitStatus === "error" && submitError ? (
                  <div className="mb-3 rounded-[16px] ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-4 py-3 text-xs text-orange-200/90">
                    <div className="font-semibold">
                      {t("ui_send_failed", "Paiement impossible")}
                    </div>
                    <div className="mt-1 text-orange-200/80">{submitError}</div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualSend();
                  }}
                  disabled={
                    sendButtonDisabled ||
                    submitStatus === "processing" ||
                    submitStatus === "success"
                  }
                  className={[
                    "w-full h-14 rounded-[20px] text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
                    sendButtonDisabled
                      ? sendProcessing
                        ? "opacity-45 cursor-not-allowed"
                        : "bg-xcannes-green/[0.07] text-xcannes-green/60 cursor-not-allowed ring-[0.5px] ring-xcannes-green/40 ring-inset"
                      : "text-white hover:scale-[1.01] active:scale-[0.98]",
                  ].join(" ")}
                  style={
                    sendButtonDisabled
                      ? sendProcessing
                        ? {
                            background:
                              "linear-gradient(180deg, rgba(34,154,86,0.65) 0%, rgba(14,103,58,0.65) 100%)",
                            color: "rgba(255,255,255,0.4)",
                          }
                        : undefined
                      : {
                          background:
                            "linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)",
                          boxShadow:
                            "0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)",
                        }
                  }
                >
                  {submitStatus === "success" ? (
                    <span className="inline-flex items-center justify-center gap-2 text-white/90">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 ring-inset">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                      {t("ui_done", "Terminé")}
                    </span>
                  ) : sendButtonDisabled && !sendProcessing ? (
                    <span className="inline-flex items-center gap-1.5 text-white/20">
                      <span className="text-xs">
                        {t(
                          "ui_send_fill_cta",
                          "Choisissez la devise et le montant",
                        )}
                      </span>
                      <span className="inline-flex items-end gap-[3px] mb-[-1px]">
                        <span
                          className="payreq-modal-dot"
                          style={{ animationDelay: "0s" }}
                        >
                          ·
                        </span>
                        <span
                          className="payreq-modal-dot"
                          style={{ animationDelay: "0.6s" }}
                        >
                          ·
                        </span>
                        <span
                          className="payreq-modal-dot"
                          style={{ animationDelay: "1.2s" }}
                        >
                          ·
                        </span>
                      </span>
                    </span>
                  ) : (
                    sendButtonLabel
                  )}
                </button>
                <style>{`
                  @keyframes payreqModalDotBlink {
                    0%, 70%, 100% { opacity: 0.1; }
                    35% { opacity: 0.9; }
                  }
                  .payreq-modal-dot {
                    font-size: 20px;
                    line-height: 1;
                    animation: payreqModalDotBlink 2.4s ease-in-out infinite;
                    color: inherit;
                  }
                `}</style>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
