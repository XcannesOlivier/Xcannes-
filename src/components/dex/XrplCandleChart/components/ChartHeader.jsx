"use client";

import { useEffect, useMemo } from "react";
import FxPairSelector from "./FxPairSelector";
import { lockBodyScroll } from "@/utils/bodyScrollLock";

// En-tête compact original du chart (prix + sélecteurs)
import { useTranslation } from "next-i18next";

export default function ChartHeader({
  pair,
  interval,
  onPairChange,
  onIntervalChange,
  availableIntervals,
  uniquePairs,
  filteredMarketStructure,
  isFxMode,
  fxBase,
  fxQuote,
  fxInfo,
  setFxBase,
  setFxQuote,
  currentPrice,
  percent24h,
  showTooltips,
  dropdownOpen,
  setDropdownOpen,
  handlePairSelect,
  dropdownRef,
  chartType,
  setChartType,
  timeScaleRef,
  showSettings,
  setShowSettings,
  chartSettings,
  setChartSettings
}) {
  const { t } = useTranslation("common");
  const popularLivePairs = useMemo(() => {
    const pyth = filteredMarketStructure?.pyth?.currencies;
    const pythPairs = pyth ? Object.values(pyth).flat() : [];
    const preferredOrder = [
      "EUR/USD",
      "USD/CNH",
      "GBP/USD",
      "USD/JPY",
      "USD/CHF",
      "USD/AUD",
      "USD/CAD",
      "USD/INR",
      "EUR/GBP"
    ];
    const uniquePyth = Array.from(new Set(pythPairs));
    const preferred = preferredOrder.filter((p) => uniquePyth.includes(p));
    const rest = uniquePyth.
    filter((p) => !preferred.includes(p)).
    sort((a, b) => a.localeCompare(b));
    return [...preferred, ...rest];
  }, [filteredMarketStructure]);
  const xrplPairs = useMemo(() => {
    const xrpl = filteredMarketStructure?.xrpl?.currencies;
    if (!xrpl) return [];
    return Object.values(xrpl).flat();
  }, [filteredMarketStructure]);
  const pairStatusLabel = isFxMode ?
  t("ui_daily_rate_4f4a2c7a6d", "Taux quotidien") :
  t("ui_live_a633f195c7", "En direct");
  // Accessibilité : fermer les menus sur Escape
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        if (setShowSettings) setShowSettings(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setDropdownOpen, setShowSettings]);

  // Accessibilité : focus trap dans le dropdown paires
  useEffect(() => {
    if (!dropdownOpen || !dropdownRef?.current) return;
    const container = dropdownRef.current;
    const focusables = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    const onKeyDown = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    first.focus();
    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [dropdownOpen, dropdownRef]);

  // Accessibilité : focus trap dans le menu settings
  useEffect(() => {
    if (!showSettings || !dropdownRef?.current) return;
    const menu = document.getElementById("chart-settings-menu");
    if (!menu) return;
    const focusables = menu.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    const onKeyDown = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    first.focus();
    menu.addEventListener("keydown", onKeyDown);
    return () => menu.removeEventListener("keydown", onKeyDown);
  }, [showSettings, dropdownRef]);

  useEffect(() => {
    if (!dropdownOpen) return;
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;
    return lockBodyScroll();
  }, [dropdownOpen]);

  return (
    <div className="border-b-0 md:border-b border-subtle border-l-0 border-r-0 px-3 py-2 max-sm:px-2 max-sm:pt-px max-sm:pb-1.5 bg-elevated">
      <div className="flex items-center justify-between gap-3 max-sm:gap-1.5 max-sm:flex-col max-sm:items-stretch">
        {/* Prix actuel + paire (zone hero) */}
        <div className="flex items-baseline gap-3 max-sm:gap-1.5 max-sm:justify-center max-sm:w-full">
          <div
            ref={dropdownRef}
            className="flex flex-col max-sm:items-center max-sm:text-center relative">

            {onPairChange ?
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              aria-controls="pair-dropdown"
              className="inline-flex items-center gap-1 text-primary hover:text-accent-rlusd transition-colors">

                <span className="font-orbitron font-semibold text-xl md:text-sm tracking-[0.14em] uppercase">
                  {isFxMode ? `${fxBase}/${fxQuote}` : pair}
                </span>
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  isFxMode ?
                  "bg-white/5 text-white/60" :
                  "bg-xcannes-green/15 text-xcannes-green"}`
                  }>
                  {pairStatusLabel}
                </span>
                <svg
                className={`w-3 h-3 transition-transform ${
                dropdownOpen ? "rotate-180" : ""}`
                }
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">

                  <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7" />

                </svg>
              </button> :

            <h2 className="font-orbitron font-semibold text-primary text-xl md:text-sm tracking-[0.14em] uppercase">
                {isFxMode ? `${fxBase}/${fxQuote}` : pair}
              </h2>
            }
            {(isFxMode ? fxInfo.price : currentPrice) &&
            <div className="flex items-baseline gap-2 max-sm:gap-1">
                <span className="font-semibold text-primary text-xl md:text-lg">
                  {(isFxMode ? fxInfo.price : currentPrice)?.toFixed(5)}
                </span>
                {(!isFxMode || fxInfo.changePercent != null) &&
              <span
                className={`text-sm md:text-xs font-medium ${
                (isFxMode ? fxInfo.changePercent : percent24h.percent) >=
                0 ?
                "text-price-up" :
                "text-price-down"}`
                }
                title={
                isFxMode ?
                "Variation quotidienne" :
                "Évolution sur 24h"
                }>

                    {(isFxMode ?
                fxInfo.changePercent :
                percent24h.percent) >= 0 ?
                "+" :
                ""}
                    {(isFxMode ?
                fxInfo.changePercent :
                percent24h.percent)?.
                toFixed(2)}
                    %
                  </span>
              }
              </div>
            }
            {/* Dropdown principal sous le nom de paire */}
            <>
              <div
                className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-700 ${
                  dropdownOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setDropdownOpen(false)}
                aria-hidden={!dropdownOpen}
              />
              <div
                id="pair-dropdown"
                role="listbox"
                aria-hidden={!dropdownOpen}
                className={`absolute md:fixed z-40 mt-8 md:mt-0 left-1/2 md:left-4 -translate-x-1/2 md:translate-x-0 md:top-28 ${
                isFxMode ?
                "w-[92vw] max-w-[92vw] md:w-[640px] md:max-w-[95vw]" :
                "w-[92vw] max-w-[92vw] md:w-[520px] md:max-w-[95vw]"} max-h-[580px] md:max-h-[680px] overflow-y-auto bg-elevated border border-white/10 rounded-lg shadow-2xl p-2 space-y-2 transition-all duration-700 ease-out ${
                  dropdownOpen
                    ? "opacity-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 -translate-y-2 pointer-events-none"
                }`
                }>

                {(popularLivePairs.length > 0 || xrplPairs.length > 0) &&
                <div className="px-2 pb-2 border-b border-white/10">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted">
                      <span>{t("ui_popular_pairs_0f4bb8a2b3", "Paires populaires")}</span>
                      <span>{t("ui_xrpl_assets_68a2c5aef7", "Actif XRPL")}</span>
                    </div>
                    <div className="mt-2 grid gap-1 grid-cols-[1fr_84px] md:grid-cols-[1fr_96px] items-start">
                      <div className="flex flex-wrap gap-1.5 max-h-[60px] overflow-y-scroll pr-1">
                        {popularLivePairs.map((p) =>
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePairSelect(p)}
                      className="px-2 py-1 rounded-full border border-white/10 text-xs text-secondary transition-all md:hover:border-xcannes-green/60 md:hover:text-xcannes-green/80">

                          {p}
                        </button>
                    )}
                      </div>
                      <div className="ml-auto flex flex-col gap-1 items-stretch -ml-2 justify-self-end">
                        {xrplPairs.map((p) =>
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePairSelect(p)}
                        className={`w-full px-2 py-1 rounded-md border-2 text-xs transition-all ${
                        p === "XRP/RLUSD" || p === "XCS/RLUSD" ?
                        "border-xcannes-blue-weight text-white/90 hover:border-xcannes-blue hover:text-white/90" :
                        "border-white/10 text-secondary md:hover:border-xcannes-green/60 md:hover:text-xcannes-green/80"}`
                        }>

                            {p}
                          </button>
                      )}
                      </div>
                    </div>
                  </div>
                }

                <div className="px-2 pt-3">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted">
                    {t("ui_create_pair_4a77c2e68c", "Créer une paire (fiat)")}
                  </div>
                  <FxPairSelector
                    base={fxBase}
                    quote={fxQuote}
                    alwaysOpen
                    compact
                    onChange={({ base: nextBase, quote: nextQuote }, field) => {
                      const baseClean = String(nextBase || "").toUpperCase();
                      const quoteClean = String(nextQuote || "").toUpperCase();
                      if (!baseClean || !quoteClean) return;
                      setFxBase(baseClean);
                      setFxQuote(quoteClean);
                      if (field === "quote") {
                        handlePairSelect(`${baseClean}/${quoteClean}`);
                      }
                    }} />
                </div>

              </div>
            </>
          </div>
        </div>

        {/* Toolbar de contrôles (timeframes desktop + actions chart) */}
        <div className="flex items-center gap-2 max-sm:gap-1.5 flex-wrap justify-end max-sm:justify-end max-sm:w-full">
          {/* Timeframes desktop */}
          {availableIntervals.length > 0 &&
          typeof onIntervalChange === "function" &&
          <select
            value={interval}
            onChange={(e) => !isFxMode && onIntervalChange(e.target.value)}
            disabled={isFxMode}
            className="hidden sm:inline-block bg-elevated border border-white/10 px-3 py-1.5 rounded text-xs text-primary font-medium disabled:opacity-40 hover:border-xcannes-green/60 transition-all">

                {availableIntervals.map((int) =>
            <option key={int} value={int}>
                    {int}
                  </option>
            )}
              </select>
          }

          {/* Type de chart (toujours disponible, y compris en mode FX EOD) */}
          {true &&
          <div className="relative group">
              <button
              onClick={() => setChartType(chartType === "candle" ? "line" : "candle")}
              className="p-2 max-sm:p-1.5 transition-all flex items-center justify-center text-white/60 hover:text-white/80">

                {chartType === "candle" ?
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">

                    <path d="M3 3v18h18" />
                    <path d="M7 14l4-4 3 3 5-6" />
                  </svg> :

              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">

                    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
                    <path d="M18 17V9" />
                    <path d="M13 17V5" />
                    <path d="M8 17v-3" />
                  </svg>
              }
              </button>
              {showTooltips &&
            <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] font-semibold text-white/90">
                    {chartType === "candle" ? "Mode Ligne" : "Mode Bougies"}
                  </div>
                  <div className="text-[9px] text-white/50 mt-0.5">
                    {chartType === "candle" ? "Afficher en ligne" : "Afficher en chandeliers"}
                  </div>
                </div>
            }
            </div>
          }

          {/* Reset (toujours disponible, y compris en mode FX EOD) */}
          {true &&
          <div className="relative group">
              <button
              onClick={() => {
                if (timeScaleRef.current) timeScaleRef.current.fitContent();
              }}
              className="p-2 max-sm:p-1.5 transition-all flex items-center justify-center text-white/60 hover:text-white/80">

                <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">

                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
              {showTooltips &&
            <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] font-semibold text-white/90">{t("ui_reset_77f2efd6da", "Réinitialiser")}</div>
                  <div className="text-[9px] text-white/50 mt-0.5">{t("ui_adjust_zoom_automatically_31f714860e", "Ajuster le zoom automatiquement")}</div>
                </div>
            }
            </div>
          }

          {/* Settings (header desktop uniquement - mobile utilise toolbar) */}
          {!isFxMode &&
          <div className="relative group hidden md:block">
              <button
              onClick={() => setShowSettings(!showSettings)}
              aria-haspopup="true"
              aria-expanded={showSettings}
              aria-controls="chart-settings-menu"
              className={`p-2 transition-all flex items-center justify-center ${
              showSettings ? "text-xcannes-green" : "text-white/60 hover:text-white/80"}`
              }>

                <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">

                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              {showTooltips &&
            <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] font-semibold text-white/90">{t("ui_parameters_da2b8022f7", "Paramètres")}</div>
                  <div className="text-[9px] text-white/50 mt-0.5">{t("ui_chart_configuration_2087a61aa4", "Configuration du graphique")}</div>
                </div>
            }

              {/* Dropdown menu des paramètres */}
              {showSettings &&
            <div
              id="chart-settings-menu"
              role="menu"
              className="absolute top-full mt-2 right-0 bg-black/95 border border-white/20 rounded-lg p-2.5 shadow-xl z-40 min-w-[170px]">

                  <div className="text-[10px] font-semibold text-white/90 mb-2 pb-1.5 border-b border-white/10">{t("ui_parameters_da2b8022f7", "Paramètres")}

              </div>

                  {/* Option Grille */}
                  <button
                onClick={() => setChartSettings({ ...chartSettings, showGrid: !chartSettings.showGrid })}
                className="flex items-center justify-between w-full px-1.5 py-1.5 text-[10px] rounded hover:bg-white/5 transition-all mb-0.5">

                    <span className="text-white/80">{t("ui_grid_46093641b8", "Grille")}</span>
                    <div
                  className={`w-7 h-3.5 rounded-full transition-all relative ${
                  chartSettings.showGrid ? "bg-xcannes-green" : "bg-white/20"}`
                  }>

                      <div
                    className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${
                    chartSettings.showGrid ? "left-3.5" : "left-0.5"}`
                    }>
                  </div>
                    </div>
                  </button>

                  {/* Option Crosshair */}
                  <button
                onClick={() => setChartSettings({ ...chartSettings, showCrosshair: !chartSettings.showCrosshair })}
                className="flex items-center justify-between w-full px-1.5 py-1.5 text-[10px] rounded hover:bg-white/5 transition-all mb-0.5">

                    <span className="text-white/80">{t("ui_crosshair_5734deb624", "Crosshair")}</span>
                    <div
                  className={`w-7 h-3.5 rounded-full transition-all relative ${
                  chartSettings.showCrosshair ? "bg-xcannes-green" : "bg-white/20"}`
                  }>

                      <div
                    className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${
                    chartSettings.showCrosshair ? "left-3.5" : "left-0.5"}`
                    }>
                  </div>
                    </div>
                  </button>

                  {/* Option Auto-scale */}
                  <button
                onClick={() => setChartSettings({ ...chartSettings, autoScale: !chartSettings.autoScale })}
                className="flex items-center justify-between w-full px-1.5 py-1.5 text-[10px] rounded hover:bg-white/5 transition-all">

                    <span className="text-white/80">{t("ui_auto_scale_27fa19a5df", "Auto-scale")}</span>
                    <div
                  className={`w-7 h-3.5 rounded-full transition-all relative ${
                  chartSettings.autoScale ? "bg-xcannes-green" : "bg-white/20"}`
                  }>

                      <div
                    className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${
                    chartSettings.autoScale ? "left-3.5" : "left-0.5"}`
                    }>
                  </div>
                    </div>
                  </button>
                </div>
            }
            </div>
          }
        </div>
      </div>

    </div>);

}
