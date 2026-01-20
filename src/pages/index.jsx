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

                <p className="mt-6 text-lg sm:text-xl text-white/80 font-light leading-relaxed">
                  {t(
                    "home_v2_hero_subtitle",
                  "Payez, recevez et convertissez dans 160+ devises — rapide, sécurisé, économique."
                  )}
                </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Link href="/wallet">
                  <button className={bankButtonClassName({ tone: "blue", variant: "soft", size: "lg" })}>
                    {t("home_v2_hero_cta_primary", "Ouvrir le wallet")}
                  </button>
                </Link>
                <Link
                  href="/dex"
                  className={bankButtonClassName({ tone: "green", variant: "soft", size: "lg" })}
                >
                  {t("home_v2_final_cta_markets", "Voir les marchés")}
                  <span className="inline-block ml-2 text-xs">→</span>
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
                  descClassName: "text-[13px]",
                  className:
                    "order-first sm:order-none lg:order-first lg:col-span-3 relative overflow-hidden border-xcannes-green/40 hover:border-xcannes-green/80 before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-xcannes-green/60 before:to-transparent after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-xcannes-green/50 after:to-transparent",
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
                      <div className="text-[15px] font-semibold text-white/90">{item.title}</div>
                      {item.link ? null : null}
                    </div>
                    {item.subtitle ? (
                      <div className="mt-0.5 text-[13px] text-white/65">
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
                          "text-[13px] text-white/55 leading-relaxed",
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
                        <span aria-hidden="true">→</span>
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
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSpeedModalOpen(false);
              }}
            >
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#040c13]/95 p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">
                      {t("home_v2_hero_speed_modal_title", "Pourquoi c'est rapide")}
                    </h4>
                    <p className="mt-1 text-sm text-white/65">
                      {t(
                        "home_v2_hero_speed_modal_subtitle",
                        "XCANNES s'appuie sur le réseau XRP Ledger (XRP) pour finaliser les transactions en quelques secondes."
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpeedModalOpen(false)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                    aria-label={t("home_v2_hero_speed_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-4 space-y-2 text-sm text-white/70">
                  {[
                    t(
                      "home_v2_hero_speed_modal_point_1",
                      "Vous validez dans Xaman."
                    ),
                    t(
                      "home_v2_hero_speed_modal_point_2",
                      "Confirmations rapides, sans délais bancaires."
                    ),
                    t(
                      "home_v2_hero_speed_modal_point_3",
                      "Engagement XCANNES : < 3 s en conditions normales."
                    ),
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green/70" />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-white/45">
                  {t(
                    "home_v2_hero_speed_modal_note",
                    "En cas de congestion rare du réseau, le délai peut être légèrement supérieur."
                  )}
                </div>
              </div>
            </div>,
            speedModalRoot
          )}
        {securityModalRoot &&
          securityModalOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSecurityModalOpen(false);
              }}
            >
              <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#040c13]/95 p-5 shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">
                      {t(
                        "home_v2_hero_security_modal_title",
                        "Sécurité & validation des transactions"
                      )}
                    </h4>
                    <p className="mt-1 text-sm text-white/65">
                      {t(
                        "home_v2_hero_security_modal_subtitle",
                        "Le wallet XCANNES s'appuie sur Xaman, une solution de validation utilisée par des centaines de milliers d'utilisateurs dans le monde."
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSecurityModalOpen(false)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                    aria-label={t("home_v2_hero_security_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-4 flex-1 overflow-y-auto pr-2">
                  <div className="space-y-4 text-xs text-white/60">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green/70" />
                      <span>
                        {t(
                          "home_v2_hero_security_modal_biometrics",
                          "Validation biométrique sur votre appareil (empreinte/Face ID)."
                        )}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green/70" />
                      <span>
                        {t(
                          "home_v2_hero_security_modal_xrpl_native",
                          "Transactions XRPL natives : validation on-chain, sans intermédiaire."
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 space-y-5 text-sm text-white/70">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
                        {t(
                          "home_v2_hero_security_modal_section_control_title",
                          "Un contrôle qui reste entre vos mains"
                        )}
                      </div>
                      <div className="mt-2 space-y-2">
                        {[
                          t(
                            "home_v2_hero_security_modal_point_1",
                            "Vos fonds restent sous votre contrôle."
                          ),
                          t(
                            "home_v2_hero_security_modal_point_2",
                            "Chaque transaction doit être validée par vous."
                          ),
                          t(
                            "home_v2_hero_security_modal_point_3",
                            "Aucune action ne peut être exécutée sans votre accord."
                          ),
                        ].map((line) => (
                          <div key={line} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green/70" />
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-white/55">
                        {t(
                          "home_v2_hero_security_modal_note",
                          "Ni XCANNES, ni Xaman ne peuvent accéder à vos fonds ou agir à votre place."
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
                        {t(
                          "home_v2_hero_security_modal_section_trust_title",
                          "Un système reconnu et largement utilisé"
                        )}
                      </div>
                      <p className="mt-2">
                        {t(
                          "home_v2_hero_security_modal_section_trust_body",
                          "Xaman est un wallet non-custodial reconnu dans l'écosystème des actifs numériques, utilisé par des services, entreprises et utilisateurs dans le monde."
                        )}
                      </p>
                      <p className="mt-2">
                        {t(
                          "home_v2_hero_security_modal_section_trust_body_2",
                          "Son principe est simple : l'utilisateur conserve le contrôle, la plateforme n'intervient pas dans la validation."
                        )}
                      </p>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
                        {t(
                          "home_v2_hero_security_modal_section_reg_title",
                          "Compatibilité avec les cadres réglementaires"
                        )}
                      </div>
                      <p className="mt-2">
                        {t(
                          "home_v2_hero_security_modal_section_reg_body",
                          "Architecture sans conservation de fonds, sans gestion des clés par la plateforme, avec validation explicite par l'utilisateur."
                        )}
                      </p>
                      <p className="mt-2">
                        {t(
                          "home_v2_hero_security_modal_section_reg_body_2",
                          "Compatible avec les grandes orientations (ex. MiCA en Europe, États-Unis). Xaman est un logiciel de validation, pas un intermédiaire financier."
                        )}
                      </p>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
                        {t(
                          "home_v2_hero_security_modal_section_role_title",
                          "Le rôle de XCANNES"
                        )}
                      </div>
                      <div className="mt-2 space-y-2">
                        {[
                          t(
                            "home_v2_hero_security_modal_section_role_point_1",
                            "Initier des paiements et conversions."
                          ),
                          t(
                            "home_v2_hero_security_modal_section_role_point_2",
                            "Afficher vos soldes et opérations."
                          ),
                          t(
                            "home_v2_hero_security_modal_section_role_point_3",
                            "Vous guider dans vos actions."
                          ),
                        ].map((line) => (
                          <div key={line} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green/70" />
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-white/55">
                        {t(
                          "home_v2_hero_security_modal_section_role_note",
                          "La validation finale et la sécurité reposent sur Xaman et votre confirmation."
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
                        {t(
                          "home_v2_hero_security_modal_section_summary_title",
                          "En résumé"
                        )}
                      </div>
                      <div className="mt-2 space-y-2">
                        {[
                          t(
                            "home_v2_hero_security_modal_section_summary_point_1",
                            "Vous gardez le contrôle de vos fonds."
                          ),
                          t(
                            "home_v2_hero_security_modal_section_summary_point_2",
                            "Chaque transaction est validée manuellement."
                          ),
                          t(
                            "home_v2_hero_security_modal_section_summary_point_3",
                            "Xaman est une solution reconnue et largement utilisée."
                          ),
                          t(
                            "home_v2_hero_security_modal_section_summary_point_4",
                            "XCANNES ne détient ni vos fonds, ni vos clés."
                          ),
                        ].map((line) => (
                          <div key={line} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green/70" />
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            securityModalRoot
          )}
        {feesModalRoot &&
          feesModalOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setFeesModalOpen(false);
              }}
            >
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#040c13]/95 p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">
                      {t("home_v2_hero_fees_modal_title", "Frais & transparence")}
                    </h4>
                    <p className="mt-1 text-sm text-white/65">
                      {t(
                        "home_v2_hero_fees_modal_subtitle",
                        "Les coûts sont affichés avant confirmation."
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeesModalOpen(false)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                    aria-label={t("home_v2_hero_fees_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-4 space-y-2 text-sm text-white/70">
                  {[
                    t(
                      "home_v2_hero_fees_modal_point_1",
                      "Frais réseau XRPL sur chaque transaction on-chain."
                    ),
                    t(
                      "home_v2_hero_fees_modal_point_2",
                      "XCANNES ne prélève pas de frais séparés : le coût est un spread FX."
                    ),
                    t(
                      "home_v2_hero_fees_modal_point_3",
                      "Spread par tiers selon la devise (A/B/C)."
                    ),
                    t(
                      "home_v2_hero_fees_modal_point_4",
                      "Taux de conversion : Pyth quand disponible, sinon FX EOD (1x/jour)."
                    ),
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green/70" />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-white/45">
                  {t(
                    "home_v2_hero_fees_modal_note",
                    "Activation d'une nouvelle devise : paiement unique en XCS."
                  )}
                </div>
              </div>
            </div>,
            feesModalRoot
          )}
        {valueModalRoot &&
          valueModalOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setValueModalOpen(false);
              }}
            >
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#040c13]/95 p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">
                      {t("home_v2_hero_value_modal_title", "Gardez la valeur")}
                    </h4>
                    <p className="mt-1 text-sm text-white/65">
                      {t(
                        "home_v2_hero_value_modal_subtitle",
                        "Montants locaux affichés, référence USD stable."
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValueModalOpen(false)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                    aria-label={t("home_v2_hero_value_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-4 space-y-2 text-sm text-white/70">
                  {[
                    t(
                      "home_v2_hero_value_modal_point_1",
                      "Votre valeur de référence est en USD (RLUSD)."
                    ),
                    t(
                      "home_v2_hero_value_modal_point_2",
                      "Les montants locaux sont indicatifs, basés sur des taux marché."
                    ),
                    t(
                      "home_v2_hero_value_modal_point_3",
                      "Conversion possible à tout moment, taux affiché avant confirmation."
                    ),
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green/70" />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-white/45">
                  {t(
                    "home_v2_hero_value_modal_note",
                    "L'affichage local varie avec le taux de change; la référence reste RLUSD."
                  )}
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
