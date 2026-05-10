"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const STATEMENT_LAYOUTS = {
    full: {
      backdropClass: "bg-black/80",
      wrapperClass: "items-stretch justify-center px-0",
      panelClass:
        "w-full h-[100dvh] max-h-[100dvh] rounded-none border-0",
    },
    "dex-desktop": {
      backdropClass: "bg-black/75",
      wrapperClass: "items-center justify-center px-3",
      panelClass:
        "max-w-4xl rounded-2xl max-h-[90vh]",
    },
    "dex-mobile": {
      backdropClass: "bg-black/90",
      wrapperClass: "items-stretch justify-center px-0",
      panelClass: "w-full h-[100dvh] max-h-[100dvh] rounded-none border-0",
    },
    default: {
      backdropClass: "bg-black/80",
      wrapperClass: "items-center justify-center px-4",
      panelClass:
        "max-w-5xl rounded-2xl max-h-[92vh]",
    },
    "inline-desktop": {
      backdropClass: "",
      wrapperClass: "items-stretch justify-stretch p-0",
      panelClass: "w-full h-full rounded-xl border-l border-white/10",
    },
  };

  const resolvedLayout = inline
    ? STATEMENT_LAYOUTS[variant] || STATEMENT_LAYOUTS["inline-desktop"]
    : STATEMENT_LAYOUTS["dex-mobile"];
  const wrapperBaseClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10200] flex";

  const modalBgClass =
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated";
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
        {/* Header */}
        <div
          className="relative flex-shrink-0 bg-[#111518] shadow-[inset_0_16px_28px_rgba(255,255,255,0.03),inset_0_-46px_70px_rgba(0,0,0,0.55)] px-4 py-4 before:content-[''] before:absolute before:left-0 before:right-0 before:bottom-0 before:h-px before:bg-white/10"
        >
          <div className="flex justify-center -mt-1 pt-1 pb-2" aria-hidden>
            <span className="block w-12 h-1.5 rounded-full bg-white/20" />
          </div>
          <div className="flex justify-center">
            <div className="min-w-0 flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center flex-wrap">
                <h2 className="text-[30px] font-bold text-white/95 tracking-tight leading-tight text-center">
                  {t(
                    "ui_global_statement_13e29aa8aa",
                    "Historique de vos dernières transactions",
                  )}
                </h2>
                {noticeVariant === "demo" ? (
                  <span className="ml-2 inline-flex items-center text-white/80 text-sm font-semibold px-2 py-0.5 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[14px] text-white/60 max-w-[52ch] leading-relaxed">
                {t(
                  "ui_global_statement_subtitle_recent_20",
                  "Consultez vos transactions récentes et ouvrez-en une pour voir les détails.",
                )}
              </p>
              <div className="mt-3 flex flex-col items-center gap-1 min-w-0">
                <span className="text-sm text-white font-semibold">
                  {walletLabel || t("nav_wallet", "Wallet")}
                </span>
                {walletAddress ? (
                  <span className="text-xs text-white/60 font-mono break-all">
                    {walletAddress}
                  </span>
                ) : null}
              </div>
            </div>
            {/* close via swipe/backdrop */}
          </div>

          <div className="mt-4 rounded-[14px] p-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
            <div className="text-xs text-white/60">
              {t("ui_total_assets_label_fr", "Total des actifs")}
            </div>
            <div className="mt-1 text-3xl font-semibold text-white/95">
              ≈ {formatAmountWithSymbol(locale, totalBalance, "USD")}
            </div>
            <div className="mt-1 text-xs text-white/50">
              {sortedTokens.length} {t("ui_currencies_wallet_lines_f4", "devises")}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {/* Controls */}
          <div className="grid grid-cols-1 gap-3 items-end">
            <div>
              <div className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                {t("ui_statement_period_4674b18f25", "Période")}
              </div>
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
              <div className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                {t("ui_sort_label", "Tri")}
              </div>
              <div className="inline-flex rounded-[10px] ring-1 ring-white/10 ring-inset bg-white/5 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <button
                  type="button"
                  onClick={() => setSortBy("balance")}
                  className={[
                    "px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors duration-150",
                    sortBy === "balance"
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white/80 hover:bg-white/5",
                  ].join(" ")}
                >
                  {t("ui_sort_balance_short", "Balance")}
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("name")}
                  className={[
                    "px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors duration-150",
                    sortBy === "name"
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white/80 hover:bg-white/5",
                  ].join(" ")}
                >
                  {t("ui_sort_name_short", "Nom")}
                </button>
              </div>
            </div>
          </div>

          {/* Asset list */}
          <div className="space-y-2">
            {sortedTokens.map((token, idx) => {
              const usdValue = getUsdValue(token);
              const tokenCode = getDisplayCurrencyCode(token.currency);
              const showConverted =
                Number.isFinite(usdValue) &&
                String(tokenCode || "").toUpperCase() !== "USD";

              return (
                <button
                  key={`${token.currency}-${idx}`}
                  type="button"
                  onClick={() => onViewCurrency?.(token)}
                  disabled={!onViewCurrency}
                  className="w-full text-left rounded-xl px-3 py-3 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-14px_22px_rgba(0,0,0,0.5)] hover:from-white/[0.10] hover:to-white/[0.04] transition-colors duration-150 disabled:opacity-70 disabled:cursor-default"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {["RLUSD", "USD"].includes(
                        String(token.currency || "").toUpperCase(),
                      ) ? (
                        <Image
                          src={`/symbols/${String(token.currency || "").toLowerCase()}.png`}
                          alt={tokenCode}
                          width={28}
                          height={28}
                          className="flex-shrink-0 w-7 h-7 rounded-md"
                        />
                      ) : (
                        <span className="text-2xl flex-shrink-0">
                          {getCurrencyFlag(tokenCode)}
                        </span>
                      )}

                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-white/90 truncate">
                          {tokenCode}
                        </div>
                        {token.issuer ? (
                          <div className="text-[11px] text-white/45 truncate mt-0.5 font-mono">
                            {`${token.issuer.slice(0, 6)}...${token.issuer.slice(-4)}`}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-[15px] font-semibold text-white/90 font-mono">
                          {formatAmountWithSymbol(
                            locale,
                            token.value,
                            token.currency,
                            { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                          )}
                        </div>
                        {showConverted ? (
                          <div className="text-[11px] text-white/45 font-mono mt-0.5">
                            ≈ {formatAmountWithSymbol(locale, usdValue, "USD")}
                          </div>
                        ) : null}
                      </div>

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

          {/* Watermark */}
          <div className="hidden">
            <div className="space-y-1">
              {ledgerLastIndex != null ? (
                <p className="text-[9px] text-white/30 font-mono px-2">
                  {t("ui_ledger_index_label_0c2a1d9b5e", "Ledger index:")}{" "}
                  {ledgerLastIndex}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="relative px-4 py-3 pb-2 flex flex-row items-stretch gap-2 bg-[#111518] shadow-[inset_0_-16px_28px_rgba(255,255,255,0.03),inset_0_46px_70px_rgba(0,0,0,0.55)] before:content-[''] before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-white/10">
          <div className="flex flex-1 items-center rounded-[16px] p-1 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-[#101415] to-[#0d1214] justify-end">
            <button
              onClick={handleExportPdf}
              disabled={exportFormat === "pdf"}
              className="shrink-0 px-2 py-2 text-white/60 hover:text-white transition-colors disabled:opacity-40"
              aria-label={t("ui_export_pdf_9c8d16b4fe", "Télécharger")}
            >
              <ShareIcon
                className={`w-5 h-5 ${exportFormat === "pdf" ? "opacity-40" : ""}`}
              />
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
