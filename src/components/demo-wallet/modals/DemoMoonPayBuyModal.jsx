import { useMemo, useState, useEffect } from "react";
import { XCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import { useTranslation } from "next-i18next";
import { CRYPTO_ICONS } from "../utils/demoMarketConstants";
import { useModalTransition } from "@/hooks/useModalTransition";
import { greenActionBtnBase } from "./demoWalletModalTokens";

// Static fiat currencies for the demo wallet (no MoonPay API call needed)
const DEMO_FIAT_CURRENCIES = [
  { code: "USD", name: "US Dollar", minBuyAmount: 5 },
  { code: "EUR", name: "Euro", minBuyAmount: 5 },
  { code: "GBP", name: "British Pound", minBuyAmount: 5 },
  { code: "CAD", name: "Canadian Dollar", minBuyAmount: 5 },
  { code: "CHF", name: "Swiss Franc", minBuyAmount: 5 },
  { code: "AUD", name: "Australian Dollar", minBuyAmount: 5 },
  { code: "JPY", name: "Japanese Yen", minBuyAmount: 500 },
  { code: "MXN", name: "Mexican Peso", minBuyAmount: 100 },
  { code: "BRL", name: "Brazilian Real", minBuyAmount: 25 },
  { code: "INR", name: "Indian Rupee", minBuyAmount: 400 },
  { code: "NGN", name: "Nigerian Naira", minBuyAmount: 2000 },
  { code: "AED", name: "UAE Dirham", minBuyAmount: 20 },
  { code: "PHP", name: "Philippine Peso", minBuyAmount: 250 },
];

const normalizeFiatCurrencyCode = (value) => {
  const upper = String(value || "").trim().toUpperCase();
  if (!upper) return "";
  if (upper === "XRP" || upper === "RLUSD") return "";
  return upper;
};

/**
 * MoonPayBuyModal - Modal pour acheter des cryptos avec MoonPay
 *
 * @param {boolean} isOpen - Modal ouverte ou fermée
 * @param {function} onClose - Callback de fermeture
 * @param {string} walletAddress - Adresse XRPL de destination
 * @param {boolean} embedded - Mode embedded (sans backdrop/header)
 */
const DemoMoonPayBuyModal = ({
  isOpen,
  onClose,
  walletAddress,
  walletLabel = "",
  hideWalletAddress = false,
  preferredFiatCurrency = "",
  embedded = false,
  isPreviewMode = false,
  noticeVariant = "preview",
  demoMode = false,
  onDemoSubmit,
}) => {
  const { t } = useTranslation("common");
  const stripLeadingNoticePrefix = (value) =>
    String(value || "").replace(/^\s*[^:：]{1,60}\s*[:：]\s*/, "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("form"); // 'form' | 'success' | 'error'
  const displayError =
    error && /api\.sandbox\.moonpay\.com/i.test(error) ? null : error;
  // Options d'achat (RLUSD par défaut)
  const [currency, setCurrency] = useState("RLUSD");
  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState("fiat");
  const [fiatCurrency, setFiatCurrency] = useState(() => {
    return normalizeFiatCurrencyCode(preferredFiatCurrency) || "USD";
  });
  const [fiatCurrencies, setFiatCurrencies] = useState([]);

  // Cryptos supportées par MoonPay (USD via RLUSD)
  const supportedCurrencies = [
    { code: "RLUSD", name: "USD Stablecoin", icon: CRYPTO_ICONS.RLUSD },
  ];

  const PRODUCT_MIN_USD = 5;

  const selectedFiat = useMemo(() => {
    return (fiatCurrencies || []).find((fiat) => fiat.code === fiatCurrency);
  }, [fiatCurrencies, fiatCurrency]);

  const minFiatAmount = useMemo(() => {
    const candidate = Number(
      selectedFiat?.minBuyAmount ?? selectedFiat?.minAmount,
    );
    if (Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
    if (fiatCurrency === "USD") {
      return PRODUCT_MIN_USD;
    }
    return null;
  }, [PRODUCT_MIN_USD, fiatCurrency, selectedFiat]);

  // Load static fiat currencies when modal opens (no API call)
  useEffect(() => {
    if (!isOpen) return;
    setFiatCurrencies(DEMO_FIAT_CURRENCIES);
    setFiatCurrency((prev) => {
      if (DEMO_FIAT_CURRENCIES.some((fiat) => fiat.code === prev)) return prev;
      const preferred = normalizeFiatCurrencyCode(preferredFiatCurrency);
      if (preferred && DEMO_FIAT_CURRENCIES.some((fiat) => fiat.code === preferred)) {
        return preferred;
      }
      return "USD";
    });
  }, [isOpen, preferredFiatCurrency]);

  // Générer l'URL MoonPay
  const generateBuyUrl = async () => {
    if (!walletAddress) {
      setError(
        t(
          "moonpay_error_wallet_required_5f2a1c9d3e",
          "Wallet address is required.",
        ),
      );
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError(
        t(
          "moonpay_error_invalid_amount_8c3b1a6d2f",
          "Please enter a valid amount.",
        ),
      );
      return;
    }

    if (
      amountType === "fiat" &&
      minFiatAmount !== null &&
      parseFloat(amount) < minFiatAmount
    ) {
      setError(
        t("moonpay_error_minimum_fiat", {
          defaultValue: "Minimum amount is {{amount}} {{currency}}.",
          amount: minFiatAmount,
          currency: fiatCurrency,
        }),
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (demoMode) {
        const res = await Promise.resolve(
          onDemoSubmit?.({
            currencyCode: String(currency || "RLUSD").toUpperCase(),
            baseCurrencyCode: String(fiatCurrency || "USD").toUpperCase(),
            amountType,
            amount: parseFloat(amount),
          }),
        );
        if (res?.error) {
          throw new Error(res.error);
        }
        setStep("success");
        setTimeout(() => {
          onClose?.();
        }, 1200);
        return;
      }

      throw new Error(
        t(
          "demo_wallet_moonpay_live_disabled_8f4c2a1d9e",
          "MoonPay is disabled in the demo wallet.",
        ),
      );
    } catch (err) {
      console.error("Error generating buy URL:", err);
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

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, fiatCurrency]);

  const continueLabel = loading
    ? t("moonpay_action_loading_7c2b1d9a3e", "Loading...")
    : demoMode
      ? t("moonpay_action_simulate_buy_5a1c9d7b3e", "Simulate buy")
      : t("moonpay_action_continue_buy_8d2a1c6b9f", "Continue to MoonPay");
  const continueDisabled = loading || !amount;

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
    <div className={embedded ? "" : "p-4"}>
      {/* Form */}
      {step === "form" && (
        <div className="space-y-5">
          {/* Currency selector */}
          <div>
            <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
              {t("moonpay_select_cryptocurrency", "Select cryptocurrency")}
            </label>
            <ModalSelect
              value={currency}
              onChange={setCurrency}
              options={supportedCurrencies.map((curr) => ({
                value: curr.code,
                label: curr.name,
                icon: curr.icon ? { src: curr.icon, alt: curr.code } : null,
              }))}
              useNativeSelect={false}
              buttonClassName="w-full bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl px-4 py-4 text-base text-white/90 focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer hover:ring-white/25 transition-all duration-150"
              menuClassName={
                noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated"
              }
              selectClassName="xcannes-select w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60"
            />
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
              {t("moonpay_amount_in_currency_8b1c7d2a9e", {
                defaultValue: "Amount in {{currency}}",
                currency: amountType === "fiat" ? fiatCurrency : currency,
              })}
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={amountType === "fiat" ? "100" : "1.0"}
                step={amountType === "fiat" ? "10" : "0.1"}
                min="0"
                className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 pr-16 transition-all duration-150"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                {amountType === "fiat" ? fiatCurrency : currency}
              </span>
            </div>
            {amountType === "fiat" && minFiatAmount !== null && (
              <p className="text-[11px] text-white/45 mt-2">
                {t("moonpay_minimum_prefix", "Minimum:")} {minFiatAmount}{" "}
                {fiatCurrency}
              </p>
            )}
          </div>

          {/* Wallet address display */}
          <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
            <p className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
              {t("moonpay_destination_wallet", "Destination wallet")}
            </p>
            {hideWalletAddress && String(walletLabel || "").trim() ? (
              <p className="text-[16px] text-white font-semibold truncate mb-1">
                {walletLabel}
              </p>
            ) : null}
            {!hideWalletAddress ? (
              <p className="text-[10px] text-white/60 font-mono break-all">
                {walletAddress}
              </p>
            ) : null}
          </div>

          {/* Error message */}
          {displayError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{displayError}</p>
            </div>
          )}

          {/* Info box */}
          <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2">
            <p className="text-[11px] text-white/60">
              {demoMode
                ? `ℹ️ ${stripLeadingNoticePrefix(
                    t(
                      "moonpay_info_buy_demo_1b7d2c9a5e",
                      "No MoonPay redirect. The buy is simulated.",
                    ),
                  )}`
                : `ℹ️ ${t(
                    "moonpay_info_buy_live_3c8a1d6b2f",
                    "You'll be redirected to MoonPay to complete the payment. Accepted: Credit card, debit card, Apple Pay, Google Pay, bank transfer.",
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
            onConfirm={generateBuyUrl}
            disabled={continueDisabled}
            variant="xcannesGreen"
          />
          <button
            type="button"
            onClick={generateBuyUrl}
            disabled={continueDisabled}
            className={`hidden w-full text-xl py-4 ${greenActionBtnBase}`}
          >
            {continueLabel}
          </button>
        </div>
      )}

      {/* Success */}
      {step === "success" && (
        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircleIcon className="w-16 h-16 text-green-400 mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">
            {t("moonpay_buy_success_title", "Transaction Completed!")}
          </h4>
          <p className="text-white/60 text-center mb-4">
            {t(
              "moonpay_buy_success_body",
              "Your crypto will be sent to your wallet shortly.",
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors"
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
              }}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
            >
              {t("try_again", "Try Again")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors"
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
        className={`fixed inset-0 z-[10000] bg-black/80 ${
          isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
        }`}
        onClick={step === "iframe" ? null : onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className={`relative w-full wallet-modal-panel max-w-2xl border rounded-2xl overflow-hidden pointer-events-auto shadow-2xl ${
            noticeVariant === "demo"
              ? "bg-xcannes-surface-demo border-white/10"
              : "bg-elevated border-subtle"
          } ${isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-orbitron font-bold text-white">
                  {t(
                    "ui_buy_crypto_with_fiat_f09c7b4228",
                    "Buy Crypto with Fiat",
                  )}
                </h3>
              </div>
              <p className="text-xs text-white/60 mt-1">
                {t(
                  "ui_powered_by_moonpay_secure_ch_0bcfb2aeb5",
                  "Powered by MoonPay • Secure checkout",
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

export default DemoMoonPayBuyModal;
