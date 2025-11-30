"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import xcannesApi from "../lib/xcannesApi";

const REGION_DEFS = {
  Europe: ["EUR", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF"],
  Americas: ["USD", "CAD", "BRL", "MXN", "ARS", "CLP", "COP", "PEN", "BZD", "GTQ", "HNL", "CRC"],
  "Asia-Pacific": ["JPY", "CNY", "CNH", "HKD", "KRW", "INR", "SGD", "THB", "PHP", "IDR", "MYR", "AUD", "NZD", "FJD"],
  "Middle East & Africa": ["AED", "SAR", "QAR", "KWD", "EGP", "MAD", "ZAR", "KES", "NGN", "GHS"],
};

// Overrides explicites devise -> drapeau (multi-pays, cas spéciaux)
const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴",
};

// Convertit un code pays ISO-2 (ex: "AE") en emoji drapeau
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

  // Cas spéciaux d'abord
  if (CURRENCY_FLAG_OVERRIDES[upper]) {
    return CURRENCY_FLAG_OVERRIDES[upper];
  }

  // Pour la majorité des monnaies fiat, les 2 premières lettres
  // correspondent au code pays ISO (AED -> AE, KES -> KE, etc.)
  const countryGuess = upper.slice(0, 2);
  return countryCodeToFlag(countryGuess);
}

export default function FxPairSelector({ base, quote, onChange }) {
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState(null); // "base" | "quote" | null
  const [expandedRegions, setExpandedRegions] = useState({});
  const popupRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await xcannesApi.getFxCurrencies();
        if (!cancelled) {
          setCurrencies(list);
        }
      } catch (err) {
        console.error("[FxPairSelector] Erreur chargement devises:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const favorites = useMemo(
    () => ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"],
    []
  );

  const byCode = useMemo(() => {
    const map = new Map();
    currencies.forEach((c) => {
      map.set(c.code.toUpperCase(), c);
    });
    return map;
  }, [currencies]);

  const baseEntry = byCode.get(String(base || "").toUpperCase());
  const quoteEntry = byCode.get(String(quote || "").toUpperCase());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return currencies;
    return currencies.filter((c) => {
      const code = c.code.toLowerCase();
      const name = (c.name || "").toLowerCase();
      return code.includes(term) || name.includes(term);
    });
  }, [currencies, search]);

  const groupedByRegion = useMemo(() => {
    const groups = {};
    filtered.forEach((c) => {
      const code = c.code.toUpperCase();
      let region = "Other";
      for (const [name, codes] of Object.entries(REGION_DEFS)) {
        if (codes.includes(code)) {
          region = name;
          break;
        }
      }
      if (!groups[region]) groups[region] = [];
      groups[region].push(c);
    });
    return groups;
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (!popupRef.current) return;
      if (!popupRef.current.contains(e.target)) {
        setOpen(false);
        setActiveField(null);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = (code) => {
    const upper = code.toUpperCase();
    if (activeField === "base") {
      if (onChange) {
        onChange({ base: upper, quote: quote || "USD" });
      }
      // Rester ouvert pour choisir la quote
      setActiveField("quote");
      setSearch("");
      return;
    } else if (activeField === "quote") {
      if (onChange) {
        onChange({ base: base || "USD", quote: upper });
      }
    }

    setOpen(false);
    setActiveField(null);
    setSearch("");
  };

  const openFor = (field) => {
    setActiveField(field);
    setOpen(true);
    setSearch("");
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Base selector */}
      <button
        type="button"
        onClick={() => openFor("base")}
        className="bg-black/60 border border-white/10 px-3 py-1.5 rounded text-xs text-white font-medium hover:border-white/30 transition-all flex items-center gap-1 min-w-[80px]"
      >
        <div className="flex items-center gap-1">
          {/* Desktop/tablette large (>= md): code + nom complet */}
          <span className="hidden md:inline text-xs text-white/80">
            {base || "BASE"}
            {baseEntry?.name ? ` – ${baseEntry.name}` : ""}
          </span>
          {/* Mobile + petite tablette (< md): drapeau + code ISO */}
          <span className="inline-flex md:hidden items-center gap-1 text-[11px]">
            <span>{getFlag(base || "")}</span>
            <span>{base || "BASE"}</span>
          </span>
        </div>
        <svg
          className="w-3 h-3 ml-auto"
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

      <span className="text-white/50 text-xs">/</span>

      {/* Quote selector */}
      <button
        type="button"
        onClick={() => openFor("quote")}
        className="bg-black/60 border border-white/10 px-3 py-1.5 rounded text-xs text-white font-medium hover:border-white/30 transition-all flex items-center gap-1 min-w-[80px]"
      >
        <div className="flex items-center gap-1">
          {/* Desktop/tablette large (>= md): code + nom complet */}
          <span className="hidden md:inline text-xs text-white/80">
            {quote || "QUOTE"}
            {quoteEntry?.name ? ` – ${quoteEntry.name}` : ""}
          </span>
          {/* Mobile + petite tablette (< md): drapeau + code ISO */}
          <span className="inline-flex md:hidden items-center gap-1 text-[11px]">
            <span>{getFlag(quote || "")}</span>
            <span>{quote || "QUOTE"}</span>
          </span>
        </div>
        <svg
          className="w-3 h-3 ml-auto"
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

      {/* Dropdown */}
      {open && (
        <div
          ref={popupRef}
          className="absolute z-50 top-full mt-2 right-0 w-80 max-w-[90vw] bg-black/95 border border-white/15 rounded-lg shadow-2xl"
        >
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
            <div className="text-[10px] text-white/40 uppercase">
              {activeField === "base" ? "Select base currency" : "Select quote currency"}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setActiveField(null);
                setSearch("");
              }}
              className="text-white/40 hover:text-white/80 text-xs px-1"
            >
              ✕
            </button>
          </div>
          <div className="px-3 py-2 border-b border-white/10">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or name..."
              className="w-full bg-black/60 border border-white/15 rounded px-2 py-1 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-xcannes-green"
            />
          </div>

          {loading ? (
            <div className="px-3 py-4 text-xs text-white/50 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin" />
              Loading currencies...
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {/* Favorites */}
              <div className="px-3 py-2 border-b border-white/10">
                <div className="text-[10px] text-white/40 uppercase mb-1">
                  Favorites
                </div>
                <div className="flex flex-wrap gap-1">
                  {favorites.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleSelect(code)}
                      className="px-2 py-1 rounded border border-white/15 text-[11px] text-white/80 hover:border-xcannes-green hover:text-xcannes-green transition-all"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              {/* All currencies filtered */}
              <div className="px-3 py-2">
                <div className="text-[10px] text-white/40 uppercase mb-1">
                  All currencies
                </div>
                {filtered.length === 0 ? (
                  <div className="text-[11px] text-white/40 py-2">
                    {"No result for \""}{search}{"\""}
                  </div>
                ) : (
                  Object.entries(groupedByRegion).map(([region, list]) => (
                    <div key={region} className="mb-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRegions((prev) => ({
                            ...prev,
                            [region]: !prev[region],
                          }))
                        }
                        className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] text-white/60 hover:bg-white/5 rounded"
                      >
                        <span className="font-semibold">{region}</span>
                        <span className="text-white/40 text-[9px]">
                          {list.length}
                        </span>
                      </button>
                      {(expandedRegions[region] ?? true) && (
                        <div className="mt-1">
                          {list.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => handleSelect(c.code)}
                              className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 text-[11px] text-white/80"
                            >
                              <span className="font-semibold mr-2">
                                {c.code}
                              </span>
                              <span className="flex-1 text-left text-white/50 truncate">
                                {c.name}
                              </span>
                              <span className="text-white/30 text-[10px] ml-1">
                                {c.symbol}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
