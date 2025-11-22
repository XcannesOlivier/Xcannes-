/**
 * 🪝 Hook personnalisé pour utiliser l'API XCANNES DEX
 * Note: Pour WebSocket, utiliser useXcannesWS() depuis XcannesWSContext
 */

import { useState, useEffect, useCallback } from 'react';
import xcannesApi from '../lib/xcannesApi';
import { pairToBackendFormat } from '../utils/xrpl';

/**
 * Hook pour récupérer et suivre un ticker
 * @param {string} pair - Format: "XCS/XRP"
 * @param {number} refreshInterval - Intervalle de rafraîchissement en ms (0 = pas de polling)
 * @returns {Object} { ticker, loading, error, refresh }
 * 
 * Note: Pour temps réel, utiliser useXcannesWS() depuis XcannesWSContext
 */
export function useTicker(pair, refreshInterval = 5000) {
  const [ticker, setTicker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const backendPair = pairToBackendFormat(pair);

  const fetchTicker = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await xcannesApi.getTicker(backendPair);
      setTicker(data);
    } catch (err) {
      setError(err.message);
      console.error('[useTicker] Erreur:', err);
    } finally {
      setLoading(false);
    }
  }, [backendPair]);

  useEffect(() => {
    fetchTicker();

    // Polling optionnel
    if (refreshInterval > 0) {
      const interval = setInterval(fetchTicker, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchTicker, refreshInterval]);

  return { ticker, loading, error, refresh: fetchTicker };
}
