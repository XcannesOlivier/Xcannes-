"use client";

import { useEffect, useMemo, useState } from "react";
import { useXcannesWS } from "../../context/XcannesWSContext";
import { getBookIdFromPair } from "../../utils/xrpl";
import { getPairCategory } from "../../utils/marketStructure";
import OrderbookSidebar from "./OrderbookSidebar";
import NewsFeed from "./NewsFeed";
import { WalletInfoContent } from "../componentsGlobal/WalletInfoModal";

/**
 * Onglets mobile (M1) pour la zone marché :
 * - Orderbook
 * - Info & Fees
 * - Trades
 *
 * Utilisé uniquement sous 1024px dans TradingLayoutV1A.
 */
export default function MobileTradingTabs({ pair }) {
  const pairCategory = useMemo(() => getPairCategory(pair), [pair]);
  const isXRPL = pairCategory === "xrpl";

  const { orderbooks, trades } = useXcannesWS();
  const [orderbookStatus, setOrderbookStatus] = useState(null);
  const [activeTab, setActiveTab] = useState("orderbook");

  // Déduire backendPair + statut du carnet depuis le WS (même logique que OrderbookSidebar)
  useEffect(() => {
    if (!isXRPL) {
      setOrderbookStatus(null);
      return;
    }
    const bookData = getBookIdFromPair(pair);
    if (!bookData?.backendPair) {
      setOrderbookStatus(null);
      return;
    }
    const ob = orderbooks.get(bookData.backendPair);
    if (!ob) {
      setOrderbookStatus(null);
      return;
    }

    // NOTE ARKOS: quand la clé "orderbook_status" sera figée côté backend,
    // on pourra supprimer le fallback sur "status" et les heuristiques ci-dessous.
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
      const rawAsks = Array.isArray(ob.asks) ? ob.asks : [];
      const rawBids = Array.isArray(ob.bids) ? ob.bids : [];
      const hasOrders = rawAsks.length > 0 || rawBids.length > 0;
      if (!hasOrders) {
        status = "none";
      } else {
        status = "available";
      }
    }

    setOrderbookStatus(status);
  }, [orderbooks, pair, isXRPL]);

  // Règle d’onglet actif par défaut (mobile) :
  // - Paires XRPL : toujours "Orderbook" au chargement / changement de paire
  // - Paires externes : onglet "Orderbook" (news / flux externe)
  useEffect(() => {
    let nextTab = "orderbook";

    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isXRPL, orderbookStatus, pair]);

  // Variant Info & Fees selon cas
  const infoVariant = useMemo(() => {
    if (!isXRPL) return "external";
    if (orderbookStatus === "none") return "xrpl_no_orders";
    if (orderbookStatus === "maintenance") return "maintenance";
    return "xrpl_default";
  }, [isXRPL, orderbookStatus]);

  // Trades pour l’onglet dédié
  const tradesHistory = useMemo(() => {
    if (!isXRPL) return [];
    const bookData = getBookIdFromPair(pair);
    if (!bookData?.backendPair) return [];
    const list = trades.get(bookData.backendPair) || [];
    return list
      .map((trade) => {
        const price = Number(trade.price);
        const amount = Number(trade.amount);
        const executed_time =
          trade.timestamp instanceof Date
            ? trade.timestamp
            : new Date(trade.timestamp);
        if (!Number.isFinite(price) || !Number.isFinite(amount)) return null;
        return {
          price,
          amount,
          executed_time,
          type: trade.side === "sell" ? "sell" : "buy",
        };
      })
      .filter(Boolean)
      .slice(0, 40);
  }, [trades, pair, isXRPL]);

  const tabs = useMemo(
    () => [
      {
        key: "orderbook",
        label: isXRPL ? "Orderbook" : "Live News",
      },
      { key: "info", label: "Info & Fees" },
      // Sur XRPL, on préfère un onglet "News" plutôt que "Trades" sur mobile
      isXRPL
        ? { key: "news", label: "News" }
        : { key: "trades", label: "Trades" },
    ],
    [isXRPL]
  );

  return (
    <div className="mt-4">
      {/* Tabs */}
      <div className="flex justify-around border-b border-subtle text-[12px] text-muted">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-xs uppercase tracking-[0.14em] border-b-2 focus-ring-token ${
                isActive
                  ? "border-accent-rlusd text-primary"
                  : "border-transparent text-muted hover:text-secondary"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="mt-2">
        {activeTab === "orderbook" ? (
          <OrderbookSidebar pair={pair} />
        ) : activeTab === "info" ? (
          <div className="panel-body">
            <WalletInfoContent />
          </div>
        ) : activeTab === "news" && isXRPL ? (
          <div className="panel-body h-[60vh]">
            <NewsFeed category="finance" />
          </div>
        ) : (
          <div className="panel-body">
            {tradesHistory.length === 0 ? (
              <p className="text-[11px] text-muted">
                No recent trades for this pair.
              </p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-3 gap-2 mb-1 text-[11px] text-muted font-medium">
                  <div>Price</div>
                  <div className="text-right">Amount</div>
                  <div className="text-right">Time</div>
                </div>
                {tradesHistory.map((tx, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-3 gap-2 py-1 hover:bg-white/5 rounded transition-colors text-[11px]"
                  >
                    <div
                      className={`font-semibold ${
                        tx.type === "buy" ? "text-price-up" : "text-price-down"
                      }`}
                    >
                      {tx.price.toFixed(6)}
                    </div>
                    <div className="text-secondary text-right">
                      {tx.amount.toFixed(2)}
                    </div>
                    <div className="text-muted text-right">
                      {tx.executed_time.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
