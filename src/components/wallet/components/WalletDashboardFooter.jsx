"use client";

import { useTranslation } from "next-i18next";

const scanButtonStyle = {
  background: "transparent",
  boxShadow:
    "0 4px 14px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 18px rgba(255,255,255,0.07)",
};

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
    <div className="mt-[2px] shrink-0 z-20 bg-transparent md:bg-elevated md:[--bg-elevated:#090c0d] border-t-0 md:mt-auto md:border-t md:border-white/10 lg:border-t lg:border-white/[0.04] lg:border-r lg:border-r-white/5">
      {/* Mobile footer — barre unique 3 colonnes */}
      <div
        className="relative md:hidden shrink-0"
        style={{ paddingBottom: 'max(4px, env(safe-area-inset-bottom))' }}
      >
        {/* Gradient de fondu sous la barre */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-[#0d1012] via-[#0d1012]/70 to-transparent" />

        {/* Gradient au-dessus du footer — sépare du contenu */}
        <div className="pointer-events-none absolute inset-x-0 bottom-full h-[64px] bg-gradient-to-t from-[#0d1012]/90 to-transparent" />

        {/* Barre flottante */}
        <div className="relative z-10 mx-4 mb-1 h-[46px] flex items-center rounded-[30px] overflow-hidden bg-[#0e1214] ring-1 ring-white/[0.02] ring-inset shadow-[0_2px_16px_rgba(0,0,0,0.35),0_1px_3px_rgba(0,0,0,0.2)]">

          {/* Gauche : + Devise */}
          <div className="flex-1 flex items-center justify-end h-full min-w-0" style={{ boxShadow: '0 0 18px rgba(255,255,255,0.07)' }}>
            {addCurrencySlot ?? null}
          </div>

          {/* Centre : Scanner */}
          {onScan ? (
            <div className="shrink-0 flex items-center justify-center px-2">
              <button
                type="button"
                onClick={onScan}
                className="flex h-[44px] w-[110px] items-center justify-center rounded-[14px] text-xcannes-green transition-transform duration-150 hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#39d57c]/20"
                style={scanButtonStyle}
                aria-label={t(SCAN_LABEL_KEY, "Scan QR Code")}
              >
                <ScanIcon />
              </button>
            </div>
          ) : null}

          {/* Droite : Historique */}
          <div className="flex-1 flex items-center justify-center h-full min-w-0" style={{ boxShadow: '0 0 18px rgba(255,255,255,0.07)' }}>
            {onHistory ? (
              <button
                type="button"
                onClick={onHistory}
                className="w-full h-[46px] flex flex-row items-center justify-center gap-1.5 transition-colors rounded-[30px] px-3 group"
                style={scanButtonStyle}
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
