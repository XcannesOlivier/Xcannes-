"use client";

import { useEffect, useMemo, useState } from "react";
import { useXumm } from "@/context/XummContext";
import { getPairCategory } from "@/utils/marketStructure";
import OrderbookSidebar from "@/components/dex/panels/OrderbookSidebar";
import MobileTradingTabs from "./MobileTradingTabs";
import WalletDashboard from "@/components/wallet/WalletDashboard";
import ExchangeSection from "@/components/dex/ExchangeSections/ExchangeSection";

/**
 * Layout trading Variante 1A
 * - 3 colonnes sur desktop
 *   - Gauche : Wallet RLUSD/XCS + portfolio scrollable
 *   - Centre : Pair + Prix + Chart (dominant)
 *   - Droite : Orderbook + Recent trades (ou Info & Fees)
 * - Mobile / tablette : sections empilées avec en-têtes accordéon
 */
export default function TradingLayoutV1A({
  pair,
  interval,
  onPairChange,
  onIntervalChange,
  availablePairs,
  ChartComponent,
}) {
  const { isConnected } = useXumm();

  const [viewportWidth, setViewportWidth] = useState(null);
  const pairCategory = useMemo(() => getPairCategory(pair), [pair]);
  const isXRPL = pairCategory === "xrpl";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const layoutMode = useMemo(() => {
    if (viewportWidth == null) return "desktop1A";
    if (viewportWidth < 1024) return "mobile";
    return "desktop1A";
  }, [viewportWidth]);
  const walletVariant = layoutMode === "mobile" ? "dex-mobile" : "dex-desktop";

  // Variante 1A desktop ≥1180px : 3 colonnes avec wallet central
  return (
    <div className="w-full px-3 sm:px-4 lg:px-0">
      <div
        className="
          grid gap-4 lg:gap-0
          grid-cols-1
          lg:grid-cols-[22%_56%_22%]
          xl:grid-cols-[20%_60%_20%]
          items-start
        "
      >
        {/* Colonne gauche : Orderbook + Recent trades (ou Info & Fees) */}
        <section className="order-3 lg:order-1">
          <div className="mt-3 lg:mt-0">
            <div className="lg:sticky lg:top-32 lg:h-[calc(100vh-8rem)] bg-elevated backdrop-blur-sm overflow-hidden">
              {layoutMode === "mobile" ? (
                <MobileTradingTabs pair={pair} />
              ) : (
                <OrderbookSidebar
                  pair={pair}
                />
              )}
            </div>
          </div>
        </section>

        {/* Colonne centrale : Pair + Prix + Chart (dominant) */}
        <section className="order-1 lg:order-2">
          <div className="chart-panel bg-elevated backdrop-blur-sm h-full max-sm:-mx-3">
            <div className="dex-chart-container flex flex-col min-h-[50vh] md:min-h-[60vh] xl:h-[calc(100vh-8rem)]">
              <ChartComponent
                pair={pair}
                interval={interval}
                onPairChange={onPairChange}
                onIntervalChange={onIntervalChange}
                availablePairs={availablePairs}
              />
            </div>
          </div>
        </section>

        {/* Colonne droite : Wallet RLUSD/XCS + dashboard */}
        <section className="order-2 lg:order-3">
          <div className="mt-3 lg:mt-0">
            <div className="lg:sticky lg:top-32 lg:h-[calc(100vh-8rem)] bg-elevated backdrop-blur-sm overflow-hidden">
              <WalletDashboard preview={!isConnected} variant={walletVariant} />
              {/* Sur mobile & paires non-XRPL : section EOD entre wallet et orderbook */}
              {!isXRPL && layoutMode === "mobile" && (
                <div className="mt-4">
                  <ExchangeSection variant="embedded" />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
