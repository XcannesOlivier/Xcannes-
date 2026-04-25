import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { apiUrl } from '@/lib/runtimeConfig';
import TransactionProgressModal from './modals/TransactionProgressModal';

import { useWalletCurrencyLines } from './hooks/useWalletCurrencyLines';
import { useCurrencyLinesForm } from './hooks/useCurrencyLinesForm';
import { useCurrencyLinesActions } from './hooks/useCurrencyLinesActions';
import { useWalletTokens } from './hooks/useWalletTokens';
import { useRlusdPerUnitRates } from './hooks/useRlusdPerUnitRates';
import { useUsdTotalLabel } from './hooks/useUsdTotalLabel';
import { useWalletMeta } from './hooks/useWalletMeta';
import { lockBodyScroll } from '@/utils/bodyScrollLock';
import { useXrplConnectionIndicator } from './hooks/useXrplConnectionIndicator';
import { useWalletLabel } from './hooks/useWalletLabel';
import WalletDashboardFooter from './components/WalletDashboardFooter';
import WalletDashboardHeader from './components/WalletDashboardHeader';
import WalletDashboardActionRow from './components/WalletDashboardActionRow';
import WalletDashboardTokenList from './components/WalletDashboardTokenList';
import WalletDashboardTokenRow from './components/WalletDashboardTokenRow';
import { useWalletModalProps } from './hooks/useWalletModalProps';
import { useWalletActivation } from './hooks/useWalletActivation';
import { useWalletToast } from './hooks/useWalletToast';
import WalletDesktopModals from './desktop/WalletDesktopModals';
import WalletMobileModals from './mobile/WalletMobileModals';
import WalletToastOverlay from './components/WalletToastOverlay';
import { useWalletNavigation } from './hooks/useWalletNavigation';
import { useTokenDisplayLabels } from './hooks/useTokenDisplayLabels';
import WalletPendingPayreqs from './components/WalletPendingPayreqs';
import ReconciliationBanner from './components/ReconciliationBanner';
import { useTranslation } from 'next-i18next';
import xcannesApi from '@/lib/xcannesApi';
import { WALLET_LAYOUT, USD_STABLECOINS, WALLET_ACCEPTED_TOKENS } from './walletDashboardConfig';

// Sub-orchestrator hooks
import { useWalletSendOrchestrator } from './hooks/useWalletSendOrchestrator';
import { useWalletSwapOrchestrator } from './hooks/useWalletSwapOrchestrator';
import { useWalletIncomingToast } from './hooks/useWalletIncomingToast';
import { useWalletRecentActivityBanner } from './hooks/useWalletRecentActivityBanner';
import { useDesktopInlineFlags } from './hooks/useDesktopInlineFlags';
import { useAugmentedCurrencyLines } from './hooks/useAugmentedCurrencyLines';
import { useReconciliation } from './hooks/useReconciliation';
import { usePreferredCurrency } from './hooks/usePreferredCurrency';

function isAcceptedOnChainToken(currency) {
  const code = String(currency || '').toUpperCase();
  return WALLET_ACCEPTED_TOKENS.has(code);
}

const MOONPAY_ORIGIN_SUFFIX = '.moonpay.com';
const MOONPAY_ACTIVE_STORAGE_KEY = 'xcannes_moonpay_active';
const MOONPAY_BUY_RESUME_KEY = 'xcannes_moonpay_resume_buy_v1';
const MOONPAY_SELL_RESUME_KEY = 'xcannes_moonpay_resume_sell_v1';
const MOONPAY_AUTOOPEN_TAB_KEY = 'xcannes_moonpay_autoopen_tab';
const MOONPAY_SELL_FLOW_KEY = 'xcannes_moonpay_sell_flow_v1';
const MOONPAY_SELL_SOURCE_KEY = 'xcannes_moonpay_sell_source_v1';
const MOONPAY_WALLET_ADDRESS_KEY = 'xcannes_moonpay_wallet_address_v1';
const MOONPAY_BUY_RESUME_MAX_AGE_MS = 5 * 60 * 1000;

function normalizeMovementKind(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function resolveIncomingXrpAmount(movement) {
  const displayAmount = Number(movement?.displayAmount);
  if (Number.isFinite(displayAmount) && displayAmount > 0) return displayAmount;
  const amountXrp = Number(movement?.amountXrp);
  if (Number.isFinite(amountXrp) && amountXrp > 0) return amountXrp;
  const amount = Number(movement?.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  const amountRlusd = Number(movement?.amountRlusd);
  const fxRate = Number(movement?.fxRate);
  if (Number.isFinite(amountRlusd) && amountRlusd > 0 && Number.isFinite(fxRate) && fxRate > 0) {
    return amountRlusd / fxRate;
  }
  return Number.NaN;
}

function readMoonpayBuyResumeState(walletAddress) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage?.getItem(MOONPAY_BUY_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || parsed.kind !== 'buy') return null;
    if (!parsed.awaitingXrpSwap) return null;
    if (String(parsed.walletAddress || '') !== String(walletAddress || '')) return null;
    const ageMs = Date.now() - Number(parsed.ts || 0);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MOONPAY_BUY_RESUME_MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveMoonpayBuyResumeState(nextState) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.setItem(
      MOONPAY_BUY_RESUME_KEY,
      JSON.stringify({ ...nextState, v: 1, kind: 'buy', ts: Date.now() }),
    );
  } catch {
    // ignore
  }
}

function isTrustedMoonpayUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = String(url.hostname || '').toLowerCase();
    return host === 'moonpay.com' || host.endsWith(MOONPAY_ORIGIN_SUFFIX);
  } catch {
    return false;
  }
}

function clearMoonpaySellClientState() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.removeItem(MOONPAY_ACTIVE_STORAGE_KEY);
    window.sessionStorage?.removeItem(MOONPAY_AUTOOPEN_TAB_KEY);
    window.sessionStorage?.removeItem(MOONPAY_SELL_RESUME_KEY);
    window.sessionStorage?.removeItem(MOONPAY_SELL_FLOW_KEY);
    window.localStorage?.removeItem(MOONPAY_SELL_SOURCE_KEY);
    window.localStorage?.removeItem(MOONPAY_WALLET_ADDRESS_KEY);
    window.__XCANNES_MOONPAY_ACTIVE__ = false;
    window.dispatchEvent(new CustomEvent('xcannes:moonpay-active', { detail: { active: false } }));
  } catch {
    // ignore
  }
}

function returnToMoonpaySellWidget(returnUrl) {
  if (typeof window === 'undefined') return;
  clearMoonpaySellClientState();
  if (isTrustedMoonpayUrl(returnUrl)) {
    window.location.href = returnUrl;
    return;
  }
  if (window.history.length > 1) {
    window.history.back();
  }
}

export default function WalletDashboard({
  showDesktopStatement = false,
  qrSizingVariant = 'default',
  showMobileHomeLink = false,
  allowBackgroundScrollOnMobile = false,
  initialMoonpaySellRequest = null,
}) {
  const { t, i18n } = useTranslation('common');
  const locale = i18n?.language || 'en';
  const statementVariant = WALLET_LAYOUT.statementVariant;
  const showDesktopStatementPanel = Boolean(showDesktopStatement);

  // ── Core wallet context ────────────────────────────────────
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
    walletAddresses,
    switchWallet,
  } = useWallet();

  const { toasts, confirmState, toast, confirm, dismissToast, resolveConfirm } = useWalletToast();

  // ── Wallet switch (instant) ─────────────────────────────────
  const handleSwitchWallet = useCallback((addr) => {
    if (!addr || addr === wallet) return;
    switchWallet(addr);
  }, [wallet, switchWallet]);

  // ── Transaction progress modal state ────────────────────────
  const [txProgress, setTxProgress] = useState({
    visible: false,
    status: 'pending',
    actionLabel: '',
    actionKey: '',
    errorMessage: '',
    details: null,
  });

  const TX_ACTION_LABELS = useMemo(
    () => ({
      'wallet:convert': t('ui_tx_label_conversion', 'Conversion'),
      'wallet:swap': t('ui_tx_label_swap', 'Swap XRPL'),
      'wallet:send': t('ui_tx_label_payment', 'Paiement'),
      'moonpay:sell': t('ui_tx_label_moonpay_sell', 'Envoi MoonPay'),
      'wallet:reconcile': t('ui_tx_label_reconciliation', 'Réconciliation'),
      'wallet:activate_xrp': t('ui_tx_label_activation', 'Activation'),
      'wallet:setup': t('ui_tx_label_setup', 'Configuration'),
    }),
    [t],
  );

  // ── UI state (needs to exist before callbacks deps) ───────
  const [activeAction, setActiveAction] = useState(null);

  const handleTxProgressClose = useCallback(() => {
    let shouldCloseAction = false;
    let shouldReturnToMoonpay = false;
    let moonpayReturnUrl = '';

    setTxProgress(prev => {
      if (prev.status === 'success') {
        shouldCloseAction =
          prev.actionKey === 'wallet:convert' || prev.actionKey === 'wallet:send' || prev.actionKey === 'moonpay:sell';
        shouldReturnToMoonpay = prev.actionKey === 'moonpay:sell';
        moonpayReturnUrl = String(prev.details?.moonpayReturnUrl || '').trim();
      }
      return { ...prev, visible: false };
    });
    if (shouldCloseAction) {
      setActiveAction(null);
    }
    if (shouldReturnToMoonpay) {
      returnToMoonpaySellWidget(moonpayReturnUrl);
    }
  }, [setActiveAction]);

  /**
   * Poll XRPL tx-status endpoint until the transaction is validated
   * on-ledger, or give up after ~12 s.
   */
  const waitForTxValidation = useCallback(async hash => {
    const MAX_POLLS = 12;
    const INTERVAL = 1000; // 1 s
    for (let i = 0; i < MAX_POLLS; i++) {
      try {
        const res = await fetch(apiUrl(`/wallet/tx-status?hash=${encodeURIComponent(hash)}`));
        if (res.ok) {
          const data = await res.json();
          if (data.validated) return true;
        }
      } catch {
        /* network hiccup — keep polling */
      }
      await new Promise(r => setTimeout(r, INTERVAL));
    }
    return false; // timeout — show success anyway (tesSUCCESS was received)
  }, []);

  /**
   * Wrapper around signTransaction — Xumm-style progress overlay
   * AFTER Face ID validation (post-sign). Flow:
   *   1. signTransaction() → QR → Face ID → XRPL submit (no modal yet)
   *   2. signed:true → show "pending" with 3 blinking dots
   *   3. poll XRPL for validated:true on the tx hash (non-blocking)
   *   4. validated → "Validé" + confetti
   *
   * IMPORTANT: polling runs in background — does NOT block the return.
   * Each hook's post-sign logic (toast, form reset, refreshBalance) runs immediately.
   */
  const signTransactionWithProgress = useCallback(
    async (txjson, options) => {
      const actionKey = options?.action || '';
      const label = TX_ACTION_LABELS[actionKey] || t('ui_tx_label_default', 'Transaction');

      try {
        const result = await signTransaction(txjson, options);

        if (result?.signed) {
          // Show "en cours" with 3 blinking dots
          setTxProgress({
            visible: true,
            status: 'pending',
            actionLabel: label,
            actionKey: actionKey,
            errorMessage: '',
            details: options?.progressDetails || null,
          });

          // Fire-and-forget: poll XRPL then switch to success
          const txHash = result.hash || '';
          (async () => {
            if (txHash) {
              await waitForTxValidation(txHash);
            }
            setTxProgress(prev => (prev.visible ? { ...prev, status: 'success' } : prev));
          })();
        } else if (result?.rejected) {
          // XRPL rejected the transaction (tem*, tef*, tel*)
          setTxProgress({
            visible: true,
            status: 'error',
            actionLabel: label,
            actionKey: actionKey,
            errorMessage: result.engineMessage || result.engineResult || t('ui_tx_rejected', 'Transaction rejetée'),
            details: options?.progressDetails || null,
          });
        }
        // If result is null (cancelled/expired), don't show anything

        return result;
      } catch (err) {
        setTxProgress({
          visible: true,
          status: 'error',
          actionLabel: label,
          actionKey: actionKey,
          errorMessage: err?.message || String(err),
          details: options?.progressDetails || null,
        });
        throw err;
      }
    },
    [signTransaction, TX_ACTION_LABELS, t, waitForTxValidation],
  );

  // ── Token computation ──────────────────────────────────────
  const baseTokens = useMemo(
    () => (balance?.tokens || []).filter(tok => isAcceptedOnChainToken(tok?.currency)),
    [balance?.tokens],
  );
  const hasOnChainRlusd = (baseTokens || []).some(tok => String(tok?.currency || '').toUpperCase() === 'RLUSD');
  const xrpAmount = parseFloat(balance?.xrp || 0) || 0;

  const isStablecoin = useCallback(currency => USD_STABLECOINS.includes(String(currency || '').toUpperCase()), []);
  const stableUsd = useMemo(
    () =>
      baseTokens
        .filter(tok => isStablecoin(tok.currency))
        .reduce((sum, tok) => {
          const v = parseFloat(tok.value);
          return sum + (Number.isFinite(v) ? v : 0);
        }, 0),
    [baseTokens, isStablecoin],
  );
  const displayTokens = useMemo(
    () => [{ key: 'XRP', currency: 'XRP', issuer: 'Native', value: xrpAmount }],
    [xrpAmount],
  );

  // ── UI state ───────────────────────────────────────────────
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showActivationRequestModal, setShowActivationRequestModal] = useState(false);
  const [showGlobalStatement, setShowGlobalStatement] = useState(false);
  const [showCurrencyStatement, setShowCurrencyStatement] = useState(false);
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);
  const [desktopSettingsPage, setDesktopSettingsPage] = useState(null);
  const [selectedStatementToken, setSelectedStatementToken] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDesktopPanel, setIsDesktopPanel] = useState(false);
  const desktopDefaultActionSetRef = useRef(false);
  const [recentActivityMessage, setRecentActivityMessage] = useState('');
  const recentActivityTimerRef = useRef(null);

  // ── Desktop panel media query ──────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!showDesktopStatementPanel) {
      setIsDesktopPanel(false);
      desktopDefaultActionSetRef.current = false;
      return;
    }
    const media = window.matchMedia('(min-width: 1024px)');
    const handleChange = () => setIsDesktopPanel(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [showDesktopStatementPanel]);

  useEffect(() => {
    if (isDesktopPanel) return;
    setDesktopSettingsPage(null);
  }, [isDesktopPanel]);

  // ── Currency lines (backend) — called first so label can feed useWalletLabel
  const backendWalletAddress = wallet || null;

  const {
    lines: currencyLines,
    summary: currencyLinesSummary,
    reconciliation: reconciliationData,
    walletLabel: clWalletLabel,
    defaultCurrency: clDefaultCurrency,
    loading: currencyLinesLoading,
    error: currencyLinesError,
    initialReady: currencyLinesReady,
    refresh: refreshCurrencyLines,
    upsertCurrencyLine,
  } = useWalletCurrencyLines(backendWalletAddress);

  // ── Wallet label (fed by currency-lines, no extra XRPL call) ──
  const {
    walletLabel,
    isWalletLabelLocked,
    defaultCurrency,
    walletHeaderToast,
    flashWalletHeaderToast,
    loadWalletLabel,
  } = useWalletLabel({
    walletAddress: wallet,
    isConnected,
    defaultLabel: t('nav_wallet', 'Wallet'),
    externalLabel: clWalletLabel,
    externalDefaultCurrency: clDefaultCurrency,
    onRefresh: refreshCurrencyLines,
  });
  const defaultWalletLabel = t('nav_wallet', 'Wallet');
  const walletHasCustomLabel = Boolean(
    String(walletLabel || '').trim() && String(walletLabel || '').trim() !== defaultWalletLabel,
  );
  const { renderWalletMeta } = useWalletMeta({
    walletAddress: wallet,
    walletLabel,
    hideAddress: true,
    labelPrefix: t('ui_current_account_prefix', 'Compte actuel:'),
  });

  // ── Preferred currency ─────────────────────────────────────
  const {
    preferredCurrency,
    setPreferredCurrency,
    topCurrencies: prefTopCurrencies,
    fawazCurrencies: prefFawazCurrencies,
    fawazLoading: prefFawazLoading,
    loadFawazCurrencies: prefLoadFawazCurrencies,
  } = usePreferredCurrency({
    defaultCurrency,
  });

  const { currencyLineCode, setCurrencyLineCode, currencyLineAllocatedRlusd, setCurrencyLineAllocatedRlusd } =
    useCurrencyLinesForm();

  const { handleUpsertCurrencyLine: handleUpsertCurrencyLineReal } = useCurrencyLinesActions({
    backendWalletAddress,
    currencyLineCode,
    currencyLineAllocatedRlusd,
    setCurrencyLineCode,
    setCurrencyLineAllocatedRlusd,
    upsertCurrencyLine,
    toast,
  });

  // ── Reconciliation (external spend detection) ──────────────
  const reconciliation = useReconciliation({
    reconciliation: reconciliationData,
    address: wallet,
    signTransaction: signTransactionWithProgress,
    onComplete: () => {
      refreshBalance();
      refreshCurrencyLines();
    },
  });

  // ── Augmented currency lines (defaults + sorting + deficit) ─
  const { augmentedCurrencyLines, currencyLineCodes } = useAugmentedCurrencyLines({
    currencyLines,
    currencyLinesSummary,
    backendWalletAddress,
    refreshCurrencyLines,
  });

  // ── Tokens (augmented with currency lines) ─────────────────
  const { augmentedTokens, allocatedRlusdByCurrency, swapCurrencyOptions } = useWalletTokens({
    displayTokens,
    currencyLines: augmentedCurrencyLines,
  });

  const selectableTokens = useMemo(
    () =>
      (augmentedTokens || []).filter(token => {
        const code = String(token?.currency || '')
          .trim()
          .toUpperCase();
        return code !== 'XRP' && code !== 'RLUSD';
      }),
    [augmentedTokens],
  );
  const hasRlusdTrustline = hasOnChainRlusd;

  // ===== SUB-ORCHESTRATORS ===================================
  // swapState MUST be created before useRlusdPerUnitRates so that
  // the currently selected swap currencies (which may not yet exist
  // as wallet lines) are included in the rate-fetching codes.

  const swapState = useWalletSwapOrchestrator({
    isConnected,
    backendWalletAddress,
    wallet,
    signTransaction: signTransactionWithProgress,
    refreshBalance,
    hasOnChainRlusd,
    swapCurrencyOptions,
    currencyLinesSummary,
    allocatedRlusdByCurrency,
    refreshCurrencyLines,
    toast,
  });
  const { setCashModalTab } = swapState;

  // Auto-resume MoonPay after a reconnect (iOS Apple flows can background the page).
  // If a MoonPay iframe was active before the disconnect, reopen the Cash modal
  // and let the MoonPay modal restore/generate the widget URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isConnected) return;
    if (activeAction) return;
    // When the wallet is rendered inside a third-party iframe (ex: MoonPay confirm step),
    // never auto-open the Cash modal: it would duplicate the UI inside the widget.
    if (window.self !== window.top) return;
    try {
      const tab = window.sessionStorage?.getItem('xcannes_moonpay_autoopen_tab');
      if (tab !== 'buy' && tab !== 'sell') return;
      setCashModalTab(tab);
      setActiveAction('cash');
      window.sessionStorage?.removeItem('xcannes_moonpay_autoopen_tab');
    } catch {
      // Ignore
    }
  }, [activeAction, isConnected, setActiveAction, setCashModalTab]);

  // Augment currency line codes with whatever the user has currently
  // selected in the swap modal — this ensures we fetch rates for new
  // currencies that are not yet in the wallet.
  const rateCodes = useMemo(() => {
    const codes = new Set(currencyLineCodes || []);
    const base = String(swapState.convertBaseCurrency || '')
      .trim()
      .toUpperCase();
    const quote = String(swapState.convertQuoteCurrency || '')
      .trim()
      .toUpperCase();
    if (base && base !== 'USD' && base !== 'RLUSD' && base !== 'XRP') codes.add(base);
    if (quote && quote !== 'USD' && quote !== 'RLUSD' && quote !== 'XRP') codes.add(quote);
    const pref = String(preferredCurrency || '')
      .trim()
      .toUpperCase();
    if (pref && pref !== 'USD' && pref !== 'RLUSD' && pref !== 'XRP') codes.add(pref);
    return Array.from(codes);
  }, [currencyLineCodes, swapState.convertBaseCurrency, swapState.convertQuoteCurrency, preferredCurrency]);

  const { usdPerUnit: rlusdPerUnitRates, sourceByCode: rlusdPerUnitSources } = useRlusdPerUnitRates(rateCodes);

  const sendState = useWalletSendOrchestrator({
    wallet,
    isConnected,
    isDesktopPanel,
    backendWalletAddress,
    signTransaction: signTransactionWithProgress,
    hasOnChainRlusd,
    augmentedTokens,
    selectableTokens,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    allocatedRlusdByCurrency,
    closeQrModal,
    toast,
    confirm,
    setActiveAction,
  });
  const { startMoonpaySellRequest } = sendState;

  const handledMoonpaySellRequestRef = useRef('');
  const moonpayBuyAutoOpenRef = useRef('');

  useEffect(() => {
    const request = initialMoonpaySellRequest;
    if (!request?.depositWalletAddress) return;

    const requestKey =
      String(request?.flowId || '').trim() ||
      String(request?.transactionId || '').trim() ||
      [request.depositWalletAddress, request.baseCurrencyCode, request.baseCurrencyAmount]
        .map(value => String(value || '').trim())
        .join(':');

    if (!requestKey) return;
    if (handledMoonpaySellRequestRef.current === requestKey) return;

    const started = startMoonpaySellRequest?.(request);
    if (!started) return;

    handledMoonpaySellRequestRef.current = requestKey;
    setActiveAction('send');
  }, [initialMoonpaySellRequest, setActiveAction, startMoonpaySellRequest]);

  useWalletIncomingToast({ backendWalletAddress, flashWalletHeaderToast });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isConnected || !wallet) return;
    if (window.self !== window.top) return;

    const resume = readMoonpayBuyResumeState(wallet);
    if (!resume) {
      moonpayBuyAutoOpenRef.current = '';
      return;
    }

    const shouldAutoOpen =
      !activeAction &&
      Number.isFinite(Number(resume.detectedXrpAmount)) &&
      Number(resume.detectedXrpAmount) > 0 &&
      resume.preparedInboundSwap?.txjson;
    if (!shouldAutoOpen) return;

    const resumeKey =
      String(resume.detectedXrpTxHash || '').trim() ||
      String(resume.flowId || '').trim() ||
      String(resume.ts || '').trim();
    if (!resumeKey || moonpayBuyAutoOpenRef.current === resumeKey) return;

    moonpayBuyAutoOpenRef.current = resumeKey;
    setCashModalTab('buy');
    setActiveAction('cash');
  }, [activeAction, isConnected, setActiveAction, setCashModalTab, wallet]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isConnected || !wallet) return;
    if (activeAction === 'cash') return;

    const resume = readMoonpayBuyResumeState(wallet);
    if (!resume) return;
    if (
      Number.isFinite(Number(resume.detectedXrpAmount)) &&
      Number(resume.detectedXrpAmount) > 0 &&
      resume.preparedInboundSwap?.txjson
    ) {
      return;
    }

    let cancelled = false;
    const seenMovementIdRef = { current: '' };

    const pollMoonpayBuySettlement = async () => {
      if (cancelled) return;
      const freshResume = readMoonpayBuyResumeState(wallet);
      if (!freshResume) return;
      if (
        Number.isFinite(Number(freshResume.detectedXrpAmount)) &&
        Number(freshResume.detectedXrpAmount) > 0 &&
        freshResume.preparedInboundSwap?.txjson
      ) {
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set('address', String(wallet || ''));
        params.set('limit', '10');
        params.set('source', 'onchain');
        const response = await fetch(apiUrl(`/wallet/statement?${params.toString()}`));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;

        const movements = Array.isArray(data?.movements) ? data.movements : [];
        const incomingXrp = movements.find(movement => {
          const kind = normalizeMovementKind(movement?.kind);
          if (kind !== 'PAYMENT_IN' && kind !== 'XRPL_PAYMENT_IN') return false;
          const currencyCode = String(
            movement?.toCurrencyCode || movement?.fromCurrencyCode || movement?.displayCurrency || '',
          )
            .trim()
            .toUpperCase();
          if (currencyCode !== 'XRP') return false;
          const movementId = String(movement?.movementId || movement?._id || movement?.txHash || '').trim();
          if (movementId && movementId === seenMovementIdRef.current) return false;
          const createdAtMs = movement?.createdAt ? new Date(movement.createdAt).getTime() : Number.NaN;
          const awaitingXrpSince = Number(freshResume.awaitingXrpSince);
          if (Number.isFinite(awaitingXrpSince) && Number.isFinite(createdAtMs) && createdAtMs < awaitingXrpSince) {
            return false;
          }
          return Number.isFinite(resolveIncomingXrpAmount(movement));
        });

        if (!incomingXrp) return;

        const movementId = String(incomingXrp?.movementId || incomingXrp?._id || incomingXrp?.txHash || '').trim();
        if (movementId) {
          seenMovementIdRef.current = movementId;
        }

        const detectedAmount = resolveIncomingXrpAmount(incomingXrp);
        if (!Number.isFinite(detectedAmount) || detectedAmount <= 0) return;

        const preparedInboundSwap = await xcannesApi.prepareRlusdXrpSwap({
          address: wallet,
          direction: 'XRP_TO_RLUSD',
          amountXrp: detectedAmount,
        });
        if (cancelled) return;

        const nextResume = {
          ...freshResume,
          detectedXrpAmount: detectedAmount,
          detectedXrpTxHash: String(incomingXrp?.txHash || '').trim(),
          preparedInboundSwap,
        };
        saveMoonpayBuyResumeState(nextResume);

        if (!activeAction && window.self === window.top) {
          const resumeKey =
            String(nextResume.detectedXrpTxHash || '').trim() ||
            String(nextResume.flowId || '').trim() ||
            String(Date.now());
          moonpayBuyAutoOpenRef.current = resumeKey;
          setCashModalTab('buy');
          setActiveAction('cash');
        }
      } catch {
        // ignore transient partner/XRPL errors; next poll retries
      }
    };

    pollMoonpayBuySettlement();
    const intervalId = window.setInterval(pollMoonpayBuySettlement, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeAction, isConnected, setActiveAction, setCashModalTab, wallet]);

  const flashRecentActivity = useCallback(message => {
    const text = String(message || '').trim();
    if (!text) return;
    setRecentActivityMessage(text);
    if (recentActivityTimerRef.current) {
      window.clearTimeout(recentActivityTimerRef.current);
      recentActivityTimerRef.current = null;
    }
    recentActivityTimerRef.current = window.setTimeout(() => {
      setRecentActivityMessage('');
      recentActivityTimerRef.current = null;
    }, 10000);
  }, []);

  useEffect(() => {
    return () => {
      if (recentActivityTimerRef.current) {
        window.clearTimeout(recentActivityTimerRef.current);
        recentActivityTimerRef.current = null;
      }
    };
  }, []);

  useWalletRecentActivityBanner({
    backendWalletAddress,
    rlusdPerUnitRates,
    savedAddresses: sendState?.savedAddresses || [],
    onActivity: ({ message }) => flashRecentActivity(message),
  });

  // ── Reset previous action state on desktop inline switch ──
  const prevActionRef = useRef(null);
  const { resetSendForm, resetReceiveForm } = sendState;
  const { resetSwapForm, resetCashForm } = swapState;
  useEffect(() => {
    const prev = prevActionRef.current;
    prevActionRef.current = activeAction;
    if (prev && prev !== activeAction) {
      if (prev === 'send') resetSendForm?.();
      if (prev === 'receive') resetReceiveForm?.();
      if (prev === 'swap') resetSwapForm?.();
      if (prev === 'cash') resetCashForm?.();
    }
  }, [activeAction, resetSendForm, resetReceiveForm, resetSwapForm, resetCashForm]);

  // ── Token display labels ───────────────────────────────────
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

  // ── Statement balance override (USD = unallocated RLUSD) ─────────
  const statementBalance = useMemo(() => {
    const token = selectedStatementToken;
    if (!token) return null;
    const code = String(token.currency || '')
      .trim()
      .toUpperCase();
    if (!code) return null;

    // USD statement shows the unallocated RLUSD pool (1:1).
    if (code === 'USD') {
      const unallocated = Number(currencyLinesSummary?.unallocatedRlusd);
      return Number.isFinite(unallocated) ? unallocated : null;
    }

    // For other currency lines (trustline-only), convert allocated RLUSD → units.
    if (token.isTrustlineOnly) {
      const allocated = allocatedRlusdByCurrency?.get?.(code);
      if (!Number.isFinite(allocated)) return null;
      const rawRate = code === 'USD' || code === 'RLUSD' ? 1 : Number(rlusdPerUnitRates?.[code]);
      if (!Number.isFinite(rawRate) || rawRate <= 0) return allocated;
      return allocated / rawRate;
    }

    return null;
  }, [selectedStatementToken, currencyLinesSummary, allocatedRlusdByCurrency, rlusdPerUnitRates]);

  // ── Activation ─────────────────────────────────────────────
  const {
    handleInstallRequiredTrustline,
    handleRlusdSetupConfirm,
    handleOpenActivationModal,
    handleActivationRequestFromThirdParty,
    handleActivationBuyViaMoonpay,
    handleActivationSendFromWallet,
  } = useWalletActivation({
    isConnected,
    wallet,
    signTransaction: signTransactionWithProgress,
    refreshBalance,
    loadWalletLabel,
    hasRlusdTrustline,
    toast,
    confirm,
    closeInlineQr: sendState.closeInlineQr,
    setWalletInfoOpen,
    setShowActivationModal,
    setShowActivationRequestModal,
    setCashBuyPrefill: swapState.setCashBuyPrefill,
    setCashModalTab: swapState.setCashModalTab,
    setActiveAction,
  });

  // ── Navigation ─────────────────────────────────────────────
  const {
    handleActivateCurrencyLine,
    handleUpsertCurrencyLine,
    handleAction,
    handleOpenCurrencyStatement,
    handleOpenInfo,
    handleOpenSecurity,
    handleOpenHelp,
    handleOpenTerms,
    handleOpenGlobalStatement,
    handleCopyAddress,
    handleRefreshWallet,
  } = useWalletNavigation({
    wallet,
    isConnected,
    backendWalletAddress,
    isDesktopPanel,
    isConnecting,
    isRefreshing,
    setIsRefreshing,
    refreshBalance,
    currencyLines,
    handleUpsertCurrencyLineReal,
    activeAction,
    closeInlineQr: sendState.closeInlineQr,
    setActiveAction,
    setWalletInfoOpen,
    setDesktopSettingsPage,
    setSwapDefaultView: swapState.setSwapDefaultView,
    setSwapLockedView: swapState.setSwapLockedView,
    setCashBuyPrefill: swapState.setCashBuyPrefill,
    setShowActivationModal,
    setShowActivationRequestModal,
    setShowGlobalStatement,
    setShowCurrencyStatement,
    setSelectedStatementToken,
    setConvertBaseCurrency: swapState.setConvertBaseCurrency,
    setConvertQuoteCurrency: swapState.setConvertQuoteCurrency,
    setConvertAmount: swapState.setConvertAmount,
    flashWalletHeaderToast,
    t,
    toast,
  });

  // ── Token row renderer ─────────────────────────────────────
  const renderTokenRow = useCallback(
    token => (
      <WalletDashboardTokenRow key={token.key} token={token} onClick={() => handleOpenCurrencyStatement(token)} />
    ),
    [handleOpenCurrencyStatement],
  );

  const handleOpenXrplActivity = useCallback(() => {
    const xrpToken = (augmentedTokens || []).find(tok => String(tok?.currency || '').toUpperCase() === 'XRP') || {
      currency: 'XRP',
      issuer: null,
      value: 0,
    };
    handleOpenCurrencyStatement(xrpToken);
  }, [augmentedTokens, handleOpenCurrencyStatement]);

  // ── Total label ────────────────────────────────────────────
  const { usdRates, totalLabel, totalInUsd } = useUsdTotalLabel({
    augmentedTokens,
    isPreviewMode: false,
    stableUsd,
    demoTotalUsd: 0,
    isStablecoin,
    fiatRates: rlusdPerUnitRates,
    rlusdOnChain: currencyLinesSummary?.rlusdOnChain ?? null,
    preferredCurrency,
    locale,
  });

  const xrplConnectionIndicator = useXrplConnectionIndicator({
    isPreviewMode: false,
    isConnecting,
    isConnected,
  });

  // ── Desktop: default action on mount ───────────────────────
  useEffect(() => {
    if (!isDesktopPanel) {
      desktopDefaultActionSetRef.current = false;
      return;
    }
    if (desktopDefaultActionSetRef.current) return;
    if (activeAction || showActivationModal || showActivationRequestModal || walletInfoOpen || showCurrencyStatement) {
      return;
    }
    swapState.setSwapDefaultView('convert');
    swapState.setSwapLockedView(null);
    setActiveAction('swap');
    desktopDefaultActionSetRef.current = true;
  }, [
    activeAction,
    isDesktopPanel,
    showActivationModal,
    showActivationRequestModal,
    showCurrencyStatement,
    walletInfoOpen,
    swapState,
  ]);

  // ── Desktop inline flags ───────────────────────────────────
  const inlineFlags = useDesktopInlineFlags({
    isDesktopPanel,
    qrScannerOpen: sendState.qrScannerOpen,
    activeAction,
    sendPaymentRequest: sendState.sendPaymentRequest,
    showActivationModal,
    showActivationRequestModal,
    walletInfoOpen,
    desktopSettingsPage,
    showCurrencyStatement,
    selectedStatementToken,
  });

  // ── Modal props (shared desktop & mobile) ──────────────────
  const modalProps = useWalletModalProps({
    wallet,
    walletAddresses,
    switchWallet,
    isConnected,
    isWalletActivated,
    hasOnChainRlusd,
    walletLabel,
    walletHasCustomLabel,
    renderWalletMeta,
    signTransaction: signTransactionWithProgress,
    connect,
    activeAction,
    setActiveAction,
    qrSizingVariant,
    selectableTokens,
    augmentedTokens,
    selectLabelByAssetKey,
    selectLabelRightByAssetKey,
    selectIconByAssetKey,
    selectLabelMobileByAssetKey,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    handleCopyAddress,
    handleInstallRequiredTrustline,
    handleActivateCurrencyLine,
    effectiveRefreshCurrencyLines: refreshCurrencyLines,
    effectiveCurrencyLinesLoading: currencyLinesLoading,
    effectiveCurrencyLinesError: currencyLinesError,
    effectiveCurrencyLinesSummary: currencyLinesSummary,
    effectiveCurrencyLines: augmentedCurrencyLines,
    currencyLineCode,
    setCurrencyLineCode,
    currencyLineAllocatedRlusd,
    setCurrencyLineAllocatedRlusd,
    handleUpsertCurrencyLine,
    showActivationModal,
    setShowActivationModal,
    handleActivationSendFromWallet,
    handleActivationRequestFromThirdParty,
    handleActivationBuyViaMoonpay,
    showActivationRequestModal,
    setShowActivationRequestModal,
    handleRlusdSetupConfirm,
    walletInfoOpen,
    setWalletInfoOpen,
    displayTokensWithCurrencyLines,
    backendWalletAddress,
    isFullPageView: true,
    statementVariant,
    usdRates,
    preferredCurrency,
    showGlobalStatement,
    setShowGlobalStatement,
    showCurrencyStatement,
    setShowCurrencyStatement,
    selectedStatementToken,
    setSelectedStatementToken,
    statementBalance,
    toast,
    // Spread sub-orchestrator state (keys match useWalletModalProps params)
    ...sendState,
    ...swapState,
  });

  // ── Body scroll lock ───────────────────────────────────────
  const allowBackgroundScrollForStatements = !isDesktopPanel && (showGlobalStatement || showCurrencyStatement);
  const allowBackgroundScrollForActions =
    !isDesktopPanel &&
    (activeAction === 'cash' ||
      activeAction === 'cashChoice' ||
      activeAction === 'sendChoice' ||
      activeAction === 'cashUsdSwapOut' ||
      activeAction === 'cashUsdSwapIn' ||
      (activeAction === 'swap' && swapState.swapLockedView === 'lines') ||
      (activeAction === 'send' && sendState.sendTab === 'payreq'));
  const lockForActiveAction = Boolean(activeAction && !allowBackgroundScrollForActions);
  const lockForStatements = Boolean(
    (showGlobalStatement || showCurrencyStatement) && !allowBackgroundScrollForStatements,
  );
  const shouldLockBodyScroll =
    !isDesktopPanel &&
    !allowBackgroundScrollOnMobile &&
    Boolean(
      lockForActiveAction ||
      showActivationModal ||
      showActivationRequestModal ||
      walletInfoOpen ||
      sendState.qrScannerOpen ||
      sendState.showSaveAddressPrompt ||
      lockForStatements,
    );

  useEffect(() => {
    if (!shouldLockBodyScroll) return;
    return lockBodyScroll();
  }, [shouldLockBodyScroll]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <>
      <div
        className={`bg-xcannes-surface-demo h-full min-h-0 overflow-hidden ${
          showDesktopStatementPanel
            ? 'flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,600px)] lg:gap-0'
            : 'flex flex-col'
        }`}
      >
        <div className="flex flex-col min-h-0">
          {/* Header */}
          <WalletDashboardHeader
            isConnected={isConnected}
            wallet={wallet}
            totalLabel={totalLabel}
            totalInUsd={totalInUsd}
            xrplConnectionIndicator={xrplConnectionIndicator}
            walletLabel={walletLabel}
            walletHeaderToast={walletHeaderToast}
            onCopyAddress={handleCopyAddress}
            onRefreshWallet={handleRefreshWallet}
            isConnecting={isConnecting}
            isRefreshing={isRefreshing}
            isWalletLabelLocked={isWalletLabelLocked}
            showMobileHomeLink={showMobileHomeLink}
            walletAddresses={walletAddresses}
            onSwitchWallet={handleSwitchWallet}
            isDesktopPanel={isDesktopPanel}
            onOpenInfo={handleOpenInfo}
            onOpenXrplActivity={handleOpenXrplActivity}
            onOpenSecurity={handleOpenSecurity}
            onOpenHelp={handleOpenHelp}
            onOpenTerms={handleOpenTerms}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            onActivateWallet={handleOpenActivationModal}
            onConfirmSetup={handleRlusdSetupConfirm}
            activeAction={activeAction}
            preferredCurrency={preferredCurrency}
            topCurrencies={prefTopCurrencies}
            fawazCurrencies={prefFawazCurrencies}
            fawazLoading={prefFawazLoading}
            onLoadFawazCurrencies={prefLoadFawazCurrencies}
            onPreferredCurrencyChange={setPreferredCurrency}
          />

          {/* Action row: Send / Receive / Exchange / Buy */}
          <WalletDashboardActionRow onAction={handleAction} />

          {/* Reconciliation banner (external RLUSD spend detected) */}
          <ReconciliationBanner
            visible={reconciliation.visible}
            deficit={reconciliation.deficit}
            operationsSummary={reconciliation.operationsSummary}
            submitting={reconciliation.submitting}
            error={reconciliation.error}
            txHash={reconciliation.txHash}
            onConfirm={reconciliation.confirm}
            onDismiss={reconciliation.dismiss}
          />

          {/* Pending payment requests */}
          {sendState.pendingCount > 0 ? (
            <div className="px-1">
              <WalletPendingPayreqs
                pendingPayreqs={sendState.pendingPayreqs}
                onResume={sendState.handleResumePayreq}
                onRemove={sendState.removePayreq}
              />
            </div>
          ) : null}

          {/* Token list */}
          <div className="flex-1 flex flex-col min-h-0">
            <WalletDashboardTokenList
              tokens={tokenListTokens}
              renderTokenRow={renderTokenRow}
              headerTitle={
                <div className="w-full flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleOpenGlobalStatement}
                    className="shrink-0 inline-flex items-center gap-2 text-[14px] md:text-[13px] font-normal text-white/65 hover:text-white/90 transition-colors"
                    title={
                      recentActivityMessage
                        ? recentActivityMessage
                        : t('ui_open_statement', 'Ouvrir le relevé des transactions')
                    }
                    aria-label={t('ui_open_statement', 'Ouvrir le relevé des transactions')}
                  >
                    <span>{t('ui_consult_global_statement_3b89f4a7a2', 'Historique')}</span>
                    <span className="text-white/35 text-base md:text-lg leading-none">›</span>
                  </button>
                </div>
              }
              className="touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            />
          </div>

          <WalletDashboardFooter
            onScan={
              !isDesktopPanel
                ? () => {
                    sendState.setQrScannerOpen?.(true);
                  }
                : null
            }
          />
          {!isDesktopPanel ? (
            <WalletMobileModals
              {...modalProps}
              signTransaction={signTransactionWithProgress}
              showSaveAddressPrompt={sendState.showSaveAddressPrompt}
              setShowSaveAddressPrompt={sendState.setShowSaveAddressPrompt}
              addressToSave={sendState.addressToSave}
              setAddressToSave={sendState.setAddressToSave}
              saveAddress={sendState.saveAddress}
            />
          ) : null}
        </div>

        {isDesktopPanel ? (
          <WalletDesktopModals
            {...inlineFlags}
            {...modalProps}
            signTransaction={signTransactionWithProgress}
            setDesktopSettingsPage={setDesktopSettingsPage}
          />
        ) : null}
      </div>
      <TransactionProgressModal
        visible={txProgress.visible}
        status={txProgress.status}
        actionLabel={txProgress.actionLabel}
        actionKey={txProgress.actionKey}
        errorMessage={txProgress.errorMessage}
        details={txProgress.details}
        autoCloseMs={
          txProgress.actionKey === 'wallet:convert'
            ? 1600
            : txProgress.actionKey === 'wallet:send' || txProgress.actionKey === 'moonpay:sell'
              ? 2000
              : null
        }
        onClose={handleTxProgressClose}
      />
      <WalletToastOverlay
        toasts={toasts}
        confirmState={confirmState}
        dismissToast={dismissToast}
        resolveConfirm={resolveConfirm}
      />
    </>
  );
}
