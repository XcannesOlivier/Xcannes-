import Head from "next/head";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Header from "../components/componentsGlobal/Header";
import FooterPro from "../components/componentsGlobal/FooterPro";
import Link from "next/link";
import FAQSection from "../components/home/FAQSection";
import TokenomicsSimplified from "../components/home/TokenomicsSimplified";
import TrustlineBlock from "../components/home/TrustlineBlock";
import BuyXCSSection from "../components/home/BuyXCSSection";
import SEOHead from "../components/componentsGlobal/SEOHead";
import PriceTicker from "../components/marketGlobal/PriceTicker";
import WhyXcannesSection from "../components/home/WhyXcannesSection";
import XummSecuritySection from "../components/home/XummSecuritySection";
import RoadmapDistributionSection from "../components/home/RoadmapDistributionSection";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import xcannesApi from "../lib/xcannesApi";

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
        title="XCannes - Digital Asset Exchange on XRP Ledger"
        description="Trade XCS tokens instantly. Fast, secure, transparent blockchain exchange built on XRPL technology."
        canonical="/"
      />

      <Header />

      <PriceTicker
        pairs={pairs}
        fixed={true}
        backgroundClass="bg-xcannes-background"
      />

      {/* HERO SECTION CORPORATE ELEGANT */}
      <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-xcannes-background pt-16">
        {/* Grid pattern overlay - subtle */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(52, 211, 153, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(52, 211, 153, 0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-32 text-center">
          {/* Main heading - Elegant typography */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-sans font-bold text-white mb-8 leading-tight tracking-tight">
            {t("hero_title")}
            <span className="block mt-3 bg-gradient-to-r from-white/95 via-white/60 via-xcannes-green/70 to-xcannes-green bg-clip-text text-transparent">
              {t("hero_title_gradient")}
            </span>
          </h1>

          {/* Subheading - 3 lignes corporate */}
          <div className="max-w-3xl mx-auto mb-14 space-y-2">
            <p className="text-xl text-white/90 font-light leading-relaxed">
              {t("hero_description_line1")}
            </p>
            <p className="text-xl text-white/85 font-light leading-relaxed">
              {t("hero_description_line2")}
            </p>
            <p className="text-xl text-white/75 font-light leading-relaxed">
              {t("hero_description_line3")}
            </p>
          </div>

          {/* CTA Buttons - harmonisés */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            <Link href="/dex">
              <button className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-xcannes-green hover:bg-xcannes-green/90 text-white font-semibold text-sm tracking-wide transition-all duration-200 hover:-translate-y-0.5">
                {t("hero_cta_primary")}
              </button>
            </Link>
            <Link href="/dex">
              <button className="inline-flex items-center justify-center px-8 py-3 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white font-medium text-sm tracking-wide transition-all duration-200">
                {t("hero_cta_secondary")}
                <span className="inline-block ml-2 text-xs">→</span>
              </button>
            </Link>
          </div>

          {/* Stats - Corporate elegant avec depth */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { 
                value: t("stat_spread_value"), 
                label: t("stat_spread_label"),
                description: t("stat_spread_desc")
              },
              { 
                value: t("stat_price_value"), 
                label: t("stat_price_label"),
                description: t("stat_price_desc")
              },
              { 
                value: t("stat_speed_value"), 
                label: t("stat_speed_label"),
                description: t("stat_speed_desc")
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="group relative bg-xcannes-background backdrop-blur-md border border-white/10 rounded-xl p-8 hover:border-xcannes-green/50 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-xcannes-green/0 group-hover:bg-xcannes-green/5 rounded-xl transition-all duration-300" />
                
                <div className="relative">
                  <div className="text-5xl font-sans font-bold text-xcannes-green mb-3">
                    {stat.value}
                  </div>
                  <div className="text-base text-white font-semibold mb-1">
                    {stat.label}
                  </div>
                  <div className="text-sm text-white/60">
                    {stat.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

       
      </main>

      {/* CONTENT SECTIONS */}
      <div className="bg-xcannes-background">
        <WhyXcannesSection />
        <XummSecuritySection />
        <TokenomicsSimplified />
        <RoadmapDistributionSection />
        <BuyXCSSection />
        <FAQSection />
      </div>

      <FooterPro />

      {/* Professional AI Assistant - Bottom right floating button */}
      {assistantContainer && createPortal(
        <div className="fixed right-3 bottom-3 md:right-6 md:bottom-6 z-[9999]">
          {assistantOpen && (
            <div className="ai-assistant-panel mb-3 w-[96vw] max-w-none md:max-w-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="ai-badge">AI</div>
                  <p className="text-sm font-semibold text-white/90">
                    XCANNES Assistant
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssistantOpen(false)}
                  className="ai-close-btn"
                  aria-label="Close assistant"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="ai-message-area">
                <p className="text-sm font-medium text-slate-800 mb-2">
                  Hello, I&apos;m the XCANNES assistant.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ask questions about DEX operations, XRPL pairs, Pyth feeds, or EOD markets.
                  I&apos;ll guide you step by step.
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask a question..."
                  className="ai-input"
                />
                <button
                  type="button"
                  className="ai-send-btn"
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
              aria-label="Assistant IA"
              title="Assistant IA"
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
              background: rgba(15, 23, 42, 0.95);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              border: 1px solid rgba(6, 182, 212, 0.2);
              border-radius: 16px;
              padding: 16px;
              box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.3),
                0 0 0 1px rgba(6, 182, 212, 0.1) inset;
              
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
              background: rgba(241, 245, 249, 0.95);
              border: 1px solid rgba(6, 182, 212, 0.1);
              border-radius: 8px;
            }

            /* Custom scrollbar for message area */
            .ai-message-area::-webkit-scrollbar {
              width: 4px;
            }

            .ai-message-area::-webkit-scrollbar-track {
              background: rgba(0, 0, 0, 0.05);
              border-radius: 2px;
            }

            .ai-message-area::-webkit-scrollbar-thumb {
              background: rgba(6, 182, 212, 0.3);
              border-radius: 2px;
            }

            .ai-message-area::-webkit-scrollbar-thumb:hover {
              background: rgba(6, 182, 212, 0.5);
            }

            /* Input field */
            .ai-input {
              flex: 1;
              padding: 8px 12px;
              background: rgba(241, 245, 249, 0.95);
              border: 1px solid rgba(6, 182, 212, 0.15);
              border-radius: 8px;
              font-size: 13px;
              color: #1e293b;
              transition: all 120ms;
            }

            .ai-input::placeholder {
              color: rgba(30, 41, 59, 0.4);
            }

            .ai-input:focus {
              outline: none;
              border-color: rgba(6, 182, 212, 0.4);
              box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.08);
            }

            /* Send button */
            .ai-send-btn {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 36px;
              height: 36px;
              background: rgba(6, 182, 212, 0.12);
              border: 1px solid rgba(6, 182, 212, 0.25);
              border-radius: 8px;
              color: #06B6D4;
              cursor: pointer;
              transition: all 120ms;
            }

            .ai-send-btn:hover {
              background: rgba(6, 182, 212, 0.18);
              border-color: rgba(6, 182, 212, 0.4);
              box-shadow: 0 0 12px rgba(6, 182, 212, 0.15);
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
