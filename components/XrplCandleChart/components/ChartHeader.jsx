"use client";

import React, { useEffect } from "react";
import FxPairSelector from "./FxPairSelector";

// En-tête compact original du chart (prix + sélecteurs)
export default function ChartHeader({
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
  setChartSettings,
}) {
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
    <div className="border-b border-white/10 p-3 max-sm:p-2">
      <div className="flex items-center justify-between gap-3 max-sm:gap-1.5 max-sm:flex-col max-sm:items-stretch">
        {/* Prix actuel */}
        <div className="flex items-center gap-3 max-sm:gap-1.5 max-sm:justify-between max-sm:w-full">
          <h2 className="font-orbitron font-bold text-white text-lg max-sm:text-sm">
            {isFxMode ? `${fxBase}/${fxQuote}` : pair}
          </h2>
          {(isFxMode ? fxInfo.price : currentPrice) && (
            <div className="flex items-baseline gap-2 max-sm:gap-1">
              <span className="font-semibold text-white text-base max-sm:text-sm">
                {(isFxMode ? fxInfo.price : currentPrice)?.toFixed(6)}
              </span>
              {(!isFxMode || fxInfo.changePercent != null) && (
                <span
                  className={`text-xs max-sm:text-sm font-medium ${
                    (isFxMode ? fxInfo.changePercent : percent24h.percent) >= 0
                      ? "text-xcannes-green"
                      : "text-red-500"
                  }`}
                  title={
                    isFxMode
                      ? "Daily change (EOD Fawaz)"
                      : "Évolution sur 24h"
                  }
                >
                  {(isFxMode ? fxInfo.changePercent : percent24h.percent) >= 0
                    ? "+"
                    : ""}
                  {(isFxMode
                    ? fxInfo.changePercent
                    : percent24h.percent
                  )?.toFixed(2)}
                  %
                </span>
              )}
            </div>
          )}
        </div>

        {/* Contrôles globaux + sélecteur FX EOD */}
        <div className="flex items-center gap-3 max-sm:gap-1.5 flex-wrap justify-end max-sm:justify-between max-sm:w-full">
          {/* Mode Live / FX EOD */}
          <div className="inline-flex items-center rounded-full bg-black/60 border border-white/10 p-1 max-sm:px-1 max-sm:py-0.5 text-[11px] max-sm:text-sm">
            <button
              type="button"
              onClick={() => {
                setPairMode("live");
                setIsFxMode(false);
              }}
              aria-pressed={pairMode === "live"}
              aria-label="Mode Live"
              className={`px-3 py-1 max-sm:px-2 max-sm:py-0.5 rounded-full font-semibold transition-all relative overflow-hidden ${
                pairMode === "live"
                  ? "text-white"
                  : "text-white/60 hover:text-white/90"
              }`}
            >
              <span className="relative z-10">Live</span>
              {pairMode === "live" && (
                <span
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/30 to-transparent"
                  style={{ animation: "liveSweep 3s ease-in-out infinite" }}
                />
              )}
            </button>
            <div className="relative group">
              <button
                type="button"
                onClick={() => {
                  setPairMode("eod");
                  setIsFxMode(true);
                }}
                aria-pressed={pairMode === "eod"}
                aria-label="Mode FX End of Day"
                className={`px-3 py-1 max-sm:px-2 max-sm:py-0.5 rounded-full font-semibold transition-all relative overflow-hidden ${
                  pairMode === "eod"
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white/90"
                }`}
              >
                <span className="relative z-10">EOD</span>
                {pairMode === "eod" && (
                  <span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"
                    style={{ animation: "eodSweep 3s ease-in-out infinite" }}
                  />
                )}
              </button>
              {showTooltips && (
                <div className="hidden group-hover:block absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg px-2 py-1.5 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] max-sm:text-xs font-semibold text-white/90">
                    End of Day
                  </div>
                  <div className="text-[9px] max-sm:text-[11px] text-white/50 mt-0.5">
                    FX rates · 1 update / 24h
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contrôles DEX (paires + timeframes) - mode Live */}
          {pairMode === "live" && uniquePairs.length > 0 && onPairChange && (
            <div ref={dropdownRef} className="relative">
              {/* Bouton principal - affiche la paire actuelle */}
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
                aria-controls="pair-dropdown"
                className="bg-black/60 border border-white/10 px-3 py-1.5 max-sm:px-2 max-sm:py-1 rounded text-xs max-sm:text-sm text-white font-medium hover:border-white/20 transition-all flex items-center gap-2 max-sm:gap-1"
              >
                <span>{pair}</span>
                <svg
                  className={`w-3 h-3 transition-transform ${
                    dropdownOpen ? "rotate-180" : ""
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

              {/* Dropdown personnalisé */}
              {dropdownOpen && (
                <div
                  id="pair-dropdown"
                  role="listbox"
                  className="absolute z-20 mt-2 w-[260px] max-h-[360px] overflow-y-auto bg-black/95 border border-white/20 rounded-lg shadow-2xl p-2 space-y-1"
                >
                  {Object.entries(filteredMarketStructure).map(([marketKey, market]) => {
                    const isExpanded = expandedMarkets[marketKey];
                    return (
                      <div key={marketKey} className="border border-white/10 rounded-md overflow-hidden">
                        <button
                          onClick={() => toggleMarket(marketKey)}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs text-white/80 bg-white/5 hover:bg-white/10 transition-all"
                        >
                          <span>{market.label}</span>
                          <svg
                            className={`w-3 h-3 transition-transform ${
                              isExpanded ? "rotate-180" : ""
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

                        {isExpanded && (
                          <div className="bg-black/40 px-2 pb-2">
                            {Object.entries(market.currencies).map(([currency, pairs]) => {
                              const currencyKey = `${marketKey}-${currency}`;
                              const isCurrencyExpanded = expandedCurrencies[currencyKey];

                              return (
                                <div key={currency} className="mb-1">
                                  <button
                                    onClick={() => toggleCurrency(marketKey, currency)}
                                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 rounded transition-all"
                                  >
                                    <span className="font-medium">{currency}</span>
                                    <svg
                                      className={`w-2.5 h-2.5 transition-transform ${
                                        isCurrencyExpanded ? "rotate-180" : ""
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

                                  {isCurrencyExpanded && (
                                    <div className="ml-2 mt-1 space-y-0.5">
                                      {pairs.map((p) => (
                                        <button
                                          key={p}
                                          onClick={() => handlePairSelect(p)}
                                          className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-white/10 transition-all ${
                                            pair === p
                                              ? "bg-xcannes-green/20 text-xcannes-green"
                                              : "text-white/70"
                                          }`}
                                        >
                                          {p}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* FX EOD selector - mode EOD */}
          {pairMode === "eod" && (
            <div className="flex items-center gap-2 max-sm:gap-1.5">
              <FxPairSelector
                base={fxBase}
                quote={fxQuote}
                onChange={({ base, quote }) => {
                  setFxBase(base);
                  setFxQuote(quote);
                  setIsFxMode(true);
                  setPairMode("eod");
                }}
              />
              {fxLoading && (
                <div className="w-3 h-3 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}

          {pairMode === "live" && availableIntervals.length > 0 && onIntervalChange && (
            <select
              value={interval}
              onChange={(e) => !isFxMode && onIntervalChange(e.target.value)}
              disabled={isFxMode}
              className="bg-black/60 border border-white/10 px-3 py-1.5 max-sm:px-2 max-sm:py-1 rounded text-xs max-sm:text-sm text-white font-medium disabled:opacity-40 hover:border-white/20 transition-all"
            >
              {availableIntervals.map((int) => (
                <option key={int} value={int}>
                  {int}
                </option>
              ))}
            </select>
          )}

          {/* Type de chart (header en mode Live) */}
          {pairMode === "live" && (
            <div className="relative group">
              <button
                onClick={() => setChartType(chartType === "candle" ? "line" : "candle")}
                className="p-2 max-sm:p-1.5 transition-all flex items-center justify-center text-white/60 hover:text-white/80"
              >
                {chartType === "candle" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3v18h18" />
                    <path d="M7 14l4-4 3 3 5-6" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
                    <path d="M18 17V9" />
                    <path d="M13 17V5" />
                    <path d="M8 17v-3" />
                  </svg>
                )}
              </button>
              {showTooltips && (
                <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] font-semibold text-white/90">
                    {chartType === "candle" ? "Mode Ligne" : "Mode Bougies"}
                  </div>
                  <div className="text-[9px] text-white/50 mt-0.5">
                    {chartType === "candle" ? "Afficher en ligne" : "Afficher en chandeliers"}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reset (header en mode Live) */}
          {pairMode === "live" && (
            <div className="relative group">
              <button
                onClick={() => {
                  if (timeScaleRef.current) timeScaleRef.current.fitContent();
                }}
                className="p-2 max-sm:p-1.5 transition-all flex items-center justify-center text-white/60 hover:text-white/80"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
              {showTooltips && (
                <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] font-semibold text-white/90">Réinitialiser</div>
                  <div className="text-[9px] text-white/50 mt-0.5">Ajuster le zoom automatiquement</div>
                </div>
              )}
            </div>
          )}

          {/* Settings (header desktop uniquement - mobile utilise toolbar) */}
          {pairMode === "live" && (
            <div className="relative group hidden md:block">
              <button
                onClick={() => setShowSettings(!showSettings)}
                aria-haspopup="true"
                aria-expanded={showSettings}
                aria-controls="chart-settings-menu"
                className={`p-2 transition-all flex items-center justify-center ${
                  showSettings ? "text-xcannes-green" : "text-white/60 hover:text-white/80"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              {showTooltips && (
                <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
                  <div className="text-[11px] font-semibold text-white/90">Paramètres</div>
                  <div className="text-[9px] text-white/50 mt-0.5">Configuration du graphique</div>
                </div>
              )}

              {/* Dropdown menu des paramètres */}
              {showSettings && (
                <div
                  id="chart-settings-menu"
                  role="menu"
                  className="absolute top-full mt-2 right-0 bg-black/95 border border-white/20 rounded-lg p-2.5 shadow-xl z-40 min-w-[170px]"
                >
                  <div className="text-[10px] font-semibold text-white/90 mb-2 pb-1.5 border-b border-white/10">
                    Paramètres
                  </div>

                  {/* Option Grille */}
                  <button
                    onClick={() => setChartSettings({ ...chartSettings, showGrid: !chartSettings.showGrid })}
                    className="flex items-center justify-between w-full px-1.5 py-1.5 text-[10px] rounded hover:bg-white/5 transition-all mb-0.5"
                  >
                    <span className="text-white/80">Grille</span>
                    <div
                      className={`w-7 h-3.5 rounded-full transition-all relative ${
                        chartSettings.showGrid ? "bg-xcannes-green" : "bg-white/20"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${
                          chartSettings.showGrid ? "left-3.5" : "left-0.5"
                        }`}
                      ></div>
                    </div>
                  </button>

                  {/* Option Crosshair */}
                  <button
                    onClick={() => setChartSettings({ ...chartSettings, showCrosshair: !chartSettings.showCrosshair })}
                    className="flex items-center justify-between w-full px-1.5 py-1.5 text-[10px] rounded hover:bg-white/5 transition-all mb-0.5"
                  >
                    <span className="text-white/80">Crosshair</span>
                    <div
                      className={`w-7 h-3.5 rounded-full transition-all relative ${
                        chartSettings.showCrosshair ? "bg-xcannes-green" : "bg-white/20"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${
                          chartSettings.showCrosshair ? "left-3.5" : "left-0.5"
                        }`}
                      ></div>
                    </div>
                  </button>

                  {/* Option Auto-scale */}
                  <button
                    onClick={() => setChartSettings({ ...chartSettings, autoScale: !chartSettings.autoScale })}
                    className="flex items-center justify-between w-full px-1.5 py-1.5 text-[10px] rounded hover:bg-white/5 transition-all"
                  >
                    <span className="text-white/80">Auto-scale</span>
                    <div
                      className={`w-7 h-3.5 rounded-full transition-all relative ${
                        chartSettings.autoScale ? "bg-xcannes-green" : "bg-white/20"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${
                          chartSettings.autoScale ? "left-3.5" : "left-0.5"
                        }`}
                      ></div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
