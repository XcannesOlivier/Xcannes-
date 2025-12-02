"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import xcannesApi from "../lib/xcannesApi";

// Répartition des devises par région / sous-région (schéma proche ONU)
const REGION_DEFS = {
  // Europe
  "Europe - Northern": [
    "SEK", // Suède
    "NOK", // Norvège
    "DKK", // Danemark
    "ISK", // Islande
    "IMP", // Livre de l'île de Man
    "GGP", // Livre de Guernesey
  ],
  "Europe - Western": [
    "EUR", // Zone euro (coeur)
    "GBP", // Royaume-Uni
    "CHF", // Suisse
    // Anciennes monnaies d'Europe de l'Ouest (pré-euro)
    "DEM", // Deutsche Mark
    "FRF", // Franc français
    "BEF", // Franc belge
    "NLG", // Florin néerlandais
    "LUF", // Franc luxembourgeois
    "IEP", // Livre irlandaise
  ],
  "Europe - Eastern": [
    "PLN", // Pologne
    "CZK", // Tchéquie
    "HUF", // Hongrie
    "RON", // Roumanie
    "ROL", // Ancien leu roumain (legacy)
    "BGN", // Bulgarie
    "RUB", // Russie
    "UAH", // Ukraine
    "BYN", // Biélorussie
    "BYR", // Ancien rouble biélorusse (legacy)
    "MDL", // Moldavie
    "SKK", // Ancienne couronne slovaque (legacy)
  ],
  "Europe - Southern": [
    "ALL", // Albanie
    "BAM", // Bosnie-Herzégovine
    "HRK", // Croatie (legacy)
    "MKD", // Macédoine du Nord
    "RSD", // Serbie
    "TRY", // Turquie (souvent classée Europe du Sud/Est)
    // Anciennes monnaies d'Europe du Sud (pré-euro)
    "ITL", // Lire italienne
    "ESP", // Peseta espagnole
    "PTE", // Escudo portugais
    "GRD", // Drachme grecque
    "VAL", // Lire de la Cité du Vatican (legacy)
    "CYP", // Livre chypriote (legacy)
    "GIP", // Livre de Gibraltar
    "MTL", // Lire maltaise (legacy)
  ],
  // Amériques (conforme aux sous-régions ONU : Mexique en Amérique centrale)
  "Americas - Northern": ["USD", "CAD"],
  "Americas - Central": ["GTQ", "HNL", "BZD", "CRC", "MXN"],
  "Americas - Caribbean": [
    "XCD", // Dollar des Caraïbes orientales
    "JMD", // Jamaïque
    "TTD", // Trinité-et-Tobago
    "BSD", // Bahamas
    "BBD", // Barbade
    "BMD", // Bermudes
    "DOP", // République dominicaine
    "HTG", // Haïti
    "CUP", // Cuba
    "CUC", // Peso convertible cubain (legacy)
    "KYD", // Dollar des îles Caïmans
  ],
  "Americas - Southern": ["BRL", "ARS", "CLP", "COP", "PEN"],
  // Ancienne monnaie d'Amérique centrale
  "Americas - Central": ["GTQ", "HNL", "BZD", "CRC", "SVC", "NIO", "PAB"], // Salvadoran Colón + Nicaragua + Panama
  // Ancienne monnaie d'Amérique du Sud
  "Americas - Southern": ["BRL", "ARS", "CLP", "COP", "PEN", "UYU", "GYD", "FKP", "SRD"], // Uruguay, Guyana, Falklands, Suriname
  // Asie (répartition inspirée des sous-régions ONU)
  "Asia - Western": [
    "AED",
    "SAR",
    "QAR",
    "KWD",
    "BHD", // Bahreïn
    "OMR", // Oman
    "JOD", // Jordanie
    "ILS", // Israël
    "SYP", // Syrie
    "YER", // Yémen
    "IQD", // Irak
  ],
  "Asia - Southern": [
    "INR", // Inde
    "PKR", // Pakistan
    "BDT", // Bangladesh
    "LKR", // Sri Lanka
    "NPR", // Népal
    "MVR", // Maldives
    "AFN", // Afghanistan
    "BTN", // Bhoutan
  ],
  "Asia - Eastern": [
    "CNY",
    "CNH",
    "HKD",
    "JPY",
    "KRW",
    "TWD", // Taïwan
    "MOP", // Macao
  ],
  "Asia - South-Eastern": [
    "SGD",
    "THB",
    "PHP",
    "IDR",
    "MYR",
    "VND", // Vietnam
    "KHR", // Cambodge
    "MMK", // Myanmar
    "LAK", // Laos
    "BND", // Brunei
  ],
  "Asia - Central": [
    "KZT", // Kazakhstan
    "UZS", // Ouzbékistan
    "TMT", // Turkménistan
    "KGS", // Kirghizistan
    "TJS", // Tadjikistan
    "AZN", // Azerbaïdjan
    "GEL", // Géorgie
    "AMD", // Arménie
    "TMM", // Ancien manat turkmène (legacy)
  ],
  // Océanie
  "Oceania - Australia & New Zealand": ["AUD", "NZD"],
  "Oceania - Melanesia": ["FJD"],
  "Oceania - Micronesia": [],
  "Oceania - Polynesia": [
    "TVD", // Dollar de Tuvalu
    "XPF", // Franc CFP (Polynésie française, etc.)
    "SBD", // Solomon Islands Dollar (géographiquement Mélanésie, mais souvent groupé Pacifique)
  ],
  // Afrique
  "Africa - Northern": [
    "EGP", // Égypte
    "LYD", // Libye
    "MAD", // Maroc
    "TND", // Tunisie
    "DZD", // Algérie
    "SDG", // Soudan (actuel)
    "SDD", // Ancien dinar soudanais (legacy)
  ],
  "Africa - Western": [
    "XOF", // UEMOA (BCEAO)
    "NGN", // Nigeria
    "GHS", // Ghana (actuel)
    "GHC", // Ancien cedi ghanéen (legacy)
    "GNF", // Guinée
    "SLL", // Ancien Leone sierra-léonais
    "SLE", // Nouveau Leone sierra-léonais
    "LRD", // Liberia
    "CVE", // Cap-Vert
    "MRU", // Mauritanie
    "GMD", // Gambie
    "SHP", // Livre de Sainte-Hélène
  ],
  "Africa - Central": [
    "XAF", // CEMAC (BEAC)
    "CDF", // RD Congo
    "STN", // Sao Tomé-et-Principe (nouveau dobra)
    "STD", // Ancien Sao Tomé Dobra (legacy)
  ],
  "Africa - Eastern": [
    "KES", // Kenya
    "TZS", // Tanzanie
    "UGX", // Ouganda
    "ETB", // Éthiopie
    "RWF", // Rwanda
    "BIF", // Burundi
    "SOS", // Somalie
    "DJF", // Djibouti
    "KMF", // Comores
    "MUR", // Roupie mauricienne
    "SSP", // South Sudanese Pound
  ],
  "Africa - Southern": [
    "ZAR", // Afrique du Sud
    "BWP", // Botswana
    "NAD", // Namibie
    "ZMW", // Zambie
    "MWK", // Malawi
    "AOA", // Angola
    "LSL", // Lesotho
    "SZL", // Eswatini
    "MZN", // Mozambique
    "ZWL", // Zimbabwe
    "MGA", // Madagascar
    "SCR", // Seychelles
    "ZMK", // Ancien kwacha zambien
    "ZWD", // Ancien dollar zimbabwéen
    "MGF", // Ancien franc malgache
  ],
};

// Ordre d'affichage des régions dans le modal (régions ONU -> sous-régions)
const REGION_ORDER = [
  // Europe
  "Europe - Northern",
  "Europe - Western",
  "Europe - Southern",
  "Europe - Eastern",
  // Amériques
  "Americas - Northern",
  "Americas - Central",
  "Americas - Caribbean",
  "Americas - Southern",
  // Asie
  "Asia - Western",
  "Asia - Central",
  "Asia - Southern",
  "Asia - Eastern",
  "Asia - South-Eastern",
  // Océanie
  "Oceania - Australia & New Zealand",
  "Oceania - Melanesia",
  "Oceania - Micronesia",
  "Oceania - Polynesia",
  // Afrique
  "Africa - Northern",
  "Africa - Western",
  "Africa - Central",
  "Africa - Eastern",
  "Africa - Southern",
];

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
          let enriched = Array.isArray(list) ? list.slice() : [];

          // ✅ S'assurer que l'USD existe toujours dans la liste EOD,
          // même si l'API FX ne le renvoie pas explicitement
          const hasUsd = enriched.some(
            (c) => String(c.code || "").toUpperCase() === "USD"
          );
          if (!hasUsd) {
            enriched.unshift({
              code: "USD",
              name: "US Dollar",
              symbol: "$",
            });
          }

          setCurrencies(enriched);
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

    // Construire les groupes bruts
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

    // Ordonner les devises à l'intérieur de chaque région par code ISO
    Object.keys(groups).forEach((region) => {
      groups[region].sort((a, b) => a.code.localeCompare(b.code));
    });

    // Construire un objet ordonné selon REGION_ORDER, puis les éventuelles régions restantes
    const ordered = {};
    REGION_ORDER.forEach((region) => {
      if (groups[region]) {
        ordered[region] = groups[region];
      }
    });
    Object.keys(groups).forEach((region) => {
      // Ne pas réintroduire "Other" : on cache les devises non mappées (ex: tokens crypto)
      if (!REGION_ORDER.includes(region) && region !== "Other") {
        ordered[region] = groups[region];
      }
    });

    return ordered;
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
            <div className="max-h-[50vh] md:max-h-[65vh] overflow-y-auto">
              {/* All currencies filtered */}
              <div className="px-3 py-2">
                <div className="text-[10px] max-sm:text-sm text-white/40 uppercase mb-1">
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
                          setExpandedRegions((prev) => {
                            const isCurrentlyOpen = !!prev[region];
                            // Accordéon : soit on ferme tout, soit on n'ouvre que cette région
                            if (isCurrentlyOpen) {
                              return {};
                            }
                            return { [region]: true };
                          })
                        }
                        className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] max-sm:text-base text-white/60 hover:bg-white/5 rounded"
                      >
                        <span className="font-semibold">{region}</span>
                        <span className="text-white/40 text-[9px] max-sm:text-xs">
                          {list.length}
                        </span>
                      </button>
                      {expandedRegions[region] && (
                        <div className="mt-1">
                          {list.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => handleSelect(c.code)}
                              className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 text-[11px] max-sm:text-base text-white/80"
                            >
                              <span className="font-semibold mr-2">
                                {c.code}
                              </span>
                              <span className="flex-1 text-left text-white/50 truncate">
                                {c.name}
                              </span>
                              <span className="text-white/30 text-[10px] max-sm:text-xs ml-1">
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
