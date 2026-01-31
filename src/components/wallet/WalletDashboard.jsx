"use client";

	import { useCallback, useEffect, useMemo, useRef, useState } from "react";
	import { createPortal } from "react-dom";
	import { useXumm } from "@/context/XummContext";
import xcannesApi from "@/lib/xcannesApi";
import { apiUrl } from "@/lib/runtimeConfig";
import { getWalletSessionHeaders } from "@/lib/walletSession";
	import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { encodeXrplCurrencyCode, XRPL_KNOWN_ISSUERS } from "@/utils/xrpl";
import {
  buildRlusdPaymentTxjson,
  computeSpreadQuote,
  XCANNES_ACTIVATION_WALLET_ADDRESS,
  XCANNES_SPREAD_WALLET_ADDRESS,
} from "@/utils/walletSpread";
	import { useWalletCurrencyLines } from "./hooks/useWalletCurrencyLines";
	import { useConvertForm } from "./hooks/useConvertForm";
	import { useCurrencyLinesForm } from "./hooks/useCurrencyLinesForm";
import { useCurrencyLinesActions } from "./hooks/useCurrencyLinesActions";
import { useOverflowLock } from "./hooks/useOverflowLock";
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
import { useXrplConnectionIndicator } from "./hooks/useXrplConnectionIndicator";
import { useWalletLabel } from "./hooks/useWalletLabel";
import WalletDashboardFooter from "./components/WalletDashboardFooter";
import WalletDashboardHeader from "./components/WalletDashboardHeader";
import WalletDashboardActionRow from "./components/WalletDashboardActionRow";
import WalletDashboardTokenList from "./components/WalletDashboardTokenList";
import WalletDashboardTokenRow from "./components/WalletDashboardTokenRow";
import WalletDashboardSaveAddressPrompt from "./components/WalletDashboardSaveAddressPrompt";
import QRScanner from "./components/QRScanner";
import WalletDashboardCashModal from "./modals/WalletDashboardCashModal";
import WalletDashboardReceiveModal from "./modals/WalletDashboardReceiveModal";
import WalletDashboardSendModal from "./modals/WalletDashboardSendModal";
import WalletDashboardStatementModals from "./modals/WalletDashboardStatementModals";
import WalletDashboardSwapModal from "./modals/WalletDashboardSwapModal";
import WalletDashboardAdjustModal from "./modals/WalletDashboardAdjustModal";
import WalletInfoModal from "./modals/WalletInfoModal";
import WalletActivationModal from "./modals/WalletActivationModal";
import WalletActivationRequestModal from "./modals/WalletActivationRequestModal";
import { buildCurrencyLineMemo, buildMoonpayMemo, buildPayreqMemo, buildXrplJsonMemo } from "@/utils/xrplMemo";
import { useTranslation } from "next-i18next";
import {
  getCurrencyFlag,
  getTokenIcon,
  resolveWalletLayout,
  USD_STABLECOINS,
} from "./walletDashboardConfig";

const DEFAULT_ACTIVATION_FEE_RLUSD = 1;
const ACTIVATION_FEE_RLUSD = (() => {
  const raw = Number.parseFloat(
    process.env.NEXT_PUBLIC_WALLET_ACTIVATION_FEE_RLUSD || ""
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ACTIVATION_FEE_RLUSD;
})();

const DEFAULT_WALLET_LABEL_FEE_RLUSD = 1;
const WALLET_LABEL_FEE_RLUSD = (() => {
  const raw = Number.parseFloat(
    process.env.NEXT_PUBLIC_WALLET_LABEL_FEE_RLUSD || ""
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_WALLET_LABEL_FEE_RLUSD;
})();

const DEFAULT_ADJUSTMENT_FEE_RLUSD = 1;
const ADJUSTMENT_FEE_RLUSD = (() => {
  const raw = Number.parseFloat(
    process.env.NEXT_PUBLIC_WALLET_ADJUSTMENT_FEE_RLUSD || ""
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ADJUSTMENT_FEE_RLUSD;
})();

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
}) {
  const { t } = useTranslation("common");
  // Preview wallet (non connecté) : tout à 0 pour éviter de faire croire à un solde réel.
  const DEMO_RLUSD_TOTAL = 0;
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
    isWalletActivated,
    walletSessionToken,
    refreshBalance,
    connect,
    disconnect,
    signTransaction,
  } = useXumm();

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
    () => effectiveBalance?.tokens || [],
    [effectiveBalance?.tokens]
  );
  const hasOnChainRlusd = (baseTokens || []).some(
    (t) => String(t?.currency || "").toUpperCase() === "RLUSD"
  );
  const hasOnChainXcs = (baseTokens || []).some(
    (t) => String(t?.currency || "").toUpperCase() === "XCS"
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAction, setActiveAction] = useState(null); // 'send' | 'receive' | 'swap' | 'buy' | 'sell' | null
  const [swapDefaultView, setSwapDefaultView] = useState("convert");
  const [swapLockedView, setSwapLockedView] = useState(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showActivationRequestModal, setShowActivationRequestModal] = useState(false);
  const adjustmentAutoOpenedRef = useRef(false);
  const { receiveTab, setReceiveTab } = useReceiveForm();
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
    walletHeaderToast,
    flashWalletHeaderToast,
    openWalletLabelEditor: handleOpenWalletLabelEditor,
    saveWalletLabel: handleSaveWalletLabel,
    cancelWalletLabel: handleCancelWalletLabel,
  } = useWalletLabel({
    walletAddress: effectiveWallet,
    isConnected: effectiveIsConnected,
    isPreviewMode,
    isWalletActivated,
    hasOnChainRlusd,
    defaultLabel: t("nav_wallet", "Wallet"),
    signTransaction,
    activationDestination: XCANNES_ACTIVATION_WALLET_ADDRESS,
    renameFeeRlusd: WALLET_LABEL_FEE_RLUSD,
  });
  const { renderWalletMeta } = useWalletMeta({
    walletAddress: effectiveWallet,
    walletLabel,
  });

  const handleAction = useCallback(
    (nextAction) => {
      if (effectiveIsConnected && isWalletLabelRequired) {
        flashWalletHeaderToast("Nom du wallet requis.", 2000);
        handleOpenWalletLabelEditor();
        return;
      }
      if (nextAction === "swap") {
        setSwapDefaultView("convert");
        setSwapLockedView(null);
      }
      setActiveAction(nextAction);
    },
    [
      effectiveIsConnected,
      flashWalletHeaderToast,
      handleOpenWalletLabelEditor,
      isWalletLabelRequired,
    ]
  );

  const handleOpenCurrencyLines = useCallback(() => {
    setSwapDefaultView("lines");
    setSwapLockedView("lines");
    setActiveAction("swap");
  }, []);
  
  const [cashModalTab, setCashModalTab] = useState("buy"); // 'buy' | 'sell' - Onglet actif dans la modal Cash
  
  // États pour Payment Request
  const {
    requestAmount,
    setRequestAmount,
    requestCurrency,
    setRequestCurrency,
    requestMemo,
    setRequestMemo,
  } = usePaymentRequestForm();

  const handleOpenActivationModal = useCallback(() => {
    setShowActivationModal(true);
  }, []);

  const handleActivationRequestFromThirdParty = useCallback(() => {
    setShowActivationModal(false);
    setShowActivationRequestModal(true);
  }, []);

  const handleActivationBuyViaMoonpay = useCallback(() => {
    setShowActivationModal(false);
    setCashModalTab("buy");
    setActiveAction("cash");
  }, [setCashModalTab]);
  
  const [selectedWallet, setSelectedWallet] = useState("");
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
  } = useConvertForm();
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
        isMissingTrustline: true,
      });
    }

    // S'assurer qu'il y a toujours une ligne RLUSD visible,
    // même si la trustline n'est pas encore installée.
    const hasRlusd = tokens.some(
      (t) => String(t.currency || "").toUpperCase() === "RLUSD"
    );
    if (!hasRlusd) {
      tokens.push({
        key: "RLUSD:auto",
        currency: "RLUSD",
        issuer: "Trustline",
        value: 0,
        isMissingTrustline: true,
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

  // Adresse backend (session API)
  const backendWalletAddress = isPreviewMode ? null : effectiveWallet || null;

  const {
    lines: currencyLines,
    summary: currencyLinesSummary,
    loading: currencyLinesLoading,
    error: currencyLinesError,
    refresh: refreshCurrencyLines,
    upsertCurrencyLine,
    removeCurrencyLine,
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
      removeCurrencyLine,
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
      .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
  }, [demoLines, isPreviewMode]);

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

  const effectiveCurrencyLines = isPreviewMode ? demoCurrencyLines : currencyLines;
  const effectiveCurrencyLinesSummary = isPreviewMode
    ? demoCurrencyLinesSummary
    : currencyLinesSummary;
  const effectiveCurrencyLinesLoading = isPreviewMode ? false : currencyLinesLoading;
  const effectiveCurrencyLinesError = isPreviewMode ? null : currencyLinesError;
  const effectiveRefreshCurrencyLines = isPreviewMode
    ? () => {}
    : refreshCurrencyLines;

  const adjustmentDeficitRlusd = Number(
    effectiveCurrencyLinesSummary?.excessAllocatedRlusd ?? 0
  );
  const hasAdjustmentDeficit =
    Number.isFinite(adjustmentDeficitRlusd) && adjustmentDeficitRlusd > 1e-9;

  const payActivationFee = useCallback(async ({ action, memoPayload, memoPayloads } = {}) => {
    if (!wallet || !signTransaction) {
      alert("Please connect your Xumm wallet first.");
      return null;
    }
    if (!hasOnChainRlusd) {
      alert("RLUSD trustline is not installed yet. Please install it first.");
      return null;
    }

    const destination = String(XCANNES_ACTIVATION_WALLET_ADDRESS || "").trim();
    if (!destination) {
      alert("Activation wallet not configured.");
      return null;
    }

    const txjson = buildRlusdPaymentTxjson({
      account: wallet,
      destination,
      amountRlusd: ACTIVATION_FEE_RLUSD,
    });
    if (!txjson) {
      alert("Unable to build activation fee payment.");
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
      if (memos.length > 0) txjson.Memos = memos;
    }

    const result = await signTransaction(txjson, { action });
    if (!result?.signed || !result?.uuid) {
      alert("Activation payment cancelled or expired.");
      return null;
    }

    if (refreshBalance) {
      setTimeout(() => refreshBalance(), 2500);
    }

    return result.uuid;
  }, [hasOnChainRlusd, refreshBalance, signTransaction, wallet]);

  const handleActivateCurrencyLine = useCallback(
    async (code) => {
      const currencyCode = String(code || "").trim().toUpperCase();
      if (!currencyCode || currencyCode.length < 2) return false;
      if (currencyCode === "RLUSD" || currencyCode === "XRP" || currencyCode === "XCS") return false;

      if (isPreviewMode) {
        setDemoLines((prev) => {
          const next = { ...(prev || {}) };
          if (next[currencyCode]) return next;
          next[currencyCode] = { currency: currencyCode, rlusd: 0, units: 0, rate: 0 };
          return next;
        });
        return true;
      }

      if (!backendWalletAddress) {
        alert("Please connect your Xumm wallet first.");
        return false;
      }

      const alreadyActive = (currencyLines || []).some(
        (line) => String(line?.currencyCode || "").toUpperCase() === currencyCode
      );
      if (alreadyActive) return false;

      if (isWalletActivated === false) {
        alert(
          t("ui_wallet_activation_required_f4", {
            defaultValue: "Wallet must be activated to create currency lines.",
          })
        );
        return false;
      }

      if (!hasOnChainRlusd) {
        alert("RLUSD trustline is not installed yet. Please install it first.");
        return false;
      }

      const memoPayload = buildCurrencyLineMemo({
        action: "activate",
        currencyCode,
        allocatedRlusdAfter: 0,
      });
      if (!memoPayload) {
        alert("Invalid currency line memo.");
        return false;
      }
      const xummUuid = await payActivationFee({
        action: "wallet:currency-lines:upsert",
        memoPayload,
      });
      if (!xummUuid) return false;

      if (refreshCurrencyLines) {
        setTimeout(() => refreshCurrencyLines(), 3500);
      }
      return true;
    },
    [
      backendWalletAddress,
      currencyLines,
      hasOnChainRlusd,
      isPreviewMode,
      isWalletActivated,
      payActivationFee,
      refreshCurrencyLines,
      setDemoLines,
      t,
    ]
  );


  // Ouvrir le convert (swap modal) depuis d'autres briques UI.
  // Event detail:
  // - action: "buy" | "sell"
  // - base, quote: codes devises (ex: EUR/USD)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = async (event) => {
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
      setShowAdjustmentModal(true);
    };
    window.addEventListener("xcannes:wallet:open-adjustment", handler);
    return () =>
      window.removeEventListener("xcannes:wallet:open-adjustment", handler);
  }, []);

  useEffect(() => {
    if (isPreviewMode) return;
    if (!backendWalletAddress) return;
    if (!hasAdjustmentDeficit) {
      adjustmentAutoOpenedRef.current = false;
      return;
    }
    if (adjustmentAutoOpenedRef.current) return;
    if (activeAction || showAdjustmentModal) return;
    setShowAdjustmentModal(true);
    adjustmentAutoOpenedRef.current = true;
  }, [
    activeAction,
    backendWalletAddress,
    hasAdjustmentDeficit,
    isPreviewMode,
    showAdjustmentModal,
  ]);

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

  const handleRemoveCurrencyLine = useCallback(
    async (code) => {
      const currencyCode = String(code || "").trim().toUpperCase();
      if (!currencyCode || currencyCode === "RLUSD") return false;

      if (isPreviewMode) {
        setDemoLines((prev) => {
          const next = { ...(prev || {}) };
          const allocated = Number(next?.[currencyCode]?.rlusd || 0);
          if (allocated > 0) {
            const pool = next.RLUSD || { currency: "RLUSD", rlusd: 0, units: 0, rate: 1 };
            const nextPoolRlusd = Math.max(0, Number(pool.rlusd || 0) + allocated);
            next.RLUSD = { ...pool, rlusd: nextPoolRlusd, units: nextPoolRlusd, rate: 1 };
          }
          delete next[currencyCode];
          return next;
        });
        return true;
      }

      const line = (currencyLines || []).find(
        (entry) => String(entry?.currencyCode || "").toUpperCase() === currencyCode
      );
      const allocated = Number(line?.allocatedRlusd || 0);
      if (Number.isFinite(allocated) && allocated > 0) {
        alert("La ligne doit être à zéro pour être supprimée.");
        return false;
      }

      const ok = confirm(`Supprimer la ligne ${currencyCode} ?`);
      if (!ok) return false;

      const deleteMemo = buildCurrencyLineMemo({
        action: "delete",
        currencyCode,
        allocatedRlusdAfter: 0,
      });
      if (!deleteMemo) {
        alert("Invalid currency line memo.");
        return false;
      }
      const xummUuid = await payActivationFee({
        action: "wallet:currency-lines:delete",
        memoPayload: deleteMemo,
      });
      if (!xummUuid) return false;

      if (refreshCurrencyLines) {
        setTimeout(() => refreshCurrencyLines(), 3500);
      }
      return true;
    },
    [currencyLines, isPreviewMode, payActivationFee, refreshCurrencyLines, setDemoLines]
  );

  const handleRefresh = async () => {
    if (!refreshBalance) return;
    setIsRefreshing(true);
    await refreshBalance();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleInstallRequiredTrustline = useCallback(
    async (currencyCode) => {
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

      try {
        const result = await signTransaction(txjson);
        if (result && result.signed) {
          alert(`✅ Trustline ${code} submitted via Xumm.`);
          if (refreshBalance) {
            setTimeout(() => refreshBalance(), 2500);
          }
        } else {
          alert("Transaction cancelled or expired.");
        }
      } catch (err) {
        console.error("Install trustline error:", err);
        alert("Error while preparing trustline: " + (err?.message || String(err)));
      }
    },
    [isConnected, refreshBalance, signTransaction, wallet]
  );

  const renderTokenRow = useCallback(
    (token) => (
      <WalletDashboardTokenRow
        key={token.key}
        token={token}
        tokenRowClass={layout.tokenRowClass}
        onInstallTrustline={handleInstallRequiredTrustline}
        isWalletActivated={isWalletActivated}
        onActivateWallet={handleOpenActivationModal}
        onClick={() => {
          setSelectedStatementToken(token);
          setShowCurrencyStatement(true);
        }}
      />
    ),
    [
      handleInstallRequiredTrustline,
      handleOpenActivationModal,
      isWalletActivated,
      layout.tokenRowClass,
    ]
  );

  const {
    augmentedTokens,
    allocatedRlusdByCurrency,
    swapCurrencyOptions,
  } = useWalletTokens({ displayTokens, currencyLines });

  const hasRlusdTrustline = useMemo(() => {
    return (augmentedTokens || []).some((token) => {
      const code = String(token?.currency || "").toUpperCase();
      return code === "RLUSD" && !token?.isMissingTrustline;
    });
  }, [augmentedTokens]);

  const selectLabelByAssetKey = useMemo(() => {
    const labels = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      if (token?.key) labels[token.key] = code;
      labels[code] = code;
    });
    return labels;
  }, [augmentedTokens]);

  const selectLabelRightByAssetKey = useMemo(() => {
    const labels = {};
    const balanceLabel = t("ui_balance_label_4db9aa0c31", "Balance").replace(/:\s*$/, "");
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const amount = Number(token?.value || 0);
      const amountLabel = Number.isFinite(amount)
        ? amount.toLocaleString(undefined, { maximumFractionDigits: 4 })
        : "0";
      const label = `${balanceLabel} = ${amountLabel}`;
      if (token?.key) labels[token.key] = label;
      labels[code] = label;
    });
    return labels;
  }, [augmentedTokens, t]);

  const selectLabelMobileByAssetKey = useMemo(() => {
    const labels = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const amount = Number(token?.value || 0);
      const amountLabel = Number.isFinite(amount)
        ? amount.toLocaleString(undefined, { maximumFractionDigits: 4 })
        : "0";
      const label = `${code} (${amountLabel})`;
      if (token?.key) labels[token.key] = label;
      labels[code] = label;
    });
    return labels;
  }, [augmentedTokens]);

  const selectIconByAssetKey = useMemo(() => {
    const icons = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const icon = CRYPTO_ICONS?.[code]
        ? { src: CRYPTO_ICONS[code], alt: code }
        : token?.isTrustlineOnly
          ? getCurrencyFlag(code)
          : getTokenIcon(code);
      if (token?.key) icons[token.key] = icon;
      icons[code] = icon;
    });
    return icons;
  }, [augmentedTokens]);

  const swapCurrencyOptionsForModal = useMemo(() => {
    const candidates = new Set((swapCurrencyOptions || []).map((c) => String(c || "").toUpperCase()).filter(Boolean));
    if (convertBaseCurrency) candidates.add(String(convertBaseCurrency || "").toUpperCase());
    if (convertQuoteCurrency) candidates.add(String(convertQuoteCurrency || "").toUpperCase());

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
  }, [convertBaseCurrency, convertQuoteCurrency, swapCurrencyOptions]);

  const currencyLineCodes = useMemo(() => {
    const codes = new Set();
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (code) codes.add(code);
    });
    // Exclure les actifs XRPL (affichés on-chain), garder les devises "UX".
    ["XRP", "XCS", "RLUSD"].forEach((c) => codes.delete(c));
    return Array.from(codes);
  }, [currencyLines]);

  const { usdPerUnit: rlusdPerUnitRates, sourceByCode: rlusdPerUnitSources } =
    useRlusdPerUnitRates(currencyLineCodes);

  // Toast "crédité en EUR" (etc.) quand un paiement entrant est détecté.
  const lastIncomingToastRef = useRef(null);
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPreviewMode) return;
    if (!backendWalletAddress || !walletSessionToken) return;

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
        const res = await fetch(apiUrl(`/wallet/statement?${params.toString()}`), {
          headers: getWalletSessionHeaders(walletSessionToken),
        });
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
  }, [backendWalletAddress, flashWalletHeaderToast, isPreviewMode, walletSessionToken]);

  const displayTokensWithCurrencyLines = useMemo(() => {
    return (augmentedTokens || []).map((token) => {
      const currency = String(token?.currency || "").toUpperCase();
      if (!currency) return token;

      // Pour les devises "UX" (off-chain), on affiche:
      // - valeur principale en devise (units), basée sur l'allocation RLUSD et un taux indicatif
      // - valeur secondaire "≈ RLUSD" = allocation RLUSD
      if (!token?.isTrustlineOnly) return token;
      if (currency === "XRP" || currency === "XCS" || currency === "RLUSD") return token;

      const allocated =
        allocatedRlusdByCurrency?.get?.(currency) ??
        (Number.isFinite(Number(token?.allocatedRlusd)) ? Number(token.allocatedRlusd) : 0);

      const rate = Number(rlusdPerUnitRates?.[currency]);
      const units =
        Number.isFinite(rate) && rate > 0 && Number.isFinite(allocated) && allocated > 0
          ? allocated / rate
          : 0;

      return {
        ...token,
        value: units,
        demoRlusdValue: Number.isFinite(allocated) ? allocated : 0,
      };
    });
  }, [allocatedRlusdByCurrency, augmentedTokens, rlusdPerUnitRates]);
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
  });

  const selectedSendToken =
    augmentedTokens.find((t) => t.key === sendAssetKey) ||
    augmentedTokens[0] ||
    null;

  const sendFxInfo = useMemo(() => {
    const code = String(selectedSendToken?.currency || "").toUpperCase();
    if (!code) return null;
    if (code === "XRP" || code === "RLUSD" || code === "XCS") return null;
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
    const spread = computeSpreadQuote({
      base: code,
      quote: "RLUSD",
      amountRlusd: paymentRlusd,
    });
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
      selectedSendToken?.currency === "RLUSD" &&
      !hasOnChainRlusd &&
      !isPreviewMode
    ) {
      alert("RLUSD trustline is not installed yet. Please install it first.");
      return { ok: false };
    }
    if (
      selectedSendToken?.currency === "XCS" &&
      !hasOnChainXcs &&
      !isPreviewMode
    ) {
      alert("XCS trustline is not installed yet. Please install it first.");
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
    const isFxSend =
      selectedSendToken?.isTrustlineOnly &&
      currency !== "XRP" &&
      currency !== "RLUSD" &&
      currency !== "XCS";

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

        const spread = computeSpreadQuote({ base: currency, quote: "RLUSD", amountRlusd: paymentRlusd });
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
            `Allocation insuffisante en ${currency} pour couvrir paiement + spread.\n\n` +
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
              ? `Spread XCANNES (tier ${spread?.tier || "A"}): ≈ ${spreadFeeRlusd.toLocaleString("en-US", {
                  maximumFractionDigits: 6,
                })} RLUSD\n`
              : "") +
            `Total RLUSD à débiter: ≈ ${totalToSpendRlusd.toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })} RLUSD\n\n` +
            (spreadFeeRlusd > 0
              ? `2 signatures Xumm seront demandées (spread → XCANNES, puis paiement → destinataire).`
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
              `Allocation démo insuffisante (≈ RLUSD) pour couvrir paiement + spread. Disponible: ${availableRlusd.toLocaleString(
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

          alert(
            `✅ (Demo) Signature 1/2 simulée: spread → XCANNES (${XCANNES_SPREAD_WALLET_ADDRESS})\n` +
              `✅ (Demo) Signature 2/2 simulée: paiement → destinataire (${dest})`
          );
          handleAddressSave(dest);
          setSendAmount("");
          setSendDestination("");
          return { ok: true };
        }

        // 1) Paiement spread → wallet entreprise XCANNES
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
            throw new Error("Invalid RLUSD spread payment");
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
            throw new Error("Invalid spread memo payload");
          }
          const spreadMemos = buildXrplJsonMemo(spreadMemoPayload);
          if (!spreadMemos) {
            throw new Error("Invalid spread memo");
          }
          spreadTx.Memos = spreadMemos;

          const spreadResult = await signTransaction(spreadTx, {
            action: "wallet:convert",
          });
          if (!spreadResult?.signed) {
            alert("Spread payment cancelled or expired.");
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
              ? "Payment cancelled or expired. (Spread was already paid.)"
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

        alert(`✅ (Demo) Paiement simulé: ${amountNum} ${currency} → ${dest}`);
        handleAddressSave(dest);
        setSendAmount("");
        setSendDestination("");
        return { ok: true };
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

      // If this payment comes from a XCANNES request, attach a memo so the receiver
      // can auto-credit the right currency line (only meaningful for RLUSD payments).
      if (currency === "RLUSD" && sendPaymentRequest?.targetCurrencyCode) {
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

    const amountDrops = String(Math.round(1 * 1_000_000));
    const txjson = {
      TransactionType: "Payment",
      Destination: effectiveWallet,
      Amount: amountDrops,
    };

    const result = await signTransaction(txjson, { action: "wallet:activate_xrp" });
    if (result?.signed && refreshBalance) {
      setTimeout(() => refreshBalance(), 3000);
    }
  }, [effectiveWallet, refreshBalance, signTransaction]);

  const handleSwitchWallet = () => {
    if (isConnecting) return;
    connect();
  };

  useEffect(() => {
    setSelectedWallet(wallet || "");
  }, [wallet]);
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
  });

  const previewTotalLabel = useMemo(() => {
    if (!isPreviewMode) return null;
    const total =
      effectiveCurrencyLinesSummary?.rlusdOnChain != null
        ? Number(effectiveCurrencyLinesSummary.rlusdOnChain)
        : Object.entries(demoLines || {}).reduce((sum, [_code, line]) => {
            const value = Number(line?.rlusd || 0);
            return sum + (Number.isFinite(value) ? value : 0);
          }, 0);
    const safe = Number.isFinite(total) ? total : 0;
    return `${safe.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} USD`;
  }, [demoLines, effectiveCurrencyLinesSummary, isPreviewMode]);

  const xrplConnectionIndicator = useXrplConnectionIndicator({
    isPreviewMode,
    isConnecting,
    isConnected: effectiveIsConnected,
  });

  useOverflowLock(
    !!activeAction || showAdjustmentModal || showActivationModal || showActivationRequestModal
  );

  return (
    <>
      <div className={`flex flex-col bg-elevated h-full min-h-0 ${layout.containerClass}`}>
        {/* Header */}
        <WalletDashboardHeader
          layout={layout}
          effectiveIsConnected={effectiveIsConnected}
          effectiveWallet={effectiveWallet}
          onDisconnect={disconnect}
          totalLabel={previewTotalLabel || totalLabel}
          onOpenGlobalStatement={() => setShowGlobalStatement(true)}
          xrplConnectionIndicator={xrplConnectionIndicator}
          walletLabel={walletLabel}
          walletHeaderToast={walletHeaderToast}
          onOpenWalletLabelEditor={handleOpenWalletLabelEditor}
          onCopyAddress={handleCopyAddress}
          onSwitchWallet={handleSwitchWallet}
          isConnecting={isConnecting}
          isEditingWalletLabel={isEditingWalletLabel}
          isWalletLabelRequired={isWalletLabelRequired}
          walletLabelDraft={walletLabelDraft}
          onWalletLabelDraftChange={setWalletLabelDraft}
          onSaveWalletLabel={handleSaveWalletLabel}
          onCancelWalletLabel={handleCancelWalletLabel}
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
          tokens={isPreviewMode ? displayTokens : displayTokensWithCurrencyLines}
          renderTokenRow={renderTokenRow}
          headerTitle={t("demo_lines_title", "Balances by currency")}
          headerActionLabel={t("home_feature_currencylines_cta", "Manage lines")}
          onHeaderAction={handleOpenCurrencyLines}
          className="touch-pan-y"
          style={{ WebkitOverflowScrolling: "touch" }}
        />
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
          isPreviewMode={isPreviewMode}
          isWalletActivated={isWalletActivated}
          hasRlusdTrustline={hasRlusdTrustline}
        />
        <WalletActivationRequestModal
          open={showActivationRequestModal}
          onClose={() => setShowActivationRequestModal(false)}
          walletAddress={effectiveWallet}
          walletLabel={walletLabel}
          isPreviewMode={isPreviewMode}
          isWalletActivated={isWalletActivated}
          hasRlusdTrustline={hasRlusdTrustline}
        />
      </div>

      {/* Modales via Portal pour éviter les problèmes de z-index et overflow */}
      {typeof document !== 'undefined' && createPortal(
        <>
          <WalletDashboardSendModal
            open={activeAction === "send"}
            onClose={() => setActiveAction(null)}
            isPreviewMode={isPreviewMode}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            sendTab={sendTab}
            setSendTab={setSendTab}
            renderWalletMeta={renderWalletMeta}
            augmentedTokens={augmentedTokens}
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
          />

          <WalletDashboardReceiveModal
            open={activeAction === "receive"}
            onClose={() => setActiveAction(null)}
            isPreviewMode={isPreviewMode}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
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
            augmentedTokens={augmentedTokens}
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
            handleRemoveCurrencyLine={handleRemoveCurrencyLine}
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
            activationFeeRlusd={ACTIVATION_FEE_RLUSD}
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
	        onClose={() => setActiveAction(null)}
          isPreviewMode={isPreviewMode}
          isWalletActivated={isWalletActivated}
          hasRlusdTrustline={hasRlusdTrustline}
	        cashModalTab={cashModalTab}
	        setCashModalTab={setCashModalTab}
	        renderWalletMeta={renderWalletMeta}
	        availableTokens={augmentedTokens}
	        rlusdPerUnitRates={rlusdPerUnitRates}
	        selectLabelByCurrency={selectLabelByAssetKey}
	        selectLabelRightByCurrency={selectLabelRightByAssetKey}
	        selectIconByCurrency={selectIconByAssetKey}
	        selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
	        walletAddress={effectiveWallet || ""}
	      />

        </>,
        document.body
      )}

      {/* QR Scanner Modal for Address */}
      <QRScanner
        isOpen={qrScannerOpen}
        onScan={handleAddressScan}
        onClose={() => setQrScannerOpen(false)}
      />

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

	      <WalletDashboardStatementModals
	        augmentedTokens={augmentedTokens}
	        backendWalletAddress={backendWalletAddress}
	        effectiveWallet={effectiveWallet}
          isPreviewMode={isPreviewMode}
          isWalletActivated={isWalletActivated}
	        isFullPageView={isFullPageView}
	        statementVariant={statementVariant}
	        currencyLines={effectiveCurrencyLines}
	        usdRates={usdRates}
        showGlobalStatement={showGlobalStatement}
        setShowGlobalStatement={setShowGlobalStatement}
        showCurrencyStatement={showCurrencyStatement}
        setShowCurrencyStatement={setShowCurrencyStatement}
        selectedStatementToken={selectedStatementToken}
        setSelectedStatementToken={setSelectedStatementToken}
      />
    </>
  );
}
