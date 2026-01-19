import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Header from "@/components/layout/Header";
import FooterPro from "@/components/layout/FooterPro";
import Link from "next/link";
import SEOHead from "@/components/layout/SEOHead";
import WhyXcannesSection from "@/components/home/WhyXcannesSection";
import XummSecuritySection from "@/components/home/XummSecuritySection";
import HomeHowItWorksSection from "@/components/home/HomeHowItWorksSection";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import xcannesApi from "@/lib/xcannesApi";
import WalletProductSection from "@/components/home/WalletProductSection";
import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

export default function Home() {
  const { t } = useTranslation("common");

  // 📊 Charger toutes les paires dynamiquement depuis l'API
  const [availablePairs, setAvailablePairs] = useState([
  "XRP/RLUSD", "XCS/XRP", "XCS/RLUSD" // Fallback - 3 paires configurées
  ]);
  const [loadingPairs, setLoadingPairs] = useState(true);

  // container DOM pour portal (sert à fixer la bulle en dehors de tout conteneur transformé)
  const [assistantContainer, setAssistantContainer] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
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
    el.id = "assistant-root";
    document.body.appendChild(el);
    setAssistantContainer(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);
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

  useEffect(() => {
    const fetchPairs = async () => {
      try {
        const markets = await xcannesApi.getAllMarkets();
        if (markets) {
          // Priorité: trading (XRPL) > pyth (FOREX)
          const allPairs = [
          ...(markets.trading || []), // Paires XRPL
          ...(markets.pyth || []) // Paires Pyth
          ];

          const pairsList = Array.from(new Set(
            allPairs.
            filter((m) => m.active !== false).
            map((m) => `${m.base}/${m.quote}`)
          ));

          setAvailablePairs(pairsList);
          if (DEBUG_LOGS) {
            console.log(`✅ [Index] ${pairsList.length} paires chargées:`, pairsList);
          }
        }
      } catch (error) {
        console.error("⚠️ [Index] Erreur chargement paires, utilisation fallback:", error);
        setAvailablePairs(["XRP/RLUSD", "XCS/XRP", "XCS/RLUSD"]);
      } finally {
        setLoadingPairs(false);
      }
    };

    fetchPairs();
  }, []);

  // Mémoriser pour éviter re-renders inutiles
  // Limiter aux 10 paires les plus utilisées et exclure XCS_*
  const pairs = useMemo(
    () =>
    availablePairs.
    filter((p) => !p.startsWith("XCS/")).
    slice(0, 10),
    [availablePairs]
  );

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
                    "order-first sm:order-none lg:order-first lg:col-span-3 relative overflow-hidden before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-xcannes-green/60 before:to-transparent after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-xcannes-green/50 after:to-transparent",
                  iconWrapperClassName: "w-10 h-10 lg:w-11 lg:h-11",
                  link: {
                    label: t("home_v2_hero_pillar_4_link", "Détails"),
                    onClick: () => setValueModalOpen(true),
                  },
                  icon:
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/80">
                        <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                }].
                map((item) =>
                <div
                  key={item.title}
                  className={[
                    "flex items-start gap-3 bg-black/20 border border-white/10 rounded-xl px-4 py-4",
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
                      <div className="text-sm font-semibold text-white/90">{item.title}</div>
                      {item.link ? null : null}
                    </div>
                    {item.subtitle ? (
                      <div className="mt-0.5 text-xs text-white/65">
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
                          "text-xs text-white/55 leading-relaxed",
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
                        onClick={item.link.onClick}
                        className="inline-flex items-center gap-1 text-[11px] text-xcannes-green hover:text-xcannes-green/80 transition-colors shrink-0 mt-auto self-end pt-3"
                      >
                        {item.link.label}
                        <span aria-hidden="true">→</span>
                      </button>
                    ) : null}
                  </div>
                  </div>
                )}
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
        <HomeHowItWorksSection pairs={pairs} />
        <WhyXcannesSection />
      </div>

      <FooterPro />

      {/* Support - Bottom right floating button */}
      {assistantContainer && createPortal(
        <div className="fixed right-3 bottom-3 md:right-6 md:bottom-6 z-[9999]">
          {assistantOpen &&
          <div className="ai-assistant-panel mb-3 w-[96vw] max-w-none md:max-w-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="ai-badge">{t("home_support_badge", "SUP")}</div>
                  <p className="text-sm font-semibold text-white/90">
                    {t("home_support_title", "Support XCANNES")}
                  </p>
                </div>
                <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                className="ai-close-btn"
                aria-label={t("home_support_close", "Fermer")}>

                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="ai-message-area">
                <p className="text-sm font-medium text-white/90 mb-2">
                  {t("home_support_msg_title", "Besoin d’aide ?")}
                </p>
                <p className="text-xs text-white/60 leading-relaxed">
                  {t(
                  "home_support_msg_body",
                  "Posez une question sur le wallet, les paiements, la conversion ou les marchés. Nous vous guidons étape par étape."
                )}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                type="text"
                placeholder={t("home_support_placeholder", "Write your question…")}
                className="ai-input" />

                <button
                type="button"
                className="ai-send-btn"
                aria-label={t("home_support_send", "Envoyer")}>

                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          }
          {!assistantOpen &&
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="w-10 h-10 md:w-12 md:h-12 transition-all bg-transparent text-white hover:bg-white/10 border-2 border-white/30 rounded-full flex items-center justify-center relative overflow-hidden"
            aria-label={t("home_support_open", "Ouvrir le support")}
            title={t("home_support_open", "Ouvrir le support")}>

              <span
              className="tracking-wider relative z-10 inline-block text-lg md:text-xl"
              style={{ animation: "irregularPulse 3s ease-in-out infinite" }}>

                •••
              </span>
              <span
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              style={{ animation: "shimmer 2s ease-in-out infinite" }}>
            </span>
            </button>
          }
          <style jsx global>{`
            @keyframes shimmer {
              0% {
                transform: translateX(-100%) rotate(0deg);
              }
              100% {
                transform: translateX(100%) rotate(360deg);
              }
            }
            @keyframes irregularPulse {
              0% {
                transform: scale(1);
              }
              15% {
                transform: scale(1.15);
              }
              25% {
                transform: scale(1);
              }
              40% {
                transform: scale(1.08);
              }
              50% {
                transform: scale(1);
              }
              75% {
                transform: scale(1.12);
              }
              85% {
                transform: scale(1);
              }
              100% {
                transform: scale(1);
              }
            }

            /* ============================================
               Professional AI Assistant Button
               Cyan/turquoise cold tone - intelligence semantics
               Desaturated, non-intrusive, tool-like
               ============================================ */

            /* Floating button - circular, minimal */
            .ai-assistant-btn {
              width: 48px;
              height: 48px;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              
              /* Glassmorphism - very subtle */
              background: rgba(6, 182, 212, 0.08);
              backdrop-filter: blur(8px);
              -webkit-backdrop-filter: blur(8px);
              
              border: 1px solid rgba(6, 182, 212, 0.2);
              border-radius: 50%;
              
              /* Subtle depth shadow - not decorative */
              box-shadow: 
                0 4px 12px rgba(0, 0, 0, 0.15),
                0 0 0 1px rgba(6, 182, 212, 0.1) inset;
              
              cursor: pointer;
              transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
              
              /* Prevent text selection */
              user-select: none;
              -webkit-user-select: none;
            }

            /* Icon styling - cyan cold tone */
            .ai-icon {
              color: #06B6D4;
              opacity: 0.9;
              transition: all 150ms;
            }

            /* Beta badge - top-right corner, very discreet */
            .ai-beta-badge {
              position: absolute;
              top: -2px;
              right: -2px;
              width: 16px;
              height: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(6, 182, 212, 0.15);
              border: 1px solid rgba(6, 182, 212, 0.3);
              border-radius: 50%;
              font-size: 9px;
              font-weight: 600;
              color: #06B6D4;
              letter-spacing: -0.5px;
            }

            /* Hover state - subtle glow, clearer icon */
            .ai-assistant-btn:hover {
              background: rgba(6, 182, 212, 0.12);
              border-color: rgba(6, 182, 212, 0.35);
              box-shadow: 
                0 6px 16px rgba(0, 0, 0, 0.2),
                0 0 20px rgba(6, 182, 212, 0.15),
                0 0 0 1px rgba(6, 182, 212, 0.15) inset;
              transform: translateY(-1px);
            }

            .ai-assistant-btn:hover .ai-icon {
              opacity: 1;
              transform: scale(1.05);
            }

            .ai-assistant-btn:hover .ai-beta-badge {
              background: rgba(6, 182, 212, 0.22);
              border-color: rgba(6, 182, 212, 0.45);
            }

            /* Active (press) state */
            .ai-assistant-btn:active {
              transform: translateY(0) scale(0.97);
              box-shadow: 
                0 2px 8px rgba(0, 0, 0, 0.2),
                0 0 0 1px rgba(6, 182, 212, 0.2) inset;
              transition-duration: 60ms;
            }

            /* Focus-visible - keyboard navigation */
            .ai-assistant-btn:focus-visible {
              outline: 2px solid rgba(6, 182, 212, 0.6);
              outline-offset: 3px;
              border-color: rgba(6, 182, 212, 0.5);
            }

            /* ============================================
               AI Assistant Panel (when open)
               ============================================ */

            .ai-assistant-panel {
              background: rgba(4, 12, 19, 0.92);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              border: 1px solid rgba(148, 163, 184, 0.18);
              border-radius: 16px;
              padding: 16px;
              box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.3),
                0 0 0 1px rgba(255, 255, 255, 0.04) inset;
              
              /* Subtle fade-in animation */
              animation: aiPanelFadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1);
            }

            @keyframes aiPanelFadeIn {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            /* AI badge in panel header */
            .ai-badge {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 2px 6px;
              background: rgba(6, 182, 212, 0.15);
              border: 1px solid rgba(6, 182, 212, 0.3);
              border-radius: 4px;
              font-size: 10px;
              font-weight: 700;
              color: #06B6D4;
              letter-spacing: 0.5px;
            }

            /* Close button */
            .ai-close-btn {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 24px;
              height: 24px;
              color: rgba(255, 255, 255, 0.4);
              transition: all 120ms;
              cursor: pointer;
              border-radius: 4px;
            }

            .ai-close-btn:hover {
              color: rgba(255, 255, 255, 0.9);
              background: rgba(255, 255, 255, 0.05);
            }

            .ai-close-btn:active {
              transform: scale(0.95);
            }

            /* Message area */
            .ai-message-area {
              min-height: 120px;
              max-height: 240px;
              overflow-y: auto;
              padding: 12px;
              background: rgba(0, 0, 0, 0.22);
              border: 1px solid rgba(148, 163, 184, 0.18);
              border-radius: 8px;
            }

            /* Custom scrollbar for message area */
            .ai-message-area::-webkit-scrollbar {
              width: 4px;
            }

            .ai-message-area::-webkit-scrollbar-track {
              background: rgba(255, 255, 255, 0.04);
              border-radius: 2px;
            }

            .ai-message-area::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.14);
              border-radius: 2px;
            }

            .ai-message-area::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.22);
            }

            /* Input field */
            .ai-input {
              flex: 1;
              padding: 8px 12px;
              background: rgba(0, 0, 0, 0.28);
              border: 1px solid rgba(148, 163, 184, 0.2);
              border-radius: 8px;
              font-size: 13px;
              color: rgba(255, 255, 255, 0.9);
              transition: all 120ms;
            }

            .ai-input::placeholder {
              color: rgba(255, 255, 255, 0.35);
            }

            .ai-input:focus {
              outline: none;
              border-color: rgba(255, 255, 255, 0.28);
              box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
            }

            /* Send button */
            .ai-send-btn {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 36px;
              height: 36px;
              background: rgba(255, 255, 255, 0.06);
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 8px;
              color: rgba(255, 255, 255, 0.75);
              cursor: pointer;
              transition: all 120ms;
            }

            .ai-send-btn:hover {
              background: rgba(255, 255, 255, 0.1);
              border-color: rgba(255, 255, 255, 0.2);
              box-shadow: 0 0 12px rgba(0, 0, 0, 0.25);
            }

            .ai-send-btn:active {
              transform: scale(0.95);
            }

            /* ============================================
               Responsive adjustments
               ============================================ */

            @media (max-width: 768px) {
              .ai-assistant-btn {
                width: 44px;
                height: 44px;
              }

              .ai-icon {
                width: 18px;
                height: 18px;
              }

              .ai-beta-badge {
                width: 14px;
                height: 14px;
                font-size: 8px;
              }
            }

            /* ============================================
               Accessibility - High contrast mode
               ============================================ */

            @media (prefers-contrast: high) {
              .ai-assistant-btn {
                border-width: 2px;
                border-color: rgba(6, 182, 212, 0.5);
              }

              .ai-badge {
                border-width: 2px;
              }
            }

            /* ============================================
               Reduced motion support
               ============================================ */

            @media (prefers-reduced-motion: reduce) {
              .ai-assistant-btn,
              .ai-icon,
              .ai-close-btn,
              .ai-send-btn,
              .ai-input {
                transition: none;
                animation: none;
              }

              .ai-assistant-panel {
                animation: none;
              }

              .ai-assistant-btn:hover {
                transform: none;
              }

              .ai-assistant-btn:active {
                transform: none;
                opacity: 0.8;
              }
            }
          `}</style>
        </div>,
        assistantContainer
      )}
    </>);

}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getPageTranslations(locale, ["common"]))
    }
  };
}
