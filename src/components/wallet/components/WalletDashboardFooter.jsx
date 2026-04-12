"use client";

import { useTranslation } from "next-i18next";

export default function WalletDashboardFooter({ onScan } = {}) {
  const { t } = useTranslation("common");

  return (
    <div className="mt-auto shrink-0 z-20 bg-elevated [--bg-elevated:#090c0d] md:[--bg-elevated:unset] border-t-0 md:border-t md:border-white/10">
      {/* Mobile: scan button straddling list + footer */}
      <div className="md:hidden relative h-14 pb-[env(safe-area-inset-bottom)] before:content-[''] before:absolute before:inset-x-0 before:top-[1px] before:h-px before:bg-white/11 before:pointer-events-none">
        <span className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom)+30px)] text-[10px] font-light text-white/35">
          By XCANNES LLC
        </span>
        <div
          className="absolute inset-x-0 top-0 h-14 pointer-events-none"
          aria-hidden
        />
        {onScan ? (
          <button
            type="button"
            onClick={onScan}
            className="absolute left-1/2 top-1 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-elevated shadow-[0_-10px_22px_rgba(0,0,0,0.35)] flex items-center justify-center text-white/70 hover:text-white/90 transition-colors"
            aria-label={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-14 h-14 translate-y-[4px]"
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
        ) : null}
      </div>

      <div className="hidden md:flex px-5 md:px-4 py-4 md:py-5 items-center justify-center min-h-[52px] md:min-h-[56px]">
        <span className="font-orbitron font-semibold tracking-[0.24em] text-white/80 uppercase text-xl leading-none">
          {t("ui_xcannes_3cdc66a392", "XCANNES")}
        </span>
        <span className="mx-3 text-[13px] font-light text-white/30">|</span>
        <span className="text-[16px] font-light italic text-white/40">
          {t("ui_global_usd_wallet_202f7e48be", "Multi-currency wallet")}
        </span>
      </div>
    </div>
  );
}
