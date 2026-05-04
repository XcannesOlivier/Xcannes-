"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
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
    "Vos dernières transactions",
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
  const [shareNotice, setShareNotice] = useState("");
  const [shareNoticeTone, setShareNoticeTone] = useState("success");
  const [counterpartyLabels, setCounterpartyLabels] = useState({});
  const labelCacheRef = useRef(new Map());
  const shareNoticeTimerRef = useRef(null);
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

  const normalizeKind = useCallback(
    (value) => String(value || "").trim().toUpperCase(),
    [],
  );

  const isVisibleMovement = useCallback(
    (m) => {
      const kind = normalizeKind(m?.kind);
      if (!kind) return false;
      if (
        kind === "ALLOCATE" ||
        kind.startsWith("ALLOCATE_") ||
        kind === "DEALLOCATE" ||
        kind.startsWith("DEALLOCATE_")
      ) {
        return false;
      }
      if (kind === "XRPL_TRUSTLINE_ADD" || kind === "XRPL_TRUSTLINE_REMOVE") {
        return false;
      }
      if (kind === "WALLET_LABEL") return false;
      return true;
    },
    [normalizeKind],
  );

  const sortMovementsDesc = useCallback((list) => {
    const sorted = Array.isArray(list) ? list.slice() : [];
    sorted.sort((a, b) => {
      const leftDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const rightDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (leftDate !== rightDate) return rightDate - leftDate;

      const left = Number.isFinite(Number(a?.ledgerIndex))
        ? Number(a.ledgerIndex)
        : -Infinity;
      const right = Number.isFinite(Number(b?.ledgerIndex))
        ? Number(b.ledgerIndex)
        : -Infinity;
      if (left !== right) return right - left;
      return String(b?.txHash || "").localeCompare(String(a?.txHash || ""));
    });
    return sorted;
  }, []);

  const recentMovements = useMemo(() => {
    const visible = (movements || []).filter(isVisibleMovement);
    const sorted = sortMovementsDesc(visible);
    return sorted.slice(0, MAX_RECENT_TRANSACTIONS);
  }, [
    MAX_RECENT_TRANSACTIONS,
    isVisibleMovement,
    movements,
    sortMovementsDesc,
  ]);

  const isXrplAddress = useCallback(
    (value) =>
      /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(String(value || "").trim()),
    [],
  );

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
    [counterpartyLabels, isXrplAddress, savedAddressLabelByAddress],
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
    isXrplAddress,
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
    isXrplAddress,
    recentMovements,
    savedAddressLabelByAddress,
  ]);

  const truncateMiddle = useCallback((value, left = 10, right = 8) => {
    const s = String(value || "");
    if (!s) return "";
    if (s.length <= left + right + 1) return s;
    return `${s.slice(0, left)}…${s.slice(-right)}`;
  }, []);

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
    [normalizeKind],
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
    [normalizeKind, usdRates],
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
    [formatConversionUnits, normalizeKind, rlusdToLocal, t],
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
    setShareNotice("");
    setShareNoticeTone("success");
    if (shareNoticeTimerRef.current) {
      window.clearTimeout(shareNoticeTimerRef.current);
      shareNoticeTimerRef.current = null;
    }
    if (detailOnly) {
      onClose?.();
    }
  }, [detailOnly, onClose]);

  useEffect(() => {
    if (!detailOnly) return;
    if (detailOpen) return;
    if (!initialDetailMovement) return;
    setDetailMovement(initialDetailMovement);
    setDetailOpen(true);
  }, [detailOnly, detailOpen, initialDetailMovement]);

  const flashShareNotice = useCallback(
    (message, { tone = "success", autoClose = true } = {}) => {
      const text = String(message || "").trim();
      if (!text) return;
      setShareNotice(text);
      setShareNoticeTone(tone === "error" ? "error" : "success");
      if (shareNoticeTimerRef.current) {
        window.clearTimeout(shareNoticeTimerRef.current);
        shareNoticeTimerRef.current = null;
      }
      if (!autoClose) return;
      shareNoticeTimerRef.current = window.setTimeout(() => {
        shareNoticeTimerRef.current = null;
        closeMovementDetails();
      }, 1100);
    },
    [closeMovementDetails],
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
        // Conversion cards contain more rows (Compte + From/To/Frais).
        // Use a taller canvas to avoid cropped content on mobile shares.
        const w = 1080;
        const h = isConversion ? 900 : 720;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

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

      // Background
      ctx.fillStyle = "#0b0f10";
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(
        w * 0.5,
        h * 0.22,
        0,
        w * 0.5,
        h * 0.22,
        h * 0.95,
      );
      glow.addColorStop(0, "rgba(34,197,94,0.22)");
      glow.addColorStop(0.6, "rgba(34,197,94,0.08)");
      glow.addColorStop(1, "rgba(34,197,94,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Card
      const pad = 56;
      const cardX = pad;
      const cardY = pad;
      const cardW = w - pad * 2;
      const cardH = h - pad * 2;
      roundedRect(cardX, cardY, cardW, cardH, 42);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Header
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText("XCANNES", cardX + 44, cardY + 62);

      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.font = "800 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(ellipsize(title, cardW - 88), cardX + 44, cardY + 120);

      // Main line (amount or conversion line)
      const mainY = cardY + 220;
      if (isConversion) {
        // Keep the pair only in the title ("Convertion BASE → QUOTE")
        // to avoid duplicating it in the card.
      } else {
        ctx.font = "800 86px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = isDebit ? "#f87171" : "#22c55e";
        ctx.fillText(ellipsize(amountSigned, cardW - 88), cardX + 44, mainY);
      }

      // Meta blocks
      let y = cardY + 292;
      const metaGap = 56;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(t("ui_date_label_7a2c1b9d5e", "Date"), cardX + 44, y);
      ctx.fillText(t("ui_status_label", "Statut"), cardX + 44, y + metaGap);

      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(ellipsize(subtitle, cardW - 88), cardX + 44, y + 32);
      ctx.fillText(
        ellipsize(statusLabel || "", cardW - 88),
        cardX + 44,
        y + metaGap + 32,
      );

      // Counterparty / conversion details
      y = cardY + 430;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

      if (isPaymentOut || isPaymentIn) {
        const cpTitle = isPaymentOut
          ? t("ui_recipient_label", "Destinataire")
          : t("ui_sender_label", "Expéditeur");
        ctx.fillText(cpTitle, cardX + 44, y);
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.font = "600 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.fillText(
          ellipsize(counterpartyLabel || "—", cardW - 88),
          cardX + 44,
          y + 38,
        );
      } else if (isConversion) {
        const grossRlusd = Number(detailMovement?.amountRlusdGross);
        const netRlusd = Number(detailMovement?.amountRlusd);
        const baseRlusd = Number.isFinite(grossRlusd) ? grossRlusd : netRlusd;
        const baseUnits = rlusdToLocal(baseRlusd, from);
        const quoteUnits = rlusdToLocal(netRlusd, to);
        const fromLine = `${formatConversionUnits(baseUnits, from)}`;
        const toLine = `${formatConversionUnits(quoteUnits, to)}`;
        const spread = Number(detailMovement?.spreadRlusd);
        const feeUnits =
          Number.isFinite(spread) && spread > 0 ? rlusdToLocal(spread, to) : null;
        const feeLine =
          feeUnits != null ? `${formatConversionUnits(feeUnits, to)}` : "—";

        ctx.fillText(t("ui_account", "Compte"), cardX + 44, y);
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.font = "600 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.fillText(
          ellipsize(walletLabel || t("nav_wallet", "Wallet"), cardW - 88),
          cardX + 44,
          y + 38,
        );

        y += 86;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.fillText(t("ui_from_label_2c7a1d9b5e", "From"), cardX + 44, y);
        ctx.fillText(t("ui_to_label_7b2c1a9d5e", "To"), cardX + 44, y + 78);
        ctx.fillText(t("ui_fees", "Frais"), cardX + 44, y + 156);
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.font = "600 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.fillText(ellipsize(fromLine, cardW - 88), cardX + 44, y + 38);
        ctx.fillText(ellipsize(toLine, cardW - 88), cardX + 44, y + 116);
        ctx.fillText(ellipsize(feeLine, cardW - 88), cardX + 44, y + 194);
      }

      // Tx hash (if any)
      const hash = String(detailMovement?.txHash || "").trim();
      if (hash) {
        ctx.fillStyle = "rgba(255,255,255,0.50)";
        ctx.font = "600 18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillText(
          ellipsize(hash, cardW - 88),
          cardX + 44,
          cardY + cardH - 44,
        );
      }

        if (typeof canvas.toBlob === "function") {
          return await new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), "image/png", 0.92);
          });
        }

        // Safari fallback: toBlob may be missing
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
    isXrplAddress,
    isPreviewMode,
    normalizeKind,
    rlusdToLocal,
    t,
    toast,
    truncateMiddle,
    walletLabel,
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
  }, [detailMovement, normalizeKind, t]);

  const detailIsConversion = useMemo(() => {
    return normalizeKind(detailMovement?.kind) === "CONVERSION";
  }, [detailMovement, normalizeKind]);

  const detailIsPaymentSent = useMemo(() => {
    const kind = normalizeKind(detailMovement?.kind);
    return kind === "PAYMENT_OUT" || kind === "XRPL_PAYMENT_OUT";
  }, [detailMovement, normalizeKind]);

  const detailIsPaymentReceive = useMemo(() => {
    const kind = normalizeKind(detailMovement?.kind);
    return kind === "PAYMENT_IN" || kind === "XRPL_PAYMENT_IN";
  }, [detailMovement, normalizeKind]);

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
    isXrplAddress,
    truncateMiddle,
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
    isXrplAddress,
    truncateMiddle,
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

  const transactionDetailModal =
    detailOpen && detailMovement && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[10300] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm wallet-modal-backdrop-in"
              onClick={closeMovementDetails}
            />
            <div
              className={`relative w-full max-w-md rounded-[20px] ${modalBgClass} p-4 md:p-5 ring-1 ring-white/10 ring-inset shadow-[0_24px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] wallet-modal-lift-in`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
                    {detailIsConversion ? detailConversionHeader : detailTypeLabel}
                  </div>
                  {!detailIsConversion ? (
                    <div
                      className={[
                        "mt-1 text-[22px] md:text-[26px] font-bold font-mono whitespace-nowrap",
                        getMovementUiType(detailMovement) === "debit"
                          ? "text-red-400"
                          : getMovementUiType(detailMovement) === "credit"
                            ? "text-xcannes-green"
                            : "text-white/90",
                      ].join(" ")}
                    >
                      {(() => {
                        const uiType = getMovementUiType(detailMovement);
                        const { amount, currency } =
                          getMovementDisplayAmount(detailMovement);
                        const sign =
                          uiType === "debit"
                            ? "−"
                            : uiType === "credit"
                              ? "+"
                              : "";
                        return `${sign}${formatAmountWithSymbolLocal(
                          amount,
                          currency,
                        )}`;
                      })()}
                    </div>
                  ) : null}
                </div>
                {/* closed via backdrop click */}
              </div>

              <div className="h-px bg-white/[0.04] my-3" />

              {/* Status & Date */}
              <div className="space-y-3">
                <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
                  {t("ui_status_and_date", "Statut & date")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <div className="text-xs text-white/60">
                      {t("ui_status_label", "Statut")}
                    </div>
                    <div className="mt-0.5 text-sm text-white/90 font-semibold">
                      {detailStatusLabel}
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <div className="text-xs text-white/60">
                      {t("ui_date_label_7a2c1b9d5e", "Date")}
                    </div>
                    <div className="mt-0.5 text-sm text-white/90 font-semibold truncate">
                      {formatMovementDateTime(detailMovement)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/[0.04] my-3" />

              {/* Details */}
              <div className="space-y-2">
                <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
                  {t("ui_details", "Détails")}
                </div>
                <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/60">
                      {t("ui_type_label_8b1a4d2c7e", "Type")}
                    </span>
                    <span className="text-sm font-semibold text-white/90">
                      {(() => {
                        const k = normalizeKind(detailMovement?.kind);
                        if (k === "PAYMENT_OUT" || k === "XRPL_PAYMENT_OUT") return t("ui_type_sent", "Envoyé");
                        if (k === "PAYMENT_IN" || k === "XRPL_PAYMENT_IN") return t("ui_type_received", "Reçu");
                        if (k === "CONVERSION") return t("ui_type_conversion", "Conversion");
                        if (k === "RECONCILE") return t("ui_type_reconcile", "Ajustement");
                        return String(detailMovement?.kind || "").trim() || "—";
                      })()}
                    </span>
                  </div>
                  {detailIsPaymentSent ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-white/60">
                          {t("ui_currency_label_2f7a1c9b5e", "Devise")}
                        </span>
                        <span className="text-sm font-semibold text-white/90 font-mono">
                          {String(detailMovement?.fromCurrencyCode || "")
                            .toUpperCase()
                            .trim() || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-white/60">
                          {t(
                            "ui_recipient_label_2c7a1d9b5e",
                            "Destinataire",
                          )}
                        </span>
                        <span className="text-sm font-semibold text-white/90 truncate">
                          {detailRecipientLabel}
                        </span>
                      </div>
                    </>
                  ) : detailIsPaymentReceive ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-white/60">
                          {t("ui_currency_label_2f7a1c9b5e", "Devise")}
                        </span>
                        <span className="text-sm font-semibold text-white/90 font-mono">
                          {String(detailMovement?.toCurrencyCode || "")
                            .toUpperCase()
                            .trim() || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-white/60">
                          {t(
                            "ui_sender_label_2c7a1d9b5e",
                            "Expéditeur",
                          )}
                        </span>
                        <span className="text-sm font-semibold text-white/90 truncate">
                          {detailSenderLabel}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-white/60">
                          {t("ui_from_label_2c7a1d9b5e", "From")}
                        </span>
                        <span className="text-sm font-semibold text-white/90 font-mono">
                          {detailIsConversion
                            ? detailConversionFrom
                            : String(detailMovement?.fromCurrencyCode || "")
                                .toUpperCase()
                                .trim() || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-white/60">
                          {t("ui_to_label_7b2c1a9d5e", "To")}
                        </span>
                        <span className="text-sm font-semibold text-white/90 font-mono">
                          {detailIsConversion
                            ? detailConversionTo
                            : String(detailMovement?.toCurrencyCode || "")
                                .toUpperCase()
                                .trim() || "—"}
                        </span>
                      </div>
                      {detailIsConversion ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-white/60">
                            {t("ui_fx_rate", "Taux")}
                          </span>
                          <span className="text-sm font-semibold text-white/90 font-mono">
                            {detailConversionFee}
                          </span>
                        </div>
                      ) : detailMovement?.fxRate ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-white/60">
                            {t("ui_fx_rate", "Taux")}
                          </span>
                          <span className="text-sm font-semibold text-white/90 font-mono">
                            {Number(detailMovement.fxRate).toLocaleString(
                              locale,
                              {
                                maximumFractionDigits: 8,
                              },
                            )}
                          </span>
                        </div>
                      ) : null}
                    </>
                  )}
                  {detailMovement?.note ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-white/60">
                        {t("ui_note", "Note")}
                      </span>
                      <span className="text-sm font-semibold text-white/90 truncate">
                        {String(detailMovement.note)}
                      </span>
                    </div>
                  ) : null}
                  {detailMovement?.counterparty &&
                  !detailIsPaymentSent &&
                  !detailIsPaymentReceive ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-white/60">
                        {t("ui_counterparty", "Contrepartie")}
                      </span>
                      <span className="text-sm font-semibold text-white/90 font-mono truncate">
                        {isXrplAddress(detailMovement.counterparty)
                          ? truncateMiddle(detailMovement.counterparty, 8, 6)
                          : String(detailMovement.counterparty)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Counterparty copy */}
              {detailMovement?.counterparty &&
              isXrplAddress(detailMovement.counterparty) &&
              !detailIsPaymentSent ? (
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await copyToClipboard(
                        detailMovement.counterparty,
                        t("ui_copied_address", "Adresse copiée"),
                      );
                      setCopiedCounterparty(true);
                      window.setTimeout(
                        () => setCopiedCounterparty(false),
                        1200,
                      );
                    }}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-[20px] bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-semibold"
                  >
                    {t("ui_copy_address", "Copier l’adresse")}
                  </button>
                  {copiedCounterparty ? (
                    <span className="text-[10px] text-xcannes-green/90 font-medium">
                      {t("ui_copied", "Copié")}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="h-px bg-white/[0.04] my-3" />

              {/* Technical */}
              {detailMovement?.txHash ? (
                <div className="space-y-2">
                  <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
                    {t("ui_transaction", "Transaction")}
                  </div>
                  <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-white/60">
                          {t("ui_tx_hash_label_2b7c1a9d5e", "Hash")}
                        </div>
                        <div className="mt-0.5 text-sm text-white/90 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                          {truncateMiddle(detailMovement.txHash, 10, 8)}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-none">
                        <button
                          type="button"
                          onClick={async () => {
                            await copyToClipboard(
                              detailMovement.txHash,
                              t("ui_copied_hash", "Hash copié"),
                            );
                            setCopiedHash(true);
                            window.setTimeout(
                              () => setCopiedHash(false),
                              1200,
                            );
                          }}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-[20px] bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                          aria-label={t("ui_copy_hash", "Copy hash")}
                          title={t("ui_copy_hash", "Copy hash")}
                        >
                          ⧉
                        </button>
                        {copiedHash ? (
                          <span className="text-[10px] text-xcannes-green/90 font-medium">
                            {t("ui_copied", "Copié")}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleShareMovement}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-[20px] bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                          aria-label={t("ui_share", "Partager")}
                          title={t("ui_share", "Partager")}
                        >
                          ↗
                        </button>
                      </div>
                    </div>
                    {shareNotice ? (
                      <div
                        className={[
                          "mt-3 text-xs font-medium",
                          shareNoticeTone === "error"
                            ? "text-red-200"
                            : "text-xcannes-green/90",
                        ].join(" ")}
                      >
                        {shareNotice}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

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
        className={`relative w-full wallet-modal-panel wallet-modal-no-top-highlight-mobile ${modalBgClass} flex flex-col overflow-hidden z-[10201] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] ${
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
        {/* Header */}
        <div
          className={`relative flex-shrink-0 bg-[#111518] shadow-[inset_0_16px_28px_rgba(255,255,255,0.03),inset_0_-46px_70px_rgba(0,0,0,0.55)] px-4 md:px-5 py-4 before:content-[''] before:absolute before:left-0 before:right-0 before:bottom-0 before:h-px before:bg-white/10`}
          onPointerDown={(event) => {
            maybeStartOverlayDrag(event, "fixed");
          }}
        >
          {swipeEnabled ? (
            <div className="md:hidden flex justify-center -mt-1 pt-1 pb-2" aria-hidden>
              <span className="block w-12 h-1.5 rounded-full bg-white/20" />
            </div>
          ) : null}
          <div className="flex justify-center">
            <div className="min-w-0 flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center">
                <h2 className="text-[30px] md:text-[34px] font-bold text-white/95 tracking-tight leading-tight text-center">
                  {globalTitle}
                </h2>
                {noticeVariant === "demo" ? (
                  <span className="ml-2 inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-[52ch] leading-relaxed">
                {t(
                  "ui_global_statement_subtitle_recent_20",
                  "Consultez vos transactions récentes et ouvrez-en une pour voir les détails.",
                )}
              </p>
            </div>
            {/* close via swipe/backdrop */}
          </div>

            <div className="mt-6 mb-4 flex justify-center">
            <div className="relative w-auto min-w-[200px] max-w-[260px]" ref={accountDropdownRef}>
              <p className="text-[22px] md:text-[21px] text-white/85 font-medium mb-1 text-center">
                {t("ui_current_account_plain", "Compte actuel")}
              </p>
              <button
                type="button"
                onClick={() => setAccountDropdownOpen((prev) => !prev)}
                className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-elevated ring-1 ring-inset transition-all ${accountDropdownOpen ? "rounded-t-[10px] rounded-b-none ring-white/20" : "rounded-[10px] ring-white/15"}`}
                aria-haspopup="menu"
                aria-expanded={accountDropdownOpen}
                title={t("ui_current_account_plain", "Compte actuel")}
              >
                <span className="h-3 w-3 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0 animate-pulse" aria-hidden />
                <span className="text-white/95 text-sm font-semibold truncate min-w-0 flex-1 text-center">
                  {walletLabel || t("nav_wallet", "Wallet")}
                </span>
                <svg
                  className="w-4 h-4 text-white/45 transition-colors"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                  <circle cx="12" cy="12" r="2.6" />
                  {accountDropdownOpen ? <path d="M4 20L20 4" /> : null}
                </svg>
              </button>
              {accountDropdownOpen && walletAddress ? (
                <div className="absolute top-full left-0 z-[200] w-full mt-1 rounded-[10px] ring-1 ring-white/20 ring-inset bg-elevated px-4 py-3 shadow-[0_8px_18px_rgba(0,0,0,0.45)]">
                  <p className="text-[13px] md:text-[14px] text-white/60 mb-2">
                    {t("ui_account_address", "Adresse du compte")}
                  </p>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      className={`min-w-0 flex-1 text-left text-xs md:text-sm text-white/55 font-mono font-light ${
                        accountAddressExpanded ? "break-all whitespace-normal" : "truncate"
                      }`}
                      title={walletAddress}
                      onClick={() => setAccountAddressExpanded((prev) => !prev)}
                      aria-label={t("ui_toggle_wallet_address_truncation", "Afficher l'adresse complète")}
                    >
                      {accountAddressExpanded
                        ? walletAddress
                        : `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard?.writeText?.(walletAddress);
                          setAccountCopyNotice(t("ui_copied_address", "Adresse copiée"));
                          if (accountCopyNoticeTimerRef.current) clearTimeout(accountCopyNoticeTimerRef.current);
                          accountCopyNoticeTimerRef.current = window.setTimeout(() => {
                            setAccountCopyNotice("");
                          }, 3000);
                        } catch {
                          /* ignore */
                        }
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
                  <div
                    className={`mt-1.5 text-[11px] text-xcannes-green/85 transition-opacity duration-200 ${
                      accountCopyNotice ? "opacity-100" : "opacity-0"
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {accountCopyNotice || " "}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Content - Zone scrollable */}
        <div
          ref={overlayListRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 md:px-5 py-4 flex flex-col gap-4 bg-gradient-to-b from-[#101415] to-[#0d1214]"
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
                {recentMovements.filter((m) => {
                  if (txFilter === "all") return true;
                  const uiT = getMovementUiType(m);
                  if (txFilter === "conversion") return normalizeKind(m?.kind) === "CONVERSION";
                  if (txFilter === "credit") return uiT === "credit";
                  if (txFilter === "debit") return uiT === "debit";
                  return true;
                }).map((m, idx) => {
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
                          "w-full text-left rounded-[20px] px-3 transition-colors duration-150",
                          isLatest
                            ? "py-3 ring-1 ring-inset bg-[#101415] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-14px_22px_rgba(0,0,0,0.5)] ring-white/20 transform-gpu scale-[1.03] origin-center drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] transition-transform duration-150"
                            : "py-2 ring-1 ring-inset ring-white/[0.06] bg-[#101415] shadow-[inset_0_-14px_18px_rgba(0,0,0,0.8)]",
                        ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[15px] font-medium text-white/90 truncate">
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
	                                        "text-[15px] font-semibold font-mono whitespace-nowrap",
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
                            className="w-5 h-5 text-white/35"
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
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="relative px-4 md:px-6 py-3 md:py-4 pb-2 md:pb-4 flex flex-row md:flex-row items-stretch md:items-center gap-2 bg-[#111518] shadow-[inset_0_-16px_28px_rgba(255,255,255,0.03),inset_0_46px_70px_rgba(0,0,0,0.55)] before:content-[''] before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-white/10">
          {/* Filtres */}
          <div className="flex flex-1 md:flex-1 items-center rounded-[16px] p-1 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-[#101415] to-[#0d1214]">
            {[
              { key: "all", label: t("ui_all_0c90d41d71", "Tout") },
              { key: "credit", label: t("ui_credits_b8166276a0", "Entrées") },
              { key: "debit", label: t("ui_debits_38c870b18f", "Sorties") },
              { key: "conversion", label: t("ui_conversions_b604b5ef8b", "Conversions") },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTxFilter(item.key)}
                className={`px-3 py-3 flex-1 text-center rounded-[12px] text-sm font-medium transition-colors whitespace-nowrap ${
                  txFilter === item.key
                    ? item.key === "all"
                      ? "bg-[#111518] text-white shadow-[inset_0_-14px_18px_rgba(0,0,0,0.8)]"
                      : item.key === "credit"
                        ? "bg-green-500/15 text-green-300"
                        : item.key === "debit"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-blue-500/15 text-blue-300"
                    : "text-white/60 hover:text-white/80 bg-[#111518] hover:bg-[#111518]"
                }`}
              >
                {item.label}
              </button>
            ))}
            {/* Icône télécharger intégrée dans le bloc filtres — mobile uniquement */}
            <button
              onClick={handleExportPdf}
              disabled={exportFormat === "pdf"}
              className="md:hidden shrink-0 px-2 py-2 text-white/60 hover:text-white transition-colors disabled:opacity-40"
              aria-label={t("ui_export_pdf_9c8d16b4fe", "Télécharger")}
            >
              <ShareIcon className={`w-5 h-5 ${exportFormat === "pdf" ? "opacity-40" : ""}`} />
            </button>
          </div>
          {/* Export — droite, desktop uniquement */}
          <div className="hidden md:flex justify-end gap-2 shrink-0">
            <button
              onClick={handleExportPdf}
              disabled={exportFormat === "pdf"}
              className="px-4 py-2.5 rounded-[14px] text-sm font-semibold transition-colors disabled:opacity-50 text-white/80 hover:text-white"
            >
              {exportFormat === "pdf" ? (
                <span className="inline-flex items-center gap-2">
                  <ShareIcon className="w-5 h-5 opacity-60" />
                  <span>{t("ui_loading_1386baebe9", "Loading…")}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <ShareIcon className="w-5 h-5" />
                  <span>{t("ui_export_pdf_9c8d16b4fe", "Télécharger")}</span>
                </span>
              )}
            </button>
          </div>
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
