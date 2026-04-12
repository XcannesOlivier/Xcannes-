"use client";

import { useTranslation } from "next-i18next";

const MOBILE_MODAL_BG = "#111516";
const MOBILE_BASE_BG = "#090c0d";

const mobileFooterStyle = {
  paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
};

const mobileOverlayFillStyle = {
  backgroundColor: MOBILE_MODAL_BG,
};

const scanButtonStyle = {
  background:
    "linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)",
  boxShadow:
    "0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)",
};

const SCAN_LABEL_KEY = "ui_scan_qr_code_12fa63d927";
const BRAND_KEY = "ui_xcannes_3cdc66a392";
const TAGLINE_KEY = "ui_global_usd_wallet_202f7e48be";

const MUSTACHE_FILL_PATH =
  "M0 30 H70 C98 30 118 0 136 0 H254 C272 0 292 30 320 30 H390 V36 H0 Z";
const MUSTACHE_CENTER_PATH = "M136 0 H254";
const MUSTACHE_LEFT_CONNECT_PATH = "M70 30 C98 30 118 0 136 0";
const MUSTACHE_RIGHT_CONNECT_PATH = "M254 0 C272 0 292 30 320 30";
const LEFT_LABEL_LINE_PATH = "M0 30 H70";
const RIGHT_LABEL_LINE_PATH = "M390 30 H320";

function ScanIcon({ className = "h-10 w-10" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7V6a2 2 0 0 1 2-2h1M20 7V6a2 2 0 0 0-2-2h-1M4 17v1a2 2 0 0 0 2 2h1M20 17v1a2 2 0 0 1-2 2h-1"
      />
      <rect x="7.7" y="7.7" width="2.9" height="2.9" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="13.4" y="7.7" width="2.9" height="2.9" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="7.7" y="13.4" width="2.9" height="2.9" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="13.4" y="13.4" width="2.9" height="2.9" rx="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MobileFooterOverlay() {
  return (
    <div
      className="absolute inset-x-0 top-0 overflow-hidden"
      style={{ height: 88 }}
      aria-hidden
    >
      <div
        className="absolute inset-x-0 bottom-0 h-[56px]"
        style={mobileOverlayFillStyle}
      />
      <svg
        viewBox="0 0 390 36"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 h-[36px] w-full text-[#697173]/40"
      >
        <path d={MUSTACHE_FILL_PATH} fill={MOBILE_MODAL_BG} />
        <path
          d={MUSTACHE_CENTER_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d={LEFT_LABEL_LINE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d={RIGHT_LABEL_LINE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d={MUSTACHE_LEFT_CONNECT_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d={MUSTACHE_RIGHT_CONNECT_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function MobileScanButton({ onScan, ariaLabel }) {
  if (!onScan) return null;

  return (
    <>
      <div
        className="pointer-events-none absolute left-1/2 top-[11px] z-0 h-[58px] w-[162px] -translate-x-1/2 rounded-full bg-black/75 blur-[14px]"
        aria-hidden
      />
      <button
        type="button"
        onClick={onScan}
        className="absolute left-1/2 top-[6px] z-10 flex h-[60px] w-[170px] -translate-x-1/2 items-center justify-center rounded-full text-white transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#39d57c]/20"
        style={scanButtonStyle}
        aria-label={ariaLabel}
      >
        <ScanIcon />
      </button>
    </>
  );
}

export default function WalletDashboardFooter({ onScan } = {}) {
  const { t } = useTranslation("common");

  return (
    <div className="mt-auto shrink-0 z-20 bg-elevated [--bg-elevated:#090c0d] border-t-0 md:border-t md:border-white/10">
      <div
        className="relative overflow-visible bg-[#090c0d] md:hidden"
        style={mobileFooterStyle}
      >
        <div className="relative h-[108px]">
          <MobileFooterOverlay />

          <span
            className="absolute right-2 top-[7px] z-20 bg-[#090c0d] pl-2 text-[8px] font-light tracking-[0.12em] text-white/18"
            style={{ backgroundColor: MOBILE_BASE_BG }}
          >
            By XCANNES LLC
          </span>

          <MobileScanButton
            onScan={onScan}
            ariaLabel={t(SCAN_LABEL_KEY, "Scan QR Code")}
          />
        </div>
      </div>

      <div className="hidden min-h-[52px] items-center justify-center px-5 py-4 md:flex md:min-h-[56px] md:px-4 md:py-5">
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
