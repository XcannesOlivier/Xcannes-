"use client";

import {
  Fragment,
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
  const highlightRowRef = useRef(null);
  const highlightTimerRef = useRef(null);
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
  const transactionsByMonth = useMemo(() => {
    const map = new Map(statementMonthKeys.map((key) => [key, []]));
    for (const tx of transactionsWithDisplayBalance || []) {
      const key = getMonthKeyFromTransaction(tx);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(tx);
    }
    return statementMonthKeys.map((key) => ({
      key,
      label: formatMonthLabel(key, locale),
      transactions: map.get(key) || [],
    }));
  }, [statementMonthKeys, transactionsWithDisplayBalance, locale]);

  const visibleGroups = useMemo(() => {
    const map = new Map(transactionsByMonth.map((group) => [group.key, group]));
    if (selectedMonth === "archives") {
      const archiveKeys = statementMonthKeys.slice(12);
      return archiveKeys.map(
        (key) =>
          map.get(key) || {
            key,
            label: formatMonthLabel(key, locale),
            transactions: [],
          },
      );
    }
    if (!selectedMonthKey) return [];
    return [
      map.get(selectedMonthKey) || {
        key: selectedMonthKey,
        label: formatMonthLabel(selectedMonthKey, locale),
        transactions: [],
      },
    ];
  }, [
    transactionsByMonth,
    selectedMonth,
    selectedMonthKey,
    statementMonthKeys,
    locale,
  ]);

  const showMonthHeaders = selectedMonth === "archives";

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

  // Icône par type de transaction
  const getTransactionIcon = (category) => {
    if (isPreviewMode && (category === "buy" || category === "sell"))
      return null;
    const icons = {
      buy: "+",
      sell: "−",
    };
    return icons[category] || null;
  };

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

  // Fonction pour enrichir la description avec des drapeaux
  const enrichDescription = useCallback(
    (description) => {
      if (!description) return description;

      // Remplacer les codes de devises par leurs drapeaux + code
      let enriched = description;

      // Chercher les patterns courants: "XXX → YYY" ou "XXX/YYY"
      const currencyPattern = /\b([A-Z]{3,6})\b/g;
      enriched = enriched.replace(currencyPattern, (match) => {
        const flag = getCurrencyFlag(match);
        return `${flag} ${match}`;
      });

      return enriched;
    },
    [getCurrencyFlag],
  );
  const simplifyMobileDescription = useCallback(
    (description, category) => {
      if (!description) return description;
      const safeDescription = String(description).trim();
      const lower = safeDescription.toLowerCase();
      if (category !== "exchange") {
        if (lower.includes("moonpay")) {
          if (lower.includes("achat")) return "Achat";
          if (lower.includes("vente")) return "Vente";
        }
        if (lower.startsWith("achat")) return "Achat";
        if (lower.startsWith("vente")) return "Vente";
        if (
          lower.startsWith("recevoir") ||
          lower.startsWith("reçu") ||
          lower.startsWith("recu")
        ) {
          return "Reçu";
        }
        if (
          lower.startsWith("envoyer") ||
          lower.startsWith("envoyé") ||
          lower.startsWith("envoye")
        ) {
          return "Envoyé";
        }
        if (lower.startsWith("payer")) return "Envoyé";
        if (lower.includes("recevoir") && lower.includes("wallet"))
          return "Reçu";
        if (lower.includes("envoyer") && lower.includes("wallet"))
          return "Envoyé";
        return enrichDescription(safeDescription);
      }
      const arrowMatch = safeDescription.match(
        /([A-Z]{3,6})\s*(?:→|->)\s*([A-Z]{3,6})/,
      );
      if (arrowMatch) {
        return enrichDescription(`${arrowMatch[1]} → ${arrowMatch[2]}`);
      }
      const slashMatch = safeDescription.match(
        /([A-Z]{3,6})\s*\/\s*([A-Z]{3,6})/,
      );
      if (slashMatch) {
        return enrichDescription(`${slashMatch[1]} → ${slashMatch[2]}`);
      }
      const firstCurrencyIndex = safeDescription.search(/\b[A-Z]{3}\b/);
      const trimmed =
        firstCurrencyIndex >= 0
          ? safeDescription.slice(firstCurrencyIndex)
          : safeDescription.replace(/^\s*conversion\s*/i, "").trim();
      return enrichDescription(trimmed);
    },
    [enrichDescription],
  );

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

  const renderCurrencyBadge = useCallback(
    (code) => {
      const upper = String(code || "").toUpperCase();
      if (!upper) return null;
      const display = getDisplayCurrencyCode(upper);
      if (CRYPTO_ICONS?.[display]) {
        const iconSrc = CRYPTO_ICONS[display];
        return (
          <span className="inline-flex items-center gap-1">
            {isSvgIcon(iconSrc) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={iconSrc}
                alt={display}
                width={16}
                height={16}
                className="w-4 h-4 rounded-sm"
              />
            ) : (
              <Image
                src={iconSrc}
                alt={display}
                width={16}
                height={16}
                className="w-4 h-4 rounded-sm"
              />
            )}
            <span className="text-white/80 text-xs md:text-sm">{display}</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1">
          <span className="text-base md:text-lg">
            {getCurrencyFlag(display)}
          </span>
          <span className="text-white/80 text-xs md:text-sm">{display}</span>
        </span>
      );
    },
    [getCurrencyFlag],
  );

  const renderConversionDescription = useCallback(
    (description, { withLabel = false } = {}) => {
      const pair = parseConversionPair(description);
      if (!pair) return null;
      const badges = (
        <span className="inline-flex items-center gap-2">
          {renderCurrencyBadge(pair.from)}
          <span className="text-white/50 text-xs md:text-sm">→</span>
          {renderCurrencyBadge(pair.to)}
        </span>
      );
      if (!withLabel) return badges;
      return (
        <span className="inline-flex items-center gap-2">
          <span className="text-white/70 text-xs md:text-sm">
            {t("statement_conversion_label", "Conversion")}
          </span>
          {badges}
        </span>
      );
    },
    [parseConversionPair, renderCurrencyBadge, t],
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

  const formatAmount = useCallback(
    (amount) => {
      return parseFloat(amount || 0).toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      });
    },
    [locale],
  );

  const formatUsdAmount = useCallback(
    (amount) => {
      return parseFloat(amount || 0).toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    [locale],
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
        "w-full xcannes-fullscreen-safe rounded-none border border-white/10 md:max-w-4xl md:rounded-2xl md:max-h-[92vh] lg:max-w-5xl",
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
        "w-full xcannes-fullscreen-safe rounded-none border border-white/10",
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
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated";
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
        className={`relative w-full wallet-modal-panel ${modalBgClass} flex flex-col overflow-hidden z-[10201] ${
          resolvedLayout.panelClass
        } ${inline ? "wallet-inline-zoom-in" : isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in"}`}
      >
        {/* Header avec Account Info intégré */}
        <div
          className={`flex-shrink-0 ${modalBgClass} px-4 md:px-6 py-3 md:py-4`}
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
                <p className="text-[11px] text-white/50 font-mono break-all">
                  {walletAddress}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">
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
                  <p className="text-xs text-white/50 mb-1">
                    {t("ui_balance_445d830d72", "Balance")}
                  </p>
                  <p className="text-sm text-white font-semibold">
                    {formatAmountWithSymbolLocal(balance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50 mb-1">
                    {t("demo_indexed_stability_label_f4", "Stabilité Indexée")}
                  </p>
                  <p className="text-[11px] text-white/50">
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
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  filter === "all"
                    ? "bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {stripCountSuffix(t("ui_all_0c90d41d71", "All"))}
              </button>
              <button
                onClick={() => setFilter("credit")}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  filter === "credit"
                    ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {stripCountSuffix(t("ui_credits_b8166276a0", "Credits"))}
              </button>
              <button
                onClick={() => setFilter("debit")}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  filter === "debit"
                    ? "bg-red-500/20 hover:bg-red-500/30 text-red-300"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {stripCountSuffix(t("ui_debits_38c870b18f", "Debits"))}
              </button>
              <button
                onClick={() => setFilter("conversion")}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  filter === "conversion"
                    ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {stripCountSuffix(
                  t("ui_conversions_b604b5ef8b", "Conversions"),
                )}
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-black/40 rounded-lg overflow-hidden flex flex-col min-h-0">
            {error && (
              <div className="bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                {error}
              </div>
            )}
            <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto md:max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/85 backdrop-blur-md z-10">
                  <tr>
                    <th className="text-left px-2 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">
                      {t("ui_date_bb69dc2fa3", "Date")}
                    </th>
                    <th className="text-left pl-2 pr-1 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">
                      {t("ui_description_d37d7cf577", "Description")}
                    </th>
                    <th className="text-right pl-1 pr-2 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">
                      {t("ui_amount_1843418f56", "Amount")}
                    </th>
                    <th className="text-right px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60 hidden md:table-cell">
                      {t("ui_balance_445d830d72", "Balance")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="text-center py-12 text-white/40 text-sm"
                      >
                        {t("ui_loading_948e39804b", "Loading…")}
                      </td>
                    </tr>
                  ) : !visibleGroups || visibleGroups.length === 0 ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="text-center py-12 text-white/40 text-sm"
                      >
                        {t(
                          "ui_no_transactions_found_af217af8de",
                          "No transactions found",
                        )}
                      </td>
                    </tr>
                  ) : (
                    (visibleGroups || []).map((group, groupIdx) => (
                      <Fragment key={group.key || groupIdx}>
                        {showMonthHeaders ? (
                          <tr className="bg-white/5">
                            <td
                              colSpan="4"
                              className="px-2 md:px-4 py-2 text-xs font-semibold text-white/70 uppercase tracking-wide"
                            >
                              {group.label || group.key}
                            </td>
                          </tr>
                        ) : null}
                        {group.transactions.length === 0 ? (
                          <tr>
                            <td
                              colSpan="4"
                              className="text-center py-6 text-white/40 text-sm"
                            >
                              {t(
                                "ui_no_transactions_found_af217af8de",
                                "No transactions found",
                              )}
                            </td>
                          </tr>
                        ) : (
                          group.transactions.map((tx, idx) => {
                            const icon = getTransactionIcon(tx.category);
                            const transactionId = tx?.id || null;
                            const isHighlighted =
                              highlightedTransactionId &&
                              transactionId === highlightedTransactionId;
                            const rowClassName = isHighlighted
                              ? "border-b border-white/5 bg-xcannes-green/10 transition-colors"
                              : "border-b border-white/5 hover:bg-white/5 transition-colors";
                            return (
                              <tr
                                key={`${group.key || groupIdx}-${idx}`}
                                ref={isHighlighted ? highlightRowRef : null}
                                className={rowClassName}
                              >
                                <td className="px-2 md:px-4 py-2.5 md:py-3 text-white/70 font-mono text-xs">
                                  {formatDate(tx.date)}
                                </td>
                                <td className="pl-2 pr-1 md:px-4 py-2.5 md:py-3">
                                  <div className="flex items-center gap-2">
                                    {icon ? (
                                      <span className="transaction-icon text-lg flex-shrink-0">
                                        {icon}
                                      </span>
                                    ) : null}
                                    <div className="min-w-0">
                                      <p className="text-sm text-white/90 truncate">
                                        {(() => {
                                          const localizedDescription =
                                            getLocalizedDescription(tx);
                                          const suppressFlags = Boolean(
                                            tx?.suppressDescriptionFlags,
                                          );
                                          if (tx.category === "exchange") {
                                            return (
                                              renderConversionDescription(
                                                localizedDescription,
                                                {
                                                  withLabel: !isMobileDate,
                                                },
                                              ) ||
                                              (isMobileDate
                                                ? simplifyMobileDescription(
                                                    localizedDescription,
                                                    tx.category,
                                                  )
                                                : enrichDescription(
                                                    localizedDescription,
                                                  ))
                                            );
                                          }
                                          if (suppressFlags) {
                                            return localizedDescription;
                                          }
                                          return isMobileDate
                                            ? tx.kind === "XRPL_PAYMENT_IN"
                                              ? t(
                                                  "statement_xrpl_mobile_in",
                                                  "Reçu",
                                                )
                                              : tx.kind === "XRPL_PAYMENT_OUT"
                                                ? t(
                                                    "statement_xrpl_mobile_out",
                                                    "Envoyé",
                                                  )
                                                : simplifyMobileDescription(
                                                    localizedDescription,
                                                    tx.category,
                                                  )
                                            : enrichDescription(
                                                localizedDescription,
                                              );
                                        })()}
                                      </p>
                                      {tx.counterparty &&
                                        String(tx.counterparty).toUpperCase() !== "XCANNES" && (
                                          <p className="text-xs text-white/40 font-mono truncate hidden md:block">
                                            {tx.counterparty.slice(0, 10)}...
                                            {tx.counterparty.slice(-6)}
                                          </p>
                                        )}
                                    </div>
                                  </div>
                                </td>
                                <td
                                  className={`pl-1 pr-2 md:px-4 py-2.5 md:py-3 text-right font-mono text-sm font-medium ${
                                    tx.type === "debit"
                                      ? "text-red-400"
                                      : "text-green-400"
                                  }`}
                                >
                                  {tx.type === "debit" ? "−" : "+"}
                                  {formatAmountWithSymbolLocal(tx.amount)}
                                </td>
                                <td className="px-3 md:px-4 py-2.5 md:py-3 text-right font-mono text-white/90 text-sm hidden md:table-cell">
                                  {formatAmountWithSymbolLocal(
                                    tx?.displayRunningBalance != null
                                      ? tx.displayRunningBalance
                                      : tx.runningBalance,
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => onLoadMore && onLoadMore()}
              disabled={loadingMore}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-white/10 hover:bg-white/15 text-white/70"
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
                <p className="text-xs text-white/20 font-mono">
                  {t("ui_ledger_index_label_0c2a1d9b5e", "Ledger index:")}{" "}
                  {ledgerLastIndex}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-transparent md:bg-black/30">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportPdf}
              disabled={exportFormat === "pdf"}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-transparent md:bg-white/10 md:hover:bg-white/15 text-white/70"
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
              className="hidden md:inline-flex md:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-white/10 hover:bg-white/15 text-white/70"
            >
              {t("ui_print_1313eff37c", "🖨️ Print")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(content, document.body);
}
