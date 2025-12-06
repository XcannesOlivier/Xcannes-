"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { useXcannesWS } from "../context/XcannesWSContext";
import { getBookIdFromPair } from "../utils/xrpl";
import { getPairCategory } from "../utils/marketStructure";
import ChartFooter from "./ChartFooter";
import NewsFeed from "./NewsFeed";

export default function OrderbookSidebar({ pair }) {
  const { t } = useTranslation("common");
  const pairCategory = useMemo(() => getPairCategory(pair), [pair]);
  const isXRPL = pairCategory === "xrpl";

  // ✅ Extraire base/quote de la paire ET détecter si c'est une paire non-XRPL
  const { isFxMode, fxBase, fxQuote } = useMemo(() => {
    if (pair && pair.includes('/')) {
      const parts = pair.split('/');
      const base = parts[0] || '';
      const quote = parts[1] || '';
      
      // Mode FX activé pour toutes les paires non-XRPL
      const isNonXrpl = pairCategory !== "xrpl";
      
      return {
        isFxMode: isNonXrpl,
        fxBase: base,
        fxQuote: quote
      };
    }
    return { isFxMode: false, fxBase: '', fxQuote: '' };
  }, [pair, pairCategory]);

  const { connected, orderbooks, trades, subscribe, unsubscribe } =
    useXcannesWS();

  const [asks, setAsks] = useState([]);
  const [bids, setBids] = useState([]);
  const [history, setHistory] = useState([]);

  // Abonnement WS XRPL
  useEffect(() => {
    if (!isXRPL) return;

    const bookData = getBookIdFromPair(pair);
    if (!bookData?.backendPair || !connected) return;

    subscribe("orderbook", bookData.backendPair);
    subscribe("trades", bookData.backendPair);

    return () => {
      unsubscribe("orderbook", bookData.backendPair);
      unsubscribe("trades", bookData.backendPair);
    };
  }, [pair, connected, subscribe, unsubscribe, isXRPL]);

  // Orderbook updates
  useEffect(() => {
    if (!isXRPL) return;

    const bookData = getBookIdFromPair(pair);
    if (!bookData?.backendPair) return;

    const ob = orderbooks.get(bookData.backendPair);
    if (!ob?.asks || !ob?.bids) return;

    const formatOrders = (orders) =>
      orders.slice(0, 10).map((order) => ({
        price: parseFloat(order.price),
        amount: parseFloat(order.amount),
        total: parseFloat(order.price) * parseFloat(order.amount),
      }));

    setAsks(formatOrders(ob.asks));
    setBids(formatOrders(ob.bids));
  }, [orderbooks, pair, isXRPL]);

  // Trades history
  useEffect(() => {
    if (!isXRPL) return;

    const bookData = getBookIdFromPair(pair);
    if (!bookData?.backendPair) return;

    const tradeEntries = trades.get(bookData.backendPair) || [];
    const formattedTrades = tradeEntries.slice(0, 40).map((trade) => ({
      price: Number(trade.price),
      amount: Number(trade.amount),
      executed_time:
        trade.timestamp instanceof Date
          ? trade.timestamp
          : new Date(trade.timestamp),
      type: trade.side === "sell" ? "sell" : "buy",
    }));

    setHistory(formattedTrades);
  }, [trades, pair, isXRPL]);

  const maxAskAmount = Math.max(...asks.map((a) => a.amount || 0), 1);
  const maxBidAmount = Math.max(...bids.map((b) => b.amount || 0), 1);

  return (
    <aside className="bg-black/40 backdrop-blur-sm rounded-l-xl rounded-r-none h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/10">
        {/* Titre - SMARTPHONE : "Market", DESKTOP : "Order Book" */}
        <h2 className="md:hidden text-lg font-semibold text-white/90 uppercase tracking-wider mb-2">
          Order Book & Trades
        </h2>
        <h2 className="hidden md:block text-sm font-semibold text-white/80 uppercase tracking-wider">
          {t("trading_orderbook")}
        </h2>
        {/* Police agrandie - SMARTPHONE UNIQUEMENT, normale - DESKTOP */}
        <p className="text-sm md:text-[11px] text-white/40 md:text-white/40 mt-0 md:mt-1 font-normal md:font-normal">
          {pair} · {connected ? "Live XRPL" : "Offline"}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isXRPL ? (
          <div className="p-4 space-y-6">
            {/* Orderbook headers + listes (scrollables) */}
            <div>
              <div className="grid grid-cols-3 gap-2 mb-2 text-[11px] text-white/40 font-medium">
                <div>{t("trading_orderbook_price")}</div>
                <div className="text-right">
                  {t("trading_orderbook_amount")}
                </div>
                <div className="text-right">
                  {t("trading_orderbook_total")}
                </div>
              </div>

              <div className="space-y-3">
                {/* Bids (offres d'achat) */}
                <div className="buys-list max-h-[180px] overflow-y-auto overscroll-contain pr-1">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-1 h-1 rounded-full bg-xcannes-green" />
                    <span className="text-[11px] font-semibold text-xcannes-green">
                      {t("trading_buys")}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {bids.map((order, idx) => {
                      const depthPercent = (order.amount / maxBidAmount) * 100;
                      return (
                        <div key={idx} className="relative">
                          <div
                            className="absolute inset-y-0 right-0 bg-xcannes-green/10"
                            style={{ width: `${depthPercent}%` }}
                          />
                          <div className="relative grid grid-cols-3 gap-2 py-0.5 text-[11px]">
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

                {/* Spread */}
                <div className="my-2 py-1 text-center border-y border-white/5">
                  <span className="text-[11px] text-white/40">
                    {t("trading_spread")}:{" "}
                    {asks[0] && bids[0]
                      ? (asks[0].price - bids[0].price).toFixed(6)
                      : "-"}
                  </span>
                </div>

                {/* Asks (offres de vente) */}
                <div className="sells-list max-h-[180px] overflow-y-auto overscroll-contain pr-1">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-1 h-1 rounded-full bg-red-500" />
                    <span className="text-[11px] font-semibold text-red-400">
                      {t("trading_sells")}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {asks.map((order, idx) => {
                      const depthPercent = (order.amount / maxAskAmount) * 100;
                      return (
                        <div key={idx} className="relative">
                          <div
                            className="absolute inset-y-0 right-0 bg-red-500/10"
                            style={{ width: `${depthPercent}%` }}
                          />
                          <div className="relative grid grid-cols-3 gap-2 py-0.5 text-[11px]">
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
              </div>
            </div>

            {/* Recent trades */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                  {t("trading_recent_trades")}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-1 text-[11px] text-white/40 font-medium">
                <div>{t("trading_orderbook_price")}</div>
                <div className="text-right">
                  {t("trading_orderbook_amount")}
                </div>
                <div className="text-right">{t("trading_time")}</div>
              </div>

              <div className="recent-trades-list space-y-1 max-h-[140px] overflow-y-auto overscroll-contain pr-1">
                {history.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-[11px] text-white/40 mb-1">
                      {t("trading_no_trades")}
                    </p>
                  </div>
                ) : (
                  history.map((tx, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-3 gap-2 py-1 hover:bg-white/5 rounded transition-colors"
                    >
                      <div
                        className={`text-[11px] font-semibold ${
                          tx.type === "buy"
                            ? "text-xcannes-green"
                            : "text-red-400"
                        }`}
                      >
                        {tx.price?.toFixed(6)}
                      </div>
                      <div className="text-[11px] text-white/70 text-right">
                        {tx.amount?.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-white/50 text-right">
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
        ) : (
          <NewsFeed category="finance" />
        )}
      </div>

      {/* Chart Footer en bas de la colonne Orderbook sur mobile uniquement */}
      <div className="md:hidden">
        <ChartFooter 
          pair={pair}
          fxMode={isFxMode}
          fxBase={fxBase}
          fxQuote={fxQuote}
        />
      </div>
    </aside>
  );
}
