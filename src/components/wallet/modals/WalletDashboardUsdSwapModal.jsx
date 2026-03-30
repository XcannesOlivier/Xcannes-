"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useModalTransition } from "@/hooks/useModalTransition";
import { greenActionBtnBase } from "./walletModalTokens";

const USD_STABLECOIN_OPTIONS = [
  { code: "USDC", label: "USDC" },
  { code: "USDT", label: "USDT" },
];

export default function WalletDashboardUsdSwapModal({
  open,
  onClose,
  walletLabel = "",
  walletAddress = "",
  noticeVariant = "preview",
  inline = false,
}) {
  const { t } = useTranslation("common");
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  const [step, setStep] = useState("form"); // form | confirm | pending | success
  const [toAsset, setToAsset] = useState("USDC");
  const [amount, setAmount] = useState("");

  const parsedAmount = useMemo(() => Number(String(amount || "").trim()), [amount]);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const toOption = USD_STABLECOIN_OPTIONS.find((opt) => opt.code === toAsset);
  const toLabel = toOption?.label || toAsset;

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-convert-modal border-white/10 md:border overflow-hidden flex flex-col min-h-0 pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
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
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={() => {
            setStep("form");
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
          <div className="border-b border-white/10">
            <div className="flex items-start justify-between p-4 gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-white font-semibold text-base md:text-lg leading-tight">
                    {t("ui_usd_swap_title", "Échanger des stablecoins USD")}
                  </h3>
                  {noticeVariant === "demo" ? (
                    <span className="inline-flex items-center text-white/80 text-xs md:text-sm font-semibold px-2 py-1 leading-none">
                      {t("demo_notice_title", "Mode démo")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs md:text-sm text-white/60">
                  {t(
                    "ui_usd_swap_subtitle",
                    "Échangez RLUSD contre USDC ou USDT via un partenaire d’échange.",
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  onClose?.();
                }}
                className="wallet-modal-close md:absolute md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5">
            {step === "success" ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircleIcon className="w-14 h-14 text-xcannes-green mb-3" />
                <div className="text-white font-semibold text-lg">
                  {t("ui_usd_swap_success_title", "Échange confirmé")}
                </div>
                <div className="mt-2 text-sm text-white/60 max-w-sm">
                  {t(
                    "ui_usd_swap_success_body",
                    "Votre échange est en cours de traitement. Le délai et les frais dépendent du partenaire.",
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    onClose?.();
                  }}
                  className={`mt-6 w-full max-w-sm py-3 ${greenActionBtnBase}`}
                >
                  {t("ui_close_08378568ba", "Fermer")}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
                  <p className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                    {t("moonpay_from_account", "Depuis le compte")}
                  </p>
                  {String(walletLabel || "").trim() ? (
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-xcannes-green/80 shrink-0"
                        aria-hidden
                      />
                      <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
                        {walletLabel}
                      </p>
                    </div>
                  ) : null}
                  {String(walletAddress || "").trim() ? (
                    <p className="text-[10px] md:text-[11px] text-white/60 font-mono break-all">
                      {walletAddress}
                    </p>
                  ) : null}
                </div>

                {step === "pending" ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xcannes-green mb-4" />
                    <p className="text-white/80">
                      {t("ui_usd_swap_pending", "Connexion au partenaire…")}
                    </p>
                  </div>
                ) : null}

                {step === "form" ? (
                  <>
                    <div>
                      <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                        {t("ui_usd_swap_receive_in", "Recevoir en")}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {USD_STABLECOIN_OPTIONS.map((opt) => {
                          const active = opt.code === toAsset;
                          return (
                            <button
                              key={opt.code}
                              type="button"
                              onClick={() => setToAsset(opt.code)}
                              className={[
                                "rounded-xl px-4 py-3 ring-1 ring-inset transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
                                active
                                  ? "bg-xcannes-green/10 ring-xcannes-green/35 text-white"
                                  : "bg-black/20 ring-white/10 text-white/70 hover:bg-black/30 hover:text-white/90 hover:ring-white/15",
                              ].join(" ")}
                            >
                              <div className="text-base font-semibold">{opt.label}</div>
                              <div className="mt-0.5 text-[11px] text-white/55">
                                {t(
                                  opt.code === "USDC"
                                    ? "ui_usd_swap_usdc_hint"
                                    : "ui_usd_swap_usdt_hint",
                                  opt.code === "USDC"
                                    ? "USD Coin (stablecoin USD)"
                                    : "Tether (stablecoin USD)",
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                        {t("ui_usd_swap_amount_usd", "Montant en USD")}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="100"
                          step="10"
                          min="0"
                          className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 pr-16 transition-all duration-150"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                          USD
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
                      {t(
                        "ui_usd_swap_explain",
                        "Un swap entre stablecoins USD vise généralement une valeur 1:1. Des frais et délais peuvent s’appliquer selon le partenaire.",
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!hasValidAmount}
                      onClick={() => setStep("confirm")}
                      className={`w-full text-xl py-4 ${greenActionBtnBase}`}
                    >
                      {t("ui_action_continue", "Continuer")}
                    </button>
                  </>
                ) : null}

                {step === "confirm" ? (
                  <>
                    <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-black/20">
                      <p className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                        {t("ui_review", "Récapitulatif")}
                      </p>
                      <div className="text-white/80 text-sm">
                        <div>
                          {t("ui_usd_swap_you_exchange", "Vous échangez")}{" "}
                          <span className="text-white font-semibold">
                            {hasValidAmount ? parsedAmount : 0} RLUSD
                          </span>
                        </div>
                        <div className="mt-1">
                          {t("ui_usd_swap_you_receive", "Vous recevez")}{" "}
                          <span className="text-white font-semibold">
                            {toLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep("form")}
                        className="flex-1 rounded-lg border border-white/10 bg-black/20 text-white/70 font-semibold py-3 transition-colors hover:bg-black/30 hover:text-white"
                      >
                        {t("ui_back", "Retour")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStep("pending");
                          window.setTimeout(() => setStep("success"), 900);
                        }}
                        className={`flex-1 py-3 ${greenActionBtnBase}`}
                      >
                        {t("ui_confirm", "Confirmer")}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

