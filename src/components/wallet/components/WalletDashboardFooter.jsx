"use client";

import { useTranslation } from "next-i18next";

const SCAN_LABEL_KEY = "ui_scan_qr_code_12fa63d927";
const BRAND_KEY = "ui_xcannes_3cdc66a392";
const TAGLINE_KEY = "ui_global_usd_wallet_202f7e48be";

function ScanIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="butt"
        strokeLinejoin="miter"
        d="M2.5 10V2.5H10M22 2.5H29.5V10M10 29.5H2.5V22M29.5 22V29.5H22"
      />
    </svg>
  );
}

export default function WalletDashboardFooter({ onScan, addCurrencySlot, onHistory, scrolled = false } = {}) {
  const { t } = useTranslation("common");

  return (
    <div className="mt-0 shrink-0 z-20 bg-transparent md:bg-elevated md:[--bg-elevated:#090c0d] border-t-0 md:mt-auto md:border-t md:border-white/10 lg:border-t lg:border-white/[0.04] lg:border-r lg:border-r-white/5">
      {/* Mobile footer — boutons flottants */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 pointer-events-none"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Barre footer */}
        <div className="relative pointer-events-auto h-[62px] flex items-center bg-[#0b0f10]" data-scrolled={scrolled}>

          {/* Gauche : + Devise */}
          <div className="flex-1 flex items-center justify-center h-full min-w-0">
            {addCurrencySlot ?? null}
          </div>

          {/* Séparateur */}
          {onScan ? <div className="w-px h-6 bg-white/[0.08] shrink-0" aria-hidden /> : null}

          {/* Centre : Scanner */}
          {onScan ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <button
                type="button"
                onClick={onScan}
                className="w-full h-full flex flex-col items-center justify-center gap-[3px] text-white/75 transition-opacity duration-150 hover:opacity-75 active:opacity-50 focus-visible:outline-none group"
                aria-label={t(SCAN_LABEL_KEY, "Scan QR Code")}
              >
                <ScanIcon />
                <span className="text-[14px] font-light tracking-wide leading-none text-white/55 group-hover:text-white/75 transition-colors">Scanner</span>
              </button>
            </div>
          ) : null}

          {/* Séparateur */}
          {onHistory ? <div className="w-px h-6 bg-white/[0.08] shrink-0" aria-hidden /> : null}

          {/* Droite : Activité */}
          <div className="flex-1 flex items-center justify-center h-full min-w-0">
            {onHistory ? (
              <button
                type="button"
                onClick={onHistory}
                className="w-full h-full flex flex-col items-center justify-center gap-[3px] transition-opacity hover:opacity-75 active:opacity-50 focus-visible:outline-none px-1.5 group"
                aria-label={t("ui_open_statement", "Ouvrir le relevé des transactions")}
              >
                <svg
                  className="w-5 h-5 shrink-0 text-white/75 group-hover:text-white/90 transition-colors"
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
                <span className="text-[14px] font-light tracking-wide leading-none text-white/55 group-hover:text-white/75 transition-colors">Activité</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Desktop footer */}
      <div className="hidden min-h-[52px] items-center justify-center px-5 py-4 md:flex md:min-h-[36px] md:px-4 md:py-2 md:bg-[#0b0f10]">
        <span className="font-orbitron text-xl font-light uppercase leading-none tracking-[0.24em] text-white/80">
          {t(BRAND_KEY, "XCANNES")}
        </span>
      </div>
    </div>
  );
}
