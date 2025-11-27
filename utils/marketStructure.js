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
      EUR: ["EUR/USD", "EUR/GBP", "EUR/JPY", "EUR/CHF", "EUR/AUD"],
      GBP: ["GBP/USD", "GBP/JPY", "GBP/CHF", "GBP/AUD"],
      AUD: ["AUD/USD", "AUD/JPY"],
      NZD: ["NZD/USD"],
      USD: ["USD/CAD", "USD/CHF", "USD/JPY", "USD/HKD", "USD/SGD", "USD/MXN"],
      CHF: ["CHF/JPY"]
    }
  },
  
  exotic: {
    label: "🌍 EXOTIC (15 verified)",
    currencies: {
      "Latin America": [
        "USD/BRL", "USD/CLP", "USD/COP", "USD/PEN"
      ],
      "Asia": [
        "USD/INR", "USD/IDR", "USD/PHP", "USD/KRW", 
        "USD/TWD", "USD/CNH"
      ],
      "Other": [
        "USD/ZAR", "USD/TRY", "USD/NOK", "USD/SEK", "USD/GEL"
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
        return categoryKey;
      }
    }
  }
  return null;
};
