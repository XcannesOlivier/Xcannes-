"use client";

import { useEffect, useState } from "react";
import xcannesApi from "../../../lib/xcannesApi";
import { useXcannesWS } from "../../../context/XcannesWSContext";
import { getBookIdFromPair } from "../../../utils/xrpl";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const logError = (...args) => {
  if (DEBUG_LOGS) console.error(...args);
};

// Fonction pour obtenir le drapeau d'une devise
const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴",
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
  if (CURRENCY_FLAG_OVERRIDES[upper]) {
    return CURRENCY_FLAG_OVERRIDES[upper];
  }
  const countryGuess = upper.slice(0, 2);
  return countryCodeToFlag(countryGuess);
}

// Fonction pour obtenir l'icône d'un actif (fiat ou autre)
const ASSET_ICONS = {
  XRP: "✕",
  RLUSD: "$",
  DEFAULT: "💎",
};

// Liste des devises fiat connues (pour utiliser les drapeaux)
const FIAT_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'CNH',
  'HKD', 'SGD', 'KRW', 'INR', 'RUB', 'BRL', 'MXN', 'ZAR', 'TRY', 'SEK',
  'NOK', 'DKK', 'PLN', 'THB', 'IDR', 'MYR', 'PHP', 'CZK', 'HUF', 'RON',
  'ILS', 'AED', 'SAR', 'QAR', 'KWD', 'EGP', 'MAD', 'NGN', 'KES', 'GHS'
];

function getAssetIcon(code) {
  if (!code) return ASSET_ICONS.DEFAULT;
  const upper = String(code).toUpperCase();
  
  // Si c'est une devise fiat connue, utiliser le drapeau
  if (FIAT_CURRENCIES.includes(upper)) {
    return getFlag(upper);
  }
  
  return ASSET_ICONS[upper] || ASSET_ICONS.DEFAULT;
}

function getAssetName(code) {
  if (!code) return code;
  const upper = String(code).toUpperCase();
  
  const names = {
    XRP: "Ripple",
    RLUSD: "RLUSD Stablecoin",
  };
  
  return names[upper] || code;
}

// ✅ Fonction intelligente : utilise le drapeau si c'est une devise fiat, sinon une icône générique
function getSmartIcon(code, currencyInfo) {
  // Si on a des infos de devise fiat, utiliser le drapeau
  if (currencyInfo && currencyInfo.code) {
    return getFlag(currencyInfo.code);
  }
  // Sinon, utiliser l'icône d'actif
  return getAssetIcon(code);
}

function getSmartName(code, currencyInfo) {
  // Si on a des infos de devise fiat, utiliser le nom complet
  if (currencyInfo && currencyInfo.name) {
    return currencyInfo.name;
  }
  // Sinon, utiliser le nom d'actif
  return getAssetName(code);
}

export default function ChartFooter({ pair, fxMode, fxBase, fxQuote, stats24h: providedStats }) {
  const { tickers } = useXcannesWS();
  
  // ✅ Auto-détection du fxMode si non fourni mais que fxBase/fxQuote sont présents
  const actualFxMode = fxMode !== undefined ? fxMode : (fxBase && fxQuote && pair && !pair.includes('XRP') && !pair.includes('XCS') && !pair.includes('RLUSD'));
  const actualFxBase = fxBase || 'EUR';
  const actualFxQuote = fxQuote || 'USD';
  
  const [stats, setStats] = useState({
    high24h: null,
    low24h: null,
    volume24h: null,
  });
  const [isXrplPair, setIsXrplPair] = useState(false);
  const [isPythPair, setIsPythPair] = useState(false);
  const [currencies, setCurrencies] = useState({ base: null, quote: null });
  const [pairInfo, setPairInfo] = useState({ base: '', quote: '' });
  const [xrpSupply, setXrpSupply] = useState({ total: null, circulating: null });

  // Charger les infos des devises pour le mode FX EOD
  useEffect(() => {
    if (!actualFxMode || !actualFxBase || !actualFxQuote) {
      setCurrencies({ base: null, quote: null });
      return;
    }

    let cancelled = false;
    const loadCurrencies = async () => {
      try {
        const list = await xcannesApi.getFxCurrencies();
        if (cancelled) return;

        const baseInfo = list.find(c => c.code === actualFxBase);
        const quoteInfo = list.find(c => c.code === actualFxQuote);

        setCurrencies({
          base: baseInfo || { code: actualFxBase, name: actualFxBase },
          quote: quoteInfo || { code: actualFxQuote, name: actualFxQuote }
        });
      } catch (err) {
        logError('[ChartFooter] Erreur chargement devises:', err);
        setCurrencies({
          base: { code: actualFxBase, name: actualFxBase },
          quote: { code: actualFxQuote, name: actualFxQuote },
        });
      }
    };

    loadCurrencies();

    return () => {
      cancelled = true;
    };
  }, [actualFxMode, actualFxBase, actualFxQuote]);

  // Détecter XRPL / Pyth
  useEffect(() => {
    const book = getBookIdFromPair(pair);
    setIsXrplPair(Boolean(book?.backendPair));
    setIsPythPair(pair?.includes('_PYTH') || pair?.includes('PYTH/'));
    if (pair && pair.includes('/')) {
      const [base, quote] = pair.split('/');
      setPairInfo({ base, quote });
    } else {
      setPairInfo({ base: pair || '', quote: '' });
    }
  }, [pair]);

  // Synchroniser si stats fournies par le parent (évite double fetch)
  useEffect(() => {
    if (!providedStats) return;
    setStats({
      high24h: providedStats.high ?? providedStats.high24h ?? null,
      low24h: providedStats.low ?? providedStats.low24h ?? null,
      volume24h: providedStats.volume ?? providedStats.volume24h ?? null,
    });
  }, [providedStats]);

  // Récupérer stats 24h depuis l'API (fallback si pas dans le WS ou pas fournies)
  useEffect(() => {
    if (providedStats) return;
    let cancelled = false;

    const loadStats = async () => {
      try {
        const book = getBookIdFromPair(pair);
        if (!book?.backendPair) return;
        const ticker = await xcannesApi.getTicker(book.backendPair);
        if (!ticker || cancelled) return;
        const highSource =
          ticker.high24h ??
          ticker.high_price ??
          ticker.highPrice ??
          ticker.high;
        const lowSource =
          ticker.low24h ??
          ticker.low_price ??
          ticker.lowPrice ??
          ticker.low;
        const volumeSource =
          ticker.volume24h ??
          ticker.volume ??
          ticker.quoteVolume ??
          ticker.quote_volume;
        setStats({
          high24h: highSource != null ? Number(highSource) : null,
          low24h: lowSource != null ? Number(lowSource) : null,
          volume24h: volumeSource != null ? Number(volumeSource) : null,
        });
      } catch (err) {
        logError('[ChartFooter] Erreur stats 24h:', err);
      }
    };

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [pair]);

  // Si ticker WS dispo, l'utiliser en priorité
  useEffect(() => {
    const book = getBookIdFromPair(pair);
    if (!book?.backendPair) return;
    const wsTicker = tickers?.get?.(book.backendPair);
    if (!wsTicker) return;

    const highSource =
      wsTicker.high24h ??
      wsTicker.high_price ??
      wsTicker.highPrice ??
      wsTicker.high ??
      stats.high24h;
    const lowSource =
      wsTicker.low24h ??
      wsTicker.low_price ??
      wsTicker.lowPrice ??
      wsTicker.low ??
      stats.low24h;
    const volumeSource =
      wsTicker.volume24h ??
      wsTicker.volume ??
      wsTicker.quote_volume ??
      wsTicker.quoteVolume ??
      stats.volume24h;

    setStats({
      high24h: highSource != null ? Number(highSource) : null,
      low24h: lowSource != null ? Number(lowSource) : null,
      volume24h: volumeSource != null ? Number(volumeSource) : null,
    });
  }, [pair, tickers, stats.high24h, stats.low24h, stats.volume24h]);

  const baseIcon = getSmartIcon(pairInfo.base, currencies.base);
  const quoteIcon = getSmartIcon(pairInfo.quote, currencies.quote);
  const baseName = getSmartName(pairInfo.base, currencies.base);
  const quoteName = getSmartName(pairInfo.quote, currencies.quote);

  return (
    <div className="bg-black/50 border-t border-white/10 text-white p-3 max-sm:p-2">
      <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
        <div className="flex items-center gap-3">
          <div className="text-2xl max-sm:text-xl">{baseIcon}</div>
          <div>
            <div className="text-sm font-semibold">
              {pairInfo.base} / {pairInfo.quote || (actualFxMode ? actualFxQuote : "XRP")}
            </div>
            <div className="text-xs text-white/60">
              {baseName} · {quoteName}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs max-sm:text-sm">
          <div className="px-2 py-1 rounded bg-white/5 border border-white/10">
            <span className="text-white/60">24h High</span>{" "}
            <span className="font-semibold text-white">
              {stats.high24h ? Number(stats.high24h).toFixed(6) : "—"}
            </span>
          </div>
          <div className="px-2 py-1 rounded bg-white/5 border border-white/10">
            <span className="text-white/60">24h Low</span>{" "}
            <span className="font-semibold text-white">
              {stats.low24h ? Number(stats.low24h).toFixed(6) : "—"}
            </span>
          </div>
          <div className="px-2 py-1 rounded bg-white/5 border border-white/10">
            <span className="text-white/60">24h Volume</span>{" "}
            <span className="font-semibold text-white">
              {stats.volume24h ? Number(stats.volume24h).toFixed(2) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
