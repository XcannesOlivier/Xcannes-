"use client";

import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";

export default function DemoWalletDashboardSendChoiceModal({
  open,
  onClose,
  onChooseQuickScan,
  onChooseSimpleSend,
  onChoosePayRequest,
  renderWalletMeta,
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
    : "fixed inset-0 z-[10001] flex items-end justify-center pointer-events-none";

  const panelClass = [
    "relative w-full wallet-modal-panel wallet-modal-no-top-highlight-mobile overflow-hidden flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)]",
    inline ? "h-full max-h-none rounded-xl" : "h-screen rounded-none",
    "bg-xcannes-surface-demo demo-wallet-tooltip-scope",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const cardCls =
    "w-full rounded-[18px] ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)] px-4 py-4 flex items-center justify-between gap-4 text-left hover:ring-white/15 hover:bg-white/[0.04] transition-colors";

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
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}
        >
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_12%_0%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(600px_circle_at_100%_50%,rgba(0,255,150,0.06),transparent_60%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
          </div>

          <div className="relative z-10 flex flex-col flex-1 min-h-0">
            {!inline ? (
              <div className="flex justify-center pt-3 pb-0" aria-hidden>
                <span className="block w-12 h-1.5 rounded-full bg-white/20" />
              </div>
            ) : null}

            <div className="flex-1 min-h-0 flex flex-col">
              <div className="pt-[70px] pb-3 flex flex-col items-center text-center">
                <h3 className="mt-1 px-6 text-[30px] font-semibold text-white/95 tracking-tight">
                  {t(
                    "ui_send_choice_subtitle",
                    "Comment souhaitez-vous envoyer de l'argent ?",
                  )}
                </h3>
                <p className="mt-2 text-[14px] text-white/60 max-w-[34ch] leading-relaxed">
                  {t(
                    "ui_send_choice_hint",
                    "Choisissez le type d’envoi qui correspond à votre besoin.",
                  )}
                </p>

                <div className="mt-[40px] flex justify-center px-4 w-full">
                  <div className="rounded-[18px] bg-elevated ring-1 ring-white/10 ring-inset px-4 py-3 shadow-none">
                    <div className="text-[11px] text-white/45 text-center">
                      {t("moonpay_from_account", "Compte source")}
                    </div>
                    <div className="mt-1 flex justify-center">
                      {renderWalletMeta?.("text-center [&_.font-mono]:hidden")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 px-4 pb-6 flex flex-col justify-center gap-3">
                <button
                  type="button"
                  onClick={onChooseSimpleSend}
                  className={cardCls}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-white/95">
                      {t("ui_send_choice_simple", "Envoyer un paiement")}
                    </div>
                    <div className="mt-1 text-[12px] text-white/55 leading-snug">
                      {t(
                        "ui_send_choice_simple_hint",
                        "Saisir une adresse et un montant.",
                      )}
                    </div>
                  </div>
                  <span className="text-white/35 text-2xl leading-none">›</span>
                </button>

                <button
                  type="button"
                  onClick={onChooseQuickScan}
                  className={cardCls}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-white/95">
                      {t("ui_send_choice_quickscan", "Scanner un QR")}
                    </div>
                    <div className="mt-1 text-[12px] text-white/55 leading-snug">
                      {t(
                        "ui_send_choice_quickscan_hint",
                        "Importer un QR ou coller un code.",
                      )}
                    </div>
                  </div>
                  <span className="text-white/35 text-2xl leading-none">›</span>
                </button>

                <button
                  type="button"
                  onClick={onChoosePayRequest || onChooseQuickScan}
                  className={cardCls}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-white/95">
                      {t("ui_send_choice_payreq", "Payer une demande")}
                    </div>
                    <div className="mt-1 text-[12px] text-white/55 leading-snug">
                      {t(
                        "ui_send_choice_payreq_hint",
                        "Scanner une demande de paiement (payreq).",
                      )}
                    </div>
                  </div>
                  <span className="text-white/35 text-2xl leading-none">›</span>
                </button>
              </div>

              <div className="px-4 pb-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 rounded-[16px] bg-white/5 hover:bg-white/10 ring-1 ring-white/10 ring-inset text-white/80 text-[14px] font-medium transition-colors"
                >
                  {t("close", "Fermer")}
                </button>
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

