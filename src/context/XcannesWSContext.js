import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import wsClient from "@/lib/xcannesWebSocket";

const XcannesWSContext = createContext();

export const XcannesWSProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const wsErrorsRef = useRef([]); // Erreurs stockées en ref, pas en state

  useEffect(() => {
    // Utiliser le singleton wsClient
    wsClient
      .connect()
      .then(() => {
        setConnected(true);
      })
      .catch((err) => {
        console.error("❌ [XcannesWSContext] Erreur connexion:", err);
        setConnected(false);
      });

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
      wsClient.off("error", handleWsError);
    };
  }, []);

  const subscribe = useCallback((channel, pair) => {
    wsClient.subscribe(channel, pair);
  }, []);

  const unsubscribe = useCallback((channel, pair) => {
    wsClient.unsubscribe(channel, pair);
  }, []);

  const value = useMemo(() => ({
    connected,
    subscribe,
    unsubscribe,
    ws: wsClient,
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
