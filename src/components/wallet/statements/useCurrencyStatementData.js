import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import {
  STATEMENT_HISTORY_MONTHS,
  buildDefaultMonthKeys,
  formatMonthLabel,
  getMonthKeyFromTransaction,
} from "./statementShared";

/**
 * useCurrencyStatementData
 * ------------------------
 * Handles month selection, transaction filtering, statistics,
 * and displayBalance augmentation for CurrencyStatement.
 */
export default function useCurrencyStatementData({
  transactions = [],
  statementMonths = [],
  balance,
  normalizedCurrency,
  filter,
  selectedMonth,
  setSelectedMonth,
  locale,
}) {
  const { t } = useTranslation("common");
  const archivesLabel = t("ui_archives_label_3c1f8a7b2e", "Archives");
  const archivesLongLabel = t(
    "ui_archives_12plus_7b3c9a1d5e",
    "Archives (12+ months)",
  );

  /* ── base transactions ─────────────────────────────────── */
  const baseTransactions = useMemo(
    () => (Array.isArray(transactions) ? transactions : []),
    [transactions],
  );

  /* ── month keys ────────────────────────────────────────── */
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

  /* ── available months for selector ─────────────────────── */
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

  /* ── clamp selectedMonth when availableMonths change ───── */
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
  }, [availableMonths, selectedMonth, setSelectedMonth]);

  /* ── selected month key(s) ─────────────────────────────── */
  const selectedMonthKey = useMemo(() => {
    if (selectedMonth === "archives") return null;
    const option = availableMonths.find(
      (item) =>
        typeof item?.value === "number" &&
        Number(item.value) === Number(selectedMonth),
    );
    return option?.key || null;
  }, [availableMonths, selectedMonth]);

  const selectedMonthKeys = useMemo(() => {
    if (selectedMonth === "archives") {
      return statementMonthKeys.slice(12);
    }
    return selectedMonthKey ? [selectedMonthKey] : [];
  }, [selectedMonth, selectedMonthKey, statementMonthKeys]);

  /* ── period transactions (for the selected month) ──────── */
  const periodTransactions = useMemo(() => {
    if (!selectedMonthKeys.length) return [];
    const keySet = new Set(selectedMonthKeys);
    return baseTransactions.filter((tx) => {
      const key = getMonthKeyFromTransaction(tx);
      return key && keySet.has(key);
    });
  }, [baseTransactions, selectedMonthKeys]);

  /* ── statistics ─────────────────────────────────────────── */
  const credits = periodTransactions.filter((tok) => tok.type === "credit");
  const debits = periodTransactions.filter((tok) => tok.type === "debit");

  const totalCredits = credits.reduce(
    (sum, tok) => sum + parseFloat(tok.amount || 0),
    0,
  );
  const totalDebits = debits.reduce(
    (sum, tok) => sum + parseFloat(tok.amount || 0),
    0,
  );

  const openingBalance = balance - totalCredits + totalDebits;
  const closingBalance = balance;

  const avgTransaction =
    periodTransactions.length > 0
      ? (totalCredits + totalDebits) / periodTransactions.length
      : 0;

  const largestTransaction = periodTransactions.reduce((max, tok) => {
    const amount = parseFloat(tok.amount || 0);
    return amount > max ? amount : max;
  }, 0);

  const transactionsByCategory = periodTransactions.reduce((acc, tx) => {
    const cat = tx.category || "other";
    if (!acc[cat]) acc[cat] = { count: 0, amount: 0 };
    acc[cat].count++;
    acc[cat].amount += parseFloat(tx.amount || 0);
    return acc;
  }, {});

  /* ── filtered transactions ─────────────────────────────── */
  const filteredTransactions = useMemo(() => {
    return periodTransactions.filter((tok) => {
      if (filter === "credit") return tok.type === "credit";
      if (filter === "debit") return tok.type === "debit";
      if (filter === "conversion") return tok.category === "exchange";
      return true;
    });
  }, [periodTransactions, filter]);

  /* ── transactions augmented with running display balance ── */
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

  /* ── transactions grouped by month ─────────────────────── */
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

  /* ── visible groups based on selection ──────────────────── */
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

  /* ── adjustment info ────────────────────────────────────── */
  const adjustmentInfo = useMemo(() => {
    let required = false;
    let deficit = null;
    for (const tx of transactions || []) {
      if (!tx?.adjustmentRequired) continue;
      required = true;
      const value = Number(tx?.adjustmentDeficitRlusd);
      if (Number.isFinite(value)) {
        deficit = Math.max(deficit ?? 0, value);
      }
    }
    return { required, deficit };
  }, [transactions]);

  /* ── current period label ───────────────────────────────── */
  const currentPeriod =
    selectedMonth === "archives"
      ? archivesLabel
      : availableMonths.find((option) => option.value === selectedMonth)
          ?.label || null;
  const currentDisplayPeriod =
    selectedMonth === "archives"
      ? archivesLabel
      : availableMonths.find((option) => option.value === selectedMonth)
          ?.displayLabel || null;

  return {
    baseTransactions,
    statementMonthKeys,
    availableMonths,
    selectedMonthKey,
    selectedMonthKeys,
    periodTransactions,
    credits,
    debits,
    totalCredits,
    totalDebits,
    openingBalance,
    closingBalance,
    avgTransaction,
    largestTransaction,
    transactionsByCategory,
    filteredTransactions,
    transactionsWithDisplayBalance,
    transactionsByMonth,
    visibleGroups,
    showMonthHeaders,
    adjustmentInfo,
    currentPeriod,
    currentDisplayPeriod,
  };
}
