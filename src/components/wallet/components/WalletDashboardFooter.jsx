"use client";

import { useTranslation } from "next-i18next";

export default function WalletDashboardFooter({ onScan } = {}) {
  const { t } = useTranslation("common");

  return (
    <div className="mt-auto shrink-0 z-20 bg-elevated [--bg-elevated:#090c0d] md:[--bg-elevated:unset] md:border-t md:border-white/10">
      {/* Mobile only: sculpted footer dock with floating scan action */}
      <div
        className="md:hidden relative overflow-visible bg-[#090c0d]"
        style={{ paddingTop: 20, paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[96px] overflow-hidden"
          aria-hidden
        >
          <div className="absolute inset-0 bg-[#090c0d]" />
          <div className="absolute left-1/2 top-[44px] h-[46px] w-[176px] -translate-x-1/2 rounded-full bg-black/55 blur-[14px]" />
          <svg
            viewBox="0 0 390 96"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient id="wallet-footer-line" x1="0" y1="0" x2="390" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
              </linearGradient>
              <linearGradient id="wallet-footer-line-rev" x1="390" y1="0" x2="0" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
              </linearGradient>
            </defs>
            <path
              d="M0 56 H72 C94 56 112 52 126 42 C139 33 151 28 166 29"
              fill="none"
              stroke="url(#wallet-footer-line)"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <path
              d="M390 56 H318 C296 56 278 52 264 42 C251 33 239 28 224 29"
              fill="none"
              stroke="url(#wallet-footer-line-rev)"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <span className="absolute right-4 top-[38px] text-[10px] font-light tracking-[0.14em] text-white/22 uppercase">
          By XCANNES LLC
        </span>

        {onScan ? (
          <>
            <div
              className="pointer-events-none absolute left-1/2 top-3 z-0 h-[66px] w-[168px] -translate-x-1/2 rounded-full bg-black/65 blur-[10px]"
              aria-hidden
            />
            <button
              type="button"
              onClick={onScan}
              className="absolute left-1/2 top-3 z-10 flex h-[62px] w-[172px] -translate-x-1/2 items-center justify-center rounded-full border border-[#39d57c]/40 text-white transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#39d57c]/20"
              style={{
                background:
                  "linear-gradient(180deg, rgba(42,170,96,1) 0%, rgba(20,122,67,1) 100%)",
                boxShadow:
                  "0 14px 28px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -10px 18px rgba(0,0,0,0.16)",
              }}
              aria-label={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-9 w-9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
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

        <div className="h-[76px]" aria-hidden />
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
