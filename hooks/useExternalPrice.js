/**
 * 🌐 Hook pour obtenir les prix en temps réel des marchés externes (Pyth)
 * Utilisé pour crypto, forex majeurs, commodities (pas les exotiques)
 */

import { useState, useEffect, useRef } from 'react';
import xcannesApi from '../lib/xcannesApi';

const POLL_INTERVAL = 5000; // 5 secondes (le service Pyth update toutes les 10s)
const SUPPORTED_CATEGORIES = ['crypto', 'forex', 'commodity']; // Exclure 'exotic'

/**
 * Hook pour obtenir le prix live d'une paire externe
 * @param {string} pair - Format: "EUR/USD", "BTC/USD", "XAU/USD"
 * @param {string} category - Type de marché: 'crypto', 'forex', 'commodity', 'exotic'
 * @returns {Object} - { price: number|null, loading: boolean, error: string|null, data: Object|null }
 */
export function useExternalPrice(pair, category) {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Si paire exotic, ne pas activer le live
    if (!pair || !category || category === 'exotic') {
      setLoading(false);
      return;
    }

    // Vérifier que c'est une catégorie supportée
    if (!SUPPORTED_CATEGORIES.includes(category)) {
      setLoading(false);
      return;
    }

    // Fonction pour fetch le prix
    const fetchPrice = async () => {
      try {
        // Convertir EUR/USD en EUR_USD pour l'API
        const symbol = pair.replace('/', '_');
        
        let response;
        if (category === 'forex') {
          response = await xcannesApi.getForexPrice(symbol);
        } else if (category === 'crypto') {
          // Pour crypto, on peut utiliser forex endpoint (Pyth gère les deux)
          response = await xcannesApi.getForexPrice(symbol);
        } else if (category === 'commodity') {
          response = await xcannesApi.getCommodityPrice(symbol);
        }

        if (!isMountedRef.current) return;

        if (response?.success && response?.data) {
          const priceData = response.data;
          const midPrice = Number(priceData.midPrice || priceData.price || 0);
          
          if (midPrice > 0) {
            setPrice(midPrice);
            setData(priceData);
            setError(null);
          } else {
            setError('Prix invalide');
          }
        } else {
          setError('Aucune donnée disponible');
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error(`[useExternalPrice] Erreur fetch ${pair}:`, err);
        setError(err.message || 'Erreur réseau');
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    // Fetch initial
    fetchPrice();

    // Polling toutes les 5 secondes
    intervalRef.current = setInterval(fetchPrice, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pair, category]);

  return { price, loading, error, data };
}

export default useExternalPrice;
