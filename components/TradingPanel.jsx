"use client";

import { useEffect, useState, useCallback } from "react";
import { getBookIdFromPair } from "../utils/xrpl";
import xcannesApi from "../lib/xcannesApi";
import TokenAmountInput from "./TokenAmountInput";
import { useTranslation } from "next-i18next";
import useTrade from "../hooks/useTrade";
import { useXcannesWS } from "../context/XcannesWSContext"; // ✅ WebSocket

export default function TradingPanel({ pair }) {
  const { t } = useTranslation("common");
  
  // ✅ WebSocket hook
  const { connected, orderbooks, subscribe, unsubscribe } = useXcannesWS();
  
  // OrderBook & History states
  const [asks, setAsks] = useState([]);
  const [bids, setBids] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState(null);

  // Calcul du prix du marché actuel (mid-price)
  const marketPrice =
    asks[0] && bids[0] ? (asks[0].price + bids[0].price) / 2 : 0.00001;

  // Hook de trading centralisé avec prix du marché en temps réel
  const trade = useTrade(pair, marketPrice);

  // Fetch book info
  useEffect(() => {
    const b = getBookIdFromPair(pair);
    setBook(b);
  }, [pair]);

  // ✅ S'abonner au WebSocket pour l'orderbook
  useEffect(() => {
    const bookData = getBookIdFromPair(pair);
    if (!bookData?.backendPair || !connected) return;

    console.log('[TradingPanel] 🔌 Abonnement orderbook:', bookData.backendPair);
    subscribe('orderbook', bookData.backendPair);

    return () => {
      console.log('[TradingPanel] 🔌 Désabonnement orderbook:', bookData.backendPair);
      unsubscribe('orderbook', bookData.backendPair);
    };
  }, [pair, connected, subscribe, unsubscribe]);

  // ✅ Écouter les mises à jour WebSocket de l'orderbook
  useEffect(() => {
    const bookData = getBookIdFromPair(pair);
    if (!bookData?.backendPair) return;

    const orderbookData = orderbooks.get(bookData.backendPair);
    
    if (orderbookData?.asks && orderbookData?.bids) {
      const formatOrders = (orders) =>
        orders.slice(0, 5).map((order) => ({
          price: parseFloat(order.price),
          amount: parseFloat(order.amount),
          total: parseFloat(order.price) * parseFloat(order.amount),
        }));

      setAsks(formatOrders(orderbookData.asks));
      setBids(formatOrders(orderbookData.bids));
      setLoading(false);
      
      console.log('[TradingPanel] 📊 Orderbook mis à jour via WebSocket');
    }
  }, [orderbooks, pair]);

  // ✅ Fetch initial Trade History (HTTP - garde pour l'instant)
  const fetchTradeHistory = useCallback(async () => {
    try {
      const bookData = getBookIdFromPair(pair);
      if (!bookData?.backendPair) return;

      const response = await xcannesApi.getTrades(bookData.backendPair, 50);

      if (response && response.trades && Array.isArray(response.trades)) {
        const formattedTrades = response.trades.slice(0, 10).map((trade) => ({
          price: parseFloat(trade.price),
          amount: parseFloat(trade.amount),
          executed_time: new Date(trade.timestamp || Date.now()),
          type: trade.side === "buy" ? "buy" : "sell",
        }));

        setHistory(formattedTrades);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("Erreur history:", err);
      setHistory([]);
    }
  }, [pair]);

  // ✅ Fetch initial trade history + polling (garde pour l'instant)
  useEffect(() => {
    fetchTradeHistory();
    const interval = setInterval(() => {
      fetchTradeHistory();
    }, 10000); // Polling 10s pour trades (à migrer vers WS plus tard)
    return () => clearInterval(interval);
  }, [pair, fetchTradeHistory]);

  const base = pair.split("/")[0];
  const counter = pair.split("/")[1];
  const maxAskAmount = Math.max(...asks.map((a) => a.amount || 0), 1);
  const maxBidAmount = Math.max(...bids.map((b) => b.amount || 0), 1);

  if (loading) {
    return (
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-white/60 text-sm">{t("trading_loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-lg font-orbitron font-bold text-white">
          {t("trading_title")}
        </h2>
        <p className="text-xs text-white/40 mt-1">{t("trading_subtitle")}</p>
      </div>

      {/* Main Grid: 3 colonnes */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
        {/* COLONNE 1 : TradeBox */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-4">
            {t("trading_place_order")}
          </h3>

          {/* BUY/SELL Toggle */}
          <div className="flex gap-2 mb-4">
            {["BUY", "SELL"].map((opt) => (
              <button
                key={opt}
                onClick={() => trade.toggleMode(opt)}
                className={`flex-1 px-3 py-2 rounded text-xs font-semibold transition-all ${
                  trade.mode === opt
                    ? "bg-xcannes-green text-white"
                    : opt === "BUY"
                    ? "bg-xcannes-green/20 text-xcannes-green hover:bg-xcannes-green/30"
                    : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                }`}
              >
                {opt === "BUY" ? t("trading_buy") : t("trading_sell")} {base}
              </button>
            ))}
          </div>

          {/* Market/Limit */}
          <div className="flex gap-2 mb-4">
            {["market", "limit"].map((type) => (
              <button
                key={type}
                onClick={() => trade.toggleOrderType(type)}
                className={`px-3 py-1 rounded text-xs border font-semibold transition-all ${
                  trade.orderType === type
                    ? "bg-xcannes-green text-white border-xcannes-green"
                    : "border-white/10 hover:border-white/20 text-white/60"
                }`}
              >
                {type === "market" ? t("trading_market") : t("trading_limit")}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="mb-3">
            <label className="block mb-1 text-xs text-white/60">
              {t("trading_amount")} ({base})
            </label>
            <TokenAmountInput
              value={trade.amount}
              onChange={trade.updateAmount}
              token={base}
            />
          </div>

          {/* Percentage buttons */}
          <div className="grid grid-cols-4 gap-1 mb-3">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => trade.setPercent(pct)}
                className="px-2 py-1 border border-white/10 rounded hover:bg-xcannes-green hover:text-black transition-all text-xs"
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Price (if limit) */}
          {trade.orderType === "limit" && (
            <div className="mb-3">
              <label className="block mb-1 text-xs text-white/60">
                {t("trading_price")} ({counter})
              </label>
              <TokenAmountInput
                value={trade.price}
                onChange={trade.updatePrice}
                token={counter}
              />
            </div>
          )}

          {/* Total */}
          <p className="text-xs text-white/60 mb-3">
            {t("trading_total")}:{" "}
            <span className="text-xcannes-green font-semibold">
              {trade.total} {counter}
            </span>
          </p>

          {/* Submit Button */}
          <button
            onClick={trade.placeOrder}
            disabled={trade.isProcessing || !trade.isConnected}
            className="bg-xcannes-green hover:scale-105 transition text-white px-4 py-2 rounded text-sm font-semibold w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {trade.isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {t("trading_processing")}...
              </span>
            ) : !trade.isConnected ? (
              "🔌 " + t("trading_connect_wallet")
            ) : (
              t("trading_place_order_button").replace(
                "{mode}",
                trade.mode === "BUY" ? t("trading_buy") : t("trading_sell")
              )
            )}
          </button>
        </div>

        {/* COLONNE 2 : OrderBook */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-4">
            {t("trading_orderbook")}
          </h3>

          {/* Headers */}
          <div className="grid grid-cols-3 gap-2 mb-2 text-xs text-white/40 font-medium">
            <div>{t("trading_orderbook_price")}</div>
            <div className="text-right">{t("trading_orderbook_amount")}</div>
            <div className="text-right">{t("trading_orderbook_total")}</div>
          </div>

          {/* ASKS */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1 h-1 rounded-full bg-red-500"></div>
              <span className="text-xs font-semibold text-red-400">
                {t("trading_sells")}
              </span>
            </div>
            <div className="space-y-0.5">
              {asks.slice(0, 5).map((order, idx) => {
                const depthPercent = (order.amount / maxAskAmount) * 100;
                return (
                  <div key={idx} className="relative">
                    <div
                      className="absolute inset-y-0 right-0 bg-red-500/10"
                      style={{ width: `${depthPercent}%` }}
                    />
                    <div className="relative grid grid-cols-3 gap-2 py-0.5 text-xs">
                      <div className="text-red-400 font-semibold">
                        {order.price?.toFixed(6)}
                      </div>
                      <div className="text-white/70 text-right">
                        {order.amount?.toFixed(2)}
                      </div>
                      <div className="text-white/50 text-right">
                        {order.total?.toFixed(4)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Spread */}
          <div className="my-2 py-1 text-center border-y border-white/5">
            <span className="text-xs text-white/40">
              {t("trading_spread")}:{" "}
              {asks[0] && bids[0]
                ? (asks[0].price - bids[0].price).toFixed(6)
                : "-"}
            </span>
          </div>

          {/* BIDS */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1 h-1 rounded-full bg-xcannes-green"></div>
              <span className="text-xs font-semibold text-xcannes-green">
                {t("trading_buys")}
              </span>
            </div>
            <div className="space-y-0.5">
              {bids.slice(0, 5).map((order, idx) => {
                const depthPercent = (order.amount / maxBidAmount) * 100;
                return (
                  <div key={idx} className="relative">
                    <div
                      className="absolute inset-y-0 right-0 bg-xcannes-green/10"
                      style={{ width: `${depthPercent}%` }}
                    />
                    <div className="relative grid grid-cols-3 gap-2 py-0.5 text-xs">
                      <div className="text-xcannes-green font-semibold">
                        {order.price?.toFixed(6)}
                      </div>
                      <div className="text-white/70 text-right">
                        {order.amount?.toFixed(2)}
                      </div>
                      <div className="text-white/50 text-right">
                        {order.total?.toFixed(4)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLONNE 3 : Trade History */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-4">
            {t("trading_recent_trades")}
          </h3>

          {/* Headers */}
          <div className="grid grid-cols-3 gap-2 mb-2 text-xs text-white/40 font-medium">
            <div>{t("trading_orderbook_price")}</div>
            <div className="text-right">{t("trading_orderbook_amount")}</div>
            <div className="text-right">{t("trading_time")}</div>
          </div>

          {/* Trade List */}
          <div className="space-y-1 max-h-[350px] overflow-y-auto">
            {history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-white/40 mb-2">
                  {t("trading_no_trades")}
                </p>
                <p className="text-xs text-white/30">
                  💡 Chargement des ordres du carnet XRPL...
                </p>
              </div>
            ) : (
              history.map((tx, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-3 gap-2 py-1.5 hover:bg-white/5 rounded transition-colors"
                >
                  <div
                    className={`text-xs font-semibold ${
                      tx.type === "buy" ? "text-xcannes-green" : "text-red-400"
                    }`}
                  >
                    {tx.price?.toFixed(6)}
                  </div>
                  <div className="text-xs text-white/70 text-right">
                    {tx.amount?.toFixed(2)}
                  </div>
                  <div className="text-xs text-white/50 text-right">
                    {tx.executed_time.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
