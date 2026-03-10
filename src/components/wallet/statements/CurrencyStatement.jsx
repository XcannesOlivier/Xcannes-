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
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { escapeHtml, openPrintWindow } from "@/utils/statementExport";
import { useTranslation } from "next-i18next";
import StatementMonthSelect from "./StatementMonthSelect";
import {
  formatAmountWithSymbol,
  getDisplayCurrencyCode,
  USD_STABLECOINS,
} from "../walletDashboardConfig";
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

/**
 * Composant de relevé bancaire pour une devise spécifique.
 * Refactorisé : la logique data / formatters / walletLabel / docHash
 * est déléguée à des hooks dédiés.
 */
export default function CurrencyStatement({
  currency,
  balance,
  issuer: _issuer,
  walletAddress,
  walletLabelOverride = "",
  isPreviewMode = false,
  isWalletActivated = null,
  noticeVariant = "preview",
  transactions = [],
  hasMore = false,
  loadingMore = false,
  onLoadMore,
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
  const [isMobileDate, setIsMobileDate] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [highlightedTransactionId, setHighlightedTransactionId] =
    useState(null);
  const highlightRowRef = useRef(null);
  const highlightTimerRef = useRef(null);
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
  });

  /* ── destructure data hook ─────────────────────────────── */
  const {
    availableMonths,
    visibleGroups,
    showMonthHeaders,
    transactionsWithDisplayBalance,
  } = data;

  const currentPeriod = data.currentPeriod || fallbackPeriod;

  /* ── destructure formatters hook ───────────────────────── */
  const {
    enrichDescription,
    simplifyMobileDescription,
    getLocalizedDescription,
    renderConversionDescription,
    formatDate,
    formatAmountLocal: formatAmountWithSymbolLocal,
    formatUsd: formatUsdWithSymbol,
    getTransactionIcon,
  } = fmt;

  // Format a RLUSD amount as local-currency units.
  // Transaction amounts from the backend are in RLUSD; divide by rate
  // to get the local value (EUR, GBP…) that fluctuates with the FX rate.
  // balance (header) is already in local units so use formatAmountWithSymbolLocal directly.
  const formatAmountRlusdAsLocal = useCallback(
    (rlusdAmount) => formatAmountWithSymbolLocal(rlusdToLocal(rlusdAmount)),
    [formatAmountWithSymbolLocal, rlusdToLocal],
  );

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

  /* ── XRP reserve ───────────────────────────────────────── */
  const showReserveDetails = isPreviewMode || isWalletActivated === true;
  const reservePlaceholder = "\u2014";

  const xrpReserveDetails = useMemo(() => {
    if (normalizedCurrency !== "XRP" || !showReserveDetails) return null;
    const activationXrp = 1;
    const trustlineReserveXrp = 0.2;
    const trustlineRlusdXrp = hasRlusdTrustline ? trustlineReserveXrp : 0;
    return {
      totalReserveXrp: activationXrp + trustlineRlusdXrp,
      activationXrp,
      trustlineRlusdXrp,
    };
  }, [hasRlusdTrustline, normalizedCurrency, showReserveDetails]);

  /* ── ledger status ─────────────────────────────────────── */
  const ledgerEvidenceCount = useMemo(
    () => (transactions || []).filter((tok) => tok?.txHash).length,
    [transactions],
  );

  const ledgerLastIndex = useMemo(() => {
    const indexes = (transactions || [])
      .map((tok) => Number(tok?.ledgerIndex))
      .filter((v) => Number.isFinite(v));
    return indexes.length ? Math.max(...indexes) : null;
  }, [transactions]);

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
          tx?.category === "exchange" && tx?.spreadRlusd > 0
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
    rlusdToLocal,
    transactionsWithDisplayBalance,
    formatDate,
    ledgerLastIndex,
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
  }, [buildPrintHtml, docHash, normalizedCurrency, t]);

  const handlePrint = useCallback(() => {
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
  }, [buildPrintHtml, docHash, normalizedCurrency, t]);

  /* ── layout ────────────────────────────────────────────── */
  const resolvedLayout =
    STATEMENT_LAYOUTS[variant] || STATEMENT_LAYOUTS.full;
  const wrapperBaseClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10200] flex";
  const modalBgClass =
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated";

  /* ── render ────────────────────────────────────────────── */
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
        if (e.target === e.currentTarget) onClose?.();
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
                  {noticeVariant === "demo" ? (
                    <span className="inline-flex items-center text-white/70 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                      {t("demo_notice_title", "Mode démo")}
                    </span>
                  ) : null}

                </div>
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
              <p className="text-xs text-white/50 mb-1">
                {t("ui_balance_445d830d72", "Balance")}
              </p>
              <p className="text-sm text-white font-semibold">
                {formatAmountWithSymbolLocal(balance)}
              </p>
              {estimatedUsd != null && Number.isFinite(estimatedUsd) ? (
                <p className="text-[11px] text-white/50">
                  ≈ {formatUsdWithSymbol(estimatedUsd)}
                </p>
              ) : null}

              {normalizedCurrency === "XRP" && (
                <div className="mt-2 relative">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-white/50 whitespace-pre-line">
                        {t("ui_reserve_2d584ec9c7", "Reserve")}
                      </p>
                      <p className="text-[11px] text-white/70 font-mono">
                        {xrpReserveDetails
                          ? `${xrpReserveDetails.totalReserveXrp.toFixed(2)}${t("ui_xrp_034964b994", "XRP")}`
                          : reservePlaceholder}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReserveOpen((v) => !v)}
                      disabled={!xrpReserveDetails}
                      className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[11px] text-white/70 transition-colors disabled:opacity-40 disabled:hover:bg-white/5 disabled:cursor-not-allowed"
                      aria-expanded={reserveOpen}
                      aria-disabled={!xrpReserveDetails}
                      aria-label={t(
                        "ui_reserve_breakdown_de2c3de53e",
                        "Reserve breakdown",
                      )}
                    >
                      {t("ui_details_e9615e470d", "Details")}
                    </button>
                  </div>

                  {reserveOpen && (
                    <div className="mt-2 rounded-lg bg-black/60 p-3 space-y-2">
                      <div className="text-[11px] text-white/70">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            {t(
                              "ui_activation_wallet_1dcd314549",
                              "Activation wallet",
                            )}
                          </span>
                          <span className="font-mono">
                            {xrpReserveDetails.activationXrp.toFixed(2)}{" "}
                            {t("ui_xrp_034964b994", "XRP")}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span>
                            {t(
                              "ui_trustline_rlusd_9c077313dc",
                              "Trustline RLUSD",
                            )}{" "}
                            {hasRlusdTrustline
                              ? t(
                                  "ui_status_active_short_4c8b1a7d2e",
                                  "(active)",
                                )
                              : t(
                                  "ui_status_to_activate_short_7a1c4d9b2e",
                                  "(to activate)",
                                )}
                          </span>
                          <span className="font-mono">
                            {xrpReserveDetails.trustlineRlusdXrp.toFixed(2)}{" "}
                            {t("ui_xrp_034964b994", "XRP")}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content - Zone scrollable */}
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
                                          const feeSuffix =
                                            tx.category === "exchange" &&
                                            tx.spreadRlusd > 0 ? (
                                              <span className="text-[8px] md:text-xs text-white/35 ml-0.5 md:ml-1 whitespace-nowrap">
                                                ({t(
                                                  "statement_conversion_fee_label",
                                                  "Frais",
                                                )}{" : "}{formatAmountRlusdAsLocal(
                                                  tx.spreadRlusd,
                                                )})
                                              </span>
                                            ) : null;
                                          return tx.category === "exchange"
                                            ? renderConversionDescription(
                                                localizedDescription,
                                                {
                                                  withLabel: !isMobileDate,
                                                  feeSuffix,
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
                                            : isMobileDate
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
                                  {formatAmountRlusdAsLocal(tx.amount)}
                                </td>
                                <td className="px-3 md:px-4 py-2.5 md:py-3 text-right font-mono text-white/90 text-sm hidden md:table-cell">
                                  {formatAmountRlusdAsLocal(
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

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
