import { createContext, useContext, useEffect, useState, useRef } from "react";
import wsClient from "../lib/xcannesWebSocket";

const XcannesWSContext = createContext();

export const XcannesWSProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [tickers, setTickers] = useState(new Map()); // Map<pair, ticker>
  const [orderbooks, setOrderbooks] = useState(new Map()); // Map<pair, orderbook>

  useEffect(() => {
    // Utiliser le singleton wsClient
    wsClient
      .connect()
      .then(() => {
        setConnected(true);
        console.log("✅ [XcannesWSContext] WebSocket connecté");
      })
      .catch((err) => {
        console.error("❌ [XcannesWSContext] Erreur connexion:", err);
        setConnected(false);
      });

    // Écouter les tickers
    wsClient.on("ticker", (message) => {
      if (message.data) {
        setTickers(prev => {
          const next = new Map(prev);
          next.set(message.data.symbol, message.data);
          return next;
        });
      }
    });

    // Écouter les orderbooks
    wsClient.on("orderbook", (message) => {
      if (message.data) {
        setOrderbooks(prev => {
          const next = new Map(prev);
          next.set(message.data.symbol, message.data);
          return next;
        });
      }
    });

    // Cleanup à la destruction
    return () => {
      // Ne pas fermer la connexion (singleton partagé)
      wsClient.off("ticker");
      wsClient.off("orderbook");
    };
  }, []);

  const subscribe = (channel, pair) => {
    wsClient.subscribe(channel, pair);
  };

  const unsubscribe = (channel, pair) => {
    wsClient.unsubscribe(channel, pair);
  };

  const value = {
    connected,
    tickers,
    orderbooks,
    subscribe,
    unsubscribe,
    ws: wsClient,
  };

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
