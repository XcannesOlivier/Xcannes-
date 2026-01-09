"use client";

import WalletDashboardTrustlineCurrencyForm from "../components/WalletDashboardTrustlineCurrencyForm";
import WalletNotConnectedNotice from "../components/WalletNotConnectedNotice";import { useTranslation } from "next-i18next";

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
  handleRemoveTrustlineCurrency
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
          className="relative w-full max-w-md bg-gray-900 border-0 md:border md:border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto"
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
          <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">
            {editingTrustlineCurrency}{t("ui_trustline_5274231985", "trustline")}
          </h3>
	          <p className="text-[11px] text-white/60">{t("ui_g_rez_le_locking_xcs_po_0d49af4c57", "Gérez le verrouillage XCS pour cette devise. Cette action ne modifie pas directement votre solde on-chain, seulement le suivi interne.")}


          </p>
	          <WalletNotConnectedNotice
            show={isPreviewMode}
            variant={noticeVariant}
            contextLabel={noticeContextLabel} />

          <WalletDashboardTrustlineCurrencyForm
            currentEditingLine={currentEditingLine}
            editingTrustlineLocked={editingTrustlineLocked}
            setEditingTrustlineLocked={setEditingTrustlineLocked}
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