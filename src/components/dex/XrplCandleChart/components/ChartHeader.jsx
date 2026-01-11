"use client";

import React, { useEffect } from "react";
import FxPairSelector from "./FxPairSelector";

// En-tête compact original du chart (prix + sélecteurs)
import { useTranslation } from "next-i18next";export default function ChartHeader({
  pair,
  interval,
  onPairChange,
  onIntervalChange,
  availableIntervals,
  uniquePairs,
  filteredMarketStructure,
  pairMode,
  setPairMode,
  isFxMode,
  setIsFxMode,
  fxBase,
  fxQuote,
  fxInfo,
  fxLoading,
  setFxBase,
  setFxQuote,
  currentPrice,
  percent24h,
  showTooltips,
  dropdownOpen,
  setDropdownOpen,
  expandedMarkets,
  expandedCurrencies,
  toggleMarket,
  toggleCurrency,
  handlePairSelect,
  dropdownRef,
  chartType,
  setChartType,
  timeScaleRef,
  showSettings,
  setShowSettings,
  chartSettings,
  setChartSettings
}) {const { t } = useTranslation("common");
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

  return (
    <div className="border-b-0 md:border-b border-subtle border-l-0 border-r-0 px-3 py-2 max-sm:px-2 max-sm:pt-px max-sm:pb-1.5 bg-elevated">
      <div className="flex items-center justify-between gap-3 max-sm:gap-1.5 max-sm:flex-col max-sm:items-stretch">
        {/* Prix actuel + paire (zone hero) */}
        <div className="flex items-baseline gap-3 max-sm:gap-1.5 max-sm:justify-center max-sm:w-full">
          <div
            ref={dropdownRef}
            className="flex flex-col max-sm:items-center max-sm:text-center relative">

            {uniquePairs.length > 0 && onPairChange ?
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
                "Daily change (EOD Fawaz)" :
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
            {uniquePairs.length > 0 && dropdownOpen &&
            <div
              id="pair-dropdown"
              role="listbox"
              className={`absolute md:fixed z-40 mt-8 md:mt-0 left-1/2 md:left-4 -translate-x-1/2 md:translate-x-0 md:top-28 ${
              isFxMode ?
              "w-[460px] max-w-[95vw]" :
              "w-[300px] max-w-[90vw]"} max-h-[530px] overflow-y-auto bg-base border border-subtle rounded-lg shadow-2xl p-2 space-y-2`
              }>

                {/* Toggle Live / EOD dans le menu */}
                <div className="px-2 pb-2 border-b border-subtle flex items-center justify-between text-[11px] text-muted">
                  <span className="uppercase tracking-[0.16em]">{t("ui_mode_6f09dd56a0", "Mode")}</span>
                  <div className="inline-flex items-center rounded-full bg-subtle border border-subtle p-0.5">
                    <button
                    type="button"
                    onClick={() => {
                      setPairMode("live");
                      setIsFxMode(false);
                    }}
                    aria-pressed={!isFxMode}
                    className={`px-3 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                    !isFxMode ?
                    "bg-accent-rlusd/20 text-primary" :
                    "text-muted hover:text-primary"}`
                    }>{t("ui_live_a633f195c7", "Live")}


                  </button>
                      <button
                    type="button"
                    onClick={() => {
                      setPairMode("eod");
                      // Basculer en mode FX EOD sur une paire par défaut
                      // (EUR/USD) si aucune paire FX n'a encore été choisie.
                      const nextBase = fxBase || "EUR";
                      const nextQuote = fxQuote || "USD";
                      setFxBase(nextBase);
                      setFxQuote(nextQuote);
                      setIsFxMode(true);
                    }}
                    aria-pressed={isFxMode}
                    className={`px-3 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                    isFxMode ?
                    "bg-subtle text-primary" :
                    "text-muted hover:text-primary"}`
                    }>{t("ui_add_90615be412", "ADD")}


                  </button>
                  </div>
                </div>
                
                {/* Contenu du sélecteur selon le mode */}
                {!isFxMode &&
              <>
                    {/* Liste des marchés / paires Live (XRPL + Pyth temps réel) */}
                    {Object.entries(filteredMarketStructure).map(
                  ([marketKey, market]) => {
                    const isExpanded = expandedMarkets[marketKey];
                    return (
                      <div
                        key={marketKey}
                        className="border border-subtle rounded-md overflow-hidden">

                            <button
                          onClick={() => toggleMarket(marketKey)}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs text-primary bg-subtle hover:bg-elevated transition-all">

                              <span>{market.label}</span>
                              <svg
                            className={`w-3 h-3 transition-transform ${
                            isExpanded ? "rotate-180" : ""}`
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
                            </button>

                            {isExpanded &&
                        <div className="bg-base px-2 pb-2">
                                {Object.entries(market.currencies).map(
                            ([currency, pairs]) => {
                              const currencyKey = `${marketKey}-${currency}`;
                              const isCurrencyExpanded =
                              expandedCurrencies[currencyKey];

                              return (
                                <div key={currency} className="mb-1">
                                        <button
                                    onClick={() =>
                                    toggleCurrency(marketKey, currency)
                                    }
                                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-secondary hover:bg-subtle rounded transition-all">

                                          <span className="font-medium">
                                            {currency}
                                          </span>
                                          <svg
                                      className={`w-2.5 h-2.5 transition-transform ${
                                      isCurrencyExpanded ?
                                      "rotate-180" :
                                      ""}`
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
                                        </button>

                                        {isCurrencyExpanded &&
                                  <div className="ml-2 mt-1 space-y-0.5">
                                            {pairs.map((p) =>
                                    <button
                                      key={p}
                                      onClick={() =>
                                      handlePairSelect(p)
                                      }
                                      className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-subtle transition-all ${
                                      pair === p ?
                                      "bg-accent-rlusd/10 text-accent-rlusd" :
                                      "text-muted"}`
                                      }>

                                                {p}
                                              </button>
                                    )}
                                          </div>
                                  }
                                      </div>);

                            }
                          )}
                              </div>
                        }
                          </div>);

                  }
                )}
                  </>
              }

                {isFxMode &&
              <div className="px-2 pt-2">
                    <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted">{t("ui_currencies_add_d324e3ae6f", "Devises (ADD)")}

                </div>
                    <FxPairSelector
                  base={fxBase}
                  quote={fxQuote}
                  alwaysOpen
                  onChange={({ base: nextBase, quote: nextQuote }, field) => {
                    const baseClean = String(nextBase || "").toUpperCase();
                    const quoteClean = String(nextQuote || "").toUpperCase();
                    if (!baseClean || !quoteClean) return;
                    setFxBase(baseClean);
                    setFxQuote(quoteClean);
                    setIsFxMode(true);
                    if (onPairChange) {
                      onPairChange(`${baseClean}/${quoteClean}`);
                    }
                    // Fermer le sélecteur seulement après sélection de la QUOTE
                    if (field === "quote") {
                      setDropdownOpen(false);
                    }
                  }} />

                  </div>
              }
              </div>
            }
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
            className="hidden sm:inline-block bg-subtle border border-subtle px-3 py-1.5 rounded text-xs text-primary font-medium disabled:opacity-40 hover:border-accent-rlusd/60 transition-all">

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