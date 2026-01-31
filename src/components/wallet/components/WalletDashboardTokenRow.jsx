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
  isWalletActivated,
  onActivateWallet
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

  const showWalletActivationNotice =
  currencyCode === "XRP" && isWalletActivated === false;
  const showRlusdTrustlineNotice =
  currencyCode === "RLUSD" && isMissingTrustline;
  const showXcsTrustlineNotice =
  currencyCode === "XCS" && isMissingTrustline;

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
        className="w-full text-left">

        <div
          className={`flex items-center gap-3 rounded-md bg-base hover:bg-slate-800/40 border border-slate-800/60 px-3 py-2 transition-colors cursor-pointer ${tokenRowClass}`}>

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
          {showWalletActivationNotice ? (
            <div className="flex-1 min-w-0 px-2">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-blue-200/90 text-center leading-snug">
                <span>
                  <span className="hidden md:inline">
                    {t(
                      "ui_for_activate_your_wallet_su_75416099a8",
                      "Pour activer votre wallet sur le reseau XRPL, une reserve minimale de"
                    )}{" "}
                    <span className="font-mono">{t("ui_1_xrp_5436c63b66", "1 XRP")}</span>{" "}
                    {t("ui_est_requise_38539df503", "est requise.")}{" "}
                  </span>
                  <span className="md:hidden">
                    {t(
                      "ui_min_xrp_reserve_short_6c2a5f9b1d",
                      "Sur le reseau XRPL, une reserve minimale de"
                    )}{" "}
                    <span className="font-mono">{t("ui_1_xrp_5436c63b66", "1 XRP")}</span>{" "}
                    {t("ui_est_requis_5b9c2d7f1a", "est requis.")}{" "}
                  </span>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onActivateWallet?.();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onActivateWallet?.();
                    }
                  }}
                  className="text-blue-100 underline underline-offset-2 hover:text-blue-50 whitespace-nowrap">
                  {t("ui_activate_wallet_btn_7d6b90e42f", "Activer le wallet")}
                </span>
              </div>
            </div>
          ) : showRlusdTrustlineNotice ? (
            <div className="flex-1 min-w-0 px-2">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-amber-200/90 text-center leading-snug">
                <span>
                  <span className="hidden md:inline">
                    {t("ui_currency_not_activated_f4", "Devise non activée")}.{" "}
                    {t(
                      "ui_authorize_rlusd_wallet_2c1e5f9a",
                      "Autoriser RLUSD sur votre wallet."
                    )}
                  </span>
                  <span className="md:hidden">
                    {t(
                      "ui_authorize_rlusd_wallet_short_2c1e5f9d",
                      "Autoriser RLUSD sur votre wallet."
                    )}
                  </span>{" "}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onInstallTrustline?.(currencyCode);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onInstallTrustline?.(currencyCode);
                    }
                  }}
                  className="text-amber-100 underline underline-offset-2 hover:text-amber-50 whitespace-nowrap">
                  {t("ui_activate_7f2974ed87", "Activer")}
                </span>
              </div>
            </div>
          ) : showXcsTrustlineNotice ? (
            <div className="flex-1 min-w-0 px-2">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-white/90 md:text-amber-200/90 text-center leading-snug">
                <span>
                  <span className="hidden md:inline">
                    {t("ui_currency_not_activated_f4", "Devise non activée")}.{" "}
                    {t(
                      "ui_xcs_benefits_notice_2c1e5f9b",
                      "Elle permet de détenir du XCS et de profiter d'avantages."
                    )}
                  </span>
                  <span className="md:hidden">
                    {t(
                      "ui_xcs_benefits_notice_short_2c1e5f9c",
                      "Profiter d'avantages."
                    )}
                  </span>{" "}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onInstallTrustline?.(currencyCode);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onInstallTrustline?.(currencyCode);
                    }
                  }}
                  className="text-white underline underline-offset-2 hover:text-white/90 md:text-amber-100 md:hover:text-amber-50 whitespace-nowrap">
                  {t("ui_activate_7f2974ed87", "Activer")}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="text-right text-[12px] text-primary shrink-0">
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
      </div>

    </div>);

}
