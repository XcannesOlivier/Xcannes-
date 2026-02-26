"use client";

	import { useCallback, useEffect, useMemo, useRef, useState } from "react";
	import { createPortal } from "react-dom";
	import { useWallet } from "@/context/WalletContext";
import xcannesApi from "@/lib/xcannesApi";
import { apiUrl } from "@/lib/runtimeConfig";
	import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { encodeXrplCurrencyCode, XRPL_KNOWN_ISSUERS } from "@/utils/xrpl";
import {
  buildRlusdPaymentTxjson,
  computeSpreadQuote,
  XCANNES_SPREAD_WALLET_ADDRESS,
} from "@/utils/walletSpread";
	import { useWalletCurrencyLines } from "./hooks/useWalletCurrencyLines";
	import { useConvertForm } from "./hooks/useConvertForm";
	import { useCurrencyLinesForm } from "./hooks/useCurrencyLinesForm";
import { useCurrencyLinesActions } from "./hooks/useCurrencyLinesActions";
	import { useSavedAddresses } from "./hooks/useSavedAddresses";
	import { usePaymentRequestScanner } from "./hooks/usePaymentRequestScanner";
	import { usePaymentRequestForm } from "./hooks/usePaymentRequestForm";
	import { useReceiveForm } from "./hooks/useReceiveForm";
	import { useSendForm } from "./hooks/useSendForm";
import { useSwapConversion } from "./hooks/useSwapConversion";
import { useSwapDemoLines } from "./hooks/useSwapDemoLines";
import { useWalletTokens } from "./hooks/useWalletTokens";
import { useRlusdPerUnitRates } from "./hooks/useRlusdPerUnitRates";
import { useUsdTotalLabel } from "./hooks/useUsdTotalLabel";
import { useWalletMeta } from "./hooks/useWalletMeta";
import { lockBodyScroll } from "@/utils/bodyScrollLock";
import { useXrplConnectionIndicator } from "./hooks/useXrplConnectionIndicator";
import { useWalletLabel } from "./hooks/useWalletLabel";
import WalletDashboardFooter from "./components/WalletDashboardFooter";
import WalletDashboardHeader from "./components/WalletDashboardHeader";
import WalletDashboardActionRow from "./components/WalletDashboardActionRow";
import WalletDashboardTokenList from "./components/WalletDashboardTokenList";
import WalletDashboardTokenRow from "./components/WalletDashboardTokenRow";
import WalletDashboardSaveAddressPrompt from "./components/WalletDashboardSaveAddressPrompt";
import QRScanner from "./components/QRScanner";
import XummQRModal from "@/components/xumm/XummQRModal";
import WalletDashboardCashModal from "./modals/WalletDashboardCashModal";
import WalletDashboardReceiveModal from "./modals/WalletDashboardReceiveModal";
import WalletDashboardSendModal from "./modals/WalletDashboardSendModal";
import WalletDashboardPayreqModal from "./modals/WalletDashboardPayreqModal";
import WalletDashboardStatementModals from "./modals/WalletDashboardStatementModals";
import WalletDashboardSwapModal from "./modals/WalletDashboardSwapModal";
import WalletDashboardAdjustModal from "./modals/WalletDashboardAdjustModal";
import WalletInfoModal from "./modals/WalletInfoModal";
import WalletActivationModal from "./modals/WalletActivationModal";
import WalletActivationRequestModal from "./modals/WalletActivationRequestModal";
import WalletRlusdSetupModal from "./modals/WalletRlusdSetupModal";
import { buildMoonpayMemo, buildPayreqMemo, buildWalletLabelMemo, buildXrplJsonMemo } from "@/utils/xrplMemo";
import { useTranslation } from "next-i18next";
import {
  getCurrencyFlag,
  getDisplayCurrencyCode,
  getTokenIcon,
  formatAmountWithSymbol,
  resolveWalletLayout,
  WALLET_CURRENCY_LINE_ORDER,
  USD_STABLECOINS,
  WALLET_ACCEPTED_TOKENS,
} from "./walletDashboardConfig";

// Wallet label fee removed — naming is now free (embedded in TrustSet memo
// or via 1-drop XRP self-payment fallback).

const DEFAULT_ADJUSTMENT_FEE_RLUSD = 1;
const ADJUSTMENT_FEE_RLUSD = (() => {
  const raw = Number.parseFloat(
    process.env.NEXT_PUBLIC_WALLET_ADJUSTMENT_FEE_RLUSD || ""
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ADJUSTMENT_FEE_RLUSD;
})();

const DEFAULT_ACTIVATION_XRP_AMOUNT = 1;
const ACTIVATION_BUNDLE_XRP_AMOUNT = 1.4;
// Priorité d'affichage synchronisée avec useWalletTokens.
const WALLET_TOKEN_PRIORITY = { USD: 0, XRP: 999 };

/**
 * Filtre les tokens on-chain: seuls les actifs acceptés par XCANNES sont
 * gardés. XRP est natif (pas dans account_lines), RLUSD est le seul token
 * accepté. Tout autre trustline (XCS, USDC, random tokens…) est ignoré.
 */
function isAcceptedOnChainToken(currency) {
  const code = String(currency || "").toUpperCase();
  return WALLET_ACCEPTED_TOKENS.has(code);
}
const PREVIEW_WALLET_ID = "PREVIEW";
const MAX_PREVIEW_EVENTS = 120;

const MOONPAY_SELL_WALLETS = new Set(
  String(process.env.NEXT_PUBLIC_MOONPAY_WALLETS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
);

const isMoonpaySellDestination = (address) => {
  const dest = String(address || "").trim();
  return dest && MOONPAY_SELL_WALLETS.has(dest);
};

const buildMoonpaySellMemos = (destination, { currency, amount, amountRlusd } = {}) => {
  if (!isMoonpaySellDestination(destination)) return null;
  const payload = buildMoonpayMemo({
    side: "sell",
    provider: "moonpay",
    currencyCode: currency || null,
    amount: Number.isFinite(Number(amount)) ? Number(amount) : null,
    amountRlusd: Number.isFinite(Number(amountRlusd)) ? Number(amountRlusd) : null,
  });
  if (!payload) return null;
  return buildXrplJsonMemo(payload);
};

const appendMemos = (txjson, extraMemos) => {
  if (!txjson || !Array.isArray(extraMemos) || extraMemos.length === 0) return;
  const existing = Array.isArray(txjson.Memos) ? txjson.Memos : [];
  txjson.Memos = [...existing, ...extraMemos];
};

export default function WalletDashboard({
  preview = false,
  isFullPage = false,
  variant,
  showDesktopStatement = false,
  showPayreqDecor = false,
  qrSizingVariant = "default",
  showMobileHomeLink = false,
  allowBackgroundScrollOnMobile = false,
  allowPageScrollOnMobile = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  // Preview wallet (non connecté) : tout à 0 pour éviter de faire croire à un solde réel.
  const DEMO_RLUSD_TOTAL = 0;
  const layout = useMemo(
    () => resolveWalletLayout(variant, isFullPage),
    [variant, isFullPage]
  );
  const isFullPageView = layout.isFullPage;
  const statementVariant = layout.statementVariant;
  const showDesktopStatementPanel = Boolean(showDesktopStatement);
  const payreqDecorProps = showPayreqDecor ? { showFauxPayreqDecor: true } : {};

  const {
    wallet,
    isConnected,
    isConnecting,
    balance,
    isWalletActivated,
    qrModalData,
    refreshBalance,
    connect,
    disconnect,
    signTransaction,
    closeQrModal,
  } = useWallet();

  // Mode "preview" ne doit JAMAIS faire croire que le wallet est connecté.
  // On l'utilise uniquement pour afficher des données de démonstration
  // quand aucun wallet n'est connecté.
  const isPreviewMode = preview && !isConnected;
  const effectiveIsConnected = isConnected;

  const effectiveWallet = isPreviewMode
    ? "rPREVIEWWALLETxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    : wallet;

  const effectiveBalance = isPreviewMode
    ? {
        xrp: "0",
        // En mode preview, on laisse la liste de devises vide
        // pour que les lignes soient créées via les trustlines.
        tokens: [],
      }
    : balance;

  const baseTokens = useMemo(
    () => (effectiveBalance?.tokens || []).filter(
      (t) => isAcceptedOnChainToken(t?.currency)
    ),
    [effectiveBalance?.tokens]
  );
  const hasOnChainRlusd = (baseTokens || []).some(
    (t) => String(t?.currency || "").toUpperCase() === "RLUSD"
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef(null);
  const [activeAction, setActiveAction] = useState(null); // 'send' | 'receive' | 'swap' | 'buy' | 'sell' | null
  const [swapDefaultView, setSwapDefaultView] = useState("convert");
  const [swapLockedView, setSwapLockedView] = useState(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showActivationRequestModal, setShowActivationRequestModal] = useState(false);
  const [showRlusdSetupModal, setShowRlusdSetupModal] = useState(false);
  const [isDesktopPanel, setIsDesktopPanel] = useState(false);
  const desktopDefaultActionSetRef = useRef(false);
  const adjustmentAutoOpenedRef = useRef(false);
  const { receiveTab, setReceiveTab } = useReceiveForm();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showDesktopStatementPanel) {
      setIsDesktopPanel(false);
      desktopDefaultActionSetRef.current = false;
      return;
    }
    const media = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsDesktopPanel(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [showDesktopStatementPanel]);
  const {
    sendTab,
    setSendTab,
    sendAssetKey,
    setSendAssetKey,
    sendDestination,
    setSendDestination,
    sendAmount,
    setSendAmount,
    sendProcessing,
    setSendProcessing,
    sendPaymentRequest,
    setSendPaymentRequest,
  } = useSendForm();
  
  // Adresses sauvegardées
  const { savedAddresses, saveAddress } = useSavedAddresses();
  const [showSaveAddressPrompt, setShowSaveAddressPrompt] = useState(false);
  const [addressToSave, setAddressToSave] = useState("");
  const [addressLabel, setAddressLabel] = useState("");
  const {
    walletLabel,
    walletLabelDraft,
    setWalletLabelDraft,
    isEditingWalletLabel,
    isWalletLabelRequired,
    isWalletLabelLocked,
    walletHeaderToast,
    flashWalletHeaderToast,
    openWalletLabelEditor: handleOpenWalletLabelEditor,
    saveWalletLabel: handleSaveWalletLabel,
    cancelWalletLabel: handleCancelWalletLabel,
    loadWalletLabel,
  } = useWalletLabel({
    walletAddress: effectiveWallet,
    isConnected: effectiveIsConnected,
    isPreviewMode,
    isWalletActivated,
    hasOnChainRlusd,
    defaultLabel: t("nav_wallet", "Wallet"),
    signTransaction,
  });
  const defaultWalletLabel = t("nav_wallet", "Wallet");
  const walletHasCustomLabel = Boolean(
    String(walletLabel || "").trim() && String(walletLabel || "").trim() !== defaultWalletLabel
  );
  const { renderWalletMeta } = useWalletMeta({
    walletAddress: effectiveWallet,
    walletLabel,
    hideAddress: false,
  });

  const [cashBuyPrefill, setCashBuyPrefill] = useState(null);

  const [cashModalTab, setCashModalTab] = useState("buy"); // 'buy' | 'sell' - Onglet actif dans la modal Cash
  const [activationBundleEnabled, setActivationBundleEnabled] = useState(false);
  const activationXrpAmount = activationBundleEnabled ?
    ACTIVATION_BUNDLE_XRP_AMOUNT :
    DEFAULT_ACTIVATION_XRP_AMOUNT;
  const activationXrpAmountLabel = activationBundleEnabled ? "1.40" : "1";
  
  // États pour Payment Request
  const {
    requestAmount,
    setRequestAmount,
    requestCurrency,
    setRequestCurrency,
    requestMemo,
    setRequestMemo,
  } = usePaymentRequestForm();
  
  const {
    convertBaseCurrency,
    setConvertBaseCurrency,
    convertQuoteCurrency,
    setConvertQuoteCurrency,
    convertAmount,
    setConvertAmount,
    convertPreview,
    setConvertPreview,
    convertProcessing,
    setConvertProcessing,
  } = useConvertForm({ defaultBaseCurrency: "USD", defaultQuoteCurrency: "EUR" });

  // Empêcher la sélection de XRP ou RLUSD comme devise de requête de paiement.
  // USD est le terme visible pour l'utilisateur — ne pas le forcer sur RLUSD.
  useEffect(() => {
    const upper = String(requestCurrency || "").trim().toUpperCase();
    if (upper === "XRP" || upper === "RLUSD") {
      setRequestCurrency("USD");
    }
  }, [requestCurrency, setRequestCurrency]);

  // Empêcher XRP/RLUSD dans les sélecteurs de conversion.
  useEffect(() => {
    const baseUpper = String(convertBaseCurrency || "").trim().toUpperCase();
    const quoteUpper = String(convertQuoteCurrency || "").trim().toUpperCase();
    if (baseUpper === "XRP" || baseUpper === "RLUSD") {
      setConvertBaseCurrency("USD");
    }
    if (quoteUpper === "XRP" || quoteUpper === "RLUSD") {
      setConvertQuoteCurrency("USD");
    }
  }, [convertBaseCurrency, convertQuoteCurrency, setConvertBaseCurrency, setConvertQuoteCurrency]);
  const {
    currencyLineCode,
    setCurrencyLineCode,
    currencyLineAllocatedRlusd,
    setCurrencyLineAllocatedRlusd,
  } = useCurrencyLinesForm();
  
  // États pour les relevés bancaires
  const [showGlobalStatement, setShowGlobalStatement] = useState(false);
  const [showCurrencyStatement, setShowCurrencyStatement] = useState(false);
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);
  const [selectedStatementToken, setSelectedStatementToken] = useState(null);
  const [previewEvents, setPreviewEvents] = useState([]);
  const [statementHighlightByCurrency, setStatementHighlightByCurrency] = useState({});
  const previewEventCounterRef = useRef(0);

  const formatPreviewAddressShort = useCallback((address) => {
    const clean = String(address || "").trim();
    if (!clean) return "";
    if (clean.length <= 12) return clean;
    return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
  }, []);

  const buildPreviewEventId = useCallback((prefix = "evt") => {
    previewEventCounterRef.current += 1;
    return `${prefix}_${Date.now()}_${previewEventCounterRef.current}`;
  }, []);

  const recordStatementHighlight = useCallback((currency, eventId) => {
    const key = String(currency || "").trim().toUpperCase();
    if (!key || !eventId) return;
    setStatementHighlightByCurrency((prev) => ({
      ...(prev || {}),
      [key]: { eventId, ts: Date.now() },
    }));
  }, []);

  const pushPreviewEvent = useCallback(
    (event) => {
      if (!isPreviewMode) return;
      if (!event || !event.id) return;
      setPreviewEvents((prev) => {
        const next = [event, ...(Array.isArray(prev) ? prev : [])];
        if (next.length > MAX_PREVIEW_EVENTS) {
          next.length = MAX_PREVIEW_EVENTS;
        }
        return next;
      });
    },
    [isPreviewMode]
  );

  const handlePreviewConvert = useCallback(
    (payload) => {
      if (!isPreviewMode || !payload) return;
      const base = String(payload?.base || payload?.fromCurrency || "")
        .trim()
        .toUpperCase();
      const quote = String(payload?.quote || payload?.toCurrency || "")
        .trim()
        .toUpperCase();
      if (!base || !quote) return;
      const eventId = buildPreviewEventId("convert");
      const event = {
        id: eventId,
        ts: Number(payload?.ts) || Date.now(),
        kind: "convert",
        wallet: PREVIEW_WALLET_ID,
        fromCurrency: base,
        toCurrency: quote,
        fromAmount: Number(payload?.amountBase ?? payload?.fromAmount ?? 0),
        toAmount: Number(payload?.amountQuote ?? payload?.toAmount ?? 0),
        usdGross: Number(
          payload?.amountRlusdGross ?? payload?.rlusdGross ?? payload?.usdGross ?? 0
        ),
        usdNet: Number(
          payload?.amountRlusdNet ?? payload?.rlusdNet ?? payload?.usdNet ?? 0
        ),
        feeUsd: Number(
          payload?.spreadFeeRlusd ?? payload?.feeRlusd ?? payload?.feeUsd ?? 0
        ),
      };
      pushPreviewEvent(event);
      recordStatementHighlight(base, eventId);
      recordStatementHighlight(quote, eventId);
    },
    [buildPreviewEventId, isPreviewMode, pushPreviewEvent, recordStatementHighlight]
  );
  
  const { demoLines, setDemoLines } = useSwapDemoLines({
    demoRlusdTotal: DEMO_RLUSD_TOTAL,
  });

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

  const currencyOrderIndex = useMemo(() => {
    const entries = Array.isArray(WALLET_CURRENCY_LINE_ORDER)
      ? WALLET_CURRENCY_LINE_ORDER
      : [];
    const index = new Map();
    entries.forEach((code, idx) => {
      const upper = String(code || "").toUpperCase();
      if (!upper) return;
      if (!index.has(upper)) index.set(upper, idx);
    });
    return index;
  }, []);

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

      // S'assurer qu'il y a toujours une ligne RLUSD dédiée
      if (!seen.has("RLUSD")) {
        tokens.push({
          key: "DEMO:RLUSD",
          currency: "RLUSD",
          issuer: "Trustline",
          value: 0,
          demoRlusdValue: 0,
        });
        seen.add("RLUSD");
      }



      tokens.sort((a, b) => {
        const aCode = String(a?.currency || "").toUpperCase();
        const bCode = String(b?.currency || "").toUpperCase();
        const aPriority = Object.prototype.hasOwnProperty.call(WALLET_TOKEN_PRIORITY, aCode)
          ? WALLET_TOKEN_PRIORITY[aCode]
          : Number.POSITIVE_INFINITY;
        const bPriority = Object.prototype.hasOwnProperty.call(WALLET_TOKEN_PRIORITY, bCode)
          ? WALLET_TOKEN_PRIORITY[bCode]
          : Number.POSITIVE_INFINITY;
        if (aPriority !== bPriority) return aPriority - bPriority;
        const aOrder = currencyOrderIndex.get(aCode) ?? Number.POSITIVE_INFINITY;
        const bOrder = currencyOrderIndex.get(bCode) ?? Number.POSITIVE_INFINITY;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return aCode.localeCompare(bCode);
      });

      return tokens;
    }

    // Mode "réel": seul XRP est affiché comme token on-chain.
    // RLUSD n'apparaît plus directement — il est décomposé en :
    //   - ligne USD (pool non alloué) via currencyLines
    //   - lignes de devises internes (EUR, GBP…) via currencyLines
    // Le solde RLUSD on-chain reste accessible via baseTokens / hasOnChainRlusd
    // pour la cohérence (invariant) et les opérations internes.
    const tokens = [
      {
        key: "XRP",
        currency: "XRP",
        issuer: "Native",
        value: xrpAmount,
      },
    ];

    tokens.sort((a, b) => {
      const aCode = String(a?.currency || "").toUpperCase();
      const bCode = String(b?.currency || "").toUpperCase();
      const aPriority = Object.prototype.hasOwnProperty.call(WALLET_TOKEN_PRIORITY, aCode)
        ? WALLET_TOKEN_PRIORITY[aCode]
        : Number.POSITIVE_INFINITY;
      const bPriority = Object.prototype.hasOwnProperty.call(WALLET_TOKEN_PRIORITY, bCode)
        ? WALLET_TOKEN_PRIORITY[bCode]
        : Number.POSITIVE_INFINITY;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aOrder = currencyOrderIndex.get(aCode) ?? Number.POSITIVE_INFINITY;
      const bOrder = currencyOrderIndex.get(bCode) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return aCode.localeCompare(bCode);
    });

    return tokens;
  }, [baseTokens, currencyOrderIndex, xrpAmount, isPreviewMode, demoLines]);

  // Adresse backend (session API)
  const backendWalletAddress = isPreviewMode ? null : effectiveWallet || null;

  const {
    lines: currencyLines,
    summary: currencyLinesSummary,
    loading: currencyLinesLoading,
    error: currencyLinesError,
    refresh: refreshCurrencyLines,
    upsertCurrencyLine,
  } = useWalletCurrencyLines(backendWalletAddress, { signTransaction });

  const {
    handleUpsertCurrencyLine: handleUpsertCurrencyLineReal,
  } =
    useCurrencyLinesActions({
      backendWalletAddress,
      currencyLineCode,
      currencyLineAllocatedRlusd,
      setCurrencyLineCode,
      setCurrencyLineAllocatedRlusd,
      upsertCurrencyLine,
    });

  const demoCurrencyLines = useMemo(() => {
    if (!isPreviewMode) return [];
    const entries = Object.entries(demoLines || {});
    return entries
      .filter(([code]) => String(code || "").toUpperCase() !== "RLUSD")
      .map(([code, line]) => ({
        currencyCode: String(code || "").toUpperCase(),
        allocatedRlusd: Number(line?.rlusd || 0),
        fxSource: "DEMO",
      }))
      .sort((a, b) => {
        const aCode = String(a?.currencyCode || "").toUpperCase();
        const bCode = String(b?.currencyCode || "").toUpperCase();
        const aOrder = currencyOrderIndex.get(aCode) ?? Number.POSITIVE_INFINITY;
        const bOrder = currencyOrderIndex.get(bCode) ?? Number.POSITIVE_INFINITY;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return aCode.localeCompare(bCode);
      });
  }, [currencyOrderIndex, demoLines, isPreviewMode]);

  const demoCurrencyLinesSummary = useMemo(() => {
    if (!isPreviewMode) return null;
    const unallocated = Number(demoLines?.RLUSD?.rlusd || 0);
    const totalAllocated = Object.entries(demoLines || {}).reduce((sum, [code, line]) => {
      const upper = String(code || "").toUpperCase();
      if (!upper || upper === "RLUSD") return sum;
      const value = Number(line?.rlusd || 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const rlusdOnChain = unallocated + totalAllocated;
    return {
      rlusdOnChain,
      totalAllocatedRlusd: totalAllocated,
      unallocatedRlusd: unallocated,
      invariantOk: true,
      excessAllocatedRlusd: 0,
    };
  }, [demoLines, isPreviewMode]);

  const effectiveCurrencyLinesSummary = isPreviewMode
    ? demoCurrencyLinesSummary
    : currencyLinesSummary;
  const effectiveCurrencyLines = useMemo(() => {
    const base = isPreviewMode ? demoCurrencyLines : currencyLines;
    const lines = Array.isArray(base) ? [...base] : [];
    const existing = new Set(
      lines.map((l) => String(l?.currencyCode || "").toUpperCase()).filter(Boolean)
    );

    // Lignes par défaut affichées dans tout wallet (même nouveau).
    const DEFAULT_LINES = ["USD", "EUR", "CHF", "GBP", "CAD", "JPY", "AED"];

    // Injecter la ligne USD synthétique avec le montant non alloué.
    const unallocatedRaw = effectiveCurrencyLinesSummary?.unallocatedRlusd;
    const unallocated = Number(unallocatedRaw);
    if (!existing.has("USD") && unallocatedRaw != null && Number.isFinite(unallocated)) {
      lines.push({
        currencyCode: "USD",
        allocatedRlusd: unallocated,
        isDerived: true,
        active: false,
      });
      existing.add("USD");
    } else if (!existing.has("USD")) {
      lines.push({
        currencyCode: "USD",
        allocatedRlusd: 0,
        isDerived: true,
        active: false,
      });
      existing.add("USD");
    }

    // Injecter les autres lignes par défaut (allocation 0) si absentes.
    DEFAULT_LINES.forEach((code) => {
      if (!existing.has(code)) {
        lines.push({
          currencyCode: code,
          allocatedRlusd: 0,
          isDerived: true,
          active: false,
        });
        existing.add(code);
      }
    });

    return lines.sort((a, b) => {
      const aCode = String(a?.currencyCode || "").toUpperCase();
      const bCode = String(b?.currencyCode || "").toUpperCase();
      const aOrder = currencyOrderIndex.get(aCode) ?? Number.POSITIVE_INFINITY;
      const bOrder = currencyOrderIndex.get(bCode) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return aCode.localeCompare(bCode);
    });
  }, [
    currencyLines,
    currencyOrderIndex,
    demoCurrencyLines,
    effectiveCurrencyLinesSummary,
    isPreviewMode,
  ]);
  const effectiveCurrencyLinesLoading = isPreviewMode ? false : currencyLinesLoading;
  const effectiveCurrencyLinesError = isPreviewMode ? null : currencyLinesError;
  const effectiveRefreshCurrencyLines = useMemo(() => {
    if (isPreviewMode) return () => {};
    return refreshCurrencyLines;
  }, [isPreviewMode, refreshCurrencyLines]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPreviewMode) return;
    if (!backendWalletAddress || !effectiveRefreshCurrencyLines) return;

    const handleWalletRefresh = (event) => {
      const address = event?.detail?.address;
      if (!address || address !== backendWalletAddress) return;
      effectiveRefreshCurrencyLines();
    };

    window.addEventListener("xcannes:wallet:refresh", handleWalletRefresh);
    return () => window.removeEventListener("xcannes:wallet:refresh", handleWalletRefresh);
  }, [backendWalletAddress, effectiveRefreshCurrencyLines, isPreviewMode]);

  const adjustmentDeficitRlusd = Number(
    effectiveCurrencyLinesSummary?.excessAllocatedRlusd ?? 0
  );
  const hasAdjustmentDeficit =
    Number.isFinite(adjustmentDeficitRlusd) && adjustmentDeficitRlusd > 1e-9;

  const submitCurrencyLineAction = useCallback(async ({ action, memoPayload, memoPayloads } = {}) => {
    if (!wallet || !signTransaction) {
      alert("Please connect your Xumm wallet first.");
      return null;
    }

    const payloadList = [];
    if (Array.isArray(memoPayloads)) {
      payloadList.push(...memoPayloads);
    }
    if (memoPayload) {
      payloadList.push(memoPayload);
    }
    if (payloadList.length > 0) {
      const memos = [];
      for (const payload of payloadList) {
        if (!payload) {
          alert("Invalid memo payload.");
          return null;
        }
        const built = buildXrplJsonMemo(payload);
        if (!built) {
          alert("Invalid memo payload.");
          return null;
        }
        memos.push(...built);
      }
      if (memos.length === 0) {
        alert("Invalid memo payload.");
        return null;
      }
      const txjson = {
        TransactionType: "Payment",
        Account: wallet,
        Destination: wallet,
        Amount: "1", // 1 drop XRP (memo-only trace, no RLUSD fee)
        Memos: memos,
      };
      const result = await signTransaction(txjson, { action });
      if (!result?.signed || !result?.uuid) {
        alert("Action cancelled or expired.");
        return null;
      }

      if (refreshBalance) {
        setTimeout(() => refreshBalance(), 2500);
      }

      return result.uuid;
    }
    alert("Invalid memo payload.");
    return null;
  }, [refreshBalance, signTransaction, wallet]);

  // 🆕 MISE À JOUR : Activation automatique et GRATUITE lors de la conversion
  // Les currency lines ne nécessitent plus d'activation manuelle payante.
  // Elles s'activent automatiquement lors de la première conversion.
  const handleActivateCurrencyLine = useCallback(
    async (code) => {
      const currencyCode = String(code || "").trim().toUpperCase();
      if (!currencyCode || currencyCode.length < 2) return false;
      if (currencyCode === "RLUSD" || currencyCode === "XRP") return false;

      if (isPreviewMode) {
        setDemoLines((prev) => {
          const next = { ...(prev || {}) };
          if (next[currencyCode]) return next;
          next[currencyCode] = { currency: currencyCode, rlusd: 0, units: 0, rate: 0 };
          return next;
        });
        const eventId = buildPreviewEventId("line");
        pushPreviewEvent({
          id: eventId,
          ts: Date.now(),
          kind: "trustline_add",
          wallet: PREVIEW_WALLET_ID,
          currency: currencyCode,
        });
        recordStatementHighlight(currencyCode, eventId);
        return true;
      }

      // Mode réel : les lignes de devises sont activées automatiquement et gratuitement
      // lorsqu'un paiement arrive ou qu'une conversion est effectuée.
      // Ouvrir le convertisseur pour que l'utilisateur puisse allouer sa première conversion.
      if (!backendWalletAddress) {
        alert("Please connect your Xumm wallet first.");
        return false;
      }

      const alreadyActive = (currencyLines || []).some(
        (line) => String(line?.currencyCode || "").toUpperCase() === currencyCode
      );
      if (alreadyActive) {
        alert(
          t("ui_currency_line_already_active", {
            defaultValue: "Cette devise est déjà activée dans votre wallet.",
          })
        );
        return false;
      }

      // Ouvrir le convertisseur avec la devise présélectionnée (activation gratuite)
      setConvertBaseCurrency("RLUSD");
      setConvertQuoteCurrency(currencyCode);
      setConvertAmount("");
      setSwapDefaultView("convert");
      setSwapLockedView(null);
      setActiveAction("swap");
      return true;
    },
    [
      backendWalletAddress,
      buildPreviewEventId,
      currencyLines,
      isPreviewMode,
      pushPreviewEvent,
      recordStatementHighlight,
      setActiveAction,
      setConvertAmount,
      setConvertBaseCurrency,
      setConvertQuoteCurrency,
      setDemoLines,
      setSwapDefaultView,
      setSwapLockedView,
      t,
    ]
  );



  const handleUpsertCurrencyLine = useCallback(async () => {
    if (isPreviewMode) {
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

      setDemoLines((prev) => {
        const next = { ...(prev || {}) };
        const existing = next[code] || { currency: code, rlusd: 0, units: 0, rate: 0 };
        const existingUnits = Number(existing.units || 0);
        const existingRlusd = Number(existing.rlusd || 0);
        const existingPerUnit =
          Number.isFinite(existingUnits) &&
          existingUnits > 0 &&
          Number.isFinite(existingRlusd) &&
          existingRlusd > 0
            ? existingRlusd / existingUnits
            : null;
        const perUnit = existingPerUnit || 1;
        const units = allocated > 0 && perUnit > 0 ? allocated / perUnit : 0;
        const pool = next.RLUSD || { currency: "RLUSD", rlusd: 0, units: 0, rate: 1 };
        const poolRlusd = Number(pool.rlusd || 0);
        const delta = allocated - (Number.isFinite(existingRlusd) ? existingRlusd : 0);
        if (delta > 0 && poolRlusd + 1e-9 < delta) {
          alert(
            `Insufficient unallocated RLUSD (demo). Available: ${poolRlusd.toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })} RLUSD.`
          );
          return prev;
        }

        next.RLUSD = {
          ...pool,
          rlusd: Math.max(0, poolRlusd - delta),
          units: Math.max(0, poolRlusd - delta),
          rate: 1,
        };

        next[code] = {
          ...existing,
          currency: code,
          rlusd: allocated,
          units,
          rate: allocated > 0 ? units / allocated : Number(existing.rate || 0),
        };
        return next;
      });

      setCurrencyLineCode("");
      setCurrencyLineAllocatedRlusd("");
      return;
    }

    await handleUpsertCurrencyLineReal?.();
  }, [
    currencyLineAllocatedRlusd,
    currencyLineCode,
    handleUpsertCurrencyLineReal,
    isPreviewMode,
    setCurrencyLineAllocatedRlusd,
    setCurrencyLineCode,
    setDemoLines,
  ]);

  const handleInstallRequiredTrustline = useCallback(
    async (currencyCode, { walletSetup } = {}) => {
      const code = String(currencyCode || "").toUpperCase();
      if (!code) return;
      if (!isConnected || !wallet) {
        alert("Please connect your Xumm wallet first.");
        return;
      }

      const issuer = XRPL_KNOWN_ISSUERS?.[code] || null;
      if (!issuer) {
        alert(`Missing issuer configuration for ${code}.`);
        return;
      }

      const ok = confirm(
        `Install XRPL trustline for ${code}?\n\nThis will open Xumm to sign a TrustSet transaction.`
      );
      if (!ok) return;

      const currency = encodeXrplCurrencyCode(code);
      const txjson = {
        TransactionType: "TrustSet",
        Account: wallet,
        LimitAmount: {
          currency,
          issuer,
          value: "1000000000",
        },
      };

      // Attach wallet_label memo when setup info is provided (name + optional default currency)
      if (walletSetup?.label) {
        const memoData = { label: walletSetup.label };
        if (walletSetup.defaultCurrency) {
          memoData.defaultCurrency = walletSetup.defaultCurrency;
        }
        const memoPayload = buildWalletLabelMemo(memoData);
        if (memoPayload) {
          const memos = buildXrplJsonMemo(memoPayload);
          if (memos) {
            txjson.Memos = memos;
          }
        }
      }

      try {
        const result = await signTransaction(txjson);
        if (result && result.signed) {
          alert(`✅ Trustline ${code} submitted via Xumm.`);
          if (refreshBalance) {
            setTimeout(() => refreshBalance(), 2500);
          }
          // If label was set via TrustSet memo, refresh wallet label
          if (walletSetup?.label && loadWalletLabel) {
            setTimeout(() => loadWalletLabel(), 3000);
          }
        } else {
          alert("Transaction cancelled or expired.");
        }
      } catch (err) {
        console.error("Install trustline error:", err);
        alert("Error while preparing trustline: " + (err?.message || String(err)));
      }
    },
    [isConnected, loadWalletLabel, refreshBalance, signTransaction, wallet]
  );

  // ── RLUSD setup: opens a form to collect name + default currency,
  //    then triggers RLUSD TrustSet with wallet_label memo attached.
  const handleOpenRlusdSetup = useCallback(() => {
    setShowRlusdSetupModal(true);
  }, []);

  const handleRlusdSetupConfirm = useCallback(
    ({ label, defaultCurrency } = {}) => {
      setShowRlusdSetupModal(false);
      handleInstallRequiredTrustline("RLUSD", {
        walletSetup: { label, defaultCurrency },
      });
    },
    [handleInstallRequiredTrustline]
  );

  const {
    augmentedTokens,
    allocatedRlusdByCurrency,
    swapCurrencyOptions,
  } = useWalletTokens({ displayTokens, currencyLines: effectiveCurrencyLines });

  const selectableTokens = useMemo(() => {
    return (augmentedTokens || []).filter((token) => {
      const code = String(token?.currency || "").trim().toUpperCase();
      // XRP et RLUSD ne sont pas sélectionnables dans les modales Send/Receive.
      // USD est une devise sélectionnable comme EUR, CHF, etc.
      return code !== "XRP" && code !== "RLUSD";
    });
  }, [augmentedTokens]);

  // RLUSD n'est plus dans augmentedTokens (décomposé en USD+lignes).
  // On se base sur baseTokens (solde on-chain) pour savoir si la trustline existe.
  const hasRlusdTrustline = hasOnChainRlusd;

  // Les labels des sélecteurs sont calculés plus bas, après displayTokensWithCurrencyLines,
  // pour disposer des valeurs en devise locale (allocation / taux FX).

  const swapCurrencyOptionsForModal = useMemo(() => {
    const candidates = new Set((swapCurrencyOptions || []).map((c) => String(c || "").toUpperCase()).filter(Boolean));
    if (convertBaseCurrency) candidates.add(String(convertBaseCurrency || "").toUpperCase());
    if (convertQuoteCurrency) candidates.add(String(convertQuoteCurrency || "").toUpperCase());

    const weight = (code) => {
      if (code === "USD") return 0;
      return 3;
    };

    return Array.from(candidates).sort((a, b) => {
      const wa = weight(a);
      const wb = weight(b);
      if (wa !== wb) return wa - wb;
      return a.localeCompare(b);
    });
  }, [convertBaseCurrency, convertQuoteCurrency, swapCurrencyOptions]);

  const currencyLineCodes = useMemo(() => {
    const codes = new Set();
	    (currencyLines || []).forEach((line) => {
	      const code = String(line?.currencyCode || "").trim().toUpperCase();
	      if (code) codes.add(code);
	    });
	    // Exclure les actifs XRPL (affichés on-chain), garder les devises "UX".
	    ["XRP", "RLUSD", "USD"].forEach((c) => codes.delete(c));
	    return Array.from(codes);
	  }, [currencyLines]);

  const { usdPerUnit: rlusdPerUnitRates, sourceByCode: rlusdPerUnitSources } =
    useRlusdPerUnitRates(currencyLineCodes);

  const previewRates = useMemo(() => {
    if (!isPreviewMode) return {};
    const next = { ...(rlusdPerUnitRates || {}) };
    Object.entries(demoLines || {}).forEach(([code, line]) => {
      const upper = String(code || "").toUpperCase();
      if (!upper) return;
      const units = Number(line?.units || 0);
      const rlusd = Number(line?.rlusd || 0);
      if (
        Number.isFinite(units) &&
        units > 0 &&
        Number.isFinite(rlusd) &&
        rlusd > 0
      ) {
        next[upper] = rlusd / units;
      }
    });
    next.RLUSD = 1;
    next.USD = 1;
    return next;
  }, [demoLines, isPreviewMode, rlusdPerUnitRates]);

  const resolvePreviewRlusdPerUnit = useCallback(
    (currency) => {
      const code = String(currency || "").trim().toUpperCase();
      if (!code) return Number.NaN;
      const rate = Number(previewRates?.[code]);
      if (Number.isFinite(rate) && rate > 0) return rate;
      if (code === "RLUSD" || code === "USD") return 1;
      return Number.NaN;
    },
    [previewRates]
  );

  const previewUnallocatedRlusd = useMemo(() => {
    if (!isPreviewMode) return null;
    const candidate = Number(effectiveCurrencyLinesSummary?.unallocatedRlusd);
    if (Number.isFinite(candidate)) return candidate;
    const fallback = Number(demoLines?.RLUSD?.rlusd);
    return Number.isFinite(fallback) ? fallback : null;
  }, [demoLines, effectiveCurrencyLinesSummary, isPreviewMode]);

  const previewTotalRlusd = useMemo(() => {
    if (!isPreviewMode) return null;
    const candidate = Number(effectiveCurrencyLinesSummary?.rlusdOnChain);
    if (Number.isFinite(candidate)) return candidate;
    const sum = Object.entries(demoLines || {}).reduce((acc, [, line]) => {
      const value = Number(line?.rlusd || 0);
      return acc + (Number.isFinite(value) ? value : 0);
    }, 0);
    return Number.isFinite(sum) ? sum : null;
  }, [demoLines, effectiveCurrencyLinesSummary, isPreviewMode]);

  const statementTotalBalanceUsd = useMemo(() => {
    if (!isPreviewMode) return null;
    const total = Number(previewTotalRlusd);
    return Number.isFinite(total) ? total : null;
  }, [isPreviewMode, previewTotalRlusd]);

  const globalStatementTokens = useMemo(() => {
    if (!isPreviewMode) return null;
    const base = (augmentedTokens || []).filter((token) => {
      const code = String(token?.currency || "").toUpperCase();
      return code && code !== "XRP" && code !== "USD" && code !== "RLUSD";
    });
    if (previewUnallocatedRlusd != null && Number.isFinite(Number(previewUnallocatedRlusd))) {
      base.push({
        key: "DERIVED:USD",
        currency: "USD",
        value: Number(previewUnallocatedRlusd),
        issuer: undefined,
        isTrustlineOnly: true,
        isDerivedUsd: true,
      });
    }
    return base;
  }, [augmentedTokens, isPreviewMode, previewUnallocatedRlusd]);

  const statementBalance = useMemo(() => {
    if (!isPreviewMode || !selectedStatementToken) return null;
    const currency = String(selectedStatementToken.currency || "").toUpperCase();
    if (!currency) return null;
    const isDerivedUsd = Boolean(selectedStatementToken?.isDerivedUsd || selectedStatementToken?.isDerived);
    if (currency === "USD" && isDerivedUsd) {
      return previewUnallocatedRlusd != null &&
        Number.isFinite(Number(previewUnallocatedRlusd))
        ? Number(previewUnallocatedRlusd)
        : 0;
    }
    if (currency === "RLUSD") {
      const value = Number(demoLines?.RLUSD?.units ?? demoLines?.RLUSD?.rlusd ?? 0);
      return Number.isFinite(value) ? value : 0;
    }
    const demoLine = demoLines?.[currency];
    if (demoLine) {
      const units = Number(demoLine?.units ?? 0);
      if (Number.isFinite(units)) return units;
      const rlusd = Number(demoLine?.rlusd ?? 0);
      const rate = resolvePreviewRlusdPerUnit(currency);
      if (Number.isFinite(rlusd) && Number.isFinite(rate) && rate > 0) {
        return rlusd / rate;
      }
    }
    const fallback = Number(selectedStatementToken?.value ?? 0);
    return Number.isFinite(fallback) ? fallback : null;
  }, [
    demoLines,
    isPreviewMode,
    previewUnallocatedRlusd,
    resolvePreviewRlusdPerUnit,
    selectedStatementToken,
  ]);

  const previewGlobalMovements = useMemo(() => {
    if (!isPreviewMode) return null;
    const events = Array.isArray(previewEvents) ? previewEvents : [];
    return events
      .map((evt) => {
        if (!evt) return null;
        const createdAt = evt?.createdAt ? new Date(evt.createdAt) : new Date(evt?.ts || Date.now());
        const createdAtIso = createdAt.toISOString();
        const resolveAmountRlusd = () => {
          const direct = Number(
            evt?.amountRlusd ?? evt?.usdNet ?? evt?.usdGross ?? evt?.usdValue ?? evt?.amount
          );
          if (Number.isFinite(direct)) return direct;
          const currency = String(evt?.currency || "").toUpperCase();
          const amount = Number(evt?.amount || 0);
          const rate = resolvePreviewRlusdPerUnit(currency);
          if (Number.isFinite(rate) && rate > 0) return amount * rate;
          return Number.isFinite(amount) ? amount : 0;
        };
        if (evt.kind === "convert") {
          return {
            movementId: evt.id,
            createdAt: createdAtIso,
            fromCurrencyCode: evt.fromCurrency,
            toCurrencyCode: evt.toCurrency,
            amountRlusd: resolveAmountRlusd(),
          };
        }
        if (evt.kind === "send") {
          return {
            movementId: evt.id,
            createdAt: createdAtIso,
            fromCurrencyCode: evt.currency,
            toCurrencyCode: evt.currency,
            amountRlusd: resolveAmountRlusd(),
          };
        }
        if (evt.kind === "buy" || evt.kind === "sell" || evt.kind === "spread_fee") {
          return {
            movementId: evt.id,
            createdAt: createdAtIso,
            fromCurrencyCode: evt.currency || "RLUSD",
            toCurrencyCode: evt.currency || "RLUSD",
            amountRlusd: resolveAmountRlusd(),
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [isPreviewMode, previewEvents, resolvePreviewRlusdPerUnit]);

  const previewCurrencyTransactions = useMemo(() => {
    if (!isPreviewMode || !selectedStatementToken) return [];
    const currency = String(selectedStatementToken.currency || "").toUpperCase();
    if (!currency) return [];
    const events = Array.isArray(previewEvents) ? previewEvents : [];
    const startingBalanceRaw =
      statementBalance != null && Number.isFinite(Number(statementBalance))
        ? Number(statementBalance)
        : Number(selectedStatementToken?.value ?? 0);
    let running = Number.isFinite(startingBalanceRaw) ? startingBalanceRaw : 0;
    const txs = [];
    const ratesSnapshot = previewRates || {};

    events.forEach((evt) => {
      const createdAt = new Date(evt?.ts || Date.now()).toISOString();
      const runningSnapshot = running;
      let amount = 0;
      let delta = 0;
      let type = "credit";
      let category = "other";
      let description = t("demo_statement_movement", "Mouvement");
      let counterparty = "";
      let postEventTx = null;

      if (evt.kind === "send" && String(evt.currency || "").toUpperCase() === currency) {
        amount = Number(evt.amount || 0);
        delta = -amount;
        type = "debit";
        const destAddress = String(evt.toAddress || evt.toLabel || "").trim();
        const destLabel = destAddress
          ? formatPreviewAddressShort(destAddress)
          : t("demo_counterparty_unknown", "Destination");
        counterparty = destAddress || destLabel;
        description = t("demo_statement_send_to", {
          defaultValue: "Envoyé à {{to}}",
          to: destLabel,
        });
      } else if (evt.kind === "convert") {
        category = "exchange";
        const fromCurrency = String(evt.fromCurrency || "").toUpperCase();
        const toCurrency = String(evt.toCurrency || "").toUpperCase();
        const fromLabel = getDisplayCurrencyCode(fromCurrency);
        const toLabel = getDisplayCurrencyCode(toCurrency);
        if (fromCurrency === currency) {
          type = "debit";
          amount = Number(evt.fromAmount || 0);
          delta = -amount;
          description = t("demo_statement_exchange", {
            defaultValue: "Conversion {{fromCurrency}} → {{toCurrency}}",
            fromCurrency: fromLabel,
            toCurrency: toLabel,
          });
        } else if (toCurrency === currency) {
          type = "credit";
          amount = Number(evt.toAmount || 0);
          delta = amount;
          description = t("demo_statement_exchange", {
            defaultValue: "Conversion {{fromCurrency}} → {{toCurrency}}",
            fromCurrency: fromLabel,
            toCurrency: toLabel,
          });
          const feeUsd = Number(evt.feeUsd || 0);
          const quoteRate = Number(ratesSnapshot?.[currency] || 0);
          const feeQuote =
            Number.isFinite(feeUsd) && feeUsd > 0 && quoteRate > 0
              ? feeUsd / quoteRate
              : 0;
          if (Number.isFinite(feeQuote) && feeQuote > 0) {
            const feeUsdLabel = feeUsd.toLocaleString(locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            postEventTx = {
              id: `${evt.id}_fee`,
              date: createdAt,
              createdAt,
              category: "fee",
              type: "debit",
              description: t("demo_statement_fee_spread_pair", {
                defaultValue:
                  "Frais conversion {{fromCurrency}} → {{toCurrency}} ({{fee}} USD)",
                fromCurrency: fromLabel,
                toCurrency: toLabel,
                fee: feeUsdLabel,
              }),
              counterparty: "",
              amount: feeQuote,
              runningBalance: runningSnapshot,
              displayRunningBalance: runningSnapshot,
            };
          }
        } else {
          return;
        }
      } else if (evt.kind === "buy" && String(evt.currency || "").toUpperCase() === currency) {
        category = "buy";
        type = "credit";
        amount = Number(evt.amount || 0);
        delta = amount;
        description = t("demo_statement_buy_moonpay", "Achat via MoonPay (démo)");
      } else if (evt.kind === "sell" && String(evt.currency || "").toUpperCase() === currency) {
        category = "sell";
        type = "debit";
        amount = Number(evt.amount || 0);
        delta = -amount;
        description = t("demo_statement_sell_moonpay", "Vente via MoonPay (démo)");
      } else if (
        evt.kind === "spread_fee" &&
        String(evt.currency || "").toUpperCase() === currency
      ) {
        category = "fee";
        type = "debit";
        amount = Number(evt.amount || 0);
        delta = -amount;
        description = t("demo_statement_fee_spread", "Frais de conversion (1 %)");
      } else if (
        evt.kind === "trustline_add" &&
        String(evt.currency || "").toUpperCase() === currency
      ) {
        category = "operation";
        type = "credit";
        amount = 0;
        delta = 0;
        description = t("demo_statement_trustline_add", {
          defaultValue: "Activation de ligne {{currency}}",
          currency,
        });
      } else if (
        evt.kind === "trustline_remove" &&
        String(evt.currency || "").toUpperCase() === currency
      ) {
        category = "operation";
        type = "debit";
        amount = 0;
        delta = 0;
        description = t("demo_statement_trustline_remove", {
          defaultValue: "Désactivation de ligne {{currency}}",
          currency,
        });
      } else {
        return;
      }

      if (!Number.isFinite(amount) || (amount <= 0 && category !== "operation")) return;

      txs.push({
        id: evt.id,
        date: createdAt,
        createdAt,
        category,
        type,
        description,
        counterparty,
        amount,
        runningBalance: running,
      });
      running -= delta;

      if (postEventTx) {
        txs.push(postEventTx);
      }
    });

    if (
      txs.length > 0 &&
      statementBalance != null &&
      Number.isFinite(Number(statementBalance))
    ) {
      const first = txs[0];
      if (first && Number(first.displayRunningBalance) !== Number(statementBalance)) {
        txs[0] = { ...first, displayRunningBalance: Number(statementBalance) };
      }
    }

    return txs;
  }, [
    formatPreviewAddressShort,
    isPreviewMode,
    locale,
    previewEvents,
    previewRates,
    selectedStatementToken,
    statementBalance,
    t,
  ]);

  const highlightTransactionId = useMemo(() => {
    if (!isPreviewMode || !selectedStatementToken) return null;
    const key = String(selectedStatementToken?.currency || "").trim().toUpperCase();
    return statementHighlightByCurrency?.[key]?.eventId || null;
  }, [isPreviewMode, selectedStatementToken, statementHighlightByCurrency]);

  // Toast "crédité en EUR" (etc.) quand un paiement entrant est détecté.
  const lastIncomingToastRef = useRef(null);
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPreviewMode) return;
    if (!backendWalletAddress) return;

    const storageKey = `xcannes_wallet_last_incoming:${backendWalletAddress}`;
    try {
      lastIncomingToastRef.current = window.sessionStorage.getItem(storageKey);
    } catch {
      // ignore
    }

    let cancelled = false;

    const fetchLatestIncoming = async () => {
      if (cancelled) return;
      try {
        const params = new URLSearchParams();
        params.set("address", backendWalletAddress);
        params.set("limit", "5");
        params.set("source", "onchain");
        const res = await fetch(apiUrl(`/wallet/statement?${params.toString()}`));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;

        const movements = Array.isArray(data?.movements) ? data.movements : [];
        const incoming = movements.find(
          (m) => String(m?.kind || "").toUpperCase() === "PAYMENT_IN"
        );
        if (!incoming) return;

        const movementId = String(incoming?.movementId || incoming?._id || "");
        if (!movementId) return;
        if (movementId && lastIncomingToastRef.current === movementId) return;

        const createdAt = incoming?.createdAt ? new Date(incoming.createdAt) : null;
        const createdAtMs =
          createdAt && Number.isFinite(createdAt.getTime()) ? createdAt.getTime() : null;
        if (createdAtMs != null && createdAtMs < mountedAtRef.current) {
          lastIncomingToastRef.current = movementId;
          try {
            window.sessionStorage.setItem(storageKey, movementId);
          } catch {
            // ignore
          }
          return;
        }

        const toCurrency = String(incoming?.toCurrencyCode || "").toUpperCase();
        const amountRlusd = Number(incoming?.amountRlusd ?? 0);
        const fxRate = Number(incoming?.fxRate ?? 0);

        let message = "";
        if (toCurrency && Number.isFinite(amountRlusd) && amountRlusd > 0) {
          if (Number.isFinite(fxRate) && fxRate > 0) {
            const amountFx = amountRlusd / fxRate;
            message = `+${amountFx.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })} ${toCurrency} crédités`;
          } else {
            message = `+${amountRlusd.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })} RLUSD crédités`;
          }
        }

        if (message) {
          flashWalletHeaderToast(message, 5000);
        }

        lastIncomingToastRef.current = movementId;
        try {
          window.sessionStorage.setItem(storageKey, movementId);
        } catch {
          // ignore
        }
      } catch (error) {
        // Best effort only.
        if (process.env.NEXT_PUBLIC_DEBUG_LOGS === "true") {
          console.warn("[wallet] incoming toast poll failed:", error?.message || error);
        }
      }
    };

    fetchLatestIncoming();
    const interval = window.setInterval(fetchLatestIncoming, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [backendWalletAddress, flashWalletHeaderToast, isPreviewMode]);

  const displayTokensWithCurrencyLines = useMemo(() => {
    return (augmentedTokens || []).map((token) => {
      const currency = String(token?.currency || "").toUpperCase();
      if (!currency) return token;

      // Pour les devises "UX" (off-chain), on affiche:
      // - valeur principale en devise (units), basée sur l'allocation RLUSD et un taux indicatif
      // - valeur secondaire "≈ RLUSD" = allocation RLUSD
      if (!token?.isTrustlineOnly) return token;
      if (currency === "XRP") return token;

      const allocated =
        allocatedRlusdByCurrency?.get?.(currency) ??
        (Number.isFinite(Number(token?.allocatedRlusd)) ? Number(token.allocatedRlusd) : 0);

      // USD et RLUSD ont un taux fixe de 1 (stablecoin pegged 1:1).
      const rawRate = (currency === "USD" || currency === "RLUSD") ? 1 : Number(rlusdPerUnitRates?.[currency]);
      const units =
        Number.isFinite(rawRate) && rawRate > 0 && Number.isFinite(allocated) && allocated > 0
          ? allocated / rawRate
          : 0;

      return {
        ...token,
        value: units,
        demoRlusdValue: Number.isFinite(allocated) ? allocated : 0,
      };
    });
  }, [allocatedRlusdByCurrency, augmentedTokens, rlusdPerUnitRates]);

  // --- Labels des sélecteurs (calculés après displayTokensWithCurrencyLines
  //     pour disposer des valeurs en devise locale). ---
  const selectLabelByAssetKey = useMemo(() => {
    const labels = {};
    (displayTokensWithCurrencyLines || augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const display = getDisplayCurrencyCode(code);
      if (token?.key) labels[token.key] = display;
      labels[code] = display;
    });
    return labels;
  }, [displayTokensWithCurrencyLines, augmentedTokens]);

  const selectLabelRightByAssetKey = useMemo(() => {
    const labels = {};
    (displayTokensWithCurrencyLines || augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const display = getDisplayCurrencyCode(code);
      const amount = Number(token?.value || 0);
      const amountLabel = Number.isFinite(amount)
        ? formatAmountWithSymbol(locale, amount, display, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
          })
        : formatAmountWithSymbol(locale, 0, display, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
          });
      if (token?.key) labels[token.key] = amountLabel;
      labels[code] = amountLabel;
    });
    return labels;
  }, [displayTokensWithCurrencyLines, augmentedTokens, locale]);

  const selectLabelMobileByAssetKey = useMemo(() => {
    const labels = {};
    (displayTokensWithCurrencyLines || augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const display = getDisplayCurrencyCode(code);
      const amount = Number(token?.value || 0);
      const amountLabel = Number.isFinite(amount)
        ? formatAmountWithSymbol(locale, amount, display, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
          })
        : formatAmountWithSymbol(locale, 0, display, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
          });
      const label = `${display} (${amountLabel})`;
      if (token?.key) labels[token.key] = label;
      labels[code] = label;
    });
    return labels;
  }, [displayTokensWithCurrencyLines, augmentedTokens, locale]);

  const selectIconByAssetKey = useMemo(() => {
    const icons = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const display = getDisplayCurrencyCode(code);
      const icon = CRYPTO_ICONS?.[display]
        ? { src: CRYPTO_ICONS[display], alt: display }
        : token?.isTrustlineOnly || display !== code
          ? getCurrencyFlag(display)
          : getTokenIcon(code);
      if (token?.key) icons[token.key] = icon;
      icons[code] = icon;
    });
    return icons;
  }, [augmentedTokens]);

  const tokenListTokens = useMemo(() => {
    const tokens = isPreviewMode ? displayTokens : displayTokensWithCurrencyLines;
    // XRP n'apparaît pas dans les lignes de devises du wallet.
    // Il est visible uniquement dans le relevé global (dernière ligne).
    // RLUSD est masqué (décomposé en USD + lignes).
    return (tokens || []).filter((token) => {
      const code = String(token?.currency || "").toUpperCase();
      return code !== "XRP" && code !== "RLUSD";
    });
  }, [displayTokens, displayTokensWithCurrencyLines, isPreviewMode]);
  const { handleDemoConvert } = useSwapConversion({
    isPreviewMode,
    effectiveIsConnected,
    backendWalletAddress,
    walletAddress: wallet,
    signTransaction,
    refreshBalance,
    hasOnChainRlusd,
    swapCurrencyOptions,
    convertBaseCurrency,
    convertQuoteCurrency,
    convertAmount,
    setConvertBaseCurrency,
    setConvertQuoteCurrency,
    setConvertAmount,
    setConvertPreview,
    setConvertProcessing,
    demoLines,
    setDemoLines,
    demoRlusdTotal: DEMO_RLUSD_TOTAL,
    currencyLinesSummary: effectiveCurrencyLinesSummary,
    allocatedRlusdByCurrency,
    refreshCurrencyLines: effectiveRefreshCurrencyLines,
    getAllMarkets: xcannesApi.getAllMarkets,
    getTicker: xcannesApi.getTicker,
    getFxEod: xcannesApi.getFxEod,
    onDemoConvert: handlePreviewConvert,
  });

  const selectedSendToken =
    selectableTokens.find((t) => t.key === sendAssetKey) ||
    selectableTokens[0] ||
    null;

  const sendFxInfo = useMemo(() => {
    const code = String(selectedSendToken?.currency || "").toUpperCase();
    if (!code) return null;
    // USD (pool non alloué = RLUSD) et XRP ne sont pas des conversions FX.
    if (code === "XRP" || code === "RLUSD" || code === "USD") return null;
    if (!selectedSendToken?.isTrustlineOnly) return null;

    const amountFx = Number.parseFloat(sendAmount || "0");
    if (!Number.isFinite(amountFx) || amountFx <= 0) return null;

    const demoLine = isPreviewMode ? demoLines?.[code] : null;
    const demoUnits = Number(demoLine?.units || 0);
    const demoRlusd = Number(demoLine?.rlusd || 0);
    const demoPerUnit =
      Number.isFinite(demoUnits) && demoUnits > 0 && Number.isFinite(demoRlusd) && demoRlusd > 0
        ? demoRlusd / demoUnits
        : null;

    const rawRate = Number(rlusdPerUnitRates?.[code]);
    const rlusdPerUnit = isPreviewMode
      ? demoPerUnit || 1
      : Number.isFinite(rawRate) && rawRate > 0
        ? rawRate
        : Number.NaN;
    if (!Number.isFinite(rlusdPerUnit) || rlusdPerUnit <= 0) return null;

    const paymentRlusd = amountFx * rlusdPerUnit;

    // Same-currency payreq → no spread fee (1 tx direct).
    const isSameCurrencyPayreq =
      sendPaymentRequest &&
      String(sendPaymentRequest?.targetCurrencyCode || "").toUpperCase() === code;
    const spread = isSameCurrencyPayreq
      ? { isFx: false, spreadFraction: 0, halfSpreadFraction: 0, spreadFeeRlusd: 0, tier: null }
      : computeSpreadQuote({ base: code, quote: "RLUSD", amountRlusd: paymentRlusd });
    const spreadFeeRlusd = Number(spread?.spreadFeeRlusd || 0);

    return {
      currency: code,
      fxSource: isPreviewMode ? "DEMO" : rlusdPerUnitSources?.[code] || null,
      rlusdPerUnit,
      amountFx,
      paymentRlusd,
      spreadFeeRlusd,
      spreadTier: spread?.tier || null,
      spreadPercentTotal:
        spread?.isFx && Number.isFinite(Number(spread?.spreadFraction))
          ? Number(spread.spreadFraction) * 100
          : 0,
    };
  }, [
    demoLines,
    isPreviewMode,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    selectedSendToken,
    sendAmount,
    sendPaymentRequest,
  ]);

  useEffect(() => {
    if (!sendPaymentRequest || !selectedSendToken) return;
    const requestedRlusd = Number(sendPaymentRequest?.amountRlusd);
    if (!Number.isFinite(requestedRlusd) || requestedRlusd <= 0) return;

    const targetCurrency = String(sendPaymentRequest?.targetCurrencyCode || "")
      .trim()
      .toUpperCase();
    const selectedCurrency = String(selectedSendToken?.currency || "").toUpperCase();
    if (!selectedCurrency) return;

    const demoLine = isPreviewMode ? demoLines?.[selectedCurrency] : null;
    const demoUnits = Number(demoLine?.units || 0);
    const demoRlusd = Number(demoLine?.rlusd || 0);
    const demoPerUnit =
      Number.isFinite(demoUnits) && demoUnits > 0 && Number.isFinite(demoRlusd) && demoRlusd > 0
        ? demoRlusd / demoUnits
        : null;

    const rawRate = Number(rlusdPerUnitRates?.[selectedCurrency]);
    const fallbackRate =
      isPreviewMode && Number.isFinite(demoPerUnit) && demoPerUnit > 0
        ? demoPerUnit
        : Number.isFinite(rawRate) && rawRate > 0
          ? rawRate
          : Number.NaN;

    let nextAmount = null;

    if (selectedCurrency === "RLUSD") {
      nextAmount = requestedRlusd;
    } else if (targetCurrency && selectedCurrency === targetCurrency) {
      const displayAmount = Number(sendPaymentRequest?.displayAmount);
      if (Number.isFinite(displayAmount) && displayAmount > 0) {
        nextAmount = displayAmount;
      } else {
        const requestedFxRate = Number(sendPaymentRequest?.fxRate);
        const rate =
          Number.isFinite(requestedFxRate) && requestedFxRate > 0 ? requestedFxRate : fallbackRate;
        if (Number.isFinite(rate) && rate > 0) {
          nextAmount = requestedRlusd / rate;
        }
      }
    } else {
      if (Number.isFinite(fallbackRate) && fallbackRate > 0) {
        nextAmount = requestedRlusd / fallbackRate;
      }
    }

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return;

    const formatted = nextAmount.toFixed(6).replace(/\.?0+$/, "");
    setSendAmount(formatted);
  }, [
    demoLines,
    isPreviewMode,
    rlusdPerUnitRates,
    sendPaymentRequest,
    selectedSendToken,
    setSendAmount,
  ]);

  const {
    qrScannerOpen,
    setQrScannerOpen,
    handleAddressScan,
    handlePaymentRequestScan,
  } = usePaymentRequestScanner({
    augmentedTokens,
    setSendDestination,
    setSendAmount,
    setSendAssetKey,
    setSendTab,
    setSendPaymentRequest,
  });

  const closeInlineQr = useCallback(() => {
    if (!isDesktopPanel) return;
    setQrScannerOpen(false);
    closeQrModal?.();
  }, [closeQrModal, isDesktopPanel, setQrScannerOpen]);

  const handleAction = useCallback(
    (nextAction) => {
      closeInlineQr();
      setWalletInfoOpen(false);
      if (effectiveIsConnected && isWalletLabelRequired) {
        flashWalletHeaderToast("Nom du wallet requis.", 2000);
      }
      if (nextAction === "swap") {
        setSwapDefaultView("convert");
        setSwapLockedView(null);
      }
      if (nextAction === "cash") {
        setCashBuyPrefill(null);
      }
      setActiveAction(nextAction);
    },
    [
      closeInlineQr,
      effectiveIsConnected,
      flashWalletHeaderToast,
      isWalletLabelRequired,
      setSwapDefaultView,
      setSwapLockedView,
      setCashBuyPrefill,
    ]
  );

  const handleOpenCurrencyLines = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    setSwapDefaultView("lines");
    setSwapLockedView("lines");
    setActiveAction("swap");
  }, [closeInlineQr, setSwapDefaultView, setSwapLockedView]);

  const handleOpenActivationModal = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    setActivationBundleEnabled(false);
    setShowActivationModal(true);
  }, [closeInlineQr]);

  const handleActivationRequestFromThirdParty = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    setShowActivationModal(false);
    setShowActivationRequestModal(true);
  }, [closeInlineQr]);

  const handleActivationBuyViaMoonpay = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    setShowActivationModal(false);
    setCashBuyPrefill({
      currency: "XRP",
      amount: activationXrpAmountLabel,
      amountType: "crypto",
    });
    setCashModalTab("buy");
    setActiveAction("cash");
  }, [activationXrpAmountLabel, closeInlineQr, setCashModalTab]);

  const handleOpenCurrencyStatement = useCallback(
    (token) => {
      closeInlineQr();
      setWalletInfoOpen(false);
      if (isDesktopPanel) {
        setActiveAction(null);
        setShowAdjustmentModal(false);
        setShowActivationModal(false);
        setShowActivationRequestModal(false);
        setShowGlobalStatement(false);
      }
      setSelectedStatementToken(token);
      setShowCurrencyStatement(true);
    },
    [
      closeInlineQr,
      isDesktopPanel,
    ]
  );

  const handleOpenInfo = useCallback(() => {
    closeInlineQr();
    if (isDesktopPanel) {
      setActiveAction(null);
      setShowAdjustmentModal(false);
      setShowActivationModal(false);
      setShowActivationRequestModal(false);
      setShowCurrencyStatement(false);
      setSelectedStatementToken(null);
      setShowGlobalStatement(false);
    }
    setWalletInfoOpen(true);
  }, [closeInlineQr, isDesktopPanel]);

  // Ouvrir le convert (swap modal) depuis d'autres briques UI.
  // Event detail:
  // - action: "buy" | "sell"
  // - base, quote: codes devises (ex: EUR/USD)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = async (event) => {
      closeInlineQr();
      setWalletInfoOpen(false);
      const detail = event?.detail || {};
      const action = String(detail.action || "").toLowerCase();
      const base = String(detail.base || "").trim().toUpperCase();
      const quote = String(detail.quote || "").trim().toUpperCase();
      if (!base || !quote) return;

      const desiredBase = action === "buy" ? quote : base;
      const desiredQuote = action === "buy" ? base : quote;

      setConvertBaseCurrency(desiredBase);
      setConvertQuoteCurrency(desiredQuote === desiredBase ? "RLUSD" : desiredQuote);
      setConvertAmount("");
      setSwapDefaultView("convert");
      setSwapLockedView(null);
      setActiveAction("swap");

    };

    window.addEventListener("xcannes:wallet:open-convert", handler);
    return () => window.removeEventListener("xcannes:wallet:open-convert", handler);
  }, [
    closeInlineQr,
    handleActivateCurrencyLine,
    setActiveAction,
    setConvertAmount,
    setConvertBaseCurrency,
    setConvertQuoteCurrency,
    setSwapDefaultView,
    setSwapLockedView,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      closeInlineQr();
      setWalletInfoOpen(false);
      setShowAdjustmentModal(true);
    };
    window.addEventListener("xcannes:wallet:open-adjustment", handler);
    return () =>
      window.removeEventListener("xcannes:wallet:open-adjustment", handler);
  }, [closeInlineQr]);

  useEffect(() => {
    if (isPreviewMode) return;
    if (!backendWalletAddress) return;
    if (!hasAdjustmentDeficit) {
      adjustmentAutoOpenedRef.current = false;
      return;
    }
    if (adjustmentAutoOpenedRef.current) return;
    if (activeAction || showAdjustmentModal) return;
    closeInlineQr();
    setWalletInfoOpen(false);
    setShowAdjustmentModal(true);
    adjustmentAutoOpenedRef.current = true;
  }, [
    activeAction,
    backendWalletAddress,
    closeInlineQr,
    hasAdjustmentDeficit,
    isPreviewMode,
    showAdjustmentModal,
  ]);

  const renderTokenRow = useCallback(
    (token) => (
      <WalletDashboardTokenRow
        key={token.key}
        token={token}
        tokenRowClass={layout.tokenRowClass}
        onInstallTrustline={handleInstallRequiredTrustline}
        isWalletActivated={isWalletActivated}
        hasRlusdTrustline={hasRlusdTrustline}
        onActivateWallet={handleOpenActivationModal}
        onOpenRlusdSetup={handleOpenRlusdSetup}
        onClick={() => handleOpenCurrencyStatement(token)}
      />
    ),
    [
      handleInstallRequiredTrustline,
      handleOpenActivationModal,
      handleOpenCurrencyStatement,
      handleOpenRlusdSetup,
      hasRlusdTrustline,
      isWalletActivated,
      layout.tokenRowClass,
    ]
  );

  const handleSendSubmit = async ({ saveDestination = "", saveLabel = "" } = {}) => {
    const normalizedSaveDestination = String(saveDestination || "").trim();
    const handleAddressSave = (dest) => {
      const normalizedDest = String(dest || "").trim();
      if (!normalizedDest) return;
      const isAlreadySaved = savedAddresses.some((a) => a.address === normalizedDest);
      if (!isAlreadySaved && normalizedSaveDestination === normalizedDest) {
        saveAddress(normalizedDest, saveLabel);
        return;
      }
      if (!isAlreadySaved) {
        setAddressToSave(normalizedDest);
        setShowSaveAddressPrompt(true);
      }
    };
    if (!isConnected || !wallet) {
      if (!isPreviewMode) {
        alert("Please connect your Xumm wallet first.");
        return { ok: false };
      }
    }
    if (!selectedSendToken) {
      alert("No asset selected.");
      return { ok: false };
    }
    if (
      (selectedSendToken?.currency === "RLUSD" || selectedSendToken?.currency === "USD") &&
      !hasOnChainRlusd &&
      !isPreviewMode
    ) {
      alert("RLUSD trustline is not installed yet. Please install it first.");
      return { ok: false };
    }

    const amountNum = parseFloat(sendAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount.");
      return { ok: false };
    }

    const dest = (sendDestination || "").trim();
    if (!dest || !dest.startsWith("r") || dest.length < 25) {
      alert("Please enter a valid XRPL destination address.");
      return { ok: false };
    }

    const currency = String(selectedSendToken.currency || "").toUpperCase();
    // USD (pool non alloué) est envoyé comme RLUSD natif, pas comme une conversion FX.
    const isFxSend =
      selectedSendToken?.isTrustlineOnly &&
      currency !== "XRP" &&
      currency !== "RLUSD" &&
      currency !== "USD";

    setSendProcessing(true);
    setActiveAction(null);

    try {
      if (isFxSend) {
        if (!backendWalletAddress && !isPreviewMode) {
          alert("Please connect your Xumm wallet first.");
          return { ok: false };
        }
        if (!hasOnChainRlusd && !isPreviewMode) {
          alert("RLUSD trustline is not installed yet. Please install it first.");
          return { ok: false };
        }

        const demoLine = isPreviewMode ? demoLines?.[currency] : null;
        const demoUnits = Number(demoLine?.units || 0);
        const demoRlusd = Number(demoLine?.rlusd || 0);
        const demoPerUnit =
          Number.isFinite(demoUnits) && demoUnits > 0 && Number.isFinite(demoRlusd) && demoRlusd > 0
            ? demoRlusd / demoUnits
            : null;

        const requestTargetCurrency = String(
          sendPaymentRequest?.targetCurrencyCode || ""
        )
          .trim()
          .toUpperCase();

        const requestedFxRate =
          sendPaymentRequest?.fxRate != null
            ? Number(sendPaymentRequest.fxRate)
            : Number.NaN;

        const rawRate = Number(rlusdPerUnitRates?.[currency]);
        const effectiveRate =
          requestTargetCurrency && requestTargetCurrency === currency &&
          Number.isFinite(requestedFxRate) && requestedFxRate > 0
            ? requestedFxRate
            : rawRate;

        const rlusdPerUnit = isPreviewMode
          ? demoPerUnit || 1
          : Number.isFinite(effectiveRate) && effectiveRate > 0
            ? effectiveRate
            : Number.NaN;
        if (!Number.isFinite(rlusdPerUnit) || rlusdPerUnit <= 0) {
          alert(`Impossible de récupérer le taux pour ${currency}.`);
          return { ok: false };
        }

        const requestedRlusd =
          sendPaymentRequest?.amountRlusd != null &&
          Number.isFinite(Number(sendPaymentRequest.amountRlusd))
            ? Number(sendPaymentRequest.amountRlusd)
            : null;

        let paymentRlusd = amountNum * rlusdPerUnit;
        let effectiveAmountNum = amountNum;
        let isAlternateCurrency = false;

        if (requestTargetCurrency && requestTargetCurrency !== currency) {
          if (!Number.isFinite(requestedRlusd) || requestedRlusd <= 0) {
            alert("Montant RLUSD demandé manquant pour cette demande.");
            return { ok: false };
          }
          isAlternateCurrency = true;
          paymentRlusd = requestedRlusd;
          effectiveAmountNum = paymentRlusd / rlusdPerUnit;
          if (!Number.isFinite(effectiveAmountNum) || effectiveAmountNum <= 0) {
            alert("Impossible de calculer le montant dans la devise sélectionnée.");
            return { ok: false };
          }
        }

        if (Number.isFinite(requestedRlusd)) {
          const diff = Math.abs(paymentRlusd - requestedRlusd);
          if (diff > Math.max(0.01, requestedRlusd * 0.005)) {
            alert(
              `Montant RLUSD différent de la demande.\n\n` +
                `Demandé: ≈ ${requestedRlusd.toLocaleString("en-US", { maximumFractionDigits: 6 })} RLUSD\n` +
                `Calculé: ≈ ${paymentRlusd.toLocaleString("en-US", { maximumFractionDigits: 6 })} RLUSD\n\n` +
                `Scannez à nouveau la demande ou vérifiez le taux.`
            );
            return { ok: false };
          }
        }

        // Same-currency payreq → no spread, 1 single transaction.
        const isSameCurrencyPayreq =
          sendPaymentRequest && requestTargetCurrency && requestTargetCurrency === currency;
        const spread = isSameCurrencyPayreq
          ? { isFx: false, spreadFraction: 0, halfSpreadFraction: 0, spreadFeeRlusd: 0, tier: null }
          : computeSpreadQuote({ base: currency, quote: "RLUSD", amountRlusd: paymentRlusd });
        const spreadFeeRlusd = Number(spread?.spreadFeeRlusd || 0);
        const totalToSpendRlusd = paymentRlusd + spreadFeeRlusd;
        const epsilon = 1e-9;

        const availableAllocatedRlusd =
          allocatedRlusdByCurrency?.get?.(currency) ??
          (Number.isFinite(Number(selectedSendToken?.allocatedRlusd))
            ? Number(selectedSendToken.allocatedRlusd)
            : Number.NaN);
        if (Number.isFinite(availableAllocatedRlusd) && availableAllocatedRlusd + epsilon < totalToSpendRlusd) {
          const maxPaymentRlusd =
            spread?.halfSpreadFraction != null && Number(spread.halfSpreadFraction) > 0
              ? availableAllocatedRlusd / (1 + Number(spread.halfSpreadFraction))
              : availableAllocatedRlusd;
          const maxFx = maxPaymentRlusd > 0 ? maxPaymentRlusd / rlusdPerUnit : 0;
          alert(
            `Allocation insuffisante en ${currency} pour couvrir paiement + frais de conversion.\n\n` +
              `Disponible: ≈ ${availableAllocatedRlusd.toLocaleString("en-US", {
                maximumFractionDigits: 6,
              })} RLUSD\n` +
              `Maximum: ≈ ${maxFx.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${currency}`
          );
          return { ok: false };
        }

        const requestedDisplayAmount =
          sendPaymentRequest?.displayAmount ??
          (Number.isFinite(requestedRlusd) &&
          Number.isFinite(Number(sendPaymentRequest?.fxRate)) &&
          Number(sendPaymentRequest?.fxRate) > 0
            ? requestedRlusd / Number(sendPaymentRequest.fxRate)
            : null);
        const requestedDisplayCurrency =
          sendPaymentRequest?.displayCurrency || requestTargetCurrency || null;

        const ok = confirm(
          `Paiement en RLUSD (affiché en ${currency}).\n\n` +
            (isAlternateCurrency && requestedDisplayCurrency
              ? `Demande: ${requestedDisplayAmount != null
                  ? Number(requestedDisplayAmount).toLocaleString("en-US", { maximumFractionDigits: 6 })
                  : "-"} ${requestedDisplayCurrency}\n`
              : "") +
            `Montant: ${effectiveAmountNum.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${currency}\n` +
            `≈ ${paymentRlusd.toLocaleString("en-US", { maximumFractionDigits: 6 })} RLUSD au destinataire\n` +
            (spreadFeeRlusd > 0
              ? `Frais de conversion (1 %) : ≈ ${spreadFeeRlusd.toLocaleString("en-US", {
                  maximumFractionDigits: 6,
                })} RLUSD\n`
              : "") +
            `Total RLUSD à débiter: ≈ ${totalToSpendRlusd.toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })} RLUSD\n\n` +
            (spreadFeeRlusd > 0
              ? `2 signatures Xumm seront demandées (frais de conversion → XCANNES, puis paiement → destinataire).`
              : `1 signature Xumm sera demandée (paiement → destinataire).`)
        );
        if (!ok) return { ok: false };

        if (isPreviewMode) {
          // Demo: simulate 2 signatures + update demoLines balance.
          const currentLine = demoLines?.[currency] || null;
          const availableUnits = Number(currentLine?.units || 0);
          if (availableUnits + 1e-9 < effectiveAmountNum) {
            alert(
              `Solde démo insuffisant en ${currency}. Disponible: ${availableUnits.toLocaleString("en-US", {
                maximumFractionDigits: 6,
              })} ${currency}.`
            );
            return { ok: false };
          }

          const availableRlusd = Number(currentLine?.rlusd || 0);
          const totalDebitRlusd = totalToSpendRlusd;
          if (availableRlusd + 1e-9 < totalDebitRlusd) {
            alert(
              `Allocation démo insuffisante (≈ RLUSD) pour couvrir paiement + frais de conversion. Disponible: ${availableRlusd.toLocaleString(
                "en-US",
                { maximumFractionDigits: 6 }
              )} RLUSD.`
            );
            return { ok: false };
          }

          setDemoLines((prev) => {
            const next = { ...prev };
            const line = next[currency] || { currency, rlusd: 0, units: 0, rate: 0 };
            const newUnits = Math.max(0, Number(line.units || 0) - effectiveAmountNum);
            const newRlusd = Math.max(0, Number(line.rlusd || 0) - totalDebitRlusd);
            next[currency] = {
              ...line,
              units: newUnits,
              rlusd: newRlusd,
              rate: newRlusd > 0 ? newUnits / newRlusd : 0,
            };
            return next;
          });

          const previewTs = Date.now();
          const sendEventId = buildPreviewEventId("send");
          pushPreviewEvent({
            id: sendEventId,
            ts: previewTs,
            kind: "send",
            from: PREVIEW_WALLET_ID,
            currency,
            amount: effectiveAmountNum,
            amountRlusd: paymentRlusd,
            toAddress: dest,
            memo: sendPaymentRequest?.memo || null,
          });
          recordStatementHighlight(currency, sendEventId);

          if (Number.isFinite(spreadFeeRlusd) && spreadFeeRlusd > 0) {
            const spreadFeeUnits =
              Number.isFinite(rlusdPerUnit) && rlusdPerUnit > 0
                ? spreadFeeRlusd / rlusdPerUnit
                : spreadFeeRlusd;
            const feeEventId = buildPreviewEventId("fee");
            pushPreviewEvent({
              id: feeEventId,
              ts: previewTs,
              kind: "spread_fee",
              wallet: PREVIEW_WALLET_ID,
              currency,
              amount: spreadFeeUnits,
              amountRlusd: spreadFeeRlusd,
            });
          }

          alert(
            spreadFeeRlusd > 0
              ? `✅ (Demo) Signature 1/2 simulée: frais de conversion → XCANNES (${XCANNES_SPREAD_WALLET_ADDRESS})\n` +
                `✅ (Demo) Signature 2/2 simulée: paiement → destinataire (${dest})`
              : `✅ (Demo) Signature simulée: paiement → destinataire (${dest})`
          );
          handleAddressSave(dest);
          setSendAmount("");
          setSendDestination("");
          return { ok: true };
        }

        // 1) Paiement des frais de conversion → wallet entreprise XCANNES
        const fxSource =
          (sendPaymentRequest?.fxSource ? String(sendPaymentRequest.fxSource) : null) ||
          rlusdPerUnitSources?.[currency] ||
          null;
        if (spreadFeeRlusd > 0) {
          const spreadAllocatedBefore = allocatedRlusdByCurrency?.get(currency);
          const spreadAllocatedAfter = Number.isFinite(spreadAllocatedBefore)
            ? Math.max(0, Number(spreadAllocatedBefore) - spreadFeeRlusd)
            : null;
          const spreadTx = buildRlusdPaymentTxjson({
            account: wallet,
            destination: XCANNES_SPREAD_WALLET_ADDRESS,
            amountRlusd: spreadFeeRlusd,
          });
          if (!spreadTx) {
            throw new Error("Invalid RLUSD conversion fee payment");
          }
          const spreadMemoPayload = buildPayreqMemo({
            origin: "spread",
            targetCurrencyCode: currency,
            displayAmount: spreadFeeRlusd,
            displayCurrencyCode: "RLUSD",
            amountRlusd: spreadFeeRlusd,
            allocatedRlusdAfter: spreadAllocatedAfter,
            fxRate: rlusdPerUnit,
            fxSource,
            note: "spread",
          });
          if (!spreadMemoPayload) {
            throw new Error("Invalid conversion fee memo payload");
          }
          const spreadMemos = buildXrplJsonMemo(spreadMemoPayload);
          if (!spreadMemos) {
            throw new Error("Invalid conversion fee memo");
          }
          spreadTx.Memos = spreadMemos;

          const spreadResult = await signTransaction(spreadTx, {
            action: "wallet:convert",
          });
          if (!spreadResult?.signed) {
            alert("Conversion fee payment cancelled or expired.");
            return { ok: false };
          }
        }

        // 2) Paiement principal → destinataire
        const payTx = buildRlusdPaymentTxjson({
          account: wallet,
          destination: dest,
          amountRlusd: paymentRlusd,
        });
        if (!payTx) {
          throw new Error("Invalid RLUSD payment");
        }

        const targetCurrencyForMemo = sendPaymentRequest?.targetCurrencyCode
          ? requestTargetCurrency || currency
          : currency;
        const displayAmountForMemo = sendPaymentRequest
          ? sendPaymentRequest?.displayAmount ?? effectiveAmountNum
          : effectiveAmountNum;
        const displayCurrencyForMemo = sendPaymentRequest
          ? sendPaymentRequest?.displayCurrency ?? targetCurrencyForMemo ?? currency
          : currency;
        const targetAllocatedBefore = allocatedRlusdByCurrency?.get(targetCurrencyForMemo);
        const paymentDebitRlusd =
          targetCurrencyForMemo === currency ? totalToSpendRlusd : paymentRlusd;
        const paymentAllocatedAfter = Number.isFinite(targetAllocatedBefore)
          ? Math.max(0, Number(targetAllocatedBefore) - paymentDebitRlusd)
          : null;

        const memoPayload = buildPayreqMemo({
          origin: sendPaymentRequest ? "payreq" : "manual",
          targetCurrencyCode: targetCurrencyForMemo,
          displayAmount: displayAmountForMemo,
          displayCurrencyCode: displayCurrencyForMemo,
          amountRlusd: paymentRlusd,
          allocatedRlusdAfter: paymentAllocatedAfter,
          fxRate: rlusdPerUnit,
          fxSource,
          note: sendPaymentRequest?.memo || null,
        });
        if (!memoPayload) {
          throw new Error("Invalid payment memo payload");
        }
        const memos = buildXrplJsonMemo(memoPayload);
        if (!memos) {
          throw new Error("Invalid payment memo");
        }
        payTx.Memos = memos;
        appendMemos(
          payTx,
          buildMoonpaySellMemos(dest, {
            currency,
            amount: effectiveAmountNum,
            amountRlusd: paymentRlusd,
          })
        );

        const payResult = await signTransaction(payTx, {
          action: "wallet:convert",
        });
        if (payResult?.signed) {
          alert("✅ Payment submitted via Xumm.");

          handleAddressSave(dest);

          setSendAmount("");
          setSendDestination("");
          setSendPaymentRequest(null);
          if (refreshBalance) setTimeout(() => refreshBalance(), 3000);
          if (refreshCurrencyLines) setTimeout(() => refreshCurrencyLines(), 3000);
          return { ok: true };
        } else {
          alert(
            spreadFeeRlusd > 0
              ? "Payment cancelled or expired. (Conversion fee was already paid.)"
              : "Transaction cancelled or expired."
          );
          return { ok: false };
        }
      }

      if (isPreviewMode) {
        // Demo: simulate a single on-chain payment by adjusting demoLines for RLUSD, otherwise keep UX simple.
        if (currency === "RLUSD") {
          const available = Number(demoLines?.RLUSD?.units || 0);
          if (available + 1e-9 < amountNum) {
            alert(
              `Solde démo insuffisant en RLUSD. Disponible: ${available.toLocaleString("en-US", {
                maximumFractionDigits: 6,
              })} RLUSD.`
            );
            return { ok: false };
          }

          setDemoLines((prev) => {
            const next = { ...prev };
            const line = next.RLUSD || {
              currency: "RLUSD",
              rlusd: DEMO_RLUSD_TOTAL,
              units: DEMO_RLUSD_TOTAL,
              rate: 1,
            };
            const newUnits = Math.max(0, Number(line.units || 0) - amountNum);
            const newRlusd = Math.max(0, Number(line.rlusd || 0) - amountNum);
            next.RLUSD = { ...line, units: newUnits, rlusd: newRlusd, rate: 1 };
            return next;
          });
        }

        const previewTs = Date.now();
        const sendEventId = buildPreviewEventId("send");
        pushPreviewEvent({
          id: sendEventId,
          ts: previewTs,
          kind: "send",
          from: PREVIEW_WALLET_ID,
          currency,
          amount: amountNum,
          amountRlusd: currency === "RLUSD" ? amountNum : null,
          toAddress: dest,
          memo: sendPaymentRequest?.memo || null,
        });
        recordStatementHighlight(currency, sendEventId);

        alert(`✅ (Demo) Paiement simulé: ${amountNum} ${currency} → ${dest}`);
        handleAddressSave(dest);
        setSendAmount("");
        setSendDestination("");
        return { ok: true };
      }

      let Amount;
      if (selectedSendToken.currency === "XRP" && selectedSendToken.issuer === "Native") {
        Amount = Math.round(amountNum * 1_000_000).toString();
      } else if (currency === "USD" || currency === "RLUSD") {
        // USD (pool non alloué) et RLUSD sont envoyés comme RLUSD on-chain.
        const rlusdTxjson = buildRlusdPaymentTxjson({
          account: wallet,
          destination: dest,
          amountRlusd: amountNum,
        });
        if (!rlusdTxjson) {
          alert("Failed to build RLUSD payment.");
          return { ok: false };
        }
        Amount = rlusdTxjson.Amount;
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

      // If this payment comes from a XCANNES request, attach a memo so the receiver
      // can auto-credit the right currency line (only meaningful for RLUSD payments).
      if ((currency === "RLUSD" || currency === "USD") && sendPaymentRequest?.targetCurrencyCode) {
        const target = String(sendPaymentRequest.targetCurrencyCode || "")
          .trim()
          .toUpperCase();
        const targetAllocatedBefore = allocatedRlusdByCurrency?.get(target);
        const paymentAllocatedAfter = Number.isFinite(targetAllocatedBefore)
          ? Math.max(0, Number(targetAllocatedBefore) - amountNum)
          : null;
        const memoPayload = buildPayreqMemo({
          origin: "payreq",
          targetCurrencyCode: target || null,
          displayAmount: sendPaymentRequest?.displayAmount ?? null,
          displayCurrencyCode: (sendPaymentRequest?.displayCurrency ?? target) || null,
          amountRlusd: amountNum,
          allocatedRlusdAfter: paymentAllocatedAfter,
          fxRate: sendPaymentRequest?.fxRate ?? null,
          fxSource: sendPaymentRequest?.fxSource ?? null,
          note: sendPaymentRequest?.memo || null,
        });
        if (!memoPayload) {
          throw new Error("Invalid payreq memo payload");
        }
        const memos = buildXrplJsonMemo(memoPayload);
        if (!memos) {
          throw new Error("Invalid payreq memo");
        }
        txjson.Memos = memos;
      }

      appendMemos(
        txjson,
        buildMoonpaySellMemos(dest, {
          currency,
          amount: amountNum,
          amountRlusd: currency === "RLUSD" ? amountNum : null,
        })
      );

      const result = await signTransaction(txjson);
      if (result && result.signed) {
        alert("✅ Payment submitted via Xumm.");
        handleAddressSave(dest);

        setSendAmount("");
        setSendDestination("");
        setSendPaymentRequest(null);
        if (refreshBalance) {
          setTimeout(() => refreshBalance(), 3000);
        }
        return { ok: true };
      } else {
        alert("Transaction cancelled or expired.");
        return { ok: false };
      }
    } catch (err) {
      console.error("Send payment error:", err);
      alert("Error while preparing payment: " + (err?.message || String(err)));
      return { ok: false };
    } finally {
      setSendProcessing(false);
    }
  };

  const handleCopyAddress = useCallback(async () => {
    if (!effectiveWallet || typeof navigator === "undefined") return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(effectiveWallet);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = effectiveWallet;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      flashWalletHeaderToast("Adresse copiée", 1600);
    } catch (e) {
      console.error("Copy error:", e);
      flashWalletHeaderToast("Copie impossible", 2000);
    }
  }, [effectiveWallet, flashWalletHeaderToast]);

  const handleActivationSendFromWallet = useCallback(async () => {
    setShowActivationModal(false);
    if (!effectiveWallet || !signTransaction) {
      alert("Please connect your Xumm wallet first.");
      return;
    }

    const amountDrops = String(Math.round(Number(activationXrpAmount) * 1_000_000));
    const txjson = {
      TransactionType: "Payment",
      Destination: effectiveWallet,
      Amount: amountDrops,
    };

    const result = await signTransaction(txjson, { action: "wallet:activate_xrp" });
    if (result?.signed && refreshBalance) {
      setTimeout(() => refreshBalance(), 3000);
    }
  }, [activationXrpAmount, effectiveWallet, refreshBalance, signTransaction]);

  const handleRefreshWallet = useCallback(async () => {
    if (isConnecting || isRefreshing) return;
    if (isPreviewMode) return;
    const startedAt = Date.now();
    setIsRefreshing(true);
    try {
      const tasks = [];
      if (typeof refreshBalance === "function") {
        tasks.push(Promise.resolve(refreshBalance()));
      }
      if (typeof window !== "undefined" && backendWalletAddress) {
        window.dispatchEvent(
          new CustomEvent("xcannes:wallet:refresh", {
            detail: { address: backendWalletAddress },
          })
        );
      }
      if (tasks.length > 0) await Promise.allSettled(tasks);
    } finally {
      const minDurationMs = 700;
      const elapsed = Date.now() - startedAt;
      const remaining = minDurationMs - elapsed;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (remaining > 0) {
        refreshTimerRef.current = setTimeout(() => {
          setIsRefreshing(false);
          refreshTimerRef.current = null;
        }, remaining);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [
    backendWalletAddress,
    isConnecting,
    isPreviewMode,
    isRefreshing,
    refreshBalance,
  ]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  const { usdRates, totalLabel } = useUsdTotalLabel({
    augmentedTokens,
    isPreviewMode,
    stableUsd,
    xrpAmount,
    demoTotalUsd: DEMO_RLUSD_TOTAL,
    isStablecoin,
    cryptoIcons: CRYPTO_ICONS,
    getAllMarkets: xcannesApi.getAllMarkets,
    getTicker: xcannesApi.getTicker,
    getFxEod: xcannesApi.getFxEod,
    rlusdOnChain: effectiveCurrencyLinesSummary?.rlusdOnChain ?? null,
  });

  const previewTotalLabel = useMemo(() => {
    if (!isPreviewMode) return null;
    const total = Number(previewTotalRlusd);
    const safe = Number.isFinite(total) ? total : 0;
    return `${safe.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} USD`;
  }, [isPreviewMode, previewTotalRlusd]);

  const previewStatementProps = useMemo(() => {
    if (!isPreviewMode) return {};
    return {
      previewGlobalMovements,
      previewCurrencyTransactions,
      highlightTransactionId,
      statementBalance,
      statementTotalBalanceUsd,
      globalStatementTokens,
    };
  }, [
    globalStatementTokens,
    highlightTransactionId,
    isPreviewMode,
    previewCurrencyTransactions,
    previewGlobalMovements,
    statementBalance,
    statementTotalBalanceUsd,
  ]);

  const xrplConnectionIndicator = useXrplConnectionIndicator({
    isPreviewMode,
    isConnecting,
    isConnected: effectiveIsConnected,
  });

  useEffect(() => {
    if (!isDesktopPanel) {
      desktopDefaultActionSetRef.current = false;
      return;
    }
    if (desktopDefaultActionSetRef.current) return;
    if (
      activeAction ||
      showAdjustmentModal ||
      showActivationModal ||
      showActivationRequestModal ||
      walletInfoOpen ||
      showCurrencyStatement
    ) {
      return;
    }
    setSwapDefaultView("convert");
    setSwapLockedView(null);
    setActiveAction("swap");
    desktopDefaultActionSetRef.current = true;
  }, [
    activeAction,
    isDesktopPanel,
    showActivationModal,
    showActivationRequestModal,
    showAdjustmentModal,
    showCurrencyStatement,
    walletInfoOpen,
  ]);

  const handleOpenGlobalStatement = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    if (isDesktopPanel) {
      setActiveAction(null);
      setShowAdjustmentModal(false);
      setShowActivationModal(false);
      setShowActivationRequestModal(false);
      setShowCurrencyStatement(false);
      setSelectedStatementToken(null);
      setShowGlobalStatement(false);
      return;
    }
    setShowGlobalStatement(true);
  }, [
    closeInlineQr,
    isDesktopPanel,
  ]);

  const isXummInlineOpen = Boolean(qrModalData && (qrModalData.visible ?? true));
  const showInlineXumm = isDesktopPanel && isXummInlineOpen;
  const showInlineQrScanner = isDesktopPanel && !showInlineXumm && qrScannerOpen;
  const hasPayreq = Boolean(sendPaymentRequest);
  const showInlineSend =
    isDesktopPanel &&
    !showInlineXumm &&
    !showInlineQrScanner &&
    activeAction === "send" &&
    !hasPayreq;
  const showInlinePayreq =
    isDesktopPanel &&
    !showInlineXumm &&
    !showInlineQrScanner &&
    activeAction === "send" &&
    hasPayreq;
  const showInlineReceive =
    isDesktopPanel && !showInlineXumm && !showInlineQrScanner && activeAction === "receive";
  const showInlineSwap =
    isDesktopPanel && !showInlineXumm && !showInlineQrScanner && activeAction === "swap";
  const showInlineCash =
    isDesktopPanel && !showInlineXumm && !showInlineQrScanner && activeAction === "cash";
  const showInlineAdjust =
    isDesktopPanel && !showInlineXumm && !showInlineQrScanner && showAdjustmentModal;
  const showInlineActivation =
    isDesktopPanel && !showInlineXumm && !showInlineQrScanner && showActivationModal;
  const showInlineActivationRequest =
    isDesktopPanel && !showInlineXumm && !showInlineQrScanner && showActivationRequestModal;
  const showInlineInfo =
    isDesktopPanel && !showInlineXumm && !showInlineQrScanner && walletInfoOpen;
  const allowBackgroundScrollForStatements =
    !isDesktopPanel && (showGlobalStatement || showCurrencyStatement);
  const allowBackgroundScrollForActions =
    !isDesktopPanel &&
    ((activeAction === "cash") ||
      (activeAction === "swap" && swapLockedView === "lines") ||
      (activeAction === "send" && sendTab === "payreq"));
  const lockForActiveAction = Boolean(activeAction && !allowBackgroundScrollForActions);
  const lockForStatements =
    Boolean((showGlobalStatement || showCurrencyStatement) && !allowBackgroundScrollForStatements);
  const shouldLockBodyScroll =
    !isDesktopPanel &&
    !allowBackgroundScrollOnMobile &&
    Boolean(
      lockForActiveAction ||
      showAdjustmentModal ||
      showActivationModal ||
      showActivationRequestModal ||
      walletInfoOpen ||
      qrScannerOpen ||
      showSaveAddressPrompt ||
      lockForStatements
    );
  const hasInlineModal =
    showInlineXumm ||
    showInlineQrScanner ||
    showInlineSend ||
    showInlinePayreq ||
    showInlineReceive ||
    showInlineSwap ||
    showInlineCash ||
    showInlineAdjust ||
    showInlineActivation ||
    showInlineActivationRequest ||
    showInlineInfo;
  const showInlineCurrencyStatement =
    isDesktopPanel &&
    !hasInlineModal &&
    showCurrencyStatement &&
    selectedStatementToken;
  const showInlineGlobalStatement =
    isDesktopPanel && !hasInlineModal && !showInlineCurrencyStatement;

  useEffect(() => {
    if (!shouldLockBodyScroll) return;
    return lockBodyScroll();
  }, [shouldLockBodyScroll]);

  return (
    <>
	      <div
	        className={`bg-[#0b0f10] h-full min-h-0 ${layout.containerClass} ${
	          showDesktopStatementPanel
	            ? "flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,600px)] lg:gap-6"
	            : "flex flex-col"
	        }`}
	      >
        <div className="flex flex-col min-h-0">
          {/* Header */}
		        <WalletDashboardHeader
		          layout={layout}
		          effectiveIsConnected={effectiveIsConnected}
		          effectiveWallet={effectiveWallet}
		          onDisconnect={disconnect}
		          totalLabel={previewTotalLabel || totalLabel}
		          xrplConnectionIndicator={xrplConnectionIndicator}
		          walletLabel={walletLabel}
		          walletHeaderToast={walletHeaderToast}
		          onOpenWalletLabelEditor={handleOpenWalletLabelEditor}
	          onCopyAddress={handleCopyAddress}
	          onRefreshWallet={handleRefreshWallet}
	          isConnecting={isConnecting}
	          isRefreshing={isRefreshing}
	          isEditingWalletLabel={isEditingWalletLabel}
	          isWalletLabelRequired={isWalletLabelRequired}
	          isWalletLabelLocked={isWalletLabelLocked}
	          walletLabelDraft={walletLabelDraft}
	          onWalletLabelDraftChange={setWalletLabelDraft}
	          onSaveWalletLabel={handleSaveWalletLabel}
	          onCancelWalletLabel={handleCancelWalletLabel}
	          showMobileHomeLink={showMobileHomeLink}
	        />

          {/* Action row: Send / Receive / Exchange / Buy */}
          <WalletDashboardActionRow
            layout={layout}
            onAction={handleAction}
          />

          {/* Token list */}
	          <div className="flex-1 flex flex-col min-h-0">
			          <WalletDashboardTokenList
			            layout={layout}
			            tokens={tokenListTokens}
			            renderTokenRow={renderTokenRow}
			            headerTitle={
			              <button
			                type="button"
		                onClick={handleOpenGlobalStatement}
		                className="text-sm md:text-xs text-white/70 hover:text-white transition-colors"
		              >
		                {t(
		                  "ui_consult_global_statement_3b89f4a7a2",
		                  "Consulter votre Relevé global"
		                )}
		              </button>
		            }
		            className="touch-pan-y"
		            style={{ WebkitOverflowScrolling: "touch" }}
		            disableInternalScroll={allowPageScrollOnMobile && !isDesktopPanel}
		          />
	          </div>

          <WalletDashboardFooter
            layout={layout}
            xrplConnectionIndicator={xrplConnectionIndicator}
            isFullPageView={isFullPageView}
            onOpenInfo={handleOpenInfo}
          />
          {!isDesktopPanel ? (
            <>
              <WalletInfoModal
                isOpen={walletInfoOpen}
                onClose={() => setWalletInfoOpen(false)}
                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
              />
              <WalletActivationModal
                open={showActivationModal}
                onClose={() => setShowActivationModal(false)}
                onSendFromWallet={handleActivationSendFromWallet}
                onRequestFromThirdParty={handleActivationRequestFromThirdParty}
                onBuyViaMoonpay={handleActivationBuyViaMoonpay}
                activationBundleEnabled={activationBundleEnabled}
                onToggleActivationBundle={setActivationBundleEnabled}
                activationAmountXrp={activationXrpAmount}
                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
              />
              <WalletActivationRequestModal
                open={showActivationRequestModal}
                onClose={() => setShowActivationRequestModal(false)}
                walletAddress={effectiveWallet}
                walletLabel={walletLabel}
                activationAmountXrp={activationXrpAmount}
                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
              />
              <WalletRlusdSetupModal
                open={showRlusdSetupModal}
                onClose={() => setShowRlusdSetupModal(false)}
                onConfirm={handleRlusdSetupConfirm}
              />
            </>
          ) : null}
        </div>

        {isDesktopPanel ? (
          <aside className="hidden lg:flex lg:flex-col min-h-0 relative">
            {showInlineXumm ? (
              <XummQRModal
                isOpen
                inline
                onClose={closeQrModal}
                uuid={qrModalData?.uuid}
                qrUrl={qrModalData?.qrUrl}
                deepLink={qrModalData?.deepLink}
                type={qrModalData?.type || "connect"}
                status={qrModalData?.status}
                enablePolling={false}
              />
            ) : null}

            {showInlineQrScanner ? (
              <div className="flex-1 min-h-0">
                <QRScanner
                  isOpen
                  embedded
                  onScan={handleAddressScan}
                  onClose={() => setQrScannerOpen(false)}
                  hideTitle
                  hideWhenUnavailable
                  className="h-full"
                />
              </div>
            ) : null}
            {showInlineSend ? (
	              <WalletDashboardSendModal
                open
                inline
                onClose={() => setActiveAction(null)}
                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
                qrSizingVariant={qrSizingVariant}
                renderWalletMeta={renderWalletMeta}
	                augmentedTokens={selectableTokens}
                selectedSendToken={selectedSendToken}
                sendFxInfo={sendFxInfo}
                setSendAssetKey={setSendAssetKey}
                sendAmount={sendAmount}
                setSendAmount={setSendAmount}
                sendPaymentRequest={sendPaymentRequest}
                selectLabelByAssetKey={selectLabelByAssetKey}
                selectLabelRightByAssetKey={selectLabelRightByAssetKey}
                selectIconByAssetKey={selectIconByAssetKey}
                selectLabelMobileByAssetKey={selectLabelMobileByAssetKey}
                savedAddresses={savedAddresses}
                sendDestination={sendDestination}
                setSendDestination={setSendDestination}
                setQrScannerOpen={setQrScannerOpen}
                handlePaymentRequestScan={handlePaymentRequestScan}
                handleSendSubmit={handleSendSubmit}
                sendProcessing={sendProcessing}
                enableSaveAddress={true}
                {...payreqDecorProps}
              />
            ) : null}
            {showInlinePayreq ? (
              <WalletDashboardPayreqModal
                open
                inline
                onClose={() => {
                  setSendPaymentRequest(null);
                  setActiveAction(null);
                }}
                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
                renderWalletMeta={renderWalletMeta}
                augmentedTokens={selectableTokens}
                selectedSendToken={selectedSendToken}
                sendFxInfo={sendFxInfo}
                setSendAssetKey={setSendAssetKey}
                setSendAmount={setSendAmount}
                sendPaymentRequest={sendPaymentRequest}
                sendDestination={sendDestination}
                sendAmount={sendAmount}
                sendProcessing={sendProcessing}
                handleSendSubmit={handleSendSubmit}
                savedAddresses={savedAddresses}
                selectLabelByAssetKey={selectLabelByAssetKey}
                selectLabelRightByAssetKey={selectLabelRightByAssetKey}
                selectIconByAssetKey={selectIconByAssetKey}
                selectLabelMobileByAssetKey={selectLabelMobileByAssetKey}
                enableSaveAddress={true}
              />
            ) : null}

            {showInlineReceive ? (
	          <WalletDashboardReceiveModal
                open
                inline
                onClose={() => setActiveAction(null)}
                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
                dashboardVariant={variant}
                receiveTab={receiveTab}
                setReceiveTab={setReceiveTab}
                renderWalletMeta={renderWalletMeta}
                effectiveWallet={effectiveWallet}
                handleCopyAddress={handleCopyAddress}
                requestAmount={requestAmount}
                setRequestAmount={setRequestAmount}
                requestCurrency={requestCurrency}
                setRequestCurrency={setRequestCurrency}
                selectLabelByCurrency={selectLabelByAssetKey}
                selectLabelRightByCurrency={selectLabelRightByAssetKey}
                selectIconByCurrency={selectIconByAssetKey}
                selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
	            augmentedTokens={selectableTokens}
                requestMemo={requestMemo}
                setRequestMemo={setRequestMemo}
                rlusdPerUnitRates={rlusdPerUnitRates}
                rlusdPerUnitSources={rlusdPerUnitSources}
                walletLabel={walletLabel}
              />
            ) : null}

            {showInlineSwap ? (
              <WalletDashboardSwapModal
                open
                inline
                onClose={() => setActiveAction(null)}
                renderWalletMeta={renderWalletMeta}
                isPreviewMode={isPreviewMode}
                defaultView={swapDefaultView}
                lockedView={swapLockedView}
                dashboardVariant={variant}
                effectiveIsConnected={effectiveIsConnected}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
                walletAddress={effectiveWallet}
                onConnectWallet={connect}
                hasOnChainRlusd={hasOnChainRlusd}
                onInstallTrustline={handleInstallRequiredTrustline}
                onActivateCurrencyLine={handleActivateCurrencyLine}
                refreshCurrencyLines={effectiveRefreshCurrencyLines}
                currencyLinesLoading={effectiveCurrencyLinesLoading}
                currencyLinesError={effectiveCurrencyLinesError}
                currencyLinesSummary={effectiveCurrencyLinesSummary}
                currencyLines={effectiveCurrencyLines}
                swapCurrencyOptions={swapCurrencyOptionsForModal}
                convertBaseCurrency={convertBaseCurrency}
                setConvertBaseCurrency={setConvertBaseCurrency}
                convertQuoteCurrency={convertQuoteCurrency}
                setConvertQuoteCurrency={setConvertQuoteCurrency}
                convertAmount={convertAmount}
                setConvertAmount={setConvertAmount}
                convertPreview={convertPreview}
                selectLabelByCurrency={selectLabelByAssetKey}
                selectLabelRightByCurrency={selectLabelRightByAssetKey}
                selectIconByCurrency={selectIconByAssetKey}
                selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
                currencyLineCode={currencyLineCode}
                setCurrencyLineCode={setCurrencyLineCode}
                currencyLineAllocatedRlusd={currencyLineAllocatedRlusd}
                setCurrencyLineAllocatedRlusd={setCurrencyLineAllocatedRlusd}
                handleUpsertCurrencyLine={handleUpsertCurrencyLine}
                handleDemoConvert={handleDemoConvert}
                convertProcessing={convertProcessing}
                rlusdPerUnitRates={rlusdPerUnitRates}
              />
            ) : null}

	            {showInlineCash ? (
			      <WalletDashboardCashModal
	                open
	                inline
	                onClose={() => {
	                  setActiveAction(null);
	                  setCashBuyPrefill(null);
	                }}
	                isPreviewMode={isPreviewMode}
	                isWalletActivated={isWalletActivated}
	                hasRlusdTrustline={hasRlusdTrustline}
	                cashModalTab={cashModalTab}
	                setCashModalTab={setCashModalTab}
	                renderWalletMeta={renderWalletMeta}
	                walletLabel={walletLabel}
	                hideWalletAddress={walletHasCustomLabel}
			        availableTokens={selectableTokens}
	                rlusdPerUnitRates={rlusdPerUnitRates}
	                selectLabelByCurrency={selectLabelByAssetKey}
	                selectLabelRightByCurrency={selectLabelRightByAssetKey}
	                selectIconByCurrency={selectIconByAssetKey}
                selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
                walletAddress={effectiveWallet || ""}
                buyPrefill={cashBuyPrefill}
              />
            ) : null}

            {showInlineAdjust ? (
              <WalletDashboardAdjustModal
                open
                inline
                onClose={() => setShowAdjustmentModal(false)}
                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
                renderWalletMeta={renderWalletMeta}
                walletAddress={effectiveWallet}
                signTransaction={signTransaction}
                deficitRlusd={adjustmentDeficitRlusd}
                currencyLines={effectiveCurrencyLines}
                rlusdPerUnitRates={rlusdPerUnitRates}
                refreshBalance={refreshBalance}
                refreshCurrencyLines={effectiveRefreshCurrencyLines}
                adjustmentFeeRlusd={ADJUSTMENT_FEE_RLUSD}
              />
            ) : null}

            {showInlineActivation ? (
              <WalletActivationModal
                open
                inline
                onClose={() => setShowActivationModal(false)}
                onSendFromWallet={handleActivationSendFromWallet}
                onRequestFromThirdParty={handleActivationRequestFromThirdParty}
                onBuyViaMoonpay={handleActivationBuyViaMoonpay}
                activationBundleEnabled={activationBundleEnabled}
                onToggleActivationBundle={setActivationBundleEnabled}
                activationAmountXrp={activationXrpAmount}
                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
              />
            ) : null}

            {showInlineActivationRequest ? (
              <WalletActivationRequestModal
                open
                inline
                onClose={() => setShowActivationRequestModal(false)}
                walletAddress={effectiveWallet}
                walletLabel={walletLabel}
                activationAmountXrp={activationXrpAmount}
                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
              />
            ) : null}

            {showRlusdSetupModal ? (
              <WalletRlusdSetupModal
                open
                onClose={() => setShowRlusdSetupModal(false)}
                onConfirm={handleRlusdSetupConfirm}
              />
            ) : null}

            {showInlineInfo ? (
              <WalletInfoModal
                isOpen
                inline
                onClose={() => setWalletInfoOpen(false)}
                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                hasRlusdTrustline={hasRlusdTrustline}
              />
            ) : null}

	            {showInlineCurrencyStatement ? (
	              <WalletDashboardStatementModals
	                augmentedTokens={displayTokensWithCurrencyLines || augmentedTokens}
	                backendWalletAddress={backendWalletAddress}
	                effectiveWallet={effectiveWallet}
	                walletDisplayLabel={walletHasCustomLabel ? walletLabel : ""}
	                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                isFullPageView={isFullPageView}
                statementVariant={statementVariant}
                usdRates={usdRates}
                {...previewStatementProps}
                showGlobalStatement={showGlobalStatement}
                setShowGlobalStatement={setShowGlobalStatement}
                showCurrencyStatement={showCurrencyStatement}
                setShowCurrencyStatement={setShowCurrencyStatement}
                selectedStatementToken={selectedStatementToken}
                setSelectedStatementToken={setSelectedStatementToken}
                inlineCurrencyStatement
                inlineCurrencyStatementClassName="flex-1 min-h-0"
                inlineStatementVariant="inline-desktop"
              />
            ) : null}

	            {showInlineGlobalStatement ? (
	              <WalletDashboardStatementModals
	                augmentedTokens={displayTokensWithCurrencyLines || augmentedTokens}
	                backendWalletAddress={backendWalletAddress}
	                effectiveWallet={effectiveWallet}
	                walletDisplayLabel={walletHasCustomLabel ? walletLabel : ""}
	                isPreviewMode={isPreviewMode}
                isWalletActivated={isWalletActivated}
                isFullPageView={isFullPageView}
                statementVariant={statementVariant}
                usdRates={usdRates}
                {...previewStatementProps}
                showGlobalStatement={showGlobalStatement}
                setShowGlobalStatement={setShowGlobalStatement}
                showCurrencyStatement={showCurrencyStatement}
                setShowCurrencyStatement={setShowCurrencyStatement}
                selectedStatementToken={selectedStatementToken}
                setSelectedStatementToken={setSelectedStatementToken}
                inlineGlobalStatement
                inlineGlobalStatementClassName="flex-1 min-h-0"
                inlineStatementVariant="inline-desktop"
              />
            ) : null}
          </aside>
        ) : null}
      </div>

      {/* Modales via Portal pour éviter les problèmes de z-index et overflow */}
      {!isDesktopPanel && typeof document !== 'undefined' && createPortal(
        <>
          <WalletDashboardSendModal
            open={activeAction === "send" && !hasPayreq}
            onClose={() => setActiveAction(null)}
            isPreviewMode={isPreviewMode}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            qrSizingVariant={qrSizingVariant}
            renderWalletMeta={renderWalletMeta}
            augmentedTokens={selectableTokens}
            selectedSendToken={selectedSendToken}
            sendFxInfo={sendFxInfo}
            setSendAssetKey={setSendAssetKey}
            sendAmount={sendAmount}
            setSendAmount={setSendAmount}
            sendPaymentRequest={sendPaymentRequest}
            selectLabelByAssetKey={selectLabelByAssetKey}
            selectLabelRightByAssetKey={selectLabelRightByAssetKey}
            selectIconByAssetKey={selectIconByAssetKey}
            selectLabelMobileByAssetKey={selectLabelMobileByAssetKey}
            savedAddresses={savedAddresses}
            sendDestination={sendDestination}
            setSendDestination={setSendDestination}
            setQrScannerOpen={setQrScannerOpen}
            handlePaymentRequestScan={handlePaymentRequestScan}
            handleSendSubmit={handleSendSubmit}
            sendProcessing={sendProcessing}
            enableSaveAddress={true}
            {...payreqDecorProps}
          />
          <WalletDashboardPayreqModal
            open={activeAction === "send" && hasPayreq}
            onClose={() => {
              setSendPaymentRequest(null);
              setActiveAction(null);
            }}
            isPreviewMode={isPreviewMode}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            renderWalletMeta={renderWalletMeta}
            augmentedTokens={selectableTokens}
            selectedSendToken={selectedSendToken}
            sendFxInfo={sendFxInfo}
            setSendAssetKey={setSendAssetKey}
            setSendAmount={setSendAmount}
            sendPaymentRequest={sendPaymentRequest}
            sendDestination={sendDestination}
            sendAmount={sendAmount}
            sendProcessing={sendProcessing}
            handleSendSubmit={handleSendSubmit}
            savedAddresses={savedAddresses}
            selectLabelByAssetKey={selectLabelByAssetKey}
            selectLabelRightByAssetKey={selectLabelRightByAssetKey}
            selectIconByAssetKey={selectIconByAssetKey}
            selectLabelMobileByAssetKey={selectLabelMobileByAssetKey}
            enableSaveAddress={true}
          />

          <WalletDashboardReceiveModal
            open={activeAction === "receive"}
            onClose={() => setActiveAction(null)}
            isPreviewMode={isPreviewMode}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            dashboardVariant={variant}
            receiveTab={receiveTab}
            setReceiveTab={setReceiveTab}
            renderWalletMeta={renderWalletMeta}
            effectiveWallet={effectiveWallet}
            handleCopyAddress={handleCopyAddress}
            requestAmount={requestAmount}
            setRequestAmount={setRequestAmount}
            requestCurrency={requestCurrency}
            setRequestCurrency={setRequestCurrency}
            selectLabelByCurrency={selectLabelByAssetKey}
            selectLabelRightByCurrency={selectLabelRightByAssetKey}
            selectIconByCurrency={selectIconByAssetKey}
            selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
	            augmentedTokens={selectableTokens}
            requestMemo={requestMemo}
            setRequestMemo={setRequestMemo}
            rlusdPerUnitRates={rlusdPerUnitRates}
            rlusdPerUnitSources={rlusdPerUnitSources}
            walletLabel={walletLabel}
          />

            <WalletDashboardSwapModal
              open={activeAction === "swap"}
              onClose={() => setActiveAction(null)}
              renderWalletMeta={renderWalletMeta}
              isPreviewMode={isPreviewMode}
              defaultView={swapDefaultView}
              lockedView={swapLockedView}
              dashboardVariant={variant}
              effectiveIsConnected={effectiveIsConnected}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            walletAddress={effectiveWallet}
            onConnectWallet={connect}
            hasOnChainRlusd={hasOnChainRlusd}
            onInstallTrustline={handleInstallRequiredTrustline}
            onActivateCurrencyLine={handleActivateCurrencyLine}
            refreshCurrencyLines={effectiveRefreshCurrencyLines}
            currencyLinesLoading={effectiveCurrencyLinesLoading}
            currencyLinesError={effectiveCurrencyLinesError}
            currencyLinesSummary={effectiveCurrencyLinesSummary}
            currencyLines={effectiveCurrencyLines}
            swapCurrencyOptions={swapCurrencyOptionsForModal}
            convertBaseCurrency={convertBaseCurrency}
            setConvertBaseCurrency={setConvertBaseCurrency}
            convertQuoteCurrency={convertQuoteCurrency}
            setConvertQuoteCurrency={setConvertQuoteCurrency}
            convertAmount={convertAmount}
            setConvertAmount={setConvertAmount}
            convertPreview={convertPreview}
            selectLabelByCurrency={selectLabelByAssetKey}
            selectLabelRightByCurrency={selectLabelRightByAssetKey}
            selectIconByCurrency={selectIconByAssetKey}
            selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
            currencyLineCode={currencyLineCode}
            setCurrencyLineCode={setCurrencyLineCode}
            currencyLineAllocatedRlusd={currencyLineAllocatedRlusd}
            setCurrencyLineAllocatedRlusd={setCurrencyLineAllocatedRlusd}
            handleUpsertCurrencyLine={handleUpsertCurrencyLine}
            handleDemoConvert={handleDemoConvert}
            convertProcessing={convertProcessing}
            rlusdPerUnitRates={rlusdPerUnitRates}
          />

          <WalletDashboardAdjustModal
            open={showAdjustmentModal}
            onClose={() => setShowAdjustmentModal(false)}
            isPreviewMode={isPreviewMode}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            renderWalletMeta={renderWalletMeta}
            walletAddress={effectiveWallet}
            signTransaction={signTransaction}
            deficitRlusd={adjustmentDeficitRlusd}
            currencyLines={effectiveCurrencyLines}
            rlusdPerUnitRates={rlusdPerUnitRates}
            refreshBalance={refreshBalance}
            refreshCurrencyLines={effectiveRefreshCurrencyLines}
            adjustmentFeeRlusd={ADJUSTMENT_FEE_RLUSD}
          />

		      <WalletDashboardCashModal
		        open={activeAction === "cash"}
		        onClose={() => {
		          setActiveAction(null);
		          setCashBuyPrefill(null);
		        }}
	          isPreviewMode={isPreviewMode}
	          isWalletActivated={isWalletActivated}
	          hasRlusdTrustline={hasRlusdTrustline}
		        cashModalTab={cashModalTab}
		        setCashModalTab={setCashModalTab}
		        renderWalletMeta={renderWalletMeta}
		        walletLabel={walletLabel}
		        hideWalletAddress={walletHasCustomLabel}
		        availableTokens={augmentedTokens}
		        rlusdPerUnitRates={rlusdPerUnitRates}
		        selectLabelByCurrency={selectLabelByAssetKey}
		        selectLabelRightByCurrency={selectLabelRightByAssetKey}
		        selectIconByCurrency={selectIconByAssetKey}
	        selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
	        walletAddress={effectiveWallet || ""}
          buyPrefill={cashBuyPrefill}
	      />

        </>,
        document.body
      )}

      {/* QR Scanner Modal for Address */}
      {!isDesktopPanel ? (
        <QRScanner
          isOpen={qrScannerOpen}
          onScan={handleAddressScan}
          onClose={() => setQrScannerOpen(false)}
          hideTitle
        />
      ) : null}

      <WalletDashboardSaveAddressPrompt
        open={showSaveAddressPrompt}
        addressToSave={addressToSave}
        addressLabel={addressLabel}
        setAddressLabel={setAddressLabel}
        onClose={() => {
          setShowSaveAddressPrompt(false);
          setAddressLabel("");
          setAddressToSave("");
        }}
        onSave={() => {
          saveAddress(addressToSave, addressLabel);
          setShowSaveAddressPrompt(false);
          setAddressLabel("");
          setAddressToSave("");
          alert("✅ Address saved!");
        }}
      />

	      {!isDesktopPanel ? (
	        <WalletDashboardStatementModals
	          augmentedTokens={displayTokensWithCurrencyLines || augmentedTokens}
	          backendWalletAddress={backendWalletAddress}
	          effectiveWallet={effectiveWallet}
	          walletDisplayLabel={walletHasCustomLabel ? walletLabel : ""}
	          isPreviewMode={isPreviewMode}
	          isWalletActivated={isWalletActivated}
	          isFullPageView={isFullPageView}
	          statementVariant={statementVariant}
	          usdRates={usdRates}
	          {...previewStatementProps}
          showGlobalStatement={showGlobalStatement}
          setShowGlobalStatement={setShowGlobalStatement}
          showCurrencyStatement={showCurrencyStatement}
          setShowCurrencyStatement={setShowCurrencyStatement}
          selectedStatementToken={selectedStatementToken}
          setSelectedStatementToken={setSelectedStatementToken}
        />
      ) : null}
    </>
  );
}
