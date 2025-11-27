/**
 * 🔌 Service WebSocket pour XCANNES DEX Backend
 * Avec auto-reconnexion, gestion d'erreurs, et heartbeat
 */

const runtimeEnv = (process.env.NEXT_PUBLIC_ENVIRONMENT || '').trim().toLowerCase();
const isProdStage = runtimeEnv === 'production';
const isDev = !isProdStage;

const rawWsUrl = (process.env.NEXT_PUBLIC_XCANNES_WS_URL || "").trim();

function resolveWsUrl() {
  const trimmed = (rawWsUrl || "").replace(/\/$/, "");

  if (!isProdStage) {
    return trimmed || "ws://localhost:3002";
  }

  if (!trimmed) {
    throw new Error("NEXT_PUBLIC_XCANNES_WS_URL requis en production.");
  }

  if (!trimmed.startsWith("wss://")) {
    throw new Error(
      `URL WebSocket invalide: ${trimmed}. Utilisez un endpoint WSS (ex: wss://stream.xcannes.com).`
    );
  }

  return trimmed;
}

const BACKEND_CONFIG = {
  WS_URL: resolveWsUrl(),
};

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
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = WS_CONFIG.MAX_RECONNECT_ATTEMPTS;
    this.reconnectDelay = WS_CONFIG.RECONNECT_INTERVAL;
    this.isConnecting = false;
    this.isManualClose = false;
    this.pingInterval = null;
    this.pongTimeout = null;
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
        console.log(`🔌 [XcannesWS] Connexion à ${this.url}...`);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("✅ [XcannesWS] Connecté au WebSocket");
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // Démarrer heartbeat
          this.startHeartbeat();
          
          // Ré-abonner aux paires précédentes
          if (this.subscriptions.size > 0) {
            console.log(`[XcannesWS] Ré-abonnement à ${this.subscriptions.size} abonnement(s)`);
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
          console.log(`👋 [XcannesWS] Déconnecté (code: ${event.code})`);
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
      console.log(
        `🔄 [XcannesWS] Reconnexion tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`
      );

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
      console.log("📡 [XcannesWS] Serveur:", message.message || message);
    }

    // Dispatch aux listeners (envoyer le message complet)
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach((callback) => {
        try {
          callback(message); // ✅ Passer message complet { type, channel, data }
        } catch (error) {
          console.error(`[XcannesWS] Erreur callback ${type}:`, error);
        }
      });
    }
  }

  /**
   * Écouter un type d'événement
   * @param {string} eventType - 'ticker', 'orderbook', 'trades', 'connected', 'heartbeat'
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
   * S'abonner à un canal pour une paire
   * @param {string} channel - 'ticker' ou 'orderbook'
   * @param {string} pair - Format: XCS_XRP
   */
  subscribe(channel, pair) {
    const subscriptionKey = `${channel}:${pair}`;
    const alreadySubscribed = this.subscriptions.has(subscriptionKey);
    this.subscriptions.add(subscriptionKey);

    if (alreadySubscribed) {
      // Pas besoin de renvoyer un subscribe identique
      return;
    }

    if (this.isConnected()) {
      this.send({
        type: 'subscribe',
        channel,
        pair,
      });
      console.log(`📥 [XcannesWS] Abonné à ${channel}:${pair}`);
    } else {
      console.warn(`⚠️ [XcannesWS] Pas connecté, abonnement en attente: ${channel}:${pair}`);
    }
  }

  /**
   * Se désabonner d'un canal pour une paire
   * @param {string} channel - 'ticker' ou 'orderbook'
   * @param {string} pair - Format: XCS_XRP
   */
  unsubscribe(channel, pair) {
    const subscriptionKey = `${channel}:${pair}`;
    const wasSubscribed = this.subscriptions.delete(subscriptionKey);

    if (!wasSubscribed) {
      return;
    }

    if (this.isConnected()) {
      this.send({
        type: 'unsubscribe',
        channel,
        pair,
      });
      console.log(`📤 [XcannesWS] Désabonné de ${channel}:${pair}`);
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
      console.warn(
        "[XcannesWS] WebSocket non connecté, message non envoyé:",
        data
      );
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
      this.listeners.clear();
      console.log('[XcannesWS] Déconnecté manuellement');
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
