"use client";

import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Header from "../components/Header";
import FooterPro from "../components/FooterPro";
import TradingPanel from "../components/TradingPanel";
import SetupPanel from "../components/SetupPanel";
import { useXumm } from "../context/XummContext";
import SEOHead from "../components/SEOHead";
import PriceTicker from "../components/PriceTicker";
import xcannesApi from "../lib/xcannesApi";

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

      <main className="relative w-full min-h-screen text-white pt-36 pb-0 mb-0 bg-cover bg-center bg-no-repeat bg-fixed font-montserrat font-[300] bg-xcannes-background">
        <div className="absolute inset-0 bg-black/0 z-0" />

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <h1 className="text-5xl md:text-6xl font-orbitron font-bold text-center text-white mb-8 tracking-tight">
            {t("dex_title")}
          </h1>

          {/* Graphique pleine largeur */}
          <XrplCandleChartRaw
            key={`${selectedPair}-${interval}`}
            pair={selectedPair}
            interval={interval}
            onPairChange={setSelectedPair}
            onIntervalChange={setInterval}
            availablePairs={pairs}
          />

          {/* Trading Panel unifié */}
          <div className="mt-6">
            <TradingPanel pair={selectedPair} />
          </div>

          {/* Setup Panel unifié (Trustline + Fiat Purchase) */}
          <div className="mt-6">
            <SetupPanel />
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

      <FooterPro />
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
