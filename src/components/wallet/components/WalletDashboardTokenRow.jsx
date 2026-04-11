"use client";

import Image from "next/image";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import {
  getCurrencyFlag,
  getTokenIcon,
  getDisplayCurrencyCode,
  formatAmountWithSymbol,
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
    ? "w-12 h-12 text-[22px] sm:w-14 sm:h-14 sm:text-[26px]"
    : isLineCurrency
      ? "w-10 h-10 text-[18px] sm:w-11 sm:h-11 sm:text-[20px]"
      : "w-8 h-8 text-[14px] sm:w-9 sm:h-9 sm:text-[15px]";
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

  // Keep rows fully opaque so the list background "glow" stays behind them.
  const rowSurfaceClass = "bg-[#050708] hover:bg-[#070a0b]";

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
          className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors cursor-pointer ${rowSurfaceClass} ${tokenRowClass}`}
        >
          <div className={`flex items-center ${iconTextGapClass} min-w-0`}>
            <div
              className={`${iconSizeClass} ${iconRadiusClass} ${iconEdgeSpacingClass} flex items-center justify-center font-semibold text-primary overflow-hidden leading-none flex-shrink-0`}
            >
              {renderTokenIcon(token)}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[15px] md:text-[16px] text-primary truncate">
                  {currencyLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="text-right text-[15px] md:text-[16px] text-primary shrink-0">
            <div className="font-mono">
                  {Number.isFinite(displayValue)
                ? formatAmountWithSymbol(locale, displayValue, displayCode, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : formatAmountWithSymbol(locale, 0, displayCode, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
