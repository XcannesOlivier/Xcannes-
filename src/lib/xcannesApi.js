/**
 * 🔌 Service API REST pour XCANNES DEX Backend
 * Avec retry automatique, timeout, et cache
 */

import { getApiBaseUrl } from "./runtimeConfig";
import LruCache from "../utils/lruCache";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

const BACKEND_CONFIG = {
  // Passer par l'API 3001 (qui proxifie /api/v1/* vers Market Data 3003 + XUMM)
  API_URL: getApiBaseUrl(),
};

const API_CONFIG = {
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  CACHE_TTL: 5000,
  CACHE_MAX_ENTRIES: 200,
};

const API_ENDPOINTS = {
  MARKETS: '/api/v1/markets',
  MARKETS_ALL: '/api/v1/markets/all',
  TICKER: '/api/v1/ticker',
  TRADES: '/api/v1/trades',
  KLINES: '/api/v1/klines',
  FX_EOD: '/api/v1/fx/eod',
  FX_CURRENCIES: '/api/v1/fx/currencies',
};

class XcannesAPI {
  constructor() {
    this.baseURL = BACKEND_CONFIG.API_URL;
    this.cache = new LruCache({
      maxEntries: API_CONFIG.CACHE_MAX_ENTRIES,
      defaultTtlMs: API_CONFIG.CACHE_TTL,
    });
    this.healthStatus = { isHealthy: true, lastCheck: 0 };
  }

  /**
   * Requête générique avec retry et timeout
   */
  async request(endpoint, options = {}) {
    const { 
      method = 'GET',
      body = null,
      timeout = API_CONFIG.TIMEOUT,
      retries = API_CONFIG.RETRY_ATTEMPTS,
      useCache = true,
      cacheTTL = API_CONFIG.CACHE_TTL,
    } = options;

    // Vérifier le cache (GET seulement)
    if (method === 'GET' && useCache) {
      const cached = this.getFromCache(endpoint);
      if (cached) return cached;
    }

    // Tenter la requête avec retry
    let lastError;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : null,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Mettre en cache
        if (method === 'GET' && useCache) {
          this.setCache(endpoint, data, cacheTTL);
        }

        return data;
      } catch (error) {
        lastError = error;
        if (DEBUG_LOGS) {
          console.warn(
            `[XcannesAPI] Tentative ${attempt + 1}/${retries} échouée:`,
            error.message
          );
        }
        
        // Attendre avant de réessayer
        if (attempt < retries - 1) {
          await this.sleep(API_CONFIG.RETRY_DELAY * (attempt + 1));
        }
      }
    }

    console.error(`[XcannesAPI] Erreur ${endpoint} après ${retries} tentatives:`, lastError);
    throw lastError;
  }

  /**
   * Gestion du cache
   */
  getFromCache(key) {
    return this.cache.get(key);
  }

  setCache(key, data, ttl) {
    this.cache.set(key, data, ttl);
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Utilitaire de sommeil
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check du backend
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      
      this.healthStatus = {
        isHealthy: response.ok && data.status === 'ok',
        lastCheck: Date.now(),
        data,
      };
      
      return this.healthStatus;
    } catch (error) {
      this.healthStatus = {
        isHealthy: false,
        lastCheck: Date.now(),
        error: error.message,
      };
      return this.healthStatus;
    }
  }

  /**
   * Obtenir le statut de santé
   */
  getHealthStatus() {
    return this.healthStatus;
  }

  /**
   * Récupérer toutes les paires (64 paires DEX)
   * @returns {Promise<Array>}
   */
  async getMarkets() {
    const result = await this.request(API_ENDPOINTS.MARKETS);
    return result.success ? result.data : [];
  }

  /**
   * Récupérer toutes les paires incluant pyth
   * @returns {Promise<Object>}
   */
  async getAllMarkets() {
    const result = await this.request(API_ENDPOINTS.MARKETS_ALL);
    return result.success ? result.data : { trading: [], pyth: [] };
  }

  /**
   * Récupérer le ticker d'une paire
   * @param {string} pair - Format: RLUSD_XRP
   * @returns {Promise<Object>}
   */
  async getTicker(pair) {
    const result = await this.request(`${API_ENDPOINTS.TICKER}?pair=${pair}`);
    return result.success ? result.data : null;
  }

  /**
   * Récupérer les trades récents
   * @param {string} pair - Format: RLUSD_XRP
   * @param {number} limit - Nombre de trades (default: 50)
   * @returns {Promise<Object>}
   */
  async getTrades(pair, limit = 50) {
    const result = await this.request(
      `${API_ENDPOINTS.TRADES}?pair=${pair}&limit=${limit}`,
      { useCache: false } // Toujours récupérer les derniers trades
    );
    return result.success ? result.data : { trades: [] };
  }

  /**
   * Récupérer les candles OHLCV
   * @param {string} pair - Format: RLUSD_XRP
   * @param {string} interval - 1m, 5m, 15m, 1h, 4h, 1d
   * @param {number} limit - Nombre de candles (default: 100)
   * @returns {Promise<Object>}
   */
  async getKlines(pair, interval = "1h", limit = 100) {
    // Utiliser uniquement l'endpoint temps réel (données XRPL réelles)
    const result = await this.request(
      `${API_ENDPOINTS.KLINES}?pair=${pair}&interval=${interval}&limit=${limit}`
    );
    return result.success ? result.data?.candles || [] : [];
  }

  /**
   * Récupérer les bougies EOD pour une paire forex générique (Fawaz)
   * @param {string} base - Devise de base (ex: 'EUR')
   * @param {string} quote - Devise de contrepartie (ex: 'JPY')
   * @param {number} days - Nombre de jours d'historique (max 3650)
   */
  async getFxEod(base = 'USD', quote = 'EUR', days = 365) {
    const params = new URLSearchParams({
      base,
      quote,
      days: String(days),
    });
    const result = await this.request(`${API_ENDPOINTS.FX_EOD}?${params.toString()}`, {
      useCache: true,
      cacheTTL: 60000, // 60s
    });
    return result.success ? result.data : { base, quote, symbol: `${base}/${quote}`, days, candles: [] };
  }

  /**
   * Récupérer la liste des devises disponibles pour Fawaz (forex_prices_eod)
   * @returns {Promise<Array<{code: string, name: string, symbol: string}>>}
   */
  async getFxCurrencies() {
    try {
      const result = await this.request(API_ENDPOINTS.FX_CURRENCIES, {
        useCache: true,
        cacheTTL: 3600000, // 1h
      });
      if (Array.isArray(result?.data)) return result.data;
      if (Array.isArray(result)) return result;
      return [];
    } catch (error) {
      // Ne pas faire planter l'app si le backend FX est inaccessible : retourner une liste vide
      // et laisser les consommateurs afficher un fallback.
      if (DEBUG_LOGS) {
        console.warn(
          "[XcannesAPI] FX currencies fallback to empty list:",
          error?.message || error
        );
      }
      return [];
    }
  }
}

// Export singleton
const xcannesApi = new XcannesAPI();
export default xcannesApi;
export { XcannesAPI };
