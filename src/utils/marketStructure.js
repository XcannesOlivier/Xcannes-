/**
 * 🏛️ Structure des marchés disponibles sur Xcannes DEX
 * Organisée sans sous-catégories : XRPL, Pyth (par défaut), Fawaz (EOD)
 */

export const MARKET_STRUCTURE = {
  xrpl: {
    label: "🔷 XRPL",
    currencies: {
      XRP: ["XRP/RLUSD"],
      XCS: ["XCS/RLUSD"]
    }
  },
  
  // Paires de devises Pyth (sans doublons)
  pyth: {
    label: "💱 Devises",
    currencies: {
      "Europe": [
        "EUR/USD", "EUR/GBP", "EUR/JPY", "EUR/CHF", "EUR/AUD", "EUR/CAD", "EUR/NZD", "EUR/SEK", "EUR/NOK",
        "GBP/USD", "GBP/JPY", "GBP/CHF", "GBP/AUD", "GBP/CAD", "GBP/NZD",
        "CHF/JPY",
        "USD/CHF", "USD/NOK", "USD/SEK"
      ],
      "Americas": [
        "USD/CAD", "USD/BRL", "USD/MXN", "USD/CLP", "USD/COP", "USD/PEN",
        "CAD/CHF", "CAD/JPY"
      ],
      "Asia-Pacific": [
        "USD/JPY", "USD/CNH", "USD/HKD", "USD/SGD", "USD/KRW", "USD/TWD", "USD/INR", "USD/IDR", "USD/PHP",
        "AUD/USD", "AUD/JPY", "AUD/CAD", "AUD/CHF", "AUD/NZD",
        "NZD/USD", "NZD/CAD", "NZD/CHF", "NZD/JPY"
      ],
      "Other": [
        "USD/ZAR", "USD/TRY"
      ]
    }
  },
};

/**
 * ✅ Helper pour détecter la catégorie d'une paire
 * @param {string} pair - Format: "EUR/USD", "XRP/RLUSD", etc.
 * @returns {string} - 'xrpl', 'fawaz', ou 'pyth' (par défaut pour les autres)
 */
export const getPairCategory = (pair) => {
  for (const [categoryKey, category] of Object.entries(MARKET_STRUCTURE)) {
    for (const [currency, pairs] of Object.entries(category.currencies)) {
      if (pairs.includes(pair)) {
        return categoryKey;
      }
    }
  }
  // Par défaut, tout ce qui n'est pas XRPL ou dans la liste Pyth est traité comme flux Pyth externe
  return 'pyth';
};
