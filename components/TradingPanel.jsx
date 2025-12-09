"use client";

import { useEffect, useState, useMemo } from "react";
import { getBookIdFromPair } from "../utils/xrpl";
import TokenAmountInput from "./TokenAmountInput";
import { useTranslation } from "next-i18next";
import useTrade from "../hooks/useTrade";
import { useXcannesWS } from "../context/XcannesWSContext"; // ✅ WebSocket
import { useExternalPriceWS } from "../hooks/useExternalPriceWS"; // ✅ Prix live Pyth (WebSocket temps réel)
import { getPairCategory } from "../utils/marketStructure"; // ✅ Helper pour détecter la catégorie

export default function TradingPanel({
  pair,
  variant = "card",
  showHeader = true,
}) {
  const { t } = useTranslation("common");
  const isSidebar = variant === "sidebar";
  
  // ✅ Détection du type de paire (même logique que le graphique)
  const pairCategory = useMemo(() => getPairCategory(pair), [pair]);
  const isXRPL = pairCategory === 'xrpl';
  const isExternal = pairCategory === 'pyth';
  const isFawaz = pairCategory === 'fawaz';
  
  // ✅ WebSocket hook (XRPL seulement)
  const { connected, orderbooks, trades, subscribe, unsubscribe } = useXcannesWS();
  
  // ✅ Prix live Pyth via WebSocket (pas Fawaz/EOD)
  const { price: externalPrice, loading: loadingExternalPrice } = useExternalPriceWS(
    isExternal && !isFawaz ? pair : null
  );
  
  // OrderBook & History states (conservés pour calcul du mid-price,
  // mais l'affichage détaillé est désormais dans OrderbookSidebar)
  const [asks, setAsks] = useState([]);
  const [bids, setBids] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState(null);

  // Fetch book info
  useEffect(() => {
    const b = getBookIdFromPair(pair);
    setBook(b);
  }, [pair]);

  // Calcul du prix du marché unifié : Pyth (externe) ou XRPL (mid-price orderbook)
  const marketPrice = isExternal
    ? (externalPrice || 0.00001)
    : (asks[0] && bids[0] ? (asks[0].price + bids[0].price) / 2 : 0.00001);

  // Hook de trading centralisé avec prix du marché en temps réel
  const trade = useTrade(pair, marketPrice);

  // ✅ S'abonner au WebSocket pour l'orderbook (XRPL uniquement)
  useEffect(() => {
    if (!isXRPL) return; // Skip si paire externe
    
    const bookData = getBookIdFromPair(pair);
    if (!bookData?.backendPair || !connected) return;

    console.log('[TradingPanel] 🔌 Abonnement orderbook:', bookData.backendPair);
    subscribe('orderbook', bookData.backendPair);
    subscribe('trades', bookData.backendPair);

    return () => {
      console.log('[TradingPanel] 🔌 Désabonnement orderbook:', bookData.backendPair);
      unsubscribe('orderbook', bookData.backendPair);
      unsubscribe('trades', bookData.backendPair);
    };
  }, [pair, connected, subscribe, unsubscribe, isXRPL]);

  // ✅ Écouter les mises à jour WebSocket de l'orderbook (XRPL uniquement)
  useEffect(() => {
    if (!isXRPL) {
      // Pour les paires externes, pas de loading (données viennent de Pyth)
      setLoading(false);
      return;
    }
    
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
  }, [orderbooks, pair, isXRPL]);

  // ✅ Synchroniser l'historique des trades depuis le WebSocket (XRPL uniquement)
  useEffect(() => {
    if (!isXRPL) return; // Skip si paire externe
    
    const bookData = getBookIdFromPair(pair);
    if (!bookData?.backendPair) return;

    const tradeEntries = trades.get(bookData.backendPair) || [];
    const formattedTrades = tradeEntries.slice(0, 20).map((trade) => ({
      price: Number(trade.price),
      amount: Number(trade.amount),
      executed_time: trade.timestamp instanceof Date ? trade.timestamp : new Date(trade.timestamp),
      type: trade.side === "sell" ? "sell" : "buy",
    }));

    setHistory(formattedTrades);
  }, [trades, pair, isXRPL]);

  const base = pair.split("/")[0];
  const counter = pair.split("/")[1];
  const maxAskAmount = Math.max(...asks.map((a) => a.amount || 0), 1);
  const maxBidAmount = Math.max(...bids.map((b) => b.amount || 0), 1);

  if (loading) {
    return (
      <div
        className={
          isSidebar
            ? "border-b border-white/10 p-4"
            : "bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-6"
        }
      >
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-white/60 text-sm">{t("trading_loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isSidebar
          ? "border-b border-white/10 overflow-hidden"
          : "bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden"
      }
    >
      {/* Header */}
      {showHeader && (
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-orbitron font-bold text-white">
            {t("trading_title")}
          </h2>
          <p className="text-xs text-white/40 mt-1">{t("trading_subtitle")}</p>
        </div>
      )}

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
            disabled={trade.isProcessing || !trade.isConnected || isExternal}
            className="bg-xcannes-green hover:scale-105 transition text-white px-4 py-2 rounded text-sm font-semibold w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isExternal ? (
              "🔒 " + t("trading_read_only")
            ) : trade.isProcessing ? (
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

        {/* COLONNE 2 & 3 : Orderbook + Trades ont été déplacées dans OrderbookSidebar (layout /dex) */}
      </div>
    </div>
  );
}
