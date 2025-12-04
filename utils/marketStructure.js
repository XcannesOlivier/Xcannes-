/**
 * 🏛️ Structure des marchés disponibles sur Xcannes DEX
 * Organisée par catégories : XRPL, Forex, Exotic, Crypto, Commodities
 */

export const MARKET_STRUCTURE = {
  xrpl: {
    label: "🔷 XRPL",
    currencies: {
      XRP: ["XRP/RLUSD"],
      XCS: ["XCS/XRP", "XCS/RLUSD"]
    }
  },
  
  forex: {
    label: "💱 FOREX",
    currencies: {
      EUR: ["EUR/USD", "EUR/GBP", "EUR/JPY", "EUR/CHF", "EUR/AUD", "EUR/CAD", "EUR/NZD", "EUR/NOK", "EUR/SEK"],
      GBP: ["GBP/USD", "GBP/JPY", "GBP/CHF", "GBP/AUD", "GBP/CAD", "GBP/NZD"],
      AUD: ["AUD/USD", "AUD/JPY", "AUD/CAD", "AUD/CHF", "AUD/NZD"],
      NZD: ["NZD/USD", "NZD/CAD", "NZD/CHF", "NZD/JPY"],
      CAD: ["CAD/CHF", "CAD/JPY"],
      USD: ["USD/CAD", "USD/CHF", "USD/JPY", "USD/HKD", "USD/SGD", "USD/MXN", "USD/CNH", "USD/ZAR", "USD/TRY", "USD/NOK", "USD/SEK"],
      CHF: ["CHF/JPY"]
    }
  },
  
  exotic: {
    label: "🌍 EXOTIC (9 pairs)",
    currencies: {
      "Latin America": [
        "USD/BRL", "USD/CLP", "USD/COP", "USD/PEN"
      ],
      "Asia": [
        "USD/INR", "USD/IDR", "USD/PHP", "USD/KRW", "USD/TWD"
      ]
    }
  },
  
  crypto: {
    label: "₿ CRYPTO",
    currencies: {
      BTC: ["BTC/USD"],
      ETH: ["ETH/USD"],
      XRP: ["XRP/USD"]
    }
  },
  
  commodities: {
    label: "🛢️ COMMODITIES",
    currencies: {
      Metals: ["XAU/USD", "XAG/USD", "XPT/USD", "XPD/USD"],
      Energy: ["OIL/USD"]
    }
  }
};

/**
 * ✅ Helper pour détecter la catégorie d'une paire
 * @param {string} pair - Format: "EUR/USD", "XRP/RLUSD", etc.
 * @returns {string|null} - 'xrpl', 'forex', 'exotic', 'crypto', 'commodity', ou null
 */
export const getPairCategory = (pair) => {
  for (const [categoryKey, category] of Object.entries(MARKET_STRUCTURE)) {
    for (const [currency, pairs] of Object.entries(category.currencies)) {
      if (pairs.includes(pair)) {
        // Normaliser 'commodities' → 'commodity' pour cohérence avec backend
        return categoryKey === 'commodities' ? 'commodity' : categoryKey;
      }
    }
  }
  return null;
};
