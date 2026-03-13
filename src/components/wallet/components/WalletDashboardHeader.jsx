"use client";

import { useState, useRef, useEffect } from "react";
import WalletConnectButton from "@/components/wallet/WalletConnectButton";
import WalletSettingsDropdown from "@/components/wallet/components/WalletSettingsDropdown";
import WalletSetupDropdown from "@/components/wallet/components/WalletSetupDropdown";
import Link from "next/link";
import { useTranslation } from "next-i18next";

export default function WalletDashboardHeader({
  isConnected,
  wallet,
  totalLabel,
  totalInUsd,
  xrplConnectionIndicator,
  walletLabel,
  walletHeaderToast,
  onCopyAddress,
  onRefreshWallet,
  isConnecting,
  isRefreshing,
  isWalletLabelLocked,
  onOpenInfo,
  showMobileHomeLink = false,
  walletAddresses = [],
  onSwitchWallet,
  // Setup dropdown props
  isWalletActivated,
  hasRlusdTrustline,
  onActivateWallet,
  onConfirmSetup,
  activeAction,
  // Preferred currency props
  preferredCurrency,
  topCurrencies,
  fawazCurrencies,
  fawazLoading,
  onLoadFawazCurrencies,
  onPreferredCurrencyChange,
}) {
  const { t } = useTranslation("common");
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);
  const hasMultipleWallets = walletAddresses.length > 1;

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isSwitcherOpen) return;
    const handleClickOutside = (e) => {
      if (isSwitcherOpen && switcherRef.current && !switcherRef.current.contains(e.target)) {
        setIsSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSwitcherOpen]);

  return (
    <div
      className="panel-header flex flex-col shrink-0"
    >
      {/* Titres discrets en haut */}
      <div className="flex items-center justify-between mb-0 md:mb-3">
        <div className="flex items-center gap-3 min-w-0">
            {showMobileHomeLink && (
              <Link
                href="/"
                className="md:hidden inline-flex items-center justify-center h-8 w-8 text-white/70 hover:text-xcannes-green transition-colors"
                aria-label={t("nav_home", "Page d'accueil")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
            )}
          </div>
        {/* Bouton Connect (quand pas connecté) */}
        {!(isConnected && wallet) && (
          <WalletConnectButton small variant="statement-blue" />
        )}
      </div>

      {/* Solde et info wallet */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-lg md:text-sm text-white/55 tracking-[0.18em] uppercase mb-4 md:mb-0">
          {t("ui_total_balance_label_a91b6b8c1e", "Solde total")}
        </div>
        <p className="text-6xl md:text-5xl lg:text-6xl font-sans font-bold text-white tabular-nums tracking-tight">
          {totalLabel}
        </p>
        {Number.isFinite(totalInUsd) && totalInUsd > 0 && preferredCurrency && preferredCurrency !== "USD" && preferredCurrency !== "RLUSD" && (
          <p className="text-[11px] text-white/35 font-mono tabular-nums mt-0.5">
            {totalInUsd.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RLUSD
          </p>
        )}

        {/* ── Wallet setup dropdown (centralised activation steps) ── */}
        {isConnected && wallet && (
          <WalletSetupDropdown
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            walletLabel={walletLabel}
            isWalletLabelLocked={isWalletLabelLocked}
            onActivateWallet={onActivateWallet}
            onConfirmSetup={onConfirmSetup}
            activeAction={activeAction}
          />
        )}

        {/* Bloc wallet — sélecteur + copier + refresh */}
        {isConnected && wallet && (
          <div className="w-full mt-6 md:mt-1.5 px-2 flex justify-center">
            <div className="relative flex items-center gap-2 w-full max-w-[460px]">
              <div className="flex-1 min-w-0 rounded-md bg-black/20 px-2.5 py-1.5 shadow-none">
                <div className="flex items-start justify-between gap-3" ref={switcherRef}>
                  <div className="min-w-0 flex-1">
                    {/* Wallet name + address — clickable when multi-wallet */}
                    <button
                      type="button"
                      onClick={hasMultipleWallets ? () => setIsSwitcherOpen((v) => !v) : undefined}
                      className={`w-full text-left ${hasMultipleWallets ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`h-2 w-2 rounded-full ring-4 shrink-0 ${xrplConnectionIndicator.dotClass} ${xrplConnectionIndicator.ringClass} ${
                            xrplConnectionIndicator.pulse ? "animate-pulse" : ""
                          }`}
                          title={xrplConnectionIndicator.label}
                          aria-label={xrplConnectionIndicator.label}
                        />

                        <span className="text-[13px] md:text-[14px] font-semibold text-white/90 truncate">
                          {walletLabel || "Wallet"}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] text-white/55 truncate">
                          {wallet.slice(0, 10)}…{wallet.slice(-8)}
                        </span>
                        {walletHeaderToast ? (
                          <span className="text-[10px] text-xcannes-green/90">
                            {walletHeaderToast}
                          </span>
                        ) : null}
                      </div>
                    </button>

                    {/* Multi-wallet dropdown */}
                    {isSwitcherOpen && hasMultipleWallets && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1.5 rounded-lg bg-[#151b1e] border border-white/10 shadow-xl max-h-52 overflow-y-auto">
                        {walletAddresses.map((w, index) => {
                          const addr = typeof w === "string" ? w : w.address;
                          const label = typeof w === "string" ? null : w.label;
                          const isActive = addr === wallet;
                          const displayName = isActive
                            ? (walletLabel || label || `Wallet ${index + 1}`)
                            : (label || `Wallet ${index + 1}`);
                          return (
                            <button
                              key={addr}
                              type="button"
                              onClick={() => {
                                if (!isActive) onSwitchWallet?.(addr);
                                setIsSwitcherOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 transition-colors ${
                                isActive
                                  ? "bg-xcannes-green/10 border-l-2 border-xcannes-green"
                                  : "hover:bg-white/5 border-l-2 border-transparent"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full shrink-0 ${
                                  isActive ? "bg-xcannes-green" : "bg-white/20"
                                }`}
                              />
                              <div className="min-w-0">
                                <div
                                  className={`text-[13px] font-medium truncate ${
                                    isActive ? "text-xcannes-green" : "text-white/75"
                                  }`}
                                >
                                  {displayName}
                                </div>
                                <div
                                  className={`font-mono text-[12px] truncate ${
                                    isActive ? "text-xcannes-green/70" : "text-white/40"
                                  }`}
                                >
                                  {addr.slice(0, 10)}…{addr.slice(-8)}
                                </div>
                              </div>
                              {isActive && (
                                <span className="ml-auto text-[11px] text-xcannes-green/80 font-medium uppercase tracking-wider">
                                  {t("ui_active_wallet", "actif")}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Chevron — ouvre le sélecteur multi-wallet */}
                  {hasMultipleWallets && (
                    <button
                      type="button"
                      onClick={() => setIsSwitcherOpen((v) => !v)}
                      className="p-1 bg-transparent border border-transparent hover:bg-transparent text-white/50 hover:text-white rounded-md transition-all active:scale-95"
                      aria-label={t("ui_switch_wallet", "Changer de wallet")}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${isSwitcherOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Bouton Copier (extérieur) */}
              <button
                type="button"
                onClick={onCopyAddress}
                title={t("ui_copy_address_82d1cf6e94", "Copier l'adresse")}
                className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white transition-all active:scale-95"
                aria-label={t("ui_copy_xrpl_address_4f63ed10fc", "Copier l'adresse XRPL")}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>

              {/* Bouton Refresh (extérieur) */}
              <button
                type="button"
                onClick={onRefreshWallet}
                disabled={isConnecting || isRefreshing}
                title={t("ui_refresh_wallet_4c31d0ce7a", "Recharger le wallet")}
                className={`shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-transparent border border-transparent hover:bg-transparent transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                  isRefreshing
                    ? "text-xcannes-green hover:text-xcannes-green/90"
                    : "text-white/60 hover:text-white"
                }`}
                aria-label={t(
                  "ui_refresh_wallet_label_7b2d1a9c4e",
                  "Recharger le wallet",
                )}
              >
                <svg
                  className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.02.67-.07 1h2.02c.03-.33.05-.66.05-1 0-4.42-3.58-8-8-8zm-6.93 7H3.05c-.03.33-.05.66-.05 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-.34.02-.67.07-1z" />
                </svg>
              </button>

              {/* Bouton Paramètres (à côté du refresh, même style) */}
              <WalletSettingsDropdown
                position="inline"
                onOpenInfo={onOpenInfo}
                preferredCurrency={preferredCurrency}
                topCurrencies={topCurrencies}
                fawazCurrencies={fawazCurrencies}
                fawazLoading={fawazLoading}
                onLoadFawazCurrencies={onLoadFawazCurrencies}
                onPreferredCurrencyChange={onPreferredCurrencyChange}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
