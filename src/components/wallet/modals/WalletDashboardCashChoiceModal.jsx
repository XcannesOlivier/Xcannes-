"use client";

import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";

export default function WalletDashboardCashChoiceModal({
  open,
  onClose,
  onChooseBuy,
  onChooseSell,
  onChooseUsdSwapOut,
  onChooseUsdSwapIn,
  noticeVariant = "preview",
  inline = false,
}) {
  const { t } = useTranslation("common");
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-cash-modal border-white/10 md:border overflow-hidden flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-screen md:h-auto md:max-w-lg md:max-h-[100vh] rounded-none md:rounded-2xl",
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const content = (
    <>
      {/* Backdrop */}
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={onClose}
        />
      ) : null}

      {/* Modal */}
      <div className={wrapperClass}>
        <div
          className={panelClass}
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}
        >
          <div className="border-b border-white/10">
            <div className="flex items-start justify-between p-4 gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-white font-semibold text-base md:text-lg leading-tight">
                    {t("ui_funds_manage_title", "Gérer vos fonds")}
                  </h3>
                  {noticeVariant === "demo" ? (
                    <span className="inline-flex items-center text-white/80 text-xs md:text-sm font-semibold px-2 py-1 leading-none">
                      {t("demo_notice_title", "Mode démo")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs md:text-sm text-white/60">
                  {t(
                    "ui_funds_manage_subtitle",
                    "Ajoutez, retirez ou échangez vos stablecoins USD.",
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="wallet-modal-close md:absolute md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5">
            <div className="space-y-3">
              <button
                type="button"
                onClick={onChooseBuy}
                className="w-full text-left rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)] transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-xcannes-green/10 ring-1 ring-xcannes-green/25 ring-inset flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-xcannes-green" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 5V19M5 12H19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[16px] md:text-[17px] text-white font-semibold truncate">
                        {t("ui_funds_add_title", "ajouter des fonds")}
                      </p>
                      <svg className="w-5 h-5 text-white/50" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M9 18L15 12L9 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p className="mt-1 text-[11px] md:text-xs text-white/60">
                      {t(
                        "ui_funds_add_hint",
                        "Par carte ou virement via partenaire.",
                      )}
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={onChooseSell}
                className="w-full text-left rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)] transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white/80" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12H19M12 5L19 12L12 19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[16px] md:text-[17px] text-white font-semibold truncate">
                        {t("ui_funds_withdraw_title", "virement")}
                      </p>
                      <svg className="w-5 h-5 text-white/50" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M9 18L15 12L9 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p className="mt-1 text-[11px] md:text-xs text-white/60">
                      {t(
                        "ui_funds_withdraw_hint",
                        "Vers votre compte bancaire.",
                      )}
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={onChooseUsdSwapOut}
                className="w-full text-left rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)] transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white/80" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M7 7H21M21 7V21M21 7L14 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M17 17H3M3 17V3M3 17L10 10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[16px] md:text-[17px] text-white font-semibold truncate">
                        {t("ui_funds_swap_out_title", "RLUSD (XRPL) → stablecoin USD")}
                      </p>
                      <svg className="w-5 h-5 text-white/50" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M9 18L15 12L9 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p className="mt-1 text-[11px] md:text-xs text-white/60">
                      {t(
                        "ui_funds_swap_out_hint",
                        "Recevoir USDC/USDT (multi-chain) sur une autre adresse.",
                      )}
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={onChooseUsdSwapIn}
                className="w-full text-left rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)] transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white/80" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M7 7H21M21 7V21M21 7L14 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M17 17H3M3 17V3M3 17L10 10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[16px] md:text-[17px] text-white font-semibold truncate">
                        {t("ui_funds_swap_in_title", "Stablecoin USD → RLUSD (XRPL)")}
                      </p>
                      <svg className="w-5 h-5 text-white/50" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M9 18L15 12L9 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p className="mt-1 text-[11px] md:text-xs text-white/60">
                      {t(
                        "ui_funds_swap_in_hint",
                        "Envoyer depuis un wallet externe et recevoir sur votre adresse XRPL.",
                      )}
                    </p>
                  </div>
                </div>
              </button>
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
