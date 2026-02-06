"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import xcannesApi from "@/lib/xcannesApi";
import { useXcannesWS } from "@/context/XcannesWSContext";
import { getBookIdFromPair } from "@/lib/marketMetadata";
import { useTranslation } from "next-i18next";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const logError = (...args) => {
  if (DEBUG_LOGS) console.error(...args);
};

// Icônes crypto disponibles dans /public/symbols/
const CRYPTO_ICON_PATHS = {
  XRP: "/symbols/xrp.png",
  RLUSD: "/symbols/rlusd.png",
  XCS: "/symbols/xcs.svg"
};

// Fonction pour obtenir le drapeau d'une devise
const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴"
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
  DEFAULT: "💎"
};

// Liste des devises fiat connues (pour utiliser les drapeaux)
const FIAT_CURRENCIES = [
'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'CNH',
'HKD', 'SGD', 'KRW', 'INR', 'RUB', 'BRL', 'MXN', 'ZAR', 'TRY', 'SEK',
'NOK', 'DKK', 'PLN', 'THB', 'IDR', 'MYR', 'PHP', 'CZK', 'HUF', 'RON',
'ILS', 'AED', 'SAR', 'QAR', 'KWD', 'EGP', 'MAD', 'NGN', 'KES', 'GHS'];


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
    RLUSD: "RLUSD Stablecoin"
  };

  return names[upper] || code;
}

// ✅ Fonction intelligente : utilise les icônes PNG pour crypto, drapeaux pour fiat, ou icône texte
function getSmartIcon(code, currencyInfo) {
  const upper = String(code || "").toUpperCase();

  // Si c'est une crypto avec icône disponible, retourner le composant Image
  if (CRYPTO_ICON_PATHS[upper]) {
    return (
      <Image
        src={CRYPTO_ICON_PATHS[upper]}
        alt={upper}
        width={20}
        height={20}
        className="w-5 h-5 object-cover rounded-md" />);


  }

  // Si on a des infos de devise fiat, utiliser le drapeau
  if (currencyInfo && currencyInfo.code) {
    return <span className="text-xl max-sm:text-lg">{getFlag(currencyInfo.code)}</span>;
  }
  // Sinon, utiliser l'icône d'actif (texte)
  return <span className="text-xl max-sm:text-lg">{getAssetIcon(code)}</span>;
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
  const { t } = useTranslation("common");
  const { tickers } = useXcannesWS();

  // ✅ Auto-détection du fxMode si non fourni mais que fxBase/fxQuote sont présents
  const actualFxMode = fxMode !== undefined ? fxMode : fxBase && fxQuote && pair && !pair.includes('XRP') && !pair.includes('XCS') && !pair.includes('RLUSD');
  const actualFxBase = fxBase || 'EUR';
  const actualFxQuote = fxQuote || 'USD';

  const [stats, setStats] = useState({
    high24h: null,
    low24h: null,
    volume24h: null
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

        const baseInfo = list.find((c) => c.code === actualFxBase);
        const quoteInfo = list.find((c) => c.code === actualFxQuote);

        setCurrencies({
          base: baseInfo || { code: actualFxBase, name: actualFxBase },
          quote: quoteInfo || { code: actualFxQuote, name: actualFxQuote }
        });
      } catch (err) {
        logError('[ChartFooter] Erreur chargement devises:', err);
        setCurrencies({
          base: { code: actualFxBase, name: actualFxBase },
          quote: { code: actualFxQuote, name: actualFxQuote }
        });
      }
    };

    loadCurrencies();

    return () => {
      cancelled = true;
    };
  }, [actualFxMode, actualFxBase, actualFxQuote]);

  // Détecter XRPL / Pyth / externe
  useEffect(() => {
    const book = getBookIdFromPair(pair);
    const source = book?.source || (pair?.includes("_PYTH") || pair?.includes("PYTH/") ? "pyth" : "xrpl");
    setIsXrplPair(source === "xrpl");
    setIsPythPair(source === "pyth" || book?.type === "external");
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
      volume24h: providedStats.volume ?? providedStats.volume24h ?? null
    });
  }, [providedStats]);

  // Récupérer stats 24h depuis l'API (fallback si pas fournies par le parent et pas dans le WS)
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
          volume24h: volumeSource != null ? Number(volumeSource) : null
        });
      } catch (err) {
        logError('[ChartFooter] Erreur stats 24h:', err);
      }
    };

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [pair, providedStats]);

  // Si ticker WS dispo, l'utiliser en priorité UNIQUEMENT
  // lorsque le parent ne fournit pas déjà des stats (fallback pur)
  useEffect(() => {
    if (providedStats) return;
    const book = getBookIdFromPair(pair);
    if (!book?.backendPair) return;
    const wsTicker = tickers?.get?.(book.backendPair);
    if (!wsTicker) return;

    const highSource =
    wsTicker.high24h ??
    wsTicker.high_price ??
    wsTicker.highPrice ??
    wsTicker.high;
    const lowSource =
    wsTicker.low24h ??
    wsTicker.low_price ??
    wsTicker.lowPrice ??
    wsTicker.low;
    const volumeSource =
    wsTicker.volume24h ??
    wsTicker.volume ??
    wsTicker.quote_volume ??
    wsTicker.quoteVolume;

    // Stabiliser High / Low / Volume pour éviter les clignotements
    setStats((prev) => {
      const prevHigh = prev?.high24h ?? null;
      const prevLow = prev?.low24h ?? null;
      const prevVolume = prev?.volume24h ?? null;

      const highNum =
      highSource !== undefined && highSource !== null ?
      Number(highSource) :
      NaN;
      const lowNum =
      lowSource !== undefined && lowSource !== null ?
      Number(lowSource) :
      NaN;
      const volumeNum =
      volumeSource !== undefined && volumeSource !== null ?
      Number(volumeSource) :
      NaN;

      const nextHigh =
      Number.isFinite(highNum) && highNum > 0 ?
      highNum :
      prevHigh;
      const nextLow =
      Number.isFinite(lowNum) && lowNum > 0 ?
      lowNum :
      prevLow;
      const nextVolume =
      Number.isFinite(volumeNum) && volumeNum >= 0 ?
      volumeNum :
      prevVolume;

      return {
        high24h: nextHigh ?? null,
        low24h: nextLow ?? null,
        volume24h: nextVolume ?? null
      };
    });
  }, [pair, tickers, stats.high24h, stats.low24h, stats.volume24h, providedStats]);

  const baseIcon = getSmartIcon(pairInfo.base, currencies.base);
  const quoteIcon = getSmartIcon(pairInfo.quote, currencies.quote);
  const baseName = getSmartName(pairInfo.base, currencies.base);
  const quoteName = getSmartName(pairInfo.quote, currencies.quote);
  // Volume uniquement pour les paires XRPL "pures" (flux XRPL),
  // pas pour les paires Pyth ou EOD/FX.
  const showVolume = isXrplPair && !actualFxMode && !isPythPair;

  return (
    <div className="bg-elevated border-t-0 md:border-t border-subtle text-primary px-3 py-2 max-sm:px-2 max-sm:py-2">
      <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1">
            <div className="flex items-center justify-center w-5 h-5">{baseIcon}</div>
            <div className="flex items-center justify-center w-5 h-5">
              {quoteIcon}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="text-xs font-semibold text-primary">
              {pairInfo.base} / {pairInfo.quote || (actualFxMode ? actualFxQuote : "XRP")}
            </div>
            <div className="text-[11px] text-muted">
              {baseName} · {quoteName}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] max-sm:text-xs">
          <div className="px-2 py-1 rounded-md bg-elevated">
            <span className="text-muted mr-1">{t("ui_24h_high_ed16d75f72", "24h High")}</span>
            <span className="font-mono text-primary">
              {stats.high24h != null ?
              Number(stats.high24h).toFixed(5) :
              "—"}
            </span>
          </div>
          <div className="px-2 py-1 rounded-md bg-elevated">
            <span className="text-muted mr-1">{t("ui_24h_low_ebbb84750e", "24h Low")}</span>
            <span className="font-mono text-primary">
              {stats.low24h != null ?
              Number(stats.low24h).toFixed(5) :
              "—"}
            </span>
          </div>
          {showVolume &&
          <div className="px-2 py-1 rounded-md bg-elevated">
              <span className="text-muted mr-1">{t("ui_24h_volume_21cd876868", "24h Volume")}</span>
              <span className="font-mono text-primary">
                {stats.volume24h != null ?
              Number(stats.volume24h).toFixed(2) :
              "—"}
              </span>
            </div>
          }
        </div>
      </div>
    </div>);

}
