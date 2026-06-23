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
        className="w-12 h-12 md:w-8 md:h-8 object-cover"
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
    ? "w-[52px] h-[52px] md:w-[28px] md:h-[28px] text-4xl md:text-xl leading-none opacity-65"
    : isLineCurrency
      ? "w-[52px] h-[52px] md:w-[28px] md:h-[28px] text-4xl md:text-xl leading-none opacity-65"
      : "w-[50px] h-[50px] md:w-[26px] md:h-[26px] text-3xl md:text-lg leading-none";
  const iconRadiusClass = isNativeAsset ? "rounded-lg" : "";
  const iconEdgeSpacingClass = isNativeAsset ? "ml-1" : "";
  const iconTextGapClass = isNativeAsset ? "gap-3" : "gap-2";
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
    <div className="w-full">
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
          className={`flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 md:py-3 transition-colors cursor-pointer ${rowSurfaceClass} ${tokenRowClass}`}
        >
          <div className={`flex items-center gap-3 min-w-0 flex-1`}>
            <div
              className={`${iconSizeClass} ${iconRadiusClass} ${iconEdgeSpacingClass} flex items-center justify-center font-light text-primary overflow-hidden leading-none flex-shrink-0`}
            >
              {renderTokenIcon(token)}
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl md:text-2xl text-white/70 md:text-white/70 truncate leading-tight">
                  <span className="md:hidden">
                    {currencyLabel.length > 22 ? currencyLabel.slice(0, 22) + '…' : currencyLabel}
                  </span>
                  <span className="hidden md:inline">{currencyLabel}</span>
                </span>
              </div>
              {/* Montant + code — mobile uniquement, sous le nom */}
              <div className="md:hidden flex items-center gap-1.5 mt-[3px]">
                <span className="text-lg font-mono text-white/90 leading-tight">
                  {Number.isFinite(displayValue)
                    ? new Intl.NumberFormat(locale || "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayValue)
                    : "0.00"}
                </span>
                <span className="text-sm font-light text-white/50">{displayCode}</span>
              </div>
            </div>
          </div>
          {/* Desktop : montant + code + chevron */}
          <div className="hidden md:flex text-right text-xl text-white shrink-0 leading-tight">
            <div className="font-mono flex items-center gap-1.5">
              {Number.isFinite(displayValue)
                ? new Intl.NumberFormat(locale || "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayValue)
                : "0.00"}
              {" "}
              <span className="text-sm font-light text-white/50">{displayCode}</span>
              <svg className="w-2.5 h-2.5 shrink-0 text-white/18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
          {/* Mobile : chevron seul à droite */}
          <div className="md:hidden shrink-0">
            <svg className="w-2.5 h-2.5 text-white/18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
