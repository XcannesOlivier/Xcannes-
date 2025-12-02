"use client";

import { useTranslation } from "next-i18next";
import { useXumm } from "../context/XummContext";
import WalletDashboard from "./WalletDashboard";

export default function DexSidebar() {
  const { t } = useTranslation("common");
  const { isConnected } = useXumm();

  return (
    <aside className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-l-xl rounded-r-none h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <WalletDashboard preview={!isConnected} />
      </div>
    </aside>
  );
}
