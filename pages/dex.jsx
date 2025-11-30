"use client";

import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
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
  
  // Charger les paires depuis l'API au montage
  useEffect(() => {
    const fetchPairs = async () => {
      try {
        const markets = await xcannesApi.getAllMarkets(); // ✅ Utiliser getAllMarkets() pour inclure Pyth
        if (markets) {
          // Priorité: display > pyth (pour éviter doublons entre display et trading)
          const allPairs = [
            ...(markets.display || []),  // Paires principales avec métadonnées
            ...(markets.pyth || [])       // Paires Pyth (FOREX)
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
  
  // Mémoriser les paires pour éviter les re-renders
  const pairs = useMemo(() => availablePairs, [availablePairs]);

  return (
    <>
      <SEOHead
        title={t("dex_seo_title")}
        description={t("dex_seo_description")}
        canonical="/dex"
      />

      <Header />

      <PriceTicker pairs={pairs} fixed={true} />

      <main className="relative w-full min-h-screen text-white pt-32 pb-0 mb-0 bg-cover bg-center bg-no-repeat bg-fixed font-montserrat font-[300] bg-xcannes-background">
        <div className="absolute inset-0 bg-black/0 z-0" />

        <div className="w-full relative z-10">
          {/* Layout principal: sidebar gauche (orderbook) + chart centre + sidebar droite (trading) */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(300px,360px)] gap-2 items-start">
            {/* Sidebar Orderbook + Trades (gauche) */}
            <div className="hidden md:block">
              <div className="sticky top-32 h-[calc(100vh-8rem)]">
                <OrderbookSidebar pair={selectedPair} />
              </div>
            </div>

            {/* Chart au centre */}
            <div className="flex flex-col justify-end min-h-[calc(100vh-8rem)]">
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

          {isConnected && (
            <div className="my-12 text-center">
              <p className="text-xs text-green-400 break-all">
                {t("dex_wallet_connected")} {wallet}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Mobile bottom nav: Orderbook / Trading */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden pointer-events-none">
        <div className="flex justify-center mb-3">
          <div className="pointer-events-auto flex items-center justify-between gap-2 px-4 py-2 rounded-full bg-black/80 border border-white/10 backdrop-blur-md w-[90%] max-w-md">
            <button
              type="button"
              onClick={() => {
                setMobileOrderbookOpen(true);
                setMobileTradingOpen(false);
              }}
              className={`flex-1 text-xs font-medium py-1.5 rounded-full transition-all ${
                mobileOrderbookOpen
                  ? "bg-xcannes-green text-black"
                  : "bg-white/5 text-white/70"
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
              className={`flex-1 text-xs font-medium py-1.5 rounded-full transition-all ${
                mobileTradingOpen
                  ? "bg-xcannes-green text-black"
                  : "bg-white/5 text-white/70"
              }`}
            >
              Trading
            </button>
          </div>
        </div>

        {/* Mobile Orderbook bottom sheet */}
        <div className="fixed inset-0 z-40 md:hidden pointer-events-none">
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
            <div className="h-[75vh] bg-black/95 border-t border-white/20 rounded-t-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-white/80">
                  Order Book
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOrderbookOpen(false)}
                  className="text-white/60 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="h-full overflow-y-auto p-2">
                <OrderbookSidebar pair={selectedPair} />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Trading bottom sheet */}
        <div className="fixed inset-0 z-40 md:hidden pointer-events-none">
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
            <div className="h-[75vh] bg-black/95 border-t border-white/20 rounded-t-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-white/80">
                  Trading
                </span>
                <button
                  type="button"
                  onClick={() => setMobileTradingOpen(false)}
                  className="text-white/60 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="h-full overflow-y-auto p-2">
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
