/**
 * 🌐 Hook WebSocket pour les prix en temps réel des marchés externes (Pyth)
 * Alternative moderne à useExternalPrice avec streaming temps réel
 * Utilisé pour les paires Pyth (flux unifié)
 */

import { useState, useEffect } from 'react';
import { useXcannesWS } from '../context/XcannesWSContext';

/**
 * Hook pour obtenir le prix live d'une paire externe via WebSocket
 * @param {string} pair - Format: "EUR/USD", "BTC/USD", "XAU/USD" ou "EUR_USD"
 * @returns {Object} - { price: number|null, loading: boolean, error: string|null, data: Object|null }
 */
export function useExternalPriceWS(pair) {
  const { externalPrices, externalPricesVersion, connected } = useXcannesWS();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Normaliser le symbole (EUR/USD ou EUR_USD → EUR_USD)
  const symbol = pair ? pair.replace('/', '_').toUpperCase() : null;

  useEffect(() => {
    if (!symbol) {
      setLoading(false);
      setError('Symbole manquant');
      return;
    }

    if (!connected) {
      setError('WebSocket déconnecté');
      return;
    }

    // Vérifier si on a des données
    if (externalPrices.has(symbol)) {
      setLoading(false);
      setError(null);
    } else {
      // Attendre un peu pour recevoir les données
      const timeout = setTimeout(() => {
        if (!externalPrices.has(symbol)) {
          setError('Prix non disponible');
          setLoading(false);
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [symbol, connected, externalPricesVersion, externalPrices]);

  // Récupérer le prix depuis le cache WebSocket
  const priceData = symbol ? externalPrices.get(symbol) : null;
  const price = priceData ? Number(priceData.midPrice || priceData.price || 0) : null;

  return {
    price,
    loading: loading && !priceData,
    error: priceData ? null : error,
    data: priceData,
    connected,
    symbol
  };
}

/**
 * Hook pour obtenir plusieurs prix externes en une fois
 * @param {Array<{pair: string, category: string}>} pairs - Liste des paires
 * @returns {Object} - Map<symbol, priceData>
 */
export function useMultipleExternalPricesWS(pairs) {
  const { externalPrices, connected } = useXcannesWS();
  const [prices, setPrices] = useState(new Map());

  useEffect(() => {
    if (!pairs || pairs.length === 0) {
      setPrices(new Map());
      return;
    }

    const result = new Map();
    pairs.forEach(({ pair, category }) => {
      const symbol = pair.replace('/', '_').toUpperCase();
      const data = externalPrices.get(symbol);
      if (data) {
        result.set(symbol, {
          ...data,
          price: Number(data.midPrice || data.price || 0)
        });
      }
    });

    setPrices(result);
  }, [pairs, externalPrices, connected]);

  return {
    prices,
    connected,
    count: prices.size
  };
}

export default useExternalPriceWS;
