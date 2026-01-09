"use client";

import WalletDashboardTrustlinesAddForm from "../components/WalletDashboardTrustlinesAddForm";
import WalletDashboardTrustlinesFooter from "../components/WalletDashboardTrustlinesFooter";
import WalletDashboardTrustlinesList from "../components/WalletDashboardTrustlinesList";
import WalletNotConnectedNotice from "../components/WalletNotConnectedNotice";import { useTranslation } from "next-i18next";

export default function WalletDashboardTrustlinesModal({
  open,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  trustlineCode,
  setTrustlineCode,
  trustlineLocked,
  setTrustlineLocked,
  handleAddTrustline,
  walletLinesLoading,
  walletLinesError,
  walletLines,
  totalLockedXcs,
  openTrustlineEditor
}) {const { t } = useTranslation("common");
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={onClose} />

      {/* Modale */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-3 pointer-events-none">
        <div
          className="relative w-full max-w-md sm:max-w-lg md:max-w-2xl bg-gray-900 border-0 md:border md:border-white/10 rounded-2xl p-4 md:p-5 lg:p-7 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto"
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
          <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">{t("ui_trustlines_59e1e35db4", "Trustlines")}

          </h3>
          <p className="text-[11px] text-white/60 mb-2">{t("ui_ajoutez_ou_supprimez_vos_lig_f40801cee4", "Ajoutez ou supprimez vos lignes internes de suivi XCS.")}

          </p>
          <WalletNotConnectedNotice
            show={isPreviewMode}
            variant={noticeVariant}
            contextLabel={noticeContextLabel} />


          {/* Formulaire ajout trustline */}
          <WalletDashboardTrustlinesAddForm
            trustlineCode={trustlineCode}
            setTrustlineCode={setTrustlineCode}
            trustlineLocked={trustlineLocked}
            setTrustlineLocked={setTrustlineLocked}
            onSubmit={handleAddTrustline} />


          {/* Liste des lignes existantes */}
          <WalletDashboardTrustlinesList
            walletLinesLoading={walletLinesLoading}
            walletLinesError={walletLinesError}
            walletLines={walletLines}
            onEdit={openTrustlineEditor} />


          {/* Résumé total XCS bloqué */}
          <WalletDashboardTrustlinesFooter
            totalLockedXcs={totalLockedXcs}
            onClose={onClose} />

        </div>
      </div>
    </>);

}