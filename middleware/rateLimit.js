/**
 * Rate Limiting Middleware
 * Protège contre les abus sur les endpoints sensibles
 * 
 * Usage:
 *   import rateLimit from '@/middleware/rateLimit';
 *   export default rateLimit(handler, { max: 5, window: 60 });
 */

import { RateLimiterMemory } from 'rate-limiter-flexible';
import winstonLogger from '../lib/winstonLogger';

// Configuration par défaut
const rateLimiters = {
  // Checkout Stripe : 5 tentatives / heure
  checkout: new RateLimiterMemory({
    points: 5,
    duration: 3600, // 1 heure
  }),
  
  // Connexion XUMM : 10 tentatives / heure
  xummConnect: new RateLimiterMemory({
    points: 10,
    duration: 3600,
  }),
  
  // Signature transaction : 20 / heure
  xummSign: new RateLimiterMemory({
    points: 20,
    duration: 3600,
  }),
  
  // Balance queries : 30 / minute
  balance: new RateLimiterMemory({
    points: 30,
    duration: 60,
  }),
  
  // Global API : 100 requests / minute
  global: new RateLimiterMemory({
    points: 100,
    duration: 60,
  }),
};

/**
 * Middleware de rate limiting
 * @param {Function} handler - Handler Next.js
 * @param {Object} options - Options
 * @param {string} options.type - Type de limiter (checkout, xummConnect, etc.)
 * @param {number} options.max - Nombre max de requêtes (override)
 * @param {number} options.window - Fenêtre en secondes (override)
 * @returns {Function} Handler avec rate limiting
 */
export default function rateLimit(handler, options = {}) {
  const {
    type = 'global',
    max,
    window,
  } = options;

  // Créer un limiter custom si max/window fournis
  let limiter = rateLimiters[type];
  if (max || window) {
    limiter = new RateLimiterMemory({
      points: max || 100,
      duration: window || 60,
    });
  }

  return async (req, res) => {
    // Identifier le client
    const identifier = 
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.socket.remoteAddress ||
      'unknown';

    try {
      // Consommer 1 point
      await limiter.consume(identifier);
      
      // Continuer vers le handler
      return await handler(req, res);
    } catch (rateLimiterRes) {
      // Rate limit dépassé
      winstonLogger.warn('Rate limit exceeded', {
        ip: identifier,
        type,
        endpoint: req.url,
        method: req.method,
      });

      res.status(429).json({
        error: 'Too many requests',
        message: 'Please wait before trying again',
        retryAfter: Math.ceil(rateLimiterRes.msBeforeNext / 1000),
      });
    }
  };
}

// Export des limiters pour usage direct
export { rateLimiters };
