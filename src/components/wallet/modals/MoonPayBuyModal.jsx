import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XCircleIcon, CheckCircleIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import ModalSelect from '@/components/ui/ModalSelect';
import { useTranslation } from 'next-i18next';
import { CRYPTO_ICONS } from '@/utils/marketConstants';
import { useModalTransition } from '@/hooks/useModalTransition';
import { isIOSDevice } from '@/utils/deviceDetect';
import xcannesApi from '@/lib/xcannesApi';
import { apiUrl } from '@/lib/runtimeConfig';
import { getCurrencyFlag, formatAmountWithSymbol } from '../walletDashboardConfig';
import { getCurrencyDescription } from '@/utils/currencyDescriptions';
import { modalSelectButtonCls, modalSelectListCls } from './walletModalTokens';

const fmtAmountRight = (raw) => {
  if (!raw) return null;
  const str = String(raw);
  const i = str.lastIndexOf(' ');
  if (i < 0) return <span>{str}</span>;
  return <span className="inline-flex items-baseline gap-[3px]">{str.slice(0, i)}<span className="text-[0.78em]">{str.slice(i + 1)}</span></span>;
};

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';
const MOONPAY_ORIGIN_SUFFIX = '.moonpay.com';
const MOONPAY_ACTIVE_STORAGE_KEY = 'xcannes_moonpay_active';
const MOONPAY_BUY_RESUME_KEY = 'xcannes_moonpay_resume_buy_v1';
const MOONPAY_AUTOOPEN_TAB_KEY = 'xcannes_moonpay_autoopen_tab';
const MOONPAY_BUY_FLOW_KEY = 'xcannes_moonpay_buy_flow_v1';
const MOONPAY_WALLET_ADDRESS_KEY = 'xcannes_moonpay_wallet_address_v1';
const MOONPAY_RESUME_MAX_AGE_MS = 5 * 60 * 1000;
const MOONPAY_FLOW_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const MOONPAY_TAG_XRP = Number.parseInt(process.env.NEXT_PUBLIC_MOONPAY_TAG_XRP || '589', 10);
const MOONPAY_TAG_RLUSD = Number.parseInt(process.env.NEXT_PUBLIC_MOONPAY_TAG_RLUSD || '590', 10);

const resolveMoonpayTag = currencyCode => {
  const code = String(currencyCode || '')
    .trim()
    .toUpperCase();
  if (code === 'XRP') return Number.isFinite(MOONPAY_TAG_XRP) ? MOONPAY_TAG_XRP : null;
  if (code === 'RLUSD') return Number.isFinite(MOONPAY_TAG_RLUSD) ? MOONPAY_TAG_RLUSD : null;
  return null;
};

// Cryptos supportées par MoonPay
const MOONPAY_SUPPORTED_CURRENCIES = [
  { code: 'RLUSD', icon: CRYPTO_ICONS.RLUSD },
  { code: 'XRP', icon: CRYPTO_ICONS.XRP },
];

const isTrustedMoonPayOrigin = origin => {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'moonpay.com' || host.endsWith(MOONPAY_ORIGIN_SUFFIX);
  } catch (_) {
    return false;
  }
};

const notifyPwaMoonpayActive = (active, tab = 'buy') => {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const isPwaEmbedded = params.get('embedded') === 'pwa' || Boolean(window.__XCANNES_PWA_EMBEDDED__);
    if (!isPwaEmbedded) return;
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage({ type: 'MOONPAY_ACTIVE', active: Boolean(active), tab }, '*');
  } catch {
    // ignore
  }
};

const normalizeFiatCurrencyCode = value => {
  const upper = String(value || '')
    .trim()
    .toUpperCase();
  if (!upper) return '';
  if (upper === 'XRP' || upper === 'RLUSD') return '';
  return upper;
};

const normalizeMovementKind = value =>
  String(value || '')
    .trim()
    .toUpperCase();

const resolveIncomingXrpAmount = movement => {
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
};

const truncateMiddle = (value, head = 6, tail = 5) => {
  const str = String(value ?? '');
  if (!str) return '';
  if (str.length <= head + tail + 1) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
};

/**
 * MoonPayBuyModal - Modal pour acheter des cryptos avec MoonPay
 *
 * @param {boolean} isOpen - Modal ouverte ou fermée
 * @param {function} onClose - Callback de fermeture
 * @param {string} walletAddress - Adresse XRPL de destination
 * @param {boolean} embedded - Mode embedded (sans backdrop/header)
 */
const MoonPayBuyModal = ({
  isOpen,
  onClose,
  walletAddress,
  walletLabel = '',
  signTransaction = null,
  preferredFiatCurrency = '',
  onProceedToUsdSwapOut,
  embedded = false,
  noticeVariant = 'preview',
  demoMode = false,
  onDemoSubmit,
  availableTokens,
  rlusdPerUnitRates,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  prefill = null,
}) => {
  const { t, i18n } = useTranslation('common');
  const locale = i18n?.language || 'en';
  const resolvedTitleOverride = String(prefill?.titleOverride || '').trim();
  const useSimpleSwapPartner =
    String(prefill?.partnerOverride || '')
      .trim()
      .toLowerCase() === 'simpleswap';
  const accentVariant = useSimpleSwapPartner ? 'simpleswapBlue' : 'green';
  const accentText90 = accentVariant === 'simpleswapBlue' ? 'text-[#0870f8]/90' : 'text-xcannes-green/90';
  const accentText80 = accentVariant === 'simpleswapBlue' ? 'text-[#0870f8]/80' : 'text-xcannes-green/80';
  const accentRing25Bg =
    accentVariant === 'simpleswapBlue' ? 'ring-[#0870f8]/25 bg-[#0870f8]' : 'ring-xcannes-green/25 bg-xcannes-green';
  const modalPanelRef = useRef(null);
  const contentRootRef = useRef(null);
  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('form'); // 'form' | 'loading' | 'iframe' | 'awaiting_xrp' | 'swap_ready' | 'swapping' | 'success' | 'error'
  const displayError = error && /api\.sandbox\.moonpay\.com/i.test(error) ? null : error;
  const moonpayActiveRef = useRef(false);
  const pendingAutoStartRef = useRef(false);
  const isIOS = isIOSDevice();
  const moonpayIframeAllow = isIOS
    ? 'camera *; microphone *; clipboard-write'
    : 'camera https://moonpay.com https://buy.moonpay.com https://buy-sandbox.moonpay.com https://sell.moonpay.com https://sell-sandbox.moonpay.com https://wallet.moonpay.com https://*.moonpay.com; clipboard-write';
  const latestStepRef = useRef(step);
  const latestIframeUrlRef = useRef(iframeUrl);
  const [pendingSwapTargetCurrency, setPendingSwapTargetCurrency] = useState('');
  const [pendingSwapDetectedXrp, setPendingSwapDetectedXrp] = useState(null);
  const [, setPendingSwapTxHash] = useState('');
  const [awaitingXrpSince, setAwaitingXrpSince] = useState(null);
  const [preparedInboundSwap, setPreparedInboundSwap] = useState(null);
  const pendingSwapPollSeenRef = useRef('');

  useEffect(() => {
    latestStepRef.current = step;
    latestIframeUrlRef.current = iframeUrl;
  }, [iframeUrl, step]);

  // Mark MoonPay iframe flow as active so wallet-level auto-lock does not
  // disconnect while the user completes KYC/Apple flows (events inside iframe
  // don't bubble to the parent window).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const active = Boolean(isOpen && step === 'iframe' && iframeUrl);
    if (active === moonpayActiveRef.current) return;
    moonpayActiveRef.current = active;
    try {
      if (active) {
        window.sessionStorage?.setItem(MOONPAY_ACTIVE_STORAGE_KEY, '1');
        window.sessionStorage?.setItem(MOONPAY_AUTOOPEN_TAB_KEY, 'buy');
        window.__XCANNES_MOONPAY_ACTIVE__ = true;
        try {
          window.localStorage?.setItem(
            MOONPAY_WALLET_ADDRESS_KEY,
            JSON.stringify({ v: 1, ts: Date.now(), address: String(walletAddress || '') }),
          );
        } catch {
          // ignore
        }
      } else {
        window.sessionStorage?.removeItem(MOONPAY_ACTIVE_STORAGE_KEY);
        window.__XCANNES_MOONPAY_ACTIVE__ = false;
      }
      window.dispatchEvent(new CustomEvent('xcannes:moonpay-active', { detail: { active } }));
      notifyPwaMoonpayActive(active, 'buy');
    } catch {
      // Ignore storage errors
    }
  }, [iframeUrl, isOpen, step, walletAddress]);

  // Options d'achat (RLUSD par défaut)
  const [currency, setCurrency] = useState('RLUSD');
  const [targetAssetAmount, setTargetAssetAmount] = useState('');
  const [amount, setAmount] = useState('');
  const [amountType, setAmountType] = useState('fiat');
  const [walletAddressExpanded, setWalletAddressExpanded] = useState(false);
  const [walletAddressCopied, setWalletAddressCopied] = useState(false);
  const [fiatCurrency, setFiatCurrency] = useState(() => {
    return (
      normalizeFiatCurrencyCode(prefill?.fiatCurrency) || normalizeFiatCurrencyCode(preferredFiatCurrency) || 'USD'
    );
  });
  const normalizedPreferredFiatCurrency = useMemo(() => {
    return normalizeFiatCurrencyCode(preferredFiatCurrency);
  }, [preferredFiatCurrency]);

  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.matchMedia?.('(min-width: 768px)')?.matches);
  });
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [, setAssetSearch] = useState('');
  const assetDropdownListRef = useRef(null);
  const assetDropdownTriggerRef = useRef(null);
  const assetDropdownDesktopPopupRef = useRef(null);
  const [, setAssetOverlayDragging] = useState(false);
  const [, setAssetOverlayTranslateY] = useState(0);
  const assetOverlayDragMetaRef = useRef({
    startY: 0,
    startAt: 0,
    pointerId: null,
    lastDelta: 0,
    pending: false,
    source: null,
    dragging: false,
    scrollLocked: false,
    lockedOverflowY: '',
  });
  const [wizardStep, setWizardStep] = useState(1); // 1/3 = asset, 2/3 = fiat+amount, 3/3 = MoonPay iframe
  const [reviewTimestamp, setReviewTimestamp] = useState(null);
  const [xrpPreviewAmount, setXrpPreviewAmount] = useState(null);
  const [opDetailsOpen, setOpDetailsOpen] = useState(false);

  const PRODUCT_MIN_USD = 5;

  // Étape 2 = résumé : on verrouille le sélecteur pour éviter les edits involontaires.
  useEffect(() => {
    if (wizardStep === 1) return;
    setAssetDropdownOpen(false);
    setAssetSearch('');
  }, [wizardStep]);

  const supportedCurrencies = useMemo(() => {
    const fallbackTokens = MOONPAY_SUPPORTED_CURRENCIES.map(curr => ({
      currency: curr.code,
      value: 0,
    }));
    const sourceTokens = Array.isArray(availableTokens) && availableTokens.length ? availableTokens : fallbackTokens;

    const seen = new Set();
    const orderedTokens = [
      ...sourceTokens.filter(token => {
        const code = String(token?.currency || '').toUpperCase();
        return code === 'XRP' || code === 'RLUSD';
      }),
      ...sourceTokens.filter(token => {
        const code = String(token?.currency || '').toUpperCase();
        return code !== 'XRP' && code !== 'RLUSD';
      }),
    ];

    return orderedTokens
      .map(token => {
        const currencyRaw = token?.currency;
        const currencyCode = String(currencyRaw || '').toUpperCase();
        // Do not offer XRP in the buy flow selector.
        if (currencyCode === 'XRP') return null;
        if (!currencyCode || seen.has(currencyCode)) return null;
        seen.add(currencyCode);

        const _fullNameBuy = getCurrencyDescription(currencyCode) || selectLabelByCurrency?.[currencyRaw] || selectLabelByCurrency?.[currencyCode] || currencyCode;
        const labelLeft = _fullNameBuy.length > 15 ? _fullNameBuy.slice(0, 15) + '…' : _fullNameBuy;
        const amountValue = Number(token?.value || 0);
        const fallbackAmountLabel = Number.isFinite(amountValue)
          ? formatAmountWithSymbol(locale, amountValue, currencyCode, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : formatAmountWithSymbol(locale, 0, currencyCode, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
        const amountLabelFromProps =
          selectLabelRightByCurrency?.[currencyRaw] || selectLabelRightByCurrency?.[currencyCode] || '';
        const amountLabel =
          typeof amountLabelFromProps === 'string' && amountLabelFromProps.trim()
            ? amountLabelFromProps
            : fallbackAmountLabel;
        const labelRight = amountLabel;
        const labelMobile =
          selectLabelMobileByCurrency?.[currencyRaw] || selectLabelMobileByCurrency?.[currencyCode] || labelLeft;
        const moonpayIcon =
          MOONPAY_SUPPORTED_CURRENCIES.find(curr => String(curr?.code || '').toUpperCase() === currencyCode)?.icon ||
          null;
        return {
          code: currencyCode,
          label: labelLeft,
          labelLeft,
          labelRight,
          amountLabel,
          labelMobile,
          icon:
            selectIconByCurrency?.[currencyRaw] ||
            selectIconByCurrency?.[currencyCode] ||
            moonpayIcon ||
            getCurrencyFlag(currencyCode),
        };
      })
      .filter(Boolean);
  }, [
    availableTokens,
    locale,
    selectIconByCurrency,
    selectLabelByCurrency,
    selectLabelMobileByCurrency,
    selectLabelRightByCurrency,
  ]);

  const selectedToken = useMemo(() => {
    const current = String(currency || '').toUpperCase();
    if (!current) return null;
    return (availableTokens || []).find(token => String(token?.currency || '').toUpperCase() === current) || null;
  }, [availableTokens, currency]);

  const targetAmountValue = Number.parseFloat(targetAssetAmount || '');
  const currencyUpper = String(currency || '').toUpperCase();
  const isCurrencyLine = Boolean(selectedToken?.isTrustlineOnly);
  const rlusdRate = isCurrencyLine
    ? currencyUpper === 'RLUSD' || currencyUpper === 'USD'
      ? 1
      : Number(rlusdPerUnitRates?.[currencyUpper])
    : 1;
  const hasValidTargetAmount = Number.isFinite(targetAmountValue) && targetAmountValue > 0;
  const conversionMissing = isCurrencyLine && hasValidTargetAmount && (!Number.isFinite(rlusdRate) || rlusdRate <= 0);
  const rlusdEquivalent =
    hasValidTargetAmount && !conversionMissing
      ? isCurrencyLine
        ? targetAmountValue * rlusdRate
        : targetAmountValue
      : null;
  // Fees are always calculated by the partner (MoonPay/Topper). Avoid showing misleading "fees"
  // derived from FX conversions (e.g. 20,000 DOP vs 329 RLUSD).

  const formatAmountWithCode = (amount, code, options = {}) => {
    const num = Number(amount);
    if (!Number.isFinite(num)) return '-';
    const upper = String(code || '').toUpperCase();
    const { minimumFractionDigits = 2, maximumFractionDigits = 2, ...rest } = options || {};
    const value = new Intl.NumberFormat(locale || 'en', {
      minimumFractionDigits,
      maximumFractionDigits,
      ...rest,
    }).format(num);
    return upper ? `${value} ${upper}` : value;
  };

  const [moonpayFiatCurrencyCodes, setMoonpayFiatCurrencyCodes] = useState(() => new Set());
  const [moonpayFiatCurrenciesLoaded, setMoonpayFiatCurrenciesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen) return () => {};
    if (demoMode) return () => {};
    // Fetch supported fiat currencies from MoonPay (via our proxy) so we can
    // fallback correctly when a wallet currency isn't supported by MoonPay.
    (async () => {
      try {
        const res = await fetch('/api/moonpay/fiat-currencies');
        const data = await res.json();
        const list = Array.isArray(data?.currencies) ? data.currencies : [];
        const codes = new Set(
          list
            .map(c =>
              String(c?.code || c?.currencyCode || '')
                .trim()
                .toUpperCase(),
            )
            .filter(Boolean),
        );
        if (!cancelled && codes.size > 0) {
          setMoonpayFiatCurrencyCodes(codes);
        }
      } catch {
        // ignore: we'll fallback via a small allow-list
      } finally {
        if (!cancelled) setMoonpayFiatCurrenciesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoMode, isOpen]);

  const COMMON_MOONPAY_FIATS = useMemo(
    () =>
      new Set([
        'USD',
        'EUR',
        'GBP',
        'CHF',
        'CAD',
        'AUD',
        'NZD',
        'JPY',
        'SEK',
        'NOK',
        'DKK',
        'PLN',
        'CZK',
        'HUF',
        'RON',
        'BGN',
        'TRY',
        'ILS',
        'ZAR',
        'BRL',
        'MXN',
        'ARS',
        'CLP',
        'COP',
        'PEN',
      ]),
    [],
  );

  const resolvedMoonpayBaseFiatCurrencyCode = useMemo(() => {
    // MoonPay fiat (payment) currency should default to the user's preferred fiat currency,
    // stored in the wallet_label memo on the RLUSD trustline (preferredFiatCurrency).
    const requested = String(fiatCurrency || '')
      .trim()
      .toUpperCase();
    if (!requested) return 'USD';
    if (moonpayFiatCurrencyCodes.size > 0) {
      return moonpayFiatCurrencyCodes.has(requested) ? requested : 'USD';
    }
    // If the list isn't loaded yet, assume common fiats are supported.
    if (!moonpayFiatCurrenciesLoaded && COMMON_MOONPAY_FIATS.has(requested)) return requested;
    return COMMON_MOONPAY_FIATS.has(requested) ? requested : 'USD';
  }, [COMMON_MOONPAY_FIATS, fiatCurrency, moonpayFiatCurrenciesLoaded, moonpayFiatCurrencyCodes]);

  const resolveRlusdRateForFiat = useCallback((code) => {
    const upper = String(code || '')
      .trim()
      .toUpperCase();
    if (!upper) return Number.NaN;
    if (upper === 'USD' || upper === 'RLUSD') return 1;
    const rate = Number(rlusdPerUnitRates?.[upper]);
    return Number.isFinite(rate) && rate > 0 ? rate : Number.NaN;
  }, [rlusdPerUnitRates]);

  const fallbackMoonpayFeeEstimates = useMemo(() => {
    const amountRlusdForQuote = Number(rlusdEquivalent);
    if (!Number.isFinite(amountRlusdForQuote) || amountRlusdForQuote <= 0) return null;

    const baseFiat = String(resolvedMoonpayBaseFiatCurrencyCode || 'USD')
      .trim()
      .toUpperCase();
    const baseFiatRlusdRate = resolveRlusdRateForFiat(baseFiat);
    if (!Number.isFinite(baseFiatRlusdRate) || baseFiatRlusdRate <= 0) return null;

    // Express fees in the wallet-selected currency line (e.g. DOP),
    // even though MoonPay charges in the payment fiat (baseFiat).
    const targetRlusdRate = isCurrencyLine ? Number(rlusdRate) : 1;
    if (!Number.isFinite(targetRlusdRate) || targetRlusdRate <= 0) return null;

    const amountInBaseFiat = amountRlusdForQuote / baseFiatRlusdRate;
    if (!Number.isFinite(amountInBaseFiat) || amountInBaseFiat <= 0) return null;

    const presets = [
      {
        key: 'moonpay_balance',
        label: t('moonpay_fee_method_balance', 'MoonPay Balance'),
        rate: 0,
        min: 0,
        requiresFiat: 'USD',
      },
      {
        key: 'sepa',
        label: t('moonpay_fee_method_sepa', 'SEPA Bank Transfer'),
        rate: 0.01,
        min: 3.99,
        requiresFiat: 'EUR',
      },
      {
        key: 'cards',
        label: t('moonpay_fee_method_cards', 'Credit Cards'),
        rate: 0.045,
        min: 3.99,
        requiresFiat: null,
      },
    ];

    const items = presets
      .map(preset => {
        if (preset.requiresFiat && preset.requiresFiat !== baseFiat) return null;
        const feeBaseFiat = Math.max(amountInBaseFiat * preset.rate, preset.min);
        if (!Number.isFinite(feeBaseFiat) || feeBaseFiat < 0) return null;
        const feeRlusd = feeBaseFiat * baseFiatRlusdRate;
        const feeTarget = feeRlusd / targetRlusdRate;
        if (!Number.isFinite(feeTarget) || feeTarget < 0) return null;
        return {
          key: preset.key,
          label: preset.label,
          amount: feeTarget,
        };
      })
      .filter(Boolean);

    return items.length ? items : null;
  }, [isCurrencyLine, resolvedMoonpayBaseFiatCurrencyCode, resolveRlusdRateForFiat, rlusdEquivalent, rlusdRate, t]);

  const [moonpayFeeEstimates, setMoonpayFeeEstimates] = useState(null);
  const [, setMoonpayFeeEstimateError] = useState(null);
  const normalizeFeeError = value => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.message || 'MoonPay quote failed';
    try {
      const msg = value?.message || value?.error || value?.code;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
      return JSON.stringify(value);
    } catch {
      return 'MoonPay quote failed';
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!isOpen) return () => {};
    if (demoMode) return () => {};
    if (wizardStep !== 2) return () => {};
    if (!hasValidTargetAmount || conversionMissing) return () => {};

    const run = async () => {
      try {
        setMoonpayFeeEstimateError(null);

        const amountRlusdForQuote = Number(rlusdEquivalent);
        if (!Number.isFinite(amountRlusdForQuote) || amountRlusdForQuote <= 0) return;

        const quote = await xcannesApi.getRlusdXrpQuote({
          direction: 'XRP_TO_RLUSD',
          amountRlusd: amountRlusdForQuote,
        });
        const quotedXrpAmount = Number(quote?.xrpAmount);
        if (!Number.isFinite(quotedXrpAmount) || quotedXrpAmount <= 0) return;

        const xrpAmountToBuy = Number(quotedXrpAmount.toFixed(6));
        if (!Number.isFinite(xrpAmountToBuy) || xrpAmountToBuy <= 0) return;

        const baseFiat = String(resolvedMoonpayBaseFiatCurrencyCode || 'USD')
          .trim()
          .toUpperCase();
        const baseFiatRlusdRate = resolveRlusdRateForFiat(baseFiat);
        if (!Number.isFinite(baseFiatRlusdRate) || baseFiatRlusdRate <= 0) return;

        const targetRlusdRate = isCurrencyLine ? Number(rlusdRate) : 1;
        if (!Number.isFinite(targetRlusdRate) || targetRlusdRate <= 0) return;

        const methods = [
          {
            key: 'moonpay_balance',
            label: t('moonpay_fee_method_balance', 'MoonPay Balance'),
            paymentMethod: 'moonpay_balance',
            requiresFiat: 'USD',
          },
          {
            key: 'sepa',
            label: t('moonpay_fee_method_sepa', 'SEPA Bank Transfer'),
            paymentMethod: 'sepa_bank_transfer',
            requiresFiat: 'EUR',
          },
          {
            key: 'cards',
            label: t('moonpay_fee_method_cards', 'Credit Cards'),
            paymentMethod: 'credit_debit_card',
            requiresFiat: null,
          },
        ].filter(m => !m.requiresFiat || m.requiresFiat === baseFiat);

        const results = await Promise.all(
          methods.map(async method => {
            const res = await fetch('/api/moonpay/buy-quote', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                currencyCode: 'xrp',
                baseCurrencyCode: baseFiat,
                quoteCurrencyAmount: xrpAmountToBuy,
                paymentMethod: method.paymentMethod,
                areFeesIncluded: true,
                extraFeePercentage: 0,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data?.message || data?.error || 'MoonPay quote failed');
            }
            const q = data?.quote || {};
            const feeAmount = Number(q?.feeAmount || 0);
            const extraFeeAmount = Number(q?.extraFeeAmount || 0);
            const networkFeeAmount = Number(q?.networkFeeAmount || 0);
            const totalFeeBaseFiat = feeAmount + extraFeeAmount + networkFeeAmount;
            if (!Number.isFinite(totalFeeBaseFiat) || totalFeeBaseFiat < 0) return null;
            const feeRlusd = totalFeeBaseFiat * baseFiatRlusdRate;
            const feeTarget = feeRlusd / targetRlusdRate;
            if (!Number.isFinite(feeTarget) || feeTarget < 0) return null;
            return { key: method.key, label: method.label, amount: feeTarget };
          }),
        );

        const items = results.filter(Boolean);
        if (!cancelled) {
          setMoonpayFeeEstimates(items.length ? items : null);
        }
      } catch (error) {
        if (!cancelled) {
          setMoonpayFeeEstimateError(normalizeFeeError(error) || 'MoonPay quote failed');
          setMoonpayFeeEstimates(null);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    conversionMissing,
    demoMode,
    hasValidTargetAmount,
    isCurrencyLine,
    isOpen,
    resolveRlusdRateForFiat,
    rlusdEquivalent,
    rlusdRate,
    resolvedMoonpayBaseFiatCurrencyCode,
    t,
    wizardStep,
  ]);

  // Aperçu XRP en temps réel (étape 1) — debounced 500 ms
  useEffect(() => {
    setXrpPreviewAmount(null);
    if (!isOpen || demoMode || wizardStep !== 1) return () => {};
    const rlusdAmt = Number(rlusdEquivalent);
    if (!Number.isFinite(rlusdAmt) || rlusdAmt <= 0) return () => {};
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const q = await xcannesApi.getRlusdXrpQuote({ direction: 'XRP_TO_RLUSD', amountRlusd: rlusdAmt });
        const xrpAmt = Number(q?.xrpAmount);
        if (!cancelled && Number.isFinite(xrpAmt) && xrpAmt > 0) setXrpPreviewAmount(xrpAmt);
      } catch {
        // ignore — aperçu non bloquant
      }
    }, 500);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [demoMode, isOpen, rlusdEquivalent, wizardStep]);

  const reviewTimestampLabel = useMemo(() => {
    if (!reviewTimestamp) return '';
    try {
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(reviewTimestamp);
    } catch {
      return '';
    }
  }, [locale, reviewTimestamp]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia?.('(min-width: 768px)');
    if (!mediaQuery) return;
    const update = () => setIsDesktopViewport(Boolean(mediaQuery.matches));
    update();
    try {
      mediaQuery.addEventListener?.('change', update);
      return () => mediaQuery.removeEventListener?.('change', update);
    } catch {
      mediaQuery.addListener?.(update);
      return () => mediaQuery.removeListener?.(update);
    }
  }, []);

  useEffect(() => {
    if (!assetDropdownOpen) return;
    const prevOverflow = document?.body?.style?.overflow;
    try {
      if (typeof document !== 'undefined' && !isDesktopViewport) document.body.style.overflow = 'hidden';
    } catch {
      // ignore
    }
    const handleKeyDown = event => {
      if (event.key === 'Escape') setAssetDropdownOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      try {
        if (typeof document !== 'undefined') document.body.style.overflow = prevOverflow || '';
      } catch {
        // ignore
      }
    };
  }, [assetDropdownOpen, isDesktopViewport]);

  useEffect(() => {
    if (!assetDropdownOpen) return;
    if (!isDesktopViewport) return;
    const handler = event => {
      const popupEl = assetDropdownDesktopPopupRef.current;
      const triggerEl = assetDropdownTriggerRef.current;
      if (popupEl && popupEl.contains(event.target)) return;
      if (triggerEl && triggerEl.contains(event.target)) return;
      setAssetDropdownOpen(false);
      setAssetSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [assetDropdownOpen, isDesktopViewport]);

  useEffect(() => {
    if (assetDropdownOpen) return;
    try {
      const listEl = assetDropdownListRef.current;
      const meta = assetOverlayDragMetaRef.current;
      if (listEl && meta?.scrollLocked) {
        listEl.style.overflowY = meta.lockedOverflowY;
      }
    } catch {
      // ignore
    }
    setAssetOverlayDragging(false);
    setAssetOverlayTranslateY(0);
    assetOverlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: '',
    };
  }, [assetDropdownOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!supportedCurrencies.length) return;
    setCurrency(prev => {
      const current = String(prev || '').toUpperCase();
      if (supportedCurrencies.some(curr => curr.code === current)) {
        return current;
      }
      return supportedCurrencies[0].code;
    });
  }, [isOpen, supportedCurrencies]);

  const saveResumeState = useMemo(() => {
    return (extra = {}) => {
      if (typeof window === 'undefined') return;
      try {
        window.sessionStorage?.setItem(
          MOONPAY_BUY_RESUME_KEY,
          JSON.stringify({
            v: 1,
            kind: 'buy',
            ts: Date.now(),
            walletAddress: String(walletAddress || ''),
            currency: String(currency || '').toUpperCase(),
            targetCurrencyCode: String(currency || '').toUpperCase(),
            targetAssetAmount: String(targetAssetAmount || ''),
            amountType: amountType === 'crypto' ? 'crypto' : 'fiat',
            amount: String(amount || ''),
            fiatCurrency: String(fiatCurrency || '').toUpperCase(),
            ...extra,
          }),
        );
      } catch {
        // Ignore
      }
    };
  }, [amount, amountType, currency, fiatCurrency, targetAssetAmount, walletAddress]);

  const getOrCreateFlowId = useMemo(() => {
    return () => {
      if (typeof window === 'undefined') return null;
      try {
        const raw = window.sessionStorage?.getItem(MOONPAY_BUY_FLOW_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const ageMs = Date.now() - Number(parsed?.ts || 0);
          if (
            parsed?.v === 1 &&
            typeof parsed?.id === 'string' &&
            parsed.id &&
            Number.isFinite(ageMs) &&
            ageMs >= 0 &&
            ageMs <= MOONPAY_FLOW_MAX_AGE_MS
          ) {
            return parsed.id;
          }
        }
      } catch {
        // ignore
      }

      try {
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
        window.sessionStorage?.setItem(MOONPAY_BUY_FLOW_KEY, JSON.stringify({ v: 1, kind: 'buy', ts: Date.now(), id }));
        return id;
      } catch {
        return null;
      }
    };
  }, []);

  const clearFlowId = useMemo(() => {
    return () => {
      if (typeof window === 'undefined') return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_BUY_FLOW_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

  const clearMoonpayWalletAddress = useMemo(() => {
    return () => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage?.removeItem(MOONPAY_WALLET_ADDRESS_KEY);
      } catch {
        // ignore
      }
    };
  }, []);

  const readResumeState = useMemo(() => {
    return () => {
      if (typeof window === 'undefined') return null;
      try {
        const raw = window.sessionStorage?.getItem(MOONPAY_BUY_RESUME_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== 1 || parsed.kind !== 'buy') return null;
        return parsed;
      } catch {
        return null;
      }
    };
  }, []);

  const clearResumeState = useMemo(() => {
    return () => {
      if (typeof window === 'undefined') return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_BUY_RESUME_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

  const clearAutoOpen = useMemo(() => {
    return () => {
      if (typeof window === 'undefined') return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_AUTOOPEN_TAB_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

  const deactivateMoonpayActive = useMemo(() => {
    return () => {
      if (typeof window === 'undefined') return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_ACTIVE_STORAGE_KEY);
        window.__XCANNES_MOONPAY_ACTIVE__ = false;
        window.dispatchEvent(new CustomEvent('xcannes:moonpay-active', { detail: { active: false } }));
      } catch {
        // Ignore
      }
    };
  }, []);

  const handleUserClose = useMemo(() => {
    return () => {
      clearResumeState();
      clearAutoOpen();
      clearFlowId();
      clearMoonpayWalletAddress();
      deactivateMoonpayActive();
      setIframeUrl(null);
      setError(null);
      setStep('form');
      setWizardStep(1);
      setReviewTimestamp(null);
      setTargetAssetAmount('');
      setPendingSwapTargetCurrency('');
      setPendingSwapDetectedXrp(null);
      setPendingSwapTxHash('');
      setAwaitingXrpSince(null);
      setPreparedInboundSwap(null);
      setWalletAddressExpanded(false);
      setWalletAddressCopied(false);
      onClose?.();
    };
  }, [clearAutoOpen, clearFlowId, clearMoonpayWalletAddress, clearResumeState, deactivateMoonpayActive, onClose]);

  useEffect(() => {
    return () => {
      deactivateMoonpayActive();
      notifyPwaMoonpayActive(false, 'buy');
    };
  }, [deactivateMoonpayActive]);

  const handleWidgetClose = useMemo(() => {
    return () => {
      clearResumeState();
      clearAutoOpen();
      clearFlowId();
      clearMoonpayWalletAddress();
      deactivateMoonpayActive();
      setIframeUrl(null);
      setError(null);
      setStep('form');
      setWizardStep(1);
      setReviewTimestamp(null);
      setTargetAssetAmount('');
      setPendingSwapTargetCurrency('');
      setPendingSwapDetectedXrp(null);
      setPendingSwapTxHash('');
      setAwaitingXrpSince(null);
      setPreparedInboundSwap(null);
      setWalletAddressExpanded(false);
      setWalletAddressCopied(false);
    };
  }, [clearAutoOpen, clearFlowId, clearMoonpayWalletAddress, clearResumeState, deactivateMoonpayActive]);

  const handleCopyWalletAddress = async event => {
    event?.stopPropagation?.();
    try {
      const value = String(walletAddress || '').trim();
      if (!value) return;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.left = '-1000px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setWalletAddressCopied(true);
      window.setTimeout(() => setWalletAddressCopied(false), 1400);
    } catch {
      // ignore
    }
  };

  // If the user closes the Cash modal while the MoonPay widget is open,
  // don't keep the resume cache around.
  useEffect(() => {
    return () => {
      if (latestStepRef.current !== 'iframe' || !latestIframeUrlRef.current) return;
      clearResumeState();
      clearAutoOpen();
      clearFlowId();
      clearMoonpayWalletAddress();
      deactivateMoonpayActive();
    };
  }, [clearAutoOpen, clearFlowId, clearMoonpayWalletAddress, clearResumeState, deactivateMoonpayActive]);

  const prefillSignature = useMemo(() => {
    if (!prefill) return '';
    return JSON.stringify({
      currency: prefill.currency || '',
      amount: prefill.amount ?? '',
      amountType: prefill.amountType || '',
      fiatCurrency: prefill.fiatCurrency || '',
    });
  }, [prefill]);
  const prefillFiatCurrency = useMemo(() => {
    return normalizeFiatCurrencyCode(prefill?.fiatCurrency);
  }, [prefill]);
  const lastPrefillRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      lastPrefillRef.current = null;
      setReviewTimestamp(null);
      return;
    }
    setWizardStep(1);
    setReviewTimestamp(null);
    if (!prefill || !prefillSignature) return;
    if (lastPrefillRef.current === prefillSignature) return;
    lastPrefillRef.current = prefillSignature;
    if (prefill.currency) {
      setCurrency(String(prefill.currency).toUpperCase());
    }
    if (prefill.amount != null) {
      setAmount(String(prefill.amount));
    }
    if (prefill.amountType) {
      const nextType = prefill.amountType === 'crypto' ? 'crypto' : 'fiat';
      setAmountType(nextType);
    }
    if (prefill.fiatCurrency) {
      const nextFiat = normalizeFiatCurrencyCode(prefill.fiatCurrency);
      if (nextFiat) setFiatCurrency(nextFiat);
    }
  }, [isOpen, prefill, prefillSignature]);

  // Base currency (fiat) defaults to the wallet's on-chain defaultCurrency memo.
  // The user can still change it inside MoonPay if needed.
  useEffect(() => {
    if (!isOpen) return;
    if (prefillFiatCurrency) return;
    if (!normalizedPreferredFiatCurrency) return;
    setFiatCurrency(normalizedPreferredFiatCurrency);
  }, [isOpen, normalizedPreferredFiatCurrency, prefillFiatCurrency]);

  // Resume flow after iOS background / reconnect:
  // restore the last inputs and auto-generate the widget URL so the user
  // lands directly back on the MoonPay iframe.
  useEffect(() => {
    if (!isOpen) return;
    if (!walletAddress) return;
    if (demoMode) return;
    if (step !== 'form' || iframeUrl) return;
    if (!fiatCurrency) return;

    const resume = readResumeState();
    if (!resume) return;
    if (String(resume.walletAddress || '') !== String(walletAddress || '')) return;
    const ageMs = Date.now() - Number(resume.ts || 0);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MOONPAY_RESUME_MAX_AGE_MS) return;

    // Prefer restoring the last widget URL (keeps the same MoonPay session),
    // and only regenerate if missing.
    if (resume.lastIframeUrl) {
      setIframeUrl(String(resume.lastIframeUrl));
      setStep('iframe');
      return;
    }

    if (resume.awaitingXrpSwap) {
      const restoredPreparedSwap =
        resume.preparedInboundSwap && typeof resume.preparedInboundSwap === 'object'
          ? resume.preparedInboundSwap
          : null;
      setPendingSwapTargetCurrency(
        String(resume.targetCurrencyCode || resume.currency || '')
          .trim()
          .toUpperCase(),
      );
      setPendingSwapDetectedXrp(
        Number.isFinite(Number(resume.detectedXrpAmount)) && Number(resume.detectedXrpAmount) > 0
          ? Number(resume.detectedXrpAmount)
          : null,
      );
      setPendingSwapTxHash(String(resume.detectedXrpTxHash || '').trim());
      setAwaitingXrpSince(
        Number.isFinite(Number(resume.awaitingXrpSince))
          ? Number(resume.awaitingXrpSince)
          : Number.isFinite(Number(resume.ts))
            ? Number(resume.ts)
            : Date.now(),
      );
      setPreparedInboundSwap(restoredPreparedSwap);
      setStep(
        Number.isFinite(Number(resume.detectedXrpAmount)) &&
          Number(resume.detectedXrpAmount) > 0 &&
          restoredPreparedSwap?.txjson
          ? 'swap_ready'
          : 'awaiting_xrp',
      );
      return;
    }

    const nextCurrency = String(resume.currency || '').toUpperCase();
    if (nextCurrency) setCurrency(nextCurrency);
    if (resume.targetAssetAmount != null) setTargetAssetAmount(String(resume.targetAssetAmount));
    if (resume.amountType) setAmountType(resume.amountType === 'crypto' ? 'crypto' : 'fiat');
    if (resume.amount != null) setAmount(String(resume.amount));
    if (resume.fiatCurrency) setFiatCurrency(String(resume.fiatCurrency).toUpperCase());

    pendingAutoStartRef.current = true;
  }, [demoMode, fiatCurrency, iframeUrl, isOpen, readResumeState, step, walletAddress]);

  useEffect(() => {
    if (!isOpen) return;
    if (!pendingAutoStartRef.current) return;
    if (demoMode) return;
    pendingAutoStartRef.current = false;

    const id = window.setTimeout(() => {
      generateBuyUrl();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, isOpen]);

  const minFiatAmount = useMemo(() => {
    if (resolvedMoonpayBaseFiatCurrencyCode === 'USD') {
      return PRODUCT_MIN_USD;
    }
    return null;
  }, [PRODUCT_MIN_USD, resolvedMoonpayBaseFiatCurrencyCode]);

  // Générer l'URL MoonPay
  const generateBuyUrl = async () => {
    if (!walletAddress) {
      setError(t('moonpay_error_wallet_required_5f2a1c9d3e', 'Wallet address is required.'));
      return;
    }

    const currencyUpper = String(currency || 'RLUSD')
      .trim()
      .toUpperCase();
    const moonpayCurrencyCode = 'XRP';
    const requestedFiatAmount = Number.parseFloat(String(targetAssetAmount || '').trim());
    const amountRlusdForQuote = Number(rlusdEquivalent);

    if (!Number.isFinite(requestedFiatAmount) || requestedFiatAmount <= 0) {
      setError(t('moonpay_error_invalid_amount_8c3b1a6d2f', 'Please enter a valid amount.'));
      return;
    }

    if (
      minFiatAmount !== null &&
      // When MoonPay falls back to USD (because the selected wallet currency isn't supported),
      // validate the minimum on the RLUSD-equivalent amount (≈ USD).
      (resolvedMoonpayBaseFiatCurrencyCode === 'USD' && currencyUpper !== 'USD'
        ? !Number.isFinite(amountRlusdForQuote) || amountRlusdForQuote < minFiatAmount
        : requestedFiatAmount < minFiatAmount)
    ) {
      setError(
        t('moonpay_error_minimum_fiat', {
          defaultValue: 'Minimum amount is {{amount}} {{currency}}.',
          amount: minFiatAmount,
          currency: resolvedMoonpayBaseFiatCurrencyCode,
        }),
      );
      return;
    }

    // Persist inputs so we can resume after iOS Apple flows / reconnect.
    const flowId = getOrCreateFlowId();
    saveResumeState({
      flowId,
      moonpayCurrencyCode,
      targetCurrencyCode: currencyUpper,
      targetAssetAmount: String(targetAssetAmount || ''),
    });

    setLoading(true);
    setError(null);

    try {
      if (demoMode) {
        const res = await Promise.resolve(
          onDemoSubmit?.({
            currencyCode: String(moonpayCurrencyCode || 'RLUSD').toUpperCase(),
            baseCurrencyCode: String(resolvedMoonpayBaseFiatCurrencyCode || 'USD').toUpperCase(),
            amountType: 'fiat',
            amount: requestedFiatAmount,
          }),
        );
        if (res?.error) {
          throw new Error(res.error);
        }
        setIframeUrl(null);
        setStep('success');
        setTimeout(() => {
          onClose?.();
        }, 1200);
        return;
      }

      setStep('loading');
      if (!Number.isFinite(amountRlusdForQuote) || amountRlusdForQuote <= 0) {
        throw new Error(
          t('moonpay_error_invalid_rlusd_quote_amount', 'Unable to calculate the RLUSD amount for this purchase.'),
        );
      }

      const quote = await xcannesApi.getRlusdXrpQuote({
        direction: 'XRP_TO_RLUSD',
        amountRlusd: amountRlusdForQuote,
      });
      const quotedXrpAmount = Number(quote?.xrpAmount);
      if (!Number.isFinite(quotedXrpAmount) || quotedXrpAmount <= 0) {
        throw new Error(
          t('moonpay_error_invalid_xrp_quote_amount', 'Unable to calculate the XRP amount to buy for this purchase.'),
        );
      }

      const xrpAmountToBuy = Number(quotedXrpAmount.toFixed(6));
      if (!Number.isFinite(xrpAmountToBuy) || xrpAmountToBuy <= 0) {
        throw new Error(
          t(
            'moonpay_error_invalid_xrp_quote_amount_rounded',
            'Unable to calculate the XRP amount to buy for this purchase.',
          ),
        );
      }

      const walletAddressTag = resolveMoonpayTag(moonpayCurrencyCode);
      const options = {
        ...(walletAddressTag != null ? { walletAddressTag } : null),
        ...(flowId ? { xcannesFlowId: flowId } : null),
      };
      const response = await fetch('/api/moonpay/generate-buy-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          currencyCode: moonpayCurrencyCode,
          // Use the selected wallet currency as an input for the RLUSD quote, but only send
          // a fiat code supported by MoonPay as the payment currency (fallback to USD).
          baseCurrencyCode: resolvedMoonpayBaseFiatCurrencyCode,
          quoteCurrencyAmount: xrpAmountToBuy,
          options: Object.keys(options || {}).length ? options : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('moonpay_error_generate_buy_url_4d2c9a1f7b', 'Failed to generate buy URL.'));
      }

      if (data.success && data.url) {
        setIframeUrl(data.url);
        saveResumeState({ lastIframeUrl: data.url });
        setStep('iframe');
      } else {
        throw new Error(t('moonpay_error_invalid_response_6b2d8c1a9f', 'Invalid response from server.'));
      }
    } catch (err) {
      console.error('Error generating buy URL:', err);
      setError(err.message || t('moonpay_error_load_widget_3c1a7d8b2e', 'Failed to load MoonPay widget.'));
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Écouter les messages du widget MoonPay
  useEffect(() => {
    const handleMessage = event => {
      // Vérifier l'origine (MoonPay sandbox ou production)
      if (!isTrustedMoonPayOrigin(event.origin)) return;

      const { type, status } = event.data;

      if (DEBUG_LOGS) {
        console.log('MoonPay message received:', event.data);
      }

      // Transaction complétée
      if (type === 'transaction_completed' || status === 'completed') {
        const targetCurrency = String(currency || 'RLUSD')
          .trim()
          .toUpperCase();
        clearAutoOpen();
        clearFlowId();
        clearMoonpayWalletAddress();
        deactivateMoonpayActive();
        setIframeUrl(null);
        setPendingSwapTargetCurrency(targetCurrency);
        setPendingSwapDetectedXrp(null);
        setPendingSwapTxHash('');
        setPreparedInboundSwap(null);
        setAwaitingXrpSince(Date.now());
        saveResumeState({
          awaitingXrpSwap: true,
          awaitingXrpSince: Date.now(),
          targetCurrencyCode: targetCurrency,
          targetAssetAmount: String(targetAssetAmount || ''),
          lastIframeUrl: '',
        });
        setStep('awaiting_xrp');
      }

      // Transaction échouée
      if (type === 'transaction_failed' || status === 'failed') {
        setError(t('moonpay_error_transaction_failed_9a2c1b7d5e', 'Transaction failed. Please try again.'));
        setStep('error');
      }

      // Utilisateur a fermé le widget
      if (type === 'close' || type === 'widget_closed') {
        handleWidgetClose();
      }
    };

    if (isOpen) {
      window.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [
    clearAutoOpen,
    clearFlowId,
    clearMoonpayWalletAddress,
    clearResumeState,
    currency,
    deactivateMoonpayActive,
    handleWidgetClose,
    isOpen,
    onClose,
    saveResumeState,
    targetAssetAmount,
    t,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (step !== 'awaiting_xrp') return;
    if (!walletAddress) return;

    let cancelled = false;

    const pollIncomingXrp = async () => {
      if (cancelled) return;
      try {
        const params = new URLSearchParams();
        params.set('address', String(walletAddress || ''));
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
          if (movementId && movementId === pendingSwapPollSeenRef.current) return false;
          const createdAtMs = movement?.createdAt ? new Date(movement.createdAt).getTime() : Number.NaN;
          if (Number.isFinite(awaitingXrpSince) && Number.isFinite(createdAtMs) && createdAtMs < awaitingXrpSince) {
            return false;
          }
          return Number.isFinite(resolveIncomingXrpAmount(movement));
        });

        if (!incomingXrp) return;

        const movementId = String(incomingXrp?.movementId || incomingXrp?._id || incomingXrp?.txHash || '').trim();
        pendingSwapPollSeenRef.current = movementId;
        const detectedAmount = resolveIncomingXrpAmount(incomingXrp);
        if (!Number.isFinite(detectedAmount) || detectedAmount <= 0) return;

        const preparedSwap = await xcannesApi.prepareRlusdXrpSwap({
          address: walletAddress,
          direction: 'XRP_TO_RLUSD',
          amountXrp: detectedAmount,
        });
        if (cancelled) return;

        setPendingSwapDetectedXrp(detectedAmount);
        setPendingSwapTxHash(String(incomingXrp?.txHash || '').trim());
        setPreparedInboundSwap(preparedSwap);
        saveResumeState({
          awaitingXrpSwap: true,
          awaitingXrpSince: Number.isFinite(awaitingXrpSince) && awaitingXrpSince > 0 ? awaitingXrpSince : Date.now(),
          detectedXrpAmount: detectedAmount,
          detectedXrpTxHash: String(incomingXrp?.txHash || '').trim(),
          targetCurrencyCode: pendingSwapTargetCurrency || currency,
          targetAssetAmount: String(targetAssetAmount || ''),
          preparedInboundSwap: preparedSwap,
        });
        setStep('swap_ready');
      } catch (pollError) {
        if (DEBUG_LOGS) {
          console.warn('[MoonPayBuyModal] XRP receipt poll failed:', pollError?.message || pollError);
        }
      }
    };

    pollIncomingXrp();
    const intervalId = window.setInterval(pollIncomingXrp, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    awaitingXrpSince,
    currency,
    isOpen,
    pendingSwapTargetCurrency,
    saveResumeState,
    step,
    targetAssetAmount,
    walletAddress,
  ]);

  const handleConvertReceivedXrpToRlusd = async () => {
    if (!signTransaction || !preparedInboundSwap?.txjson) {
      setError(
        t('moonpay_error_prepare_swap_buy_missing_signer', 'Wallet signature is required to convert the received XRP.'),
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setStep('swapping');
      const result = await signTransaction(preparedInboundSwap.txjson, {
        action: 'wallet:swap',
        progressDetails: {
          amountLabel: `${Number(pendingSwapDetectedXrp || 0).toLocaleString('en-US', {
            maximumFractionDigits: 6,
          })} XRP → RLUSD`,
          beneficiaryLabel: walletLabel || 'XCANNES',
          beneficiaryAddress: walletAddress,
        },
      });
      if (!result?.signed) {
        setError(t('moonpay_error_prepare_swap_buy_cancelled', 'XRPL swap was cancelled or expired.'));
        setStep('swap_ready');
        return;
      }

      const targetCurrency = String(pendingSwapTargetCurrency || currency || 'RLUSD')
        .trim()
        .toUpperCase();
      clearResumeState();
      setStep('success');
      setTimeout(() => {
        onClose?.();
        if (targetCurrency && targetCurrency !== 'RLUSD' && typeof window !== 'undefined') {
          window.setTimeout(() => {
            try {
              window.dispatchEvent(
                new CustomEvent('xcannes:wallet:open-convert', {
                  detail: { action: 'sell', base: 'RLUSD', quote: targetCurrency },
                }),
              );
            } catch {
              // ignore
            }
          }, 50);
        }
      }, 1800);
    } catch (swapError) {
      setError(
        swapError?.message ||
          t('moonpay_error_prepare_swap_buy_failed', 'Failed to convert the received XRP into RLUSD.'),
      );
      setStep('swap_ready');
    } finally {
      setLoading(false);
    }
  };

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, fiatCurrency]);

  useEffect(() => {
    setTargetAssetAmount('');
  }, [currency]);

  useEffect(() => {
    if (!isOpen) return;
    if (wizardStep !== 2) return;
    if (!hasValidTargetAmount) return;
    if (conversionMissing) return;
    if (!Number.isFinite(Number(rlusdEquivalent)) || Number(rlusdEquivalent) <= 0) return;

    const next = Number(Number(rlusdEquivalent).toFixed(6));
    if (!Number.isFinite(next) || next <= 0) return;

    setAmountType('crypto');
    setAmount(String(next));
  }, [conversionMissing, hasValidTargetAmount, isOpen, rlusdEquivalent, wizardStep]);

  const continueLabel = loading
    ? t('moonpay_action_loading_7c2b1d9a3e', 'Loading...')
    : demoMode
      ? t('moonpay_action_simulate_buy_5a1c9d7b3e', 'Simulate buy')
      : t('moonpay_action_continue_buy_8d2a1c6b9f', 'Continuer');
  const continueDisabled =
    loading || !hasValidTargetAmount || conversionMissing;

  const handleContinue = () => {
    if (wizardStep === 1) {
      if (useSimpleSwapPartner && typeof onProceedToUsdSwapOut === 'function') {
        const resolved = Number(rlusdEquivalent);
        const prefill =
          Number.isFinite(resolved) && resolved > 0
            ? String(Number(resolved.toFixed(6)))
            : String(targetAssetAmount || '').trim();
        onProceedToUsdSwapOut(prefill, {
          direction: 'stable_to_rlusd',
          accentVariant: 'simpleSwapBlue',
        });
        return;
      }
      generateBuyUrl();
      return;
    }
    generateBuyUrl();
  };

  const highlightPaymentMethods = text => {
    const input = String(text || '');
    if (!input) return text;
    const methods = ['carte bancaire', 'Apple Pay', 'Google Pay', 'virement'];
    const parts = input.split(
      new RegExp(`(${methods.map(m => m.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')).join('|')})`, 'g'),
    );
    return parts.map((part, idx) =>
      methods.includes(part) ? (
        <span key={idx} className={[accentText90, 'font-semibold'].join(' ')}>
          {part}
        </span>
      ) : (
        <span key={idx}>{part}</span>
      ),
    );
  };

  const shouldAnimate = !embedded;
  const { shouldRender, isClosing } = useModalTransition(isOpen, {
    enabled: shouldAnimate,
  });

  if (embedded) {
    if (!isOpen) return null;
  } else if (!shouldRender) {
    return null;
  }

  // Mode embedded: retourner seulement le contenu
  const renderContent = () => (
    <div ref={contentRootRef} className={embedded ? 'relative' : 'relative p-4 md:p-5'}>
      <style jsx global>{`
        .xcannes-no-number-spin::-webkit-outer-spin-button,
        .xcannes-no-number-spin::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .xcannes-no-number-spin {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>
      {/* Form */}
      {step === 'form' && (
        <div className='space-y-5'>
          {/* Title + Wallet pill */}
          {wizardStep === 1 ? (
	            <div className="relative z-[120] px-4 pt-2 pb-4 text-center">
              {/* Desktop: bouton ← Retour vers "Gérer vos fonds" (embedded) */}
              {embedded ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="hidden md:inline-flex absolute left-0 md:left-[-15px] top-2 md:top-[-10px] items-center gap-2 text-white/70 hover:text-white transition-colors"
                  aria-label={t('back', 'Back')}
                >
                  <ChevronLeftIcon className="w-4 h-4" aria-hidden="true" />
                  <span className="text-xs">{t('ui_back', 'Retour')}</span>
                </button>
              ) : null}
              <h3 className="text-[30px] md:text-[34px] font-bold text-white/95 tracking-tight mb-1">
                {resolvedTitleOverride || t('ui_funds_add_title', 'Ajouter des fonds')}
              </h3>
              {!demoMode && !useSimpleSwapPartner ? (
                <div className="mb-4 flex flex-col items-center">
                  <p className="mt-2 text-[14px] md:text-[15px] text-white/80 max-w-[34ch] mx-auto leading-relaxed text-center">
                    {t('moonpay_buy_payment_methods_list', 'Payez par carte, Apple Pay, Google Pay ou virement bancaire.')}
                  </p>
                </div>
              ) : null}
	              <div className="flex justify-center">
	                <div className={`inline-flex flex-col items-center gap-1 bg-elevated px-6 py-2 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)] ${assetDropdownOpen ? 'ring-1 ring-white/20 ring-inset' : ''}`}>
                  <span className="text-white/70 text-[14px] md:text-[15px] font-medium tracking-wide">
                    {t('moonpay_from_account', 'Compte de réception')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={['h-3 w-3 rounded-full ring-4 shrink-0 animate-pulse', accentRing25Bg].join(' ')}
                      aria-hidden
                    />
                    <span className="text-white/95 text-[14px] md:text-[15px] font-semibold">
                      {walletLabel || 'XCANNES'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Currency selector */}
          {wizardStep === 1 ? (
		            <div className="relative z-[120]">
              <div className="text-[13px] tracking-normal font-medium text-white/55 mb-2">
                {t('moonpay_buy_receive_currency_label', 'Devise à recevoir')}
              </div>
	              <ModalSelect
	                value={currency}
	                onChange={(val) => setCurrency(String(val || '').toUpperCase())}
	                onOpenChange={setAssetDropdownOpen}
	                portalTarget={embedded ? contentRootRef.current : modalPanelRef.current}
	                options={(supportedCurrencies || []).map((opt) => {
	                  const labelLeftText = opt.labelLeft || opt.label || opt.code;
	                  const isSelected = String(opt.code) === String(currency || '');
                  const labelRight = !assetDropdownOpen && isSelected
                    ? (
                      <span className="inline-flex items-center gap-[3px] text-[10px] text-white/30 tracking-normal font-normal">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="opacity-50 shrink-0">
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.5"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                        <span>{t('ui_balances_short_label_aa12', 'Solde disponible')}</span>
                      </span>
                    )
                    : (opt.amountLabel
                        ? fmtAmountRight(opt.amountLabel)
                        : null);
                  return {
                    value: opt.code,
                    icon: opt.icon,
                    label: labelLeftText,
                    labelLeft: <span className="md:text-[1.12em]">{labelLeftText}</span>,
                    labelRight,
                    labelMobile: opt.labelMobile || labelLeftText,
                  };
                })}
                useNativeSelect={false}
                hideSelected
                showMobileOptionRight={true}
                iconClassName="text-3xl leading-none"
                optionIconClassName="text-2xl leading-none opacity-60"
                optionClassName="py-2 md:py-2.5 !text-base md:!text-lg !text-white/60"
                menuHeader={t('ui_your_balances_header', 'Vos soldes')}
	                backdropClassName=""
                buttonClassName={modalSelectButtonCls}
                openButtonClassName="!bg-white/10 !border !border-white/10 !border-b-0 !rounded-b-none !ring-1 !ring-white/10 !shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                menuClassName={noticeVariant === 'demo' ? 'bg-xcannes-surface-demo !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px] max-h-[450px]' : 'bg-[#101415] !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px] max-h-[450px]'}
                selectClassName={modalSelectListCls}
              />
            </div>
          ) : null}

          {wizardStep === 1 ? (
            <div>
              <div className="text-[13px] tracking-normal font-medium text-white/55 mb-2">
                {t('moonpay_buy_selected_asset_amount', 'Montant')}
              </div>
              <div className="relative z-[2] bg-[#111518] rounded-[18px] p-0">
              <div className={[
                'relative flex items-center gap-3 px-5 pt-5 pb-5 rounded-[18px] bg-black/40 backdrop-blur-sm ring-1 ring-white/10 ring-inset transition-all duration-200 overflow-hidden wallet-amount-shimmer',
                'shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)]',
                'focus-within:ring-white/25 focus-within:shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.10),0_0_24px_rgba(255,255,255,0.06)]',
              ].join(' ')}>
                <input
                  type="number"
                  value={targetAssetAmount}
                  onChange={wizardStep === 1 ? e => setTargetAssetAmount(e.target.value) : undefined}
                  placeholder={t('ui_enter_amount_placeholder', '0.00')}
                  step="0.0001"
                  min="0"
                  inputMode="decimal"
                  readOnly={wizardStep !== 1}
                  className={[
                    'xcannes-no-number-spin flex-1 min-w-0 bg-transparent text-white text-4xl md:text-5xl font-bold placeholder:text-white/35 focus:outline-none transition-all duration-150',
                    wizardStep !== 1 ? 'cursor-default opacity-95' : '',
                  ].join(' ')}
                />
                <span className="shrink-0 text-white/70 drop-shadow-sm text-2xl md:text-3xl font-semibold">
                  {String(currency || '').toUpperCase()}
                </span>
              </div>
            </div>{/* /wrapper opaque */}
            {isCurrencyLine && hasValidTargetAmount && !conversionMissing && currencyUpper !== 'RLUSD' ? (
              <div className="mt-2 flex items-center gap-1.5 text-[13px] text-white/50">
                <span>≈</span>
                <span className="font-semibold text-white/70">
                  {Number.isFinite(rlusdEquivalent)
                    ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rlusdEquivalent)
                    : '—'}
                </span>
                <span>RLUSD</span>
              </div>
            ) : null}
            {!demoMode && hasValidTargetAmount && !conversionMissing && xrpPreviewAmount !== null ? (
              <div className="mt-1 flex items-center gap-1.5 text-[13px] text-white/40">
                <span>≈</span>
                <span className="font-semibold text-white/55">
                  {new Intl.NumberFormat(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(xrpPreviewAmount)}
                </span>
                <span>XRP</span>
              </div>
            ) : null}
            {isCurrencyLine && hasValidTargetAmount && conversionMissing ? (
              <p className="mt-2 text-[11px] text-red-300">
                {t('ui_rate_unavailable_base_5c1a9b7d2e', 'Rate unavailable for base currency.')}
              </p>
            ) : null}

            {hasValidTargetAmount && !conversionMissing ? (
              <div className="mt-4 space-y-1">
                <p className="text-[13px] text-white/55">
                  {t('ui_buy_summary_line', {
                    defaultValue: 'Vous ajoutez {{amount}} {{currency}} à votre compte.',
                    amount: new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(targetAmountValue),
                    currency: String(currency || '').toUpperCase(),
                  })}
                </p>
                <button
                  type="button"
                  onClick={() => setOpDetailsOpen(true)}
                  className={['text-[13px] font-medium underline underline-offset-2 transition-opacity hover:opacity-80', accentText80].join(' ')}
                >
                  {t('ui_op_details_link', 'Détails de l\'opération')}
                </button>
              </div>
            ) : null}
            </div>
          ) : null}

          <div className="px-1 py-2 text-[15px] md:text-sm leading-snug text-white/85">
            {demoMode ? (
              highlightPaymentMethods(
                t('moonpay_info_buy_demo_1b7d2c9a5e', 'Mode démo : pas de redirection MoonPay. L'achat est simulé.'),
              )
            ) : (
              <>
                {useSimpleSwapPartner ? (
                  <p className="whitespace-pre-line">
                    {t(
                      'ui_simpleswap_choose_conversion_stablecoin_and_network_0c0b2b64d1',
                      'Vous choisirez le stablecoin de conversion (USDC, USDT…)\net le réseau sur la page suivante (SimpleSwap)',
                    )}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {/* Error message */}
                  </div>
                  <div className="text-white text-[36px] md:text-[42px] font-semibold tracking-tight leading-none">
                    {hasValidTargetAmount
                      ? formatAmountWithCode(targetAmountValue, currencyUpper, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })
                      : `— ${currencyUpper}`}
                  </div>
                  {/* Internal XCANNES accounting is backed by RLUSD — keep it out of this summary UI. */}
                  {resolvedMoonpayBaseFiatCurrencyCode !== String(fiatCurrency || '').toUpperCase() ? (
                    <div className="mt-2 text-[12px] md:text-[13px] text-white/55">
                      {t('moonpay_buy_fiat_fallback_note', {
                        defaultValue: 'Paiement en {{currency}} (devise non supportée → fallback).',
                        currency: resolvedMoonpayBaseFiatCurrencyCode,
                      })}
                    </div>
                  ) : null}

                  {reviewTimestampLabel ? (
                    <div className="mt-5 text-[15px] md:text-[16px] text-white/55">{reviewTimestampLabel}</div>
                  ) : null}

                  <div className="my-5 h-px bg-white/10" aria-hidden />

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white">
                      <span
                        className={['h-2.5 w-2.5 rounded-full ring-4 shrink-0 animate-pulse', accentRing25Bg].join(' ')}
                        aria-hidden
                      />
                      <span className="font-semibold text-[18px] md:text-[20px] truncate">
                        {walletLabel || 'XCANNES'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setWalletAddressExpanded(prev => !prev)}
                        aria-expanded={walletAddressExpanded}
                        title={walletAddress}
                        className={[
                          'min-w-0 flex-1 text-left font-mono transition-colors',
                          walletAddressExpanded
                            ? 'text-[15px] md:text-[17px] break-all'
                            : 'text-[15px] md:text-[17px] whitespace-nowrap',
                          'text-white/70 hover:text-white',
                        ].join(' ')}
                      >
                        {walletAddressExpanded ? walletAddress : truncateMiddle(walletAddress)}
                      </button>
                      <button
                      type="button"
                      onClick={handleCopyWalletAddress}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] md:text-xs font-semibold ring-1 ring-white/10 bg-elevated text-white/70 hover:text-white hover:ring-white/20 transition-colors"
                      aria-label={t('ui_copy_address', 'Copier')}
                    >
                      {walletAddressCopied ? t('ui_copied', 'Copié') : t('ui_copy', 'Copier')}
                    </button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2 text-[16px] md:text-[18px]">
                    <div className="flex items-center justify-between gap-4 text-white/75">
                      <span>{t('ui_summary_estimated_fees', 'Frais estimés')}</span>
                    </div>
                    {moonpayFeeEstimates || fallbackMoonpayFeeEstimates ? (
                      <div className="space-y-1 text-[13px] md:text-sm text-white/70">
                        {(moonpayFeeEstimates || fallbackMoonpayFeeEstimates).map(item => (
                          <div key={item.key} className="flex items-center justify-between gap-3">
                            <span className="truncate">{item.label}</span>
                            <span className="shrink-0 text-white/85 font-medium text-right">
                              {formatAmountWithCode(item.amount, currencyUpper, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        ))}
                        <div className="pt-1 text-[11px] md:text-xs text-white/45">
                          {t(
                            'moonpay_fee_estimate_note',
                            'Estimations indicatives — les frais exacts dépendent de la méthode choisie dans MoonPay.',
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div
                  className={[
                    'mt-3 rounded-[20px] px-4 py-4 md:px-5 md:py-6 ring-1 ring-white/10 ring-inset bg-[#101415]',
                    'shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]',
                  ].join(' ')}
                >
                  <div className="space-y-1.5 text-[15px] md:text-sm leading-snug">
                    <div className="font-semibold text-white">
                      {t('ui_buy_summary_how_it_works_title', 'Comment ça marche ?')}
                    </div>
                    <div className="text-white/70">
                      {t('ui_buy_summary_how_it_works_step_1', '1. Paiement sécurisé (carte, Apple Pay…)')}
                    </div>
                    <div className="text-white/70">
                      {t('ui_buy_summary_how_it_works_step_2', "2. Achat de l'actif système XRPL (XRP)")}
                    </div>
                    <div className="text-white/70">
                      {t('ui_buy_summary_how_it_works_step_3', '3. Conversion et crédit sur votre compte')}
                    </div>
                    <div className={`pt-1 font-semibold ${accentText80}`}>
                      {t('ui_buy_summary_how_it_works_success', '✓ Tout est automatique — vous validez simplement')}
                    </div>
                  </div>
                  {!useSimpleSwapPartner ? (
                    <p className="mt-2 text-[11px] md:text-xs text-white/45">
                      {t('moonpay_buy_partner_location_note', 'Le partenaire proposé dépend de votre localisation.')}
                    </p>
                  ) : null}
                </div>
              </>
            ) : demoMode ? (
              highlightPaymentMethods(
                t('moonpay_info_buy_demo_1b7d2c9a5e', 'Mode démo : pas de redirection MoonPay. L’achat est simulé.'),
              )
            ) : (
              <>
                {useSimpleSwapPartner ? (
                  <p className="whitespace-pre-line">
                    {t(
                      'ui_simpleswap_choose_conversion_stablecoin_and_network_0c0b2b64d1',
                      'Vous choisirez le stablecoin de conversion (USDC, USDT…)\net le réseau sur la page suivante (SimpleSwap)',
                    )}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {/* Error message */}
          {displayError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-[20px]">
              <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{displayError}</p>
            </div>
          )}

          {/* Continue button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleContinue();
            }}
            disabled={continueDisabled}
            className={[
              "md:hidden w-full h-14 rounded-[20px] text-white text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
              continueDisabled
                ? "opacity-45 cursor-not-allowed"
                : "hover:scale-[1.01] active:scale-[0.98]",
            ].join(" ")}
            style={continueDisabled
              ? { background: 'linear-gradient(180deg, rgba(34,154,86,0.65) 0%, rgba(14,103,58,0.65) 100%)' }
              : { background: 'linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
            }
          >
            {continueLabel}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={continueDisabled}
            className={[
              "hidden md:flex items-center justify-center w-full h-14 rounded-[20px] text-white text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
              continueDisabled
                ? "opacity-45 cursor-not-allowed"
                : "hover:scale-[1.01] active:scale-[0.98]",
            ].join(" ")}
            style={continueDisabled
              ? { background: 'linear-gradient(180deg, rgba(34,154,86,0.65) 0%, rgba(14,103,58,0.65) 100%)' }
              : { background: 'linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
            }
          >
            {continueLabel}
          </button>
		          {!demoMode && !useSimpleSwapPartner ? (
		            <div className="text-center text-[12px] md:text-[13px] text-white/55 mt-1 leading-snug">
		              <p>{t('moonpay_info_buy_live_3c8a1d6b2f', 'Paiement sécurisé via MoonPay ou Topper.')}</p>
		              <p>{t('moonpay_buy_partner_location_note_cta', 'Conversion automatique si nécessaire.')}</p>
		            </div>
		          ) : null}
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center py-12">
          <div
            className={[
              'animate-spin rounded-full h-12 w-12 border-b-2 mb-4',
              useSimpleSwapPartner ? 'border-[#0870f8]' : 'border-xcannes-green',
            ].join(' ')}
          />
          <p className="text-white/80">{t('moonpay_loading_widget', 'Loading MoonPay widget...')}</p>
        </div>
      )}

      {step === 'awaiting_xrp' && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className={[
              'animate-pulse rounded-full h-12 w-12 mb-4 ring-4',
              useSimpleSwapPartner ? 'ring-[#0870f8]/25 bg-[#0870f8]' : 'ring-xcannes-green/25 bg-xcannes-green',
            ].join(' ')}
          />
          <h4 className="text-xl font-bold text-white mb-2">
            {t('moonpay_buy_waiting_xrp_title', 'En attente du XRP')}
          </h4>
          <p className="text-white/60 text-center mb-4 max-w-md">
            {t(
              'moonpay_buy_waiting_xrp_body',
              'MoonPay est terminé. Dès que le XRP arrive sur votre wallet XCANNES, nous préparons la conversion XRPL vers RLUSD.',
            )}
          </p>
          <button
            type="button"
            onClick={handleWidgetClose}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-[20px] transition-colors"
          >
            {t('close', 'Close')}
          </button>
        </div>
      )}

      {step === 'swap_ready' && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircleIcon
            className={['w-16 h-16 mb-4', useSimpleSwapPartner ? 'text-[#0870f8]' : 'text-xcannes-green'].join(' ')}
          />
          <h4 className="text-xl font-bold text-white mb-2">{t('moonpay_buy_swap_ready_title', 'XRP reçu')}</h4>
          <p className="text-white/60 text-center mb-2 max-w-md">
            {t(
              'moonpay_buy_swap_ready_body',
              'Le XRP a été détecté sur votre wallet. Vous pouvez maintenant signer la conversion XRPL vers RLUSD.',
            )}
          </p>
          {Number.isFinite(Number(pendingSwapDetectedXrp)) && Number(pendingSwapDetectedXrp) > 0 ? (
            <div className="mb-5 rounded-[20px] bg-white/5 ring-1 ring-white/10 px-4 py-3 text-white/85">
              {Number(pendingSwapDetectedXrp).toLocaleString('en-US', {
                maximumFractionDigits: 6,
              })}{' '}
              XRP
            </div>
          ) : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConvertReceivedXrpToRlusd}
              className={`px-6 py-2 text-black font-semibold rounded-[20px] transition-colors ${
                useSimpleSwapPartner ? 'bg-[#0870f8] hover:bg-[#0765df]' : 'bg-xcannes-green hover:bg-xcannes-green/90'
              }`}
            >
              {t('moonpay_buy_swap_ready_action', 'Signer le swap XRP → RLUSD')}
            </button>
            <button
              type="button"
              onClick={handleWidgetClose}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-[20px] transition-colors"
            >
              {t('close', 'Close')}
            </button>
          </div>
        </div>
      )}

      {step === 'swapping' && (
        <div className="flex flex-col items-center justify-center py-12">
          <div
            className={[
              'animate-spin rounded-full h-12 w-12 border-b-2 mb-4',
              useSimpleSwapPartner ? 'border-[#0870f8]' : 'border-xcannes-green',
            ].join(' ')}
          />
          <p className="text-white/80">{t('moonpay_buy_swapping_label', 'Préparation du swap XRPL…')}</p>
        </div>
      )}

      {/* MoonPay iframe */}
      {step === 'iframe' && iframeUrl && (
        <div className="relative">
          <div className="relative" style={{ height: 'calc(100vh - 40px)', minHeight: '600px', maxHeight: '760px' }}>
            <iframe
              src={iframeUrl}
              className="w-full h-full rounded-[20px]"
              allow={moonpayIframeAllow}
              allowFullScreen
              title={t('moonpay_widget_title_buy', 'MoonPay Widget')}
            />
          </div>
        </div>
      )}

      {/* Success */}
      {step === 'success' && (
        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircleIcon
            className={['w-16 h-16 mb-4', useSimpleSwapPartner ? 'text-[#0870f8]' : 'text-green-400'].join(' ')}
          />
          <h4 className="text-xl font-bold text-white mb-2">
            {t('moonpay_buy_success_title', 'Transaction Completed!')}
          </h4>
          <p className="text-white/60 text-center mb-4">
            {t('moonpay_buy_success_body', 'Your crypto will be sent to your wallet shortly.')}
          </p>
          <button
            type="button"
            onClick={onClose}
            className={[
              'px-6 py-2 text-black font-semibold rounded-[20px] transition-colors',
              useSimpleSwapPartner ? 'bg-[#0870f8] hover:bg-[#0765df]' : 'bg-xcannes-green hover:bg-xcannes-green/90',
            ].join(' ')}
          >
            {t('close', 'Close')}
          </button>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="flex flex-col items-center justify-center py-12">
          <XCircleIcon className="w-16 h-16 text-red-400 mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">{t('moonpay_error_title', 'Something went wrong')}</h4>
          <p className="text-white/60 text-center mb-4">
            {displayError || t('moonpay_error_try_again_later_6f2b1c9d8a', 'Please try again later.')}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setError(null);
                setIframeUrl(null);
              }}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-[20px] transition-colors"
            >
              {t('try_again', 'Try Again')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={[
                'px-6 py-2 text-black font-semibold rounded-[20px] transition-colors',
                useSimpleSwapPartner ? 'bg-[#0870f8] hover:bg-[#0765df]' : 'bg-xcannes-green hover:bg-xcannes-green/90',
              ].join(' ')}
            >
              {t('close', 'Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Mode embedded: retourner seulement le contenu
  if (embedded) {
    return renderContent();
  }

  // Mode standalone: retourner le modal complet
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
          isClosing ? 'wallet-modal-backdrop-out' : 'wallet-modal-backdrop-in'
        }`}
        onClick={step === 'iframe' ? null : onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          ref={modalPanelRef}
          className={`relative w-full wallet-modal-panel max-w-2xl border rounded-2xl overflow-hidden pointer-events-auto shadow-2xl ${
            noticeVariant === 'demo' ? 'bg-xcannes-surface-demo border-white/10' : 'bg-elevated border-subtle'
          } ${isClosing ? 'wallet-modal-lift-out' : 'wallet-modal-lift-in'}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header — visible uniquement pendant l'iframe */}
          {step === 'iframe' && (
            <div className="flex items-center gap-3 p-4 md:p-5 border-b border-white/10">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                    {t('ui_buy_crypto_with_fiat_f09c7b4228', 'Buy Crypto with Fiat')}
                  </h3>
                  {noticeVariant === 'demo' ? (
                    <span className="inline-flex items-center text-white/80 text-xs md:text-sm font-semibold px-2 py-1 leading-none">
                      {t('demo_notice_title', 'Mode démo')}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-white/60 mt-1">
                  {t('ui_powered_by_moonpay_secure_ch_0bcfb2aeb5', 'Powered by MoonPay • Secure checkout')}
                </p>
              </div>
            </div>
          )}

          {/* Bouton fermer flottant — steps form/loading/error/success (pas iframe) */}
          {step !== 'iframe' && (
            <button
              type="button"
              onClick={handleUserClose}
              className="absolute top-4 right-4 z-20 text-white/60 hover:text-white transition-colors bg-transparent rounded-full w-10 h-10 flex items-center justify-center hover:bg-white/5"
              aria-label={t('close', 'Fermer')}
            >
              <span aria-hidden className="text-xl leading-none">✕</span>
            </button>
          )}

          {/* Content */}
          {renderContent()}
        </div>
      </div>

      {/* Bottom sheet — Détails de l'opération */}
      {opDetailsOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[10040] flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpDetailsOpen(false)}
          />
          {/* Sheet */}
          <div className="relative w-full bg-[#141414] rounded-t-3xl ring-1 ring-white/10 shadow-2xl px-6 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))] max-h-[85dvh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center mb-4">
              <span className="block w-10 h-1.5 rounded-full bg-white/20" aria-hidden />
            </div>

            {/* Title */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-white font-semibold text-lg leading-tight">
                {t('ui_op_details_title', 'Détails de l\'opération')}
              </h2>
              <button
                type="button"
                onClick={() => setOpDetailsOpen(false)}
                className="text-white/50 hover:text-white transition-colors text-xl leading-none p-1"
                aria-label={t('ui_close', 'Fermer')}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="space-y-5 text-[15px] leading-relaxed text-white/75">
              <p>
                {t('ui_op_details_p1', 'Le paiement est traité par notre partenaire.')}{' '}
                {xrpPreviewAmount !== null ? (
                  <span className="text-white/55">
                    ({t('ui_op_details_xrp_hint', {
                      defaultValue: '≈ {{xrp}} XRP',
                      xrp: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(xrpPreviewAmount),
                    })})
                  </span>
                ) : null}
              </p>
              <p>
                {t('ui_op_details_p2', 'Selon la liquidité disponible, une conversion automatique peut être utilisée pour créditer votre compte. XRP peut servir de bridge de liquidité pendant l\'opération.')}
              </p>
              <p>
                {t('ui_op_details_p3', 'Tout est automatique : vous validez simplement le paiement chez le partenaire.')}
              </p>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
};

export default MoonPayBuyModal;
