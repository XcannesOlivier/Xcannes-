"use client";

import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/utils/useModalTransition";

export default function WalletActivationModal({
  open,
  onClose,
  onSendFromWallet,
  onRequestFromThirdParty,
  onBuyViaMoonpay,
  activationBundleEnabled = false,
  onToggleActivationBundle,
  activationAmountXrp = 1,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null,
  inline = false,
}) {
  const { t } = useTranslation("common");
  const showNotConnectedNotice = isPreviewMode;
  const showRlusdNotActivatedNotice =
    !isPreviewMode && isWalletActivated === true && hasRlusdTrustline === false;
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const actionCardBase =
    "group w-full text-left rounded-xl border border-white/10 bg-black/30 hover:bg-black/40 px-4 py-3 transition-all duration-200 hover:border-white/20 hover:-translate-y-0.5";
  const actionTitle = "text-sm font-semibold text-white";
  const actionDesc = "mt-1 text-[11px] text-white/60";
  const actionIconBase =
    "flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-all duration-200 group-hover:border-white/25 group-hover:bg-white/10";
  const actionArrowBase =
    "text-white/30 transition-colors duration-200 group-hover:text-white/60";
  const currentActivationAmountLabel =
    Number(activationAmountXrp) === 1.4
      ? "1.40"
      : String(activationAmountXrp || "1");
  const bundleAmountLabel = "1.40";
  const bundleCardClass = activationBundleEnabled
    ? "border-emerald-400/40 bg-emerald-500/10"
    : "border-white/10 bg-black/30";

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[11001] flex items-center justify-center px-4 pointer-events-none";
  const panelClass = [
    inline
      ? "relative w-full wallet-modal-panel h-full bg-elevated border border-subtle rounded-xl p-4 md:p-5 space-y-4 pointer-events-auto shadow-2xl overflow-y-auto"
      : "relative w-full wallet-modal-panel max-w-md bg-elevated border border-subtle rounded-2xl p-4 md:p-5 space-y-4 pointer-events-auto shadow-2xl",
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
          onClick={() => {
            onToggleActivationBundle?.(false);
            onClose?.();
          }}
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
            onClick={() => {
              onToggleActivationBundle?.(false);
              onClose?.();
            }}
            className="wallet-modal-close absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl"
            aria-label={t("ui_close_08378568ba", "Close")}
          >
            ✕
          </button>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c1b2e]/80 via-[#0b1017]/90 to-black/80 p-4 shadow-lg">
            <div className="absolute right-4 top-4 hidden h-12 w-12 rounded-full bg-white/5 blur-xl md:block" />
            <div className="relative pr-8 space-y-2">
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
                <span className="h-1.5 w-1.5 rounded-full bg-xcannes-green/80" />
                {t("ui_activation_label_2a9d7f1b5c", "Activation")}
              </div>
              <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                {t("ui_get_1_xrp_title_9d07f2455a", "Obtenir {{amount}} XRP", {
                  amount: currentActivationAmountLabel,
                })}
              </h3>
              <p className="text-sm text-white/70">
                {t(
                  "ui_need_1_xrp_to_activate_8b6c7f2c5f",
                  "Il faut {{amount}} XRP pour activer.",
                  {
                    amount: currentActivationAmountLabel,
                  },
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {showNotConnectedNotice ? (
                  <span className="inline-flex items-center text-xcannes-yellow text-xs font-semibold leading-none px-2 py-1 rounded-full bg-amber-500/10 border border-amber-400/30">
                    {t("wallet_not_connected_title", "Wallet not connected")}
                  </span>
                ) : null}
                {showRlusdNotActivatedNotice ? (
                  <span className="inline-flex items-center text-amber-300 text-xs font-semibold leading-none px-2 py-1 rounded-full bg-amber-500/10 border border-amber-400/30">
                    {t(
                      "wallet_rlusd_not_activated_title",
                      "USD not activated. Authorize USD on your wallet.",
                    )}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`rounded-xl border px-4 py-3 ${bundleCardClass}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-xcannes-green"
                checked={activationBundleEnabled}
                onChange={(e) => onToggleActivationBundle?.(e.target.checked)}
              />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">
                  {t(
                    "ui_activation_bundle_title_8c1d7f2b9e",
                    "Option {{amount}} XRP",
                    {
                      amount: bundleAmountLabel,
                    },
                  )}
                </div>
                <div className="text-[11px] text-white/60">
                  {t(
                    "ui_activation_bundle_desc_4b7a1c9e2d",
                    "Activer le wallet et avoir de quoi activer USD.",
                  )}
                </div>
              </div>
            </label>
          </div>
          {activationBundleEnabled ? (
            <div className="text-[11px] text-emerald-200/90">
              {t(
                "ui_activation_amount_summary_7a2c9d1e5b",
                "Montant choisi : {{amount}} XRP",
                {
                  amount: bundleAmountLabel,
                },
              )}
            </div>
          ) : null}

          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => onRequestFromThirdParty?.()}
              className={`${actionCardBase} order-1 md:order-2`}
            >
              <div className="flex items-center gap-3">
                <div className={actionIconBase}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 7h10a3 3 0 0 1 0 6H9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 13l-3 3 3 3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 4h6v6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className={actionTitle}>
                    {t(
                      "ui_activation_request_third_party_2a4d2f92e3",
                      "Demander a un tiers (QR XUMM)",
                    )}
                  </div>
                  <div className={actionDesc}>
                    {t(
                      "ui_activation_request_desc_2a5a1c7b4d",
                      "Generer un QR XUMM a scanner ou partager.",
                    )}
                  </div>
                </div>
                <div className={actionArrowBase}>›</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onSendFromWallet?.()}
              className={`${actionCardBase} order-2 md:order-1`}
            >
              <div className="flex items-center gap-3">
                <div className={actionIconBase}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 12h16"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className={actionTitle}>
                    {t(
                      "ui_activation_send_other_wallet_4d9b7f2a1e",
                      "Envoyer depuis un autre wallet (XUMM)",
                    )}
                  </div>
                  <div className={actionDesc}>
                    {t(
                      "ui_activation_send_other_wallet_desc_4b3a2d9c7f",
                      "Ouvre XUMM et envoie {{amount}} XRP depuis un autre wallet.",
                      { amount: currentActivationAmountLabel },
                    )}
                  </div>
                </div>
                <div className={actionArrowBase}>›</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onBuyViaMoonpay?.()}
              className={`${actionCardBase} order-3`}
            >
              <div className="flex items-center gap-3">
                <div className={actionIconBase}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 7h18v10H3z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="M7 15h4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className={actionTitle}>
                    {t(
                      "ui_activation_buy_moonpay_23a9c1d5fe",
                      "Acheter via partenaire (MoonPay)",
                    )}
                  </div>
                  <div className={actionDesc}>
                    {t(
                      "ui_activation_buy_moonpay_desc_5c1d9a2b7e",
                      "Acheter du XRP avec carte ou virement.",
                    )}
                  </div>
                </div>
                <div className={actionArrowBase}>›</div>
              </div>
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
