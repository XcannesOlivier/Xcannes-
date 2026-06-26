"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import CurrencyTransactionDetailModal from "./CurrencyTransactionDetailModal";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { escapeHtml, openPrintWindow } from "@/utils/statementExport";
import { useTranslation } from "next-i18next";
import StatementMonthSelect from "./StatementMonthSelect";
import { apiUrl } from "@/lib/runtimeConfig";
import {
  formatAmountWithSymbol,
  getDisplayCurrencyCode,
  USD_STABLECOINS,
} from "../walletDashboardConfig";
import { truncateMiddle } from "../modals/walletModalShared";
import {
  HIGHLIGHT_DURATION_MS,
  STATEMENT_LAYOUTS,
  ShareIcon,
  getCurrencyFlag,
  isSvgIcon,
  stripCountSuffix,
} from "./statementShared";
import useStatementWalletLabel from "./useStatementWalletLabel";
import useStatementDocHash from "./useStatementDocHash";
import useCurrencyStatementData from "./useCurrencyStatementData";
import useCurrencyStatementFormatters from "./useCurrencyStatementFormatters";
import XrpNetworkStatement from "./XrpNetworkStatement";
import { isXrplAddress } from "../utils/xrplAddress";
import { useFlashNotice } from "../hooks/useFlashNotice";
import SegmentedFilterControl from "@/components/ui/SegmentedFilterControl";

/**
 * Composant de relevé bancaire pour une devise spécifique.
 * Refactorisé : la logique data / formatters / walletLabel / docHash
 * est déléguée à des hooks dédiés.
 */
export default function CurrencyStatement({
  currency,
  balance,
  walletAddress,
  walletLabelOverride = "",
  isPreviewMode = false,
  noticeVariant = "preview",
  transactions = [],
  loading = false,
  error = null,
  period = "",
  variant = "full",
  isClosing = false,
  inline = false,
  usdRates = {},
  hasRlusdTrustline = false,
  rlusdBalance: _rlusdBalance = null,
  statementMonths = [],
  highlightTransactionId = null,
  onClose,
  toast,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const isInlineDesktop = variant === "inline-desktop";
  const normalizedCurrency = useMemo(
    () => String(currency || "").toUpperCase(),
    [currency],
  );
  const isXrpNetworkView = normalizedCurrency === "XRP";
  const statementPanelOverflowClass = isXrpNetworkView
    ? "overflow-y-auto overscroll-contain touch-pan-y"
    : "overflow-hidden";
  const statementPanelScrollStyle = isXrpNetworkView
    ? { WebkitOverflowScrolling: "touch" }
    : undefined;
  const displayCurrency = useMemo(
    () => getDisplayCurrencyCode(normalizedCurrency),
    [normalizedCurrency],
  );
  const currencyDescription = useMemo(
    () => String(getCurrencyDescription(normalizedCurrency) || "").trim(),
    [normalizedCurrency],
  );
  const headerTitle = useMemo(() => {
    if (isXrpNetworkView) {
      return t(
        "ui_xrp_ledger_native_token_title",
        "XRP Ledger Native Token",
      );
    }
    return currencyDescription || displayCurrency;
  }, [currencyDescription, displayCurrency, isXrpNetworkView, t]);

  /* ── RLUSD → local-currency converter ───────────────────
   * All internal amounts (balance, tx.amount, tx.runningBalance) are
   * stored in RLUSD.  For non-USD/RLUSD currencies we must divide by
   * the usdRates entry (RLUSD-per-1-unit) so the statement shows the
   * actual local-currency value that fluctuates with the FX rate.
   *
   * NOTE: The `balance` prop (header) is already in local-currency units
   * (converted in useTokenDisplayLabels).  Only transaction amounts
   * (tx.amount, tx.runningBalance) need rlusdToLocal conversion.
   */
  const rlusdToLocal = useMemo(() => {
    const code = normalizedCurrency;
    // USD and RLUSD are 1:1 — no conversion needed.
    if (!code || USD_STABLECOINS.includes(code)) {
      return (rlusdAmount) => {
        const v = Number(rlusdAmount);
        return Number.isFinite(v) ? v : 0;
      };
    }
    const rate = Number(usdRates?.[code]);
    if (!Number.isFinite(rate) || rate <= 0) {
      // No rate available — fall back to raw RLUSD value.
      return (rlusdAmount) => {
        const v = Number(rlusdAmount);
        return Number.isFinite(v) ? v : 0;
      };
    }
    return (rlusdAmount) => {
      const v = Number(rlusdAmount);
      if (!Number.isFinite(v)) return 0;
      return v / rate;
    };
  }, [normalizedCurrency, usdRates]);

  /* ── local state ───────────────────────────────────────── */
  const [filter, setFilter] = useState("all");
  const [exportFormat, setExportFormat] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [accountAddressExpanded, setAccountAddressExpanded] = useState(false);
  const [accountCopyNotice, setAccountCopyNotice] = useState("");
  const accountCopyNoticeTimerRef = useRef(null);
  const clearAccountCopyNoticeTimer = useCallback(() => {
    if (!accountCopyNoticeTimerRef.current) return;
    clearTimeout(accountCopyNoticeTimerRef.current);
    accountCopyNoticeTimerRef.current = null;
  }, []);
  const [footerDropdownOpen, setFooterDropdownOpen] = useState(false);
  const [footerAddressExpanded, setFooterAddressExpanded] = useState(false);
  const [footerCopyNotice, setFooterCopyNotice] = useState("");
  const footerCopyNoticeTimerRef = useRef(null);
  const clearFooterCopyNoticeTimer = useCallback(() => {
    if (!footerCopyNoticeTimerRef.current) return;
    clearTimeout(footerCopyNoticeTimerRef.current);
    footerCopyNoticeTimerRef.current = null;
  }, []);
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [isMobileDate, setIsMobileDate] = useState(false);
  const [highlightedTransactionId, setHighlightedTransactionId] =
    useState(null);
  const [detailTx, setDetailTx] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLabel, setDetailLabel] = useState("");
  const [detailLabelLoading, setDetailLabelLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const { notice: shareNotice, noticeTone: shareNoticeTone, flashNotice: _flashNotice, resetNotice: resetShareNotice } = useFlashNotice();
  const copiedHashTimerRef = useRef(null);
  const copiedAddressTimerRef = useRef(null);
  const [counterpartyLabels, setCounterpartyLabels] = useState({});
  const labelCacheRef = useRef(new Map());
  const highlightRowRef = useRef(null);
  const highlightTimerRef = useRef(null);
  const [overlayDragging, setOverlayDragging] = useState(false);
  const [overlayTranslateY, setOverlayTranslateY] = useState(0);
  const overlayRef = useRef(null);
  const accountDropdownRef = useRef(null);
  const footerDropdownRef = useRef(null);
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

  /* ── extracted hooks ───────────────────────────────────── */
  const walletLabel = useStatementWalletLabel(
    walletAddress,
    walletLabelOverride,
  );

  const data = useCurrencyStatementData({
    transactions,
    statementMonths,
    balance,
    normalizedCurrency,
    filter,
    selectedMonth,
    setSelectedMonth,
    locale,
  });

  const fmt = useCurrencyStatementFormatters({
    locale,
    displayCurrency,
    isMobileDate,
    isPreviewMode,
    compactLabels: isInlineDesktop,
  });

  /* ── destructure data hook ─────────────────────────────── */
  const {
    availableMonths,
    transactionsWithDisplayBalance,
  } = data;

  const currentPeriod = data.currentPeriod || fallbackPeriod;

  /* ── destructure formatters hook ───────────────────────── */
  const {
    parseConversionPair,
    getLocalizedDescription,
    formatDate,
    formatAmountLocal: formatAmountWithSymbolLocal,
  } = fmt;

  // Format a RLUSD amount as local-currency units.
  // Transaction amounts from the backend are in RLUSD; divide by rate
  // to get the local value (EUR, GBP…) that fluctuates with the FX rate.
  // balance (header) is already in local units so use formatAmountWithSymbolLocal directly.
  const formatAmountRlusdAsLocal = useCallback(
    (rlusdAmount) => formatAmountWithSymbolLocal(rlusdToLocal(rlusdAmount)),
    [formatAmountWithSymbolLocal, rlusdToLocal],
  );

  const openTxDetails = useCallback((tx) => {
    if (!tx) return;
    setDetailTx(tx);
    setDetailOpen(true);
  }, []);

  const closeTxDetails = useCallback(() => {
    setDetailOpen(false);
    setDetailTx(null);
    setDetailLabel("");
    setDetailLabelLoading(false);
    setCopiedHash(false);
    setCopiedAddress(false);
    resetShareNotice();
    if (copiedHashTimerRef.current) {
      window.clearTimeout(copiedHashTimerRef.current);
      copiedHashTimerRef.current = null;
    }
    if (copiedAddressTimerRef.current) {
      window.clearTimeout(copiedAddressTimerRef.current);
      copiedAddressTimerRef.current = null;
    }
  }, [resetShareNotice]);

  const flashShareNotice = useCallback(
    (message, opts = {}) => _flashNotice(message, { ...opts, onAutoClose: closeTxDetails }),
    [_flashNotice, closeTxDetails],
  );

  const formatDateTime = useCallback(
    (tx) => {
      const raw = tx?.createdAt || tx?.date || "";
      const parsed = new Date(raw);
      if (!Number.isFinite(parsed.getTime())) return String(raw || "");
      // Mobile: no seconds in the transaction detail cards
      if (isMobileDate) {
        // Fixed compact format requested: "MM/DD HH:mm"
        const md = new Intl.DateTimeFormat("en-US", {
          month: "2-digit",
          day: "2-digit",
        }).format(parsed);
        const hm = new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(parsed);
        return `${md} ${hm}`;
      }
      return parsed.toLocaleString(locale);
    },
    [isMobileDate, locale],
  );

  const getCounterpartyAddressFromTx = useCallback(
    (tx) => {
      const trimmed = (v) => String(v || "").trim();
      const normalized = (v) => {
        const s = trimmed(v);
        if (!s || s.toUpperCase() === "XCANNES") return "";
        return s;
      };
      const isOutgoing =
        tx?.type === "debit" ||
        String(tx?.kind || "").toUpperCase().includes("OUT");

      const candidates = [];
      const push = (v) => {
        const s = normalized(v);
        if (s) candidates.push(s);
      };

      // Common fields (schemas vary between on-chain/off-chain currency lines)
      push(tx?.counterparty);
      push(tx?.counterpartyAddress);
      push(tx?.counterpartyXrplAddress);

      if (isOutgoing) {
        push(tx?.to);
        push(tx?.destination);
        push(tx?.destinationAddress);
        push(tx?.recipient);
        push(tx?.recipientAddress);
        push(tx?.beneficiary);
        push(tx?.beneficiaryAddress);

        push(tx?.from);
        push(tx?.source);
        push(tx?.sourceAddress);
        push(tx?.sender);
        push(tx?.senderAddress);
      } else {
        push(tx?.from);
        push(tx?.source);
        push(tx?.sourceAddress);
        push(tx?.sender);
        push(tx?.senderAddress);

        push(tx?.to);
        push(tx?.destination);
        push(tx?.destinationAddress);
        push(tx?.recipient);
        push(tx?.recipientAddress);
        push(tx?.beneficiary);
        push(tx?.beneficiaryAddress);
      }

      return candidates.find((addr) => isXrplAddress(addr)) || "";
    },
    [],
  );

  useEffect(() => {
    if (!detailOpen || !detailTx) return;
    const counterparty = getCounterpartyAddressFromTx(detailTx);
    if (!counterparty || !isXrplAddress(counterparty)) {
      setDetailLabel("");
      setDetailLabelLoading(false);
      return;
    }
    const cached = labelCacheRef.current.get(counterparty);
    if (cached != null) {
      setDetailLabel(cached);
      setDetailLabelLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLabelLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          apiUrl(`/wallet/label?address=${encodeURIComponent(counterparty)}`),
        );
        const data = await res.json().catch(() => ({}));
        const label = String(data?.label || "").trim();
        labelCacheRef.current.set(counterparty, label);
        if (!cancelled) {
          setCounterpartyLabels((prev) =>
            prev?.[counterparty] === label
              ? prev
              : { ...(prev || {}), [counterparty]: label },
          );
        }
        if (!cancelled) setDetailLabel(label);
      } catch {
        if (!cancelled) setDetailLabel("");
      } finally {
        if (!cancelled) setDetailLabelLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [detailOpen, detailTx, getCounterpartyAddressFromTx]);

  /* ── prefetch counterparty labels for the list ─────────── */
  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const list = Array.isArray(transactionsWithDisplayBalance)
      ? transactionsWithDisplayBalance
      : [];
    if (!list.length) return () => {};

    // Only prefetch for a limited number of recent rows (avoids spamming the API).
    const candidates = [];
    for (const tx of list) {
      const addr = getCounterpartyAddressFromTx(tx);
      if (!addr || addr.toUpperCase() === "XCANNES") continue;
      if (!isXrplAddress(addr)) continue;
      candidates.push(addr);
      if (candidates.length >= 40) break;
    }

    const unique = Array.from(new Set(candidates));
    const toFetch = unique.filter((addr) => {
      if (labelCacheRef.current.has(addr)) return false;
      if (counterpartyLabels?.[addr] != null) return false;
      return true;
    });
    if (!toFetch.length) return () => {};

    let cancelled = false;
    (async () => {
      for (const addr of toFetch) {
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
  }, [transactionsWithDisplayBalance, counterpartyLabels, getCounterpartyAddressFromTx]);

  /* ── doc hash ──────────────────────────────────────────── */
  const statementHashInput = useMemo(() => {
    const safeBalance = Number.isFinite(Number(balance)) ? Number(balance) : 0;
    const txPayload = (transactionsWithDisplayBalance || []).map((tx) => ({
      date: tx?.date || "",
      type: tx?.type || "",
      category: tx?.category || "",
      description: tx?.description || "",
      amount: Number.isFinite(Number(tx?.amount)) ? Number(tx.amount) : 0,
      runningBalance: Number.isFinite(Number(tx?.displayRunningBalance))
        ? Number(tx.displayRunningBalance)
        : Number.isFinite(Number(tx?.runningBalance))
          ? Number(tx.runningBalance)
          : 0,
      counterparty: tx?.counterparty || "",
    }));
    return JSON.stringify({
      version: 1,
      type: "currency_statement",
      walletAddress: walletAddress || "",
      currency: normalizedCurrency,
      period: currentPeriod,
      balance: safeBalance,
      transactions: txPayload,
    });
  }, [
    balance,
    currentPeriod,
    transactionsWithDisplayBalance,
    normalizedCurrency,
    walletAddress,
  ]);

  const docHash = useStatementDocHash(statementHashInput);

  /* ── resize listener ───────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobileDate(window.innerWidth < 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!accountDropdownOpen) setAccountAddressExpanded(false);
  }, [accountDropdownOpen]);

  useEffect(() => {
    setAccountAddressExpanded(false);
  }, [walletAddress]);

  useEffect(() => {
    if (!accountDropdownOpen) {
      setAccountCopyNotice("");
      clearAccountCopyNoticeTimer();
    }
  }, [accountDropdownOpen, clearAccountCopyNoticeTimer]);

  useEffect(() => {
    setAccountCopyNotice("");
    clearAccountCopyNoticeTimer();
  }, [walletAddress, clearAccountCopyNoticeTimer]);

  useEffect(() => {
    return () => {
      clearAccountCopyNoticeTimer();
    };
  }, [clearAccountCopyNoticeTimer]);

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

  /* ── footer dropdown ──────────────────────────────────── */
  useEffect(() => {
    if (!footerDropdownOpen) {
      setFooterAddressExpanded(false);
      setFooterCopyNotice("");
      clearFooterCopyNoticeTimer();
    }
  }, [footerDropdownOpen, clearFooterCopyNoticeTimer]);

  useEffect(() => {
    return () => {
      clearFooterCopyNoticeTimer();
    };
  }, [clearFooterCopyNoticeTimer]);

  useEffect(() => {
    if (!footerDropdownOpen) return;
    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target) return;
      if (footerDropdownRef.current && footerDropdownRef.current.contains(target)) return;
      setFooterDropdownOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [footerDropdownOpen]);

  /* ── highlight timer ───────────────────────────────────── */
  useEffect(() => {
    if (!highlightTransactionId) return undefined;
    setHighlightedTransactionId(highlightTransactionId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedTransactionId(null);
    }, HIGHLIGHT_DURATION_MS);
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [highlightTransactionId]);

  useEffect(() => {
    if (!highlightedTransactionId) return;
    const node = highlightRowRef.current;
    if (!node) return;
    const raf = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [filter, highlightedTransactionId, transactions]);

  /* ── estimated USD ─────────────────────────────────────── */
  const estimatedUsd = useMemo(() => {
    const value = Number.parseFloat(balance || 0) || 0;
    const code = normalizedCurrency;
    if (!code) return null;
    const rate = usdRates?.[code];
    if (Number.isFinite(rate) && rate > 0) return value * rate;
    if (USD_STABLECOINS.includes(code)) return value;
    // For XRP and currencies without a rate, return null to hide the
    // USD estimate rather than displaying a misleading value.
    return null;
  }, [balance, normalizedCurrency, usdRates]);

  /* ── timeline groups (Today / Yesterday / date) ────────── */
  const timelineGroups = useMemo(() => {
    const list = Array.isArray(transactionsWithDisplayBalance)
      ? [...transactionsWithDisplayBalance]
      : [];

    const getTxTime = (tx) => {
      const raw = tx?.createdAt || tx?.date || "";
      const d = new Date(raw);
      const tms = d.getTime();
      return Number.isFinite(tms) ? tms : 0;
    };
    list.sort((a, b) => getTxTime(b) - getTxTime(a));

    const startOfDay = (d) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const labelFor = (date) => {
      const day = startOfDay(date);
      if (day.getTime() === today.getTime()) {
        return t("ui_today_8b1a4d2c7e", "Today");
      }
      if (day.getTime() === yesterday.getTime()) {
        return t("ui_yesterday_1c7a9d3b5e", "Yesterday");
      }
      return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    };

    const keyFor = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    const groups = [];
    const map = new Map();
    for (const tx of list) {
      const raw = tx?.createdAt || tx?.date || "";
      const d = new Date(raw);
      const tms = d.getTime();
      const date = Number.isFinite(tms) ? d : new Date(0);
      const key = keyFor(date);
      if (!map.has(key)) {
        const group = { key, label: labelFor(date), date, transactions: [] };
        map.set(key, group);
        groups.push(group);
      }
      map.get(key).transactions.push(tx);
    }

    return groups;
  }, [transactionsWithDisplayBalance, locale, t]);

  const formatCounterpartyCompact = useCallback((counterparty) => {
    const raw = String(counterparty || "").trim();
    if (!raw || raw.toUpperCase() === "XCANNES") return "";
    if (raw.length <= 16) return raw;
    return `${raw.slice(0, 9)}…${raw.slice(-5)}`;
  }, []);

  const getTimelineIcon = useCallback((tx) => {
    if (tx?.category === "exchange") return "⇄";
    if (tx?.type === "credit") return "↓";
    return "↑";
  }, []);

  const getTimelineLabel = useCallback(
    (tx) => {
      if (!tx) return "";
      if (tx?.category === "exchange") {
        const pair = parseConversionPair(tx?.description || "");
        if (pair?.from && pair?.to) return `${pair.from} → ${pair.to}`;
        const localized = String(getLocalizedDescription(tx) || "").trim();
        return localized.replace(/^Conversion\\s*/i, "").trim() || localized;
      }
      const base =
        tx?.type === "credit"
          ? t("statement_xrpl_mobile_in", "Reçu")
          : t("statement_xrpl_mobile_out", "Envoyé");
      const addr = getCounterpartyAddressFromTx(tx);
      const cachedLabel =
        (addr && (counterpartyLabels?.[addr] ?? labelCacheRef.current.get(addr))) ||
        "";
      const name = cachedLabel ? cachedLabel : formatCounterpartyCompact(addr);
      return name ? `${base} de ${name}` : base;
    },
    [
      counterpartyLabels,
      formatCounterpartyCompact,
      getCounterpartyAddressFromTx,
      getLocalizedDescription,
      parseConversionPair,
      t,
    ],
  );

  const isQuoteSideConversion = useCallback(
    (tx) => {
      if (!tx || tx?.category !== "exchange") return false;
      const pair = parseConversionPair(tx?.description || "");
      if (!pair?.to) return false;
      return String(pair.to || "").trim().toUpperCase() === normalizedCurrency;
    },
    [normalizedCurrency, parseConversionPair],
  );

  /* ── ledger status ─────────────────────────────────────── */
  const ledgerEvidenceCount = useMemo(
    () => (transactions || []).filter((tok) => tok?.txHash).length,
    [transactions],
  );

  const ledgerStatus = useMemo(() => {
    if (isPreviewMode) return "preview";
    if (!["XRP", "RLUSD"].includes(normalizedCurrency)) return "offchain";
    if (ledgerEvidenceCount > 0) return "verified";
    return "available";
  }, [isPreviewMode, ledgerEvidenceCount, normalizedCurrency]);

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

  /* ── export helpers ────────────────────────────────────── */
  const buildPrintHtml = useCallback(() => {
    const generatedAt = new Date().toLocaleString(locale);
    const docHashLabel = docHash || "-";
    const walletLabelText = walletLabel || t("nav_wallet", "Wallet");
    const balanceValue = Number.isFinite(Number(balance)) ? Number(balance) : 0;
    const balanceDisplay = formatAmountWithSymbol(
      locale,
      balanceValue,
      displayCurrency,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    );
    const descriptionLabel = t("ui_description_4c9f6b1a2d", "Description");
    const typeLabel = t("ui_type_label_8b1a4d2c7e", "Type");
    const amountLabel = `${t("ui_amount_0bb3c64b1d", "Amount")} (${displayCurrency})`;
    const balanceLabel = `${t("ui_balance_label_7f2a1b9c5e", "Balance")} (${displayCurrency})`;
    const rowsHtml = (transactionsWithDisplayBalance || [])
      .map((tx) => {
        const isDebit = tx?.type === "debit";
        const txType = isDebit
          ? t("ui_debit_0f7c2a1b9e", "Debit")
          : t("ui_credit_93bc2a1d7e", "Credit");
        const txDescription = getLocalizedDescription(tx);
        const counterparty =
          tx?.counterparty &&
          String(tx.counterparty).toUpperCase() !== "XCANNES" &&
          !txDescription.includes(tx.counterparty)
            ? `(${tx.counterparty})`
            : "";
        const fullDescription = [txDescription, counterparty]
          .filter(Boolean)
          .join(" ");
        const feeLabel =
          tx?.category === "exchange" &&
          isQuoteSideConversion(tx) &&
          tx?.spreadRlusd > 0
            ? ` (${t("statement_conversion_fee_label", "Frais")} : ${formatAmountWithSymbol(
                locale,
                rlusdToLocal(tx.spreadRlusd),
                displayCurrency,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 },
              )})`
            : "";
        return `
        <tr>
          <td>${escapeHtml(formatDate(tx?.date))}</td>
          <td>${escapeHtml(fullDescription)}${feeLabel ? `<br/><small style="color:#888">${escapeHtml(feeLabel)}</small>` : ""}</td>
          <td>${escapeHtml(txType)}</td>
          <td class="right">${escapeHtml(
            `${isDebit ? "-" : "+"}${formatAmountWithSymbol(
              locale,
              rlusdToLocal(tx?.amount),
              displayCurrency,
              { minimumFractionDigits: 2, maximumFractionDigits: 2 },
            )}`,
          )}</td>
          <td class="right">${escapeHtml(
            formatAmountWithSymbol(
              locale,
              rlusdToLocal(
                tx?.displayRunningBalance != null
                  ? tx.displayRunningBalance
                  : tx?.runningBalance,
              ),
              displayCurrency,
              { minimumFractionDigits: 2, maximumFractionDigits: 2 },
            ),
          )}</td>
        </tr>
      `;
      })
      .join("");
    const emptyRow = `
      <tr>
        <td colspan="5" class="muted">${escapeHtml(
          t("ui_no_transactions_found_af217af8de", "No transactions found"),
        )}</td>
      </tr>
    `;

    return `
      <h1>${escapeHtml(`${normalizedCurrency} ${t("ui_statement_a87c93acb8", "Statement")}`)}</h1>
      <div class="meta">
        <div>${escapeHtml(walletLabelText)}</div>
        <div><strong>${escapeHtml(t("ui_wallet_address_label_2f7a1c9b5e", "Wallet address"))}:</strong> <span class="small">${escapeHtml(walletAddress || "-")}</span></div>
        <div><strong>${escapeHtml(t("ui_statement_period_label_3f6c1a9b5e", "Period"))}:</strong> ${escapeHtml(currentPeriod || fallbackPeriod)}</div>
        <div><strong>${escapeHtml(t("ui_balance_label_7f2a1b9c5e", "Balance"))}:</strong> ${escapeHtml(balanceDisplay)}</div>
        <div><strong>${escapeHtml(t("ui_generated_on_ae324c9048", "Generated on"))}:</strong> ${escapeHtml(generatedAt)}</div>
        <div><strong>${escapeHtml(t("ui_ledger_status_label_0f7c1a9b5e", "Ledger status"))}:</strong> ${escapeHtml(ledgerStatusLabel)}</div>
        <div><strong>${escapeHtml(t("ui_document_hash_label_9b5c1a2d7e", "Document hash"))}:</strong> <span class="small">${escapeHtml(docHashLabel)}</span></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t("ui_date_label_7a2c1b9d5e", "Date"))}</th>
            <th>${escapeHtml(descriptionLabel)}</th>
            <th>${escapeHtml(typeLabel)}</th>
            <th class="right">${escapeHtml(amountLabel)}</th>
            <th class="right">${escapeHtml(balanceLabel)}</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || emptyRow}
        </tbody>
      </table>
    `;
	  }, [
	    balance,
	    currentPeriod,
	    docHash,
	    displayCurrency,
	    fallbackPeriod,
	    getLocalizedDescription,
	    isQuoteSideConversion,
	    rlusdToLocal,
	    transactionsWithDisplayBalance,
	    formatDate,
	    ledgerStatusLabel,
    locale,
    normalizedCurrency,
    t,
    walletAddress,
    walletLabel,
  ]);

  const handleExportPdf = useCallback(() => {
    setExportFormat("pdf");
    try {
      const suffix = docHash ? docHash.slice(0, 12) : "draft";
      const ok = openPrintWindow({
        title: `XCANNES ${normalizedCurrency || "Statement"} ${suffix}`,
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
  }, [buildPrintHtml, docHash, normalizedCurrency, t, toast]);

  /* ── layout ────────────────────────────────────────────── */
  const resolvedLayout =
    STATEMENT_LAYOUTS[variant] || STATEMENT_LAYOUTS.full;
  const wrapperBaseClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10200] flex";
  const modalBgClass =
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated";
  const swipeEnabled = !inline && variant === "full" && !isXrpNetworkView;

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
  }, [swipeEnabled, normalizedCurrency, variant]);

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

  const copyToClipboard = useCallback(
    async (text, successMessage) => {
      const value = String(text || "").trim();
      if (!value) return;
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else if (typeof document !== "undefined") {
          const el = document.createElement("textarea");
          el.value = value;
          el.setAttribute("readonly", "");
          el.style.position = "absolute";
          el.style.left = "-9999px";
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
        }
        if (successMessage) toast?.success?.(successMessage);
      } catch {
        // ignore
      }
    },
    [toast],
  );

  const detailIsOutgoing = useMemo(() => {
    if (!detailTx) return false;
    return (
      detailTx?.type === "debit" ||
      String(detailTx?.kind || "").toUpperCase().includes("OUT")
    );
  }, [detailTx]);

  const detailTypeLabel = useMemo(() => {
    if (!detailTx) return "";
    if (detailTx?.category === "exchange") {
      return t("statement_conversion_label", "Conversion");
    }
    if (detailIsOutgoing) return t("statement_xrpl_payment_out", "Paiement envoyé");
    return t("statement_xrpl_mobile_in", "Reçu");
  }, [detailIsOutgoing, detailTx, t]);

  const detailIsConversion = detailTx?.category === "exchange";

  const showConversionFee = useMemo(() => {
    if (!detailTx) return false;
    if (detailIsConversion) return isQuoteSideConversion(detailTx);
    const spread = Number(detailTx?.spreadRlusd);
    return Number.isFinite(spread) && spread > 0;
  }, [detailIsConversion, detailTx, isQuoteSideConversion]);

  const detailStatusLabel = useMemo(() => {
    if (!detailTx) return "";
    if (isPreviewMode) return t("ui_status_preview", "Aperçu");
    if (detailTx?.txHash) return t("ui_status_confirmed", "Confirmé");
    if (!["XRP", "RLUSD"].includes(normalizedCurrency)) {
      return t("ui_status_offchain", "Hors chaîne");
    }
    return t("ui_status_recorded", "Enregistré");
  }, [detailTx, isPreviewMode, normalizedCurrency, t]);

  const counterpartyAddress = useMemo(() => {
    if (!detailTx) return "";
    return getCounterpartyAddressFromTx(detailTx);
  }, [detailTx, getCounterpartyAddressFromTx]);

  const counterpartyTitle = useMemo(() => {
    return detailIsOutgoing
      ? t("ui_recipient_label", "Destinataire")
      : t("ui_sender_label", "Expéditeur");
  }, [detailIsOutgoing, t]);

  const counterpartyName = useMemo(() => {
    if (!counterpartyAddress) return "";
    if (detailLabelLoading) return "…";
    const label = String(detailLabel || "").trim();
    return label || t("ui_no_name_found", "Aucun nom trouvé");
  }, [counterpartyAddress, detailLabel, detailLabelLoading, t]);

  const handleShareTransaction = useCallback(async () => {
    if (!detailTx) return;
    if (typeof document === "undefined") return;

    const typeLabelBase =
      detailTypeLabel || t("ui_transaction", "Transaction");
    const conversionPair =
      detailTx?.category === "exchange"
        ? parseConversionPair(detailTx?.description || "")
        : null;
    const typeLabel =
      conversionPair?.from && conversionPair?.to
        ? `${typeLabelBase} ${conversionPair.from} → ${conversionPair.to}`
        : typeLabelBase;
    const amountLabel = `${detailTx?.type === "debit" ? "−" : "+"}${formatAmountRlusdAsLocal(
      detailTx?.amount ?? 0,
    )}`;
    const dateLabel = formatDateTime(detailTx);
    const statusLabel = detailStatusLabel || "";
    const nameLabel = counterpartyName || "";
    const addressLabel = counterpartyAddress || "";
    const walletLabelText = String(walletLabel || t("nav_wallet", "Wallet")).trim();
    const showTaux =
      detailTx?.category === "exchange" &&
      showConversionFee &&
      Number(detailTx?.spreadRlusd) > 0;
    const tauxLabel = showTaux
      ? formatAmountRlusdAsLocal(detailTx.spreadRlusd)
      : "";
    const isConversionShare = detailIsConversion;

    const buildCardBlob = async () => {
      if (isConversionShare) {

      const convTitle = typeLabel;
      const convAmount = amountLabel;
      const convDate = dateLabel;
      const convStatus = statusLabel;
      const convFrom = conversionPair?.from || "?";
      const convTo = conversionPair?.to || "?";
      const convFromAmt = amountLabel;
      const convToAmt = "—";
      const fxRateCS = detailTx?.fxRate ? Number(detailTx.fxRate).toFixed(4) : (tauxLabel || "—");
      const convRate = convFrom && convTo ? `1 ${convFrom} = ${fxRateCS} ${convTo}` : fxRateCS;
      const convRateShort = fxRateCS;
      const convTxHash = String(detailTx?.txHash || "").trim();
      const walletLabelVar = walletLabelText;

      // ── CONVERSION: dedicated design ─────────────────────────────────
      const isPortrait = typeof window !== "undefined" && window.innerWidth < 768;
      const w = isPortrait ? 1080 : 1600;
      const h = isPortrait ? 1560 : 900;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const accent = "#3b82f6";
      const accentDim = "rgba(59,130,246,0.13)";
      const accentBorder = "rgba(59,130,246,0.30)";
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
      ctx.fillStyle="rgba(59,130,246,0.04)"; ctx.fill();
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
      const drawCalendar=(cx,cy,s)=>{
        ctx.strokeStyle=accent; ctx.lineWidth=s*0.09; ctx.fillStyle=accentDim;
        rr(cx-s/2,cy-s/2,s,s,s*0.18); ctx.fill(); ctx.stroke();
        ctx.strokeStyle=accent; ctx.lineWidth=s*0.07;
        [0.42,0.58,0.72].forEach(r=>{
          ctx.beginPath(); ctx.moveTo(cx-s*0.28,cy-s*0.5+s*r);
          ctx.lineTo(cx+s*0.28,cy-s*0.5+s*r); ctx.stroke();
        });
        [cx-s*0.12,cx+s*0.12].forEach(rx=>{
          ctx.beginPath(); ctx.moveTo(rx,cy-s*0.5+s*0.16); ctx.lineTo(rx,cy-s*0.5+s*0.28); ctx.stroke();
        });
      };
      const drawCheckShield=(cx,cy,r)=>{
        // shield / checkmark
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
        ctx.fillStyle=accentDim; ctx.fill();
        ctx.strokeStyle=accent; ctx.lineWidth=2; ctx.stroke();
        const ck=r*0.45;
        ctx.beginPath(); ctx.moveTo(cx-ck*0.9,cy); ctx.lineTo(cx-ck*0.2,cy+ck*0.7); ctx.lineTo(cx+ck*0.9,cy-ck*0.6);
        ctx.strokeStyle=accent; ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.stroke();
      };
      const drawCurrencyCircle=(cx,cy,r,label)=>{
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
        ctx.fillStyle=accentDim; ctx.fill();
        ctx.strokeStyle=accent; ctx.lineWidth=2.5; ctx.stroke();
        ctx.fillStyle=accentText; ctx.font=`700 ${Math.round(r*0.75)}px system-ui,-apple-system,sans-serif`;
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(label.slice(0,1), cx, cy);
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
      const drawInfoIcon=(cx,cy,r)=>{
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
        ctx.fillStyle=accentDim; ctx.fill();
        ctx.strokeStyle=accent; ctx.lineWidth=1.5; ctx.stroke();
        ctx.fillStyle=accentText; ctx.font=`700 ${Math.round(r*1.1)}px system-ui`;
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("i",cx,cy+1);
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
      const secNote = t("ui_security_confirmation_note","Chaque transaction nécessite une confirmation.");
      const discNote = t("ui_conversion_fx_note","Le montant final peut varier légèrement selon les fluctuations du taux de change.");

      if (isPortrait) {
        // ── PORTRAIT ──────────────────────────────────────────────────────
        // Header: dot + name + addr
        const dotR=7;
        ctx.beginPath(); ctx.arc(cardX+44+dotR,cardY+52,dotR,0,Math.PI*2);
        ctx.fillStyle=accent; ctx.fill();
        ctx.fillStyle=textPrimary; ctx.font="600 26px system-ui,-apple-system,sans-serif";
        ctx.textAlign="left"; ctx.textBaseline="middle";
        ctx.fillText(ellipsize(wName,200),cardX+44+dotR*2+8,cardY+52);
        ctx.fillStyle=textSecondary; ctx.font="400 22px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(" · "+wAddrShort,cardW-200),cardX+44+dotR*2+8+ctx.measureText(wName).width+4,cardY+52);

        // Title
        ctx.fillStyle=textPrimary; ctx.font="800 58px system-ui,-apple-system,sans-serif";
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillText(ellipsize(convTitle,cardW-88),cardX+44,cardY+130);

        // Amount
        ctx.font="800 110px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace";
        ctx.fillStyle=accentText;
        ctx.fillText(ellipsize(convAmount,cardW-88),cardX+44,cardY+260);

        // Divider
        ctx.strokeStyle="rgba(255,255,255,0.07)"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(cardX+44,cardY+290); ctx.lineTo(cardX+cardW-44,cardY+290); ctx.stroke();

        // Row 1: Date | Statut
        let cy2=cardY+320;
        const cardGap=18; const iconS=44; const halfW=(cardW-cardGap)/2;
        const cardH1=110;
        infoCard(cardX,cy2,halfW,cardH1);
        drawCalendar(cardX+36,cy2+cardH1/2,iconS);
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textSecondary; ctx.font="500 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_date_label_7a2c1b9d5e","Date"),cardX+68,cy2+38);
        ctx.fillStyle=textPrimary; ctx.font="600 24px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convDate,halfW-76),cardX+68,cy2+70);

        const sx=cardX+halfW+cardGap;
        infoCard(sx,cy2,halfW,cardH1);
        drawCheckShield(sx+36,cy2+cardH1/2,22);
        ctx.fillStyle=textSecondary; ctx.font="500 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_status_label","Statut"),sx+68,cy2+38);
        ctx.fillStyle=textPrimary; ctx.font="600 26px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convStatus||"—",halfW-80),sx+68,cy2+76);

        // Conversion pair card
        cy2+=cardH1+cardGap;
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
        // arrow
        ctx.strokeStyle=textSecondary; ctx.lineWidth=2; ctx.lineCap="round";
        const midX=cardX+cardW/2;
        ctx.beginPath(); ctx.moveTo(midX-18,midY); ctx.lineTo(midX+18,midY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(midX+6,midY-12); ctx.lineTo(midX+18,midY); ctx.lineTo(midX+6,midY+12); ctx.stroke();
        drawCurrencyCircle(rightCX,midY,circR,convTo);
        ctx.fillStyle=textPrimary; ctx.font="700 26px system-ui,-apple-system,sans-serif";
        ctx.fillText(convTo,rightCX,midY-circR-10);
        ctx.fillStyle=accentText; ctx.font="400 22px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convToAmt,cardW*0.35),rightCX,midY+circR+26);

        // Rate card
        cy2+=convCardH+cardGap;
        const rateCardH=100;
        infoCard(cardX,cy2,cardW,rateCardH);
        drawTrend(cardX+36,cy2+rateCardH/2,iconS);
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textSecondary; ctx.font="500 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_fx_rate_used","Taux utilisé"),cardX+68,cy2+36);
        ctx.fillStyle=textPrimary; ctx.font="600 28px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convRate,cardW-84),cardX+68,cy2+72);

        // Disclaimer card
        cy2+=rateCardH+cardGap;
        const discH=isPortrait?130:0;
        infoCard(cardX,cy2,cardW,discH);
        drawInfoIcon(cardX+36,cy2+discH/2,20);
        ctx.fillStyle=textSecondary; ctx.font="400 21px system-ui,-apple-system,sans-serif";
        ctx.textAlign="left"; ctx.textBaseline="top";
        // wrap disc note
        const discWords=discNote.split(" "); let discLine=""; let discY=cy2+22;
        discWords.forEach(w=>{
          const test=discLine?discLine+" "+w:w;
          ctx.font="400 21px system-ui,-apple-system,sans-serif";
          if(ctx.measureText(test).width>cardW-100){
            ctx.fillText(discLine,cardX+68,discY); discY+=28; discLine=w;
          } else discLine=test;
        });
        if(discLine) ctx.fillText(discLine,cardX+68,discY);

        // Footer
        ctx.fillStyle="rgba(255,255,255,0.22)"; ctx.font="600 20px system-ui,-apple-system,sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="alphabetic";
        ctx.fillText("XCANNES",cardX+cardW/2,cardY+cardH-22);

      } else {
        // ── LANDSCAPE ──────────────────────────────────────────────────────
        const leftW=Math.round(cardW*0.46);
        const rightX=cardX+leftW+44; const rightW=cardX+cardW-rightX-12;

        // Avatar top-left
        const avR=36; const avCx=cardX+44+avR; const avCy=cardY+50+avR;
        ctx.beginPath(); ctx.arc(avCx,avCy,avR,0,Math.PI*2);
        ctx.fillStyle=accentDim; ctx.fill();
        ctx.strokeStyle=accent; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle=textPrimary; ctx.font="700 28px system-ui,-apple-system,sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(initial,avCx,avCy);
        ctx.beginPath(); ctx.arc(avCx+avR*0.68,avCy+avR*0.68,8,0,Math.PI*2);
        ctx.fillStyle="#080f1f"; ctx.fill();
        ctx.beginPath(); ctx.arc(avCx+avR*0.68,avCy+avR*0.68,6,0,Math.PI*2);
        ctx.fillStyle=accent; ctx.fill();
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textPrimary; ctx.font="600 26px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(wName,leftW-60),avCx+avR+14,avCy+8);
        ctx.fillStyle=textSecondary; ctx.font="400 18px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(wAddrShort,leftW-60),avCx+avR+14,avCy+34);

        // Vertical divider
        ctx.strokeStyle="rgba(255,255,255,0.07)"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(cardX+leftW+22,cardY+24); ctx.lineTo(cardX+leftW+22,cardY+cardH-24); ctx.stroke();

        // Left: title + amount
        ctx.fillStyle=textPrimary; ctx.font="800 50px system-ui,-apple-system,sans-serif";
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillText(ellipsize(convTitle,leftW-44),cardX+44,cardY+160);
        ctx.font="800 88px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace";
        ctx.fillStyle=accentText;
        ctx.fillText(ellipsize(convAmount,leftW-44),cardX+44,cardY+268);

        // Divider left
        ctx.strokeStyle="rgba(255,255,255,0.07)"; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(cardX+44,cardY+290); ctx.lineTo(cardX+leftW-12,cardY+290); ctx.stroke();

        // Date | Statut
        let ly=cardY+318;
        const cardGapL=16; const iconSL=40; const halfLW=(leftW-cardGapL)/2;
        const lCardH=106;
        infoCard(cardX,ly,halfLW,lCardH);
        drawCalendar(cardX+30,ly+lCardH/2,iconSL);
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textSecondary; ctx.font="500 17px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_date_label_7a2c1b9d5e","Date"),cardX+60,ly+32);
        ctx.fillStyle=textPrimary; ctx.font="600 20px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convDate,halfLW-68),cardX+60,ly+60);

        const lsx=cardX+halfLW+cardGapL;
        infoCard(lsx,ly,halfLW,lCardH);
        drawCheckShield(lsx+30,ly+lCardH/2,19);
        ctx.fillStyle=textSecondary; ctx.font="500 17px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_status_label","Statut"),lsx+58,ly+32);
        ctx.fillStyle=textPrimary; ctx.font="700 22px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convStatus||"—",halfLW-68),lsx+58,ly+68);
        ly+=lCardH+cardGapL;

        // Conversion pair card
        const convCardH=108;
        infoCard(cardX,ly,leftW,convCardH);
        const circR=30;
        const leftCX=cardX+leftW*0.22; const rightCX=cardX+leftW*0.72; const midY=ly+convCardH/2;
        drawCurrencyCircle(leftCX,midY,circR,convFrom);
        ctx.textAlign="center"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textPrimary; ctx.font="700 22px system-ui,-apple-system,sans-serif";
        ctx.fillText(convFrom,leftCX,midY-circR-8);
        ctx.fillStyle=textSecondary; ctx.font="400 19px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convFromAmt,leftW*0.35),leftCX,midY+circR+22);
        const midX2=cardX+leftW/2;
        ctx.strokeStyle=textSecondary; ctx.lineWidth=2; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(midX2-16,midY); ctx.lineTo(midX2+16,midY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(midX2+4,midY-10); ctx.lineTo(midX2+16,midY); ctx.lineTo(midX2+4,midY+10); ctx.stroke();
        drawCurrencyCircle(rightCX,midY,circR,convTo);
        ctx.fillStyle=textPrimary; ctx.font="700 22px system-ui,-apple-system,sans-serif";
        ctx.fillText(convTo,rightCX,midY-circR-8);
        ctx.fillStyle=accentText; ctx.font="400 19px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convToAmt,leftW*0.35),rightCX,midY+circR+22);
        ly+=convCardH+cardGapL;

        // Rate card
        const rateCardH=92;
        infoCard(cardX,ly,leftW,rateCardH);
        drawTrend(cardX+30,ly+rateCardH/2,iconSL);
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textSecondary; ctx.font="500 17px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_fx_rate_used","Taux utilisé"),cardX+60,ly+30);
        ctx.fillStyle=textPrimary; ctx.font="600 24px system-ui,-apple-system,sans-serif";
        ctx.fillText(ellipsize(convRate,leftW-72),cardX+60,ly+62);

        // Right: disclaimer + details table + TX ID
        let ry=cardY+44; const rGap=16; const rCardW=rightW;

        // Disclaimer
        const discCardH=116;
        infoCard(rightX,ry,rCardW,discCardH);
        drawInfoIcon(rightX+28,ry+32,17);
        ctx.textAlign="left"; ctx.textBaseline="top";
        ctx.fillStyle=textSecondary; ctx.font="400 17px system-ui,-apple-system,sans-serif";
        const discWords=discNote.split(" "); let discLine=""; let discY=ry+16;
        discWords.forEach(w=>{
          const test=discLine?discLine+" "+w:w;
          if(ctx.measureText(test).width>rCardW-64){
            ctx.fillText(discLine,rightX+52,discY); discY+=23; discLine=w;
          } else discLine=test;
        });
        if(discLine) ctx.fillText(discLine,rightX+52,discY);
        ry+=discCardH+rGap;

        // Details table card
        const detailH=186;
        infoCard(rightX,ry,rCardW,detailH);
        ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillStyle=textPrimary; ctx.font="700 22px system-ui,-apple-system,sans-serif";
        ctx.fillText(t("ui_conversion_details","Détails de la conversion"),rightX+24,ry+34);
        const rows=[
          [t("ui_amount_in_from","Montant en "+convFrom), convFromAmt, textSecondary],
          [t("ui_fx_rate_short","Taux de change"), convRateShort, textSecondary],
          [t("ui_amount_in_to","Montant en "+convTo), convToAmt, accentText],
        ];
        let rowY=ry+62;
        rows.forEach(([label,val,valColor])=>{
          ctx.fillStyle=textSecondary; ctx.font="400 17px system-ui,-apple-system,sans-serif";
          ctx.fillText(label,rightX+24,rowY);
          ctx.textAlign="right";
          ctx.fillStyle=valColor; ctx.font="600 18px system-ui,-apple-system,sans-serif";
          ctx.fillText(ellipsize(val,rCardW-48),rightX+rCardW-20,rowY);
          ctx.textAlign="left";
          rowY+=38;
        });
        ry+=detailH+rGap;

        // TX ID card
        const txHash=convTxHash; const txHashShort=txHash.length>22?txHash.slice(0,10)+"…"+txHash.slice(-10):txHash;
        const txCardH=96;
        infoCard(rightX,ry,rCardW,txCardH);
        ctx.fillStyle=textSecondary; ctx.font="500 17px system-ui,-apple-system,sans-serif"; ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        ctx.fillText(t("ui_tx_id","ID de transaction"),rightX+24,ry+30);
        ctx.fillStyle=textPrimary; ctx.font="500 18px ui-monospace,SFMono-Regular,Menlo,Monaco,monospace";
        ctx.fillText(ellipsize(txHashShort||"—",rCardW-160),rightX+24,ry+60);
        if(txHash){
          const bW=110; const bH=34; const bX=rightX+rCardW-bW-14; const bY=ry+(txCardH-bH)/2;
          rr(bX,bY,bW,bH,17); ctx.fillStyle=accentDim; ctx.fill();
          ctx.strokeStyle=accentBorder; ctx.lineWidth=1; ctx.stroke();
          ctx.fillStyle=accentText; ctx.font="600 18px system-ui,-apple-system,sans-serif";
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(t("ui_copy_action","Copier"),bX+bW/2,bY+bH/2);
          ctx.textAlign="left"; ctx.textBaseline="alphabetic";
        }

        // Security note bottom
        const noteY2=cardY+cardH-36;
        const lkS=24;
        const noteCardH=56;
        infoCard(cardX,noteY2-noteCardH+8,cardW,noteCardH);
        drawLock(cardX+36,noteY2-noteCardH*0.1+8,lkS);
        ctx.fillStyle=textSecondary; ctx.font="400 18px system-ui,-apple-system,sans-serif";
        ctx.textAlign="left"; ctx.textBaseline="middle";
        ctx.fillText(ellipsize(secNote,cardW-80),cardX+36+lkS+8,noteY2-noteCardH/2+8);
      }

      if(typeof canvas.toBlob==="function"){
        return await new Promise((resolve)=>{canvas.toBlob((blob)=>resolve(blob),"image/png",0.92);});
      }
      const dataUrl=canvas.toDataURL("image/png");
      const res=await fetch(dataUrl);
      return await res.blob();

      }
      const isCsSent = !isConversionShare && detailTx?.type === "debit";
      if (isCsSent) {

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

      const recipientName = nameLabel || "—";
      const recipientAddr = (() => {
        const cp = String(addressLabel || "").trim();
        if (!cp || cp.length <= 20) return cp;
        return cp.slice(0, 8) + "…" + cp.slice(-6);
      })();
      const wName = String(walletLabelText || t("nav_wallet", "Wallet")).trim();
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
        ctx.fillText(typeLabel, bigCx, bigCy + bigR + 76);

        // Amount
        ctx.font = "800 100px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = accentText;
        ctx.fillText(ellipsize(amountLabel, cardW - 80), bigCx, bigCy + bigR + 190);

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
        ctx.fillText(ellipsize(dateLabel, cardW - 84), cardX + 68, cy2 + 68);
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
        ctx.fillText(typeLabel, bigCx, bigCy + bigR + 64);
        ctx.font = "800 80px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = accentText;
        ctx.fillText(ellipsize(amountLabel, leftW - 40), bigCx, bigCy + bigR + 158);

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
        ctx.fillText(ellipsize(dateLabel, rCardW - 68), rightX + 56, ry + 64);
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
      const isCsReceived = !isConversionShare && detailTx?.type !== "debit";
      if (isCsReceived) {

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

      const senderName = nameLabel || "—";
      const senderAddr = (() => {
        const cp = String(addressLabel || "").trim();
        if (!cp || cp.length <= 20) return cp;
        return cp.slice(0, 8) + "…" + cp.slice(-6);
      })();
      const txHash = String(detailTx?.txHash || "").trim();
      const txHashShort = txHash.length > 22 ? txHash.slice(0, 10) + "…" + txHash.slice(-10) : txHash;
      const wName = String(walletLabelText || t("nav_wallet", "Wallet")).trim();
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
        ctx.fillText(typeLabel, bigCx, bigCy + bigR + 76);

        // Amount (big green)
        ctx.font = "800 100px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = accentText;
        ctx.fillText(ellipsize(amountLabel, cardW - 80), bigCx, bigCy + bigR + 190);

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
        const dateParts = dateLabel.split(/[,\n]/);
        ctx.fillText(ellipsize(dateParts[0] || dateLabel, halfW - 76), cardX + 68, cy2 + 74);
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
        ctx.fillText(typeLabel, bigCx, bigCy + bigR + 64);
        ctx.font = "800 80px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = accentText;
        ctx.fillText(ellipsize(amountLabel, leftW - 40), bigCx, bigCy + bigR + 160);
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
        const dp = dateLabel.split(/[,\n]/);
        ctx.fillText(ellipsize(dp[0] || dateLabel, halfRW - 64), rightX + 56, ry + 62);
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

      const txIsDebit = detailTx?.type === "debit";
      const accentMain = txIsDebit ? "#f87171" : "#22c55e";
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
        const addrRaw = String(walletAddress || "").trim();
        const addrShort = addrRaw ? `${addrRaw.slice(0, 8)}…${addrRaw.slice(-6)}` : "";
        const accountLine = `${walletLabelText}${addrShort ? "  ·  " + addrShort : ""}`;
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
        ctx.fillText(ellipsize(typeLabel, cardW - 88), cardX + 44, cardY + 132);

        ctx.font = "800 96px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = accentMain;
        ctx.textAlign = "center";
        ctx.fillText(ellipsize(amountLabel, cardW - 40), cardX + cardW / 2, cardY + 256);

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
        ctx.fillText(ellipsize(dateLabel, cardW / 2 - 44), col1x, my + 34);
        ctx.fillText(ellipsize(statusLabel || "—", cardW / 2 - 44), col2x, my + 34);
        my += 100;

        if (showTaux && tauxLabel) {
          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.font = "600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(t("ui_fx_rate", "Taux"), col1x, my);
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(ellipsize(tauxLabel, cardW / 2 - 44), col1x, my + 34);
          my += 100;
        }
        if (isConversionShare) {
          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.font = "600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(t("ui_account", "Compte"), col2x, my - 100);
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(ellipsize(walletLabelText || "—", cardW / 2 - 44), col2x, my - 100 + 34);
        } else {
          const cpTitle = counterpartyTitle || t("ui_counterparty", "Contrepartie");
          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.font = "600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(cpTitle, col1x, my);
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "600 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(ellipsize(nameLabel || t("ui_no_name_found", "Aucun nom trouvé"), cardW - 88), col1x, my + 38);
          if (addressLabel) {
            const addrDisp = addressLabel.length > 28 ? `${addressLabel.slice(0, 12)}…${addressLabel.slice(-8)}` : addressLabel;
            ctx.fillStyle = "rgba(255,255,255,0.45)";
            ctx.font = "500 20px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            ctx.fillText(addrDisp, col1x, my + 82);
          }
        }

      } else {
        // === LANDSCAPE (desktop) ===
        const splitX = cardX + Math.round(cardW * 0.5);

        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.font = "700 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(ellipsize(typeLabel, splitX - cardX - 72), cardX + 44, cardY + 126);

        ctx.font = "800 72px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = accentMain;
        ctx.fillText(ellipsize(amountLabel, splitX - cardX - 44), cardX + 44, cardY + 232);

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
        ctx.fillText(ellipsize(dateLabel, rightW), rx, ry + 28);
        ry += 72;

        ctx.fillStyle = "rgba(255,255,255,0.42)";
        ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.fillText(t("ui_status_label", "Statut"), rx, ry);
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.fillText(ellipsize(statusLabel || "—", rightW), rx, ry + 28);
        ry += 72;

        if (showTaux && tauxLabel) {
          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(t("ui_fx_rate", "Taux"), rx, ry);
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(ellipsize(tauxLabel, rightW), rx, ry + 28);
          ry += 72;
        }
        if (isConversionShare) {
          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(t("ui_account", "Compte"), rx, ry);
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(ellipsize(walletLabelText || "—", rightW), rx, ry + 28);
        } else {
          const cpTitle = counterpartyTitle || t("ui_counterparty", "Contrepartie");
          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(cpTitle, rx, ry);
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.font = "600 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(ellipsize(nameLabel || t("ui_no_name_found", "Aucun nom trouvé"), rightW), rx, ry + 28);
          if (addressLabel) {
            const addrDisp = addressLabel.length > 20 ? `${addressLabel.slice(0, 8)}…${addressLabel.slice(-6)}` : addressLabel;
            ctx.fillStyle = "rgba(255,255,255,0.40)";
            ctx.font = "500 17px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            ctx.fillText(addrDisp, rx, ry + 60);
          }
        }
      }

      // Brand footer
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("XCANNES", cardX + cardW / 2, cardY + cardH - 22);

      return await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b || null), "image/png", 0.92),
      );
    };

    const blob = await buildCardBlob();
    if (!blob) return;

    const fileBase =
      String(detailTx?.txHash || "").trim().slice(0, 10) || String(Date.now());
    const file = new File([blob], `xcannes-transaction-${fileBase}.png`, {
      type: "image/png",
    });

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        const payload = {
          title: t("ui_transaction", "Transaction"),
          text: t("ui_share_transaction_card", "Partager la carte de transaction"),
          files: [file],
        };
        if (typeof navigator.canShare === "function" && !navigator.canShare(payload)) {
          throw new Error("canShare:false");
        }
        await navigator.share(payload);
        flashShareNotice(t("ui_shared", "Partagé"), { tone: "success" });
        return;
      }
    } catch (err) {
      if (String(err?.name || "") === "AbortError") return;
      // fall back below
    }
    // Fallback: download the image
    try {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      flashShareNotice(t("ui_downloaded", "Téléchargé"), {
        tone: "success",
      });
    } catch {
      flashShareNotice(t("ui_share_failed", "Partage impossible"), {
        tone: "error",
        autoClose: false,
      });
    }
  }, [
    counterpartyAddress,
    counterpartyName,
    counterpartyTitle,
    detailIsConversion,
    detailStatusLabel,
    detailTx,
    detailTypeLabel,
    flashShareNotice,
    formatAmountRlusdAsLocal,
    formatDateTime,
    parseConversionPair,
    showConversionFee,
    t,
    walletLabel,
    walletAddress,
  ]);

  const transactionDetailModal = detailOpen && detailTx ? (
    <CurrencyTransactionDetailModal
      detailTx={detailTx}
      onClose={closeTxDetails}
      modalBgClass={modalBgClass}
      detailIsConversion={detailIsConversion}
      detailTypeLabel={detailTypeLabel}
      detailStatusLabel={detailStatusLabel}
      formatDateTime={formatDateTime}
      formatAmountRlusdAsLocal={formatAmountRlusdAsLocal}
      walletLabel={walletLabel}
      walletAddress={walletAddress}
      counterpartyAddress={counterpartyAddress}
      counterpartyTitle={counterpartyTitle}
      counterpartyName={counterpartyName}
      copyToClipboard={copyToClipboard}
      copiedAddress={copiedAddress}
      setCopiedAddress={setCopiedAddress}
      copiedAddressTimerRef={copiedAddressTimerRef}
      copiedHash={copiedHash}
      setCopiedHash={setCopiedHash}
      copiedHashTimerRef={copiedHashTimerRef}
      truncateMiddle={truncateMiddle}
      showConversionFee={showConversionFee}
      handleShare={handleShareTransaction}
      shareNotice={shareNotice}
      shareNoticeTone={shareNoticeTone}
      t={t}
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
        className={`relative w-full wallet-modal-panel wallet-modal-no-top-highlight-mobile ${modalBgClass} flex flex-col min-h-0 ${statementPanelOverflowClass} ${inline ? "z-[1]" : "z-[10201]"} shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
          resolvedLayout.panelClass
        } ${inline ? "wallet-inline-zoom-in" : liftAnimClass}`}
        style={{
          ...(statementPanelScrollStyle || {}),
          ...(swipeEnabled
            ? {
                transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
                transition: overlayDragging
                  ? "none"
                  : "transform 220ms cubic-bezier(0.2,0,0,1)",
                opacity: overlayTranslateY > 0 ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) : undefined,
                willChange: overlayTranslateY ? "transform" : undefined,
              }
            : {}),
        }}
        onPointerMove={handleOverlayPointerMove}
        onPointerUp={handleOverlayPointerEnd}
        onPointerCancel={handleOverlayPointerEnd}
      >
	        {/* Header avec Account Info intégré */}
	        <div
	          className={`relative flex-shrink-0 bg-elevated px-4 md:px-6 py-3 md:py-4`}
            onPointerDown={(event) => {
              maybeStartOverlayDrag(event, "fixed");
            }}
	        >
            {swipeEnabled ? (
              <div className="md:hidden flex justify-center -mt-1 pt-1 pb-2" aria-hidden>
                <span className="block w-12 h-1.5 rounded-full bg-white/20" />
              </div>
            ) : null}
	          <div className="flex items-start justify-between gap-3 mb-3 relative z-[65]">
	            {isXrpNetworkView ? (
	              <button
	                type="button"
	                onClick={onClose}
	                className={[
                    "wallet-modal-close text-white/60 hover:text-xcannes-green transition-colors flex-shrink-0 w-10 h-10 flex items-center justify-center -ml-2",
                    inline ? "wallet-modal-close--force" : "",
                  ].join(" ")}
	                aria-label={t("back", "Retour")}
	              >
	                <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
	              </button>
	            ) : null}
              <div className="flex flex-col items-start text-left gap-1 min-w-0 flex-1">
                {/* Drapeau + nom sur une seule ligne */}
                <div className="flex items-center justify-start gap-2 flex-wrap min-w-0">
	              {CRYPTO_ICONS?.[displayCurrency] ? (
	                isSvgIcon(CRYPTO_ICONS[displayCurrency]) ? (
	                  // eslint-disable-next-line @next/next/no-img-element
	                  <img
                    src={CRYPTO_ICONS[displayCurrency]}
                    alt={displayCurrency}
                    width={24}
                    height={24}
                      className="flex-shrink-0 w-6 h-6 rounded-md"
                  />
                ) : (
                  <Image
                    src={CRYPTO_ICONS[displayCurrency]}
                    alt={displayCurrency}
                    width={24}
                    height={24}
                      className="flex-shrink-0 w-6 h-6 rounded-md"
                  />
                )
              ) : (
                  <span className="text-2xl flex-shrink-0 leading-none">
                  {getCurrencyFlag(displayCurrency)}
                </span>
              )}
              <h2 className="text-[22px] md:text-[26px] font-light text-white/80 md:text-white tracking-tight min-w-0 truncate">
                {headerTitle}
              </h2>
              {noticeVariant === "demo" ? (
                <span className="inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                  {t("demo_notice_title", "Mode démo")}
                </span>
              ) : null}
                </div>
	              </div>
              {/* close via swipe/backdrop */}
	          </div>
	        </div>{/* /header */}

        {/* Balance + Filtres — bloc commun */}
        {!isXrpNetworkView ? (
          <div className="mx-4 md:mx-6 rounded-[20px] ring-1 ring-inset ring-white/[0.07]">
          {/* Balance + USD estimé */}
          <div className="flex flex-col items-center text-center gap-0.5 mt-3 mb-3 w-fit mx-auto px-8 py-4">
            <p className="text-[18px] md:text-[20px] text-white/60">
              {t("ui_balance_445d830d72", "Solde disponible")}
            </p>
            <p className="text-4xl text-white font-bold">
              {formatAmountWithSymbolLocal(balance)}
            </p>
            {estimatedUsd != null && Number.isFinite(estimatedUsd) ? (
              <p className="text-[12px] text-white/50 mt-1 whitespace-nowrap">
                <span className="text-white/40 mr-1">{t("ui_digital_usd_label", "Équivalent USD numérique")}</span>
                ≈ {formatAmountWithSymbol(locale, estimatedUsd, "RLUSD", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            ) : null}
          </div>

          {/* Filtres */}
          <div className="flex flex-col">
            <div className="mx-4 h-px bg-white/[0.07] rounded-full" aria-hidden />
            <div className="flex flex-1 p-[3px]">
              <SegmentedFilterControl
                tabs={[
                  { key: "all",        label: stripCountSuffix(t("ui_all_0c90d41d71", "Tout")) },
                  { key: "credit",     label: stripCountSuffix(t("ui_credits_b8166276a0", "Entrées")) },
                  { key: "debit",      label: stripCountSuffix(t("ui_debits_38c870b18f", "Sorties")) },
                  { key: "conversion", label: stripCountSuffix(t("ui_conversions_b604b5ef8b", "Conversions")) },
                ]}
                value={filter}
                onChange={setFilter}
                className="w-full"
              />
            </div>
          </div>
          </div>
        ) : null}

        {/* Barre : compte | sélecteur de période | télécharger */}
        {!isXrpNetworkView ? (
          <div className="flex items-center gap-2 px-4 md:px-6 mt-2 mb-4 w-full">
            {/* Gauche : label compte avec dropdown adresse */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="relative w-auto min-w-[120px] max-w-[200px]" ref={footerDropdownRef}>
                <button
                  type="button"
                  onClick={() => setFooterDropdownOpen((prev) => !prev)}
                  className="w-full inline-flex items-center justify-center gap-0 px-1 md:px-2 py-1.5 bg-transparent transition-all rounded-[10px]"
                  aria-haspopup="menu"
                  aria-expanded={footerDropdownOpen}
                  title={t("ui_current_account_plain", "Compte actuel")}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0 wallet-dot-active mr-1" aria-hidden />
                  <span className="text-white/95 text-sm font-semibold truncate min-w-0">
                    {walletLabel || t("nav_wallet", "Wallet")}
                  </span>
                  <svg className="w-4 h-4 text-white/45 shrink-0 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle cx="12" cy="12" r="2.6" />
                    {footerDropdownOpen && <path d="M4 20 L20 4" />}
                  </svg>
                </button>
                {footerDropdownOpen && walletAddress ? (
                  <div className="absolute top-full left-0 z-[200] w-full mt-1 rounded-[10px] ring-1 ring-white/20 ring-inset bg-elevated px-4 py-3 shadow-[0_8px_18px_rgba(0,0,0,0.45)]">
                    <p className="text-[13px] text-white/60 mb-2">{t("ui_account_address", "Adresse du compte")}</p>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        className={`min-w-0 flex-1 text-left text-xs text-white/55 font-mono font-light ${footerAddressExpanded ? "break-all whitespace-normal" : "truncate"}`}
                        title={walletAddress}
                        onClick={() => setFooterAddressExpanded((prev) => !prev)}
                        aria-label={t("ui_toggle_wallet_address_truncation", "Afficher l'adresse complète")}
                      >
                        {footerAddressExpanded ? walletAddress : `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard?.writeText?.(walletAddress);
                            setFooterCopyNotice(t("ui_copied_address", "Adresse copiée"));
                            if (footerCopyNoticeTimerRef.current) clearTimeout(footerCopyNoticeTimerRef.current);
                            footerCopyNoticeTimerRef.current = window.setTimeout(() => setFooterCopyNotice(""), 3000);
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
                    <div
                      className={`mt-1.5 text-[11px] text-xcannes-green/85 transition-opacity duration-200 ${footerCopyNotice ? "opacity-100" : "opacity-0"}`}
                      role="status"
                      aria-live="polite"
                    >
                      {footerCopyNotice || " "}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {/* Centre : sélecteur de période */}
            <div className="shrink-0">
              <StatementMonthSelect
                value={selectedMonth}
                onOpenChange={setPeriodDropdownOpen}
                onChange={(nextValue) => {
                  if (nextValue === "archives") {
                    setSelectedMonth("archives");
                    return;
                  }
                  const parsed = Number.parseInt(nextValue, 10);
                  setSelectedMonth(Number.isFinite(parsed) ? parsed : 0);
                }}
                options={availableMonths}
                menuClassName={modalBgClass}
                menuPosition="bottom"
              />
            </div>
            {/* Droite : bouton télécharger */}
            <div className="flex items-center justify-end flex-1">
              <button
                onClick={handleExportPdf}
                disabled={exportFormat === "pdf"}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-1.5 md:py-2 rounded-[10px] text-sm font-medium transition-colors disabled:opacity-50 text-white/70 hover:text-white bg-transparent hover:bg-white/[0.04]"
                aria-label={t("ui_export_pdf_9c8d16b4fe", "Télécharger")}
                title={t("ui_export_pdf_9c8d16b4fe", "Télécharger")}
              >
                <ShareIcon className={`w-4 h-4 ${exportFormat === "pdf" ? "opacity-40" : ""}`} />
                <span>{exportFormat === "pdf" ? t("ui_loading_1386baebe9", "Loading…") : t("ui_export_pdf_9c8d16b4fe", "Télécharger")}</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Content - Zone scrollable */}
        <div
          className={[
            "px-0 py-4 md:py-6 flex flex-col gap-4 overscroll-contain bg-transparent",
            isXrpNetworkView ? "flex-none" : "flex-1 min-h-0",
            isXrpNetworkView
              ? "overflow-visible"
              : "overflow-hidden",
          ].join(" ")}
          style={undefined}
        >
          {isXrpNetworkView ? (
            <XrpNetworkStatement
              hasRlusdTrustline={hasRlusdTrustline}
              rlusdBalance={_rlusdBalance}
              transactions={transactions}
            />
          ) : (
            <>
          {/* Archive Notice */}
          {selectedMonth === "archives" && (
            <div className="bg-blue-500/10 rounded-[20px] p-3 md:p-4">
              <p className="text-sm text-blue-300 flex items-center gap-2">
                <span className="text-xl">📁</span>
                <span>
                  <strong>{t("ui_archives_743254edfe", "Archives:")}</strong>
                  {t(
                    "ui_displaying_transactions_olde_e408b4a17d",
                    "Displaying transactions older than 12 months.",
                  )}
                </span>
              </p>
            </div>
          )}

          {/* Transactions Timeline */}
          {error && (
            <div className="bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
              {error}
            </div>
          )}
          <div
            ref={overlayListRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            onPointerDown={(event) => {
              maybeStartOverlayDrag(event, "list");
            }}
          >
              {loading ? (
                <div className="py-14 text-center text-white/40 text-sm">
                  {t("ui_loading_948e39804b", "Loading…")}
                </div>
              ) : !timelineGroups || timelineGroups.length === 0 ? (
                <div className="py-14 text-center text-white/40 text-sm">
                  {t(
                    "ui_no_transactions_found_af217af8de",
                    "No transactions found",
                  )}
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  {timelineGroups.map((group) => (
                    <div key={group.key}>
                      <div className="px-4 pt-1 pb-0.5 text-[11px] font-light text-white/50 tracking-wide">
                        {group.label}
                      </div>
                      <div className="px-3 pb-1 flex flex-col gap-1.5">
                        {group.transactions.map((tx, idx) => {
                          const transactionId =
                            tx?.id || tx?.txHash || `${group.key}-${idx}`;
                          const isHighlighted =
                            highlightedTransactionId &&
                            transactionId === highlightedTransactionId;
                          const isLast = idx === group.transactions.length - 1;
                          return (
                            <div key={transactionId}>
                              <button
                                type="button"
                                ref={isHighlighted ? highlightRowRef : null}
                                onClick={() => openTxDetails(tx)}
                                className={[
                                  "w-full flex items-center gap-1.5 text-left px-3 py-2 rounded-[16px] bg-transparent ring-1 ring-inset ring-white/[0.06] transition-colors duration-150",
                                  isHighlighted
                                    ? "text-white"
                                    : "text-white/90 hover:text-white",
                                ].join(" ")}
                              >
                                <div className={`w-7 h-7 flex items-center justify-center flex-none text-[15px] leading-none ${
                                  tx?.category === "exchange"
                                    ? "text-blue-300"
                                    : tx?.type === "credit"
                                      ? "text-green-300"
                                      : "text-red-300"
                                }`}>
                                  {getTimelineIcon(tx)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-light text-white/90 break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                    {getTimelineLabel(tx)}
                                  </div>
                                </div>
                                <div className="flex-none max-w-[48%] flex items-center justify-end gap-2">
                                  <div
                                    className={`text-right font-mono font-light whitespace-nowrap overflow-hidden text-ellipsis ${
                                      tx?.type === "debit"
                                        ? "text-red-400"
                                        : "text-xcannes-green"
                                    }`}
                                  >
                                    {tx?.type === "debit" ? "−" : "+"}
                                    {formatAmountRlusdAsLocal(tx?.amount)}
                                  </div>
                                  <span className="text-[16px] leading-none text-white/35">
                                    ›
                                  </span>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            </>
          )}
        </div>

        {/* Bottom bar – mobile */}
        {!inline ? (
          <div
            className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
            aria-hidden
          >
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

  if (inline)
    return (
      <>
        {content}
        {transactionDetailModal}
      </>
    );
  if (typeof document === "undefined") return null;
  return (
    <>
      {createPortal(content, document.body)}
      {transactionDetailModal}
    </>
  );
}
