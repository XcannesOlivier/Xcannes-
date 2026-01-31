"use client";

import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "next-i18next";
import { XCANNES_MEMO_SCHEMAS } from "@/utils/xrplMemo";

export default function WalletActivationRequestModal({
  open,
  onClose,
  walletAddress,
  walletLabel,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null,
}) {
  const { t } = useTranslation("common");
  const showNotConnectedNotice = isPreviewMode;
  const showNotActivatedNotice = !isPreviewMode && isWalletActivated === false;
  const showRlusdNotActivatedNotice =
    !isPreviewMode && isWalletActivated === true && hasRlusdTrustline === false;
  const [copied, setCopied] = useState(false);

  const requestPayload = useMemo(() => {
    if (!walletAddress) return null;
    return {
      schema: XCANNES_MEMO_SCHEMAS.payreq.schema,
      to: walletAddress,
      targetCurrency: "XRP",
      displayAmount: 1,
      displayCurrency: "XRP",
      amountRlusd: null,
      fxRate: null,
      fxSource: null,
      issuer: null,
      memo: "",
      beneficiaryLabel: String(walletLabel || "").trim() || null,
      createdAt: new Date().toISOString(),
    };
  }, [walletAddress, walletLabel]);

  const requestValue = useMemo(() => {
    if (!requestPayload) return "";
    try {
      return JSON.stringify(requestPayload);
    } catch {
      return "";
    }
  }, [requestPayload]);

  const shareText = useMemo(() => {
    if (!requestValue) return "";
    return `${t("ui_activation_share_text_7f0f1c9a2d", "Demande de paiement XCANNES:")}\n${requestValue}`;
  }, [requestValue, t]);

  const handleCopy = async () => {
    if (!requestValue || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(requestValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    if (!requestValue || typeof navigator === "undefined") return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("ui_activation_share_title_8b2d9f1a5c", "Demande de paiement"),
          text: shareText,
        });
        return;
      } catch {
        // fall through
      }
    }
    handleCopy();
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[11000] bg-black/80 md:backdrop-blur-sm"
        onClick={() => onClose?.()} />

      <div className="fixed inset-0 z-[11001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-elevated border border-subtle rounded-2xl p-4 md:p-5 space-y-3 pointer-events-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl"
            aria-label={t("ui_close_08378568ba", "Close")}>
            ✕
          </button>

          <div className="pr-8">
            <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
              {t("ui_activation_request_title_6b7c3e2a1f", "Demande 1 XRP")}
            </h3>
            {showNotConnectedNotice ? (
              <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none mt-1">
                {t("wallet_not_connected_title", "Wallet not connected")}
              </span>
            ) : null}
            {showNotActivatedNotice ? (
              <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none mt-1">
                {t(
                  "wallet_not_activated_title",
                  "Wallet not activated: a minimum reserve of 1 XRP is required."
                )}
              </span>
            ) : null}
            {showRlusdNotActivatedNotice ? (
              <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none mt-1">
                {t(
                  "wallet_rlusd_not_activated_title",
                  "RLUSD not activated. Authorize RLUSD on your wallet."
                )}
              </span>
            ) : null}
            <p className="mt-1 text-sm text-white/60">
              {t("ui_activation_request_subtitle_9a2d7f5c1e", "QR code et code de demande deja prets.")}
            </p>
          </div>

          {requestValue ? (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-black/60 border border-white/10 rounded-xl p-3">
                <QRCodeCanvas
                  value={requestValue}
                  size={180}
                  bgColor="#000000"
                  fgColor="#ffffff"
                />
              </div>
              <div className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/70 break-all">
                {requestValue}
              </div>
            </div>
          ) : (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {t("ui_activation_request_error_6c1f7a2b9d", "Adresse wallet manquante.")}
            </div>
          )}

          <div className="grid gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="w-full rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/80 text-black font-semibold transition-all duration-200 hover:bg-[#22C55E] hover:scale-105 active:scale-95">
              {t("ui_share_request_4b9a2d7f1c", "Partager")}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="w-full rounded-lg border border-white/20 bg-transparent text-white/70 font-semibold transition-all duration-200 hover:border-white/35 hover:text-white/90">
              {copied
                ? t("ui_copied_9a2d7f5c1e", "Copie")
                : t("ui_copy_request_32a3f4409b", "Copier le code")}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={`mailto:?subject=${encodeURIComponent(
                t("ui_activation_mail_subject_2a9f1c7d5e", "Demande de paiement XCANNES")
              )}&body=${encodeURIComponent(shareText)}`}
              className="text-center text-xs text-white/70 rounded-lg border border-white/15 bg-black/30 px-3 py-2 hover:text-white/90 hover:border-white/30">
              {t("ui_share_mail_4d7a1f2c9e", "Email")}
            </a>
            <a
              href={`sms:?body=${encodeURIComponent(shareText)}`}
              className="text-center text-xs text-white/70 rounded-lg border border-white/15 bg-black/30 px-3 py-2 hover:text-white/90 hover:border-white/30">
              {t("ui_share_sms_7b2d9f1a5c", "SMS")}
            </a>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
