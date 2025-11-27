"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import Header from "../components/Header";
import FooterPro from "../components/FooterPro";
import SEOHead from "../components/SEOHead";
import PriceTicker from "../components/PriceTicker";
import xcannesApi from "../lib/xcannesApi";

const API_BASE = (process.env.NEXT_PUBLIC_XCANNES_API_URL || "").replace(/\/$/, "");
const apiUrl = (path) => `${API_BASE}${path}`;

const DEFAULT_AMOUNT = 500;
const QUOTE_DEBOUNCE = 450;

const formatNumber = (value, options = {}) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 6, ...options }).format(value || 0);

export default function StableExchange() {
  const { t } = useTranslation("common");
  
  // 📊 Paires pour PriceTicker
  const [availablePairs, setAvailablePairs] = useState(["XRP/RLUSD", "XCS/XRP", "XCS/RLUSD"]);
  const [loadingPairs, setLoadingPairs] = useState(true);
  
  const [pairs, setPairs] = useState([]);
  const [selectedPairId, setSelectedPairId] = useState("");
  const [fromCurrency, setFromCurrency] = useState("");
  const [toCurrency, setToCurrency] = useState("");
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [rateBoard, setRateBoard] = useState([]);

  const selectedPair = useMemo(
    () => pairs.find((pair) => pair.id === selectedPairId) || null,
    [pairs, selectedPairId]
  );

  const loadPairs = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/stable-swap/pairs"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const availablePairs = data.pairs || [];
      setPairs(availablePairs);
      if (availablePairs.length > 0) {
        const first = availablePairs[0];
        setSelectedPairId(first.id);
        setFromCurrency(first.from.currency);
        setToCurrency(first.to.currency);
        setAmount(Math.max(first.minAmount || DEFAULT_AMOUNT, DEFAULT_AMOUNT));
      }
    } catch (error) {
      console.error("Failed to load stable pairs:", error);
    }
  }, []);

  useEffect(() => {
    loadPairs();
  }, [loadPairs]);

  // 📊 Charger les paires pour PriceTicker
  useEffect(() => {
    const fetchTickerPairs = async () => {
      try {
        const markets = await xcannesApi.getAllMarkets();
        if (markets) {
          const allPairs = [
            ...(markets.display || []),
            ...(markets.pyth || [])
          ];
          
          const pairsList = Array.from(new Set(
            allPairs
              .filter(m => m.active !== false)
              .map(m => `${m.base}/${m.quote}`)
          ));
          
          setAvailablePairs(pairsList);
          console.log(`✅ [StableExchange] ${pairsList.length} paires chargées pour ticker`);
        }
      } catch (error) {
        console.error("⚠️ [StableExchange] Erreur chargement paires:", error);
        setAvailablePairs(["XRP/RLUSD", "XCS/XRP", "XCS/RLUSD"]);
      } finally {
        setLoadingPairs(false);
      }
    };
    
    fetchTickerPairs();
  }, []);

  // Mémoriser les paires pour PriceTicker
  const tickerPairs = useMemo(() => availablePairs, [availablePairs]);

  const fetchQuote = useCallback(
    async (params) => {
      if (!params?.from || !params?.to || !params?.amount || !API_BASE) return;
      try {
        setLoadingQuote(true);
        setQuoteError(null);
        const searchParams = new URLSearchParams({
          from: params.from,
          to: params.to,
          amount: String(params.amount),
        });
        const res = await fetch(apiUrl(`/stable-swap/quote?${searchParams.toString()}`));
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setQuote(data);
        setRateBoard((prev) => {
          const others = prev.filter((item) => item.pairId !== data.pair?.id || item.direction !== data.pair?.direction);
          return [
            ...others,
            {
              pairId: data.pair?.id,
              direction: data.pair?.direction,
              label: selectedPair?.label || data.pair?.label,
              from: data.pair?.from?.currency,
              to: data.pair?.to?.currency,
              rate: data.rate,
              inverseRate: data.inverseRate,
              spreadPercent: data.spreadPercent,
              timestamp: data.timestamp,
              provider: selectedPair?.provider || data.pair?.provider || null,
              icon: selectedPair?.from?.icon || data.pair?.from?.icon || null,
            },
          ];
        });
      } catch (error) {
        console.error("Stable quote error:", error);
        setQuoteError(error.message);
      } finally {
        setLoadingQuote(false);
      }
    },
    [selectedPair]
  );

  useEffect(() => {
    if (!selectedPair) return;
    setFromCurrency(selectedPair.from.currency);
    setToCurrency(selectedPair.to.currency);
    setAmount((prev) => Math.max(prev, selectedPair.minAmount || DEFAULT_AMOUNT));
  }, [selectedPair]);

  useEffect(() => {
    if (!fromCurrency || !toCurrency || !selectedPairId) return;
    const validAmount = Number(amount);
    if (!Number.isFinite(validAmount) || validAmount <= 0) return;
    const handler = setTimeout(() => {
      fetchQuote({ from: fromCurrency, to: toCurrency, amount: validAmount });
    }, QUOTE_DEBOUNCE);
    return () => clearTimeout(handler);
  }, [fromCurrency, toCurrency, amount, selectedPairId, fetchQuote]);

  useEffect(() => {
    if (pairs.length === 0) return;
    const preload = async () => {
      for (const pair of pairs) {
        try {
          await fetchQuote({
            from: pair.from.currency,
            to: pair.to.currency,
            amount: pair.minAmount || DEFAULT_AMOUNT,
          });
        } catch (error) {
          console.warn("Unable to preload quote for pair", pair.id, error);
        }
      }
    };
    preload();
  }, [pairs, fetchQuote]);

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const minAmount = selectedPair?.minAmount ?? 0;
  const maxAmount = selectedPair?.maxAmount ?? 0;
  const fromIcon = selectedPair?.from?.icon || "💱";
  const toIcon = selectedPair?.to?.icon || "⚡";
  const providerLabel = selectedPair?.provider || "";
  const deskFeePercent = selectedPair?.feeBps != null ? selectedPair.feeBps / 100 : null;

  const isAmountOutAvailable = quote && Number.isFinite(quote.amountOutAfterFee);

  return (
    <>
      <SEOHead
        title={t("stable_exchange_title", "Stablecoin Lounge")}
        description={t(
          "stable_exchange_subtitle",
          "Convert your XRPL stablecoins instantly with transparent rates."
        )}
        canonical="/stable-exchange"
      />
      <Header />
      
      <PriceTicker pairs={tickerPairs} fixed={true} />

      <main className="relative w-full min-h-screen text-white pt-36 pb-16 bg-xcannes-background bg-cover bg-fixed font-montserrat">
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-white/10 bg-white/5 text-xs uppercase tracking-[0.3rem] text-white/60">
              Lounge
            </span>
            <h1 className="mt-4 text-4xl md:text-5xl font-orbitron font-bold tracking-tight">
              {t("stable_exchange_title", "Stablecoin Lounge")}
            </h1>
            <p className="mt-3 text-white/60 text-sm md:text-base max-w-3xl mx-auto">
              {t(
                "stable_exchange_subtitle",
                "Convert your XRPL stablecoins with transparent airport-style rates."
              )}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                <div className="flex flex-col gap-4">
                  {selectedPair && (
                    <div className="flex items-center justify-between text-white/50 text-xs uppercase tracking-[0.3rem]">
                      <span className="flex items-center gap-2 tracking-normal">
                        <span className="text-2xl">{fromIcon}</span>
                        <span className="text-white/50">
                          {providerLabel || t("stable_exchange_default_provider", "Desk liquidity")}
                        </span>
                      </span>
                      {deskFeePercent != null && (
                        <span className="text-white/40 tracking-[0.2rem]">
                          {t("stable_exchange_fee_rate", "Desk fee")} {deskFeePercent.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
                        {t("nav_stable_exchange", "Stable Exchange")}
                      </p>
                      <h2 className="text-xl font-orbitron font-semibold">
                        {selectedPair?.label || "Stable swap"}
                      </h2>
                    </div>
                    {pairs.length > 1 && (
                      <select
                        value={selectedPairId}
                        onChange={(event) => setSelectedPairId(event.target.value)}
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-xcannes-green transition-colors"
                      >
                        {pairs.map((pair) => (
                          <option key={pair.id} value={pair.id}>
                            {pair.from?.icon ? `${pair.from.icon} ${pair.label}` : pair.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-start">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <label className="text-xs uppercase tracking-widest text-white/40 block mb-2">
                        {t("stable_exchange_from_label", "You give")}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={minAmount || 0}
                          max={maxAmount || undefined}
                          step="0.01"
                          value={amount}
                          onChange={(event) => setAmount(Number(event.target.value))}
                          placeholder={t("stable_exchange_amount_placeholder", "Amount")}
                          className="flex-1 bg-transparent text-2xl font-orbitron focus:outline-none"
                        />
                        <div className="px-3 py-2 bg-white/10 rounded-lg text-sm font-semibold flex items-center gap-2">
                          <span className="text-lg">{fromIcon}</span>
                          <span>{fromCurrency || "..."}</span>
                        </div>
                      </div>
                      {selectedPair && (
                        <p className="text-xs text-white/30 mt-2">
                          {formatNumber(selectedPair.minAmount || 0)} min —{" "}
                          {formatNumber(selectedPair.maxAmount || 0)} max
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleSwap}
                      className="mx-auto mt-3 md:mt-8 bg-white/10 hover:bg-white/20 transition-colors border border-white/10 rounded-full px-4 py-2 text-sm font-medium"
                    >
                      {t("stable_exchange_swap_button", "Swap currencies")}
                    </button>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <label className="text-xs uppercase tracking-widest text-white/40 block mb-2">
                        {t("stable_exchange_to_label", "You receive")}
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-2xl font-orbitron text-white">
                          {loadingQuote
                            ? "..."
                            : isAmountOutAvailable
                            ? formatNumber(quote.amountOutAfterFee, { maximumFractionDigits: 6 })
                            : "—"}
                        </div>
                        <div className="px-3 py-2 bg-white/10 rounded-lg text-sm font-semibold flex items-center gap-2">
                          <span className="text-lg">{toIcon}</span>
                          <span>{toCurrency || "..."}</span>
                        </div>
                      </div>
                      {quote && (
                        <p className="text-xs text-white/30 mt-2">
                          {t("stable_exchange_fee_label", "Estimated fee")}:{" "}
                          {formatNumber(quote.fee, { maximumFractionDigits: 4 })}{" "}
                          {fromCurrency}
                        </p>
                      )}
                    </div>
                  </div>

                  {quoteError && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3">
                      {quoteError}
                    </div>
                  )}

                  {quote && (
                    <div className="grid sm:grid-cols-2 gap-4 text-sm bg-white/5 border border-white/10 rounded-xl p-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/40">
                          {t("stable_exchange_rate_label", "Live rate")}
                        </p>
                        <p className="text-lg font-semibold">
                          1 {fromCurrency} = {formatNumber(quote.rate, { maximumFractionDigits: 6 })}{" "}
                          {toCurrency}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/40">
                          {t("stable_exchange_mid_label", "Mid-market")}
                        </p>
                        <p className="text-lg font-semibold">
                          1 {toCurrency} ={" "}
                          {formatNumber(quote.inverseRate, { maximumFractionDigits: 6 })} {fromCurrency}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/40">
                          {t("stable_exchange_spread_label", "Spread")}
                        </p>
                        <p className="text-lg font-semibold">
                          {(quote.spreadPercent * 100 || 0).toFixed(4)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/40">
                          {t("stable_exchange_last_update", "Last updated")}
                        </p>
                        <p className="text-lg font-semibold">
                          {new Date(quote.timestamp || Date.now()).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <button
                      className="bg-xcannes-green text-black font-semibold px-6 py-3 rounded-lg hover:bg-xcannes-green/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={loadingQuote || !isAmountOutAvailable}
                    >
                      {t("stable_exchange_convert_button", "Convert now")}
                    </button>
                    <p className="text-xs text-white/40">
                      {t(
                        "stable_exchange_convert_hint",
                        "Connect your Xumm wallet from the header to execute immediately."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-[0.35rem] text-white/40 mb-3">
                  {t("stable_exchange_board_title", "Today’s reference rates")}
                </p>
                <div className="space-y-3">
                  {(rateBoard.length > 0 ? rateBoard : pairs.map((pair) => ({
                    pairId: pair.id,
                    label: pair.label,
                    from: pair.from.currency,
                    to: pair.to.currency,
                    rate: null,
                    inverseRate: null,
                    spreadPercent: null,
                    provider: pair.provider || null,
                    icon: pair.from?.icon || null,
                  }))).map((entry) => (
                    <div
                      key={`${entry.pairId}-${entry.from}-${entry.to}`}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {entry.icon || "💱"}
                          </span>
                          <div className="flex flex-col leading-tight">
                            <span className="font-semibold">
                              {entry.label || `${entry.from} → ${entry.to}`}
                            </span>
                            {entry.provider && (
                              <span className="text-white/40 text-[11px] uppercase tracking-[0.2rem]">
                                {entry.provider}
                              </span>
                            )}
                          </div>
                        </div>
                        {entry.timestamp && (
                          <span className="text-white/30 text-xs">
                            {t("stable_exchange_board_updated", "Updated")}{" "}
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between text-xs text-white/50">
                        <span>
                          {t("stable_exchange_rate_label", "Live rate")}:{" "}
                          {entry.rate ? formatNumber(entry.rate, { maximumFractionDigits: 6 }) : "—"}
                        </span>
                        <span>
                          {t("stable_exchange_spread_label", "Spread")}:{" "}
                          {entry.spreadPercent
                            ? `${(entry.spreadPercent * 100).toFixed(3)}%`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-white/60">
                <h3 className="text-sm uppercase tracking-[0.3rem] text-white/40 mb-3">
                  Lounge Tips
                </h3>
                <ul className="space-y-2 list-disc list-inside">
                  <li>
                    {t(
                      "stable_exchange_tip_limits",
                      "Amounts outside the min/max range require OTC desk approval."
                    )}
                  </li>
                  <li>
                    {t(
                      "stable_exchange_tip_refresh",
                      "Rates update automatically as liquidity changes."
                    )}
                  </li>
                  <li>
                    {t(
                      "stable_exchange_tip_xumm",
                      "Connect Xumm to sign the transaction in less than 3 seconds."
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      <FooterPro />
    </>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  };
}
