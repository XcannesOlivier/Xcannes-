"use client";

import DemoMoonPayBuyModal from "./DemoMoonPayBuyModal";
import DemoMoonPaySellModal from "./DemoMoonPaySellModal";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";

const FundsCardAddIcon = () => (
  <svg viewBox="0 0 48 48" className="w-11 h-11" fill="none" aria-hidden>
    <rect
      x="6"
      y="14"
      width="32"
      height="22"
      rx="6"
      className="fill-xcannes-green/15 stroke-xcannes-green/45"
      strokeWidth="0.9"
    />
    <rect x="10" y="18" width="18" height="4" rx="2" className="fill-xcannes-green/35" />
    <rect x="10" y="26" width="12" height="3" rx="1.5" className="fill-xcannes-green/25" />
    <path
      d="M36 24v8m-4-4h8"
      className="stroke-xcannes-green"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const FundsCardBankIcon = () => (
  <svg viewBox="0 0 48 48" className="w-11 h-11" fill="none" aria-hidden>
    <path
      d="M10 18l14-8 14 8"
      className="stroke-white/80"
      strokeWidth="0.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M14 18h20" className="stroke-white/80" strokeWidth="0.9" strokeLinecap="round" />
    <path
      d="M16 18v16m6-16v16m6-16v16m6-16v16"
      className="stroke-white/60"
      strokeWidth="0.9"
      strokeLinecap="round"
    />
    <path d="M12 34h24" className="stroke-white/80" strokeWidth="0.9" strokeLinecap="round" />
    <path d="M10 38h28" className="stroke-white/75" strokeWidth="0.9" strokeLinecap="round" />
  </svg>
);

const ChevronRight = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M9 18L15 12L9 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function DemoWalletDashboardCashModal({
  open,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  demoMode = false,
  onDemoBuy,
  onDemoSell,
  cashModalTab,
  setCashModalTab,
  renderWalletMeta,
  walletLabel = "",
  hideWalletAddress = false,
  preferredFiatCurrency = "",
  availableTokens,
  rlusdPerUnitRates,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  walletAddress,
  inline = false,
}) {
  const { t } = useTranslation("common");
  const normalizedTab = String(cashModalTab || "")
    .trim()
    .toLowerCase();
  const cashView = normalizedTab === "buy" || normalizedTab === "sell" ? normalizedTab : "choice";
  const isChoiceView = cashView === "choice";
  const headerTitle = isChoiceView
    ? t("ui_funds_manage_title", "Gérer vos fonds")
    : cashView === "buy"
      ? t("ui_funds_increase_balances_title", "Ajouter des fonds")
      : t("ui_funds_withdraw_title_mobile", "Transférer vers la banque");
  const headerSubtitle = isChoiceView
    ? t(
        "ui_funds_manage_subtitle",
        "Ajoutez, retirez ou transférez vos fonds facilement.",
      )
    : "";
  const walletLabelDisplay = String(walletLabel || "").trim() || "XCANNES";
  const cashNote =
    noticeVariant === "demo"
      ? t(
          "ui_fiat_gateway_note_demo_6f1d8c2a9b",
          "Buy/sell are simulated, no MoonPay redirect.",
        )
      : t(
          "ui_fiat_gateway_note_live_4b8c2d1e9f",
          "Buy/sell via MoonPay (partner). Availability depends on country and payment method. Rates and fees are shown before confirmation.",
        );
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end justify-center pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-cash-modal overflow-hidden flex flex-col pointer-events-auto",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-full rounded-none",
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
          className={`fixed inset-0 z-[10000] bg-black/80 ${
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
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_12%_0%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(850px_circle_at_95%_92%,rgba(0,255,150,0.06),transparent_55%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
          </div>

          <div className="relative z-10 flex flex-col flex-1 min-h-0">
            <div className="border-b border-white/10">
              {!inline ? (
                <div className="flex justify-center pt-3 pb-0" aria-hidden>
                  <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                </div>
              ) : null}

              <div className="pt-6 pb-3 flex flex-col items-center text-center px-4">
                <div className="w-full flex items-center justify-between">
                  <div className="w-10" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <h3 className="mt-1 text-[30px] font-semibold text-white/95 tracking-tight truncate">
                      {headerTitle}
                    </h3>
                    {noticeVariant === "demo" ? (
                      <span className="mt-2 inline-flex items-center text-white/80 text-sm font-semibold px-2 py-1 leading-none">
                        {t("demo_notice_title", "Mode démo")}
                      </span>
                    ) : null}
                    {headerSubtitle ? (
                      <p className="mt-2 text-[14px] text-white/60 max-w-[34ch] mx-auto leading-relaxed">
                        {headerSubtitle}
                      </p>
                    ) : null}
                  </div>
                  <div className="w-10 flex items-center justify-end">
                    {!isChoiceView ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCashModalTab?.("choice");
                        }}
                        className="wallet-modal-close w-10 h-10 rounded-full bg-white/10 ring-1 ring-white/10 hover:bg-white/[0.15] transition-colors text-white/90 flex items-center justify-center"
                        aria-label={t("back", "Back")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-5 h-5"
                          aria-hidden="true"
                        >
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose?.();
                        }}
                        className="wallet-modal-close w-10 h-10 rounded-full bg-white/10 ring-1 ring-white/10 hover:bg-white/[0.15] transition-colors text-white/90 flex items-center justify-center"
                        aria-label={t("close", "Close")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-5 h-5"
                          aria-hidden="true"
                        >
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {!isChoiceView ? (
                  <div className="mt-2 w-full flex justify-center">
                    <div className="rounded-[18px] bg-elevated ring-1 ring-white/10 ring-inset px-5 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]">
                      <div className="text-[11px] text-white/45 text-center">
                        {t("moonpay_from_account", "Compte source")}
                      </div>
                      <div className="mt-1 flex justify-center">
                        {renderWalletMeta?.("text-center [&_.font-mono]:hidden")}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div
              className="flex-1 min-h-0 overflow-y-auto p-4"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div key={cashView} className="wallet-tab-unfold-in h-full">
                {isChoiceView ? (
                  <div className="flex flex-col gap-7 pb-2">
                    {(() => {
                      const sectionHeader = (label) => (
                        <div className="flex items-center gap-3 px-1">
                          <div className="text-[13px] tracking-[0.22em] text-white/45">
                            {label}
                          </div>
                          <div className="h-px flex-1 bg-white/10" aria-hidden />
                        </div>
                      );

                      const cardClassName =
                        "w-full text-left rounded-[20px] px-4 py-4 bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.03] ring-1 ring-white/10 ring-inset shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]";

                      return (
                        <>
                          <div className="space-y-4">
                            {sectionHeader(
                              t("ui_funds_section_agent", "Compte bancaire"),
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCashModalTab?.("buy");
                              }}
                              className={cardClassName}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-[16px] bg-transparent flex items-center justify-center flex-shrink-0">
                                  <FundsCardAddIcon />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[18px] text-white font-semibold truncate">
                                      {t(
                                        "ui_funds_increase_balances_title",
                                        "Ajouter des fonds",
                                      )}
                                    </p>
                                    <ChevronRight className="w-5 h-5 text-white/45" />
                                  </div>
                                  <p className="mt-1 text-[15px] leading-snug text-white/55 flex items-center gap-1.5">
                                    <span>
                                      {t(
                                        "ui_funds_add_hint_account",
                                        "À votre compte",
                                      )}
                                    </span>
                                    <span
                                      className="h-2 w-2 rounded-full bg-xcannes-green shrink-0 animate-pulse"
                                      aria-hidden
                                    />
                                    <span className="text-white/90 font-semibold truncate">
                                      {walletLabelDisplay}
                                    </span>
                                  </p>
                                  <p className="mt-2 text-[13px] text-white/45">
                                    {t(
                                      "ui_funds_add_hint",
                                      "Par carte ou virement bancaire",
                                    )}
                                  </p>
                                </div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCashModalTab?.("sell");
                              }}
                              className={cardClassName}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-[16px] bg-transparent flex items-center justify-center flex-shrink-0">
                                  <FundsCardBankIcon />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[18px] text-white font-semibold truncate">
                                      {t(
                                        "ui_funds_withdraw_title_mobile",
                                        "Transférer vers la banque",
                                      )}
                                    </p>
                                    <ChevronRight className="w-5 h-5 text-white/45" />
                                  </div>
                                  <p className="mt-1 text-[15px] leading-snug text-white/55">
                                    {t(
                                      "ui_funds_withdraw_hint",
                                      "Vers votre compte bancaire",
                                    )}
                                  </p>
                                </div>
                              </div>
                            </button>
                          </div>

                          <div className="rounded-[14px] p-4 ring-1 ring-white/10 ring-inset bg-white/[0.02] text-white/55 text-sm">
                            {cashNote}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : cashView === "buy" ? (
                  <>
                    <div className="rounded-[14px] p-4 ring-1 ring-white/10 ring-inset bg-white/[0.02] text-white/55 text-sm mb-4">
                      {cashNote}
                    </div>
                    <DemoMoonPayBuyModal
                      isOpen={true}
                      onClose={onClose}
                      walletAddress={walletAddress || ""}
                      walletLabel={walletLabelDisplay}
                      hideWalletAddress={hideWalletAddress}
                      preferredFiatCurrency={preferredFiatCurrency}
                      embedded={true}
                      isPreviewMode={isPreviewMode}
                      demoMode={demoMode}
                      onDemoSubmit={onDemoBuy}
                      noticeVariant={noticeVariant}
                    />
                  </>
                ) : (
                  <>
                    <div className="rounded-[14px] p-4 ring-1 ring-white/10 ring-inset bg-white/[0.02] text-white/55 text-sm mb-4">
                      {cashNote}
                    </div>
                    <DemoMoonPaySellModal
                      isOpen={true}
                      onClose={onClose}
                      walletAddress={walletAddress || ""}
                      walletLabel={walletLabelDisplay}
                      hideWalletAddress={hideWalletAddress}
                      preferredFiatCurrency={preferredFiatCurrency}
                      embedded={true}
                      isPreviewMode={isPreviewMode}
                      demoMode={demoMode}
                      onDemoSubmit={onDemoSell}
                      availableTokens={availableTokens}
                      rlusdPerUnitRates={rlusdPerUnitRates}
                      selectLabelByCurrency={selectLabelByCurrency}
                      selectLabelRightByCurrency={selectLabelRightByCurrency}
                      selectIconByCurrency={selectIconByCurrency}
                      selectLabelMobileByCurrency={selectLabelMobileByCurrency}
                      noticeVariant={noticeVariant}
                    />
                  </>
                )}
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
