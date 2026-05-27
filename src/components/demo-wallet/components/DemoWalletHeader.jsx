/**
 * DemoWalletHeader — brand row, total balance, wallet meta bar, label editor & reset button.
 *
 * Extracted from DemoWalletDashboard to keep the main component lean.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { formatMoney, formatDemoAddressShort } from "../utils/demoWalletHelpers";
import DemoWalletSettingsDropdown from "./demoWalletsettingsDropdown";

export default function DemoWalletHeader({
  locale,
  displayAmount,
  displayCurrency,
  totalInRlusd,
  walletContextLabel,
  wallet,
  onOpenInfo,
  preferredCurrency,
  topCurrencies,
  fawazCurrencies,
  fawazLoading,
  onLoadFawazCurrencies,
  onPreferredCurrencyChange,
  walletHeaderToast,
  handleCopyWalletAddress,
  walletAddresses = [],
  activeWalletId,
  onSwitchWallet,
  handleRefreshWallet,
  isRefreshing,
}) {
  const { t } = useTranslation("common");
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);
  const hasMultipleWallets = (walletAddresses || []).length > 1;

  const resolvedWalletLabel =
    String(walletContextLabel || "").trim() || t("nav_wallet", "Wallet");
  const shortWalletLabel =
    resolvedWalletLabel.length > 13
      ? `${resolvedWalletLabel.slice(0, 13)}…`
      : resolvedWalletLabel;

  useEffect(() => {
    if (!isSwitcherOpen) return;
    const handler = (e) => {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(e.target)
      ) {
        setIsSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isSwitcherOpen]);

  return (
    <div className="panel-header flex flex-col shrink-0 bg-[#111518] shadow-[inset_0_16px_28px_rgba(255,255,255,0.03),inset_0_-46px_70px_rgba(0,0,0,0.55)] px-4 pt-4 pb-3">
      <div className="flex flex-col items-center gap-3">
        <div className="w-full mb-2 flex justify-start">
          <div className="relative flex items-center gap-2.5 w-full">
            <div
              className={[
                "flex-none min-w-0 rounded-[14px] px-3 py-2 relative z-[41] transition-all duration-150",
                "bg-[#0d1214] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                isSwitcherOpen
                  ? "w-[280px] border-l border-r border-t border-white/20 rounded-b-none"
                  : "max-w-[280px]",
              ].join(" ")}
              ref={switcherRef}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={
                      hasMultipleWallets
                        ? () => setIsSwitcherOpen((v) => !v)
                        : undefined
                    }
                    className={`w-full text-left ${
                      hasMultipleWallets ? "cursor-pointer" : "cursor-default"
                    }`}
                    aria-haspopup={hasMultipleWallets ? "menu" : undefined}
                    aria-expanded={hasMultipleWallets ? isSwitcherOpen : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full ring-[3px] shrink-0 bg-xcannes-green ring-xcannes-green/20 animate-pulse"
                        title={t("demo_xrpl_indicator", "XRPL (démo)")}
                        aria-label={t("demo_xrpl_indicator", "XRPL (démo)")}
                      />
                      <span className="min-w-0 flex items-center gap-2">
                        <span className="text-[18px] font-semibold text-white/85 truncate">
                          {shortWalletLabel}
                        </span>
                        <svg
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            isSwitcherOpen ? "rotate-180" : ""
                          } ${hasMultipleWallets ? "text-white/55" : "text-white/30"}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </span>
                    </div>

                    {walletHeaderToast ? (
                      <div className="mt-0.5 flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-xcannes-green/90">
                          {walletHeaderToast}
                        </span>
                      </div>
                    ) : null}
                  </button>

                  {!hasMultipleWallets && wallet ? (
                    <div className="mt-0.5 flex items-center gap-2 min-w-0">
                      <span
                        className="font-mono text-[10px] text-white/45 truncate"
                        title={t(
                          "demo_tt_wallet_address",
                          "Adresse XRPL du wallet.",
                        )}
                      >
                        {formatDemoAddressShort(wallet)}
                      </span>
                    </div>
                  ) : null}

                  {hasMultipleWallets && isSwitcherOpen ? (
                    <div className="absolute z-50 -left-px top-full mt-0 w-[280px] rounded-b-[14px] bg-[#0d1214] border-l border-r border-b border-white/20 shadow-[0_12px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.04)] max-h-[70vh] overflow-y-auto overflow-x-hidden">
                      {(walletAddresses || []).map((w) => {
                        const id = String(w?.id || "").toUpperCase();
                        const isActive =
                          id === String(activeWalletId || "").toUpperCase();
                        const displayName =
                          String(w?.label || "").trim() ||
                          `${t("demo_wallet_label", "Wallet")} ${id}`;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setIsSwitcherOpen(false);
                              if (!isActive) onSwitchWallet?.(id);
                            }}
                            className={[
                              "w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 transition-colors border-l-2",
                              isActive
                                ? "bg-xcannes-green/10 border-xcannes-green"
                                : "hover:bg-white/5 border-transparent",
                            ].join(" ")}
                          >
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                isActive ? "bg-xcannes-green" : "bg-white/20"
                              }`}
                            />
                            <div className="min-w-0">
                              <div
                                className={`text-[13px] font-medium truncate ${
                                  isActive
                                    ? "text-xcannes-green"
                                    : "text-white/80"
                                }`}
                              >
                                {displayName}
                              </div>
                              <div
                                className={`font-mono text-[12px] truncate ${
                                  isActive
                                    ? "text-xcannes-green/70"
                                    : "text-white/40"
                                }`}
                              >
                                {(w?.address || "").slice(0, 10)}…
                                {(w?.address || "").slice(-8)}
                              </div>
                            </div>
                            {isActive ? (
                              <span className="ml-auto text-[11px] text-xcannes-green/80 font-medium uppercase tracking-wider">
                                {t("ui_active_wallet", "actif")}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="ml-auto">
              <DemoWalletSettingsDropdown
                onOpenInfo={onOpenInfo}
                preferredCurrency={preferredCurrency}
                topCurrencies={topCurrencies}
                fawazCurrencies={fawazCurrencies}
                fawazLoading={fawazLoading}
                onLoadFawazCurrencies={onLoadFawazCurrencies}
                onPreferredCurrencyChange={onPreferredCurrencyChange}
                onCopyAddress={handleCopyWalletAddress}
                onResetDemo={handleRefreshWallet}
                resetDisabled={isRefreshing}
              />
            </div>
          </div>
        </div>

        <div className="text-[22px] text-white/55 mb-1">
          {t("ui_total_balance_label_a91b6b8c1e", "Solde total")}
        </div>
        <p
          className="text-6xl font-sans font-bold text-white tabular-nums tracking-tight leading-none"
          title={t("demo_tt_balance", "Total converti en USD (démo).")}
        >
          {formatMoney(locale, displayAmount, displayCurrency)}
        </p>
        {Number.isFinite(totalInRlusd) &&
        totalInRlusd > 0 &&
        displayCurrency &&
        displayCurrency !== "USD" &&
        displayCurrency !== "RLUSD" ? (
          <div className="text-[11px] text-white/50 mt-0.5 mb-1 inline-flex items-center gap-2">
            <span>
              {totalInRlusd.toLocaleString("en", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              RLUSD
            </span>
            <button
              type="button"
              onClick={onOpenInfo}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/3 hover:bg-white/5 ring-1 ring-white/10 hover:ring-white/15 text-white/55 hover:text-white/75 transition-colors"
              aria-label={t("ui_info", "Informations")}
              title={t("ui_info", "Informations")}
            >
              <span className="text-[12px] leading-none font-semibold">i</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
	  );
	}
