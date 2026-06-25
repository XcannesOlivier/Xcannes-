"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import {
  getCurrencyFlag,
  getTokenIcon,
  getDisplayCurrencyCode,
  USD_STABLECOINS,
} from "../walletDashboardConfig";
import { useTranslation } from "next-i18next";

function renderTokenIcon(token) {
  const code = String(token?.currency || "").toUpperCase();
  const displayCode = getDisplayCurrencyCode(code);

  if (displayCode !== code) {
    return getCurrencyFlag(displayCode);
  }

  if (code && CRYPTO_ICONS[code]) {
    return (
      <Image
        src={CRYPTO_ICONS[code]}
        alt={code}
        width={52}
        height={52}
        className="w-12 h-12 object-cover"
      />
    );
  }

  return token?.isTrustlineOnly ? getCurrencyFlag(code) : getTokenIcon(code);
}

function isStablecoin(currency) {
  return USD_STABLECOINS.includes(String(currency || "").toUpperCase());
}

export default function WalletDashboardTokenRow({
  token,
  tokenRowClass = "",
  onClick,
  animationDelay = 0,
  animReady = false,
}) {
  const { i18n } = useTranslation("common");
  const locale = i18n?.language || "en";

  // ── Hover tactile avec retour automatique ──────────────────────
  const [touched, setTouched] = useState(false);
  const touchTimerRef = useRef(null);
  const handleTouchStart = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    setTouched(true);
  };
  const handleTouchEnd = () => {
    touchTimerRef.current = setTimeout(() => setTouched(false), 300);
  };
  const currencyCode = String(token?.currency || "").toUpperCase();
  const displayCode = getDisplayCurrencyCode(currencyCode);
  const isDisplayOverride = displayCode !== currencyCode;
  const rawValue = Number(token?.value || 0);
  const isLineCurrency = Boolean(token?.isTrustlineOnly);
  const isNativeAsset = currencyCode === "XRP";
  const hasCryptoIcon = Boolean(displayCode && CRYPTO_ICONS?.[displayCode]);
  const isFlagIcon = isDisplayOverride || (isLineCurrency && !hasCryptoIcon);
  const iconSizeClass = isFlagIcon
    ? "w-[52px] h-[52px] text-4xl leading-none opacity-65"
    : isLineCurrency
      ? "w-[52px] h-[52px] text-4xl leading-none opacity-65"
      : "w-[50px] h-[50px] text-3xl leading-none";
  const iconRadiusClass = isNativeAsset ? "rounded-lg" : "";
  const iconEdgeSpacingClass = isNativeAsset ? "ml-1" : "";
  const iconTextGapClass = isNativeAsset ? "gap-3" : "gap-2";
  // The Swiss flag (🇨🇭) is square (1:1) unlike most flags (3:2), so it appears
  // smaller in the icon container. Scale it up to visually match the others.
  const SQUARE_FLAG_CURRENCIES = new Set(["CHF"]);
  const iconScaleClass = SQUARE_FLAG_CURRENCIES.has(displayCode) ? "scale-[1.35]" : "";
  const displayValue = rawValue;

  const currencyLabel =
    currencyCode === "XRP"
      ? "XRP · Native"
      : isDisplayOverride
        ? getCurrencyDescription(displayCode) || displayCode
        : getCurrencyDescription(currencyCode) ||
          (isStablecoin(currencyCode)
            ? "XRPL Stablecoin"
            : isLineCurrency
              ? `${getCurrencyDescription(currencyCode)}`
              : "XRPL Token");

  // Style surface calqué sur les cartes du bloc "Support" (Paramètres) :
  // fond elevated + voile blanc léger + ombres internes.
  const rowSurfaceClass = [
    "bg-elevated",
    "border border-white/[0.03] border-b-0",
    "bg-white/[0.035]",
    "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0)_85%)]",
    "[@media(hover:hover)]:hover:bg-none [@media(hover:hover)]:hover:border-b [@media(hover:hover)]:hover:border-white/[0.05]",
    touched ? "!bg-none !border !border-white/[0.05]" : "",
    "transition-colors duration-150",
  ].join(" ");

  const handleRowKeyDown = (event) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div className={`w-full${animReady ? ' animate-slide-from-right' : ''}`} style={animReady ? { animationDelay: `${animationDelay}ms` } : undefined}>
      <div
        key={token?.key}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleRowKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full text-left"
      >
        <div
          className={`flex items-center gap-3 md:gap-6 rounded-[14px] px-3.5 py-2 md:py-2.5 transition-colors cursor-pointer ${rowSurfaceClass} ${tokenRowClass}`}
        >
          {/* Icône — identique mobile et desktop */}
          <div
            className={`${iconSizeClass} ${iconRadiusClass} ${iconEdgeSpacingClass} ${iconScaleClass} flex items-center justify-center font-light text-primary overflow-hidden leading-none flex-shrink-0`}
          >
            {renderTokenIcon(token)}
          </div>

          {/* ── Mobile : nom + montant empilés ── */}
          <div className="md:hidden min-w-0 flex flex-col justify-center flex-1">
            <span className="text-[18px] text-white/70 truncate leading-tight">
              {currencyLabel.length > 22 ? currencyLabel.slice(0, 22) + '…' : currencyLabel}
            </span>
            <div className="flex items-center gap-1.5 mt-[3px]">
              <span className="text-[16px] font-mono text-white/90 leading-tight">
                {Number.isFinite(displayValue)
                  ? new Intl.NumberFormat(locale || "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayValue)
                  : "0.00"}
              </span>
              <span className="text-[12px] font-light text-white/50">{displayCode}</span>
            </div>
          </div>
          <div className="md:hidden shrink-0">
            <span className="text-base font-light text-white/30 leading-none" aria-hidden>+</span>
          </div>

          {/* ── Desktop : une seule ligne — nom | montant+code | "+" ── */}
          <div className="hidden md:flex items-center gap-3 flex-1 min-w-0">
            <span className="text-2xl text-white/70 truncate leading-tight flex-1">
              {currencyLabel}
            </span>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-2xl font-mono text-white/90 leading-tight">
                {Number.isFinite(displayValue)
                  ? new Intl.NumberFormat(locale || "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayValue)
                  : "0.00"}
              </span>
              <span className="text-base font-light text-white/50">{displayCode}</span>
            </div>
            <span className="text-lg font-light text-white/30 leading-none shrink-0 ml-2" aria-hidden>+</span>
          </div>
        </div>
      </div>
    </div>
  );
}
