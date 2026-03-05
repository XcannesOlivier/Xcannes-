"use client";

import { useState, useRef, useEffect } from "react";
import WalletConnectButton from "@/components/wallet/WalletConnectButton";
import WalletSettingsDropdown from "@/components/wallet/components/WalletSettingsDropdown";
import WalletSetupDropdown from "@/components/wallet/components/WalletSetupDropdown";
import Link from "next/link";
import { useTranslation } from "next-i18next";

export default function WalletDashboardHeader({
  layout,
  isConnected,
  wallet,
  onDisconnect,
  totalLabel,
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
  hideWalletAddress = false,
  walletAddresses = [],
  onSwitchWallet,
  // Setup dropdown props
  isWalletActivated,
  hasRlusdTrustline,
  onActivateWallet,
  onConfirmSetup,
  activeAction,
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
      className={`panel-header ${layout.headerClass} flex flex-col shrink-0`}
    >
      {/* Titres discrets en haut */}
      <div className="flex items-center justify-between mb-4 md:mb-3">
        {layout.showBrandTitle ? (
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
            <span className="hidden md:inline text-base font-orbitron font-semibold tracking-[0.2em] text-white/80 uppercase leading-none">
              {t("ui_xcannes_3cdc66a392", "XCANNES")}
            </span>
            <span className="hidden md:inline text-[11px] font-light text-white/30">
              |
            </span>
            <span className="hidden md:inline text-[14px] font-light italic text-white/40 truncate max-w-[160px] sm:max-w-none">
              {t("ui_global_usd_wallet_202f7e48be", "Multi-currency wallet")}
            </span>
          </div>
        ) : (
          <div />
        )}
        {/* Bouton Paramètres (desktop uniquement, sur mobile il est dans le footer) */}
        {isConnected && wallet ? (
          <WalletSettingsDropdown
            position="header"
            onDisconnect={onDisconnect}
            onCopyAddress={onCopyAddress}
            onRefreshWallet={onRefreshWallet}
            onOpenInfo={onOpenInfo}
            isConnecting={isConnecting}
            isRefreshing={isRefreshing}
            isWalletLabelLocked={isWalletLabelLocked}
          />
        ) : (
          <WalletConnectButton small variant="statement-blue" />
        )}
      </div>

      {/* Solde et info wallet */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-sm md:text-xs text-white/55 tracking-[0.18em] uppercase">
          {t("ui_total_balance_label_a91b6b8c1e", "Solde total")}
        </div>
        <p className="text-5xl md:text-4xl lg:text-5xl font-sans font-bold text-white tabular-nums tracking-tight">
          {totalLabel}
        </p>

        <a
          href="https://ripple.com/solutions/stablecoin/transparency/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-block text-[10px] text-white/40 hover:text-white/70 transition-colors"
        >
          {t(
            "ui_stablecoin_usd_r_gul_d_details_80d8d1ba32",
            "Stablecoin USD régulé (détails)",
          )}
        </a>

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
            <div className="flex items-center gap-2 w-full max-w-[460px]">
              <div className="flex-1 min-w-0 rounded-md bg-black/20 px-2.5 py-1.5 shadow-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1" ref={switcherRef}>
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

                        {hasMultipleWallets && (
                          <>
                            <span className="text-[10px] text-white/35 font-medium">
                              · {walletAddresses.length}
                            </span>
                            <svg
                              className={`w-3 h-3 text-white/40 shrink-0 transition-transform ${
                                isSwitcherOpen ? "rotate-180" : ""
                              }`}
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
                          </>
                        )}

                        {hideWalletAddress && walletHeaderToast ? (
                          <span className="text-[10px] text-xcannes-green/90 truncate">
                            {walletHeaderToast}
                          </span>
                        ) : null}
                      </div>

                      {!hideWalletAddress ? (
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
                      ) : null}
                    </button>

                    {/* Multi-wallet dropdown */}
                    {isSwitcherOpen && hasMultipleWallets && (
                      <div className="absolute z-50 left-0 right-0 mt-1.5 mx-2 max-w-[460px] rounded-lg bg-[#151b1e] border border-white/10 shadow-xl max-h-52 overflow-y-auto">
                        {walletAddresses.map((w) => {
                          const addr = typeof w === "string" ? w : w.address;
                          const label = typeof w === "string" ? null : w.label;
                          const isActive = addr === wallet;
                          return (
                            <button
                              key={addr}
                              type="button"
                              onClick={() => {
                                if (!isActive) onSwitchWallet?.(addr);
                                setIsSwitcherOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                                isActive
                                  ? "bg-xcannes-green/10 border-l-2 border-xcannes-green"
                                  : "hover:bg-white/5 border-l-2 border-transparent"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                  isActive ? "bg-xcannes-green" : "bg-white/20"
                                }`}
                              />
                              <div className="min-w-0">
                                {label && (
                                  <div
                                    className={`text-[11px] font-medium truncate ${
                                      isActive ? "text-xcannes-green" : "text-white/75"
                                    }`}
                                  >
                                    {label}
                                  </div>
                                )}
                                <div
                                  className={`font-mono text-[10px] truncate ${
                                    isActive ? "text-xcannes-green/70" : "text-white/40"
                                  }`}
                                >
                                  {addr.slice(0, 10)}…{addr.slice(-8)}
                                </div>
                              </div>
                              {isActive && (
                                <span className="ml-auto text-[9px] text-xcannes-green/80 font-medium uppercase tracking-wider">
                                  {t("ui_active_wallet", "actif")}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={onCopyAddress}
                      title={t(
                        "ui_copy_address_82d1cf6e94",
                        "Copier l'adresse",
                      )}
                      className="p-1 bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white rounded-md transition-all active:scale-95"
                      aria-label={t(
                        "ui_copy_xrpl_address_4f63ed10fc",
                        "Copier l'adresse XRPL",
                      )}
                    >
                      <svg
                        className="w-4 h-4"
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
                  </div>
                </div>
              </div>

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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
