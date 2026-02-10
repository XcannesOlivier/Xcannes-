"use client";

import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";

export function WalletInfoContent({
  withCloseGutter = false,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null,
  noticeVariant = "preview"
}) {
  const { t } = useTranslation("common");
  const showNotConnectedNotice = isPreviewMode && noticeVariant !== "demo";
  const showNotActivatedNotice =
    !isPreviewMode && noticeVariant !== "demo" && isWalletActivated === false;
  const showRlusdNotActivatedNotice =
    !isPreviewMode &&
    noticeVariant !== "demo" &&
    isWalletActivated === true &&
    hasRlusdTrustline === false;
  const activationFeeValue = Number.parseFloat(
    process.env.NEXT_PUBLIC_WALLET_ACTIVATION_FEE_RLUSD || ""
  );
  const activationFeeLabel = (
    Number.isFinite(activationFeeValue) && activationFeeValue > 0
      ? activationFeeValue
      : 1
  ).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <>
      <div className={withCloseGutter ? "pr-8" : ""}>
        <div className="flex items-center gap-2">
          <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">{t("ui_xcannes_wallet_how_it_works_0397d0e570", "XCANNES Wallet — How it works")}

          </h3>
          {noticeVariant === "demo" ? (
            <span className="inline-flex items-center text-xcannes-green text-xs md:text-sm font-semibold px-2 py-0.5 leading-none">
              {t("demo_notice_title", "Mode démo")}
            </span>
          ) : null}
          {showNotConnectedNotice ? (
            <span className="inline-flex items-center text-xcannes-yellow text-sm md:text-sm font-semibold leading-none">
              {t("wallet_not_connected_title", "Wallet not connected")}
            </span>
          ) : null}
          {showNotActivatedNotice ? (
            <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none">
              {t(
                "wallet_not_activated_title",
                "Wallet not activated: a minimum reserve of 1 XRP is required."
              )}
            </span>
          ) : null}
          {showRlusdNotActivatedNotice ? (
            <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none">
              {t(
                "wallet_rlusd_not_activated_title",
                "RLUSD not activated. Authorize RLUSD on your wallet."
              )}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-white/60">{t("ui_wallet_no_custodial_on_xrp_4e8c91bea3", "Wallet non-custodial sur XRPL + un “ledger UX” pour répartir RLUSD en lignes de comptes.")}


        </p>
      </div>

      <div className="mt-5 grid gap-4">
        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white/80">{t("ui_core_features_fe8d86dd76", "Core features")}</h4>
          <ul className="mt-2 space-y-1 text-[13px] text-white/70 list-disc pl-5">
            <li>{t("ui_hold_assets_on_chain_xrp_rlu_6e9344f999", "Hold assets on-chain (XRP / RLUSD / XCS).")}</li>
            <li>{t("ui_create_currency_lines_eur_gb_3cb882c93c", "Create currency lines (EUR/GBP/…) to allocate RLUSD internally.")}

            </li>
            <li>{t("ui_convert_between_lines_alloca_8439f5b49f", "Convert between lines (allocation-only MVP, no on-chain FX).")}</li>
            <li>{t("ui_statements_show_a_unified_vi_6ef7ea3ce7", "Statements show a unified view of your wallet activity.")}</li>
          </ul>
          <p className="mt-3 text-[12px] text-white/45">{t("ui_in_the_wallet_list_you_will__7a5642d046", "In the wallet list, you will see 2 types of “lines”:")}
            {" "}
            <span className="font-mono">{t("ui_xrpl_assets_c7b3e7185a", "XRPL assets")}</span>{t("ui_on_chain_and_0836c903ca", "(on-chain) and")}{" "}
            <span className="font-mono">{t("ui_local_currency_lines_2b186f452e", "local currency lines")}</span>{t("ui_off_chain_allocations_for_lo_07b1acc670", "(off-chain allocations). For local currency lines, the small")}
            {" "}
            <span className="font-mono">{t("ui_rlusd_6a0d57ec4d", "≈ … RLUSD")}</span>{t("ui_value_represents_the_underly_94a3198fdf", "value represents the underlying allocation.")}

          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white/80">
            {t("ui_activation_fee_xcs_title_f4", "Activation fee (RLUSD)")}
          </h4>
          <p className="mt-2 text-[13px] text-white/70">
            {t("ui_activation_fee_xcs_body_f4", {
              defaultValue:
                "Creating a new currency line requires a one-time payment of {{amount}} RLUSD to the XCANNES wallet.",
              amount: activationFeeLabel,
            })}
          </p>
          <p className="mt-2 text-[12px] text-white/45">
            {t("ui_activation_fee_xcs_note_f4", "No escrow/lock: the fee is paid on-chain at activation.")}
          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white/80">{t("ui_fees_580613eea6", "Fees")}</h4>
          <ul className="mt-2 space-y-1 text-[13px] text-white/70 list-disc pl-5">
            <li>{t("ui_xrpl_network_fee_on_chain_pa_975e8f666a", "XRPL network fee (on-chain): payable sur chaque transaction XRPL (ex: Payment, TrustSet).")}


            </li>
            <li>{t("ui_xcannes_ne_pr_l_ve_pas_de_fe_b3ee902ca3", "XCANNES ne prélève pas de frais séparé. Le modèle est un")}
              {" "}
              <span className="font-semibold">{t("ui_spread_8f9f9fc2e9", "taux FX fixe")}</span>{t("ui_appliqu_uniquement_quand_il__d0c9824222", "appliqué uniquement quand il y a une conversion (ex:")}
              {" "}
              <span className="font-mono">{t("ui_eur_gbp_1865864628", "EUR↔GBP")}</span>,{" "}
              <span className="font-mono">{t("ui_rlusd_eur_23dc8f699b", "RLUSD↔EUR")}</span>).
            </li>
            <li>{t("ui_spread_fx_tiers_88afacafd8", "Taux FX par catégorie:")}
              <span className="font-mono">{t("ui_a_b_c_04f974d21b", "A/B/C")}</span>{t("ui_ex_1f3a886dcf", "(ex:")}
              <span className="font-mono">{t("ui_a_0_60_462cd3b75c", "A=0.60%")}</span>,{" "}
              <span className="font-mono">{t("ui_b_1_00_d712ad6d37", "B=1.00%")}</span>,{" "}
              <span className="font-mono">{t("ui_c_1_80_0cb90046ff", "C=1.80%")}</span>{t("ui_total_bid_ask_autour_du_mid__fb93bb89c0", "appliqué sur le montant en")}
              <span className="font-mono">{t("ui_rlusd_5933874327", "RLUSD")}</span>{t("ui_sent_onchain_to_company_wallet_d9e8e01d57", "et envoyé on-chain vers un wallet entreprise XCANNES.")}

            </li>
            <li>{t("ui_convert_interne_1_signature__c7b5a8e4dd", "Conversion interne: 1 signature Xumm. Paiement entre 2 wallets: 2 signatures si un taux FX s’applique (sinon 1).")}


            </li>
          </ul>
          <p className="mt-2 text-[12px] text-white/45">{t("ui_source_de_rate_paires_live_v_6b7123ea24", "Source de taux: paires “live” via Pyth quand disponible, sinon FX EOD (coté 1×/jour).")}


          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white/80">{t("ui_important_af28edf1c1", "Important")}</h4>
          <ul className="mt-2 space-y-1 text-[13px] text-white/70 list-disc pl-5">
            <li>{t("ui_xrpl_est_la_source_de_v_rit__bf1084eac7", "XRPL est la source de vérité pour les soldes on-chain.")}</li>
            <li>{t("ui_currency_lines_represent_rlusd_155e16f839", "Les lignes de comptes représentent une répartition interne de RLUSD.")}


            </li>
            <li>{t("ui_l_allocation_totale_ne_doit__dcf11e3d6c", "L’allocation totale ne doit jamais dépasser RLUSD on-chain.")}</li>
            <li>{t("ui_amounts_in_currency_indicative_73d7ff4e8d", "Les montants en devise (EUR, USD, …) sont des valeurs indicatives basées sur des taux marché; la valeur de référence reste")}

              {" "}
              <span className="font-mono">{t("ui_rlusd_5933874327", "RLUSD")}</span>.
            </li>
          </ul>
        </section>
      </div>
    </>);

}

export default function WalletInfoModal({
  isOpen,
  onClose,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null,
  noticeVariant = "preview",
  noticeContextLabel = "",
  inline = false
}) {
  const { t } = useTranslation("common");
  if (!isOpen) return null;
  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[11001] flex items-center justify-center px-4 pointer-events-none";
  const panelClass = inline
    ? "relative w-full wallet-modal-panel h-full bg-elevated border border-subtle rounded-xl p-4 md:p-6 overflow-y-auto flex flex-col overscroll-contain pointer-events-auto shadow-2xl"
    : "relative w-full wallet-modal-panel max-w-2xl bg-elevated border border-subtle rounded-2xl p-4 md:p-6 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto shadow-2xl";

  const content = (
    <>
      {!inline ? (
        <div
          className="fixed inset-0 z-[11000] bg-black/80 md:backdrop-blur-sm"
          onClick={() => onClose && onClose()} />
      ) : null}

      <div className={wrapperClass}>
        <div
          className={panelClass}
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}>

          <button
            type="button"
            onClick={() => onClose && onClose()}
            className="wallet-modal-close absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl"
            aria-label={t("ui_close_08378568ba", "Close")}>

            ✕
          </button>

          <WalletInfoContent
            withCloseGutter
            isPreviewMode={isPreviewMode}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            noticeVariant={noticeVariant} />
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
