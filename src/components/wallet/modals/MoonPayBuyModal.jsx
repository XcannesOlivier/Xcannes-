import { useMemo, useState, useEffect } from 'react';
import { XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useXumm } from "@/context/XummContext";
import { useTranslation } from "next-i18next";

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
 * MoonPayBuyModal - Modal pour acheter des cryptos avec MoonPay
 * 
 * @param {boolean} isOpen - Modal ouverte ou fermée
 * @param {function} onClose - Callback de fermeture
 * @param {string} walletAddress - Adresse XRPL de destination
 * @param {boolean} embedded - Mode embedded (sans backdrop/header)
 */
const MoonPayBuyModal = ({
  isOpen,
  onClose,
  walletAddress,
  embedded = false,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  demoMode = false,
  onDemoSubmit
}) => {const { t } = useTranslation("common");
  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('form'); // 'form' | 'loading' | 'iframe' | 'success' | 'error'
  const { isWalletActivated, balance, signTransaction } = useXumm();

  // Options d'achat (RLUSD par défaut)
  const [currency, setCurrency] = useState('RLUSD');
  const [amount, setAmount] = useState('');
  const [amountType, setAmountType] = useState('fiat'); // 'fiat' | 'crypto'
  const [fiatCurrency, setFiatCurrency] = useState('USD');
  const [fiatCurrencies, setFiatCurrencies] = useState([]);
  const [fiatLoading, setFiatLoading] = useState(false);
  const [fiatError, setFiatError] = useState(null);

  // Cryptos supportées par MoonPay (RLUSD en priorité)
  const supportedCurrencies = [
  { code: 'RLUSD', name: 'RLUSD Stablecoin' },
  { code: 'XRP', name: 'XRP (Ripple)' }];

  const PRODUCT_MIN_USD = 5;


  const hasRlusdTrustline = useMemo(() => {
    const tokens = balance?.tokens || [];
    return tokens.some((t) => String(t?.currency || "").toUpperCase() === "RLUSD");
  }, [balance?.tokens]);

  const hasXcsTrustline = useMemo(() => {
    const tokens = balance?.tokens || [];
    return tokens.some((t) => String(t?.currency || "").toUpperCase() === "XCS");
  }, [balance?.tokens]);

  const needsActivation = isWalletActivated === false;
  const needsTrustlines = isWalletActivated === true && (!hasRlusdTrustline || !hasXcsTrustline);

  const selectedFiat = useMemo(() => {
    return (fiatCurrencies || []).find((fiat) => fiat.code === fiatCurrency);
  }, [fiatCurrencies, fiatCurrency]);

  const minFiatAmount = useMemo(() => {
    const candidate = Number(
      selectedFiat?.minBuyAmount ??
      selectedFiat?.minAmount
    );
    if (Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
    if (fiatCurrency === 'USD') {
      return PRODUCT_MIN_USD;
    }
    return null;
  }, [PRODUCT_MIN_USD, fiatCurrency, selectedFiat]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const loadFiatCurrencies = async () => {
      setFiatLoading(true);
      setFiatError(null);
      try {
        const response = await fetch('/api/moonpay/fiat-currencies');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load fiat currencies');
        }
        const list = data?.currencies || data?.data || data || [];
        const normalized = Array.isArray(list) ?
        list
          .map((fiat) => ({
            ...fiat,
            code: String(fiat?.code || '').toUpperCase(),
          }))
          .filter((fiat) => fiat.code) :
        [];

        if (!active) return;
        setFiatCurrencies(normalized);
        setFiatCurrency((prev) => {
          if (normalized.some((fiat) => fiat.code === prev)) {
            return prev;
          }
          const usd = normalized.find((fiat) => fiat.code === 'USD');
          return usd?.code || normalized[0]?.code || 'USD';
        });
      } catch (error) {
        if (!active) return;
        setFiatError(error?.message || 'Failed to load fiat currencies');
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

  const requestXummSignature = async () => {
    if (!signTransaction) {
      setError(
        t(
          "moonpay_error_signature_required",
          "XUMM signature required. Please connect your wallet."
        )
      );
      return null;
    }

    const result = await signTransaction({ TransactionType: "SignIn" });
    if (!result?.signed || !result?.uuid) {
      setError(
        t(
          "moonpay_error_signature_cancelled",
          "Signature cancelled or expired."
        )
      );
      return null;
    }

    return result.uuid;
  };

  // Générer l'URL MoonPay
  const generateBuyUrl = async () => {
    if (!walletAddress) {
      setError(
        t(
          "moonpay_error_wallet_required_5f2a1c9d3e",
          "Wallet address is required."
        )
      );
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError(
        t(
          "moonpay_error_invalid_amount_8c3b1a6d2f",
          "Please enter a valid amount."
        )
      );
      return;
    }

    if (amountType === 'fiat' && minFiatAmount !== null && parseFloat(amount) < minFiatAmount) {
      setError(
        t("moonpay_error_minimum_fiat", {
          defaultValue: "Minimum amount is {{amount}} {{currency}}.",
          amount: minFiatAmount,
          currency: fiatCurrency,
        })
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
            amount: parseFloat(amount)
          })
        );
        if (res?.error) {
          throw new Error(res.error);
        }
        setIframeUrl(null);
        setStep('success');
        setTimeout(() => {
          onClose?.();
        }, 1200);
        return;
      }

      const xummUuid = await requestXummSignature();
      if (!xummUuid) return;

      setStep('loading');

      const response = await fetch('/api/moonpay/generate-buy-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress,
          currencyCode: currency,
          baseCurrencyCode: fiatCurrency,
          baseCurrencyAmount: amountType === 'fiat' ? parseFloat(amount) : undefined,
          quoteCurrencyAmount: amountType === 'crypto' ? parseFloat(amount) : undefined,
          xummUuid
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            t(
              "moonpay_error_generate_buy_url_4d2c9a1f7b",
              "Failed to generate buy URL."
            )
        );
      }

      if (data.success && data.url) {
        setIframeUrl(data.url);
        setStep('iframe');
      } else {
        throw new Error(
          t(
            "moonpay_error_invalid_response_6b2d8c1a9f",
            "Invalid response from server."
          )
        );
      }
    } catch (err) {
      console.error('Error generating buy URL:', err);
      setError(
        err.message ||
          t(
            "moonpay_error_load_widget_3c1a7d8b2e",
            "Failed to load MoonPay widget."
          )
      );
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Écouter les messages du widget MoonPay
  useEffect(() => {
    const handleMessage = (event) => {
      // Vérifier l'origine (MoonPay sandbox ou production)
      if (!isTrustedMoonPayOrigin(event.origin)) return;

      const { type, status } = event.data;

      if (DEBUG_LOGS) {
        console.log('MoonPay message received:', event.data);
      }

      // Transaction complétée
      if (type === 'transaction_completed' || status === 'completed') {
        setStep('success');
        setTimeout(() => {
          onClose();
        }, 3000);
      }

      // Transaction échouée
      if (type === 'transaction_failed' || status === 'failed') {
        setError(
          t(
            "moonpay_error_transaction_failed_9a2c1b7d5e",
            "Transaction failed. Please try again."
          )
        );
        setStep('error');
      }

      // Utilisateur a fermé le widget
      if (type === 'close' || type === 'widget_closed') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, onClose, t]);

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, amountType, fiatCurrency]);

  if (!isOpen) return null;

  // Mode embedded: retourner seulement le contenu
  const renderContent = () =>
  <div className={embedded ? "" : "p-4 md:p-5"}>
            {/* Form */}
            {step === 'form' &&
    <div className="space-y-4">

                {(needsActivation || needsTrustlines) &&
	      <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
	                    <p className="text-xs text-amber-200">
	                      {needsActivation ?
	          t(
	            "moonpay_buy_activation_notice",
	            "Wallet not activated: your first purchase also includes XRP to activate your wallet (1 XRP) and enable RLUSD/XCS trustlines (+0.1 XRP)."
	          ) :
	          t(
	            "moonpay_buy_trustlines_notice",
	            "Missing trustlines: your first purchase may include +0.1 XRP to install RLUSD/XCS if needed."
	          )}
	                    </p>
	                  </div>
	      }

                {/* Currency selector */}
	                <div>
	                  <label className="block text-sm font-medium text-white/80 mb-2">
	                    {t(
	                      "moonpay_select_cryptocurrency",
	                      "Select cryptocurrency"
	                    )}
	                  </label>
	                  <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none">

                    {supportedCurrencies.map((curr) =>
          <option key={curr.code} value={curr.code}>
                        {curr.name}
                      </option>
          )}
                  </select>
                </div>

                {/* Fiat currency selector */}
	                <div>
	                  <label className="block text-sm font-medium text-white/80 mb-2">
	                    {t("moonpay_fiat_currency_label", "Fiat currency")}
	                  </label>
	                  <select
          value={fiatCurrency}
          onChange={(e) => setFiatCurrency(e.target.value)}
          disabled={fiatLoading || fiatCurrencies.length === 0}
          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none disabled:opacity-60">

                    {fiatCurrencies.length === 0 ?
          <option value="">
                        {fiatLoading ?
            t("moonpay_fiat_loading", "Loading fiat currencies...") :
            t("moonpay_fiat_unavailable", "Fiat currencies unavailable")}
                      </option> :
          fiatCurrencies.map((fiat) =>
          <option key={fiat.code} value={fiat.code}>
                        {fiat.name || fiat.code} ({fiat.code})
                      </option>
          )}
                  </select>
                  {fiatLoading &&
                  <p className="text-xs text-white/50 mt-1">
	                    {t("moonpay_fiat_loading", "Loading fiat currencies...")}
	                  </p>
                  }
                  {fiatError && !fiatLoading &&
                  <p className="text-xs text-red-400 mt-1">
	                    {fiatError}
	                  </p>
                  }
                </div>

                {/* Amount type toggle */}
                <div className="flex gap-2">
                  <button
          type="button"
          onClick={() => setAmountType('fiat')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          amountType === 'fiat' ?
          'bg-xcannes-green text-black' :
          'bg-black/40 text-white/60 border border-white/10 hover:bg-black/60'}`
          }>

	                    {t("moonpay_buy_with_fiat", "Buy with {{currency}}", {
	                      currency: fiatCurrency,
	                    })}
	                  </button>
                  <button
          type="button"
          onClick={() => setAmountType('crypto')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          amountType === 'crypto' ?
          'bg-xcannes-green text-black' :
          'bg-black/40 text-white/60 border border-white/10 hover:bg-black/60'}`
          }>

	                    {t("buy", "Buy")} {currency}
	                  </button>
                </div>

                {/* Amount input */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    {t("moonpay_amount_in_currency_8b1c7d2a9e", {
                      defaultValue: "Amount in {{currency}}",
                      currency: amountType === 'fiat' ? fiatCurrency : currency,
                    })}
                  </label>
                  <div className="relative">
                    <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={amountType === 'fiat' ? '100' : '1.0'}
            step={amountType === 'fiat' ? '10' : '0.1'}
            min="0"
            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none pr-16" />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
	                      {amountType === 'fiat' ?
	                      fiatCurrency :
	                      currency}
	                    </span>
                  </div>
	                  {amountType === 'fiat' && minFiatAmount !== null &&
	        <p className="text-xs text-white/40 mt-1">
	                      {t("moonpay_minimum_prefix", "Minimum:")}{" "}
	                      {minFiatAmount} {fiatCurrency}
	                    </p>
	        }
                </div>

	                {/* Wallet address display */}
	                <div className="bg-black/40 border border-white/10 rounded-lg p-3">
	                  <p className="text-xs text-white/60 mb-1">
	                    {t("moonpay_destination_wallet", "Destination wallet")}
	                  </p>
	                  <p className="text-sm text-white/90 font-mono break-all">
	                    {walletAddress}
	                  </p>
	                </div>

                {/* Error message */}
                {error &&
      <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
      }

                {/* Info box */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs text-blue-400">
                    {demoMode ?
          `ℹ️ ${t(
            "moonpay_info_buy_demo_1b7d2c9a5e",
            "Demo mode: no MoonPay redirect. The buy is simulated."
          )}` :
          `ℹ️ ${t(
            "moonpay_info_buy_live_3c8a1d6b2f",
            "You'll be redirected to MoonPay to complete the payment. Accepted: Credit card, debit card, Apple Pay, Google Pay, bank transfer."
          )}`}{" "}
                    {t(
                      "moonpay_minimum_note",
                      "Minimums depend on MoonPay (currency, country, payment method)."
                    )}
                  </p>
                </div>

                {/* Continue button */}
                <button
        type="button"
        onClick={generateBuyUrl}
        disabled={loading || !amount || fiatCurrencies.length === 0}
        className="w-full py-3 bg-xcannes-green hover:bg-xcannes-green/90 disabled:bg-white/10 disabled:text-white/40 text-black font-semibold rounded-lg transition-all duration-200 hover:scale-105 border border-white/10">

                  {loading ?
        t("moonpay_action_loading_7c2b1d9a3e", "Loading...") :
        demoMode ?
        t("moonpay_action_simulate_buy_5a1c9d7b3e", "Simulate buy") :
        t("moonpay_action_continue_buy_8d2a1c6b9f", "Continue to MoonPay")}
                </button>
              </div>
    }

	                {/* Loading */}
	            {step === 'loading' &&
	    <div className="flex flex-col items-center justify-center py-12">
	                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xcannes-green mb-4"></div>
	                <p className="text-white/80">
	                  {t(
	                    "moonpay_loading_widget",
	                    "Loading MoonPay widget..."
	                  )}
	                </p>
	              </div>
	    }

            {/* MoonPay iframe */}
            {step === 'iframe' && iframeUrl &&
    <div className="relative" style={{ height: '600px' }}>
	                <iframe
	        src={iframeUrl}
	        className="w-full h-full rounded-lg"
	        allow="payment"
	        title={t("moonpay_widget_title_buy", "MoonPay Widget")} />

                <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 bg-black/80 text-white/80 hover:text-white px-3 py-1 rounded-lg text-sm transition-colors">

	                  {t("close", "Close")}
	                </button>
              </div>
    }

            {/* Success */}
            {step === 'success' &&
    <div className="flex flex-col items-center justify-center py-12">
                <CheckCircleIcon className="w-16 h-16 text-green-400 mb-4" />
	                <h4 className="text-xl font-bold text-white mb-2">
	                  {t("moonpay_buy_success_title", "Transaction Completed!")}
	                </h4>
	                <p className="text-white/60 text-center mb-4">
	                  {t(
	                    "moonpay_buy_success_body",
	                    "Your crypto will be sent to your wallet shortly."
	                  )}
	                </p>
                <button
        type="button"
        onClick={onClose}
        className="px-6 py-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors">

	                  {t("close", "Close")}
	                </button>
              </div>
    }

            {/* Error */}
            {step === 'error' &&
    <div className="flex flex-col items-center justify-center py-12">
                <XCircleIcon className="w-16 h-16 text-red-400 mb-4" />
	                <h4 className="text-xl font-bold text-white mb-2">
	                  {t("moonpay_error_title", "Something went wrong")}
	                </h4>
                <p className="text-white/60 text-center mb-4">
                  {error ||
                    t(
                      "moonpay_error_try_again_later_6f2b1c9d8a",
                      "Please try again later."
                    )}
                </p>
                <div className="flex gap-3">
                  <button
          type="button"
          onClick={() => {
            setStep('form');
            setError(null);
            setIframeUrl(null);
          }}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors">

	                    {t("try_again", "Try Again")}
	                  </button>
                  <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors">

	                    {t("close", "Close")}
	                  </button>
                </div>
              </div>
    }
    </div>;


  // Mode embedded: retourner seulement le contenu
  if (embedded) {
    return renderContent();
  }

  // Mode standalone: retourner le modal complet
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={step === 'iframe' ? null : onClose} />

      
      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className="relative w-full max-w-2xl bg-elevated border border-subtle rounded-2xl overflow-hidden pointer-events-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">{t("ui_buy_crypto_with_fiat_f09c7b4228", "Buy Crypto with Fiat")}

                </h3>
                {noticeVariant === "demo" ? (
                  <span className="inline-flex items-center text-emerald-400 text-xs md:text-sm font-semibold border border-emerald-400/40 rounded-full px-2 py-0.5 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}
                {isPreviewMode && noticeVariant !== "demo" ? (
                  <span className="inline-flex items-center text-amber-200 text-xs md:text-sm font-semibold border border-amber-400/40 rounded-full px-2 py-0.5 leading-none">
                    {t("wallet_not_connected_title", "Wallet not connected")}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-white/60 mt-1">{t("ui_powered_by_moonpay_secure_ch_0bcfb2aeb5", "Powered by MoonPay • Secure checkout")}

              </p>
            </div>
            {step !== 'iframe' &&
            <button
              type="button"
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors text-xl">

                ✕
              </button>
            }
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </div>
    </>);

};

export default MoonPayBuyModal;
