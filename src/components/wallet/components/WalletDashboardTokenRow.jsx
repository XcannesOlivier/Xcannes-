"use client";

	import Image from "next/image";
	import { CRYPTO_ICONS } from "@/components/dex/ExchangeSections/constants";
	import { getCurrencyDescription } from "@/utils/currencyDescriptions";
	import {
	  getCurrencyFlag,
	  getTokenIcon,
	  USD_STABLECOINS,
	} from "../walletDashboardConfig";

function renderTokenIcon(token) {
  const code = String(token?.currency || "").toUpperCase();

  if (code && CRYPTO_ICONS[code]) {
    return (
      <Image
        src={CRYPTO_ICONS[code]}
        alt={code}
        width={20}
        height={20}
        className="w-5 h-5 object-cover"
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
  const currencyCode = String(token?.currency || "").toUpperCase();
  const rawValue = Number(token?.value || 0);
  const demoRlusd =
    token?.demoRlusdValue != null && Number.isFinite(Number(token.demoRlusdValue))
      ? Number(token.demoRlusdValue)
      : rawValue;

  const displayValue =
    currencyCode === "XRP" && Number.isFinite(rawValue)
      ? Math.min(rawValue, 5)
      : rawValue;

  return (
    <button
      key={token?.key}
      type="button"
      onClick={onClick}
      className="w-full text-left"
    >
      <div
        className={`flex items-center justify-between rounded-md bg-base hover:bg-slate-800/40 border border-slate-800/60 px-3 py-2 transition-colors cursor-pointer ${tokenRowClass}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 flex items-center justify-center text-[13px] font-semibold text-primary overflow-hidden">
            {renderTokenIcon(token)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-primary truncate">{token?.currency}</span>
            <span className="text-[11px] text-muted truncate">
              {token?.currency === "XRP"
                ? "XRP · Native"
                : token?.isTrustlineOnly
                  ? getCurrencyDescription(token?.currency)
                  : isStablecoin(token?.currency)
                    ? "XRPL Stablecoin"
                    : token?.currency === "XCS"
                      ? "XCannes Token"
                      : "XRPL Token"}
            </span>
          </div>
        </div>
        <div className="text-right text-[12px] text-primary">
          <div className="font-mono">
            {Number.isFinite(displayValue)
              ? displayValue.toLocaleString("en-US", {
                  maximumFractionDigits: 4,
                })
              : "0"}
          </div>
          <div className="mt-0.5 text-[10px] text-muted font-normal">
            ≈{" "}
            {Number.isFinite(demoRlusd)
              ? demoRlusd.toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })
              : "0"}{" "}
            RLUSD
          </div>
        </div>
      </div>
    </button>
  );
}
