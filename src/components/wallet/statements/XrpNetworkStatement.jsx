"use client";

import Image from "next/image";
import { useTranslation } from "next-i18next";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/context/WalletContext";

export default function XrpNetworkStatement({
  hasRlusdTrustline = false,
  rlusdBalance = null,
  transactions = [],
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const [showRlusdModal, setShowRlusdModal] = useState(false);
  const [showReserveAndFees, setShowReserveAndFees] = useState(false);
  const { balance: walletBalance } = useWallet();

  const activationReserveXrp = useMemo(() => {
    const base = Number(walletBalance?.xrpReserveBase);
    if (Number.isFinite(base) && base > 0) return base;
    return 1.0;
  }, [walletBalance?.xrpReserveBase]);

  const currentXrpBalance = useMemo(() => {
    const v = Number(walletBalance?.xrp);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }, [walletBalance?.xrp]);

  const reservedTotalXrp = useMemo(() => {
    const v = Number(walletBalance?.xrpReserved);
    if (Number.isFinite(v) && v >= 0) return v;
    const base = Number(walletBalance?.xrpReserveBase);
    const inc = Number(walletBalance?.xrpReserveInc);
    const ownerCount = Number(walletBalance?.xrpOwnerCount);
    const safeBase = Number.isFinite(base) && base >= 0 ? base : 1;
    const safeInc = Number.isFinite(inc) && inc >= 0 ? inc : 0.2;
    const safeOwner = Number.isFinite(ownerCount) && ownerCount >= 0 ? ownerCount : 0;
    return safeBase + safeInc * safeOwner;
  }, [
    walletBalance?.xrpOwnerCount,
    walletBalance?.xrpReserveBase,
    walletBalance?.xrpReserveInc,
    walletBalance?.xrpReserved,
  ]);

  const lockedReserveXrp = useMemo(() => {
    return Math.max(0, reservedTotalXrp - activationReserveXrp);
  }, [activationReserveXrp, reservedTotalXrp]);

  const availableForFeesXrp = useMemo(() => {
    // Product rule: the activation reserve is treated as a fee buffer.
    // Only the "extra" reserve (due to owned objects like trustlines) is locked.
    const available = currentXrpBalance - lockedReserveXrp;
    return Number.isFinite(available) ? Math.max(0, available) : 0;
  }, [currentXrpBalance, lockedReserveXrp]);

  const totalFeesPaidXrp = useMemo(() => {
    const list = Array.isArray(transactions) ? transactions : [];
    const totalRow = list.find(
      (tx) => String(tx?.kind || "").toUpperCase() === "XRPL_FEES_TOTAL",
    );
    const amount = Number(totalRow?.amount);
    if (Number.isFinite(amount) && amount >= 0) return amount;
    return 0;
  }, [transactions]);

  const totalFeesPaidCount = useMemo(() => {
    const list = Array.isArray(transactions) ? transactions : [];
    const totalRow = list.find(
      (tx) => String(tx?.kind || "").toUpperCase() === "XRPL_FEES_TOTAL",
    );
    const count = Number(totalRow?.feesCount);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  }, [transactions]);

  const formatXrpAmount = useMemo(() => {
    return (value, { smallMaxDecimals = 6, largeMaxDecimals = 2 } = {}) => {
      const v = Number(value);
      const safe = Number.isFinite(v) ? v : 0;
      const abs = Math.abs(safe);
      const maxFractionDigits = abs > 0 && abs < 0.01 ? smallMaxDecimals : largeMaxDecimals;
      try {
        return new Intl.NumberFormat(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: maxFractionDigits,
        }).format(safe);
      } catch {
        return safe.toFixed(Math.max(2, maxFractionDigits));
      }
    };
  }, [locale]);

  const reserveFillPct = useMemo(() => {
    const total = Number(walletBalance?.xrp);
    if (!Number.isFinite(total) || total <= 0) return 0;
    const pct = (activationReserveXrp / total) * 100;
    if (!Number.isFinite(pct)) return 0;
    return Math.max(0, Math.min(100, pct));
  }, [activationReserveXrp, walletBalance?.xrp]);

  const formattedRlusdBalance = useMemo(() => {
    const value = Number(rlusdBalance);
    const safe = Number.isFinite(value) ? value : 0;
    try {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(safe);
    } catch {
      return safe.toFixed(2);
    }
  }, [locale, rlusdBalance]);

  useEffect(() => {
    if (!showRlusdModal) return;
    const handler = (e) => {
      if (e.key === "Escape") setShowRlusdModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showRlusdModal]);

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {showRlusdModal ? (
        <RlusdInfoModal onClose={() => setShowRlusdModal(false)} />
      ) : null}

      <div className="rounded-[14px] ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-18px_28px_rgba(0,0,0,0.55)] overflow-hidden">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white/85">
              {t("ui_activation_reserve", "Activation Reserve")}
            </div>
            <div className="text-sm font-semibold text-white">
              {formatXrpAmount(activationReserveXrp, { smallMaxDecimals: 2, largeMaxDecimals: 2 })}{" "}
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
              <div className="min-w-0">
                <div className="text-sm text-white/75">
                  {t("ui_available_for_fees", "Available for Fees")}
                </div>
                <div className="text-[11px] text-white/45 mt-0.5 truncate">
                  {t("ui_xrp_available_breakdown", "Solde {{bal}} • Réserve {{res}}", {
                    bal: `${formatXrpAmount(currentXrpBalance, { smallMaxDecimals: 6, largeMaxDecimals: 6 })} ${t("ui_xrp_034964b994", "XRP")}`,
                    res: `${formatXrpAmount(lockedReserveXrp, { smallMaxDecimals: 6, largeMaxDecimals: 6 })} ${t("ui_xrp_034964b994", "XRP")}`,
                  })}
                </div>
              </div>
              <div className="text-sm font-semibold text-white shrink-0">
                {formatXrpAmount(availableForFeesXrp, {
                  smallMaxDecimals: 6,
                  largeMaxDecimals: 6,
                })}{" "}
                {t("ui_xrp_034964b994", "XRP")}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/75">
                {t("ui_total_fees_paid", "Total Fees Paid")}
              </div>
              <div className="text-sm font-semibold text-white">
                {formatXrpAmount(totalFeesPaidXrp, { smallMaxDecimals: 6, largeMaxDecimals: 6 })}{" "}
                {t("ui_xrp_034964b994", "XRP")}
              </div>
            </div>
            {totalFeesPaidCount > 0 ? (
              <div className="text-[11px] text-white/45">
                {t("ui_transactions_count_short", "{{count}} tx", {
                  count: totalFeesPaidCount,
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[14px] ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-18px_28px_rgba(0,0,0,0.55)] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <div className="text-sm font-semibold text-white/85">
            {t("ui_active_trustlines", "Active Trustlines")}
          </div>
        </div>

        {hasRlusdTrustline ? (
          <button
            type="button"
            onClick={() => setShowRlusdModal(true)}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-white">RLUSD</div>
                  <span className="text-[11px] text-white/40">
                    {t("ui_ripple_usd", "Ripple USD")}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-xcannes-green/10 text-xcannes-green border border-xcannes-green/20 whitespace-nowrap">
                    {t("ui_active_short", "Active")}
                  </span>
                </div>
                <div className="text-[12px] text-white/55 mt-0.5">
                  {t("ui_1_rlusd_equals_1_usd", "1 RLUSD = 1 USD")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-sm font-semibold text-white">
                {formattedRlusdBalance}{" "}
                <span className="text-white/70">{t("ui_rlusd", "RLUSD")}</span>
              </div>
              <div className="text-sm text-white/40">
                {t("ui_details_e9615e470d", "Details")} ›
              </div>
            </div>
          </button>
        ) : (
          <div className="px-4 py-4">
            <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/85">
                    {t("ui_no_active_trustlines", "No active trustlines")}
                  </div>
                  <div className="mt-1 text-[12px] text-white/55">
                    {t(
                      "ui_trustline_rlusd_needed_hint",
                      "Activez la trustline RLUSD pour utiliser le Compte et payer les frais de transactions RLUSD.",
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-white/70 border border-white/10 shrink-0">
                  {t("ui_inactive_short", "Inactive")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {}}
                className="mt-3 w-full px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/15 text-white/80 transition-colors"
              >
                {t("ui_activate_rlusd_trustline", "Activer RLUSD (gratuit)")}
              </button>
            </div>
          </div>
        )}
      </div>

	      <div className="rounded-[14px] ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] overflow-hidden">
	        <div className="px-4 py-4">
	          <div className="flex items-start justify-between gap-3">
	            <div className="text-sm font-bold text-white/85">
	              {t(
	                "ui_xrp_network_explainer_title",
	                "Comprendre la réserve, les fees et les trustlines",
	              )}
	            </div>
	            <button
	              type="button"
	              onClick={() => setShowReserveAndFees((v) => !v)}
	              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
	              aria-expanded={showReserveAndFees}
	              aria-label={t("ui_expand_details", "Afficher les détails")}
	            >
	              {showReserveAndFees ? "−" : "+"}
	            </button>
	          </div>
	          <div className="mt-2 text-[12px] text-white/65 leading-relaxed">
	            {t(
	              "ui_xrp_network_explainer_intro",
	              "Dans XCANNES, le XRP n’est pas échangé : il sert à activer le Compte, à maintenir les trustlines (ex: RLUSD) et à payer les frais réseau du XRPL.",
            )}
          </div>

	          <div className="mt-4 space-y-3">
	            <div className="flex items-start gap-3">
	              <span className="mt-0.5 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/80 shrink-0">
	                ⓘ
	              </span>
		              <div className="min-w-0">
		                <div className="text-sm font-semibold text-white/85">
		                  {t("ui_xrp_explainer_reserve_title", "Réserve")}
	                </div>
	                {showReserveAndFees ? (
	                  <div className="mt-1 text-[12px] text-white/60 leading-relaxed">
	                    {t(
	                      "ui_xrp_explainer_reserve_desc",
	                      "La réserve est un minimum requis par le XRPL. Elle dépend de votre Compte (activation) et des objets détenus (ex: trustlines). Une partie peut servir de buffer pour les frais.",
	                    )}
	                  </div>
	                ) : null}
	              </div>
		            </div>

	            <div className="flex items-start gap-3">
	              <span className="mt-0.5 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-xcannes-green/10 border border-xcannes-green/25 text-xcannes-green shrink-0">
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
		                <div className="text-sm font-semibold text-white/85">
		                  {t("ui_xrp_explainer_fees_title", "Frais de réseaux XRPL")}
		                </div>
		                {showReserveAndFees ? (
		                  <>
		                    <div className="mt-1 text-[12px] text-white/60 leading-relaxed">
		                      {t(
		                        "ui_xrpl_fees_note",
		                        "Les frais de transaction sur le XRPL sont extrêmement faibles (≈ 0.00001 XRP, soit < 0.0001 USD) et sont déduits de votre reserve XRP.",
		                      )}
		                    </div>
		                    <div className="mt-2 text-[12px] text-white/65">
		                      {t("ui_total_fees_paid", "Total Fees Paid")}:{" "}
		                      <span className="font-semibold text-white/85">
		                        {formatXrpAmount(totalFeesPaidXrp, {
		                          smallMaxDecimals: 6,
		                          largeMaxDecimals: 6,
		                        })}{" "}
		                        {t("ui_xrp_034964b994", "XRP")}
		                      </span>
		                      {totalFeesPaidCount > 0 ? (
		                        <span className="text-white/45">
		                          {" "}
		                          ·{" "}
		                          {t("ui_transactions_count_short", "{{count}} tx", {
		                            count: totalFeesPaidCount,
		                          })}
		                        </span>
		                      ) : null}
		                    </div>
		                  </>
		                ) : null}
		              </div>
		            </div>

	            <div className="flex items-start gap-3">
		              <span className="mt-0.5 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/80 shrink-0">
		                <Image
		                  src="/symbols/rlusd.png"
		                  alt="RLUSD"
	                  width={20}
                  height={20}
                  className="rounded-md"
                />
              </span>
	              <div className="min-w-0">
	                <div className="text-sm font-semibold text-white/85">
	                  {t("ui_xrp_explainer_trustlines_title", "Trustlines (RLUSD)")}
	                </div>
	                {showReserveAndFees ? (
	                  <div className="mt-1 text-[12px] text-white/60 leading-relaxed">
	                    {t(
	                      "ui_xrp_explainer_trustlines_desc",
	                      "Une trustline est une autorisation sur le XRPL. XCANNES utilise RLUSD comme base : vous activez la trustline pour envoyer/recevoir et convertir.",
	                    )}
	                  </div>
	                ) : null}
	              </div>
	            </div>
	          </div>
	        </div>
	      </div>
	    </div>
	  );
	}

function RlusdInfoModal({ onClose }) {
  const { t } = useTranslation("common");

  return (
    <div
      className="fixed inset-0 z-[10260] flex flex-col bg-black/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative w-full h-full bg-elevated overflow-y-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]">
        <div className="sticky top-0 z-10 bg-elevated/95 backdrop-blur border-b border-white/10 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
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
                <div className="text-lg font-bold text-white leading-tight">
                  {t("ui_discover_rlusd", "Découvrez RLUSD")}
                </div>
                <div className="text-sm text-white/60">
                  {t("ui_rlusd_ripple_usd", "(Ripple USD)")}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-white/55 hover:text-white hover:bg-white/5 transition-colors"
              aria-label={t("close", "Fermer")}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-4 pb-10 pt-5 max-w-[520px] mx-auto">
          <div className="text-sm text-white/70 leading-relaxed">
            {t(
              "ui_rlusd_intro",
              "Le RLUSD (Ripple USD) est un stablecoin rattaché en 1:1 au dollar américain (1 RLUSD = 1 USD), émis par Ripple sur le XRP Ledger.",
            )}
          </div>

          <div className="mt-5 h-px bg-white/10" />

          <div className="mt-5">
            <div className="text-sm font-bold text-white/85">
              {t("ui_why_rlusd_secure", "Pourquoi RLUSD est sécurisé ?")}
            </div>

            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-start gap-3">
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
                    <div className="text-sm font-semibold text-white/85">
                      {t("ui_stablecoin_1_1", "Stablecoin garanti 1:1")}
                    </div>
                    <div className="mt-1 text-[12px] text-white/60 leading-relaxed">
                      {t(
                        "ui_stablecoin_1_1_desc",
                        "Chaque RLUSD est garanti par 1 dollar américain détenu dans des réserves réglementées par Ripple.",
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-start gap-3">
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
                    <div className="text-sm font-semibold text-white/85">
                      {t("ui_issued_by_licensed_company", "Émis par une société agréée")}
                    </div>
                    <div className="mt-1 text-[12px] text-white/60 leading-relaxed">
                      {t(
                        "ui_issued_by_licensed_company_desc",
                        "Ripple, la société émettrice du RLUSD, est enregistrée comme entreprise de services monétaires auprès de la FinCEN aux États-Unis et autorisée comme entité par Singapour et l’Irlande.",
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-bold text-white/85">
              {t("ui_what_is_rlusd_exactly", "RLUSD, c’est quoi exactement ?")}
            </div>
            <div className="mt-2 text-[12px] text-white/65 leading-relaxed">
              {t(
                "ui_what_is_rlusd_exactly_desc",
                "RLUSD est un stablecoin indexé sur le dollar américain émis par Ripple sur le XRP Ledger, ce qui signifie que 1 RLUSD est toujours équivalent à 1 dollar américain.",
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-[radial-gradient(70%_70%_at_50%_30%,rgba(34,197,94,0.14)_0%,rgba(0,0,0,0.20)_55%,rgba(0,0,0,0.55)_100%)] overflow-hidden">
              <div className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-xcannes-green/10 border border-xcannes-green/25 text-xcannes-green shrink-0">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-white/85">
                          {t("ui_guaranteed_stability", "Stabilité garantie")}
                        </div>
                        <div className="text-[11px] text-white/55 mt-0.5">
                          {t("ui_1_rlusd_equals_1_usd", "1 RLUSD = 1 USD")}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-xcannes-green/10 border border-xcannes-green/25 text-xcannes-green shrink-0">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-white/85">
                          {t("ui_issued_by_ripple", "Émis par Ripple")}
                        </div>
                        <div className="text-[11px] text-white/55 mt-0.5">
                          {t(
                            "ui_regulatory_compliance",
                            "Ripple assure la conformité réglementaire",
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <a
              href="https://rlusd.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-semibold text-white/85 underline underline-offset-4 hover:text-white transition-colors"
            >
              {t("ui_stablecoin_rlusd", "Stablecoin RLUSD")}
            </a>
            <div className="text-[11px] text-white/40 mt-1">
              {t("ui_open_ripple_com", "Ouvrir ripple.com")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
