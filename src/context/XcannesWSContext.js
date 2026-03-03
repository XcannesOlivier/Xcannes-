import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import wsClient from "@/lib/xcannesWebSocket";

const XcannesWSContext = createContext();
const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

/**
 * Hook pour les composants qui ont BESOIN des tickers temps réel.
 * Utilise un pattern subscribe-on-demand pour ne re-rendre QUE les
 * composants qui appellent ce hook, pas tout l'arbre React.
 */
const tickerListeners = new Set();
const tickersRef = { current: new Map() };
let tickersVersionRef = 0;

function notifyTickerListeners() {
  tickerListeners.forEach(fn => fn());
}

export function useTickers() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const handler = () => forceUpdate(v => v + 1);
    tickerListeners.add(handler);
    return () => tickerListeners.delete(handler);
  }, []);
  return { tickers: tickersRef.current, tickersVersion: tickersVersionRef };
}

export const XcannesWSProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const wsErrorsRef = useRef([]); // Erreurs stockées en ref, pas en state

  useEffect(() => {
    // Utiliser le singleton wsClient
    wsClient
      .connect()
      .then(() => {
        setConnected(true);
        if (DEBUG_LOGS) {
          console.log("✅ [XcannesWSContext] WebSocket connecté");
        }
      })
      .catch((err) => {
        console.error("❌ [XcannesWSContext] Erreur connexion:", err);
        setConnected(false);
      });

    // Écouter les tickers — stockés en ref (pas en state) pour éviter
    // de re-rendre tout l'arbre React à chaque tick.
    // Seuls les composants qui appellent useTickers() sont notifiés.
    const handleTicker = (message) => {
      if (message.data) {
        tickersRef.current = new Map(tickersRef.current);
        tickersRef.current.set(message.data.symbol, message.data);
        tickersVersionRef++;
        notifyTickerListeners();
      }
    };

    wsClient.on("ticker", handleTicker);

    // Écouter le canal "eod-summary" agrégé (toutes les paires en un message)
    const handleEodSummary = (message) => {
      if (!message.data || !Array.isArray(message.data.pairs)) return;
      
      const next = new Map(tickersRef.current);
      message.data.pairs.forEach(pair => {
        if (pair && pair.symbol) {
          next.set(pair.symbol, pair);
        }
      });
      tickersRef.current = next;
      tickersVersionRef++;
      notifyTickerListeners();
      
      if (DEBUG_LOGS) {
        console.log(`[XcannesWS] 📊 EOD Summary reçu: ${message.data.pairs.length} paires`);
      }
    };

    wsClient.on("eod-summary", handleEodSummary);

    // Gérer les messages d'erreur du serveur WS de manière non bloquante
    const handleWsError = (message) => {
      const msg =
        message?.message ||
        message?.data?.message ||
        "WebSocket error (type \"error\")";

      if (process.env.NEXT_PUBLIC_DEBUG_LOGS === "true") {
        console.warn("[XcannesWS] WS error:", msg, message);
      }

      // Stocké en ref — pas de re-render
      const next = [...wsErrorsRef.current, { message: msg, timestamp: Date.now(), raw: message }];
      wsErrorsRef.current = next.slice(-20);
    };

    wsClient.on("error", handleWsError);

    // Cleanup à la destruction
    return () => {
      wsClient.off("ticker", handleTicker);
      wsClient.off("eod-summary", handleEodSummary);
      wsClient.off("error", handleWsError);
    };
  }, []);

  // ✅ Mémoriser avec useCallback pour éviter re-création à chaque render
  const subscribe = useCallback((channel, pair) => {
    wsClient.subscribe(channel, pair);
  }, []);

  const unsubscribe = useCallback((channel, pair) => {
    wsClient.unsubscribe(channel, pair);
  }, []);

  // ✅ Value stable — ne change que si connected change.
  // Les tickers sont accessibles via useTickers() (pattern subscription).
  const value = useMemo(() => ({
    connected,
    subscribe,
    unsubscribe,
    ws: wsClient,
    // Accès en lecture depuis le ref pour les cas legacy
    getTickers: () => tickersRef.current,
    getTickersVersion: () => tickersVersionRef,
    getWsErrors: () => wsErrorsRef.current,
  }), [connected, subscribe, unsubscribe]);

  return (
    <XcannesWSContext.Provider value={value}>
      {children}
    </XcannesWSContext.Provider>
  );
};

export const useXcannesWS = () => {
  const context = useContext(XcannesWSContext);
  if (!context) {
    throw new Error("useXcannesWS must be used within XcannesWSProvider");
  }
  return context;
};
