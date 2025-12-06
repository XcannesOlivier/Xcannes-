"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Header from "../components/Header";
import DexSidebar from "../components/DexSidebar";
import { useXumm } from "../context/XummContext";
import SEOHead from "../components/SEOHead";
import PriceTicker from "../components/PriceTicker";
import xcannesApi from "../lib/xcannesApi";
import OrderbookSidebar from "../components/OrderbookSidebar";

// 📈 Chart dynamique sans SSR
const XrplCandleChartRaw = dynamic(
  () => import("../components/XrplCandleChartRaw").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-white/60 text-sm">
              {(typeof window !== "undefined" &&
                window.__NEXT_DATA__?.props?.pageProps?._nextI18Next
                  ?.initialI18nStore?.[
                  window.__NEXT_DATA__?.props?.pageProps?._nextI18Next
                    ?.initialLocale
                ]?.common?.dex_chart_loading) ||
                "Loading chart..."}
            </p>
          </div>
        </div>
      </div>
    ),
  }
);

export default function Dex() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const isDex = router.pathname === "/dex";

  const [selectedPair, setSelectedPair] = useState("XRP/RLUSD");
  const [interval, setInterval] = useState("1d");
  const [availablePairs, setAvailablePairs] = useState(["XRP/RLUSD"]); // Défaut
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [mobileOrderbookOpen, setMobileOrderbookOpen] = useState(false);
  const [mobileTradingOpen, setMobileTradingOpen] = useState(false);
  const { wallet, isConnected } = useXumm();
  const tradingScrollPosRef = useRef(0);
  const tradingScrollTimeRef = useRef(0);
  const orderbookScrollPosRef = useRef(0);
  const orderbookScrollTimeRef = useRef(0);

  // Charger les paires depuis l'API au montage
  useEffect(() => {
    const fetchPairs = async () => {
      try {
        const markets = await xcannesApi.getAllMarkets(); // ✅ Utiliser getAllMarkets() pour inclure Pyth
        if (markets) {
          // Priorité: trading (XRPL) > pyth (FOREX)
          const allPairs = [
            ...(markets.trading || []),  // Paires XRPL (XRP/RLUSD, XCS/XRP, XCS/RLUSD)
            ...(markets.pyth || [])       // Paires Pyth (FOREX + métaux)
          ];
          
          // Filtrer les paires actives, dédupliquer, et convertir format backend (XCS_XRP) vers frontend (XCS/XRP)
          const pairsList = Array.from(new Set(
            allPairs
              .filter(m => m.active !== false)
              .map(m => `${m.base}/${m.quote}`)
          ));
          
          setAvailablePairs(pairsList);
          
          console.log(`✅ ${pairsList.length} paires chargées:`, pairsList);
        }
      } catch (error) {
        console.error("Erreur chargement paires:", error);
        // Garder uniquement les 3 paires configurées en fallback
        setAvailablePairs(["XRP/RLUSD", "XCS/XRP", "XCS/RLUSD"]);
      } finally {
        setLoadingPairs(false);
      }
    };
    
    fetchPairs();
  }, []);

  // 🎯 Top 10 paires les plus importantes pour le PriceTicker (sans XCS pour l'instant)
  const topPairs = useMemo(() => {
    const importantPairs = [
      "XRP/RLUSD",    // XRPL principale
      "EUR/USD",      // Forex majeure
      "GBP/USD",      // Forex majeure
      "USD/JPY",      // Forex majeure
      "USD/CHF",      // Forex majeure
      "AUD/USD",      // Forex majeure
      "BTC/USD",      // Crypto majeure
      "ETH/USD",      // Crypto majeure
      "XAU/USD",      // Or
      "XAG/USD",      // Argent
    ];
    
    // Filtrer seulement les paires disponibles dans availablePairs
    return importantPairs.filter(pair => availablePairs.includes(pair));
  }, [availablePairs]);

  // Désactiver le scroll sur mobile (iPhone)
  useEffect(() => {
    // Détecter si on est sur mobile
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
      // Fixer le body pour empêcher le scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      // Empêcher le bounce iOS
      document.body.style.overscrollBehavior = 'none';
      
      return () => {
        // Réactiver le scroll au démontage
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.overscrollBehavior = '';
      };
    }
  }, []);
  
  // Mémoriser les paires pour éviter les re-renders
  const pairs = useMemo(() => availablePairs, [availablePairs]);

  return (
    <>
      <SEOHead
        title={t("dex_seo_title")}
        description={t("dex_seo_description")}
        canonical="/dex"
      />

      {/* Header desktop uniquement */}
      <div className="hidden md:block">
        <Header />
      </div>

      {/* PriceTicker desktop uniquement */}
      <div className="hidden md:block">
        <PriceTicker pairs={topPairs} fixed={true} />
      </div>

      {/* Conteneur principal pleine hauteur */}
      <main className="relative w-full min-h-screen text-white pt-0 md:pt-32 pb-36 md:pb-0 mb-0 bg-cover bg-center bg-no-repeat bg-fixed font-montserrat font-[300] bg-xcannes-background">
        <div className="absolute inset-0 bg-black/0 z-0" />

        <div className="w-full relative z-10">
          {/* Layout principal: sidebar gauche (orderbook) + chart centre + sidebar droite (trading) */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(300px,360px)] gap-0 items-start">
            {/* Sidebar Orderbook + Trades (gauche) */}
            <div className="hidden md:block">
              <div className="sticky top-32 h-[calc(100vh-8rem)]">
                <OrderbookSidebar pair={selectedPair} />
              </div>
            </div>

            {/* Chart au centre */}
            <div className="flex flex-col md:h-[calc(100vh-8rem)] pb-0 md:pb-0">
              <XrplCandleChartRaw
                pair={selectedPair}
                interval={interval}
                onPairChange={setSelectedPair}
                onIntervalChange={setInterval}
                availablePairs={pairs}
              />
            </div>

            {/* Sidebar Trading + Setup (droite) */}
            <div className="hidden md:block">
              <div className="sticky top-32 h-[calc(100vh-8rem)]">
                <div className="h-full overflow-y-auto">
                  <DexSidebar pair={selectedPair} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile bottom nav: Orderbook / Trading */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between gap-2 px-0 py-2 bg-black/85 border-t border-white/10 backdrop-blur-md w-full">
            <button
              type="button"
              onClick={() => {
                // TODO: Ouvrir l'assistant IA
                alert('Assistant IA - À venir');
              }}
              className="flex-[0.5] text-lg font-bold py-0.5 px-1 transition-all bg-gradient-to-br from-[#6366f1] to-[#4f46e5] text-white hover:from-[#5b5dd8] hover:to-[#4338ca] border border-[#6366f1]/50 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-lg shadow-[#6366f1]/20"
              aria-label="Assistant IA"
            >
              <span className="tracking-wider relative z-10 inline-block" style={{ animation: 'irregularPulse 3s ease-in-out infinite' }}>•••</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" 
                    style={{ transform: 'translateX(-100%)', animation: 'shimmer 2s ease-in-out infinite' }}></span>
              <style jsx>{`
                @keyframes shimmer {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(100%); }
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
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOrderbookOpen(true);
                setMobileTradingOpen(false);
              }}
              className={`flex-[0.6] text-sm font-medium py-1.5 transition-all border rounded-md ${
                mobileOrderbookOpen
                  ? "bg-xcannes-green text-black border-xcannes-green"
                  : "bg-white/5 text-white/70 border-white/20"
              }`}
            >
              Order Book
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileTradingOpen(true);
                setMobileOrderbookOpen(false);
              }}
              className={`flex-[0.8] text-lg font-semibold py-0.5 px-0 transition-all border rounded-md tracking-wide ${
                mobileTradingOpen
                  ? "bg-[#3052ef] text-white border-[#3052ef]"
                  : "bg-white/5 text-[#3052ef] border-[#3052ef]/60"
              }`}
            >
              Wallet
            </button>
            <button
              type="button"
              onClick={() => {
                // TODO: Ouvrir la page d'achat XCS
                window.open('https://xcannes.com', '_blank');
              }}
              className="px-6 py-1 bg-xcannes-green hover:bg-xcannes-green/80 text-white rounded-full flex items-center justify-center transition-all font-bold text-base shrink-0"
              aria-label="Acheter XCS"
            >
              Buy
            </button>
        </div>

        {/* Mobile Orderbook bottom sheet */}
        <div className="fixed inset-0 z-50 md:hidden pointer-events-none">
          {/* Overlay */}
          <div
            className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
              mobileOrderbookOpen ? "opacity-100 pointer-events-auto" : "opacity-0"
            }`}
            onClick={() => setMobileOrderbookOpen(false)}
          />
          {/* Panel */}
          <div
            className={`absolute inset-x-0 bottom-0 transform transition-transform duration-300 ${
              mobileOrderbookOpen ? "translate-y-0" : "translate-y-full"
            } pointer-events-auto`}
          >
            <div className="h-[100dvh] bg-black/95 border-t border-white/20 rounded-t-2xl overflow-hidden flex flex-col">
              {/* Header avec titre et bouton fermer */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
                <div className="flex flex-col">
                  <h3 className="text-white font-normal text-lg">Market</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOrderbookOpen(false)}
                  className="text-white/60 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all"
                  aria-label="Fermer le panneau orderbook"
                >
                  ✕
                </button>
              </div>
              {/* Contenu scrollable */}
              <div className="flex-1 overflow-y-auto p-2">
                <OrderbookSidebar pair={selectedPair} />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Trading bottom sheet */}
        <div className="fixed inset-0 z-50 md:hidden pointer-events-none">
          {/* Overlay */}
          <div
            className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
              mobileTradingOpen ? "opacity-100 pointer-events-auto" : "opacity-0"
            }`}
            onClick={() => setMobileTradingOpen(false)}
          />
          {/* Panel */}
          <div
            className={`absolute inset-x-0 bottom-0 transform transition-transform duration-300 ${
              mobileTradingOpen ? "translate-y-0" : "translate-y-full"
            } pointer-events-auto`}
          >
            <div className="h-[100dvh] bg-black/95 border-t border-white/20 rounded-t-2xl overflow-hidden flex flex-col">
              {/* Header avec titre et bouton fermer */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
                <h3 className="text-white font-medium text-base">XCANNES-Wallet</h3>
                <button
                  type="button"
                  onClick={() => setMobileTradingOpen(false)}
                  className="text-white/60 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all"
                  aria-label="Fermer le panneau trading"
                >
                  ✕
                </button>
              </div>
              {/* Contenu scrollable */}
              <div className="flex-1 overflow-y-auto p-2">
                <DexSidebar pair={selectedPair} />
              </div>
            </div>
          </div>
        </div>
      </div>
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
