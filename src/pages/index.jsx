import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Header from "@/components/layout/Header";
import FooterPro from "@/components/layout/FooterPro";
import Link from "next/link";
import SEOHead from "@/components/layout/SEOHead";
import SupportAssistantWidget from "@/components/layout/SupportAssistantWidget";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import WalletProductSection from "@/components/home/WalletProductSection";
import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

export default function Home() {
  const { t } = useTranslation("common");

  const [speedModalRoot, setSpeedModalRoot] = useState(null);
  const [speedModalOpen, setSpeedModalOpen] = useState(false);
  const [securityModalRoot, setSecurityModalRoot] = useState(null);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [feesModalRoot, setFeesModalRoot] = useState(null);
  const [feesModalOpen, setFeesModalOpen] = useState(false);
  const [valueModalRoot, setValueModalRoot] = useState(null);
  const [valueModalOpen, setValueModalOpen] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "speed-details-modal-root";
    document.body.appendChild(el);
    setSpeedModalRoot(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "security-details-modal-root";
    document.body.appendChild(el);
    setSecurityModalRoot(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "fees-details-modal-root";
    document.body.appendChild(el);
    setFeesModalRoot(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "value-details-modal-root";
    document.body.appendChild(el);
    setValueModalRoot(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);

  return (
    <>
      <SEOHead
        title={t("ui_xcannes_multi_currency_walle_51c5a96da0", "XCANNES - Multi-currency wallet with stable USD value")}
        description="A non-custodial multi-currency wallet with a local-currency experience and stable USD value in the background. Send, pay, receive, and convert with clarity."
        canonical="/" />


      <Header />

      <div className="pt-16 bg-xcannes-background">

        {/* HERO (more “private bank” tone) */}
        <main className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.05),transparent_45%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-xcannes-background md:h-36" />

          <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 md:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-5">
                {t("home_v2_hero_badge", "XCANNES")}
              </p>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-montserrat font-semibold text-white leading-tight tracking-tight">
                {t("home_v2_hero_title", "Payez local.")}{" "}
                <span className="text-xcannes-green">
                  {t("home_v2_hero_title_emphasis", "Gardez la valeur.")}
                </span>
              </h1>

                <p className="mt-6 text-lg sm:text-xl text-white/90 font-light leading-relaxed italic">
                  <span dangerouslySetInnerHTML={{
                    __html: t(
                      "home_v2_hero_subtitle",
                      "Payez, recevez et convertissez dans 160+ devises ⮕ rapide, sécurisé, économique."
                    ).replace('⮕', '<span class="inline-block text-xcannes-green animate-pulse">⮕</span>')
                  }} />
                </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Link href="/wallet">
                  <button className={bankButtonClassName({ tone: "blue", variant: "soft", size: "lg" })}>
                    <span className="sm:hidden">
                      {t("home_v2_hero_cta_primary_mobile", "Gérer mon argent")}
                    </span>
                    <span className="hidden sm:inline">
                      {t("home_v2_hero_cta_primary", "Ouvrir le wallet")}
                    </span>
                  </button>
                </Link>
                <Link
                  href="/dex"
                  className={bankButtonClassName({ tone: "green", variant: "soft", size: "lg" })}
                >
                  <span className="sm:hidden">
                    {t("home_v2_final_cta_markets_mobile", "Voir les taux de change")}
                  </span>
                  <span className="hidden sm:inline">
                    {t("home_v2_final_cta_markets", "Voir les marchés")}
                  </span>
                </Link>
              </div>

              {/* 4 essentials (keep light, avoid jargon) */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                {
                  title: t("home_v2_hero_pillar_1_title", "Rapide"),
                  stat: t("home_v2_hero_pillar_1_stat", "≤ 3 s"),
                  subtitle: t("home_v2_hero_pillar_1_caption", "Paiement & conversion"),
                  link: {
                    label: t("home_v2_hero_pillar_1_link", "Détails"),
                    onClick: () => setSpeedModalOpen(true),
                  },
                  icon:
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/80">
                        <path d="M10 13l2 2 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 22A10 10 0 1 0 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                },
                {
                  title: t("home_v2_hero_pillar_2_title", "Sécurisé"),
                  desc: t(
                    "home_v2_hero_pillar_2_desc",
                    "Chaque transaction est validée sous votre contrôle exclusif."
                  ),
                  link: {
                    label: t("home_v2_hero_pillar_2_link", "Détails"),
                    onClick: () => setSecurityModalOpen(true),
                  },
                  icon:
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/80">
                        <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0 0 15.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 0 0 8 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                },
                {
                  title: t("home_v2_hero_pillar_3_title", "Économique"),
                  desc: t(
                    "home_v2_hero_pillar_3_desc",
                    "Frais optimisés, conversion affichée avant confirmation."
                  ),
                  link: {
                    label: t("home_v2_hero_pillar_3_link", "Détails"),
                    onClick: () => setFeesModalOpen(true),
                  },
                  icon:
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/80">
                        <path d="M7 7h11l-2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M17 17H6l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                },
                {
                  title: t("home_v2_hero_pillar_4_title", "Gardez la valeur"),
                  desc: t(
                    "home_v2_hero_pillar_4_desc",
                    "Un pouvoir d’achat stable, dans n’importe quel pays. Protégez ce que vous mettez de côté."
                  ),
                  descClassName: "text-[16px] sm:text-[13px]",
                  className:
                    "order-first sm:order-none lg:order-first lg:col-span-3",
                  iconWrapperClassName: "w-10 h-10 lg:w-11 lg:h-11",
                  link: {
                    label: t("home_v2_hero_pillar_4_link", "Détails"),
                    onClick: () => setValueModalOpen(true),
                  },
                  icon:
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/80">
                        <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                }].map((item) => {
                  const isClickable = Boolean(item.link?.onClick);
                  return (
                    <div
                      key={item.title}
                      role={isClickable ? "button" : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      onClick={isClickable ? item.link.onClick : undefined}
                      onKeyDown={
                        isClickable
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                item.link.onClick();
                              }
                            }
                          : undefined
                      }
                      className={[
                        "flex items-start gap-3 bg-black/20 border border-xcannes-green/25 rounded-xl px-4 py-4 transition-transform duration-200 ease-out hover:scale-[1.01] hover:border-xcannes-green/60",
                        isClickable
                          ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-xcannes-green/70"
                          : "",
                        item.className
                      ].filter(Boolean).join(" ")}>

                    <div
                      className={[
                        "mt-0.5 flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-white/10",
                        item.iconWrapperClassName
                      ].filter(Boolean).join(" ")}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0 text-left flex-1 h-full flex flex-col">
                    <div className="flex w-full items-baseline justify-between gap-3">
                      <div className="text-[18px] sm:text-[17px] font-semibold text-white/90">{item.title}</div>
                      {item.link ? null : null}
                    </div>
                    {item.subtitle ? (
                      <div className="mt-0.5 text-[17.5px] sm:text-[14.5px] text-white/75 italic">
                        {item.subtitle}
                      </div>
                    ) : null}
                    {item.stat ? (
                      <div className="mt-2 text-center">
                        <div className="text-3xl font-semibold text-white/90 leading-tight">
                          {item.stat}
                        </div>
                      </div>
                    ) : null}
                    {item.desc ? (
                      <div
                        className={[
                          "text-[17.5px] sm:text-[14.5px] text-white/75 leading-relaxed italic",
                          item.stat ? "mt-1 text-center" : "",
                          item.descClassName
                        ].filter(Boolean).join(" ")}
                      >
                        {item.desc}
                      </div>
                    ) : null}
                    {item.link ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          item.link.onClick();
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-xcannes-green hover:text-xcannes-green/80 transition-colors shrink-0 mt-auto self-end pt-3"
                      >
                        {item.link.label}
                      </button>
                    ) : null}
                  </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        </main>
        {speedModalRoot &&
          speedModalOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-xcannes-background px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSpeedModalOpen(false);
              }}
            >
              <div className="w-full max-w-[560px] rounded-xl bg-black/20 p-6 sm:p-7 backdrop-blur-sm shadow-[0_0_26px_rgba(34,197,94,0.18)] md:shadow-[0_0_22px_rgba(34,197,94,0.12)] animate-[fadeScale_180ms_ease-out] motion-reduce:animate-none">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xcannes-green/90">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[23px] sm:text-[24px] font-semibold text-white leading-tight">
                        {t("home_v2_hero_speed_modal_title", "Pourquoi c'est rapide")}
                      </h4>
                      <p className="mt-1.5 text-[19.5px] sm:text-[13.5px] text-white/65 leading-[1.5]">
                        {t(
                          "home_v2_hero_speed_modal_subtitle",
                          "XCANNES s'appuie sur le réseau XRP Ledger pour valider les transactions en quelques secondes."
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpeedModalOpen(false)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors shrink-0"
                    aria-label={t("home_v2_hero_speed_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    t(
                      "home_v2_hero_speed_modal_point_1",
                      "Transactions XRPL natives : validation on-chain en quelques secondes."
                    ),
                    t(
                      "home_v2_hero_speed_modal_point_2",
                      "Signature immédiate dans Xaman, sans délais bancaires."
                    ),
                    t(
                      "home_v2_hero_speed_modal_point_3",
                      "Transactions préremplies : vous validez, c'est terminé."
                    ),
                    t(
                      "home_v2_hero_speed_modal_point_4",
                      "Engagement XCANNES : < 3 s en conditions normales."
                    ),
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-xcannes-green/70 flex-shrink-0" />
                      <span className="text-[20.5px] sm:text-[14.5px] text-white/80 leading-relaxed">{line}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 text-[18.5px] sm:text-[12.5px] text-white/50 italic leading-relaxed">
                  {t(
                    "home_v2_hero_speed_modal_note",
                    "En cas de congestion rare du réseau, le délai peut être légèrement supérieur."
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSpeedModalOpen(false)}
                    className="px-6 py-2 rounded-lg border border-white/15 bg-white/[0.04] text-white text-[14px] font-medium backdrop-blur-md transition-all duration-200 hover:border-xcannes-green/40 hover:bg-white/[0.08] hover:shadow-[0_0_18px_rgba(24,169,113,0.25)]"
                  >
                    {t("home_v2_hero_speed_modal_cta", "Compris")}
                  </button>
                </div>
              </div>
            </div>,
            speedModalRoot
          )}
        {securityModalRoot &&
          securityModalOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-xcannes-background px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSecurityModalOpen(false);
              }}
            >
              <div className="w-full max-w-[560px] rounded-xl bg-black/20 p-6 sm:p-7 backdrop-blur-sm shadow-[0_0_26px_rgba(34,197,94,0.18)] md:shadow-[0_0_22px_rgba(34,197,94,0.12)] animate-[fadeScale_180ms_ease-out] motion-reduce:animate-none">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xcannes-green/90">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3l8 4v6c0 5-4 7.5-8 8-4-0.5-8-3-8-8V7l8-4z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[23px] sm:text-[24px] font-semibold text-white leading-tight">
                        {t("home_v2_hero_security_modal_title", "Sécurisé")}
                      </h4>
                      <p className="mt-1.5 text-[15.5px] sm:text-[13.5px] text-white/65 leading-[1.5]">
                        {t(
                          "home_v2_hero_security_modal_subtitle",
                          "Chaque transaction est validée sous votre contrôle exclusif."
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSecurityModalOpen(false)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors shrink-0"
                    aria-label={t("home_v2_hero_security_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    t(
                      "home_v2_hero_security_modal_point_1",
                      "Non‑custodial : XCANNES ne détient pas vos fonds."
                    ),
                    t(
                      "home_v2_hero_security_modal_point_2",
                      "Chaque action est validée par vous, jamais automatiquement."
                    ),
                    t(
                      "home_v2_hero_security_modal_point_3",
                      "Transactions enregistrées sur le réseau, traçables et vérifiables."
                    ),
                    t(
                      "home_v2_hero_security_modal_point_5",
                      "XCANNES renforce la sécurité des transactions en s’appuyant sur Xaman, le wallet natif de l’écosystème XRPL."
                    ),
                    t(
                      "home_v2_hero_security_modal_point_4",
                      "Les transactions ne peuvent être validées qu’après authentification sur l’appareil de l’utilisateur, par code PIN ou biométrie."
                    ),
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-xcannes-green/70 flex-shrink-0" />
                      <span className="text-[16.5px] sm:text-[14.5px] text-white/80 leading-relaxed">{line}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 text-[14.5px] sm:text-[12.5px] text-white/50 italic leading-relaxed">
                  {t(
                    "home_v2_hero_security_modal_note",
                    "Vous gardez le contrôle, XCANNES n’agit jamais à votre place."
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSecurityModalOpen(false)}
                    className="px-6 py-2 rounded-lg border border-white/15 bg-white/[0.04] text-white text-[14px] font-medium backdrop-blur-md transition-all duration-200 hover:border-xcannes-green/40 hover:bg-white/[0.08] hover:shadow-[0_0_18px_rgba(24,169,113,0.25)]"
                  >
                    {t("home_v2_hero_security_modal_cta", "Compris")}
                  </button>
                </div>
              </div>
            </div>,
            securityModalRoot
          )}
        {feesModalRoot &&
          feesModalOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-xcannes-background px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setFeesModalOpen(false);
              }}
            >
              <div className="w-full max-w-[560px] rounded-xl bg-black/20 p-6 sm:p-7 backdrop-blur-sm shadow-[0_0_26px_rgba(34,197,94,0.18)] md:shadow-[0_0_22px_rgba(34,197,94,0.12)] animate-[fadeScale_180ms_ease-out] motion-reduce:animate-none">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xcannes-green/90">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[23px] sm:text-[24px] font-semibold text-white leading-tight">
                        {t("home_v2_hero_fees_modal_title", "Économique")}
                      </h4>
                      <p className="mt-1.5 text-[19.5px] sm:text-[13.5px] text-white/65 leading-[1.5]">
                        {t(
                          "home_v2_hero_fees_modal_subtitle",
                          "Des coûts maîtrisés, affichés avant confirmation."
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeesModalOpen(false)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors shrink-0"
                    aria-label={t("home_v2_hero_fees_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    t(
                      "home_v2_hero_fees_modal_point_2",
                      "XCANNES ne prélève pas de frais séparés : le coût principal est le spread."
                    ),
                    t(
                      "home_v2_hero_fees_modal_point_3",
                      "Le spread est optimisé selon la devise."
                    ),
                    t(
                      "home_v2_hero_fees_modal_point_5",
                      "Activation ou désactivation d’une ligne de compte : 1 USD (≈ 1 RLUSD), sans durée limite. Cette transaction enregistre l’action sur le réseau XRPL."
                    ),
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-xcannes-green/70 flex-shrink-0" />
                      <span className="text-[20.5px] sm:text-[14.5px] text-white/80 leading-relaxed">{line}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 text-[18.5px] sm:text-[12.5px] text-white/50 italic leading-relaxed">
                  {t(
                    "home_v2_hero_fees_modal_note",
                    "Activation d'une nouvelle devise : paiement unique en RLUSD."
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFeesModalOpen(false)}
                    className="px-6 py-2 rounded-lg border border-white/15 bg-white/[0.04] text-white text-[14px] font-medium backdrop-blur-md transition-all duration-200 hover:border-xcannes-green/40 hover:bg-white/[0.08] hover:shadow-[0_0_18px_rgba(24,169,113,0.25)]"
                  >
                    {t("home_v2_hero_fees_modal_cta", "Compris")}
                  </button>
                </div>
              </div>
            </div>,
            feesModalRoot
          )}
        {valueModalRoot &&
          valueModalOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-xcannes-background px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setValueModalOpen(false);
              }}
            >
              <div className="w-full max-w-[560px] rounded-xl bg-black/20 p-6 sm:p-7 backdrop-blur-sm shadow-[0_0_26px_rgba(34,197,94,0.18)] md:shadow-[0_0_22px_rgba(34,197,94,0.12)] animate-[fadeScale_180ms_ease-out] motion-reduce:animate-none">
                {/* Header avec icône */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-start gap-3">
                    {/* Icône ancre/bouclier */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-xcannes-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[23px] sm:text-[24px] font-semibold text-white leading-tight">
                        {t("home_v2_hero_value_modal_title", "Protégé contre la volatilité")}
                      </h4>
                      <p className="mt-1.5 text-[13.5px] text-white/65 leading-[1.5]">
                        {t(
                          "home_v2_hero_value_modal_subtitle",
                          "Même si la devise locale bouge, votre référence USD (RLUSD) reste la même."
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValueModalOpen(false)}
                    className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                    aria-label={t("home_v2_hero_value_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>

                {/* Points principaux */}
                <div className="mt-5 space-y-3">
                  {[
                    t(
                      "home_v2_hero_value_modal_point_1",
                      "Le montant que vous validez est en devise locale."
                    ),
                    t(
                      "home_v2_hero_value_modal_point_2",
                      "Les montants locaux suivent le taux du marché."
                    ),
                    t(
                      "home_v2_hero_value_modal_point_3",
                      "La référence USD (RLUSD) reste stable et lisible."
                    ),
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-xcannes-green/70 flex-shrink-0" />
                      <span className="text-[14.5px] text-white/80 leading-relaxed">{line}</span>
                    </div>
                  ))}
                </div>

                {/* Bloc Exemple visuel */}
                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-[12px] font-semibold text-xcannes-green uppercase tracking-[0.2em]">
                      {t("home_v2_hero_value_modal_example_title", "Exemple")}
                    </div>
                    {t("home_v2_hero_value_modal_example_rate", "").trim() ? (
                      <div className="text-[11px] text-white/50">
                        {t("home_v2_hero_value_modal_example_rate", "Taux initial 1,18 → 1,10")}
                      </div>
                    ) : null}
                  </div>

                  {t("home_v2_hero_value_modal_example_intro", "").trim() ? (
                    <p className="text-[13.5px] text-white/65 leading-relaxed mb-4">
                      {t(
                        "home_v2_hero_value_modal_example_intro",
                        "Si vous convertissez 1 EUR au taux 1,18, votre référence devient 1,18 RLUSD."
                      )}
                    </p>
                  ) : null}

                  {/* Mini-schéma visuel */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-[12px] text-white/60 mb-3">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md border border-white/10 bg-white/[0.03] text-xcannes-green/90">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 7l6 6 4-4 6 6" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M20 19H4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span className="font-medium">{t("home_v2_hero_value_modal_example_if_eur_falls", "Si l'euro baisse")}</span>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] text-white/45 uppercase tracking-[0.18em] mb-1">
                          {t("home_v2_hero_value_modal_example_today", "Aujourd'hui")}
                        </div>
                        <div className="text-[14px] text-white">1 EUR = 1,18$</div>
                        <div className="text-[12px] text-white/55">
                          {t("home_v2_hero_value_modal_example_ref", "Réf")} : 1,18$
                        </div>
                      </div>

                      {t("home_v2_hero_value_modal_example_rate_moves", "").trim() ? (
                        <div className="flex items-center justify-center gap-2 text-[11px] text-white/45">
                          <span>{t("home_v2_hero_value_modal_example_rate_moves", "Le taux change")}</span>
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M7 14l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : null}

                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] text-white/45 uppercase tracking-[0.18em] mb-1">
                          {t("home_v2_hero_value_modal_example_later", "Plus tard")}
                        </div>
                        <div className="text-[14px] text-white">1 EUR = 1,10$</div>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-white">EUR ≈ 1,07</span>
                            <span className="text-[10px] text-white/45 uppercase tracking-wide">
                              {t("home_v2_hero_value_modal_example_change", "change")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-xcannes-green">USD = 1,18$</span>
                            <span className="text-[10px] text-white/45 uppercase tracking-wide">
                              {t("home_v2_hero_value_modal_example_stable", "stable")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-[12px] text-white/60">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md border border-white/10 bg-white/[0.03] text-xcannes-green/90">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 3l8 4v6c0 5-4 7.5-8 8-4-0.5-8-3-8-8V7l8-4z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span>{t("home_v2_hero_value_modal_example_usd_anchor", "Référence USD inchangée")}</span>
                    </div>
                  </div>

                  {t("home_v2_hero_value_modal_example_conclusion", "").trim() ? (
                    <div className="mt-4 text-[13.5px] text-white/65 leading-relaxed border-t border-white/10 pt-3">
                      {t(
                        "home_v2_hero_value_modal_example_conclusion",
                        "Si le taux passe à 1,10, l'affichage devient ≈ 1,07 EUR, mais la référence reste 1,18 RLUSD. Vous décidez quand reconvertir."
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Note finale */}
                <div className="mt-5 text-[12.5px] text-white/50 italic leading-relaxed">
                  {t(
                    "home_v2_hero_value_modal_note",
                    "L'affichage local varie avec le marché ; la référence reste USD (RLUSD)."
                  )}
                </div>

                {/* Bouton CTA discret */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setValueModalOpen(false)}
                    className="px-6 py-2 rounded-lg border border-white/15 bg-white/[0.04] text-white text-[14px] font-medium backdrop-blur-md transition-all duration-200 hover:border-xcannes-green/40 hover:bg-white/[0.08] hover:shadow-[0_0_18px_rgba(24,169,113,0.25)]"
                  >
                    {t("home_v2_hero_value_modal_cta", "Compris")}
                  </button>
                </div>
              </div>
            </div>,
            valueModalRoot
          )}
      </div>

      {/* CONTENT SECTIONS */}
      <div className="bg-xcannes-background">
        <WalletProductSection />
        <section className="relative py-14 sm:py-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-montserrat font-[300] text-white/90 tracking-[0.02em]">
              {t("home_v2_demo_slogan", "Votre argent. Partout. Intact.")}
            </h3>
          </div>
        </section>
      </div>

      <FooterPro />

      <SupportAssistantWidget />
    </>);

}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getPageTranslations(locale, ["common"]))
    }
  };
}
