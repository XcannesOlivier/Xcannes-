"use client";

	import { useCallback, useEffect, useMemo, useState } from "react";
	import { createPortal } from "react-dom";
	import { useXumm } from "@/context/XummContext";
	import xcannesApi from "@/lib/xcannesApi";
	import { CRYPTO_ICONS } from "@/components/dex/ExchangeSections/constants";
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

  const { handleUpsertCurrencyLine, handleRemoveCurrencyLine } =
    useCurrencyLinesActions({
      backendWalletAddress,
      currencyLineCode,
      currencyLineAllocatedRlusd,
      setCurrencyLineCode,
      setCurrencyLineAllocatedRlusd,
      upsertCurrencyLine,
      removeCurrencyLine,
    });

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

  const renderTokenRow = useCallback(
    (token) => (
      <WalletDashboardTokenRow
        key={token.key}
        token={token}
        tokenRowClass={layout.tokenRowClass}
        onClick={() => {
          setSelectedStatementToken(token);
          setShowCurrencyStatement(true);
        }}
      />
    ),
    [layout.tokenRowClass]
  );

  const {
    augmentedTokens,
    allocatedRlusdByCurrency,
    swapCurrencyOptions,
  } = useWalletTokens({ displayTokens, walletLines, currencyLines });
  const { handleDemoConvert } = useSwapConversion({
    isPreviewMode,
    effectiveIsConnected,
    backendWalletAddress,
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
    currencyLinesSummary,
    allocatedRlusdByCurrency,
    convertCurrencyAllocation,
    getTicker: xcannesApi.getTicker,
    getFxEod: xcannesApi.getFxEod,
  });

  const selectedSendToken =
    augmentedTokens.find((t) => t.key === sendAssetKey) ||
    augmentedTokens[0] ||
    null;

  const {
    qrScannerOpen,
    setQrScannerOpen,
    paymentRequestScannerOpen,
    setPaymentRequestScannerOpen,
    handleAddressScan,
    handlePaymentRequestScan,
  } = usePaymentRequestScanner({
    augmentedTokens,
    setSendDestination,
    setSendAmount,
    setSendAssetKey,
    setSendTab,
  });

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
          totalLabel={totalLabel}
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
            tokens={augmentedTokens}
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
        />
      </div>

      {/* Modales via Portal pour éviter les problèmes de z-index et overflow */}
      {typeof document !== 'undefined' && createPortal(
        <>
          <WalletDashboardSendModal
            open={activeAction === "send"}
            onClose={() => setActiveAction(null)}
            sendTab={sendTab}
            setSendTab={setSendTab}
            renderWalletMeta={renderWalletMeta}
            augmentedTokens={augmentedTokens}
            selectedSendToken={selectedSendToken}
            setSendAssetKey={setSendAssetKey}
            sendAmount={sendAmount}
            setSendAmount={setSendAmount}
            savedAddresses={savedAddresses}
            sendDestination={sendDestination}
            setSendDestination={setSendDestination}
            setQrScannerOpen={setQrScannerOpen}
            setPaymentRequestScannerOpen={setPaymentRequestScannerOpen}
            handleSendSubmit={handleSendSubmit}
            sendProcessing={sendProcessing}
          />

          <WalletDashboardReceiveModal
            open={activeAction === "receive"}
            onClose={() => setActiveAction(null)}
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
          />

          <WalletDashboardSwapModal
            open={activeAction === "swap"}
            onClose={() => setActiveAction(null)}
            renderWalletMeta={renderWalletMeta}
            isPreviewMode={isPreviewMode}
            effectiveIsConnected={effectiveIsConnected}
            refreshCurrencyLines={refreshCurrencyLines}
            currencyLinesLoading={currencyLinesLoading}
            currencyLinesError={currencyLinesError}
            currencyLinesSummary={currencyLinesSummary}
            currencyLines={currencyLines}
            handleRemoveCurrencyLine={handleRemoveCurrencyLine}
            swapCurrencyOptions={swapCurrencyOptions}
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
        cashModalTab={cashModalTab}
        setCashModalTab={setCashModalTab}
        renderWalletMeta={renderWalletMeta}
        walletAddress={effectiveWallet || ""}
      />

      <WalletDashboardTrustlineCurrencyModal
        open={activeAction === "trustlineCurrency" && !!editingTrustlineCurrency}
        onClose={handleCloseTrustlineEditor}
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
      
      {/* QR Scanner Modal for Payment Request */}
      <QRScanner
        isOpen={paymentRequestScannerOpen}
        onScan={handlePaymentRequestScan}
        onClose={() => setPaymentRequestScannerOpen(false)}
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
        effectiveWallet={effectiveWallet}
        isFullPageView={isFullPageView}
        statementVariant={statementVariant}
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
