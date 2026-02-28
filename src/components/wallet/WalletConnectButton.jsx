"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { useTranslation } from "next-i18next";

/**
 * WalletConnectButton — Generic wallet connect/disconnect button.
 *
 * Generic wallet connect/disconnect button. Works with any wallet provider
 * (native relay, PWA embedded, etc.) via the unified useWallet() hook.
 *
 * Props:
 *  - small       : compact sizing
 *  - variant     : "default" | "statement" | "statement-blue"
 *  - mode        : "full" (shows connected state + disconnect) | "single" (button only)
 *  - className   : override button class
 *  - connectedClassName : override connected button class (mode=single)
 *  - connectLabel / connectedLabel : override labels
 */
export default function WalletConnectButton({
  small = false,
  variant = "default",
  mode = "full",
  className = "",
  connectedClassName = "",
  connectLabel,
  connectedLabel,
}) {
  const { wallet, isConnected, isConnecting, connect, disconnect } =
    useWallet();
  const { t } = useTranslation("common");

  const handleConnectClick = () => {
    if (isConnected) return;
    connect();
  };

  // ── Connected state (mode = "full") ──────────────────────────
  if (isConnected && mode === "full") {
    return (
      <div className="inline-flex items-center gap-3">
        {/* Connected badge */}
        <div
          className={`flex items-center gap-3 ${
            small ? "px-4 py-2" : "px-6 py-3"
          } bg-xcannes-green/10 border border-xcannes-green/30 rounded-lg backdrop-blur-sm group`}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-xcannes-green animate-pulse" />
            <span
              className={`${
                small ? "text-xs" : "text-sm"
              } font-medium text-xcannes-green`}
            >
              {t("wallet_connected")}
            </span>
          </div>
          <span
            className={`${
              small ? "text-xs" : "text-sm"
            } font-mono text-white/60 group-hover:text-white`}
          >
            {wallet.slice(0, 6)}...{wallet.slice(-4)}
          </span>
        </div>

        {/* Disconnect button */}
        <button
          onClick={disconnect}
          className={`${
            small ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
          } bg-white/5 hover:bg-red-500/20 text-white/70 hover:text-red-400 border border-white/10 hover:border-red-500/40 rounded-lg font-medium transition-all duration-300`}
          aria-label={t(
            "ui_logout_wallet_558f860cac",
            "Se déconnecter du wallet",
          )}
        >
          <span className="hidden sm:inline">{t("wallet_disconnect")}</span>
          <span className="sm:hidden">✕</span>
        </button>
      </div>
    );
  }

  // ── Button class by variant ──────────────────────────────────
  const connectClass =
    variant === "statement"
      ? "px-4 py-1.5 text-sm md:text-xs bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green font-medium rounded-lg transition-all duration-200 border border-xcannes-green/30 hover:scale-105"
      : variant === "statement-blue"
        ? "px-4 py-1.5 text-sm md:text-xs bg-[#0f7fe1]/20 hover:bg-[#0f7fe1]/30 text-[#0f7fe1] font-medium rounded-lg transition-all duration-200 border border-[#0f7fe1]/40 hover:scale-105"
        : `${small ? "px-4 py-1.5 text-xs" : "px-5 py-2 text-sm"} bg-[#3052ff] hover:bg-[#2642d9] text-white font-medium rounded-lg transition-all duration-200`;

  // ── Single-button mode ───────────────────────────────────────
  if (mode === "single") {
    if (isConnected) {
      const resolvedClass = connectedClassName || connectClass;
      return (
        <button
          type="button"
          disabled
          className={resolvedClass}
          aria-label={t("ui_wallet_connect_2e772de308", "Wallet connecté")}
        >
          {connectedLabel || t("wallet_connected")}
        </button>
      );
    }

    return (
      <button
        onClick={handleConnectClick}
        disabled={isConnecting}
        className={`${className || connectClass} disabled:opacity-60 disabled:cursor-not-allowed`}
        aria-label={t(
          "ui_connect_your_wallet_xrpl_73361356ca",
          "Connecter votre wallet XRPL",
        )}
      >
        {isConnecting
          ? t("ui_connecting_2c59b8f12e", "Connecting...")
          : connectLabel || t("wallet_connect")}
      </button>
    );
  }

  // ── Default mode (not connected) ────────────────────────────
  return (
    <button
      onClick={handleConnectClick}
      disabled={isConnecting}
      className={`${className || connectClass} disabled:opacity-60 disabled:cursor-not-allowed`}
      aria-label={t(
        "ui_connect_your_wallet_xrpl_73361356ca",
        "Connecter votre wallet XRPL",
      )}
    >
      {isConnecting
        ? t("ui_connecting_2c59b8f12e", "Connecting...")
        : connectLabel || t("wallet_connect")}
    </button>
  );
}
