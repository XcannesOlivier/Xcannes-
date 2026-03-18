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
import { getCurrencyDescription } from "../utils/demoCurrencyDescriptions";
import { CRYPTO_ICONS } from "../utils/demoMarketConstants";
import {
  buildCsvString,
  downloadTextFile,
  escapeHtml,
  openPrintWindow,
  sha256Hex,
} from "../utils/demoStatementExport";
import { useTranslation } from "next-i18next";
import DemoStatementMonthSelect from "./DemoStatementMonthSelect";
import { apiUrl } from "@/lib/runtimeConfig";
import {
  formatAmountWithSymbol,
  getDisplayCurrencyCode,
} from "../demoWalletDashboardConfig";

const USD_STABLECOINS = [
  "RLUSD",
  "USD",
];
const HIGHLIGHT_DURATION_MS = 5000;
const STATEMENT_HISTORY_MONTHS = 13;

const stripCountSuffix = (label) =>
  String(label || "")
    .replace(/\s*[\(\uFF08]\s*$/, "")
    .trim();

const ShareIcon = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const isSvgIcon = (src) => {
  if (!src) return false;
  return String(src).toLowerCase().endsWith(".svg");
};

const buildMonthKeyUtc = (date) => {
  if (!(date instanceof Date)) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return `${year}-${String(month).padStart(2, "0")}`;
};

const buildDefaultMonthKeys = (months) => {
  const now = new Date();
  const list = [];
  for (let i = 0; i < months; i += 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const key = buildMonthKeyUtc(date);
    if (key) list.push(key);
  }
  return list;
};

const getMonthKeyFromTransaction = (tx) => {
  const createdAt = tx?.createdAt ? new Date(tx.createdAt) : null;
  if (createdAt && Number.isFinite(createdAt.getTime())) {
    return buildMonthKeyUtc(createdAt);
  }
  const dateRaw = String(tx?.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const [year, month] = dateRaw
      .split("-")
      .map((value) => Number.parseInt(value, 10));
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }
  return null;
};

const formatMonthLabel = (monthKey, locale, { monthOnly = false } = {}) => {
  if (!monthKey) return "";
  const [year, month] = String(monthKey)
    .split("-")
    .map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(
    locale || "en",
    monthOnly ? { month: "long" } : { month: "long", year: "numeric" },
  );
};

/**
 * Composant de relevé bancaire pour une devise spécifique
 */
export default function DemoCurrencyStatement({
  currency,
  balance,
  issuer,
  walletAddress,
  walletLabelOverride = "",
  isPreviewMode = false,
  noticeVariant = "preview",
  transactions = [],
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  loading = false,
  error = null,
  period = "",
  isFullPage = false,
  variant = "default",
  isClosing = false,
  inline = false,
  usdRates = {},
  rlusdBalance = null,
  statementMonths = [],
  highlightTransactionId = null,
  onClose,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const normalizedCurrency = useMemo(
    () => String(currency || "").toUpperCase(),
    [currency],
  );
  const displayCurrency = useMemo(
    () => getDisplayCurrencyCode(normalizedCurrency),
    [normalizedCurrency],
  );
  const currencyDescription = useMemo(
    () => String(getCurrencyDescription(normalizedCurrency) || "").trim(),
    [normalizedCurrency],
  );
  const [filter, setFilter] = useState("all"); // all, credit, debit, conversion
  const [exportFormat, setExportFormat] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = current month, 1 = last month, etc.
  const [isMobileDate, setIsMobileDate] = useState(variant === "dex-mobile");
  const [reserveOpen, setReserveOpen] = useState(false);
  const [docHash, setDocHash] = useState("");
  const resolvedLabelOverride = String(walletLabelOverride || "").trim();
  const [walletLabel, setWalletLabel] = useState(resolvedLabelOverride);
  const [highlightedTransactionId, setHighlightedTransactionId] =
    useState(null);
  const [detailTx, setDetailTx] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [counterpartyLabels, setCounterpartyLabels] = useState({});
  const highlightRowRef = useRef(null);
  const highlightTimerRef = useRef(null);
  const labelCacheRef = useRef(new Map());
  const defaultPeriod = t(
    "ui_statement_period_default_5f4c8a7d2b",
    "December 2025",
  );
  const archivesLabel = t("ui_archives_label_3c1f8a7b2e", "Archives");
  const archivesLongLabel = t(
    "ui_archives_12plus_7b3c9a1d5e",
    "Archives (12+ months)",
  );
  const fallbackPeriod = period || defaultPeriod;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      setIsMobileDate(window.innerWidth < 640);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!highlightTransactionId) return undefined;
    setHighlightedTransactionId(highlightTransactionId);
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedTransactionId(null);
    }, HIGHLIGHT_DURATION_MS);
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, [highlightTransactionId]);

  useEffect(() => {
    setWalletLabel(resolvedLabelOverride);
  }, [resolvedLabelOverride]);

  const estimatedUsd = useMemo(() => {
    const value = Number.parseFloat(balance || 0) || 0;
    const code = normalizedCurrency;
    if (!code) return value;
    const rate = usdRates?.[code];
    if (Number.isFinite(rate)) return value * rate;
    if (USD_STABLECOINS.includes(code)) return value;
    return value;
  }, [balance, normalizedCurrency, usdRates]);

  const showReserveDetails = isPreviewMode;
  const reservePlaceholder = "—";

  const baseTransactions = useMemo(
    () => (Array.isArray(transactions) ? transactions : []),
    [transactions],
  );

  const statementMonthKeys = useMemo(() => {
    const provided = Array.isArray(statementMonths)
      ? statementMonths.filter(
          (key) => typeof key === "string" && key.length >= 7,
        )
      : [];
    if (provided.length > 0) return provided;

    const derived = new Set();
    for (const tx of baseTransactions || []) {
      const key = getMonthKeyFromTransaction(tx);
      if (key) derived.add(key);
    }
    if (derived.size > 0) {
      return Array.from(derived).sort((a, b) => b.localeCompare(a));
    }

    return buildDefaultMonthKeys(STATEMENT_HISTORY_MONTHS);
  }, [statementMonths, baseTransactions]);

  const availableMonths = useMemo(() => {
    const keys = statementMonthKeys || [];
    const visibleKeys = keys.slice(0, 12);
    const months = visibleKeys.map((key, idx) => ({
      value: idx,
      key,
      label: formatMonthLabel(key, locale),
      displayLabel: formatMonthLabel(key, locale, { monthOnly: true }),
    }));
    if (keys.length > 12) {
      months.push({
        value: "archives",
        key: "archives",
        label: archivesLongLabel,
        displayLabel: archivesLabel,
      });
    }
    return months;
  }, [statementMonthKeys, locale, archivesLongLabel, archivesLabel]);

  useEffect(() => {
    const hasArchives = availableMonths.some(
      (option) => option.value === "archives",
    );
    if (selectedMonth === "archives" && !hasArchives) {
      setSelectedMonth(0);
      return;
    }
    if (typeof selectedMonth === "number") {
      const maxIndex =
        availableMonths.filter((option) => typeof option.value === "number")
          .length - 1;
      if (maxIndex >= 0 && selectedMonth > maxIndex) {
        setSelectedMonth(0);
      }
    }
  }, [availableMonths, selectedMonth]);

  const selectedMonthKey = useMemo(() => {
    if (selectedMonth === "archives") return null;
    const option = availableMonths.find(
      (item) =>
        typeof item?.value === "number" &&
        Number(item.value) === Number(selectedMonth),
    );
    return option?.key || null;
  }, [availableMonths, selectedMonth]);

  const currentPeriod =
    selectedMonth === "archives"
      ? archivesLabel
      : availableMonths.find((option) => option.value === selectedMonth)
          ?.label || fallbackPeriod;
  const currentDisplayPeriod =
    selectedMonth === "archives"
      ? archivesLabel
      : availableMonths.find((option) => option.value === selectedMonth)
          ?.displayLabel || String(fallbackPeriod).split(" ")[0];

  const selectedMonthKeys = useMemo(() => {
    if (selectedMonth === "archives") {
      return statementMonthKeys.slice(12);
    }
    return selectedMonthKey ? [selectedMonthKey] : [];
  }, [selectedMonth, selectedMonthKey, statementMonthKeys]);

  const periodTransactions = useMemo(() => {
    if (!selectedMonthKeys.length) return [];
    const keySet = new Set(selectedMonthKeys);
    return baseTransactions.filter((tx) => {
      const key = getMonthKeyFromTransaction(tx);
      return key && keySet.has(key);
    });
  }, [baseTransactions, selectedMonthKeys]);

  // Calculer les statistiques (sur la période sélectionnée)
  const credits = periodTransactions.filter((t) => t.type === "credit");
  const debits = periodTransactions.filter((t) => t.type === "debit");
  const conversions = periodTransactions.filter(
    (t) => t.category === "exchange",
  );

  const totalCredits = credits.reduce(
    (sum, t) => sum + parseFloat(t.amount || 0),
    0,
  );
  const totalDebits = debits.reduce(
    (sum, t) => sum + parseFloat(t.amount || 0),
    0,
  );

  const openingBalance = balance - totalCredits + totalDebits;
  const closingBalance = balance;
  const netChange = closingBalance - openingBalance;
  const percentChange =
    openingBalance !== 0 ? (netChange / openingBalance) * 100 : 0;

  // Statistiques supplémentaires
  const avgTransaction =
    periodTransactions.length > 0
      ? (totalCredits + totalDebits) / periodTransactions.length
      : 0;
  const largestTransaction = periodTransactions.reduce((max, t) => {
    const amount = parseFloat(t.amount || 0);
    return amount > max ? amount : max;
  }, 0);

  // Catégorisation par type
  const transactionsByCategory = periodTransactions.reduce((acc, tx) => {
    const cat = tx.category || "other";
    if (!acc[cat]) acc[cat] = { count: 0, amount: 0 };
    acc[cat].count++;
    acc[cat].amount += parseFloat(tx.amount || 0);
    return acc;
  }, {});

  // Données pour graphiques (fictives basées sur les transactions)
  const monthlyData = [
    { day: "01", balance: openingBalance * 0.95 },
    { day: "05", balance: openingBalance * 0.92 },
    { day: "10", balance: openingBalance * 0.98 },
    { day: "15", balance: openingBalance * 1.05 },
    { day: "20", balance: openingBalance * 1.02 },
    { day: "25", balance: openingBalance * 1.08 },
    { day: "28", balance: closingBalance },
  ];

  // Filtrer les transactions
  const filteredTransactions = useMemo(() => {
    return periodTransactions.filter((t) => {
      if (filter === "credit") return t.type === "credit";
      if (filter === "debit") return t.type === "debit";
      if (filter === "conversion") return t.category === "exchange";
      return true;
    });
  }, [periodTransactions, filter]);

  const transactionsWithDisplayBalance = useMemo(() => {
    const list = (filteredTransactions || []).map((tx) => ({ ...tx }));
    const currentDisplayBalance = Number.isFinite(Number(balance))
      ? Number(balance)
      : null;
    let displayBalance = currentDisplayBalance;
    let stopDisplayBalance = false;

    for (const tx of list) {
      if (stopDisplayBalance) continue;
      const kind = String(tx?.kind || "")
        .trim()
        .toUpperCase();
      const displayAmount = Number(tx?.displayAmount ?? tx?.amount ?? NaN);
      const displayCurrency = String(
        tx?.displayCurrencyCode || normalizedCurrency || "",
      )
        .trim()
        .toUpperCase();
      const isMoonpay = kind === "MOONPAY_BUY" || kind === "MOONPAY_SELL";
      const hasDisplay =
        isMoonpay &&
        Number.isFinite(displayBalance) &&
        Number.isFinite(displayAmount) &&
        displayAmount > 0 &&
        displayCurrency &&
        displayCurrency === normalizedCurrency;
      if (!hasDisplay) continue;

      if (kind === "MOONPAY_BUY") {
        tx.displayRunningBalance = displayBalance;
        const delta = Math.abs(displayAmount);
        displayBalance -= delta;
        continue;
      }

      if (kind === "MOONPAY_SELL") {
        stopDisplayBalance = true;
      }
    }

    return list;
  }, [filteredTransactions, balance, normalizedCurrency]);

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
      const addr = String(tx?.counterparty || "").trim();
      const cachedLabel =
        (addr && (counterpartyLabels?.[addr] ?? labelCacheRef.current.get(addr))) ||
        "";
      const name = cachedLabel ? cachedLabel : formatCounterpartyCompact(addr);
      return name ? `${base} · ${name}` : base;
    },
    [
      counterpartyLabels,
      formatCounterpartyCompact,
      getLocalizedDescription,
      parseConversionPair,
      t,
    ],
  );

  /* ── prefetch counterparty labels for the list ─────────── */
  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const list = Array.isArray(transactionsWithDisplayBalance)
      ? transactionsWithDisplayBalance
      : [];
    if (!list.length) return () => {};

    const isXrplAddress = (value) =>
      /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(String(value || "").trim());

    const candidates = [];
    for (const tx of list) {
      const addr = String(tx?.counterparty || "").trim();
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
  }, [transactionsWithDisplayBalance, counterpartyLabels]);

  const openTxDetails = useCallback((tx) => {
    if (!tx) return;
    setDetailTx(tx);
    setDetailOpen(true);
  }, []);

  const closeTxDetails = useCallback(() => {
    setDetailOpen(false);
    setDetailTx(null);
  }, []);

  const formatDateTime = useCallback(
    (tx) => {
      const raw = tx?.createdAt || tx?.date || "";
      const parsed = new Date(raw);
      if (!Number.isFinite(parsed.getTime())) return String(raw || "");
      return parsed.toLocaleString(locale);
    },
    [locale],
  );

  useEffect(() => {
    if (!highlightedTransactionId) return;
    const node = highlightRowRef.current;
    if (!node) return;
    const raf = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [filter, highlightedTransactionId, transactions]);

  const ledgerEvidenceCount = useMemo(() => {
    return (transactions || []).filter((t) => t?.txHash).length;
  }, [transactions]);

  const ledgerLastIndex = useMemo(() => {
    const indexes = (transactions || [])
      .map((t) => Number(t?.ledgerIndex))
      .filter((v) => Number.isFinite(v));
    if (!indexes.length) return null;
    return Math.max(...indexes);
  }, [transactions]);

  const ledgerStatus = useMemo(() => {
    if (isPreviewMode) return "preview";
    if (!["RLUSD", "USD"].includes(normalizedCurrency))
      return "offchain";
    if (ledgerEvidenceCount > 0) return "verified";
    return "available";
  }, [isPreviewMode, ledgerEvidenceCount, normalizedCurrency]);

  const ledgerStatusLabel = useMemo(() => {
    if (ledgerStatus === "verified") {
      return t(
        "ui_verified_on_xrp_ledger_334f28ce50",
        "Verified on XRP Ledger",
      );
    }
    if (ledgerStatus === "available") {
      return t(
        "ui_ledger_available_no_tx_f4",
        "Ledger available (no transactions yet)",
      );
    }
    if (ledgerStatus === "offchain") {
      return t(
        "ui_ledger_offchain_allocations_f4",
        "Ledger validation unavailable for off-chain allocations",
      );
    }
    return t(
      "ui_ledger_preview_unavailable_f4",
      "Ledger validation unavailable (preview)",
    );
  }, [ledgerStatus, t]);

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
      period: currentPeriod || fallbackPeriod,
      balance: safeBalance,
      transactions: txPayload,
    });
  }, [
    balance,
    currentPeriod,
    fallbackPeriod,
    transactionsWithDisplayBalance,
    normalizedCurrency,
    walletAddress,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined") return () => {};
    (async () => {
      const hash = await sha256Hex(statementHashInput);
      if (!cancelled) setDocHash(hash);
    })();
    return () => {
      cancelled = true;
    };
  }, [statementHashInput]);

  // Fonction pour obtenir le drapeau de la devise
  const getCurrencyFlag = useCallback((curr) => {
    const flags = {
      // Devises fiat - Monde entier
      USD: "🇺🇸", // Dollar américain
      EUR: "🇪🇺", // Euro
      GBP: "🇬🇧", // Livre sterling
      JPY: "🇯🇵", // Yen japonais
      CHF: "🇨🇭", // Franc suisse
      CAD: "🇨🇦", // Dollar canadien
      AUD: "🇦🇺", // Dollar australien
      CNY: "🇨🇳", // Yuan chinois
      INR: "🇮🇳", // Roupie indienne
      BRL: "🇧🇷", // Real brésilien
      MXN: "🇲🇽", // Peso mexicain
      KRW: "🇰🇷", // Won sud-coréen
      RUB: "🇷🇺", // Rouble russe
      ZAR: "🇿🇦", // Rand sud-africain
      SGD: "🇸🇬", // Dollar de Singapour
      HKD: "🇭🇰", // Dollar de Hong Kong
      NOK: "🇳🇴", // Couronne norvégienne
      SEK: "🇸🇪", // Couronne suédoise
      DKK: "🇩🇰", // Couronne danoise
      PLN: "🇵🇱", // Zloty polonais
      TRY: "🇹🇷", // Livre turque
      AED: "🇦🇪", // Dirham des EAU
      SAR: "🇸🇦", // Riyal saoudien
      THB: "🇹🇭", // Baht thaïlandais
      IDR: "🇮🇩", // Roupie indonésienne
      MYR: "🇲🇾", // Ringgit malaisien
      PHP: "🇵🇭", // Peso philippin
      NZD: "🇳🇿", // Dollar néo-zélandais
      ARS: "🇦🇷", // Peso argentin
      CLP: "🇨🇱", // Peso chilien
      COP: "🇨🇴", // Peso colombien
      PEN: "🇵🇪", // Sol péruvien
      EGP: "🇪🇬", // Livre égyptienne
      NGN: "🇳🇬", // Naira nigérian
      KES: "🇰🇪", // Shilling kényan
      GHS: "🇬🇭", // Cedi ghanéen
      MAD: "🇲🇦", // Dirham marocain
      TND: "🇹🇳", // Dinar tunisien

      // Afrique
      XOF: "🇸🇳", // Franc CFA (Sénégal)
      XAF: "🇨🇲", // Franc CFA (Cameroun)
      UGX: "🇺🇬", // Shilling ougandais
      TZS: "🇹🇿", // Shilling tanzanien
      ETB: "🇪🇹", // Birr éthiopien
      MUR: "🇲🇺", // Roupie mauricienne
      BWP: "🇧🇼", // Pula botswanais
      ZMW: "🇿🇲", // Kwacha zambien
      AOA: "🇦🇴", // Kwanza angolais
      MZN: "🇲🇿", // Metical mozambicain

      // Amérique Latine
      VES: "🇻🇪", // Bolivar vénézuélien
      UYU: "🇺🇾", // Peso uruguayen
      PYG: "🇵🇾", // Guarani paraguayen
      BOB: "🇧🇴", // Boliviano bolivien
      CRC: "🇨🇷", // Colon costaricain
      GTQ: "🇬🇹", // Quetzal guatémaltèque
      HNL: "🇭🇳", // Lempira hondurien
      NIO: "🇳🇮", // Cordoba nicaraguayen
      PAB: "🇵🇦", // Balboa panaméen
      SOL: "🇵🇪", // Sol péruvien (affichage)
      DOP: "🇩🇴", // Peso dominicain
      HTG: "🇭🇹", // Gourde haïtienne
      JMD: "🇯🇲", // Dollar jamaïcain
      TTD: "🇹🇹", // Dollar de Trinité-et-Tobago

      // Asie-Pacifique
      VND: "🇻🇳", // Dong vietnamien
      LAK: "🇱🇦", // Kip laotien
      KHR: "🇰🇭", // Riel cambodgien
      MMK: "🇲🇲", // Kyat birman
      BDT: "🇧🇩", // Taka bangladais
      PKR: "🇵🇰", // Roupie pakistanaise
      LKR: "🇱🇰", // Roupie srilankaise
      NPR: "🇳🇵", // Roupie népalaise
      AFN: "🇦🇫", // Afghani afghan
      MNT: "🇲🇳", // Tugrik mongol
      KZT: "🇰🇿", // Tenge kazakh
      UZS: "🇺🇿", // Som ouzbek
      TJS: "🇹🇯", // Somoni tadjik
      KGS: "🇰🇬", // Som kirghiz
      TWD: "🇹🇼", // Dollar taïwanais

      // Moyen-Orient
      ILS: "🇮🇱", // Shekel israélien
      JOD: "🇯🇴", // Dinar jordanien
      KWD: "🇰🇼", // Dinar koweïtien
      BHD: "🇧🇭", // Dinar bahreïni
      OMR: "🇴🇲", // Rial omanais
      QAR: "🇶🇦", // Riyal qatari
      IQD: "🇮🇶", // Dinar irakien
      SYP: "🇸🇾", // Livre syrienne
      LBP: "🇱🇧", // Livre libanaise
      YER: "🇾🇪", // Rial yéménite

      // Europe de l'Est et autres
      CZK: "🇨🇿", // Couronne tchèque
      HUF: "🇭🇺", // Forint hongrois
      RON: "🇷🇴", // Leu roumain
      BGN: "🇧🇬", // Lev bulgare
      RSD: "🇷🇸", // Dinar serbe
      UAH: "🇺🇦", // Hryvnia ukrainienne
      BYN: "🇧🇾", // Rouble biélorusse
      GEL: "🇬🇪", // Lari géorgien
      AMD: "🇦🇲", // Dram arménien
      AZN: "🇦🇿", // Manat azerbaïdjanais
      MDL: "🇲🇩", // Leu moldave
      ALL: "🇦🇱", // Lek albanais
      MKD: "🇲🇰", // Denar macédonien
      BAM: "🇧🇦", // Mark convertible bosniaque
      ISK: "🇮🇸", // Couronne islandaise

      // Océanie et autres
      FJD: "🇫🇯", // Dollar fidjien
      PGK: "🇵🇬", // Kina papouasien
      WST: "🇼🇸", // Tala samoan
      TOP: "🇹🇴", // Pa'anga tongien
      VUV: "🇻🇺", // Vatu vanuatais

      // Stablecoins
      RLUSD: "🇺🇸", // USD
    };
    return flags[curr] || "💱"; // Fallback sur l'emoji exchange
  }, []);

  const parseConversionPair = useCallback((description) => {
    if (!description) return null;
    const text = String(description).trim();
    let match = text.match(/([A-Z]{3,6})\s*(?:→|->)\s*([A-Z]{3,6})/);
    if (!match) {
      match = text.match(/([A-Z]{3,6})\s*\/\s*([A-Z]{3,6})/);
    }
    if (!match) return null;
    return { from: match[1], to: match[2] };
  }, []);

  const getLocalizedDescription = useCallback(
    (tx) => {
      const kind = String(tx?.kind || "")
        .trim()
        .toUpperCase();
      const rawCounterparty = tx?.counterparty
        ? String(tx.counterparty).trim()
        : "";
      const counterparty = rawCounterparty;
      const category = String(tx?.category || "")
        .trim()
        .toLowerCase();

      if (kind === "PAYMENT_OUT") {
        return counterparty
          ? t("statement_payment_out_to", "Envoyé à {{counterparty}}", {
              counterparty,
            })
          : t("statement_payment_out_generic", "Paiement envoyé");
      }
      if (kind === "PAYMENT_IN") {
        return counterparty
          ? t("statement_payment_in_from", "Reçu de {{counterparty}}", {
              counterparty,
            })
          : t("statement_payment_in_generic", "Paiement reçu");
      }
      if (kind === "XRPL_PAYMENT_OUT") {
        return t("statement_xrpl_payment_out", "Paiement envoyé");
      }
      if (kind === "XRPL_PAYMENT_IN") {
        return t("statement_xrpl_payment_in", "Paiement reçu");
      }
      if (kind === "MOONPAY_BUY") {
        return t("statement_buy_bank", "Purchase by bank payment");
      }
      if (kind === "MOONPAY_SELL") {
        return t("statement_sell_bank", "Sale to bank account");
      }
      if (category === "exchange") {
        const pair = parseConversionPair(tx?.description || "");
        if (pair) {
          return `${t("statement_conversion_label", "Conversion")} ${pair.from} → ${pair.to}`;
        }
      }

      return tx?.description || "";
    },
    [parseConversionPair, t],
  );

  const formatDate = useCallback(
    (dateStr) => {
      if (!dateStr) return t("ui_not_available_9c2a1f7b3d", "N/A");
      const date = new Date(dateStr);
      const options = isMobileDate
        ? { day: "2-digit", month: "2-digit" }
        : { day: "2-digit", month: "2-digit", year: "numeric" };
      return date.toLocaleDateString(locale, options);
    },
    [isMobileDate, locale, t],
  );

  const formatAmountWithSymbolLocal = useCallback(
    (amount) =>
      formatAmountWithSymbol(locale, amount, displayCurrency, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [displayCurrency, locale],
  );

  const formatUsdWithSymbol = useCallback(
    (amount) =>
      formatAmountWithSymbol(locale, amount, "USD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );

  const buildPrintHtml = useCallback(() => {
    const generatedAt = new Date().toLocaleString(locale);
    const ledgerIndexLabel =
      ledgerLastIndex != null ? String(ledgerLastIndex) : "-";
    const docHashLabel = docHash || "-";
    const walletLabelText = walletLabel || t("nav_wallet", "Wallet");
    const balanceValue = Number.isFinite(Number(balance)) ? Number(balance) : 0;
    const balanceDisplay = formatAmountWithSymbol(
      locale,
      balanceValue,
      displayCurrency,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
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
          tx?.counterparty && !txDescription.includes(tx.counterparty)
            ? `(${tx.counterparty})`
            : "";
        const fullDescription = [txDescription, counterparty]
          .filter(Boolean)
          .join(" ");
        return `
        <tr>
          <td>${escapeHtml(formatDate(tx?.date))}</td>
          <td>${escapeHtml(fullDescription)}</td>
          <td>${escapeHtml(txType)}</td>
          <td class="right">${escapeHtml(
            `${isDebit ? "-" : "+"}${formatAmountWithSymbol(
              locale,
              tx?.amount,
              displayCurrency,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}`,
          )}</td>
          <td class="right">${escapeHtml(
            formatAmountWithSymbol(
              locale,
              tx?.displayRunningBalance != null
                ? tx.displayRunningBalance
                : tx?.runningBalance,
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
      <h1>${escapeHtml(`${displayCurrency} ${t("ui_statement_a87c93acb8", "Statement")}`)}</h1>
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
    transactionsWithDisplayBalance,
    formatDate,
    ledgerLastIndex,
    ledgerStatusLabel,
    locale,
    t,
    walletAddress,
    walletLabel,
  ]);

  const handleExportPdf = useCallback(() => {
    setExportFormat("pdf");
    try {
      const suffix = docHash ? docHash.slice(0, 12) : "draft";
      const ok = openPrintWindow({
        title: `XCANNES ${displayCurrency || "Statement"} ${suffix}`,
        bodyHtml: buildPrintHtml(),
      });
      if (!ok && typeof window !== "undefined") {
        window.alert(
          t(
            "ui_popup_blocked_1c7a9d3b5e",
            "Popup blocked. Please allow popups to export or print.",
          ),
        );
      }
    } finally {
      setExportFormat(null);
    }
  }, [buildPrintHtml, docHash, displayCurrency, t]);

  const handlePrint = useCallback(() => {
    const suffix = docHash ? docHash.slice(0, 12) : "draft";
    const ok = openPrintWindow({
      title: `XCANNES ${displayCurrency || "Statement"} ${suffix}`,
      bodyHtml: buildPrintHtml(),
    });
    if (!ok && typeof window !== "undefined") {
      window.alert(
        t(
          "ui_popup_blocked_1c7a9d3b5e",
          "Popup blocked. Please allow popups to export or print.",
        ),
      );
    }
  }, [buildPrintHtml, docHash, displayCurrency, t]);

  const handleExportCsv = useCallback(() => {
    setExportFormat("csv");
    try {
      const suffix = docHash ? docHash.slice(0, 12) : "draft";
      const headers = [
        "date",
        "type",
        "category",
        "description",
        "amount",
        "running_balance",
        "statement_balance",
        "counterparty",
        "currency",
        "ledger_status",
        "ledger_index",
        "doc_hash",
      ];
      const rows = (transactionsWithDisplayBalance || []).map((tx) => [
        tx?.date || "",
        tx?.type || "",
        tx?.category || "",
        getLocalizedDescription(tx),
        Number.isFinite(Number(tx?.amount)) ? Number(tx.amount) : "",
        Number.isFinite(Number(tx?.displayRunningBalance))
          ? Number(tx.displayRunningBalance)
          : Number.isFinite(Number(tx?.runningBalance))
            ? Number(tx.runningBalance)
            : "",
        Number.isFinite(Number(balance)) ? Number(balance) : "",
        tx?.counterparty || "",
        displayCurrency || "",
        ledgerStatus,
        ledgerLastIndex != null ? ledgerLastIndex : "",
        docHash || "",
      ]);
      const csv = buildCsvString(headers, rows);
      downloadTextFile({
        filename: `xcannes-statement-${String(displayCurrency || "currency").toLowerCase()}-${suffix}.csv`,
        content: csv,
        type: "text/csv;charset=utf-8",
      });
    } finally {
      setExportFormat(null);
    }
  }, [
    balance,
    docHash,
    displayCurrency,
    getLocalizedDescription,
    transactionsWithDisplayBalance,
    ledgerLastIndex,
    ledgerStatus,
  ]);

  const STATEMENT_LAYOUTS = {
    full: {
      backdropClass: "bg-black/80 md:backdrop-blur-sm",
      wrapperClass: "items-stretch justify-center px-0 md:items-center md:px-4",
      panelClass:
        "w-full h-[100dvh] max-h-[100dvh] rounded-none border-0 md:h-auto md:max-w-4xl md:rounded-2xl md:max-h-[92vh] lg:max-w-5xl",
    },
    "dex-desktop": {
      backdropClass: "bg-black/75 md:backdrop-blur-sm",
      wrapperClass: "items-center justify-center px-3 md:px-4",
      panelClass: "max-w-4xl lg:max-w-5xl rounded-2xl max-h-[90vh]",
    },
    "dex-mobile": {
      backdropClass: "bg-black/90 md:backdrop-blur-sm",
      wrapperClass: "items-stretch justify-center px-0",
      panelClass:
        "w-full h-[100dvh] max-h-[100dvh] rounded-none border-0",
    },
    default: {
      backdropClass: "bg-black/80 md:backdrop-blur-sm",
      wrapperClass: "items-center justify-center px-4",
      panelClass: "max-w-4xl lg:max-w-5xl rounded-2xl max-h-[92vh]",
    },
    "inline-desktop": {
      backdropClass: "",
      wrapperClass: "items-stretch justify-stretch p-0",
      panelClass: "w-full h-full rounded-xl",
    },
  };

  const resolvedLayout =
    STATEMENT_LAYOUTS[variant] || STATEMENT_LAYOUTS.default;
  const wrapperBaseClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10200] flex";

  const modalBgClass =
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated";

  const truncateMiddle = useCallback((text, start = 6, end = 4) => {
    const raw = String(text || "").trim();
    if (!raw) return "";
    if (raw.length <= start + end + 1) return raw;
    return `${raw.slice(0, start)}…${raw.slice(-end)}`;
  }, []);

  const copyToClipboard = useCallback(async (text) => {
    const value = String(text || "").trim();
    if (!value) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }
      if (typeof document !== "undefined") {
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
    } catch {
      // ignore
    }
  }, []);

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

  const showConversionFee = useMemo(() => {
    if (!detailTx) return false;
    if (detailTx?.category === "exchange") return true;
    const spread = Number(detailTx?.spreadRlusd);
    return Number.isFinite(spread) && spread > 0;
  }, [detailTx]);

  const detailStatusLabel = useMemo(() => {
    if (!detailTx) return "";
    if (isPreviewMode) return t("ui_status_preview", "Aperçu");
    if (detailTx?.txHash) return t("ui_status_confirmed", "Confirmé");
    if (!["RLUSD", "USD"].includes(normalizedCurrency)) {
      return t("ui_status_offchain", "Hors chaîne");
    }
    return t("ui_status_recorded", "Enregistré");
  }, [detailTx, isPreviewMode, normalizedCurrency, t]);

  const counterpartyAddress = useMemo(() => {
    const raw = String(detailTx?.counterparty || "").trim();
    if (!raw || raw.toUpperCase() === "XCANNES") return "";
    return raw;
  }, [detailTx]);

  const counterpartyTitle = useMemo(() => {
    return detailIsOutgoing
      ? t("ui_recipient_label", "Destinataire")
      : t("ui_sender_label", "Expéditeur");
  }, [detailIsOutgoing, t]);

  const counterpartyName = useMemo(() => {
    if (!counterpartyAddress) return "";
    const cached =
      counterpartyLabels?.[counterpartyAddress] ??
      labelCacheRef.current.get(counterpartyAddress) ??
      "";
    return cached || t("ui_no_name_found", "Aucun nom trouvé");
  }, [counterpartyAddress, counterpartyLabels, t]);

  const detailExplorerUrl = useMemo(() => {
    const hash = String(detailTx?.txHash || "").trim();
    if (!hash) return "";
    return `https://xrpscan.com/tx/${encodeURIComponent(hash)}`;
  }, [detailTx]);

  const transactionDetailModal =
    detailOpen && detailTx && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[10300] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm wallet-modal-backdrop-in"
              onClick={closeTxDetails}
            />
            <div
              className={`relative w-full max-w-md rounded-[14px] ${modalBgClass} p-4 md:p-5 ring-1 ring-white/10 ring-inset shadow-[0_24px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] wallet-modal-lift-in`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] tracking-[0.08em] uppercase text-[#8B98A5]">
                    {detailTypeLabel || t("ui_transaction", "Transaction")}
                  </div>
                  <div
                    className={`mt-1 text-[22px] md:text-[26px] font-bold font-mono whitespace-nowrap ${
                      detailTx?.type === "debit"
                        ? "text-red-400"
                        : "text-xcannes-green"
                    }`}
                  >
                    {detailTx?.type === "debit" ? "−" : "+"}
                    {formatAmountWithSymbolLocal(detailTx?.amount ?? 0)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeTxDetails}
                  className="wallet-modal-close text-white/60 hover:text-white transition-colors text-xl w-10 h-10 -mr-2 flex items-center justify-center rounded-lg hover:bg-white/5"
                >
                  ✕
                </button>
              </div>

              <div className="h-px bg-white/[0.04] my-3" />

              {/* Status & Date */}
              <div className="space-y-3">
                <div className="text-[11px] tracking-[0.08em] uppercase text-[#8B98A5]">
                  {t("ui_status_and_date", "Statut & date")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <div className="text-xs text-white/60">
                      {t("ui_status_label", "Statut")}
                    </div>
                    <div className="mt-0.5 text-sm text-white/90 font-semibold">
                      {detailStatusLabel}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <div className="text-xs text-white/60">
                      {t("ui_date_label_7a2c1b9d5e", "Date")}
                    </div>
                    <div className="mt-0.5 text-sm text-white/90 font-semibold truncate">
                      {formatDateTime(detailTx)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/[0.04] my-3" />

              {/* Counterparty */}
              {counterpartyAddress ? (
                <div className="space-y-2">
                  <div className="text-[11px] tracking-[0.08em] uppercase text-[#8B98A5]">
                    {counterpartyTitle}
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-white/90 font-semibold truncate">
                          {counterpartyName}
                        </div>
                        <div className="mt-0.5 text-xs text-white/60 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                          {truncateMiddle(counterpartyAddress, 8, 6)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(counterpartyAddress)}
                        className="flex-none inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                        aria-label={t("ui_copy_address", "Copy address")}
                        title={t("ui_copy_address", "Copy address")}
                      >
                        ⧉
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="h-px bg-white/[0.04] my-3" />

              {/* Financial details */}
              <div className="space-y-2">
                <div className="text-[11px] tracking-[0.08em] uppercase text-[#8B98A5]">
                  {t("ui_details_label", "Détails")}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/60">
                      {t("ui_amount_52cea2dd3d", "Montant")}
                    </span>
                    <span
                      className={`text-sm font-semibold font-mono ${
                        detailTx?.type === "debit"
                          ? "text-red-400"
                          : "text-xcannes-green"
                      }`}
                    >
                      {detailTx?.type === "debit" ? "−" : "+"}
                      {formatAmountWithSymbolLocal(detailTx?.amount ?? 0)}
                    </span>
                  </div>
                  {showConversionFee ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-white/60">
                        {t("statement_conversion_fee_label", "Frais")}
                      </span>
                      <span className="text-sm font-semibold font-mono text-white/90">
                        {detailTx?.spreadRlusd
                          ? formatAmountWithSymbolLocal(detailTx.spreadRlusd)
                          : formatAmountWithSymbolLocal(0)}
                      </span>
                    </div>
                  ) : null}
                  {detailTx?.runningBalance != null ||
                  detailTx?.displayRunningBalance != null ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-white/60">
                        {t("ui_balance_after_label", "Solde après")}
                      </span>
                      <span className="text-sm font-semibold font-mono text-white/90">
                        {formatAmountWithSymbolLocal(
                          detailTx?.displayRunningBalance != null
                            ? detailTx.displayRunningBalance
                            : detailTx?.runningBalance ?? 0,
                        )}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="h-px bg-white/[0.04] my-3" />

              {/* Technical */}
              {detailTx?.txHash ? (
                <div className="space-y-2">
                  <div className="text-[11px] tracking-[0.08em] uppercase text-[#8B98A5]">
                    {t("ui_transaction", "Transaction")}
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-white/60">
                          {t("ui_tx_hash_label_2b7c1a9d5e", "Hash")}
                        </div>
                        <div className="mt-0.5 text-sm text-white/90 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                          {truncateMiddle(detailTx.txHash, 10, 8)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(detailTx.txHash)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                          aria-label={t("ui_copy_hash", "Copy hash")}
                          title={t("ui_copy_hash", "Copy hash")}
                        >
                          ⧉
                        </button>
                        {detailExplorerUrl ? (
                          <a
                            href={detailExplorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                            aria-label={t(
                              "ui_view_on_explorer",
                              "View on explorer",
                            )}
                            title={t(
                              "ui_view_on_explorer",
                              "View on explorer",
                            )}
                          >
                            ↗
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;
  const content = (
    <div
      className={`${wrapperBaseClass} ${resolvedLayout.wrapperClass} ${
        inline
          ? ""
          : `${resolvedLayout.backdropClass} ${
              isClosing
                ? "wallet-modal-backdrop-out"
                : "wallet-modal-backdrop-in"
            }`
      }`}
      onClick={(e) => {
        if (inline) return;
        // Fermer uniquement si on clique sur le backdrop (pas sur le modal)
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className={`relative w-full wallet-modal-panel ${modalBgClass} flex flex-col overflow-hidden z-[10201] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] ${
          resolvedLayout.panelClass
        } ${inline ? "wallet-inline-zoom-in" : isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in"}`}
      >
        {/* Header avec Account Info intégré */}
        <div
          className={`relative flex-shrink-0 ${modalBgClass} px-4 md:px-6 py-3 md:py-4 before:content-[''] before:absolute before:left-0 before:right-0 before:bottom-0 before:h-px before:bg-white/10`}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              {CRYPTO_ICONS?.[displayCurrency] ? (
                isSvgIcon(CRYPTO_ICONS[displayCurrency]) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={CRYPTO_ICONS[displayCurrency]}
                    alt={displayCurrency}
                    width={32}
                    height={32}
                    className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-md"
                  />
                ) : (
                  <Image
                    src={CRYPTO_ICONS[displayCurrency]}
                    alt={displayCurrency}
                    width={32}
                    height={32}
                    className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-md"
                  />
                )
              ) : (
                <span className="text-2xl md:text-3xl flex-shrink-0">
                  {getCurrencyFlag(displayCurrency)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-lg md:text-xl font-bold text-white min-w-0 inline-flex items-baseline gap-2">
                    <span className="truncate">
                      {currencyDescription || displayCurrency}
                    </span>
                  </h2>

                </div>
                {/* Description merged into title */}
              </div>
            </div>
            <button
              onClick={onClose}
              className="wallet-modal-close text-white/60 hover:text-xcannes-green transition-colors text-2xl md:text-3xl leading-none flex-shrink-0 w-10 h-10 flex items-center justify-center -mr-2"
            >
              ×
            </button>
          </div>

          {/* Account Info dans le header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <p className="text-sm text-white font-semibold truncate">
                {walletLabel || t("nav_wallet", "Wallet")}
              </p>
              {walletAddress ? (
                <p className="text-[11px] text-white/60 font-mono break-all">
                  {walletAddress}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">
                {t("ui_statement_period_6dedec11d9", "Statement Period")}
              </p>
              {/* Month Selector - Version simplifiée */}
              <DemoStatementMonthSelect
                value={selectedMonth}
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
              />
            </div>
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="pl-1">
                  <p className="text-xs text-white/60 mb-1">
                    {t("ui_balance_445d830d72", "Balance")}
                  </p>
                  <p className="text-sm text-white font-semibold">
                    {formatAmountWithSymbolLocal(balance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/60 mb-1">
                    {t("demo_indexed_stability_label_f4", "Stabilité Indexée")}
                  </p>
                  <p className="text-[11px] text-white/60">
                    ≈ {formatUsdWithSymbol(estimatedUsd)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content - Zone scrollable avec flex-1 pour prendre l'espace restant */}
        <div className="flex-1 overflow-hidden px-4 md:px-6 py-4 md:py-6 flex flex-col gap-4 min-h-0 overscroll-contain">
          {/* Archive Notice */}
          {selectedMonth === "archives" && (
            <div className="bg-blue-500/10 rounded-lg p-3 md:p-4">
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

          {/* Filters */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center rounded-xl p-1 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              {[
                {
                  key: "all",
                  label: stripCountSuffix(t("ui_all_0c90d41d71", "All")),
                },
                {
                  key: "credit",
                  label: stripCountSuffix(
                    t("ui_credits_b8166276a0", "Credits"),
                  ),
                },
                {
                  key: "debit",
                  label: stripCountSuffix(t("ui_debits_38c870b18f", "Debits")),
                },
                {
                  key: "conversion",
                  label: stripCountSuffix(
                    t("ui_conversions_b604b5ef8b", "Conversions"),
                  ),
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                    filter === item.key
                      ? "bg-white/5 text-white"
                      : "text-white/60 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions Timeline */}
          <div className="rounded-[14px] ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-18px_28px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col min-h-0">
            {error && (
              <div className="bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                {error}
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto md:max-h-[420px]">
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
                <div className="space-y-4 py-2">
                  {timelineGroups.map((group) => (
                    <div key={group.key}>
                      <div className="px-4 pt-4 pb-2 text-[11px] font-semibold text-white/50 uppercase tracking-wide">
                        {group.label}
                      </div>
                      <div className="pb-2">
                        {group.transactions.map((tx, idx) => {
                          const transactionId =
                            tx?.id || tx?.txHash || `${group.key}-${idx}`;
                          const isHighlighted =
                            highlightedTransactionId &&
                            transactionId === highlightedTransactionId;
                          return (
                            <button
                              key={transactionId}
                              type="button"
                              ref={isHighlighted ? highlightRowRef : null}
                              onClick={() => openTxDetails(tx)}
                              className={[
                                "w-full flex items-center gap-3 text-left mx-3 px-3 py-3 rounded-xl ring-1 ring-white/10 ring-inset",
                                "bg-gradient-to-b from-white/[0.06] to-white/[0.02]",
                                "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-12px_18px_rgba(0,0,0,0.45)]",
                                "transition-colors duration-150",
                                isHighlighted
                                  ? "ring-xcannes-green/25 from-xcannes-green/20 to-xcannes-green/5"
                                  : "hover:from-white/[0.08] hover:to-white/[0.03]",
                              ].join(" ")}
                            >
                              <div className="w-8 h-8 rounded-full bg-black/20 ring-1 ring-white/10 ring-inset flex items-center justify-center text-white/60 flex-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                <span className="text-sm leading-none">
                                  {getTimelineIcon(tx)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-white/90 truncate whitespace-nowrap overflow-hidden text-ellipsis">
                                  {getTimelineLabel(tx)}
                                </div>
                              </div>
                              <div
                                className={`flex-none font-mono font-semibold whitespace-nowrap ${
                                  tx?.type === "debit"
                                    ? "text-red-400"
                                    : "text-xcannes-green"
                                }`}
                              >
                                {tx?.type === "debit" ? "−" : "+"}
                                {formatAmountWithSymbolLocal(tx?.amount)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => onLoadMore && onLoadMore()}
              disabled={loadingMore}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-white/10 hover:bg-white/15 text-white/80"
            >
              {loadingMore
                ? t("ui_loading_1386baebe9", "Loading…")
                : t("ui_load_more_3f7a1c9d5b", "Load more")}
            </button>
          )}

          {/* Watermark */}
          <div className="hidden sm:block text-center py-3 md:py-4">
            <div className="space-y-1">
              {ledgerLastIndex != null ? (
                <p className="text-xs text-white/30 font-mono">
                  {t("ui_ledger_index_label_0c2a1d9b5e", "Ledger index:")}{" "}
                  {ledgerLastIndex}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="relative px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-transparent md:bg-black/30 before:content-[''] before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-white/10">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportPdf}
              disabled={exportFormat === "pdf"}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-transparent md:bg-white/10 md:hover:bg-white/15 text-white/80"
            >
              {exportFormat === "pdf" ? (
                <>
                  <span className="md:hidden" aria-hidden>
                    <ShareIcon className="w-5 h-5 opacity-60" />
                  </span>
                  <span className="hidden md:inline text-[13px] sm:text-inherit">
                    {t("ui_loading_1386baebe9", "Loading…")}
                  </span>
                </>
              ) : (
                <>
                  <span className="md:hidden" aria-hidden>
                    <ShareIcon className="w-5 h-5" />
                  </span>
                  <span className="hidden md:inline text-[13px] sm:text-inherit">
                    {t("ui_export_pdf_9c8d16b4fe", "📄 Export PDF")}
                  </span>
                </>
              )}
            </button>
            <button
              onClick={handlePrint}
              className="hidden md:inline-flex md:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-white/10 hover:bg-white/15 text-white/80"
            >
              {t("ui_print_1313eff37c", "🖨️ Print")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return (
      <>
        {content}
        {transactionDetailModal}
      </>
    );
  }

  if (typeof document === "undefined") {
    return null;
  }

  return (
    <>
      {createPortal(content, document.body)}
      {transactionDetailModal}
    </>
  );
}
