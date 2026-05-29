"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslation } from "next-i18next";
import {
  escapeHtml,
  openPrintWindow,
  sha256Hex,
} from "../utils/demoStatementExport";
import DemoStatementMonthSelect from "./DemoStatementMonthSelect";
import {
  formatAmountWithSymbol,
  getDisplayCurrencyCode,
} from "../demoWalletDashboardConfig";

const USD_STABLECOINS = [
  "RLUSD",
  "USD",
];

const ShareIcon = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51l6.83 3.98" />
    <path d="M15.41 6.51L8.59 10.49" />
  </svg>
);

/**
 * Composant de relevé bancaire global (toutes les devises consolidées)
 */
export default function DemoGlobalStatement({
  tokens = [],
  walletAddress,
  walletLabelOverride = "",
  isPreviewMode = false,
  noticeVariant = "preview",
  period = "",
  isFullPage = false,
  variant = "default",
  isClosing = false,
  inline = false,
  usdRates = {},
  totalBalanceOverride = null,
  movements = [],
  movementsLoading = false,
  movementsError = null,
  movementsHasMore = false,
  movementsLoadingMore = false,
  onLoadMoreMovements,
  onClose,
  onViewCurrency,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const [sortBy, setSortBy] = useState("balance"); // balance, change, name
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = current month, 1 = last month, etc.
  const [exportFormat, setExportFormat] = useState(null);
  const [docHash, setDocHash] = useState("");
  const resolvedLabelOverride = String(walletLabelOverride || "").trim();
  const [walletLabel, setWalletLabel] = useState(resolvedLabelOverride);
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
    setWalletLabel(resolvedLabelOverride);
  }, [resolvedLabelOverride]);

  // Générer les 12 derniers mois
  const generateMonths = () => {
    const months = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1,
      );
      months.push({
        value: i,
        label: date.toLocaleDateString(locale, {
          month: "long",
          year: "numeric",
        }),
        displayLabel: date.toLocaleDateString(locale, { month: "long" }), // Juste le mois pour l'affichage
      });
    }

    months.push({
      value: "archives",
      label: archivesLongLabel,
      displayLabel: archivesLabel,
    });
    return months;
  };

  const availableMonths = generateMonths();
  const currentPeriod =
    selectedMonth === "archives"
      ? archivesLabel
      : availableMonths[selectedMonth]?.label || fallbackPeriod;
  const currentDisplayPeriod =
    selectedMonth === "archives"
      ? archivesLabel
      : availableMonths[selectedMonth]?.displayLabel ||
        String(fallbackPeriod).split(" ")[0]; // Affiche juste le mois

  const isUsdStablecoin = useCallback(
    (currency) =>
      USD_STABLECOINS.includes(String(currency || "").toUpperCase()),
    [],
  );

  const getUsdValue = useCallback(
    (token) => {
      const value = parseFloat(token.value || 0);
      if (!Number.isFinite(value)) return null;
      if (value === 0) return 0;
      const code = String(token.currency || "").toUpperCase();
      const rate = usdRates?.[code];
      if (Number.isFinite(rate)) return value * rate;
      if (isUsdStablecoin(code)) return value;
      return null;
    },
    [isUsdStablecoin, usdRates],
  );

  // Calculer les totaux
  const computedTotalBalance = tokens.reduce((sum, token) => {
    const usdValue = getUsdValue(token);
    return sum + (Number.isFinite(usdValue) ? usdValue : 0);
  }, 0);
  const totalBalance = Number.isFinite(Number(totalBalanceOverride))
    ? Number(totalBalanceOverride)
    : computedTotalBalance;

  // Trier les tokens
  const sortedTokens = [...tokens].sort((a, b) => {
    if (sortBy === "balance") {
      return parseFloat(b.value || 0) - parseFloat(a.value || 0);
    }
    if (sortBy === "name") {
      return a.currency.localeCompare(b.currency);
    }
    return 0;
  });

  const ledgerEvidenceCount = useMemo(() => {
    return (movements || []).filter((m) => m?.txHash).length;
  }, [movements]);

  const ledgerLastIndex = useMemo(() => {
    const indexes = (movements || [])
      .map((m) => Number(m?.ledgerIndex))
      .filter((v) => Number.isFinite(v));
    if (!indexes.length) return null;
    return Math.max(...indexes);
  }, [movements]);

  const ledgerStatus = useMemo(() => {
    if (isPreviewMode) return "preview";
    if (ledgerEvidenceCount > 0) return "verified";
    if (Array.isArray(movements) && movements.length > 0) return "offchain";
    return "available";
  }, [isPreviewMode, ledgerEvidenceCount, movements]);

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
    const safeTotal = Number.isFinite(Number(totalBalance))
      ? Number(totalBalance)
      : 0;
    const tokenPayload = (tokens || []).map((token) => ({
      currency: token?.currency || "",
      value: Number.isFinite(Number(token?.value)) ? Number(token.value) : 0,
      issuer: token?.issuer || "",
      isTrustlineOnly: Boolean(token?.isTrustlineOnly),
    }));
    const movementPayload = (movements || []).map((m) => ({
      kind: m?.kind || "",
      fromCurrencyCode: m?.fromCurrencyCode || "",
      toCurrencyCode: m?.toCurrencyCode || "",
      amountRlusd: Number.isFinite(Number(m?.amountRlusd))
        ? Number(m.amountRlusd)
        : 0,
      fxRate: Number.isFinite(Number(m?.fxRate)) ? Number(m.fxRate) : null,
      fxSource: m?.fxSource || "",
      txHash: m?.txHash || "",
      note: m?.note || "",
      createdAt: m?.createdAt || "",
    }));
    return JSON.stringify({
      version: 1,
      type: "global_statement",
      walletAddress: walletAddress || "",
      period: currentPeriod || fallbackPeriod,
      totalBalance: safeTotal,
      tokens: tokenPayload,
      movements: movementPayload,
    });
  }, [
    currentPeriod,
    fallbackPeriod,
    movements,
    tokens,
    totalBalance,
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

  const buildPrintHtml = useCallback(() => {
    const docHashLabel = docHash || "-";
    const ledgerIndexLabel =
      ledgerLastIndex != null ? String(ledgerLastIndex) : "-";
    const walletLabelText = walletLabel || t("nav_wallet", "Wallet");
    const totalBalanceDisplay = Number.isFinite(Number(totalBalance))
      ? formatAmountWithSymbol(locale, totalBalance, "USD")
      : "-";
    const balancesRows = (sortedTokens || [])
      .map((token) => {
        const usdValue = getUsdValue(token);
        const displayCode = getDisplayCurrencyCode(token?.currency);
        return `
        <tr>
          <td>${escapeHtml(displayCode || "-")}</td>
          <td class="right">${escapeHtml(
            formatAmountWithSymbol(locale, token?.value, token?.currency, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          )}</td>
          <td class="right">${
            Number.isFinite(usdValue)
              ? escapeHtml(formatAmountWithSymbol(locale, usdValue, "USD"))
              : "-"
          }</td>
        </tr>
      `;
      })
      .join("");
    const balancesEmpty = `
      <tr>
        <td colspan="3" class="muted">${escapeHtml(
          t("ui_no_balances_found_2c7a1d9b5e", "No balances available"),
        )}</td>
      </tr>
    `;
    const movementRows = (movements || [])
      .map((m) => {
        const from = String(m?.fromCurrencyCode || "").toUpperCase();
        const to = String(m?.toCurrencyCode || "").toUpperCase();
        const amount = Number(m?.amountRlusd || 0);
        const createdAt = m?.createdAt ? new Date(m.createdAt) : null;
        const when =
          createdAt && Number.isFinite(createdAt.getTime())
            ? createdAt.toLocaleString(locale)
            : "";
        return `
        <tr>
          <td>${escapeHtml(when)}</td>
          <td>${escapeHtml(from)}</td>
          <td>${escapeHtml(to)}</td>
          <td class="right">${escapeHtml(
            Number.isFinite(amount)
              ? amount.toLocaleString(locale, { maximumFractionDigits: 2 })
              : "-",
          )}</td>
          <td>${escapeHtml(m?.txHash || "")}</td>
        </tr>
      `;
      })
      .join("");
    const movementsEmpty = `
      <tr>
        <td colspan="5" class="muted">${escapeHtml(
          t("ui_no_movements_found_2b7c1a9d5e", "No movements available"),
        )}</td>
      </tr>
    `;

    return `
      <h1>${escapeHtml(t("ui_global_statement_13e29aa8aa", "Historique de vos dernières transactions"))}</h1>
      <div class="meta">
        <div><strong>${escapeHtml(t("ui_wallet_address_label_2f7a1c9b5e", "Wallet address"))}:</strong> <span class="small">${escapeHtml(walletAddress || "-")}</span></div>
        <div><strong>${escapeHtml(t("ui_statement_period_label_3f6c1a9b5e", "Period"))}:</strong> ${escapeHtml(currentPeriod || fallbackPeriod)}</div>
        <div><strong>${escapeHtml(t("ui_total_balance_label_2c7a1d9b5e", "Total balance (USD)"))}:</strong> ${escapeHtml(totalBalanceDisplay)}</div>
        <div><strong>${escapeHtml(t("ui_ledger_status_label_0f7c1a9b5e", "Ledger status"))}:</strong> ${escapeHtml(ledgerStatusLabel)}</div>
        <div><strong>${escapeHtml(t("ui_document_hash_label_9b5c1a2d7e", "Document hash"))}:</strong> <span class="small">${escapeHtml(docHashLabel)}</span></div>
      </div>
      <h2>${escapeHtml(t("ui_balances_label_1c7a2d9b5e", "Balances"))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t("ui_currency_label_2f7a1c9b5e", "Currency"))}</th>
            <th class="right">${escapeHtml(t("ui_balance_label_7f2a1b9c5e", "Balance"))}</th>
            <th class="right">${escapeHtml(t("ui_usd_value_label_1a7c9d3b5e", "USD value"))}</th>
          </tr>
        </thead>
        <tbody>
          ${balancesRows || balancesEmpty}
        </tbody>
      </table>
      <h2>${escapeHtml(t("ui_recent_activity_de80b9813c", "Recent activity"))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t("ui_date_label_7a2c1b9d5e", "Date"))}</th>
            <th>${escapeHtml(t("ui_from_label_2c7a1d9b5e", "From"))}</th>
            <th>${escapeHtml(t("ui_to_label_7b2c1a9d5e", "To"))}</th>
            <th class="right">${escapeHtml(t("ui_amount_rlusd_label_2c7a1d9b5e", "Amount (RLUSD)"))}</th>
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
    docHash,
    fallbackPeriod,
    getUsdValue,
    ledgerLastIndex,
    ledgerStatusLabel,
    locale,
    movements,
    sortedTokens,
    t,
    totalBalance,
    walletAddress,
    walletLabel,
  ]);

  const handleExportPdf = useCallback(() => {
    setExportFormat("pdf");
    try {
      const suffix = docHash ? docHash.slice(0, 12) : "draft";
      const ok = openPrintWindow({
        title: `XCANNES Historique ${suffix}`,
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
  }, [buildPrintHtml, docHash, t]);

  const getCurrencyFlag = (currency) => {
    const code = String(currency || "")
      .trim()
      .toUpperCase();
    const flags = {
      EUR: "🇪🇺",
      USD: "🇺🇸",
      GBP: "🇬🇧",
      JPY: "🇯🇵",
      CHF: "🇨🇭",
      CAD: "🇨🇦",
      AUD: "🇦🇺",
      NZD: "🇳🇿",
      CNY: "🇨🇳",
      INR: "🇮🇳",
      KRW: "🇰🇷",
      SGD: "🇸🇬",
      HKD: "🇭🇰",
      MXN: "🇲🇽",
      BRL: "🇧🇷",
      ZAR: "🇿🇦",
      TRY: "🇹🇷",
      RUB: "🇷🇺",
      SEK: "🇸🇪",
      NOK: "🇳🇴",
      DKK: "🇩🇰",
      PLN: "🇵🇱",
      THB: "🇹🇭",
      IDR: "🇮🇩",
      MYR: "🇲🇾",
      PHP: "🇵🇭",
      CZK: "🇨🇿",
      ILS: "🇮🇱",
      CLP: "🇨🇱",
      AED: "🇦🇪",
      SAR: "🇸🇦",
      // Demo wallet: treat RLUSD as USD for statement visuals.
      RLUSD: "🇺🇸",
      AFN: "🇦🇫",
      ALL: "🇦🇱",
      DZD: "🇩🇿",
      AOA: "🇦🇴",
      ARS: "🇦🇷",
      AMD: "🇦🇲",
      AWG: "🇦🇼",
      AZN: "🇦🇿",
      BSD: "🇧🇸",
      BHD: "🇧🇭",
      BDT: "🇧🇩",
      BBD: "🇧🇧",
      BYN: "🇧🇾",
      BZD: "🇧🇿",
      BMD: "🇧🇲",
      BTN: "🇧🇹",
      BOB: "🇧🇴",
      BAM: "🇧🇦",
      BWP: "🇧🇼",
      BND: "🇧🇳",
      BGN: "🇧🇬",
      BIF: "🇧🇮",
      KHR: "🇰🇭",
      CVE: "🇨🇻",
      XAF: "🇨🇫",
      XOF: "🇧🇫",
      KMF: "🇰🇲",
      CDF: "🇨🇩",
      CRC: "🇨🇷",
      CUP: "🇨🇺",
      CYP: "🇨🇾",
      DJF: "🇩🇯",
      DOP: "🇩🇴",
      XCD: "🇦🇬",
      EGP: "🇪🇬",
      ERN: "🇪🇷",
      ETB: "🇪🇹",
      FJD: "🇫🇯",
      GMD: "🇬🇲",
      GEL: "🇬🇪",
      GHS: "🇬🇭",
      GTQ: "🇬🇹",
      GNF: "🇬🇳",
      GYD: "🇬🇾",
      HTG: "🇭🇹",
      HNL: "🇭🇳",
      HUF: "🇭🇺",
      ISK: "🇮🇸",
      IQD: "🇮🇶",
      JMD: "🇯🇲",
      JOD: "🇯🇴",
      KZT: "🇰🇿",
      KES: "🇰🇪",
      KWD: "🇰🇼",
      KGS: "🇰🇬",
      LAK: "🇱🇦",
      LBP: "🇱🇧",
      LSL: "🇱🇸",
      LRD: "🇱🇷",
      LYD: "🇱🇾",
      MOP: "🇲🇴",
      MKD: "🇲🇰",
      MGA: "🇲🇬",
      MWK: "🇲🇼",
      MVR: "🇲🇻",
      MRU: "🇲🇷",
      MUR: "🇲🇺",
      MDL: "🇲🇩",
      MNT: "🇲🇳",
      MAD: "🇲🇦",
      MZN: "🇲🇿",
      MMK: "🇲🇲",
      NAD: "🇳🇦",
      NPR: "🇳🇵",
      NIO: "🇳🇮",
      NGN: "🇳🇬",
      OMR: "🇴🇲",
      PKR: "🇵🇰",
      PAB: "🇵🇦",
      PGK: "🇵🇬",
      PYG: "🇵🇾",
      PEN: "🇵🇪",
      SOL: "🇵🇪",
      QAR: "🇶🇦",
      RON: "🇷🇴",
      RWF: "🇷🇼",
      WST: "🇼🇸",
      STN: "🇸🇹",
      RSD: "🇷🇸",
      SCR: "🇸🇨",
      SOS: "🇸🇴",
      LKR: "🇱🇰",
      SDG: "🇸🇩",
      SRD: "🇸🇷",
      SZL: "🇸🇿",
      SYP: "🇸🇾",
      TWD: "🇹🇼",
      TJS: "🇹🇯",
      TZS: "🇹🇿",
      TOP: "🇹🇴",
      TTD: "🇹🇹",
      TND: "🇹🇳",
      TMT: "🇹🇲",
      UGX: "🇺🇬",
      UAH: "🇺🇦",
      UYU: "🇺🇾",
      UZS: "🇺🇿",
      VUV: "🇻🇺",
      VES: "🇻🇪",
      VND: "🇻🇳",
      YER: "🇾🇪",
      ZMW: "🇿🇲",
      ZWL: "🇿🇼",
    };
    return flags[code] || "💱";
  };

  const [txFilter, setTxFilter] = useState("all");
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [accountAddressExpanded, setAccountAddressExpanded] = useState(false);
  const [accountCopyNotice, setAccountCopyNotice] = useState("");
  const [detailTx, setDetailTx] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const accountDropdownRef = useRef(null);
  const accountCopyNoticeTimerRef = useRef(null);

  useEffect(() => {
    if (!accountDropdownOpen) return;
    const handler = (e) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [accountDropdownOpen]);

  const openMovementDetails = useCallback((m) => {
    setDetailTx(m);
    setDetailOpen(true);
  }, []);

  const closeMovementDetails = useCallback(() => {
    setDetailOpen(false);
    setTimeout(() => setDetailTx(null), 200);
  }, []);

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

  const transactionDetailModal =
    detailOpen && detailTx && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[10400] flex items-end md:items-center justify-center">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={closeMovementDetails}
            />
            <div
              className={`relative w-full md:max-w-lg rounded-t-2xl md:rounded-2xl ${modalBgClass} flex flex-col overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] wallet-modal-lift-in`}
            >
              <div className="flex-shrink-0 bg-[#111518] px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-semibold text-white/95">
                    {(() => {
                      const k = String(detailTx?.kind || "").toUpperCase();
                      if (k === "CONVERSION") return t("ui_conversion", "Conversion");
                      if (k.includes("_OUT")) return t("statement_xrpl_mobile_out", "Envoyé");
                      if (k.includes("_IN")) return t("statement_xrpl_mobile_in", "Reçu");
                      return t("ui_transaction", "Transaction");
                    })()}
                  </div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    {detailTx?.createdAt
                      ? new Date(detailTx.createdAt).toLocaleString(locale)
                      : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeMovementDetails}
                  className="shrink-0 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label={t("ui_close", "Fermer")}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {(() => {
                  const k = String(detailTx?.kind || "").toUpperCase();
                  const isConversion = k === "CONVERSION";
                  const isPaymentOut = k.includes("_OUT");
                  const isPaymentIn = k.includes("_IN");
                  const isDebit = isPaymentOut || k.includes("FEE");
                  const displayAmount = Number(detailTx?.displayAmount);
                  const amount =
                    Number.isFinite(displayAmount) && displayAmount
                      ? displayAmount
                      : Number(detailTx?.amountRlusd || 0);
                  const currency = String(
                    detailTx?.displayCurrencyCode || "RLUSD",
                  ).trim();
                  const from = String(
                    detailTx?.fromCurrencyCode || "",
                  ).toUpperCase();
                  const to = String(
                    detailTx?.toCurrencyCode || "",
                  ).toUpperCase();

                  return (
                    <>
                      {!isConversion ? (
                        <div className="rounded-[14px] p-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03]">
                          <div className="text-xs text-white/50">
                            {t("ui_amount_label_2c7a1d9b5e", "Montant")}
                          </div>
                          <div
                            className={`mt-1 text-2xl font-bold font-mono ${
                              isDebit ? "text-red-400" : "text-xcannes-green"
                            }`}
                          >
                            {isDebit ? "−" : "+"}
                            {Number.isFinite(amount)
                              ? `${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
                              : "—"}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[14px] p-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03]">
                          <div className="text-xs text-white/50">
                            {t("ui_conversion", "Conversion")}
                          </div>
                          <div className="mt-1 text-xl font-bold text-white/90">
                            {from} → {to}
                          </div>
                        </div>
                      )}
                      {detailTx?.txHash ? (
                        <div>
                          <div className="text-xs text-white/50 mb-1">
                            {t("ui_tx_hash_label_2b7c1a9d5e", "Tx hash")}
                          </div>
                          <div className="text-xs font-mono text-white/70 break-all">
                            {detailTx.txHash}
                          </div>
                        </div>
                      ) : null}
                      {detailTx?.counterparty &&
                      detailTx.counterparty.toUpperCase() !== "XCANNES" ? (
                        <div>
                          <div className="text-xs text-white/50 mb-1">
                            {isPaymentOut
                              ? t("ui_recipient_label", "Destinataire")
                              : t("ui_sender_label", "Expéditeur")}
                          </div>
                          <div className="text-xs font-mono text-white/70 break-all">
                            {detailTx.counterparty}
                          </div>
                        </div>
                      ) : null}
                      {detailTx?.note ? (
                        <div>
                          <div className="text-xs text-white/50 mb-1">
                            {t("ui_note_label", "Note")}
                          </div>
                          <div className="text-sm text-white/80">
                            {detailTx.note}
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const content = (
    <div className={`${wrapperBaseClass} ${resolvedLayout.wrapperClass}`}>
      {!inline ? (
        <div
          className={[
            "absolute inset-0 z-[10200]",
            resolvedLayout.backdropClass,
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in",
          ].join(" ")}
          onClick={onClose}
        />
      ) : null}

      <div
        className={`relative w-full wallet-modal-panel wallet-modal-no-top-highlight-mobile ${modalBgClass} flex flex-col overflow-hidden ${inline ? "z-[1]" : "z-[10201]"} shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] ${resolvedLayout.panelClass} ${inline ? "wallet-inline-zoom-in" : isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in"}`}
      >
        {/* Header + Filtres */}
        <div className="relative flex-shrink-0 bg-[#111518] shadow-[inset_0_70px_100px_rgba(0,0,0,0.75)]">
          <div className="px-4 md:px-5 py-4">
            {!inline ? (
              <div
                className="md:hidden flex justify-center -mt-1 pt-1 pb-2"
                aria-hidden
              >
                <span className="block w-12 h-1.5 rounded-full bg-white/20" />
              </div>
            ) : null}
            <div className="flex justify-start">
              <div className="min-w-0 flex flex-col items-start justify-center text-left gap-3">
                <div className="flex items-center justify-start gap-3">
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-white/70"
                    aria-hidden="true"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8" strokeWidth="1.1" />
                    <polyline points="14 2 14 8 20 8" strokeWidth="1.1" />
                    <circle cx="18" cy="17" r="4" strokeWidth="1.1" />
                    <polyline points="18 15 18 17 19.5 18.5" />
                    <line x1="8" y1="13" x2="12" y2="13" />
                    <line x1="8" y1="9" x2="10" y2="9" />
                    <line x1="8" y1="17" x2="11" y2="17" />
                  </svg>
                  <h2 className="text-[28px] md:text-[32px] font-semibold text-white/95 tracking-tight text-left">
                    {t(
                      "ui_global_statement_13e29aa8aa",
                      "Historique de vos dernières transactions",
                    )}
                  </h2>
                  {noticeVariant === "demo" ? (
                    <span className="ml-2 inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                      {t("demo_notice_title", "Mode démo")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] md:text-[15px] text-white/50 max-w-[46ch] md:max-w-[60ch] leading-relaxed">
                  {t(
                    "ui_global_statement_subtitle_recent_20",
                    "Consultez vos transactions récentes et ouvrez-en une pour voir les détails.",
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Filtres */}
          <div className="px-4 md:px-6 pt-6 md:pt-7 pb-2 md:pb-3 flex flex-row items-stretch md:items-center gap-2">
            <div className="flex flex-1 items-center rounded-[16px] p-1 ring-1 ring-white/[0.05] ring-inset bg-gradient-to-b from-[#101415] to-[#0d1214]">
              {[
                { key: "all", label: t("ui_all_0c90d41d71", "Tout") },
                { key: "credit", label: t("ui_credits_b8166276a0", "Entrées") },
                { key: "debit", label: t("ui_debits_38c870b18f", "Sorties") },
                {
                  key: "conversion",
                  label: t("ui_conversions_b604b5ef8b", "Conversions"),
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTxFilter(item.key)}
                  className={`px-3 py-3 flex-1 text-center rounded-[12px] text-sm font-medium transition-colors whitespace-nowrap ${
                    txFilter === item.key
                      ? item.key === "all"
                        ? "bg-[#14191c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-14px_18px_rgba(0,0,0,0.6)]"
                        : item.key === "credit"
                          ? "bg-green-500/15 text-green-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                          : item.key === "debit"
                            ? "bg-red-500/15 text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                            : "bg-blue-500/15 text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                      : item.key === "all"
                        ? "text-white/60 hover:text-white/80 bg-[#111518] hover:bg-[#0d1114]"
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
        </div>
        {/* fin conteneur header+filtres */}

        {/* Content - Zone scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-5 pt-4 md:pt-6 pb-6 md:pb-6 flex flex-col gap-4 bg-gradient-to-b from-[#101415] to-[#0d1214] border-t border-white/[0.10] md:border-white/[0.06]">
          <div className="space-y-2">
            {movementsLoading ? (
              <div className="rounded-[20px] px-3 py-3 ring-1 ring-white/10 ring-inset bg-white/5 text-sm text-white/70">
                {t("ui_loading_1386baebe9", "Loading…")}
              </div>
            ) : movementsError ? (
              <div className="rounded-[20px] px-3 py-3 ring-1 ring-red-500/20 ring-inset bg-red-500/10 text-sm text-red-200">
                {String(movementsError)}
              </div>
            ) : !movements || movements.length === 0 ? (
              <div className="rounded-[20px] px-3 py-3 ring-1 ring-white/10 ring-inset bg-white/5 text-sm text-white/70">
                {t(
                  "ui_no_transactions_yet_2c7a1d9b5e",
                  "Aucune transaction pour le moment",
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {movements
                  .filter((m) => {
                    if (txFilter === "all") return true;
                    const k = String(m?.kind || "").toUpperCase();
                    if (txFilter === "conversion") return k === "CONVERSION";
                    if (txFilter === "credit")
                      return k.includes("_IN") || k === "RECONCILE";
                    if (txFilter === "debit")
                      return k.includes("_OUT") || k.includes("FEE");
                    return true;
                  })
                  .map((m, idx) => {
                    const k = String(m?.kind || "").toUpperCase();
                    const isConversion = k === "CONVERSION";
                    const isPaymentOut = k.includes("_OUT");
                    const isPaymentIn = k.includes("_IN");
                    const isDebit = isPaymentOut || k.includes("FEE");
                    const isCredit = isPaymentIn || k === "RECONCILE";
                    const uiType = isDebit
                      ? "debit"
                      : isCredit
                        ? "credit"
                        : "neutral";
                    const sign = isDebit ? "−" : isCredit ? "+" : "";
                    const isLatest = idx === 0;
                    const from = String(
                      m?.fromCurrencyCode || "",
                    ).toUpperCase();
                    const to = String(m?.toCurrencyCode || "").toUpperCase();
                    const displayAmount = Number(m?.displayAmount);
                    const amount =
                      Number.isFinite(displayAmount) && displayAmount
                        ? displayAmount
                        : Number(m?.amountRlusd || 0);
                    const currency = String(
                      m?.displayCurrencyCode || "RLUSD",
                    ).trim();
                    const createdAt = m?.createdAt
                      ? new Date(m.createdAt)
                      : null;
                    const when =
                      createdAt && Number.isFinite(createdAt.getTime())
                        ? createdAt.toLocaleString(locale)
                        : "";
                    const rowCounterparty = String(
                      m?.counterparty || "",
                    ).trim();
                    const rowCounterpartyLabel = (() => {
                      if (
                        !rowCounterparty ||
                        rowCounterparty.toUpperCase() === "XCANNES"
                      )
                        return "";
                      if (rowCounterparty.length > 30)
                        return `${rowCounterparty.slice(0, 8)}…${rowCounterparty.slice(-6)}`;
                      return rowCounterparty;
                    })();
                    const key =
                      m?.movementId ||
                      m?.id ||
                      `${m?.txHash || "nohash"}-${m?.kind || ""}-${m?.createdAt || ""}-${idx}`;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => openMovementDetails(m)}
                        className={[
                          "w-full text-left rounded-[20px] px-3 transition-colors duration-150",
                          isLatest
                            ? "py-3 ring-1 ring-inset bg-[#101415] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-14px_22px_rgba(0,0,0,0.5)] ring-white/10 transform-gpu scale-[1.04] origin-center drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] transition-transform duration-150"
                            : "py-2 ring-1 ring-inset ring-white/[0.06] bg-[#101415] shadow-[inset_0_-14px_18px_rgba(0,0,0,0.8)]",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[15px] font-medium text-white/90 truncate">
                              {isPaymentOut
                                ? `${t("statement_xrpl_mobile_out", "Envoyé")}${
                                    rowCounterpartyLabel
                                      ? ` à ${rowCounterpartyLabel}`
                                      : ""
                                  }`
                                : isPaymentIn
                                  ? `${t("statement_xrpl_mobile_in", "Reçu")}${
                                      rowCounterpartyLabel
                                        ? ` de ${rowCounterpartyLabel}`
                                        : ""
                                    }`
                                  : isConversion
                                    ? `${t("ui_conversion", "Conversion")}${
                                        from && to ? ` ${from} → ${to}` : ""
                                      }`
                                    : m?.note || k}
                            </div>
                            <div className="mt-0.5 text-[11px] text-white/45 truncate">
                              {when || ""}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {!isConversion ? (
                              <div className="text-right">
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
                                  {Number.isFinite(amount)
                                    ? `${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
                                    : "—"}
                                </div>
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
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {movementsHasMore ? (
            <button
              type="button"
              onClick={onLoadMoreMovements}
              disabled={movementsLoadingMore}
              className="w-full text-center text-sm text-white/50 hover:text-white/80 py-3 transition-colors disabled:opacity-40"
            >
              {movementsLoadingMore
                ? t("ui_loading_1386baebe9", "Loading…")
                : t("ui_load_more_8b3c1d2a9e", "Charger plus")}
            </button>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 md:px-6 py-1.5 md:py-3 pb-[max(2px,env(safe-area-inset-bottom))] md:pb-[max(12px,env(safe-area-inset-bottom))] border-t border-white/[0.10] md:border-white/[0.06] bg-[#111518] shadow-[inset_0_-46px_70px_rgba(0,0,0,0.55)] flex items-center justify-between gap-3">
          {/* Compte actuel */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="relative w-auto min-w-[120px] max-w-[180px]"
              ref={accountDropdownRef}
            >
              <button
                type="button"
                onClick={() => setAccountDropdownOpen((prev) => !prev)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 md:py-2 bg-transparent transition-all rounded-[10px]"
                aria-haspopup="menu"
                aria-expanded={accountDropdownOpen}
                title={t("ui_current_account_plain", "Compte actuel")}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0 animate-pulse"
                  aria-hidden
                />
                <span className="text-white/95 text-sm font-semibold truncate min-w-0 flex-1 text-center">
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
                  {accountDropdownOpen ? <path d="M4 20L20 4" /> : null}
                </svg>
              </button>
              {accountDropdownOpen && walletAddress ? (
                <div className="absolute bottom-full left-0 z-[200] w-full mb-1 rounded-[10px] ring-1 ring-white/20 ring-inset bg-elevated px-4 py-3 shadow-[0_-8px_18px_rgba(0,0,0,0.45)]">
                  <p className="text-[13px] text-white/60 mb-2">
                    {t("ui_account_address", "Adresse du compte")}
                  </p>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      className={`min-w-0 flex-1 text-left text-xs text-white/55 font-mono font-light ${
                        accountAddressExpanded
                          ? "break-all whitespace-normal"
                          : "truncate"
                      }`}
                      title={walletAddress}
                      onClick={() =>
                        setAccountAddressExpanded((prev) => !prev)
                      }
                      aria-label={t(
                        "ui_toggle_wallet_address_truncation",
                        "Afficher l'adresse complète",
                      )}
                    >
                      {accountAddressExpanded
                        ? walletAddress
                        : `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard?.writeText?.(
                            walletAddress,
                          );
                          setAccountCopyNotice(
                            t("ui_copied_address", "Adresse copiée"),
                          );
                          if (accountCopyNoticeTimerRef.current)
                            clearTimeout(accountCopyNoticeTimerRef.current);
                          accountCopyNoticeTimerRef.current =
                            window.setTimeout(
                              () => setAccountCopyNotice(""),
                              3000,
                            );
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="shrink-0 text-white/40 hover:text-white/70 transition-colors p-0.5"
                      title={t("ui_copy_address", "Copier l'adresse")}
                      aria-label={t("ui_copy_address", "Copier l'adresse")}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
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
          {/* Bouton télécharger */}
          <button
            onClick={handleExportPdf}
            disabled={exportFormat === "pdf"}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-1.5 md:py-2 rounded-[10px] text-sm font-medium transition-colors disabled:opacity-50 text-white/70 hover:text-white bg-transparent hover:bg-white/[0.04]"
            aria-label={t("ui_export_pdf_9c8d16b4fe", "Télécharger")}
          >
            <ShareIcon
              className={`w-4 h-4 ${exportFormat === "pdf" ? "opacity-40" : ""}`}
            />
            <span>
              {exportFormat === "pdf"
                ? t("ui_loading_1386baebe9", "Loading…")
                : t("ui_export_pdf_9c8d16b4fe", "Télécharger")}
            </span>
          </button>
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
