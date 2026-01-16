"use client";

import WalletDashboardTrustlineCurrencyForm from "../components/WalletDashboardTrustlineCurrencyForm";
import { useTranslation } from "next-i18next";

export default function WalletDashboardTrustlineCurrencyModal({
  open,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  editingTrustlineCurrency,
  currentEditingLine,
  editingTrustlineLocked,
  setEditingTrustlineLocked,
  handleSaveTrustlineCurrency,
  handleRemoveTrustlineCurrency,
  minLockedXcs = 0.2
}) {const { t } = useTranslation("common");
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={onClose} />

      {/* Modale */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className={[
            "relative w-full max-w-md bg-elevated border-0 md:border md:border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto",
            noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
          ].join(" ")}
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => e.stopPropagation()}>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10">

            ✕
          </button>
          <div className="flex items-center gap-2 mb-1 pr-6">
            <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
              {editingTrustlineCurrency}{t("ui_trustline_5274231985", "trustline")}
            </h3>
            {noticeVariant === "demo" ? (
              <span className="inline-flex items-center text-emerald-400 text-xs md:text-sm font-semibold px-2 py-0.5 leading-none">
                {t("demo_notice_title", "Mode démo")}
              </span>
            ) : null}
            {isPreviewMode && noticeVariant !== "demo" ? (
              <span className="inline-flex items-center text-amber-200 text-sm md:text-sm font-semibold leading-none">
                {t("wallet_not_connected_title", "Wallet not connected")}
              </span>
            ) : null}
          </div>
	          <p className="text-[11px] text-white/60">{t("ui_manage_xcs_lock_0d49af4c57", "Gérez le verrouillage XCS pour cette devise. Cette action ne modifie pas directement votre solde on-chain, seulement le suivi interne.")}


          </p>
          <WalletDashboardTrustlineCurrencyForm
            currentEditingLine={currentEditingLine}
            editingTrustlineLocked={editingTrustlineLocked}
            setEditingTrustlineLocked={setEditingTrustlineLocked}
            minLockedXcs={minLockedXcs}
            onSave={handleSaveTrustlineCurrency}
            onRemove={handleRemoveTrustlineCurrency} />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 text-xs text-white/80 hover:bg-white/10 transition-colors active:scale-95">{t("ui_close_492abf031d", "Fermer")}


          </button>
        </div>
      </div>
    </>);

}
