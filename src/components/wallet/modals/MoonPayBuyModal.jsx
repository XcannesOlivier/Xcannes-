import React, { useMemo, useState, useEffect } from 'react';
import { XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useXumm } from "@/context/XummContext";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

/**
 * MoonPayBuyModal - Modal pour acheter des cryptos avec MoonPay
 * 
 * @param {boolean} isOpen - Modal ouverte ou fermée
 * @param {function} onClose - Callback de fermeture
 * @param {string} walletAddress - Adresse XRPL de destination
 * @param {boolean} embedded - Mode embedded (sans backdrop/header)
 */
const MoonPayBuyModal = ({ isOpen, onClose, walletAddress, embedded = false }) => {
  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('form'); // 'form' | 'loading' | 'iframe' | 'success' | 'error'
  const { isWalletActivated, balance } = useXumm();
  
  // Options d'achat (RLUSD par défaut)
  const [currency, setCurrency] = useState('RLUSD');
  const [amount, setAmount] = useState('');
  const [amountType, setAmountType] = useState('fiat'); // 'fiat' | 'crypto'

  // Cryptos supportées par MoonPay (RLUSD en priorité)
  const supportedCurrencies = [
    { code: 'RLUSD', name: 'RLUSD Stablecoin', min: 20 },
    { code: 'XRP', name: 'XRP (Ripple)', min: 50 },
  ];

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

  // Générer l'URL MoonPay
  const generateBuyUrl = async () => {
    if (!walletAddress) {
      setError('Wallet address is required');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const selectedCurrency = supportedCurrencies.find(c => c.code === currency);
    if (amountType === 'fiat' && parseFloat(amount) < selectedCurrency.min) {
      setError(`Minimum amount is $${selectedCurrency.min} USD`);
      return;
    }

    setLoading(true);
    setError(null);
    setStep('loading');

    try {
      const response = await fetch('/api/moonpay/generate-buy-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          currencyCode: currency,
          baseCurrencyAmount: amountType === 'fiat' ? parseFloat(amount) : undefined,
          quoteCurrencyAmount: amountType === 'crypto' ? parseFloat(amount) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate buy URL');
      }

      if (data.success && data.url) {
        setIframeUrl(data.url);
        setStep('iframe');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error generating buy URL:', err);
      setError(err.message || 'Failed to load MoonPay widget');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Écouter les messages du widget MoonPay
  useEffect(() => {
    const handleMessage = (event) => {
      // Vérifier l'origine (MoonPay sandbox ou production)
      if (!event.origin.includes('moonpay.com')) return;

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
        setError('Transaction failed. Please try again.');
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
  }, [isOpen, onClose]);

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, amountType]);

  if (!isOpen) return null;

  // Mode embedded: retourner seulement le contenu
  const renderContent = () => (
    <div className={embedded ? "" : "p-4 md:p-5"}>
            {/* Form */}
            {step === 'form' && (
              <div className="space-y-4">
                {(needsActivation || needsTrustlines) && (
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
                    <p className="text-xs text-amber-200">
                      {needsActivation
                        ? "Wallet non activé: le premier achat inclut aussi du XRP pour activer votre wallet (1 XRP) et permettre l’installation des trustlines RLUSD/XCS (+0.1 XRP)."
                        : "Trustlines manquantes: le premier achat peut inclure +0.1 XRP pour installer RLUSD/XCS si nécessaire."}
                    </p>
                  </div>
                )}

                {/* Currency selector */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Select cryptocurrency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none"
                  >
                    {supportedCurrencies.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount type toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAmountType('fiat')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      amountType === 'fiat'
                        ? 'bg-xcannes-green text-black'
                        : 'bg-black/40 text-white/60 border border-white/10 hover:bg-black/60'
                    }`}
                  >
                    Buy with USD
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountType('crypto')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      amountType === 'crypto'
                        ? 'bg-xcannes-green text-black'
                        : 'bg-black/40 text-white/60 border border-white/10 hover:bg-black/60'
                    }`}
                  >
                    Buy {currency}
                  </button>
                </div>

                {/* Amount input */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    {amountType === 'fiat' ? 'Amount in USD' : `Amount in ${currency}`}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={amountType === 'fiat' ? '100' : '1.0'}
                      step={amountType === 'fiat' ? '10' : '0.1'}
                      min="0"
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                      {amountType === 'fiat' ? 'USD' : currency}
                    </span>
                  </div>
                  {amountType === 'fiat' && (
                    <p className="text-xs text-white/40 mt-1">
                      Minimum: ${supportedCurrencies.find(c => c.code === currency)?.min} USD
                    </p>
                  )}
                </div>

                {/* Wallet address display */}
                <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-white/60 mb-1">Destination wallet</p>
                  <p className="text-sm text-white/90 font-mono break-all">
                    {walletAddress}
                  </p>
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {/* Info box */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs text-blue-400">
                    ℹ️ You&apos;ll be redirected to MoonPay to complete the payment. 
                    Accepted: Credit card, debit card, Apple Pay, Google Pay, bank transfer.
                  </p>
                </div>

                {/* Continue button */}
                <button
                  type="button"
                  onClick={generateBuyUrl}
                  disabled={loading || !amount}
                  className="w-full py-3 bg-xcannes-green hover:bg-xcannes-green/90 disabled:bg-white/10 disabled:text-white/40 text-black font-semibold rounded-lg transition-all duration-200 hover:scale-105 border border-white/10"
                >
                  {loading ? 'Loading...' : 'Continue to MoonPay'}
                </button>
              </div>
            )}

            {/* Loading */}
            {step === 'loading' && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xcannes-green mb-4"></div>
                <p className="text-white/80">Loading MoonPay widget...</p>
              </div>
            )}

            {/* MoonPay iframe */}
            {step === 'iframe' && iframeUrl && (
              <div className="relative" style={{ height: '600px' }}>
                <iframe
                  src={iframeUrl}
                  className="w-full h-full rounded-lg"
                  allow="payment"
                  title="MoonPay Widget"
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-2 right-2 bg-black/80 text-white/80 hover:text-white px-3 py-1 rounded-lg text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {/* Success */}
            {step === 'success' && (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircleIcon className="w-16 h-16 text-green-400 mb-4" />
                <h4 className="text-xl font-bold text-white mb-2">Transaction Completed!</h4>
                <p className="text-white/60 text-center mb-4">
                  Your crypto will be sent to your wallet shortly.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {/* Error */}
            {step === 'error' && (
              <div className="flex flex-col items-center justify-center py-12">
                <XCircleIcon className="w-16 h-16 text-red-400 mb-4" />
                <h4 className="text-xl font-bold text-white mb-2">Something went wrong</h4>
                <p className="text-white/60 text-center mb-4">
                  {error || 'Please try again later.'}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form');
                      setError(null);
                      setIframeUrl(null);
                    }}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors"
                  >
                    Close
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
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={step === 'iframe' ? null : onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className="relative w-full max-w-2xl bg-elevated border border-subtle rounded-2xl overflow-hidden pointer-events-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/10">
            <div>
              <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                Buy Crypto with Fiat
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Powered by MoonPay • Secure checkout
              </p>
            </div>
            {step !== 'iframe' && (
              <button
                type="button"
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors text-xl"
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

export default MoonPayBuyModal;
