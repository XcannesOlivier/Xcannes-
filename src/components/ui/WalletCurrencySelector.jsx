"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import xcannesApi from "@/lib/xcannesApi";
import { useTranslation } from "next-i18next";

const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴"
};

// Petit set de devises les plus utilisées dans le monde
// Limité à 7 pour rester simple et rapide à parcourir.
const POPULAR_CURRENCIES = [
{ code: "USD", name: "US Dollar" },
{ code: "EUR", name: "Euro" },
{ code: "JPY", name: "Japanese Yen" },
{ code: "GBP", name: "British Pound" },
{ code: "CHF", name: "Swiss Franc" },
{ code: "AUD", name: "Australian Dollar" },
{ code: "CAD", name: "Canadian Dollar" }];

const normalizeCode = (code) => String(code || "").trim().toUpperCase();

function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const codePoints = [...countryCode.toUpperCase()].map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65)
  );
  return String.fromCodePoint(...codePoints);
}

function getFlag(code) {
  if (!code) return "🏳️";
  const upper = String(code).toUpperCase();
  if (CURRENCY_FLAG_OVERRIDES[upper]) {
    return CURRENCY_FLAG_OVERRIDES[upper];
  }
  const countryGuess = upper.slice(0, 2);
  return countryCodeToFlag(countryGuess);
}

export default function WalletCurrencySelector({
  value,
  onChange,
  placeholder = "Select currency...",
  extraOptions = [],
  quickOptions = [],
  showQuickAdd = true,
  excludeCodes = []
}) {
  const { t } = useTranslation("common");
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const popupRef = useRef(null);
  const triggerRef = useRef(null);

  const excludedSet = useMemo(() => {
    return new Set((excludeCodes || []).map(normalizeCode).filter(Boolean));
  }, [excludeCodes]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await xcannesApi.getFxCurrencies();
        if (cancelled || !Array.isArray(list)) {
          setCurrencies([]);
          return;
        }
        setCurrencies(
          list
            .map((c) => {
              const code = normalizeCode(c?.code);
              if (!code) return null;
              return { ...c, code };
            })
            .filter(Boolean)
        );
      } catch (err) {
        setCurrencies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const normalizedQuickOptions = useMemo(() => {
    return (quickOptions || [])
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") {
          const code = normalizeCode(item);
          if (!code) return null;
          return { code, name: code };
        }
        const code = normalizeCode(item.code);
        if (!code) return null;
        return { code, name: item.name || code };
      })
      .filter(Boolean)
      .filter((c) => !excludedSet.has(normalizeCode(c.code)));
  }, [excludedSet, quickOptions]);

  const mergedCurrencies = useMemo(() => {
    const extras = [...(extraOptions || []), ...normalizedQuickOptions]
      .map((item) => {
        const code = normalizeCode(item?.code);
        if (!code) return null;
        return { code, name: item?.name || code };
      })
      .filter(Boolean);
    const baseMap = new Map();
    currencies.forEach((c) => {
      const code = normalizeCode(c?.code);
      if (!code || excludedSet.has(code)) return;
      baseMap.set(code, { ...c, code });
    });
    extras.forEach((c) => {
      const code = normalizeCode(c?.code);
      if (!code || excludedSet.has(code)) return;
      if (!baseMap.has(code)) {
        baseMap.set(code, { ...c, code });
      }
    });
    return Array.from(baseMap.values());
  }, [currencies, extraOptions, excludedSet, normalizedQuickOptions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return mergedCurrencies;
    return mergedCurrencies.filter((c) => {
      const code = c.code.toLowerCase();
      const name = (c.name || "").toLowerCase();
      return code.includes(term) || name.includes(term);
    });
  }, [mergedCurrencies, search]);

  const selected = useMemo(() => {
    if (!value) return null;
    const upper = normalizeCode(value);
    return mergedCurrencies.find((c) => normalizeCode(c.code) === upper) || {
      code: upper,
      name: upper,
    };
  }, [value, mergedCurrencies]);

  const handleSelect = (code) => {
    if (onChange) {
      onChange(normalizeCode(code));
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        ref={triggerRef}
        className="w-full bg-black/40 border border-white/15 rounded-md px-3 py-2 text-xs text-white/80 flex items-center justify-between gap-2 hover:border-[#06B6D4]/70 transition-colors active:scale-98">

        <div className="flex items-center gap-2">
          <span className="text-sm">
            {selected ? getFlag(selected.code) : "🏳️"}
          </span>
          <span className="truncate">
            {selected ? `${selected.code} – ${selected.name}` : placeholder}
          </span>
        </div>
        <svg
          className={`w-3 h-3 transition-transform ${
          open ? "rotate-180" : ""}`
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

      {open &&
      <div
        ref={popupRef}
        className="absolute z-50 mt-1 w-full max-h-72 bg-[#0a0f0d] border border-white/10 rounded-lg shadow-2xl overscroll-contain flex flex-col"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}>

          <div className="px-3 pt-2 pb-1 border-b border-white/10 space-y-2">
            {showQuickAdd ?
            <>
                {normalizedQuickOptions.length > 0 ?
              <div className="text-[10px] font-semibold text-white/60">
                    {t("ui_quick_add_e62e925d4f", "Quick add")}
                  </div> :
              null}
                {/* Raccourci pour les devises les plus utilisées */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {(normalizedQuickOptions.length > 0 ? normalizedQuickOptions : POPULAR_CURRENCIES).map((c) =>
                <button
                  key={c.code}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(c.code);
                  }}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white/80 hover:border-accent-rlusd shrink-0 active:scale-95">

                      <span className="text-sm">{getFlag(c.code)}</span>
                      <span className="font-mono">{c.code}</span>
                    </button>
                )}
                </div>
              </> :
            null}
            <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            placeholder={t("ui_search_currency_045b7c357f", "Search currency...")}
            className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 placeholder:text-white/40 focus:outline-none focus:border-accent-rlusd" />

          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-3 text-xs text-muted flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin" />
                {t("ui_loading_currencies_9af59a0977", "Loading currencies...")}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted">
                {t("ui_no_currencies_found_b70888825e", "No currencies found.")}
              </div>
            ) : (
              <ul className="py-1">
                {filtered.map((c) =>
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(c.code);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-white/80 hover:bg-white/5 flex items-center gap-2 text-left active:scale-98">
                      <span className="text-sm">{getFlag(c.code)}</span>
                      <span className="font-mono text-[11px]">{c.code}</span>
                      <span className="text-[11px] text-white/45 truncate">
                        {c.name}
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      }
    </div>);

}
