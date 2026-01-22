"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import { apiUrl } from "@/lib/runtimeConfig";
import { extractXcannesPayReqFromMemos } from "@/utils/xrplMemo";
import {
  buildCsvString,
  downloadTextFile,
  escapeHtml,
  openPrintWindow,
  sha256Hex
} from "@/utils/statementExport";
import { useTranslation } from "next-i18next";
import StatementMonthSelect from "./StatementMonthSelect";

const WALLET_LABEL_STORAGE_KEY = "xcannes_wallet_labels";
const USD_STABLECOINS = [
"RLUSD",
"USD",
"USDC",
"USDT",
"BUSD",
"DAI",
"TUSD",
"USDP",
"GUSD"];
const HIGHLIGHT_DURATION_MS = 5000;
const XRPL_HISTORY_DAYS = 365;


/**
 * Composant de relevé bancaire pour une devise spécifique
 */
export default function CurrencyStatement({
  currency,
  balance,
  issuer,
  walletAddress,
  backendWalletAddress,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  walletId = "",
  transactions = [],
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  loading = false,
  error = null,
  period = "",
  isFullPage = false,
  variant = "default",
  usdRates = {},
  hasRlusdTrustline = false,
  hasXcsTrustline = false,
  xcannesCurrencyLinesCount = 0,
  highlightTransactionId = null,
  onClose
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const [filter, setFilter] = useState("all"); // all, credit, debit, conversion
  const [exportFormat, setExportFormat] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = current month, 1 = last month, etc.
  const [isMobileDate, setIsMobileDate] = useState(variant === "dex-mobile");
  const [reserveOpen, setReserveOpen] = useState(false);
  const [ledgerTab, setLedgerTab] = useState("statement"); // statement | xrpl
  const [docHash, setDocHash] = useState("");
  const [highlightedTransactionId, setHighlightedTransactionId] = useState(null);
  const highlightRowRef = useRef(null);
  const highlightTimerRef = useRef(null);

  const [xrplDirection, setXrplDirection] = useState("all"); // all | send | receive
  const [xrplPayments, setXrplPayments] = useState([]);
  const [xrplCursorNext, setXrplCursorNext] = useState(null);
  const [xrplHasMore, setXrplHasMore] = useState(false);
  const [xrplLoading, setXrplLoading] = useState(false);
  const [xrplLoadingMore, setXrplLoadingMore] = useState(false);
  const [xrplError, setXrplError] = useState(null);
  const defaultPeriod = t(
    "ui_statement_period_default_5f4c8a7d2b",
    "December 2025"
  );
  const archivesLabel = t("ui_archives_label_3c1f8a7b2e", "Archives");
  const archivesLongLabel = t(
    "ui_archives_12plus_7b3c9a1d5e",
    "Archives (12+ months)"
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

  const walletLabel = useMemo(() => {
    if (typeof window === "undefined" || !walletAddress) return "";
    try {
      const raw = localStorage.getItem(WALLET_LABEL_STORAGE_KEY);
      const labels = raw ? JSON.parse(raw) : {};
      return labels[walletAddress] || "";
    } catch (err) {
      console.error("Error loading wallet label:", err);
      return "";
    }
  }, [walletAddress]);

  const normalizedCurrency = useMemo(
    () => String(currency || "").toUpperCase(),
    [currency]
  );

  const canFetchXrplPayments = useMemo(() => {
    return (
      typeof window !== "undefined" &&
      typeof backendWalletAddress === "string" &&
      backendWalletAddress.startsWith("r") &&
      backendWalletAddress.length >= 25 &&
      ["XRP", "RLUSD", "XCS"].includes(normalizedCurrency));

  }, [backendWalletAddress, normalizedCurrency]);

  const fetchXrplPayments = useCallback(
    async ({ cursor, direction } = {}) => {
      const url = new URL(apiUrl("/wallet/xrpl/payments"));
      url.searchParams.set("address", backendWalletAddress);
      url.searchParams.set("currencyCode", normalizedCurrency);
      url.searchParams.set("limit", "100");
      url.searchParams.set("days", String(XRPL_HISTORY_DAYS));

      const dir = String(direction || "").trim().toLowerCase();
      if (dir === "send" || dir === "receive") {
        url.searchParams.set("direction", dir);
      }
      if (cursor) url.searchParams.set("cursor", String(cursor));

      const res = await fetch(url.toString());
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error || `XRPL payments request failed (${res.status})`
        );
      }
      return data;
    },
    [backendWalletAddress, normalizedCurrency]
  );

  const loadXrplFirstPage = useCallback(async () => {
    if (!canFetchXrplPayments) return;
    setXrplLoading(true);
    setXrplError(null);
    setXrplPayments([]);
    setXrplHasMore(false);
    setXrplCursorNext(null);

    try {
      const dir =
      xrplDirection === "send" || xrplDirection === "receive" ?
      xrplDirection :
      null;
      const data = await fetchXrplPayments({ direction: dir });
      setXrplPayments(Array.isArray(data?.payments) ? data.payments : []);
      setXrplHasMore(Boolean(data?.hasMore));
      setXrplCursorNext(data?.cursorNext || null);
    } catch (err) {
      console.error("[wallet/xrpl/payments] load error:", err);
      setXrplError(
        err?.message ||
          t(
            "ui_xrpl_payments_load_failed_9b3c1a7d5e",
            "Failed to load XRPL payments."
          )
      );
      setXrplPayments([]);
      setXrplHasMore(false);
      setXrplCursorNext(null);
    } finally {
      setXrplLoading(false);
    }
  }, [canFetchXrplPayments, fetchXrplPayments, xrplDirection, t]);

  const loadXrplMore = useCallback(async () => {
    if (!canFetchXrplPayments || !xrplHasMore || !xrplCursorNext) return;
    if (xrplLoadingMore) return;
    setXrplLoadingMore(true);
    setXrplError(null);

    try {
      const dir =
      xrplDirection === "send" || xrplDirection === "receive" ?
      xrplDirection :
      null;
      const data = await fetchXrplPayments({
        cursor: xrplCursorNext,
        direction: dir
      });
      const more = Array.isArray(data?.payments) ? data.payments : [];
      setXrplPayments((prev) => [...(prev || []), ...more]);
      setXrplHasMore(Boolean(data?.hasMore));
      setXrplCursorNext(data?.cursorNext || null);
    } catch (err) {
      console.error("[wallet/xrpl/payments] load more error:", err);
      setXrplError(
        err?.message ||
          t(
            "ui_xrpl_payments_load_more_failed_2a7c1b9d5e",
            "Failed to load more XRPL payments."
          )
      );
    } finally {
      setXrplLoadingMore(false);
    }
  }, [
  canFetchXrplPayments,
  fetchXrplPayments,
  xrplCursorNext,
  xrplDirection,
  xrplHasMore,
  xrplLoadingMore,
  t]
  );

  useEffect(() => {
    if (ledgerTab !== "xrpl") return;
    loadXrplFirstPage();
  }, [ledgerTab, loadXrplFirstPage]);

  useEffect(() => {
    // avoid mixing data between currencies
    setLedgerTab("statement");
    setXrplDirection("all");
    setXrplPayments([]);
    setXrplCursorNext(null);
    setXrplHasMore(false);
    setXrplLoading(false);
    setXrplLoadingMore(false);
    setXrplError(null);
  }, [normalizedCurrency]);

  const estimatedUsd = useMemo(() => {
    const value = Number.parseFloat(balance || 0) || 0;
    const code = normalizedCurrency;
    if (!code) return value;
    const rate = usdRates?.[code];
    if (Number.isFinite(rate)) return value * rate;
    if (USD_STABLECOINS.includes(code)) return value;
    if (code === "XRP") return value * 0.5;
    return value;
  }, [balance, normalizedCurrency, usdRates]);

  const xrpReserveDetails = useMemo(() => {
    const code = normalizedCurrency;
    if (code !== "XRP") return null;

    const activationXrp = 1;
    const trustlinesExtraXrpTotal = 0.1;
    const trustlineRlusdXrp = trustlinesExtraXrpTotal / 2;
    const trustlineXcsXrp = trustlinesExtraXrpTotal / 2;
    const totalReserveXrp = activationXrp + trustlinesExtraXrpTotal;

    return {
      totalReserveXrp,
      activationXrp,
      trustlineRlusdXrp,
      trustlineXcsXrp
    };
  }, [normalizedCurrency]);

  const xcsReserveDetails = useMemo(() => {
    const code = normalizedCurrency;
    if (code !== "XCS") return null;

    const walletActivationXcs = 1;
    const linesCount = Number(xcannesCurrencyLinesCount || 0);
    const lockXcsPerLine = 0.2;
    const xcannesLinesLockedXcs =
    Number.isFinite(linesCount) && linesCount > 0 ? linesCount * lockXcsPerLine : 0;
    const totalLockedXcs = walletActivationXcs + xcannesLinesLockedXcs;

    return {
      totalLockedXcs,
      walletActivationXcs,
      xcannesCurrencyLinesCount: Number.isFinite(linesCount) ? linesCount : 0,
      lockXcsPerLine,
      xcannesLinesLockedXcs
    };
  }, [normalizedCurrency, xcannesCurrencyLinesCount]);

  // Générer les 12 derniers mois
  const generateMonths = () => {
    const months = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      months.push({
        value: i,
        label: date.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
        displayLabel: date.toLocaleDateString(locale, { month: 'long' }) // Juste le mois pour l'affichage
      });
    }

    months.push({
      value: 'archives',
      label: archivesLongLabel,
      displayLabel: archivesLabel
    });
    return months;
  };

  const availableMonths = generateMonths();
  const currentPeriod = selectedMonth === 'archives' ? archivesLabel : availableMonths[selectedMonth]?.label || fallbackPeriod;
  const currentDisplayPeriod = selectedMonth === 'archives' ? archivesLabel : availableMonths[selectedMonth]?.displayLabel || String(fallbackPeriod).split(' ')[0]; // Affiche juste le mois


  // Calculer les statistiques
  const credits = transactions.filter((t) => t.type === "credit");
  const debits = transactions.filter((t) => t.type === "debit");

  const totalCredits = credits.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const totalDebits = debits.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const openingBalance = balance - totalCredits + totalDebits;
  const closingBalance = balance;
  const netChange = closingBalance - openingBalance;
  const percentChange = openingBalance !== 0 ? netChange / openingBalance * 100 : 0;

  // Statistiques supplémentaires
  const avgTransaction = transactions.length > 0 ? (totalCredits + totalDebits) / transactions.length : 0;
  const largestTransaction = transactions.reduce((max, t) => {
    const amount = parseFloat(t.amount || 0);
    return amount > max ? amount : max;
  }, 0);

  // Catégorisation par type
  const transactionsByCategory = transactions.reduce((acc, tx) => {
    const cat = tx.category || 'other';
    if (!acc[cat]) acc[cat] = { count: 0, amount: 0 };
    acc[cat].count++;
    acc[cat].amount += parseFloat(tx.amount || 0);
    return acc;
  }, {});

  // Données pour graphiques (fictives basées sur les transactions)
  const monthlyData = [
  { day: '01', balance: openingBalance * 0.95 },
  { day: '05', balance: openingBalance * 0.92 },
  { day: '10', balance: openingBalance * 0.98 },
  { day: '15', balance: openingBalance * 1.05 },
  { day: '20', balance: openingBalance * 1.02 },
  { day: '25', balance: openingBalance * 1.08 },
  { day: '28', balance: closingBalance }];


  // Filtrer les transactions
  const filteredTransactions = transactions.filter((t) => {
    if (filter === "credit") return t.type === "credit";
    if (filter === "debit") return t.type === "debit";
    if (filter === "conversion") return t.category === "exchange";
    return true;
  });

  useEffect(() => {
    if (!highlightedTransactionId || ledgerTab !== "statement") return;
    const node = highlightRowRef.current;
    if (!node) return;
    const raf = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [filter, highlightedTransactionId, ledgerTab, transactions]);

  const ledgerEvidenceCount = useMemo(() => {
    return (xrplPayments || []).filter((p) => p?.txHash).length;
  }, [xrplPayments]);

  const ledgerLastIndex = useMemo(() => {
    const indexes = (xrplPayments || [])
      .map((p) => Number(p?.ledgerIndex))
      .filter((v) => Number.isFinite(v));
    if (!indexes.length) return null;
    return Math.max(...indexes);
  }, [xrplPayments]);

  const ledgerStatus = useMemo(() => {
    if (isPreviewMode) return "preview";
    if (!canFetchXrplPayments) return "offchain";
    if (ledgerEvidenceCount > 0) return "verified";
    return "available";
  }, [canFetchXrplPayments, isPreviewMode, ledgerEvidenceCount]);

  const ledgerStatusLabel = useMemo(() => {
    if (ledgerStatus === "verified") {
      return t("ui_verified_on_xrp_ledger_334f28ce50", "Verified on XRP Ledger");
    }
    if (ledgerStatus === "available") {
      return t(
        "ui_ledger_available_no_tx_f4",
        "Ledger available (no transactions yet)"
      );
    }
    if (ledgerStatus === "offchain") {
      return t(
        "ui_ledger_offchain_allocations_f4",
        "Ledger validation unavailable for off-chain allocations"
      );
    }
    return t(
      "ui_ledger_preview_unavailable_f4",
      "Ledger validation unavailable (preview)"
    );
  }, [ledgerStatus, t]);

  const statementHashInput = useMemo(() => {
    const safeBalance = Number.isFinite(Number(balance)) ? Number(balance) : 0;
    const txPayload = (filteredTransactions || []).map((tx) => ({
      date: tx?.date || "",
      type: tx?.type || "",
      category: tx?.category || "",
      description: tx?.description || "",
      amount: Number.isFinite(Number(tx?.amount)) ? Number(tx.amount) : 0,
      runningBalance: Number.isFinite(Number(tx?.runningBalance))
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
  filteredTransactions,
  normalizedCurrency,
  walletAddress]);

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
    const icons = {
      buy: "+",
      sell: "−"
    };
    return icons[category] || null;
  };

  // Fonction pour obtenir le drapeau de la devise
  const getCurrencyFlag = (curr) => {
    const flags = {
      // Devises fiat - Monde entier
      "USD": "🇺🇸", // Dollar américain
      "EUR": "🇪🇺", // Euro
      "GBP": "🇬🇧", // Livre sterling
      "JPY": "🇯🇵", // Yen japonais
      "CHF": "🇨🇭", // Franc suisse
      "CAD": "🇨🇦", // Dollar canadien
      "AUD": "🇦🇺", // Dollar australien
      "CNY": "🇨🇳", // Yuan chinois
      "INR": "🇮🇳", // Roupie indienne
      "BRL": "🇧🇷", // Real brésilien
      "MXN": "🇲🇽", // Peso mexicain
      "KRW": "🇰🇷", // Won sud-coréen
      "RUB": "🇷🇺", // Rouble russe
      "ZAR": "🇿🇦", // Rand sud-africain
      "SGD": "🇸🇬", // Dollar de Singapour
      "HKD": "🇭🇰", // Dollar de Hong Kong
      "NOK": "🇳🇴", // Couronne norvégienne
      "SEK": "🇸🇪", // Couronne suédoise
      "DKK": "🇩🇰", // Couronne danoise
      "PLN": "🇵🇱", // Zloty polonais
      "TRY": "🇹🇷", // Livre turque
      "AED": "🇦🇪", // Dirham des EAU
      "SAR": "🇸🇦", // Riyal saoudien
      "THB": "🇹🇭", // Baht thaïlandais
      "IDR": "🇮🇩", // Roupie indonésienne
      "MYR": "🇲🇾", // Ringgit malaisien
      "PHP": "🇵🇭", // Peso philippin
      "NZD": "🇳🇿", // Dollar néo-zélandais
      "ARS": "🇦🇷", // Peso argentin
      "CLP": "🇨🇱", // Peso chilien
      "COP": "🇨🇴", // Peso colombien
      "PEN": "🇵🇪", // Sol péruvien
      "EGP": "🇪🇬", // Livre égyptienne
      "NGN": "🇳🇬", // Naira nigérian
      "KES": "🇰🇪", // Shilling kényan
      "GHS": "🇬🇭", // Cedi ghanéen
      "MAD": "🇲🇦", // Dirham marocain
      "TND": "🇹🇳", // Dinar tunisien

      // Afrique
      "XOF": "🇸🇳", // Franc CFA (Sénégal)
      "XAF": "🇨🇲", // Franc CFA (Cameroun)
      "UGX": "🇺🇬", // Shilling ougandais
      "TZS": "🇹🇿", // Shilling tanzanien
      "ETB": "🇪🇹", // Birr éthiopien
      "MUR": "🇲🇺", // Roupie mauricienne
      "BWP": "🇧🇼", // Pula botswanais
      "ZMW": "🇿🇲", // Kwacha zambien
      "AOA": "🇦🇴", // Kwanza angolais
      "MZN": "🇲🇿", // Metical mozambicain

      // Amérique Latine
      "VES": "🇻🇪", // Bolivar vénézuélien
      "UYU": "🇺🇾", // Peso uruguayen
      "PYG": "🇵🇾", // Guarani paraguayen
      "BOB": "🇧🇴", // Boliviano bolivien
      "CRC": "🇨🇷", // Colon costaricain
      "GTQ": "🇬🇹", // Quetzal guatémaltèque
      "HNL": "🇭🇳", // Lempira hondurien
      "NIO": "🇳🇮", // Cordoba nicaraguayen
      "PAB": "🇵🇦", // Balboa panaméen
      "DOP": "🇩🇴", // Peso dominicain
      "HTG": "🇭🇹", // Gourde haïtienne
      "JMD": "🇯🇲", // Dollar jamaïcain
      "TTD": "🇹🇹", // Dollar de Trinité-et-Tobago

      // Asie-Pacifique
      "VND": "🇻🇳", // Dong vietnamien
      "LAK": "🇱🇦", // Kip laotien
      "KHR": "🇰🇭", // Riel cambodgien
      "MMK": "🇲🇲", // Kyat birman
      "BDT": "🇧🇩", // Taka bangladais
      "PKR": "🇵🇰", // Roupie pakistanaise
      "LKR": "🇱🇰", // Roupie srilankaise
      "NPR": "🇳🇵", // Roupie népalaise
      "AFN": "🇦🇫", // Afghani afghan
      "MNT": "🇲🇳", // Tugrik mongol
      "KZT": "🇰🇿", // Tenge kazakh
      "UZS": "🇺🇿", // Som ouzbek
      "TJS": "🇹🇯", // Somoni tadjik
      "KGS": "🇰🇬", // Som kirghiz
      "TWD": "🇹🇼", // Dollar taïwanais

      // Moyen-Orient
      "ILS": "🇮🇱", // Shekel israélien
      "JOD": "🇯🇴", // Dinar jordanien
      "KWD": "🇰🇼", // Dinar koweïtien
      "BHD": "🇧🇭", // Dinar bahreïni
      "OMR": "🇴🇲", // Rial omanais
      "QAR": "🇶🇦", // Riyal qatari
      "IQD": "🇮🇶", // Dinar irakien
      "SYP": "🇸🇾", // Livre syrienne
      "LBP": "🇱🇧", // Livre libanaise
      "YER": "🇾🇪", // Rial yéménite

      // Europe de l'Est et autres
      "CZK": "🇨🇿", // Couronne tchèque
      "HUF": "🇭🇺", // Forint hongrois
      "RON": "🇷🇴", // Leu roumain
      "BGN": "🇧🇬", // Lev bulgare
      "HRK": "🇭🇷", // Kuna croate
      "RSD": "🇷🇸", // Dinar serbe
      "UAH": "🇺🇦", // Hryvnia ukrainienne
      "BYN": "🇧🇾", // Rouble biélorusse
      "GEL": "🇬🇪", // Lari géorgien
      "AMD": "🇦🇲", // Dram arménien
      "AZN": "🇦🇿", // Manat azerbaïdjanais
      "MDL": "🇲🇩", // Leu moldave
      "ALL": "🇦🇱", // Lek albanais
      "MKD": "🇲🇰", // Denar macédonien
      "BAM": "🇧🇦", // Mark convertible bosniaque
      "ISK": "🇮🇸", // Couronne islandaise

      // Océanie et autres
      "FJD": "🇫🇯", // Dollar fidjien
      "PGK": "🇵🇬", // Kina papouasien
      "WST": "🇼🇸", // Tala samoan
      "TOP": "🇹🇴", // Pa'anga tongien
      "VUV": "🇻🇺", // Vatu vanuatais

      // Stablecoins et tokens fiat
      "RLUSD": "🔵", // Ripple USD (Stablecoin)
      "BUSD": "🟡", // Binance USD
      "DAI": "🟠", // DAI Stablecoin
      "TUSD": "🔷", // TrueUSD
      "USDP": "⚪", // Pax Dollar
      "GUSD": "💚", // Gemini Dollar
      "USDD": "⚫", // USDD Stablecoin
      "FRAX": "🔲", // Frax
      "LUSD": "🟦", // Liquity USD
      "sUSD": "🔶", // Synthetix USD

      // Cryptomonnaies
      "XRP": "⚡", // XRP Ledger
      "BTC": "₿", // Bitcoin
      "ETH": "Ξ", // Ethereum
      "USDT": "₮", // Tether
      "USDC": "🔵", // USD Coin
      "BNB": "🔶", // Binance Coin
      "SOL": "◎", // Solana
      "ADA": "₳", // Cardano
      "DOGE": "Ð", // Dogecoin
      "MATIC": "🟣", // Polygon
      "DOT": "⬤", // Polkadot
      "LINK": "🔗", // Chainlink
      "AVAX": "🔺", // Avalanche
      "UNI": "🦄", // Uniswap
      "ATOM": "⚛️", // Cosmos
      "XLM": "🚀", // Stellar
      "ALGO": "◬", // Algorand
      "VET": "💎", // VeChain
      "ICP": "∞", // Internet Computer
      "FIL": "📁", // Filecoin
      "NEAR": "Ⓝ", // Near Protocol
      "APT": "🅰️", // Aptos
      "ARB": "🔷", // Arbitrum
      "OP": "🔴", // Optimism
      "SAND": "🏖️", // The Sandbox
      "MANA": "🎮", // Decentraland
      "XCS": "🌟", // Xcannes Coin
      "SHIB": "🐕", // Shiba Inu
      "TRX": "🔺", // Tron
      "LTC": "Ł", // Litecoin
      "BCH": "₿", // Bitcoin Cash
      "XMR": "ɱ", // Monero
      "ETC": "Ξ", // Ethereum Classic
      "XTZ": "ꜩ", // Tezos
      "EOS": "🔷", // EOS
      "AAVE": "👻", // Aave
      "MKR": "Ⓜ️", // Maker
      "COMP": "🏦", // Compound
      "SNX": "🔷", // Synthetix
      "CRV": "🌊", // Curve
      "SUSHI": "🍣", // SushiSwap
      "YFI": "💼", // Yearn Finance
      "BAT": "🦇", // Basic Attention Token
      "ZRX": "Ⓩ", // 0x
      "ENJ": "🎮", // Enjin Coin
      "CHZ": "⚽", // Chiliz
      "THETA": "📺", // Theta
      "FTM": "👻", // Fantom
      "HBAR": "ℏ", // Hedera
      "EGLD": "🏔️", // MultiversX (Elrond)
      "FLR": "🔥", // Flare
      "XDC": "🌐", // XDC Network
      "KAVA": "🌾", // Kava
      "ZIL": "💎", // Zilliqa
      "QTUM": "⬡", // Qtum
      "WAVES": "🌊", // Waves
      "ICX": "🔷", // ICON
      "ONT": "⭕", // Ontology
      "ZEC": "🛡️", // Zcash
      "DASH": "💸", // Dash
      "DCR": "🔷", // Decred
      "XCS": "🌟" // Xcannes Coin
    };
    return flags[curr] || "💱"; // Fallback sur l'emoji exchange
  };

  // Fonction pour enrichir la description avec des drapeaux
  const enrichDescription = (description) => {
    if (!description) return description;

    // Remplacer les codes de devises par leurs drapeaux + code
    let enriched = description;

    // Chercher les patterns courants: "XXX → YYY" ou "XXX/YYY"
    const currencyPattern = /\b([A-Z]{3})\b/g;
    enriched = enriched.replace(currencyPattern, (match) => {
      const flag = getCurrencyFlag(match);
      return `${flag} ${match}`;
    });

    return enriched;
  };
  const simplifyMobileDescription = useCallback(
    (description, category) => {
      if (!description) return description;
      const safeDescription = String(description).trim();
      const lower = safeDescription.toLowerCase();
      if (category !== "exchange") {
        if (lower.includes("moonpay")) {
          if (lower.includes("achat")) return "achat";
          if (lower.includes("vente")) return "vente";
        }
        if (lower.startsWith("achat")) return "achat";
        if (lower.startsWith("vente")) return "vente";
        if (lower.startsWith("recevoir") || lower.startsWith("reçu") || lower.startsWith("recu")) {
          return "reçu";
        }
        if (lower.startsWith("envoyer") || lower.startsWith("envoyé") || lower.startsWith("envoye")) {
          return "envoyé";
        }
        if (lower.includes("recevoir") && lower.includes("wallet")) return "reçu";
        if (lower.includes("envoyer") && lower.includes("wallet")) return "envoyé";
        return enrichDescription(safeDescription);
      }
      const arrowMatch = safeDescription.match(/([A-Z]{3})\s*(?:→|->)\s*([A-Z]{3})/);
      if (arrowMatch) {
        return enrichDescription(`${arrowMatch[1]} → ${arrowMatch[2]}`);
      }
      const slashMatch = safeDescription.match(/([A-Z]{3})\s*\/\s*([A-Z]{3})/);
      if (slashMatch) {
        return enrichDescription(`${slashMatch[1]} → ${slashMatch[2]}`);
      }
      const firstCurrencyIndex = safeDescription.search(/\b[A-Z]{3}\b/);
      const trimmed = firstCurrencyIndex >= 0
        ? safeDescription.slice(firstCurrencyIndex)
        : safeDescription.replace(/^\s*conversion\s*/i, "").trim();
      return enrichDescription(trimmed);
    },
    [enrichDescription]
  );

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return t("ui_not_available_9c2a1f7b3d", "N/A");
    const date = new Date(dateStr);
    const options = isMobileDate ?
    { day: "2-digit", month: "2-digit" } :
    { day: "2-digit", month: "2-digit", year: "numeric" };
    return date.toLocaleDateString(locale, options);
  }, [isMobileDate, locale, t]);

  const formatAmount = useCallback((amount) => {
    return parseFloat(amount || 0).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  }, [locale]);

  const buildPrintHtml = useCallback(() => {
    const generatedAt = new Date().toLocaleString(locale);
    const ledgerIndexLabel = ledgerLastIndex != null ? String(ledgerLastIndex) : "-";
    const docHashLabel = docHash || "-";
    const walletLabelText = walletLabel || t("nav_wallet", "Wallet");
    const balanceValue = Number.isFinite(Number(balance)) ? Number(balance) : 0;
    const balanceDisplay = `${formatAmount(balanceValue)} ${normalizedCurrency}`;
    const descriptionLabel = t("ui_description_4c9f6b1a2d", "Description");
    const typeLabel = t("ui_type_label_8b1a4d2c7e", "Type");
    const amountLabel = `${t("ui_amount_0bb3c64b1d", "Amount")} (${normalizedCurrency})`;
    const balanceLabel = `${t("ui_balance_label_7f2a1b9c5e", "Balance")} (${normalizedCurrency})`;
    const rowsHtml = (filteredTransactions || []).map((tx) => {
      const isDebit = tx?.type === "debit";
      const txType = isDebit ?
      t("ui_debit_0f7c2a1b9e", "Debit") :
      t("ui_credit_93bc2a1d7e", "Credit");
      const txDescription = tx?.description || "";
      const counterparty = tx?.counterparty ? `(${tx.counterparty})` : "";
      const fullDescription = [txDescription, counterparty].filter(Boolean).join(" ");
      return `
        <tr>
          <td>${escapeHtml(formatDate(tx?.date))}</td>
          <td>${escapeHtml(fullDescription)}</td>
          <td>${escapeHtml(txType)}</td>
          <td class="right">${escapeHtml(`${isDebit ? "-" : "+"}${formatAmount(tx?.amount)}`)}</td>
          <td class="right">${escapeHtml(formatAmount(tx?.runningBalance))}</td>
        </tr>
      `;
    }).join("");
    const emptyRow = `
      <tr>
        <td colspan="5" class="muted">${escapeHtml(
          t("ui_no_transactions_found_af217af8de", "No transactions found")
        )}</td>
      </tr>
    `;

    return `
      <h1>${escapeHtml(`${normalizedCurrency} ${t("ui_statement_a87c93acb8", "Statement")}`)}</h1>
      <div class="meta">
        <div><strong>${escapeHtml(t("ui_account_holder_3eef963295", "Account Holder"))}:</strong> ${escapeHtml(walletLabelText)}</div>
        <div><strong>${escapeHtml(t("ui_wallet_address_label_2f7a1c9b5e", "Wallet address"))}:</strong> <span class="small">${escapeHtml(walletAddress || "-")}</span></div>
        <div><strong>${escapeHtml(t("ui_statement_period_label_3f6c1a9b5e", "Period"))}:</strong> ${escapeHtml(currentPeriod || fallbackPeriod)}</div>
        <div><strong>${escapeHtml(t("ui_balance_label_7f2a1b9c5e", "Balance"))}:</strong> ${escapeHtml(balanceDisplay)}</div>
        <div><strong>${escapeHtml(t("ui_generated_on_ae324c9048", "Generated on"))}:</strong> ${escapeHtml(generatedAt)}</div>
        <div><strong>${escapeHtml(t("ui_ledger_status_label_0f7c1a9b5e", "Ledger status"))}:</strong> ${escapeHtml(ledgerStatusLabel)}</div>
        <div><strong>${escapeHtml(t("ui_ledger_index_label_0c2a1d9b5e", "Ledger index"))}:</strong> ${escapeHtml(ledgerIndexLabel)}</div>
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
  fallbackPeriod,
  filteredTransactions,
  formatDate,
  formatAmount,
  ledgerLastIndex,
  ledgerStatusLabel,
  locale,
  normalizedCurrency,
  t,
  walletAddress,
  walletLabel]);

  const handleExportPdf = useCallback(() => {
    setExportFormat("pdf");
    try {
      const suffix = docHash ? docHash.slice(0, 12) : "draft";
      const ok = openPrintWindow({
        title: `XCANNES ${normalizedCurrency || "Statement"} ${suffix}`,
        bodyHtml: buildPrintHtml()
      });
      if (!ok && typeof window !== "undefined") {
        window.alert(
          t(
            "ui_popup_blocked_1c7a9d3b5e",
            "Popup blocked. Please allow popups to export or print."
          )
        );
      }
    } finally {
      setExportFormat(null);
    }
  }, [buildPrintHtml, docHash, normalizedCurrency, t]);

  const handlePrint = useCallback(() => {
    const suffix = docHash ? docHash.slice(0, 12) : "draft";
    const ok = openPrintWindow({
      title: `XCANNES ${normalizedCurrency || "Statement"} ${suffix}`,
      bodyHtml: buildPrintHtml()
    });
    if (!ok && typeof window !== "undefined") {
      window.alert(
        t(
          "ui_popup_blocked_1c7a9d3b5e",
          "Popup blocked. Please allow popups to export or print."
        )
      );
    }
  }, [buildPrintHtml, docHash, normalizedCurrency, t]);

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
      "doc_hash"];
      const rows = (filteredTransactions || []).map((tx) => ([
        tx?.date || "",
        tx?.type || "",
        tx?.category || "",
        tx?.description || "",
        Number.isFinite(Number(tx?.amount)) ? Number(tx.amount) : "",
        Number.isFinite(Number(tx?.runningBalance)) ? Number(tx.runningBalance) : "",
        Number.isFinite(Number(balance)) ? Number(balance) : "",
        tx?.counterparty || "",
        normalizedCurrency || "",
        ledgerStatus,
        ledgerLastIndex != null ? ledgerLastIndex : "",
        docHash || ""
      ]));
      const csv = buildCsvString(headers, rows);
      downloadTextFile({
        filename: `xcannes-statement-${String(normalizedCurrency || "currency").toLowerCase()}-${suffix}.csv`,
        content: csv,
        type: "text/csv;charset=utf-8"
      });
    } finally {
      setExportFormat(null);
    }
  }, [
  balance,
  docHash,
  filteredTransactions,
  ledgerLastIndex,
  ledgerStatus,
  normalizedCurrency]);

  const STATEMENT_LAYOUTS = {
    full: {
      backdropClass: "bg-black/80 md:backdrop-blur-sm",
      wrapperClass: "items-stretch justify-center px-0 md:items-center md:px-4",
      panelClass:
      "w-full h-[100svh] max-h-[100svh] rounded-none border-0 md:max-w-4xl md:rounded-2xl md:border md:border-white/10 md:max-h-[92vh] lg:max-w-5xl"
    },
    "dex-desktop": {
      backdropClass: "bg-black/75 md:backdrop-blur-sm",
      wrapperClass: "items-center justify-center px-3 md:px-4",
      panelClass:
      "max-w-4xl lg:max-w-5xl rounded-2xl border border-white/10 max-h-[90vh]"
    },
    "dex-mobile": {
      backdropClass: "bg-black/90 md:backdrop-blur-sm",
      wrapperClass: "items-stretch justify-center px-0",
      panelClass:
      "w-full h-[100svh] max-h-[100svh] rounded-none border-0"
    },
    default: {
      backdropClass: "bg-black/80 md:backdrop-blur-sm",
      wrapperClass: "items-center justify-center px-4",
      panelClass:
      "max-w-4xl lg:max-w-5xl rounded-2xl border border-white/10 max-h-[92vh]"
    }
  };

  const resolvedLayout = STATEMENT_LAYOUTS[variant] || STATEMENT_LAYOUTS.default;

  const modalBgClass = noticeVariant === "demo" && walletId === "A" ? "bg-[#0b1017]" : "bg-elevated";

  const content =
  <div
    className={`fixed inset-0 z-[10200] flex ${resolvedLayout.wrapperClass} ${resolvedLayout.backdropClass}`}
    onClick={(e) => {
      // Fermer uniquement si on clique sur le backdrop (pas sur le modal)
      if (e.target === e.currentTarget) {
        onClose();
      }
    }}>

      <div
      className={`relative w-full ${modalBgClass} flex flex-col overflow-hidden z-[10201] ${resolvedLayout.panelClass}`}>

        
	        {/* Header avec Account Info intégré */}
	        <div className={`border-b border-white/10 flex-shrink-0 ${modalBgClass} px-4 md:px-6 py-3 md:py-4`}>
	          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              {['XRP', 'RLUSD', 'XCS'].includes(currency) ?
            <Image
              src={`/symbols/${currency.toLowerCase()}.png`}
              alt={currency}
              width={32}
              height={32}
              className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-md" /> :


            <span className="text-2xl md:text-3xl flex-shrink-0">{getCurrencyFlag(currency)}</span>
            }
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-lg md:text-xl font-bold text-white truncate">
                    {currency} {t("ui_statement_a87c93acb8", "Statement")}
                  </h2>
                  {noticeVariant === "demo" ? (
                    <span className="inline-flex items-center text-xcannes-green text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                      {t("demo_notice_title", "Mode démo")}
                    </span>
                  ) : null}
                  {isPreviewMode && noticeVariant !== "demo" ? (
                    <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold px-2 py-0.5 leading-none">
                      {t("wallet_not_connected_title", "Wallet not connected")}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs md:text-sm text-white/60 truncate">
                  {getCurrencyDescription(currency)}
                </p>
              </div>
            </div>
            <button
            onClick={onClose}
            className="text-white/60 hover:text-xcannes-green transition-colors text-2xl md:text-3xl leading-none flex-shrink-0 w-10 h-10 flex items-center justify-center -mr-2">

              ×
            </button>
	          </div>

	          
	          {/* Account Info dans le header */}
	          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
	            <div>
              <p className="text-xs text-white/50 mb-1">{t("ui_account_holder_3eef963295", "Account Holder")}</p>
              <p className="text-sm text-white font-semibold truncate">
                {walletLabel || t("nav_wallet", "Wallet")}
              </p>
              <p className="text-[11px] text-white/50 font-mono break-all">
                {walletAddress}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">{t("ui_statement_period_6dedec11d9", "Statement Period")}</p>
              {/* Month Selector - Version simplifiée */}
              <StatementMonthSelect
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
              <p className="text-xs text-white/50 mb-1">{t("ui_balance_445d830d72", "Balance")}</p>
              <p className="text-sm text-white font-semibold">
                {formatAmount(balance)} {currency}
              </p>
              <p className="text-[11px] text-white/50">
                ≈ {formatAmount(estimatedUsd)}{t("ui_usd_506842b2ba", "USD")}
            </p>

              {xrpReserveDetails &&
            <div className="mt-2 relative">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-white/50">{t("ui_reserve_2d584ec9c7", "Reserve")}</p>
                      <p className="text-[11px] text-white/70 font-mono">
                        {xrpReserveDetails.totalReserveXrp.toFixed(2)}{t("ui_xrp_034964b994", "XRP")}
                  </p>
                    </div>
                    <button
                  type="button"
                  onClick={() => setReserveOpen((v) => !v)}
                  className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[11px] text-white/70 border border-white/10 transition-colors"
                  aria-expanded={reserveOpen}
                  aria-label={t("ui_reserve_breakdown_de2c3de53e", "Reserve breakdown")}>{t("ui_details_e9615e470d", "Details")}


                </button>
                  </div>

                  {reserveOpen &&
              <div className="mt-2 rounded-lg border border-white/10 bg-black/60 p-3 space-y-2">
                      <div className="text-[11px] text-white/70">
                        <div className="flex items-center justify-between gap-2">
                          <span>{t("ui_activation_wallet_1dcd314549", "Activation wallet")}</span>
                          <span className="font-mono">{xrpReserveDetails.activationXrp.toFixed(2)}{t("ui_xrp_034964b994", "XRP")}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span>
                            {t("ui_trustline_rlusd_9c077313dc", "Trustline RLUSD")}{" "}
                            {hasRlusdTrustline ?
                              t("ui_status_active_short_4c8b1a7d2e", "(active)") :
                              t("ui_status_to_activate_short_7a1c4d9b2e", "(to activate)")}
                          </span>
                          <span className="font-mono">{xrpReserveDetails.trustlineRlusdXrp.toFixed(2)}{t("ui_xrp_034964b994", "XRP")}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span>
                            {t("ui_trustline_xcs_91682deeea", "Trustline XCS")}{" "}
                            {hasXcsTrustline ?
                              t("ui_status_active_short_4c8b1a7d2e", "(active)") :
                              t("ui_status_to_activate_short_7a1c4d9b2e", "(to activate)")}
                          </span>
                          <span className="font-mono">{xrpReserveDetails.trustlineXcsXrp.toFixed(2)}{t("ui_xrp_034964b994", "XRP")}</span>
                        </div>
                      </div>
                    </div>
              }
                </div>
            }

              {xcsReserveDetails &&
            <div className="mt-2 relative">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-white/50">{t("ui_reserve_2d584ec9c7", "Reserve")}</p>
                      <p className="text-[11px] text-white/70 font-mono">
                        {xcsReserveDetails.totalLockedXcs.toFixed(2)}{t("ui_xcs_3a4119a8c0", "XCS")}
                  </p>
                    </div>
                    <button
                  type="button"
                  onClick={() => setReserveOpen((v) => !v)}
                  className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[11px] text-white/70 border border-white/10 transition-colors"
                  aria-expanded={reserveOpen}
                  aria-label={t("ui_reserve_breakdown_de2c3de53e", "Reserve breakdown")}>{t("ui_details_e9615e470d", "Details")}


                </button>
                  </div>

                  {reserveOpen &&
              <div className="mt-2 rounded-lg border border-white/10 bg-black/60 p-3 space-y-2">
                      <div className="text-[11px] text-white/70">
                        <div className="flex items-center justify-between gap-2">
                          <span>{t("ui_activation_wallet_xcannes_92757c7cdd", "Activation wallet XCANNES")}</span>
                          <span className="font-mono">
                            {xcsReserveDetails.walletActivationXcs.toFixed(2)}{t("ui_xcs_3a4119a8c0", "XCS")}
                    </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 text-[11px] text-white/70">
                        <div className="flex items-center justify-between gap-2">
                          <span>{t("ui_xcannes_currency_lines_1f3927f668", "Lignes de devises XCANNES (")}
                      {xcsReserveDetails.xcannesCurrencyLinesCount} × {xcsReserveDetails.lockXcsPerLine.toFixed(2)}{t("ui_xcs_f516c57c4d", "XCS)")}
                    </span>
                          <span className="font-mono">
                            {xcsReserveDetails.xcannesLinesLockedXcs.toFixed(2)}{t("ui_xcs_3a4119a8c0", "XCS")}
                    </span>
                        </div>
                        <p className="mt-1 text-[10px] text-white/45">{t("ui_locking_xcs_via_escrow__2d99312708", "Verrouillage XCS via escrow. Fermeture: 0.10 XCS remboursé, 0.10 XCS vers XCANNES.")}

                  </p>
                        <p className="mt-1 text-[10px] text-white/45">{t("ui_inclut_les_lignes_actives_m__0e52afcff8", "Inclut les lignes actives même si allocation = 0 RLUSD.")}

                  </p>
                      </div>
                    </div>
              }
                </div>
            }
            </div>
          </div>
        </div>

        {/* Content - Zone scrollable avec flex-1 pour prendre l'espace restant */}
        <div className="flex-1 overflow-hidden px-4 md:px-6 py-4 md:py-6 flex flex-col gap-4 min-h-0 overscroll-contain">
          
          {/* Archive Notice */}
          {selectedMonth === 'archives' &&
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 md:p-4">
              <p className="text-sm text-blue-300 flex items-center gap-2">
                <span className="text-xl">📁</span>
                <span><strong>{t("ui_archives_743254edfe", "Archives:")}</strong>{t("ui_displaying_transactions_olde_e408b4a17d", "Displaying transactions older than 12 months.")}</span>
              </p>
            </div>
        }

          {/* Filters */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {canFetchXrplPayments &&
          <div className="flex gap-1.5">
                <button
              type="button"
              onClick={() => setLedgerTab("statement")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              ledgerTab === "statement" ?
              "bg-white/10 text-white border border-white/15" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_statement_a87c93acb8", "Statement")}


            </button>
                <button
              type="button"
              onClick={() => setLedgerTab("xrpl")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              ledgerTab === "xrpl" ?
              "bg-[#0f7fe1]/20 text-[#78b8ff] border border-[#0f7fe1]/30" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_xrpl_payments_78947fa490", "XRPL payments")}


            </button>
              </div>
          }

            {ledgerTab === "xrpl" && canFetchXrplPayments ?
          <div className="flex gap-1.5 flex-wrap">
                <button
              type="button"
              onClick={() => setXrplDirection("all")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              xrplDirection === "all" ?
              "bg-white/10 text-white border border-white/15" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_all_32cb8ed597", "All")}


            </button>
                <button
              type="button"
              onClick={() => setXrplDirection("receive")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              xrplDirection === "receive" ?
              "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_receive_61ed481e18", "Receive")}


            </button>
                <button
              type="button"
              onClick={() => setXrplDirection("send")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              xrplDirection === "send" ?
              "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_send_71ed97cd73", "Send")}


            </button>
              </div> :

          <div className="flex gap-1.5 flex-wrap">
                <button
              onClick={() => setFilter("all")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              filter === "all" ?
              "bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green border border-xcannes-green/30" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_all_0c90d41d71", "All (")}

              {transactions.length})
                </button>
                <button
              onClick={() => setFilter("credit")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              filter === "credit" ?
              "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_credits_b8166276a0", "Credits (")}

              {credits.length})
                </button>
                <button
              onClick={() => setFilter("debit")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              filter === "debit" ?
              "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_debits_38c870b18f", "Debits (")}

              {debits.length})
                </button>
                <button
              onClick={() => setFilter("conversion")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              filter === "conversion" ?
              "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_conversions_b604b5ef8b", "Conversions (")}

              {transactions.filter((t) => t.category === "exchange").length})
                </button>
              </div>
          }
          </div>

          {/* Transactions Table */}
          <div className="bg-black/40 rounded-lg border border-white/10 overflow-hidden flex flex-col min-h-0">
            {ledgerTab === "statement" && error &&
          <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                {error}
              </div>
          }
            {ledgerTab === "xrpl" && xrplError &&
          <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                {xrplError}
              </div>
          }
            <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto md:max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/40 backdrop-blur-sm z-10">
                  {ledgerTab === "xrpl" ?
                <tr className="border-b border-white/10">
                      <th className="text-left px-2 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">{t("ui_date_bb69dc2fa3", "Date")}</th>
                      <th className="text-left pl-2 pr-1 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">{t("ui_counterparty_cf147b1ba8", "Counterparty")}</th>
                      <th className="text-right pl-1 pr-2 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">{t("ui_amount_1843418f56", "Amount")}</th>
                      <th className="text-right px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60 hidden md:table-cell">{t("ui_tx_a0c330d97d", "Tx")}</th>
                    </tr> :

                <tr className="border-b border-white/10">
                      <th className="text-left px-2 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">{t("ui_date_bb69dc2fa3", "Date")}</th>
                      <th className="text-left pl-2 pr-1 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">{t("ui_description_d37d7cf577", "Description")}</th>
                      <th className="text-right pl-1 pr-2 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">{t("ui_amount_1843418f56", "Amount")}</th>
                      <th className="text-right px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60 hidden md:table-cell">{t("ui_balance_445d830d72", "Balance")}</th>
                    </tr>
                }
                </thead>
                <tbody>
                  {ledgerTab === "xrpl" ?
                xrplLoading ?
                <tr>
                        <td colSpan="4" className="text-center py-12 text-white/40 text-sm">{t("ui_loading_948e39804b", "Loading…")}

                  </td>
                      </tr> :
                xrplPayments.length === 0 ?
                <tr>
                        <td colSpan="4" className="text-center py-12 text-white/40 text-sm">{t("ui_no_xrpl_payments_found_ea91b30191", "No XRPL payments found")}

                  </td>
                      </tr> :

                xrplPayments.map((p) => {
                  const createdAt = p?.createdAt ? new Date(p.createdAt) : null;
                  const when =
                  createdAt && Number.isFinite(createdAt.getTime()) ?
                  createdAt.toLocaleString(locale) :
                  "";
                  const dir = String(p?.direction || "").toLowerCase();
                  const isSend = dir === "send";
                  const amount = Number(p?.value ?? 0);
                  const txHash = String(p?.txHash || "");
                  const counterparty = String(p?.counterparty || "").trim();
                  const counterpartyShort =
                  counterparty ?
                  `${counterparty.slice(0, 10)}...${counterparty.slice(-6)}` :
                  "";
                  const explorerUrl = txHash ? `https://xrpscan.com/tx/${txHash}` : null;
                  const payReq = extractXcannesPayReqFromMemos(p?.memos);
                  const credited =
                  payReq?.targetCurrencyCode || payReq?.targetCurrency || null;
                  const desc = isSend ?
                  t("demo_stmt_desc_send", "Send") :
                  t("demo_stmt_desc_receive", "Receive");
                  const metaPrefix = isSend ?
                  t("demo_stmt_to", "to") :
                  t("demo_stmt_from", "from");
                  const meta = counterpartyShort ? `${metaPrefix} ${counterpartyShort}` : "";
                  const metaTitle = counterparty ? `${metaPrefix} ${counterparty}` : "";

                  return (
                    <tr
                      key={txHash || `${when}:${counterparty}:${amount}`}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors">

                            <td className="px-2 md:px-4 py-2.5 md:py-3 text-white/70 font-mono text-xs">
                              {when}
                            </td>
                            <td className="pl-2 pr-1 md:px-4 py-2.5 md:py-3">
                              <div className="min-w-0">
                                <div className="text-[12px] text-white/85 font-semibold">
                                  {desc}
                                </div>
                                <div
                          className="text-[11px] text-white/45 truncate"
                          title={metaTitle || undefined}>
                                  {meta || "—"}
                                </div>
                                {txHash ?
                          <div className="text-[10px] text-white/35 font-mono truncate md:hidden">
                                    {txHash.slice(0, 10)}…{txHash.slice(-8)}
                                  </div> :
                          null}
                                {!isSend && credited ?
                          <div className="text-[10px] text-xcannes-green/80">
                                    {t("credited_in", "Credited in")}{" "}
                                    {String(credited).toUpperCase()}
                                  </div> :
                          null}
                              </div>
                            </td>
                            <td className={`pl-1 pr-2 md:px-4 py-2.5 md:py-3 text-right font-mono text-sm font-medium ${isSend ? "text-red-400" : "text-green-400"}`}>
                              {isSend ? "−" : "+"}
                              {Number.isFinite(amount) ?
                        amount.toLocaleString(locale, { maximumFractionDigits: 8 }) :
                        "0"}{" "}
                              <span className="text-white/50">{normalizedCurrency}</span>
                            </td>
                            <td className="px-3 md:px-4 py-2.5 md:py-3 text-right text-[11px] hidden md:table-cell">
                              {explorerUrl ?
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#78b8ff] hover:underline underline-offset-2">

                                  {t("view", "View")}
                                </a> :

                        <span className="text-white/30">—</span>
                        }
                            </td>
                          </tr>);

                }) :

                loading ?
                <tr>
                      <td colSpan="4" className="text-center py-12 text-white/40 text-sm">{t("ui_loading_948e39804b", "Loading…")}

                  </td>
                    </tr> :
                filteredTransactions.length === 0 ?
                <tr>
                      <td colSpan="4" className="text-center py-12 text-white/40 text-sm">{t("ui_no_transactions_found_af217af8de", "No transactions found")}

                  </td>
                    </tr> :

                filteredTransactions.map((tx, idx) => {
                  const icon = getTransactionIcon(tx.category);
                  const transactionId = tx?.id || null;
                  const isHighlighted =
                    highlightedTransactionId && transactionId === highlightedTransactionId;
                  const rowClassName = isHighlighted
                    ? "border-b border-white/5 bg-xcannes-green/10 transition-colors"
                    : "border-b border-white/5 hover:bg-white/5 transition-colors";
                  return (
                    <tr
                      key={idx}
                      ref={isHighlighted ? highlightRowRef : null}
                      className={rowClassName}
                    >
                          <td className="px-2 md:px-4 py-2.5 md:py-3 text-white/70 font-mono text-xs">
                            {formatDate(tx.date)}
                          </td>
                          <td className="pl-2 pr-1 md:px-4 py-2.5 md:py-3">
                            <div className="flex items-center gap-2">
                              {icon ?
                          <span className="transaction-icon text-lg flex-shrink-0">
                                  {icon}
                                </span> :
                          null}
                              <div className="min-w-0">
                                <p className="text-sm text-white/90 truncate">
                                  {isMobileDate ?
                                    simplifyMobileDescription(tx.description, tx.category) :
                                    enrichDescription(tx.description)}
                                </p>
                                {tx.counterparty &&
                            <p className="text-xs text-white/40 font-mono truncate hidden md:block">
                                    {tx.counterparty.slice(0, 10)}...{tx.counterparty.slice(-6)}
                                  </p>
                            }
                              </div>
                            </div>
                          </td>
                          <td className={`pl-1 pr-2 md:px-4 py-2.5 md:py-3 text-right font-mono text-sm font-medium ${tx.type === "debit" ? "text-red-400" : "text-green-400"}`}>
                            {tx.type === "debit" ? "−" : "+"}{formatAmount(tx.amount)}
                          </td>
                          <td className="px-3 md:px-4 py-2.5 md:py-3 text-right font-mono text-white/90 text-sm hidden md:table-cell">
                            {formatAmount(tx.runningBalance)}
                          </td>
                        </tr>);

                })
                }
                </tbody>
              </table>
            </div>
          </div>

          {ledgerTab === "statement" && hasMore &&
        <button
          type="button"
          onClick={() => onLoadMore && onLoadMore()}
          disabled={loadingMore}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-white/10 hover:bg-white/15 text-white/70 border border-white/15">

              {loadingMore ?
                t("ui_loading_1386baebe9", "Loading…") :
                t("ui_load_more_3f7a1c9d5b", "Load more")}
            </button>
        }

          {ledgerTab === "xrpl" && xrplHasMore &&
        <button
          type="button"
          onClick={() => loadXrplMore()}
          disabled={xrplLoadingMore}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-white/10 hover:bg-white/15 text-white/70 border border-white/15">

              {xrplLoadingMore ?
                t("ui_loading_1386baebe9", "Loading…") :
                t("ui_load_more_3f7a1c9d5b", "Load more")}
            </button>
        }

          {/* Watermark */}
          <div className="hidden sm:block text-center py-3 md:py-4 border-t border-white/10">
            <div className="space-y-1">
              <p className="text-xs text-white/20 font-mono hidden md:block">{t("ui_generated_on_ae324c9048", "Generated on")}
              {new Date().toLocaleString(locale)}
              </p>
              <p className="text-xs text-white/20 font-mono">{ledgerStatusLabel}</p>
              {ledgerLastIndex != null ?
            <p className="text-xs text-white/20 font-mono">
                  {t("ui_ledger_index_label_0c2a1d9b5e", "Ledger index:")}{" "}
                  {ledgerLastIndex}
                </p> :
            null}
              <p className="text-[10px] text-white/10 font-mono break-all">
                {t("ui_document_hash_label_9b5c1a2d7e", "Document hash:")}{" "}
                {docHash || "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-white/10 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-black/30">
          <div className="flex gap-2 flex-wrap">
            <button
            onClick={handleExportPdf}
            disabled={exportFormat === "pdf"}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-white/10 hover:bg-white/15 text-white/70 border border-white/15">

              {exportFormat === "pdf" ?
                t("ui_loading_1386baebe9", "Loading…") :
                t("ui_export_pdf_9c8d16b4fe", "📄 Export PDF")}
            </button>
            <button
            onClick={handleExportCsv}
            disabled={exportFormat === "csv"}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-white/10 hover:bg-white/15 text-white/70 border border-white/15">

              {exportFormat === "csv" ?
                t("ui_loading_1386baebe9", "Loading…") :
                t("ui_export_csv_2f8a1b9d5e", "Export CSV")}
            </button>
            <button
            onClick={handlePrint}
            className="hidden md:inline-flex md:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-white/10 hover:bg-white/15 text-white/70 border border-white/15">{t("ui_print_1313eff37c", "🖨️ Print")}


          </button>
          </div>
        </div>
      </div>
    </div>;


  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(content, document.body);
}
