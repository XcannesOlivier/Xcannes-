"use client";

import { useState, useEffect, useCallback } from "react";
import { useXumm } from "../context/XummContext";
import XummQRModal from "./XummQRModal";

const TRUSTLINE_DATA = {
  issuer: "rBxQY3dc4mJtcDA5UgmLvtKsdc7vmCGgxx",
  currency: "XCS",
  limit: "2006400",
};

export default function WalletDashboard({ preview = false }) {
  const { 
    wallet, 
    isConnected, 
    balance, 
    refreshBalance,
    disconnect,
    qrModalData,
    closeQrModal,
  } = useXumm();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAction, setActiveAction] = useState(null); // 'send' | 'receive' | 'swap' | 'buy' | null

  const formatBalance = (value) => {
    if (!value && value !== 0) return "0";
    return parseFloat(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  // Construire un jeu de données de prévisualisation si preview=true
  const effectiveIsConnected = preview ? true : isConnected;
  const effectiveWallet = preview
    ? "rPREVIEWWALLETxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    : wallet;
  const effectiveBalance = preview
    ? {
        xrp: "12345.6789",
        tokens: [
          {
            currency: TRUSTLINE_DATA.currency,
            issuer: TRUSTLINE_DATA.issuer,
            value: "250000",
            limit: TRUSTLINE_DATA.limit,
          },
          {
            currency: "USD",
            issuer: "rUSDISSUERxxxxxx",
            value: "1234.56",
            limit: "1000000",
          },
        ],
      }
    : balance;

  if (!effectiveIsConnected) {
    return null; // Ne pas afficher si pas connecté (hors preview)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (refreshBalance) {
      await refreshBalance();
    }
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Erreur copie:", err);
    }
  };

  const baseTokens = effectiveBalance?.tokens || [];
  const xrpAmount = parseFloat(effectiveBalance?.xrp || 0) || 0;

  const isStablecoin = (currency) =>
    ["RLUSD", "USD", "USDC", "USDT", "EUR", "EURS", "EURT"].includes(currency);

  const stableTokens = baseTokens.filter((t) => isStablecoin(t.currency));
  const stableUsd = stableTokens.reduce((sum, t) => {
    const v = parseFloat(t.value);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  const xcsToken = baseTokens.find((t) => t.currency === "XCS");
  const xcsAmount = xcsToken ? parseFloat(xcsToken.value) || 0 : 0;

  const totalLabel =
    stableUsd > 0
      ? `$${stableUsd.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : `${xrpAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} XRP`;

  const displayTokens = [
    {
      key: "XRP",
      currency: "XRP",
      issuer: "Native",
      value: xrpAmount,
      type: "native",
    },
    ...baseTokens.map((t) => ({
      key: `${t.currency}:${t.issuer}`,
      currency: t.currency,
      issuer: t.issuer,
      value: parseFloat(t.value) || 0,
      type:
        t.currency === "XCS"
          ? "xcs"
          : isStablecoin(t.currency)
          ? "stable"
          : "other",
    })),
    // Tokens de démo supplémentaires pour le layout
    ...[
      { currency: "BTC", issuer: "demo", value: 0.1234, type: "other" },
      { currency: "ETH", issuer: "demo", value: 2.56, type: "other" },
      { currency: "EUR.X", issuer: "demo", value: 5300, type: "stable" },
      { currency: "RLUSD", issuer: "demo", value: 12000, type: "stable" },
      { currency: "JPY.X", issuer: "demo", value: 1500000, type: "stable" },
      { currency: "USDT", issuer: "demo", value: 3400, type: "stable" },
      { currency: "USDC", issuer: "demo", value: 2750, type: "stable" },
      { currency: "GBP.X", issuer: "demo", value: 2100, type: "stable" },
      { currency: "CHF.X", issuer: "demo", value: 1800, type: "stable" },
      { currency: "XAU.X", issuer: "demo", value: 3.2, type: "other" },
    ].map((t) => ({
      key: `demo:${t.currency}`,
      currency: t.currency,
      issuer: t.issuer,
      value: t.value,
      type: t.type,
    })),
  ];

  const typeWeight = (t) => {
    if (t.type === "native") return 0;
    if (t.type === "xcs") return 1;
    if (t.type === "stable") return 2;
    return 3;
  };

  displayTokens.sort((a, b) => {
    const wa = typeWeight(a);
    const wb = typeWeight(b);
    if (wa !== wb) return wa - wb;
    return b.value - a.value;
  });

  return (
    <>
      <div className="bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden flex flex-col h-full">
        {/* Header style "wallet app" */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                Wallet
              </p>
              <p className="pt-10 text-2xl font-orbitron font-bold text-white">
                {totalLabel}
              </p>
              <p className="mt-1 text-xs text-xcannes-green">
                +0.00 · 0.00%
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-xcannes-green animate-pulse" />
                <span className="text-[10px] text-white/50">
                  {effectiveWallet.slice(0, 6)}...
                  {effectiveWallet.slice(-4)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(effectiveWallet)}
                  className="text-[10px] text-white/40 hover:text-white transition-colors"
                  title="Copy address"
                >
                  Copy
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-[10px] text-white/40 hover:text-white transition-colors disabled:opacity-50"
                  title="Refresh balance"
                >
                  <span
                    className={
                      isRefreshing ? "animate-spin inline-block" : ""
                    }
                  >
                    🔄
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="px-4 py-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: "send", label: "Send", icon: "↗" },
              { key: "receive", label: "Receive", icon: "↙" },
              { key: "swap", label: "Exchange", icon: "⇄" },
              { key: "buy", label: "Buy", icon: "+" },
            ].map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => setActiveAction(action.key)}
                className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white/5 py-2 text-[11px] text-white/80 hover:bg-white/10 transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-blue-500/80 flex items-center justify-center text-sm">
                  {action.icon}
                </span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Token list (XRP + XCS + stablecoins + autres) */}
        <div className="p-4 space-y-2 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
          {displayTokens.map((token) => {
            const isXrp = token.currency === "XRP";
            const isXcs = token.currency === "XCS";
            const isStable = token.type === "stable";

            const bgClass = isXrp
              ? "bg-blue-500/15"
              : isXcs
              ? "bg-xcannes-green/15"
              : isStable
              ? "bg-emerald-500/10"
              : "bg-white/5";

            const badgeLabel = isXrp
              ? "XRP · Native"
              : isXcs
              ? "XCANNES Token"
              : isStable
              ? "XRPL Stablecoin"
              : "XRPL Token";

            return (
              <div
                key={token.key}
                className={`${bgClass} rounded-xl px-3 py-2.5 flex items-center gap-3`}
              >
                <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-sm font-semibold text-white">
                  {token.currency[0] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {token.currency}
                  </p>
                  <p className="text-[11px] text-white/40 truncate">
                    {badgeLabel}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono text-white">
                    {formatBalance(token.value)} {token.currency}
                  </p>
                  {isStable && (
                    <p className="text-[11px] text-white/50">
                      ≈ ${formatBalance(token.value)}
                    </p>
                  )}
                  {isXrp && stableUsd > 0 && (
                    <p className="text-[11px] text-white/40">
                      + ${stableUsd.toFixed(2)} stables
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modales d'action (UI only pour l'instant) */}
      {activeAction === "send" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-5">
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h3 className="text-xl font-orbitron font-bold text-white mb-1">
              Send assets
            </h3>
            <p className="text-xs text-white/50 mb-4">
              Choisissez l&apos;actif, le montant et l&apos;adresse XRPL de destination.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-white/60 mb-1">
                  Asset
                </label>
                <select className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80">
                  {displayTokens.map((t) => (
                    <option key={t.key} value={t.currency}>
                      {t.currency}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-white/60 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0.0000"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
                />
              </div>
              <div>
                <label className="block text-[11px] text-white/60 mb-1">
                  Destination (XRPL address)
                </label>
                <input
                  type="text"
                  placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
                />
              </div>
              <button
                type="button"
                className="w-full mt-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold text-sm py-2.5 rounded-lg transition-all"
              >
                Continue (UI only)
              </button>
            </div>
          </div>
        </div>
      )}

      {activeAction === "receive" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-5">
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h3 className="text-xl font-orbitron font-bold text-white mb-1">
              Receive assets
            </h3>
            <p className="text-xs text-white/50 mb-4">
              Utilisez cette adresse XRPL pour recevoir des fonds sur votre wallet XCANNES.
            </p>
            <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-3 mb-3">
              <p className="text-[11px] text-white/60 mb-1">Wallet address</p>
              <p className="text-xs font-mono text-white break-all">
                {effectiveWallet}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(effectiveWallet)}
              className="w-full mb-2 bg-white/10 hover:bg-white/15 text-white text-sm py-2.5 rounded-lg transition-all"
            >
              Copy address
            </button>
            <p className="text-[11px] text-white/40">
              Bientôt: QR code de réception et options de réseau détaillées.
            </p>
          </div>
        </div>
      )}

      {activeAction === "swap" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-5">
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h3 className="text-xl font-orbitron font-bold text-white mb-1">
              Swap assets
            </h3>
            <p className="text-xs text-white/50 mb-4">
              Interface de swap visuel entre vos actifs (maquette UI, logique à brancher).
            </p>
            <div className="space-y-3">
              <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-3">
                <p className="text-[11px] text-white/60 mb-1">From</p>
                <div className="flex items-center gap-2">
                  <select className="flex-1 bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80">
                    {displayTokens.map((t) => (
                      <option key={t.key} value={t.currency}>
                        {t.currency}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="0.0000"
                    className="w-32 bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
                  />
                </div>
              </div>

              <div className="flex justify-center text-white/50 text-xs">
                ⇄
              </div>

              <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-3">
                <p className="text-[11px] text-white/60 mb-1">To</p>
                <div className="flex items-center gap-2">
                  <select className="flex-1 bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80">
                    {displayTokens.map((t) => (
                      <option key={`${t.key}-to`} value={t.currency}>
                        {t.currency}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Auto-calculated"
                    disabled
                    className="w-32 bg-black/40 border border-dashed border-white/15 rounded-lg px-3 py-2 text-sm text-white/50 outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                className="w-full mt-1 bg-xcannes-green/80 hover:bg-xcannes-green text-black font-semibold text-sm py-2.5 rounded-lg transition-all"
              >
                Preview swap (UI only)
              </button>
            </div>
          </div>
        </div>
      )}

      {activeAction === "buy" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-5">
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h3 className="text-xl font-orbitron font-bold text-white mb-1">
              Buy crypto
            </h3>
            <p className="text-xs text-white/50 mb-4">
              Cette interface accueillera l&apos;on-ramp (carte bancaire / virement) pour acheter des stables ou du XCS directement vers votre wallet XRPL.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-white/60 mb-1">
                  Asset to buy
                </label>
                <select className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80">
                  <option value="XCS">XCS</option>
                  <option value="RLUSD">RLUSD</option>
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-white/60 mb-1">
                  Fiat amount (placeholder)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  placeholder="100 USD"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
                />
              </div>
              <button
                type="button"
                className="w-full mt-2 bg-xcannes-green/80 hover:bg-xcannes-green text-black font-semibold text-sm py-2.5 rounded-lg transition-all"
              >
                Continue to provider (UI only)
              </button>
            </div>
          </div>
        </div>
      )}

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
