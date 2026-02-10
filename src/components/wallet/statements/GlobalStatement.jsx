"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslation } from "next-i18next";
import { apiUrl } from "@/lib/runtimeConfig";
import {
  buildCsvString,
  downloadTextFile,
  escapeHtml,
  openPrintWindow,
  sha256Hex
} from "@/utils/statementExport";
import StatementMonthSelect from "./StatementMonthSelect";

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


/**
 * Composant de relevé bancaire global (toutes les devises consolidées)
 */
export default function GlobalStatement({
  tokens = [],
  walletAddress,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null,
  noticeVariant = "preview",
  noticeContextLabel = "",
  walletId = "",
  period = "",
  isFullPage = false,
  variant = "default",
  inline = false,
  usdRates = {},
  movements = [],
  movementsLoading = false,
  movementsError = null,
  movementsHasMore = false,
  movementsLoadingMore = false,
  onLoadMoreMovements,
  onClose,
  onViewCurrency
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const [sortBy, setSortBy] = useState("balance"); // balance, change, name
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = current month, 1 = last month, etc.
  const [exportFormat, setExportFormat] = useState(null);
  const [docHash, setDocHash] = useState("");
  const [walletLabel, setWalletLabel] = useState("");
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
    let cancelled = false;
    if (!walletAddress) {
      setWalletLabel("");
      return () => {};
    }

    const loadLabel = async () => {
      try {
        const res = await fetch(
          apiUrl(`/wallet/label?address=${encodeURIComponent(walletAddress)}`)
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load wallet label");
        }
        if (cancelled) return;
        setWalletLabel(String(data?.label || "").trim());
      } catch (err) {
        console.error("Error loading wallet label:", err);
        if (!cancelled) setWalletLabel("");
      }
    };

    loadLabel();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

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

  const isUsdStablecoin = useCallback(
    (currency) =>
    USD_STABLECOINS.includes(String(currency || "").toUpperCase()),
    []
  );

  const getUsdValue = useCallback((token) => {
    const value = parseFloat(token.value || 0);
    if (!Number.isFinite(value)) return null;
    if (value === 0) return 0;
    const code = String(token.currency || "").toUpperCase();
    const rate = usdRates?.[code];
    if (Number.isFinite(rate)) return value * rate;
    if (isUsdStablecoin(code)) return value;
    if (code === "XRP") return value * 0.5;
    return null;
  }, [isUsdStablecoin, usdRates]);

  // Calculer les totaux
  const totalBalance = tokens.reduce((sum, token) => {
    const usdValue = getUsdValue(token);
    return sum + (Number.isFinite(usdValue) ? usdValue : 0);
  }, 0);

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

  const formatAmount = useCallback((amount) => {
    return parseFloat(amount || 0).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, [locale]);

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
    const safeTotal = Number.isFinite(Number(totalBalance)) ? Number(totalBalance) : 0;
    const tokenPayload = (tokens || []).map((token) => ({
      currency: token?.currency || "",
      value: Number.isFinite(Number(token?.value)) ? Number(token.value) : 0,
      issuer: token?.issuer || "",
      isTrustlineOnly: Boolean(token?.isTrustlineOnly)
    }));
    const movementPayload = (movements || []).map((m) => ({
      kind: m?.kind || "",
      fromCurrencyCode: m?.fromCurrencyCode || "",
      toCurrencyCode: m?.toCurrencyCode || "",
      amountRlusd: Number.isFinite(Number(m?.amountRlusd)) ? Number(m.amountRlusd) : 0,
      fxRate: Number.isFinite(Number(m?.fxRate)) ? Number(m.fxRate) : null,
      fxSource: m?.fxSource || "",
      txHash: m?.txHash || "",
      note: m?.note || "",
      createdAt: m?.createdAt || ""
    }));
    return JSON.stringify({
      version: 1,
      type: "global_statement",
      walletAddress: walletAddress || "",
      period: currentPeriod || fallbackPeriod,
      totalBalance: safeTotal,
      tokens: tokenPayload,
      movements: movementPayload
    });
  }, [currentPeriod, fallbackPeriod, movements, tokens, totalBalance, walletAddress]);

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
    const generatedAt = new Date().toLocaleString(locale);
    const docHashLabel = docHash || "-";
    const ledgerIndexLabel = ledgerLastIndex != null ? String(ledgerLastIndex) : "-";
    const walletLabelText = walletLabel || t("nav_wallet", "Wallet");
    const totalBalanceDisplay = Number.isFinite(Number(totalBalance)) ?
    `$${formatAmount(totalBalance)}` :
    "-";
    const balancesRows = (sortedTokens || []).map((token) => {
      const usdValue = getUsdValue(token);
      return `
        <tr>
          <td>${escapeHtml(String(token?.currency || "").toUpperCase())}</td>
          <td class="right">${escapeHtml(formatAmount(token?.value))}</td>
          <td class="right">${Number.isFinite(usdValue) ? escapeHtml(`$${formatAmount(usdValue)}`) : "-"}</td>
        </tr>
      `;
    }).join("");
    const balancesEmpty = `
      <tr>
        <td colspan="3" class="muted">${escapeHtml(
          t("ui_no_balances_found_2c7a1d9b5e", "No balances available")
        )}</td>
      </tr>
    `;
    const movementRows = (movements || []).map((m) => {
      const from = String(m?.fromCurrencyCode || "").toUpperCase();
      const to = String(m?.toCurrencyCode || "").toUpperCase();
      const amount = Number(m?.amountRlusd || 0);
      const createdAt = m?.createdAt ? new Date(m.createdAt) : null;
      const when =
      createdAt && Number.isFinite(createdAt.getTime()) ?
      createdAt.toLocaleString(locale) :
      "";
      return `
        <tr>
          <td>${escapeHtml(when)}</td>
          <td>${escapeHtml(m?.kind || "")}</td>
          <td>${escapeHtml(from)}</td>
          <td>${escapeHtml(to)}</td>
          <td class="right">${escapeHtml(
            Number.isFinite(amount) ?
            amount.toLocaleString(locale, { maximumFractionDigits: 6 }) :
            "-"
          )}</td>
          <td>${escapeHtml(m?.txHash || "")}</td>
        </tr>
      `;
    }).join("");
    const movementsEmpty = `
      <tr>
        <td colspan="6" class="muted">${escapeHtml(
          t("ui_no_movements_found_2b7c1a9d5e", "No movements available")
        )}</td>
      </tr>
    `;

    return `
      <h1>${escapeHtml(t("ui_global_statement_13e29aa8aa", "Global Statement"))}</h1>
      <div class="meta">
        <div><strong>${escapeHtml(t("ui_account_holder_3eef963295", "Account Holder"))}:</strong> ${escapeHtml(walletLabelText)}</div>
        <div><strong>${escapeHtml(t("ui_wallet_address_label_2f7a1c9b5e", "Wallet address"))}:</strong> <span class="small">${escapeHtml(walletAddress || "-")}</span></div>
        <div><strong>${escapeHtml(t("ui_statement_period_label_3f6c1a9b5e", "Period"))}:</strong> ${escapeHtml(currentPeriod || fallbackPeriod)}</div>
        <div><strong>${escapeHtml(t("ui_total_balance_label_2c7a1d9b5e", "Total balance (USD)"))}:</strong> ${escapeHtml(totalBalanceDisplay)}</div>
        <div><strong>${escapeHtml(t("ui_generated_on_3827d9035f", "Generated on"))}:</strong> ${escapeHtml(generatedAt)}</div>
        <div><strong>${escapeHtml(t("ui_ledger_status_label_0f7c1a9b5e", "Ledger status"))}:</strong> ${escapeHtml(ledgerStatusLabel)}</div>
        <div><strong>${escapeHtml(t("ui_ledger_index_label_0c2a1d9b5e", "Ledger index"))}:</strong> ${escapeHtml(ledgerIndexLabel)}</div>
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
            <th>${escapeHtml(t("ui_type_label_8b1a4d2c7e", "Type"))}</th>
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
  formatAmount,
  getUsdValue,
  ledgerLastIndex,
  ledgerStatusLabel,
  locale,
  movements,
  sortedTokens,
  t,
  totalBalance,
  walletAddress,
  walletLabel]);

  const handleExportPdf = useCallback(() => {
    setExportFormat("pdf");
    try {
      const suffix = docHash ? docHash.slice(0, 12) : "draft";
      const ok = openPrintWindow({
        title: `XCANNES Global Statement ${suffix}`,
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
  }, [buildPrintHtml, docHash, t]);

  const handlePrint = useCallback(() => {
    const suffix = docHash ? docHash.slice(0, 12) : "draft";
    const ok = openPrintWindow({
      title: `XCANNES Global Statement ${suffix}`,
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
  }, [buildPrintHtml, docHash, t]);

  const handleExportCsv = useCallback(() => {
    setExportFormat("csv");
    try {
      const suffix = docHash ? docHash.slice(0, 12) : "draft";
      const headers = [
      "created_at",
      "kind",
      "from_currency",
      "to_currency",
      "amount_rlusd",
      "fx_rate",
      "fx_source",
      "tx_hash",
      "total_balance_usd",
      "ledger_status",
      "doc_hash"];
      const rows = (movements || []).map((m) => ([
        m?.createdAt || "",
        m?.kind || "",
        m?.fromCurrencyCode || "",
        m?.toCurrencyCode || "",
        Number.isFinite(Number(m?.amountRlusd)) ? Number(m.amountRlusd) : "",
        Number.isFinite(Number(m?.fxRate)) ? Number(m.fxRate) : "",
        m?.fxSource || "",
        m?.txHash || "",
        Number.isFinite(Number(totalBalance)) ? Number(totalBalance) : "",
        ledgerStatus,
        docHash || ""
      ]));
      const csv = buildCsvString(headers, rows);
      downloadTextFile({
        filename: `xcannes-statement-global-${suffix}.csv`,
        content: csv,
        type: "text/csv;charset=utf-8"
      });
    } finally {
      setExportFormat(null);
    }
  }, [docHash, ledgerStatus, movements, totalBalance]);

  const getCurrencyFlag = (currency) => {
    const flags = {
      EUR: "🇪🇺", USD: "🇺🇸", GBP: "🇬🇧", JPY: "🇯🇵",
      CHF: "🇨🇭", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿",
      CNY: "🇨🇳", INR: "🇮🇳", KRW: "🇰🇷", SGD: "🇸🇬",
      HKD: "🇭🇰", MXN: "🇲🇽", BRL: "🇧🇷", ZAR: "🇿🇦",
      TRY: "🇹🇷", RUB: "🇷🇺", SEK: "🇸🇪", NOK: "🇳🇴",
      DKK: "🇩🇰", PLN: "🇵🇱", THB: "🇹🇭", IDR: "🇮🇩",
      MYR: "🇲🇾", PHP: "🇵🇭", CZK: "🇨🇿", ILS: "🇮🇱",
      CLP: "🇨🇱", AED: "🇦🇪", SAR: "🇸🇦",
      XRP: "✕", RLUSD: "💵", XCS: "🪙",
      BTC: "₿", ETH: "Ξ", USDT: "₮", USDC: "💵",
      BNB: "🔶", ADA: "₳", DOGE: "Ð",
      XLM: "🚀", LINK: "⬡", DOT: "⚫", UNI: "🦄",
      MATIC: "🔷", LTC: "Ł", BCH: "₿", AVAX: "🔺",
      ATOM: "⚛️", XMR: "ɱ", TRX: "◇", ETC: "Ξ",
      AFN: "🇦🇫", ALL: "🇦🇱", DZD: "🇩🇿", AOA: "🇦🇴",
      ARS: "🇦🇷", AMD: "🇦🇲", AWG: "🇦🇼", AZN: "🇦🇿",
      BSD: "🇧🇸", BHD: "🇧🇭", BDT: "🇧🇩", BBD: "🇧🇧",
      BYN: "🇧🇾", BZD: "🇧🇿", BMD: "🇧🇲", BTN: "🇧🇹",
      BOB: "🇧🇴", BAM: "🇧🇦", BWP: "🇧🇼", BND: "🇧🇳",
      BGN: "🇧🇬", BIF: "🇧🇮", KHR: "🇰🇭", CVE: "🇨🇻",
      XAF: "🇨🇫", XOF: "🇧🇫", KMF: "🇰🇲", CDF: "🇨🇩",
      CRC: "🇨🇷", CUP: "🇨🇺", CYP: "🇨🇾",
      DJF: "🇩🇯", DOP: "🇩🇴", XCD: "🇦🇬", EGP: "🇪🇬",
      ERN: "🇪🇷", ETB: "🇪🇹", FJD: "🇫🇯", GMD: "🇬🇲",
      GEL: "🇬🇪", GHS: "🇬🇭", GTQ: "🇬🇹", GNF: "🇬🇳",
      GYD: "🇬🇾", HTG: "🇭🇹", HNL: "🇭🇳", HUF: "🇭🇺",
      ISK: "🇮🇸", IQD: "🇮🇶", JMD: "🇯🇲", JOD: "🇯🇴",
      KZT: "🇰🇿", KES: "🇰🇪", KWD: "🇰🇼", KGS: "🇰🇬",
      LAK: "🇱🇦", LBP: "🇱🇧", LSL: "🇱🇸", LRD: "🇱🇷",
      LYD: "🇱🇾", MOP: "🇲🇴", MKD: "🇲🇰", MGA: "🇲🇬",
      MWK: "🇲🇼", MVR: "🇲🇻", MRU: "🇲🇷", MUR: "🇲🇺",
      MDL: "🇲🇩", MNT: "🇲🇳", MAD: "🇲🇦", MZN: "🇲🇿",
      MMK: "🇲🇲", NAD: "🇳🇦", NPR: "🇳🇵", NIO: "🇳🇮",
      NGN: "🇳🇬", OMR: "🇴🇲", PKR: "🇵🇰", PAB: "🇵🇦",
      PGK: "🇵🇬", PYG: "🇵🇾", PEN: "🇵🇪", SOL: "🇵🇪", QAR: "🇶🇦",
      RON: "🇷🇴", RWF: "🇷🇼", WST: "🇼🇸", STN: "🇸🇹",
      RSD: "🇷🇸", SCR: "🇸🇨", SOS: "🇸🇴",
      LKR: "🇱🇰", SDG: "🇸🇩", SRD: "🇸🇷", SZL: "🇸🇿",
      SYP: "🇸🇾", TWD: "🇹🇼", TJS: "🇹🇯", TZS: "🇹🇿",
      TOP: "🇹🇴", TTD: "🇹🇹", TND: "🇹🇳", TMT: "🇹🇲",
      UGX: "🇺🇬", UAH: "🇺🇦", UYU: "🇺🇾", UZS: "🇺🇿",
      VUV: "🇻🇺", VES: "🇻🇪", VND: "🇻🇳", YER: "🇾🇪",
      ZMW: "🇿🇲", ZWL: "🇿🇼"
    };
    return flags[currency] || "💱";
  };

  const getCategoryBadge = (token) => {
    if (token.currency === "XRP") {
      return {
        label: t("ui_label_native_2d7a1c9b4e", "Native"),
        color: "blue"
      };
    }
    if (token.currency === "XCS") {
      return {
        label: t("ui_label_platform_7c1a9d3b5e", "Platform"),
        color: "green"
      };
    }
    if (isUsdStablecoin(token.currency))
    return {
      label: t("ui_label_stablecoin_9b2c7a1d5e", "Stablecoin"),
      color: "purple"
    };
    if (token.isTrustlineOnly) {
      return {
        label: t("ui_label_exchange_rate_5a1c7b9d3e", "Exchange Rate"),
        color: "orange"
      };
    }
    return { label: t("ui_label_token_1c7b3a9d5e", "Token"), color: "gray" };
  };

  const STATEMENT_LAYOUTS = {
    full: {
      backdropClass: "bg-black/80 md:backdrop-blur-sm",
      wrapperClass: "items-stretch justify-center px-0 md:items-center md:px-4",
      panelClass:
      "w-full h-[100svh] max-h-[100svh] rounded-none border-0 md:max-w-5xl md:rounded-2xl md:border md:border-white/10 md:max-h-[92vh] lg:max-w-6xl"
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
      "max-w-5xl lg:max-w-6xl rounded-2xl border border-white/10 max-h-[92vh]"
    },
    "inline-desktop": {
      backdropClass: "",
      wrapperClass: "items-stretch justify-stretch p-0",
      panelClass:
      "w-full h-full rounded-xl border border-white/10"
    }
  };

  const resolvedLayout = STATEMENT_LAYOUTS[variant] || STATEMENT_LAYOUTS.default;
  const wrapperBaseClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10200] flex";

  const modalBgClass = noticeVariant === "demo" && walletId === "B" ? "bg-[#0b1017]" : "bg-elevated";
  const showNotConnectedNotice = isPreviewMode && noticeVariant !== "demo";
  const showNotActivatedNotice =
    !isPreviewMode && noticeVariant !== "demo" && isWalletActivated === false;
  const showRlusdNotActivatedNotice =
    !isPreviewMode &&
    noticeVariant !== "demo" &&
    isWalletActivated === true &&
    hasRlusdTrustline === false;

  const content =
  <div
    className={`${wrapperBaseClass} ${resolvedLayout.wrapperClass} ${inline ? "" : resolvedLayout.backdropClass}`}
    onClick={(e) => {
      if (inline) return;
      // Fermer uniquement si on clique sur le backdrop (pas sur le modal)
      if (e.target === e.currentTarget) {
        onClose?.();
      }
    }}>

      <div
      className={`relative w-full ${modalBgClass} flex flex-col overflow-hidden z-[10201] ${resolvedLayout.panelClass}`}>

        
        {/* Header avec Account Info intégré */}
        <div className={`border-b border-white/10 flex-shrink-0 ${modalBgClass} px-4 md:px-5 py-4`}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl flex-shrink-0">🌍</span>
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-xl font-bold text-white truncate">
                  {t("ui_global_statement_13e29aa8aa", "Global Statement")}
                </h2>
                {noticeVariant === "demo" ? (
                  <span className="inline-flex items-center text-xcannes-green text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}
                {showNotConnectedNotice ? (
                  <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold px-2 py-0.5 leading-none">
                    {t("wallet_not_connected_title", "Wallet not connected")}
                  </span>
                ) : null}
                {showNotActivatedNotice ? (
                  <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold px-2 py-0.5 leading-none">
                    {t(
                      "wallet_not_activated_title",
                      "Wallet not activated: a minimum reserve of 1 XRP is required."
                    )}
                  </span>
                ) : null}
                {showRlusdNotActivatedNotice ? (
                  <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold px-2 py-0.5 leading-none">
                    {t(
                      "wallet_rlusd_not_activated_title",
                      "RLUSD not activated. Authorize RLUSD on your wallet."
                    )}
                  </span>
                ) : null}
              </div>
            </div>
            {!inline ? (
              <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors text-2xl leading-none flex-shrink-0">

                ✕
              </button>
            ) : null}
          </div>

          
          {/* Account Info dans le header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-white/50 mb-1">{t("ui_account_holder_1bfc3cd21c", "Account Holder")}</p>
              <p className="text-sm text-white font-semibold truncate">
                {walletLabel || t("nav_wallet", "Wallet")}
              </p>
              <p className="text-[11px] text-white/50 font-mono break-all">
                {walletAddress}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">{t("ui_statement_period_4674b18f25", "Statement Period")}</p>
              {/* Month Selector - simplifié */}
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
              <p className="text-xs text-white/50 mb-1">{t("ui_total_assets_918e935125", "Total Assets")}</p>
              <p className="text-sm text-white">≈ {formatAmount(totalBalance)}{t("ui_usd_fb11d8df09", "USD")}</p>
              <p className="text-[11px] text-white/50">{tokens.length}{t("ui_currencies_5e5bf1a8a1", "Currencies")}</p>
            </div>
          </div>
        </div>

        {/* Content - Zone scrollable avec flex-1 pour prendre l'espace restant */}
        <div className="flex-1 overflow-hidden px-4 md:px-5 py-4 flex flex-col gap-4 min-h-0">

          {/* Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2 flex-wrap">
              <button
              onClick={() => setSortBy("balance")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              sortBy === "balance" ?
              "bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green border border-xcannes-green/30" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_sort_by_balance_17aed9021c", "Sort by Balance")}


            </button>
              <button
              onClick={() => setSortBy("name")}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
              sortBy === "name" ?
              "bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green border border-xcannes-green/30" :
              "bg-white/5 text-white/60 hover:bg-white/10"}`
              }>{t("ui_sort_by_name_2590e44f12", "Sort by Name")}


            </button>
            </div>
          </div>

          {/* Assets Table */}
          <div className="bg-black/40 rounded-lg border border-white/10 overflow-hidden flex flex-col min-h-0">
            <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto md:max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/40 backdrop-blur-sm z-10">
                  <tr className="border-b border-white/10">
                    <th className="text-left px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">{t("ui_asset_e3ae76ddf7", "Asset")}</th>
                    <th className="text-left px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">{t("ui_type_c5068d5570", "Type")}</th>
                    <th className="text-right px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">{t("ui_balance_0ad2d5b8eb", "Balance")}</th>
                    <th className="text-right px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60 hidden md:table-cell">{t("ui_usd_value_6925fe3f7e", "≈ USD Value")}</th>
                    <th className="text-center px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">{t("ui_action_96db311a48", "Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTokens.map((token, idx) => {
                  const badge = getCategoryBadge(token);
                  const usdValue = getUsdValue(token);

                  return (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-3 md:px-4 py-2.5 md:py-3">
                          <div className="flex items-center gap-2">
                            {['XRP', 'RLUSD', 'XCS'].includes(token.currency) ?
                          <Image
                            src={`/symbols/${token.currency.toLowerCase()}.png`}
                            alt={token.currency}
                            width={24}
                            height={24}
                            className="flex-shrink-0 w-6 h-6 rounded-md" /> :


                          <span className="text-lg sm:text-2xl flex-shrink-0">{getCurrencyFlag(token.currency)}</span>
                          }
                            <div className="min-w-0">
                              <p className="text-white font-medium text-xs sm:text-sm truncate">{token.currency}</p>
                              <p className="text-[9px] sm:text-xs text-white/40 truncate">
                                {token.currency === "XRP" ?
                                  t("ui_label_native_2d7a1c9b4e", "Native") :
                                  token.issuer?.slice(0, 8) + "..."}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-xs font-medium whitespace-nowrap
                            ${badge.color === "blue" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : ""}
                            ${badge.color === "green" ? "bg-green-500/20 text-green-300 border border-green-500/30" : ""}
                            ${badge.color === "purple" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : ""}
                            ${badge.color === "orange" ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : ""}
                            ${badge.color === "gray" ? "bg-white/10 text-white/60 border border-white/20" : ""}
                          `}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-white font-medium text-[10px] sm:text-sm">
                          <div className="truncate">{formatAmount(token.value)}</div>
                          <div className="text-[9px] sm:text-xs text-white/50">{token.currency}</div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-white/70 text-[10px] sm:text-sm hidden sm:table-cell">
                          {Number.isFinite(usdValue) ?
                        `$${formatAmount(usdValue)}` :
                        "--"}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          <button
                          onClick={() => onViewCurrency && onViewCurrency(token)}
                          className="px-2 sm:px-3 py-1 bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green rounded text-[9px] sm:text-xs font-medium transition-colors border border-xcannes-green/30 whitespace-nowrap">

                            <span className="hidden sm:inline">
                              {t("view_statement", "View Statement")}
                            </span>
                            <span className="sm:hidden">{t("view", "View")}</span>
                          </button>
                        </td>
                      </tr>);

                })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Watermark */}
          <div className="hidden sm:block text-center py-3 sm:py-4">
            <div className="space-y-1">
              <p className="text-[9px] sm:text-xs text-white/20 font-mono px-2">{t("ui_generated_on_3827d9035f", "Generated on")}
              {new Date().toLocaleString(locale)}
              </p>
              <p className="text-[9px] sm:text-xs text-white/20 font-mono px-2">{ledgerStatusLabel}</p>
              {ledgerLastIndex != null ?
            <p className="text-[9px] sm:text-xs text-white/20 font-mono px-2">
                  {t("ui_ledger_index_label_0c2a1d9b5e", "Ledger index:")}{" "}
                  {ledgerLastIndex}
                </p> :
            null}
              <p className="text-[9px] sm:text-xs text-white/10 font-mono px-2 break-all">
                {t("ui_document_hash_label_9b5c1a2d7e", "Document hash:")}{" "}
                {docHash || "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-white/10 px-3 sm:px-6 py-3 sm:py-4 bg-black/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex gap-2 flex-wrap">
            <button
            onClick={handleExportPdf}
            disabled={exportFormat === "pdf"}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/15 text-white/70 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border border-white/15 disabled:opacity-50">

              {exportFormat === "pdf" ?
              t("ui_loading_1386baebe9", "Loading…") :
              t("ui_export_pdf_9c8d16b4fe", "📄 Export PDF")}


          </button>
            <button
            onClick={handleExportCsv}
            disabled={exportFormat === "csv"}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/15 text-white/70 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border border-white/15 disabled:opacity-50">

              {exportFormat === "csv" ?
              t("ui_loading_1386baebe9", "Loading…") :
              t("ui_export_csv_2f8a1b9d5e", "Export CSV")}


          </button>
            <button
            onClick={handlePrint}
            className="hidden md:inline-flex md:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/15 text-white/70 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border border-white/15">{t("ui_print_eb5de3a228", "🖨️ Print")}


          </button>
          </div>
        </div>
      </div>
    </div>;


  if (inline) {
    return content;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(content, document.body);
}
