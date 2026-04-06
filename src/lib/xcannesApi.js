/**
 * 🔌 Service API REST pour XCANNES DEX Backend
 * Avec retry automatique, timeout, et cache
 */

import { getApiBaseUrl } from "./runtimeConfig";
import LruCache from "../utils/lruCache";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

const BACKEND_CONFIG = {
  // Passer par l'API 3001 (qui proxifie /api/v1/* vers Market Data 3003 + Wallet)
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
  FX_RATE: '/api/v1/fx/rate',
  FX_CURRENCIES: '/api/v1/fx/currencies',
  XRPL_RLUSD_XRP_QUOTE: '/wallet/rlusd-xrp-quote',
};

class XcannesAPI {
  constructor() {
    this.baseURL = BACKEND_CONFIG.API_URL;
    this.cache = new LruCache({
      maxEntries: API_CONFIG.CACHE_MAX_ENTRIES,
      defaultTtlMs: API_CONFIG.CACHE_TTL,
    });
    this.healthStatus = { isHealthy: true, lastCheck: 0 };
    this.request = this.request.bind(this);
    this.getHealthStatus = this.getHealthStatus.bind(this);
    this.getFxRate = this.getFxRate.bind(this);
    this.getFxCurrencies = this.getFxCurrencies.bind(this);
    this.getRlusdXrpQuote = this.getRlusdXrpQuote.bind(this);
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
      negativeCacheTTL = 0,
    } = options;

    // Vérifier le cache (GET seulement)
    if (method === 'GET' && useCache) {
      const cached = this.getFromCache(endpoint);
      if (cached !== null) {
        // Negative cache hit — rethrow the stored error
        if (cached && cached.__negativeCache) {
          throw new Error(cached.__negativeCache);
        }
        return cached;
      }
    }

    // Tenter la requête avec retry
    let lastError;
    let is4xx = false;
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
          const status = response.status;
          // 4xx errors are deterministic — no point retrying
          if (status >= 400 && status < 500) {
            is4xx = true;
            throw new Error(`HTTP ${status}: ${response.statusText}`);
          }
          throw new Error(`HTTP ${status}: ${response.statusText}`);
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

        // Don't retry 4xx errors (404, 400…) — they won't resolve on retry
        if (is4xx) break;
        
        // Attendre avant de réessayer
        if (attempt < retries - 1) {
          await this.sleep(API_CONFIG.RETRY_DELAY * (attempt + 1));
        }
      }
    }

    // Cache the negative result to avoid hammering the server
    if (method === 'GET' && useCache && negativeCacheTTL > 0) {
      this.setCache(endpoint, { __negativeCache: lastError?.message || 'Request failed' }, negativeCacheTTL);
    }

    if (DEBUG_LOGS) {
      console.error(`[XcannesAPI] Erreur ${endpoint} après ${is4xx ? 1 : retries} tentatives:`, lastError);
    }
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
   * Récupérer le dernier taux de change EOD pour une paire forex (Fawaz)
   * @param {string} base - Devise de base (ex: 'USD')
   * @param {string} quote - Devise cible (ex: 'EUR')
   * @returns {Promise<{ base, quote, rate, date, source }>}
   */
  async getFxRate(base = 'USD', quote = 'EUR') {
    const params = new URLSearchParams({ base, quote });
    const result = await this.request(`${API_ENDPOINTS.FX_RATE}?${params.toString()}`, {
      useCache: true,
      cacheTTL: 43200000, // 12h — Fawaz met à jour ~1x/jour, on poll toutes les 12h
      negativeCacheTTL: 3600000, // 1h — évite de spammer le serveur si la paire n'existe pas
    });
    return result.success ? result.data : null;
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

  /**
   * Quote indicatif RLUSD/XRP depuis le DEX XRPL (book_offers).
   * @param {number} amountRlusd - Montant RLUSD (USD) à convertir
   * @param {'XRP_TO_RLUSD'|'RLUSD_TO_XRP'} direction
   */
  async getRlusdXrpQuote(amountRlusd, direction = 'XRP_TO_RLUSD') {
    const amt = Number(amountRlusd);
    const dir = String(direction || '').trim().toUpperCase();
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new Error('Invalid amountRlusd');
    }
    const params = new URLSearchParams({
      amountRlusd: String(amt),
      direction: dir === 'RLUSD_TO_XRP' ? 'RLUSD_TO_XRP' : 'XRP_TO_RLUSD',
    });

    return this.request(`${API_ENDPOINTS.XRPL_RLUSD_XRP_QUOTE}?${params.toString()}`, {
      useCache: true,
      cacheTTL: 2000,
      negativeCacheTTL: 3000,
    });
  }
}

// Export singleton
const xcannesApi = new XcannesAPI();
export default xcannesApi;
