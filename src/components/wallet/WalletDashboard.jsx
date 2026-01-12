"use client";

	import { useCallback, useEffect, useMemo, useRef, useState } from "react";
	import { createPortal } from "react-dom";
	import { useXumm } from "@/context/XummContext";
import xcannesApi from "@/lib/xcannesApi";
import { apiUrl } from "@/lib/runtimeConfig";
	import { CRYPTO_ICONS } from "@/components/dex/ExchangeSections/constants";
import { encodeXrplCurrencyCode, XRPL_KNOWN_ISSUERS } from "@/utils/xrpl";
import {
  buildRlusdPaymentTxjson,
  computeSpreadQuote,
  XCANNES_SPREAD_WALLET_ADDRESS,
} from "@/utils/walletSpread";
	import { useWalletLines } from "./hooks/useWalletLines";
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
import { useTrustlinesForm } from "./hooks/useTrustlinesForm";
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
import WalletDashboardTrustlineCurrencyModal from "./modals/WalletDashboardTrustlineCurrencyModal";
import WalletDashboardTrustlinesModal from "./modals/WalletDashboardTrustlinesModal";
import WalletInfoModal from "./modals/WalletInfoModal";
import { buildXrplJsonMemo } from "@/utils/xrplMemo";
import {
  resolveWalletLayout,
  USD_STABLECOINS,
  WALLET_LABEL_STORAGE_KEY,
} from "./walletDashboardConfig";

export default function WalletDashboard({
  preview = false,
  isFullPage = false,
  variant,
}) {
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

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAction, setActiveAction] = useState(null); // 'send' | 'receive' | 'swap' | 'buy' | 'sell' | 'trustlines' | null
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
    walletHeaderToast,
    flashWalletHeaderToast,
    openWalletLabelEditor: handleOpenWalletLabelEditor,
    saveWalletLabel: handleSaveWalletLabel,
    cancelWalletLabel: handleCancelWalletLabel,
  } = useWalletLabel({
    walletAddress: effectiveWallet,
    isConnected: effectiveIsConnected,
    storageKey: WALLET_LABEL_STORAGE_KEY,
  });
  const { renderWalletMeta } = useWalletMeta({
    walletAddress: effectiveWallet,
    walletLabel,
  });
  
  const [cashModalTab, setCashModalTab] = useState("buy"); // 'buy' | 'sell' - Onglet actif dans la modal Cash
  
  // États pour Payment Request
  const {
    requestAmount,
    setRequestAmount,
    requestCurrency,
    setRequestCurrency,
    requestMethod,
    setRequestMethod,
    requestToAddress,
    setRequestToAddress,
    requestMemo,
    setRequestMemo,
  } = usePaymentRequestForm();
  
  const [selectedWallet, setSelectedWallet] = useState("");
  const {
    trustlineCode,
    setTrustlineCode,
    trustlineLocked,
    setTrustlineLocked,
    editingTrustlineCurrency,
    setEditingTrustlineCurrency,
    editingTrustlineLocked,
    setEditingTrustlineLocked,
  } = useTrustlinesForm();
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
  
  const xrpAmount = parseFloat(effectiveBalance?.xrp || 0) || 0;
  const hasOnChainRlusd = useMemo(() => {
    return (baseTokens || []).some(
      (t) => String(t?.currency || "").toUpperCase() === "RLUSD"
    );
  }, [baseTokens]);
  const hasOnChainXcs = useMemo(() => {
    return (baseTokens || []).some(
      (t) => String(t?.currency || "").toUpperCase() === "XCS"
    );
  }, [baseTokens]);

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

  const {
    handleUpsertCurrencyLine: handleUpsertCurrencyLineReal,
    handleRemoveCurrencyLine: handleRemoveCurrencyLineReal,
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

  const handleActivateCurrencyLine = useCallback(
    async (code) => {
      const currencyCode = String(code || "").trim().toUpperCase();
      if (!currencyCode || currencyCode.length < 2) return;
      if (currencyCode === "RLUSD" || currencyCode === "XRP" || currencyCode === "XCS") return;

      if (isPreviewMode) {
        setDemoLines((prev) => {
          const next = { ...(prev || {}) };
          if (next[currencyCode]) return next;
          next[currencyCode] = { currency: currencyCode, rlusd: 0, units: 0, rate: 0 };
          return next;
        });
        return;
      }

      if (!backendWalletAddress) {
        alert("Please connect your Xumm wallet first.");
        return;
      }

      await upsertCurrencyLine?.({ currencyCode, allocatedRlusd: 0 });
    },
    [backendWalletAddress, isPreviewMode, setDemoLines, upsertCurrencyLine]
  );

  // Ouvrir le convert (swap modal) depuis d'autres briques UI (ex: ExchangeSection).
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

      // Mapping demandé: BUY => base/quote, SELL => inversé.
      const desiredBase = action === "sell" ? quote : base;
      const desiredQuote = action === "sell" ? base : quote;

      setConvertBaseCurrency(desiredBase);
      setConvertQuoteCurrency(desiredQuote === desiredBase ? "RLUSD" : desiredQuote);
      setConvertAmount("");
      setActiveAction("swap");

      // Best effort: s'assurer que les lignes existent (fiat) pour que l'option soit utilisable.
      // Ne pas bloquer l'ouverture de la modale.
      window.setTimeout(() => {
        Promise.all([
          handleActivateCurrencyLine(desiredBase),
          handleActivateCurrencyLine(desiredQuote),
        ]).catch(() => {});
      }, 0);
    };

    window.addEventListener("xcannes:wallet:open-convert", handler);
    return () => window.removeEventListener("xcannes:wallet:open-convert", handler);
  }, [
    handleActivateCurrencyLine,
    setActiveAction,
    setConvertAmount,
    setConvertBaseCurrency,
    setConvertQuoteCurrency,
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
      if (!currencyCode || currencyCode === "RLUSD") return;

      if (isPreviewMode) {
        const ok = confirm(`Delete currency line ${currencyCode}?`);
        if (!ok) return;
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
        return;
      }

      await handleRemoveCurrencyLineReal?.(currencyCode);
    },
    [handleRemoveCurrencyLineReal, isPreviewMode, setDemoLines]
  );

  const handleRefresh = async () => {
    if (!refreshBalance) return;
    setIsRefreshing(true);
    await refreshBalance();
    setTimeout(() => setIsRefreshing(false), 800);
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
        onClick={() => {
          setSelectedStatementToken(token);
          setShowCurrencyStatement(true);
        }}
      />
    ),
    [handleInstallRequiredTrustline, isWalletActivated, layout.tokenRowClass]
  );

  const {
    augmentedTokens,
    allocatedRlusdByCurrency,
    swapCurrencyOptions,
  } = useWalletTokens({ displayTokens, walletLines, currencyLines });

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
    (walletLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (code) codes.add(code);
    });
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (code) codes.add(code);
    });
    // Exclure les actifs XRPL (affichés on-chain), garder les devises "UX".
    ["XRP", "XCS", "RLUSD"].forEach((c) => codes.delete(c));
    return Array.from(codes);
  }, [currencyLines, walletLines]);

  const { usdPerUnit: rlusdPerUnitRates, sourceByCode: rlusdPerUnitSources } =
    useRlusdPerUnitRates(currencyLineCodes);

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
    spreadDestination: XCANNES_SPREAD_WALLET_ADDRESS,
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
    convertCurrencyAllocation,
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
        if (requestTargetCurrency && requestTargetCurrency !== currency) {
          alert(
            `Cette demande est libellée en ${requestTargetCurrency}.\n` +
              `Veuillez sélectionner ${requestTargetCurrency} comme devise d’envoi.`
          );
          return { ok: false };
        }

        const requestedFxRate =
          sendPaymentRequest?.fxRate != null
            ? Number(sendPaymentRequest.fxRate)
            : Number.NaN;

        const rawRate = Number(rlusdPerUnitRates?.[currency]);
        const effectiveRate = Number.isFinite(requestedFxRate) && requestedFxRate > 0
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

        const paymentRlusd = amountNum * rlusdPerUnit;
        if (
          sendPaymentRequest?.amountRlusd != null &&
          Number.isFinite(Number(sendPaymentRequest.amountRlusd))
        ) {
          const requestedRlusd = Number(sendPaymentRequest.amountRlusd);
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

        const ok = confirm(
          `Paiement en RLUSD (affiché en ${currency}).\n\n` +
            `Montant: ${amountNum.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${currency}\n` +
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
          if (availableUnits + 1e-9 < amountNum) {
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
            const newUnits = Math.max(0, Number(line.units || 0) - amountNum);
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
          const spreadTx = buildRlusdPaymentTxjson({
            account: wallet,
            destination: XCANNES_SPREAD_WALLET_ADDRESS,
            amountRlusd: spreadFeeRlusd,
          });
          if (!spreadTx) {
            throw new Error("Invalid RLUSD spread payment");
          }
          const spreadResult = await signTransaction(spreadTx);
          if (!spreadResult?.signed) {
            alert("Spread payment cancelled or expired.");
            return { ok: false };
          }

          // Déallocation backend minimale (spread payé) pour garder l'invariant
          const deallocateSpread = await convertCurrencyAllocation?.({
            fromCurrencyCode: currency,
            toCurrencyCode: "RLUSD",
            amountRlusd: spreadFeeRlusd,
            fromFxRate: rlusdPerUnit,
            fromFxSource: fxSource,
            toFxRate: 1,
            toFxSource: "PYTH",
          });
          if (!deallocateSpread || deallocateSpread.error) {
            console.warn("Failed to deallocate spread (backend):", deallocateSpread?.error);
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

        const memoPayload = {
          xcannes: "payreq",
          v: 1,
          targetCurrencyCode: currency,
          displayAmount: amountNum,
          displayCurrencyCode: currency,
          amountRlusd: paymentRlusd,
          fxRate: rlusdPerUnit,
          fxSource,
          note: sendPaymentRequest?.memo || null,
        };
        const memos = buildXrplJsonMemo(memoPayload);
        if (memos) payTx.Memos = memos;

        const payResult = await signTransaction(payTx);
        if (payResult?.signed) {
          alert("✅ Payment submitted via Xumm.");

          // 3) Déallocation backend du paiement (réduit l'allocation de la devise choisie)
          const deallocatePayment = await convertCurrencyAllocation?.({
            fromCurrencyCode: currency,
            toCurrencyCode: "RLUSD",
            amountRlusd: paymentRlusd,
            fromFxRate: rlusdPerUnit,
            fromFxSource: fxSource,
            toFxRate: 1,
            toFxSource: "PYTH",
          });
          if (!deallocatePayment || deallocatePayment.error) {
            console.warn("Failed to deallocate payment (backend):", deallocatePayment?.error);
          }
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
        const memoPayload = {
          xcannes: "payreq",
          v: 1,
          targetCurrencyCode: target || null,
          displayAmount: sendPaymentRequest?.displayAmount ?? null,
          displayCurrencyCode: (sendPaymentRequest?.displayCurrency ?? target) || null,
          amountRlusd: amountNum,
          fxRate: sendPaymentRequest?.fxRate ?? null,
          fxSource: sendPaymentRequest?.fxSource ?? null,
          note: sendPaymentRequest?.memo || null,
        };
        const memos = buildXrplJsonMemo(memoPayload);
        if (memos) txjson.Memos = memos;
      }

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

  const handleCopyAddress = async () => {
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

  useOverflowLock(!!activeAction);

  const currentEditingLine =
    editingTrustlineCurrency &&
    (walletLines || []).find(
      (line) =>
        String(line.currencyCode || "").toUpperCase() ===
        String(editingTrustlineCurrency || "").toUpperCase()
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
          walletLabelDraft={walletLabelDraft}
          onWalletLabelDraftChange={setWalletLabelDraft}
          onSaveWalletLabel={handleSaveWalletLabel}
          onCancelWalletLabel={handleCancelWalletLabel}
        />

        {/* Action row: Send / Receive / Exchange / Buy / Trustlines */}
        <WalletDashboardActionRow
          layout={layout}
          onAction={setActiveAction}
          showKycPanel={false}
        />

        {/* Token list */}
        <div className="flex-1 flex flex-col min-h-0">
        <WalletDashboardTokenList
          layout={layout}
          tokens={isPreviewMode ? displayTokens : displayTokensWithCurrencyLines}
          renderTokenRow={renderTokenRow}
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
        />
      </div>

      {/* Modales via Portal pour éviter les problèmes de z-index et overflow */}
      {typeof document !== 'undefined' && createPortal(
        <>
          <WalletDashboardSendModal
            open={activeAction === "send"}
            onClose={() => setActiveAction(null)}
            isPreviewMode={isPreviewMode}
            sendTab={sendTab}
            setSendTab={setSendTab}
            renderWalletMeta={renderWalletMeta}
            augmentedTokens={augmentedTokens}
            selectedSendToken={selectedSendToken}
            sendFxInfo={sendFxInfo}
            setSendAssetKey={setSendAssetKey}
            sendAmount={sendAmount}
            setSendAmount={setSendAmount}
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
            receiveTab={receiveTab}
            setReceiveTab={setReceiveTab}
            renderWalletMeta={renderWalletMeta}
            effectiveWallet={effectiveWallet}
            handleCopyAddress={handleCopyAddress}
            requestAmount={requestAmount}
            setRequestAmount={setRequestAmount}
            requestCurrency={requestCurrency}
            setRequestCurrency={setRequestCurrency}
            augmentedTokens={augmentedTokens}
            requestMemo={requestMemo}
            setRequestMemo={setRequestMemo}
            requestMethod={requestMethod}
            setRequestMethod={setRequestMethod}
            requestToAddress={requestToAddress}
            setRequestToAddress={setRequestToAddress}
            rlusdPerUnitRates={rlusdPerUnitRates}
            rlusdPerUnitSources={rlusdPerUnitSources}
          />

          <WalletDashboardSwapModal
            open={activeAction === "swap"}
            onClose={() => setActiveAction(null)}
            renderWalletMeta={renderWalletMeta}
            isPreviewMode={isPreviewMode}
            effectiveIsConnected={effectiveIsConnected}
            hasOnChainRlusd={hasOnChainRlusd}
            hasOnChainXcs={hasOnChainXcs}
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
            currencyLineCode={currencyLineCode}
            setCurrencyLineCode={setCurrencyLineCode}
            currencyLineAllocatedRlusd={currencyLineAllocatedRlusd}
            setCurrencyLineAllocatedRlusd={setCurrencyLineAllocatedRlusd}
            handleUpsertCurrencyLine={handleUpsertCurrencyLine}
            handleDemoConvert={handleDemoConvert}
            convertProcessing={convertProcessing}
          />

	      <WalletDashboardCashModal
	        open={activeAction === "cash"}
	        onClose={() => setActiveAction(null)}
          isPreviewMode={isPreviewMode}
	        cashModalTab={cashModalTab}
	        setCashModalTab={setCashModalTab}
	        renderWalletMeta={renderWalletMeta}
	        walletAddress={effectiveWallet || ""}
	      />

	      <WalletDashboardTrustlineCurrencyModal
	        open={activeAction === "trustlineCurrency" && !!editingTrustlineCurrency}
	        onClose={handleCloseTrustlineEditor}
          isPreviewMode={isPreviewMode}
	        editingTrustlineCurrency={editingTrustlineCurrency}
	        currentEditingLine={currentEditingLine}
	        editingTrustlineLocked={editingTrustlineLocked}
	        setEditingTrustlineLocked={setEditingTrustlineLocked}
	        handleSaveTrustlineCurrency={handleSaveTrustlineCurrency}
	        handleRemoveTrustlineCurrency={handleRemoveTrustlineCurrency}
	      />

	      <WalletDashboardTrustlinesModal
	        open={activeAction === "trustlines"}
	        onClose={() => setActiveAction(null)}
          isPreviewMode={isPreviewMode}
	        trustlineCode={trustlineCode}
	        setTrustlineCode={setTrustlineCode}
	        trustlineLocked={trustlineLocked}
	        setTrustlineLocked={setTrustlineLocked}
        handleAddTrustline={handleAddTrustline}
        walletLinesLoading={walletLinesLoading}
        walletLinesError={walletLinesError}
        walletLines={walletLines}
        totalLockedXcs={totalLockedXcs}
        openTrustlineEditor={openTrustlineEditor}
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
