"use client";

import XummConnectButton from "@/components/xumm/XummConnectButton";
import { useTranslation } from "next-i18next";

export default function WalletDashboardHeader({
  layout,
  effectiveIsConnected,
  effectiveWallet,
  onDisconnect,
  totalLabel,
  onOpenGlobalStatement,
  xrplConnectionIndicator,
  walletLabel,
  walletHeaderToast,
  onOpenWalletLabelEditor,
  onCopyAddress,
  onRefreshWallet,
  isConnecting,
  isRefreshing,
  isEditingWalletLabel,
  isWalletLabelRequired,
  walletLabelDraft,
  onWalletLabelDraftChange,
  onSaveWalletLabel,
  onCancelWalletLabel
}) {
  const { t } = useTranslation("common");
  return (
    <div className={`panel-header ${layout.headerClass} flex flex-col shrink-0`}>
      {/* Titres discrets en haut */}
      <div className="flex items-center justify-between mb-2 md:mb-3">
        {layout.showBrandTitle ?
        <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs md:text-sm font-orbitron font-semibold tracking-[0.2em] text-white/80 uppercase">{t("ui_xcannes_3cdc66a392", "XCANNES")}

          </span>
            <span className="text-[10px] font-light text-white/30">|</span>
            <span className="text-[10px] font-light text-white/40 truncate max-w-[160px] sm:max-w-none">{t("ui_global_usd_wallet_202f7e48be", "Multi-currency wallet")}

          </span>
          </div> :

        <div />
        }
        {/* Bouton Connect ou Déconnecter */}
        {effectiveIsConnected && effectiveWallet ?
        <button
          type="button"
          onClick={() => onDisconnect?.()}
          className="px-3 py-1.5 text-[10px] md:text-xs bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-white/60 hover:text-red-400 rounded-md transition-colors">{t("ui_disconnect_2c9c62cc27", "Déconnecter")}


        </button> :

        <XummConnectButton small variant="statement-blue" />
        }
      </div>

      {/* Solde et info wallet */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-2xl md:text-3xl font-orbitron font-semibold text-white">
          {totalLabel}
        </p>

        {/* Bouton Global Statement - Toujours visible, même en démo */}
        <button
          type="button"
          onClick={onOpenGlobalStatement}
          className="mt-2 px-4 py-1.5 bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green rounded-lg text-xs font-medium transition-all duration-200 border border-xcannes-green/30 hover:scale-105">{t("ui_see_statement_9771dff7ec", "Voir le relevé")}


        </button>

        <a
          href="https://ripple.com/solutions/stablecoin/transparency/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-white/40 hover:text-xcannes-green/80 transition-colors">{t("ui_stablecoin_usd_r_gul_d_details_80d8d1ba32", "Stablecoin USD régulé (détails)")}


        </a>

        {/* Affichage du wallet connecté à la place du menu déroulant */}
        {effectiveIsConnected && effectiveWallet &&
        <div className="w-full mt-2 px-2 flex justify-center">
            <div className="relative w-full max-w-[560px] pr-12">
              <div className="w-full min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                      className={`h-2 w-2 rounded-full ring-4 ${xrplConnectionIndicator.dotClass} ${xrplConnectionIndicator.ringClass} ${
                      xrplConnectionIndicator.pulse ? "animate-pulse" : ""}`
                      }
                      title={xrplConnectionIndicator.label}
                      aria-label={xrplConnectionIndicator.label} />

                      <span className="text-[12px] md:text-[13px] font-semibold text-white/85 truncate">
                        {walletLabel || "Wallet"}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-white/55 truncate">
                        {effectiveWallet.slice(0, 10)}…{effectiveWallet.slice(-8)}
                      </span>
                      {walletHeaderToast &&
                    <span className="text-[10px] text-xcannes-green/90">
                          {walletHeaderToast}
                        </span>
                    }
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                    type="button"
                    onClick={onOpenWalletLabelEditor}
                    title={t("ui_rename_86c8307e14", "Renommer")}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-lg transition-all active:scale-95"
                    aria-label={t("ui_rename_wallet_8fecb8eee2", "Renommer le wallet")}>

                      <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">

                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16.862 3.487a2.1 2.1 0 012.97 2.97L8.9 17.39a4 4 0 01-1.69 1l-3.42 1.14 1.14-3.42a4 4 0 011-1.69L16.862 3.487z" />

                      </svg>
                    </button>

                    <button
                    type="button"
                    onClick={onCopyAddress}
                    title={t("ui_copy_address_82d1cf6e94", "Copier l'adresse")}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-lg transition-all active:scale-95"
                    aria-label={t("ui_copy_xrpl_address_4f63ed10fc", "Copier l'adresse XRPL")}>

                      <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">

                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />

                      </svg>
                    </button>
                  </div>
                </div>

                {isEditingWalletLabel &&
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-2">
                    <input
                  type="text"
                  value={walletLabelDraft}
                  onChange={(e) => onWalletLabelDraftChange?.(e.target.value)}
                  placeholder={t("ui_wallet_name_b4c2f054b9", "Nom du wallet")}
                  className="min-w-0 w-full bg-transparent text-[16px] md:text-[12px] text-white/85 outline-none placeholder:text-white/35"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onSaveWalletLabel?.();
                    }
                    if (e.key === "Escape") {
                      onCancelWalletLabel?.();
                    }
                  }}
                  autoFocus />


                    <button
                  type="button"
                  onClick={onSaveWalletLabel}
                  className="p-2 rounded-md bg-xcannes-green/15 hover:bg-xcannes-green/25 border border-xcannes-green/25 text-xcannes-green transition-colors active:scale-95"
                  aria-label={t("ui_save_404be3f4a5", "Enregistrer")}
                  title={t("ui_save_2d42b7df0f", "Enregistrer")}>

                      <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">

                        <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7" />

                      </svg>
                    </button>

                    {!isWalletLabelRequired &&
                    <button
                      type="button"
                      onClick={onCancelWalletLabel}
                      className="p-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 transition-colors active:scale-95"
                      aria-label={t("ui_cancel_d2d2058892", "Annuler")}
                      title={t("ui_cancel_fbca985028", "Annuler")}>

                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">

                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12" />

                      </svg>
                    </button>
                    }
                  </div>
              }
              </div>

              <button
              type="button"
              onClick={onRefreshWallet}
              disabled={isConnecting || isRefreshing}
              title={t("ui_refresh_wallet_4c31d0ce7a", "Recharger le wallet")}
              className={`absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
              isRefreshing ?
              "text-xcannes-green hover:text-xcannes-green/90" :
              "text-white/60 hover:text-white"}`
              }
              aria-label={t("ui_refresh_wallet_label_7b2d1a9c4e", "Recharger le wallet")}>

                <svg
                className={`w-7 h-7 ${isRefreshing ? "animate-spin" : ""}`}
                fill="currentColor"
                viewBox="0 0 24 24">

                  <path
                  d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.02.67-.07 1h2.02c.03-.33.05-.66.05-1 0-4.42-3.58-8-8-8zm-6.93 7H3.05c-.03.33-.05.66-.05 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-.34.02-.67.07-1z" />
                </svg>
              </button>
            </div>
          </div>
        }
      </div>
    </div>);

}
