"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import WalletNotConnectedNotice from "../components/WalletNotConnectedNotice";

const WALLET_LABEL_STORAGE_KEY = "xcannes_wallet_labels";
const USD_STABLECOINS = [
  "RLUSD",
  "USD",
  "USDC",
  "USDT",
  "BUSD",
  "DAI",
  "TUSD",
  "USDP",
  "GUSD",
];

/**
 * Composant de relevé bancaire global (toutes les devises consolidées)
 */
export default function GlobalStatement({ 
  tokens = [], 
  walletAddress,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  period = "December 2025",
  isFullPage = false,
  variant = "default",
  usdRates = {},
  movements = [],
  movementsLoading = false,
  movementsError = null,
  movementsHasMore = false,
  movementsLoadingMore = false,
  onLoadMoreMovements,
  onClose,
  onViewCurrency
}) {
  const [sortBy, setSortBy] = useState("balance"); // balance, change, name
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = current month, 1 = last month, etc.

  const walletLabel = useMemo(() => {
    if (typeof window === "undefined" || !walletAddress) return "";
    try {
      const raw = localStorage.getItem(WALLET_LABEL_STORAGE_KEY);
      const labels = raw ? JSON.parse(raw) : {};
      return labels[walletAddress] || "";
    } catch (err) {
      console.error("Error loading wallet label:", err);
      return "";
    }
  }, [walletAddress]);

  // Générer les 12 derniers mois
  const generateMonths = () => {
    const months = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      months.push({
        value: i,
        label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        displayLabel: date.toLocaleDateString('en-US', { month: 'long' }) // Juste le mois pour l'affichage
      });
    }
    
    months.push({ 
      value: 'archives', 
      label: 'Archives (12+ months)',
      displayLabel: 'Archives'
    });
    return months;
  };

  const availableMonths = generateMonths();
  const currentPeriod = selectedMonth === 'archives' ? 'Archives' : availableMonths[selectedMonth]?.label || period;
  const currentDisplayPeriod = selectedMonth === 'archives' ? 'Archives' : availableMonths[selectedMonth]?.displayLabel || period.split(' ')[0]; // Affiche juste le mois

  const isUsdStablecoin = (currency) =>
    USD_STABLECOINS.includes(String(currency || "").toUpperCase());

  const getUsdValue = (token) => {
    const value = parseFloat(token.value || 0);
    if (!Number.isFinite(value)) return null;
    if (value === 0) return 0;
    const code = String(token.currency || "").toUpperCase();
    const rate = usdRates?.[code];
    if (Number.isFinite(rate)) return value * rate;
    if (isUsdStablecoin(code)) return value;
    if (code === "XRP") return value * 0.5;
    return null;
  };

  // Calculer les totaux
  const totalBalance = tokens.reduce((sum, token) => {
    const usdValue = getUsdValue(token);
    return sum + (Number.isFinite(usdValue) ? usdValue : 0);
  }, 0);

  // Trier les tokens
  const sortedTokens = [...tokens].sort((a, b) => {
    if (sortBy === "balance") {
      return parseFloat(b.value || 0) - parseFloat(a.value || 0);
    }
    if (sortBy === "name") {
      return a.currency.localeCompare(b.currency);
    }
    return 0;
  });

  const formatAmount = (amount) => {
    return parseFloat(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getCurrencyFlag = (currency) => {
    const flags = {
      EUR: "🇪🇺", USD: "🇺🇸", GBP: "🇬🇧", JPY: "🇯🇵",
      CHF: "🇨🇭", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿",
      CNY: "🇨🇳", INR: "🇮🇳", KRW: "🇰🇷", SGD: "🇸🇬",
      HKD: "🇭🇰", MXN: "🇲🇽", BRL: "🇧🇷", ZAR: "🇿🇦",
      TRY: "🇹🇷", RUB: "🇷🇺", SEK: "🇸🇪", NOK: "🇳🇴",
      DKK: "🇩🇰", PLN: "🇵🇱", THB: "🇹🇭", IDR: "🇮🇩",
      MYR: "🇲🇾", PHP: "🇵🇭", CZK: "🇨🇿", ILS: "🇮🇱",
      CLP: "🇨🇱", AED: "🇦🇪", SAR: "🇸🇦",
      XRP: "✕", RLUSD: "💵", XCS: "🪙",
      BTC: "₿", ETH: "Ξ", USDT: "₮", USDC: "💵",
      BNB: "🔶", SOL: "◎", ADA: "₳", DOGE: "Ð",
      XLM: "🚀", LINK: "⬡", DOT: "⚫", UNI: "🦄",
      MATIC: "🔷", LTC: "Ł", BCH: "₿", AVAX: "🔺",
      ATOM: "⚛️", XMR: "ɱ", TRX: "◇", ETC: "Ξ",
      AFN: "🇦🇫", ALL: "🇦🇱", DZD: "🇩🇿", AOA: "🇦🇴",
      ARS: "🇦🇷", AMD: "🇦🇲", AWG: "🇦🇼", AZN: "🇦🇿",
      BSD: "🇧🇸", BHD: "🇧🇭", BDT: "🇧🇩", BBD: "🇧🇧",
      BYN: "🇧🇾", BZD: "🇧🇿", BMD: "🇧🇲", BTN: "🇧🇹",
      BOB: "🇧🇴", BAM: "🇧🇦", BWP: "🇧🇼", BND: "🇧🇳",
      BGN: "🇧🇬", BIF: "🇧🇮", KHR: "🇰🇭", CVE: "🇨🇻",
      XAF: "🇨🇫", XOF: "🇧🇫", KMF: "🇰🇲", CDF: "🇨🇩",
      CRC: "🇨🇷", HRK: "🇭🇷", CUP: "🇨🇺", CYP: "🇨🇾",
      DJF: "🇩🇯", DOP: "🇩🇴", XCD: "🇦🇬", EGP: "🇪🇬",
      ERN: "🇪🇷", ETB: "🇪🇹", FJD: "🇫🇯", GMD: "🇬🇲",
      GEL: "🇬🇪", GHS: "🇬🇭", GTQ: "🇬🇹", GNF: "🇬🇳",
      GYD: "🇬🇾", HTG: "🇭🇹", HNL: "🇭🇳", HUF: "🇭🇺",
      ISK: "🇮🇸", IQD: "🇮🇶", JMD: "🇯🇲", JOD: "🇯🇴",
      KZT: "🇰🇿", KES: "🇰🇪", KWD: "🇰🇼", KGS: "🇰🇬",
      LAK: "🇱🇦", LBP: "🇱🇧", LSL: "🇱🇸", LRD: "🇱🇷",
      LYD: "🇱🇾", MOP: "🇲🇴", MKD: "🇲🇰", MGA: "🇲🇬",
      MWK: "🇲🇼", MVR: "🇲🇻", MRU: "🇲🇷", MUR: "🇲🇺",
      MDL: "🇲🇩", MNT: "🇲🇳", MAD: "🇲🇦", MZN: "🇲🇿",
      MMK: "🇲🇲", NAD: "🇳🇦", NPR: "🇳🇵", NIO: "🇳🇮",
      NGN: "🇳🇬", OMR: "🇴🇲", PKR: "🇵🇰", PAB: "🇵🇦",
      PGK: "🇵🇬", PYG: "🇵🇾", PEN: "🇵🇪", QAR: "🇶🇦",
      RON: "🇷🇴", RWF: "🇷🇼", WST: "🇼🇸", STN: "🇸🇹",
      RSD: "🇷🇸", SCR: "🇸🇨", SLL: "🇸🇱", SOS: "🇸🇴",
      LKR: "🇱🇰", SDG: "🇸🇩", SRD: "🇸🇷", SZL: "🇸🇿",
      SYP: "🇸🇾", TWD: "🇹🇼", TJS: "🇹🇯", TZS: "🇹🇿",
      TOP: "🇹🇴", TTD: "🇹🇹", TND: "🇹🇳", TMT: "🇹🇲",
      UGX: "🇺🇬", UAH: "🇺🇦", UYU: "🇺🇾", UZS: "🇺🇿",
      VUV: "🇻🇺", VES: "🇻🇪", VND: "🇻🇳", YER: "🇾🇪",
      ZMW: "🇿🇲", ZWL: "🇿🇼"
    };
    return flags[currency] || "💱";
  };

  const getCategoryBadge = (token) => {
    if (token.currency === "XRP") return { label: "Native", color: "blue" };
    if (token.currency === "XCS") return { label: "Platform", color: "green" };
    if (isUsdStablecoin(token.currency))
      return { label: "Stablecoin", color: "purple" };
    if (token.isTrustlineOnly) return { label: "Exchange Rate", color: "orange" };
    return { label: "Token", color: "gray" };
  };

  const STATEMENT_LAYOUTS = {
    full: {
      backdropClass: "bg-black/80 md:backdrop-blur-sm",
      wrapperClass: "items-stretch justify-center px-0 md:items-center md:px-4",
      panelClass:
        "w-full h-[100svh] max-h-[100svh] rounded-none border-0 md:max-w-5xl md:rounded-2xl md:border md:border-white/10 md:max-h-[92vh] lg:max-w-6xl",
    },
    "dex-desktop": {
      backdropClass: "bg-black/75 md:backdrop-blur-sm",
      wrapperClass: "items-center justify-center px-3 md:px-4",
      panelClass:
        "max-w-4xl lg:max-w-5xl rounded-2xl border border-white/10 max-h-[90vh]",
    },
    "dex-mobile": {
      backdropClass: "bg-black/90 md:backdrop-blur-sm",
      wrapperClass: "items-stretch justify-center px-0",
      panelClass:
        "w-full h-[100svh] max-h-[100svh] rounded-none border-0",
    },
    default: {
      backdropClass: "bg-black/80 md:backdrop-blur-sm",
      wrapperClass: "items-center justify-center px-4",
      panelClass:
        "max-w-5xl lg:max-w-6xl rounded-2xl border border-white/10 max-h-[92vh]",
    },
  };

  const resolvedLayout = STATEMENT_LAYOUTS[variant] || STATEMENT_LAYOUTS.default;

  const content = (
    <div
      className={`fixed inset-0 z-[10200] flex ${resolvedLayout.wrapperClass} ${resolvedLayout.backdropClass}`}
      onClick={(e) => {
        // Fermer uniquement si on clique sur le backdrop (pas sur le modal)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`relative w-full bg-elevated flex flex-col overflow-hidden z-[10201] ${resolvedLayout.panelClass}`}
      >
        
        {/* Header avec Account Info intégré */}
        <div className="border-b border-white/10 flex-shrink-0 bg-elevated px-4 md:px-5 py-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl flex-shrink-0">🌍</span>
              <h2 className="text-xl font-bold text-white truncate">
                Global Statement
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors text-2xl leading-none flex-shrink-0"
            >
              ✕
            </button>
          </div>

          <WalletNotConnectedNotice
            show={isPreviewMode}
            className="mb-4"
            variant={noticeVariant}
            contextLabel={noticeContextLabel}
          />
          
          {/* Account Info dans le header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-white/50 mb-1">Account Holder</p>
              <p className="text-sm text-white font-semibold truncate">
                {walletLabel || "Wallet"}
              </p>
              <p className="text-[11px] text-white/50 font-mono break-all">
                {walletAddress}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Statement Period</p>
              {/* Month Selector - simplifié */}
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value === 'archives' ? 'archives' : parseInt(e.target.value))}
                  className="statement-select w-full bg-black/40 border border-white/20 rounded-md px-3 py-1.5 text-sm text-white cursor-pointer hover:border-white/40 transition-colors appearance-none pr-8"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 8px center',
                    backgroundSize: '12px',
                  }}
                >
                  {availableMonths.map((month) => (
                    <option key={month.value} value={month.value} className="bg-[#040c13]">
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Total Assets</p>
              <p className="text-sm text-white">≈ {formatAmount(totalBalance)} USD</p>
              <p className="text-[11px] text-white/50">{tokens.length} Currencies</p>
            </div>
          </div>
        </div>

        {/* Content - Zone scrollable avec flex-1 pour prendre l'espace restant */}
        <div className="flex-1 overflow-hidden px-4 md:px-5 py-4 flex flex-col gap-4 min-h-0">

          {/* Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSortBy("balance")}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  sortBy === "balance" 
                    ? "bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green border border-xcannes-green/30" 
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                Sort by Balance
              </button>
              <button
                onClick={() => setSortBy("name")}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  sortBy === "name" 
                    ? "bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green border border-xcannes-green/30" 
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                Sort by Name
              </button>
            </div>
          </div>

          {/* Assets Table */}
          <div className="bg-black/40 rounded-lg border border-white/10 overflow-hidden flex flex-col min-h-0">
            <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto md:max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/40 backdrop-blur-sm z-10">
                  <tr className="border-b border-white/10">
                    <th className="text-left px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">Asset</th>
                    <th className="text-left px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">Type</th>
                    <th className="text-right px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">Balance</th>
                    <th className="text-right px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60 hidden md:table-cell">≈ USD Value</th>
                    <th className="text-center px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTokens.map((token, idx) => {
                    const badge = getCategoryBadge(token);
                    const usdValue = getUsdValue(token);
                    
                    return (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-3 md:px-4 py-2.5 md:py-3">
                          <div className="flex items-center gap-2">
                            {['XRP', 'RLUSD', 'XCS'].includes(token.currency) ? (
                              <Image 
                                src={`/symbols/${token.currency.toLowerCase()}.png`} 
                                alt={token.currency}
                                width={24}
                                height={24}
                                className="flex-shrink-0 w-6 h-6 rounded-md"
                              />
                            ) : (
                              <span className="text-lg sm:text-2xl flex-shrink-0">{getCurrencyFlag(token.currency)}</span>
                            )}
                            <div className="min-w-0">
                              <p className="text-white font-medium text-xs sm:text-sm truncate">{token.currency}</p>
                              <p className="text-[9px] sm:text-xs text-white/40 truncate">
                                {token.currency === "XRP" ? "Native" : token.issuer?.slice(0, 8) + "..."}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-xs font-medium whitespace-nowrap
                            ${badge.color === "blue" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : ""}
                            ${badge.color === "green" ? "bg-green-500/20 text-green-300 border border-green-500/30" : ""}
                            ${badge.color === "purple" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : ""}
                            ${badge.color === "orange" ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : ""}
                            ${badge.color === "gray" ? "bg-white/10 text-white/60 border border-white/20" : ""}
                          `}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-white font-medium text-[10px] sm:text-sm">
                          <div className="truncate">{formatAmount(token.value)}</div>
                          <div className="text-[9px] sm:text-xs text-white/50">{token.currency}</div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono text-white/70 text-[10px] sm:text-sm hidden sm:table-cell">
                          {Number.isFinite(usdValue)
                            ? `$${formatAmount(usdValue)}`
                            : "--"}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          <button
                            onClick={() => onViewCurrency && onViewCurrency(token)}
                            className="px-2 sm:px-3 py-1 bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green rounded text-[9px] sm:text-xs font-medium transition-colors border border-xcannes-green/30 whitespace-nowrap"
                          >
                            <span className="hidden sm:inline">View Statement</span>
                            <span className="sm:hidden">View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Watermark */}
          <div className="hidden sm:block text-center py-3 sm:py-4">
            <p className="text-[9px] sm:text-xs text-white/20 font-mono px-2">
              Generated on {new Date().toLocaleString("en-US")}
            </p>
          </div>
        </div>

        {!isPreviewMode &&
        (movementsError ||
          movementsLoading ||
          (Array.isArray(movements) && movements.length > 0) ||
          movementsHasMore) ? (
          <div className="border-t border-white/10 bg-black/20 px-3 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-sm font-semibold text-white/80">
                Recent activity
              </h3>
              {movementsLoading && (
                <span className="text-[10px] text-white/40">Loading…</span>
              )}
            </div>
            {movementsError && (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {movementsError}
              </div>
            )}
            {!movementsError &&
            Array.isArray(movements) &&
            movements.length > 0 ? (
              <div className="space-y-1.5">
                {movements.slice(0, 15).map((m) => {
                  const from = String(m?.fromCurrencyCode || "").toUpperCase();
                  const to = String(m?.toCurrencyCode || "").toUpperCase();
                  const amount = Number(m?.amountRlusd || 0);
                  const createdAt = m?.createdAt ? new Date(m.createdAt) : null;
                  const when =
                    createdAt && Number.isFinite(createdAt.getTime())
                      ? createdAt.toLocaleString("en-US")
                      : "";
                  return (
                    <div
                      key={m.movementId || `${when}:${from}:${to}:${amount}`}
                      className="flex items-center justify-between gap-3 rounded-md bg-black/30 border border-white/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] text-white/70 truncate">
                          {from && to ? `${from} → ${to}` : "Movement"}
                        </div>
                        <div className="text-[10px] text-white/30 truncate">
                          {when}
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-white/80">
                        {Number.isFinite(amount)
                          ? `${amount.toLocaleString("en-US", {
                              maximumFractionDigits: 6,
                            })} RLUSD`
                          : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {movementsHasMore && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onLoadMoreMovements && onLoadMoreMovements()}
                  disabled={movementsLoadingMore}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 border border-white/15 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {movementsLoadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer Actions */}
        <div className="border-t border-white/10 px-3 sm:px-6 py-3 sm:py-4 bg-black/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => alert("Export PDF functionality to be implemented")}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/15 text-white/70 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border border-white/15"
            >
              📄 Export PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/15 text-white/70 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border border-white/15"
            >
              🖨️ Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(content, document.body);
}
