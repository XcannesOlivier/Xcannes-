"use client";

import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";

export function WalletInfoContent({
  isPreviewMode = false,
  noticeVariant = "preview",
  onBack,
}) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col min-h-full">
      {/* Header (sticky) */}
      <div className="sticky top-0 z-10 bg-[#0B0F14] border-b border-white/[0.06]">
        <div className="h-14 px-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 -ml-2 rounded-lg inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            aria-label={t("ui_back", "Back")}
            title={t("ui_back", "Back")}
          >
            ←
          </button>
          <div className="min-w-0">
            <div className="text-base font-semibold text-[#E6EDF3] truncate">
              {t("ui_how_it_works", "How it works")}
            </div>
            <div className="text-xs text-[#8B98A5] truncate">
              {t("ui_xcannes_wallet", "XCANNES Wallet")}
            </div>
          </div>
        </div>
      </div>

      {/* Intro */}
      <div className="px-4 pt-4">
        <p className="text-sm leading-snug text-[#8B98A5]">
          {t(
            "ui_wallet_intro_short_fees",
            "Non-custodial wallet on XRPL. Funds are organized into internal currency lines.",
          )}
        </p>
      </div>

      {/* Sections */}
      <div className="px-4 py-5 space-y-4">
        <section className="rounded-xl bg-[#11161C] border border-white/[0.06] p-4">
          <div className="text-[13px] tracking-[0.08em] uppercase text-[#8B98A5]">
            {t("ui_core_features_fe8d86dd76", "Core features")}
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-[#E6EDF3] list-disc pl-5">
            <li>
              {t("ui_hold_assets_demo", "Hold assets on-chain (USD)")}
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

        <section className="rounded-xl bg-[#11161C] border border-white/[0.06] p-4">
          <div className="text-[13px] tracking-[0.08em] uppercase text-[#8B98A5]">
            {t("ui_currency_lines_title", "Currency lines")}
          </div>
          <div className="mt-3 space-y-3 text-sm text-[#E6EDF3]">
            <div className="space-y-1">
              <div className="text-[#8B98A5] text-xs uppercase tracking-[0.08em]">
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
            <div className="text-[#8B98A5]">
              {t(
                "ui_currency_lines_note_short",
                "Displayed values (EUR, GBP…) are based on USD allocation.",
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-[#11161C] border border-white/[0.06] p-4">
          <div className="text-[13px] tracking-[0.08em] uppercase text-[#8B98A5]">
            {t("ui_fees_580613eea6", "Fees")}
          </div>
          <div className="mt-3 space-y-3 text-sm text-[#E6EDF3]">
            <div>
              <div className="text-[#E6EDF3] font-semibold">
                {t("ui_xrpl_network", "XRPL network")}
              </div>
              <div className="text-[#8B98A5]">
                {t(
                  "ui_xrpl_network_fee_on_chain_pa_975e8f666a",
                  "Applies to on-chain transactions",
                )}
              </div>
            </div>
            <div>
              <div className="text-[#E6EDF3] font-semibold">
                {t("ui_conversion_fee", "Conversion")}
              </div>
              <div className="text-[#8B98A5]">
                {t(
                  "ui_conversion_fee_value",
                  "1% fee (minimum $0.01)",
                )}
              </div>
            </div>
            <div>
              <div className="text-[#E6EDF3] font-semibold">
                {t("ui_signatures", "Signatures")}
              </div>
              <ul className="mt-1 space-y-1.5 text-[#8B98A5] list-disc pl-5">
                <li>{t("ui_sig_demo", "No signature required (demo)")}</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-[#11161C] border border-white/[0.06] p-4">
          <div className="flex items-center gap-2">
            <span className="text-[#8B98A5]">⚠️</span>
            <div className="text-[13px] tracking-[0.08em] uppercase text-[#8B98A5]">
              {t("ui_important_af28edf1c1", "Important")}
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-[#E6EDF3] list-disc pl-5">
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

export default function DemoWalletInfoModal({
  isOpen,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  inline = false,
}) {
  const { t } = useTranslation("common");
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(isOpen, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const content = (
    <div
      className={`fixed inset-0 z-[11001] bg-[#0B0F14] ${
        isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in"
      }`}
    >
      <div className="h-full overflow-y-auto overscroll-contain">
        <WalletInfoContent
          isPreviewMode={isPreviewMode}
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
