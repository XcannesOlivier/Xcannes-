/**
 * 🔌 Service WebSocket pour XCANNES DEX Backend
 * Avec auto-reconnexion, gestion d'erreurs, et heartbeat
 */

import { getWsUrl } from "./runtimeConfig";

const BACKEND_CONFIG = {
  WS_URL: getWsUrl(),
};

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

const WS_CONFIG = {
  RECONNECT_INTERVAL: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
  PING_INTERVAL: 30000,
  PONG_TIMEOUT: 5000,
};

const WS_ACTIONS = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  PING: 'ping',
  GET_SUBSCRIPTIONS: 'get_subscriptions',
};

class XcannesWebSocket {
  constructor() {
    this.url = BACKEND_CONFIG.WS_URL;
    this.ws = null;
    this.listeners = new Map();
    this.subscriptions = new Set();
    this.subscriptionCounts = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = WS_CONFIG.MAX_RECONNECT_ATTEMPTS;
    this.reconnectDelay = WS_CONFIG.RECONNECT_INTERVAL;
    this.isConnecting = false;
    this.isManualClose = false;
    this.pingInterval = null;
    this.pongTimeout = null;
    
    // ✅ Queue pour étaler les souscriptions (éviter "trop de souscriptions")
    this.subscriptionQueue = [];
    this.isProcessingQueue = false;
    this.SUBSCRIPTION_DELAY_MS = 50; // 50ms entre chaque souscription
    // Timers pour retarder le unsubscribe et éviter churn subscribe/unsubscribe rapide
    this.unsubscribeTimers = new Map(); // Map<subscriptionKey, Timeout>
    // ✅ THROTTLE BRUTAL : bloquer re-subscribe pendant X secondes
    this.lastSubscribeTime = new Map(); // Map<subscriptionKey, timestamp>
    this.SUBSCRIBE_THROTTLE_MS = 2000; // 2 secondes minimum entre 2 subscribe identiques
  }

  /**
   * Connexion au WebSocket
   * @returns {Promise<void>}
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return Promise.resolve();
    }

    this.isConnecting = true;
    this.isManualClose = false;

    return new Promise((resolve, reject) => {
      try {
        if (DEBUG_LOGS) {
          console.log(`🔌 [XcannesWS] Connexion à ${this.url}...`);
        }
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          if (DEBUG_LOGS) {
            console.log("✅ [XcannesWS] Connecté au WebSocket");
          }
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // Démarrer heartbeat
          this.startHeartbeat();
          
          // Ré-abonner aux paires précédentes
          if (this.subscriptions.size > 0) {
            if (DEBUG_LOGS) {
              console.log(
                `[XcannesWS] Ré-abonnement à ${this.subscriptions.size} abonnement(s)`
              );
            }
            this.subscriptions.forEach(sub => {
              const [channel, pair] = sub.split(':');
              this.send({ type: 'subscribe', channel, pair });
            });
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error("[XcannesWS] Erreur parsing message:", error);
          }
        };

        this.ws.onerror = (error) => {
          console.error("[XcannesWS] Erreur WebSocket:", error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = (event) => {
          if (DEBUG_LOGS) {
            console.log(`👋 [XcannesWS] Déconnecté (code: ${event.code})`);
          }
          this.isConnecting = false;
          this.stopHeartbeat();
          
          if (!this.isManualClose) {
            this.handleReconnect();
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Heartbeat (ping/pong)
   */
  startHeartbeat() {
    this.stopHeartbeat();

    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: WS_ACTIONS.PING });

        // Timeout si pas de pong
        this.pongTimeout = setTimeout(() => {
          console.warn('[XcannesWS] Pas de pong reçu, reconnexion...');
          this.ws?.close();
        }, WS_CONFIG.PONG_TIMEOUT);
      }
    }, WS_CONFIG.PING_INTERVAL);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  handlePong() {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  /**
   * Gestion de la reconnexion automatique
   */
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      if (DEBUG_LOGS) {
        console.log(
          `🔄 [XcannesWS] Reconnexion tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`
        );
      }

      setTimeout(() => {
        this.connect()
          .then(() => {
            // Ré-abonnement aux canaux précédents
            this.subscriptions.forEach((sub) => {
              const [channel, pair] = sub.split(":");
              this.subscribe(channel, pair);
            });
          })
          .catch((err) => {
            console.error("[XcannesWS] Échec reconnexion:", err);
          });
      }, this.reconnectDelay);
    } else {
      console.error(
        "❌ [XcannesWS] Nombre maximal de tentatives de reconnexion atteint"
      );
    }
  }

  /**
   * Gestion des messages reçus
   * @param {Object} message
   */
  handleMessage(message) {
    const { type, data, channel } = message;

    const hasListeners = this.listeners.has(type);
    // Ne pas logger chaque tick Pyth pour éviter de saturer la console
    const isDebug = DEBUG_LOGS && type !== 'pyth';

    if (isDebug) {
      // Log discret en mode debug uniquement
      console.log("[XcannesWS] 📨 Message reçu:", {
        type,
        channel,
        symbol: data?.symbol,
        hasListeners,
      });
    }

    // Messages système
    if (type === 'pong') {
      this.handlePong();
      return;
    }

    if (type === 'heartbeat') {
      // Heartbeat du serveur (optionnel)
      return;
    }

    // Log des messages de connexion
    if (type === "connected") {
      if (isDebug) {
        console.log("📡 [XcannesWS] Serveur:", message.message || message);
      }
    }

    // Dispatch aux listeners (envoyer le message complet)
    if (hasListeners) {
      const callbacks = this.listeners.get(type);
      if (isDebug) {
        console.log(
          `[XcannesWS] 🎯 Dispatching ${type} à ${callbacks.size} listener(s)`
        );
      }
      callbacks.forEach((callback) => {
        try {
          callback(message); // ✅ Passer message complet { type, channel, data }
        } catch (error) {
          console.error(`[XcannesWS] Erreur callback ${type}:`, error);
        }
      });
    } else {
      // Ne pas spammer en production : ignorer silencieusement les types non écoutés
      // En mode debug, loguer en warning léger pour inspection.
      if (isDebug) {
        console.warn("[XcannesWS] ⚠️ Aucun listener pour type:", type, message);
      }
    }
  }

  /**
   * Écouter un type d'événement
   * @param {string} eventType - 'ticker', 'pyth', 'eod-summary', 'wallet', 'connected', 'heartbeat'
   * @param {Function} callback
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  /**
   * Arrêter d'écouter un type d'événement
   * @param {string} eventType
   * @param {Function} callback
   */
  off(eventType, callback) {
    if (!this.listeners.has(eventType)) return;

    const callbacks = this.listeners.get(eventType);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * ✅ Traiter la queue de souscriptions avec délais
   */
  async processSubscriptionQueue() {
    if (this.isProcessingQueue || this.subscriptionQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.subscriptionQueue.length > 0) {
      const { channel, pair } = this.subscriptionQueue.shift();
      
      if (this.isConnected()) {
        this.send({
          type: 'subscribe',
          channel,
          pair,
        });
        if (DEBUG_LOGS) {
          console.log(`📥 [XcannesWS] Abonné à ${channel}:${pair} (queue: ${this.subscriptionQueue.length} restants)`);
        }
      }
      
      // Attendre un délai avant la prochaine souscription
      if (this.subscriptionQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.SUBSCRIPTION_DELAY_MS));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * S'abonner à un canal pour une paire
   * @param {string} channel - 'ticker' ou 'pyth' (et canaux spéciaux: 'eod-summary', 'wallet')
   * @param {string} pair - Format: RLUSD_XRP
   */
  subscribe(channel, pair) {
    const subscriptionKey = `${channel}:${pair}`;
    
    // ✅ THROTTLE : ignorer si subscribe trop récent (< 2s)
    const now = Date.now();
    const lastTime = this.lastSubscribeTime.get(subscriptionKey) || 0;
    const timeSinceLastSubscribe = now - lastTime;
    
    if (timeSinceLastSubscribe < this.SUBSCRIBE_THROTTLE_MS) {
      // Trop tôt pour re-subscribe, ignorer silencieusement
      if (DEBUG_LOGS) {
        console.warn(`⏱️ [XcannesWS] Subscribe throttled pour ${subscriptionKey} (${timeSinceLastSubscribe}ms depuis dernier)`);
      }
      return;
    }
    
    // ✅ Enregistrer le timestamp AVANT de vérifier alreadySubscribed
    this.lastSubscribeTime.set(subscriptionKey, now);
    
    const currentCount = this.subscriptionCounts.get(subscriptionKey) || 0;
    const alreadySubscribed = currentCount > 0;
    this.subscriptionCounts.set(subscriptionKey, currentCount + 1);
    this.subscriptions.add(subscriptionKey);
    
    // Annuler le timer d'unsubscribe si existant (re-subscribe rapide)
    if (this.unsubscribeTimers.has(subscriptionKey)) {
      clearTimeout(this.unsubscribeTimers.get(subscriptionKey));
      this.unsubscribeTimers.delete(subscriptionKey);
    }

    if (alreadySubscribed) {
      // Déjà abonné, pas besoin de renvoyer
      return;
    }

    if (this.isConnected()) {
      // ✅ Ajouter à la queue au lieu d'envoyer directement
      this.subscriptionQueue.push({ channel, pair });
      this.processSubscriptionQueue();
    } else {
      if (DEBUG_LOGS) {
        console.warn(`⚠️ [XcannesWS] Pas connecté, abonnement en attente: ${channel}:${pair}`);
      }
    }
  }

  /**
   * Se désabonner d'un canal pour une paire
   * @param {string} channel - 'ticker' ou 'pyth' (et canaux spéciaux: 'eod-summary', 'wallet')
   * @param {string} pair - Format: RLUSD_XRP
   */
  unsubscribe(channel, pair) {
    const subscriptionKey = `${channel}:${pair}`;
    const currentCount = this.subscriptionCounts.get(subscriptionKey) || 0;
    if (currentCount <= 1) {
      // Planifier un unsubscribe différé pour éviter churn si un re-subscribe arrive vite
      this.subscriptionCounts.delete(subscriptionKey);
      const wasSubscribed = this.subscriptions.has(subscriptionKey);

      if (!wasSubscribed) {
        return;
      }

      // Si un timer existait, laisser-le (on va remplacer)
      if (this.unsubscribeTimers.has(subscriptionKey)) {
        clearTimeout(this.unsubscribeTimers.get(subscriptionKey));
        this.unsubscribeTimers.delete(subscriptionKey);
      }

      // Délai de 500ms avant d'envoyer réellement le unsubscribe
      const timer = setTimeout(() => {
        // Si entre temps la subscription a été rajoutée, annuler
        if (this.subscriptionCounts.get(subscriptionKey) > 0) {
          // Re-subscribe happened, cancel
          this.unsubscribeTimers.delete(subscriptionKey);
          return;
        }

        const removed = this.subscriptions.delete(subscriptionKey);
        this.unsubscribeTimers.delete(subscriptionKey);
        if (!removed) return;

        if (this.isConnected()) {
          this.send({ type: 'unsubscribe', channel, pair });
          if (DEBUG_LOGS) {
            console.log(`📤 [XcannesWS] Désabonné de ${channel}:${pair} (après délai)`);
          }
        }
      }, 500);

      this.unsubscribeTimers.set(subscriptionKey, timer);
    } else {
      this.subscriptionCounts.set(subscriptionKey, currentCount - 1);
    }
  }

  /**
   * Envoyer un message au serveur
   * @param {Object} data
   */
  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      if (DEBUG_LOGS) {
        console.warn(
          "[XcannesWS] WebSocket non connecté, message non envoyé:",
          data
        );
      }
    }
  }

  /**
   * Envoyer un ping
   */
  ping() {
    this.send({ type: "ping" });
  }

  /**
   * Fermer la connexion
   */
  close() {
    this.isManualClose = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
      this.subscriptions.clear();
      this.subscriptionCounts.clear();
      this.listeners.clear();
      if (DEBUG_LOGS) {
        console.log('[XcannesWS] Déconnecté manuellement');
      }
    }
  }

  /**
   * Vérifier si connecté
   * @returns {boolean}
   */
  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Obtenir les abonnements actifs
   * @returns {Array<string>}
   */
  getSubscriptions() {
    return Array.from(this.subscriptions);
  }

  /**
   * Obtenir l'état de la connexion
   * @returns {number} WebSocket.CONNECTING | OPEN | CLOSING | CLOSED
   */
  getReadyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// Export singleton
const wsClient = new XcannesWebSocket();
export default wsClient;
export { XcannesWebSocket };
