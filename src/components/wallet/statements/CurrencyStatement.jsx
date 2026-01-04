"use client";

import { useEffect, useMemo, useState } from "react";
	import { createPortal } from "react-dom";
	import { QRCodeCanvas } from "qrcode.react";
	import Image from "next/image";
	import { getCurrencyDescription } from "@/utils/currencyDescriptions";

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
 * Composant de relevé bancaire pour une devise spécifique
 */
export default function CurrencyStatement({ 
  currency, 
  balance, 
  issuer,
  walletAddress,
  transactions = [],
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  period = "December 2025",
  isFullPage = false,
  variant = "default",
  usdRates = {},
  onClose 
}) {
  const [filter, setFilter] = useState("all"); // all, credit, debit, conversion
  const [exportFormat, setExportFormat] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = current month, 1 = last month, etc.
  const [isMobileDate, setIsMobileDate] = useState(variant === "dex-mobile");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      setIsMobileDate(window.innerWidth < 640);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
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

  const estimatedUsd = useMemo(() => {
    const value = Number.parseFloat(balance || 0) || 0;
    const code = String(currency || "").toUpperCase();
    if (!code) return value;
    const rate = usdRates?.[code];
    if (Number.isFinite(rate)) return value * rate;
    if (USD_STABLECOINS.includes(code)) return value;
    if (code === "XRP") return value * 0.5;
    return value;
  }, [balance, currency, usdRates]);

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


  // Calculer les statistiques
  const credits = transactions.filter(t => t.type === "credit");
  const debits = transactions.filter(t => t.type === "debit");
  
  const totalCredits = credits.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const totalDebits = debits.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  
  const openingBalance = balance - totalCredits + totalDebits;
  const closingBalance = balance;
  const netChange = closingBalance - openingBalance;
  const percentChange = openingBalance !== 0 ? ((netChange / openingBalance) * 100) : 0;

  // Statistiques supplémentaires
  const avgTransaction = transactions.length > 0 ? (totalCredits + totalDebits) / transactions.length : 0;
  const largestTransaction = transactions.reduce((max, t) => {
    const amount = parseFloat(t.amount || 0);
    return amount > max ? amount : max;
  }, 0);
  
  // Catégorisation par type
  const transactionsByCategory = transactions.reduce((acc, tx) => {
    const cat = tx.category || 'other';
    if (!acc[cat]) acc[cat] = { count: 0, amount: 0 };
    acc[cat].count++;
    acc[cat].amount += parseFloat(tx.amount || 0);
    return acc;
  }, {});

  // Données pour graphiques (fictives basées sur les transactions)
  const monthlyData = [
    { day: '01', balance: openingBalance * 0.95 },
    { day: '05', balance: openingBalance * 0.92 },
    { day: '10', balance: openingBalance * 0.98 },
    { day: '15', balance: openingBalance * 1.05 },
    { day: '20', balance: openingBalance * 1.02 },
    { day: '25', balance: openingBalance * 1.08 },
    { day: '28', balance: closingBalance },
  ];

  // Filtrer les transactions
  const filteredTransactions = transactions.filter(t => {
    if (filter === "credit") return t.type === "credit";
    if (filter === "debit") return t.type === "debit";
    if (filter === "conversion") return t.category === "exchange";
    return true;
  });

  // Fonction d'export PDF (simulation)
  const handleExport = (format) => {
    setExportFormat(format);
    setTimeout(() => {
      alert(`Export ${format.toUpperCase()} en cours... (fonctionnalité à implémenter)`);
      setExportFormat(null);
    }, 500);
  };

  // Icône par type de transaction
  const getTransactionIcon = (category) => {
    const icons = {
      buy: "+",
      sell: "−",
    };
    return icons[category] || null;
  };

  // Fonction pour obtenir le drapeau de la devise
  const getCurrencyFlag = (curr) => {
    const flags = {
      // Devises fiat - Monde entier
      "USD": "🇺🇸", // Dollar américain
      "EUR": "🇪🇺", // Euro
      "GBP": "🇬🇧", // Livre sterling
      "JPY": "🇯🇵", // Yen japonais
      "CHF": "🇨🇭", // Franc suisse
      "CAD": "🇨🇦", // Dollar canadien
      "AUD": "🇦🇺", // Dollar australien
      "CNY": "🇨🇳", // Yuan chinois
      "INR": "🇮🇳", // Roupie indienne
      "BRL": "🇧🇷", // Real brésilien
      "MXN": "🇲🇽", // Peso mexicain
      "KRW": "🇰🇷", // Won sud-coréen
      "RUB": "🇷🇺", // Rouble russe
      "ZAR": "🇿🇦", // Rand sud-africain
      "SGD": "🇸🇬", // Dollar de Singapour
      "HKD": "🇭🇰", // Dollar de Hong Kong
      "NOK": "🇳🇴", // Couronne norvégienne
      "SEK": "🇸🇪", // Couronne suédoise
      "DKK": "🇩🇰", // Couronne danoise
      "PLN": "🇵🇱", // Zloty polonais
      "TRY": "🇹🇷", // Livre turque
      "AED": "🇦🇪", // Dirham des EAU
      "SAR": "🇸🇦", // Riyal saoudien
      "THB": "🇹🇭", // Baht thaïlandais
      "IDR": "🇮🇩", // Roupie indonésienne
      "MYR": "🇲🇾", // Ringgit malaisien
      "PHP": "🇵🇭", // Peso philippin
      "NZD": "🇳🇿", // Dollar néo-zélandais
      "ARS": "🇦🇷", // Peso argentin
      "CLP": "🇨🇱", // Peso chilien
      "COP": "🇨🇴", // Peso colombien
      "PEN": "🇵🇪", // Sol péruvien
      "EGP": "🇪🇬", // Livre égyptienne
      "NGN": "🇳🇬", // Naira nigérian
      "KES": "🇰🇪", // Shilling kényan
      "GHS": "🇬🇭", // Cedi ghanéen
      "MAD": "🇲🇦", // Dirham marocain
      "TND": "🇹🇳", // Dinar tunisien
      
      // Afrique
      "XOF": "🇸🇳", // Franc CFA (Sénégal)
      "XAF": "🇨🇲", // Franc CFA (Cameroun)
      "UGX": "🇺🇬", // Shilling ougandais
      "TZS": "🇹🇿", // Shilling tanzanien
      "ETB": "🇪🇹", // Birr éthiopien
      "MUR": "🇲🇺", // Roupie mauricienne
      "BWP": "🇧🇼", // Pula botswanais
      "ZMW": "🇿🇲", // Kwacha zambien
      "AOA": "🇦🇴", // Kwanza angolais
      "MZN": "🇲🇿", // Metical mozambicain
      
      // Amérique Latine
      "VES": "🇻🇪", // Bolivar vénézuélien
      "UYU": "🇺🇾", // Peso uruguayen
      "PYG": "🇵🇾", // Guarani paraguayen
      "BOB": "🇧🇴", // Boliviano bolivien
      "CRC": "🇨🇷", // Colon costaricain
      "GTQ": "🇬🇹", // Quetzal guatémaltèque
      "HNL": "🇭🇳", // Lempira hondurien
      "NIO": "🇳🇮", // Cordoba nicaraguayen
      "PAB": "🇵🇦", // Balboa panaméen
      "DOP": "🇩🇴", // Peso dominicain
      "HTG": "🇭🇹", // Gourde haïtienne
      "JMD": "🇯🇲", // Dollar jamaïcain
      "TTD": "🇹🇹", // Dollar de Trinité-et-Tobago
      
      // Asie-Pacifique
      "VND": "🇻🇳", // Dong vietnamien
      "LAK": "🇱🇦", // Kip laotien
      "KHR": "🇰🇭", // Riel cambodgien
      "MMK": "🇲🇲", // Kyat birman
      "BDT": "🇧🇩", // Taka bangladais
      "PKR": "🇵🇰", // Roupie pakistanaise
      "LKR": "🇱🇰", // Roupie srilankaise
      "NPR": "🇳🇵", // Roupie népalaise
      "AFN": "🇦🇫", // Afghani afghan
      "MNT": "🇲🇳", // Tugrik mongol
      "KZT": "🇰🇿", // Tenge kazakh
      "UZS": "🇺🇿", // Som ouzbek
      "TJS": "🇹🇯", // Somoni tadjik
      "KGS": "🇰🇬", // Som kirghiz
      "TWD": "🇹🇼", // Dollar taïwanais
      
      // Moyen-Orient
      "ILS": "🇮🇱", // Shekel israélien
      "JOD": "🇯🇴", // Dinar jordanien
      "KWD": "🇰🇼", // Dinar koweïtien
      "BHD": "🇧🇭", // Dinar bahreïni
      "OMR": "🇴🇲", // Rial omanais
      "QAR": "🇶🇦", // Riyal qatari
      "IQD": "🇮🇶", // Dinar irakien
      "SYP": "🇸🇾", // Livre syrienne
      "LBP": "🇱🇧", // Livre libanaise
      "YER": "🇾🇪", // Rial yéménite
      
      // Europe de l'Est et autres
      "CZK": "🇨🇿", // Couronne tchèque
      "HUF": "🇭🇺", // Forint hongrois
      "RON": "🇷🇴", // Leu roumain
      "BGN": "🇧🇬", // Lev bulgare
      "HRK": "🇭🇷", // Kuna croate
      "RSD": "🇷🇸", // Dinar serbe
      "UAH": "🇺🇦", // Hryvnia ukrainienne
      "BYN": "🇧🇾", // Rouble biélorusse
      "GEL": "🇬🇪", // Lari géorgien
      "AMD": "🇦🇲", // Dram arménien
      "AZN": "🇦🇿", // Manat azerbaïdjanais
      "MDL": "🇲🇩", // Leu moldave
      "ALL": "🇦🇱", // Lek albanais
      "MKD": "🇲🇰", // Denar macédonien
      "BAM": "🇧🇦", // Mark convertible bosniaque
      "ISK": "🇮🇸", // Couronne islandaise
      
      // Océanie et autres
      "FJD": "🇫🇯", // Dollar fidjien
      "PGK": "🇵🇬", // Kina papouasien
      "WST": "🇼🇸", // Tala samoan
      "TOP": "🇹🇴", // Pa'anga tongien
      "VUV": "🇻🇺", // Vatu vanuatais
      
      // Stablecoins et tokens fiat
      "RLUSD": "🔵", // Ripple USD (Stablecoin)
      "BUSD": "🟡", // Binance USD
      "DAI": "🟠", // DAI Stablecoin
      "TUSD": "🔷", // TrueUSD
      "USDP": "⚪", // Pax Dollar
      "GUSD": "💚", // Gemini Dollar
      "USDD": "⚫", // USDD Stablecoin
      "FRAX": "🔲", // Frax
      "LUSD": "🟦", // Liquity USD
      "sUSD": "🔶", // Synthetix USD
      
      // Cryptomonnaies
      "XRP": "⚡", // XRP Ledger
      "BTC": "₿",  // Bitcoin
      "ETH": "Ξ",  // Ethereum
      "USDT": "₮", // Tether
      "USDC": "🔵", // USD Coin
      "BNB": "🔶", // Binance Coin
      "SOL": "◎",  // Solana
      "ADA": "₳",  // Cardano
      "DOGE": "Ð",  // Dogecoin
      "MATIC": "🟣", // Polygon
      "DOT": "⬤",  // Polkadot
      "LINK": "🔗", // Chainlink
      "AVAX": "🔺", // Avalanche
      "UNI": "🦄", // Uniswap
      "ATOM": "⚛️",  // Cosmos
      "XLM": "🚀", // Stellar
      "ALGO": "◬",  // Algorand
      "VET": "💎", // VeChain
      "ICP": "∞",  // Internet Computer
      "FIL": "📁", // Filecoin
      "NEAR": "Ⓝ",  // Near Protocol
      "APT": "🅰️",  // Aptos
      "ARB": "🔷", // Arbitrum
      "OP": "🔴",  // Optimism
      "SAND": "🏖️", // The Sandbox
      "MANA": "🎮", // Decentraland
      "XCS": "🌟", // Xcannes Coin
      "SHIB": "🐕", // Shiba Inu
      "TRX": "🔺", // Tron
      "LTC": "Ł",  // Litecoin
      "BCH": "₿",  // Bitcoin Cash
      "XMR": "ɱ",  // Monero
      "ETC": "Ξ",  // Ethereum Classic
      "XTZ": "ꜩ",  // Tezos
      "EOS": "🔷", // EOS
      "AAVE": "👻", // Aave
      "MKR": "Ⓜ️",  // Maker
      "COMP": "🏦", // Compound
      "SNX": "🔷", // Synthetix
      "CRV": "🌊", // Curve
      "SUSHI": "🍣", // SushiSwap
      "YFI": "💼", // Yearn Finance
      "BAT": "🦇", // Basic Attention Token
      "ZRX": "Ⓩ",  // 0x
      "ENJ": "🎮", // Enjin Coin
      "CHZ": "⚽", // Chiliz
      "THETA": "📺", // Theta
      "FTM": "👻", // Fantom
      "HBAR": "ℏ",  // Hedera
      "EGLD": "🏔️", // MultiversX (Elrond)
      "FLR": "🔥", // Flare
      "XDC": "🌐", // XDC Network
      "KAVA": "🌾", // Kava
      "ZIL": "💎", // Zilliqa
      "QTUM": "⬡",  // Qtum
      "WAVES": "🌊", // Waves
      "ICX": "🔷", // ICON
      "ONT": "⭕", // Ontology
      "ZEC": "🛡️", // Zcash
      "DASH": "💸", // Dash
      "DCR": "🔷", // Decred
      "XCS": "🌟", // Xcannes Coin
    };
    return flags[curr] || "💱"; // Fallback sur l'emoji exchange
  };

  // Fonction pour enrichir la description avec des drapeaux
  const enrichDescription = (description) => {
    if (!description) return description;
    
    // Remplacer les codes de devises par leurs drapeaux + code
    let enriched = description;
    
    // Chercher les patterns courants: "XXX → YYY" ou "XXX/YYY"
    const currencyPattern = /\b([A-Z]{3})\b/g;
    enriched = enriched.replace(currencyPattern, (match) => {
      const flag = getCurrencyFlag(match);
      return `${flag} ${match}`;
    });
    
    return enriched;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    const options = isMobileDate
      ? { day: "2-digit", month: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" };
    return date.toLocaleDateString("fr-FR", options);
  };

  const formatAmount = (amount) => {
    return parseFloat(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  const STATEMENT_LAYOUTS = {
    full: {
      backdropClass: "bg-black/80 md:backdrop-blur-sm",
      wrapperClass: "items-stretch justify-center px-0 md:items-center md:px-4",
      panelClass:
        "w-full h-[100svh] max-h-[100svh] rounded-none border-0 md:max-w-4xl md:rounded-2xl md:border md:border-white/10 md:max-h-[92vh] lg:max-w-5xl",
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
        "max-w-4xl lg:max-w-5xl rounded-2xl border border-white/10 max-h-[92vh]",
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
        <div className="border-b border-white/10 flex-shrink-0 bg-elevated px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              {['XRP', 'RLUSD', 'XCS'].includes(currency) ? (
                <Image 
                  src={`/symbols/${currency.toLowerCase()}.png`} 
                  alt={currency}
                  width={32}
                  height={32}
                  className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-md"
                />
              ) : (
                <span className="text-2xl md:text-3xl flex-shrink-0">{getCurrencyFlag(currency)}</span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg md:text-xl font-bold text-white truncate">
                  {currency} Statement
                </h2>
                <p className="text-xs md:text-sm text-white/60 truncate">
                  {getCurrencyDescription(currency)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-xcannes-green transition-colors text-2xl md:text-3xl leading-none flex-shrink-0 w-10 h-10 flex items-center justify-center -mr-2"
            >
              ×
            </button>
          </div>
          
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
              {/* Month Selector - Version simplifiée */}
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
              <p className="text-xs text-white/50 mb-1">Balance</p>
              <p className="text-sm text-white font-semibold">
                {formatAmount(balance)} {currency}
              </p>
              <p className="text-[11px] text-white/50">
                ≈ {formatAmount(estimatedUsd)} USD
              </p>
            </div>
          </div>
        </div>

        {/* Content - Zone scrollable avec flex-1 pour prendre l'espace restant */}
        <div className="flex-1 overflow-hidden px-4 md:px-6 py-4 md:py-6 flex flex-col gap-4 min-h-0 overscroll-contain">
          
          {/* Archive Notice */}
          {selectedMonth === 'archives' && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 md:p-4">
              <p className="text-sm text-blue-300 flex items-center gap-2">
                <span className="text-xl">📁</span>
                <span><strong>Archives:</strong> Displaying transactions older than 12 months.</span>
              </p>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  filter === "all" 
                    ? "bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green border border-xcannes-green/30" 
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                All ({transactions.length})
              </button>
              <button
                onClick={() => setFilter("credit")}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  filter === "credit" 
                    ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30" 
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                Credits ({credits.length})
              </button>
              <button
                onClick={() => setFilter("debit")}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  filter === "debit" 
                    ? "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30" 
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                Debits ({debits.length})
              </button>
              <button
                onClick={() => setFilter("conversion")}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  filter === "conversion" 
                    ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30" 
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                Conversions ({transactions.filter(t => t.category === "exchange").length})
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-black/40 rounded-lg border border-white/10 overflow-hidden flex flex-col min-h-0">
            <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto md:max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/40 backdrop-blur-sm z-10">
                  <tr className="border-b border-white/10">
                    <th className="text-left px-2 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">Date</th>
                    <th className="text-left pl-2 pr-1 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">Description</th>
                    <th className="text-right pl-1 pr-2 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60">Amount</th>
                    <th className="text-right px-3 md:px-4 py-2.5 md:py-3 text-xs font-medium text-white/60 hidden md:table-cell">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-12 text-white/40 text-sm">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx, idx) => {
                      const icon = getTransactionIcon(tx.category);
                      return (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-2 md:px-4 py-2.5 md:py-3 text-white/70 font-mono text-xs">
                            {formatDate(tx.date)}
                          </td>
                          <td className="pl-2 pr-1 md:px-4 py-2.5 md:py-3">
                            <div className="flex items-center gap-2">
                              {icon ? (
                                <span className="transaction-icon text-lg flex-shrink-0">
                                  {icon}
                                </span>
                              ) : null}
                              <div className="min-w-0">
                                <p className="text-sm text-white/90 truncate">{enrichDescription(tx.description)}</p>
                                {tx.counterparty && (
                                  <p className="text-xs text-white/40 font-mono truncate hidden md:block">
                                    {tx.counterparty.slice(0, 10)}...{tx.counterparty.slice(-6)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`pl-1 pr-2 md:px-4 py-2.5 md:py-3 text-right font-mono text-sm font-medium ${tx.type === "debit" ? "text-red-400" : "text-green-400"}`}>
                            {tx.type === "debit" ? "−" : "+"}{formatAmount(tx.amount)}
                          </td>
                          <td className="px-3 md:px-4 py-2.5 md:py-3 text-right font-mono text-white/90 text-sm hidden md:table-cell">
                            {formatAmount(tx.runningBalance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => onLoadMore && onLoadMore()}
              disabled={loadingMore}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-white/10 hover:bg-white/15 text-white/70 border border-white/15"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}

          {/* Watermark */}
          <div className="hidden sm:block text-center py-3 md:py-4 border-t border-white/10">
            <div className="space-y-1">
              <p className="text-xs text-white/20 font-mono hidden md:block">
                Generated on {new Date().toLocaleString("en-US")}
              </p>
              <p className="text-xs text-white/20 font-mono">
                🔐 Verified on XRP Ledger
              </p>
              <p className="text-[10px] text-white/10 font-mono break-all">
                Doc ID: {Math.random().toString(36).substring(2, 15).toUpperCase()}-
                {new Date().getTime().toString(36).toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-white/10 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-black/30">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleExport("pdf")}
              disabled={exportFormat === "pdf"}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-white/10 hover:bg-white/15 text-white/70 border border-white/15"
            >
              {exportFormat === "pdf" ? "..." : "📄 PDF"}
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-white/10 hover:bg-white/15 text-white/70 border border-white/15"
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
