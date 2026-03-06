"use client";

import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/utils/useModalTransition";

export default function WalletActivationRequestModal({
  open,
  onClose,
  walletAddress,
  activationAmountXrp = 1,
  inline = false,
}) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);
  const activationAmountLabel =
    Number(activationAmountXrp) === 1.4
      ? "1.40"
      : String(activationAmountXrp || "1");

  // Build a simple XRPL payment request URI
  const paymentUri = useMemo(() => {
    if (!walletAddress) return "";
    const amountDrops = Math.round(Number(activationAmountXrp) * 1_000_000);
    const drops = Number.isFinite(amountDrops) && amountDrops > 0 ? amountDrops : 1_000_000;
    // Standard XRPL PayString / payment URI format
    return `https://xcannes.com/wallet?pay=${walletAddress}&amount=${drops}`;
  }, [walletAddress, activationAmountXrp]);

  const shareText = useMemo(() => {
    if (!paymentUri) return "";
    return `${t(
      "ui_activation_share_text_7f0f1c9a2d",
      "Demande {{amount}} XRP XCANNES:",
      {
        amount: activationAmountLabel,
      },
    )}\n${paymentUri}`;
  }, [activationAmountLabel, paymentUri, t]);

  const handleCopy = async () => {
    if (!paymentUri || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(walletAddress || paymentUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    if (!paymentUri || typeof navigator === "undefined") return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t(
            "ui_activation_share_title_8b2d9f1a5c",
            "Demande de paiement",
          ),
          text: shareText,
          url: paymentUri,
        });
        return;
      } catch {
        // fall through
      }
    }
    handleCopy();
  };

  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[11001] flex items-center justify-center px-4 pointer-events-none";
  const panelClass = [
    inline
      ? "relative w-full wallet-modal-panel h-full bg-elevated border border-subtle rounded-xl p-4 md:p-5 space-y-3 pointer-events-auto shadow-2xl overflow-y-auto"
      : "relative w-full wallet-modal-panel max-w-md bg-elevated border border-subtle rounded-2xl p-4 md:p-5 space-y-3 pointer-events-auto shadow-2xl",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {!inline ? (
        <div
          className={`fixed inset-0 z-[11000] bg-black/80 md:backdrop-blur-sm ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={() => onClose?.()}
        />
      ) : null}

      <div className={wrapperClass}>
        <div
          className={panelClass}
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={() => onClose?.()}
            className="wallet-modal-close absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl"
            aria-label={t("ui_close_08378568ba", "Close")}
          >
            ✕
          </button>

          <div className="pr-8">
            <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
              {t(
                "ui_activation_request_title_6b7c3e2a1f",
                "Demande {{amount}} XRP",
                {
                  amount: activationAmountLabel,
                },
              )}
            </h3>

            <p className="mt-1 text-sm text-white/60">
              {t(
                "ui_activation_request_subtitle_9a2d7f5c1e",
                "Envoyez {{amount}} XRP à cette adresse.",
                {
                  amount: activationAmountLabel,
                },
              )}
            </p>
          </div>

          {walletAddress ? (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-black/60 border border-white/10 rounded-xl p-4 w-full">
                <div className="text-[11px] text-white/40 mb-1">
                  {t("ui_wallet_address_label", "Adresse wallet")}
                </div>
                <div className="text-sm text-white/90 font-mono break-all">
                  {walletAddress}
                </div>
              </div>
              {paymentUri ? (
                <div className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/70 break-all">
                  <span className="text-white/40">
                    {t("ui_transaction_code_2a6c9b1d5e", "Lien de paiement")}
                    :
                  </span>{" "}
                  <a
                    href={paymentUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/90 underline underline-offset-2 hover:text-white"
                  >
                    {paymentUri}
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {t(
                "ui_activation_request_error_6c1f7a2b9d",
                "Adresse wallet manquante.",
              )}
            </div>
          )}

          <div className="grid gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={!paymentUri}
              className="w-full rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/80 text-black font-semibold transition-all duration-200 hover:bg-[#22C55E] hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              {t("ui_share_request_4b9a2d7f1c", "Partager")}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!walletAddress}
              className="w-full rounded-lg border border-white/20 bg-transparent text-white/70 font-semibold transition-all duration-200 hover:border-white/35 hover:text-white/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {copied
                ? t("ui_copied_9a2d7f5c1e", "Copie")
                : t("ui_copy_request_32a3f4409b", "Copier le code")}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
