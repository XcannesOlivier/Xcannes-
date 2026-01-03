"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { QRCodeCanvas } from "qrcode.react";
import { useXumm } from "../../context/XummContext";
import xcannesApi from "../../lib/xcannesApi";
import { CRYPTO_ICONS } from "../dex/ExchangeSections/constants";
import { useWalletLines } from "./hooks/useWalletLines";
import { useWalletCurrencyLines } from "./hooks/useWalletCurrencyLines";
import WalletCurrencySelector from "./WalletCurrencySelector";
import WalletDashboardFooter from "./WalletDashboardFooter";
import WalletInfoModal from "./WalletInfoModal";
import XummConnectButton from "../xumm/XummConnectButton";
import TokenAmountInput from "./TokenAmountInput";
import QRScanner from "./QRScanner";
import MoonPayKYCModal from "./MoonPayKYCModal";
import MoonPayBuyModal from "./MoonPayBuyModal";
import MoonPaySellModal from "./MoonPaySellModal";
import { KYCStatusPanel } from "./KYCStatusBadge";
import CurrencyStatement from "./CurrencyStatement";
import { getCurrencyDescription } from "../../utils/currencyDescriptions";
import GlobalStatement from "./GlobalStatement";

  const TOKEN_ICONS = {
    XRP: "✕",
    XCS: "Ⓧ",
    BTC: "₿",
  ETH: "Ξ",
  USDT: "₮",
  USDC: "＄",
};

const WALLET_LABEL_STORAGE_KEY = "xcannes_wallet_labels";

const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴",
};

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

function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const codePoints = [...countryCode.toUpperCase()].map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65)
  );
  return String.fromCodePoint(...codePoints);
}

function getCurrencyFlag(code) {
  if (!code) return "🏳️";
  const upper = String(code).toUpperCase();
  if (CURRENCY_FLAG_OVERRIDES[upper]) {
    return CURRENCY_FLAG_OVERRIDES[upper];
  }
  const countryGuess = upper.slice(0, 2);
  return countryCodeToFlag(countryGuess);
}

function getTokenIcon(currency) {
  const code = String(currency || "").toUpperCase();
  if (TOKEN_ICONS[code]) return TOKEN_ICONS[code];
  const first = code.match(/[A-Z]/);
  return first ? first[0] : "?";
}

function renderTokenIcon(token) {
  const code = String(token?.currency || "").toUpperCase();

  // Icône dédiée pour les cryptos connues (XRP, RLUSD, XCS, ...)
  if (code && CRYPTO_ICONS[code]) {
    return (
      <Image
        src={CRYPTO_ICONS[code]}
        alt={code}
        width={20}
        height={20}
        className="w-5 h-5 object-cover"
      />
    );
  }

  // Sinon : drapeau pour les trustlines "fiat", ou fallback texte
  return token?.isTrustlineOnly ? getCurrencyFlag(code) : getTokenIcon(code);
}

const WALLET_LAYOUTS = {
  full: {
    isFullPage: true,
    tokenListClass: "max-h-none",
    statementVariant: "full",
    showBrandTitle: true,
    showOpenFullWallet: false,
    containerClass: "",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass: "",
  },
  "dex-desktop": {
    isFullPage: false,
    tokenListClass: "max-h-none",
    statementVariant: "dex-desktop",
    showBrandTitle: false,
    showOpenFullWallet: false,
    containerClass:
      "overflow-hidden",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass: "rounded-lg",
  },
  "dex-mobile": {
    isFullPage: false,
    tokenListClass: "max-h-[calc(100svh-300px)] md:max-h-[420px]",
    statementVariant: "dex-mobile",
    showBrandTitle: true,
    showOpenFullWallet: true,
    containerClass:
      "h-[100svh] rounded-none shadow-xl shadow-black/30 overflow-hidden border-t border-white/10",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass:
      "rounded-xl bg-white/5 border-white/10 hover:bg-white/10",
  },
  default: {
    isFullPage: false,
    tokenListClass: "max-h-72 md:max-h-[420px]",
    statementVariant: "default",
    showBrandTitle: false,
    showOpenFullWallet: false,
    containerClass: "",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass: "",
  },
};

function resolveWalletLayout(variant, isFullPage) {
  if (variant && WALLET_LAYOUTS[variant]) {
    return WALLET_LAYOUTS[variant];
  }
  if (isFullPage) {
    return WALLET_LAYOUTS.full;
  }
  return WALLET_LAYOUTS.default;
}

export default function WalletDashboard({
  preview = false,
  isFullPage = false,
  variant,
}) {
  const DEMO_RLUSD_TOTAL = 1000;
  const layout = useMemo(
    () => resolveWalletLayout(variant, isFullPage),
    [variant, isFullPage]
  );
  const isFullPageView = layout.isFullPage;
  const statementVariant = layout.statementVariant;

  const {
    wallet,
    isConnected,
    isConnecting,
    balance,
    refreshBalance,
    connect,
    disconnect,
    signTransaction,
  } = useXumm();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAction, setActiveAction] = useState(null); // 'send' | 'receive' | 'swap' | 'buy' | 'sell' | 'trustlines' | null
  const [sendTab, setSendTab] = useState("scan-request"); // 'manual' | 'scan-request' - Par défaut "Pay" (scan-request)
  const [receiveTab, setReceiveTab] = useState("receive"); // 'receive' | 'request'
  const [sendAssetKey, setSendAssetKey] = useState("");
  const [sendDestination, setSendDestination] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendProcessing, setSendProcessing] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [paymentRequestScannerOpen, setPaymentRequestScannerOpen] = useState(false);
  
  // Adresses sauvegardées
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showSaveAddressPrompt, setShowSaveAddressPrompt] = useState(false);
  const [addressToSave, setAddressToSave] = useState("");
  const [addressLabel, setAddressLabel] = useState("");
  const [walletLabel, setWalletLabel] = useState("");
  const [walletLabelDraft, setWalletLabelDraft] = useState("");
  const [isEditingWalletLabel, setIsEditingWalletLabel] = useState(false);
  
  // États MoonPay KYC
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [kycStatus, setKycStatus] = useState("not_started"); // not_started | pending | approved | failed
  const [cashModalTab, setCashModalTab] = useState("buy"); // 'buy' | 'sell' - Onglet actif dans la modal Cash
  
  // États pour Payment Request
  const [requestAmount, setRequestAmount] = useState("");
  const [requestCurrency, setRequestCurrency] = useState("XRP");
  const [requestMethod, setRequestMethod] = useState("qr"); // 'qr' | 'link' | 'xrpl' | 'notification'
  const [requestToAddress, setRequestToAddress] = useState("");
  const [requestMemo, setRequestMemo] = useState("");
  
  const [trustlineCode, setTrustlineCode] = useState("");
  const [trustlineLocked, setTrustlineLocked] = useState("");
  const [selectedWallet, setSelectedWallet] = useState("");
  const [editingTrustlineCurrency, setEditingTrustlineCurrency] = useState(null);
  const [editingTrustlineLocked, setEditingTrustlineLocked] = useState("");
  const [convertBaseCurrency, setConvertBaseCurrency] = useState("");
  const [convertQuoteCurrency, setConvertQuoteCurrency] = useState("");
  const [convertAmount, setConvertAmount] = useState("");
  const [fxCurrencies, setFxCurrencies] = useState([]);
  const [fxCurrenciesLoading, setFxCurrenciesLoading] = useState(false);
  const [showOtherQuoteCurrencies, setShowOtherQuoteCurrencies] = useState(false);
  const [currencyLineCode, setCurrencyLineCode] = useState("");
  const [currencyLineAllocatedRlusd, setCurrencyLineAllocatedRlusd] = useState("");
  
  // États pour les relevés bancaires
  const [showGlobalStatement, setShowGlobalStatement] = useState(false);
  const [showCurrencyStatement, setShowCurrencyStatement] = useState(false);
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);
  const [selectedStatementToken, setSelectedStatementToken] = useState(null);
  const [usdRates, setUsdRates] = useState({});
  
  const [demoLines, setDemoLines] = useState(() => ({
    RLUSD: {
      currency: "RLUSD",
      rlusd: DEMO_RLUSD_TOTAL,
      units: DEMO_RLUSD_TOTAL,
      rate: 1,
    },
    EUR: { currency: "EUR", rlusd: 0, units: 0, rate: 0 },
    USD: { currency: "USD", rlusd: 0, units: 0, rate: 0 },
    GBP: { currency: "GBP", rlusd: 0, units: 0, rate: 0 },
    CHF: { currency: "CHF", rlusd: 0, units: 0, rate: 0 },
    JPY: { currency: "JPY", rlusd: 0, units: 0, rate: 0 },
    CAD: { currency: "CAD", rlusd: 0, units: 0, rate: 0 },
    AUD: { currency: "AUD", rlusd: 0, units: 0, rate: 0 },
    SGD: { currency: "SGD", rlusd: 0, units: 0, rate: 0 },
    HKD: { currency: "HKD", rlusd: 0, units: 0, rate: 0 },
    SEK: { currency: "SEK", rlusd: 0, units: 0, rate: 0 },
    NOK: { currency: "NOK", rlusd: 0, units: 0, rate: 0 },
    DKK: { currency: "DKK", rlusd: 0, units: 0, rate: 0 },
    PLN: { currency: "PLN", rlusd: 0, units: 0, rate: 0 },
    CZK: { currency: "CZK", rlusd: 0, units: 0, rate: 0 },
    HUF: { currency: "HUF", rlusd: 0, units: 0, rate: 0 },
    MXN: { currency: "MXN", rlusd: 0, units: 0, rate: 0 },
    INR: { currency: "INR", rlusd: 0, units: 0, rate: 0 },
    ZAR: { currency: "ZAR", rlusd: 0, units: 0, rate: 0 },
    TRY: { currency: "TRY", rlusd: 0, units: 0, rate: 0 },
    IDR: { currency: "IDR", rlusd: 0, units: 0, rate: 0 },
    PHP: { currency: "PHP", rlusd: 0, units: 0, rate: 0 },
    KRW: { currency: "KRW", rlusd: 0, units: 0, rate: 0 },
    TWD: { currency: "TWD", rlusd: 0, units: 0, rate: 0 },
    AED: { currency: "AED", rlusd: 0, units: 0, rate: 0 },
    BRL: { currency: "BRL", rlusd: 0, units: 0, rate: 0 },
    XOF: { currency: "XOF", rlusd: 0, units: 0, rate: 0 },
    XAF: { currency: "XAF", rlusd: 0, units: 0, rate: 0 },
  }));
  const [convertPreview, setConvertPreview] = useState("");
  const [convertProcessing, setConvertProcessing] = useState(false);

  // Mode "preview" ne doit JAMAIS faire croire que le wallet est connecté.
  // On l'utilise uniquement pour afficher des données de démonstration
  // quand aucun wallet n'est connecté.
  const isPreviewMode = preview && !isConnected;
  const effectiveIsConnected = isConnected;
  
  // Charger les adresses sauvegardées depuis localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xcannes_saved_addresses');
      if (saved) {
        setSavedAddresses(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Error loading saved addresses:', err);
    }
  }, []);
  
  // Fonction pour sauvegarder une adresse
  const saveAddress = (address, label) => {
    const newAddress = {
      address,
      label: label || address.slice(0, 10) + '...',
      savedAt: new Date().toISOString()
    };
    const updated = [...savedAddresses, newAddress];
    setSavedAddresses(updated);
    localStorage.setItem('xcannes_saved_addresses', JSON.stringify(updated));
  };
  
  // Fonction pour supprimer une adresse
  const deleteAddress = (address) => {
    const updated = savedAddresses.filter(a => a.address !== address);
    setSavedAddresses(updated);
    localStorage.setItem('xcannes_saved_addresses', JSON.stringify(updated));
  };
  
  const effectiveWallet = isPreviewMode
    ? "rPREVIEWWALLETxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    : wallet;
  const effectiveBalance = isPreviewMode
    ? {
        xrp: "12345.6789",
        // En mode preview, on laisse la liste de devises vide
        // pour que les lignes soient créées via les trustlines.
        tokens: [],
      }
    : balance;

  const baseTokens = useMemo(
    () => effectiveBalance?.tokens || [],
    [effectiveBalance?.tokens]
  );
  
  const xrpAmount = parseFloat(effectiveBalance?.xrp || 0) || 0;

  const isStablecoin = useCallback((currency) => {
    return USD_STABLECOINS.includes(String(currency || "").toUpperCase());
  }, []);

  const stableUsd = useMemo(() => {
    return baseTokens
      .filter((t) => isStablecoin(t.currency))
      .reduce((sum, t) => {
        const v = parseFloat(t.value);
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0);
  }, [baseTokens, isStablecoin]);

  const displayTokens = useMemo(() => {
    // Mode démo: on affiche la "composition" virtuelle du capital RLUSD
    if (isPreviewMode) {
      const tokens = [];

      // Toujours une ligne XRP en haut (démo XRPL)
      tokens.push({
        key: "XRP",
        currency: "XRP",
        issuer: "Native",
        value: xrpAmount,
      });

      const seen = new Set(["XRP"]);

      Object.entries(demoLines || {}).forEach(([code, line]) => {
        const upper = String(code || "").toUpperCase();
        if (!upper || seen.has(upper)) return;
        const rlusdValue = Number(line?.rlusd || 0);
        const units = Number(line?.units || 0);
        tokens.push({
          key: `DEMO:${upper}`,
          currency: upper,
          issuer: upper === "RLUSD" ? "Demo" : "Trustline",
          isTrustlineOnly: upper !== "RLUSD",
          value: Number.isFinite(units) ? units : 0,
          demoRlusdValue: Number.isFinite(rlusdValue) ? rlusdValue : 0,
        });
        seen.add(upper);
      });

      // S'assurer qu'il y a toujours une ligne XCS dédiée
      if (!seen.has("XCS")) {
        tokens.push({
          key: "DEMO:XCS",
          currency: "XCS",
          issuer: "Trustline",
          value: 0,
          demoRlusdValue: 0,
        });
        seen.add("XCS");
      }

      // S'assurer qu'il y a toujours une ligne RLUSD visible (même si demoLines a été modifié)
      if (!seen.has("RLUSD")) {
        tokens.push({
          key: "DEMO:RLUSD",
          currency: "RLUSD",
          issuer: "Demo",
          value: DEMO_RLUSD_TOTAL,
          demoRlusdValue: DEMO_RLUSD_TOTAL,
        });
      }

      const weight = (currency) => {
        if (currency === "XRP") return 0;
        if (currency === "XCS") return 1;
        if (currency === "RLUSD") return 2;
        return 3;
      };

      tokens.sort((a, b) => {
        const wa = weight(a.currency);
        const wb = weight(b.currency);
        if (wa !== wb) return wa - wb;
        return (b.demoRlusdValue || b.value || 0) - (a.demoRlusdValue || a.value || 0);
      });

      return tokens;
    }

    // Mode "réel": on affiche les soldes XRPL
    const tokens = [
      {
        key: "XRP",
        currency: "XRP",
        issuer: "Native",
        value: xrpAmount,
      },
      ...baseTokens.map((t) => ({
        key: `${t.currency}:${t.issuer || "issuer"}`,
        currency: t.currency,
        issuer: t.issuer,
        value: parseFloat(t.value) || 0,
      })),
    ];

    const weight = (currency) => {
      if (currency === "XRP") return 0;
      if (currency === "XCS") return 1;
      if (currency === "RLUSD") return 2;
      return 3;
    };

    // S'assurer qu'il y a toujours une ligne XCS juste après XRP,
    // même si aucune position ou trustline n'existe encore.
    const hasXcs = tokens.some(
      (t) => String(t.currency || "").toUpperCase() === "XCS"
    );
    if (!hasXcs) {
      tokens.push({
        key: "XCS:auto",
        currency: "XCS",
        issuer: "Trustline",
        value: 0,
      });
    }

    tokens.sort((a, b) => {
      const wa = weight(a.currency);
      const wb = weight(b.currency);
      if (wa !== wb) return wa - wb;
      return b.value - a.value;
    });

    return tokens;
  }, [baseTokens, xrpAmount, isPreviewMode, demoLines]);

  // Trustlines (panneau avancé)
  const backendWalletAddress = isPreviewMode ? null : effectiveWallet || null;
  const {
    lines: walletLines,
    totalLockedXcs,
    loading: walletLinesLoading,
    error: walletLinesError,
    addLine,
    removeLine,
  } = useWalletLines(backendWalletAddress);

  const {
    lines: currencyLines,
    summary: currencyLinesSummary,
    loading: currencyLinesLoading,
    error: currencyLinesError,
    refresh: refreshCurrencyLines,
    upsertCurrencyLine,
    removeCurrencyLine,
    convertAllocation: convertCurrencyAllocation,
  } = useWalletCurrencyLines(backendWalletAddress);

  const handleRefresh = async () => {
    if (!refreshBalance) return;
    setIsRefreshing(true);
    await refreshBalance();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleUpsertCurrencyLine = async () => {
    if (!backendWalletAddress) {
      alert("Please connect your Xumm wallet first.");
      return;
    }

    const code = String(currencyLineCode || "").trim().toUpperCase();
    if (!code || code.length < 2) {
      alert("Select a valid currency.");
      return;
    }
    if (code === "RLUSD") {
      alert("RLUSD is the pool (unallocated). Choose another currency.");
      return;
    }

    const allocated = Number.parseFloat(currencyLineAllocatedRlusd);
    if (!Number.isFinite(allocated) || allocated < 0) {
      alert("Enter a valid allocated RLUSD amount (>= 0).");
      return;
    }

    await upsertCurrencyLine({
      currencyCode: code,
      allocatedRlusd: allocated,
    });

    setCurrencyLineCode("");
    setCurrencyLineAllocatedRlusd("");
  };

  const handleRemoveCurrencyLine = async (code) => {
    if (!backendWalletAddress) return;
    const currencyCode = String(code || "").trim().toUpperCase();
    if (!currencyCode) return;
    const ok = confirm(`Delete currency line ${currencyCode}?`);
    if (!ok) return;
    await removeCurrencyLine(currencyCode);
  };
  const openTrustlineEditor = (currency) => {
    const code = String(currency || "").toUpperCase();
    if (!code) return;
    const existingLine =
      (walletLines || []).find(
        (line) => String(line.currencyCode || "").toUpperCase() === code
      ) || null;
    setEditingTrustlineCurrency(code);
    setEditingTrustlineLocked(
      existingLine && Number.isFinite(Number(existingLine.lockedXcs))
        ? String(existingLine.lockedXcs)
        : ""
    );
    setActiveAction("trustlineCurrency");
  };

  const handleSaveTrustlineCurrency = async () => {
    const code = String(editingTrustlineCurrency || "").toUpperCase();
    if (!code) return;
    const locked = Number(editingTrustlineLocked || "0");
    if (!Number.isFinite(locked) || locked < 0) {
      alert("Enter a valid non-negative locked XCS amount.");
      return;
    }
    await addLine(code, locked);
    setActiveAction(null);
    setEditingTrustlineCurrency(null);
    setEditingTrustlineLocked("");
  };

  const handleRemoveTrustlineCurrency = async () => {
    const code = String(editingTrustlineCurrency || "").toUpperCase();
    if (!code) return;
    await removeLine(code);
    setActiveAction(null);
    setEditingTrustlineCurrency(null);
    setEditingTrustlineLocked("");
  };

  const handleCloseTrustlineEditor = () => {
    setActiveAction(null);
    setEditingTrustlineCurrency(null);
    setEditingTrustlineLocked("");
  };

  const renderTokenRow = useCallback((token) => {
    const currencyCode = String(token.currency || "").toUpperCase();
    const rawValue = Number(token.value || 0);
    const demoRlusd =
      token.demoRlusdValue != null &&
      Number.isFinite(Number(token.demoRlusdValue))
        ? Number(token.demoRlusdValue)
        : rawValue;
    const displayValue =
      currencyCode === "XRP" && Number.isFinite(rawValue)
        ? Math.min(rawValue, 5)
        : rawValue;

    return (
      <button
        key={token.key}
        type="button"
        onClick={() => {
          setSelectedStatementToken(token);
          setShowCurrencyStatement(true);
        }}
        className="w-full text-left"
      >
        <div
          className={`flex items-center justify-between rounded-md bg-base hover:bg-slate-800/40 border border-slate-800/60 px-3 py-2 transition-colors cursor-pointer ${layout.tokenRowClass}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 flex items-center justify-center text-[13px] font-semibold text-primary overflow-hidden">
              {renderTokenIcon(token)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-primary truncate">
                {token.currency}
              </span>
              <span className="text-[11px] text-muted truncate">
                {token.currency === "XRP"
                  ? "XRP · Native"
                  : token.isTrustlineOnly
                  ? getCurrencyDescription(token.currency)
                  : isStablecoin(token.currency)
                  ? "XRPL Stablecoin"
                  : token.currency === "XCS"
                  ? "XCannes Token"
                  : "XRPL Token"}
              </span>
            </div>
          </div>
          <div className="text-right text-[12px] text-primary">
            <div className="font-mono">
              {Number.isFinite(displayValue)
                ? displayValue.toLocaleString("en-US", {
                    maximumFractionDigits: 4,
                  })
                : "0"}
            </div>
            <div className="mt-0.5 text-[10px] text-muted font-normal">
              ≈{" "}
              {Number.isFinite(demoRlusd)
                ? demoRlusd.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })
                : "0"}{" "}
              RLUSD
            </div>
          </div>
        </div>
      </button>
    );
  }, [isStablecoin, layout.tokenRowClass]);

  const augmentedTokens = useMemo(() => {
    // 1) Regrouper par devise pour éviter les doublons
    const byCurrency = new Map();
    (displayTokens || []).forEach((t) => {
      const code = String(t.currency || "").toUpperCase();
      if (!code) return;
      if (!byCurrency.has(code)) {
        byCurrency.set(code, { ...t, currency: code });
      }
    });

    // 2) Ajouter les trustlines qui n'ont pas déjà une ligne de devise
    (walletLines || []).forEach((line) => {
      const code = String(line.currencyCode || "").toUpperCase();
      if (!code || byCurrency.has(code)) return;
      byCurrency.set(code, {
        key: `TL:${code}`,
        currency: code,
        issuer: "Trustline",
        value: 0,
        isTrustlineOnly: true,
      });
    });

    return Array.from(byCurrency.values());
  }, [displayTokens, walletLines]);

  const tokenRows = useMemo(() => {
    return (augmentedTokens || []).map(renderTokenRow);
  }, [augmentedTokens, renderTokenRow]);

  const walletCurrencyOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    (augmentedTokens || []).forEach((t) => {
      const code = String(t.currency || "").toUpperCase();
      if (!code || seen.has(code)) return;
      seen.add(code);
      list.push(code);
    });
    return list;
  }, [augmentedTokens]);

  const allocatedRlusdByCurrency = useMemo(() => {
    const map = new Map();
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (!code) return;
      const allocated = Number.parseFloat(line?.allocatedRlusd ?? 0);
      map.set(code, Number.isFinite(allocated) ? allocated : 0);
    });
    return map;
  }, [currencyLines]);

  const swapCurrencyOptions = useMemo(() => {
    const candidates = new Set();
    (walletCurrencyOptions || []).forEach((code) => {
      const upper = String(code || "").toUpperCase();
      if (upper) candidates.add(upper);
    });
    candidates.add("RLUSD");
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (code) candidates.add(code);
    });

    const weight = (code) => {
      if (code === "RLUSD") return 0;
      if (code === "XRP") return 1;
      if (code === "XCS") return 2;
      return 3;
    };

    return Array.from(candidates).sort((a, b) => {
      const wa = weight(a);
      const wb = weight(b);
      if (wa !== wb) return wa - wb;
      return a.localeCompare(b);
    });
  }, [walletCurrencyOptions, currencyLines]);

  const selectedSendToken =
    augmentedTokens.find((t) => t.key === sendAssetKey) ||
    augmentedTokens[0] ||
    null;

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
    
    // Fermer la modale immédiatement avant d'ouvrir Xumm
    setActiveAction(null);
    
    try {
      const result = await signTransaction(txjson);
      if (result && result.signed) {
        alert("✅ Payment submitted via Xumm.");
        
        // Proposer de sauvegarder l'adresse si elle n'est pas déjà sauvegardée
        const isAlreadySaved = savedAddresses.some(a => a.address === dest);
        if (!isAlreadySaved) {
          setAddressToSave(dest);
          setShowSaveAddressPrompt(true);
        }
        
        setSendAmount("");
        setSendDestination("");
        if (refreshBalance) {
          setTimeout(() => refreshBalance(), 3000);
        }
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

  const handleCopyAddress = async () => {
    if (!effectiveWallet || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(effectiveWallet);
      alert("Address copied to clipboard");
    } catch (e) {
      console.error("Copy error:", e);
    }
  };

  const handleSwitchWallet = () => {
    if (isConnecting) return;
    connect();
  };

  const handleAddTrustline = async () => {
    const code = (trustlineCode || "").trim().toUpperCase();
    if (!code) {
      alert("Enter a currency code (ex: XCS)");
      return;
    }
    const locked = Number(trustlineLocked || "0");
    await addLine(code, Number.isFinite(locked) ? locked : 0);
    setTrustlineCode("");
    setTrustlineLocked("");
  };

  useEffect(() => {
    setSelectedWallet(wallet || "");
  }, [wallet]);

  const rateCodesKey = useMemo(() => {
    const codes = (augmentedTokens || [])
      .filter((token) => {
        const value = Number(token.value || 0);
        return Number.isFinite(value) && value > 0;
      })
      .map((t) => String(t.currency || "").toUpperCase())
      .filter(Boolean);
    const unique = Array.from(new Set(codes)).sort();
    return unique.join("|");
  }, [augmentedTokens]);

  useEffect(() => {
    let cancelled = false;

    const getTickerPrice = (ticker) => {
      const priceSource =
        ticker?.lastPrice ??
        ticker?.price ??
        ticker?.midPrice ??
        ticker?.bidPrice ??
        ticker?.askPrice;
      const price = Number(priceSource);
      return Number.isFinite(price) && price > 0 ? price : NaN;
    };

    const resolveUsdRate = async (code, pythPairsMap) => {
      const upper = String(code || "").toUpperCase();
      if (!upper) return NaN;
      if (upper === "USD" || upper === "RLUSD") return 1;

      if (isStablecoin(upper)) return 1;

      if (CRYPTO_ICONS[upper] || ["XRP", "XCS", "BTC", "ETH"].includes(upper)) {
        try {
          const ticker = await xcannesApi.getTicker(`${upper}_RLUSD`);
          const price = getTickerPrice(ticker);
          if (Number.isFinite(price)) return price;
        } catch (err) {
          console.warn("USD rate XRPL error:", err);
        }
        return NaN;
      }

      try {
        const directKey = `${upper}_USD`;
        const inverseKey = `USD_${upper}`;
        const direct = pythPairsMap.get(directKey);
        const inverse = pythPairsMap.get(inverseKey);
        if (direct) {
          const ticker = await xcannesApi.getTicker(direct.symbol || directKey);
          const price = getTickerPrice(ticker);
          if (Number.isFinite(price)) return price;
        }
        if (inverse) {
          const ticker = await xcannesApi.getTicker(inverse.symbol || inverseKey);
          const price = getTickerPrice(ticker);
          if (Number.isFinite(price) && price > 0) return 1 / price;
        }
      } catch (err) {
        console.warn("USD rate Pyth error:", err);
      }

      try {
        const fxResult = await xcannesApi.getFxEod("USD", upper, 30);
        const candles = Array.isArray(fxResult?.candles) ? fxResult.candles : [];
        const last = candles[candles.length - 1];
        const close =
          last && last.close != null
            ? Number(last.close)
            : last && last.price != null
            ? Number(last.price)
            : NaN;

        if (Number.isFinite(close) && close > 0) {
          return 1 / close;
        }
      } catch (err) {
        console.warn("USD rate Fawaz error:", err);
      }

      return NaN;
    };

    const loadUsdRates = async () => {
      if (!rateCodesKey) {
        setUsdRates({});
        return;
      }
      try {
        const markets = await xcannesApi.getAllMarkets();
        const pythPairs = Array.isArray(markets?.pyth) ? markets.pyth : [];
        const pythPairsMap = new Map();
        pythPairs.forEach((pair) => {
          if (!pair?.base || !pair?.quote) return;
          const key = `${String(pair.base).toUpperCase()}_${String(pair.quote).toUpperCase()}`;
          pythPairsMap.set(key, pair);
        });

        const codes = rateCodesKey.split("|").filter(Boolean);
        const rates = {};
        await Promise.all(
          codes.map(async (code) => {
            rates[code] = await resolveUsdRate(code, pythPairsMap);
          })
        );

        if (!cancelled) {
          setUsdRates(rates);
        }
      } catch (err) {
        console.error("USD rates loading error:", err);
      }
    };

    loadUsdRates();
    return () => {
      cancelled = true;
    };
  }, [rateCodesKey, isStablecoin]);

  const totalUsd = useMemo(() => {
    const total = (augmentedTokens || []).reduce((sum, token) => {
      const code = String(token.currency || "").toUpperCase();
      const rate = usdRates[code];
      const value = Number(token.value || 0);
      if (!Number.isFinite(rate) || !Number.isFinite(value)) return sum;
      return sum + value * rate;
    }, 0);
    return Number.isFinite(total) ? total : 0;
  }, [augmentedTokens, usdRates]);

  const totalUsdLabel =
    Number.isFinite(totalUsd) && totalUsd > 0
      ? `${totalUsd.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} USD`
      : null;

  const fallbackTotalLabel = isPreviewMode
    ? `${DEMO_RLUSD_TOTAL.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} USD`
    : stableUsd > 0
    ? `${stableUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} USD`
    : `${xrpAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} USD`;

  const totalLabel = totalUsdLabel || fallbackTotalLabel;

  useEffect(() => {
    if (!effectiveIsConnected || !effectiveWallet) {
      setWalletLabel("");
      setWalletLabelDraft("");
      setIsEditingWalletLabel(false);
      return;
    }

    try {
      const raw = localStorage.getItem(WALLET_LABEL_STORAGE_KEY);
      const labels = raw ? JSON.parse(raw) : {};
      const label = labels[effectiveWallet] || "";
      setWalletLabel(label);
      setWalletLabelDraft(label);
    } catch (err) {
      console.error("Error loading wallet label:", err);
    }
  }, [effectiveIsConnected, effectiveWallet]);

  const handleOpenWalletLabelEditor = () => {
    if (!effectiveWallet) return;
    setWalletLabelDraft(walletLabel || "");
    setIsEditingWalletLabel(true);
  };

  const handleSaveWalletLabel = () => {
    if (!effectiveWallet) return;
    const trimmed = walletLabelDraft.trim();
    setWalletLabel(trimmed);
    setIsEditingWalletLabel(false);

    try {
      const raw = localStorage.getItem(WALLET_LABEL_STORAGE_KEY);
      const labels = raw ? JSON.parse(raw) : {};
      if (trimmed) {
        labels[effectiveWallet] = trimmed;
      } else {
        delete labels[effectiveWallet];
      }
      localStorage.setItem(WALLET_LABEL_STORAGE_KEY, JSON.stringify(labels));
    } catch (err) {
      console.error("Error saving wallet label:", err);
    }
  };

  const handleCancelWalletLabel = () => {
    setWalletLabelDraft(walletLabel);
    setIsEditingWalletLabel(false);
  };

  const xrplConnectionIndicator = useMemo(() => {
    if (isPreviewMode) {
      return {
        label: "Preview mode",
        dotClass: "bg-white/30",
        ringClass: "ring-white/10",
        pulse: false,
      };
    }

    if (isConnecting) {
      return {
        label: "Connecting…",
        dotClass: "bg-amber-400",
        ringClass: "ring-amber-400/20",
        pulse: true,
      };
    }

    if (effectiveIsConnected) {
      return {
        label: "XRPL connected",
        dotClass: "bg-xcannes-green",
        ringClass: "ring-xcannes-green/25",
        pulse: true,
      };
    }

    return {
      label: "Not connected",
      dotClass: "bg-white/20",
      ringClass: "ring-white/10",
      pulse: false,
    };
  }, [effectiveIsConnected, isConnecting, isPreviewMode]);

  const renderWalletMeta = (className = "") => {
    if (!effectiveWallet) return null;
    return (
      <div className={`text-[10px] text-white/50 ${className}`}>
        <div className="font-semibold text-white/70">
          {walletLabel || "Wallet"}
        </div>
        <div className="font-mono break-all">{effectiveWallet}</div>
      </div>
    );
  };

  const loadKycStatus = async () => {
    if (!effectiveWallet) return;
    try {
      const response = await fetch("/api/moonpay/kyc-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: effectiveWallet }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setKycStatus(data.status);
      }
    } catch (error) {
      console.error("Error loading KYC status:", error);
    }
  };

  // Charger le statut KYC au chargement si wallet connecté
  useEffect(() => {
    if (effectiveIsConnected && effectiveWallet) {
      loadKycStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveIsConnected, effectiveWallet]);

  const handleKycComplete = () => {
    setKycStatus("approved");
    setKycModalOpen(false);
    // Optionnel: afficher une notification de succès
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!activeAction) return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [activeAction]);

  const currentEditingLine =
    editingTrustlineCurrency &&
    (walletLines || []).find(
      (line) =>
        String(line.currencyCode || "").toUpperCase() ===
        String(editingTrustlineCurrency || "").toUpperCase()
    );

  useEffect(() => {
    if (activeAction !== "swap") return;
    let cancelled = false;
    const loadFxCurrencies = async () => {
      try {
        setFxCurrenciesLoading(true);
        const list = await xcannesApi.getFxCurrencies();
        if (!cancelled && Array.isArray(list)) {
          setFxCurrencies(list);
        }
      } catch (_) {
        if (!cancelled) {
          setFxCurrencies([]);
        }
      } finally {
        if (!cancelled) {
          setFxCurrenciesLoading(false);
        }
      }
    };
    loadFxCurrencies();
    return () => {
      cancelled = true;
    };
  }, [activeAction]);

  useEffect(() => {
    if (!swapCurrencyOptions.length) return;
    if (!convertBaseCurrency) {
      const preferredBase = swapCurrencyOptions.includes("RLUSD")
        ? "RLUSD"
        : swapCurrencyOptions.includes("XRP")
        ? "XRP"
        : swapCurrencyOptions[0];
      setConvertBaseCurrency(preferredBase);
    }
    if (!convertQuoteCurrency) {
      const preferredQuotes = ["RLUSD", "USD", "USDT", "USDC"];
      const fromWallet =
        preferredQuotes.find((c) => swapCurrencyOptions.includes(c)) ||
        (swapCurrencyOptions.length > 1
          ? swapCurrencyOptions[1]
          : swapCurrencyOptions[0]);
      setConvertQuoteCurrency(fromWallet);
    }
  }, [swapCurrencyOptions, convertBaseCurrency, convertQuoteCurrency]);

  const otherCurrencyOptions = useMemo(() => {
    if (!walletCurrencyOptions || walletCurrencyOptions.length === 0) return [];
    const walletSet = new Set(walletCurrencyOptions.map((c) => c.toUpperCase()));

    const fxCodes = (fxCurrencies || [])
      .map((c) => String(c.code || "").toUpperCase())
      .filter((code) => code && !walletSet.has(code));

    const cryptoCodes = Object.keys(CRYPTO_ICONS || {})
      .map((c) => c.toUpperCase())
      .filter((code) => !walletSet.has(code));

    const merged = Array.from(new Set([...fxCodes, ...cryptoCodes]));
    merged.sort();
    return merged;
  }, [walletCurrencyOptions, fxCurrencies]);

  const getRlusdPerUnit = async (currencyCode) => {
    const code = String(currencyCode || "").toUpperCase();
    if (!code) return NaN;
    if (code === "RLUSD") return 1;

    const existing = demoLines[code];
    if (existing && Number(existing.units || 0) > 0) {
      const rlusd = Number(existing.rlusd || 0);
      const units = Number(existing.units || 0);
      if (rlusd > 0 && units > 0) {
        return rlusd / units;
      }
    }

    // XRPL tokens: XCS / XRP coté en RLUSD
    if (code === "XCS" || code === "XRP") {
      try {
        const pairSymbol = `${code}_RLUSD`;
        const ticker = await xcannesApi.getTicker(pairSymbol);
        const lastPrice = ticker?.lastPrice ? Number(ticker.lastPrice) : NaN;
        if (Number.isFinite(lastPrice) && lastPrice > 0) {
          // lastPrice = RLUSD pour 1 unité de la devise
          return lastPrice;
        }
      } catch (e) {
        console.warn("getRlusdPerUnit XRPL error:", e);
      }
      return 1;
    }

    // Forex via Fawaz: RLUSD ≈ USD
    try {
      const baseForFx = "USD";
      const fxResult = await xcannesApi.getFxEod(baseForFx, code, 30);
      const candles = Array.isArray(fxResult?.candles)
        ? fxResult.candles
        : [];
      const last = candles[candles.length - 1];
      const close =
        last && last.close != null
          ? Number(last.close)
          : last && last.price != null
          ? Number(last.price)
          : NaN;

      if (Number.isFinite(close) && close > 0) {
        // close = combien de CODE pour 1 USD
        // RLUSD_per_unit_CODE ≈ 1 / close
        return 1 / close;
      }
    } catch (e) {
      console.warn("getRlusdPerUnit FX error:", e);
    }

    // Fallback: 1 RLUSD ≈ 1 unité de la devise
    return 1;
  };

  const handleDemoConvert = async () => {
    if (isPreviewMode) {
      const base = String(convertBaseCurrency || "").toUpperCase();
      const quote = String(convertQuoteCurrency || "").toUpperCase();
      const amountBase = Number(convertAmount || "0");

      if (!base || !quote || base === quote) {
        alert("Choisissez deux devises différentes.");
        return;
      }

      if (!Number.isFinite(amountBase) || amountBase <= 0) {
        alert("Entrez un montant valide dans la devise de base.");
        return;
      }

      const baseLine =
        demoLines[base] ||
        (base === "RLUSD"
          ? demoLines.RLUSD
          : null);

      if (!baseLine || !Number.isFinite(Number(baseLine.units || 0))) {
        alert("Aucun solde démo disponible dans la devise de base sélectionnée.");
        return;
      }

      const availableBaseUnits = Number(baseLine.units || 0);
      if (amountBase > availableBaseUnits + 1e-8) {
        alert(
          `Montant trop élevé. Solde disponible en ${base}: ${availableBaseUnits.toLocaleString(
            "en-US",
            { maximumFractionDigits: 4 }
          )}.`
        );
        return;
      }

      setConvertProcessing(true);
      try {
        const rlusdPerBase = await getRlusdPerUnit(base);
        const rlusdPerQuote = await getRlusdPerUnit(quote);

        if (
          !Number.isFinite(rlusdPerBase) ||
          rlusdPerBase <= 0 ||
          !Number.isFinite(rlusdPerQuote) ||
          rlusdPerQuote <= 0
        ) {
          alert("Impossible de récupérer les taux de conversion pour cette paire.");
          return;
        }

        const rlusdValue = amountBase * rlusdPerBase;
        const quoteUnits = rlusdValue / rlusdPerQuote;

        const priceSource =
          base === "RLUSD"
            ? `1 RLUSD ≈ ${(
                1 / rlusdPerQuote
              ).toLocaleString("en-US", { maximumFractionDigits: 4 })} ${quote}`
            : `Prix implicite via RLUSD (base=${base}, quote=${quote})`;

        setDemoLines((prev) => {
          const next = { ...prev };
          const baseLineNext =
            next[base] ||
            (base === "RLUSD"
              ? next.RLUSD || {
                  currency: "RLUSD",
                  rlusd: DEMO_RLUSD_TOTAL,
                  units: DEMO_RLUSD_TOTAL,
                  rate: 1,
                }
              : null);

          if (!baseLineNext) {
            return next;
          }

          const quoteLine = next[quote] || {
            currency: quote,
            rlusd: 0,
            units: 0,
            rate: 0,
          };

          const newBaseRlusd = Math.max(
            0,
            Number(baseLineNext.rlusd || 0) - rlusdValue
          );
          const newBaseUnits = Math.max(
            0,
            Number(baseLineNext.units || 0) - amountBase
          );

          next[base] = {
            ...baseLineNext,
            rlusd: newBaseRlusd,
            units: newBaseUnits,
            rate:
              newBaseRlusd > 0 && newBaseUnits > 0
                ? newBaseUnits / newBaseRlusd
                : base === "RLUSD"
                ? 1
                : baseLineNext.rate || 0,
          };

          next[quote] = {
            ...quoteLine,
            rlusd: Number(quoteLine.rlusd || 0) + rlusdValue,
            units: Number(quoteLine.units || 0) + quoteUnits,
            rate:
              Number(quoteLine.rlusd || 0) + rlusdValue > 0 &&
              Number(quoteLine.units || 0) + quoteUnits > 0
                ? (Number(quoteLine.units || 0) + quoteUnits) /
                  (Number(quoteLine.rlusd || 0) + rlusdValue)
                : quoteLine.rate || 0,
          };

          return next;
        });

        setConvertPreview(
          `Démo: ${amountBase.toLocaleString("en-US", {
            maximumFractionDigits: 4,
          })} ${base} ≈ ${quoteUnits.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })} ${quote} (${priceSource})`
        );
        setConvertAmount("");
      } catch (error) {
        console.error("Demo convert error:", error);
        alert(
          "Erreur lors de la conversion démo: " +
            (error?.message || String(error))
        );
      } finally {
        setConvertProcessing(false);
      }

      return;
    }

    if (!effectiveIsConnected || !backendWalletAddress) {
      alert("Please connect your Xumm wallet first.");
      return;
    }

    const base = String(convertBaseCurrency || "").toUpperCase();
    const quote = String(convertQuoteCurrency || "").toUpperCase();
    const amountBase = Number(convertAmount || "0");

    if (!base || !quote || base === quote) {
      alert("Choisissez deux devises différentes.");
      return;
    }

    if (!Number.isFinite(amountBase) || amountBase <= 0) {
      alert("Entrez un montant valide dans la devise de base.");
      return;
    }

    setConvertProcessing(true);
    try {
      const rlusdPerBase = await getRlusdPerUnit(base);
      const rlusdPerQuote = quote === "RLUSD" ? 1 : await getRlusdPerUnit(quote);

      if (
        !Number.isFinite(rlusdPerBase) ||
        rlusdPerBase <= 0 ||
        !Number.isFinite(rlusdPerQuote) ||
        rlusdPerQuote <= 0
      ) {
        alert("Impossible de récupérer les taux de conversion pour cette paire.");
        return;
      }

      const rlusdValue = amountBase * rlusdPerBase;
      const epsilon = 1e-9;

      if (base === "RLUSD") {
        const unallocated = Number(currencyLinesSummary?.unallocatedRlusd);
        if (Number.isFinite(unallocated) && unallocated + epsilon < rlusdValue) {
          alert(
            `Insufficient unallocated RLUSD. Available: ${unallocated.toLocaleString(
              "en-US",
              { maximumFractionDigits: 6 }
            )} RLUSD.`
          );
          return;
        }
      } else {
        const availableAllocated = allocatedRlusdByCurrency.get(base) || 0;
        if (availableAllocated + epsilon < rlusdValue) {
          const maxUnits =
            availableAllocated > 0 ? availableAllocated / rlusdPerBase : 0;
          alert(
            `Montant trop élevé. Allocation disponible en ${base}: ${maxUnits.toLocaleString(
              "en-US",
              { maximumFractionDigits: 6 }
            )} ${base} (≈ ${availableAllocated.toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })} RLUSD).`
          );
          return;
        }
      }

      const result = await convertCurrencyAllocation({
        fromCurrencyCode: base,
        toCurrencyCode: quote,
        amountRlusd: rlusdValue,
        fromFxRate: rlusdPerBase,
        toFxRate: rlusdPerQuote,
      });

      if (!result || result.error) {
        throw new Error(result?.error || "Conversion failed");
      }

      if (quote === "RLUSD") {
        setConvertPreview(
          `Deallocated: ${amountBase.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} ${base} → ${rlusdValue.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} RLUSD (unallocated)`
        );
      } else {
        const quoteUnits = rlusdValue / rlusdPerQuote;
        setConvertPreview(
          `Allocation: ${amountBase.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} ${base} → ${quoteUnits.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} ${quote} (≈ ${rlusdValue.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} RLUSD)`
        );
      }

      setConvertAmount("");
    } catch (error) {
      console.error("Convert error:", error);
      alert("Conversion error: " + (error?.message || String(error)));
    } finally {
      setConvertProcessing(false);
    }
  };

  return (
    <>
      <div className={`flex flex-col bg-elevated h-full min-h-0 ${layout.containerClass}`}>
        {/* Header */}
        <div className={`panel-header ${layout.headerClass} flex flex-col shrink-0`}>
          {/* Titres discrets en haut */}
          <div className="flex items-center justify-between mb-2 md:mb-3">
            {layout.showBrandTitle ? (
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs md:text-sm font-orbitron font-semibold tracking-[0.2em] text-white/80 uppercase">
                  XCANNES
                </span>
                <span className="text-[10px] font-light text-white/30">|</span>
                <span className="text-[10px] font-light text-white/40 truncate max-w-[160px] sm:max-w-none">
                  Digital Asset Exchange
                </span>
              </div>
            ) : (
              <div />
            )}
            {/* Bouton Connect ou Déconnecter */}
            {effectiveIsConnected && effectiveWallet ? (
              <button
                type="button"
                onClick={() => disconnect()}
                className="px-3 py-1.5 text-[10px] md:text-xs bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-white/60 hover:text-red-400 rounded-md transition-colors"
              >
                Déconnecter
              </button>
            ) : (
              <XummConnectButton small variant="statement-blue" />
            )}
          </div>
          
          {/* Solde et info wallet */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl md:text-3xl font-orbitron font-semibold text-white">
              {totalLabel}
            </p>
            <p className="text-[11px] text-xcannes-green">
              ≈ 1.00 USD/RLUSD
            </p>
            
            {/* Bouton Global Statement - Toujours visible, même en démo */}
            <button
              onClick={() => setShowGlobalStatement(true)}
              className="mt-2 px-4 py-1.5 bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green rounded-lg text-xs font-medium transition-all duration-200 border border-xcannes-green/30 hover:scale-105"
            >
              📊 View Statement
            </button>
            
            <a 
              href="https://ripple.com/solutions/stablecoin/transparency/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] text-white/40 hover:text-xcannes-green/80 transition-colors"
            >
              Stablecoin agréé par la NYDFS
            </a>
            
            {/* Affichage du wallet connecté à la place du menu déroulant */}
            {effectiveIsConnected && effectiveWallet && (
            <div className="flex items-start gap-2 mt-1">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleOpenWalletLabelEditor}
                  className="inline-flex items-center gap-2 bg-xcannes-green/10 border border-xcannes-green/30 rounded-md px-3 py-1.5 text-left hover:bg-xcannes-green/20 transition-colors"
                  title="Rename wallet"
                >
                  <div className="w-2 h-2 rounded-full bg-xcannes-green animate-pulse" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-white/80 font-semibold truncate">
                      {walletLabel || "Wallet"}
                    </div>
                    <div className="text-[10px] text-white/60 font-mono truncate">
                      {effectiveWallet.slice(0, 8)}...{effectiveWallet.slice(-6)}
                    </div>
                  </div>
                </button>

                {isEditingWalletLabel && (
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-md px-2 py-1">
                    <input
                      type="text"
                      value={walletLabelDraft}
                      onChange={(e) => setWalletLabelDraft(e.target.value)}
                      placeholder="Custom wallet name"
                      className="w-40 bg-transparent text-[11px] text-white/80 outline-none placeholder:text-white/40"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveWalletLabel();
                        }
                        if (e.key === "Escape") {
                          handleCancelWalletLabel();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveWalletLabel}
                      className="px-2 py-1 text-[10px] rounded bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green border border-xcannes-green/30 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelWalletLabel}
                      className="px-2 py-1 text-[10px] rounded bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
                
              <button
                type="button"
                onClick={handleSwitchWallet}
                disabled={isConnecting}
                title="Changer de wallet"
                className="p-2 bg-white/5 hover:bg-xcannes-green/20 border border-white/10 hover:border-xcannes-green/40 text-white/60 hover:text-xcannes-green rounded-md transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 1l4 4-4 4M21 5H9a4 4 0 00-4 4v1M7 23l-4-4 4-4M3 19h12a4 4 0 004-4v-1" />
                </svg>
              </button>
              {/* Bouton Copier - icône uniquement */}
              <button
                type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyAddress();
                  }}
                  title="Copier l'adresse"
                  className="p-2 bg-white/5 hover:bg-xcannes-green/20 border border-white/10 hover:border-xcannes-green/40 text-white/60 hover:text-xcannes-green rounded-md transition-all active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action row: Send / Receive / Exchange / Buy / Trustlines */}
        <div
          className={`px-3 py-2 md:py-3 border-b border-white/5 space-y-2 md:space-y-3 ${layout.actionRowClass}`}
        >
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {/* Send */}
            <button
              type="button"
              onClick={() => setActiveAction("send")}
              className="wallet-action-btn wallet-action-send group"
            >
              <div className="wallet-action-icon">
                <svg
                  className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </div>
              <span className="wallet-action-label">Send</span>
            </button>

            {/* Receive */}
            <button
              type="button"
              onClick={() => setActiveAction("receive")}
              className="wallet-action-btn wallet-action-receive group"
            >
              <div className="wallet-action-icon">
                <svg
                  className="w-4 h-4 transition-transform duration-150 group-hover:translate-y-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
              </div>
              <span className="wallet-action-label">Receive</span>
            </button>

            {/* Convert */}
            <button
              type="button"
              onClick={() => setActiveAction("swap")}
              className="wallet-action-btn wallet-action-swap group"
            >
              <div className="wallet-action-icon">
                <svg
                  className="w-4 h-4 transition-transform duration-150 group-hover:rotate-90"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="17 1 21 5 17 9"></polyline>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                  <polyline points="7 23 3 19 7 15"></polyline>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                </svg>
              </div>
              <span className="wallet-action-label">Convert</span>
            </button>

            {/* Buy/Sell */}
            <button
              type="button"
              onClick={() => setActiveAction("cash")}
              className="wallet-action-btn wallet-action-buysell group"
            >
              <div className="wallet-action-icon">
                <svg
                  className="w-4 h-4 transition-transform duration-150 group-hover:scale-110"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
              </div>
              <span className="wallet-action-label">Buy/Sell</span>
            </button>
          </div>
          
          {/* KYC Status Panel - affiché uniquement si wallet connecté */}
          {effectiveIsConnected && effectiveWallet && (
            <div className="mt-2">
              <KYCStatusPanel
                walletAddress={effectiveWallet}
                kycStatus={kycStatus}
                onVerifyClick={() => setKycModalOpen(true)}
              />
            </div>
          )}
        </div>

        {/* Token list */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            className={`flex-1 min-h-0 p-3 overflow-y-auto overscroll-contain ${layout.tokenListClass} touch-pan-y`}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* Mobile: toutes les devises avec scroll adapté */}
            <div className="space-y-1.5 md:hidden">
              {tokenRows}
            </div>

            {/* Desktop: liste complète */}
            <div className="hidden md:flex md:flex-col md:space-y-1.5">
              {tokenRows}
            </div>
          </div>
        </div>

        <WalletDashboardFooter
          layout={layout}
          xrplConnectionIndicator={xrplConnectionIndicator}
          isFullPageView={isFullPageView}
          onOpenInfo={() => setWalletInfoOpen(true)}
        />
        <WalletInfoModal
          isOpen={walletInfoOpen}
          onClose={() => setWalletInfoOpen(false)}
        />
      </div>

      {/* Modales via Portal pour éviter les problèmes de z-index et overflow */}
      {typeof document !== 'undefined' && createPortal(
        <>
          {/* Modale SEND */}
          {activeAction === "send" && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
            onClick={() => setActiveAction(null)}
          />
          {/* Modale */}
          <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
            <div 
              className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto" 
              style={{ WebkitOverflowScrolling: 'touch' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveAction(null);
                }}
                className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
              >
                ✕
              </button>
              <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">
                {sendTab === "manual" ? "Send assets" : "Pay Request"}
              </h3>
              {renderWalletMeta("mb-2")}
              
              {/* Tabs */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSendTab("manual")}
                  className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
                    sendTab === "manual"
                      ? "bg-xcannes-green text-black font-semibold"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  Manual Send
                </button>
                <button
                  type="button"
                  onClick={() => setSendTab("scan-request")}
                  className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
                    sendTab === "scan-request"
                      ? "bg-xcannes-green text-black font-semibold"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  Scan Request
                </button>
              </div>
              
              <p className="text-xs md:text-sm text-white/50 mb-2 md:mb-4">
                {sendTab === "manual"
                  ? "Choisissez l'actif, le montant et l'adresse XRPL de destination."
                  : "Scannez un QR code de demande de paiement."}
              </p>
            
            {/* Tab Content: Manual Send */}
            {sendTab === "manual" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                    Asset
                  </label>
                  <select
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
                    value={selectedSendToken ? selectedSendToken.key : ""}
                  onChange={(e) => setSendAssetKey(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {augmentedTokens.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.currency}
                    </option>
                  ))}
                </select>
                {selectedSendToken && (
                  <p className="mt-1 text-[11px] text-white/40">
                    Balance:&nbsp;
                    <span className="text-white/70">
                      {selectedSendToken.value.toLocaleString("en-US", {
                        maximumFractionDigits: 6,
                      })}{" "}
                      {selectedSendToken.currency}
                    </span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                  Amount
                </label>
                <TokenAmountInput
                  value={sendAmount}
                  onChange={setSendAmount}
                  max={selectedSendToken ? selectedSendToken.value : undefined}
                  placeholder="0.0000"
                  token={selectedSendToken?.currency || "XRP"}
                />
              </div>
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                  Destination (XRPL address)
                </label>
                
                {/* Dropdown pour adresses sauvegardées */}
                {savedAddresses.length > 0 && (
                  <div className="mb-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          setSendDestination(e.target.value);
                        }
                      }}
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-xcannes-green/80"
                    >
                      <option value="">Select saved address...</option>
                      {savedAddresses.map((addr, idx) => (
                        <option key={idx} value={addr.address}>
                          {addr.label} ({addr.address.slice(0, 8)}...{addr.address.slice(-6)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sendDestination}
                    onChange={(e) => setSendDestination(e.target.value)}
                    placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQrScannerOpen(true);
                    }}
                    className="md:hidden px-3 py-2.5 bg-xcannes-green/20 hover:bg-xcannes-green/30 border border-xcannes-green/40 rounded-lg transition-colors"
                    title="Scan QR Code"
                  >
                    <svg className="w-5 h-5 text-xcannes-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendSubmit();
                }}
                disabled={sendProcessing}
                className="w-full mt-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-white/10"
              >
                {sendProcessing ? "Sending..." : "Send"}
              </button>
            </div>
            )}
            
            {/* Tab Content: Scan Request */}
            {sendTab === "scan-request" && (
              <div className="space-y-6">
                {/* Header explicatif */}
                <div className="bg-gradient-to-br from-xcannes-green/10 to-emerald-600/10 border border-xcannes-green/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-xcannes-green/20 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-xcannes-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-sm mb-1">Pay a Payment Request</h3>
                      <p className="text-white/70 text-xs leading-relaxed">
                        Scan a QR code to pay a merchant, friend, or service instantly. The payment details will be filled automatically.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bouton principal de scan */}
                <div className="text-center py-6">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPaymentRequestScannerOpen(true);
                    }}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-xcannes-green to-emerald-600 hover:from-xcannes-green/90 hover:to-emerald-600/90 rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-xcannes-green/30"
                  >
                    <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <span className="text-black font-bold text-base">Scan QR Code</span>
                  </button>
                </div>

                {/* Info supplémentaire */}
                <div className="bg-black/20 border border-white/5 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Compatible with XRPL payment requests, Xaman (XUMM) QR codes, and standard crypto addresses.
                    </p>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </>
      )}

      {/* Modale RECEIVE */}
      {activeAction === "receive" && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
            onClick={() => setActiveAction(null)}
          />
          {/* Modale */}
          <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
            <div 
              className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto" 
              style={{ WebkitOverflowScrolling: 'touch' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveAction(null);
                }}
                className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
              >
                ✕
              </button>
              <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">
                {receiveTab === "receive" ? "Receive assets" : "Request payment"}
              </h3>
              {renderWalletMeta("mb-2")}
              
              {/* Tabs */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setReceiveTab("receive")}
                  className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
                    receiveTab === "receive"
                      ? "bg-xcannes-green text-black font-semibold"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  Receive
                </button>
                <button
                  type="button"
                  onClick={() => setReceiveTab("request")}
                  className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
                    receiveTab === "request"
                      ? "bg-xcannes-green text-black font-semibold"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  Request Payment
                </button>
              </div>
              
              <p className="text-xs md:text-sm text-white/50 mb-3">
                {receiveTab === "receive" 
                  ? "Partagez cette adresse XRPL pour recevoir des fonds."
                  : "Créez une demande de paiement à envoyer à un autre wallet."}
              </p>
            
            {/* Tab Content: Receive */}
            {receiveTab === "receive" && effectiveWallet && (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-black/60 border border-white/10 rounded-xl p-3">
                  <QRCodeCanvas
                    value={effectiveWallet}
                    size={180}
                    bgColor="#000000"
                    fgColor="#ffffff"
                  />
                </div>
                <div className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 break-all">
                  {effectiveWallet}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyAddress();
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 text-xs text-white/80 hover:bg-white/20 transition-colors active:scale-95"
                >
                  Copy address
                </button>
              </div>
            )}
            
            {/* Tab Content: Request Payment */}
            {receiveTab === "request" && effectiveWallet && (
              <div className="space-y-4">
                {/* Amount & Currency */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                      Currency
                    </label>
                    <select
                      value={requestCurrency}
                      onChange={(e) => setRequestCurrency(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                    >
                      {augmentedTokens.map((t) => (
                        <option key={t.key} value={t.currency}>
                          {t.currency}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Memo (optional) */}
                <div>
                  <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                    Memo (optional)
                  </label>
                  <input
                    type="text"
                    value={requestMemo}
                    onChange={(e) => setRequestMemo(e.target.value)}
                    placeholder="Payment for..."
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                  />
                </div>

                {/* Request Method Selection */}
                <div>
                  <label className="block text-[11px] md:text-xs text-white/60 mb-2">
                    Send request via:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestMethod("qr")}
                      className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                        requestMethod === "qr"
                          ? "bg-xcannes-green/20 border-xcannes-green/40 text-xcannes-green"
                          : "bg-white/5 border-white/10 text-white/60"
                      } border`}
                    >
                      📱 QR Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestMethod("link")}
                      className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                        requestMethod === "link"
                          ? "bg-xcannes-green/20 border-xcannes-green/40 text-xcannes-green"
                          : "bg-white/5 border-white/10 text-white/60"
                      } border`}
                    >
                      🔗 Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestMethod("xrpl")}
                      className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                        requestMethod === "xrpl"
                          ? "bg-xcannes-green/20 border-xcannes-green/40 text-xcannes-green"
                          : "bg-white/5 border-white/10 text-white/60"
                      } border`}
                    >
                      💎 XRPL Request
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestMethod("notification")}
                      className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                        requestMethod === "notification"
                          ? "bg-xcannes-green/20 border-xcannes-green/40 text-xcannes-green"
                          : "bg-white/5 border-white/10 text-white/60"
                      } border`}
                    >
                      🔔 Notification
                    </button>
                  </div>
                </div>

                {/* Conditional: Address for notification */}
                {requestMethod === "notification" && (
                  <div>
                    <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                      Recipient Wallet Address
                    </label>
                    <input
                      type="text"
                      value={requestToAddress}
                      onChange={(e) => setRequestToAddress(e.target.value)}
                      placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                    />
                  </div>
                )}

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Implement payment request generation
                    alert(`Payment request feature coming soon!\nMethod: ${requestMethod}\nAmount: ${requestAmount} ${requestCurrency}`);
                  }}
                  className="w-full mt-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10"
                >
                  Generate Request
                </button>
                
                {/* Info */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-xs text-blue-400">
                    {requestMethod === "qr" && "Generate a QR code that can be scanned to pay you."}
                    {requestMethod === "link" && "Create a shareable link for this payment request."}
                    {requestMethod === "xrpl" && "Use XRPL native payment request (Payment Channel)."}
                    {requestMethod === "notification" && "Send a notification to the specified wallet address."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* Modale CONVERT (Swap) */}
      {activeAction === "swap" && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
            onClick={() => setActiveAction(null)}
          />
          {/* Modale */}
          <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
            <div 
              className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto" 
              style={{ WebkitOverflowScrolling: 'touch' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveAction(null);
                }}
                className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
              >
                ✕
              </button>
              <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">
                Convert assets
              </h3>
              <p className="text-xs md:text-sm text-white/60">
                Conversion interne des allocations RLUSD (pool RLUSD ↔ devises).
              </p>
              {renderWalletMeta("mb-2")}
              {!isPreviewMode && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-white/80">
                      Currency lines (allocations RLUSD)
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshCurrencyLines();
                      }}
                      className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/60 border border-white/10 transition-colors"
                      disabled={currencyLinesLoading}
                    >
                      Refresh
                    </button>
                  </div>

                  {currencyLinesError && (
                    <div className="text-[11px] text-red-400">
                      {currencyLinesError}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-[10px] text-white/60">
                    <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                      <div className="text-white/40">On-chain</div>
                      <div className="font-mono text-white/80">
                        {currencyLinesSummary?.rlusdOnChain == null
                          ? "—"
                          : Number(currencyLinesSummary.rlusdOnChain).toLocaleString(
                              "en-US",
                              { maximumFractionDigits: 6 }
                            )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                      <div className="text-white/40">Allocated</div>
                      <div className="font-mono text-white/80">
                        {Number(currencyLinesSummary?.totalAllocatedRlusd || 0).toLocaleString(
                          "en-US",
                          { maximumFractionDigits: 6 }
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                      <div className="text-white/40">Unallocated</div>
                      <div className="font-mono text-white/80">
                        {currencyLinesSummary?.unallocatedRlusd == null
                          ? "—"
                          : Number(currencyLinesSummary.unallocatedRlusd).toLocaleString(
                              "en-US",
                              { maximumFractionDigits: 6 }
                            )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {(currencyLines || []).length === 0 ? (
                      <div className="text-[11px] text-white/40">
                        No currency lines yet.
                      </div>
                    ) : (
                      currencyLines.map((line) => {
                        const code = String(line?.currencyCode || "").toUpperCase();
                        const allocated = Number.parseFloat(line?.allocatedRlusd ?? 0) || 0;
                        return (
                          <div
                            key={code}
                            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5"
                          >
                            <div className="min-w-0">
                              <div className="font-mono text-[11px] text-white/80">
                                {code}
                              </div>
                              <div className="text-[10px] text-white/40">
                                {allocated.toLocaleString("en-US", {
                                  maximumFractionDigits: 6,
                                })}{" "}
                                RLUSD
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCurrencyLine(code);
                              }}
                              className="px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-[10px] text-red-200 border border-red-500/30 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                  Base
                </label>
                <select
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
                  value={convertBaseCurrency}
                  onChange={(e) => setConvertBaseCurrency(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {swapCurrencyOptions
                    .filter(code => code !== convertQuoteCurrency)
                    .map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                  Quote
                </label>
                <select
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
                  value={convertQuoteCurrency}
                  onChange={(e) => setConvertQuoteCurrency(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {swapCurrencyOptions
                    .filter(code => code !== convertBaseCurrency)
                    .map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                  Amount
                </label>
                <TokenAmountInput
                  value={convertAmount}
                  onChange={setConvertAmount}
                  placeholder="0.0000"
                  token={convertBaseCurrency || "XRP"}
                />
                {convertPreview && (
                  <p className="mt-1 text-[11px] text-white/60">
                    {convertPreview}
                  </p>
                )}
              </div>

              {!isPreviewMode && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-white/80">
                    Add / set currency line
                  </div>
                  <WalletCurrencySelector
                    value={currencyLineCode}
                    onChange={setCurrencyLineCode}
                    placeholder="Select currency..."
                  />
                  <TokenAmountInput
                    value={currencyLineAllocatedRlusd}
                    onChange={setCurrencyLineAllocatedRlusd}
                    placeholder="Allocated (RLUSD)"
                    token="RLUSD"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpsertCurrencyLine();
                    }}
                    className="w-full bg-white/5 hover:bg-white/10 text-white/80 font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 border border-white/10"
                    disabled={
                      currencyLinesLoading ||
                      !currencyLineCode ||
                      String(currencyLineCode || "").toUpperCase() === "RLUSD"
                    }
                  >
                    Save line
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDemoConvert();
                }}
                className="w-full mt-1 bg-xcannes-green/80 hover:bg-xcannes-green text-black font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-white/10"
                disabled={
                  convertProcessing ||
                  !convertBaseCurrency ||
                  !convertQuoteCurrency ||
                  !convertAmount ||
                  (!isPreviewMode && !effectiveIsConnected)
                }
              >
                {convertProcessing
                  ? "Converting..."
                  : isPreviewMode
                  ? "Convert (demo, no real tx)"
                  : "Convert allocation"}
              </button>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Modale CASH (Buy/Sell) avec MoonPay */}
      {activeAction === "cash" && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
            onClick={() => setActiveAction(null)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
            <div 
              className="relative w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header avec onglets Buy/Sell */}
              <div className="border-b border-white/10">
                <div className="flex items-center justify-between p-4 pb-0">
                  <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                    Fiat Gateway
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveAction(null)}
                    className="text-white/60 hover:text-white transition-colors text-xl"
                  >
                    ✕
                  </button>
                </div>
                <div className="px-4 pb-3">{renderWalletMeta()}</div>
                
                {/* Onglets Buy/Sell */}
                <div className="flex gap-2 px-4 pt-3">
                  <button
                    type="button"
                    onClick={() => setCashModalTab("buy")}
                    className={`flex-1 px-4 py-3 rounded-t-lg font-semibold text-sm transition-all ${
                      cashModalTab === "buy"
                        ? 'bg-gradient-to-br from-green-500 to-xcannes-green text-white shadow-lg'
                        : 'bg-black/20 text-white/50 hover:bg-black/40 hover:text-white/80'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span>Buy Crypto</span>
                    </div>
                    <div className="text-[10px] mt-1 opacity-70">Fiat → Crypto</div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setCashModalTab("sell")}
                    className={`flex-1 px-4 py-3 rounded-t-lg font-semibold text-sm transition-all ${
                      cashModalTab === "sell"
                        ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg'
                        : 'bg-black/20 text-white/50 hover:bg-black/40 hover:text-white/80'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12H19M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Sell Crypto</span>
                    </div>
                    <div className="text-[10px] mt-1 opacity-70">Crypto → Fiat</div>
                  </button>
                </div>
              </div>

              {/* Contenu selon l'onglet actif */}
              <div className="p-4 md:p-5">
                {cashModalTab === "buy" ? (
                  <MoonPayBuyModal
                    isOpen={true}
                    onClose={() => setActiveAction(null)}
                    walletAddress={effectiveWallet || ""}
                    embedded={true}
                  />
                ) : (
                  <MoonPaySellModal
                    isOpen={true}
                    onClose={() => setActiveAction(null)}
                    walletAddress={effectiveWallet || ""}
                    embedded={true}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modale TRUSTLINE PAR DEVISE (depuis une ligne de wallet) */}
      {activeAction === "trustlineCurrency" && editingTrustlineCurrency && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
            onClick={handleCloseTrustlineEditor}
          />
          {/* Modale */}
          <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
            <div
              className="relative w-full max-w-md bg-gray-900 border-0 md:border md:border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto"
              style={{ WebkitOverflowScrolling: 'touch' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTrustlineEditor();
                }}
                className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
              >
                ✕
              </button>
            <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">
              {editingTrustlineCurrency} trustline
            </h3>
            <p className="text-[11px] text-white/60">
              Gérez le verrouillage XCS pour cette devise. Cette action ne
              modifie pas directement votre solde on-chain, seulement le suivi
              interne.
            </p>
            {currentEditingLine && (
              <p className="text-[11px] text-white/70">
                Actuellement verrouillé :{" "}
                <span className="font-semibold">
                  {Number(currentEditingLine.lockedXcs || 0).toLocaleString(
                    "en-US",
                    { maximumFractionDigits: 4 }
                  )}{" "}
                  XCS
                </span>
              </p>
            )}
            <div className="space-y-2">
              <label className="block text-[11px] text-white/60 mb-1">
                Locked XCS
              </label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={editingTrustlineLocked}
                onChange={(e) => setEditingTrustlineLocked(e.target.value)}
                placeholder="0.0000"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveTrustlineCurrency();
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-xcannes-green text-black text-sm font-semibold hover:bg-xcannes-green/90 transition-colors active:scale-95"
              >
                Enregistrer
              </button>
              {currentEditingLine && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTrustlineCurrency();
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500/80 text-white text-sm font-semibold hover:bg-red-500 transition-colors active:scale-95"
                >
                  Supprimer la trustline
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTrustlineEditor();
              }}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 text-xs text-white/80 hover:bg-white/10 transition-colors active:scale-95"
            >
              Fermer
            </button>
          </div>
        </div>
        </>
      )}

      {activeAction === "trustlines" && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
            onClick={() => setActiveAction(null)}
          />
          {/* Modale */}
          <div className="fixed inset-0 z-[10001] flex items-center justify-center px-3 pointer-events-none">
            <div
              className="relative w-full max-w-md sm:max-w-lg md:max-w-2xl bg-gray-900 border-0 md:border md:border-white/10 rounded-2xl p-4 md:p-5 lg:p-7 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto"
              style={{ WebkitOverflowScrolling: 'touch' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveAction(null);
                }}
                className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
              >
                ✕
              </button>
            <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">
              Trustlines
            </h3>
            <p className="text-[11px] text-white/60 mb-2">
              Ajoutez ou supprimez vos lignes internes de suivi XCS.
            </p>

            {/* Formulaire ajout trustline */}
            <div className="mb-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-2">
                <WalletCurrencySelector
                  value={trustlineCode}
                  onChange={setTrustlineCode}
                  placeholder="Select currency..."
                  extraOptions={[
                    { code: "XCS", name: "XCS Token" },
                    { code: "RLUSD", name: "RLUSD Stablecoin" },
                  ]}
                />
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={trustlineLocked}
                  onChange={(e) => setTrustlineLocked(e.target.value)}
                  placeholder="Locked XCS"
                  className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green"
                />
              </div>
              <div className="flex">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddTrustline();
                  }}
                  className="w-full md:w-auto md:ml-auto px-3 py-2 rounded-lg bg-xcannes-green text-black text-sm font-semibold hover:bg-xcannes-green/90 transition-colors active:scale-95"
                >
                  Valider &amp; créer la ligne
                </button>
              </div>
            </div>

            {/* Liste des lignes existantes */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {walletLinesLoading && (
                <p className="text-[11px] text-white/50">Loading trustlines…</p>
              )}
              {walletLinesError && (
                <p className="text-[11px] text-red-400">
                  {String(walletLinesError)}
                </p>
              )}
              {!walletLinesLoading &&
                !walletLinesError &&
                walletLines.length === 0 && (
                  <p className="text-[11px] text-white/50">
                    No wallet lines yet. Use the form above to add one.
                  </p>
                )}

              {walletLines.map((line) => (
                <button
                  key={line.currencyCode}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openTrustlineEditor(line.currencyCode);
                  }}
                  className="w-full text-left mb-2 active:scale-98"
                >
                  <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white">
                        {line.currencyCode}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">
                          {line.currencyCode}
                        </span>
                        <span className="text-[11px] text-white/50">
                          Locked XCS:{" "}
                          {Number(line.lockedXcs || 0).toLocaleString("en-US", {
                            maximumFractionDigits: 4,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Résumé total XCS bloqué */}
            <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
              <p className="text-[11px] text-white/60">
                Total locked XCS:{" "}
                <span className="font-semibold text-white">
                  {Number(totalLockedXcs || 0).toLocaleString("en-US", {
                    maximumFractionDigits: 4,
                  })}{" "}
                  XCS
                </span>
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveAction(null);
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 text-xs text-white/80 hover:bg-white/10 transition-colors active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
        </>
      )}
        </>,
        document.body
      )}

      {/* QR Scanner Modal for Address */}
      <QRScanner
        isOpen={qrScannerOpen}
        onScan={(address) => {
          setSendDestination(address);
          setQrScannerOpen(false);
        }}
        onClose={() => setQrScannerOpen(false)}
      />
      
      {/* QR Scanner Modal for Payment Request */}
      <QRScanner
        isOpen={paymentRequestScannerOpen}
        onScan={(data) => {
          try {
            const request = JSON.parse(data);
            if (request.amount && request.currency && request.to) {
              // Auto-fill send form with payment request data
              setSendAmount(request.amount);
              setSendDestination(request.to);
              // Find the matching asset
              const matchingToken = augmentedTokens.find(t => t.currency === request.currency);
              if (matchingToken) {
                setSendAssetKey(matchingToken.key);
              }
              // Switch to manual tab with pre-filled data
              setSendTab("manual");
              setPaymentRequestScannerOpen(false);
            } else {
              alert("Invalid payment request QR code");
            }
          } catch (err) {
            alert("Unable to parse payment request");
          }
        }}
        onClose={() => setPaymentRequestScannerOpen(false)}
      />

      {/* Modal Save Address */}
      {showSaveAddressPrompt && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
            onClick={() => {
              setShowSaveAddressPrompt(false);
              setAddressLabel("");
              setAddressToSave("");
            }}
          />
          <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
            <div 
              className="relative w-full max-w-md bg-gray-900 border-0 md:border md:border-white/10 rounded-2xl overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  Save this address?
                </h3>
                <p className="text-sm text-white/60 mb-4">
                  Would you like to save this address for future use?
                </p>
                <div className="mb-4">
                  <label className="block text-xs text-white/60 mb-2">
                    Address
                  </label>
                  <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 font-mono break-all">
                    {addressToSave}
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-xs text-white/60 mb-2">
                    Label (optional)
                  </label>
                  <input
                    type="text"
                    value={addressLabel}
                    onChange={(e) => setAddressLabel(e.target.value)}
                    placeholder="e.g., Exchange, Friend, ..."
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowSaveAddressPrompt(false);
                      setAddressLabel("");
                      setAddressToSave("");
                    }}
                    className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => {
                      saveAddress(addressToSave, addressLabel);
                      setShowSaveAddressPrompt(false);
                      setAddressLabel("");
                      setAddressToSave("");
                      alert("✅ Address saved!");
                    }}
                    className="flex-1 px-4 py-2.5 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Modal KYC MoonPay */}
      <MoonPayKYCModal
        isOpen={kycModalOpen}
        onClose={() => setKycModalOpen(false)}
        walletAddress={effectiveWallet}
        onKycComplete={handleKycComplete}
      />

      {/* Modal Global Statement */}
      {showGlobalStatement && (
        <GlobalStatement
          tokens={augmentedTokens}
          walletAddress={effectiveWallet}
          period="December 2025"
          isFullPage={isFullPageView}
          variant={statementVariant}
          usdRates={usdRates}
          onClose={() => setShowGlobalStatement(false)}
          onViewCurrency={(token) => {
            setSelectedStatementToken(token);
            setShowGlobalStatement(false);
            setShowCurrencyStatement(true);
          }}
        />
      )}

      {/* Modal Currency Statement */}
      {showCurrencyStatement && selectedStatementToken && (
        <CurrencyStatement
          currency={selectedStatementToken.currency}
          balance={parseFloat(selectedStatementToken.value || 0)}
          issuer={selectedStatementToken.issuer}
          walletAddress={effectiveWallet}
          isFullPage={isFullPageView}
          variant={statementVariant}
          usdRates={usdRates}
          transactions={[
            // Données de demo - à remplacer par de vraies transactions depuis l'API
            {
              date: "2025-12-28",
              description: "Receive from rPa...",
              category: "receive",
              type: "credit",
              amount: "250.00",
              counterparty: "rPaFcPEbMBqSBZfY6h4oJE3dqKyb6c4oB1",
              runningBalance: selectedStatementToken.value
            },
            {
              date: "2025-12-27",
              description: "Send to rMx...",
              category: "send",
              type: "debit",
              amount: "50.00",
              counterparty: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
              runningBalance: parseFloat(selectedStatementToken.value || 0) - 250
            },
            {
              date: "2025-12-26",
              description: "Exchange USD→EUR",
              category: "exchange",
              type: "credit",
              amount: "100.00",
              counterparty: "XCANNES DEX",
              runningBalance: parseFloat(selectedStatementToken.value || 0) - 200
            },
            {
              date: "2025-12-25",
              description: "Buy via MoonPay",
              category: "buy",
              type: "credit",
              amount: "200.00",
              counterparty: "MoonPay",
              runningBalance: parseFloat(selectedStatementToken.value || 0) - 300
            },
          ]}
          period="December 2025"
          onClose={() => {
            setShowCurrencyStatement(false);
            setSelectedStatementToken(null);
          }}
        />
      )}
    </>
  );
}
