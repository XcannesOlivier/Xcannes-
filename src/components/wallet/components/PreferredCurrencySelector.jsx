"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { getCurrencyFlag } from "../walletDashboardConfig";

/**
 * PreferredCurrencySelector — dropdown selector for preferred display currency.
 *
 * Shows top 5 currencies as quick-pick buttons, then a search input
 * that filters through all available Fawaz currencies.
 */
export default function PreferredCurrencySelector({
  currentCurrency = "USD",
  topCurrencies = [],
  allCurrencies = [],
  isLoading = false,
  onSelect,
  onOpen,
}) {
  const { t } = useTranslation("common");
  const [isExpanded, setIsExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);

  // Focus search when expanded
  useEffect(() => {
    if (isExpanded && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isExpanded]);

  // Notify parent to load currencies when expanding
  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    setSearch("");
    onOpen?.();
  }, [onOpen]);

  // Top 5 display codes (always visible)
  const TOP_CODES = useMemo(
    () => ["USD", "EUR", "GBP", "CHF", "CAD"],
    [],
  );

  // Filtered currencies for search
  const filteredCurrencies = useMemo(() => {
    if (!search.trim()) return allCurrencies.slice(0, 20); // show first 20 by default
    const q = search.trim().toUpperCase();
    return allCurrencies.filter(
      (c) =>
        c.code.includes(q) ||
        (c.name && c.name.toUpperCase().includes(q)),
    );
  }, [allCurrencies, search]);

  const handleSelect = useCallback(
    (code) => {
      onSelect?.(code);
      setIsExpanded(false);
      setSearch("");
    },
    [onSelect],
  );

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="text-[10px] font-semibold text-white/60 uppercase tracking-wider px-1">
        {t("ui_preferred_currency_label", "Votre devise préférée")}
      </div>

      {/* Top 5 quick-pick */}
      <div className="flex flex-wrap gap-1.5 px-1">
        {TOP_CODES.map((code) => {
          const isActive = code === currentCurrency;
          const flag = getCurrencyFlag(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => handleSelect(code)}
              className={[
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-all active:scale-95",
                isActive
                  ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                  : "border-white/12 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80",
              ].join(" ")}
            >
              <span className="text-[13px]">{flag}</span>
              {code}
            </button>
          );
        })}
      </div>

      {/* Expand/collapse for search */}
      {!isExpanded ? (
        <button
          type="button"
          onClick={handleExpand}
          className="w-full text-left px-3 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors"
        >
          {t("ui_preferred_currency_more", "Autre devise…")}
        </button>
      ) : (
        <div className="space-y-1.5">
          {/* Search input */}
          <div className="relative px-1">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "ui_preferred_currency_search",
                "Rechercher une devise…",
              )}
              className="w-full rounded-lg border border-white/15 bg-black/40 pl-8 pr-3 py-1.5 text-[11px] text-white placeholder-white/30 outline-none focus:border-white/30 transition-all"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          {/* Results list */}
          <div className="max-h-40 overflow-y-auto px-1 space-y-0.5">
            {isLoading ? (
              <div className="text-[10px] text-white/30 text-center py-3">
                {t("ui_loading", "Chargement…")}
              </div>
            ) : filteredCurrencies.length === 0 ? (
              <div className="text-[10px] text-white/30 text-center py-3">
                {t("ui_no_results", "Aucun résultat")}
              </div>
            ) : (
              filteredCurrencies.map((c) => {
                const isActive = c.code === currentCurrency;
                const flag = getCurrencyFlag(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c.code)}
                    className={[
                      "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-all",
                      isActive
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "text-white/60 hover:bg-white/5 hover:text-white/80",
                    ].join(" ")}
                  >
                    <span className="text-[13px] shrink-0">{flag}</span>
                    <span className="font-mono font-semibold">{c.code}</span>
                    {c.name && (
                      <span className="text-[10px] text-white/40 truncate">
                        {c.name}
                      </span>
                    )}
                    {isActive && (
                      <span className="ml-auto text-emerald-400 text-[10px]">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Collapse */}
          <button
            type="button"
            onClick={() => {
              setIsExpanded(false);
              setSearch("");
            }}
            className="w-full text-center py-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
          >
            {t("ui_collapse", "Réduire")}
          </button>
        </div>
      )}
    </div>
  );
}
