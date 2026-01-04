"use client";

import { useEffect, useState } from "react";
import { useXumm } from "@/context/XummContext";
import WalletDashboard from "@/components/wallet/WalletDashboard";

export default function DexSidebar() {
  const { isConnected } = useXumm();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  const walletVariant = isDesktop ? "dex-desktop" : "dex-mobile";

  return (
    <aside className="h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <WalletDashboard preview={!isConnected} variant={walletVariant} />
      </div>
    </aside>
  );
}
