"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { getCurrencyFlag } from "../walletDashboardConfig";

/**
 * PreferredCurrencySelector — dropdown selector for preferred display currency.
 *
 * Compact dropdown with search through available Fawaz currencies.
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
  const rootRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    if (!isExpanded) return;
    searchRef.current?.focus();
  }, [isExpanded]);

  const normalizedTopCurrencies = useMemo(() => {
    if (Array.isArray(topCurrencies) && topCurrencies.length > 0) {
      return topCurrencies;
    }
    return ["USD", "EUR", "GBP", "CHF", "CAD"].map((code) => ({
      code,
      name: "",
      symbol: "",
    }));
  }, [topCurrencies]);

  const topCodeSet = useMemo(() => {
    return new Set(normalizedTopCurrencies.map((c) => c.code));
  }, [normalizedTopCurrencies]);

  const uniqueCurrencies = useMemo(() => {
    const list = [];
    const seen = new Set();
    const candidates = [
      ...normalizedTopCurrencies,
      ...(Array.isArray(allCurrencies) ? allCurrencies : []),
    ];

    for (const raw of candidates) {
      const code = String(raw?.code || "").toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      list.push({
        code,
        name: String(raw?.name || ""),
        symbol: String(raw?.symbol || ""),
      });
    }

    return list;
  }, [allCurrencies, normalizedTopCurrencies]);

  const filteredCurrencies = useMemo(() => {
    if (!search.trim()) return uniqueCurrencies;
    const q = search.trim().toUpperCase();
    return uniqueCurrencies.filter(
      (c) =>
        c.code.includes(q) ||
        (c.name && c.name.toUpperCase().includes(q)),
    );
  }, [search, uniqueCurrencies]);

  const visibleCurrencies = useMemo(() => {
    if (search.trim()) return filteredCurrencies;
    const rest = filteredCurrencies.filter((c) => !topCodeSet.has(c.code));
    return [...normalizedTopCurrencies, ...rest];
  }, [
    filteredCurrencies,
    normalizedTopCurrencies,
    search,
    topCodeSet,
  ]);

  const selectedCurrency = useMemo(() => {
    return (
      uniqueCurrencies.find((c) => c.code === currentCurrency) || {
        code: currentCurrency,
        name: "",
        symbol: "",
      }
    );
  }, [currentCurrency, uniqueCurrencies]);

  const close = useCallback(() => {
    setIsExpanded(false);
    setSearch("");
  }, []);

  // Close when clicking outside the selector (keeps settings dropdown open).
  useEffect(() => {
    if (!isExpanded) return;
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [close, isExpanded]);

  const handleSelect = useCallback(
    (code) => {
      onSelect?.(code);
      close();
    },
    [close, onSelect],
  );

  return (
    <div className="space-y-2" ref={rootRef}>
      <div className="text-[10px] font-semibold text-white/55 tracking-[0.22em] px-1">
        {t("ui_preferred_currency_label", "Devise principale")}
      </div>

      <button
        type="button"
        onClick={() => {
          setIsExpanded((v) => {
            const next = !v;
            if (next) onOpen?.();
            if (next) setSearch("");
            return next;
          });
        }}
        className={[
          "w-full flex items-center gap-3 px-3 py-3 rounded-[18px] transition-colors",
          "bg-black/25 ring-1 ring-inset ring-white/10 hover:bg-black/30 hover:ring-white/15",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={isExpanded}
      >
        <span className="h-8 w-8 rounded-full bg-black/30 ring-1 ring-white/10 inline-flex items-center justify-center text-[22px] shrink-0">
          {getCurrencyFlag(currentCurrency)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <div className="text-[15px] font-semibold text-white/90 leading-tight shrink-0">
              {currentCurrency}
            </div>
            <div className="text-[11px] text-white/45 truncate">
              {selectedCurrency?.name ||
                t("ui_currency_picker_hint", "Choisir une devise")}
            </div>
          </div>
        </div>
        <span className="text-white/35 shrink-0">
          <svg
            className={["w-5 h-5 transition-transform", isExpanded ? "rotate-180" : ""].join(" ")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Dropdown panel */}
      {isExpanded && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-2 space-y-2">
          <div className="relative px-1">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                }
              }}
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
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          <div
            role="listbox"
            className="max-h-44 overflow-y-auto px-1 space-y-0.5"
          >
            {visibleCurrencies.length === 0 ? (
              <div className="text-[10px] text-white/30 text-center py-3">
                {isLoading
                  ? t("ui_loading", "Chargement…")
                  : t("ui_no_results", "Aucun résultat")}
              </div>
            ) : (
              <>
                {visibleCurrencies.map((c) => {
                  const isActive = c.code === currentCurrency;
                  const flag = getCurrencyFlag(c.code);
                  return (
                    <button
                      key={c.code}
                      role="option"
                      aria-selected={isActive}
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
                      <span className="font-mono font-semibold shrink-0">
                        {c.code}
                      </span>
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
                })}
                {isLoading && (
                  <div className="text-[10px] text-white/30 text-center py-2">
                    {t("ui_loading", "Chargement…")}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
