import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Header from "@/components/layout/Header";
import FooterPro from "@/components/layout/FooterPro";
import Link from "next/link";
import SEOHead from "@/components/layout/SEOHead";
import PriceTicker from "@/components/marketGlobal/PriceTicker";
import WhyXcannesSection from "@/components/home/WhyXcannesSection";
import XummSecuritySection from "@/components/home/XummSecuritySection";
import HomeUseCasesSection from "@/components/home/HomeUseCasesSection";
import HomeHowItWorksSection from "@/components/home/HomeHowItWorksSection";
import HomeLocalPaymentSection from "@/components/home/HomeLocalPaymentSection";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
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
    const fetchPairs = async () => {
      try {
        const markets = await xcannesApi.getAllMarkets();
        if (markets) {
          // Priorité: trading (XRPL) > pyth (FOREX)
          const allPairs = [
            ...(markets.trading || []),  // Paires XRPL
            ...(markets.pyth || [])       // Paires Pyth
          ];
          
          const pairsList = Array.from(new Set(
            allPairs
              .filter(m => m.active !== false)
              .map(m => `${m.base}/${m.quote}`)
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
      availablePairs
        .filter((p) => !p.startsWith("XCS/"))
        .slice(0, 10),
    [availablePairs]
  );

  return (
    <>
      <SEOHead
        title="XCANNES - USD-backed multi-currency wallet on XRPL"
        description="A non-custodial multi-currency wallet backed by USD stability on XRPL (via a regulated USD stablecoin). Send, pay, receive, and convert with real-time market data."
        canonical="/"
      />

      <Header />

      <PriceTicker
        pairs={pairs}
        fixed={true}
        backgroundClass="bg-black/20 border-b border-white/10"
      />

      <div className="pt-24 bg-xcannes-background">

        {/* HERO (more “private bank” tone) */}
        <main className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.05),transparent_45%)]" />

          <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 md:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-5">
                {t("hero_badge")}
              </p>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-montserrat font-semibold text-white leading-tight tracking-tight">
                {t("hero_title")}{" "}
                <span className="text-xcannes-green">{t("hero_title_gradient")}</span>
              </h1>

              <div className="mt-6 space-y-2">
                <p className="text-lg sm:text-xl text-white/80 font-light leading-relaxed">
                  {t("hero_description_line1")}
                </p>
                <p className="text-base sm:text-lg text-white/65 font-light leading-relaxed">
                  {t("hero_description_line2")}
                </p>
                <p className="text-base sm:text-lg text-white/55 font-light leading-relaxed">
                  {t("hero_description_line3")}
                </p>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Link href="/wallet">
                  <button className={bankButtonClassName({ tone: "blue", variant: "soft", size: "lg" })}>
                    {t("hero_cta_primary")}
                  </button>
                </Link>
                <Link href="/dex">
                  <button className={bankButtonClassName({ tone: "green", variant: "soft", size: "lg" })}>
                    {t("hero_cta_secondary")}
                    <span className="inline-block ml-2 text-xs">→</span>
                  </button>
                </Link>
              </div>

              {/* Trust strip */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    title: t("home_trust_1_title", "Non-custodial"),
                    desc: t("home_trust_1_desc", "Vous gardez le contrôle de vos clés."),
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-xcannes-green">
                        <path d="M12 11V7a4 4 0 0 0-8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 11h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                  {
                    title: t("home_trust_2_title", "Stabilité USD"),
                    desc: t("home_trust_2_desc", "Valeur adossée au dollar via stablecoin régulé."),
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-xcannes-green">
                        <path d="M12 1v22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                  {
                    title: t("home_trust_3_title", "Validation Xumm"),
                    desc: t("home_trust_3_desc", "Biométrie et signature explicite."),
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-xcannes-green">
                        <path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 bg-black/20 border border-white/10 rounded-xl px-4 py-4"
                  >
                    <div className="mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg bg-xcannes-green/10 border border-xcannes-green/20">
                      {item.icon}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="text-sm font-semibold text-white/90">{item.title}</div>
                      <div className="text-xs text-white/55 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Minimal metrics row */}
              <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    value: t("stat_spread_value"),
                    label: t("stat_spread_label"),
                    description: t("stat_spread_desc"),
                  },
                  {
                    value: t("stat_price_value"),
                    label: t("stat_price_label"),
                    description: t("stat_price_desc"),
                  },
                  {
                    value: t("stat_speed_value"),
                    label: t("stat_speed_label"),
                    description: t("stat_speed_desc"),
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-black/20 border border-white/10 rounded-xl px-5 py-4"
                  >
                    <div className="text-sm text-white/70">{stat.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-white">{stat.value}</div>
                    <div className="mt-1 text-xs text-white/50">{stat.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* CONTENT SECTIONS */}
      <div className="bg-xcannes-background">
        <HomeLocalPaymentSection availablePairs={availablePairs} />
        <HomeUseCasesSection />
        <HomeHowItWorksSection />
        <WalletProductSection />
        <WhyXcannesSection />
        <XummSecuritySection />
      </div>

      <FooterPro />

      {/* Support - Bottom right floating button */}
      {assistantContainer && createPortal(
        <div className="fixed right-3 bottom-3 md:right-6 md:bottom-6 z-[9999]">
          {assistantOpen && (
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
                  aria-label={t("home_support_close", "Fermer")}
                >
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
                  placeholder={t("home_support_placeholder", "Écrivez votre question…")}
                  className="ai-input"
                />
                <button
                  type="button"
                  className="ai-send-btn"
                  aria-label={t("home_support_send", "Envoyer")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          )}
          {!assistantOpen && (
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="w-10 h-10 md:w-12 md:h-12 transition-all bg-transparent text-white hover:bg-white/10 border-2 border-white/30 rounded-full flex items-center justify-center relative overflow-hidden"
              aria-label={t("home_support_open", "Ouvrir le support")}
              title={t("home_support_open", "Ouvrir le support")}
            >
              <span
                className="tracking-wider relative z-10 inline-block text-lg md:text-xl"
                style={{ animation: "irregularPulse 3s ease-in-out infinite" }}
              >
                •••
              </span>
              <span
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                style={{ animation: "shimmer 2s ease-in-out infinite" }}
              ></span>
            </button>
          )}
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
    </>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  };
}
