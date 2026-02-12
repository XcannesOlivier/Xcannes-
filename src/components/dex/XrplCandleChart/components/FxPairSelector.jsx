"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import xcannesApi from "@/lib/xcannesApi";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import { useTranslation } from "next-i18next";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const logError = (...args) => {
  if (DEBUG_LOGS) console.error(...args);
};

const REGION_DEFS = {
  Europe: ["EUR", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF"],
  Americas: ["USD", "CAD", "BRL", "MXN", "ARS", "CLP", "COP", "SOL", "BZD", "GTQ", "HNL", "CRC"],
  "Asia-Pacific": ["JPY", "CNY", "CNH", "HKD", "KRW", "INR", "SGD", "THB", "PHP", "IDR", "MYR", "AUD", "NZD", "FJD"],
  "Middle East & Africa": ["AED", "SAR", "QAR", "KWD", "EGP", "MAD", "ZAR", "KES", "NGN", "GHS"]
};

const DETAILED_REGIONS = [
"Europe - Northern",
"Europe - Western",
"Europe - Southern",
"Europe - Eastern",
"Europe - Legacy (pre-euro)",
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
"Africa - Southern"];


// Mapping des régions détaillées vers les codes de devises
const DETAILED_REGION_CURRENCIES = {
  "Europe - Northern": ["DKK", "GGP", "IMP", "ISK", "NOK", "SEK"],
  "Europe - Western": ["CHF", "EUR", "GBP"],
  "Europe - Southern": ["ALL", "GIP", "MKD", "RSD"],
  "Europe - Eastern": ["BGN", "BYN", "CZK", "HUF", "MDL", "PLN", "RON", "RUB", "UAH"],
  "Europe - Legacy (pre-euro)": [
  "BEF", // Franc belge
  "FRF", // Franc français
  "IEP", // Livre irlandaise
  "CYP", // Livre chypriote
  "ITL", // Lire italienne
  "MTL", // Lire maltaise
  "PTF", // Escudo portugais (PTE)
  "SIT", // Tolar slovène
  "VAL", // Lire du Vatican
  "BYR", // Ancien rouble biélorusse
  "ROL", // Ancien leu roumain
  "SKK" // Couronne slovaque
  ],
  "Americas - Northern": ["CAD", "USD"],
  "Americas - Central": ["BZD", "CRC", "GTQ", "HNL", "NIO", "PAB", "SVC"],
  "Americas - Caribbean": ["BBD", "BMD", "BSD", "CUP", "DOP", "HTG", "JMD", "KYD", "TTD", "XCD"],
  "Americas - Southern": ["ARS", "BRL", "CLP", "COP", "FKP", "GYD", "SOL", "SRD", "UYU"],
  "Asia - Western": ["AED", "BHD", "ILS", "IQD", "JOD", "KWD", "OMR", "QAR", "SAR", "SYP", "YER"],
  "Asia - Central": ["AMD", "AZN", "GEL", "KGS", "KZT", "TJS", "TMT", "UZS"],
  "Asia - Southern": ["AFN", "BTN", "INR", "LKR", "MVR", "NPR", "PKR"],
  "Asia - Eastern": ["CNH", "CNY", "HKD", "JPY", "KRW", "MOP", "TWD"],
  "Asia - South-Eastern": ["BND", "KHR", "LAK", "MMK", "MYR", "PHP", "SGD", "THB", "VND"],
  "Oceania - Australia & New Zealand": ["AUD", "NZD"],
  "Oceania - Melanesia": ["FJD"],
  "Oceania - Polynesia": ["SBD", "TOP", "XPF"],
  "Africa - Northern": ["DZD", "EGP", "LYD", "MAD", "SDG", "TND"],
  "Africa - Western": ["CVE", "GHS", "GMD", "GNF", "LRD", "NGN", "SHP", "SLE"],
  "Africa - Central": ["CDF", "STN", "XAF"],
  "Africa - Eastern": ["BIF", "DJF", "ETB", "KES", "KMF", "MUR", "RWF", "SOS", "SSP", "TZS", "UGX"],
  "Africa - Southern": ["AOA", "BWP", "MGA", "MWK", "MZN", "NAD", "SCR", "SZL", "ZAR", "ZWL"]
};

// Overrides explicites devise -> drapeau (multi-pays, cas spéciaux)
const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴"
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

export default function FxPairSelector({
  base,
  quote,
  value,
  onChange,
  alwaysOpen = false,
  compact = false
}) {
  const { t } = useTranslation("common");
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openInternal, setOpenInternal] = useState(false);
  const [activeField, setActiveField] = useState(null); // "base" | "quote" | null
  const [expandedRegions, setExpandedRegions] = useState({});
  const [expandedDetailedRegions, setExpandedDetailedRegions] = useState({});
  const [favorites, setFavorites] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fx-favorites');
      if (!saved) return [];
      try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];
        const normalized = parsed.map((code) => {
          if (String(code).toUpperCase() === 'PEN') return 'SOL';
          return String(code).toUpperCase();
        });
        return Array.from(new Set(normalized));
      } catch {
        return [];
      }
    }
    return [];
  });
  const popupRef = useRef(null);
  const [favoritesExpanded, setFavoritesExpanded] = useState(false);

  const resolvedBase = value && value.base || base || "";
  const resolvedQuote = value && value.quote || quote || "";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await xcannesApi.getFxCurrencies();
        if (!cancelled) {
          setCurrencies(list);
        }
      } catch (err) {
        logError("[FxPairSelector] Erreur chargement devises:", err);
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

  const baseEntry = byCode.get(String(resolvedBase || "").toUpperCase());
  const quoteEntry = byCode.get(String(resolvedQuote || "").toUpperCase());

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
    // En mode "alwaysOpen" (utilisé dans le header du chart),
    // on ne gère pas la fermeture auto au clic extérieur.
    if (!openInternal || alwaysOpen) return;
    const handleClick = (e) => {
      if (!popupRef.current) return;
      if (!popupRef.current.contains(e.target)) {
        setOpenInternal(false);
        setActiveField(null);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openInternal, alwaysOpen]);

  useEffect(() => {
    if (!alwaysOpen) return;
    setActiveField("base");
    setSearch("");
  }, [alwaysOpen]);

  const handleSelect = (code) => {
    const upper = code.toUpperCase();

    // Empêcher USD/USD
    if (activeField === "base" && upper === "USD") {
      // Si on sélectionne USD comme base, ne rien faire
      return;
    }
    if (
    activeField === "quote" &&
    upper === "USD" &&
    resolvedBase.toUpperCase() === "USD")
    {
      // Si on sélectionne USD comme quote et que base est déjà USD, ne rien faire
      return;
    }

    if (activeField === "base") {
      // Sélection de la devise de base
      const nextBase = upper;
      const nextQuote = resolvedQuote || "USD";

      if (onChange) {
        onChange({ base: nextBase, quote: nextQuote }, "base");
      }

      if (alwaysOpen) {
        // Mode header chart : rester ouvert et passer sur la quote
        setActiveField("quote");
        setSearch("");
      } else {
        // Mode EOD custom : fermer après sélection de la base
        setOpenInternal(false);
        setActiveField(null);
        setSearch("");
      }
      return;
    } else if (activeField === "quote") {
      // Sélection de la devise de cotation
      const nextBase = resolvedBase || "USD";
      const nextQuote = upper;

      // Ajouter aux favoris (max 5) uniquement pour les QUOTE
      if (!favorites.includes(upper)) {
        setFavorites((prev) => {
          const next = [upper, ...prev.filter((c) => c !== upper)];
          return next.slice(0, 5);
        });
      }

      if (onChange) {
        onChange({ base: nextBase, quote: nextQuote }, "quote");
      }

      if (!alwaysOpen) {
        setOpenInternal(false);
      }
      setActiveField(null);
      setSearch("");
      return;
    }

    // Fallback : si aucun champ actif, fermer proprement (sécurité)
    if (!alwaysOpen) {
      setOpenInternal(false);
      setActiveField(null);
      setSearch("");
    }
  };

  const clearFavorites = () => {
    setFavorites([]);
  };

  const openFor = (field) => {
    setActiveField(field);
    if (!alwaysOpen) {
      setOpenInternal(true);
    }
    setSearch("");
  };

  const isDropdownOpen = alwaysOpen || openInternal;

  return (
    <div
      className={
      alwaysOpen ?
      "relative flex flex-col gap-2" :
      "relative flex flex-col gap-2"
      }>

      {/* Ligne des boutons avec drapeaux */}
      <div className="flex items-center gap-2">
        {/* Base selector */}
        <button
          type="button"
          onClick={() => openFor("base")}
          className={
          "bg-elevated border border-white/10 px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1 min-w-[80px]" + (
          alwaysOpen ? " flex-1" : "") + (
          isDropdownOpen && activeField === "base" ?
          " border-xcannes-green text-xcannes-green" :
          " border-white/10 text-primary hover:border-xcannes-green/60")
          }>

          <div className="flex items-center gap-1">
            {/* Desktop: drapeau + code ISO */}
            <span className="hidden md:inline-flex items-center gap-1.5 text-base">
              <span>{getFlag(resolvedBase || "")}</span>
              <span className="text-sm font-semibold">{resolvedBase || "BASE"}</span>
            </span>
            {/* Mobile: drapeau + code ISO */}
            <span className="inline-flex md:hidden items-center gap-1 text-[14px]">
              <span>{getFlag(resolvedBase || "")}</span>
              <span>{resolvedBase || "BASE"}</span>
            </span>
          </div>
          <svg
            className="w-3 h-3 ml-auto"
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

        <span className="text-white/50 text-xs">/</span>

        {/* Quote selector */}
        <button
          type="button"
          onClick={() => openFor("quote")}
          className={
          "bg-elevated border border-white/10 px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1 min-w-[80px]" + (
          alwaysOpen ? " flex-1" : "") + (
          isDropdownOpen && activeField === "quote" ?
          " border-xcannes-green text-xcannes-green" :
          " border-white/10 text-primary hover:border-xcannes-green/60")
          }>

          <div className="flex items-center gap-1">
            {/* Desktop: drapeau + code ISO */}
            <span className="hidden md:inline-flex items-center gap-1.5 text-base">
              <span>{getFlag(resolvedQuote || "")}</span>
              <span className="text-sm font-semibold">{resolvedQuote || "QUOTE"}</span>
            </span>
            {/* Mobile: drapeau + code ISO */}
            <span className="inline-flex md:hidden items-center gap-1 text-[14px]">
              <span>{getFlag(resolvedQuote || "")}</span>
              <span>{resolvedQuote || "QUOTE"}</span>
            </span>
          </div>
          <svg
            className="w-3 h-3 ml-auto"
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
      </div>

      {/* Ligne des noms complets (desktop uniquement) */}
      {resolvedBase && resolvedQuote &&
      <div className="hidden md:flex items-center gap-2 text-[11px] text-white/60 -mt-1 pl-1">
          <span className="flex-1 text-left">
            {baseEntry?.name || getCurrencyDescription(resolvedBase)}
          </span>
          <span className="text-white/30">/</span>
          <span className="flex-1 text-left">
            {quoteEntry?.name || getCurrencyDescription(resolvedQuote)}
          </span>
        </div>
      }

      {/* Dropdown */}
      {isDropdownOpen &&
      <div
        ref={popupRef}
        className={
        alwaysOpen ?
        "mt-2 w-full bg-elevated border border-white/10 rounded-lg shadow-2xl" :
        "absolute z-50 top-full mt-2 right-0 w-96 max-w-[90vw] md:max-w-[95vw] bg-elevated border border-white/10 rounded-lg shadow-2xl"
        }>

          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span
              className={
              "text-[10px] font-semibold uppercase tracking-[0.16em]" + (
              activeField === "base" ?
              " text-xcannes-green" :
              " text-xcannes-green/80")
              }>

                {activeField === "base" ? "BASE (FROM)" : "QUOTE (TO)"}
              </span>
              <span className="text-[10px] text-muted uppercase">
                {activeField === "base" ?
              "Select base currency" :
              "Select quote currency"}
              </span>
            </div>
            {!alwaysOpen &&
          <button
            type="button"
            onClick={() => {
              setOpenInternal(false);
              setActiveField(null);
              setSearch("");
            }}
            className="text-muted hover:text-primary text-xs px-1">

                ✕
              </button>
          }
          </div>
          <div className="px-3 py-2 border-b border-white/10">
            <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("ui_search_code_or_name_1ed4e95837", "Search code or name...")}
            className="w-full bg-elevated border border-white/10 rounded px-2 py-1.5 text-sm md:text-xs text-primary placeholder:text-muted focus:outline-none focus:border-xcannes-green" />

          </div>

          {loading ?
        <div className="px-3 py-4 text-sm md:text-xs text-muted flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin" />{t("ui_loading_currencies_6796a767dd", "Loading currencies...")}

        </div> :

        <div className={alwaysOpen ? "max-h-[236px] md:max-h-[330px] overflow-y-scroll" : "max-h-[236px] md:max-h-[330px] overflow-y-scroll"}>
              {compact ?
          <div className="px-3 py-2 space-y-3">
                  <div>
                    <div className="text-xs md:text-[10px] text-muted uppercase mb-1">
                      {t("ui_all_currencies_6155623249", "All currencies")}
                    </div>
                    {filtered.length === 0 ?
                <div className="text-sm md:text-[11px] text-muted py-2">
                        {"No result for \""}{search}{"\""}
                      </div> :

                <div className="mt-2 space-y-1">
                        {filtered.map((c) =>
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleSelect(c.code)}
                  className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 text-sm md:text-[11px] text-secondary">

                            <span className="font-semibold mr-2">
                              {c.code}
                            </span>
                            <span className="flex-1 text-left text-white/50 truncate">
                              {c.name}
                            </span>
                          </button>
                )}
                      </div>

              }
                  </div>
                </div> :

          <>
                {/* Favorites (collapsible, max 5) */}
                {favorites.length > 0 &&
            <div className="px-3 py-2 border-b border-white/10">
                    <button
                type="button"
                onClick={() => setFavoritesExpanded((v) => !v)}
                className="flex items-center justify-between w-full mb-1">

                      <div className="flex items-center gap-1">
                        <span className="text-xs md:text-[10px] text-muted uppercase">{t("ui_favorites_1cc397670e", "Favorites")}

                  </span>
                        <span className="text-[9px] text-muted">
                          ({favorites.length}/5)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFavorites();
                    }}
                    className="text-xs md:text-[10px] text-muted hover:text-primary transition-colors"
                    title={t("ui_clear_favorites_c448f101b4", "Clear favorites")}>{t("ui_clear_0c0415464e", "Clear")}


                  </button>
                        <svg
                    className={`w-3 h-3 text-muted transition-transform ${
                    favoritesExpanded ? "rotate-180" : ""}`
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
                      </div>
                    </button>
                    {favoritesExpanded &&
              <div className="flex flex-wrap gap-1">
                        {favorites.map((code) =>
                <button
                  key={code}
                  type="button"
                  onClick={() => handleSelect(code)}
                  className="px-2 py-1 rounded-full border border-white/10 text-sm md:text-[11px] text-secondary hover:border-xcannes-green hover:text-xcannes-green transition-all">

                            {code}
                          </button>
                )}
                      </div>
              }
                  </div>
            }

                {/* All currencies filtered */}
                <div className="px-3 py-2">
                  <div className="text-xs md:text-[10px] text-muted uppercase mb-1">{t("ui_all_currencies_6155623249", "All currencies")}

              </div>
                  
                  {/* Detailed regions list */}
                  {!search &&
                      <div className="mb-3 border-b border-white/10 pb-2">
                      {DETAILED_REGIONS.map((region) => {
                  const currencyCodes = DETAILED_REGION_CURRENCIES[region] || [];
                  const availableCurrencies = currencyCodes.
                  map((code) => byCode.get(code)).
                  filter((c) => c != null);
                  const isExpanded = expandedDetailedRegions[region];

                  return (
                    <div key={region} className="mb-1">
                            <button
                        type="button"
                        onClick={() =>
                        setExpandedDetailedRegions((prev) => ({
                          // Fermer toutes les autres régions et toggle celle-ci
                          [region]: !prev[region]
                        }))
                        }
                        className="w-full flex items-center justify-between px-2 py-1.5 text-sm md:text-[11px] text-secondary hover:bg-white/5 rounded">

                              <span>{region}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-muted text-[10px] md:text-[9px]">
                                  {availableCurrencies.length}
                                </span>
                                <svg
                            className={`w-3 h-3 transition-transform ${
                            isExpanded ? 'rotate-180' : ''}`
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
                              </div>
                            </button>
                            {isExpanded && availableCurrencies.length > 0 &&
                      <div className="mt-1 ml-2 pl-2 border-l border-white/10">
                        {availableCurrencies.map((c) =>
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleSelect(c.code)}
                          className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 text-sm md:text-[11px] text-secondary">

                                    <span className="font-semibold mr-2">
                                      {c.code}
                                    </span>
                                    <span className="flex-1 text-left text-white/50 truncate">
                                      {c.name}
                                    </span>
                                  </button>
                        )}
                              </div>
                      }
                          </div>);

                })}
                    </div>
              }
                  
                  {/* Si recherche active, afficher les résultats filtrés */}
                  {search && (
              filtered.length === 0 ?
              <div className="text-sm md:text-[11px] text-muted py-2">
                        {"No result for \""}{search}{"\""}
                      </div> :

              <div className="mt-2">
                        {filtered.map((c) =>
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleSelect(c.code)}
                  className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 text-sm md:text-[11px] text-secondary">

                            <span className="font-semibold mr-2">
                              {c.code}
                            </span>
                            <span className="flex-1 text-left text-white/50 truncate">
                              {c.name}
                            </span>
                          </button>
                )}
                      </div>)

              }
                </div>
              </>
          }
            </div>
        }
        </div>
      }
    </div>);

}
