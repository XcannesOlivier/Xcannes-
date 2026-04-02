"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useModalTransition } from "@/hooks/useModalTransition";
import { greenActionBtnBase } from "./walletModalTokens";

const DEFAULT_RLUSD = { ticker: "rlusd", network: "xrpl" };
const PRIORITY_TICKERS = ["usdc", "usdt", "dai", "usdp", "tusd", "fdusd", "pyusd"];
const SWAP_DIRECTIONS = {
  RLUSD_TO_STABLE: "rlusd_to_stable",
  STABLE_TO_RLUSD: "stable_to_rlusd",
};
const MAX_STABLE_SEARCH_RESULTS = 200;
const QUICK_STABLE_TARGETS = [
  { ticker: "usdt", networkAliases: ["tron", "trx", "trc20"], label: "USDT (TRON)" },
  { ticker: "usdt", networkAliases: ["eth", "ethereum", "erc20"], label: "USDT (ETH)" },
  { ticker: "usdt", networkAliases: ["bsc", "bnb", "bep20"], label: "USDT (BSC)" },
  { ticker: "usdc", networkAliases: ["eth", "ethereum", "erc20"], label: "USDC (ETH)" },
  { ticker: "usdc", networkAliases: ["sol", "solana"], label: "USDC (SOL)" },
  { ticker: "usdc", networkAliases: ["arbitrum", "arb"], label: "USDC (ARBITRUM)" },
  { ticker: "usdc", networkAliases: ["base"], label: "USDC (BASE)" },
  { ticker: "usdc", networkAliases: ["polygon", "matic"], label: "USDC (POLYGON)" },
  { ticker: "usdc", networkAliases: ["optimism", "op"], label: "USDC (OPTIMISM)" },
  { ticker: "dai", networkAliases: ["eth", "ethereum", "erc20"], label: "DAI (ETH)" },
  { ticker: "fdusd", networkAliases: ["bsc", "bnb", "bep20"], label: "FDUSD (BSC)" },
  { ticker: "usdp", networkAliases: ["eth", "ethereum", "erc20"], label: "USDP (ETH)" },
  { ticker: "pyusd", networkAliases: ["eth", "ethereum", "erc20"], label: "PYUSD (ETH)" },
];

function pick(obj, keys, fallback = "") {
  for (const key of keys) {
    const value = obj?.[key];
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return fallback;
}

function currencyKey(cur) {
  const ticker = String(cur?.ticker || "").trim().toLowerCase();
  const network = String(cur?.network || "").trim().toLowerCase();
  if (!ticker || !network) return "";
  return `${ticker}:${network}`;
}

function currencyLabel(cur) {
  const ticker = String(cur?.ticker || "").trim().toUpperCase();
  const network = String(cur?.network || "").trim().toUpperCase();
  const name = String(cur?.name || "").trim();
  if (name) return `${ticker} (${network}) — ${name}`;
  return `${ticker} (${network})`;
}

function matchStableTarget(currency, { ticker, networkAliases }) {
  const curTicker = String(currency?.ticker || "").trim().toLowerCase();
  const curNetwork = String(currency?.network || "").trim().toLowerCase();
  if (!curTicker || !curNetwork) return false;
  if (curTicker !== String(ticker || "").trim().toLowerCase()) return false;
  return (networkAliases || []).includes(curNetwork);
}

function renderCurrencyIcon(currency) {
  const url = String(currency?.image || "").trim();
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="w-6 h-6 rounded-full bg-white/10 ring-1 ring-white/10 object-cover flex-shrink-0"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

export default function WalletDashboardUsdSwapModal({
  open,
  onClose,
  walletLabel = "",
  walletAddress = "",
  initialDirection = SWAP_DIRECTIONS.RLUSD_TO_STABLE,
  noticeVariant = "preview",
  inline = false,
}) {
  const { t } = useTranslation("common");
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  const [step, setStep] = useState("form"); // form | confirm | pending | instructions
  const [direction, setDirection] = useState(SWAP_DIRECTIONS.RLUSD_TO_STABLE);
  const [rlusdCurrency, setRlusdCurrency] = useState(DEFAULT_RLUSD);
  const [currencies, setCurrencies] = useState([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const [currenciesError, setCurrenciesError] = useState("");
  const [search, setSearch] = useState("");
  const [stableKey, setStableKey] = useState("");
  const [stableDropdownOpen, setStableDropdownOpen] = useState(false);
  const stableDropdownRef = useRef(null);
  const [amount, setAmount] = useState("");
  const [receiveAddress, setReceiveAddress] = useState("");
  const [receiveExtraId, setReceiveExtraId] = useState("");
  const [refundAddress, setRefundAddress] = useState("");
  const [refundExtraId, setRefundExtraId] = useState("");
  const [quote, setQuote] = useState(null);
  const [ranges, setRanges] = useState(null);
  const [apiError, setApiError] = useState("");
  const [exchange, setExchange] = useState(null);
  const [exchangeRefreshing, setExchangeRefreshing] = useState(false);

  const parsedAmount = useMemo(
    () => Number(String(amount || "").trim().replace(",", ".")),
    [amount],
  );
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const rlusdKey = currencyKey(rlusdCurrency);
  const stableCurrency = useMemo(() => {
    if (!stableKey) return null;
    return currencies.find((c) => currencyKey(c) === stableKey) || null;
  }, [currencies, stableKey]);
  const fromCurrency =
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? rlusdCurrency : stableCurrency;
  const toCurrency =
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? stableCurrency : rlusdCurrency;
  const toLabel = toCurrency ? currencyLabel(toCurrency) : "";
  const fromTicker = String(fromCurrency?.ticker || "").trim().toUpperCase();
  const fromNetwork = String(fromCurrency?.network || "").trim().toUpperCase();

  const quickStableOptions = useMemo(() => {
    if (!currencies.length) return [];
    return QUICK_STABLE_TARGETS.map((target) => {
      const match =
        currencies.find((cur) => matchStableTarget(cur, target)) || null;
      if (!match) return null;
      return {
        key: currencyKey(match),
        label: target.label,
        currency: match,
      };
    }).filter(Boolean);
  }, [currencies]);

  const filteredStableOptions = useMemo(() => {
    const needle = String(search || "").trim().toLowerCase();
    const list = currencies
      .filter((c) => {
        const key = currencyKey(c);
        if (!key) return false;
        if (key === rlusdKey) return false;
        if (!needle) return true;
        const hay = `${c.ticker || ""} ${c.network || ""} ${c.name || ""}`.toLowerCase();
        return hay.includes(needle);
      })
      .slice();

    list.sort((a, b) => {
      const aTicker = String(a?.ticker || "").toLowerCase();
      const bTicker = String(b?.ticker || "").toLowerCase();
      const aIdx = PRIORITY_TICKERS.indexOf(aTicker);
      const bIdx = PRIORITY_TICKERS.indexOf(bTicker);
      const ap = aIdx === -1 ? 999 : aIdx;
      const bp = bIdx === -1 ? 999 : bIdx;
      if (ap !== bp) return ap - bp;
      if (aTicker !== bTicker) return aTicker.localeCompare(bTicker);
      return String(a?.network || "").localeCompare(String(b?.network || ""));
    });

    return list;
  }, [currencies, rlusdKey, search]);

  const stableSearchResults = useMemo(
    () => filteredStableOptions.slice(0, MAX_STABLE_SEARCH_RESULTS),
    [filteredStableOptions],
  );

  const exchangeId = useMemo(
    () => pick(exchange, ["id", "exchangeId", "publicId"], ""),
    [exchange],
  );
  const depositAddress = useMemo(
    () => pick(exchange, ["addressFrom", "address_from", "depositAddress"], ""),
    [exchange],
  );
  const depositExtraId = useMemo(
    () => pick(exchange, ["extraIdFrom", "extra_id_from", "depositExtraId"], ""),
    [exchange],
  );
  const sendAmountExact = useMemo(
    () => pick(exchange, ["amountFrom", "amount_from", "amount", "amountSend"], ""),
    [exchange],
  );
  const status = useMemo(
    () => pick(exchange, ["status", "state"], ""),
    [exchange],
  );

  const resetState = () => {
    setStep("form");
    setSearch("");
    setStableDropdownOpen(false);
    setStableKey("");
    setAmount("");
    setReceiveAddress("");
    setReceiveExtraId("");
    setRefundAddress("");
    setRefundExtraId("");
    setQuote(null);
    setRanges(null);
    setApiError("");
    setExchange(null);
    setCurrenciesError("");
  };

  useEffect(() => {
    if (!open) return;
    const allowed = Object.values(SWAP_DIRECTIONS);
    const nextDirection = allowed.includes(initialDirection)
      ? initialDirection
      : SWAP_DIRECTIONS.RLUSD_TO_STABLE;
    setDirection(nextDirection);
    resetState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDirection]);

  useEffect(() => {
    if (!stableDropdownOpen) return;
    const handlePointerDown = (event) => {
      const el = stableDropdownRef.current;
      if (!el) {
        setStableDropdownOpen(false);
        return;
      }
      if (el.contains(event.target)) return;
      setStableDropdownOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setStableDropdownOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [stableDropdownOpen]);

  const fetchCurrencies = async () => {
    setCurrenciesLoading(true);
    setCurrenciesError("");
    try {
      const response = await fetch("/api/simpleswap/currencies");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
      }
      const list = Array.isArray(data?.currencies) ? data.currencies : [];
      setCurrencies(list);

      const rlusd = data?.rlusd || DEFAULT_RLUSD;
      const nextRlusd = {
        ticker: String(rlusd?.ticker || DEFAULT_RLUSD.ticker).toLowerCase(),
        network: String(rlusd?.network || DEFAULT_RLUSD.network).toLowerCase(),
      };
      setRlusdCurrency(nextRlusd);

      // Default stable selection: pick the most-used pairs first (USDT TRON, then USDT/USDC major networks).
      const byTicker = (ticker) =>
        list.filter(
          (c) =>
            String(c?.ticker || "").toLowerCase() === ticker &&
            currencyKey(c) !== currencyKey(nextRlusd),
        );
      const pickPreferred = (items) => {
        if (!items.length) return null;
        const eth = items.find((c) => String(c?.network || "").toLowerCase() === "eth");
        return eth || items[0];
      };

      const preferredQuick =
        QUICK_STABLE_TARGETS.map((target) => list.find((cur) => matchStableTarget(cur, target)))
          .find(Boolean) || null;
      const preferred =
        preferredQuick ||
        pickPreferred(byTicker("usdt")) ||
        pickPreferred(byTicker("usdc")) ||
        list.find((cur) => currencyKey(cur) !== currencyKey(nextRlusd)) ||
        null;
      const preferredKey = preferred ? currencyKey(preferred) : "";
      if (preferredKey) {
        setStableKey((prev) => {
          if (prev && list.some((cur) => currencyKey(cur) === prev)) return prev;
          return preferredKey;
        });
      }
    } catch (error) {
      setCurrenciesError(error?.message || "Impossible de charger les devises SimpleSwap.");
      setCurrencies([]);
    } finally {
      setCurrenciesLoading(false);
    }
  };

  const fetchQuoteAndRanges = async () => {
    if (!fromCurrency || !toCurrency || !hasValidAmount) return;
    setApiError("");
    setQuote(null);
    setRanges(null);

    const params = new URLSearchParams({
      fixed: "false",
      reverse: "false",
      tickerFrom: String(fromCurrency.ticker || ""),
      networkFrom: String(fromCurrency.network || ""),
      tickerTo: String(toCurrency.ticker || ""),
      networkTo: String(toCurrency.network || ""),
      amount: String(parsedAmount),
    });

    try {
      const [estimateRes, rangesRes] = await Promise.allSettled([
        fetch(`/api/simpleswap/estimates?${params.toString()}`),
        fetch(
          `/api/simpleswap/ranges?${new URLSearchParams({
            fixed: "false",
            reverse: "false",
            tickerFrom: String(fromCurrency.ticker || ""),
            networkFrom: String(fromCurrency.network || ""),
            tickerTo: String(toCurrency.ticker || ""),
            networkTo: String(toCurrency.network || ""),
          }).toString()}`,
        ),
      ]);

      if (estimateRes.status === "fulfilled") {
        const json = await estimateRes.value.json();
        if (estimateRes.value.ok) setQuote(json);
      }

      if (rangesRes.status === "fulfilled") {
        const json = await rangesRes.value.json();
        if (rangesRes.value.ok) setRanges(json);
      }
    } catch (error) {
      setApiError(error?.message || "Impossible de récupérer une estimation.");
    }
  };

  const createExchange = async () => {
    if (!fromCurrency || !toCurrency || !hasValidAmount) return;
    const defaultReceive = direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? walletAddress : "";
    const addr = String(receiveAddress || defaultReceive || "").trim();
    if (!addr) {
      setApiError(t("ui_usd_swap_missing_receive_addr", "Adresse de réception requise."));
      return;
    }

    setApiError("");
    setStep("pending");
    try {
      const refund =
        direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
          ? String(walletAddress || "").trim()
          : String(refundAddress || "").trim();
      const refundExtra =
        direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
          ? ""
          : String(refundExtraId || "").trim();
      const response = await fetch("/api/simpleswap/create-exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixed: false,
          reverse: false,
          tickerFrom: String(fromCurrency.ticker || ""),
          networkFrom: String(fromCurrency.network || ""),
          tickerTo: String(toCurrency.ticker || ""),
          networkTo: String(toCurrency.network || ""),
          amount: String(parsedAmount),
          addressTo: addr,
          extraIdTo: toCurrency?.hasExtraId ? String(receiveExtraId || "").trim() : "",
          userRefundAddress: refund,
          userRefundExtraId: refundExtra,
          rateId: null,
          customFee: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
      }
      setExchange(data);
      setStep("instructions");
    } catch (error) {
      setApiError(error?.message || "Impossible de créer l’échange.");
      setStep("confirm");
    }
  };

  const refreshExchange = async () => {
    if (!exchangeId) return;
    setExchangeRefreshing(true);
    setApiError("");
    try {
      const response = await fetch(
        `/api/simpleswap/exchange?id=${encodeURIComponent(exchangeId)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
      }
      setExchange(data);
    } catch (error) {
      setApiError(error?.message || "Impossible de rafraîchir le statut.");
    } finally {
      setExchangeRefreshing(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchCurrencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (direction !== SWAP_DIRECTIONS.STABLE_TO_RLUSD) return;
    if (String(receiveAddress || "").trim()) return;
    if (!String(walletAddress || "").trim()) return;
    setReceiveAddress(String(walletAddress).trim());
  }, [direction, open, receiveAddress, walletAddress]);

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-convert-modal border-white/10 md:border overflow-hidden flex flex-col min-h-0 pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-screen md:h-auto md:max-w-lg md:max-h-[100vh] rounded-none md:rounded-2xl",
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const content = (
    <>
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={() => {
            resetState();
            onClose?.();
          }}
        />
      ) : null}

      <div className={wrapperClass}>
        <div
          className={panelClass}
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}
        >
          <div className="border-b border-white/10">
            <div className="flex items-start justify-between p-4 gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-white font-semibold text-base md:text-lg leading-tight">
                    {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
                      ? t("ui_swap_title_out", "RLUSD → stablecoin USD")
                      : t("ui_swap_title_in", "Stablecoin USD → RLUSD")}
                  </h3>
                  {noticeVariant === "demo" ? (
                    <span className="inline-flex items-center text-white/80 text-xs md:text-sm font-semibold px-2 py-1 leading-none">
                      {t("demo_notice_title", "Mode démo")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs md:text-sm text-white/60">
                  {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
                    ? t(
                        "ui_swap_subtitle_out",
                        "Recevez un stablecoin USD (multi-chain) sur une autre adresse via SimpleSwap.",
                      )
                    : t(
                        "ui_swap_subtitle_in",
                        "Envoyez un stablecoin USD depuis un wallet externe et recevez du RLUSD sur XRPL via SimpleSwap.",
                      )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetState();
                  onClose?.();
                }}
                className="wallet-modal-close md:absolute md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5">
            {step === "instructions" ? (
              <div className="space-y-5">
                <div className="flex flex-col items-center justify-center pt-2 text-center">
                  <CheckCircleIcon className="w-14 h-14 text-xcannes-green mb-3" />
                  <div className="text-white font-semibold text-lg">
                    {t("ui_usd_swap_created_title", "Échange créé")}
                  </div>
	                  <div className="mt-2 text-sm text-white/60 max-w-sm">
	                    {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
	                      ? t(
	                          "ui_usd_swap_created_body_from_wallet",
	                          "Envoyez le montant indiqué depuis votre wallet XCANNES à l’adresse de dépôt pour lancer l’échange.",
	                        )
	                      : t(
	                          "ui_usd_swap_created_body_external",
	                          "Envoyez le montant indiqué depuis votre wallet externe à l’adresse de dépôt pour lancer l’échange.",
	                        )}
	                  </div>
	                </div>

                {apiError ? (
                  <div className="rounded-lg ring-1 ring-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                    {apiError}
                  </div>
                ) : null}

                <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-black/20">
	                  <p className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
	                    {t("ui_usd_swap_deposit", "Dépôt")}{" "}
                      <span className="text-white/70">{fromTicker || "—"}</span>
	                  </p>
                  <div className="space-y-2 text-sm text-white/80">
                    {exchangeId ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white/60 text-xs">
                            {t("ui_usd_swap_exchange_id", "ID")}
                          </div>
                          <div className="font-mono break-all">{exchangeId}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigator?.clipboard?.writeText(exchangeId).catch(() => {})
                          }
                          className="shrink-0 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold px-3 py-2"
                        >
                          {t("ui_copy", "Copier")}
                        </button>
                      </div>
                    ) : null}

                    {depositAddress ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white/60 text-xs">
                            {t("ui_usd_swap_deposit_address", "Adresse de dépôt")}
                          </div>
                          <div className="font-mono break-all">{depositAddress}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigator?.clipboard?.writeText(depositAddress).catch(() => {})
                          }
                          className="shrink-0 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold px-3 py-2"
                        >
                          {t("ui_copy", "Copier")}
                        </button>
                      </div>
                    ) : null}

                    {depositExtraId ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white/60 text-xs">
                            {t("ui_usd_swap_deposit_tag", "Tag / Memo")}
                          </div>
                          <div className="font-mono break-all">{depositExtraId}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigator?.clipboard?.writeText(depositExtraId).catch(() => {})
                          }
                          className="shrink-0 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold px-3 py-2"
                        >
                          {t("ui_copy", "Copier")}
                        </button>
                      </div>
                    ) : null}

	                    {sendAmountExact ? (
	                      <div>
	                        <div className="text-white/60 text-xs">
	                          {t("ui_usd_swap_exact_amount", "Montant à envoyer")}
	                        </div>
	                        <div className="text-white font-semibold">
	                          {sendAmountExact} {fromTicker || ""}
	                        </div>
	                      </div>
	                    ) : null}

                    {status ? (
                      <div>
                        <div className="text-white/60 text-xs">
                          {t("ui_usd_swap_status", "Statut")}
                        </div>
                        <div className="text-white font-semibold">{status}</div>
                      </div>
                    ) : null}
                  </div>
                </div>

	                <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
	                  {t(
	                    "ui_usd_swap_warning",
	                    `Attention : envoyez uniquement ${fromTicker || "l'actif sélectionné"} (${fromNetwork || "réseau sélectionné"}). Envoyer un autre actif ou oublier un Tag/Memo peut entraîner une perte.`,
	                  )}
	                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={refreshExchange}
                    disabled={!exchangeId || exchangeRefreshing}
                    className="flex-1 rounded-lg border border-white/10 bg-black/20 text-white/80 font-semibold py-3 transition-colors hover:bg-black/30 hover:text-white disabled:opacity-50"
                  >
                    {exchangeRefreshing
                      ? t("ui_refreshing", "Rafraîchit…")
                      : t("ui_refresh", "Rafraîchir")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetState();
                      onClose?.();
                    }}
                    className={`flex-1 py-3 ${greenActionBtnBase}`}
                  >
                    {t("ui_close_08378568ba", "Fermer")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
	                <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
	                  <p className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
	                    {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
	                      ? t("moonpay_from_account", "Depuis le compte")
	                      : t("ui_from_external_wallet", "Depuis un wallet externe")}
	                  </p>
	                  {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? (
	                    <>
	                      {String(walletLabel || "").trim() ? (
	                        <div className="flex items-center gap-2 mb-1">
	                          <span
	                            className="h-1.5 w-1.5 rounded-full bg-xcannes-green/80 shrink-0"
	                            aria-hidden
	                          />
	                          <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
	                            {walletLabel}
	                          </p>
	                        </div>
	                      ) : null}
	                      {String(walletAddress || "").trim() ? (
	                        <p className="text-[10px] md:text-[11px] text-white/60 font-mono break-all">
	                          {walletAddress}
	                        </p>
	                      ) : null}
	                    </>
	                  ) : (
	                    <p className="text-[11px] md:text-xs text-white/70">
	                      {t(
	                        "ui_external_wallet_hint",
	                        "Vous initierez l’envoi depuis un wallet compatible avec le réseau choisi.",
	                      )}
	                    </p>
	                  )}
	                </div>

                {step === "pending" ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xcannes-green mb-4" />
                    <p className="text-white/80">
                      {t("ui_usd_swap_pending", "Création de l’échange…")}
                    </p>
                  </div>
                ) : null}

                {currenciesLoading ? (
                  <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
                    {t("ui_usd_swap_loading_currencies", "Chargement des devises SimpleSwap…")}
                  </div>
                ) : null}

                {currenciesError ? (
                  <div className="rounded-lg ring-1 ring-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                    {currenciesError}
                  </div>
                ) : null}

                {apiError ? (
                  <div className="rounded-lg ring-1 ring-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                    {apiError}
                  </div>
                ) : null}

                {step === "form" ? (
                  <>
                    <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
                      {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
                        ? t(
                            "ui_swap_send_from_wallet",
                            "Vous enverrez du RLUSD depuis votre wallet XCANNES.",
                          )
                        : t(
                            "ui_swap_send_from_external",
                            "Vous enverrez le stablecoin depuis un wallet externe (Metamask, Exchange, etc.).",
                          )}
                    </div>

                    <div>
                      <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                        {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
                          ? t("ui_usd_swap_receive_in", "Recevoir (ticker / réseau)")
                          : t("ui_usd_swap_send_in", "Envoyer (ticker / réseau)")}
                      </label>
	                      <div className="space-y-2">
                        <div className="relative space-y-2" ref={stableDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setStableDropdownOpen((prev) => !prev)}
                            aria-expanded={stableDropdownOpen}
                            className="w-full rounded-xl px-4 py-3 ring-1 ring-white/10 ring-inset bg-black/20 text-white/80 hover:bg-black/30 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              {stableCurrency ? (
                                renderCurrencyIcon(stableCurrency)
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-white/10 ring-1 ring-white/10 flex-shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold truncate">
                                  {stableCurrency
                                    ? `${String(stableCurrency?.ticker || "").toUpperCase()} (${String(
                                        stableCurrency?.network || "",
                                      ).toUpperCase()})`
                                    : t("ui_choose_stable", "Choisir un stablecoin USD")}
                                </div>
                                <div className="mt-0.5 text-[11px] text-white/55 truncate">
                                  {stableCurrency
                                    ? String(stableCurrency?.name || "").trim() ||
                                      currencyLabel(stableCurrency)
                                    : t(
                                        "ui_choose_stable_hint",
                                        "Stablecoins USD multi-chain (USDT, USDC…)",
                                      )}
                                </div>
                              </div>
                              <svg
                                className={[
                                  "w-4 h-4 flex-shrink-0 transition-transform",
                                  stableDropdownOpen ? "rotate-180" : "",
                                ].join(" ")}
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          </button>

                          {stableDropdownOpen ? (
                            <div className="absolute left-0 right-0 mt-2 rounded-xl ring-1 ring-white/10 ring-inset bg-black/30 backdrop-blur-md overflow-hidden z-20">
                              <div className="p-3 border-b border-white/10 bg-black/20">
                                <input
                                  value={search}
                                  onChange={(e) => setSearch(e.target.value)}
                                  placeholder={t("ui_search", "Rechercher…")}
                                  autoFocus
                                  className="w-full px-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
                                />
                              </div>

                              <div className="max-h-64 overflow-y-auto">
                                {quickStableOptions.length ? (
                                  <div className="px-3 py-3 border-b border-white/10">
                                    <div className="text-[10px] tracking-[0.22em] uppercase text-white/45">
                                      {t("ui_popular", "Populaires")}
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                      {quickStableOptions.slice(0, 13).map((opt) => {
                                        const active = opt.key === stableKey;
                                        return (
                                          <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => {
                                              setStableKey(opt.key);
                                              setStableDropdownOpen(false);
                                              setSearch("");
                                            }}
                                            className={[
                                              "rounded-xl px-3 py-3 ring-1 ring-inset transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] text-left",
                                              active
                                                ? "bg-xcannes-green/10 ring-xcannes-green/35 text-white"
                                                : "bg-black/20 ring-white/10 text-white/70 hover:bg-black/30 hover:text-white/90 hover:ring-white/15",
                                            ].join(" ")}
                                          >
                                            <div className="flex items-center gap-2">
                                              {renderCurrencyIcon(opt.currency)}
                                              <div className="min-w-0">
                                                <div className="text-sm font-semibold truncate">
                                                  {opt.label}
                                                </div>
                                                <div className="mt-0.5 text-[11px] text-white/55 truncate">
                                                  {String(opt.currency?.name || "").trim() ||
                                                    currencyLabel(opt.currency)}
                                                </div>
                                              </div>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}
                                {stableSearchResults.length ? (
                                  stableSearchResults.map((cur) => {
                                    const key = currencyKey(cur);
                                    const active = key === stableKey;
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                          setStableKey(key);
                                          setStableDropdownOpen(false);
                                          setSearch("");
                                        }}
                                        className={[
                                          "w-full flex items-center gap-3 px-3 py-2 text-left border-b border-white/5 last:border-b-0",
                                          active
                                            ? "bg-xcannes-green/10 text-white"
                                            : "hover:bg-white/[0.04] text-white/80",
                                        ].join(" ")}
                                      >
                                        {renderCurrencyIcon(cur)}
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-semibold truncate">
                                            {String(cur?.ticker || "").toUpperCase()}{" "}
                                            <span className="text-white/50 font-normal">
                                              ({String(cur?.network || "").toUpperCase()})
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-white/55 truncate">
                                            {String(cur?.name || "").trim() || currencyLabel(cur)}
                                          </div>
                                        </div>
                                        {active ? (
                                          <span className="text-xcannes-green font-semibold text-xs">
                                            ✓
                                          </span>
                                        ) : null}
                                      </button>
                                    );
                                  })
                                ) : (
                                  <div className="px-4 py-6 text-sm text-white/60">
                                    {t("ui_no_results", "Aucun résultat.")}
                                  </div>
                                )}
                              </div>
                              <div className="px-3 py-2 text-[11px] text-white/55 bg-white/[0.02] border-t border-white/5">
                                {filteredStableOptions.length > MAX_STABLE_SEARCH_RESULTS
                                  ? t(
                                      "ui_search_limit",
                                      `Résultats limités à ${MAX_STABLE_SEARCH_RESULTS}. Affinez votre recherche.`,
                                    )
                                  : t("ui_search_results", "Sélectionnez un actif.")}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        {toCurrency?.hasExtraId ? (
                          <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
                            {t(
                              "ui_usd_swap_extraid_notice",
                              "Cette devise peut nécessiter un Tag/Memo (extraId) pour la réception.",
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                        {t("ui_swap_amount_send", "Montant à envoyer")}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder={direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? "25" : "100"}
                          step="0.01"
                          min="0"
                          className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 pr-16 transition-all duration-150"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                          {fromTicker || "—"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
                      {t(
                        "ui_usd_swap_explain",
                        "Un swap entre stablecoins USD vise généralement une valeur 1:1. Des frais et délais peuvent s’appliquer selon le partenaire.",
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                        {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
                          ? t("ui_usd_swap_receive_address", "Adresse de réception")
                          : t("ui_usd_swap_receive_address_rlusd", "Adresse de réception (RLUSD / XRPL)")}
                      </label>
                      <input
                        value={receiveAddress}
                        onChange={(e) => setReceiveAddress(e.target.value)}
                        placeholder={t(
                          "ui_usd_swap_receive_address_placeholder",
                          direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                            ? "Adresse XRPL (ex: r…)"
                            : "Adresse sur le réseau choisi (ex: 0x… / T…)",
                        )}
                        className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
                      />
                      {direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? (
                        <div className="mt-2 rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
                          {t(
                            "ui_swap_receive_rlusd_hint",
                            "Par défaut, vous recevez le RLUSD sur votre adresse wallet. Vous pouvez la remplacer si besoin.",
                          )}
                        </div>
                      ) : null}
                      {toCurrency?.hasExtraId ? (
                        <div className="mt-2">
                          <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                            {t("ui_usd_swap_receive_extraid", "Tag / Memo (extraId)")}
                          </label>
                          <input
                            value={receiveExtraId}
                            onChange={(e) => setReceiveExtraId(e.target.value)}
                            placeholder={toCurrency?.extraIdName || "Memo / Tag"}
                            className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
                          />
                        </div>
                      ) : null}
                    </div>

                    {direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? (
                      <div>
                        <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                          {t("ui_swap_refund_address", "Adresse de remboursement (optionnel)")}
                        </label>
                        <input
                          value={refundAddress}
                          onChange={(e) => setRefundAddress(e.target.value)}
                          placeholder={t(
                            "ui_swap_refund_address_placeholder",
                            "Adresse sur le réseau d’envoi (si l’échange échoue)",
                          )}
                          className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
                        />
                        {fromCurrency?.hasExtraId ? (
                          <div className="mt-2">
                            <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                              {t("ui_swap_refund_extraid", "Tag / Memo de remboursement (optionnel)")}
                            </label>
                            <input
                              value={refundExtraId}
                              onChange={(e) => setRefundExtraId(e.target.value)}
                              placeholder={fromCurrency?.extraIdName || "Memo / Tag"}
                              className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      disabled={
                        !hasValidAmount ||
                        !fromCurrency ||
                        !toCurrency ||
                        !stableCurrency ||
                        !String(
                          receiveAddress ||
                            (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                              ? walletAddress
                              : "") ||
                            "",
                        ).trim()
                      }
                      onClick={async () => {
                        const addr = String(
                          receiveAddress ||
                            (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                              ? walletAddress
                              : "") ||
                            "",
                        ).trim();
                        if (!addr) {
                          setApiError(
                            t(
                              "ui_usd_swap_missing_receive_addr",
                              "Adresse de réception requise.",
                            ),
                          );
                          return;
                        }
                        await fetchQuoteAndRanges();
                        setStep("confirm");
                      }}
                      className={`w-full text-xl py-4 ${greenActionBtnBase}`}
                    >
                      {t("ui_action_continue", "Continuer")}
                    </button>
                  </>
                ) : null}

                {step === "confirm" ? (
                  <>
                    <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-black/20">
                      <p className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                        {t("ui_review", "Récapitulatif")}
                      </p>
                      <div className="text-white/80 text-sm">
                        <div>
                          {t("ui_swap_you_send", "Vous envoyez")}{" "}
                          <span className="text-white font-semibold">
                            {hasValidAmount ? parsedAmount : 0} {fromTicker || ""}
                          </span>
                        </div>
                        <div className="mt-1">
                          {t("ui_usd_swap_you_receive", "Vous recevez")}{" "}
                          <span className="text-white font-semibold">
                            {toCurrency ? currencyLabel(toCurrency) : toLabel}
                          </span>
                        </div>
                        {String(
                          receiveAddress ||
                            (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                              ? walletAddress
                              : "") ||
                            "",
                        ).trim() ? (
                          <div className="mt-2 text-xs text-white/60 font-mono break-all">
                            {t("ui_usd_swap_receive_to", "Vers")}{" "}
                            {String(
                              receiveAddress ||
                                (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                                  ? walletAddress
                                  : "") ||
                                "",
                            ).trim()}
                          </div>
                        ) : null}
                        {quote ? (
                          <div className="mt-2 text-xs text-white/60">
                            {t("ui_usd_swap_estimate", "Estimation")}:{" "}
                            <span className="text-white/90 font-semibold">
                              {pick(quote, ["amount", "estimatedAmount", "estimate"], "—")}
                            </span>
                          </div>
                        ) : null}
                        {ranges ? (
                          <div className="mt-1 text-xs text-white/60">
                            {t("ui_usd_swap_limits", "Limites")}:{" "}
                            <span className="text-white/80">
                              {pick(ranges, ["min", "minAmount", "minimum"], "—")} –{" "}
                              {pick(ranges, ["max", "maxAmount", "maximum"], "—")}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep("form")}
                        className="flex-1 rounded-lg border border-white/10 bg-black/20 text-white/70 font-semibold py-3 transition-colors hover:bg-black/30 hover:text-white"
                      >
                        {t("ui_back", "Retour")}
                      </button>
                      <button
                        type="button"
                        onClick={createExchange}
                        className={`flex-1 py-3 ${greenActionBtnBase}`}
                      >
                        {t("ui_confirm", "Confirmer")}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
