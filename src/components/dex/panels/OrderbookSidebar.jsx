"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { useXcannesWS } from "@/context/XcannesWSContext";
import { getBookIdFromPair } from "@/lib/marketMetadata";
import { getPairCategory } from "@/utils/marketStructure";
import { ChartFooter } from "@/components/dex/XrplCandleChart";
import NewsFeed from "./NewsFeed";
import InfoFeesPanel from "./InfoFeesPanel";
import WalletInfoModal from "@/components/wallet/modals/WalletInfoModal";

export default function OrderbookSidebar({ pair, onPriceSelect }) {
  const { t } = useTranslation("common");
  const pairCategory = useMemo(() => getPairCategory(pair), [pair]);
  const isXRPL = pairCategory === "xrpl";
  const [desktopPanel, setDesktopPanel] = useState("orderbook"); // 'orderbook' | 'news'
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);

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
  const [orderbookStatus, setOrderbookStatus] = useState(null);
  const [orderbookMeta, setOrderbookMeta] = useState({
    orderCountBids: 0,
    orderCountAsks: 0,
    totalDepthBase: 0,
    totalDepthQuote: 0,
    spreadPercent: null,
    midPrice: null
  });
  const [selectedRow, setSelectedRow] = useState(null);

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
    if (!ob) return;

    const rawAsks = Array.isArray(ob.asks) ? ob.asks : [];
    const rawBids = Array.isArray(ob.bids) ? ob.bids : [];

    const formatOrders = (orders) =>
    orders.slice(0, 10).map((order) => ({
      price: parseFloat(order.price),
      amount: parseFloat(order.amount),
      total: parseFloat(order.price) * parseFloat(order.amount)
    }));

    setAsks(formatOrders(rawAsks));
    setBids(formatOrders(rawBids));

    // Statut backend prioritaire (ARKOS)
    const backendStatus = ob.orderbook_status || ob.status || null;
    let status = null;

    if (backendStatus === "maintenance") {
      status = "maintenance";
    } else if (backendStatus === "low_liquidity") {
      status = "low_liquidity";
    } else if (backendStatus === "none") {
      status = "none";
    } else if (backendStatus === "available") {
      status = "available";
    } else {
      // Fallback heuristique si le backend ne fournit pas encore orderbook_status
      const hasOrders = rawAsks.length > 0 || rawBids.length > 0;
      if (!hasOrders) {
        status = "none";
      } else {
        const totalDepthBase =
        rawBids.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0) +
        rawAsks.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
        const fewLevels = rawAsks.length + rawBids.length < 6;
        status =
        fewLevels || totalDepthBase < 100 ? "low_liquidity" : "available";
      }
    }

    const bestAsk = rawAsks[0];
    const bestBid = rawBids[0];
    const bestAskPrice = bestAsk ? parseFloat(bestAsk.price) : null;
    const bestBidPrice = bestBid ? parseFloat(bestBid.price) : null;

    let midPrice = ob.mid_price ?? ob.midPrice ?? null;
    if (
    midPrice == null &&
    bestAskPrice != null &&
    bestBidPrice != null &&
    Number.isFinite(bestAskPrice) &&
    Number.isFinite(bestBidPrice))
    {
      midPrice = (bestAskPrice + bestBidPrice) / 2;
    }

    let spreadPercent = ob.spread_percent ?? ob.spreadPercent ?? null;
    if (
    spreadPercent == null &&
    midPrice &&
    bestAskPrice != null &&
    bestBidPrice != null &&
    midPrice > 0)
    {
      spreadPercent =
      (bestAskPrice - bestBidPrice) / midPrice * 100;
    }

    setOrderbookStatus(status);
    setOrderbookMeta({
      orderCountBids:
      ob.order_count_bids ?? (
      Array.isArray(rawBids) ? rawBids.length : 0),
      orderCountAsks:
      ob.order_count_asks ?? (
      Array.isArray(rawAsks) ? rawAsks.length : 0),
      totalDepthBase:
      rawBids.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0) +
      rawAsks.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0),
      totalDepthQuote:
      rawBids.reduce(
        (sum, o) =>
        sum + (
        parseFloat(o.amount || 0) * parseFloat(o.price || 0) || 0),
        0
      ) +
      rawAsks.reduce(
        (sum, o) =>
        sum + (
        parseFloat(o.amount || 0) * parseFloat(o.price || 0) || 0),
        0
      ),
      spreadPercent:
      spreadPercent != null && Number.isFinite(spreadPercent) ?
      spreadPercent :
      null,
      midPrice:
      midPrice != null && Number.isFinite(midPrice) ? midPrice : null
    });
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
      trade.timestamp instanceof Date ?
      trade.timestamp :
      new Date(trade.timestamp),
      type: trade.side === "sell" ? "sell" : "buy"
    }));

    setHistory(formattedTrades);
  }, [trades, pair, isXRPL]);

  const maxAskAmount = Math.max(...asks.map((a) => a.amount || 0), 1);
  const maxBidAmount = Math.max(...bids.map((b) => b.amount || 0), 1);

  const hasOrderbookEntries = isXRPL && (asks.length > 0 || bids.length > 0);
  // Pour les paires externes (Pyth, Fawaz, etc.), on affiche les news
  const showNewsExternal = !isXRPL;
  const isLowLiquidity = orderbookStatus === "low_liquidity";
  const isMaintenance = orderbookStatus === "maintenance";
  const showXrplNoOrders = isXRPL && orderbookStatus === "none";
  const showDesktopNews = isXRPL && desktopPanel === "news";

  const handleRowClick = (side, order, index) => {
    const price = Number(order?.price);
    if (!Number.isFinite(price) || price <= 0) return;

    setSelectedRow((prev) => {
      const isSame =
      prev &&
      prev.side === side &&
      prev.index === index &&
      prev.price === price;

      if (isSame) {
        // Désélection : signaler que le prix venant du carnet n'est plus utilisé
        if (typeof onPriceSelect === "function") {
          onPriceSelect(null, null, { cleared: true, side, price });
        }
        return null;
      }

      if (typeof onPriceSelect === "function") {
        onPriceSelect(price, side, { from: "orderbook" });
      }

      return { side, index, price };
    });
  };

  return (
    <aside className="h-full flex flex-col overflow-hidden">
      <div className="panel-header md:border-b-0">
        {/* Titre - SMARTPHONE : "Market", DESKTOP : "Order Book" */}
        <h2 className="md:hidden text-lg font-semibold text-primary uppercase tracking-wider mb-2">
          {isXRPL ? "Order Book & Trades" : "Market News"}
        </h2>
        <h2 className="hidden md:block text-sm font-semibold text-primary uppercase tracking-wider">
          {isXRPL ? t("trading_orderbook") : "Market News"}
        </h2>
        {/* Police agrandie - SMARTPHONE UNIQUEMENT, normale - DESKTOP */}
        <p className="text-sm md:text-[11px] text-muted mt-0 md:mt-1 font-normal md:font-normal">
          {isXRPL ?
          <>
              {pair} · {connected ? "Live XRPL" : "Offline"}
            </> :

          "News aggregated from local media sources."
          }
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {showNewsExternal ?
        <div className="h-[60vh] lg:h-full">
            <NewsFeed category="finance" />
          </div> :
        showDesktopNews ?
        <div className="h-full">
            <NewsFeed category="finance" />
          </div> :
        isMaintenance ?
        <div className="p-4 space-y-4 text-sm text-secondary">
            <div className="rounded-md bg-amber-500/5 border border-amber-500/30 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-amber-200 mb-1">{t("ui_orderbook_maintenance_fa1de2fea3", "Orderbook maintenance")}

            </p>
              <p className="text-[13px] text-secondary">{t("ui_the_orderbook_for_this_pair__b0082e870e", "The orderbook for this pair is temporarily unavailable. Data may be delayed or incomplete. Trading actions linked to this book should be considered read-only.")}

            </p>
            </div>
            <InfoFeesPanel pair={pair} variant="maintenance" />
          </div> :
        showXrplNoOrders ?
        <div className="p-4 space-y-3">
            <InfoFeesPanel pair={pair} variant="xrpl_no_orders" />
          </div> :
        isXRPL ?
        <div className="p-4 space-y-6">
            {/* Orderbook headers + listes (scrollables) */}
            <div>
              {isLowLiquidity &&
            <div className="mb-3 rounded-md bg-amber-500/5 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-200">{t("ui_low_liquidity_spreads_may_be_4fa281270f", "Low liquidity – spreads may be wide.")}

            </div>
            }
              <div className="grid grid-cols-3 gap-2 mb-2 text-[11px] text-muted font-medium">
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
                <div className="buys-list max-h-[180px] overflow-y-auto overscroll-contain pr-1 rounded-none bg-elevated border-y border-subtle">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-1 h-1 rounded-full bg-xcannes-green" />
                    <span className="text-[11px] font-semibold text-price-up">
                      {t("trading_buys")}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {bids.map((order, idx) => {
                    const depthPercent = order.amount / maxBidAmount * 100;
                    const isSelected =
                    selectedRow &&
                    selectedRow.side === "bid" &&
                    selectedRow.index === idx &&
                    selectedRow.price === order.price;
                    return (
                      <div
                        key={idx}
                        className={`relative cursor-pointer border-l-2 ${
                        isSelected ?
                        "border-xcannes-green bg-subtle" :
                        "border-transparent hover:bg-subtle"}`
                        }
                        onClick={() => handleRowClick("bid", order, idx)}>

                          <div
                          className="absolute inset-y-0 right-0 bg-xcannes-green/10"
                          style={{ width: `${depthPercent}%` }} />

                          <div className="relative grid grid-cols-3 gap-2 py-0.5 text-[11px]">
                            <div className="text-price-up font-semibold">
                              {order.price?.toFixed(6)}
                            </div>
                            <div className="text-secondary text-right">
                              {order.amount?.toFixed(2)}
                            </div>
                            <div className="text-muted text-right">
                              {order.total?.toFixed(4)}
                            </div>
                          </div>
                        </div>);

                  })}
                  </div>
                </div>

                {/* Spread */}
                <div className="my-2 py-1 text-center border-y border-subtle">
                  <span className="text-[11px] text-muted">
                    {t("trading_spread")}:{" "}
                    {asks[0] && bids[0] ?
                  (asks[0].price - bids[0].price).toFixed(6) :
                  "-"}
                  </span>
                </div>

                {/* Asks (offres de vente) */}
                <div className="sells-list max-h-[180px] overflow-y-auto overscroll-contain pr-1 rounded-none bg-elevated border-y border-subtle">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-1 h-1 rounded-full bg-red-500" />
                    <span className="text-[11px] font-semibold text-price-down">
                      {t("trading_sells")}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {asks.map((order, idx) => {
                    const depthPercent = order.amount / maxAskAmount * 100;
                    const isSelected =
                    selectedRow &&
                    selectedRow.side === "ask" &&
                    selectedRow.index === idx &&
                    selectedRow.price === order.price;
                    return (
                      <div
                        key={idx}
                        className={`relative cursor-pointer border-l-2 ${
                        isSelected ?
                        "border-xcannes-green bg-subtle" :
                        "border-transparent hover:bg-subtle"}`
                        }
                        onClick={() => handleRowClick("ask", order, idx)}>

                          <div
                          className="absolute inset-y-0 right-0 bg-red-500/10"
                          style={{ width: `${depthPercent}%` }} />

                          <div className="relative grid grid-cols-3 gap-2 py-0.5 text-[11px]">
                            <div className="text-price-down font-semibold">
                              {order.price?.toFixed(6)}
                            </div>
                            <div className="text-secondary text-right">
                              {order.amount?.toFixed(2)}
                            </div>
                            <div className="text-muted text-right">
                              {order.total?.toFixed(4)}
                            </div>
                          </div>
                        </div>);

                  })}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent trades */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold text-secondary uppercase tracking-wider">
                  {t("trading_recent_trades")}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-1 text-[11px] text-muted font-medium">
                <div>{t("trading_orderbook_price")}</div>
                <div className="text-right">
                  {t("trading_orderbook_amount")}
                </div>
                <div className="text-right">{t("trading_time")}</div>
              </div>

              <div className="recent-trades-list space-y-1 max-h-[140px] overflow-y-auto overscroll-contain pr-1">
                {history.length === 0 ?
              <div className="text-center py-4">
                    <p className="text-[11px] text-muted mb-1">
                      {t("trading_no_trades")}
                    </p>
                  </div> :

              history.map((tx, idx) =>
              <div
                key={idx}
                className="grid grid-cols-3 gap-2 py-1 hover:bg-white/5 rounded transition-colors">

                      <div
                  className={`text-[11px] font-semibold ${
                  tx.type === "buy" ?
                  "text-price-up" :
                  "text-price-down"}`
                  }>

                        {tx.price?.toFixed(6)}
                      </div>
                      <div className="text-[11px] text-secondary text-right">
                        {tx.amount?.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-muted text-right">
                        {tx.executed_time.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                      </div>
                    </div>
              )
              }
              </div>
            </div>
          </div> :
        null}
      </div>

      {/* Footer */}
      {showNewsExternal ?
      <div className="mt-auto shrink-0 bg-elevated sticky bottom-0 z-20">
          <div className="px-3 py-2 flex items-center justify-end">
            <button
            type="button"
            onClick={() => setWalletInfoOpen(true)}
            className="text-[12px] font-medium text-white/85 hover:text-white transition-colors"
            title={t("ui_wallet_info_fees_190ccbf57d", "Wallet info & fees")}>{t("ui_info_fees_e39e77e039", "Info & Fees")}


          </button>
          </div>
        </div> :

      <div className="hidden md:block mt-auto shrink-0 bg-elevated">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <button
            type="button"
            onClick={() =>
            setDesktopPanel((prev) =>
            prev === "news" ? "orderbook" : "news"
            )
            }
            className="text-[12px] font-medium text-white/85 hover:text-white transition-colors">

              {showDesktopNews ? "ORDERBOOK" : "NEWS"}
            </button>

            <button
            type="button"
            onClick={() => setWalletInfoOpen(true)}
            className="text-[12px] font-medium text-white/85 hover:text-white transition-colors"
            title={t("ui_wallet_info_fees_190ccbf57d", "Wallet info & fees")}>{t("ui_info_fees_e39e77e039", "Info & Fees")}


          </button>
          </div>
        </div>
      }

      {/* Chart Footer en bas de la colonne Orderbook sur mobile uniquement */}
      {!showNewsExternal &&
      <div className="md:hidden">
          <ChartFooter
          pair={pair}
          fxMode={isFxMode}
          fxBase={fxBase}
          fxQuote={fxQuote} />

        </div>
      }

      <WalletInfoModal
        isOpen={walletInfoOpen}
        onClose={() => setWalletInfoOpen(false)} />

    </aside>);

}
