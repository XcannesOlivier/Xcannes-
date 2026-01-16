import { useState, useEffect } from 'react';
import { XCircleIcon, CheckCircleIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { useTranslation } from "next-i18next";
import { useXumm } from "@/context/XummContext";

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
  embedded = false,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  demoMode = false,
  onDemoSubmit
}) => {const { t } = useTranslation("common");
  const { signTransaction } = useXumm();
  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('form'); // 'form' | 'loading' | 'iframe' | 'success' | 'error'

  // Options de vente (RLUSD par défaut)
  const [currency, setCurrency] = useState('RLUSD');
  const [amount, setAmount] = useState('');
  const [quoteCurrency, setQuoteCurrency] = useState('USD'); // Fiat code
  const [fiatCurrencies, setFiatCurrencies] = useState([]);
  const [fiatLoading, setFiatLoading] = useState(false);
  const [fiatError, setFiatError] = useState(null);
  const resolveFiatErrorMessage = (data) => {
    if (!data) return 'Failed to load fiat currencies';
    if (typeof data === 'string') return data;
    if (typeof data?.error === 'string') return data.error;
    if (data?.error?.message) return data.error.message;
    if (data?.message) return data.message;
    return 'Failed to load fiat currencies';
  };

  // Cryptos supportées pour la vente (RLUSD en priorité)
  const supportedCurrencies = [
  { code: 'RLUSD', name: 'RLUSD Stablecoin' },
  { code: 'XRP', name: 'XRP (Ripple)' }];

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
          throw new Error(resolveFiatErrorMessage(data));
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
        setQuoteCurrency((prev) => {
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


  // Générer l'URL MoonPay pour la vente
  const generateSellUrl = async () => {
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

    setLoading(true);
    setError(null);

    try {
      if (demoMode) {
        const res = await Promise.resolve(
          onDemoSubmit?.({
            currencyCode: String(currency || "RLUSD").toUpperCase(),
            quoteCurrencyCode: String(quoteCurrency || "USD").toUpperCase(),
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

      const response = await fetch('/api/moonpay/generate-sell-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress,
          baseCurrencyCode: currency, // Crypto à vendre
          quoteCurrencyCode: quoteCurrency, // Fiat à recevoir
          baseCurrencyAmount: parseFloat(amount),
          xummUuid
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            t(
              "moonpay_error_generate_sell_url_9b2c7a1d5e",
              "Failed to generate sell URL."
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
      console.error('Error generating sell URL:', err);
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
      if (!isTrustedMoonPayOrigin(event.origin)) return;

      const { type, status } = event.data;
      if (DEBUG_LOGS) {
        console.log('MoonPay sell message received:', event.data);
      }

      if (type === 'transaction_completed' || status === 'completed') {
        setStep('success');
        setTimeout(() => {
          onClose();
        }, 3000);
      }

      if (type === 'transaction_failed' || status === 'failed') {
        setError(
          t(
            "moonpay_error_transaction_failed_9a2c1b7d5e",
            "Transaction failed. Please try again."
          )
        );
        setStep('error');
      }

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
  }, [currency, amount, quoteCurrency]);

  if (!isOpen) return null;

  // Mode embedded: retourner seulement le contenu
  const renderContent = () =>
  <div className={embedded ? "" : "p-4 md:p-5"}>
            {/* Form */}
            {step === 'form' &&
    <div className="space-y-4">
                {/* Currency selector */}
	                <div>
	                  <label className="block text-sm font-medium text-white/80 mb-2">
	                    {t(
	                      "moonpay_select_crypto_to_sell",
	                      "Select cryptocurrency to sell"
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
            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none pr-16" />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                      {currency}
                    </span>
                  </div>
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
                  <select
          value={quoteCurrency}
          onChange={(e) => setQuoteCurrency(e.target.value)}
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
                  {fiatError && !fiatLoading &&
                  <p className="text-xs text-red-400 mt-1">
	                    {fiatError}
	                  </p>
                  }
                </div>

                {/* Wallet address display */}
	                <div className="bg-black/40 border border-white/10 rounded-lg p-3">
	                  <p className="text-xs text-white/60 mb-1">
	                    {t("moonpay_from_wallet", "From wallet")}
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
          `💰 ${t(
            "moonpay_info_sell_demo_6d1a9c2b7e",
            "Demo mode: the sell is simulated (no bank transfer)."
          )}` :
          `💰 ${t(
            "moonpay_info_sell_live_8b2c1a7d5f",
            "Funds will be transferred to your bank account. MoonPay supports SEPA, wire transfer, and instant bank transfer in supported countries."
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
        onClick={generateSellUrl}
        disabled={loading || !amount || fiatCurrencies.length === 0}
        className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:from-white/10 disabled:to-white/10 disabled:text-white/40 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 border border-white/10">

                  {loading ?
        t("moonpay_action_loading_7c2b1d9a3e", "Loading...") :
        demoMode ?
        t("moonpay_action_simulate_sell_4d1a9c7b2e", "Simulate sell") :
        t("moonpay_action_continue_sell_2c8a1d6b4f", "Continue to Sell")}
                </button>
              </div>
    }

            {/* Loading */}
	            {step === 'loading' &&
	    <div className="flex flex-col items-center justify-center py-12">
	                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
	                <p className="text-white/80">
	                  {t("moonpay_loading_widget", "Loading MoonPay widget...")}
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
	        title={t("moonpay_widget_title_sell", "MoonPay Sell Widget")} />

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
	                  {t("moonpay_sell_success_title", "Sale Completed!")}
	                </h4>
	                <p className="text-white/60 text-center mb-4">
	                  {t(
	                    "moonpay_sell_success_body",
	                    "Your funds will be transferred to your bank account."
	                  )}
	                </p>
                <button
        type="button"
        onClick={onClose}
        className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all">

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
          className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all">

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
                <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">{t("ui_sell_crypto_for_fiat_1167ce7e08", "Sell Crypto for Fiat")}

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
              <p className="text-xs text-white/60 mt-1">{t("ui_powered_by_moonpay_instant_b_9e94ccf50e", "Powered by MoonPay • Instant bank transfer")}

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

export default MoonPaySellModal;
