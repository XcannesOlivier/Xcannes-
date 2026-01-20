import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import Header from "@/components/layout/Header";
import FooterPro from "@/components/layout/FooterPro";
import SEOHead from "@/components/layout/SEOHead";
import SupportAssistantWidget from "@/components/layout/SupportAssistantWidget";
import HomeHowItWorksSection from "@/components/home/HomeHowItWorksSection";
import xcannesApi from "@/lib/xcannesApi";
import { getPageTranslations } from "@/i18n/getPageTranslations";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

export default function InfrastructurePage() {
  const { t } = useTranslation("common");
  const [availablePairs, setAvailablePairs] = useState([
    "XRP/RLUSD",
    "XCS/XRP",
    "XCS/RLUSD",
  ]);

  useEffect(() => {
    const fetchPairs = async () => {
      try {
        const markets = await xcannesApi.getAllMarkets();
        if (markets) {
          const allPairs = [
            ...(markets.trading || []),
            ...(markets.pyth || []),
          ];

          const pairsList = Array.from(
            new Set(
              allPairs
                .filter((market) => market.active !== false)
                .map((market) => `${market.base}/${market.quote}`)
            )
          );

          setAvailablePairs(pairsList);
          if (DEBUG_LOGS) {
            console.log(
              `[Infrastructure] ${pairsList.length} pairs loaded:`,
              pairsList
            );
          }
        }
      } catch (error) {
        console.error(
          "[Infrastructure] Pair load failed, using fallback:",
          error
        );
        setAvailablePairs(["XRP/RLUSD", "XCS/XRP", "XCS/RLUSD"]);
      }
    };

    fetchPairs();
  }, []);

  const pairs = useMemo(
    () =>
      availablePairs.filter((pair) => !pair.startsWith("XCS/")).slice(0, 10),
    [availablePairs]
  );

  return (
    <>
      <SEOHead
        title={t("infra_meta_title", "Infrastructure - XCANNES")}
        description={t(
          "infra_meta_description",
          "XRPL settlement, RLUSD unit, price sources, and real-time markets."
        )}
        canonical="/infrastructure"
      />

      <div className="min-h-screen bg-xcannes-background">
        <Header />
        <main>
          <HomeHowItWorksSection pairs={pairs} showCta={false} />
        </main>
        <FooterPro />
        <SupportAssistantWidget />
      </div>
    </>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getPageTranslations(locale, ["common"])),
    },
  };
}
