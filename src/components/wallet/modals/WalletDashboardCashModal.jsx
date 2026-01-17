"use client";

import MoonPayBuyModal from "./MoonPayBuyModal";
import MoonPaySellModal from "./MoonPaySellModal";
import { createPortal } from "react-dom";import { useTranslation } from "next-i18next";

export default function WalletDashboardCashModal({
  open,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  walletId = "",
  demoMode = false,
  onDemoBuy,
  onDemoSell,
  cashModalTab,
  setCashModalTab,
  renderWalletMeta,
  walletAddress
}) {const { t } = useTranslation("common");
  if (!open) return null;

  const content =
  <>
      {/* Backdrop */}
      <div
      className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
      onClick={onClose} />


      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
        className={[
          "relative w-full max-w-2xl border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-[92vh] pointer-events-auto",
          noticeVariant === "demo" && walletId === "A" ? "bg-[#0b1017]" : "bg-elevated",
          noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}>

          {/* Header avec onglets Buy/Sell */}
          <div className="border-b border-white/10">
            <div className="flex items-center justify-between p-4 pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                  {t("ui_fiat_gateway_2b14cbec79", "Fiat Gateway")}
                </h3>
                {noticeVariant === "demo" ? (
                  <span className="inline-flex items-center text-xcannes-green text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}
                {isPreviewMode && noticeVariant !== "demo" ? (
                  <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                    {t("wallet_not_connected_title", "Wallet not connected")}
                  </span>
                ) : null}
              </div>
              <button
              type="button"
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors text-xl">

                ✕
              </button>
            </div>
            <div className="px-4 pb-3">{renderWalletMeta?.()}</div>

            {/* Onglets Buy/Sell */}
            <div className="flex gap-2 px-4 pt-3">
              <button
              type="button"
              onClick={() => setCashModalTab("buy")}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 border ${
              cashModalTab === "buy" ?
              "bg-xcannes-green/20 text-xcannes-green border-xcannes-green/40 hover:bg-xcannes-green/30 hover:scale-[1.02]" :
              "bg-black/20 text-white/50 border-white/10 hover:bg-black/40 hover:text-white/80"}`
              }>

                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path
                    d="M12 5V19M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round" />

                  </svg>
                  <span>{t("ui_buy_crypto_f72f8661b9", "Buy Crypto")}</span>
                </div>
                <div className="text-[10px] mt-1 opacity-70">{t("ui_fiat_crypto_21ae637b23", "Fiat → Crypto")}</div>
              </button>

              <button
              type="button"
              onClick={() => setCashModalTab("sell")}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 border ${
              cashModalTab === "sell" ?
              "bg-violet-500/20 text-violet-500 border-violet-500/40 hover:bg-violet-500/30 hover:scale-[1.02]" :
              "bg-black/20 text-white/50 border-white/10 hover:bg-black/40 hover:text-white/80"}`
              }>

                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path
                    d="M5 12H19M12 5L19 12L12 19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round" />

                  </svg>
                  <span>{t("ui_sell_crypto_c12d62c0d6", "Sell Crypto")}</span>
                </div>
                <div className="text-[10px] mt-1 opacity-70">{t("ui_crypto_fiat_7ec0396100", "Crypto → Fiat")}</div>
              </button>
            </div>
          </div>

          {/* Contenu selon l'onglet actif */}
          <div
          className="p-4 md:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0"
          style={{ WebkitOverflowScrolling: "touch" }}>

            {cashModalTab === "buy" ?
          <MoonPayBuyModal
            isOpen={true}
            onClose={onClose}
            walletAddress={walletAddress || ""}
            embedded={true}
            isPreviewMode={isPreviewMode}
            demoMode={demoMode}
            onDemoSubmit={onDemoBuy}
            noticeVariant={noticeVariant}
            noticeContextLabel={noticeContextLabel} /> :


          <MoonPaySellModal
            isOpen={true}
            onClose={onClose}
            walletAddress={walletAddress || ""}
            embedded={true}
            isPreviewMode={isPreviewMode}
            demoMode={demoMode}
            onDemoSubmit={onDemoSell}
            noticeVariant={noticeVariant}
            noticeContextLabel={noticeContextLabel} />

          }
          </div>
        </div>
      </div>
    </>;


  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
