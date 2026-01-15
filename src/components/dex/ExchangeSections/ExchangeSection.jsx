"use client";

	import { useEffect, useMemo, useState } from "react";
	import { useTranslation } from "next-i18next";
	import { FxPairSelector } from "@/components/dex/XrplCandleChart";
	import { useXcannesWS } from "@/context/XcannesWSContext";
import { useCustomPairs } from "./useCustomPairs";
import { useEodBasePairs } from "./hooks/useEodBasePairs";
import { useEodData } from "./hooks/useEodData";
import { useEodWsSubscription } from "./hooks/useEodWsSubscription";
import { useFlashStates } from "./hooks/useFlashStates";
import { applyDynamicSpreadToMid, applySpreadToMid, spreadFractionForPair } from "@/utils/marketSpread";
import { useXrplRlusdXrpSpreadSignal } from "./hooks/useXrplSpreadSignal";
import ExchangeHeader from "./components/ExchangeHeader";
import SearchAndAddBar from "./components/SearchAndAddBar";
import PairsTableDesktop from "./components/PairsTableDesktop";
import PairsListMobile from "./components/PairsListMobile";

/**
 * Section réutilisable "EOD FX Markets"
 * - variant="page"      : plein écran (route /eod-exchange)
 * - variant="embedded"  : section scrollable à l'intérieur de /dex
 */
export default function ExchangeSection({ variant = "embedded" }) {
  const { t } = useTranslation("common");
  const { connected, tickers, tickersVersion, subscribe, unsubscribe } =
    useXcannesWS();

  const [selectedPair, setSelectedPair] = useState({
    base: "EUR",
    quote: "USD",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddPair, setShowAddPair] = useState(false);

  const basePairs = useEodBasePairs();
  const { eodData, loadingPairs, loadEODData, setEodData } = useEodData(
    basePairs,
    tickers
  );
  const flashStates = useFlashStates(eodData);
  const xrplSpreadSignal = useXrplRlusdXrpSpreadSignal({
    tickers,
    tickersVersion,
    symbols: ["XRP_RLUSD", "RLUSD_XRP"],
    alphaPct: 0.15,
    alphaDelta: 0.25,
    clampMaxPct: 0.2,
  });

  useEodWsSubscription({
    connected,
    subscribe,
    unsubscribe,
  });

  const {
    customPairs,
    handleAddCustomPair,
    handleRemoveCustomPair,
    isCustomPair,
  } = useCustomPairs(basePairs, loadEODData);

  // Mise à jour live via le canal "eod-summary" agrégé (tickers temps réel)
  useEffect(() => {
    const pairsToUpdate = [];
    const seen = new Set();

    (customPairs || []).forEach((pair) => {
      if (!pair?.base || !pair?.quote) return;
      const key = `${pair.base}/${pair.quote}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairsToUpdate.push({ ...pair, source: pair.source || "eod" });
    });

    (basePairs || []).forEach((pair) => {
      if (!pair?.base || !pair?.quote) return;
      const key = `${pair.base}/${pair.quote}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairsToUpdate.push(pair);
    });

    if (pairsToUpdate.length === 0) return;
    const tickerMap = tickers instanceof Map ? tickers : new Map();
    if (tickerMap.size === 0) return;

    setEodData((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      let changed = false;

      pairsToUpdate.forEach((pair) => {
        const symbol = pair.symbol;
        const backendPair = symbol || `${pair.base}_${pair.quote}`;
        const ticker = tickerMap.get(backendPair);

        const pairKey = `${pair.base}/${pair.quote}`;
        const existing = next[pairKey] || {};

        // Mid price:
        // - Pyth/XRPL: prefer live ticker if present
        // - Fawaz/EOD: keep the last known mid from existing data (Forex may be closed)
        const priceSource =
          ticker?.lastPrice ??
          ticker?.price ??
          ticker?.midPrice ??
          ticker?.bidPrice ??
          ticker?.askPrice ??
          existing.price ??
          existing.close;

        const rawBid =
          ticker?.bidPrice ?? ticker?.bid ?? ticker?.bestBidPrice;
        const rawAsk =
          ticker?.askPrice ?? ticker?.ask ?? ticker?.bestAskPrice;

        const priceNum =
          priceSource !== undefined && priceSource !== null
            ? Number(priceSource)
            : null;
        const bidNum =
          rawBid !== undefined && rawBid !== null ? Number(rawBid) : null;
        const askNum =
          rawAsk !== undefined && rawAsk !== null ? Number(rawAsk) : null;

        if (!Number.isFinite(priceNum) || priceNum <= 0) {
          return;
        }

        const price = priceNum;
        let bid = Number.isFinite(bidNum) ? bidNum : price;
        let ask = Number.isFinite(askNum) ? askNum : price;

        // Paires XRPL: garder bid/ask natifs, mais elles peuvent servir de signal global ailleurs.
        if (pair.source !== "xrpl") {
          const baseSpread = spreadFractionForPair(pair.base, pair.quote);
          const signalPct =
            xrplSpreadSignal?.emaPct != null
              ? Number(xrplSpreadSignal.emaPct)
              : 0;
          const signalDelta =
            xrplSpreadSignal?.emaDelta != null
              ? Number(xrplSpreadSignal.emaDelta)
              : 0;

          // Pricing "exchange-like": mid = FX reference (PYTH/FAWAZ),
          // spread = exotism + factor * XRPL spread%, then asymmetric split.
          const spreaded =
            signalPct > 0
              ? applyDynamicSpreadToMid(price, {
                  base: pair.base,
                  quote: pair.quote,
                  xrplSpreadPct: signalPct,
                  xrplSpreadDelta: signalDelta,
                  factor: 1.0,
                  pairKey,
                  minMultiplier: 0.75,
                  maxMultiplier: 3.0,
                })
              : applySpreadToMid(price, baseSpread);

          bid = spreaded.bid;
          ask = spreaded.ask;
        }

        const prevPrice = Number(existing.price ?? existing.close ?? NaN);
        const prevBid = Number(existing.bid ?? NaN);
        const prevAsk = Number(existing.ask ?? NaN);

        const priceChanged =
          !Number.isFinite(prevPrice) ||
          Math.abs(prevPrice - price) > 1e-8;
        const bidChanged =
          !Number.isFinite(prevBid) ||
          Math.abs(prevBid - bid) > 1e-8;
        const askChanged =
          !Number.isFinite(prevAsk) ||
          Math.abs(prevAsk - ask) > 1e-8;

        if (!priceChanged && !bidChanged && !askChanged) {
          return;
        }

        next[pairKey] = {
          ...existing,
          price,
          bid,
          ask,
          mode: ticker ? "ticker" : existing.mode || (pair.source === "eod" ? "eod" : "ticker"),
        };
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [
    tickers,
    basePairs,
    customPairs,
    tickersVersion,
    xrplSpreadSignal.emaDelta,
    xrplSpreadSignal.emaPct,
    setEodData,
  ]);

  // Paires globales affichées : XRPL + Pyth (toujours présentes) + paires EOD personnalisées
  const allPairs = useMemo(() => {
    const pairs = [];

    // Paires EOD personnalisées en premier
    customPairs.forEach((pair) => {
      const exists = pairs.some(
        (p) => p.base === pair.base && p.quote === pair.quote
      );
      if (!exists) {
        pairs.push({ ...pair, source: pair.source || "eod" });
      }
    });

    // Puis paires XRPL + Pyth de base
    basePairs.forEach((pair) => {
      const exists = pairs.some(
        (p) => p.base === pair.base && p.quote === pair.quote
      );
      if (!exists) {
        pairs.push(pair);
      }
    });

    return pairs;
  }, [basePairs, customPairs]);

  const filteredPairs = useMemo(() => {
    if (!searchTerm.trim()) return allPairs;
    const term = searchTerm.toLowerCase();
    return allPairs.filter(
      (pair) =>
        pair.base.toLowerCase().includes(term) ||
        pair.quote.toLowerCase().includes(term) ||
        `${pair.base}${pair.quote}`.toLowerCase().includes(term)
    );
  }, [allPairs, searchTerm]);

  const onAddCustomPair = () => {
    const success = handleAddCustomPair(selectedPair);
    if (success) {
      setShowAddPair(false);
    }
  };

  const outerClass =
    variant === "page"
      ? "min-h-screen bg-base text-white font-montserrat p-4 relative"
      : "w-full text-white font-montserrat py-10 relative";

  const innerClass =
    variant === "page"
      ? "max-w-7xl mx-auto"
      : "max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6";

  const handleTradeAction = (action, pair) => {
    if (typeof window === "undefined") return;
    const base = String(pair?.base || "").trim().toUpperCase();
    const quote = String(pair?.quote || "").trim().toUpperCase();
    if (!base || !quote) return;
    window.dispatchEvent(
      new CustomEvent("xcannes:wallet:open-convert", {
        detail: {
          action: String(action || "").toLowerCase(),
          base,
          quote,
          pairKey: `${base}/${quote}`,
          source: pair?.source || "unknown",
        },
      })
    );
  };

  return (
    <section id="eod-exchange-section" className={outerClass}>
      <div className={innerClass}>
        <ExchangeHeader
          title={t("eod_markets_title", "Global FX Markets")}
          subtitle={t(
            "eod_markets_subtitle",
            "170+ currencies with fully custom pairs on every ISO currency"
          )}
        />

        <SearchAndAddBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          showAddPair={showAddPair}
          onToggleAddPair={() => setShowAddPair((v) => !v)}
          addLabel={{
            open: t("add_pair", "Add pair"),
            close: t("close", "Close"),
          }}
          searchPlaceholder={t(
            "search_pairs",
            "Search currency pairs..."
          )}
        />

        {showAddPair && (
          <div className="mb-4 rounded-lg border border-subtle bg-elevated p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {t("add_custom_pair", "Add custom EOD pair")}
                </h3>
                <p className="text-xs text-white/50">
                  {t(
                    "add_custom_pair_hint",
                    "Select the base and quote currencies to add an EOD-only pair."
                  )}
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
                <FxPairSelector
                  value={selectedPair}
                  onChange={setSelectedPair}
                  layout="compact"
                />
                <button
                  onClick={onAddCustomPair}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#0f7fe1]/20 hover:bg-[#0f7fe1]/30 text-[#0f7fe1] border border-[#0f7fe1]/40 transition-all duration-200 hover:scale-105"
                >
                  {t("add", "Add")}
                </button>
              </div>
            </div>
          </div>
        )}

        <PairsTableDesktop
          pairs={filteredPairs}
          eodData={eodData}
          loadingPairs={loadingPairs}
          flashStates={flashStates}
          isCustomPair={isCustomPair}
          onRemoveCustomPair={handleRemoveCustomPair}
          onTradeAction={handleTradeAction}
          t={t}
        />

        <PairsListMobile
          pairs={filteredPairs}
          eodData={eodData}
          loadingPairs={loadingPairs}
          flashStates={flashStates}
          isCustomPair={isCustomPair}
          onRemoveCustomPair={handleRemoveCustomPair}
          onTradeAction={handleTradeAction}
          t={t}
        />
        {variant === "embedded" && (
          <div className="md:hidden absolute inset-y-0 right-0 w-6 bg-transparent z-20 pointer-events-auto" />
        )}
      </div>
    </section>
  );
}
