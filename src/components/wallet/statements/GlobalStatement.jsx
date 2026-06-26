"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import GlobalMovementDetailModal from "./GlobalMovementDetailModal";
import { escapeHtml, openPrintWindow } from "@/utils/statementExport";
import { apiUrl } from "@/lib/runtimeConfig";
import {
  formatAmountWithSymbol,
  USD_STABLECOINS,
} from "../walletDashboardConfig";
import { ShareIcon } from "./statementShared";
import useStatementWalletLabel from "./useStatementWalletLabel";
import useStatementDocHash from "./useStatementDocHash";
import { useSavedAddresses } from "../hooks/useSavedAddresses";
import { useFlashNotice } from "../hooks/useFlashNotice";
import { isXrplAddress } from "../utils/xrplAddress";
import { truncateMiddle } from "../modals/walletModalShared";
import {
  normalizeMovementKind as normalizeKind,
  isVisibleMovement,
  sortMovementsDesc,
} from "../utils/movementUtils";
import SegmentedFilterControl from "@/components/ui/SegmentedFilterControl";

/**
 * Composant de relevé bancaire global (toutes les devises consolidées).
 * Refactorisé : walletLabel, docHash, getCurrencyFlag et ShareIcon
 * sont délégués aux modules partagés.
 */
export default function GlobalStatement({
  tokens = [],
  walletAddress,
  walletLabelOverride = "",
  isPreviewMode = false,
  noticeVariant = "preview",
  period = "",
  variant = "full",
  isClosing = false,
  inline = false,
  usdRates = {},
  preferredCurrency = "USD",
  rlusdPerUnitRates = {},
  totalBalanceOverride = null,
  movements = [],
  movementsLoading = false,
  movementsError = null,
  highlightTransactionId = null,
  detailOnly = false,
  initialDetailMovement = null,
  onClose,
  toast,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const globalTitle = t(
    "ui_global_statement_13e29aa8aa",
    "Activité récente",
  );
  const MAX_RECENT_TRANSACTIONS = 20;

  /* ── local state ───────────────────────────────────────── */
  const [exportFormat, setExportFormat] = useState(null);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [accountAddressExpanded, setAccountAddressExpanded] = useState(false);
  const [accountCopyNotice, setAccountCopyNotice] = useState("");
  const accountCopyNoticeTimerRef = useRef(null);
  const [detailMovement, setDetailMovement] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedCounterparty, setCopiedCounterparty] = useState(false);
  const [isMobileDate, setIsMobileDate] = useState(false);
  const { notice: shareNotice, noticeTone: shareNoticeTone, flashNotice: _flashNotice, resetNotice: resetShareNotice } = useFlashNotice();
  const [counterpartyLabels, setCounterpartyLabels] = useState({});
  const labelCacheRef = useRef(new Map());
  const [overlayDragging, setOverlayDragging] = useState(false);
  const [overlayTranslateY, setOverlayTranslateY] = useState(0);
  const [txFilter, setTxFilter] = useState("all");
  const overlayRef = useRef(null);
  const accountDropdownRef = useRef(null);
  const overlayListRef = useRef(null);
  const overlayDragMetaRef = useRef({
    startY: 0,
    startAt: 0,
    pointerId: null,
    lastDelta: 0,
    pending: false,
    source: null,
    dragging: false,
    scrollLocked: false,
    lockedOverflowY: "",
  });
  const closeRequestedRef = useRef(false);
  const defaultPeriod = t(
    "ui_statement_period_default_5f4c8a7d2b",
    "December 2025",
  );
  const fallbackPeriod = period || defaultPeriod;

  useEffect(() => {
    if (!accountDropdownOpen) {
      setAccountAddressExpanded(false);
      setAccountCopyNotice("");
      if (accountCopyNoticeTimerRef.current) clearTimeout(accountCopyNoticeTimerRef.current);
    }
  }, [accountDropdownOpen]);

  useEffect(() => {
    setAccountAddressExpanded(false);
    setAccountCopyNotice("");
    if (accountCopyNoticeTimerRef.current) clearTimeout(accountCopyNoticeTimerRef.current);
  }, [walletAddress]);

  useEffect(() => {
    return () => {
      if (accountCopyNoticeTimerRef.current) clearTimeout(accountCopyNoticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!accountDropdownOpen) return;

    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target) return;
      if (accountDropdownRef.current && accountDropdownRef.current.contains(target)) return;
      setAccountDropdownOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [accountDropdownOpen]);
  const currentPeriod = t(
    "ui_last_20_transactions_period_0b6d4c2a1e",
    "Last 20 transactions",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(max-width: 767px)");
    const update = () => setIsMobileDate(Boolean(mq?.matches));
    update();
    if (!mq?.addEventListener) return;
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  /* ── extracted hooks ───────────────────────────────────── */
  const walletLabel = useStatementWalletLabel(
    walletAddress,
    walletLabelOverride,
  );

  const { savedAddresses } = useSavedAddresses({
    walletAddress,
  });

  const savedAddressLabelByAddress = useMemo(() => {
    const map = new Map();
    (savedAddresses || []).forEach((entry) => {
      const address = String(entry?.address || "").trim();
      if (!address) return;
      const label = String(entry?.label || entry?.onChainLabel || "").trim();
      if (!label) return;
      map.set(address, label);
    });
    return map;
  }, [savedAddresses]);
  /* ── helpers ───────────────────────────────────────────── */
  const isUsdStablecoin = useCallback(
    (currency) =>
      USD_STABLECOINS.includes(String(currency || "").toUpperCase()),
    [],
  );

  const rlusdToLocal = useCallback(
    (rlusdAmount, currencyCode) => {
      const amount = Number(rlusdAmount);
      if (!Number.isFinite(amount)) return 0;
      const code = String(currencyCode || "").toUpperCase();
      if (!code || isUsdStablecoin(code)) return amount;
      const rate = Number(usdRates?.[code]);
      if (!Number.isFinite(rate) || rate <= 0) return amount;
      return amount / rate;
    },
    [isUsdStablecoin, usdRates],
  );

  const formatConversionUnits = useCallback(
    (value, code) => {
      const v = Number(value);
      const c = String(code || "").toUpperCase() || "—";
      if (!Number.isFinite(v)) return `— ${c}`;
      const formatted = v.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${formatted} ${c}`;
    },
    [locale],
  );

  const recentMovements = useMemo(() => {
    const visible = (movements || []).filter(isVisibleMovement);
    const sorted = sortMovementsDesc(visible);
    return sorted.slice(0, MAX_RECENT_TRANSACTIONS);
  }, [
    MAX_RECENT_TRANSACTIONS,
    movements,
  ]);

  const getOnChainLabelForAddress = useCallback(
    (address) => {
      const key = String(address || "").trim();
      if (!key || !isXrplAddress(key)) return "";
      const fromSaved = String(savedAddressLabelByAddress.get(key) || "").trim();
      if (fromSaved) return fromSaved;
      const cached = labelCacheRef.current.get(key);
      if (cached != null) return String(cached || "").trim();
      const fromState = String(counterpartyLabels?.[key] || "").trim();
      if (fromState) return fromState;
      return "";
    },
    [counterpartyLabels, savedAddressLabelByAddress],
  );

  useEffect(() => {
    if (!detailOpen || !detailMovement) return;
    const counterparty = String(detailMovement?.counterparty || "").trim();
    if (!counterparty || !isXrplAddress(counterparty)) return;
    if (savedAddressLabelByAddress.get(counterparty)) return;
    if (labelCacheRef.current.has(counterparty)) return;
    if (counterpartyLabels?.[counterparty] != null) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          apiUrl(`/wallet/label?address=${encodeURIComponent(counterparty)}`),
        );
        const data = await res.json().catch(() => ({}));
        const label = String(data?.label || "").trim();
        labelCacheRef.current.set(counterparty, label);
        if (cancelled) return;
        setCounterpartyLabels((prev) =>
          prev?.[counterparty] === label
            ? prev
            : { ...(prev || {}), [counterparty]: label },
        );
      } catch {
        // ignore
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    counterpartyLabels,
    detailMovement,
    detailOpen,
    savedAddressLabelByAddress,
  ]);

  useEffect(() => {
    const list = Array.isArray(recentMovements) ? recentMovements : [];
    if (!list.length) return;
    let cancelled = false;

    const toFetch = [];
    for (const m of list) {
      const addr = String(m?.counterparty || "").trim();
      if (!addr || !isXrplAddress(addr)) continue;
      if (savedAddressLabelByAddress.get(addr)) continue;
      if (labelCacheRef.current.has(addr)) continue;
      if (counterpartyLabels?.[addr] != null) continue;
      toFetch.push(addr);
      if (toFetch.length >= 20) break;
    }

    if (!toFetch.length) return;
    (async () => {
      for (const addr of Array.from(new Set(toFetch))) {
        if (cancelled) return;
        try {
          const res = await fetch(
            apiUrl(`/wallet/label?address=${encodeURIComponent(addr)}`),
          );
          const data = await res.json().catch(() => ({}));
          const label = String(data?.label || "").trim();
          labelCacheRef.current.set(addr, label);
          if (cancelled) return;
          setCounterpartyLabels((prev) =>
            prev?.[addr] === label
              ? prev
              : { ...(prev || {}), [addr]: label },
          );
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    counterpartyLabels,
    recentMovements,
    savedAddressLabelByAddress,
  ]);

  const getMovementUiType = useCallback(
    (m) => {
      const kind = normalizeKind(m?.kind);
      const direction = String(m?.direction || "").trim().toLowerCase();
      if (kind === "CONVERSION") return "neutral";
      if (direction === "send") return "debit";
      if (direction === "receive") return "credit";
      if (
        kind === "PAYMENT_OUT" ||
        kind === "XRPL_PAYMENT_OUT" ||
        kind === "MOONPAY_SELL" ||
        kind === "XRPL_FEES_TOTAL" ||
        kind === "RECONCILE"
      ) {
        return "debit";
      }
      if (
        kind === "PAYMENT_IN" ||
        kind === "XRPL_PAYMENT_IN" ||
        kind === "MOONPAY_BUY"
      ) {
        return "credit";
      }
      return "neutral";
    },
    [],
  );

  const getMovementDisplayAmount = useCallback(
    (m) => {
      const displayAmount = Number(m?.displayAmount);
      const displayCurrency = String(m?.displayCurrencyCode || "").trim();
      if (
        Number.isFinite(displayAmount) &&
        displayAmount !== 0 &&
        displayCurrency
      ) {
        return { amount: displayAmount, currency: displayCurrency };
      }

      const kind = normalizeKind(m?.kind);
      const amountRlusd = Number(m?.amountRlusd);
      if (!Number.isFinite(amountRlusd)) {
        return { amount: 0, currency: "RLUSD" };
      }

      // Payment sent: show the amount in the paid currency (fromCurrencyCode)
      // instead of RLUSD.
      if (kind === "PAYMENT_OUT") {
        const from = String(m?.fromCurrencyCode || "").toUpperCase().trim();
        if (from) {
          const rate = Number(usdRates?.[from]);
          const fallbackRate = Number(m?.fxRate);
          const effectiveRate =
            Number.isFinite(rate) && rate > 0
              ? rate
              : Number.isFinite(fallbackRate) && fallbackRate > 0
                ? fallbackRate
                : null;
          const units =
            effectiveRate != null ? amountRlusd / effectiveRate : amountRlusd;
          return { amount: units, currency: from };
        }
      }

      // Payment received: show the amount in the received currency (toCurrencyCode)
      // instead of RLUSD.
      if (kind === "PAYMENT_IN") {
        const to = String(m?.toCurrencyCode || "").toUpperCase().trim();
        if (to) {
          const rate = Number(usdRates?.[to]);
          const fallbackRate = Number(m?.fxRate);
          const effectiveRate =
            Number.isFinite(rate) && rate > 0
              ? rate
              : Number.isFinite(fallbackRate) && fallbackRate > 0
                ? fallbackRate
                : null;
          const units =
            effectiveRate != null ? amountRlusd / effectiveRate : amountRlusd;
          return { amount: units, currency: to };
        }
      }

      return { amount: amountRlusd, currency: "RLUSD" };
    },
    [usdRates],
  );

  const getMovementTitle = useCallback(
    (m) => {
      const kind = normalizeKind(m?.kind);
      const from = String(m?.fromCurrencyCode || "").toUpperCase();
      const to = String(m?.toCurrencyCode || "").toUpperCase();
      if (kind === "CONVERSION") {
        const grossRlusd = Number(m?.amountRlusdGross);
        const netRlusd = Number(m?.amountRlusd);
        const baseRlusd = Number.isFinite(grossRlusd) ? grossRlusd : netRlusd;
        const quoteRlusd = Number.isFinite(netRlusd) ? netRlusd : grossRlusd;

        const baseAmount = rlusdToLocal(baseRlusd, from);
        const quoteAmount = rlusdToLocal(quoteRlusd, to);

        return t("ui_global_tx_conversion_amounts_7b1c2a9d5e", {
          defaultValue: "Conversion {{base}} → {{quote}}",
          base: formatConversionUnits(baseAmount, from),
          quote: formatConversionUnits(quoteAmount, to),
        });
      }
      if (kind === "PAYMENT_IN" || kind === "XRPL_PAYMENT_IN") {
        return t("ui_global_tx_received_1c7b2a9d5e", "Payment received");
      }
      if (kind === "PAYMENT_OUT" || kind === "XRPL_PAYMENT_OUT") {
        return t("ui_global_tx_sent_2c7a1d9b5e", "Payment sent");
      }
      if (kind === "MOONPAY_BUY") {
        return t("ui_global_tx_moonpay_buy_3c7a1d9b5e", "Purchase");
      }
      if (kind === "MOONPAY_SELL") {
        return t("ui_global_tx_moonpay_sell_4c7a1d9b5e", "Sale");
      }
      if (kind === "XRPL_FEES_TOTAL") {
        return t(
          "ui_global_tx_network_fees_5c7a1d9b5e",
          "XRPL network fees",
        );
      }
      if (kind === "RECONCILE") {
        return t(
          "ui_global_tx_adjustment_6c7a1d9b5e",
          "External adjustment",
        );
      }
      return String(m?.kind || "").trim() || t("ui_transaction", "Transaction");
    },
    [formatConversionUnits, rlusdToLocal, t],
  );

  const formatMovementDateTime = useCallback(
    (m) => {
      const raw = m?.createdAt || "";
      const parsed = raw ? new Date(raw) : null;
      if (!parsed || !Number.isFinite(parsed.getTime())) return "";
      if (isMobileDate) {
        return parsed.toLocaleString(locale, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return parsed.toLocaleString(locale);
    },
    [isMobileDate, locale],
  );

  const openMovementDetails = useCallback((m) => {
    if (!m) return;
    setDetailMovement(m);
    setDetailOpen(true);
  }, []);

  const lastAutoOpenedIdRef = useRef(null);
  useEffect(() => {
    const wanted = String(highlightTransactionId || "").trim();
    if (!wanted) return;
    if (movementsLoading) return;
    if (lastAutoOpenedIdRef.current === wanted) return;
    const match = (m) => {
      const movementId = String(m?.movementId || m?._id || "").trim();
      const txHash = String(m?.txHash || "").trim();
      return movementId === wanted || txHash === wanted;
    };
    const found = (movements || []).find(match) || null;
    if (!found) return;
    lastAutoOpenedIdRef.current = wanted;
    openMovementDetails(found);
  }, [highlightTransactionId, movements, movementsLoading, openMovementDetails]);

  const closeMovementDetails = useCallback(() => {
    setDetailOpen(false);
    setDetailMovement(null);
    setCopiedHash(false);
    setCopiedCounterparty(false);
    resetShareNotice();
    if (detailOnly) {
      onClose?.();
    }
  }, [detailOnly, onClose, resetShareNotice]);

  useEffect(() => {
    if (!detailOnly) return;
    if (detailOpen) return;
    if (!initialDetailMovement) return;
    setDetailMovement(initialDetailMovement);
    setDetailOpen(true);
  }, [detailOnly, detailOpen, initialDetailMovement]);

  const flashShareNotice = useCallback(
    (message, opts = {}) => _flashNotice(message, { ...opts, onAutoClose: closeMovementDetails }),
    [_flashNotice, closeMovementDetails],
  );

  const getUsdValue = useCallback(
    (token) => {
      const value = parseFloat(token.value || 0);
      if (!Number.isFinite(value)) return null;
      if (value === 0) return 0;
      const code = String(token.currency || "").toUpperCase();
      if (code === "XRP") return null;
      const rate = usdRates?.[code];
      if (Number.isFinite(rate) && rate > 0) return value * rate;
      if (isUsdStablecoin(code)) return value;
      // Fallback: for currency-line tokens, allocatedRlusd IS the USD value
      // (RLUSD ≈ USD 1:1). Use it when the FX rate is unavailable.
      const allocated = Number(token.allocatedRlusd);
      if (Number.isFinite(allocated) && allocated > 0) return allocated;
      return null;
    },
    [isUsdStablecoin, usdRates],
  );

  /* ── totals ────────────────────────────────────────────── */
  const computedTotalBalance = tokens.reduce((sum, token) => {
    const usdValue = getUsdValue(token);
    return sum + (Number.isFinite(usdValue) ? usdValue : 0);
  }, 0);
  const totalBalanceOverrideValue = Number(totalBalanceOverride);
  const totalBalance =
    totalBalanceOverride !== null &&
    totalBalanceOverride !== undefined &&
    totalBalanceOverride !== "" &&
    Number.isFinite(totalBalanceOverrideValue)
      ? totalBalanceOverrideValue
      : computedTotalBalance;

  /* ── preferred currency conversion ─────────────────────── */
  const prefCode = String(preferredCurrency || "USD").toUpperCase();
  const prefRlusdPerUnit = useMemo(() => {
    if (prefCode === "USD" || prefCode === "RLUSD") return 1;
    const rate = Number(rlusdPerUnitRates?.[prefCode]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }, [prefCode, rlusdPerUnitRates]);
  const totalInPreferred = useMemo(() => {
    if (!Number.isFinite(totalBalance) || totalBalance <= 0) return 0;
    if (prefCode === "USD" || prefCode === "RLUSD") return totalBalance;
    if (prefRlusdPerUnit === null) return null;
    return totalBalance / prefRlusdPerUnit;
  }, [totalBalance, prefCode, prefRlusdPerUnit]);
  const displayCurrencyCode = prefCode === "RLUSD" ? "USD" : prefCode;

  const formatAmountWithSymbolLocal = useCallback(
    (amount, currency, options = {}) =>
      formatAmountWithSymbol(locale, amount, currency, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...options,
      }),
    [locale],
  );

  const copyToClipboard = useCallback(
    async (text, successMessage) => {
      const value = String(text || "");
      if (!value) return false;
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          const el = document.createElement("textarea");
          el.value = value;
          el.setAttribute("readonly", "");
          el.style.position = "absolute";
          el.style.left = "-9999px";
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          el.remove();
        }
        if (successMessage) toast?.success?.(successMessage);
        return true;
      } catch {
        return false;
      }
    },
    [toast],
  );

  const handleShareMovement = useCallback(async () => {
    if (!detailMovement) return;
    if (typeof document === "undefined") return;

    try {
      const kind = normalizeKind(detailMovement?.kind);
      const isConversion = kind === "CONVERSION";
      const isPaymentOut =
        kind === "PAYMENT_OUT" || kind === "XRPL_PAYMENT_OUT";
      const isPaymentIn = kind === "PAYMENT_IN" || kind === "XRPL_PAYMENT_IN";
      const isDebit = getMovementUiType(detailMovement) === "debit";

      const from = String(detailMovement?.fromCurrencyCode || "")
        .toUpperCase()
        .trim();
      const to = String(detailMovement?.toCurrencyCode || "")
        .toUpperCase()
        .trim();

      const { amount, currency } = getMovementDisplayAmount(detailMovement);
      const amountLabel = formatAmountWithSymbolLocal(amount, currency, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const amountSigned = `${isDebit ? "−" : "+"}${amountLabel}`;

      const counterparty = String(detailMovement?.counterparty || "").trim();
      const counterpartyLabel =
        counterparty && isXrplAddress(counterparty)
          ? getOnChainLabelForAddress(counterparty) ||
            truncateMiddle(counterparty, 8, 6)
          : "";

      const title = isConversion
        ? `Convertion ${from || "—"} → ${to || "—"}`
        : isPaymentOut
          ? t("ui_sent", "Envoyé")
          : isPaymentIn
            ? t("ui_received", "Reçu")
            : getMovementTitle(detailMovement);

      const subtitle = formatMovementDateTime(detailMovement) || "";
      const statusLabel = (() => {
        if (detailMovement?.txHash) return t("ui_status_confirmed", "Confirmé");
        if (isPreviewMode) return t("ui_status_preview", "Aperçu");
        return t("ui_status_offchain", "Hors chaîne");
      })();

      const buildCardBlob = async () => {
        if (isConversion) {

        const convTitle = title;
        const convAmount = amountSigned;
        const convDate = subtitle;
        const convStatus = statusLabel;
        const convFrom = from || "—";
        const convTo = to || "—";
        const grossRlusdG = Number(detailMovement?.amountRlusdGross);
        const netRlusdG = Number(detailMovement?.amountRlusd);
        const baseRlusdG = Number.isFinite(grossRlusdG) ? grossRlusdG : netRlusdG;
        const convFromAmt = formatConversionUnits(rlusdToLocal(baseRlusdG, from), from) || amountSigned;
        const convToAmt = formatConversionUnits(rlusdToLocal(netRlusdG, to), to) || "—";
        const fxRateG = Number.isFinite(baseRlusdG) && Number.isFinite(netRlusdG) && baseRlusdG > 0
          ? (netRlusdG / baseRlusdG).toFixed(4)
          : (detailMovement?.fxRate ? Number(detailMovement.fxRate).toFixed(4) : "—");
        const convRate = `1 ${convFrom} = ${fxRateG} ${convTo}`;
        const convRateShort = fxRateG;
        const convTxHash = String(detailMovement?.txHash || "").trim();
        const walletLabelVar = walletLabel;

      // ── CONVERSION: dedicated design (aligned with sent/received) ───────
      const isPortrait = typeof window !== "undefined" && window.innerWidth < 768;
      const w = isPortrait ? 1080 : 1600;
      const h = isPortrait ? 1440 : 900;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const accent = "#3b82f6";
      const accentDim = "rgba(59,130,246,0.12)";
      const accentBorder = "rgba(59,130,246,0.28)";
      const accentText = "#60a5fa";
      const textPrimary = "#ffffff";
      const textSecondary = "rgba(255,255,255,0.50)";
      const cardFill = "rgba(255,255,255,0.05)";
      const cardBorder = "rgba(255,255,255,0.08)";

      ctx.fillStyle = "#0b0f10";
      ctx.fillRect(0, 0, w, h);

      const pad = isPortrait ? 48 : 56;
      const cardX = pad; const cardY = pad;
      const cardW = w - pad * 2; const cardH = h - pad * 2;
      const rr = (x, y, W, H, r) => {
        const cr = Math.max(0, Math.min(r, W/2, H/2));
        ctx.beginPath(); ctx.moveTo(x+cr, y);
        ctx.arcTo(x+W,y,x+W,y+H,cr); ctx.arcTo(x+W,y+H,x,y+H,cr);
        ctx.arcTo(x,y+H,x,y,cr); ctx.arcTo(x,y,x+W,y,cr);
        ctx.closePath();
      };
      rr(cardX,cardY,cardW,cardH,52);
      ctx.fillStyle="rgba(255,255,255,0.04)"; ctx.fill();
      ctx.strokeStyle=accentBorder; ctx.lineWidth=1.5; ctx.stroke();

      const ellipsize = (text, maxW) => {
        const raw = String(text||"");
        if(!raw || ctx.measureText(raw).width<=maxW) return raw;
        const ell="…"; let out=raw;
        while(out.length>0 && ctx.measureText(out+ell).width>maxW) out=out.slice(0,-1);
        return out?out+ell:ell;
      };
      const infoCard=(x,y,W,H)=>{
        rr(x,y,W,H,20); ctx.fillStyle=cardFill; ctx.fill();
        ctx.strokeStyle=cardBorder; ctx.lineWidth=1; ctx.stroke();
      };
      // Swap icon ⇄ in circle
      const drawSwapIcon=(cx,cy,R,big)=>{
        ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2);
        ctx.fillStyle="rgba(59,130,246,0.18)"; ctx.fill();
        ctx.strokeStyle=accent; ctx.lineWidth=big?5:3; ctx.stroke();
        const s=R*0.36; const gap=R*0.2;
        ctx.strokeStyle=accent; ctx.lineWidth=big?7:4;
        ctx.lineCap="round"; ctx.lineJoin="round";
        ctx.beginPath(); ctx.moveTo(cx-s,cy-gap); ctx.lineTo(cx+s,cy-gap); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx+s*0.4,cy-gap-s*0.45); ctx.lineTo(cx+s,cy-gap); ctx.lineTo(cx+s*0.4,cy-gap+s*0.45);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+s,cy+gap); ctx.lineTo(cx-s,cy+gap); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx-s*0.4,cy+gap-s*0.45); ctx.lineTo(cx-s,cy+gap); ctx.lineTo(cx-s*0.4,cy+gap+s*0.45);
        ctx.stroke();
      };
      const drawCalendar=(cx,cy,s)=>{
        ctx.strokeStyle=accent; ctx.lineWidth=s*0.09; ctx.fillStyle=accentDim;
        rr(cx-s/2,cy-s/2,s,s,s*0.18); ctx.fill(); ctx.stroke();
        ctx.strokeStyle=accent; ctx.lineWidth=s*0.07;
        [0.42,0.58,0.72].forEach(r=>{
          ctx.beginPath(); ctx.moveTo(cx-s*0.28,cy-s*0.5+s*r);
          ctx.lineTo(cx+s*0.28,cy-s*0.5+s*r); ctx.stroke();
        });
        ctx.beginPath(); ctx.moveTo(cx-s*0.12,cy-s*0.5+s*0.16); ctx.lineTo(cx-s*0.12,cy-s*0.5+s*0.28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+s*0.12,cy-s*0.5+s*0.16); ctx.lineTo(cx+s*0.12,cy-s*0.5+s*0.28); ctx.stroke();
      };
      const drawCheckSmall=(cx,cy,r)=>{
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
        ctx.fillStyle=accentDim; ctx.fill();
        ctx.strokeStyle=accent; ctx.lineWidth=2; ctx.stroke();
        const ck=r*0.45;
        ctx.beginPath();
        ctx.moveTo(cx-ck*0.9,cy); ctx.lineTo(cx-ck*0.2,cy+ck*0.7); ctx.lineTo(cx+ck*0.9,cy-ck*0.6);
        ctx.strokeStyle=accent; ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.stroke();
      };
      const drawCurrencyCircle=(cx,cy,r,label)=>{
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
        ctx.fillStyle=accentDim; ctx.fill();
        ctx.strokeStyle=accent; ctx.lineWidth=2.5; ctx.stroke();
        ctx.fillStyle=accentText; ctx.font=`700 ${Math.round(r*0.75)}px system-ui,-apple-system,sans-serif`;
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(label.slice(0,3), cx, cy);
      };
      const drawTrend=(cx,cy,s)=>{
        ctx.fillStyle=accentDim; ctx.strokeStyle=accent; ctx.lineWidth=s*0.09;
        rr(cx-s/2,cy-s/2,s,s,s*0.18); ctx.fill(); ctx.stroke();
        ctx.strokeStyle=accentText; ctx.lineWidth=s*0.09; ctx.lineCap="round"; ctx.lineJoin="round";
        ctx.beginPath();
        ctx.moveTo(cx-s*0.28,cy+s*0.12);
        ctx.lineTo(cx-s*0.08,cy-s*0.10);
        ctx.lineTo(cx+s*0.08,cy+s*0.04);
        ctx.lineTo(cx+s*0.28,cy-s*0.18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx+s*0.28-s*0.14,cy-s*0.18);
        ctx.lineTo(cx+s*0.28,cy-s*0.18);
        ctx.lineTo(cx+s*0.28,cy-s*0.04);
        ctx.stroke();
      };
      const drawHash=(cx,cy,s)=>{
        ctx.fillStyle=accentDim; ctx.strokeStyle=accent; ctx.lineWidth=s*0.09;
        rr(cx-s/2,cy-s/2,s,s,s*0.18); ctx.fill(); ctx.stroke();
        ctx.strokeStyle=accent; ctx.lineWidth=s*0.09;
        const off=s*0.12;
        [cy-off,cy+off].forEach(ry2=>{
          ctx.beginPath(); ctx.moveTo(cx-s*0.25,ry2); ctx.lineTo(cx+s*0.25,ry2); ctx.stroke();
        });
        [cx-off,cx+off].forEach(rx2=>{
          ctx.beginPath(); ctx.moveTo(rx2,cy-s*0.3); ctx.lineTo(rx2,cy+s*0.3); ctx.stroke();
        });
      };
      const drawLock=(cx,cy,s)=>{
        ctx.strokeStyle=textSecondary; ctx.lineWidth=s*0.09;
        ctx.beginPath(); ctx.arc(cx,cy-s*0.12,s*0.22,Math.PI,0); ctx.stroke();
        rr(cx-s*0.26,cy,s*0.52,s*0.38,s*0.08);
        ctx.fillStyle=accentDim; ctx.fill();
        ctx.strokeStyle=accent; ctx.stroke();
      };

      const wName = String(walletLabelVar || t("nav_wallet","Wallet")).trim();
      const wAddrRaw = String(walletAddress||"").trim();
      const wAddrShort = wAddrRaw.length>18 ? wAddrRaw.slice(0,8)+"…"+wAddrRaw.slice(-6) : wAddrRaw;
      const initial = wName.charAt(0).toUpperCase();
      const txHash = convTxHash;
      const txHashShort = txHash.length>22 ? txHash.slice(0,10)+"…"+txHash.slice(-10) : txHash;
      const secNote = t("ui_security_confirmation_note","Chaque transaction nécessite une confirmation.");

      if (isPortrait) {
        // ── PORTRAIT ─────────────────────────────────────────────────
        // Avatar
        const avR=40; const avCx=cardX+44+avR; const avCy=cardY+52+avR;
        ctx.beginPath(); ctx.arc(avCx,avCy,avR,0,Math.PI*2);
        ctx.fillStyle="rgba(59,130,246,0.16)"; ctx.fill();
        ctx.strokeStyle=accent; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle=textPrimary; ctx.font="700 34px system-ui,-apple-system,sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(initial,avCx,avCy);
        ctx.beginPath(); ctx.arc(avCx+avR*0.68,avCy+avR*0.68,9,0,Math.PI*2);
        ctx.fillStyle="#0b0f10"; ctx.fill();
        ctx.beginPath(); ctx.arc(avCx+avR*0.68,avCy+avR*0.68,7,0,Math.PI*2);
        ctx.fillStyle=accent; ctx.fill();
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textPrimary; ctx.font="600 28px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(wName,cardW-avCx-avR-60),avCx+avR+18,avCy-6);
        ctx.fillStyle=textSecondary; ctx.font="400 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(wAddrShort,cardW-avCx-avR-60),avCx+avR+18,avCy+22);

        // Big swap icon centered
        const bigR=72; const bigCx=cardX+cardW/2; const bigCy=cardY+270;
        drawSwapIcon(bigCx,bigCy,bigR,true);

        // Title
        ctx.fillStyle=textPrimary; ctx.font="800 64px system-ui,-apple-system,sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="alphabetic";
        ctx.fillText(ellipsize(convTitle,cardW-80),bigCx,bigCy+bigR+76);

        // Amount
        ctx.font="800 100px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace";
        ctx.fillStyle=accentText;
        ctx.fillText(ellipsize(convAmount,cardW-80),bigCx,bigCy+bigR+190);

        // Status pill
        const pillText=convStatus||"—";
        ctx.font="600 26px system-ui,-apple-system,sans-serif";
        const pillW=ctx.measureText(pillText).width+60+28;
        const pillH=52; const pillX=bigCx-pillW/2; const pillY=bigCy+bigR+218;
        rr(pillX,pillY,pillW,pillH,pillH/2);
        ctx.fillStyle=accentDim; ctx.fill();
        ctx.strokeStyle=accentBorder; ctx.lineWidth=1.5; ctx.stroke();
        drawCheckSmall(pillX+28,pillY+pillH/2,14);
        ctx.fillStyle=accentText; ctx.textAlign="left"; ctx.textBaseline="middle";
        ctx.fillText(pillText,pillX+52,pillY+pillH/2);

        // Divider
        ctx.strokeStyle="rgba(255,255,255,0.06)"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(cardX+44,bigCy+bigR+296); ctx.lineTo(cardX+cardW-44,bigCy+bigR+296); ctx.stroke();

        let cy2=bigCy+bigR+330;
        const cardGap=18; const iconS=44;
        const halfW=(cardW-cardGap)/2; const cardH1=100;

        // Date | Status
        infoCard(cardX,cy2,halfW,cardH1);
        drawCalendar(cardX+36,cy2+cardH1/2,iconS);
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textSecondary; ctx.font="500 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_date_label_7a2c1b9d5e","Date"),cardX+68,cy2+34);
        ctx.fillStyle=textPrimary; ctx.font="600 24px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convDate,halfW-76),cardX+68,cy2+66);
        const sx=cardX+halfW+cardGap;
        infoCard(sx,cy2,halfW,cardH1);
        drawCheckSmall(sx+36,cy2+cardH1/2,22);
        ctx.fillStyle=textSecondary; ctx.font="500 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_status_label","Statut"),sx+68,cy2+34);
        ctx.fillStyle=accentText; ctx.font="700 24px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convStatus||"—",halfW-80),sx+68,cy2+68);
        cy2+=cardH1+cardGap;

        // Conversion pair card
        const convCardH=116;
        infoCard(cardX,cy2,cardW,convCardH);
        const circR=34;
        const leftCX=cardX+cardW*0.22; const rightCX=cardX+cardW*0.72; const midY=cy2+convCardH/2;
        drawCurrencyCircle(leftCX,midY,circR,convFrom);
        ctx.fillStyle=textPrimary; ctx.font="700 26px system-ui,-apple-system,sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="alphabetic";
        ctx.fillText(convFrom,leftCX,midY-circR-10);
        ctx.fillStyle=textSecondary; ctx.font="400 22px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convFromAmt,cardW*0.35),leftCX,midY+circR+26);
        ctx.strokeStyle=textSecondary; ctx.lineWidth=2; ctx.lineCap="round";
        const midX=cardX+cardW/2;
        ctx.beginPath(); ctx.moveTo(midX-18,midY); ctx.lineTo(midX+18,midY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(midX+6,midY-12); ctx.lineTo(midX+18,midY); ctx.lineTo(midX+6,midY+12); ctx.stroke();
        drawCurrencyCircle(rightCX,midY,circR,convTo);
        ctx.fillStyle=textPrimary; ctx.font="700 26px system-ui,-apple-system,sans-serif";
        ctx.fillText(convTo,rightCX,midY-circR-10);
        ctx.fillStyle=accentText; ctx.font="400 22px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convToAmt,cardW*0.35),rightCX,midY+circR+26);
        cy2+=convCardH+cardGap;

        // Rate card
        const rateCardH=100;
        infoCard(cardX,cy2,cardW,rateCardH);
        drawTrend(cardX+36,cy2+rateCardH/2,iconS);
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textSecondary; ctx.font="500 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_fx_rate_used","Taux utilisé"),cardX+68,cy2+36);
        ctx.fillStyle=textPrimary; ctx.font="600 26px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convRate,cardW-84),cardX+68,cy2+70);
        cy2+=rateCardH+cardGap;

        // TX ID card
        const txCardH=110;
        infoCard(cardX,cy2,cardW,txCardH);
        drawHash(cardX+36,cy2+txCardH/2,iconS);
        ctx.fillStyle=textSecondary; ctx.font="500 20px system-ui,-apple-system,sans-serif"; ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillText(t("ui_tx_id","ID de transaction"),cardX+68,cy2+38);
        ctx.fillStyle=textPrimary; ctx.font="500 22px ui-monospace,SFMono-Regular,Menlo,Monaco,monospace";
        ctx.fillText(ellipsize(txHashShort||"—",cardW-84),cardX+68,cy2+68);
        if(txHash){
          const badgeW=130; const badgeH=40; const badgeX=cardX+cardW-badgeW-12; const badgeY=cy2+txCardH-badgeH-12;
          rr(badgeX,badgeY,badgeW,badgeH,20);
          ctx.fillStyle=accentDim; ctx.fill();
          ctx.strokeStyle=accentBorder; ctx.lineWidth=1; ctx.stroke();
          ctx.fillStyle=accentText; ctx.font="600 22px system-ui,-apple-system,sans-serif";
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(t("ui_copy_action","Copier"),badgeX+badgeW/2,badgeY+badgeH/2);
          ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        }

        // Security note
        const noteY=cardY+cardH-40; const lockS=28;
        drawLock(cardX+36,noteY-lockS*0.1,lockS);
        ctx.fillStyle=textSecondary; ctx.font="400 20px system-ui,-apple-system,sans-serif";
        ctx.textAlign="left"; ctx.textBaseline="middle";
        ctx.fillText(ellipsize(secNote,cardW-80),cardX+36+lockS,noteY);

      } else {
        // ── LANDSCAPE ────────────────────────────────────────────────
        const leftW=Math.round(cardW*0.45);
        const rightX=cardX+leftW+48; const rightW=cardX+cardW-rightX-12;

        // Avatar top-left
        const avR=36; const avCx=cardX+44+avR; const avCy=cardY+50+avR;
        ctx.beginPath(); ctx.arc(avCx,avCy,avR,0,Math.PI*2);
        ctx.fillStyle="rgba(59,130,246,0.16)"; ctx.fill();
        ctx.strokeStyle=accent; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle=textPrimary; ctx.font="700 28px system-ui,-apple-system,sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(initial,avCx,avCy);
        ctx.beginPath(); ctx.arc(avCx+avR*0.68,avCy+avR*0.68,8,0,Math.PI*2);
        ctx.fillStyle="#0b0f10"; ctx.fill();
        ctx.beginPath(); ctx.arc(avCx+avR*0.68,avCy+avR*0.68,6,0,Math.PI*2);
        ctx.fillStyle=accent; ctx.fill();
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textPrimary; ctx.font="600 26px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(wName,leftW-60),avCx+avR+14,avCy+8);
        ctx.fillStyle=textSecondary; ctx.font="400 18px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(wAddrShort,leftW-60),avCx+avR+14,avCy+34);

        // Vertical divider
        ctx.strokeStyle="rgba(255,255,255,0.07)"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(cardX+leftW+24,cardY+24); ctx.lineTo(cardX+leftW+24,cardY+cardH-24); ctx.stroke();

        // Big swap icon left-centered
        const bigR=64; const bigCx=cardX+leftW/2; const bigCy=cardY+210;
        drawSwapIcon(bigCx,bigCy,bigR,true);
        ctx.fillStyle=textPrimary; ctx.font="800 56px system-ui,-apple-system,sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="alphabetic";
        ctx.fillText(ellipsize(convTitle,leftW-40),bigCx,bigCy+bigR+64);
        ctx.font="800 80px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace";
        ctx.fillStyle=accentText;
        ctx.fillText(ellipsize(convAmount,leftW-40),bigCx,bigCy+bigR+158);

        // Status pill
        const pillText=convStatus||"—";
        ctx.font="600 24px system-ui,-apple-system,sans-serif";
        const pillW=ctx.measureText(pillText).width+52+24; const pillH=46;
        const pillX=bigCx-pillW/2; const pillY=bigCy+bigR+180;
        rr(pillX,pillY,pillW,pillH,pillH/2);
        ctx.fillStyle=accentDim; ctx.fill();
        ctx.strokeStyle=accentBorder; ctx.lineWidth=1.5; ctx.stroke();
        drawCheckSmall(pillX+24,pillY+pillH/2,12);
        ctx.fillStyle=accentText; ctx.textAlign="left"; ctx.textBaseline="middle";
        ctx.fillText(pillText,pillX+44,pillY+pillH/2);

        // Right panel cards
        let ry=cardY+44; const rGap=16; const iconS=38; const rCardW=rightW;

        // Date | Status
        const halfRW=(rCardW-rGap)/2; const cardRH1=106;
        infoCard(rightX,ry,halfRW,cardRH1);
        drawCalendar(rightX+28,ry+cardRH1/2,iconS);
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textSecondary; ctx.font="500 17px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_date_label_7a2c1b9d5e","Date"),rightX+56,ry+34);
        ctx.fillStyle=textPrimary; ctx.font="600 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convDate,halfRW-64),rightX+56,ry+62);
        const sx2=rightX+halfRW+rGap;
        infoCard(sx2,ry,halfRW,cardRH1);
        drawCheckSmall(sx2+28,ry+cardRH1/2,18);
        ctx.fillStyle=textSecondary; ctx.font="500 17px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_status_label","Statut"),sx2+56,ry+34);
        ctx.fillStyle=accentText; ctx.font="700 22px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convStatus||"—",halfRW-68),sx2+56,ry+68);
        ry+=cardRH1+rGap;

        // Conversion pair card
        const convCardH=108;
        infoCard(rightX,ry,rCardW,convCardH);
        const circR=28;
        const leftCX=rightX+rCardW*0.22; const rightCX=rightX+rCardW*0.72; const midY=ry+convCardH/2;
        drawCurrencyCircle(leftCX,midY,circR,convFrom);
        ctx.textAlign="center"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textPrimary; ctx.font="700 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(convFrom,leftCX,midY-circR-7);
        ctx.fillStyle=textSecondary; ctx.font="400 18px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convFromAmt,rCardW*0.35),leftCX,midY+circR+20);
        ctx.strokeStyle=textSecondary; ctx.lineWidth=2; ctx.lineCap="round";
        const midX2=rightX+rCardW/2;
        ctx.beginPath(); ctx.moveTo(midX2-16,midY); ctx.lineTo(midX2+16,midY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(midX2+4,midY-10); ctx.lineTo(midX2+16,midY); ctx.lineTo(midX2+4,midY+10); ctx.stroke();
        drawCurrencyCircle(rightCX,midY,circR,convTo);
        ctx.fillStyle=textPrimary; ctx.font="700 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(convTo,rightCX,midY-circR-7);
        ctx.fillStyle=accentText; ctx.font="400 18px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convToAmt,rCardW*0.35),rightCX,midY+circR+20);
        ry+=convCardH+rGap;

        // Rate card
        const rateCardH=90;
        infoCard(rightX,ry,rCardW,rateCardH);
        drawTrend(rightX+28,ry+rateCardH/2,iconS);
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textSecondary; ctx.font="500 17px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_fx_rate_used","Taux utilisé"),rightX+56,ry+30);
        ctx.fillStyle=textPrimary; ctx.font="600 22px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convRate,rCardW-72),rightX+56,ry+60);
        ry+=rateCardH+rGap;

        // TX ID card
        const txCardH=96;
        infoCard(rightX,ry,rCardW,txCardH);
        drawHash(rightX+28,ry+txCardH/2,iconS);
        ctx.fillStyle=textSecondary; ctx.font="500 17px system-ui,-apple-system,sans-serif"; ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillText(t("ui_tx_id","ID de transaction"),rightX+56,ry+32);
        ctx.fillStyle=textPrimary; ctx.font="500 18px ui-monospace,SFMono-Regular,Menlo,Monaco,monospace";
        ctx.fillText(ellipsize(txHashShort||"—",rCardW-160),rightX+56,ry+60);
        if(txHash){
          const bW=110; const bH=34; const bX=rightX+rCardW-bW-12; const bY=ry+(txCardH-bH)/2;
          rr(bX,bY,bW,bH,17); ctx.fillStyle=accentDim; ctx.fill();
          ctx.strokeStyle=accentBorder; ctx.lineWidth=1; ctx.stroke();
          ctx.fillStyle=accentText; ctx.font="600 18px system-ui,-apple-system,sans-serif";
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(t("ui_copy_action","Copier"),bX+bW/2,bY+bH/2);
          ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        }

        // Security note full-width bottom
        const noteY2=cardY+cardH-36; const lkS=24; const lkCx=cardX+36; const noteCardH=56;
        infoCard(cardX,noteY2-noteCardH+8,cardW,noteCardH);
        drawLock(lkCx+lkS*0.5,noteY2-noteCardH*0.1+8,lkS);
        ctx.fillStyle=textSecondary; ctx.font="400 18px system-ui,-apple-system,sans-serif";
        ctx.textAlign="left"; ctx.textBaseline="middle";
        ctx.fillText(ellipsize(secNote,cardW-80),lkCx+lkS+10,noteY2-noteCardH/2+8);
      }

      if(typeof canvas.toBlob==="function"){
        return await new Promise((resolve)=>{canvas.toBlob((blob)=>resolve(blob),"image/png",0.92);});
      }
      const dataUrl=canvas.toDataURL("image/png");
      const res=await fetch(dataUrl);
      return await res.blob();

        }
        if (isPaymentOut) {

      // ── SENT PAYMENT: dedicated design ──────────────────────────────
      const isPortrait = typeof window !== "undefined" && window.innerWidth < 768;
      const w = isPortrait ? 1080 : 1600;
      const h = isPortrait ? 1440 : 900;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const accent = "#f87171";
      const accentDim = "rgba(248,113,113,0.12)";
      const accentBorder = "rgba(248,113,113,0.28)";
      const accentText = "#f87171";
      const textPrimary = "#ffffff";
      const textSecondary = "rgba(255,255,255,0.50)";
      const cardFill = "rgba(255,255,255,0.05)";
      const cardBorder = "rgba(255,255,255,0.08)";

      // Background
      ctx.fillStyle = "#0b0f10";
      ctx.fillRect(0, 0, w, h);

      // Outer card
      const pad = isPortrait ? 48 : 56;
      const cardX = pad; const cardY = pad;
      const cardW = w - pad * 2; const cardH = h - pad * 2;
      const rr = (x, y, W, H, r) => {
        const cr = Math.max(0, Math.min(r, W / 2, H / 2));
        ctx.beginPath();
        ctx.moveTo(x + cr, y);
        ctx.arcTo(x + W, y, x + W, y + H, cr);
        ctx.arcTo(x + W, y + H, x, y + H, cr);
        ctx.arcTo(x, y + H, x, y, cr);
        ctx.arcTo(x, y, x + W, y, cr);
        ctx.closePath();
      };
      rr(cardX, cardY, cardW, cardH, 52);
      ctx.fillStyle = "rgba(248,113,113,0.04)";
      ctx.fill();
      ctx.strokeStyle = accentBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const ellipsize = (text, maxW) => {
        const raw = String(text || "");
        if (!raw || ctx.measureText(raw).width <= maxW) return raw;
        const ell = "…";
        let out = raw;
        while (out.length > 0 && ctx.measureText(out + ell).width > maxW) out = out.slice(0, -1);
        return out ? out + ell : ell;
      };
      const infoCard = (x, y, W, H) => {
        rr(x, y, W, H, 20);
        ctx.fillStyle = cardFill;
        ctx.fill();
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 1;
        ctx.stroke();
      };

      // Arrow down-right icon in circle
      const drawArrowIcon = (cx, cy, R, big) => {
        const h1 = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.6);
        h1.addColorStop(0, "rgba(248,113,113,0.20)"); h1.addColorStop(1, "rgba(248,113,113,0)");
        ctx.fillStyle = h1; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(248,113,113,0.18)"; ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = big ? 5 : 3; ctx.stroke();
        // Arrow ↘
        const s = R * 0.38;
        ctx.strokeStyle = accent; ctx.lineWidth = big ? 7 : 4;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(cx - s, cy - s);
        ctx.lineTo(cx + s, cy + s);
        ctx.stroke();
        const hw = big ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(cx + s, cy + s);
        ctx.lineTo(cx + s - s * 0.85, cy + s);
        ctx.moveTo(cx + s, cy + s);
        ctx.lineTo(cx + s, cy + s - s * 0.85);
        ctx.stroke();
      };
      const drawCalendar = (cx, cy, s) => {
        ctx.strokeStyle = accent; ctx.lineWidth = s * 0.09; ctx.fillStyle = accentDim;
        rr(cx - s / 2, cy - s / 2, s, s, s * 0.18); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = accent; ctx.lineWidth = s * 0.07;
        [0.42, 0.58, 0.72].forEach(r => {
          ctx.beginPath(); ctx.moveTo(cx - s * 0.28, cy - s * 0.5 + s * r);
          ctx.lineTo(cx + s * 0.28, cy - s * 0.5 + s * r); ctx.stroke();
        });
        ctx.beginPath(); ctx.moveTo(cx - s * 0.12, cy - s * 0.5 + s * 0.16);
        ctx.lineTo(cx - s * 0.12, cy - s * 0.5 + s * 0.28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + s * 0.12, cy - s * 0.5 + s * 0.16);
        ctx.lineTo(cx + s * 0.12, cy - s * 0.5 + s * 0.28); ctx.stroke();
      };
      const drawCheckSmall = (cx, cy, r) => {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = accentDim; ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
        const ck = r * 0.45;
        ctx.beginPath(); ctx.moveTo(cx - ck * 0.9, cy); ctx.lineTo(cx - ck * 0.2, cy + ck * 0.7); ctx.lineTo(cx + ck * 0.9, cy - ck * 0.6);
        ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke();
      };
      const drawPerson = (cx, cy, s) => {
        ctx.fillStyle = accentDim; ctx.strokeStyle = accent; ctx.lineWidth = s * 0.09;
        rr(cx - s / 2, cy - s / 2, s, s, s * 0.18); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy - s * 0.14, s * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = accent; ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy + s * 0.42, s * 0.28, Math.PI, 0);
        ctx.fillStyle = accent; ctx.fill();
      };
      const drawLock = (cx, cy, s) => {
        ctx.strokeStyle = textSecondary; ctx.lineWidth = s * 0.09;
        ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * 0.22, Math.PI, 0); ctx.stroke();
        rr(cx - s * 0.26, cy, s * 0.52, s * 0.38, s * 0.08);
        ctx.fillStyle = "rgba(248,113,113,0.10)"; ctx.fill();
        ctx.strokeStyle = accent; ctx.stroke();
      };

      const recipientName = counterpartyLabel || "—";
      const recipientAddr = (() => {
        const cp = String(detailMovement?.counterparty || "").trim();
        if (!cp || cp.length <= 20) return cp;
        return cp.slice(0, 8) + "…" + cp.slice(-6);
      })();
      const wName = String(walletLabel || t("nav_wallet", "Wallet")).trim();
      const wAddrRaw = String(walletAddress || "").trim();
      const wAddrShort = wAddrRaw.length > 18 ? wAddrRaw.slice(0, 8) + "…" + wAddrRaw.slice(-6) : wAddrRaw;
      const initial = wName.charAt(0).toUpperCase();
      const secNote = t("ui_security_confirmation_note", "Chaque transaction nécessite une confirmation.");

      if (isPortrait) {
        // ── PORTRAIT ─────────────────────────────────────────────────
        const avR = 40; const avCx = cardX + 44 + avR; const avCy = cardY + 52 + avR;
        ctx.beginPath(); ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(248,113,113,0.16)"; ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = textPrimary; ctx.font = "700 34px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(initial, avCx, avCy);
        ctx.beginPath(); ctx.arc(avCx + avR * 0.68, avCy + avR * 0.68, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#150808"; ctx.fill();
        ctx.beginPath(); ctx.arc(avCx + avR * 0.68, avCy + avR * 0.68, 7, 0, Math.PI * 2);
        ctx.fillStyle = accent; ctx.fill();
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = textPrimary; ctx.font = "600 28px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(wName, cardW - avCx - avR - 60), avCx + avR + 18, avCy - 6);
        ctx.fillStyle = textSecondary; ctx.font = "400 20px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(wAddrShort, cardW - avCx - avR - 60), avCx + avR + 18, avCy + 22);

        // Arrow icon
        const bigR = 72; const bigCx = cardX + cardW / 2; const bigCy = cardY + 270;
        drawArrowIcon(bigCx, bigCy, bigR, true);

        // Title
        ctx.fillStyle = textPrimary; ctx.font = "800 64px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(title, bigCx, bigCy + bigR + 76);

        // Amount
        ctx.font = "800 100px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = accentText;
        ctx.fillText(ellipsize(amountSigned, cardW - 80), bigCx, bigCy + bigR + 190);

        // Status pill
        const pillText = statusLabel || "—";
        ctx.font = "600 26px system-ui, -apple-system, sans-serif";
        const pillW = ctx.measureText(pillText).width + 60 + 28;
        const pillH = 52; const pillX = bigCx - pillW / 2; const pillY = bigCy + bigR + 218;
        rr(pillX, pillY, pillW, pillH, pillH / 2);
        ctx.fillStyle = accentDim; ctx.fill();
        ctx.strokeStyle = accentBorder; ctx.lineWidth = 1.5; ctx.stroke();
        drawCheckSmall(pillX + 28, pillY + pillH / 2, 14);
        ctx.fillStyle = accentText;
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(pillText, pillX + 52, pillY + pillH / 2);

        // Divider
        ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cardX + 44, bigCy + bigR + 296); ctx.lineTo(cardX + cardW - 44, bigCy + bigR + 296); ctx.stroke();

        let cy2 = bigCy + bigR + 330;
        const cardGap = 18; const iconS1 = 44; const cardH1 = 100;

        // Date
        infoCard(cardX, cy2, cardW, cardH1);
        drawCalendar(cardX + 36, cy2 + cardH1 / 2, iconS1);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = textSecondary; ctx.font = "500 20px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_date_label_7a2c1b9d5e", "Date"), cardX + 68, cy2 + 34);
        ctx.fillStyle = textPrimary; ctx.font = "600 26px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(subtitle, cardW - 84), cardX + 68, cy2 + 68);
        cy2 += cardH1 + cardGap;

        // Statut
        infoCard(cardX, cy2, cardW, cardH1);
        drawCheckSmall(cardX + 36, cy2 + cardH1 / 2, 22);
        ctx.fillStyle = textSecondary; ctx.font = "500 20px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_status_label", "Statut"), cardX + 68, cy2 + 34);
        ctx.fillStyle = accentText; ctx.font = "700 26px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(statusLabel || "—", cardW - 84), cardX + 68, cy2 + 68);
        cy2 += cardH1 + cardGap;

        // Destinataire
        const cardH2 = 118;
        infoCard(cardX, cy2, cardW, cardH2);
        drawPerson(cardX + 36, cy2 + cardH2 / 2, iconS1);
        ctx.fillStyle = textSecondary; ctx.font = "500 20px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_recipient_label", "Destinataire"), cardX + 68, cy2 + 34);
        ctx.fillStyle = textPrimary; ctx.font = "600 26px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(recipientName, cardW - 84), cardX + 68, cy2 + 68);
        ctx.fillStyle = textSecondary; ctx.font = "400 20px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";
        ctx.fillText(ellipsize(recipientAddr, cardW - 84), cardX + 68, cy2 + 98);

        // Security note
        const noteY = cardY + cardH - 40;
        const lockS = 28;
        drawLock(cardX + 36, noteY - lockS * 0.1, lockS);
        ctx.fillStyle = textSecondary; ctx.font = "400 20px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(ellipsize(secNote, cardW - 80), cardX + 36 + lockS, noteY);

      } else {
        // ── LANDSCAPE ────────────────────────────────────────────────
        const leftW = Math.round(cardW * 0.45);
        const rightX = cardX + leftW + 48;
        const rightW = cardX + cardW - rightX - 12;

        const avR = 36; const avCx = cardX + 44 + avR; const avCy = cardY + 50 + avR;
        ctx.beginPath(); ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(248,113,113,0.16)"; ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = textPrimary; ctx.font = "700 28px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(initial, avCx, avCy);
        ctx.beginPath(); ctx.arc(avCx + avR * 0.68, avCy + avR * 0.68, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#150808"; ctx.fill();
        ctx.beginPath(); ctx.arc(avCx + avR * 0.68, avCy + avR * 0.68, 6, 0, Math.PI * 2);
        ctx.fillStyle = accent; ctx.fill();
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = textPrimary; ctx.font = "600 26px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(wName, leftW - 60), avCx + avR + 14, avCy + 8);
        ctx.fillStyle = textSecondary; ctx.font = "400 18px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(wAddrShort, leftW - 60), avCx + avR + 14, avCy + 34);

        // Divider
        ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cardX + leftW + 24, cardY + 24); ctx.lineTo(cardX + leftW + 24, cardY + cardH - 24); ctx.stroke();

        // Arrow icon left
        const bigR = 64; const bigCx = cardX + leftW / 2; const bigCy = cardY + 210;
        drawArrowIcon(bigCx, bigCy, bigR, true);
        ctx.fillStyle = textPrimary; ctx.font = "800 56px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(title, bigCx, bigCy + bigR + 64);
        ctx.font = "800 80px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = accentText;
        ctx.fillText(ellipsize(amountSigned, leftW - 40), bigCx, bigCy + bigR + 158);

        // Status pill below amount
        const pillText = statusLabel || "—";
        ctx.font = "600 24px system-ui, -apple-system, sans-serif";
        const pillW = ctx.measureText(pillText).width + 52 + 24; const pillH = 46;
        const pillX = bigCx - pillW / 2; const pillY = bigCy + bigR + 180;
        rr(pillX, pillY, pillW, pillH, pillH / 2);
        ctx.fillStyle = accentDim; ctx.fill();
        ctx.strokeStyle = accentBorder; ctx.lineWidth = 1.5; ctx.stroke();
        drawCheckSmall(pillX + 24, pillY + pillH / 2, 12);
        ctx.fillStyle = accentText; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(pillText, pillX + 44, pillY + pillH / 2);

        // Right: 3 cards
        let ry = cardY + 44;
        const rGap = 16; const iconS = 38; const rCardW = rightW;

        // Date
        const cardRH = 106;
        infoCard(rightX, ry, rCardW, cardRH);
        drawCalendar(rightX + 28, ry + cardRH / 2, iconS);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = textSecondary; ctx.font = "500 17px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_date_label_7a2c1b9d5e", "Date"), rightX + 56, ry + 34);
        ctx.fillStyle = textPrimary; ctx.font = "600 22px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(subtitle, rCardW - 68), rightX + 56, ry + 64);
        ry += cardRH + rGap;

        // Statut
        infoCard(rightX, ry, rCardW, cardRH);
        drawCheckSmall(rightX + 28, ry + cardRH / 2, 19);
        ctx.fillStyle = textSecondary; ctx.font = "500 17px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_status_label", "Statut"), rightX + 56, ry + 34);
        ctx.fillStyle = accentText; ctx.font = "700 24px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(statusLabel || "—", rCardW - 68), rightX + 56, ry + 68);
        ry += cardRH + rGap;

        // Destinataire
        const cardRH2 = 118;
        infoCard(rightX, ry, rCardW, cardRH2);
        drawPerson(rightX + 28, ry + cardRH2 / 2, iconS);
        ctx.fillStyle = textSecondary; ctx.font = "500 17px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_recipient_label", "Destinataire"), rightX + 56, ry + 30);
        ctx.fillStyle = textPrimary; ctx.font = "600 24px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(recipientName, rCardW - 68), rightX + 56, ry + 62);
        ctx.fillStyle = textSecondary; ctx.font = "400 18px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";
        ctx.fillText(ellipsize(recipientAddr, rCardW - 68), rightX + 56, ry + 90);

        // Security note bottom full width
        const noteY2 = cardY + cardH - 36;
        const lkS = 24; const lkCx = cardX + 36;
        // Note card spanning full card width
        const noteCardH = 56;
        infoCard(cardX, noteY2 - noteCardH + 8, cardW, noteCardH);
        drawLock(lkCx + lkS * 0.5, noteY2 - noteCardH * 0.1 + 8, lkS);
        ctx.fillStyle = textSecondary; ctx.font = "400 18px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(ellipsize(secNote, cardW - 80), lkCx + lkS + 10, noteY2 - noteCardH / 2 + 8);
      }

      if (typeof canvas.toBlob === "function") {
        return await new Promise((resolve) => { canvas.toBlob((blob) => resolve(blob), "image/png", 0.92); });
      }
      const dataUrl = canvas.toDataURL("image/png");
      const res = await fetch(dataUrl);
      return await res.blob();

        }
        if (isPaymentIn) {

      // ── RECEIVED PAYMENT: dedicated design ──────────────────────────
      const isPortrait = typeof window !== "undefined" && window.innerWidth < 768;
      const w = isPortrait ? 1080 : 1600;
      const h = isPortrait ? 1440 : 900;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const accent = "#22c55e";
      const accentDim = "rgba(34,197,94,0.12)";
      const accentBorder = "rgba(34,197,94,0.28)";
      const accentText = "#22c55e";
      const textPrimary = "#ffffff";
      const textSecondary = "rgba(255,255,255,0.50)";
      const cardFill = "rgba(255,255,255,0.05)";
      const cardBorder = "rgba(255,255,255,0.08)";

      // Background
      ctx.fillStyle = "#0b0f10";
      ctx.fillRect(0, 0, w, h);

      // ── Outer card ──────────────────────────────────────────────────
      const pad = isPortrait ? 48 : 56;
      const cardX = pad; const cardY = pad;
      const cardW = w - pad * 2; const cardH = h - pad * 2;
      const rr = (x, y, W, H, r) => {
        const cr = Math.max(0, Math.min(r, W / 2, H / 2));
        ctx.beginPath();
        ctx.moveTo(x + cr, y);
        ctx.arcTo(x + W, y, x + W, y + H, cr);
        ctx.arcTo(x + W, y + H, x, y + H, cr);
        ctx.arcTo(x, y + H, x, y, cr);
        ctx.arcTo(x, y, x + W, y, cr);
        ctx.closePath();
      };
      rr(cardX, cardY, cardW, cardH, 52);
      ctx.fillStyle = "rgba(34,197,94,0.04)";
      ctx.fill();
      ctx.strokeStyle = accentBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Helpers ─────────────────────────────────────────────────────
      const ellipsize = (text, maxW) => {
        const raw = String(text || "");
        if (!raw || ctx.measureText(raw).width <= maxW) return raw;
        const ell = "…";
        let out = raw;
        while (out.length > 0 && ctx.measureText(out + ell).width > maxW) out = out.slice(0, -1);
        return out ? out + ell : ell;
      };
      const infoCard = (x, y, W, H) => {
        rr(x, y, W, H, 20);
        ctx.fillStyle = cardFill;
        ctx.fill();
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 1;
        ctx.stroke();
      };

      // Icon helpers
      const drawCalendar = (cx, cy, s) => {
        ctx.strokeStyle = accent; ctx.lineWidth = s * 0.09; ctx.fillStyle = accentDim;
        rr(cx - s / 2, cy - s / 2, s, s, s * 0.18); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = accent; ctx.lineWidth = s * 0.07;
        [0.42, 0.58, 0.72].forEach(r => {
          ctx.beginPath(); ctx.moveTo(cx - s * 0.28, cy - s * 0.5 + s * r);
          ctx.lineTo(cx + s * 0.28, cy - s * 0.5 + s * r); ctx.stroke();
        });
        ctx.beginPath(); ctx.moveTo(cx - s * 0.12, cy - s * 0.5 + s * 0.16);
        ctx.lineTo(cx - s * 0.12, cy - s * 0.5 + s * 0.28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + s * 0.12, cy - s * 0.5 + s * 0.16);
        ctx.lineTo(cx + s * 0.12, cy - s * 0.5 + s * 0.28); ctx.stroke();
      };
      const drawPerson = (cx, cy, s) => {
        ctx.fillStyle = accentDim; ctx.strokeStyle = accent; ctx.lineWidth = s * 0.09;
        rr(cx - s / 2, cy - s / 2, s, s, s * 0.18); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy - s * 0.14, s * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = accent; ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy + s * 0.42, s * 0.28, Math.PI, 0);
        ctx.fillStyle = accent; ctx.fill();
      };
      const drawHash = (cx, cy, s) => {
        ctx.fillStyle = accentDim; ctx.strokeStyle = accent; ctx.lineWidth = s * 0.09;
        rr(cx - s / 2, cy - s / 2, s, s, s * 0.18); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = accent; ctx.lineWidth = s * 0.09;
        const off = s * 0.12;
        [cy - off, cy + off].forEach(ry => {
          ctx.beginPath(); ctx.moveTo(cx - s * 0.25, ry); ctx.lineTo(cx + s * 0.25, ry); ctx.stroke();
        });
        [cx - off, cx + off].forEach(rx => {
          ctx.beginPath(); ctx.moveTo(rx, cy - s * 0.3); ctx.lineTo(rx, cy + s * 0.3); ctx.stroke();
        });
      };
      const drawCheckCircle = (cx, cy, R, big) => {
        // Outer halo
        const h1 = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.6);
        h1.addColorStop(0, "rgba(34,197,94,0.20)"); h1.addColorStop(1, "rgba(34,197,94,0)");
        ctx.fillStyle = h1; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2); ctx.fill();
        // Circle fill
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34,197,94,0.18)"; ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = big ? 5 : 3;
        ctx.stroke();
        // Checkmark
        const ck = R * 0.42;
        ctx.beginPath();
        ctx.moveTo(cx - ck * 0.9, cy);
        ctx.lineTo(cx - ck * 0.22, cy + ck * 0.72);
        ctx.lineTo(cx + ck * 0.9, cy - ck * 0.62);
        ctx.strokeStyle = accent; ctx.lineWidth = big ? 7 : 4;
        ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
      };
      const drawLock = (cx, cy, s) => {
        ctx.strokeStyle = textSecondary; ctx.lineWidth = s * 0.09;
        ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * 0.22, Math.PI, 0); ctx.stroke();
        rr(cx - s * 0.26, cy, s * 0.52, s * 0.38, s * 0.08);
        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fill(); ctx.strokeStyle = textSecondary; ctx.stroke();
      };
      const drawCheckSmall = (cx, cy, r) => {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34,197,94,0.18)"; ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
        const ck = r * 0.45;
        ctx.beginPath(); ctx.moveTo(cx - ck * 0.9, cy); ctx.lineTo(cx - ck * 0.2, cy + ck * 0.7); ctx.lineTo(cx + ck * 0.9, cy - ck * 0.6);
        ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke();
      };

      const senderName = counterpartyLabel || "—";
      const senderAddr = (() => {
        const cp = String(detailMovement?.counterparty || "").trim();
        if (!cp || cp.length <= 20) return cp;
        return cp.slice(0, 8) + "…" + cp.slice(-6);
      })();
      const txHash = String(detailMovement?.txHash || "").trim();
      const txHashShort = txHash.length > 22 ? txHash.slice(0, 10) + "…" + txHash.slice(-10) : txHash;
      const wName = String(walletLabel || t("nav_wallet", "Wallet")).trim();
      const wAddrRaw = String(walletAddress || "").trim();
      const wAddrShort = wAddrRaw.length > 18 ? wAddrRaw.slice(0, 8) + "…" + wAddrRaw.slice(-6) : wAddrRaw;
      const initial = wName.charAt(0).toUpperCase();
      const secNote = t("ui_security_confirmation_note", "Chaque transaction nécessite une confirmation.");

      if (isPortrait) {
        // ── PORTRAIT ─────────────────────────────────────────────────
        // Account block (top-left)
        const avR = 40; const avCx = cardX + 44 + avR; const avCy = cardY + 52 + avR;
        ctx.beginPath(); ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34,197,94,0.16)"; ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = textPrimary; ctx.font = "700 34px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(initial, avCx, avCy);
        // dot bottom-right of avatar
        ctx.beginPath(); ctx.arc(avCx + avR * 0.68, avCy + avR * 0.68, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#061510"; ctx.fill();
        ctx.beginPath(); ctx.arc(avCx + avR * 0.68, avCy + avR * 0.68, 7, 0, Math.PI * 2);
        ctx.fillStyle = accent; ctx.fill();
        // name + addr
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = textPrimary; ctx.font = "600 28px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(wName, cardW - avCx - avR - 60), avCx + avR + 18, avCy - 6);
        ctx.fillStyle = textSecondary; ctx.font = "400 20px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(wAddrShort, cardW - avCx - avR - 60), avCx + avR + 18, avCy + 22);

        // Checkmark circle (center)
        const bigR = 72; const bigCx = cardX + cardW / 2; const bigCy = cardY + 270;
        drawCheckCircle(bigCx, bigCy, bigR, true);

        // Title
        ctx.fillStyle = textPrimary; ctx.font = "800 64px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(title, bigCx, bigCy + bigR + 76);

        // Amount (big green)
        ctx.font = "800 100px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = accentText;
        ctx.fillText(ellipsize(amountSigned, cardW - 80), bigCx, bigCy + bigR + 190);

        // Sub-amount
        ctx.font = "500 28px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = textSecondary;
        ctx.fillText(`≈ ${amountLabel}`, bigCx, bigCy + bigR + 238);

        // Divider
        ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cardX + 44, bigCy + bigR + 268); ctx.lineTo(cardX + cardW - 44, bigCy + bigR + 268); ctx.stroke();

        // Cards
        let cy2 = bigCy + bigR + 300;
        const cardGap = 18;
        const halfW = (cardW - cardGap) / 2;
        const cardH1 = 126;

        // Row 1: Date | Statut
        infoCard(cardX, cy2, halfW, cardH1);
        const iconS1 = 44;
        drawCalendar(cardX + 36, cy2 + cardH1 / 2, iconS1);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = textSecondary; ctx.font = "500 20px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_date_label_7a2c1b9d5e", "Date"), cardX + 68, cy2 + 44);
        ctx.fillStyle = textPrimary; ctx.font = "600 24px system-ui, -apple-system, sans-serif";
        const dateParts = subtitle.split(/[,\n]/);
        ctx.fillText(ellipsize(dateParts[0] || subtitle, halfW - 76), cardX + 68, cy2 + 74);
        if (dateParts[1]) { ctx.fillStyle = textSecondary; ctx.font = "500 20px system-ui, -apple-system, sans-serif"; ctx.fillText(dateParts[1].trim(), cardX + 68, cy2 + 100); }

        const sx = cardX + halfW + cardGap;
        infoCard(sx, cy2, halfW, cardH1);
        drawCheckSmall(sx + 36, cy2 + cardH1 / 2, 22);
        ctx.fillStyle = textSecondary; ctx.font = "500 20px system-ui, -apple-system, sans-serif"; ctx.textBaseline = "alphabetic";
        ctx.fillText(t("ui_status_label", "Statut"), sx + 68, cy2 + 44);
        ctx.fillStyle = accentText; ctx.font = "700 26px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(statusLabel || "—", halfW - 80), sx + 68, cy2 + 80);

        // Row 2: Expéditeur
        cy2 += cardH1 + cardGap;
        const cardH2 = 120;
        infoCard(cardX, cy2, cardW, cardH2);
        drawPerson(cardX + 36, cy2 + cardH2 / 2, iconS1);
        ctx.fillStyle = textSecondary; ctx.font = "500 20px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_sender_label", "Expéditeur"), cardX + 68, cy2 + 38);
        ctx.fillStyle = textPrimary; ctx.font = "600 26px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(senderName, cardW - 84), cardX + 68, cy2 + 70);
        ctx.fillStyle = textSecondary; ctx.font = "400 20px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";
        ctx.fillText(ellipsize(senderAddr, cardW - 84), cardX + 68, cy2 + 98);

        // Row 3: Transaction ID
        cy2 += cardH2 + cardGap;
        const cardH3 = 110;
        infoCard(cardX, cy2, cardW, cardH3);
        drawHash(cardX + 36, cy2 + cardH3 / 2, iconS1);
        ctx.fillStyle = textSecondary; ctx.font = "500 20px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_tx_id", "ID de transaction"), cardX + 68, cy2 + 38);
        ctx.fillStyle = textPrimary; ctx.font = "500 22px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";
        ctx.fillText(ellipsize(txHashShort || "—", cardW - 84), cardX + 68, cy2 + 68);
        if (txHash) {
          // "Copier" badge
          const badgeW = 130; const badgeH = 40; const badgeX = cardX + cardW - badgeW - 12; const badgeY = cy2 + cardH3 - badgeH - 12;
          rr(badgeX, badgeY, badgeW, badgeH, 20);
          ctx.fillStyle = "rgba(34,197,94,0.14)"; ctx.fill();
          ctx.strokeStyle = accentBorder; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = accentText; ctx.font = "600 22px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(t("ui_copy_action", "Copier"), badgeX + badgeW / 2, badgeY + badgeH / 2);
          ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        }

        // Security note (bottom)
        const noteY = cardY + cardH - 40;
        const lockS = 28; const lockCx = cardX + 36;
        drawLock(lockCx, noteY - lockS * 0.1, lockS);
        ctx.fillStyle = textSecondary; ctx.font = "400 20px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(ellipsize(secNote, cardW - 80), lockCx + lockS, noteY);

      } else {
        // ── LANDSCAPE ────────────────────────────────────────────────
        const leftW = Math.round(cardW * 0.45);
        const rightX = cardX + leftW + 48;
        const rightW = cardX + cardW - rightX - 12;

        // Account block (top-left inside card)
        const avR = 36; const avCx = cardX + 44 + avR; const avCy = cardY + 50 + avR;
        ctx.beginPath(); ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34,197,94,0.16)"; ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = textPrimary; ctx.font = "700 28px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(initial, avCx, avCy);
        ctx.beginPath(); ctx.arc(avCx + avR * 0.68, avCy + avR * 0.68, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#061510"; ctx.fill();
        ctx.beginPath(); ctx.arc(avCx + avR * 0.68, avCy + avR * 0.68, 6, 0, Math.PI * 2);
        ctx.fillStyle = accent; ctx.fill();
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = textSecondary; ctx.font = "400 18px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_source_account", "Compte source"), avCx + avR + 14, avCy - 14);
        ctx.fillStyle = textPrimary; ctx.font = "600 26px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(wName, leftW - 60), avCx + avR + 14, avCy + 12);
        ctx.fillStyle = textSecondary; ctx.font = "400 18px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(wAddrShort, leftW - 60), avCx + avR + 14, avCy + 36);

        // Vertical divider
        ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cardX + leftW + 24, cardY + 24); ctx.lineTo(cardX + leftW + 24, cardY + cardH - 24); ctx.stroke();

        // Big checkmark (left)
        const bigR = 64; const bigCx = cardX + leftW / 2; const bigCy = cardY + 200;
        drawCheckCircle(bigCx, bigCy, bigR, true);
        ctx.fillStyle = textPrimary; ctx.font = "800 56px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(title, bigCx, bigCy + bigR + 64);
        ctx.font = "800 80px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = accentText;
        ctx.fillText(ellipsize(amountSigned, leftW - 40), bigCx, bigCy + bigR + 160);
        ctx.font = "400 22px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = textSecondary;
        ctx.fillText(`≈ ${amountLabel}`, bigCx, bigCy + bigR + 196);

        // Right: 3 stacked cards
        let ry = cardY + 44;
        const rGap = 16;
        const cardRH1 = 112; const cardRW = rightW;
        const halfRW = (cardRW - rGap) / 2;

        // Row 1: [Date | Statut] side by side
        infoCard(rightX, ry, halfRW, cardRH1);
        const iconS = 38;
        drawCalendar(rightX + 28, ry + cardRH1 / 2, iconS);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = textSecondary; ctx.font = "500 17px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_date_label_7a2c1b9d5e", "Date"), rightX + 56, ry + 36);
        ctx.fillStyle = textPrimary; ctx.font = "600 20px system-ui, -apple-system, sans-serif";
        const dp = subtitle.split(/[,\n]/);
        ctx.fillText(ellipsize(dp[0] || subtitle, halfRW - 64), rightX + 56, ry + 62);
        if (dp[1]) { ctx.fillStyle = textSecondary; ctx.font = "400 17px system-ui, -apple-system, sans-serif"; ctx.fillText(dp[1].trim(), rightX + 56, ry + 86); }

        const sx2 = rightX + halfRW + rGap;
        infoCard(sx2, ry, halfRW, cardRH1);
        drawCheckSmall(sx2 + 28, ry + cardRH1 / 2, 18);
        ctx.fillStyle = textSecondary; ctx.font = "500 17px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_status_label", "Statut"), sx2 + 58, ry + 36);
        ctx.fillStyle = accentText; ctx.font = "700 22px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(statusLabel || "—", halfRW - 70), sx2 + 58, ry + 68);

        // Row 2: Expéditeur
        ry += cardRH1 + rGap;
        const cardRH2 = 104;
        infoCard(rightX, ry, cardRW, cardRH2);
        drawPerson(rightX + 28, ry + cardRH2 / 2, iconS);
        ctx.fillStyle = textSecondary; ctx.font = "500 17px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_sender_label", "Expéditeur"), rightX + 56, ry + 32);
        ctx.fillStyle = textPrimary; ctx.font = "600 22px system-ui, -apple-system, sans-serif";
        ctx.fillText(ellipsize(senderName, cardRW - 68), rightX + 56, ry + 60);
        ctx.fillStyle = textSecondary; ctx.font = "400 17px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";
        ctx.fillText(ellipsize(senderAddr, cardRW - 68), rightX + 56, ry + 84);

        // Row 3: TX ID
        ry += cardRH2 + rGap;
        const cardRH3 = 100;
        infoCard(rightX, ry, cardRW, cardRH3);
        drawHash(rightX + 28, ry + cardRH3 / 2, iconS);
        ctx.fillStyle = textSecondary; ctx.font = "500 17px system-ui, -apple-system, sans-serif";
        ctx.fillText(t("ui_tx_id", "ID de transaction"), rightX + 56, ry + 32);
        ctx.fillStyle = textPrimary; ctx.font = "500 18px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";
        ctx.fillText(ellipsize(txHashShort || "—", cardRW - 160), rightX + 56, ry + 60);
        if (txHash) {
          const bW = 110; const bH = 34; const bX = rightX + cardRW - bW - 12; const bY = ry + (cardRH3 - bH) / 2;
          rr(bX, bY, bW, bH, 17);
          ctx.fillStyle = "rgba(34,197,94,0.14)"; ctx.fill();
          ctx.strokeStyle = accentBorder; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = accentText; ctx.font = "600 18px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(t("ui_copy_action", "Copier"), bX + bW / 2, bY + bH / 2);
          ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        }

        // Security note (bottom of card)
        const noteY2 = cardY + cardH - 36;
        const lkS = 24; const lkCx = cardX + 36;
        drawLock(lkCx, noteY2 - lkS * 0.1, lkS);
        ctx.fillStyle = textSecondary; ctx.font = "400 18px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(ellipsize(secNote, cardW - 80), lkCx + lkS, noteY2);
      }

      if (typeof canvas.toBlob === "function") {
        return await new Promise((resolve) => { canvas.toBlob((blob) => resolve(blob), "image/png", 0.92); });
      }
      const dataUrl = canvas.toDataURL("image/png");
      const res = await fetch(dataUrl);
      return await res.blob();

        }
        const isPortrait = typeof window !== "undefined" && window.innerWidth < 768;
        const w = 1080;
        const h = isPortrait ? 1350 : 600;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // Compute conversion detail lines upfront
        let fromLine = "", toLine = "", feeLine = "—";
        if (isConversion) {
          const grossRlusd = Number(detailMovement?.amountRlusdGross);
          const netRlusd = Number(detailMovement?.amountRlusd);
          const baseRlusd = Number.isFinite(grossRlusd) ? grossRlusd : netRlusd;
          const baseUnits = rlusdToLocal(baseRlusd, from);
          const quoteUnits = rlusdToLocal(netRlusd, to);
          fromLine = `${formatConversionUnits(baseUnits, from)}`;
          toLine = `${formatConversionUnits(quoteUnits, to)}`;
          const spread = Number(detailMovement?.spreadRlusd);
          const feeUnits = Number.isFinite(spread) && spread > 0 ? rlusdToLocal(spread, to) : null;
          feeLine = feeUnits != null ? `${formatConversionUnits(feeUnits, to)}` : "—";
        }

        const roundedRect = (x, y, width, height, r) => {
          const radius = Math.max(0, Math.min(r, width / 2, height / 2));
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.arcTo(x + width, y, x + width, y + height, radius);
          ctx.arcTo(x + width, y + height, x, y + height, radius);
          ctx.arcTo(x, y + height, x, y, radius);
          ctx.arcTo(x, y, x + width, y, radius);
          ctx.closePath();
        };

        const ellipsize = (text, maxWidth) => {
          const raw = String(text || "");
          if (!raw) return "";
          if (ctx.measureText(raw).width <= maxWidth) return raw;
          const ell = "…";
          let out = raw;
          while (out.length > 0 && ctx.measureText(out + ell).width > maxWidth) {
            out = out.slice(0, -1);
          }
          return out ? out + ell : ell;
        };

        const accentMain = isDebit ? "#f87171" : "#22c55e";
        // Background
        ctx.fillStyle = "#0b0f10";
        ctx.fillRect(0, 0, w, h);

        const pad = 52;
        const cardX = pad;
        const cardY = pad;
        const cardW = w - pad * 2;
        const cardH = h - pad * 2;
        roundedRect(cardX, cardY, cardW, cardH, 44);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.09)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Account header with accent dot
        {
          const walletName = String(walletLabel || t("nav_wallet", "Wallet")).trim();
          const addrRaw = String(walletAddress || "").trim();
          const addrShort = addrRaw ? `${addrRaw.slice(0, 8)}…${addrRaw.slice(-6)}` : "";
          const accountLine = `${walletName}${addrShort ? "  ·  " + addrShort : ""}`;
          const dotR = 6;
          const headerY = cardY + 50;
          ctx.beginPath();
          ctx.arc(cardX + 44 + dotR, headerY - 6, dotR, 0, Math.PI * 2);
          ctx.fillStyle = accentMain;
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.50)";
          ctx.font = "500 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(ellipsize(accountLine, cardW - 88), cardX + 44 + dotR * 2 + 8, headerY);
        }

        if (isPortrait) {
          // === PORTRAIT (mobile) ===
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "700 50px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(ellipsize(title, cardW - 88), cardX + 44, cardY + 132);

          if (!isConversion) {
            ctx.font = "800 96px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            ctx.fillStyle = accentMain;
            ctx.textAlign = "center";
            ctx.fillText(ellipsize(amountSigned, cardW - 40), cardX + cardW / 2, cardY + 256);
          }

          ctx.strokeStyle = "rgba(255,255,255,0.09)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cardX + 44, cardY + 286);
          ctx.lineTo(cardX + cardW - 44, cardY + 286);
          ctx.stroke();

          let my = cardY + 344;
          const col1x = cardX + 44;
          const col2x = cardX + cardW / 2 + 20;
          ctx.textAlign = "left";
          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.font = "600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(t("ui_date_label_7a2c1b9d5e", "Date"), col1x, my);
          ctx.fillText(t("ui_status_label", "Statut"), col2x, my);
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(ellipsize(subtitle, cardW / 2 - 44), col1x, my + 34);
          ctx.fillText(ellipsize(statusLabel || "—", cardW / 2 - 44), col2x, my + 34);
          my += 100;

          if (isConversion) {
            const walletName = String(walletLabel || t("nav_wallet", "Wallet")).trim();
            ctx.fillStyle = "rgba(255,255,255,0.42)";
            ctx.font = "600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(t("ui_account", "Compte"), col2x, my - 100);
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(ellipsize(walletName, cardW / 2 - 44), col2x, my - 100 + 34);
            ctx.fillStyle = "rgba(255,255,255,0.42)";
            ctx.font = "600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(t("ui_from_label_2c7a1d9b5e", "From"), col1x, my);
            ctx.fillText(t("ui_to_label_7b2c1a9d5e", "To"), col2x, my);
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(ellipsize(fromLine, cardW / 2 - 44), col1x, my + 34);
            ctx.fillText(ellipsize(toLine, cardW / 2 - 44), col2x, my + 34);
            my += 100;
            ctx.fillStyle = "rgba(255,255,255,0.42)";
            ctx.font = "600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(t("ui_fees", "Frais"), col1x, my);
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(ellipsize(feeLine, cardW / 2 - 44), col1x, my + 34);
          } else if (isPaymentOut || isPaymentIn) {
            const cpTitle = isPaymentOut ? t("ui_recipient_label", "Destinataire") : t("ui_sender_label", "Expéditeur");
            ctx.fillStyle = "rgba(255,255,255,0.42)";
            ctx.font = "600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(cpTitle, col1x, my);
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.font = "600 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(ellipsize(counterpartyLabel || "—", cardW - 88), col1x, my + 38);
          }

        } else {
          // === LANDSCAPE (desktop) ===
          const splitX = cardX + Math.round(cardW * 0.5);

          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "700 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(ellipsize(title, splitX - cardX - 72), cardX + 44, cardY + 126);

          if (!isConversion) {
            ctx.font = "800 72px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            ctx.fillStyle = accentMain;
            ctx.fillText(ellipsize(amountSigned, splitX - cardX - 44), cardX + 44, cardY + 232);
          }

          ctx.strokeStyle = "rgba(255,255,255,0.09)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(splitX, cardY + 24);
          ctx.lineTo(splitX, cardY + cardH - 24);
          ctx.stroke();

          const rx = splitX + 44;
          const rightW = cardX + cardW - rx - 16;
          let ry = cardY + 92;

          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(t("ui_date_label_7a2c1b9d5e", "Date"), rx, ry);
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(ellipsize(subtitle, rightW), rx, ry + 28);
          ry += 72;

          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(t("ui_status_label", "Statut"), rx, ry);
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(ellipsize(statusLabel || "—", rightW), rx, ry + 28);
          ry += 72;

          if (isConversion) {
            const walletName = String(walletLabel || t("nav_wallet", "Wallet")).trim();
            ctx.fillStyle = "rgba(255,255,255,0.42)";
            ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(t("ui_account", "Compte"), rx, ry);
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(ellipsize(walletName, rightW), rx, ry + 28);
            ry += 72;
            ctx.fillStyle = "rgba(255,255,255,0.42)";
            ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(t("ui_from_label_2c7a1d9b5e", "From"), rx, ry);
            ctx.fillText(t("ui_to_label_7b2c1a9d5e", "To"), rx + rightW / 2, ry);
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(ellipsize(fromLine, rightW / 2 - 8), rx, ry + 28);
            ctx.fillText(ellipsize(toLine, rightW / 2 - 8), rx + rightW / 2, ry + 28);
            ry += 72;
            ctx.fillStyle = "rgba(255,255,255,0.42)";
            ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(t("ui_fees", "Frais"), rx, ry);
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(ellipsize(feeLine, rightW), rx, ry + 28);
          } else if (isPaymentOut || isPaymentIn) {
            const cpTitle = isPaymentOut ? t("ui_recipient_label", "Destinataire") : t("ui_sender_label", "Expéditeur");
            ctx.fillStyle = "rgba(255,255,255,0.42)";
            ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(cpTitle, rx, ry);
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.font = "600 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            ctx.fillText(ellipsize(counterpartyLabel || "—", rightW), rx, ry + 28);
          }
        }

        // Brand footer
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("XCANNES", cardX + cardW / 2, cardY + cardH - 22);

        if (typeof canvas.toBlob === "function") {
          return await new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), "image/png", 0.92);
          });
        }
        const dataUrl = canvas.toDataURL("image/png");
        const res = await fetch(dataUrl);
        return await res.blob();
      };

      const blob = await buildCardBlob();
      if (!blob) return;

      const fileBase =
        String(detailMovement?.txHash || "").trim().slice(0, 10) ||
        String(Date.now());
      const fileName = `xcannes-transaction-${fileBase}.png`;
      const file =
        typeof File !== "undefined"
          ? new File([blob], fileName, { type: "image/png" })
          : null;

      try {
        if (
          file &&
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function"
        ) {
          const payload = {
            title: `XCANNES ${globalTitle}`,
            text: t(
              "ui_share_transaction_card",
              "Partager la carte de transaction",
            ),
            files: [file],
          };
          if (
            typeof navigator.canShare === "function" &&
            !navigator.canShare(payload)
          ) {
            throw new Error("canShare:false");
          }
          await navigator.share(payload);
          flashShareNotice(t("ui_shared", "Partagé"), { tone: "success" });
          return;
        }
      } catch {
        // fall back below
      }

      try {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = file?.name || fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
        toast?.success?.(t("ui_downloaded", "Téléchargé"));
        flashShareNotice(t("ui_downloaded", "Téléchargé"), {
          tone: "success",
        });
      } catch {
        // ignore
      }
    } catch {
      flashShareNotice(t("ui_share_failed", "Impossible de partager"), {
        tone: "error",
        autoClose: false,
      });
    }
  }, [
    detailMovement,
    flashShareNotice,
    formatAmountWithSymbolLocal,
    formatConversionUnits,
    formatMovementDateTime,
    getMovementDisplayAmount,
    getMovementTitle,
    getMovementUiType,
    getOnChainLabelForAddress,
    globalTitle,
    isPreviewMode,
    rlusdToLocal,
    t,
    toast,
    walletLabel,
    walletAddress,
  ]);

  /* ── ledger status ─────────────────────────────────────── */
  const ledgerEvidenceCount = useMemo(
    () => (recentMovements || []).filter((m) => m?.txHash).length,
    [recentMovements],
  );

  const ledgerStatus = useMemo(() => {
    if (isPreviewMode) return "preview";
    if (ledgerEvidenceCount > 0) return "verified";
    if (Array.isArray(recentMovements) && recentMovements.length > 0)
      return "offchain";
    return "available";
  }, [isPreviewMode, ledgerEvidenceCount, recentMovements]);

  const ledgerStatusLabel = useMemo(() => {
    if (ledgerStatus === "verified")
      return t(
        "ui_verified_on_xrp_ledger_334f28ce50",
        "Verified on XRP Ledger",
      );
    if (ledgerStatus === "available")
      return t(
        "ui_ledger_available_no_tx_f4",
        "Ledger available (no transactions yet)",
      );
    if (ledgerStatus === "offchain")
      return t(
        "ui_ledger_offchain_allocations_f4",
        "Ledger validation unavailable for off-chain allocations",
      );
    return t(
      "ui_ledger_preview_unavailable_f4",
      "Ledger validation unavailable (preview)",
    );
  }, [ledgerStatus, t]);

  /* ── doc hash ──────────────────────────────────────────── */
  const statementHashInput = useMemo(() => {
    const safeTotal = Number.isFinite(Number(totalBalance))
      ? Number(totalBalance)
      : 0;
    const movementPayload = (recentMovements || []).map((m) => ({
      kind: m?.kind || "",
      fromCurrencyCode: m?.fromCurrencyCode || "",
      toCurrencyCode: m?.toCurrencyCode || "",
      amountRlusd: Number.isFinite(Number(m?.amountRlusd))
        ? Number(m.amountRlusd)
        : 0,
      displayAmount: Number.isFinite(Number(m?.displayAmount))
        ? Number(m.displayAmount)
        : null,
      displayCurrencyCode: m?.displayCurrencyCode || "",
      fxRate: Number.isFinite(Number(m?.fxRate)) ? Number(m.fxRate) : null,
      fxSource: m?.fxSource || "",
      txHash: m?.txHash || "",
      note: m?.note || "",
      counterparty: m?.counterparty || "",
      direction: m?.direction || "",
      createdAt: m?.createdAt || "",
    }));
    return JSON.stringify({
      version: 1,
      type: "global_statement",
      walletAddress: walletAddress || "",
      period: currentPeriod || fallbackPeriod,
      totalBalance: safeTotal,
      movements: movementPayload,
    });
  }, [
    currentPeriod,
    fallbackPeriod,
    recentMovements,
    totalBalance,
    walletAddress,
  ]);

  const docHash = useStatementDocHash(statementHashInput);

  /* ── export helpers ────────────────────────────────────── */
  const buildPrintHtml = useCallback(() => {
    const docHashLabel = docHash || "-";
    const totalBalanceDisplay = Number.isFinite(Number(totalBalance))
      ? formatAmountWithSymbolLocal(
          totalInPreferred !== null && Number.isFinite(totalInPreferred)
            ? totalInPreferred
            : totalBalance,
          displayCurrencyCode,
        )
      : "-";
    const movementRows = (recentMovements || [])
      .map((m) => {
        const from = String(m?.fromCurrencyCode || "").toUpperCase();
        const to = String(m?.toCurrencyCode || "").toUpperCase();
        const displayAmount = Number(m?.displayAmount);
        const displayCurrency = String(m?.displayCurrencyCode || "").trim();
        const amount =
          Number.isFinite(displayAmount) && displayCurrency
            ? displayAmount
            : Number(m?.amountRlusd || 0);
        const currency = displayCurrency || "RLUSD";
        const createdAt = m?.createdAt ? new Date(m.createdAt) : null;
        const when =
          createdAt && Number.isFinite(createdAt.getTime())
            ? createdAt.toLocaleString(locale)
            : "";
        return `
        <tr>
          <td>${escapeHtml(when)}</td>
          <td>${escapeHtml(m?.kind || "")}</td>
          <td>${escapeHtml(from)}</td>
          <td>${escapeHtml(to)}</td>
          <td class="right">${escapeHtml(
            Number.isFinite(amount)
              ? `${amount.toLocaleString(locale, { maximumFractionDigits: 2 })} ${escapeHtml(currency)}`
              : "-",
          )}</td>
          <td>${escapeHtml(m?.txHash || "")}</td>
        </tr>
      `;
      })
      .join("");
    const movementsEmpty = `
      <tr>
        <td colspan="6" class="muted">${escapeHtml(
          t("ui_no_movements_found_2b7c1a9d5e", "No movements available"),
        )}</td>
      </tr>
    `;

    return `
      <h1>${escapeHtml(globalTitle)}</h1>
      <div class="meta">
        <div><strong>${escapeHtml(t("ui_wallet_address_label_2f7a1c9b5e", "Wallet address"))}:</strong> <span class="small">${escapeHtml(walletAddress || "-")}</span></div>
        <div><strong>${escapeHtml(t("ui_statement_period_label_3f6c1a9b5e", "Period"))}:</strong> ${escapeHtml(currentPeriod || fallbackPeriod)}</div>
        <div><strong>${escapeHtml(t("ui_total_balance_label_2c7a1d9b5e", "Total balance (USD)").replace("USD", displayCurrencyCode))}:</strong> ${escapeHtml(totalBalanceDisplay)}</div>
        <div><strong>${escapeHtml(t("ui_ledger_status_label_0f7c1a9b5e", "Ledger status"))}:</strong> ${escapeHtml(ledgerStatusLabel)}</div>
        <div><strong>${escapeHtml(t("ui_document_hash_label_9b5c1a2d7e", "Document hash"))}:</strong> <span class="small">${escapeHtml(docHashLabel)}</span></div>
      </div>
      <h2>${escapeHtml(t("ui_recent_activity_de80b9813c", "Recent activity"))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t("ui_date_label_7a2c1b9d5e", "Date"))}</th>
            <th>${escapeHtml(t("ui_type_label_8b1a4d2c7e", "Type"))}</th>
            <th>${escapeHtml(t("ui_from_label_2c7a1d9b5e", "From"))}</th>
            <th>${escapeHtml(t("ui_to_label_7b2c1a9d5e", "To"))}</th>
            <th class="right">${escapeHtml(t("ui_amount_label_2c7a1d9b5e", "Amount"))}</th>
            <th>${escapeHtml(t("ui_tx_hash_label_2b7c1a9d5e", "Tx hash"))}</th>
          </tr>
        </thead>
        <tbody>
          ${movementRows || movementsEmpty}
        </tbody>
      </table>
    `;
  }, [
    currentPeriod,
    displayCurrencyCode,
    docHash,
    fallbackPeriod,
    formatAmountWithSymbolLocal,
    globalTitle,
    ledgerStatusLabel,
    locale,
    recentMovements,
    t,
    totalBalance,
    totalInPreferred,
    walletAddress,
  ]);

  const handleExportPdf = useCallback(() => {
    setExportFormat("pdf");
    try {
      const suffix = docHash ? docHash.slice(0, 12) : "draft";
      const ok = openPrintWindow({
        title: `XCANNES ${globalTitle} ${suffix}`,
        bodyHtml: buildPrintHtml(),
      });
      if (!ok && typeof window !== "undefined") {
        const msg = t(
          "ui_popup_blocked_1c7a9d3b5e",
          "Popup blocked. Please allow popups to export or print.",
        );
        if (toast?.warn) toast.warn(msg);
        else window.alert(msg);
      }
    } finally {
      setExportFormat(null);
    }
  }, [buildPrintHtml, docHash, globalTitle, t, toast]);

  /* ── layout (GlobalStatement uses wider max-widths) ────── */
  const STATEMENT_LAYOUTS = {
    full: {
      backdropClass: "bg-black/80 md:backdrop-blur-sm",
      wrapperClass: "items-stretch justify-center px-0 md:items-center md:px-4",
      panelClass:
        "w-full xcannes-fullscreen-safe md:h-auto rounded-none border-0 md:max-w-5xl md:rounded-2xl md:max-h-[92vh] lg:max-w-6xl",
    },
    "inline-desktop": {
      backdropClass: "",
      wrapperClass: "items-stretch justify-stretch p-0",
      panelClass: "w-full h-full rounded-xl",
    },
  };

  const resolvedLayout =
    STATEMENT_LAYOUTS[variant] || STATEMENT_LAYOUTS.full;
  const wrapperBaseClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10200] flex";
  const modalBgClass =
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated";
  const swipeEnabled = !inline && variant === "full";

  useEffect(() => {
    closeRequestedRef.current = false;
    try {
      const listEl = overlayListRef.current;
      const meta = overlayDragMetaRef.current;
      if (listEl && meta?.scrollLocked) {
        listEl.style.overflowY = meta.lockedOverflowY;
      }
    } catch {
      // ignore
    }
    setOverlayDragging(false);
    setOverlayTranslateY(0);
    overlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
  }, [swipeEnabled]);

  const releaseOverlayScrollLock = () => {
    const meta = overlayDragMetaRef.current;
    if (meta?.source !== "list") return;
    if (!meta?.scrollLocked) return;
    const listEl = overlayListRef.current;
    if (!listEl) return;
    try {
      listEl.style.overflowY = meta.lockedOverflowY;
    } catch {
      // ignore
    }
    meta.scrollLocked = false;
    meta.lockedOverflowY = "";
  };

  const maybeStartOverlayDrag = (event, source) => {
    if (!swipeEnabled) return false;
    if (!event?.isPrimary) return false;
    if (event.pointerType === "mouse") return false;
    if (event.target?.closest?.("input,textarea,select")) return false;

    if (source === "list") {
      const listEl = overlayListRef.current;
      if (!listEl) return false;
      if (listEl.scrollTop > 0) return false;
    }

    overlayDragMetaRef.current = {
      startY: event.clientY,
      startAt: Date.now(),
      pointerId: event.pointerId,
      lastDelta: 0,
      pending: true,
      source,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
    return true;
  };

  const handleOverlayPointerMove = (event) => {
    if (!swipeEnabled) return;
    const meta = overlayDragMetaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;

    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;

    if (!meta.dragging) {
      if (delta < 8) return;
      try {
        overlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }

      if (meta.source === "list") {
        const listEl = overlayListRef.current;
        if (listEl && listEl.scrollTop <= 0) {
          try {
            meta.lockedOverflowY = listEl.style.overflowY;
            meta.scrollLocked = true;
            listEl.style.overflowY = "hidden";
            listEl.scrollTop = 0;
          } catch {
            // ignore
          }
        }
      }

      meta.dragging = true;
      setOverlayDragging(true);
    }

    meta.lastDelta = delta;
    setOverlayTranslateY(delta);
  };

  const handleOverlayPointerEnd = (event) => {
    if (!swipeEnabled) return;
    const meta = overlayDragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;

    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration; // px/ms
    const height = typeof window !== "undefined" ? window.innerHeight : 800;
    const closeDistance = Math.max(220, Math.min(320, height * 0.28));
    const shouldClose =
      delta > closeDistance ||
      (delta > closeDistance * 0.6 && velocity > 1.25);

    overlayDragMetaRef.current.pending = false;
    overlayDragMetaRef.current.dragging = false;
    setOverlayDragging(false);
    releaseOverlayScrollLock();

    if (shouldClose) {
      if (!closeRequestedRef.current) {
        closeRequestedRef.current = true;
        const height = typeof window !== "undefined" ? window.innerHeight : 9999;
        setOverlayTranslateY(Math.max(delta, height));
        onClose?.();
      }
      return;
    }

    setOverlayTranslateY(0);
    overlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
  };

  const detailStatusLabel = useMemo(() => {
    if (!detailMovement) return "";
    if (detailMovement?.txHash) return t("ui_status_confirmed", "Confirmé");
    if (isPreviewMode) return t("ui_status_preview", "Aperçu");
    return t("ui_status_offchain", "Hors chaîne");
  }, [detailMovement, isPreviewMode, t]);

  const detailTypeLabel = useMemo(() => {
    if (!detailMovement) return "";
    const kind = normalizeKind(detailMovement?.kind);
    if (kind === "CONVERSION") return t("ui_conversion", "Conversion");
    if (kind === "PAYMENT_IN" || kind === "XRPL_PAYMENT_IN")
      return t("ui_received", "Reçu");
    if (kind === "PAYMENT_OUT" || kind === "XRPL_PAYMENT_OUT")
      return t("ui_sent", "Envoyé");
    if (kind === "XRPL_FEES_TOTAL") return t("ui_fee", "Frais");
    if (kind === "RECONCILE") return t("ui_adjustment", "Ajustement");
    return t("ui_transaction", "Transaction");
  }, [detailMovement, t]);

  const detailIsConversion = useMemo(() => {
    return normalizeKind(detailMovement?.kind) === "CONVERSION";
  }, [detailMovement]);

  const detailIsPaymentSent = useMemo(() => {
    const kind = normalizeKind(detailMovement?.kind);
    return kind === "PAYMENT_OUT" || kind === "XRPL_PAYMENT_OUT";
  }, [detailMovement]);

  const detailIsPaymentReceive = useMemo(() => {
    const kind = normalizeKind(detailMovement?.kind);
    return kind === "PAYMENT_IN" || kind === "XRPL_PAYMENT_IN";
  }, [detailMovement]);

  const detailRecipientLabel = useMemo(() => {
    if (!detailMovement) return "—";
    const counterparty = String(detailMovement?.counterparty || "").trim();
    if (counterparty && isXrplAddress(counterparty)) {
      const label = getOnChainLabelForAddress(counterparty);
      if (label) return label;
      return truncateMiddle(counterparty, 8, 6);
    }

    const raw = detailMovement?.note || counterparty || "";
    const label = String(raw || "").trim();
    if (!label) return "—";
    // Avoid showing "XCANNES" as a recipient.
    if (label.toUpperCase() === "XCANNES") return "—";
    return label;
  }, [
    detailMovement,
    getOnChainLabelForAddress,
  ]);

  const detailSenderLabel = useMemo(() => {
    if (!detailMovement) return "—";
    const counterparty = String(detailMovement?.counterparty || "").trim();
    if (counterparty && isXrplAddress(counterparty)) {
      const label = getOnChainLabelForAddress(counterparty);
      if (label) return label;
      return truncateMiddle(counterparty, 8, 6);
    }

    const raw = detailMovement?.note || counterparty || "";
    const label = String(raw || "").trim();
    if (!label) return "—";
    if (label.toUpperCase() === "XCANNES") return "—";
    return label;
  }, [
    detailMovement,
    getOnChainLabelForAddress,
  ]);

  const detailConversionHeader = useMemo(() => {
    if (!detailMovement) return "";
    const from = String(detailMovement?.fromCurrencyCode || "")
      .toUpperCase()
      .trim();
    const to = String(detailMovement?.toCurrencyCode || "")
      .toUpperCase()
      .trim();
    return `Convertion ${from || "—"} → ${to || "—"}`;
  }, [detailMovement]);

  const detailConversionFrom = useMemo(() => {
    if (!detailMovement) return "—";
    const from = String(detailMovement?.fromCurrencyCode || "")
      .toUpperCase()
      .trim();
    const grossRlusd = Number(detailMovement?.amountRlusdGross);
    const netRlusd = Number(detailMovement?.amountRlusd);
    const baseRlusd = Number.isFinite(grossRlusd) ? grossRlusd : netRlusd;
    const baseUnits = rlusdToLocal(baseRlusd, from);
    return formatConversionUnits(baseUnits, from);
  }, [detailMovement, formatConversionUnits, rlusdToLocal]);

  const detailConversionTo = useMemo(() => {
    if (!detailMovement) return "—";
    const to = String(detailMovement?.toCurrencyCode || "")
      .toUpperCase()
      .trim();
    const netRlusd = Number(detailMovement?.amountRlusd);
    const quoteUnits = rlusdToLocal(netRlusd, to);
    return formatConversionUnits(quoteUnits, to);
  }, [detailMovement, formatConversionUnits, rlusdToLocal]);

  const detailConversionFee = useMemo(() => {
    if (!detailMovement) return "—";
    const to = String(detailMovement?.toCurrencyCode || "")
      .toUpperCase()
      .trim();
    const spread = Number(detailMovement?.spreadRlusd);
    if (!Number.isFinite(spread) || spread <= 0) return "—";
    const feeUnits = rlusdToLocal(spread, to);
    return formatConversionUnits(feeUnits, to);
  }, [detailMovement, formatConversionUnits, rlusdToLocal]);

  const transactionDetailModal = detailOpen && detailMovement ? (
    <GlobalMovementDetailModal
      detailMovement={detailMovement}
      onClose={closeMovementDetails}
      modalBgClass={modalBgClass}
      detailIsConversion={detailIsConversion}
      detailConversionHeader={detailConversionHeader}
      detailTypeLabel={detailTypeLabel}
      getMovementUiType={getMovementUiType}
      getMovementDisplayAmount={getMovementDisplayAmount}
      formatAmountWithSymbolLocal={formatAmountWithSymbolLocal}
      detailStatusLabel={detailStatusLabel}
      formatMovementDateTime={formatMovementDateTime}
      normalizeKind={normalizeKind}
      detailIsPaymentSent={detailIsPaymentSent}
      detailIsPaymentReceive={detailIsPaymentReceive}
      detailRecipientLabel={detailRecipientLabel}
      detailSenderLabel={detailSenderLabel}
      detailConversionFrom={detailConversionFrom}
      detailConversionTo={detailConversionTo}
      detailConversionFee={detailConversionFee}
      copiedCounterparty={copiedCounterparty}
      setCopiedCounterparty={setCopiedCounterparty}
      copyToClipboard={copyToClipboard}
      copiedHash={copiedHash}
      setCopiedHash={setCopiedHash}
      handleShare={handleShareMovement}
      shareNotice={shareNotice}
      shareNoticeTone={shareNoticeTone}
      isXrplAddress={isXrplAddress}
      truncateMiddle={truncateMiddle}
      walletLabel={walletLabel}
      walletAddress={walletAddress}
      t={t}
      locale={locale}
    />
  ) : null;


  /* ── render ────────────────────────────────────────────── */
  const backdropAnimClass = closeRequestedRef.current
    ? ""
    : isClosing
      ? "wallet-modal-backdrop-out"
      : "wallet-modal-backdrop-in";
  const liftAnimClass = closeRequestedRef.current
    ? ""
    : isClosing
      ? "wallet-modal-lift-out"
      : "wallet-modal-lift-in";

  const content = (
    <div
      className={`${wrapperBaseClass} ${resolvedLayout.wrapperClass}`}
    >
      {!inline ? (
        <div
          className={[
            "absolute inset-0 z-[10200]",
            resolvedLayout.backdropClass,
            backdropAnimClass,
          ].join(" ")}
          onClick={onClose}
          style={
            overlayTranslateY > 0
              ? { opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) }
              : undefined
          }
        />
      ) : null}

	        <div
	          ref={overlayRef}
		        className={`relative w-full wallet-modal-panel wallet-modal-no-top-highlight-mobile ${modalBgClass} flex flex-col overflow-hidden ${inline ? "z-[1]" : "z-[10201]"} shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
		          resolvedLayout.panelClass
		        } ${inline ? "wallet-inline-zoom-in" : liftAnimClass}`}
        style={
          swipeEnabled
            ? {
                transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
                transition: overlayDragging
                  ? "none"
                  : "transform 220ms cubic-bezier(0.2,0,0,1)",
                opacity: overlayTranslateY > 0 ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) : undefined,
                willChange: overlayTranslateY ? "transform" : undefined,
              }
            : undefined
        }
        onPointerMove={handleOverlayPointerMove}
        onPointerUp={handleOverlayPointerEnd}
        onPointerCancel={handleOverlayPointerEnd}
      >
        {/* Header + Filtres — même conteneur pour éviter la jonction */}
        <div
          className="relative flex-shrink-0 bg-elevated"
          onPointerDown={(event) => {
            maybeStartOverlayDrag(event, "fixed");
          }}
        >
          <div className="px-4 md:px-5 py-4">
          {swipeEnabled ? (
            <div className="md:hidden flex justify-center -mt-1 pt-1 pb-2" aria-hidden>
              <span className="block w-12 h-1.5 rounded-full bg-white/20" />
            </div>
          ) : null}
          <div className="flex justify-start w-full">
            <div className="w-full flex flex-col items-start justify-center text-left gap-3">
              <div className="flex items-center justify-start gap-3">
                <h2 className="text-[30px] md:text-[34px] font-light text-white/80 md:text-white tracking-tight text-left">
                  {globalTitle}
                </h2>
                {noticeVariant === "demo" ? (
                  <span className="ml-2 inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}
              </div>
              {/* Wallet label + bouton télécharger */}
              <div className="w-full flex items-center justify-between">
                <div className="relative min-w-0 max-w-[220px]" ref={accountDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setAccountDropdownOpen((prev) => !prev)}
                    className="w-full inline-flex items-center gap-2 px-3 py-1.5 bg-transparent transition-all rounded-[10px]"
                    aria-haspopup="menu"
                    aria-expanded={accountDropdownOpen}
                    title={t("ui_current_account_plain", "Compte actuel")}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0 wallet-dot-active" aria-hidden />
                    <span className="text-white/70 text-sm font-light truncate min-w-0 flex-1 text-left">
                      {walletLabel || t("nav_wallet", "Wallet")}
                    </span>
                    <svg className="w-3.5 h-3.5 text-white/35 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                      <circle cx="12" cy="12" r="2.6" />
                      {accountDropdownOpen ? <path d="M4 20L20 4" /> : null}
                    </svg>
                  </button>
                  {accountDropdownOpen && walletAddress ? (
                    <div className="absolute top-full left-0 z-[200] w-full mt-1 rounded-[10px] ring-1 ring-white/20 ring-inset bg-elevated px-4 py-3 shadow-[0_8px_18px_rgba(0,0,0,0.45)]">
                      <p className="text-[13px] text-white/60 mb-2">{t("ui_account_address", "Adresse du compte")}</p>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          className={`min-w-0 flex-1 text-left text-xs text-white/55 font-mono font-light ${accountAddressExpanded ? "break-all whitespace-normal" : "truncate"}`}
                          title={walletAddress}
                          onClick={() => setAccountAddressExpanded((prev) => !prev)}
                          aria-label={t("ui_toggle_wallet_address_truncation", "Afficher l'adresse complète")}
                        >
                          {accountAddressExpanded ? walletAddress : `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard?.writeText?.(walletAddress);
                              setAccountCopyNotice(t("ui_copied_address", "Adresse copiée"));
                              if (accountCopyNoticeTimerRef.current) clearTimeout(accountCopyNoticeTimerRef.current);
                              accountCopyNoticeTimerRef.current = window.setTimeout(() => setAccountCopyNotice(""), 3000);
                            } catch { /* ignore */ }
                          }}
                          className="shrink-0 text-white/40 hover:text-white/70 transition-colors p-0.5"
                          title={t("ui_copy_address", "Copier l'adresse")}
                          aria-label={t("ui_copy_address", "Copier l'adresse")}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        </button>
                      </div>
                      <div className={`mt-1.5 text-[11px] text-xcannes-green/85 transition-opacity duration-200 ${accountCopyNotice ? "opacity-100" : "opacity-0"}`} role="status" aria-live="polite">
                        {accountCopyNotice || " "}
                      </div>
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={handleExportPdf}
                  disabled={exportFormat === "pdf"}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-sm font-light transition-colors disabled:opacity-50 text-white/50 hover:text-white/80 bg-transparent hover:bg-white/[0.04]"
                  aria-label={t("ui_export_pdf_9c8d16b4fe", "Télécharger")}
                >
                  <ShareIcon className={`w-3.5 h-3.5 ${exportFormat === "pdf" ? "opacity-40" : ""}`} />
                  <span>{exportFormat === "pdf" ? t("ui_loading_1386baebe9", "Loading…") : t("ui_export_pdf_9c8d16b4fe", "Télécharger")}</span>
                </button>
              </div>
            </div>
          </div>
          </div>

        {/* Monthly summary stats */}
        {(() => {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          const monthMovements = (movements || []).filter((m) => {
            const d = m?.createdAt ? new Date(m.createdAt) : null;
            return d && Number.isFinite(d.getTime()) && d >= monthAgo;
          });
          let cntIn = 0, cntOut = 0, cntConv = 0;
          monthMovements.forEach((m) => {
            const uiT = getMovementUiType(m);
            const isConv = normalizeKind(m?.kind) === "CONVERSION";
            if (isConv) { cntConv++; }
            else if (uiT === "credit") { cntIn++; }
            else if (uiT === "debit") { cntOut++; }
          });
          const total = cntIn + cntOut + cntConv;
          return (
            <div className="px-4 md:px-6 pt-3 pb-1">
              <div className="grid grid-cols-2 gap-2 rounded-[18px] ring-1 ring-white/[0.06] ring-inset bg-white/[0.025] px-4 py-3">
                {/* Entrées */}
                <div
                  className="flex items-center gap-2.5"
                  style={{
                    transition: "opacity 270ms ease, filter 270ms ease",
                    opacity: txFilter === "debit" || txFilter === "conversion" ? 0.45 : 1,
                    filter: txFilter === "credit" ? "brightness(1.25)" : "brightness(1)",
                  }}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 shrink-0">
                    <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-white/40 font-light">{t("ui_credits_b8166276a0", "Entrées")}</div>
                    <div className="text-[13px] font-medium text-emerald-400 leading-tight">{cntIn} transaction{cntIn !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                {/* Sorties */}
                <div
                  className="flex items-center gap-2.5"
                  style={{
                    transition: "opacity 270ms ease, filter 270ms ease",
                    opacity: txFilter === "credit" || txFilter === "conversion" ? 0.45 : 1,
                    filter: txFilter === "debit" ? "brightness(1.25)" : "brightness(1)",
                  }}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 shrink-0">
                    <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-white/40 font-light">{t("ui_debits_38c870b18f", "Sorties")}</div>
                    <div className="text-[13px] font-medium text-red-400 leading-tight">{cntOut} transaction{cntOut !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                {/* Conversions */}
                <div
                  className="flex items-center gap-2.5"
                  style={{
                    transition: "opacity 270ms ease, filter 270ms ease",
                    opacity: txFilter === "credit" || txFilter === "debit" ? 0.45 : 1,
                    filter: txFilter === "conversion" ? "brightness(1.25)" : "brightness(1)",
                  }}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 shrink-0">
                    <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-white/40 font-light">{t("ui_conversions_b604b5ef8b", "Conversions")}</div>
                    <div className="text-[13px] font-medium text-blue-400 leading-tight">{cntConv} transaction{cntConv !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                {/* Total */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] shrink-0">
                    <svg className="w-4 h-4 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 9h6M9 12h6M9 15h4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-white/40 font-light">Total</div>
                    <div className="text-[14px] font-medium text-white/75 leading-tight">{total} transaction{total !== 1 ? "s" : ""}</div>
                    <div className="text-[10px] text-white/30">ce mois-ci</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Filtres */}
        <div className="px-4 md:px-6 pt-6 md:pt-7 pb-2 md:pb-3 flex flex-row items-stretch md:items-center gap-2">
          <div className="flex flex-1 rounded-[16px] ring-1 ring-white/[0.05] ring-inset bg-gradient-to-b from-[#101415] to-[#0d1214]">
            <SegmentedFilterControl
              tabs={[
                { key: "all",        label: t("ui_all_0c90d41d71", "Tout") },
                { key: "credit",     label: t("ui_credits_b8166276a0", "Entrées") },
                { key: "debit",      label: t("ui_debits_38c870b18f", "Sorties") },
                { key: "conversion", label: t("ui_conversions_b604b5ef8b", "Conversions") },
              ]}
              value={txFilter}
              onChange={setTxFilter}
              className="w-full"
            />
          </div>
        </div>
        </div>{/* fin conteneur header+filtres */}

        {/* Content - Zone scrollable */}
	        <div
		          ref={overlayListRef}
		          className="flex-1 min-h-0 overflow-y-auto px-4 md:px-5 pt-4 md:pt-6 pb-6 md:pb-6 flex flex-col gap-4 bg-transparent"
		          onPointerDown={(event) => {
		            maybeStartOverlayDrag(event, "list");
		          }}
		        >
          {/* Recent transactions */}
          <div className="space-y-2">
		            {movementsLoading ? (
		              <div className="rounded-[20px] px-3 py-3 ring-1 ring-white/10 ring-inset bg-white/5 text-sm text-white/70">
		                {t("ui_loading_1386baebe9", "Loading…")}
		              </div>
		            ) : movementsError ? (
		              <div className="rounded-[20px] px-3 py-3 ring-1 ring-red-500/20 ring-inset bg-red-500/10 text-sm text-red-200">
		                {String(movementsError)}
		              </div>
		            ) : recentMovements.length === 0 ? (
		              <div className="rounded-[20px] px-3 py-3 ring-1 ring-white/10 ring-inset bg-white/5 text-sm text-white/70">
		                {t(
		                  "ui_no_transactions_yet_2c7a1d9b5e",
		                  "Aucune transaction pour le moment",
		                )}
		              </div>
            ) : (
              <div className="space-y-1.5">
                {(() => {
                  const now = new Date();
                  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const weekStart = new Date(todayStart);
                  weekStart.setDate(todayStart.getDate() - todayStart.getDay());
                  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

                  const getGroup = (m) => {
                    const d = m?.createdAt ? new Date(m.createdAt) : null;
                    if (!d || !Number.isFinite(d.getTime())) return "earlier";
                    if (d >= todayStart) return "today";
                    if (d >= weekStart) return "week";
                    if (d >= monthStart) return "month";
                    return "earlier";
                  };

                  const groupLabels = {
                    today: "Aujourd'hui",
                    week: "Cette semaine",
                    month: "Ce mois-ci",
                    earlier: "Plus ancien",
                  };
                  const groupOrder = ["today", "week", "month", "earlier"];

                  const filtered = recentMovements.filter((m) => {
                    if (txFilter === "all") return true;
                    const uiT = getMovementUiType(m);
                    if (txFilter === "conversion") return normalizeKind(m?.kind) === "CONVERSION";
                    if (txFilter === "credit") return uiT === "credit";
                    if (txFilter === "debit") return uiT === "debit";
                    return true;
                  });

                  const grouped = {};
                  filtered.forEach((m) => {
                    const g = getGroup(m);
                    if (!grouped[g]) grouped[g] = [];
                    grouped[g].push(m);
                  });

                  let globalIdx = 0;
                  return groupOrder.flatMap((groupKey) => {
                    const items = grouped[groupKey];
                    if (!items || items.length === 0) return [];
                    return [
                      <div key={`group-${groupKey}`} className="px-1 pt-2 pb-1 text-[11px] font-medium tracking-wide text-white/35 uppercase">
                        {groupLabels[groupKey]}
                      </div>,
                      ...items.map((m) => {
                        const idx = globalIdx++;
                        return (() => {
                  const isConversion = normalizeKind(m?.kind) === "CONVERSION";
                  const isPaymentOut =
                    normalizeKind(m?.kind) === "PAYMENT_OUT" ||
                    normalizeKind(m?.kind) === "XRPL_PAYMENT_OUT";
                  const isPaymentIn =
                    normalizeKind(m?.kind) === "PAYMENT_IN" ||
                    normalizeKind(m?.kind) === "XRPL_PAYMENT_IN";
                  const isLatest = idx === 0;
                  const uiType = getMovementUiType(m);
                  const sign =
                    uiType === "debit"
                      ? "−"
                      : uiType === "credit"
                        ? "+"
                        : "";
                  const from = String(m?.fromCurrencyCode || "").toUpperCase();
                  const to = String(m?.toCurrencyCode || "").toUpperCase();
                  const when = formatMovementDateTime(m);
                  const rowCounterparty = String(m?.counterparty || "").trim();
                  const rowCounterpartyLabel = (() => {
                    if (!rowCounterparty) return "";
                    if (
                      rowCounterparty &&
                      rowCounterparty.toUpperCase() === "XCANNES"
                    ) {
                      return "";
                    }
                    if (isXrplAddress(rowCounterparty)) {
                      return (
                        getOnChainLabelForAddress(rowCounterparty) ||
                        truncateMiddle(rowCounterparty, 8, 6)
                      );
                    }
                    return rowCounterparty;
                  })();
                  const key =
                    m?.movementId ||
                    m?.id ||
                    `${m?.txHash || "nohash"}-${m?.ledgerIndex || "n"}-${m?.kind || ""}-${m?.createdAt || ""}-${idx}`;

	                  return (
	                    <button
	                      key={key}
	                      type="button"
	                      onClick={() => openMovementDetails(m)}
		                        className={[
		                          "w-full text-left rounded-[16px] px-3 py-2 transition-colors duration-150 ring-1 ring-inset ring-white/[0.06] bg-transparent",
		                        ].join(" ")}
		                    >
                      <div className="flex items-center gap-2.5">
                        {/* Type icon */}
                        <div className={`flex-none flex items-center justify-center w-7 h-7 text-[17px] leading-none ${
                          isConversion
                            ? "text-blue-400"
                            : uiType === "credit"
                              ? "text-emerald-400"
                              : "text-red-400"
                        }`} aria-hidden>
                          {isConversion ? "⇄" : uiType === "credit" ? "↓" : "↑"}
                        </div>
                        <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[15px] font-light text-white/90 truncate">
                            {isPaymentOut
                              ? `${t("statement_xrpl_mobile_out", "Envoyé")} ${rowCounterpartyLabel ? `à ${rowCounterpartyLabel}` : ""}`
                              : isPaymentIn
                                ? `${t("statement_xrpl_mobile_in", "Reçu")} ${rowCounterpartyLabel ? `de ${rowCounterpartyLabel}` : ""}`
                                : getMovementTitle(m)}
                          </div>
                          {isPaymentOut || isPaymentIn ? (
                            <>
                              <div className="mt-0.5 text-[11px] text-white/45 truncate">
                                {when || ""}
                              </div>
                            </>
                          ) : (
                            <div className="mt-0.5 text-[11px] text-white/45 truncate">
                              {isConversion
                                ? when || ""
                                : from && to
                                  ? `${from} → ${to}`
                                  : from || to || "—"}
                              {!isConversion && m?.note
                                ? ` · ${String(m.note)}`
                                : ""}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {!isConversion ? (
                            <div className="text-right">
                              {(() => {
                                const { amount, currency } =
                                  getMovementDisplayAmount(m);
                                return (
                                  <>
                                    <div
	                                      className={[
	                                        "text-[15px] font-light font-mono whitespace-nowrap",
		                                        uiType === "debit"
		                                          ? "text-red-400"
		                                          : uiType === "credit"
		                                            ? "text-xcannes-green"
		                                            : "text-white/90",
		                                      ].join(" ")}
                                    >
                                      {sign}
                                      {formatAmountWithSymbolLocal(
                                        amount,
                                        currency,
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        },
                                      )}
                                    </div>
                                    {when &&
                                    !isPaymentOut &&
                                    !isPaymentIn ? (
                                      <div className="text-[11px] text-white/45 mt-0.5 whitespace-nowrap">
                                        {when}
                                      </div>
                                    ) : null}
                                  </>
                                );
                              })()}
                            </div>
                          ) : null}

                          <svg
                            className="w-4 h-4 text-white/35"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                        </div>
                      </div>
                    </button>
                  );
                        })();
                      }),
                    ];
                  });
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar – mobile */}
        {!inline ? (
          <div className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20" aria-hidden>
            <span className="block w-36 h-1.5 rounded-full bg-white/80" />
          </div>
        ) : null}
        {/* Bottom bar – desktop */}
        <div className="hidden md:flex pointer-events-none justify-center pt-6 pb-4" aria-hidden>
          <span className="block w-[120px] h-[4px] rounded-full bg-white/10" />
        </div>

      </div>
    </div>
  );

  const rendered = (
    <>
      {detailOnly ? null : content}
      {transactionDetailModal}
    </>
  );

  if (inline) return rendered;
  if (typeof document === "undefined") return null;
  return createPortal(rendered, document.body);
}
