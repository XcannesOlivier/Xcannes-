"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import Header from "@/components/layout/Header";
import DexSidebar from "@/components/dex/layout/DexSidebar";
import { useXumm } from "@/context/XummContext";
import SEOHead from "@/components/layout/SEOHead";
import PriceTicker from "@/components/marketGlobal/PriceTicker";
import xcannesApi from "@/lib/xcannesApi";
import TradingLayoutV1A from "@/components/dex/layout/TradingLayoutV1A";
import FooterPro from "@/components/layout/FooterPro";
import SupportAssistantWidget from "@/components/layout/SupportAssistantWidget";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
// 📈 Chart dynamique sans SSR
const XrplCandleChartRaw = dynamic(
  () => import("@/components/dex/XrplCandleChart").then((mod) => mod.default),
  {
    ssr: false,
    loading: () =>
    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-white/60 text-sm">
              {typeof window !== "undefined" &&
            window.__NEXT_DATA__?.props?.pageProps?._nextI18Next?.
            initialI18nStore?.[
            window.__NEXT_DATA__?.props?.pageProps?._nextI18Next?.
            initialLocale]?.
            common?.dex_chart_loading ||
            "Loading chart..."}
            </p>
          </div>
        </div>
      </div>

  }
);

const ENABLE_NEW_TRADING_LAYOUT_V1A =
process.env.NEXT_PUBLIC_NEW_TRADING_LAYOUT_V1A !== "false";

export default function Dex() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const isDex = router.pathname === "/dex";

  const [selectedPair, setSelectedPair] = useState("XRP/RLUSD");
  const [interval, setInterval] = useState("1m");
  const [availablePairs, setAvailablePairs] = useState(["XRP/RLUSD"]); // Défaut
  const [loadingPairs, setLoadingPairs] = useState(true);
  const { wallet, isConnected } = useXumm();
  const [ordersOpen, setOrdersOpen] = useState(true);

  // Charger les paires depuis l'API au montage
  useEffect(() => {
    const fetchPairs = async () => {
      try {
        const markets = await xcannesApi.getAllMarkets(); // ✅ Utiliser getAllMarkets() pour inclure Pyth
        if (markets) {
          // Priorité: trading (XRPL) > pyth (FOREX)
          const allPairs = [
          ...(markets.trading || []), // Paires XRPL (XRP/RLUSD, XCS/XRP, XCS/RLUSD)
          ...(markets.pyth || []) // Paires Pyth (FOREX + métaux)
          ];

          // Filtrer les paires actives, dédupliquer, et convertir format backend (XCS_XRP) vers frontend (XCS/XRP)
          let pairsList = Array.from(
            new Set(
              allPairs.
              filter((m) => m.active !== false).
              map((m) => `${m.base}/${m.quote}`)
            )
          );

          // Retirer explicitement la paire XCS/XRP de l'interface trading
          pairsList = pairsList.filter((p) => p !== "XCS/XRP");

          setAvailablePairs(pairsList);

          if (DEBUG_LOGS) {
            console.log(`✅ ${pairsList.length} paires chargées:`, pairsList);
          }
        }
      } catch (error) {
        console.error("Erreur chargement paires:", error);
        // Garder uniquement les paires configurées en fallback (sans XCS/XRP)
        setAvailablePairs(["XRP/RLUSD", "XCS/RLUSD"]);
      } finally {
        setLoadingPairs(false);
      }
    };

    fetchPairs();
  }, []);

  // Mémoriser les paires pour éviter les re-renders
  // Limiter aux 10 paires les plus utilisées, exclure XCS et la paire actuellement sélectionnée du PriceTicker
  const tickerPairs = useMemo(
    () =>
    availablePairs.
    filter((p) => !p.startsWith("XCS/")).
    slice(0, 10),
    [availablePairs]
  );

  return (
    <>
      <SEOHead
        title={t("dex_seo_title")}
        description={t("dex_seo_description")}
        canonical="/dex" />


      {/* Header desktop uniquement */}
      <div className="hidden md:block">
        <Header />
      </div>

      {/* PriceTicker desktop uniquement */}
      <div className="hidden md:block">
        <PriceTicker
          pairs={tickerPairs}
          fixed={true}
          backgroundClass="bg-elevated" />

      </div>

      {/* Conteneur principal pleine hauteur */}
      <main className="relative w-full min-h-screen text-primary pt-0 md:pt-32 pb-10 md:pb-0 mb-0 font-montserrat font-[300] bg-elevated">
        <div className="w-full relative z-10">
          {ENABLE_NEW_TRADING_LAYOUT_V1A ?
          <TradingLayoutV1A
            pair={selectedPair}
            interval={interval}
            onPairChange={setSelectedPair}
            onIntervalChange={setInterval}
            availablePairs={availablePairs}
            ChartComponent={XrplCandleChartRaw} /> :


          <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6">
              <div
              className="
                  grid gap-4
                  grid-cols-1
                  xl:grid-cols-[64%_36%]
                  items-start
                ">













                {/* Chart principal */}
                <section
                className="
                    order-1
                  ">









                  <div className="flex flex-col min-h-[50vh] xl:min-h-[65vh] 2xl:h-[calc(100vh-8rem)] max-sm:-mx-3">
                    <XrplCandleChartRaw
                    pair={selectedPair}
                    interval={interval}
                    onPairChange={setSelectedPair}
                    onIntervalChange={setInterval}
                    availablePairs={pairs} />

                  </div>
                </section>

                {/* Wallet / Trading sidebar */}
                <section
                className="
                    order-2
                  ">









                  <div className="mt-3 xl:mt-0">
                    <div className="xl:sticky xl:top-32 xl:h-[calc(100vh-8rem)] panel-surface overflow-hidden">
                      <div className="h-full overflow-y-auto">
                        <DexSidebar pair={selectedPair} />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          }
        </div>

        {/* Slogan section */}
        <section className="relative py-14 sm:py-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-montserrat font-[300] text-white/90 tracking-[0.02em]">
              {t("home_v2_demo_slogan", "Votre argent. Partout. Intact.")}
            </h3>
          </div>
        </section>

        {/* Footer global pro */}
        <FooterPro />
      </main>

      <SupportAssistantWidget mode="trading" />
    </>);

}


export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getPageTranslations(locale, ["common"]))
    }
  };
}
