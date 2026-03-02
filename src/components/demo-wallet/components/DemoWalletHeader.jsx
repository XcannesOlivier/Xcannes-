/**
 * DemoWalletHeader — brand row, total balance, wallet meta bar, label editor & reset button.
 *
 * Extracted from DemoWalletDashboard to keep the main component lean.
 */

import { useTranslation } from "next-i18next";
import { formatMoney, formatDemoAddressShort } from "../utils/demoWalletHelpers";

export default function DemoWalletHeader({
  locale,
  displayAmount,
  displayCurrency,
  walletContextLabel,
  wallet,
  walletHeaderToast,
  isWalletLabelLocked,
  isEditingWalletLabel,
  walletLabelDraft,
  setWalletLabelDraft,
  handleOpenWalletLabelEditor,
  handleSaveWalletLabel,
  handleCancelWalletLabel,
  handleCopyWalletAddress,
  handleRefreshWallet,
  isRefreshing,
}) {
  const { t } = useTranslation("common");

  return (
    <div className="panel-header">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 min-w-0"></div>
        <div className="flex items-center gap-1">
          <span className="text-xs md:text-sm font-orbitron font-semibold tracking-[0.2em] text-white/80 uppercase">
            {t("ui_xcannes_30015bef4b", "XCANNES")}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="text-xs text-white/55 tracking-[0.18em] uppercase">
          {t("ui_total_balance_label_a91b6b8c1e", "Solde total")}
        </div>
        <p
          className="text-4xl lg:text-5xl font-sans font-bold text-white tabular-nums tracking-tight"
          title={t("demo_tt_balance", "Total converti en USD (démo).")}
        >
          {formatMoney(locale, displayAmount, displayCurrency)}
        </p>
        <a
          href="https://ripple.com/solutions/stablecoin/transparency/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs md:text-[10px] text-white/40 hover:text-white/70 transition-colors"
        >
          {t(
            "ui_stablecoin_usd_r_gul_d_details_80d8d1ba32",
            "Stablecoin USD régulé (détails)",
          )}
        </a>

        <div className="w-full mt-1.5 flex justify-center">
          <div className="flex items-center gap-2 w-full max-w-[460px]">
            <div className="flex-1 min-w-0 rounded-md bg-black/20 px-2.5 py-1.5 shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] md:text-[14px] font-semibold text-white/90 truncate">
                      {walletContextLabel || t("nav_wallet", "Wallet")}
                    </span>
                    {isWalletLabelLocked && walletHeaderToast ? (
                      <span className="text-[10px] text-xcannes-green/90 truncate">
                        {walletHeaderToast}
                      </span>
                    ) : null}
                  </div>

                  {!isWalletLabelLocked ? (
                    <div className="mt-0.5 flex items-center gap-2 min-w-0">
                      <span
                        className="font-mono text-[10px] text-white/55 truncate"
                        title={t(
                          "demo_tt_wallet_address",
                          "Adresse XRPL du wallet.",
                        )}
                      >
                        {formatDemoAddressShort(wallet)}
                      </span>
                      {walletHeaderToast ? (
                        <span className="text-[10px] text-xcannes-green/90">
                          {walletHeaderToast}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isWalletLabelLocked ? (
                    <button
                      type="button"
                      onClick={handleOpenWalletLabelEditor}
                      disabled={isEditingWalletLabel}
                      title={t("ui_rename_86c8307e14", "Renommer")}
                      className="p-1 rounded-md bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                      aria-label={t(
                        "ui_rename_wallet_8fecb8eee2",
                        "Renommer le wallet",
                      )}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16.862 3.487a2.1 2.1 0 012.97 2.97L8.9 17.39a4 4 0 01-1.69 1l-3.42 1.14 1.14-3.42a4 4 0 011-1.69L16.862 3.487z"
                        />
                      </svg>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleCopyWalletAddress}
                    title={t(
                      "ui_copy_address_82d1cf6e94",
                      "Copier l'adresse",
                    )}
                    className="p-1 rounded-md bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white transition-all active:scale-95"
                    aria-label={t(
                      "ui_copy_xrpl_address_4f63ed10fc",
                      "Copier l'adresse XRPL",
                    )}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {isEditingWalletLabel && !isWalletLabelLocked ? (
                <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-2 py-1">
                  <input
                    type="text"
                    value={walletLabelDraft}
                    onChange={(e) => setWalletLabelDraft(e.target.value)}
                    placeholder={t(
                      "ui_wallet_name_b4c2f054b9",
                      "Nom du wallet",
                    )}
                    className="min-w-0 w-full bg-transparent text-[16px] md:text-[12px] text-white/85 outline-none placeholder:text-white/35"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveWalletLabel();
                      }
                      if (e.key === "Escape") {
                        handleCancelWalletLabel();
                      }
                    }}
                    autoFocus
                  />

                  <button
                    type="button"
                    onClick={handleSaveWalletLabel}
                    className="p-1 rounded-md bg-xcannes-green/15 hover:bg-xcannes-green/25 border border-xcannes-green/25 text-xcannes-green transition-colors active:scale-95"
                    aria-label={t("ui_save_404be3f4a5", "Enregistrer")}
                    title={t("ui_save_2d42b7df0f", "Enregistrer")}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelWalletLabel}
                    className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 transition-colors active:scale-95"
                    aria-label={t("ui_cancel_d2d2058892", "Annuler")}
                    title={t("ui_cancel_fbca985028", "Annuler")}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleRefreshWallet}
              disabled={isRefreshing}
              title={t("demo_tt_reset", "Réinitialiser la démo.")}
              aria-label={t("demo_reset", "Réinitialiser")}
              className={`shrink-0 z-10 h-9 w-9 flex items-center justify-center rounded-lg bg-transparent border border-transparent hover:bg-transparent transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                isRefreshing
                  ? "text-xcannes-green hover:text-xcannes-green/90"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <svg
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.02.67-.07 1h2.02c.03-.33.05-.66.05-1 0-4.42-3.58-8-8-8zm-6.93 7H3.05c-.03.33-.05.66-.05 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-.34.02-.67.07-1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
