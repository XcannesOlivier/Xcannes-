"use client";

import { useTranslation } from "next-i18next";

export default function WalletDashboardFooter({ onScan } = {}) {
  const { t } = useTranslation("common");
  const mobileOverlayColor = "#111516";

  return (
    <div className="mt-auto shrink-0 z-20 bg-elevated [--bg-elevated:#090c0d] border-t-0 md:border-t md:border-white/10">
      {/* Mobile only: sculpted footer dock with floating scan action */}
      <div
        className="md:hidden relative overflow-visible bg-[#090c0d]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
      >
        <div className="relative h-[108px]">
          <div
            className="absolute inset-x-0 top-0 overflow-hidden"
            style={{ height: 88 }}
            aria-hidden
          >
            <div className="absolute inset-x-0 bottom-0 h-[56px]" style={{ backgroundColor: mobileOverlayColor }} />
            <svg
              viewBox="0 0 390 36"
              preserveAspectRatio="none"
              className="absolute inset-x-0 top-0 h-[36px] w-full text-white/16"
            >
              <path
                d="M0 30 C48 30 82 30 102 22 C118 15 122 0 136 0 H254 C268 0 272 15 288 22 C308 30 342 30 390 30 V36 H0 Z"
                fill={mobileOverlayColor}
              />
              <path
                d="M136 0 H254"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
              <path
                d="M0 30 C48 30 82 30 102 22 C118 15 122 0 136 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
              <path
                d="M254 0 C268 0 272 15 288 22 C308 30 342 30 390 30"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <span className="absolute right-2 top-[7px] z-20 bg-[#090c0d] pl-2 text-[8px] font-light tracking-[0.12em] text-white/15">
            By XCANNES LLC
          </span>

          {onScan ? (
            <>
              <div
                className="pointer-events-none absolute left-1/2 top-[40px] z-0 h-[56px] w-[156px] -translate-x-1/2 rounded-full bg-black/65 blur-[12px]"
                aria-hidden
              />
              <button
                type="button"
                onClick={onScan}
                className="absolute left-1/2 top-[30px] z-10 flex h-[60px] w-[170px] -translate-x-1/2 items-center justify-center rounded-full text-white transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#39d57c]/20"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(42,170,96,1) 0%, rgba(20,122,67,1) 100%)",
                  boxShadow:
                    "0 12px 24px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -10px 18px rgba(0,0,0,0.16)",
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
        </div>
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
