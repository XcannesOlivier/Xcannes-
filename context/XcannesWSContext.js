import { createContext, useContext, useEffect, useState, useRef } from "react";
import wsClient from "../lib/xcannesWebSocket";

const XcannesWSContext = createContext();

export const XcannesWSProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [tickers, setTickers] = useState(new Map()); // Map<pair, ticker>
  const [orderbooks, setOrderbooks] = useState(new Map()); // Map<pair, orderbook>
  const [trades, setTrades] = useState(new Map()); // Map<pair, trades[]>
  const [externalPrices, setExternalPrices] = useState(new Map()); // Map<symbol, pythPrice> pour forex/crypto/commodity

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
        console.log("✅ [XcannesWSContext] WebSocket connecté");
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

    // Écouter les prix externes Pyth (forex, crypto, commodity)
    const handleForex = (message) => {
      console.log('[XcannesWS] 📊 Forex reçu:', message);
      if (message.data && message.data.symbol) {
        setExternalPrices(prev => {
          const next = new Map(prev);
          next.set(message.data.symbol, message.data);
          return next;
        });
      }
    };

    const handleCommodity = (message) => {
      console.log('[XcannesWS] 🥇 Commodity reçu:', message);
      if (message.data && message.data.symbol) {
        setExternalPrices(prev => {
          const next = new Map(prev);
          next.set(message.data.symbol, message.data);
          return next;
        });
      }
    };

    const handleCrypto = (message) => {
      console.log('[XcannesWS] ₿ Crypto reçu:', message);
      if (message.data && message.data.symbol) {
        setExternalPrices(prev => {
          const next = new Map(prev);
          next.set(message.data.symbol, message.data);
          return next;
        });
      }
    };

    wsClient.on("forex", handleForex);
    wsClient.on("commodity", handleCommodity);
    wsClient.on("crypto", handleCrypto);

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

    // Cleanup à la destruction
    return () => {
      // Ne pas fermer la connexion (singleton partagé)
      wsClient.off("ticker", handleTicker);
      wsClient.off("orderbook", handleOrderbook);
      wsClient.off("forex", handleForex);
      wsClient.off("commodity", handleCommodity);
      wsClient.off("crypto", handleCrypto);
      wsClient.off("trades", handleTradesSnapshot);
      wsClient.off("trade", handleTradeUpdate);
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
    trades,
    externalPrices,
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
