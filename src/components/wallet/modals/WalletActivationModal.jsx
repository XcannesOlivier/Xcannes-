"use client";

import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import {
  MOONPAY_UI_ENABLED,
  RAMP_DEFAULT_PROVIDER,
  TOPPER_UI_ENABLED,
} from "@/utils/featureFlags";

export default function WalletActivationModal({
  open,
  onClose,
  onSendFromWallet,
  onRequestFromThirdParty,
  onBuyViaMoonpay,
  inline = false,
}) {
  const { t } = useTranslation("common");
  const moonpayEnabled = MOONPAY_UI_ENABLED;
  const topperEnabled = TOPPER_UI_ENABLED;
  const bothProvidersEnabled = moonpayEnabled && topperEnabled;
  const preferredProvider = String(RAMP_DEFAULT_PROVIDER || "moonpay")
    .trim()
    .toLowerCase();
  const primaryProvider =
    preferredProvider === "topper" && topperEnabled ? "Topper" : "MoonPay";
  const providerLabel = bothProvidersEnabled
    ? "MoonPay / Topper"
    : topperEnabled
      ? "Topper"
      : "MoonPay";
  const buyTitle =
    moonpayEnabled && !topperEnabled
      ? t(
          "ui_activation_buy_moonpay_23a9c1d5fe",
          "Acheter via partenaire (MoonPay)",
        )
      : t("ui_activation_buy_partner", {
          defaultValue: bothProvidersEnabled
            ? `Acheter via partenaire (${providerLabel})`
            : `Acheter via partenaire (${primaryProvider})`,
        });
  const buyDesc =
    moonpayEnabled && !topperEnabled
      ? t(
          "ui_activation_buy_moonpay_desc_5c1d9a2b7e",
          "Acheter du XRP avec carte ou virement.",
        )
      : t("ui_activation_buy_partner_desc", {
          defaultValue: bothProvidersEnabled
            ? "Choisissez MoonPay ou Topper pour acheter du XRP."
            : "Acheter du XRP avec carte ou virement.",
        });
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
  const activationAmountLabel = "1";

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

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c1b2e]/80 via-[#0b1017]/90 to-black/80 p-4 shadow-lg">
            <div className="absolute right-4 top-4 hidden h-12 w-12 rounded-full bg-white/5 blur-xl md:block" />
            <div className="relative pr-8 space-y-2">
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/60">
                <span className="h-1.5 w-1.5 rounded-full bg-xcannes-green/80" />
                {t("ui_activation_label_2a9d7f1b5c", "Activation")}
              </div>
              <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                {t("ui_get_1_xrp_title_9d07f2455a", "Obtenir {{amount}} XRP", {
                  amount: activationAmountLabel,
                })}
              </h3>
              <p className="text-sm text-white/80">
                {t(
                  "ui_need_1_xrp_to_activate_8b6c7f2c5f",
                  "Il faut {{amount}} XRP pour activer.",
                  {
                    amount: activationAmountLabel,
                  },
                )}
              </p>

            </div>
          </div>

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
                      "Demander a un tiers",
                    )}
                  </div>
                  <div className={actionDesc}>
                    {t(
                      "ui_activation_request_desc_2a5a1c7b4d",
                      "Generer un lien a scanner ou partager.",
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
                      "Envoyer depuis un autre wallet",
                    )}
                  </div>
                  <div className={actionDesc}>
                    {t(
                      "ui_activation_send_other_wallet_desc_4b3a2d9c7f",
                      "Envoie {{amount}} XRP depuis un autre wallet.",
                      { amount: activationAmountLabel },
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
                    {buyTitle}
                  </div>
                  <div className={actionDesc}>
                    {buyDesc}
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
