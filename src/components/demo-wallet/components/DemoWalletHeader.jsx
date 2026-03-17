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
    <div className="panel-header">
      <div className="mt-2 flex flex-col items-center gap-2">
        <div className="text-lg md:text-sm text-white/60 tracking-[0.18em] uppercase mb-4 md:mb-0">
          {t("ui_total_balance_label_a91b6b8c1e", "Solde total")}
        </div>
        <p
          className="text-6xl md:text-5xl lg:text-6xl font-sans font-bold text-white tabular-nums tracking-tight"
          title={t("demo_tt_balance", "Total converti en USD (démo).")}
        >
          {formatMoney(locale, displayAmount, displayCurrency)}
        </p>
        {Number.isFinite(totalInRlusd) &&
        totalInRlusd > 0 &&
        displayCurrency &&
        displayCurrency !== "USD" &&
        displayCurrency !== "RLUSD" ? (
          <p className="text-[11px] text-white/40 font-mono tabular-nums mt-0.5">
            {totalInRlusd.toLocaleString("en", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            RLUSD
          </p>
        ) : null}

        <div className="w-full mt-1.5 flex justify-center">
          <div className="flex items-center gap-2 w-full max-w-[460px] md:max-w-[520px]">
            <div
              className="relative flex-1 min-w-0 rounded-md bg-black/20 px-2.5 py-1.5 shadow-none"
              ref={switcherRef}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Wallet label + address */}
                <button
                  type="button"
                  onClick={
                    hasMultipleWallets
                      ? () => setIsSwitcherOpen((v) => !v)
                      : undefined
                  }
                  className={[
                    "w-full text-left min-w-0 flex-1",
                    hasMultipleWallets ? "cursor-pointer" : "cursor-default",
                  ].join(" ")}
                  aria-haspopup={hasMultipleWallets ? "menu" : undefined}
                  aria-expanded={hasMultipleWallets ? isSwitcherOpen : undefined}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] md:text-[14px] font-semibold text-white/90 truncate">
                        {walletContextLabel || t("nav_wallet", "Wallet")}
                      </span>
                      {walletHeaderToast ? (
                        <span className="text-[10px] text-xcannes-green/90 truncate">
                          {walletHeaderToast}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 min-w-0">
                      <span
                        className="font-mono text-[10px] text-white/60 truncate"
                        title={t(
                          "demo_tt_wallet_address",
                          "Adresse XRPL du wallet.",
                        )}
                      >
                        {formatDemoAddressShort(wallet)}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Chevron — same as real wallet */}
                {hasMultipleWallets ? (
                  <button
                    type="button"
                    onClick={() => setIsSwitcherOpen((v) => !v)}
                    className="p-1 bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white rounded-md transition-all active:scale-95"
                    aria-label={t("ui_switch_wallet", "Changer de wallet")}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${
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
                  </button>
                ) : null}
              </div>

              {hasMultipleWallets && isSwitcherOpen ? (
                <div className="absolute z-50 left-0 right-0 top-full mt-1.5 rounded-lg bg-[#151b1e] border border-white/10 shadow-xl max-h-52 overflow-y-auto">
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
                              isActive ? "text-xcannes-green" : "text-white/80"
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

            <button
              type="button"
              onClick={handleCopyWalletAddress}
              title={t("ui_copy_address_82d1cf6e94", "Copier l'adresse")}
              className="shrink-0 z-10 h-9 w-9 flex items-center justify-center rounded-lg bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white transition-all active:scale-95"
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

	            <button
	              type="button"
	              onClick={handleRefreshWallet}
              disabled={isRefreshing}
              title={t("demo_tt_reset", "Réinitialiser la démo.")}
              aria-label={t("demo_reset", "Réinitialiser")}
              className={`shrink-0 z-10 h-9 w-9 flex items-center justify-center rounded-lg bg-transparent border border-transparent hover:bg-transparent transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                isRefreshing
                  ? "text-xcannes-green hover:text-xcannes-green/90"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <svg
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.02.67-.07 1h2.02c.03-.33.05-.66.05-1 0-4.42-3.58-8-8-8zm-6.93 7H3.05c-.03.33-.05.66-.05 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-.34.02-.67.07-1z" />
              </svg>
	            </button>

	            <DemoWalletSettingsDropdown
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
	      </div>
	    </div>
  );
}
