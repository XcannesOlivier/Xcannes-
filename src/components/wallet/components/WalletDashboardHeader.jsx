"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import WalletConnectButton from "@/components/wallet/WalletConnectButton";
import WalletSettingsDropdown from "@/components/wallet/components/WalletSettingsDropdown";
import WalletSetupDropdown from "@/components/wallet/components/WalletSetupDropdown";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { apiUrl } from "@/lib/runtimeConfig";
import {
  readWalletLabelCache,
  writeWalletLabelCache,
} from "../hooks/walletLabelCache";

function EyeIcon({ className = "h-4 w-4", slashed = false } = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
      <circle cx="12" cy="12" r="2.6" />
      {slashed ? <path d="M4 20L20 4" /> : null}
    </svg>
  );
}

function CopyIcon({ className = "h-4 w-4" } = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 9h10v12H9z" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

export default function WalletDashboardHeader({
  isConnected,
  wallet,
  totalLabel,
  totalInUsd,
  xrplConnectionIndicator,
  walletLabel,
  walletHeaderToast,
  isWalletLabelLocked,
  onOpenInfo,
  onOpenXrplActivity,
  onOpenSecurity,
  onOpenHelp,
  onOpenTerms,
  isDesktopPanel = false,
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
  allowedCurrencyCodes,
}) {
  const { t } = useTranslation("common");
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isSwitcherVisible, setIsSwitcherVisible] = useState(false);
  const [addressModes, setAddressModes] = useState({});
  const [copyToast, setCopyToast] = useState("");
  const copyToastTimerRef = useRef(null);
  const isSwitcherClosingRef = useRef(false);
  const didSwitchRef = useRef(false);
  const switcherRef = useRef(null);
  const selectorContainerRef = useRef(null);

  // ── Soft crossfade on balance change ──────────────────────
  const [shownLabel, setShownLabel] = useState(totalLabel);
  const [balanceFading, setBalanceFading] = useState(false);
  const prevLabelRef = useRef(totalLabel);
  useEffect(() => {
    if (totalLabel === prevLabelRef.current) return;
    prevLabelRef.current = totalLabel;
    setBalanceFading(true);
    const timer = setTimeout(() => {
      setShownLabel(totalLabel);
      setBalanceFading(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [totalLabel]);
  const hasMultipleWallets = useMemo(() => {
    const set = new Set();
    for (const w of walletAddresses || []) {
      const addr = typeof w === "string" ? w : w?.address;
      if (addr) set.add(addr);
    }
    if (wallet) set.add(wallet);
    return set.size > 1;
  }, [wallet, walletAddresses]);

  // Fade-out duration: slow (1800ms) after wallet switch, fast (100ms) otherwise

  const showCopyToast = (message) => {
    setCopyToast(message);
    if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    copyToastTimerRef.current = setTimeout(() => setCopyToast(""), 3000);
  };

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    };
  }, []);

  // Smooth open/close with two-phase state (mount → animate in, animate out → unmount)
  const openSwitcher = () => {
    isSwitcherClosingRef.current = false;
    didSwitchRef.current = false;
    setAddressModes({});
    setCopyToast("");
    setIsSwitcherOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setIsSwitcherVisible(true)));
  };
  const closeSwitcher = () => {
    if (isSwitcherClosingRef.current) return; // already closing
    isSwitcherClosingRef.current = true;
    setIsSwitcherVisible(false);
    setAddressModes({});
    setCopyToast("");
    const unmountDelay = didSwitchRef.current ? 1850 : 130;
    // Wait for the CSS transition to finish before unmounting
    setTimeout(() => {
      setIsSwitcherOpen(false);
      isSwitcherClosingRef.current = false;
      didSwitchRef.current = false;
    }, unmountDelay);
  };
  const toggleSwitcher = () => (isSwitcherOpen && !isSwitcherClosingRef.current ? closeSwitcher() : !isSwitcherOpen ? openSwitcher() : undefined);
  const [labelsByAddress, setLabelsByAddress] = useState({});

  const trimmed = useCallback((v) => String(v || "").trim(), []);

  const walletAddressSet = useMemo(() => {
    const set = new Set();
    for (const w of walletAddresses || []) {
      const addr = typeof w === "string" ? w : w?.address;
      if (addr) set.add(addr);
    }
    if (wallet) set.add(wallet);
    return set;
  }, [wallet, walletAddresses]);

  useEffect(() => {
    if (!isSwitcherOpen) return;
    closeSwitcher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  // Hydrate cached labels once (client-side).
  useEffect(() => {
    try {
      const cached = readWalletLabelCache();
      if (cached && Object.keys(cached).length > 0) {
        setLabelsByAddress((prev) => ({ ...cached, ...prev }));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seed/clean label map from walletAddresses and active walletLabel,
  // so the UI updates immediately on wallet switch.
  useEffect(() => {
    if (!hasMultipleWallets) return;
    setLabelsByAddress((prev) => {
      const next = { ...prev };
      for (const w of walletAddresses) {
        const addr = typeof w === "string" ? w : w?.address;
        const label = typeof w === "string" ? "" : trimmed(w?.label);
        if (addr && label) next[addr] = label;
      }
      const active = trimmed(walletLabel);
      if (wallet && active && isWalletLabelLocked) next[wallet] = active;
      for (const addr of Object.keys(next)) {
        if (!walletAddressSet.has(addr)) delete next[addr];
      }
      writeWalletLabelCache(next);
      return next;
    });
  }, [hasMultipleWallets, isWalletLabelLocked, walletAddresses, walletAddressSet, wallet, walletLabel, trimmed]);

  // Best-effort: resolve missing wallet labels in the background (prefetch).
  // In native relay mode, the multi-wallet list may not have labels.
  useEffect(() => {
    if (!hasMultipleWallets) return;

    let cancelled = false;
    const controller = new AbortController();

    const addrsToFetch = walletAddresses
      .map((w) => (typeof w === "string" ? w : w?.address))
      .filter(Boolean)
      .filter((addr) => {
        const entry = walletAddresses.find((w) =>
          typeof w === "string" ? w === addr : w?.address === addr,
        );
        const fromList = typeof entry === "string" ? "" : trimmed(entry?.label);
        if (fromList) return false;
        if (trimmed(labelsByAddress?.[addr])) return false;
        return true;
      });

    (async () => {
      // Fetch in parallel (small list) to reduce "late labels" feeling.
      await Promise.all(
        addrsToFetch.map(async (addr) => {
          if (cancelled) return;
          try {
            const res = await fetch(
              apiUrl(
                `/wallet/label?address=${encodeURIComponent(addr)}&allowFullReplay=false`,
              ),
              { signal: controller.signal },
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;
            const label = trimmed(data?.label);
            if (!label) return;
            if (cancelled) return;
            setLabelsByAddress((prev) => {
              const next = { ...prev, [addr]: label };
              writeWalletLabelCache(next);
              return next;
            });
          } catch {
            // ignore (offline/cancelled)
          }
        }),
      );
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMultipleWallets, walletAddresses, walletAddressSet, labelsByAddress]);

  const activeWalletLabel = useMemo(() => {
    const direct = trimmed(walletLabel);
    if (direct) return direct;
    const entry = walletAddresses.find((w) =>
      typeof w === "string" ? w === wallet : w?.address === wallet,
    );
    const fromList = typeof entry === "string" ? "" : trimmed(entry?.label);
    if (fromList) return fromList;
    const fromMap = trimmed(labelsByAddress?.[wallet]);
    if (fromMap) return fromMap;
    return "Compte";
  }, [labelsByAddress, wallet, walletAddresses, walletLabel, trimmed]);

  const otherWalletEntries = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const w of walletAddresses || []) {
      const addr = typeof w === "string" ? w : w?.address;
      if (!addr || addr === wallet) continue;
      if (seen.has(addr)) continue;
      seen.add(addr);
      const label =
        typeof w === "string" ? "" : trimmed(w?.label) || trimmed(labelsByAddress?.[addr]);
      out.push({ addr, label });
    }
    return out;
  }, [labelsByAddress, trimmed, wallet, walletAddresses]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isSwitcherOpen) return;
    const handleClickOutside = (e) => {
      if (isSwitcherOpen && switcherRef.current && !switcherRef.current.contains(e.target)) {
        closeSwitcher();
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") closeSwitcher();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isSwitcherOpen]);

  return (
    <div
      className="panel-header flex flex-col shrink-0 bg-[#111518] shadow-[inset_0_16px_28px_rgba(255,255,255,0.03),inset_0_-46px_70px_rgba(0,0,0,0.55)] px-3 pt-3 pb-2 md:px-5 md:pt-2 md:pb-2"
    >
      {/* Titres discrets en haut */}
      <div className="flex items-center justify-between mb-0 md:mb-1">
        <div className="flex items-center gap-3 min-w-0">
            {showMobileHomeLink && (
              <Link
                href="/"
                className="md:hidden inline-flex items-center justify-center h-8 w-8 text-white/80 hover:text-xcannes-green transition-colors"
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
        {/* Bloc wallet — sélecteur + copier + refresh + paramètres */}
        {isConnected && wallet && (
          <div className="w-full mt-0 md:mt-0 mb-1 md:mb-0 px-1 md:px-2 flex justify-start md:justify-between">
	            <div className="relative flex items-center gap-2.5 w-full md:w-full">

	              <div className={`flex-none min-w-0 rounded-[12px] px-2 md:px-3 py-1.5 md:py-2 relative z-[41] transition-all duration-150 ${isSwitcherVisible ? 'w-[260px] border-l border-r border-t border-white/20 rounded-b-none' : 'max-w-[220px] md:max-w-[360px]'}`} ref={selectorContainerRef}>
	                <div className="flex items-start justify-between gap-1.5" ref={switcherRef}>
                  <div className="min-w-0 flex-1">
                    {/* Wallet name + address — clickable when multi-wallet */}
                    <button
                      type="button"
                      onClick={hasMultipleWallets ? toggleSwitcher : undefined}
                      className={`w-full text-left ${hasMultipleWallets ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ring-[3px] shrink-0 ${xrplConnectionIndicator.dotClass} ${xrplConnectionIndicator.ringClass} ${
                            xrplConnectionIndicator.pulse ? "animate-pulse" : ""
                          }`}
                          title={xrplConnectionIndicator.label}
                          aria-label={xrplConnectionIndicator.label}
                        />

	                        <span className="text-[17px] md:text-[19px] font-light text-white/85 truncate">
	                          {activeWalletLabel.length > 11 ? activeWalletLabel.slice(0, 11) + '…' : activeWalletLabel}
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

                    {/* Multi-wallet dropdown — smooth animated */}
                    {isSwitcherOpen && hasMultipleWallets && (
                      <div
                        className={`absolute z-50 -left-px top-full mt-0 w-[260px] rounded-b-[12px] bg-[#0d1214] border-l border-r border-b border-white/20 shadow-[0_12px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.04),inset_1px_0_0_rgba(255,255,255,0.03),inset_-1px_0_0_rgba(255,255,255,0.03)] max-h-[70vh] md:max-h-[340px] overflow-y-auto overflow-x-hidden origin-top transition-all duration-[100ms] ${
                          isSwitcherVisible
                            ? "opacity-100 scale-y-100 translate-y-0 ease-[cubic-bezier(0.16,1,0.3,1)]"
                            : "opacity-0 scale-y-[0.92] -translate-y-1 ease-[cubic-bezier(0.4,0,1,1)]"
                        }`}
                        style={{ willChange: "transform, opacity" }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Active wallet address pinned at top */}
                        <div className="px-2.5 md:px-3 pt-2 pb-1.5">
                          {(() => {
                            const addressesVisible = Object.keys(addressModes || {}).length > 0;
                            const allAddresses = Array.from(
                              new Set(
                                [
                                  wallet,
                                  ...(walletAddresses || []).map((w) =>
                                    typeof w === "string" ? w : w?.address
                                  ),
                                ].filter(Boolean)
                              )
                            );

                            const toggleAllAddresses = () => {
                              setAddressModes((prev) => {
                                const isOn = Object.keys(prev || {}).length > 0;
                                if (isOn) return {};
                                const next = {};
                                for (const addr of allAddresses) next[addr] = "truncated";
                                return next;
                              });
                            };

                            if (!addressesVisible) {
                              return (
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    className="min-w-0 flex-1 text-left text-[13px] md:text-[14px] text-white/40 hover:text-white/60 transition-colors"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleAllAddresses();
                                    }}
                                    aria-label={t("ui_view_wallet_addresses", "Voir les adresses")}
                                  >
                                    {t("ui_view_wallet_addresses", "Voir les adresses")}
                                  </button>
                                  <button
                                    type="button"
                                    className="shrink-0 rounded-md bg-white/[0.06] p-1 text-white/35 hover:bg-white/[0.10] hover:text-white/55 transition-colors"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleAllAddresses();
                                    }}
                                    aria-label={t("ui_view_wallet_addresses", "Voir les adresses")}
                                  >
                                    <EyeIcon className="h-4 w-4" slashed={false} />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div className="flex items-start gap-2">
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <div className="text-[13px] md:text-[14px] text-white/60">
                                    {t("ui_view_wallet_addresses", "Voir les adresses")}
                                  </div>
                                  <button
                                    type="button"
                                    className="shrink-0 rounded-md bg-white/[0.06] p-1 text-white/35 hover:bg-white/[0.10] hover:text-white/55 transition-colors"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleAllAddresses();
                                    }}
                                    aria-label={t("ui_view_wallet_addresses", "Voir les adresses")}
                                  >
                                    <EyeIcon className="h-4 w-4" slashed />
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        {/* Address row for selected wallet (only when all addresses visible) */}
                        {Object.keys(addressModes || {}).length > 0 ? (
                          <div className="px-2.5 md:px-3 pb-1.5">
                            <div className="flex items-start gap-2">
                                <button
                                  type="button"
                                  className={`min-w-0 flex-1 text-left font-mono font-light text-[13px] md:text-[14px] leading-snug text-white/85 ${
                                    (addressModes?.[wallet] || "truncated") === "full"
                                      ? "whitespace-normal break-all"
                                      : "truncate"
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setAddressModes((prev) => ({
                                      ...(prev || {}),
                                      [wallet]:
                                        prev?.[wallet] === "full" ? "truncated" : "full",
                                    }));
                                  }}
                                  aria-label={t(
                                    "ui_toggle_wallet_address_truncation",
                                    "Afficher l'adresse complète"
                                  )}
                                >
                                  {(addressModes?.[wallet] || "truncated") === "full"
                                    ? wallet
                                    : `${wallet.slice(0, 8)}…${wallet.slice(-6)}`}
                                </button>

                                <button
                                  type="button"
                                  className="shrink-0 rounded-md p-1 text-white/45 hover:text-white/80 transition-colors"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                      await navigator.clipboard?.writeText?.(wallet);
                                      showCopyToast(t("ui_address_copied", "Adresse copiée"));
                                    } catch {
                                      /* ignore */
                                    }
                                  }}
                                  aria-label={t("ui_copy_wallet_address", "Copier l'adresse du wallet")}
                                >
                                  <CopyIcon className="h-4 w-4" />
                                </button>
                              </div>
                          </div>
                        ) : null}
                        <div className="px-2.5 md:px-3">
                          <div className="h-px w-full bg-white/10" aria-hidden />
                        </div>
                        <div className="px-2.5 md:px-3 pt-1.5">
                          <div
                            className={`text-[11px] md:text-[12px] text-xcannes-green/80 transition-opacity duration-200 ${
                              copyToast ? "opacity-100" : "opacity-0"
                            }`}
                            role="status"
                            aria-live="polite"
                          >
                            {copyToast || " "}
                          </div>
                        </div>
                        {/* Subtitle */}
                        <div className="px-2.5 md:px-3 pt-2 pb-1">
                          <div className="text-[13px] md:text-[14px] text-white/60">
                            Changer de compte
                          </div>
                        </div>

		                        {otherWalletEntries.map((entry, index) => {
		                          const addr = entry.addr;
		                          const label = entry.label;
	                          const displayName = label || `Compte ${index + 1}`;
	                          const addressesVisible = Object.keys(addressModes || {}).length > 0;
	                          const mode = addressModes?.[addr] || "truncated";
	                          const displayAddress =
	                            mode === "full"
	                              ? addr
	                              : `${addr.slice(0, 8)}…${addr.slice(-6)}`;
                          return (
                            <div
                              key={addr}
                              onClick={() => {
                                onSwitchWallet?.(addr);
                                didSwitchRef.current = true;
                                closeSwitcher();
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter" && e.key !== " ") return;
                                e.preventDefault();
                                onSwitchWallet?.(addr);
                                didSwitchRef.current = true;
                                closeSwitcher();
                              }}
                              role="button"
                              tabIndex={0}
                              className="w-full text-left px-2.5 md:px-3 py-2.5 flex items-center gap-2 transition-colors duration-150 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                            >
                              <span
                                className="h-2 w-2 rounded-full shrink-0 transition-colors duration-150 bg-white/20 opacity-0"
                              />
		                              <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2 min-w-0">
    		                                <div
    		                                  className="text-[16px] md:text-[17px] font-light truncate text-white/80 min-w-0"
    		                                >
    		                                  {displayName}
    		                                </div>
                                    </div>
                                    {!addressesVisible ? null : (
                                      <div className="mt-0.5 flex items-start gap-2">
        		                                <button
                                          type="button"
                                          className={`min-w-0 flex-1 text-left font-mono font-light text-[13px] md:text-[14px] leading-snug text-white/70 ${
                                            mode === "full" ? "whitespace-normal break-all" : "truncate"
                                          }`}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setAddressModes((prev) => ({
                                              ...(prev || {}),
                                              [addr]:
                                                prev?.[addr] === "full" ? "truncated" : "full",
                                            }));
                                          }}
                                          aria-label={t(
                                            "ui_toggle_wallet_address_truncation",
                                            "Afficher l'adresse complète"
                                          )}
                                        >
        		                                  {displayAddress}
        		                                </button>
                                        <button
                                          type="button"
                                          className="shrink-0 rounded-md p-1 text-white/45 hover:text-white/80 transition-colors"
                                          onClick={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            try {
                                              await navigator.clipboard?.writeText?.(addr);
                                              showCopyToast(t("ui_address_copied", "Adresse copiée"));
                                            } catch {
                                              /* ignore */
                                            }
                                          }}
                                          aria-label={t("ui_copy_wallet_address", "Copier l'adresse du wallet")}
                                        >
                                          <CopyIcon className="h-4 w-4" />
                                        </button>
                                      </div>
                                    )}
		                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Chevron — ouvre le sélecteur multi-wallet */}
                  {hasMultipleWallets && (
                    <button
                      type="button"
                      onClick={toggleSwitcher}
                      className="p-0.5 bg-transparent border border-transparent hover:bg-transparent text-white/55 hover:text-white/80 rounded-md transition-all active:scale-95"
                      aria-label={t("ui_switch_wallet", "Changer de wallet")}
                    >
                      <svg
                        className={`w-[16px] h-[16px] transition-transform duration-[550ms] ${isSwitcherVisible ? "rotate-180 ease-[cubic-bezier(0.16,1,0.3,1)]" : "ease-[cubic-bezier(0.4,0,1,1)]"}`}
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

              {/* Copier / Refresh removed (mobile UI simplification) */}

              {/* Bouton Paramètres (à côté du refresh, même style) */}
              <div className="ml-auto">
              <div className="lg:hidden">
              <WalletSettingsDropdown
                position="inline"
                isDesktopPanel={isDesktopPanel}
                onOpenInfo={onOpenInfo}
                onOpenXrplActivity={onOpenXrplActivity}
                onOpenSecurity={onOpenSecurity}
                onOpenHelp={onOpenHelp}
                onOpenTerms={onOpenTerms}
                preferredCurrency={preferredCurrency}
                topCurrencies={topCurrencies}
                fawazCurrencies={fawazCurrencies}
                fawazLoading={fawazLoading}
                onLoadFawazCurrencies={onLoadFawazCurrencies}
                onPreferredCurrencyChange={onPreferredCurrencyChange}
                allowedCurrencyCodes={allowedCurrencyCodes}
              />
              </div>
              <div className="hidden lg:flex items-center">
                <Link
                  href="/"
                  className="flex items-center gap-1.5 text-[13px] text-white/45 hover:text-white/80 transition-colors px-2.5 py-1.5 rounded-lg"
                  title="Retour à l'accueil"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 2v6" />
                    <path d="M6.8 6.8a8 8 0 1 0 10.4 0" />
                  </svg>
                  <span>Déconnexion</span>
                </Link>
              </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-[21px] md:text-[27px] text-white/55 mb-0.5 md:mb-0">
          {t("ui_total_balance_label_a91b6b8c1e", "Solde total")}
        </div>
        <p
          className="text-6xl md:text-6xl lg:text-7xl font-sans font-light text-white tabular-nums tracking-tight leading-none transition-opacity duration-[180ms]"
          style={{ opacity: balanceFading ? 0 : 1 }}
        >
          {shownLabel}
        </p>
        {Number.isFinite(totalInUsd) &&
          totalInUsd > 0 &&
          preferredCurrency &&
          preferredCurrency !== "RLUSD" && (
            <button
              type="button"
              onClick={onOpenInfo}
              className="text-[11px] md:text-sm text-white/50 hover:text-white/70 transition-colors duration-150 mt-0.5 mb-1 md:mb-0 cursor-pointer"
            >
              Devises numériques
            </button>
          )}

        {/* ── Wallet setup dropdown (centralised activation steps) ── */}
        {isConnected && wallet && (
          <WalletSetupDropdown
            key={wallet}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            walletLabel={walletLabel}
            isWalletLabelLocked={isWalletLabelLocked}
            onActivateWallet={onActivateWallet}
            onConfirmSetup={onConfirmSetup}
            activeAction={activeAction}
          />
        )}
      </div>
    </div>
  );
}
