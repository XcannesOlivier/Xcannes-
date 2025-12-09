"use client";

import { useState, useEffect, useMemo } from "react";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import SEOHead from "../components/SEOHead";
import { FxPairSelector } from "../components/XrplCandleChart";
import xcannesApi from "../lib/xcannesApi";

// Paires populaires par défaut (les plus échangées)
const POPULAR_PAIRS = [
  { base: "EUR", quote: "USD" },
  { base: "GBP", quote: "USD" },
  { base: "USD", quote: "JPY" },
  { base: "USD", quote: "CHF" },
  { base: "AUD", quote: "USD" },
  { base: "USD", quote: "CAD" },
  { base: "NZD", quote: "USD" },
  { base: "EUR", quote: "GBP" },
  { base: "EUR", quote: "JPY" },
  { base: "GBP", quote: "JPY" },
  { base: "EUR", quote: "CHF" },
  { base: "USD", quote: "CNY" },
  { base: "USD", quote: "HKD" },
  { base: "USD", quote: "SGD" },
  { base: "USD", quote: "KRW" },
  { base: "USD", quote: "INR" },
  { base: "USD", quote: "BRL" },
  { base: "USD", quote: "MXN" },
  { base: "USD", quote: "ZAR" },
  { base: "EUR", quote: "AUD" },
];

// Drapeaux pour les devises
const CURRENCY_FLAGS = {
  EUR: "🇪🇺", GBP: "🇬🇧", USD: "🇺🇸", JPY: "🇯🇵", CHF: "🇨🇭",
  AUD: "🇦🇺", CAD: "🇨🇦", NZD: "🇳🇿", SEK: "🇸🇪", NOK: "🇳🇴",
  DKK: "🇩🇰", PLN: "🇵🇱", CZK: "🇨🇿", HUF: "🇭🇺", RON: "🇷🇴",
  TRY: "🇹🇷", ZAR: "🇿🇦", MXN: "🇲🇽", BRL: "🇧🇷", CNY: "🇨🇳",
  INR: "🇮🇳", KRW: "🇰🇷", SGD: "🇸🇬", HKD: "🇭🇰", THB: "🇹🇭",
  AED: "🇦🇪", SAR: "🇸🇦", ILS: "🇮🇱", EGP: "🇪🇬", MAD: "🇲🇦",
  KES: "🇰🇪", NGN: "🇳🇬", GHS: "🇬🇭",
};

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
  if (CURRENCY_FLAGS[upper]) return CURRENCY_FLAGS[upper];
  const countryGuess = upper.slice(0, 2);
  return countryCodeToFlag(countryGuess);
}

export default function EODExchange() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [selectedPair, setSelectedPair] = useState({ base: "EUR", quote: "USD" });
  const [customPairs, setCustomPairs] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eod-custom-pairs');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddPair, setShowAddPair] = useState(false);
  const [eodData, setEodData] = useState({});
  const [loadingPairs, setLoadingPairs] = useState(new Set());

  // Sauvegarder les paires personnalisées
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eod-custom-pairs', JSON.stringify(customPairs));
    }
  }, [customPairs]);

  // Charger les données EOD pour une paire
  const loadEODData = async (base, quote) => {
    const pairKey = `${base}/${quote}`;
    setLoadingPairs(prev => new Set(prev).add(pairKey));
    
    try {
      const data = await xcannesApi.getFxEOD(base, quote, 1);
      setEodData(prev => ({
        ...prev,
        [pairKey]: data?.[0] || null
      }));
    } catch (error) {
      console.error(`Erreur chargement EOD ${pairKey}:`, error);
    } finally {
      setLoadingPairs(prev => {
        const newSet = new Set(prev);
        newSet.delete(pairKey);
        return newSet;
      });
    }
  };

  // Charger les données EOD pour les paires populaires au montage
  useEffect(() => {
    POPULAR_PAIRS.slice(0, 10).forEach(({ base, quote }) => {
      loadEODData(base, quote);
    });
  }, []);

  // Combiner paires populaires et personnalisées
  const allPairs = useMemo(() => {
    const pairs = [...POPULAR_PAIRS];
    customPairs.forEach(pair => {
      if (!pairs.some(p => p.base === pair.base && p.quote === pair.quote)) {
        pairs.push(pair);
      }
    });
    return pairs;
  }, [customPairs]);

  // Filtrer les paires selon la recherche
  const filteredPairs = useMemo(() => {
    if (!searchTerm.trim()) return allPairs;
    const term = searchTerm.toLowerCase();
    return allPairs.filter(pair => 
      pair.base.toLowerCase().includes(term) || 
      pair.quote.toLowerCase().includes(term) ||
      `${pair.base}${pair.quote}`.toLowerCase().includes(term)
    );
  }, [allPairs, searchTerm]);

  const handleAddCustomPair = () => {
    const { base, quote } = selectedPair;
    if (base && quote && base !== quote) {
      const exists = customPairs.some(p => p.base === base && p.quote === quote);
      if (!exists) {
        setCustomPairs(prev => [...prev, { base, quote }]);
        loadEODData(base, quote);
      }
      setShowAddPair(false);
    }
  };

  const handleRemoveCustomPair = (base, quote) => {
    setCustomPairs(prev => prev.filter(p => !(p.base === base && p.quote === quote)));
  };

  const isCustomPair = (base, quote) => {
    return customPairs.some(p => p.base === base && p.quote === quote);
  };

  const getPairDisplay = (pair) => {
    const baseFlag = getFlag(pair.base);
    const quoteFlag = getFlag(pair.quote);
    
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xl">{baseFlag}</span>
          <span className="text-xl">{quoteFlag}</span>
        </div>
        <span className="font-semibold text-sm">{pair.base}/{pair.quote}</span>
      </div>
    );
  };

  const getEODDisplay = (pair) => {
    const pairKey = `${pair.base}/${pair.quote}`;
    const isLoading = loadingPairs.has(pairKey);
    const data = eodData[pairKey];

    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <div className="w-3 h-3 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      );
    }

    if (!data) {
      return (
        <button
          onClick={() => loadEODData(pair.base, pair.quote)}
          className="text-xcannes-green hover:text-xcannes-green/80 text-xs transition-colors"
        >
          Load data
        </button>
      );
    }

    const price = data.close || data.price || 0;
    const change = data.change || 0;
    const changePercent = data.changePercent || 0;
    const isPositive = change >= 0;

    return (
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-sm text-white">{price.toFixed(5)}</div>
          <div className={`text-xs font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{change.toFixed(5)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <SEOHead 
        title={t("eod_exchange_title", "EOD Exchange - XCANNES")} 
        description={t("eod_exchange_description", "End of Day currency exchange rates")} 
      />

      <div className="min-h-screen bg-slate-900 text-white font-montserrat p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 pt-4">
            <h1 className="text-2xl md:text-3xl font-orbitron font-bold text-white mb-2">
              {t("eod_markets_title", "End of Day Markets")}
            </h1>
            <p className="text-white/60 text-sm mb-4">
              {t("eod_markets_subtitle", "Daily closing rates for 170+ currencies")}
            </p>

            {/* Barre de recherche et bouton ajouter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("search_pairs", "Search currency pairs...")}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-xcannes-green transition-colors"
                />
              </div>
              <button
                onClick={() => setShowAddPair(!showAddPair)}
                className="px-4 py-2 bg-xcannes-green hover:bg-xcannes-green/80 text-black font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                <span className="text-lg">+</span>
                <span>{t("add_pair", "Add Pair")}</span>
              </button>
            </div>

            {/* Panneau d'ajout de paire */}
            {showAddPair && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-white/60 mb-2">
                      {t("select_pair", "Select currency pair")}
                    </label>
                    <FxPairSelector
                      base={selectedPair.base}
                      quote={selectedPair.quote}
                      onChange={(pair) => setSelectedPair(pair)}
                    />
                  </div>
                  <div className="flex gap-2 sm:mt-6">
                    <button
                      onClick={handleAddCustomPair}
                      className="px-4 py-2 bg-xcannes-green hover:bg-xcannes-green/80 text-black font-medium rounded-lg transition-colors text-sm"
                    >
                      {t("add", "Add")}
                    </button>
                    <button
                      onClick={() => setShowAddPair(false)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                    >
                      {t("cancel", "Cancel")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-white/60 text-xs mb-1">{t("total_pairs", "Total Pairs")}</div>
              <div className="text-2xl font-bold text-white">{allPairs.length}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-white/60 text-xs mb-1">{t("custom_pairs", "Custom Pairs")}</div>
              <div className="text-2xl font-bold text-xcannes-green">{customPairs.length}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-white/60 text-xs mb-1">{t("currencies", "Currencies")}</div>
              <div className="text-2xl font-bold text-white">170+</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-white/60 text-xs mb-1">{t("update", "Update")}</div>
              <div className="text-sm font-bold text-white">Daily</div>
            </div>
          </div>

          {/* Grille de paires */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800 border-b border-slate-700">
                  <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">
                      {t("pair_column", "Pair")}
                    </th>
                    <th className="px-4 py-3 text-right">
                      {t("eod_price_column", "EOD Price & Change")}
                    </th>
                    <th className="px-4 py-3 text-right w-20">
                      {t("actions_column", "Actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredPairs.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-white/40">
                        {t("no_pairs_found", "No pairs found")}
                      </td>
                    </tr>
                  ) : (
                    filteredPairs.map((pair, index) => (
                      <tr 
                        key={`${pair.base}-${pair.quote}-${index}`}
                        className="hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-4">
                          {getPairDisplay(pair)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {getEODDisplay(pair)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {isCustomPair(pair.base, pair.quote) && (
                            <button
                              onClick={() => handleRemoveCustomPair(pair.base, pair.quote)}
                              className="text-red-400 hover:text-red-300 transition-colors text-xs"
                              title={t("remove", "Remove")}
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info footer */}
          <div className="mt-6 text-center text-sm text-slate-400">
            <p>
              {t("eod_info", "End of Day rates updated daily. Data sourced from Fawaz Forex Feed.")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// i18n
export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  };
}
