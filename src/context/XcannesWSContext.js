import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import wsClient from "@/lib/xcannesWebSocket";

const XcannesWSContext = createContext();
const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

export const XcannesWSProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [tickers, setTickers] = useState(new Map()); // Map<pair, ticker>
  const [tickersVersion, setTickersVersion] = useState(0); // ✅ Compteur pour forcer re-render
  const [wsErrors, setWsErrors] = useState([]); // Derniers messages d'erreur WS (optionnel)

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

    // Écouter les tickers
    const handleTicker = (message) => {
      if (message.data) {
        setTickers(prev => {
          const next = new Map(prev);
          next.set(message.data.symbol, message.data);
          return next;
        });
        setTickersVersion(v => v + 1); // ✅ Incrémenter pour forcer re-render
      }
    };

    wsClient.on("ticker", handleTicker);

    // ✅ Écouter le canal "eod-summary" agrégé (toutes les paires en un message)
    const handleEodSummary = (message) => {
      if (!message.data || !Array.isArray(message.data.pairs)) return;
      
      // Mettre à jour tous les tickers en une fois
      setTickers(prev => {
        const next = new Map(prev);
        message.data.pairs.forEach(pair => {
          if (pair && pair.symbol) {
            next.set(pair.symbol, pair);
          }
        });
        return next;
      });
      
      setTickersVersion(v => v + 1);
      
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

      // Ne loguer en console que si debug explicite est activé
      if (process.env.NEXT_PUBLIC_DEBUG_LOGS === "true") {
        console.warn("[XcannesWS] WS error:", msg, message);
      }

      setWsErrors((prev) => {
        const next = [...prev, { message: msg, timestamp: Date.now(), raw: message }];
        // Garder uniquement les 20 dernières erreurs pour éviter la croissance infinie
        return next.slice(-20);
      });
    };

    wsClient.on("error", handleWsError);

    // Cleanup à la destruction
    return () => {
      // Ne pas fermer la connexion (singleton partagé)
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

  // ✅ Mémoriser le value pour éviter re-création à chaque render
  const value = useMemo(() => ({
    connected,
    tickers,
    tickersVersion,
    wsErrors,
    subscribe,
    unsubscribe,
    ws: wsClient,
  }), [connected, tickers, tickersVersion, wsErrors, subscribe, unsubscribe]);

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
