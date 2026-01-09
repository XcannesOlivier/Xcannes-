"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import Header from "@/components/layout/Header";
import DexSidebar from "@/components/dex/layout/DexSidebar";
import { useXumm } from "@/context/XummContext";
import SEOHead from "@/components/layout/SEOHead";
import PriceTicker from "@/components/marketGlobal/PriceTicker";
import xcannesApi from "@/lib/xcannesApi";
import OrderbookSidebar from "@/components/dex/panels/OrderbookSidebar";
import TradingLayoutV1A from "@/components/dex/layout/TradingLayoutV1A";
import ExchangeSection from "@/components/dex/ExchangeSections/ExchangeSection";
import FooterPro from "@/components/layout/FooterPro";
import { getPairCategory } from "@/utils/marketStructure";

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

  // container DOM pour la bulle assistant IA (comme sur la home)
  const [assistantContainer, setAssistantContainer] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "assistant-root-dex";
    document.body.appendChild(el);
    setAssistantContainer(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);

  // Détecter le scroll pour ajuster la position du bouton sur mobile
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const isXrplPair = useMemo(
    () => getPairCategory(selectedPair) === "xrpl",
    [selectedPair]
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
                  xl:grid-cols-[26%_74%]
                  2xl:grid-cols-[21%_58%_21%]
                  items-start
                ">







                {/* Orders / Orderbook */}
                <section
                className="
                    order-2
                    xl:order-1 xl:row-start-1 xl:col-span-1
                    2xl:order-1 2xl:row-auto 2xl:col-span-1
                  ">





                  <div className="mt-3 xl:mt-0">
                    <div className="xl:sticky xl:top-32 xl:h-[calc(100vh-8rem)] panel-surface overflow-hidden">
                      <OrderbookSidebar pair={selectedPair} />
                    </div>
                  </div>
                </section>

                {/* Chart principal */}
                <section
                className="
                    order-1
                    xl:order-2 xl:row-start-1 xl:col-span-1
                    2xl:order-2 2xl:col-span-1
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
                    order-3
                    xl:order-3 xl:row-start-2 xl:col-span-2
                    2xl:order-3 2xl:row-start-1 2xl:col-span-1
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

        {/* Section EOD FX Markets (position adaptative) */}
        {isXrplPair ?
        // Paires XRPL : EOD en dessous, comme avant
        <ExchangeSection variant="embedded" /> :

        // Paires non-XRPL : EOD au-dessus sur mobile (voir md:hidden plus haut),
        // et en dessous sur desktop pour garder la structure globale.
        <div className="hidden md:block">
            <ExchangeSection variant="embedded" />
          </div>
        }

        {/* Footer global pro */}
        <FooterPro />
      </main>

      {/* Bulle Assistant fixe en bas à droite (même style que sur la home) */}
      {assistantContainer &&
      createPortal(
        <div className={`fixed right-3 md:right-6 md:bottom-6 z-[9999] transition-all duration-300 ${
        isScrolled ? 'bottom-3' : 'bottom-20'}`
        }>
            {assistantOpen &&
          <div className="mb-3 w-[96vw] max-w-none md:max-w-md rounded-2xl border border-white/10 bg-[#040c13]/90 backdrop-blur-xl p-3 flex flex-col gap-2 shadow-2xl">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm md:text-xs font-semibold text-white">{t("ui_assistant_xcannes_9d301c0d6a", "Assistant XCANNES")}

              </p>
                  <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm md:text-xs"
                aria-label={t("ui_close_le_chat_d6b0b8eaa8", "Fermer le chat")}>

                    ✕
                  </button>
                </div>
                <div className="flex-1 min-h-[120px] max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 text-sm md:text-[11px] text-white/70">
                  <p className="mb-1 text-white/90 text-sm md:text-xs font-medium">{t("ui_hello_je_suis_l_assistant__e7c9e94d03", "Bonjour, je suis l'assistant XCANNES.")}

              </p>
                  <p className="text-sm md:text-xs text-white/60">{t("ui_d_crivez_your_question_de_t_cc5c9669ff", "Décrivez votre question de trading (pair XRPL, Pyth, EOD, carnet d'ordres...) et je vous aiderai à comprendre ce que vous voyez à l'écran.")}


              </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                type="text"
                placeholder={t("ui_write_un_message_5f2f86490f", "Écrire un message...")}
                className="flex-1 rounded-lg bg-black/25 border border-white/10 px-3 py-2 text-sm md:text-xs text-white/90 placeholder:text-white/35 focus:outline-none focus:border-xcannes-green/40 focus:ring-2 focus:ring-xcannes-green/10" />

                  <button
                type="button"
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm md:text-[11px] text-white/75 font-medium transition-colors">{t("ui_send_504b64a87b", "Envoyer")}


              </button>
                </div>
              </div>
          }
            {!assistantOpen &&
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="w-10 h-10 md:w-12 md:h-12 transition-all bg-transparent text-white hover:bg-white/10 border-2 border-white/30 rounded-full flex items-center justify-center relative overflow-hidden"
            aria-label={t("ui_assistant_ia_48e9d9815a", "Assistant IA")}
            title={t("ui_assistant_ia_f1719273f5", "Assistant IA")}>

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