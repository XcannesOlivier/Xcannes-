"use client";

import { useEffect, useMemo, useState } from "react";
import { useXumm } from "@/context/XummContext";
import WalletDashboard from "@/components/wallet/WalletDashboard";

/**
 * Layout trading Variante 1A
 * - 2 colonnes sur desktop
 *   - Gauche : Pair + Prix + Chart (dominant)
 *   - Droite : Wallet RLUSD/XCS + dashboard
 * - Mobile / tablette : sections empilées
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
  const walletVariant = layoutMode === "mobile" ? "default" : "full";

  // Variante 1A desktop ≥1024px : 2 colonnes
  return (
    <div className="w-full px-3 sm:px-4 lg:px-0">
      <div
        className="
          grid gap-4
          grid-cols-1
          lg:grid-cols-[64%_36%]
          xl:grid-cols-[60%_40%]
          items-start
        "
      >
        {/* Colonne gauche : Pair + Prix + Chart (dominant) */}
        <section className="order-1">
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
        <section className="order-2">
          <div className="mt-3 lg:mt-0">
            <div className="min-h-[70vh] lg:min-h-0 lg:sticky lg:top-32 lg:h-[calc(100vh-8rem)] bg-elevated backdrop-blur-sm overflow-hidden">
              <WalletDashboard preview={!isConnected} variant={walletVariant} showPayreqDecor />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
