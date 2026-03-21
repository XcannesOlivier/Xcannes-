"use client";

import Image from "next/image";
import { useTranslation } from "next-i18next";

export default function XrpNetworkStatement({ hasRlusdTrustline = false }) {
  const { t } = useTranslation("common");

  // Design-only placeholders (logic will be wired later).
  const activationReserveXrp = 1.0;
  const availableForFeesXrp = 0.32;
  const totalFeesPaidXrp = 0.01;
  const reserveFillPct = 72;

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="rounded-[14px] ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-18px_28px_rgba(0,0,0,0.55)] overflow-hidden">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white/85">
              {t("ui_activation_reserve", "Activation Reserve")}
            </div>
            <div className="text-sm font-semibold text-white">
              {activationReserveXrp.toFixed(2)}{" "}
              {t("ui_xrp_034964b994", "XRP")}
            </div>
          </div>

          <div className="mt-3 h-2 rounded-full bg-black/40 ring-1 ring-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-xcannes-green/70"
              style={{ width: `${reserveFillPct}%` }}
            />
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/75">
                {t("ui_available_for_fees", "Available for Fees")}
              </div>
              <div className="text-sm font-semibold text-white">
                {availableForFeesXrp.toFixed(2)}{" "}
                {t("ui_xrp_034964b994", "XRP")}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/75">
                {t("ui_total_fees_paid", "Total Fees Paid")}
              </div>
              <div className="text-sm font-semibold text-white">
                {totalFeesPaidXrp.toFixed(2)}{" "}
                {t("ui_xrp_034964b994", "XRP")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[14px] ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-18px_28px_rgba(0,0,0,0.55)] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <div className="text-sm font-semibold text-white/85">
            {t("ui_active_trustlines", "Active Trustlines")}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {}}
          className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] transition-colors"
          aria-label={t("ui_rlusd_details", "RLUSD Details")}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-white/10 shrink-0">
              <Image
                src="/symbols/rlusd.png"
                alt="RLUSD"
                width={28}
                height={28}
                className="rounded-md"
              />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-white">RLUSD</div>
                <span className="text-[11px] text-white/40">
                  {t("ui_ripple_usd", "Ripple USD")}
                </span>
              </div>
              <div className="text-[12px] text-white/55 mt-0.5">
                {hasRlusdTrustline
                  ? t("ui_trustline_active", "Trustline active")
                  : t("ui_trustline_inactive", "Trustline inactive")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-sm font-semibold text-white">
              0.00{" "}
              <span className="text-white/70">{t("ui_rlusd", "RLUSD")}</span>
            </div>
            <div className="text-sm text-white/40">
              {t("ui_details_e9615e470d", "Details")} ›
            </div>
          </div>
        </button>
      </div>

      <div className="rounded-[14px] ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] overflow-hidden">
        <div className="px-4 py-3 flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-xcannes-green/10 border border-xcannes-green/25 text-xcannes-green shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 22s8-4 8-10V6l-8-4-8 4v6c0 6 8 10 8 10z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-sm text-white/85 leading-snug">
              {t(
                "ui_xrpl_fees_note",
                "Les frais de transaction sur le XRPL sont extrêmement faibles (≈ 0.00001 XRP, soit < 0.0001 USD) et sont déduits de votre reserve XRP.",
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

