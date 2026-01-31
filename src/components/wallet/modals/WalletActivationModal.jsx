"use client";

import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";

export default function WalletActivationModal({
  open,
  onClose,
  onSendFromWallet,
  onRequestFromThirdParty,
  onBuyViaMoonpay,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null
}) {
  const { t } = useTranslation("common");
  const showNotConnectedNotice = isPreviewMode;
  const showRlusdNotActivatedNotice =
    !isPreviewMode && isWalletActivated === true && hasRlusdTrustline === false;
  if (!open) return null;
  if (typeof document === "undefined") return null;

  const actionCardBase =
    "w-full text-left rounded-xl border border-white/10 bg-black/30 hover:bg-black/40 px-4 py-3 transition-colors";
  const actionTitle = "text-sm font-semibold text-white";
  const actionDesc = "mt-1 text-[11px] text-white/60";

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
              {t("ui_get_1_xrp_title_9d07f2455a", "Obtenir 1 XRP")}
            </h3>
            {showNotConnectedNotice ? (
              <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none mt-1">
                {t("wallet_not_connected_title", "Wallet not connected")}
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
              {t("ui_need_1_xrp_to_activate_8b6c7f2c5f", "Il faut 1 XRP pour activer.")}
            </p>
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => onRequestFromThirdParty?.()}
              className={`${actionCardBase} order-1 md:order-2`}>
              <div className={actionTitle}>
                {t("ui_activation_request_third_party_2a4d2f92e3", "Demander a un tiers (QR + code)")}
              </div>
              <div className={actionDesc}>
                {t(
                  "ui_activation_request_desc_2a5a1c7b4d",
                  "Generer un QR ou un code a partager par mail, SMS ou message."
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onSendFromWallet?.()}
              className={`${actionCardBase} order-2 md:order-1`}>
              <div className={actionTitle}>
                {t("ui_activation_send_other_wallet_4d9b7f2a1e", "Envoyer depuis un autre wallet (XUMM)")}
              </div>
              <div className={actionDesc}>
                {t(
                  "ui_activation_send_other_wallet_desc_4b3a2d9c7f",
                  "Ouvre XUMM et copie l adresse pour envoyer 1 XRP."
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onBuyViaMoonpay?.()}
              className={`${actionCardBase} order-3`}>
              <div className={actionTitle}>
                {t("ui_activation_buy_moonpay_23a9c1d5fe", "Acheter via partenaire (MoonPay)")}
              </div>
              <div className={actionDesc}>
                {t(
                  "ui_activation_buy_moonpay_desc_5c1d9a2b7e",
                  "Acheter du XRP avec carte ou virement."
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
