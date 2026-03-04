import { useState, useEffect, useMemo } from "react";
import {
  XCircleIcon,
  CheckCircleIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import { useTranslation } from "next-i18next";
import { useWallet } from "@/context/WalletContext";
import { useModalTransition } from "@/utils/useModalTransition";
import { formatAmountWithSymbol } from "../walletDashboardConfig";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const MOONPAY_ORIGIN_SUFFIX = ".moonpay.com";

const isTrustedMoonPayOrigin = (origin) => {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "moonpay.com" || host.endsWith(MOONPAY_ORIGIN_SUFFIX);
  } catch (_) {
    return false;
  }
};

/**
 * MoonPaySellModal - Modal pour vendre des cryptos contre fiat
 *
 * @param {boolean} isOpen - Modal ouverte ou fermée
 * @param {function} onClose - Callback de fermeture
 * @param {string} walletAddress - Adresse XRPL source
 * @param {boolean} embedded - Mode embedded (sans backdrop/header)
 */
const MoonPaySellModal = ({
  isOpen,
  onClose,
  walletAddress,
  walletLabel = "",
  hideWalletAddress = false,
  embedded = false,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  demoMode = false,
  onDemoSubmit,
  availableTokens,
  rlusdPerUnitRates,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
}) => {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const { signTransaction, isWalletActivated, balance } = useWallet();

  const hasRlusdTrustline = useMemo(() => {
    return (balance?.tokens || []).some(
      (token) => String(token?.currency || "").toUpperCase() === "RLUSD",
    );
  }, [balance]);
  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("form"); // 'form' | 'loading' | 'iframe' | 'success' | 'error'
  const displayError =
    error && /api\.sandbox\.moonpay\.com/i.test(error) ? null : error;

  // Options de vente (RLUSD par défaut)
  const [currency, setCurrency] = useState("RLUSD");
  const [amount, setAmount] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("USD"); // Fiat code
  const [fiatCurrencies, setFiatCurrencies] = useState([]);
  const [fiatLoading, setFiatLoading] = useState(false);
  const [fiatError, setFiatError] = useState(null);
  const resolveFiatErrorMessage = (data) => {
    if (!data) return "Failed to load fiat currencies";
    if (typeof data === "string") return data;
    if (typeof data?.error === "string") return data.error;
    if (data?.error?.message) return data.error.message;
    if (data?.message) return data.message;
    return "Failed to load fiat currencies";
  };

  const supportedCurrencies = useMemo(() => {
    const seen = new Set();
    const options = [];
    (availableTokens || []).forEach((token) => {
      const currencyRaw = token?.currency;
      const currency = String(currencyRaw || "").toUpperCase();
      if (!currency || currency === "RLUSD" || seen.has(currency)) return;
      seen.add(currency);
      const labelLeft =
        selectLabelByCurrency?.[currencyRaw] ||
        selectLabelByCurrency?.[currency] ||
        currency;
      const balanceLabel = t("ui_balance_label_4db9aa0c31", "Balance").replace(
        /:\s*$/,
        "",
      );
      const amountValue = Number(token?.value || 0);
      const amountLabel = Number.isFinite(amountValue)
        ? formatAmountWithSymbol(locale, amountValue, currency, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
          })
        : formatAmountWithSymbol(locale, 0, currency, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
          });
      const fallbackRight = `${balanceLabel} = ${amountLabel}`;
      let labelRight =
        selectLabelRightByCurrency?.[currencyRaw] ||
        selectLabelRightByCurrency?.[currency] ||
        fallbackRight;
      let labelMobile =
        selectLabelMobileByCurrency?.[currencyRaw] ||
        selectLabelMobileByCurrency?.[currency] ||
        labelLeft;
      options.push({
        code: currency,
        label: labelLeft,
        labelLeft,
        labelRight,
        labelMobile,
        icon:
          selectIconByCurrency?.[currencyRaw] ||
          selectIconByCurrency?.[currency] ||
          null,
      });
    });

    if (options.length > 0) return options;
    return [
      {
        code: "RLUSD",
        label: "USD Stablecoin",
        labelLeft: "USD Stablecoin",
        labelMobile: "USD Stablecoin",
      },
    ];
  }, [
    availableTokens,
    selectLabelByCurrency,
    selectLabelRightByCurrency,
    selectIconByCurrency,
    selectLabelMobileByCurrency,
    locale,
    t,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (!supportedCurrencies.length) return;
    setCurrency((prev) => {
      const current = String(prev || "").toUpperCase();
      if (supportedCurrencies.some((curr) => curr.code === current)) {
        return current;
      }
      return supportedCurrencies[0].code;
    });
  }, [isOpen, supportedCurrencies]);

  const selectedToken = useMemo(() => {
    const current = String(currency || "").toUpperCase();
    if (!current) return null;
    return (
      (availableTokens || []).find(
        (token) => String(token?.currency || "").toUpperCase() === current,
      ) || null
    );
  }, [availableTokens, currency]);

  const amountValue = Number.parseFloat(amount || "");
  const currencyUpper = String(currency || "").toUpperCase();
  const isCurrencyLine = Boolean(selectedToken?.isTrustlineOnly);
  const rlusdRate = isCurrencyLine
    ? currencyUpper === "RLUSD" || currencyUpper === "USD"
      ? 1
      : Number(rlusdPerUnitRates?.[currencyUpper])
    : Number.NaN;
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0;
  const conversionMissing =
    isCurrencyLine &&
    hasValidAmount &&
    (!Number.isFinite(rlusdRate) || rlusdRate <= 0);
  const rlusdEquivalent =
    isCurrencyLine && hasValidAmount && !conversionMissing
      ? amountValue * rlusdRate
      : null;
  const baseCurrencyCode = isCurrencyLine ? "RLUSD" : currencyUpper;
  const baseCurrencyAmount = isCurrencyLine
    ? Number.isFinite(rlusdEquivalent)
      ? Number(rlusdEquivalent.toFixed(6))
      : Number.NaN
    : hasValidAmount
      ? amountValue
      : Number.NaN;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const loadFiatCurrencies = async () => {
      setFiatLoading(true);
      setFiatError(null);
      try {
        const response = await fetch("/api/moonpay/fiat-currencies");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(resolveFiatErrorMessage(data));
        }
        const list = data?.currencies || data?.data || data || [];
        const normalized = Array.isArray(list)
          ? list
              .map((fiat) => ({
                ...fiat,
                code: String(fiat?.code || "").toUpperCase(),
              }))
              .filter((fiat) => fiat.code)
          : [];

        if (!active) return;
        setFiatCurrencies(normalized);
        setQuoteCurrency((prev) => {
          if (normalized.some((fiat) => fiat.code === prev)) {
            return prev;
          }
          const usd = normalized.find((fiat) => fiat.code === "USD");
          return usd?.code || normalized[0]?.code || "USD";
        });
      } catch (error) {
        if (!active) return;
        setFiatError(error?.message || "Failed to load fiat currencies");
        setFiatCurrencies([]);
      } finally {
        if (active) setFiatLoading(false);
      }
    };

    loadFiatCurrencies();

    return () => {
      active = false;
    };
  }, [isOpen]);

  const requestWalletSignature = async () => {
    if (!signTransaction) {
      setError(
        t(
          "moonpay_error_signature_required",
          "Wallet signature required. Please connect your wallet.",
        ),
      );
      return null;
    }

    const result = await signTransaction({ TransactionType: "SignIn" });
    if (!result?.signed) {
      setError(
        t(
          "moonpay_error_signature_cancelled",
          "Signature cancelled or expired.",
        ),
      );
      return null;
    }

    return result.uuid || result.hash || "wallet-auth";
  };

  // Générer l'URL MoonPay pour la vente
  const generateSellUrl = async () => {
    if (!walletAddress) {
      setError(
        t(
          "moonpay_error_wallet_required_5f2a1c9d3e",
          "Wallet address is required.",
        ),
      );
      return;
    }

    if (!hasValidAmount) {
      setError(
        t(
          "moonpay_error_invalid_amount_8c3b1a6d2f",
          "Please enter a valid amount.",
        ),
      );
      return;
    }
    if (conversionMissing) {
      setError(
        t(
          "ui_rate_unavailable_base_5c1a9b7d2e",
          "Rate unavailable for base currency.",
        ),
      );
      return;
    }
    if (!Number.isFinite(baseCurrencyAmount) || baseCurrencyAmount <= 0) {
      setError(
        t(
          "moonpay_error_invalid_amount_8c3b1a6d2f",
          "Please enter a valid amount.",
        ),
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (demoMode) {
        const res = await Promise.resolve(
          onDemoSubmit?.({
            currencyCode: String(baseCurrencyCode || "RLUSD").toUpperCase(),
            quoteCurrencyCode: String(quoteCurrency || "USD").toUpperCase(),
            amount: baseCurrencyAmount,
          }),
        );
        if (res?.error) {
          throw new Error(res.error);
        }
        setIframeUrl(null);
        setStep("success");
        setTimeout(() => {
          onClose?.();
        }, 1200);
        return;
      }

      const walletAuthToken = await requestWalletSignature();
      if (!walletAuthToken) return;

      setStep("loading");

      const response = await fetch("/api/moonpay/generate-sell-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          baseCurrencyCode, // Crypto à vendre
          quoteCurrencyCode: quoteCurrency, // Fiat à recevoir
          baseCurrencyAmount,
          walletAuthToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            t(
              "moonpay_error_generate_sell_url_9b2c7a1d5e",
              "Failed to generate sell URL.",
            ),
        );
      }

      if (data.success && data.url) {
        setIframeUrl(data.url);
        setStep("iframe");
      } else {
        throw new Error(
          t(
            "moonpay_error_invalid_response_6b2d8c1a9f",
            "Invalid response from server.",
          ),
        );
      }
    } catch (err) {
      console.error("Error generating sell URL:", err);
      setError(
        err.message ||
          t(
            "moonpay_error_load_widget_3c1a7d8b2e",
            "Failed to load MoonPay widget.",
          ),
      );
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  // Écouter les messages du widget MoonPay
  useEffect(() => {
    const handleMessage = (event) => {
      if (!isTrustedMoonPayOrigin(event.origin)) return;

      const { type, status } = event.data;
      if (DEBUG_LOGS) {
        console.log("MoonPay sell message received:", event.data);
      }

      if (type === "transaction_completed" || status === "completed") {
        setStep("success");
        setTimeout(() => {
          onClose();
        }, 3000);
      }

      if (type === "transaction_failed" || status === "failed") {
        setError(
          t(
            "moonpay_error_transaction_failed_9a2c1b7d5e",
            "Transaction failed. Please try again.",
          ),
        );
        setStep("error");
      }

      if (type === "close" || type === "widget_closed") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("message", handleMessage);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isOpen, onClose, t]);

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, quoteCurrency]);

  const continueLabel = loading
    ? t("moonpay_action_loading_7c2b1d9a3e", "Loading...")
    : demoMode
      ? t("moonpay_action_simulate_sell_4d1a9c7b2e", "Simulate sell")
      : t("moonpay_action_continue_sell_2c8a1d6b4f", "Continue to Sell");
  const continueDisabled =
    loading ||
    !hasValidAmount ||
    fiatCurrencies.length === 0 ||
    conversionMissing;
  const fiatPlaceholder = t("moonpay_fiat_currency_label", "Fiat currency");
  const fiatUnavailable = !fiatLoading && fiatCurrencies.length === 0;
  const showFiatError = fiatError && !fiatLoading;
  const fiatOptions = fiatCurrencies.map((fiat) => ({
    value: fiat.code,
    label: `${fiat.name || fiat.code} (${fiat.code})`,
  }));
  const fiatSelectValue = fiatCurrencies.length === 0 ? "" : quoteCurrency;

  const shouldAnimate = !embedded;
  const { shouldRender, isClosing } = useModalTransition(isOpen, {
    enabled: shouldAnimate,
  });

  if (embedded) {
    if (!isOpen) return null;
  } else if (!shouldRender) {
    return null;
  }

  // Mode embedded: retourner seulement le contenu
  const renderContent = () => (
    <div className={embedded ? "" : "p-4 md:p-5"}>
      {/* Form */}
      {step === "form" && (
        <div className="space-y-4">
          {/* Currency selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t(
                "moonpay_select_crypto_to_sell",
                "Select cryptocurrency to sell",
              )}
            </label>
            <ModalSelect
              value={currency}
              onChange={setCurrency}
              options={supportedCurrencies.map((curr) => ({
                value: curr.code,
                label: curr.label || curr.name || curr.code,
                labelLeft:
                  curr.labelLeft || curr.label || curr.name || curr.code,
                labelRight: curr.labelRight || null,
                labelMobile:
                  curr.labelMobile ||
                  curr.labelLeft ||
                  curr.label ||
                  curr.name ||
                  curr.code,
                icon: curr.icon || null,
              }))}
              useNativeSelect={false}
              showMobileOptionRight={true}
              buttonClassName="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-xcannes-green focus:outline-none cursor-pointer"
              menuClassName={
                noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated"
              }
              selectClassName="xcannes-select w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none"
            />
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t("moonpay_amount_to_sell", "Amount to sell")}
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none pr-16"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                {currency}
              </span>
            </div>
            {isCurrencyLine && hasValidAmount && (
              <p
                className={`mt-1 text-xs ${
                  conversionMissing ? "text-red-400" : "text-white/50"
                }`}
              >
                {conversionMissing
                  ? t(
                      "ui_rate_unavailable_base_5c1a9b7d2e",
                      "Rate unavailable for base currency.",
                    )
                  : `≈ ${formatAmountWithSymbol(
                      locale,
                      Number(rlusdEquivalent || 0),
                      "USD",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}`}
              </p>
            )}
          </div>

          {/* Arrow down */}
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <ArrowDownIcon className="w-5 h-5 text-xcannes-green" />
            </div>
          </div>

          {/* Fiat currency selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t("moonpay_receive_in", "Receive in")}
            </label>
            <ModalSelect
              value={fiatSelectValue}
              onChange={setQuoteCurrency}
              options={fiatOptions}
              placeholder={fiatPlaceholder}
              disabled={fiatLoading || fiatCurrencies.length === 0}
              buttonClassName="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-xcannes-green focus:outline-none cursor-pointer disabled:opacity-60"
              menuClassName={
                noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated"
              }
              selectClassName="xcannes-select w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none disabled:opacity-60"
            />
            {showFiatError && (
              <p className="text-xs text-red-400 mt-1">{fiatError}</p>
            )}
            {!fiatLoading && !fiatError && fiatUnavailable && (
              <p className="text-xs text-white/50 mt-1">
                {t("moonpay_fiat_unavailable", "Fiat currencies unavailable")}
              </p>
            )}
          </div>

          {/* Wallet address display */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-3">
            <p className="text-xs text-white/60 mb-1">
              {t("moonpay_from_wallet", "From wallet")}
            </p>
            {hideWalletAddress && String(walletLabel || "").trim() ? (
              <p className="text-lg text-white/90 font-semibold truncate">
                {walletLabel}
              </p>
            ) : (
              <p className="text-lg text-white/90 font-mono break-all">
                {walletAddress}
              </p>
            )}
          </div>

          {/* Error message */}
          {displayError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{displayError}</p>
            </div>
          )}

          {/* Info box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-blue-400">
              {demoMode
                ? `💰 ${t(
                    "moonpay_info_sell_demo_6d1a9c2b7e",
                    "Demo mode: the sell is simulated (no bank transfer).",
                  )}`
                : `💰 ${t(
                    "moonpay_info_sell_live_8b2c1a7d5f",
                    "Funds will be transferred to your bank account. MoonPay supports SEPA, wire transfer, and instant bank transfer in supported countries.",
                  )}`}{" "}
              {t(
                "moonpay_minimum_note",
                "Minimums depend on MoonPay (currency, country, payment method).",
              )}
            </p>
          </div>

          {/* Continue button */}
          <SwipeConfirmButton
            label={continueLabel}
            onConfirm={generateSellUrl}
            disabled={continueDisabled}
            variant="xcannesGreen"
            className="md:hidden"
          />
          <button
            type="button"
            onClick={generateSellUrl}
            disabled={continueDisabled}
            className="hidden md:block w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200 border bg-xcannes-green/20 text-xcannes-green border-xcannes-green/40 hover:bg-xcannes-green/30 hover:scale-[1.02] disabled:bg-[#10B981]/10 disabled:text-[#10B981]/60 disabled:border-[#10B981]/25 disabled:hover:scale-100"
          >
            {continueLabel}
          </button>
        </div>
      )}

      {/* Loading */}
      {step === "loading" && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-white/80">
            {t("moonpay_loading_widget", "Loading MoonPay widget...")}
          </p>
        </div>
      )}

      {/* MoonPay iframe */}
      {step === "iframe" && iframeUrl && (
        <div className="relative" style={{ height: "600px" }}>
          <iframe
            src={iframeUrl}
            className="w-full h-full rounded-lg"
            allow="payment"
            title={t("moonpay_widget_title_sell", "MoonPay Sell Widget")}
          />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 bg-black/80 text-white/80 hover:text-white px-3 py-1 rounded-lg text-sm transition-colors"
          >
            {t("close", "Close")}
          </button>
        </div>
      )}

      {/* Success */}
      {step === "success" && (
        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircleIcon className="w-16 h-16 text-green-400 mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">
            {t("moonpay_sell_success_title", "Sale Completed!")}
          </h4>
          <p className="text-white/60 text-center mb-4">
            {t(
              "moonpay_sell_success_body",
              "Your funds will be transferred to your bank account.",
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all"
          >
            {t("close", "Close")}
          </button>
        </div>
      )}

      {/* Error */}
      {step === "error" && (
        <div className="flex flex-col items-center justify-center py-12">
          <XCircleIcon className="w-16 h-16 text-red-400 mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">
            {t("moonpay_error_title", "Something went wrong")}
          </h4>
          <p className="text-white/60 text-center mb-4">
            {displayError ||
              t(
                "moonpay_error_try_again_later_6f2b1c9d8a",
                "Please try again later.",
              )}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setError(null);
                setIframeUrl(null);
              }}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
            >
              {t("try_again", "Try Again")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all"
            >
              {t("close", "Close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Mode embedded: retourner seulement le contenu
  if (embedded) {
    return renderContent();
  }

  // Mode standalone: retourner le modal complet
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
          isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
        }`}
        onClick={step === "iframe" ? null : onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className={`relative w-full wallet-modal-panel max-w-2xl border rounded-2xl overflow-hidden pointer-events-auto shadow-2xl ${
            noticeVariant === "demo"
              ? "bg-[#0b0f10] border-white/10"
              : "bg-elevated border-subtle"
          } ${isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                  {t(
                    "ui_sell_crypto_for_fiat_1167ce7e08",
                    "Sell Crypto for Fiat",
                  )}
                </h3>
                {noticeVariant === "demo" ? (
                  <span className="inline-flex items-center text-white/70 text-xs md:text-sm font-semibold px-2 py-0.5 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}

              </div>
              <p className="text-xs text-white/60 mt-1">
                {t(
                  "ui_powered_by_moonpay_instant_b_9e94ccf50e",
                  "Powered by MoonPay • Instant bank transfer",
                )}
              </p>
            </div>
            {step !== "iframe" && (
              <button
                type="button"
                onClick={onClose}
                className="wallet-modal-close text-white/60 hover:text-white transition-colors text-xl"
              >
                ✕
              </button>
            )}
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default MoonPaySellModal;
