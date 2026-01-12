"use client";

import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";

export function WalletInfoContent({
  withCloseGutter = false,
  isPreviewMode = false,
  noticeVariant = "preview"
}) {const { t } = useTranslation("common");
  return (
    <>
      <div className={withCloseGutter ? "pr-8" : ""}>
        <div className="flex items-center gap-2">
          <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">{t("ui_xcannes_wallet_how_it_works_0397d0e570", "XCANNES Wallet — How it works")}

          </h3>
          {noticeVariant === "demo" ? (
            <span className="inline-flex items-center text-emerald-400 text-xs md:text-sm font-semibold border border-emerald-400/40 rounded-full px-2 py-0.5 leading-none">
              {t("demo_notice_title", "Mode démo")}
            </span>
          ) : null}
          {isPreviewMode && noticeVariant !== "demo" ? (
            <span className="inline-flex items-center text-amber-200 text-xs md:text-sm font-semibold border border-amber-400/40 rounded-full px-2 py-0.5 leading-none">
              {t("wallet_not_connected_title", "Wallet not connected")}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-white/60">{t("ui_wallet_no_custodial_on_xrp_4e8c91bea3", "Wallet non-custodial sur XRPL + un “ledger UX” pour répartir RLUSD en lignes de devises.")}


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
          <h4 className="text-sm font-semibold text-white/80">{t("ui_xcs_lock_activation_currency_c083456cb4", "XCS lock (activation + currency lines)")}

          </h4>
          <p className="mt-2 text-[13px] text-white/70">{t("ui_xcannes_utilise_un_locked_3de1d1a1e5", "XCANNES utilise un verrouillage de XCS comme “engagement” pour activer les fonctionnalités avancées et/ou pour créer des lignes de devises.")}



          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-white/70 list-disc pl-5">
            <li>{t("ui_activation_wallet_7d13181510", "Activation wallet:")}
              <span className="font-mono">{t("ui_1_xcs_4d45c847fc", "1 XCS")}</span>{" "}{t("ui_reserve_blocked_529137c552", "(réserve bloquée).")}

            </li>
            <li>{t("ui_creating_currency_line_48e7a5e551", "Création d’une ligne de devise:")}
              {" "}
              <span className="font-mono">{t("ui_0_20_xcs_cd5bfa5a79", "0.20 XCS")}</span>{t("ui_bloqu_cac6cc1f3b", "bloqué.")}
            </li>
            <li>{t("ui_line_deletion_xcs_released_df25674a3d", "Suppression d’une ligne: le XCS correspondant peut être “libéré” à")}
              {" "}
              <span className="font-mono">50%</span>{t("ui_refund_4e5e3d305c", "(refund")}{" "}
              <span className="font-mono">{t("ui_0_10_xcs_ad2ec0a991", "0.10 XCS")}</span>).
            </li>
          </ul>
          <p className="mt-2 text-[12px] text-white/45">{t("ui_note_locking_via_escrow_31ee4c3f81", "Note: le verrouillage sera géré via un mécanisme escrow. À la fermeture d’une ligne,")}

            <span className="font-mono">50%</span>{t("ui_lock_returns_to_wallet_1c3e249e22", "du verrouillage revient au wallet (")}
            <span className="font-mono">{t("ui_0_10_xcs_ad2ec0a991", "0.10 XCS")}</span>{t("ui_and_5aee655a93", ") et")}
            <span className="font-mono">50%</span>{t("ui_paid_to_management_wallet_c7338e7db3", "est versé au wallet de gestion XCANNES.")}
          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white/80">{t("ui_fees_580613eea6", "Fees")}</h4>
          <ul className="mt-2 space-y-1 text-[13px] text-white/70 list-disc pl-5">
            <li>{t("ui_xrpl_network_fee_on_chain_pa_975e8f666a", "XRPL network fee (on-chain): payable sur chaque transaction XRPL (ex: Payment, TrustSet).")}


            </li>
            <li>{t("ui_xcannes_ne_pr_l_ve_pas_de_fe_b3ee902ca3", "XCANNES ne prélève pas de “fee” séparé. Le modèle est un")}
              {" "}
              <span className="font-semibold">{t("ui_spread_8f9f9fc2e9", "spread")}</span>{t("ui_appliqu_uniquement_quand_il__d0c9824222", "appliqué uniquement quand il y a une conversion FX (ex:")}
              {" "}
              <span className="font-mono">{t("ui_eur_gbp_1865864628", "EUR↔GBP")}</span>,{" "}
              <span className="font-mono">{t("ui_rlusd_eur_23dc8f699b", "RLUSD↔EUR")}</span>).
            </li>
            <li>{t("ui_spread_fx_tiers_88afacafd8", "Spread FX: tiers")}
              <span className="font-mono">{t("ui_a_b_c_04f974d21b", "A/B/C")}</span>{t("ui_ex_1f3a886dcf", "(ex:")}
              <span className="font-mono">{t("ui_a_0_60_462cd3b75c", "A=0.60%")}</span>,{" "}
              <span className="font-mono">{t("ui_b_1_00_d712ad6d37", "B=1.00%")}</span>,{" "}
              <span className="font-mono">{t("ui_c_1_80_0cb90046ff", "C=1.80%")}</span>{t("ui_total_bid_ask_autour_du_mid__fb93bb89c0", "“total”, bid/ask autour du mid), prélevé en")}
              <span className="font-mono">{t("ui_rlusd_5933874327", "RLUSD")}</span>{t("ui_sent_onchain_to_company_wallet_d9e8e01d57", "et envoyé on-chain vers un wallet entreprise XCANNES.")}

            </li>
            <li>{t("ui_convert_interne_1_signature__c7b5a8e4dd", "Convert interne: 1 signature Xumm (paiement du spread) ; paiement entre 2 wallets: 2 signatures (spread puis paiement).")}


            </li>
          </ul>
          <p className="mt-2 text-[12px] text-white/45">{t("ui_source_de_rate_paires_live_v_6b7123ea24", "Source de taux: paires “live” via Pyth quand disponible, sinon FX EOD (coté 1×/jour).")}


          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white/80">{t("ui_important_af28edf1c1", "Important")}</h4>
          <ul className="mt-2 space-y-1 text-[13px] text-white/70 list-disc pl-5">
            <li>{t("ui_xrpl_est_la_source_de_v_rit__bf1084eac7", "XRPL est la source de vérité pour les soldes on-chain.")}</li>
            <li>{t("ui_currency_lines_represent_rlusd_155e16f839", "Les lignes de devises représentent une répartition interne de RLUSD.")}


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
  noticeVariant = "preview",
  noticeContextLabel = ""
}) {const { t } = useTranslation("common");
  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[11000] bg-black/80 md:backdrop-blur-sm"
        onClick={() => onClose && onClose()} />

      <div className="fixed inset-0 z-[11001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className="relative w-full max-w-2xl bg-elevated border border-subtle rounded-2xl p-4 md:p-6 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto shadow-2xl"
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => e.stopPropagation()}>

          <button
            type="button"
            onClick={() => onClose && onClose()}
            className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl"
            aria-label={t("ui_close_08378568ba", "Close")}>

            ✕
          </button>

          <WalletInfoContent
            withCloseGutter
            isPreviewMode={isPreviewMode}
            noticeVariant={noticeVariant} />
        </div>
      </div>
    </>,
    document.body
  );
}
