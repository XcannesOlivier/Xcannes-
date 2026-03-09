"use client";

import DemoMoonPayBuyModal from "./DemoMoonPayBuyModal";
import DemoMoonPaySellModal from "./DemoMoonPaySellModal";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";

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
    : "fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-cash-modal border border-white/10 overflow-hidden flex flex-col pointer-events-auto",
    inline
      ? "h-full max-h-none rounded-xl"
      : "max-w-2xl max-h-[92vh] rounded-2xl",
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated",
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
          {/* Header avec onglets Buy/Sell */}
          <div className="border-b border-white/10">
            <div className="flex items-start justify-between p-4 pb-0 gap-3">
              <div className="flex min-w-0 flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
                <div>{renderWalletMeta?.("pr-8")}</div>
                <div className="flex flex-wrap items-center gap-2">

                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="wallet-modal-close text-white/60 hover:text-white transition-colors text-xl"
              >
                ✕
              </button>
            </div>
            {/* Onglets Buy/Sell */}
            <div className="flex gap-2 px-4 pt-3">
              <button
                type="button"
                onClick={() => setCashModalTab("buy")}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold text-xs md:text-sm transition-all duration-200 border ${
                  cashModalTab === "buy"
                    ? "bg-xcannes-green/20 text-white/90 border-xcannes-green/40 hover:bg-xcannes-green/30 hover:text-white hover:scale-[1.02]"
                    : "bg-black/20 text-white/50 border-white/10 hover:bg-black/40 hover:text-white/80"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 5V19M5 12H19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>{t("ui_buy_crypto_f72f8661b9", "Buy Crypto")}</span>
                </div>
                {t("ui_fiat_crypto_21ae637b23", "") ? (
                  <div className="text-[10px] mt-1 opacity-70">
                    {t("ui_fiat_crypto_21ae637b23", "")}
                  </div>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => setCashModalTab("sell")}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold text-xs md:text-sm transition-all duration-200 border ${
                  cashModalTab === "sell"
                    ? "bg-xcannes-green/20 text-white/90 border-xcannes-green/40 hover:bg-xcannes-green/30 hover:text-white hover:scale-[1.02]"
                    : "bg-black/20 text-white/50 border-white/10 hover:bg-black/40 hover:text-white/80"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12H19M12 5L19 12L12 19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{t("ui_sell_crypto_c12d62c0d6", "Sell Crypto")}</span>
                </div>
                {t("ui_crypto_fiat_7ec0396100", "") ? (
                  <div className="text-[10px] mt-1 opacity-70">
                    {t("ui_crypto_fiat_7ec0396100", "")}
                  </div>
                ) : null}
              </button>
            </div>
          </div>

          {/* Contenu selon l'onglet actif */}
          <div
            className="p-4 md:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div key={cashModalTab} className="wallet-tab-unfold-in h-full">
              {cashModalTab === "buy" ? (
                <DemoMoonPayBuyModal
                  isOpen={true}
                  onClose={onClose}
                  walletAddress={walletAddress || ""}
                  walletLabel={walletLabel}
                  hideWalletAddress={hideWalletAddress}
                  embedded={true}
                  isPreviewMode={isPreviewMode}
                  demoMode={demoMode}
                  onDemoSubmit={onDemoBuy}
                  noticeVariant={noticeVariant}
                />
              ) : (
                <DemoMoonPaySellModal
                  isOpen={true}
                  onClose={onClose}
                  walletAddress={walletAddress || ""}
                  walletLabel={walletLabel}
                  hideWalletAddress={hideWalletAddress}
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
              )}
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
