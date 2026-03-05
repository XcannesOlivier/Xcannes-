"use client";

import { useTranslation } from "next-i18next";

export default function WalletDashboardFooter() {
  const { t } = useTranslation("common");

  return (
    <div className="mt-auto shrink-0 z-20 bg-elevated border-t border-white/10">
      <div className="px-5 md:px-4 py-4 md:py-5 flex items-center justify-center min-h-[52px] md:min-h-[56px]">
        {/* Mobile: XCANNES centré */}
        <span className="md:hidden flex items-center justify-center">
          <span className="font-orbitron font-semibold tracking-[0.22em] text-white/80 uppercase text-[17px]">
            {t("ui_xcannes_3cdc66a392", "XCANNES")}
          </span>
        </span>

        {/* Desktop: XCANNES | Multi-currency wallet centré */}
        <span className="hidden md:flex items-center justify-center">
          <span className="font-orbitron font-semibold tracking-[0.24em] text-white/80 uppercase text-xl leading-none">
            {t("ui_xcannes_3cdc66a392", "XCANNES")}
          </span>
          <span className="mx-3 text-[13px] font-light text-white/30">|</span>
          <span className="text-[16px] font-light italic text-white/45">
            {t("ui_global_usd_wallet_202f7e48be", "Multi-currency wallet")}
          </span>
        </span>
      </div>
    </div>
  );
}
