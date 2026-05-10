/**
 * DemoWalletFooter — footer mobile (3 colonnes) aligné sur le wallet réel.
 *
 * Extracted from DemoWalletDashboard to keep the main component lean.
 */

import { useTranslation } from "next-i18next";

const scanButtonStyle = {
  background:
    "linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)",
  boxShadow:
    "0 4px 14px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -6px 10px rgba(0,0,0,0.28)",
};

function ScanIcon() {
  return (
    <svg
      viewBox="0 0 80 24"
      className="h-6 w-[68px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="butt"
        strokeLinejoin="miter"
        d="M2.5 9V2.5H9M71 2.5H77.5V9M9 21.5H2.5V15M77.5 15V21.5H71"
      />
      <text
        x="40"
        y="13"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="currentColor"
        stroke="none"
        fontSize="15"
        fontWeight="600"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
      >
        Scanner
      </text>
    </svg>
  );
}

export default function DemoWalletFooter({
  onScan,
  onHistory,
  onAddCurrency,
} = {}) {
  const { t } = useTranslation("common");

  return (
    <div className="mt-[2px] shrink-0 z-20 bg-transparent border-t-0">
      <div
        className="relative shrink-0"
        style={{ paddingBottom: "max(4px, env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-[#0d1012] via-[#0d1012]/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-full h-[64px] bg-gradient-to-t from-[#0d1012]/90 to-transparent" />

        <div className="relative z-10 mx-4 mb-1 h-[46px] flex items-center rounded-[30px] bg-[#0e1214] ring-1 ring-white/[0.02] ring-inset shadow-[0_2px_16px_rgba(0,0,0,0.35),0_1px_3px_rgba(0,0,0,0.2)]">
          <div className="flex-1 flex items-center justify-center h-full min-w-0">
            {onAddCurrency ? (
              <button
                type="button"
                onClick={onAddCurrency}
                className="w-full h-[46px] flex flex-col items-center justify-center gap-[2px] pb-[7px] transition-colors rounded-l-[30px] px-3 group"
                aria-label={t("ui_add_currency", "Ajouter")}
              >
                <span className="text-[18px] font-light leading-none text-white/75 group-hover:text-white/90 transition-colors">
                  +
                </span>
                <span className="text-[14px] font-normal tracking-wide leading-none text-white/55 group-hover:text-white/75 transition-colors">
                  {t("ui_add_currency", "Ajouter")}
                </span>
              </button>
            ) : null}
          </div>

          {onScan ? (
            <div className="shrink-0 flex items-center justify-center px-2">
              <button
                type="button"
                onClick={onScan}
                className="flex h-[44px] w-[110px] items-center justify-center rounded-[20px] text-white transition-transform duration-150 hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#39d57c]/20"
                style={scanButtonStyle}
                aria-label={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}
              >
                <ScanIcon />
              </button>
            </div>
          ) : null}

          <div className="flex-1 flex items-center justify-center h-full min-w-0">
            {onHistory ? (
              <button
                type="button"
                onClick={onHistory}
                className="w-full h-[46px] flex flex-col items-center justify-center gap-[2px] pb-[7px] transition-colors rounded-r-[30px] px-3 group"
                aria-label={t(
                  "ui_open_statement",
                  "Ouvrir le relevé des transactions",
                )}
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
                <span className="text-[14px] font-normal tracking-wide leading-none text-white/55 group-hover:text-white/75 transition-colors">
                  {t("ui_history", "Historique")}
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
