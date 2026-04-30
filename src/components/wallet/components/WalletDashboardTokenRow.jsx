"use client";

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
        width={32}
        height={32}
        className="w-7 h-7 sm:w-8 sm:h-8 object-cover"
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
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const currencyCode = String(token?.currency || "").toUpperCase();
  const displayCode = getDisplayCurrencyCode(currencyCode);
  const isDisplayOverride = displayCode !== currencyCode;
  const rawValue = Number(token?.value || 0);
  const isLineCurrency = Boolean(token?.isTrustlineOnly);
  const isNativeAsset = currencyCode === "XRP";
  const hasCryptoIcon = Boolean(displayCode && CRYPTO_ICONS?.[displayCode]);
  const isFlagIcon = isDisplayOverride || (isLineCurrency && !hasCryptoIcon);
  const iconSizeClass = isFlagIcon
    ? "w-[28px] h-[28px] text-xl leading-none opacity-60"
    : isLineCurrency
      ? "w-[28px] h-[28px] text-xl leading-none opacity-60"
      : "w-[26px] h-[26px] text-lg leading-none";
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
    "border border-white/7",
    "bg-white/5",
    "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),rgba(255,255,255,0)_85%)]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,255,255,0.04)]",
    "hover:bg-transparent hover:border-white/10",
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
        className="w-full text-left"
      >
        <div
          className={`flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 md:py-2 transition-colors cursor-pointer ${rowSurfaceClass} ${tokenRowClass}`}
        >
          <div className={`flex items-center ${iconTextGapClass} min-w-0`}>
            <div
              className={`${iconSizeClass} ${iconRadiusClass} ${iconEdgeSpacingClass} flex items-center justify-center font-semibold text-primary overflow-hidden leading-none flex-shrink-0`}
            >
              {renderTokenIcon(token)}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-lg md:text-2xl text-white/55 md:text-white/70 truncate leading-tight">
                  <span className="md:hidden">
                    {currencyLabel.length > 15 ? currencyLabel.slice(0, 15) + '…' : currencyLabel}
                  </span>
                  <span className="hidden md:inline">{currencyLabel}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="text-right text-xl md:text-2xl text-white/70 md:text-white/75 shrink-0 leading-tight">
            <div className="font-mono flex items-center gap-1.5">
              {Number.isFinite(displayValue)
                ? new Intl.NumberFormat(locale || "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayValue)
                : "0.00"}
              {" "}
              <span className="text-sm md:text-base font-normal text-white/65 md:text-white/70">{displayCode}</span>
              <svg className="w-3 h-3 shrink-0 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
