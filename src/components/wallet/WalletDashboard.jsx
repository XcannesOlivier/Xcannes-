"use client";

	import { useCallback, useEffect, useMemo, useRef, useState } from "react";
	import { useWallet } from "@/context/WalletContext";
import xcannesApi from "@/lib/xcannesApi";
import { apiUrl } from "@/lib/runtimeConfig";
	import { CRYPTO_ICONS } from "@/utils/marketConstants";

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
import { useWalletModalProps } from "./hooks/useWalletModalProps";
import { useSendTransaction } from "./hooks/useSendTransaction";
import { useWalletActivation } from "./hooks/useWalletActivation";
import { useWalletToast } from "./hooks/useWalletToast";
import WalletDesktopModals from "./desktop/WalletDesktopModals";
import WalletMobileModals from "./mobile/WalletMobileModals";
import WalletToastOverlay from "./components/WalletToastOverlay";
import { useWalletNavigation } from "./hooks/useWalletNavigation";
import { useTokenDisplayLabels } from "./hooks/useTokenDisplayLabels";
import { usePayreqStorage } from "./hooks/usePayreqStorage";
import WalletPendingPayreqs from "./components/WalletPendingPayreqs";
import { useTranslation } from "next-i18next";
import {
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



export default function WalletDashboard({
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

  const { toasts, confirmState, toast, confirm, dismissToast, resolveConfirm } = useWalletToast();

  const effectiveIsConnected = isConnected;
  const effectiveWallet = wallet;
  const effectiveBalance = balance;

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
  const [activeAction, setActiveAction] = useState(null); // 'send' | 'receive' | 'swap' | 'buy' | 'sell' | null
  const [swapDefaultView, setSwapDefaultView] = useState("convert");
  const [swapLockedView, setSwapLockedView] = useState(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showActivationRequestModal, setShowActivationRequestModal] = useState(false);
  const [showRlusdSetupModal, setShowRlusdSetupModal] = useState(false);
  const [isDesktopPanel, setIsDesktopPanel] = useState(false);
  const desktopDefaultActionSetRef = useRef(false);
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

  // Demandes de paiement en attente (sauvegardées localement)
  const {
    pendingPayreqs,
    savePayreq,
    removePayreq,
    pendingCount,
  } = usePayreqStorage({ walletAddress: effectiveWallet?.address || null });
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
    isPreviewMode: false,
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
    // Seul XRP est affiché comme token on-chain.
    // RLUSD est décomposé en lignes de devises (USD, EUR, GBP…) via currencyLines.
    const tokens = [
      {
        key: "XRP",
        currency: "XRP",
        issuer: "Native",
        value: xrpAmount,
      },
    ];

    return tokens;
  }, [xrpAmount]);

  // Adresse backend (session API)
  const backendWalletAddress = effectiveWallet || null;

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

  const effectiveCurrencyLinesSummary = currencyLinesSummary;
  const effectiveCurrencyLines = useMemo(() => {
    const lines = Array.isArray(currencyLines) ? [...currencyLines] : [];
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
    effectiveCurrencyLinesSummary,
  ]);
  const effectiveCurrencyLinesLoading = currencyLinesLoading;
  const effectiveCurrencyLinesError = currencyLinesError;
  const effectiveRefreshCurrencyLines = refreshCurrencyLines;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!backendWalletAddress || !effectiveRefreshCurrencyLines) return;

    const handleWalletRefresh = (event) => {
      const address = event?.detail?.address;
      if (!address || address !== backendWalletAddress) return;
      effectiveRefreshCurrencyLines();
    };

    window.addEventListener("xcannes:wallet:refresh", handleWalletRefresh);
    return () => window.removeEventListener("xcannes:wallet:refresh", handleWalletRefresh);
  }, [backendWalletAddress, effectiveRefreshCurrencyLines]);

  const adjustmentDeficitRlusd = Number(
    effectiveCurrencyLinesSummary?.excessAllocatedRlusd ?? 0
  );
  const hasAdjustmentDeficit =
    Number.isFinite(adjustmentDeficitRlusd) && adjustmentDeficitRlusd > 1e-9;

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

  // Toast "crédité en EUR" (etc.) quand un paiement entrant est détecté.
  const lastIncomingToastRef = useRef(null);
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
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
  }, [backendWalletAddress, flashWalletHeaderToast]);

  const {
    displayTokensWithCurrencyLines,
    selectLabelByAssetKey,
    selectLabelRightByAssetKey,
    selectLabelMobileByAssetKey,
    selectIconByAssetKey,
    tokenListTokens,
  } = useTokenDisplayLabels({
    augmentedTokens,
    allocatedRlusdByCurrency,
    rlusdPerUnitRates,
    locale,
  });
  useSwapConversion({
    isPreviewMode: false,
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
    currencyLinesSummary: effectiveCurrencyLinesSummary,
    allocatedRlusdByCurrency,
    refreshCurrencyLines: effectiveRefreshCurrencyLines,
    getAllMarkets: xcannesApi.getAllMarkets,
    getTicker: xcannesApi.getTicker,
    getFxEod: xcannesApi.getFxEod,
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

    const rawRate = Number(rlusdPerUnitRates?.[code]);
    const rlusdPerUnit = Number.isFinite(rawRate) && rawRate > 0
      ? rawRate
      : Number.NaN;
    if (!Number.isFinite(rlusdPerUnit) || rlusdPerUnit <= 0) return null;

    const paymentRlusd = amountFx * rlusdPerUnit;

    return {
      currency: code,
      fxSource: rlusdPerUnitSources?.[code] || null,
      rlusdPerUnit,
      amountFx,
      paymentRlusd,
    };
  }, [
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    selectedSendToken,
    sendAmount,
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

    const rawRate = Number(rlusdPerUnitRates?.[selectedCurrency]);
    const fallbackRate = Number.isFinite(rawRate) && rawRate > 0
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

  // Reprendre une demande sauvegardée → charge dans le form + ouvre le payreq modal
  const handleResumePayreq = useCallback(
    (entry) => {
      if (!entry?.payreq) return;
      const pr = entry.payreq;
      if (pr.to) setSendDestination(pr.to);
      const targetCurrency = String(pr.targetCurrencyCode || "").toUpperCase();
      const matchingToken = (augmentedTokens || []).find(
        (t) => String(t.currency || "").toUpperCase() === targetCurrency
      );
      if (matchingToken) {
        setSendAssetKey(matchingToken.key);
        if (pr.displayAmount != null) setSendAmount(String(pr.displayAmount));
      } else {
        // Fallback to RLUSD
        const rlusdToken = (augmentedTokens || []).find(
          (t) => String(t.currency || "").toUpperCase() === "RLUSD"
        );
        if (rlusdToken) setSendAssetKey(rlusdToken.key);
        if (pr.amountRlusd != null) setSendAmount(String(pr.amountRlusd));
      }
      setSendPaymentRequest(pr);
      setSendTab("manual");
      setActiveAction("send");
    },
    [augmentedTokens, setSendDestination, setSendAssetKey, setSendAmount, setSendPaymentRequest, setSendTab, setActiveAction]
  );

  const {
    handleInstallRequiredTrustline,
    handleOpenRlusdSetup,
    handleRlusdSetupConfirm,
    handleOpenActivationModal,
    handleActivationRequestFromThirdParty,
    handleActivationBuyViaMoonpay,
    handleActivationSendFromWallet,
  } = useWalletActivation({
    isConnected: effectiveIsConnected,
    wallet: effectiveWallet,
    signTransaction,
    refreshBalance,
    loadWalletLabel,
    toast,
    confirm,
    closeInlineQr,
    setWalletInfoOpen,
    setShowActivationModal,
    setShowActivationRequestModal,
    setShowRlusdSetupModal,
    setActivationBundleEnabled,
    setCashBuyPrefill,
    setCashModalTab,
    setActiveAction,
    activationXrpAmount,
    activationXrpAmountLabel,
  });

  const {
    handleActivateCurrencyLine,
    handleUpsertCurrencyLine,
    handleAction,
    handleOpenCurrencyLines,
    handleOpenCurrencyStatement,
    handleOpenInfo,
    handleOpenGlobalStatement,
    handleCopyAddress,
    handleRefreshWallet,
  } = useWalletNavigation({
    effectiveWallet,
    effectiveIsConnected,
    backendWalletAddress,
    isDesktopPanel,
    isConnecting,
    isRefreshing,
    setIsRefreshing,
    refreshBalance,
    currencyLines,
    handleUpsertCurrencyLineReal,
    activeAction,
    hasAdjustmentDeficit,
    showAdjustmentModal,
    closeInlineQr,
    setActiveAction,
    setWalletInfoOpen,
    setSwapDefaultView,
    setSwapLockedView,
    setCashBuyPrefill,
    setShowAdjustmentModal,
    setShowActivationModal,
    setShowActivationRequestModal,
    setShowGlobalStatement,
    setShowCurrencyStatement,
    setSelectedStatementToken,
    setConvertBaseCurrency,
    setConvertQuoteCurrency,
    setConvertAmount,
    flashWalletHeaderToast,
    isWalletLabelRequired,
    t,
    toast,
  });

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

  const { handleSendSubmit } = useSendTransaction({
    isConnected: effectiveIsConnected,
    wallet: effectiveWallet,
    signTransaction,
    refreshBalance,
    hasOnChainRlusd,
    backendWalletAddress,
    selectedSendToken,
    sendAmount,
    sendDestination,
    sendPaymentRequest,
    setSendProcessing,
    setSendAmount,
    setSendDestination,
    setSendPaymentRequest,
    savedAddresses,
    saveAddress,
    setActiveAction,
    setAddressToSave,
    setShowSaveAddressPrompt,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    allocatedRlusdByCurrency,
    refreshCurrencyLines,
    toast,
    confirm,
    removePayreq,
    pendingPayreqs,
  });

  const { usdRates, totalLabel } = useUsdTotalLabel({
    augmentedTokens,
    isPreviewMode: false,
    stableUsd,
    xrpAmount,
    demoTotalUsd: 0,
    isStablecoin,
    cryptoIcons: CRYPTO_ICONS,
    getAllMarkets: xcannesApi.getAllMarkets,
    getTicker: xcannesApi.getTicker,
    getFxEod: xcannesApi.getFxEod,
    rlusdOnChain: effectiveCurrencyLinesSummary?.rlusdOnChain ?? null,
  });

  const xrplConnectionIndicator = useXrplConnectionIndicator({
    isPreviewMode: false,
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

  // --- Shared modal props (desktop & mobile) ---
  const modalProps = useWalletModalProps({
    effectiveWallet,
    effectiveIsConnected,
    variant,
    isWalletActivated,
    hasRlusdTrustline,
    hasOnChainRlusd,
    walletLabel,
    walletHasCustomLabel,
    renderWalletMeta,
    signTransaction,
    connect,
    activeAction,
    setActiveAction,
    qrSizingVariant,
    selectableTokens,
    augmentedTokens,
    selectedSendToken,
    sendFxInfo,
    setSendAssetKey,
    sendAmount,
    setSendAmount,
    sendPaymentRequest,
    setSendPaymentRequest,
    selectLabelByAssetKey,
    selectLabelRightByAssetKey,
    selectIconByAssetKey,
    selectLabelMobileByAssetKey,
    savedAddresses,
    sendDestination,
    setSendDestination,
    setQrScannerOpen,
    handlePaymentRequestScan,
    handleSendSubmit,
    sendProcessing,
    payreqDecorProps,
    hasPayreq,
    savePayreq,
    removePayreq,
    receiveTab,
    setReceiveTab,
    handleCopyAddress,
    requestAmount,
    setRequestAmount,
    requestCurrency,
    setRequestCurrency,
    requestMemo,
    setRequestMemo,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    swapDefaultView,
    swapLockedView,
    swapCurrencyOptionsForModal,
    convertBaseCurrency,
    setConvertBaseCurrency,
    convertQuoteCurrency,
    setConvertQuoteCurrency,
    convertAmount,
    setConvertAmount,
    convertPreview,
    convertProcessing,
    handleInstallRequiredTrustline,
    handleActivateCurrencyLine,
    effectiveRefreshCurrencyLines,
    effectiveCurrencyLinesLoading,
    effectiveCurrencyLinesError,
    effectiveCurrencyLinesSummary,
    effectiveCurrencyLines,
    currencyLineCode,
    setCurrencyLineCode,
    currencyLineAllocatedRlusd,
    setCurrencyLineAllocatedRlusd,
    handleUpsertCurrencyLine,
    cashModalTab,
    setCashModalTab,
    cashBuyPrefill,
    setCashBuyPrefill,
    showAdjustmentModal,
    setShowAdjustmentModal,
    adjustmentDeficitRlusd,
    refreshBalance,
    adjustmentFeeRlusd: ADJUSTMENT_FEE_RLUSD,
    showActivationModal,
    setShowActivationModal,
    handleActivationSendFromWallet,
    handleActivationRequestFromThirdParty,
    handleActivationBuyViaMoonpay,
    activationBundleEnabled,
    setActivationBundleEnabled,
    activationXrpAmount,
    showActivationRequestModal,
    setShowActivationRequestModal,
    showRlusdSetupModal,
    setShowRlusdSetupModal,
    handleRlusdSetupConfirm,
    walletInfoOpen,
    setWalletInfoOpen,
    displayTokensWithCurrencyLines,
    backendWalletAddress,
    isFullPageView,
    statementVariant,
    usdRates,
    showGlobalStatement,
    setShowGlobalStatement,
    showCurrencyStatement,
    setShowCurrencyStatement,
    selectedStatementToken,
    setSelectedStatementToken,
    qrModalData,
    closeQrModal,
    qrScannerOpen,
    handleAddressScan,
  });
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
		          totalLabel={totalLabel}
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

          {/* Pending payment requests */}
          {pendingCount > 0 ? (
            <div className="px-1">
              <WalletPendingPayreqs
                pendingPayreqs={pendingPayreqs}
                onResume={handleResumePayreq}
                onRemove={removePayreq}
              />
            </div>
          ) : null}

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
            <WalletMobileModals
              {...modalProps}
              showSaveAddressPrompt={showSaveAddressPrompt}
              setShowSaveAddressPrompt={setShowSaveAddressPrompt}
              addressToSave={addressToSave}
              setAddressToSave={setAddressToSave}
              addressLabel={addressLabel}
              setAddressLabel={setAddressLabel}
              saveAddress={saveAddress}
            />
          ) : null}
        </div>

        {isDesktopPanel ? (
          <WalletDesktopModals
            showInlineXumm={showInlineXumm}
            showInlineQrScanner={showInlineQrScanner}
            showInlineSend={showInlineSend}
            showInlinePayreq={showInlinePayreq}
            showInlineReceive={showInlineReceive}
            showInlineSwap={showInlineSwap}
            showInlineCash={showInlineCash}
            showInlineAdjust={showInlineAdjust}
            showInlineActivation={showInlineActivation}
            showInlineActivationRequest={showInlineActivationRequest}
            showInlineInfo={showInlineInfo}
            showInlineCurrencyStatement={showInlineCurrencyStatement}
            showInlineGlobalStatement={showInlineGlobalStatement}
            {...modalProps}
          />
        ) : null}
      </div>
      <WalletToastOverlay
        toasts={toasts}
        confirmState={confirmState}
        dismissToast={dismissToast}
        resolveConfirm={resolveConfirm}
      />
    </>
  );
}
