"use client";

import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

function WalletInfoContent({
  noticeVariant = "preview",
  onBack,
}) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col h-full bg-[#0b0f10]">
      {/* Header (sticky) */}
      <div className="sticky top-0 z-10 shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              className="h-10 w-10 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
              aria-label={t("ui_back", "Back")}
              title={t("ui_back", "Back")}
            >
              <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
                {t("ui_how_it_works", "How it works")}
              </div>
              <div className="text-[12px] text-white/80 mt-1 truncate">
                {t("ui_xcannes_wallet", "XCANNES Wallet")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {noticeVariant === "demo" ? (
              <span className="inline-flex items-center text-white/80 text-xs font-semibold px-2 py-1 leading-none rounded-lg border border-white/10 bg-white/5">
                {t("demo_notice_title", "Mode démo")}
              </span>
            ) : null}
            <span className="h-10 w-10" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
        <p className="text-[13px] leading-relaxed text-white/70">
          {t(
            "ui_wallet_intro_short_fees",
            "Non-custodial wallet on XRPL. Funds are organized into internal currency lines.",
          )}
        </p>

        <section className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("ui_core_features_fe8d86dd76", "Core features")}
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-white/80 list-disc pl-5">
            <li>
              {t(
                "ui_hold_assets_on_chain_xrp_rlu_6e9344f999",
                "Hold assets on-chain (XRP / USD)",
              )}
            </li>
            <li>
              {t(
                "ui_create_currency_lines_eur_gb_3cb882c93c",
                "Create currency lines (EUR, GBP…)",
              )}
            </li>
            <li>
              {t(
                "ui_convert_between_lines_alloca_8439f5b49f",
                "Convert between lines (internal allocation)",
              )}
            </li>
            <li>
              {t(
                "ui_statements_show_a_unified_vi_6ef7ea3ce7",
                "Unified transaction view",
              )}
            </li>
          </ul>
        </section>

        <section className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("ui_currency_lines_title", "Currency lines")}
          </div>
          <div className="mt-3 space-y-3 text-[13px] text-white/80">
            <div className="space-y-1">
              <div className="text-white/45 text-[11px] uppercase tracking-[0.22em]">
                {t("ui_two_types", "Two types")}
              </div>
              <ul className="space-y-1.5 list-disc pl-5">
                <li>{t("ui_onchain_assets", "On-chain assets (XRPL)")}</li>
                <li>
                  {t(
                    "ui_internal_currency_lines",
                    "Internal currency lines (off-chain allocation)",
                  )}
                </li>
              </ul>
            </div>
            <div className="text-white/65">
              {t(
                "ui_currency_lines_note_short",
                "Displayed values (EUR, GBP…) are based on USD allocation.",
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("ui_fees_580613eea6", "Fees")}
          </div>
          <div className="mt-3 space-y-3 text-[13px] text-white/80">
            <div>
              <div className="text-white/90 font-semibold">
                {t("ui_xrpl_network", "XRPL network")}
              </div>
              <div className="text-white/65">
                {t(
                  "ui_xrpl_network_fee_on_chain_pa_975e8f666a",
                  "Applies to on-chain transactions",
                )}
              </div>
            </div>
            <div>
              <div className="text-white/90 font-semibold">
                {t("ui_conversion_fee", "Conversion")}
              </div>
              <div className="text-white/65">
                {t("ui_conversion_fee_value", "1% fee (minimum $0.01)")}
              </div>
            </div>
            <div>
              <div className="text-white/90 font-semibold">
                {t("ui_signatures", "Signatures")}
              </div>
              <ul className="mt-1 space-y-1.5 text-white/65 list-disc pl-5">
                <li>{t("ui_sig_conversion", "Internal conversion: 1 signature")}</li>
                <li>{t("ui_sig_payments", "Payments: up to 2 signatures")}</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2">
            <span className="text-white/60" aria-hidden="true">
              ⚠️
            </span>
            <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
              {t("ui_important_af28edf1c1", "Important")}
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-white/80 list-disc pl-5">
            <li>
              {t(
                "ui_xrpl_est_la_source_de_v_rit__bf1084eac7",
                "XRPL is the source of truth for balances",
              )}
            </li>
            <li>
              {t(
                "ui_currency_lines_represent_rlusd_155e16f839",
                "Currency lines represent internal USD allocation",
              )}
            </li>
            <li>
              {t(
                "ui_l_allocation_totale_ne_doit__dcf11e3d6c",
                "Total allocation must not exceed on-chain USD",
              )}
            </li>
            <li>{t("ui_usd_reference", "USD is the reference value")}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function WalletInfoModal({
  isOpen,
  onClose,
  noticeVariant = "preview",
  inline = false,
}) {
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(isOpen, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const content = inline ? (
    <div className="flex-1 min-h-0 h-full">
      <WalletInfoContent
        noticeVariant={noticeVariant}
        onBack={() => onClose && onClose()}
      />
    </div>
  ) : (
    <div
      className={`fixed inset-0 z-[11001] bg-[#0b0f10] ${
        isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in"
      }`}
    >
      <div className="h-full">
        <WalletInfoContent
          noticeVariant={noticeVariant}
          onBack={() => onClose && onClose()}
        />
      </div>
    </div>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
