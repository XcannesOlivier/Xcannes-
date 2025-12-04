"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import xcannesApi from "../lib/xcannesApi";

const REGION_DEFS = {
  Europe: ["EUR", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF"],
  Americas: ["USD", "CAD", "BRL", "MXN", "ARS", "CLP", "COP", "PEN", "BZD", "GTQ", "HNL", "CRC"],
  "Asia-Pacific": ["JPY", "CNY", "CNH", "HKD", "KRW", "INR", "SGD", "THB", "PHP", "IDR", "MYR", "AUD", "NZD", "FJD"],
  "Middle East & Africa": ["AED", "SAR", "QAR", "KWD", "EGP", "MAD", "ZAR", "KES", "NGN", "GHS"],
};

const DETAILED_REGIONS = [
  "Europe - Northern",
  "Europe - Western",
  "Europe - Southern",
  "Europe - Eastern",
  "Americas - Northern",
  "Americas - Central",
  "Americas - Caribbean",
  "Americas - Southern",
  "Asia - Western",
  "Asia - Central",
  "Asia - Southern",
  "Asia - Eastern",
  "Asia - South-Eastern",
  "Oceania - Australia & New Zealand",
  "Oceania - Melanesia",
  "Oceania - Polynesia",
  "Africa - Northern",
  "Africa - Western",
  "Africa - Central",
  "Africa - Eastern",
  "Africa - Southern",
];

// Mapping des régions détaillées vers les codes de devises
const DETAILED_REGION_CURRENCIES = {
  "Europe - Northern": ["DKK", "GGP", "IMP", "ISK", "NOK", "SEK"],
  "Europe - Western": ["BEF", "CHF", "EUR", "FRF", "GBP", "IEP", "LUF"],
  "Europe - Southern": ["ALL", "CYP", "GIP", "HRK", "ITL", "MKD", "MTL", "PTF", "RSD", "SIT", "VAL"],
  "Europe - Eastern": ["BGN", "BYN", "BYR", "CZK", "HUF", "MDL", "PLN", "ROL", "RON", "RUB", "SKK", "UAH"],
  "Americas - Northern": ["CAD", "USD"],
  "Americas - Central": ["BZD", "CRC", "GTQ", "HNL", "NIO", "PAB", "SVC"],
  "Americas - Caribbean": ["BBD", "BMD", "BSD", "CUC", "CUP", "DOP", "HTG", "JMD", "KYD", "TTD", "XCD"],
  "Americas - Southern": ["ARS", "BRL", "CLP", "COP", "FKP", "GYD", "PEN", "SRD", "UYU"],
  "Asia - Western": ["AED", "BHD", "ILS", "IQD", "JOD", "KWD", "OMR", "QAR", "SAR", "SYP", "YER"],
  "Asia - Central": ["AMD", "AZN", "GEL", "KGS", "KZT", "TJS", "TMM", "TMT", "UZS"],
  "Asia - Southern": ["AFN", "BTN", "INR", "LKR", "MVR", "NPR", "PKR"],
  "Asia - Eastern": ["CNH", "CNY", "HKD", "JPY", "KRW", "MOP", "TWD"],
  "Asia - South-Eastern": ["BND", "KHR", "LAK", "MMK", "MYR", "PHP", "SGD", "THB", "VND"],
  "Oceania - Australia & New Zealand": ["AUD", "NZD"],
  "Oceania - Melanesia": ["FJD"],
  "Oceania - Polynesia": ["SBD", "TOP", "XPF"],
  "Africa - Northern": ["DZD", "EGP", "LYD", "MAD", "SDD", "SDG", "TND"],
  "Africa - Western": ["CVE", "GHC", "GHS", "GMD", "GNF", "LRD", "MRO", "NGN", "SHP", "SLE", "SLL"],
  "Africa - Central": ["CDF", "STD", "STN", "XAF"],
  "Africa - Eastern": ["BIF", "DJF", "ETB", "KES", "KMF", "MUR", "RWF", "SOS", "SSP", "TZS", "UGX"],
  "Africa - Southern": ["AOA", "BWP", "MGA", "MGF", "MWK", "MZN", "NAD", "SCR", "SZL", "ZAR", "ZMK", "ZWD", "ZWL"],
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
  const [expandedDetailedRegions, setExpandedDetailedRegions] = useState({});
  const [favorites, setFavorites] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fx-favorites');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
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

  // Sauvegarder les favoris dans localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fx-favorites', JSON.stringify(favorites));
    }
  }, [favorites]);

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
    
    // Empêcher USD/USD
    if (activeField === "base" && upper === "USD") {
      // Si on sélectionne USD comme base, ne rien faire
      return;
    }
    if (activeField === "quote" && upper === "USD" && base === "USD") {
      // Si on sélectionne USD comme quote et que base est déjà USD, ne rien faire
      return;
    }
    
    // Ajouter aux favoris si pas déjà présent
    if (!favorites.includes(upper)) {
      setFavorites(prev => [...prev, upper]);
    }
    
    if (activeField === "base") {
      if (onChange) {
        onChange({ base: upper, quote: quote || "USD" });
      }
      // Fermer le dropdown après sélection de la base
      setOpen(false);
      setActiveField(null);
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

  const clearFavorites = () => {
    setFavorites([]);
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
          <span className="inline-flex md:hidden items-center gap-1 text-[14px]">
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
          <span className="inline-flex md:hidden items-center gap-1 text-[14px]">
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
          className="absolute z-50 top-full mt-2 right-0 w-96 max-w-[90vw] md:max-w-[95vw] bg-black/95 border border-white/15 rounded-lg shadow-2xl"
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or name..."
              className="w-full bg-black/60 border border-white/15 rounded px-2 py-1.5 text-sm md:text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-xcannes-green"
            />
          </div>

          {loading ? (
            <div className="px-3 py-4 text-sm md:text-xs text-white/50 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin" />
              Loading currencies...
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {/* Favorites */}
              {favorites.length > 0 && (
                <div className="px-3 py-2 border-b border-white/10">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs md:text-[10px] text-white/40 uppercase">
                      Favorites
                    </div>
                    <button
                      type="button"
                      onClick={clearFavorites}
                      className="text-xs md:text-[10px] text-white/40 hover:text-white/80 transition-colors"
                      title="Clear favorites"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {favorites.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => handleSelect(code)}
                        className="px-2 py-1 rounded border border-white/10 text-sm md:text-[11px] text-white/80 hover:border-xcannes-green hover:text-xcannes-green transition-all"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All currencies filtered */}
              <div className="px-3 py-2">
                <div className="text-xs md:text-[10px] text-white/40 uppercase mb-1">
                  All currencies
                </div>
                
                {/* Detailed regions list */}
                {!search && (
                  <div className="mb-3 border-b border-white/10 pb-2">
                    {DETAILED_REGIONS.map((region) => {
                      const currencyCodes = DETAILED_REGION_CURRENCIES[region] || [];
                      const availableCurrencies = currencyCodes
                        .map(code => byCode.get(code))
                        .filter(c => c != null);
                      const isExpanded = expandedDetailedRegions[region];
                      
                      return (
                        <div key={region} className="mb-1">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDetailedRegions((prev) => ({
                                // Fermer toutes les autres régions et toggle celle-ci
                                [region]: !prev[region],
                              }))
                            }
                            className="w-full flex items-center justify-between px-2 py-1.5 text-sm md:text-[11px] text-white/60 hover:bg-white/5 rounded"
                          >
                            <span>{region}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-white/40 text-[10px] md:text-[9px]">
                                {availableCurrencies.length}
                              </span>
                              <svg
                                className={`w-3 h-3 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
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
                            </div>
                          </button>
                          {isExpanded && availableCurrencies.length > 0 && (
                            <div className="mt-1 ml-2 pl-2 border-l border-white/10">
                              {availableCurrencies.map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => handleSelect(c.code)}
                                  className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 text-sm md:text-[11px] text-white/80"
                                >
                                  <span className="font-semibold mr-2">
                                    {c.code}
                                  </span>
                                  <span className="flex-1 text-left text-white/50 truncate">
                                    {c.name}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Si recherche active, afficher les résultats filtrés */}
                {search && (
                  filtered.length === 0 ? (
                    <div className="text-sm md:text-[11px] text-white/40 py-2">
                      {"No result for \""}{search}{"\""}
                    </div>
                  ) : (
                    <div className="mt-2">
                      {filtered.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleSelect(c.code)}
                          className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 text-sm md:text-[11px] text-white/80"
                        >
                          <span className="font-semibold mr-2">
                            {c.code}
                          </span>
                          <span className="flex-1 text-left text-white/50 truncate">
                            {c.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
