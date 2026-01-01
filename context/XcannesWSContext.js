import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from "react";
import wsClient from "../lib/xcannesWebSocket";

const XcannesWSContext = createContext();
const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

export const XcannesWSProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [tickers, setTickers] = useState(new Map()); // Map<pair, ticker>
  const [tickersVersion, setTickersVersion] = useState(0); // ✅ Compteur pour forcer re-render
  const [orderbooks, setOrderbooks] = useState(new Map()); // Map<pair, orderbook>
  const [trades, setTrades] = useState(new Map()); // Map<pair, trades[]>
  const [externalPrices, setExternalPrices] = useState(new Map()); // Map<symbol, pythPrice> unifié
  const [externalPricesVersion, setExternalPricesVersion] = useState(0); // ✅ Compteur pour forcer re-render
  const [wsErrors, setWsErrors] = useState([]); // Derniers messages d'erreur WS (optionnel)

  const normalizeTrade = (trade) => {
    if (!trade || !trade.symbol) return null;
    const price = Number(trade.price);
    const amount = Number(trade.amount);
    if (!Number.isFinite(price) || !Number.isFinite(amount)) return null;
    const total = Number.isFinite(trade.total) ? Number(trade.total) : price * amount;
    const timestamp = trade.timestamp
      ? new Date(
          trade.timestamp instanceof Date
            ? trade.timestamp
            : Number.isFinite(trade.timestamp)
            ? (trade.timestamp > 1e12 ? trade.timestamp : trade.timestamp * 1000)
            : trade.timestamp
        )
      : new Date();

    return {
      symbol: trade.symbol,
      price,
      amount,
      total,
      side: trade.side || "buy",
      txHash: trade.txHash || null,
      account: trade.account || null,
      tradeType: trade.tradeType || "live",
      timestamp,
      source: trade.source || "ws",
    };
  };

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

    // Écouter les orderbooks
    const handleOrderbook = (message) => {
      if (message.data) {
        setOrderbooks(prev => {
          const next = new Map(prev);
          next.set(message.data.symbol, message.data);
          return next;
        });
      }
    };

    wsClient.on("orderbook", handleOrderbook);

    // Écouter les prix externes Pyth (canal unifié)
    const handlePyth = (message) => {
      // Log détaillé volontairement désactivé pour éviter de saturer la console
      // quand le flux Pyth envoie beaucoup de ticks.
      // if (DEBUG_LOGS) {
      //   console.log("[XcannesWS] 🌐 Pyth reçu:", message.data?.symbol || message);
      // }
      if (message.data && message.data.symbol) {
        setExternalPrices(prev => {
          const next = new Map(prev);
          next.set(message.data.symbol, message.data);
          return next;
        });
        setExternalPricesVersion(v => v + 1); // ✅ Incrémenter pour forcer re-render
      }
    };

    wsClient.on("pyth", handlePyth);

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

    const handleTradesSnapshot = (message) => {
      if (!message?.data?.symbol || !Array.isArray(message.data.trades)) return;
      const symbol = message.data.symbol;
      const normalizedList = message.data.trades
        .map(normalizeTrade)
        .filter(Boolean)
        .slice(0, 100);

      setTrades((prev) => {
        const next = new Map(prev);
        next.set(symbol, normalizedList);
        return next;
      });
    };

    const handleTradeUpdate = (message) => {
      if (!message?.data?.symbol) return;
      const normalized = normalizeTrade(message.data);
      if (!normalized) return;

      setTrades((prev) => {
        const next = new Map(prev);
        const list = next.get(normalized.symbol)
          ? [...next.get(normalized.symbol)]
          : [];
        list.unshift(normalized);
        if (list.length > 100) {
          list.length = 100;
        }
        next.set(normalized.symbol, list);
        return next;
      });
    };

    wsClient.on("trades", handleTradesSnapshot);
    wsClient.on("trade", handleTradeUpdate);

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
      wsClient.off("orderbook", handleOrderbook);
      wsClient.off("pyth", handlePyth);
      wsClient.off("eod-summary", handleEodSummary);
      wsClient.off("trades", handleTradesSnapshot);
      wsClient.off("trade", handleTradeUpdate);
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
    tickersVersion, // ✅ Exposer le compteur
    orderbooks,
    trades,
    externalPrices,
    externalPricesVersion, // ✅ Exposer le compteur
    wsErrors,
    subscribe,
    unsubscribe,
    ws: wsClient,
  }), [connected, tickers, tickersVersion, orderbooks, trades, externalPrices, externalPricesVersion, wsErrors, subscribe, unsubscribe]);

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
