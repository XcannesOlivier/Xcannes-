import { useCallback } from "react";
import Image from "next/image";
import { useTranslation } from "next-i18next";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import {
  formatAmountWithSymbol,
  getDisplayCurrencyCode,
} from "../walletDashboardConfig";
import { getCurrencyFlag, isSvgIcon } from "./statementShared";

/**
 * useCurrencyStatementFormatters
 * ------------------------------
 * All formatting / rendering callbacks used exclusively by
 * CurrencyStatement.  Keeps the component file lean.
 */
export default function useCurrencyStatementFormatters({
  locale,
  displayCurrency,
  isMobileDate,
  isPreviewMode,
  compactLabels = false,
}) {
  const { t } = useTranslation("common");

  /* ─── enrichDescription ─────────────────────────────────── */
  const enrichDescription = useCallback((description) => {
    if (!description) return description;
    let enriched = description;
    const currencyPattern = /\b([A-Z]{3,6})\b/g;
    enriched = enriched.replace(currencyPattern, (match) => {
      const flag = getCurrencyFlag(match);
      return `${flag} ${match}`;
    });
    return enriched;
  }, []);

  /* ─── simplifyMobileDescription ─────────────────────────── */
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

  /* ─── parseConversionPair ───────────────────────────────── */
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

  /* ─── getLocalizedDescription ───────────────────────────── */
  const getLocalizedDescription = useCallback(
    (tx) => {
      const kind = String(tx?.kind || "")
        .trim()
        .toUpperCase();
      const rawCounterparty = tx?.counterparty
        ? String(tx.counterparty).trim()
        : "";
      const counterparty =
        rawCounterparty && rawCounterparty.toUpperCase() !== "XCANNES"
          ? rawCounterparty
          : "";
      const category = String(tx?.category || "")
        .trim()
        .toLowerCase();

      if (kind === "PAYMENT_OUT") {
        if (compactLabels) {
          return t("statement_xrpl_mobile_out", "Sent");
        }
        return counterparty
          ? t("statement_payment_out_to", "Envoyé à {{counterparty}}", {
              counterparty,
            })
          : t("statement_payment_out_generic", "Paiement envoyé");
      }
      if (kind === "PAYMENT_IN") {
        if (compactLabels) {
          return t("statement_xrpl_mobile_in", "Received");
        }
        return counterparty
          ? t("statement_payment_in_from", "Reçu de {{counterparty}}", {
              counterparty,
            })
          : t("statement_payment_in_generic", "Paiement reçu");
      }
      if (kind === "XRPL_PAYMENT_OUT") {
        return compactLabels
          ? t("statement_xrpl_mobile_out", "Sent")
          : t("statement_xrpl_payment_out", "Paiement envoyé");
      }
      if (kind === "XRPL_PAYMENT_IN") {
        return compactLabels
          ? t("statement_xrpl_mobile_in", "Received")
          : t("statement_xrpl_payment_in", "Paiement reçu");
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
    [compactLabels, parseConversionPair, t],
  );

  /* ─── renderCurrencyBadge ───────────────────────────────── */
  const renderCurrencyBadge = useCallback((code) => {
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
        <span className="text-base md:text-lg">{getCurrencyFlag(display)}</span>
        <span className="text-white/80 text-xs md:text-sm">{display}</span>
      </span>
    );
  }, []);

  /* ─── renderConversionDescription ───────────────────────── */
  const renderConversionDescription = useCallback(
    (description, { withLabel = false, feeSuffix = null } = {}) => {
      const pair = parseConversionPair(description);
      if (!pair) return null;
      const badges = (
        <span className="inline-flex items-center gap-1">
          {renderCurrencyBadge(pair.from)}
          <span className="text-white/60 text-xs">→</span>
          {renderCurrencyBadge(pair.to)}
        </span>
      );
      if (!withLabel) return badges;
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="text-white/80 text-xs">
            {t("statement_conversion_label", "Conversion")}
          </span>
          {badges}
          {feeSuffix}
        </span>
      );
    },
    [parseConversionPair, renderCurrencyBadge, t],
  );

  /* ─── formatDate ────────────────────────────────────────── */
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

  /* ─── formatAmountWithSymbolLocal ───────────────────────── */
  const formatAmountLocal = useCallback(
    (amount) =>
      formatAmountWithSymbol(locale, amount, displayCurrency, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [displayCurrency, locale],
  );

  /* ─── formatUsdWithSymbol ───────────────────────────────── */
  const formatUsd = useCallback(
    (amount) =>
      formatAmountWithSymbol(locale, amount, "USD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );

  /* ─── getTransactionIcon ────────────────────────────────── */
  const getTransactionIcon = useCallback(
    (category) => {
      if (isPreviewMode && (category === "buy" || category === "sell"))
        return null;
      const icons = { buy: "+", sell: "−" };
      return icons[category] || null;
    },
    [isPreviewMode],
  );

  return {
    enrichDescription,
    simplifyMobileDescription,
    parseConversionPair,
    getLocalizedDescription,
    renderCurrencyBadge,
    renderConversionDescription,
    formatDate,
    formatAmountLocal,
    formatUsd,
    getTransactionIcon,
  };
}
