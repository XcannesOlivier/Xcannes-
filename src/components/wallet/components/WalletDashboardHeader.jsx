"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import WalletConnectButton from "@/components/wallet/WalletConnectButton";
import WalletSettingsDropdown from "@/components/wallet/components/WalletSettingsDropdown";
import WalletSetupDropdown from "@/components/wallet/components/WalletSetupDropdown";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { apiUrl } from "@/lib/runtimeConfig";

// ── Local label cache (best-effort) ──────────────────────────────────────────
const LABEL_CACHE_KEY = "xcannes_wallet_labels_v1";
const LABEL_CACHE_TTL_MS = 10 * 60_000; // 10 minutes

function readLabelCache() {
  try {
    const raw = localStorage.getItem(LABEL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const now = Date.now();
    const out = {};
    for (const [addr, entry] of Object.entries(parsed)) {
      const label = String(entry?.label || "").trim();
      const ts = Number(entry?.ts || 0);
      if (!addr || !label) continue;
      if (!Number.isFinite(ts) || now - ts > LABEL_CACHE_TTL_MS) continue;
      out[addr] = label;
    }
    return out;
  } catch {
    return {};
  }
}

function writeLabelCache(labelsByAddress) {
  try {
    const now = Date.now();
    const payload = {};
    for (const [addr, label] of Object.entries(labelsByAddress || {})) {
      const t = String(label || "").trim();
      if (!addr || !t) continue;
      payload[addr] = { label: t, ts: now };
    }
    localStorage.setItem(LABEL_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

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
}) {
  const { t } = useTranslation("common");
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);
  const hasMultipleWallets = walletAddresses.length > 1;
  const [labelsByAddress, setLabelsByAddress] = useState({});

  const trimmed = (v) => String(v || "").trim();

  const walletAddressSet = useMemo(() => {
    const set = new Set();
    for (const w of walletAddresses) {
      const addr = typeof w === "string" ? w : w?.address;
      if (addr) set.add(addr);
    }
    return set;
  }, [walletAddresses]);

  // Hydrate cached labels once (client-side).
  useEffect(() => {
    try {
      const cached = readLabelCache();
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
      if (wallet && active) next[wallet] = active;
      for (const addr of Object.keys(next)) {
        if (!walletAddressSet.has(addr)) delete next[addr];
      }
      writeLabelCache(next);
      return next;
    });
  }, [hasMultipleWallets, walletAddresses, walletAddressSet, wallet, walletLabel]);

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
              writeLabelCache(next);
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
    return "Wallet";
  }, [labelsByAddress, wallet, walletAddresses, walletLabel]);

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
          <div className="w-full mt-1 md:mt-1.5 mb-4 md:mb-3 px-1 md:px-2 flex justify-center">
	            <div className="relative flex items-center gap-2.5 w-full max-w-[520px]">
	              {isSwitcherOpen && hasMultipleWallets ? (
	                <div
	                  className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1.5px]"
	                  aria-hidden="true"
	                  onClick={() => setIsSwitcherOpen(false)}
	                />
	              ) : null}
	              <div className="flex-1 min-w-0 rounded-md bg-white/[0.02] px-3 py-2 shadow-none">
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

	                        <span className="text-[18px] md:text-[19px] font-semibold text-white/90 truncate">
	                          {activeWalletLabel}
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

	                    {/* Multi-wallet dropdown */}
	                    {isSwitcherOpen && hasMultipleWallets && (
	                      <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-[min(560px,calc(100vw-24px))] rounded-xl bg-elevated border border-white/10 shadow-[0_28px_90px_rgba(0,0,0,0.6)] max-h-[340px] overflow-y-auto">
	                        {walletAddresses.map((w, index) => {
	                          const addr = typeof w === "string" ? w : w.address;
                          const label =
                            typeof w === "string"
                              ? ""
                              : trimmed(w?.label) || trimmed(labelsByAddress?.[addr]);
                          const isActive = addr === wallet;
                          const displayName = isActive
                            ? (activeWalletLabel || label || `Wallet ${index + 1}`)
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
		                                  className={`text-[16px] md:text-[17px] font-medium truncate ${
		                                    isActive ? "text-xcannes-green" : "text-white/80"
		                                  }`}
		                                >
		                                  {displayName}
		                                </div>
		                                <div
		                                  className={`font-mono text-[13px] md:text-[14px] whitespace-normal break-all leading-snug ${
		                                    isActive ? "text-xcannes-green/70" : "text-white/40"
		                                  }`}
		                                >
		                                  {addr}
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
                      className="p-1 bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white rounded-md transition-all active:scale-95"
                      aria-label={t("ui_switch_wallet", "Changer de wallet")}
                    >
                      <svg
                        className={`w-[18px] h-[18px] transition-transform ${isSwitcherOpen ? "rotate-180" : ""}`}
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
                className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white transition-all active:scale-95"
                aria-label={t("ui_copy_xrpl_address_4f63ed10fc", "Copier l'adresse XRPL")}
              >
                <svg
                  className="w-[22px] h-[22px]"
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
                className={`shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-transparent border border-transparent hover:bg-transparent transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
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
                  className={`w-[22px] h-[22px] ${isRefreshing ? "animate-spin" : ""}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.02.67-.07 1h2.02c.03-.33.05-.66.05-1 0-4.42-3.58-8-8-8zm-6.93 7H3.05c-.03.33-.05.66-.05 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-.34.02-.67.07-1z" />
                </svg>
              </button>

              {/* Bouton Paramètres (à côté du refresh, même style) */}
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
              />
            </div>
          </div>
        )}

        <div className="text-lg md:text-sm text-white/60 tracking-[0.18em] uppercase mb-4 md:mb-0">
          {t("ui_total_balance_label_a91b6b8c1e", "Solde total")}
        </div>
        <p className="text-6xl md:text-5xl lg:text-6xl font-sans font-bold text-white tabular-nums tracking-tight">
          {totalLabel}
        </p>
        {Number.isFinite(totalInUsd) && totalInUsd > 0 && preferredCurrency && preferredCurrency !== "USD" && preferredCurrency !== "RLUSD" && (
          <p className="text-[11px] text-white/40 font-mono tabular-nums mt-0.5">
            {totalInUsd.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RLUSD
          </p>
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
