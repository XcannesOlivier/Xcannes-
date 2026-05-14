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
  const [footerDropdownOpen, setFooterDropdownOpen] = useState(false);
  const [footerAddressExpanded, setFooterAddressExpanded] = useState(false);
  const [footerCopyNotice, setFooterCopyNotice] = useState("");
  const footerCopyNoticeTimerRef = useRef(null);
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
      if (accountCopyNoticeTimerRef.current) clearTimeout(accountCopyNoticeTimerRef.current);
    }
  }, [accountDropdownOpen]);

  useEffect(() => {
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

  /* ── footer dropdown ──────────────────────────────────── */
  useEffect(() => {
    if (!footerDropdownOpen) {
      setFooterAddressExpanded(false);
      setFooterCopyNotice("");
      if (footerCopyNoticeTimerRef.current) clearTimeout(footerCopyNoticeTimerRef.current);
    }
  }, [footerDropdownOpen]);

  useEffect(() => {
    return () => {
      if (footerCopyNoticeTimerRef.current) clearTimeout(footerCopyNoticeTimerRef.current);
    };
  }, []);

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
      const w = 1080;
      const h = 720;
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

      // Background
      ctx.fillStyle = "#0b0f10";
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.25, 0, w * 0.5, h * 0.25, h * 0.9);
      glow.addColorStop(0, "rgba(34,197,94,0.22)");
      glow.addColorStop(0.55, "rgba(34,197,94,0.08)");
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
      ctx.font = "700 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(typeLabel, cardX + 44, cardY + 120);

      // Amount
      ctx.font = "800 86px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.fillStyle = detailTx?.type === "debit" ? "#f87171" : "#22c55e";
      ctx.fillText(amountLabel, cardX + 44, cardY + 220);

      // Meta
      const metaY = cardY + 270;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(t("ui_date_label_7a2c1b9d5e", "Date"), cardX + 44, metaY);
      ctx.fillText(t("ui_status_label", "Statut"), cardX + 44, metaY + 64);
      if (showTaux) {
        ctx.fillText(t("ui_fx_rate", "Taux"), cardX + 44, metaY + 128);
      }
      if (isConversionShare) {
        ctx.fillText(t("ui_account", "Compte"), cardX + 480, metaY);
      }

      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(dateLabel, cardX + 44, metaY + 34);
      ctx.fillText(statusLabel || "—", cardX + 44, metaY + 98);
      if (showTaux) {
        ctx.fillText(tauxLabel || "—", cardX + 44, metaY + 162);
      }
      if (isConversionShare) {
        ctx.fillText(walletLabelText || "—", cardX + 480, metaY + 34);
      }

      if (!isConversionShare) {
        // Counterparty
        const cpTitle = counterpartyTitle || t("ui_counterparty", "Contrepartie");
        const cpY = metaY + (showTaux ? 214 : 150);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.fillText(cpTitle, cardX + 44, cpY);

        ctx.fillStyle = "rgba(255,255,255,0.90)";
        ctx.font = "650 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.fillText(
          nameLabel || t("ui_no_name_found", "Aucun nom trouvé"),
          cardX + 44,
          cpY + 38,
        );

        if (addressLabel) {
          const addr =
            addressLabel.length > 26
              ? `${addressLabel.slice(0, 10)}…${addressLabel.slice(-8)}`
              : addressLabel;
          ctx.fillStyle = "rgba(255,255,255,0.60)";
          ctx.font =
            "600 22px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          ctx.fillText(addr, cardX + 44, cpY + 78);
        }
      }

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
        className={`relative w-full wallet-modal-panel wallet-modal-no-top-highlight-mobile ${modalBgClass} flex flex-col min-h-0 ${statementPanelOverflowClass} z-[10201] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] ${
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
	          className={`relative flex-shrink-0 bg-[#111518] shadow-[inset_0_16px_28px_rgba(255,255,255,0.03),inset_0_-46px_70px_rgba(0,0,0,0.55)] px-4 md:px-6 py-3 md:py-4`}
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
                    width={32}
                    height={32}
                      className="flex-shrink-0 w-8 h-8 rounded-md"
                  />
                ) : (
                  <Image
                    src={CRYPTO_ICONS[displayCurrency]}
                    alt={displayCurrency}
                    width={32}
                    height={32}
                      className="flex-shrink-0 w-8 h-8 rounded-md"
                  />
                )
              ) : (
                  <span className="text-3xl flex-shrink-0 leading-none">
                  {getCurrencyFlag(displayCurrency)}
                </span>
              )}
              <h2 className="text-[30px] md:text-[34px] font-bold text-white/95 tracking-tight min-w-0 truncate">
                {headerTitle}
              </h2>
              {noticeVariant === "demo" ? (
                <span className="inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                  {t("demo_notice_title", "Mode démo")}
                </span>
              ) : null}
                </div>
              <p className="-mt-1 text-[17px] md:text-[18px] text-white/55 leading-relaxed">
                {t(
                  "ui_currency_statement_subtitle_periods",
                  "Suivez le solde et les mouvements de cette devise.",
                )}
              </p>
	              </div>
              {/* close via swipe/backdrop */}
	          </div>

          {/* Account Info dans le header */}
          <div className="space-y-3">
            {/* Balance + USD estimé */}
            {!isXrpNetworkView ? (
              <div className="flex flex-col items-center text-center gap-0.5 mt-10 mb-10 w-fit mx-auto rounded-2xl ring-1 ring-white/10 ring-inset bg-[#0c0f11] shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)] px-8 py-4">
                <p className="text-[24px] md:text-[26px] text-white/60">
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
            ) : null}
          </div>
        </div>

        {/* Filtres */}
        {!isXrpNetworkView ? (
          <div className="px-4 md:px-6 pb-4 flex flex-row items-stretch md:items-center gap-2">
            <div className="flex flex-1 items-center rounded-[16px] p-1 ring-1 ring-white/[0.05] ring-inset bg-gradient-to-b from-[#101415] to-[#0d1214]">
              {[
                { key: "all", label: stripCountSuffix(t("ui_all_0c90d41d71", "Tout")) },
                { key: "credit", label: stripCountSuffix(t("ui_credits_b8166276a0", "Entrées")) },
                { key: "debit", label: stripCountSuffix(t("ui_debits_38c870b18f", "Sorties")) },
                { key: "conversion", label: stripCountSuffix(t("ui_conversions_b604b5ef8b", "Conversions")) },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`px-3 py-3 flex-1 text-center rounded-[12px] text-sm font-medium transition-colors whitespace-nowrap ${
                    filter === item.key
                      ? item.key === "all"
                        ? "bg-[#080a0b] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-14px_18px_rgba(0,0,0,0.9)]"
                        : item.key === "credit"
                          ? "bg-green-500/15 text-green-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                          : item.key === "debit"
                            ? "bg-red-500/15 text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                            : "bg-blue-500/15 text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                      : item.key === "all"
                        ? "text-white/60 hover:text-white/80 bg-[#111518] hover:bg-[#080a0b]"
                        : item.key === "credit"
                          ? "text-white/60 hover:text-green-300 bg-[#111518] hover:bg-green-500/15"
                          : item.key === "debit"
                            ? "text-white/60 hover:text-red-300 bg-[#111518] hover:bg-red-500/15"
                            : "text-white/60 hover:text-blue-300 bg-[#111518] hover:bg-blue-500/15"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Content - Zone scrollable */}
        <div
          className={[
            "px-0 py-4 md:py-6 flex flex-col gap-4 overscroll-contain bg-gradient-to-b from-[#101415] to-[#0d1214]",
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
                      <div className="px-4 pt-1 pb-0.5 text-[11px] font-semibold text-white/50 tracking-wide">
                        {group.label}
                      </div>
                      <div className="px-3 pb-1">
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
                                  "w-full flex items-center gap-1.5 text-left px-3 py-2 rounded-[16px] bg-[#101415] ring-1 ring-inset ring-white/[0.06] shadow-[inset_0_-14px_18px_rgba(0,0,0,0.8)] transition-colors duration-150",
                                  isHighlighted
                                    ? "text-white"
                                    : "text-white/90 hover:text-white",
                                ].join(" ")}
                              >
                                <div className="w-7 h-7 flex items-center justify-center text-white/85 flex-none">
                                  <span className="text-[15px] leading-none text-white/95">
                                    {getTimelineIcon(tx)}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm text-white/90 break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                    {getTimelineLabel(tx)}
                                  </div>
                                </div>
                                <div className="flex-none max-w-[48%] flex items-center justify-end gap-2">
                                  <div
                                    className={`text-right font-mono font-semibold whitespace-nowrap overflow-hidden text-ellipsis ${
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

        {/* Footer */}
        <div className={`shrink-0 px-4 md:px-6 py-1.5 md:py-3 pb-[max(6px,env(safe-area-inset-bottom))] md:pb-[max(12px,env(safe-area-inset-bottom))] border-t border-white/[0.06] bg-[#111518] shadow-[inset_0_-46px_70px_rgba(0,0,0,0.55)] flex items-center justify-between gap-2 ${periodDropdownOpen ? "relative z-[70]" : ""}`}>
          {/* Compte actuel */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-auto min-w-[120px] max-w-[180px]" ref={footerDropdownRef}>
              <button
                type="button"
                onClick={() => setFooterDropdownOpen((prev) => !prev)}
                className="w-full inline-flex items-center justify-center gap-0 px-1 md:px-3 py-2 bg-transparent transition-all rounded-[10px]"
                aria-haspopup="menu"
                aria-expanded={footerDropdownOpen}
                title={t("ui_current_account_plain", "Compte actuel")}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-xcannes-green ring-2 ring-xcannes-green/20 shrink-0 animate-pulse mr-1" aria-hidden />
                <span className="text-white/95 text-sm font-semibold truncate min-w-0">
                  {walletLabel || t("nav_wallet", "Wallet")}
                </span>
                <svg
                  className="w-4 h-4 text-white/45 shrink-0"
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
                  {footerDropdownOpen ? <path d="M4 20L20 4" /> : null}
                </svg>
              </button>
              {footerDropdownOpen && walletAddress ? (
                <div className="absolute bottom-full left-0 z-[200] w-full mb-1 rounded-[10px] ring-1 ring-white/20 ring-inset bg-elevated px-4 py-3 shadow-[0_-8px_18px_rgba(0,0,0,0.45)]">
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
          {/* Période du relevé — centre */}
          {!isXrpNetworkView ? (
            <div className="flex-[3] md:flex-[5] min-w-0 flex flex-col items-stretch px-2 md:px-6">
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
                menuPosition="top"
              />
            </div>
          ) : null}
          {/* Bouton télécharger */}
          <button
            onClick={handleExportPdf}
            disabled={exportFormat === "pdf"}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-colors disabled:opacity-50 text-white/70 hover:text-white bg-transparent hover:bg-white/[0.04]"
            aria-label={t("ui_export_pdf_9c8d16b4fe", "Télécharger")}
            title={t("ui_export_pdf_9c8d16b4fe", "Télécharger")}
          >
            <ShareIcon className={`w-4 h-4 ${exportFormat === "pdf" ? "opacity-40" : ""}`} />
            <span className="hidden md:inline">{exportFormat === "pdf" ? t("ui_loading_1386baebe9", "Loading…") : t("ui_export_pdf_9c8d16b4fe", "Télécharger")}</span>
          </button>
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
