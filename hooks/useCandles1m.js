/**
 * 🕐 Hook pour maintenir les bougies 1m des dernières 24h
 * Utilisé pour calculer le % d'évolution indépendamment du timeframe affiché
 */

import { useState, useEffect, useRef } from 'react';
import xcannesApi from '../lib/xcannesApi';
import { getBookIdFromPair } from '../utils/xrpl';

/**
 * Hook qui maintient toujours les 1440 dernières bougies 1m (24h)
 * @param {string} pair - La paire de trading (ex: "XRP/RLUSD")
 * @returns {Object} - { candles1m: Array, loading: boolean, error: string|null }
 */
export function useCandles1m(pair) {
  const [candles1m, setCandles1m] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchIntervalRef = useRef(null);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    if (!pair) return;

    const book = getBookIdFromPair(pair);
    if (!book) {
      setError(`Paire invalide: ${pair}`);
      setLoading(false);
      return;
    }

    /**
     * Fonction pour fetch les bougies 1m
     */
    const fetchCandles1m = async () => {
      try {
        const now = Date.now();
        
        // Éviter les requêtes trop fréquentes (minimum 30 secondes entre chaque fetch)
        if (now - lastFetchRef.current < 30000) {
          return;
        }
        
        lastFetchRef.current = now;
        
        // Fetch les 1440 dernières bougies 1m (24h)
        const data = await xcannesApi.getKlines(book.backendPair, '1m', 1440);
        
        if (data && Array.isArray(data) && data.length > 0) {
          // Filtrer les bougies vides et trier par temps
          const validCandles = data
            .filter(c => c.open !== 0 || c.high !== 0 || c.low !== 0 || c.close !== 0)
            .sort((a, b) => a.time - b.time);
          
          setCandles1m(validCandles);
          setError(null);
        } else {
          setError('Aucune donnée disponible');
        }
      } catch (err) {
        console.error('[useCandles1m] Erreur fetch:', err);
        setError(err.message || 'Erreur réseau');
      } finally {
        setLoading(false);
      }
    };

    // Fetch initial
    fetchCandles1m();

    // Rafraîchir toutes les minutes pour avoir la bougie la plus récente
    fetchIntervalRef.current = setInterval(fetchCandles1m, 60000);

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
    };
  }, [pair]);

  return { candles1m, loading, error };
}

/**
 * 📊 Calcule le pourcentage d'évolution sur 24h à partir des bougies 1m
 * 
 * @param {Array} candles1m - Les bougies 1m disponibles (idéalement 1440 = 24h)
 * @param {number} livePrice - Le prix live actuel (du WebSocket)
 * @returns {Object} - { percent: number, value: number, openPrice24h: number, periodHours: number }
 * 
 * 🎯 Règles métiers:
 * - openPrice = première bougie 1m disponible (idéalement il y a 24h)
 * - lastPrice = livePrice (prix WebSocket)
 * - percent = ((lastPrice - openPrice) / openPrice) * 100
 * - Fonctionne même avec données partielles (calcule sur la période disponible)
 */
export function compute24hPercentChange(candles1m, livePrice) {
  // Valeurs par défaut si données insuffisantes
  if (!candles1m || candles1m.length === 0 || !livePrice) {
    return { percent: 0, value: 0, openPrice24h: null, periodHours: 0 };
  }

  // Prendre l'open de la première bougie disponible
  const openPrice24h = candles1m[0].open;

  if (!openPrice24h || openPrice24h === 0) {
    return { percent: 0, value: 0, openPrice24h: null, periodHours: 0 };
  }

  // Calculer la période réelle couverte (en heures)
  const firstTime = candles1m[0].time;
  const lastTime = candles1m[candles1m.length - 1].time;
  const periodSeconds = lastTime - firstTime;
  const periodHours = periodSeconds / 3600;

  // Calcul du changement
  const value = livePrice - openPrice24h;
  const percent = (value / openPrice24h) * 100;

  return {
    percent,
    value,
    openPrice24h,
    periodHours: Math.round(periodHours * 10) / 10, // Arrondi à 1 décimale
  };
}

export default useCandles1m;
