"use client";

import Image from "next/image";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import {
  getCurrencyFlag,
  getTokenIcon,
  USD_STABLECOINS } from
"../walletDashboardConfig";
import { useTranslation } from "next-i18next";

function renderTokenIcon(token) {
  const code = String(token?.currency || "").toUpperCase();

  if (code && CRYPTO_ICONS[code]) {
    return (
      <Image
        src={CRYPTO_ICONS[code]}
        alt={code}
        width={20}
        height={20}
        className="w-5 h-5 object-cover" />);


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
  onInstallTrustline,
  isWalletActivated
}) {
  const { t } = useTranslation("common");
  const currencyCode = String(token?.currency || "").toUpperCase();
  const rawValue = Number(token?.value || 0);
  const isMissingTrustline = !!token?.isMissingTrustline;
  const demoRlusd =
  token?.demoRlusdValue != null && Number.isFinite(Number(token.demoRlusdValue)) ?
  Number(token.demoRlusdValue) :
  rawValue;

  const displayValue =
  currencyCode === "XRP" && Number.isFinite(rawValue) ?
  Math.min(rawValue, 5) :
  rawValue;

  return (
    <div className="w-full">
      <button
        key={token?.key}
        type="button"
        onClick={onClick}
        className="w-full text-left">

        <div
          className={`flex items-center justify-between rounded-md bg-base hover:bg-slate-800/40 border border-slate-800/60 px-3 py-2 transition-colors cursor-pointer ${tokenRowClass}`}>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 flex items-center justify-center text-[13px] font-semibold text-primary overflow-hidden">
              {renderTokenIcon(token)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-primary truncate">{token?.currency}</span>
              <span className="text-[11px] text-muted truncate">
                {token?.currency === "XRP" ?
                "XRP · Native" :
                token?.isTrustlineOnly ?
                `${getCurrencyDescription(token?.currency)} · RLUSD allocation` :
                isStablecoin(token?.currency) ?
                "XRPL Stablecoin" :
                token?.currency === "XCS" ?
                "XCannes Token" :
                "XRPL Token"}
              </span>
            </div>
          </div>
          <div className="text-right text-[12px] text-primary">
            <div className="font-mono">
              {Number.isFinite(displayValue) ?
              displayValue.toLocaleString("en-US", {
                maximumFractionDigits: 4
              }) :
              "0"}
            </div>
            <div className="mt-0.5 text-[10px] text-muted font-normal">
              ≈{" "}
              {Number.isFinite(demoRlusd) ?
              demoRlusd.toLocaleString("en-US", {
                maximumFractionDigits: 2
              }) :
              "0"}{" "}{t("ui_rlusd_f36819f8e2", "RLUSD")}

            </div>
          </div>
        </div>
      </button>

      {currencyCode === "XRP" && isWalletActivated === false &&
      <div className="mt-1 rounded-md border border-blue-500/25 bg-blue-500/10 px-3 py-2">
          <p className="text-[11px] text-blue-200/90">{t("ui_for_activate_your_wallet_su_75416099a8", "Pour activer votre wallet sur le réseau XRPL, une réserve minimale de")}
          {" "}
            <span className="font-mono">{t("ui_1_xrp_5436c63b66", "1 XRP")}</span>{t("ui_est_requise_38539df503", "est requise.")}
        </p>
        </div>
      }

      {isMissingTrustline && (currencyCode === "RLUSD" || currencyCode === "XCS") &&
      <div className="mt-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-amber-200/90">{t("ui_currency_not_activated_f4", "Currency not activated")}

          </span>
            <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInstallTrustline?.(currencyCode);
            }}
            className="text-[11px] text-amber-100 underline underline-offset-2 hover:text-amber-50">{t("ui_activate_7f2974ed87", "Activer")}


          </button>
          </div>
          <p className="mt-1 text-[11px] text-amber-200/80">
            {currencyCode === "RLUSD" ?
          "Autorise RLUSD sur votre wallet." :
          "Elle permet de détenir du XCS et payer les frais XCANNES."}
          </p>
        </div>
      }
    </div>);

}
