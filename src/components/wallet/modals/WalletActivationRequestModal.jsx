"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { apiUrl } from "@/lib/runtimeConfig";

export default function WalletActivationRequestModal({
  open,
  onClose,
  walletAddress,
  walletLabel,
  activationAmountXrp = 1,
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
  const [xummPayload, setXummPayload] = useState(null);
  const [xummError, setXummError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const activationAmountLabel =
    Number(activationAmountXrp) === 1.4 ? "1.40" : String(activationAmountXrp || "1");

  useEffect(() => {
    if (!open || !walletAddress) {
      setXummPayload(null);
      setXummError(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setXummError(null);

    const createPayload = async () => {
      try {
        const amountDrops = Math.round(Number(activationAmountXrp) * 1_000_000);
        const txjson = {
          TransactionType: "Payment",
          Destination: walletAddress,
          Amount: String(Number.isFinite(amountDrops) && amountDrops > 0 ? amountDrops : 1_000_000),
        };
        const res = await fetch(apiUrl("/xumm/sign"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txjson,
            action: "wallet:activation-request",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to create XUMM request");
        }
        if (!isActive) return;
        setXummPayload({
          uuid: data.uuid,
          qrUrl: data.qrUrl,
          deepLink: data.deepLink,
        });
      } catch (error) {
        if (!isActive) return;
        setXummPayload(null);
        setXummError(error?.message || "Failed to create XUMM request");
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    createPayload();
    return () => {
      isActive = false;
    };
  }, [activationAmountXrp, open, walletAddress]);

  const shareLink = useMemo(() => {
    if (!xummPayload) return "";
    const raw =
      xummPayload.deepLink || (xummPayload.uuid ? `https://xumm.app/sign/${xummPayload.uuid}` : "");
    if (!raw) return "";
    if (/^xumm:\/\//i.test(raw) || /^xaman:\/\//i.test(raw)) {
      return raw.replace(/^xumm:\/\//i, "https://").replace(/^xaman:\/\//i, "https://");
    }
    return raw;
  }, [xummPayload]);

  const transactionCode = useMemo(() => {
    if (!shareLink) return "";
    return shareLink;
  }, [shareLink]);

  const shareText = useMemo(() => {
    if (!shareLink) return "";
    return `${t("ui_activation_share_text_7f0f1c9a2d", "Demande {{amount}} XRP XCANNES:", {
      amount: activationAmountLabel,
    })}\n${shareLink}`;
  }, [activationAmountLabel, shareLink, t]);

  const handleCopy = async () => {
    if (!transactionCode || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(transactionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    if (!shareLink || typeof navigator === "undefined") return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("ui_activation_share_title_8b2d9f1a5c", "Demande de paiement"),
          text: shareText,
          url: shareLink,
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
              {t("ui_activation_request_title_6b7c3e2a1f", "Demande {{amount}} XRP", {
                amount: activationAmountLabel,
              })}
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
              {t("ui_activation_request_subtitle_9a2d7f5c1e", "QR XUMM pour {{amount}} XRP.", {
                amount: activationAmountLabel,
              })}
            </p>
          </div>

          {xummPayload?.qrUrl ? (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-black/60 border border-white/10 rounded-xl p-3">
                <img
                  src={xummPayload.qrUrl}
                  alt={t("ui_xumm_qr_code_282d93fd60", "Code QR XUMM")}
                  className="h-[180px] w-[180px]"
                />
              </div>
              {transactionCode ? (
                <div className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/70 break-all">
                  <span className="text-white/40">{t("ui_transaction_code_2a6c9b1d5e", "Code de transaction")}:</span>{" "}
                  <a
                    href={transactionCode}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/90 underline underline-offset-2 hover:text-white">
                    {transactionCode}
                  </a>
                </div>
              ) : null}
            </div>
          ) : isLoading ? (
            <div className="text-xs text-white/70 bg-black/30 border border-white/10 rounded-md px-3 py-2">
              {t("ui_activation_request_loading_2b9d7f1c5a", "Preparation du QR XUMM...")}
            </div>
          ) : xummError ? (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {t("ui_activation_request_qr_error_9f1a2b3c4d", "Erreur lors de la creation du QR XUMM.")}
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
              disabled={!shareLink}
              className="w-full rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/80 text-black font-semibold transition-all duration-200 hover:bg-[#22C55E] hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed">
              {t("ui_share_request_4b9a2d7f1c", "Partager")}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!transactionCode}
              className="w-full rounded-lg border border-white/20 bg-transparent text-white/70 font-semibold transition-all duration-200 hover:border-white/35 hover:text-white/90 disabled:opacity-60 disabled:cursor-not-allowed">
              {copied
                ? t("ui_copied_9a2d7f5c1e", "Copie")
                : t("ui_copy_request_32a3f4409b", "Copier le code")}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
