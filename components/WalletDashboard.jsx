"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useXumm } from "../context/XummContext";
import XummQRModal from "./XummQRModal";
import { QRCodeCanvas } from "qrcode.react";
import { useWalletLines } from "../hooks/useWalletLines";

const TRUSTLINE_DATA = {
  issuer: "rBxQY3dc4mJtcDA5UgmLvtKsdc7vmCGgxx",
  currency: "XCS",
  limit: "2006400",
};

const RLUSD_HEX = "524C555344000000000000000000000000000000";

const TRUSTLINES_CONFIG = [
  {
    code: "XCS",
    name: "XCANNES Token",
    issuer: TRUSTLINE_DATA.issuer,
    limit: TRUSTLINE_DATA.limit,
    category: "Featured",
  },
  {
    code: "RLUSD",
    name: "RLUSD Stablecoin",
    issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
    limit: "1000000000",
    category: "Stablecoins",
  },
];

const TOKEN_ICONS = {
  XRP: "✕",
  XCS: "Ⓧ",
  BTC: "₿",
  ETH: "Ξ",
  LTC: "Ł",
  BCH: "Ƀ",
  ADA: "A",
  SOL: "S",
  DOGE: "Ð",
  USDT: "₮",
  USDC: "＄",
};

// Drapeaux pour les devises (même logique que FxPairSelector)
const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴",
  USD: "🇺🇸",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  CHF: "🇨🇭",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  NZD: "🇳🇿",
  CNY: "🇨🇳",
  INR: "🇮🇳",
  BRL: "🇧🇷",
  ZAR: "🇿🇦",
  MXN: "🇲🇽",
  SGD: "🇸🇬",
  HKD: "🇭🇰",
  KRW: "🇰🇷",
  TRY: "🇹🇷",
  RUB: "🇷🇺",
  SEK: "🇸🇪",
  NOK: "🇳🇴",
  DKK: "🇩🇰",
  PLN: "🇵🇱",
  THB: "🇹🇭",
  IDR: "🇮🇩",
  MYR: "🇲🇾",
  PHP: "🇵🇭",
  CZK: "🇨🇿",
  ILS: "🇮🇱",
  CLP: "🇨🇱",
  AED: "🇦🇪",
  SAR: "🇸🇦",
};

function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return null;
  const codePoints = [...countryCode.toUpperCase()].map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65)
  );
  return String.fromCodePoint(...codePoints);
}

function getCurrencyFlag(code) {
  if (!code) return null;
  const upper = String(code).toUpperCase();
  
  // Cas spéciaux d'abord
  if (CURRENCY_FLAG_OVERRIDES[upper]) {
    return CURRENCY_FLAG_OVERRIDES[upper];
  }
  
  // Pour la majorité des monnaies fiat, les 2 premières lettres
  // correspondent au code pays ISO (AED -> AE, KES -> KE, etc.)
  const countryGuess = upper.slice(0, 2);
  return countryCodeToFlag(countryGuess);
}

function getTokenIcon(currency) {
  if (!currency) return "?";
  const normalized = String(currency).toUpperCase();
  if (TOKEN_ICONS[normalized]) {
    return TOKEN_ICONS[normalized];
  }
  // Pour les codes type "EUR.X", "USD.X" etc., on garde la première lettre lisible
  const firstLetterMatch = normalized.match(/[A-Z]/);
  return firstLetterMatch ? firstLetterMatch[0] : "?";
}

export default function WalletDashboard({ preview = false }) {
  const { 
    wallet, 
    isConnected, 
    balance, 
    refreshBalance,
    disconnect,
    qrModalData,
    closeQrModal,
    connect,
    signTransaction,
  } = useXumm();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAction, setActiveAction] = useState(null); // 'send' | 'receive' | 'swap' | 'buy' | 'trustlines' | null
  const [trustlineSearch, setTrustlineSearch] = useState("");
  const [showRlusdDetails, setShowRlusdDetails] = useState(false);
  const [regionDropdowns, setRegionDropdowns] = useState({});
  const [sendAssetKey, setSendAssetKey] = useState("");
  const [sendDestination, setSendDestination] = useState("");
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [sendProcessing, setSendProcessing] = useState(false);

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

  // Lignes de devises internes (stockées en base)
  const {
    lines: walletLines,
    totalLockedXcs,
    loading: walletLinesLoading,
    error: walletLinesError,
    addLine,
    removeLine,
  } = useWalletLines(effectiveIsConnected ? effectiveWallet : null);

  if (!effectiveIsConnected) {
    return null; // Ne pas afficher si pas connecté (hors preview)
  }

  const handleAddWalletLine = async (currencyCode) => {
    if (!effectiveIsConnected || !effectiveWallet) {
      console.warn("Please connect your wallet first.");
      return;
    }
    try {
      await addLine(currencyCode);
    } catch (err) {
      console.error("Add wallet line error:", err);
    }
  };

  const handleRemoveWalletLine = async (currencyCode) => {
    if (!effectiveIsConnected || !effectiveWallet) {
      console.warn("Please connect your wallet first.");
      return;
    }
    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Remove line ${currencyCode} and unlock its XCS?`
          );
    if (!ok) {
      return;
    }
    try {
      await removeLine(currencyCode);
    } catch (err) {
      console.error("Remove wallet line error:", err);
    }
  };

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

  const handleAddTrustline = async (trustline) => {
    if (!isConnected || !wallet) {
      alert("Please connect your Xumm wallet first.");
      return;
    }

    try {
      const { code, issuer, limit } = trustline;
      const currency =
        code === "RLUSD"
          ? RLUSD_HEX
          : code;

      const txjson = {
        TransactionType: "TrustSet",
        Account: wallet,
        LimitAmount: {
          currency,
          issuer,
          value: String(limit),
        },
      };

      const result = await signTransaction(txjson);
      if (result && result.signed) {
        alert("✅ Trustline added or updated successfully.");
        if (refreshBalance) {
          setTimeout(() => refreshBalance(), 3000);
        }
      } else {
        alert("Trustline request was cancelled or expired.");
      }
    } catch (error) {
      console.error("Trustline error:", error);
      alert("Error while creating trustline: " + error.message);
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
  const xcsAvailable = Math.max(xcsAmount - (totalLockedXcs || 0), 0);

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
    // Tokens de démo supplémentaires pour le layout (preview uniquement)
    ...(preview
      ? [
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
        }))
      : []),
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

  const selectedSendToken =
    displayTokens.find((t) => t.key === sendAssetKey) || displayTokens[0] || null;

  const QrScannerOverlay = ({ open, onClose, onResult }) => {
    const videoRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
      if (!open) return;

      let stream;
      let cancelled = false;
      let detector;

      const start = async () => {
        try {
          if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
            setError("Camera not available on this device.");
            return;
          }

          if ("BarcodeDetector" in window) {
            detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          } else {
            setError("QR scanning not supported by this browser.");
            return;
          }

          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });

          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }

          const scanLoop = async () => {
            if (cancelled || !videoRef.current || !detector) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes.length > 0) {
                const value = (codes[0].rawValue || "").trim();
                if (value) {
                  onResult(value);
                  return;
                }
              }
            } catch {
              // ignore single-frame errors
            }
            requestAnimationFrame(scanLoop);
          };

          requestAnimationFrame(scanLoop);
        } catch (err) {
          console.error("QR scanner error:", err);
          setError("Unable to access camera.");
        }
      };

      start();

      return () => {
        cancelled = true;
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
      };
    }, [open, onResult]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
        <div className="relative w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl p-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
          <h3 className="text-lg font-orbitron font-bold text-white mb-2">
            Scan destination QR
          </h3>
          <p className="text-[11px] text-white/50 mb-3">
            Pointez la caméra vers un QR code contenant une adresse XRPL.
          </p>
          <div className="bg-black/60 rounded-xl overflow-hidden border border-white/10 mb-2">
            <video
              ref={videoRef}
              className="w-full h-64 object-cover bg-black"
              muted
              playsInline
            />
          </div>
          {error && (
            <p className="text-[11px] text-red-400">
              {error}
            </p>
          )}
          {!error && (
            <p className="text-[10px] text-white/40">
              Si le scan ne démarre pas, vérifie les permissions caméra du navigateur.
            </p>
          )}
        </div>
      </div>
    );
  };

  const handleSendSubmit = async () => {
    if (!isConnected || !wallet) {
      alert("Please connect your Xumm wallet first.");
      return;
    }
    if (!selectedSendToken) {
      alert("No asset selected.");
      return;
    }

    const amountNum = parseFloat(sendAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const dest = (sendDestination || "").trim();
    if (!dest || !dest.startsWith("r") || dest.length < 25) {
      alert("Please enter a valid XRPL destination address.");
      return;
    }

    let Amount;
    if (selectedSendToken.currency === "XRP" && selectedSendToken.issuer === "Native") {
      Amount = Math.round(amountNum * 1_000_000).toString();
    } else {
      const normalized = amountNum.toFixed(8).replace(/\.?0+$/, "") || "0";
      Amount = {
        currency: selectedSendToken.currency,
        issuer: selectedSendToken.issuer,
        value: normalized,
      };
    }

    const txjson = {
      TransactionType: "Payment",
      Account: wallet,
      Destination: dest,
      Amount,
    };

    setSendProcessing(true);
    try {
      const result = await signTransaction(txjson);
      if (result && result.signed) {
        alert("✅ Payment submitted via Xumm.");
        setSendAmount("");
        setSendDestination("");
        if (refreshBalance) {
          setTimeout(() => refreshBalance(), 3000);
        }
        setActiveAction(null);
      } else {
        alert("Transaction cancelled or expired.");
      }
    } catch (err) {
      console.error("Send payment error:", err);
      alert("Error while preparing payment: " + (err?.message || String(err)));
    } finally {
      setSendProcessing(false);
    }
  };

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header style "wallet app" */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {/* Bouton Connect - SMARTPHONE UNIQUEMENT - Au-dessus du dropdown */}
              {preview && !isConnected && (
                <button
                  type="button"
                  onClick={connect}
                  className="mb-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#3052ef] text-white text-sm font-semibold hover:bg-[#2642d4] transition-all md:hidden"
                >
                  <span>Connect with Xumm</span>
                </button>
              )}
              {/* Dropdown sélection de wallet avec adresse - SMARTPHONE */}
              <div className="relative md:hidden">
                <div className="flex items-center gap-2 px-2 py-1 bg-transparent border border-white/20 rounded hover:border-white/40 focus-within:border-xcannes-green transition-all">
                  <span className="w-2 h-2 rounded-full bg-xcannes-green animate-pulse flex-shrink-0" />
                  <select className="flex-1 text-xs uppercase tracking-[0.18em] text-white/80 bg-transparent focus:outline-none appearance-none cursor-pointer pr-4">
                    <option value="current" className="bg-gray-900">
                      {effectiveWallet.slice(0, 6)}...{effectiveWallet.slice(-4)}
                    </option>
                    <option value="wallet2" className="bg-gray-900">Add Wallet #2</option>
                    <option value="wallet3" className="bg-gray-900">Add Wallet #3</option>
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {/* Label Wallet + Dropdown - DESKTOP */}
              <div className="hidden md:block">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-1">
                  Wallet
                </p>
                <div className="relative">
                  <div className="flex items-center gap-2 px-2 py-1 bg-transparent border border-white/20 rounded hover:border-white/40 focus-within:border-xcannes-green transition-all">
                    <span className="w-2 h-2 rounded-full bg-xcannes-green animate-pulse flex-shrink-0" />
                    <select className="flex-1 text-[10px] uppercase tracking-wider text-white/80 bg-transparent focus:outline-none appearance-none cursor-pointer pr-4">
                      <option value="current" className="bg-gray-900">
                        {effectiveWallet.slice(0, 6)}...{effectiveWallet.slice(-4)}
                      </option>
                      <option value="wallet2" className="bg-gray-900">Add Wallet #2</option>
                      <option value="wallet3" className="bg-gray-900">Add Wallet #3</option>
                    </select>
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <p className="pt-10 text-2xl font-orbitron font-bold text-white">
                {totalLabel}
              </p>
              <p className="mt-1 text-xs text-xcannes-green">
                +0.00 · 0.00%
              </p>
            </div>
            {/* Adresse wallet + actions (Copy/Refresh) - DESKTOP UNIQUEMENT */}
            <div className="hidden md:flex flex-col items-end gap-1">
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
          <div className="grid grid-cols-5 gap-2">
            {[
              { key: "send", label: "Send", icon: "↗" },
              { key: "receive", label: "Receive", icon: "↙" },
              { key: "swap", label: "Exchange", icon: "⇄" },
              { key: "buy", label: "Buy", icon: "+" },
              { key: "trustlines", label: "Trustlines", icon: "◎" },
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

            // Obtenir le drapeau pour les devises
            const currencyFlag = getCurrencyFlag(token.currency);
            
            // Fond neutre par défaut, ou transparent si on a un drapeau
            const bgClass = currencyFlag ? "bg-black/20" : (isXrp ? "bg-blue-500/15" : isXcs ? "bg-xcannes-green/15" : "bg-white/5");

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
                className={`${bgClass} rounded-xl px-3 py-2.5 flex items-center gap-3 relative overflow-hidden`}
              >
                {/* Drapeau en arrière-plan PLEIN ÉCRAN - subtil */}
                {currencyFlag && (
                  <>
                    {/* Mobile */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center select-none pointer-events-none md:hidden"
                      style={{ 
                        fontSize: '140px',
                        lineHeight: '1',
                        opacity: token.currency === 'EUR' ? '0.16' : '0.12',
                        filter: 'grayscale(0.3) brightness(0.7)',
                        transform: 'rotate(-12deg) scale(1.8)',
                      }}
                    >
                      {currencyFlag}
                    </div>
                    {/* Desktop - plus foncé */}
                    <div 
                      className="hidden md:flex absolute inset-0 items-center justify-center select-none pointer-events-none"
                      style={{ 
                        fontSize: '140px',
                        lineHeight: '1',
                        opacity: token.currency === 'EUR' ? '0.12' : '0.08',
                        filter: 'grayscale(0.4) brightness(0.6)',
                        transform: 'rotate(-12deg) scale(1.8)',
                      }}
                    >
                      {currencyFlag}
                    </div>
                  </>
                )}
                <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-lg font-semibold text-white relative z-10">
                  {currencyFlag || getTokenIcon(token.currency)}
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <p className="text-sm text-white truncate">
                    {token.currency}
                  </p>
                  <p className="text-[11px] text-white/40 truncate">
                    {badgeLabel}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 relative z-10">
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
                <select
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
                  value={selectedSendToken ? selectedSendToken.key : ""}
                  onChange={(e) => setSendAssetKey(e.target.value)}
                >
                  {displayTokens.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.currency}
                    </option>
                  ))}
                </select>
                {selectedSendToken && (
                  <p className="mt-1 text-[11px] text-white/40">
                    Balance:&nbsp;
                    <span className="text-white/70">
                      {formatBalance(selectedSendToken.value)} {selectedSendToken.currency}
                    </span>
                  </p>
                )}
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
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
                />
              </div>
              <div>
                <label className="block text-[11px] text-white/60 mb-1">
                  Destination (XRPL address)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sendDestination}
                    onChange={(e) => setSendDestination(e.target.value)}
                    placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
                  />
                  {/* Bouton Scan QR - surtout pour mobile */}
                  <button
                    type="button"
                    onClick={() => setShowQrScanner(true)}
                    className="md:hidden flex-shrink-0 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-[11px] text-white/80 hover:bg-white/15 transition-colors"
                  >
                    Scan
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-white/40">
                  Collez l&apos;adresse ou scannez un QR code (mobile).
                </p>
              </div>
              <button
                type="button"
                onClick={handleSendSubmit}
                disabled={sendProcessing}
                className="w-full mt-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold text-sm py-2.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendProcessing ? "Sending with Xumm..." : "Send with Xumm"}
              </button>
            </div>
          </div>
          <QrScannerOverlay
            open={showQrScanner}
            onClose={() => setShowQrScanner(false)}
            onResult={(value) => {
              setSendDestination(value);
              setShowQrScanner(false);
            }}
          />
        </div>
      )}

      {activeAction === "trustlines" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h3 className="text-xl font-orbitron font-bold text-white mb-1 pr-8">
              Trustlines
            </h3>
            {/* Search bubble en premier */}
            <div className="mb-3">
              <div className="relative">
                <input
                  type="text"
                  value={trustlineSearch}
                  onChange={(e) => setTrustlineSearch(e.target.value)}
                  placeholder="Search token code or name…"
                  className="w-full bg-black/60 border border-white/15 rounded-full px-3 py-2 pl-9 text-xs sm:text-sm text-white placeholder:text-white/30 outline-none focus:border-xcannes-green"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">
                  🔍
                </span>
              </div>
            </div>

            <p className="text-[11px] text-white/50 mb-3">
              Ajoutez vos trustlines :
            </p>

            {/* RLUSD + XCS en priorité (ligne simple + bouton Add) */}
            <div className="space-y-1 mb-4">
              {TRUSTLINES_CONFIG.slice(0, 2).map((tl) => {
                const isRlusd = tl.code === "RLUSD";
                const subtitle = isRlusd ? "USD régulé" : tl.name;
                return (
                  <div key={tl.code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm text-white/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">
                          {getTokenIcon(tl.code)}
                        </span>
                        <span className="font-semibold truncate">
                          {tl.code} {tl.code === "XCS" ? "Xcannes" : ""}
                        </span>
                        <span className="text-[11px] text-white/50 truncate">
                          {subtitle}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddTrustline(tl)}
                        className="px-3 py-1 rounded-full bg-xcannes-green text-black text-[10px] font-semibold hover:bg-xcannes-green/90 transition-colors flex-shrink-0"
                      >
                        Add
                      </button>
                    </div>

                    {isRlusd && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowRlusdDetails((prev) => !prev)}
                          className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80 transition-colors"
                        >
                          <span>{showRlusdDetails ? "▼" : "▶"}</span>
                          <span>Trustlines list</span>
                        </button>
                        {showRlusdDetails && (
                          <div className="ml-5 text-[11px] text-white/40 space-y-0.5">
                            {[
                              "Europe - Northern",
                              "Europe - Western",
                              "Europe - Southern",
                              "Europe - Eastern",
                              "Americas - Northern",
                              "Americas - Central",
                              "Americas - Caribbean",
                              "Americas - Southern",
                              "Asia - Western",
                              "Asia - Central",
                              "Asia - Southern",
                              "Asia - Eastern",
                              "Asia - South-Eastern",
                              "Oceania - Australia & New Zealand",
                              "Oceania - Melanesia",
                              "Oceania - Polynesia",
                              "Africa - Northern",
                              "Africa - Western",
                              "Africa - Central",
                              "Africa - Eastern",
                              "Africa - Southern",
                            ].map((region) => {
                              const isOpen = regionDropdowns[region];
                              return (
                                <div key={region} className="space-y-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRegionDropdowns((prev) => ({
                                        ...prev,
                                        [region]: !isOpen,
                                      }))
                                    }
                                    className="flex items-center gap-1 text-white/60 hover:text-white/90"
                                  >
                                    <span>{isOpen ? "▼" : "▶"}</span>
                                    <span>{region}</span>
                                  </button>
                                  {isOpen && (
                                    <div className="ml-5 text-[10px] text-white/35 italic space-y-0.5">
                                      {region === "Europe - Northern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">DKK</span>
                                            <span>Danish Krone</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">GGP</span>
                                            <span>Guernsey Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">IMP</span>
                                            <span>Isle of Man Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ISK</span>
                                            <span>Icelandic Krona</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">NOK</span>
                                            <span>Norwegian Krone</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SEK</span>
                                            <span>Swedish Krona</span>
                                          </div>
                                        </>
                                      ) : region === "Europe - Western" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BEF</span>
                                            <span>Belgian Franc</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CHF</span>
                                            <span>Swiss Franc</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleAddWalletLine("EUR")}
                                            className="flex gap-2 text-left text-white/70 hover:text-white/100"
                                          >
                                            <span className="font-semibold text-white/80">EUR</span>
                                            <span>Euro · add line</span>
                                          </button>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">FRF</span>
                                            <span>French Franc</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">GBP</span>
                                            <span>British Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">IEP</span>
                                            <span>Irish Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">LUF</span>
                                            <span>Luxembourg Franc</span>
                                          </div>
                                        </>
                                      ) : region === "Europe - Southern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ALL</span>
                                            <span>Albanian Lek</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CYP</span>
                                            <span>Cypriot Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">GIP</span>
                                            <span>Gibraltar Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">HRK</span>
                                            <span>Croatian Kuna</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ITL</span>
                                            <span>Italian Lira</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MKD</span>
                                            <span>Macedonian Denar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MTL</span>
                                            <span>Maltese Lira</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">PTE</span>
                                            <span>Portuguese Escudo</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">RSD</span>
                                            <span>Serbian Dinar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">TRY</span>
                                            <span>Turkish Lira</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">VAL</span>
                                            <span>Vatican City Lira</span>
                                          </div>
                                        </>
                                      ) : region === "Europe - Eastern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BGN</span>
                                            <span>Bulgarian Lev</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BYN</span>
                                            <span>Belarusian Ruble</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BYR</span>
                                            <span>Belarusian Ruble</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CZK</span>
                                            <span>Czech Koruna</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">HUF</span>
                                            <span>Hungarian Forint</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MDL</span>
                                            <span>Moldovan Leu</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">PLN</span>
                                            <span>Polish Zloty</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ROL</span>
                                            <span>Romanian Leu</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">RON</span>
                                            <span>Romanian Leu</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">RUB</span>
                                            <span>Russian Ruble</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SKK</span>
                                            <span>Slovak Koruna</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">UAH</span>
                                            <span>Ukrainian Hryvnia</span>
                                          </div>
                                        </>
                                      ) : region === "Americas - Northern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CAD</span>
                                            <span>Canadian Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">USD</span>
                                            <span>US Dollar</span>
                                          </div>
                                        </>
                                      ) : region === "Americas - Central" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BZD</span>
                                            <span>Belizean Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CRC</span>
                                            <span>Costa Rican Colon</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">GTQ</span>
                                            <span>Guatemalan Quetzal</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">HNL</span>
                                            <span>Honduran Lempira</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">NIO</span>
                                            <span>Nicaraguan Cordoba</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">PAB</span>
                                            <span>Panamanian Balboa</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SVC</span>
                                            <span>Salvadoran Colon</span>
                                          </div>
                                        </>
                                      ) : region === "Americas - Caribbean" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BBD</span>
                                            <span>Barbadian or Bajan Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BMD</span>
                                            <span>Bermudian Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BSD</span>
                                            <span>Bahamian Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CUC</span>
                                            <span>Cuban Convertible Peso</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CUP</span>
                                            <span>Cuban Peso</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">DOP</span>
                                            <span>Dominican Peso</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">HTG</span>
                                            <span>Haitian Gourde</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">JMD</span>
                                            <span>Jamaican Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">KYD</span>
                                            <span>Caymanian Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">TTD</span>
                                            <span>Trinidadian Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">XCD</span>
                                            <span>East Caribbean Dollar</span>
                                          </div>
                                        </>
                                      ) : region === "Americas - Southern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ARS</span>
                                            <span>Argentine Peso</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BRL</span>
                                            <span>Brazilian Real</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CLP</span>
                                            <span>Chilean Peso</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">COP</span>
                                            <span>Colombian Peso</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">FKP</span>
                                            <span>Falkland Island Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">GYD</span>
                                            <span>Guyanese Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">PEN</span>
                                            <span>Peruvian Sol</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SRD</span>
                                            <span>Surinamese Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">UYU</span>
                                            <span>Uruguayan Peso</span>
                                          </div>
                                        </>
                                      ) : region === "Asia - Western" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">AED</span>
                                            <span>Emirati Dirham</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BHD</span>
                                            <span>Bahraini Dinar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ILS</span>
                                            <span>Israeli Shekel</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">IQD</span>
                                            <span>Iraqi Dinar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">JOD</span>
                                            <span>Jordanian Dinar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">KWD</span>
                                            <span>Kuwaiti Dinar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">OMR</span>
                                            <span>Omani Rial</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">QAR</span>
                                            <span>Qatari Riyal</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SAR</span>
                                            <span>Saudi Arabian Riyal</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SYP</span>
                                            <span>Syrian Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">YER</span>
                                            <span>Yemeni Rial</span>
                                          </div>
                                        </>
                                      ) : region === "Asia - Central" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">AMD</span>
                                            <span>Armenian Dram</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">AZN</span>
                                            <span>Azerbaijan Manat</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">GEL</span>
                                            <span>Georgian Lari</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">KGS</span>
                                            <span>Kyrgyzstani Som</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">KZT</span>
                                            <span>Kazakhstani Tenge</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">TJS</span>
                                            <span>Tajikistani Somoni</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">TMM</span>
                                            <span>Turkmenistani Manat</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">TMT</span>
                                            <span>Turkmenistani Manat</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">UZS</span>
                                            <span>Uzbekistani Som</span>
                                          </div>
                                        </>
                                      ) : region === "Asia - Southern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">AFN</span>
                                            <span>Afghan Afghani</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BTN</span>
                                            <span>Bhutanese Ngultrum</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">INR</span>
                                            <span>Indian Rupee</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">LKR</span>
                                            <span>Sri Lankan Rupee</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MVR</span>
                                            <span>Maldivian Rufiyaa</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">NPR</span>
                                            <span>Nepalese Rupee</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">PKR</span>
                                            <span>Pakistani Rupee</span>
                                          </div>
                                        </>
                                      ) : region === "Asia - Eastern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CNH</span>
                                            <span>Chinese Yuan Renminbi Offshore</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CNY</span>
                                            <span>Chinese Yuan Renminbi</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">HKD</span>
                                            <span>Hong Kong Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">JPY</span>
                                            <span>Japanese Yen</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">KRW</span>
                                            <span>South Korean Won</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MOP</span>
                                            <span>Macau Pataca</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">TWD</span>
                                            <span>Taiwan New Dollar</span>
                                          </div>
                                        </>
                                      ) : region === "Asia - South-Eastern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BND</span>
                                            <span>Bruneian Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">KHR</span>
                                            <span>Cambodian Riel</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">LAK</span>
                                            <span>Lao Kip</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MMK</span>
                                            <span>Burmese Kyat</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MYR</span>
                                            <span>Malaysian Ringgit</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">PHP</span>
                                            <span>Philippine Peso</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SGD</span>
                                            <span>Singapore Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">THB</span>
                                            <span>Thai Baht</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">VND</span>
                                            <span>Vietnamese Dong</span>
                                          </div>
                                        </>
                                      ) : region === "Oceania - Australia & New Zealand" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">AUD</span>
                                            <span>Australian Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">NZD</span>
                                            <span>New Zealand Dollar</span>
                                          </div>
                                        </>
                                      ) : region === "Oceania - Melanesia" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">FJD</span>
                                            <span>Fijian Dollar</span>
                                          </div>
                                        </>
                                      ) : region === "Oceania - Polynesia" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SBD</span>
                                            <span>Solomon Islander Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">TVD</span>
                                            <span>Tuvaluan Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">XPF</span>
                                            <span>CFP Franc</span>
                                          </div>
                                        </>
                                      ) : region === "Africa - Northern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">DZD</span>
                                            <span>Algerian Dinar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">EGP</span>
                                            <span>Egyptian Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">LYD</span>
                                            <span>Libyan Dinar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MAD</span>
                                            <span>Moroccan Dirham</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SDD</span>
                                            <span>Sudanese Dinar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SDG</span>
                                            <span>Sudanese Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">TND</span>
                                            <span>Tunisian Dinar</span>
                                          </div>
                                        </>
                                      ) : region === "Africa - Western" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CVE</span>
                                            <span>Cape Verdean Escudo</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">GHC</span>
                                            <span>Ghanaian Cedi</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">GHS</span>
                                            <span>Ghanaian Cedi</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">GMD</span>
                                            <span>Gambian Dalasi</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">GNF</span>
                                            <span>Guinean Franc</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">LRD</span>
                                            <span>Liberian Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MRU</span>
                                            <span>Mauritanian Ouguiya</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">NGN</span>
                                            <span>Nigerian Naira</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SHP</span>
                                            <span>Saint Helenian Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SLE</span>
                                            <span>Sierra Leonean Leone</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SLL</span>
                                            <span>Sierra Leonean Leone</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">XOF</span>
                                            <span>CFA Franc</span>
                                          </div>
                                        </>
                                      ) : region === "Africa - Central" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">CDF</span>
                                            <span>Congolese Franc</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">STD</span>
                                            <span>Sao Tomean Dobra</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">STN</span>
                                            <span>Sao Tomean Dobra</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">XAF</span>
                                            <span>Central African CFA Franc BEAC</span>
                                          </div>
                                        </>
                                      ) : region === "Africa - Eastern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BIF</span>
                                            <span>Burundian Franc</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">DJF</span>
                                            <span>Djiboutian Franc</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ETB</span>
                                            <span>Ethiopian Birr</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">KES</span>
                                            <span>Kenyan Shilling</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">KMF</span>
                                            <span>Comorian Franc</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MUR</span>
                                            <span>Mauritian Rupee</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">RWF</span>
                                            <span>Rwandan Franc</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SOS</span>
                                            <span>Somali Shilling</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SSP</span>
                                            <span>South Sudanese Pound</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">TZS</span>
                                            <span>Tanzanian Shilling</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">UGX</span>
                                            <span>Ugandan Shilling</span>
                                          </div>
                                        </>
                                      ) : region === "Africa - Southern" ? (
                                        <>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">AOA</span>
                                            <span>Angolan Kwanza</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">BWP</span>
                                            <span>Botswana Pula</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MGA</span>
                                            <span>Malagasy Ariary</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MGF</span>
                                            <span>Malagasy Franc</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MWK</span>
                                            <span>Malawian Kwacha</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">MZN</span>
                                            <span>Mozambican Metical</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">NAD</span>
                                            <span>Namibian Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SCR</span>
                                            <span>Seychellois Rupee</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">SZL</span>
                                            <span>Swazi Lilangeni</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ZAR</span>
                                            <span>South African Rand</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ZMK</span>
                                            <span>Zambian Kwacha</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ZMW</span>
                                            <span>Zambian Kwacha</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ZWD</span>
                                            <span>Zimbabwean Dollar</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="font-semibold text-white/80">ZWL</span>
                                            <span>Zimbabwean Dollar</span>
                                          </div>
                                        </>
                                      ) : (
                                        <span>Trustlines à venir pour cette région.</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Liste supplémentaire supprimée (autres trustlines disponibles) */}
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
              Utilisez ce QR code ou l&apos;adresse XRPL ci-dessous pour recevoir des fonds sur votre wallet XCANNES.
            </p>

            <div className="flex flex-col items-center mb-4">
              <div className="bg-white rounded-xl p-3 mb-3">
                <QRCodeCanvas
                  value={effectiveWallet || ""}
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  includeMargin={false}
                />
              </div>
              <p className="text-[11px] text-white/60 text-center max-w-xs">
                Scan depuis votre application XRPL compatible (Xumm, etc.) ou copiez l&apos;adresse ci-dessous.
              </p>
            </div>

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
          qrUrl={qrModalData.qrUrl}
          deepLink={qrModalData.deepLink}
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
