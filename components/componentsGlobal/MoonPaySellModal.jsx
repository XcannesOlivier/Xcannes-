import React, { useState, useEffect } from 'react';
import { XCircleIcon, CheckCircleIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

/**
 * MoonPaySellModal - Modal pour vendre des cryptos contre fiat
 * 
 * @param {boolean} isOpen - Modal ouverte ou fermée
 * @param {function} onClose - Callback de fermeture
 * @param {string} walletAddress - Adresse XRPL source
 * @param {boolean} embedded - Mode embedded (sans backdrop/header)
 */
const MoonPaySellModal = ({ isOpen, onClose, walletAddress, embedded = false }) => {
  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('form'); // 'form' | 'loading' | 'iframe' | 'success' | 'error'
  
  // Options de vente (RLUSD par défaut)
  const [currency, setCurrency] = useState('RLUSD');
  const [amount, setAmount] = useState('');
  const [quoteCurrency, setQuoteCurrency] = useState('USD'); // USD, EUR, GBP

  // Cryptos supportées pour la vente (RLUSD en priorité)
  const supportedCurrencies = [
    { code: 'RLUSD', name: 'RLUSD Stablecoin', min: 20 },
    { code: 'XRP', name: 'XRP (Ripple)', min: 10 },
  ];

  // Devises fiat supportées
  const supportedFiatCurrencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
  ];

  // Générer l'URL MoonPay pour la vente
  const generateSellUrl = async () => {
    if (!walletAddress) {
      setError('Wallet address is required');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const selectedCurrency = supportedCurrencies.find(c => c.code === currency);
    if (parseFloat(amount) < selectedCurrency.min) {
      setError(`Minimum amount is ${selectedCurrency.min} ${currency}`);
      return;
    }

    setLoading(true);
    setError(null);
    setStep('loading');

    try {
      const response = await fetch('/api/moonpay/generate-sell-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          baseCurrencyCode: currency, // Crypto à vendre
          quoteCurrencyCode: quoteCurrency, // Fiat à recevoir
          baseCurrencyAmount: parseFloat(amount),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate sell URL');
      }

      if (data.success && data.url) {
        setIframeUrl(data.url);
        setStep('iframe');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error generating sell URL:', err);
      setError(err.message || 'Failed to load MoonPay widget');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Écouter les messages du widget MoonPay
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.origin.includes('moonpay.com')) return;

      const { type, status } = event.data;
      console.log('MoonPay sell message received:', event.data);

      if (type === 'transaction_completed' || status === 'completed') {
        setStep('success');
        setTimeout(() => {
          onClose();
        }, 3000);
      }

      if (type === 'transaction_failed' || status === 'failed') {
        setError('Transaction failed. Please try again.');
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
  }, [isOpen, onClose]);

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, quoteCurrency]);

  if (!isOpen) return null;

  // Mode embedded: retourner seulement le contenu
  const renderContent = () => (
    <div className={embedded ? "" : "p-4 md:p-5"}>
            {/* Form */}
            {step === 'form' && (
              <div className="space-y-4">
                {/* Currency selector */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Select cryptocurrency to sell
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

                {/* Amount input */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Amount to sell
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
                  <p className="text-xs text-white/40 mt-1">
                    Minimum: {supportedCurrencies.find(c => c.code === currency)?.min} {currency}
                  </p>
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
                    Receive in
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {supportedFiatCurrencies.map((fiat) => (
                      <button
                        key={fiat.code}
                        type="button"
                        onClick={() => setQuoteCurrency(fiat.code)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                          quoteCurrency === fiat.code
                            ? 'bg-xcannes-green text-black'
                            : 'bg-black/40 text-white/60 border border-white/10 hover:bg-black/60'
                        }`}
                      >
                        <span className="block text-lg mb-1">{fiat.symbol}</span>
                        <span className="text-xs">{fiat.code}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wallet address display */}
                <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-white/60 mb-1">From wallet</p>
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
                    💰 Funds will be transferred to your bank account. MoonPay supports SEPA, wire transfer, and instant bank transfer in supported countries.
                  </p>
                </div>

                {/* Continue button */}
                <button
                  type="button"
                  onClick={generateSellUrl}
                  disabled={loading || !amount}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:from-white/10 disabled:to-white/10 disabled:text-white/40 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 border border-white/10"
                >
                  {loading ? 'Loading...' : 'Continue to Sell'}
                </button>
              </div>
            )}

            {/* Loading */}
            {step === 'loading' && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
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
                  title="MoonPay Sell Widget"
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
                <h4 className="text-xl font-bold text-white mb-2">Sale Completed!</h4>
                <p className="text-white/60 text-center mb-4">
                  Your funds will be transferred to your bank account.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all"
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
                    className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all"
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
        className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm"
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
                Sell Crypto for Fiat
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Powered by MoonPay • Instant bank transfer
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

export default MoonPaySellModal;
