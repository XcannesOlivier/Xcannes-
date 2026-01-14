"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { useXumm } from "@/context/XummContext";
import { apiUrl } from "@/lib/runtimeConfig";
import { getPairCategory } from "@/utils/marketStructure";
import XummQRModal from "@/components/xumm/XummQRModal";
import TokenAmountInput from "@/components/ui/TokenAmountInput";

const SLIPPAGE_BPS = 100;
const SLIPPAGE_LABEL = "1%";

const STATUS_META = {
  pending_signature: { label: "Awaiting signature", className: "text-amber-200" },
  submitted: { label: "Submitted", className: "text-sky-200" },
  filled: { label: "Filled", className: "text-emerald-300" },
  failed: { label: "Failed", className: "text-red-300" },
  cancel_pending: { label: "Cancel pending", className: "text-amber-200" },
  cancel_submitted: { label: "Cancel submitted", className: "text-sky-200" },
  cancelled: { label: "Cancelled", className: "text-white/70" },
  cancel_failed: { label: "Cancel failed", className: "text-red-300" },
};

const normalizePairInput = (pair) => {
  const raw = String(pair || "").trim().toUpperCase();
  if (!raw) return "";
  const normalized = raw.includes("/") ? raw : raw.replace("_", "/");
  const [base, quote] = normalized.split("/");
  if (!base || !quote) return "";
  return `${base}/${quote}`;
};

const parseAmount = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumber = (value, options = {}) => {
  if (value == null) return "-";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
    ...options,
  });
};

const formatTime = (value) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const requestJson = async (path, { method = "GET", body } = {}) => {
  const res = await fetch(apiUrl(path), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || "Request failed");
  }
  return data;
};

export default function DexOrderTicket({
  pair,
  orderbookSide,
  initialSide,
  hideHeader = false,
}) {
  const { t } = useTranslation("common");
  const { wallet, isConnected, isConnecting, connect, balance } = useXumm();

  const normalizedPair = useMemo(() => normalizePairInput(pair), [pair]);
  const pairCategory = useMemo(
    () => getPairCategory(normalizedPair || pair),
    [normalizedPair, pair]
  );
  const isXRPL = pairCategory === "xrpl";

  const [base, quote] = useMemo(() => {
    if (!normalizedPair) return ["", ""];
    const [baseCode, quoteCode] = normalizedPair.split("/");
    return [baseCode, quoteCode];
  }, [normalizedPair]);

  const [side, setSide] = useState("buy");
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewState, setPreviewState] = useState({ status: "idle", error: null });
  const [orderError, setOrderError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

  const previewRequestId = useRef(0);

  useEffect(() => {
    if (!orderbookSide) return;
    setSide(orderbookSide === "bid" ? "sell" : "buy");
  }, [orderbookSide]);

  useEffect(() => {
    const normalizedInitial =
      initialSide === "sell" ? "sell" : initialSide === "buy" ? "buy" : "";
    const nextSide = normalizedInitial || "buy";
    setSide(nextSide);
    setAmount("");
    setPreview(null);
    setPreviewState({ status: "idle", error: null });
    setOrderError(null);
  }, [initialSide, normalizedPair]);

  const hasRlusdTrustline = useMemo(() => {
    const tokens = balance?.tokens || [];
    return tokens.some(
      (token) => String(token?.currency || "").toUpperCase() === "RLUSD"
    );
  }, [balance?.tokens]);

  const hasXcsTrustline = useMemo(() => {
    const tokens = balance?.tokens || [];
    return tokens.some(
      (token) => String(token?.currency || "").toUpperCase() === "XCS"
    );
  }, [balance?.tokens]);

  const trustlineMissing =
    isConnected && (!hasRlusdTrustline || (base === "XCS" && !hasXcsTrustline));

  const baseBalance = useMemo(() => {
    if (!balance) return null;
    if (base === "XRP") {
      const value = Number(balance.xrp);
      return Number.isFinite(value) ? Math.max(value, 0) : null;
    }
    if (base === "XCS") {
      const token = (balance.tokens || []).find(
        (entry) => String(entry?.currency || "").toUpperCase() === "XCS"
      );
      const value = Number(token?.value);
      return Number.isFinite(value) ? Math.max(value, 0) : null;
    }
    return null;
  }, [balance, base]);

  const maxSellAmount = side === "sell" && baseBalance ? baseBalance : null;

  const loadOrders = useCallback(
    async (refresh = true) => {
      if (!isConnected || !wallet || !normalizedPair) {
        setOrders([]);
        return;
      }
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        const query = new URLSearchParams({
          address: wallet,
          pair: normalizedPair,
          limit: "10",
          refresh: refresh ? "1" : "0",
        });
        const data = await requestJson(`/dex/orders?${query.toString()}`);
        setOrders(Array.isArray(data?.orders) ? data.orders : []);
      } catch (error) {
        setOrdersError(error?.message || "Failed to load orders");
      } finally {
        setOrdersLoading(false);
      }
    },
    [isConnected, wallet, normalizedPair]
  );

  useEffect(() => {
    loadOrders(true);
  }, [loadOrders]);

  useEffect(() => {
    if (!isXRPL || !normalizedPair) return;
    const parsedAmount = parseAmount(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setPreview(null);
      setPreviewState({ status: "idle", error: null });
      return;
    }

    const requestId = ++previewRequestId.current;
    setPreviewState({ status: "loading", error: null });

    const timer = window.setTimeout(async () => {
      try {
        const data = await requestJson("/dex/orders/preview", {
          method: "POST",
          body: {
            pair: normalizedPair,
            side,
            baseAmount: parsedAmount,
            slippageBps: SLIPPAGE_BPS,
          },
        });
        if (previewRequestId.current !== requestId) return;
        setPreview(data);
        setPreviewState({ status: "done", error: null });
      } catch (error) {
        if (previewRequestId.current !== requestId) return;
        setPreview(null);
        setPreviewState({
          status: "error",
          error: error?.message || "Preview unavailable",
        });
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [amount, side, normalizedPair, isXRPL]);

  const handleSubmit = async () => {
    setOrderError(null);
    const parsedAmount = parseAmount(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setOrderError(
        t("ui_invalid_amount_45a9c0c3df", "Enter a valid amount.")
      );
      return;
    }
    if (!wallet) {
      setOrderError(
        t("ui_wallet_required_trade_18f7e1d2a9", "Connect your wallet to trade.")
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await requestJson("/dex/orders", {
        method: "POST",
        body: {
          address: wallet,
          pair: normalizedPair,
          side,
          baseAmount: parsedAmount,
          slippageBps: SLIPPAGE_BPS,
          returnUrl: window.location.href,
        },
      });
      setModalData({
        mode: "create",
        orderId: data.orderId,
        uuid: data.uuid,
        qrUrl: data.qrUrl,
        deepLink: data.deepLink,
      });
      setAmount("");
      setPreview(null);
      loadOrders(false);
    } catch (error) {
      setOrderError(error?.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (order) => {
    if (!order?.orderId || !wallet) return;
    setOrderError(null);
    try {
      const data = await requestJson("/dex/orders/cancel", {
        method: "POST",
        body: {
          orderId: order.orderId,
          address: wallet,
          offerSequence: order.offerSequence,
          returnUrl: window.location.href,
        },
      });
      setModalData({
        mode: "cancel",
        orderId: data.orderId,
        uuid: data.uuid,
        qrUrl: data.qrUrl,
        deepLink: data.deepLink,
      });
    } catch (error) {
      setOrderError(error?.message || "Failed to cancel order");
    }
  };

  const handleModalSuccess = async () => {
    if (!modalData?.orderId || !modalData?.uuid) return;
    setIsConfirming(true);
    try {
      if (modalData.mode === "cancel") {
        await requestJson("/dex/orders/cancel/confirm", {
          method: "POST",
          body: { orderId: modalData.orderId, uuid: modalData.uuid },
        });
      } else {
        await requestJson("/dex/orders/confirm", {
          method: "POST",
          body: { orderId: modalData.orderId, uuid: modalData.uuid },
        });
      }
      loadOrders(true);
    } catch (error) {
      setOrderError(error?.message || "Failed to confirm order");
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isXRPL || !normalizedPair) return null;

  const previewQuote = preview?.quoteAmount;
  const previewAvg = preview?.avgPrice;
  const previewWorst = preview?.worstPrice;
  const previewFilled = preview?.filledBase;
  const previewUnfilled = preview?.unfilledBase;
  const previewLiquidityOk = preview?.liquidityOk;
  const quoteLabel =
    side === "buy"
      ? t("ui_estimated_cost_c402f5e15b", "Estimated cost")
      : t("ui_estimated_receive_0c5a3b7e9a", "Estimated receive");
  const showNoLiquidity = previewState.status === "done" && previewLiquidityOk === false;
  const showPartialFill =
    previewState.status === "done" && previewLiquidityOk && previewUnfilled > 0;

  const canSubmit =
    isConnected &&
    !isConnecting &&
    !trustlineMissing &&
    parseAmount(amount) &&
    previewState.status === "done" &&
    previewLiquidityOk &&
    !isSubmitting &&
    !isConfirming;

  return (
    <div className={hideHeader ? "" : "border-b border-subtle"}>
      {!hideHeader ? (
        <div className="panel-header">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-primary">
                {t("ui_market_order_ticket_7a4f5f2c1c", "Market order")}
              </h3>
              <p className="text-[11px] text-muted">
                {normalizedPair}
                {" · "}
                {"IOC"}
                {" · "}
                {t("ui_slippage_1pct_0fdafce1d0", "Slippage")} {SLIPPAGE_LABEL}
                {" · "}
                {t("ui_fees_zero_1f54f876a9", "Fees 0%")}
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
              {"XRPL"}
            </span>
          </div>
        </div>
      ) : null}

      <div className={hideHeader ? "space-y-4" : "panel-body space-y-4"}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              side === "buy"
                ? "bg-xcannes-green text-black"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {t("buy", "Buy")} {base}
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              side === "sell"
                ? "bg-red-500/80 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {t("sell", "Sell")} {base}
          </button>
        </div>

        <TokenAmountInput
          value={amount}
          onChange={setAmount}
          token={base}
          max={maxSellAmount ?? undefined}
        />

        <div className="grid grid-cols-2 gap-3 text-[11px] text-muted">
          <div className="rounded-lg border border-subtle bg-black/30 px-3 py-2 space-y-1">
            <div className="uppercase tracking-[0.16em] text-[9px] text-white/50">
              {quoteLabel} {quote}
            </div>
            <div className="text-sm text-primary">
              {formatNumber(previewQuote, { maximumFractionDigits: 2 })} {quote}
            </div>
          </div>
          <div className="rounded-lg border border-subtle bg-black/30 px-3 py-2 space-y-1">
            <div className="uppercase tracking-[0.16em] text-[9px] text-white/50">
              {t("ui_avg_price_dex_b9f4b81c6d", "Avg price")}
            </div>
            <div className="text-sm text-primary">
              {formatNumber(previewAvg)} {quote}
            </div>
          </div>
          <div className="rounded-lg border border-subtle bg-black/30 px-3 py-2 space-y-1">
            <div className="uppercase tracking-[0.16em] text-[9px] text-white/50">
              {t("ui_worst_price_1pct_55c4e5d2ff", "Worst price")}
            </div>
            <div className="text-sm text-primary">
              {formatNumber(previewWorst)} {quote}
            </div>
          </div>
          <div className="rounded-lg border border-subtle bg-black/30 px-3 py-2 space-y-1">
            <div className="uppercase tracking-[0.16em] text-[9px] text-white/50">
              {t("ui_filled_base_a3c0de25ae", "Filled base")}
            </div>
            <div className="text-sm text-primary">
              {formatNumber(previewFilled, { maximumFractionDigits: 6 })} {base}
            </div>
          </div>
        </div>

        {previewState.status === "loading" ? (
          <div className="text-[11px] text-muted">
            {t("ui_loading_orderbook_08e2c6ff6b", "Refreshing orderbook...")}
          </div>
        ) : null}

        {showNoLiquidity ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {t(
              "ui_no_liquidity_order_8b7a2d9f1c",
              "No liquidity available for this amount."
            )}
          </div>
        ) : null}

        {showPartialFill ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            {t(
              "ui_partial_fill_warning_0e1b9c7dbe",
              "Partial fill expected. Liquidity is limited at current depth."
            )}
          </div>
        ) : null}

        {previewState.status === "error" ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {previewState.error}
          </div>
        ) : null}

        {trustlineMissing ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            {t(
              "ui_trustline_required_order_d9bb4bdb3f",
              "Trustlines required to trade this pair."
            )}
          </div>
        ) : null}

        {orderError ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {orderError}
          </div>
        ) : null}

        {!isConnected ? (
          <button
            type="button"
            onClick={() => connect?.()}
            disabled={isConnecting}
            className="w-full bg-xcannes-green/80 hover:bg-xcannes-green text-black font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-white/10"
          >
            {isConnecting
              ? t("ui_connecting_2c59b8f12e", "Connecting...")
              : t("wallet_connect_cta", "Connect wallet")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-xcannes-green/80 hover:bg-xcannes-green text-black font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-white/10"
          >
            {isSubmitting
              ? t("ui_preparing_67f5f84ff4", "Preparing...")
              : side === "buy"
              ? `${t("buy", "Buy")} ${base}`
              : `${t("sell", "Sell")} ${base}`}
          </button>
        )}

        <div className="border-t border-subtle pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-secondary uppercase tracking-[0.16em]">
              {t("ui_recent_orders_9f3dba2ce4", "Recent orders")}
            </h4>
            <button
              type="button"
              onClick={() => loadOrders(true)}
              className="text-[11px] text-muted hover:text-white transition-colors"
            >
              {t("ui_refresh_7282e0c3ef", "Refresh")}
            </button>
          </div>

          {ordersLoading ? (
            <div className="text-[11px] text-muted">
              {t("ui_loading_orders_6e2b7301c2", "Loading orders...")}
            </div>
          ) : ordersError ? (
            <div className="text-[11px] text-red-200">{ordersError}</div>
          ) : orders.length === 0 ? (
            <div className="text-[11px] text-muted">
              {t("ui_no_orders_yet_0a08d0c617", "No orders yet.")}
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {orders.map((order) => {
                const meta = STATUS_META[order.status] || {
                  label: order.status || "Unknown",
                  className: "text-white/70",
                };
                const canCancel =
                  order.status === "submitted" &&
                  (order.offerSequence || order.txHash);
                return (
                  <div
                    key={order.orderId}
                    className="rounded-lg border border-subtle bg-black/30 px-3 py-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div
                          className={`font-semibold ${
                            order.side === "buy"
                              ? "text-price-up"
                              : "text-price-down"
                          }`}
                        >
                          {order.side === "buy" ? t("buy", "Buy") : t("sell", "Sell")}{" "}
                          {formatNumber(order.baseAmount, { maximumFractionDigits: 6 })}{" "}
                          {base}
                        </div>
                        <div className="text-muted">
                          {formatNumber(order.expectedQuote, { maximumFractionDigits: 2 })}{" "}
                          {quote}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${meta.className}`}>
                          {meta.label}
                        </div>
                        <div className="text-muted">
                          {formatTime(order.createdAt)}
                        </div>
                      </div>
                    </div>
                    {canCancel ? (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleCancelOrder(order)}
                          className="text-[10px] uppercase tracking-[0.14em] text-red-200 hover:text-red-100 transition-colors"
                        >
                          {t("ui_cancel_order_2b4028a1cd", "Cancel")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <XummQRModal
        isOpen={Boolean(modalData?.uuid)}
        onClose={() => setModalData(null)}
        uuid={modalData?.uuid}
        qrUrl={modalData?.qrUrl}
        deepLink={modalData?.deepLink}
        type="sign"
        onSuccess={handleModalSuccess}
        zIndexClassName="z-[11000]"
      />
    </div>
  );
}
