"use client";

import { useEffect, useState } from "react";
import xcannesApi from "../lib/xcannesApi";
import { useXcannesWS } from "../context/XcannesWSContext";
import { getBookIdFromPair } from "../utils/xrpl";

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

// Fonction pour obtenir l'icône d'un actif crypto/commodity
const ASSET_ICONS = {
  // Crypto
  BTC: "₿",
  ETH: "Ξ",
  USDT: "₮",
  USDC: "🔵",
  BNB: "🔶",
  XRP: "✕",
  ADA: "₳",
  SOL: "◎",
  DOT: "●",
  DOGE: "Ð",
  MATIC: "⬡",
  AVAX: "🔺",
  LINK: "⬣",
  UNI: "🦄",
  ATOM: "⚛",
  
  // Commodities
  GOLD: "🥇",
  SILVER: "⚪",
  OIL: "🛢️",
  GAS: "⛽",
  WHEAT: "🌾",
  CORN: "🌽",
  COFFEE: "☕",
  SUGAR: "🧁",
  COPPER: "🟤",
  
  // Par défaut
  DEFAULT: "💎"
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
    // Crypto
    BTC: "Bitcoin",
    ETH: "Ethereum",
    USDT: "Tether",
    USDC: "USD Coin",
    BNB: "Binance Coin",
    XRP: "Ripple",
    ADA: "Cardano",
    SOL: "Solana",
    DOT: "Polkadot",
    DOGE: "Dogecoin",
    MATIC: "Polygon",
    AVAX: "Avalanche",
    LINK: "Chainlink",
    UNI: "Uniswap",
    ATOM: "Cosmos",
    
    // Commodities
    GOLD: "Gold",
    SILVER: "Silver",
    OIL: "Crude Oil",
    WTI: "West Texas Intermediate",
    BRENT: "Brent Crude",
    GAS: "Natural Gas",
    WHEAT: "Wheat",
    CORN: "Corn",
    COFFEE: "Coffee",
    SUGAR: "Sugar",
    COPPER: "Copper",
    
    // Devises fiat principales
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "British Pound",
    JPY: "Japanese Yen",
    CHF: "Swiss Franc",
    CAD: "Canadian Dollar",
    AUD: "Australian Dollar",
    NZD: "New Zealand Dollar",
    CNY: "Chinese Yuan",
    CNH: "Chinese Yuan (Offshore)",
  };
  
  return names[upper] || code;
}

// ✅ Fonction intelligente : utilise le drapeau si c'est une devise fiat, sinon l'icône crypto/commodity
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

export default function ChartFooter({ pair, fxMode, fxBase, fxQuote }) {
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
        console.error('[ChartFooter] Erreur chargement devises:', err);
        setCurrencies({
          base: { code: actualFxBase, name: actualFxBase },
          quote: { code: actualFxQuote, name: actualFxQuote }
        });
      }
    };

    loadCurrencies();
    return () => { cancelled = true; };
  }, [actualFxMode, actualFxBase, actualFxQuote]);

  // ✅ Charger les infos des devises pour les paires Pyth aussi
  useEffect(() => {
    if (!isPythPair || !pairInfo.base || !pairInfo.quote) {
      return;
    }

    let cancelled = false;
    const loadPythCurrencies = async () => {
      try {
        const list = await xcannesApi.getFxCurrencies();
        if (cancelled) return;

        // Chercher si base ou quote sont des devises fiat
        const baseInfo = list.find(c => c.code === pairInfo.base);
        const quoteInfo = list.find(c => c.code === pairInfo.quote);

        // Si on trouve des infos, on les stocke
        if (baseInfo || quoteInfo) {
          setCurrencies({
            base: baseInfo || null,
            quote: quoteInfo || null
          });
        }
      } catch (err) {
        console.error('[ChartFooter] Erreur chargement devises Pyth:', err);
      }
    };

    loadPythCurrencies();
    return () => { cancelled = true; };
  }, [isPythPair, pairInfo.base, pairInfo.quote]);

  // // ✅ Charger la supply XRP toutes les 24h
  // useEffect(() => {
  //   let cancelled = false;
  //   
  //   const loadXrpSupply = async () => {
  //     try {
  //       const response = await fetch('https://data.ripple.com/v2/network/xrp_distribution');
  //       const data = await response.json();
  //       
  //       if (!cancelled && data.rows && data.rows[0]) {
  //         const row = data.rows[0];
  //         setXrpSupply({
  //           total: parseInt(row.total),
  //           circulating: parseInt(row.distributed)
  //         });
  //         console.log('[ChartFooter] XRP Supply loaded:', {
  //           total: parseInt(row.total).toLocaleString(),
  //           circulating: parseInt(row.distributed).toLocaleString()
  //         });
  //       }
  //     } catch (err) {
  //       console.error('[ChartFooter] Erreur chargement XRP supply:', err);
  //     }
  //   };
  //
  //   loadXrpSupply();
  //   
  //   // Recharger toutes les 24h
  //   const interval = setInterval(loadXrpSupply, 24 * 60 * 60 * 1000);
  //   
  //   return () => {
  //     cancelled = true;
  //     clearInterval(interval);
  //   };
  // }, []);

  useEffect(() => {
    let cancelled = false;

    const applyTicker = (ticker) => {
      if (!ticker || cancelled) {
        return;
      }

      const high24h = ticker.high24h ?? ticker.high;
      const low24h = ticker.low24h ?? ticker.low;
      const volume24h = ticker.volume24h ?? ticker.volume;

      const convertToNumber = (value) => {
        if (value == null) return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };

      const finalStats = {
        high24h: convertToNumber(high24h),
        low24h: convertToNumber(low24h),
        volume24h: convertToNumber(volume24h),
      };

      setStats(finalStats);
    };

    const load = async () => {
      // ✅ Mode FX EOD : charger directement les données EOD via actualFxBase/actualFxQuote
      if (actualFxMode && actualFxBase && actualFxQuote) {
        try {
          setIsXrplPair(false);
          setIsPythPair(false);
          const eodData = await xcannesApi.getFxEod(actualFxBase, actualFxQuote, 2);
          const candles = eodData?.candles || [];
          
          if (candles.length > 0) {
            // Calculer high = max de tous les prix des 2 dernières bougies
            // Calculer low = min de tous les prix des 2 dernières bougies
            const allPrices = candles.flatMap(candle => [
              candle.open,
              candle.high,
              candle.low,
              candle.close
            ]).filter(p => p != null && Number.isFinite(p));
            
            const calculatedHigh = allPrices.length > 0 ? Math.max(...allPrices) : null;
            const calculatedLow = allPrices.length > 0 ? Math.min(...allPrices) : null;
            
            setStats({
              high24h: calculatedHigh,
              low24h: calculatedLow,
              volume24h: null, // EOD n'a pas de volume
            });
          } else {
            setStats({ high24h: null, low24h: null, volume24h: null });
          }
        } catch (err) {
          console.error('[ChartFooter] Erreur FX EOD:', err);
          setStats({ high24h: null, low24h: null, volume24h: null });
        }
        return;
      }
      
      // Mode classique (XRPL ou paires externes)
      const book = getBookIdFromPair(pair);
      if (!book?.backendPair) {
        setStats({ high24h: null, low24h: null, volume24h: null });
        setIsXrplPair(false);
        setIsPythPair(false);
        return;
      }

      const isEODPair = book.backendPair.startsWith('USD_');
      const isPyth = book.source === 'pyth' || book.type === 'external';
      
      setIsXrplPair(book.source === 'xrpl' && !isEODPair);
      setIsPythPair(isPyth);
      
      // Extraire base et quote pour les paires Pyth
      if (isPyth) {
        const [base, quote] = book.backendPair.split('_');
        setPairInfo({ base: base || '', quote: quote || '' });
      }

      const map = tickers instanceof Map ? tickers : new Map();
      const fromWs = map.get(book.backendPair);
      
      const hasValidData = fromWs && (
        fromWs.high24h != null || 
        fromWs.high != null
      );
      
      if (hasValidData) {
        applyTicker(fromWs);
        return;
      }
      
      try {
        
        if (isEODPair) {
          // ✅ Récupérer les 2 dernières bougies EOD pour calculer un vrai high/low
          const eodData = await xcannesApi.getEODData(book.backendPair, 2);
          if (eodData && eodData.length > 0) {
            // Calculer high = max de tous les prix (open, high, low, close) des 2 bougies
            // Calculer low = min de tous les prix (open, high, low, close) des 2 bougies
            const allPrices = eodData.flatMap(candle => [
              candle.open,
              candle.high,
              candle.low,
              candle.close
            ]).filter(p => p != null && Number.isFinite(p));
            
            const calculatedHigh = allPrices.length > 0 ? Math.max(...allPrices) : null;
            const calculatedLow = allPrices.length > 0 ? Math.min(...allPrices) : null;
            
            applyTicker({
              symbol: book.backendPair,
              high: calculatedHigh,
              low: calculatedLow,
              volume: 0, // EOD n'a pas de volume
              source: 'eod'
            });
          } else {
            setStats({ high24h: null, low24h: null, volume24h: null });
          }
          return;
        }
        
        const ticker = await xcannesApi.getTicker(book.backendPair);
        applyTicker(ticker);
      } catch (err) {
        if (!cancelled) {
          setStats({ high24h: null, low24h: null, volume24h: null });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [pair, tickers, fxMode, fxBase, fxQuote]);

  const formatPrice = (value) => {
    if (!Number.isFinite(value)) return "-";
    
    const valueStr = value.toString();
    const decimalPart = valueStr.split('.')[1];
    const decimals = decimalPart ? decimalPart.length : 0;
    
    const precision = Math.min(Math.max(decimals, 6), 8);
    return value.toFixed(precision);
  };

  // Détecter si c'est une paire EOD pour adapter les labels
  const book = getBookIdFromPair(pair);
  const isEODPair = actualFxMode || book?.backendPair?.startsWith('USD_');

  return (
    <div className={`w-full p-4 max-sm:p-2 border-t border-white/10 grid gap-4 max-sm:gap-2 ${
      isXrplPair ? 'grid-cols-2 md:grid-cols-4' : (isEODPair || isPythPair) ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'
    }`}>
      <div>
        <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
          {isEODPair ? 'Daily High' : '24h High'}
          {isEODPair && (
            <span className="ml-1 text-[9px] text-white/30">(EOD)</span>
          )}
        </p>
        <p className="text-sm max-sm:text-xs font-semibold text-white">
          {formatPrice(stats.high24h)}
        </p>
      </div>
      <div>
        <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
          {isEODPair ? 'Daily Low' : '24h Low'}
          {isEODPair && (
            <span className="ml-1 text-[9px] text-white/30">(EOD)</span>
          )}
        </p>
        <p className="text-sm max-sm:text-xs font-semibold text-white">
          {formatPrice(stats.low24h)}
        </p>
      </div>
      
      {/* Paires XRPL : Volume + Market Cap */}
      {isXrplPair && (
        <>
          <div>
            <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
              24h Volume
            </p>
            <p className="text-sm max-sm:text-xs font-semibold text-white">
              {Number.isFinite(stats.volume24h)
                ? stats.volume24h.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
              Market Cap
            </p>
            <p className="text-sm max-sm:text-xs font-semibold text-white">
              {xrpSupply?.circulating && currentPrice
                ? `$${((xrpSupply.circulating * currentPrice) / 1e9).toFixed(2)}B`
                : "-"}
            </p>
          </div>
        </>
      )}
      
      {/* Paires EOD : Afficher les devises avec drapeaux */}
      {isEODPair && !isXrplPair && !isPythPair && (
        <>
          <div>
            <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
              Base Currency
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg">{getFlag(currencies.base?.code || actualFxBase)}</span>
              <div className="flex flex-col">
                <span className="text-xs max-sm:text-[10px] font-bold text-white">
                  {currencies.base?.code || actualFxBase}
                </span>
                <span className="text-[10px] max-sm:text-[9px] text-white/60 truncate max-w-[120px]">
                  {currencies.base?.name || actualFxBase}
                </span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
              Quote Currency
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg">{getFlag(currencies.quote?.code || actualFxQuote)}</span>
              <div className="flex flex-col">
                <span className="text-xs max-sm:text-[10px] font-bold text-white">
                  {currencies.quote?.code || actualFxQuote}
                </span>
                <span className="text-[10px] max-sm:text-[9px] text-white/60 truncate max-w-[120px]">
                  {currencies.quote?.name || actualFxQuote}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Paires Pyth (Crypto/Commodities) : Afficher les actifs avec icônes OU drapeaux si fiat */}
      {isPythPair && (
        <>
          <div>
            <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
              Base Asset
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg">{getSmartIcon(pairInfo.base, currencies.base)}</span>
              <div className="flex flex-col">
                <span className="text-xs max-sm:text-[10px] font-bold text-white">
                  {pairInfo.base}
                </span>
                <span className="text-[10px] max-sm:text-[9px] text-white/60 truncate max-w-[120px]">
                  {getSmartName(pairInfo.base, currencies.base)}
                </span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs max-sm:text-[10px] text-white/40 mb-1 max-sm:mb-0.5">
              Quote Asset
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg">{getSmartIcon(pairInfo.quote, currencies.quote)}</span>
              <div className="flex flex-col">
                <span className="text-xs max-sm:text-[10px] font-bold text-white">
                  {pairInfo.quote}
                </span>
                <span className="text-[10px] max-sm:text-[9px] text-white/60 truncate max-w-[120px]">
                  {getSmartName(pairInfo.quote, currencies.quote)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

