"use client";

import { useTranslation } from "next-i18next";

const SCAN_LABEL_KEY = "ui_scan_qr_code_12fa63d927";
const BRAND_KEY = "ui_xcannes_3cdc66a392";
const TAGLINE_KEY = "ui_global_usd_wallet_202f7e48be";

function ScanIcon() {
  return (
    <svg
      viewBox="0 0 96 32"
      className="h-7 w-[80px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="butt"
        strokeLinejoin="miter"
        d="M2.5 11.5V2.5H10.5M85.5 2.5H93.5V11.5M10.5 29.5H2.5V20.5M93.5 20.5V29.5H85.5"
      />
      <text
        x="48"
        y="16"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="currentColor"
        stroke="none"
        fontSize="19"
        fontWeight="400"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
      >
        Scanner
      </text>
    </svg>
  );
}

export default function WalletDashboardFooter({ onScan, addCurrencySlot, onHistory } = {}) {
  const { t } = useTranslation("common");

  return (
    <div className="mt-0 shrink-0 z-20 bg-transparent md:bg-elevated md:[--bg-elevated:#090c0d] border-t-0 md:mt-auto md:border-t md:border-white/10 lg:border-t lg:border-white/[0.04] lg:border-r lg:border-r-white/5">
      {/* Mobile footer — barre flat 3 boutons */}
      <div
        className="relative md:hidden shrink-0"
        style={{
          paddingBottom: "max(6px, env(safe-area-inset-bottom))",
        }}
      >
        {/* Gradient au-dessus du footer — sépare du contenu */}
        <div className="pointer-events-none absolute inset-x-0 bottom-full h-[64px] bg-gradient-to-t from-[#0d1012]/90 to-transparent" />

        {/* Barre footer */}
        <div className="relative z-10 h-[58px] flex items-center gap-2 px-3 bg-gradient-to-b from-black/60 via-[#0e1214] to-[#0e1214] shadow-[inset_0_18px_30px_rgba(0,0,0,0.55)] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.10]">

          {/* Gauche : + Devise */}
          <div className="flex-1 flex items-center justify-center h-full min-w-0">
            {addCurrencySlot ?? null}
          </div>

          {/* Centre : Scanner */}
          {onScan ? (
            <div className="shrink-0 flex items-center justify-center">
              <button
                type="button"
                onClick={onScan}
                className="flex h-[46px] w-[130px] items-center justify-center rounded-[16px] text-xcannes-green transition-transform duration-150 hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#39d57c]/20 bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.04] ring-inset shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.015),0_2px_8px_rgba(0,0,0,0.35),inset_0_-16px_20px_rgba(0,0,0,0.88)] scanner-btn-fade-border"
                aria-label={t(SCAN_LABEL_KEY, "Scan QR Code")}
              >
                <ScanIcon />
              </button>
            </div>
          ) : null}

          {/* Droite : Historique */}
          <div className="flex-1 flex items-center justify-center h-full min-w-0">
            {onHistory ? (
              <button
                type="button"
                onClick={onHistory}
                className="w-full h-[40px] flex flex-row items-center justify-center gap-1.5 transition-colors px-1.5 group rounded-[16px] bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.04] ring-inset shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.008),0_2px_8px_rgba(0,0,0,0.35),inset_0_-14px_18px_rgba(0,0,0,0.82)]"
                aria-label={t("ui_open_statement", "Ouvrir le relevé des transactions")}
              >
                <svg
                  className="w-[20px] h-[20px] shrink-0 text-white/75 group-hover:text-white/90 transition-colors"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15.5 14.5" />
                </svg>
                <span className="text-[14px] font-normal tracking-wide leading-none text-white/55 group-hover:text-white/75 transition-colors">Historique</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Desktop footer */}
      <div className="hidden min-h-[52px] items-center justify-center px-5 py-4 md:flex md:min-h-[36px] md:px-4 md:py-2 md:bg-[#111518] md:shadow-[inset_0_-16px_28px_rgba(255,255,255,0.03),inset_0_46px_70px_rgba(0,0,0,0.55)]">
        <span className="font-orbitron text-xl font-semibold uppercase leading-none tracking-[0.24em] text-white/80">
          {t(BRAND_KEY, "XCANNES")}
        </span>
        <span className="mx-3 text-[13px] font-light text-white/30">|</span>
        <span className="text-[16px] font-light italic text-white/40">
          {t(TAGLINE_KEY, "Multi-currency wallet")}
        </span>
      </div>
    </div>
  );
}
