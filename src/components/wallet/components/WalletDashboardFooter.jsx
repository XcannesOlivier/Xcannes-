"use client";

import { useTranslation } from "next-i18next";

export default function WalletDashboardFooter({ onScan } = {}) {
  const { t } = useTranslation("common");

  return (
    <div className="mt-auto shrink-0 z-20 bg-elevated border-t border-white/10 relative">
      {/* Mobile scan button (center notch style) */}
      {onScan ? (
        <>
          <div
            className="md:hidden absolute left-1/2 -translate-x-1/2 -top-8 w-[220px] h-14 rounded-t-[28px] bg-elevated border border-white/10 border-b-0 shadow-[0_-18px_60px_rgba(0,0,0,0.65)] pointer-events-none"
            aria-hidden
          />
          <button
            type="button"
            onClick={onScan}
            className="md:hidden absolute left-1/2 -translate-x-1/2 -top-10 w-20 h-20 rounded-full bg-[#101415] ring-1 ring-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center text-white/90 hover:text-white transition-colors"
            aria-label={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7V6a2 2 0 0 1 2-2h1M20 7V6a2 2 0 0 0-2-2h-1M4 17v1a2 2 0 0 0 2 2h1M20 17v1a2 2 0 0 1-2 2h-1"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 8h3v3H7V8Zm7 0h3v3h-3V8ZM7 13h3v3H7v-3Zm7 2h3"
              />
            </svg>
          </button>
        </>
      ) : null}

      <div className="px-5 md:px-4 py-4 md:py-5 flex items-center justify-center min-h-[52px] md:min-h-[56px]">
        {/* Mobile: XCANNES centré */}
        <span className={`md:hidden flex items-center justify-center ${onScan ? "pt-9" : ""}`}>
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
          <span className="text-[16px] font-light italic text-white/40">
            {t("ui_global_usd_wallet_202f7e48be", "Multi-currency wallet")}
          </span>
        </span>
      </div>
    </div>
  );
}
