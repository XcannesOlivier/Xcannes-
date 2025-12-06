import Head from "next/head";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Header from "../components/Header";
import FooterPro from "../components/FooterPro";
import Link from "next/link";
import FAQSection from "../components/FAQSection";
import TokenomicsSimplified from "../components/TokenomicsSimplified";
import TrustlineBlock from "../components/TrustlineBlock";
import BuyXCSSection from "../components/BuyXCSSection";
import SEOHead from "../components/SEOHead";
import PriceTicker from "../components/PriceTicker";
import WhyXcannesSection from "../components/WhyXcannesSection";
import XummSecuritySection from "../components/XummSecuritySection";
import RoadmapDistributionSection from "../components/RoadmapDistributionSection";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import xcannesApi from "../lib/xcannesApi";

export default function Home() {
  const { t } = useTranslation("common");
  
  // 📊 Charger toutes les paires dynamiquement depuis l'API
  const [availablePairs, setAvailablePairs] = useState([
    "XRP/RLUSD", "XCS/XRP", "XCS/RLUSD" // Fallback - 3 paires configurées
  ]);
  const [loadingPairs, setLoadingPairs] = useState(true);

  // container DOM pour portal (sert à fixer la bulle en dehors de tout conteneur transformé)
  const [assistantContainer, setAssistantContainer] = useState(null);
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
          console.log(`✅ [Index] ${pairsList.length} paires chargées:`, pairsList);
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
  const pairs = useMemo(() => availablePairs, [availablePairs]);

  return (
    <>
      <SEOHead
        title="XCannes - Digital Asset Exchange on XRP Ledger"
        description="Trade XCS tokens instantly. Fast, secure, transparent blockchain exchange built on XRPL technology."
        canonical="/"
      />

      <Header />

      <PriceTicker pairs={pairs} fixed={true} />

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
          {/* Badge Corporate - subtle pulse */}
          <div className="inline-flex items-center gap-2 bg-black/30 backdrop-blur-sm border border-white/10 rounded-full px-6 py-3 mb-8">
            <span className="w-2 h-2 bg-xcannes-green rounded-full animate-pulse-slow" />
            <span className="text-sm text-white/90 font-medium tracking-wide">
              XRPL
            </span>
          </div>

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

          {/* CTA Buttons - Elegant hover */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            {/* CTA Primary - gradient hover */}
            <Link href="/dex">
              <button className="group relative px-10 py-4 bg-xcannes-green hover:bg-xcannes-green/90 text-white font-semibold text-base rounded-lg transition-all duration-300 hover:-translate-y-0.5">
                {t("hero_cta_primary")}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
              </button>
            </Link>
            
            {/* CTA Secondary - border glow */}
            <Link href="/dex">
              <button className="group px-10 py-4 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-xcannes-green/50 text-white font-medium text-base rounded-lg transition-all duration-300">
                {t("hero_cta_secondary")}
                <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
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

      {/* Bulle Assistant fixe en bas à droite (render via portal pour être indépendante des conteneurs) */}
      {assistantContainer && createPortal(
        <div style={{ position: 'fixed', right: '1.5rem', bottom: '1.5rem', zIndex: 9999 }}>
          <button
            type="button"
            onClick={() => {
              alert('Assistant IA - À venir');
            }}
            className="w-14 h-14 md:w-16 md:h-16 transition-all bg-gradient-to-br from-[#6366f1] to-[#4f46e5] text-white hover:from-[#5b5dd8] hover:to-[#4338ca] border-2 border-[#6366f1]/50 rounded-full flex items-center justify-center relative overflow-hidden shadow-2xl shadow-[#6366f1]/30"
            aria-label="Assistant IA"
            title="Assistant IA"
          >
            <span className="tracking-wider relative z-10 inline-block text-xl md:text-2xl" style={{ animation: 'irregularPulse 3s ease-in-out infinite' }}>•••</span>
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" 
                  style={{ animation: 'shimmer 2s ease-in-out infinite' }}></span>
          </button>
          <style jsx global>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%) rotate(0deg); }
              100% { transform: translateX(100%) rotate(360deg); }
            }
            @keyframes irregularPulse {
              0% { transform: scale(1); }
              15% { transform: scale(1.15); }
              25% { transform: scale(1); }
              40% { transform: scale(1.08); }
              50% { transform: scale(1); }
              75% { transform: scale(1.12); }
              85% { transform: scale(1); }
              100% { transform: scale(1); }
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
