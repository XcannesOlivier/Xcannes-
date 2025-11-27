"use client";

import { useState, useEffect, useCallback } from "react";
import { useXumm } from "../context/XummContext";
import XummQRModal from "./XummQRModal";

const TRUSTLINE_DATA = {
  issuer: "rBxQY3dc4mJtcDA5UgmLvtKsdc7vmCGgxx",
  currency: "XCS",
  limit: "2006400",
};

export default function WalletDashboard() {
  const { 
    wallet, 
    isConnected, 
    balance, 
    refreshBalance,
    disconnect,
    qrModalData,
    closeQrModal,
  } = useXumm();

  const [hasTrustline, setHasTrustline] = useState(false);
  const [isCheckingTrustline, setIsCheckingTrustline] = useState(false);
  const [copied, setCopied] = useState(false);

  const trustlineData = TRUSTLINE_DATA;

  const trustlineURL = `https://xrpl.services?issuer=${trustlineData.issuer}&currency=${trustlineData.currency}&limit=${trustlineData.limit}`;

  // Vérifier si la trustline XCS existe
  const checkTrustline = useCallback(() => {
    if (!balance || !balance.tokens) {
      setHasTrustline(false);
      return;
    }

    // Chercher la trustline XCS
    const xcsToken = balance.tokens.find(
      (token) => 
        token.currency === trustlineData.currency && 
        token.issuer === trustlineData.issuer
    );

    setHasTrustline(!!xcsToken);
  }, [balance, trustlineData.currency, trustlineData.issuer]);

  useEffect(() => {
    if (isConnected && balance) {
      checkTrustline();
    }
  }, [isConnected, balance, checkTrustline]);

  const handleRefresh = async () => {
    setIsCheckingTrustline(true);
    if (refreshBalance) {
      await refreshBalance();
    }
    setTimeout(() => {
      setIsCheckingTrustline(false);
    }, 1000);
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erreur copie:", err);
    }
  };

  const formatBalance = (value) => {
    if (!value && value !== 0) return "0";
    return parseFloat(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  if (!isConnected) {
    return null; // Ne pas afficher si pas connecté
  }

  // Récupérer le solde XCS si trustline existe
  const xcsToken = balance?.tokens?.find(
    (token) => token.currency === trustlineData.currency
  );
  const xcsBalance = xcsToken ? parseFloat(xcsToken.value) : 0;

  return (
    <>
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
        {/* Header avec wallet address */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-xcannes-green rounded-full animate-pulse"></div>
                <h2 className="text-xl font-orbitron font-bold text-white">
                  Wallet Dashboard
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-white/60 break-all">
                  {wallet}
                </p>
                <button
                  onClick={() => handleCopy(wallet)}
                  className="text-white/40 hover:text-xcannes-green transition-colors text-sm"
                  title="Copy address"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Section */}
        <div className="p-6 space-y-6">
          {/* XRP Balance */}
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white/60">XRP Balance</p>
              <button
                onClick={handleRefresh}
                disabled={isCheckingTrustline}
                className="text-white/60 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh balance"
              >
                <span className={isCheckingTrustline ? "animate-spin inline-block" : ""}>
                  🔄
                </span>
              </button>
            </div>
            <p className="text-3xl font-orbitron font-bold text-white">
              {formatBalance(balance?.xrp || 0)}
              <span className="text-lg text-white/60 ml-2">XRP</span>
            </p>
          </div>

          {/* XCS Balance */}
          <div className="bg-gradient-to-br from-xcannes-green/20 to-xcannes-green/10 border border-xcannes-green/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm text-white/60">XCS Balance</p>
                {hasTrustline && (
                  <span className="text-xs bg-xcannes-green/20 text-xcannes-green px-2 py-0.5 rounded-full">
                    ✓ Trustline Active
                  </span>
                )}
              </div>
            </div>
            
            {hasTrustline ? (
              <>
                <p className="text-3xl font-orbitron font-bold text-white">
                  {formatBalance(xcsBalance)}
                  <span className="text-lg text-white/60 ml-2">XCS</span>
                </p>
                {xcsToken && (
                  <div className="mt-3 pt-3 border-t border-xcannes-green/20">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/40">Trustline Limit:</span>
                      <span className="text-white/60 font-mono">
                        {formatBalance(xcsToken.limit)} XCS
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-white/40">Available:</span>
                      <span className="text-xcannes-green font-mono">
                        {formatBalance(parseFloat(xcsToken.limit) - xcsBalance)} XCS
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-white/40 text-sm">
                <p className="mb-2">⚠️ No trustline set</p>
                <p className="text-xs">Create a trustline to receive XCS tokens</p>
              </div>
            )}
          </div>

          {/* All Active Trustlines */}
          {balance?.tokens && balance.tokens.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40 mb-3">
                All Trustlines ({balance.tokens.length})
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {balance.tokens.map((token, index) => {
                  const isXCS = token.currency === trustlineData.currency && 
                               token.issuer === trustlineData.issuer;
                  const tokenValue = parseFloat(token.value) || 0;
                  const tokenLimit = parseFloat(token.limit) || 0;
                  
                  return (
                    <div
                      key={index}
                      className={`
                        ${isXCS 
                          ? 'bg-xcannes-green/10 border-xcannes-green/30' 
                          : 'bg-white/5 border-white/10'
                        } 
                        border rounded-lg p-3 hover:bg-white/10 transition-all
                      `}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-sm font-semibold ${isXCS ? 'text-xcannes-green' : 'text-white'}`}>
                              {token.currency}
                              {isXCS && (
                                <span className="ml-2 text-xs bg-xcannes-green/20 px-2 py-0.5 rounded-full">
                                  XCS
                                </span>
                              )}
                            </p>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-white/40">Issuer:</p>
                              <p className="text-xs text-white/60 font-mono truncate">
                                {token.issuer.slice(0, 8)}...{token.issuer.slice(-6)}
                              </p>
                              <button
                                onClick={() => handleCopy(token.issuer)}
                                className="text-white/40 hover:text-xcannes-green text-xs flex-shrink-0"
                                title="Copy issuer"
                              >
                                📋
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-white/40">
                                Limit: <span className="text-white/60 font-mono">
                                  {tokenLimit.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          <p className={`text-base font-mono font-semibold ${
                            tokenValue > 0 ? 'text-white' : 'text-white/40'
                          }`}>
                            {formatBalance(tokenValue)}
                          </p>
                          <p className={`text-xs mt-1 ${
                            tokenValue > 0 
                              ? 'text-xcannes-green' 
                              : tokenValue < 0 
                              ? 'text-red-400' 
                              : 'text-white/40'
                          }`}>
                            {tokenValue > 0 ? '● Active' : tokenValue < 0 ? '● Debt' : '○ Empty'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-white/40 mb-1">XRP</p>
              <p className="text-lg font-bold text-blue-400">
                {formatBalance(balance?.xrp || 0)}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-white/40 mb-1">Trustlines</p>
              <p className="text-lg font-bold text-white">
                {balance?.tokens?.length || 0}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-white/40 mb-1">Active</p>
              <p className="text-lg font-bold text-xcannes-green">
                {balance?.tokens?.filter(t => parseFloat(t.value) > 0).length || 0}
              </p>
            </div>
          </div>

          {/* Asset Summary */}
          {balance && (
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-3">
                📊 Asset Summary
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">XRP Balance:</span>
                  <span className="text-sm font-semibold text-blue-400">
                    {formatBalance(balance.xrp)} XRP
                  </span>
                </div>
                {hasTrustline && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">XCS Balance:</span>
                    <span className="text-sm font-semibold text-xcannes-green">
                      {formatBalance(xcsBalance)} XCS
                    </span>
                  </div>
                )}
                {balance.tokens && balance.tokens.filter(t => t.currency !== 'XCS' && parseFloat(t.value) > 0).length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Other Tokens:</span>
                    <span className="text-sm font-semibold text-white">
                      {balance.tokens.filter(t => t.currency !== 'XCS' && parseFloat(t.value) > 0).length} active
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-white/40">Total Trustlines:</span>
                  <span className="text-xs text-white/60 font-mono">
                    {balance.tokens?.length || 0} configured
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Trustline Setup Section (si pas de trustline) */}
          {!hasTrustline && (
            <div className="border-t border-white/10 pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <h3 className="text-lg font-orbitron font-bold text-white">
                  Setup XCS Trustline
                </h3>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-yellow-400 mb-1">
                      Trustline Required
                    </p>
                    <p className="text-xs text-white/60">
                      To receive and trade XCS tokens, you need to create a trustline. 
                      This is a one-time setup that allows your wallet to hold XCS.
                    </p>
                  </div>
                </div>
              </div>

              {/* Trustline Info Cards */}
              <div className="space-y-2">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-xs text-white/40 mb-1">Issuer Address</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-white truncate flex-1">
                      {trustlineData.issuer}
                    </p>
                    <button
                      onClick={() => handleCopy(trustlineData.issuer)}
                      className="text-white/60 hover:text-xcannes-green transition-colors text-xs"
                      title="Copy issuer"
                    >
                      📋
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-white/40 mb-1">Currency</p>
                    <p className="text-sm font-semibold text-xcannes-green">
                      {trustlineData.currency}
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-white/40 mb-1">Limit</p>
                    <p className="text-sm font-semibold text-white">
                      {parseInt(trustlineData.limit).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trustline Actions */}
              <div className="space-y-2">
                <a
                  href={trustlineURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold px-4 py-3 rounded-lg transition-all group"
                >
                  <span className="text-sm">🔗 Create Trustline (XRPL Services)</span>
                  <span className="opacity-60 group-hover:opacity-100">→</span>
                </a>

                <button
                  onClick={() => handleCopy(trustlineURL)}
                  className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-lg transition-all text-sm"
                >
                  <span>{copied ? "✓" : "🌐"}</span>
                  <span>
                    {copied ? "URL Copied!" : "Copy Trustline URL"}
                  </span>
                </button>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-white/70 leading-relaxed">
                  💡 <strong>What is a Trustline?</strong><br/>
                  A trustline is like authorizing your wallet to hold a specific token. 
                  It&rsquo;s a standard XRPL feature that protects you from receiving unwanted tokens. 
                  Creating a trustline requires a small XRP reserve (≈2 XRP).
                </p>
              </div>
            </div>
          )}

          {/* Success message if trustline exists */}
          {hasTrustline && (
            <div className="bg-xcannes-green/10 border border-xcannes-green/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-sm font-semibold text-xcannes-green mb-1">
                    Trustline Active
                  </p>
                  <p className="text-xs text-white/60">
                    Your wallet is ready to receive and trade XCS tokens. 
                    You can now purchase XCS with fiat or trade on the DEX.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal QR Code XUMM */}
      {qrModalData && (
        <XummQRModal
          isOpen={!!qrModalData}
          onClose={closeQrModal}
          uuid={qrModalData.uuid}
          type={qrModalData.type}
          onSuccess={(data) => {
            console.log("XUMM action completed:", data);
            if (refreshBalance) {
              setTimeout(() => refreshBalance(), 2000);
            }
          }}
        />
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 255, 123, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 255, 123, 0.5);
        }
      `}</style>
    </>
  );
}
