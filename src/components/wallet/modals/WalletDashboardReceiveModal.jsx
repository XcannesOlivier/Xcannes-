'use client';

import { Buffer } from 'buffer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useIsDesktop from '../hooks/useIsDesktop';
import { readWalletLabelCache } from '../hooks/walletLabelCache';
import { QRCodeCanvas } from 'qrcode.react';
import ModalSelect from '@/components/ui/ModalSelect';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { createPortal } from 'react-dom';
import { useTranslation } from 'next-i18next';
import { XRPL_KNOWN_ISSUERS } from '@/utils/xrpl';

import { useModalTransition } from '@/hooks/useModalTransition';
import { formatAmountWithSymbol } from '../walletDashboardConfig';
import { getCurrencyDescription } from '@/utils/currencyDescriptions';

const ShareIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const ChevronRightIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const EyeIcon = ({ className = '', slashed = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
    <circle cx="12" cy="12" r="2.6" />
    {slashed ? <path d="M4 20L20 4" /> : null}
  </svg>
);

const CopyIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M9 9h10v12H9z" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
);

const ShareAddressIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 512 512"
    fill="none"
    stroke="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="m 111.4077,90.352932 h 210 q 30,0 30,29.999998 v 70" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m 111.4077,90.352932 q -30,0 -30,29.999998 v 270 q 0,30 30,30 h 190" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="211.4077" cy="180.35294" r="40" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m 161.4077,270.35293 q 0,-50 50,-50 50,0 50,50 z" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="151.4077" y1="320.35294" x2="261.40771" y2="320.35294" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="151.4077" y1="360.35294" x2="231.4077" y2="360.35294" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m 331.4077,230.35293 a 110,110 0 0 1 150,40" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m 482.23792,248.22696 -1.2558,23.90549 -18.84109,-8.17252" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="380.40771" cy="340.35294" r="95" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="332.08789" cy="337.79172" r="16" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="412.25491" cy="299.17853" r="16" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="416.71741" cy="382.14252" r="16" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="346.5" y1="330.8" x2="397.8" y2="306.1" strokeWidth="14" strokeLinecap="round" />
    <line x1="346.3" y1="345.2" x2="402.5" y2="374.7" strokeWidth="14" strokeLinecap="round" />
  </svg>
);

const RequestIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 512 512"
    fill="none"
    stroke="currentColor"
    className={className}
    aria-hidden="true"
  >
    {/* Speech bubble — a payment "ask" */}
    <path
      d="M96 132 q0 -40 40 -40 h240 q40 0 40 40 v160 q0 40 -40 40 H236 l-72 72 v-72 h-28 q-40 0 -40 -40 Z"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Dollar sign inside bubble (thick) */}
    <line x1="256" y1="130" x2="256" y2="298" strokeWidth="14" strokeLinecap="round" />
    <path
      d="M302 168 q-16 -22 -46 -22 q-40 0 -40 34 q0 28 40 34 q40 6 40 36 q0 34 -40 34 q-30 0 -48 -22"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Small accent network — like share icon */}
    <circle cx="430" cy="380" r="14" strokeWidth="14" />
    <circle cx="378" cy="432" r="10" strokeWidth="14" />
    <circle cx="452" cy="442" r="6" strokeWidth="14" />
    <line x1="420" y1="392" x2="386" y2="424" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="438" y1="392" x2="448" y2="430" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

export default function WalletDashboardReceiveModal({
  open,
  onClose,
  noticeVariant = 'preview',
  receiveTab,
  setReceiveTab,
  wallet,
  walletAddresses = [],
  onSwitchWallet,
  requestAmount,
  setRequestAmount,
  requestCurrency,
  setRequestCurrency,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  augmentedTokens,
  requestMemo,
  setRequestMemo,
  rlusdPerUnitRates,
  rlusdPerUnitSources,
  walletLabel,
  onRequestGenerated,
  inline = false,
}) {
  const { t, i18n } = useTranslation('common');
  const locale = i18n?.language || 'en';
  const fallbackWalletLabel = t('nav_wallet', 'Wallet');
  const trimmed = useCallback(value => String(value || '').trim(), []);
  const [generatedRequest, setGeneratedRequest] = useState(null);
  const [generateError, setGenerateError] = useState(null);
  const isDesktop = useIsDesktop();
  const [copyToast, setCopyToast] = useState('');
  const copyToastTimerRef = useRef(null);
  const autoCloseTimerRef = useRef(null);
  const [shareWalletDropdownOpen, setShareWalletDropdownOpen] = useState(false);
  const [requestWalletDropdownOpen, setRequestWalletDropdownOpen] = useState(false);
  const [requestCurrencyDropdownOpen, setRequestCurrencyDropdownOpen] = useState(false);
  const shareWalletDropdownRef = useRef(null);
  const [shareAddressModes, setShareAddressModes] = useState({});
  const [shareDropdownToast, setShareDropdownToast] = useState('');
  const shareDropdownToastTimerRef = useRef(null);
  const requestWalletDropdownRef = useRef(null);
  const [requestAddressModes, setRequestAddressModes] = useState({});
  const [requestDropdownToast, setRequestDropdownToast] = useState('');
  const requestDropdownToastTimerRef = useRef(null);
	  const receiveQrContainerRef = useRef(null);
	  const requestQrContainerRef = useRef(null);
	  const [qrZoomValue, setQrZoomValue] = useState(null);
	  const [localReceiveTab, setLocalReceiveTab] = useState('choice');

  const setReceiveTabSafe = setReceiveTab || setLocalReceiveTab;
  const rawReceiveTab = receiveTab != null ? receiveTab : localReceiveTab;
  const receiveView = useMemo(() => {
    const tab = String(rawReceiveTab || '')
      .trim()
      .toLowerCase();
    if (tab === 'choice' || tab === 'select') return 'choice';
    if (tab === 'request' || tab === 'payreq' || tab === 'create') return 'request';
    if (tab === 'request_qr' || tab === 'requestqr' || tab === 'request-qr' || tab === 'request_preview') return 'request_qr';
    if (tab === 'share' || tab === 'receive') return 'share';
    return 'choice';
  }, [rawReceiveTab]);

  const switchReceiveView = useCallback(
    nextView => {
      setGenerateError(null);
      setCopyToast('');
      setShareWalletDropdownOpen(false);
      setRequestWalletDropdownOpen(false);
      setRequestCurrencyDropdownOpen(false);
      setReceiveTabSafe(nextView);
    },
    [setReceiveTabSafe, setShareWalletDropdownOpen, setRequestCurrencyDropdownOpen, setRequestWalletDropdownOpen],
  );

  const showShareDropdownToast = useCallback((message) => {
    setShareDropdownToast(message);
    if (shareDropdownToastTimerRef.current) clearTimeout(shareDropdownToastTimerRef.current);
    shareDropdownToastTimerRef.current = setTimeout(() => setShareDropdownToast(''), 3000);
  }, []);

  const showRequestDropdownToast = useCallback((message) => {
    setRequestDropdownToast(message);
    if (requestDropdownToastTimerRef.current) clearTimeout(requestDropdownToastTimerRef.current);
    requestDropdownToastTimerRef.current = setTimeout(() => setRequestDropdownToast(''), 3000);
  }, []);

  const requestCurrencyCode = useMemo(
    () =>
      String(requestCurrency || '')
        .trim()
        .toUpperCase(),
    [requestCurrency],
  );

  const selectedRequestToken = useMemo(() => {
    return (augmentedTokens || []).find(t => String(t?.currency || '').toUpperCase() === requestCurrencyCode) || null;
  }, [augmentedTokens, requestCurrencyCode]);

  useEffect(() => {
    if (!open) {
      setGeneratedRequest(null);
      setGenerateError(null);
      setShareWalletDropdownOpen(false);
      setRequestWalletDropdownOpen(false);
      setRequestCurrencyDropdownOpen(false);
      if (!setReceiveTab) setLocalReceiveTab('choice');
    }
  }, [open, setReceiveTab]);

  useEffect(() => {
    if (!shareWalletDropdownOpen) {
      setShareAddressModes({});
      setShareDropdownToast('');
      if (shareDropdownToastTimerRef.current) clearTimeout(shareDropdownToastTimerRef.current);
    }
  }, [shareWalletDropdownOpen]);

  useEffect(() => {
    if (!requestWalletDropdownOpen) {
      setRequestAddressModes({});
      setRequestDropdownToast('');
      if (requestDropdownToastTimerRef.current) clearTimeout(requestDropdownToastTimerRef.current);
    }
  }, [requestWalletDropdownOpen]);

  useEffect(() => {
    setShareAddressModes({});
    setShareDropdownToast('');
    if (shareDropdownToastTimerRef.current) clearTimeout(shareDropdownToastTimerRef.current);
  }, [wallet]);

  useEffect(() => {
    setRequestAddressModes({});
    setRequestDropdownToast('');
    if (requestDropdownToastTimerRef.current) clearTimeout(requestDropdownToastTimerRef.current);
  }, [wallet]);

  useEffect(() => {
    if (!shareWalletDropdownOpen) return;
    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target) return;
      if (shareWalletDropdownRef.current && shareWalletDropdownRef.current.contains(target)) return;
      setShareWalletDropdownOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [shareWalletDropdownOpen]);

  useEffect(() => {
    if (!requestWalletDropdownOpen) return;
    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target) return;
      if (requestWalletDropdownRef.current && requestWalletDropdownRef.current.contains(target)) return;
      setRequestWalletDropdownOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [requestWalletDropdownOpen]);

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) {
        window.clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = null;
      }
      if (autoCloseTimerRef.current) {
        window.clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
      if (shareDropdownToastTimerRef.current) {
        clearTimeout(shareDropdownToastTimerRef.current);
        shareDropdownToastTimerRef.current = null;
      }
      if (requestDropdownToastTimerRef.current) {
        clearTimeout(requestDropdownToastTimerRef.current);
        requestDropdownToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setGeneratedRequest(null);
    setGenerateError(null);
  }, [wallet, requestAmount, requestCurrency, requestMemo]);

  const activeWalletLabel = useMemo(() => {
    const direct = trimmed(walletLabel);
    if (direct) return direct;
    const entry = (walletAddresses || []).find(w => (typeof w === 'string' ? w === wallet : w?.address === wallet));
    const fromList = typeof entry === 'string' ? '' : trimmed(entry?.label);
    return fromList || fallbackWalletLabel;
  }, [fallbackWalletLabel, trimmed, wallet, walletAddresses, walletLabel]);

  const activeWalletQrLabel = useMemo(() => {
    const direct = trimmed(walletLabel);
    if (direct) return direct;
    const entry = (walletAddresses || []).find(w => (typeof w === 'string' ? w === wallet : w?.address === wallet));
    const fromList = typeof entry === 'string' ? '' : trimmed(entry?.label);
    return fromList || '';
  }, [trimmed, wallet, walletAddresses, walletLabel]);

  const walletList = useMemo(() => {
    const list = Array.isArray(walletAddresses) ? walletAddresses : [];
    if (!wallet) return list;
    const hasActive = list.some(w => (typeof w === 'string' ? w === wallet : w?.address === wallet));
    if (list.length > 0) return hasActive ? list : [wallet, ...list];
    return [wallet];
  }, [wallet, walletAddresses]);
  const hasMultipleWallets = (walletList || []).length > 1;

  const shortAddress = useCallback(
    (addr, left = 6, right = 4) => {
      const s = trimmed(addr);
      if (!s) return '';
      if (s.length <= left + right + 3) return s;
      return `${s.slice(0, left)}...${s.slice(-right)}`;
    },
    [trimmed],
  );

	  const walletOptions = useMemo(() => {
      const cachedLabelsByAddress =
        typeof window === 'undefined' ? {} : readWalletLabelCache();
	    return (walletList || [])
	      .map((w, idx) => {
	        const addr = typeof w === 'string' ? w : w?.address;
	        if (!addr) return null;
	        const labelFromList = typeof w === 'string' ? '' : trimmed(w?.label);
          const cachedLabel = String(cachedLabelsByAddress?.[addr] || '').trim();
	        const label =
            addr === wallet
              ? activeWalletLabel
              : labelFromList || cachedLabel || shortAddress(addr, 8, 8) || `Wallet ${idx + 1}`;
	        const isActive = addr === wallet;
	        return {
	          value: addr,
	          icon: (
	            <span
	              className={[
	                'inline-flex h-2 w-2 rounded-full ring-4 shrink-0',
	                isActive
	                  ? 'ring-xcannes-green/25 bg-xcannes-green animate-pulse'
	                  : 'ring-white/10 bg-white/30',
	              ].join(' ')}
	              aria-hidden="true"
	            />
	          ),
	          label,
	          labelLeft: label,
	          labelRight: <span className="font-mono font-light">{shortAddress(addr)}</span>,
	          labelMobile: label,
	        };
	      })
	      .filter(Boolean);
	  }, [activeWalletLabel, shortAddress, trimmed, wallet, walletList]);

	  const shareWalletOptions = useMemo(() => {
      return walletOptions.map(opt => ({
        ...opt,
        labelRight: undefined,
        description: <span className="font-mono font-light">{shortAddress(opt.value, 8, 8)}</span>,
      }));
    }, [shortAddress, walletOptions]);

	  const accountDropdownOpenPillClassName = "rounded-3xl rounded-b-none after:content-[''] after:absolute after:inset-0 after:rounded-3xl after:rounded-b-none after:border after:border-white/25 after:border-b-0 after:pointer-events-none after:z-[1]";
	  const accountDropdownMenuClassName = inline
      ? 'bg-[#0f1314] box-border !mt-0 flex flex-col border border-white/25 border-t-0 rounded-b-[20px] shadow-[0_0_0_1px_rgba(0,0,0,0.75),-14px_22px_42px_rgba(0,0,0,0.72),14px_22px_42px_rgba(0,0,0,0.72),0_28px_56px_rgba(0,0,0,0.78)] !z-[10020]'
      : 'bg-[#0f1314] box-border !mt-0 flex flex-col border border-white/25 border-t-0 rounded-b-[20px] shadow-[0_0_0_1px_rgba(0,0,0,0.9),-12px_20px_40px_rgba(0,0,0,0.85),12px_20px_40px_rgba(0,0,0,0.85),0_28px_70px_rgba(0,0,0,0.90)] !z-[10020]';

  const isFxRequest = useMemo(() => {
    if (!selectedRequestToken?.isTrustlineOnly) return false;
    if (!requestCurrencyCode) return false;
    return requestCurrencyCode !== 'XRP' && requestCurrencyCode !== 'RLUSD' && requestCurrencyCode !== 'USD';
  }, [requestCurrencyCode, selectedRequestToken?.isTrustlineOnly]);

  const generateButtonDisabled = useMemo(() => {
    const amount = Number.parseFloat(requestAmount || '0');
    if (!Number.isFinite(amount) || amount <= 0) return true;
    if (!trimmed(wallet)) return true;

    const targetCurrencyUpper = String(requestCurrencyCode || 'USD').toUpperCase();
    if (targetCurrencyUpper === 'USD' || targetCurrencyUpper === 'RLUSD') return false;

    const rate = Number(rlusdPerUnitRates?.[targetCurrencyUpper]);
    return !Number.isFinite(rate) || rate <= 0;
  }, [requestAmount, requestCurrencyCode, rlusdPerUnitRates, trimmed, wallet]);

  const handleGenerateRequest = () => {
    setGenerateError(null);

    const amount = Number.parseFloat(requestAmount || '0');
    if (!Number.isFinite(amount) || amount <= 0) {
      setGenerateError(t('ui_request_error_invalid_amount_5bd214c9a7', 'Please enter a valid amount.'));
      return;
    }

    if (!wallet) {
      setGenerateError(t('ui_request_error_missing_wallet_4f7a2c9b1e', 'Wallet address is missing.'));
      return;
    }

    const targetCurrencyCode = requestCurrencyCode || 'USD';
    const targetCurrencyUpper = String(targetCurrencyCode || '').toUpperCase();
    const displayCurrencyUpper = targetCurrencyUpper === 'RLUSD' ? 'USD' : targetCurrencyUpper;
    let amountRlusd = null;
    let fxRate = null;
    let fxSource = null;

    if (targetCurrencyUpper === 'RLUSD' || targetCurrencyUpper === 'USD') {
      amountRlusd = amount;
      fxRate = 1;
      fxSource = 'FAWAZ';
    } else {
      const rate = Number(rlusdPerUnitRates?.[targetCurrencyUpper]);
      if (!Number.isFinite(rate) || rate <= 0) {
        setGenerateError(
          t('ui_request_error_rate_unavailable_8c2e1a7b5d', {
            defaultValue: 'Rate unavailable for {{currency}}.',
            currency: targetCurrencyUpper,
          }),
        );
        return;
      }
      fxRate = rate;
      fxSource = rlusdPerUnitSources?.[targetCurrencyUpper] || null;
      amountRlusd = amount * rate;
    }

    const issuerCandidate = String(selectedRequestToken?.issuer || '').trim();
    const issuerLooksValid = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(issuerCandidate);
    // USD et RLUSD utilisent le même issuer on-chain (RLUSD)
    const knownIssuer =
      targetCurrencyUpper === 'RLUSD' || targetCurrencyUpper === 'USD' ? XRPL_KNOWN_ISSUERS.RLUSD : null;
    const issuer = isFxRequest ? null : knownIssuer || (issuerLooksValid ? issuerCandidate : null);

    const beneficiaryLabel = trimmed(activeWalletQrLabel) || null;
    const req = {
      schema: 'xcannes-payreq',
      to: wallet,
      targetCurrency: targetCurrencyUpper,
      displayAmount: amount,
      displayCurrency: displayCurrencyUpper,
      amountRlusd: Number.isFinite(amountRlusd) ? amountRlusd : null,
      fxRate,
      fxSource,
      issuer,
      memo: requestMemo || '',
      beneficiaryLabel,
      createdAt: new Date().toISOString(),
    };

    setGeneratedRequest(req);
    onRequestGenerated?.(req);
    switchReceiveView('request_qr');
  };

  const flashCopyToast = (message, autoClose = false) => {
    const text = String(message || '').trim();
    if (!text) return;
    setCopyToast(text);
    if (copyToastTimerRef.current) {
      window.clearTimeout(copyToastTimerRef.current);
    }
    if (autoCloseTimerRef.current) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    copyToastTimerRef.current = window.setTimeout(() => {
      setCopyToast('');
      copyToastTimerRef.current = null;
    }, 1300);
    // Auto-close the modal after the toast fades out
    if (autoClose) {
      autoCloseTimerRef.current = window.setTimeout(() => {
        autoCloseTimerRef.current = null;
        onClose();
      }, 1400);
    }
  };

  const dataUrlToBlob = url => {
    const parts = url.split(',');
    if (parts.length !== 2) return null;
    const mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
    const binary = atob(parts[1]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  };

  const buildQrBlob = (useRequest = hasGeneratedRequest) => {
    const container = useRequest ? requestQrContainerRef.current : receiveQrContainerRef.current;
    const canvas = container?.querySelector?.('canvas');
    if (!canvas) return null;
    const srcWidth = canvas.width;
    const srcHeight = canvas.height;
    const baseScale = useRequest ? 4 : 3;
    const marginRatio = useRequest ? 0.12 : 0.1;
    const margin = Math.max(24, Math.round(srcWidth * marginRatio));
    const maxExportWidth = 1600;
    const safeScale = Math.min(baseScale, maxExportWidth / (srcWidth + margin * 2));
    const scale = Math.max(1.8, safeScale);
    const exportCanvas = document.createElement('canvas');
    const exportWidth = Math.round((srcWidth + margin * 2) * scale);
    const baseHeight = (srcHeight + margin * 2) * scale;
    exportCanvas.width = exportWidth;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    const maxTextWidth = exportWidth - margin * scale * 2;
    const titleFontSize = Math.max(28, Math.round(exportWidth * 0.052));
    const labelFontSize = Math.max(28, Math.round(exportWidth * 0.052));
    const addressFontSize = Math.max(13, Math.round(exportWidth * 0.026));
    const metaFontSize = Math.max(16, Math.round(exportWidth * 0.032));
    const amountFontSize = Math.max(36, Math.round(exportWidth * 0.064));
    const brandFontSize = Math.max(11, Math.round(exportWidth * 0.022));
    // Accent color used for all text: green for the address QR, orange for the
    // payment request QR.
    const accentColor = useRequest ? '#f97316' : '#16a34a';
    const titleFont = `700 ${titleFontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    const labelFont = `600 ${labelFontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    const addressFont = `${addressFontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
    const metaFont = `${metaFontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    const amountFont = `700 ${amountFontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    const brandFont = `600 ${brandFontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;

    const wrapText = (text, font) => {
      if (!text) return [];
      ctx.font = font;
      const words = String(text).split(' ');
      const lines = [];
      let current = '';
      const pushCurrent = () => {
        if (current) {
          lines.push(current);
          current = '';
        }
      };
      words.forEach(word => {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width <= maxTextWidth) {
          current = test;
          return;
        }
        pushCurrent();
        if (ctx.measureText(word).width <= maxTextWidth) {
          current = word;
          return;
        }
        let chunk = '';
        for (const ch of word) {
          const next = `${chunk}${ch}`;
          if (ctx.measureText(next).width > maxTextWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk = next;
          }
        }
        if (chunk) {
          current = chunk;
        }
      });
      pushCurrent();
      return lines;
    };

    const textLines = [];
    const addLines = (text, font, color, lineHeight) => {
      wrapText(text, font).forEach(line => {
        textLines.push({ text: line, font, color, lineHeight });
      });
    };

    // Title at the top of the exported image (different label for payment requests)
    const titleText = useRequest
      ? t('ui_qr_share_title_request', 'QR code de demande de paiement')
      : t('ui_qr_share_title', "QR code d'adresse du compte");
    const titleLineHeight = Math.round(titleFontSize * 1.35);
    const titleLinesArr = wrapText(titleText, titleFont).map(line => ({
      text: line,
      font: titleFont,
      color: accentColor,
      lineHeight: titleLineHeight,
    }));
    const titleBlockHeight = titleLinesArr.reduce((sum, line) => sum + line.lineHeight, 0);
    const titleGap = titleLinesArr.length ? Math.round(titleFontSize * 0.7) : 0;

    const labelText = String(
      useRequest
        ? generatedRequest?.beneficiaryLabel || activeWalletLabel || fallbackWalletLabel
        : activeWalletLabel || fallbackWalletLabel,
    ).trim();
    const addressText = String(useRequest ? generatedRequest?.to || wallet || '' : wallet || '').trim();
    const amountLine = useRequest ? `${requestDisplayAmountLabel} ${requestDisplayCurrency}`.trim() : '';
    const dateLine = useRequest ? requestDateLabel : '';

    if (labelText) {
      addLines(labelText, labelFont, accentColor, Math.round(labelFontSize * 1.35));
    }
    if (addressText) {
      addLines(addressText, addressFont, '#ffffff', Math.round(addressFontSize * 1.35));
    }
    if (amountLine) {
      addLines(amountLine, amountFont, accentColor, Math.round(amountFontSize * 1.35));
    }
    if (dateLine) {
      addLines(dateLine, metaFont, '#ffffff', Math.round(metaFontSize * 1.35));
    }

    const textGap = textLines.length ? Math.round(labelFontSize * 0.8) : 0;
    const textBlockHeight = textLines.reduce((sum, line) => sum + line.lineHeight, 0);

    // Brand footer "XCANNES" — discreet under the address
    const brandLineHeight = Math.round(brandFontSize * 1.4);
    const brandGap = Math.round(brandFontSize * 1.2);

    exportCanvas.height = titleBlockHeight + titleGap + baseHeight + textGap + textBlockHeight + brandGap + brandLineHeight;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    const qrTopOffset = titleBlockHeight + titleGap;
    const offset = margin * scale;
    const qrDrawX = offset;
    const qrDrawY = qrTopOffset + offset;
    const qrDrawW = srcWidth * scale;
    const qrDrawH = srcHeight * scale;

    // Solid dark-grey background filling everything around the QR (right up to
    // its canvas edge). The QR canvas already includes its own white quiet zone,
    // so scanners can still detect it.
    {
      const qrLeft = qrDrawX;
      const qrRight = qrDrawX + qrDrawW;
      const qrTop = qrDrawY;
      const qrBottom = qrDrawY + qrDrawH;
      ctx.fillStyle = 'rgba(70, 70, 70, 1)';
      // Top band
      if (qrTop > 0) {
        ctx.fillRect(0, 0, exportCanvas.width, qrTop);
      }
      // Bottom band
      if (qrBottom < exportCanvas.height) {
        ctx.fillRect(0, qrBottom, exportCanvas.width, exportCanvas.height - qrBottom);
      }
      // Left band (between top and bottom of QR)
      if (qrLeft > 0) {
        ctx.fillRect(0, qrTop, qrLeft, qrBottom - qrTop);
      }
      // Right band (between top and bottom of QR)
      if (qrRight < exportCanvas.width) {
        ctx.fillRect(qrRight, qrTop, exportCanvas.width - qrRight, qrBottom - qrTop);
      }
    }

    // Draw title at the top (on white background)
    if (titleLinesArr.length > 0) {
      let ty = Math.round(titleGap / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      titleLinesArr.forEach(line => {
        ctx.font = line.font;
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, exportWidth / 2, ty);
        ty += line.lineHeight;
      });
    }

    ctx.drawImage(canvas, qrDrawX, qrDrawY, qrDrawW, qrDrawH);
    try {
      const srcCtx = canvas.getContext('2d');
      const srcPixel = srcCtx?.getImageData(0, 0, 1, 1)?.data;
      const isDarkBg = srcPixel && srcPixel.length >= 3 ? srcPixel[0] + srcPixel[1] + srcPixel[2] < 128 * 3 : false;
      if (isDarkBg) {
        const imageData = ctx.getImageData(qrDrawX, qrDrawY, qrDrawW, qrDrawH);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        ctx.putImageData(imageData, qrDrawX, qrDrawY);
      }
    } catch {
      // fallback to raw canvas if pixel access fails
      ctx.drawImage(canvas, qrDrawX, qrDrawY, qrDrawW, qrDrawH);
    }

    if (textLines.length > 0) {
      let y = qrTopOffset + offset + qrDrawH + textGap;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      textLines.forEach(line => {
        ctx.font = line.font;
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, exportWidth / 2, y);
        y += line.lineHeight;
      });
    }

    // Brand footer
    {
      const by = exportCanvas.height - brandLineHeight - Math.round(brandGap / 3);
      ctx.font = brandFont;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('XCANNES', exportWidth / 2, by);
    }

    const dataUrl = exportCanvas.toDataURL('image/png');
    return dataUrlToBlob(dataUrl);
  };

	  const downloadBlob = (blob, filename) => {
	    if (!blob || !filename) return;
	    try {
	      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // noop
	    }
	  };

	  const handleCopyQr = async (useRequest = hasGeneratedRequest) => {
	    const fallbackText = useRequest ? requestQrValue : receiveQrValue;
	    const blob = buildQrBlob(useRequest);

    if (!isDesktop && fallbackText) {
      if (navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(fallbackText);
          flashCopyToast(t('ui_qr_code_copied_5c1d2e', 'Code copié'), true);
          return;
        } catch {
          // fall through to execCommand
        }
      }
      try {
        const el = document.createElement('textarea');
        el.value = fallbackText;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.focus();
        el.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(el);
        if (ok) {
          flashCopyToast(t('ui_qr_code_copied_5c1d2e', 'Code copié'), true);
          return;
        }
      } catch {
        // fall through
      }
    }

    if (typeof ClipboardItem !== 'undefined' && navigator?.clipboard?.write) {
      try {
        if (blob) {
          const items = { 'image/png': blob };
          if (fallbackText) {
            items['text/plain'] = new Blob([fallbackText], {
              type: 'text/plain',
            });
          }
          const item = new ClipboardItem(items);
          await navigator.clipboard.write([item]);
          flashCopyToast(t('ui_qr_copied_7b1a9c', 'QR copié'), true);
          return;
        }
      } catch {
        // fall through to text copy
      }
    }

    if (navigator?.clipboard?.writeText && fallbackText) {
      try {
        await navigator.clipboard.writeText(fallbackText);
        flashCopyToast(t('ui_qr_code_copied_5c1d2e', 'Code copié'), true);
        return;
      } catch {
        // fall through to execCommand
      }
    }

    if (fallbackText) {
      try {
        const el = document.createElement('textarea');
        el.value = fallbackText;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.focus();
        el.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(el);
        if (ok) {
          flashCopyToast(t('ui_qr_code_copied_5c1d2e', 'Code copié'), true);
          return;
        }
      } catch {
        // fall through
      }
    }

    flashCopyToast(t('ui_qr_copy_failed_a1b2c3', 'Impossible de copier le QR'));
  };

  const handleShareQr = async (useRequest = hasGeneratedRequest) => {
    const fallbackText = useRequest ? requestQrValue : receiveQrValue;
    const blob = buildQrBlob(useRequest);

    if (isDesktop || !navigator?.share) {
      if (blob) {
        downloadBlob(blob, 'xcannes-qr.png');
        flashCopyToast(t('ui_qr_downloaded_2f1a7c9d5e', 'QR téléchargé'), true);
        return;
      }
      if (fallbackText) {
        downloadBlob(new Blob([fallbackText], { type: 'text/plain' }), 'xcannes-qr.txt');
        flashCopyToast(t('ui_code_downloaded_5c1d2e7f9a', 'Code téléchargé'), true);
        return;
      }
      flashCopyToast(t('ui_share_unavailable_3b7c1a9d5e', 'Partager indisponible'));
      return;
    }

    const shareData = {};
    shareData.title = t('ui_share_qr_title_7f2a1b9c5e', 'XCANNES QR');

    const payreqShareText = t('ui_share_payreq_short', 'XCANNES payment request');

    if (blob && typeof File !== 'undefined') {
      const file = new File([blob], 'xcannes-qr.png', {
        type: blob.type || 'image/png',
      });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        shareData.files = [file];
      }
    }

    if (shareData.files) {
      shareData.text = useRequest ? payreqShareText : fallbackText;
    } else if (fallbackText) {
      shareData.text = fallbackText;
    }

    try {
      await navigator.share(shareData);
      flashCopyToast(t('ui_shared_ok_5c1d2e7f9a', 'Partagé'), true);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      flashCopyToast(t('ui_share_failed_1a2b3c', 'Partage impossible'));
    }
  };

  const requestValue = useMemo(() => {
    if (!generatedRequest) return '';
    try {
      const targetCurrency = generatedRequest.targetCurrency || generatedRequest.targetCurrencyCode || '';
      const displayCurrency = generatedRequest.displayCurrency || '';
      // Omit displayCurrency (dc) if it equals targetCurrency to save space
      const shouldIncludeDc = displayCurrency && displayCurrency !== targetCurrency;

      const compact = {
        // Schema omitted — inferred from xcannes-payreq: prefix
        to: generatedRequest.to,
        tc: targetCurrency || null,
        da: generatedRequest.displayAmount ?? generatedRequest.amount ?? null,
        ...(shouldIncludeDc && { dc: displayCurrency }),
        ar: generatedRequest.amountRlusd ?? null,
        fr: generatedRequest.fxRate ?? null,
        fs: generatedRequest.fxSource ?? null,
        i: generatedRequest.issuer ?? null,
        m: generatedRequest.memo ?? null,
        b: generatedRequest.beneficiaryLabel ?? null,
      };
      Object.keys(compact).forEach(key => {
        if (compact[key] == null || compact[key] === '') delete compact[key];
      });
      return JSON.stringify(compact);
    } catch {
      return '';
    }
  }, [generatedRequest]);
  const requestQrValue = useMemo(() => {
    if (!requestValue) return '';
    try {
      const base64 = Buffer.from(requestValue, 'utf8').toString('base64');
      const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      return `xcannes-payreq:${base64Url}`;
    } catch {
      return '';
    }
  }, [requestValue]);
  const hasGeneratedRequest = Boolean(generatedRequest && requestQrValue);
  const requestDisplayCurrency = String(generatedRequest?.displayCurrency || requestCurrencyCode || 'USD')
    .trim()
    .toUpperCase();
  const requestDisplayAmount = generatedRequest?.displayAmount ?? Number.parseFloat(requestAmount || '0');
  const requestDisplayAmountLabel = Number.isFinite(Number(requestDisplayAmount))
    ? formatAmountWithSymbol(locale, Number(requestDisplayAmount), requestDisplayCurrency, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : formatAmountWithSymbol(locale, 0, requestDisplayCurrency, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
	  const requestDateLabel = useMemo(() => {
	    const raw = generatedRequest?.createdAt;
	    if (!raw) return '';
	    const parsed = new Date(raw);
	    if (!Number.isFinite(parsed.getTime())) return '';
	    return parsed.toLocaleString(locale);
	  }, [generatedRequest?.createdAt, locale]);
	  const requestDateParts = useMemo(() => {
	    const raw = generatedRequest?.createdAt;
	    if (!raw) return { date: '', time: '' };
	    const parsed = new Date(raw);
	    if (!Number.isFinite(parsed.getTime())) return { date: '', time: '' };
	    // Force 'fr' locale for consistent date display (app is FR-first)
	    const dateLoc = locale === 'en' ? 'fr-FR' : locale;
	    return {
	      date: parsed.toLocaleDateString(dateLoc, { day: 'numeric', month: 'short', year: 'numeric' }),
	      time: parsed.toLocaleTimeString(dateLoc, { hour: '2-digit', minute: '2-digit' }),
	    };
	  }, [generatedRequest?.createdAt, locale]);
	  const receiveQrValue = useMemo(() => {
	    if (!wallet) return '';
	    const label = trimmed(activeWalletQrLabel);
	    if (!label) return `xrpl:${wallet}`;
	    return `xrpl:${wallet}?label=${encodeURIComponent(label)}`;
	  }, [activeWalletQrLabel, trimmed, wallet]);
		  const qrPixelSize = inline ? 360 : 560;
		  const requestQrPixelSize = inline ? 360 : 560;

  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  const [overlayDragging, setOverlayDragging] = useState(false);
  const [overlayTranslateY, setOverlayTranslateY] = useState(0);
  const overlayRef = useRef(null);
  const overlayListRef = useRef(null);
  const overlayDragMetaRef = useRef({
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
  const closeRequestedRef = useRef(false);

  useEffect(() => {
    const resetMeta = {
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

    if (open) {
      closeRequestedRef.current = false;
      setOverlayDragging(false);
      setOverlayTranslateY(0);
      overlayDragMetaRef.current = resetMeta;
      return;
    }

    try {
      const listEl = overlayListRef.current;
      const meta = overlayDragMetaRef.current;
      if (listEl && meta?.scrollLocked) {
        listEl.style.overflowY = meta.lockedOverflowY;
      }
    } catch {
      // ignore
    }
    setOverlayDragging(false);
    if (!closeRequestedRef.current) setOverlayTranslateY(0);
    overlayDragMetaRef.current = resetMeta;
  }, [open]);

  const releaseOverlayScrollLock = () => {
    const meta = overlayDragMetaRef.current;
    if (meta?.source !== 'list') return;
    if (!meta?.scrollLocked) return;
    const listEl = overlayListRef.current;
    if (!listEl) return;
    try {
      listEl.style.overflowY = meta.lockedOverflowY;
    } catch {
      // ignore
    }
    meta.scrollLocked = false;
    meta.lockedOverflowY = '';
  };

  const maybeStartOverlayDrag = (event, source) => {
    if (inline) return false;
    if (!event?.isPrimary) return false;
    if (event.pointerType === 'mouse') return false;
    if (event.target?.closest?.('input,textarea,select')) return false;

    if (source === 'list') {
      const listEl = overlayListRef.current;
      if (!listEl) return false;
      if (listEl.scrollTop > 0) return false;
    }

    overlayDragMetaRef.current = {
      startY: event.clientY,
      startAt: Date.now(),
      pointerId: event.pointerId,
      lastDelta: 0,
      pending: true,
      source,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: '',
    };
    return true;
  };

  const handleOverlayPointerMove = event => {
    if (inline) return;
    const meta = overlayDragMetaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;

    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;

    if (!meta.dragging) {
      if (delta < 8) return;
      try {
        overlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }

      if (meta.source === 'list') {
        const listEl = overlayListRef.current;
        if (listEl && listEl.scrollTop <= 0) {
          try {
            meta.lockedOverflowY = listEl.style.overflowY;
            meta.scrollLocked = true;
            listEl.style.overflowY = 'hidden';
            listEl.scrollTop = 0;
          } catch {
            // ignore
          }
        }
      }

      meta.dragging = true;
      setOverlayDragging(true);
    }

    meta.lastDelta = delta;
    setOverlayTranslateY(delta);
  };

  const handleOverlayPointerEnd = event => {
    if (inline) return;
    const meta = overlayDragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;

    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration; // px/ms
    const height = typeof window !== 'undefined' ? window.innerHeight : 800;
    const closeDistance = Math.max(220, Math.min(320, height * 0.28));
    const shouldClose = delta > closeDistance || (delta > closeDistance * 0.6 && velocity > 1.25);

    overlayDragMetaRef.current.pending = false;
    overlayDragMetaRef.current.dragging = false;
    setOverlayDragging(false);
    releaseOverlayScrollLock();

    if (shouldClose) {
      if (!closeRequestedRef.current) {
        closeRequestedRef.current = true;
        const height = typeof window !== 'undefined' ? window.innerHeight : 9999;
        setOverlayTranslateY(Math.max(delta, height));
        window.setTimeout(() => {
          onClose?.();
        }, 180);
      }
      return;
    }

    setOverlayTranslateY(0);
    overlayDragMetaRef.current = {
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
  };

	  if (!shouldRender) return null;

  const wrapperClass = inline
    ? 'relative w-full h-full flex'
    : 'fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none';
  const panelClass = [
    'relative w-full wallet-modal-panel wallet-receive-modal border-white/10 md:border md:border-b-white/25 lg:border-0 p-4 md:p-5 space-y-0 flex flex-col min-h-0 overflow-y-auto overscroll-contain pointer-events-auto pb-[env(safe-area-inset-bottom)]',
    inline
      ? 'h-full max-h-none rounded-xl'
      : 'h-screen md:h-auto md:max-w-lg md:max-h-[100vh] rounded-none md:rounded-2xl',
    noticeVariant === 'demo' ? 'bg-xcannes-surface-demo' : 'bg-elevated',
    noticeVariant === 'demo' ? 'demo-wallet-tooltip-scope' : '',
    inline ? 'wallet-inline-zoom-in' : '',
    !inline ? (isClosing ? 'wallet-modal-lift-out' : 'wallet-modal-lift-in') : '',
  ].join(' ');

  const backdropAnimClass = closeRequestedRef.current
    ? ''
    : isClosing
      ? 'wallet-modal-backdrop-out'
      : 'wallet-modal-backdrop-in';

  const canNativeShare = !isDesktop && typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareActionLabel = canNativeShare ? t('ui_share_qr_cta', 'Partager') : t('ui_download', 'Télécharger');
  const disableSwipeToClose = false;

  const headerTitle =
    receiveView === 'choice'
      ? t('ui_receive_title_short', 'Recevoir')
      : receiveView === 'share'
        ? t('ui_receive_share_header_title', 'Votre adresse de compte')
        : receiveView === 'request_qr'
	          ? t('ui_request_generated_label', 'Demande prête')
        : t('ui_receive_choice_request_title', 'Demander un paiement');
  const headerSubtitle =
    receiveView === 'choice'
      ? t('ui_receive_choice_subtitle', 'Choisissez comment recevoir un paiement.')
      : receiveView === 'share'
	        ? t('ui_receive_choice_share_desc', 'Partagez votre QR code ou votre adresse de réception.')
        : receiveView === 'request_qr'
	          ? t('ui_request_qr_subtitle', 'Partagez ce QR code pour recevoir le paiement.')
	        : t('ui_receive_choice_request_desc', 'Créez une demande avec un montant, une devise et un message facultatif.');

  const choiceCardBaseClassName =
    // Match the "CashChoice" action button background (wallet-actions.css).
    'relative w-full text-left rounded-[20px] px-4 py-[18px] bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.03] ring-1 ring-white/10 ring-inset shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/60';
  const choiceCardGreenClassName = `${choiceCardBaseClassName} xcannes-receivechoice-fade-border-green`;
  const choiceCardNeutralClassName = `${choiceCardBaseClassName} xcannes-receivechoice-fade-border-orange`;

  const content = (
    <>
      {/* ── QR Fullscreen Zoom Overlay ── */}
      {qrZoomValue ? (
        <div
          className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/95 backdrop-blur-md"
          onClick={() => setQrZoomValue(null)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setQrZoomValue(null)}
            className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors duration-150"
            aria-label="Fermer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="w-[96vw] max-w-[min(96vw,96vh)] md:w-[80vw] md:max-w-[360px] aspect-square rounded-none border-[12px] md:border-[20px] border-black flex items-center justify-center"
            style={{ backgroundColor: '#E8E8E8' }}
            onClick={e => e.stopPropagation()}
          >
            <QRCodeCanvas
              value={qrZoomValue}
              size={1024}
              style={{ width: '100%', height: '100%', display: 'block' }}
              bgColor="#E8E8E8"
              fgColor="#000000"
              includeMargin={true}
              level="M"
            />
          </div>
        </div>
      ) : null}

      {/* Backdrop */}
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${backdropAnimClass}`}
          onClick={onClose}
          style={
            overlayTranslateY > 0
              ? {
                  opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)),
                }
              : undefined
          }
        />
      ) : null}

      {/* Modale */}
      <div className={wrapperClass}>
        <div
          ref={overlayRef}
          className={inline ? 'w-full h-full flex' : 'pointer-events-auto w-full'}
          style={{
            transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
            transition: overlayDragging ? 'none' : 'transform 220ms cubic-bezier(0.2,0,0,1)',
            opacity: overlayTranslateY > 0 ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) : undefined,
            willChange: overlayTranslateY ? 'transform' : undefined,
          }}
          onPointerMove={disableSwipeToClose ? undefined : handleOverlayPointerMove}
          onPointerUp={disableSwipeToClose ? undefined : handleOverlayPointerEnd}
          onPointerCancel={disableSwipeToClose ? undefined : handleOverlayPointerEnd}
        >
          <div
            ref={overlayListRef}
            className={panelClass}
            onClick={e => {
              if (!inline) e.stopPropagation();
            }}
            onPointerDown={event => {
              if (!disableSwipeToClose) maybeStartOverlayDrag(event, 'list');
            }}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {receiveView === 'request' || receiveView === 'request_qr' ? (
                !hasGeneratedRequest ? (
                  <>
                    <div className="request-glow-drift absolute inset-0 md:hidden bg-[radial-gradient(700px_circle_at_100%_50%,rgba(245,166,35,0.32),transparent_60%)]" />
                    <div className="request-glow-drift absolute inset-0 hidden md:block bg-[radial-gradient(1000px_circle_at_100%_50%,rgba(245,166,35,0.32),transparent_60%)]" />
                  </>
                ) : (
                  <>
                    <div className="request-glow-drift-alt absolute inset-0 md:hidden bg-[radial-gradient(900px_circle_at_100%_75%,rgba(245,166,35,0.30),transparent_60%)]" />
                    <div className="request-glow-drift-alt absolute inset-0 hidden md:block bg-[radial-gradient(1300px_circle_at_100%_75%,rgba(245,166,35,0.30),transparent_60%)]" />
                  </>
                )
              ) : null}
            </div>
            {!inline ? (
              <div
                className={`md:hidden flex justify-center -mt-1 pt-1 ${receiveView === 'choice' ? 'pb-0' : receiveView === 'request_qr' ? 'pb-0' : 'pb-2'}`}
                aria-hidden
                onPointerDown={event => {
                  if (!disableSwipeToClose) maybeStartOverlayDrag(event, 'fixed');
                }}
              >
                <span className={`block w-12 h-1.5 rounded-full ${receiveView === 'request' ? 'bg-white/[0.13]' : 'bg-white/20'}`} />
              </div>
            ) : null}
            {receiveView !== 'choice' ? (
              <div
                className={`relative z-[66] ${receiveView === 'request_qr' ? 'pt-0' : 'pt-2'} md:pt-0 pb-3 flex flex-col ${receiveView === 'share' || receiveView === 'request' || receiveView === 'request_qr' ? `items-start text-left ${inline ? 'md:items-start md:text-left' : 'md:items-center md:text-center'}` : 'items-center text-center'}`}
                onPointerDown={event => {
                  if (!disableSwipeToClose) maybeStartOverlayDrag(event, 'fixed');
                }}
              >
                <h2 className={`${receiveView === 'request' ? 'mt-[23px] md:mt-[70px]' : receiveView === 'request_qr' ? 'mt-4 md:mt-[25px]' : receiveView === 'share' ? 'mt-[10px] md:mt-[36px]' : 'mt-[19px] md:mt-[70px]'} text-[30px] md:text-[34px] font-light text-white/80 md:text-white tracking-tight`}>
                  {headerTitle}
                </h2>

                {noticeVariant === 'demo' ? (
                  <span className="mt-2 inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-1 leading-none">
                    {t('demo_notice_title', 'Mode démo')}
                  </span>
                ) : null}

                <p className={`max-w-[34ch] md:max-w-[68ch] ${receiveView === 'share' ? 'mt-0.5 md:mt-1 mb-[3.5px] md:mb-[4px] leading-[22.5px] md:leading-[24px] text-[19px] md:text-[20px] font-light text-white/50' : receiveView === 'request' || receiveView === 'request_qr' ? 'mt-0.5 md:mt-1 mb-[3.5px] md:mb-[4px] leading-[22.5px] md:leading-[24px] text-[19px] md:text-[20px] font-light text-white/50' : 'mt-1 md:mt-2 leading-snug text-[18px] md:text-[19px] font-light text-white/60'}`}>
                  {headerSubtitle}
                </p>
              </div>
            ) : null}
            <div className="flex-1 min-h-0 flex flex-col">
              {receiveView === 'choice' ? (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div
                    className="pt-[80px] md:pt-[96px] pb-0 flex flex-col items-center text-center"
                    onPointerDown={event => {
                      maybeStartOverlayDrag(event, 'fixed');
                    }}
                  >
                    <h3 className="receive-choice-title-in mt-1 text-[30px] md:text-[34px] font-light text-white/80 md:text-white tracking-tight">
                      {t('ui_receive_choice_decision_title', 'Comment souhaitez-vous recevoir ?')}
                    </h3>
                    <p className="receive-choice-subtitle-in mt-1 md:mt-2 leading-snug md:leading-relaxed text-[19px] md:text-[20px] font-light text-white/50 max-w-[34ch]">
                      {t('ui_receive_choice_decision_subtitle', 'Partagez vos coordonnées de réception ou créez une demande de paiement.')}
                    </p>
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col justify-center gap-8 md:gap-10 pt-[10px] pb-6">
                    <button
                      type="button"
                      className={`${choiceCardGreenClassName} receive-choice-card-1-in`}
                      onClick={e => {
                        e.stopPropagation();
                        switchReceiveView('share');
                      }}
                    >
                      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[20px] overflow-hidden z-[29]">
                        <span className="receive-choice-glass receive-choice-glass-green" />
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-13 h-13 rounded-[16px] bg-transparent flex items-center justify-center flex-shrink-0 text-xcannes-green">
                          <ShareAddressIcon className="w-12 h-12" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[19px] md:text-[20px] font-light text-white truncate">
                              {t('ui_receive_choice_share_title', 'Partager votre adresse')}
                            </div>
                            <svg className="w-7 h-7 md:w-8 md:h-8 text-xcannes-green/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M7 18L13 12L7 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M13 18L19 12L13 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div className="mt-1 text-[17px] md:text-[16px] font-light leading-snug text-white/60">
                            {t(
                              'ui_receive_choice_share_desc',
                              'Affichez votre QR code et votre adresse de réception.',
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`${choiceCardNeutralClassName} receive-choice-card-2-in`}
                      onClick={e => {
                        e.stopPropagation();
                        switchReceiveView('request');
                      }}
                    >
                      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[20px] overflow-hidden z-[29]">
                        <span className="receive-choice-glass receive-choice-glass-orange" />
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-13 h-13 rounded-[16px] bg-transparent flex items-center justify-center flex-shrink-0 text-[#f5a623]">
                          <RequestIcon className="w-12 h-12" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[19px] md:text-[20px] font-light text-white truncate">
                              {t('ui_receive_choice_request_title', 'Demander un paiement')}
                            </div>
                            <svg className="w-7 h-7 md:w-8 md:h-8 text-[#f5a623]/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M7 18L13 12L7 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M13 18L19 12L13 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div className="mt-1 text-[17px] md:text-[16px] font-light leading-snug text-white/60">
                            {t(
                              'ui_receive_choice_request_desc',
	                              'Créez une demande avec un montant, une devise et un message facultatif.',
	                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : null}

              {receiveView === 'share' ? (
                <>
                  {/* Glow vert — vue share (Coordonnées de réception) */}
                  <div className="pointer-events-none absolute inset-0 z-[-1] overflow-hidden" aria-hidden>
                    <div className="share-glow-breathe share-glow-halo-a absolute inset-0 md:hidden bg-[radial-gradient(700px_circle_at_100%_50%,rgba(0,255,150,0.13),transparent_60%)]" />
                    <div className="share-glow-breathe share-glow-halo-a absolute inset-0 hidden md:block bg-[radial-gradient(1000px_circle_at_100%_50%,rgba(0,255,150,0.13),transparent_60%)]" />
                    <div className="share-glow-halo-b absolute inset-0 md:hidden bg-[radial-gradient(900px_circle_at_100%_75%,rgba(0,255,150,0.11),transparent_60%)]" />
                    <div className="share-glow-halo-b absolute inset-0 hidden md:block bg-[radial-gradient(1300px_circle_at_100%_75%,rgba(0,255,150,0.11),transparent_60%)]" />
                    <div className="share-glow-breathe absolute inset-0 bg-[radial-gradient(700px_circle_at_0%_100%,rgba(0,255,150,0.08),transparent_65%)]" />
                  </div>
	                  {/* SECTION 1 — RECEIVE FUNDS */}
	                  <div className="space-y-5 pt-2 relative z-[2]">

	                    {/* ── Centered wallet pill (style "Depuis le compte") ── */}
                      <div className="flex justify-center pt-1 pb-1 relative z-[85]">
	                      <div className={`relative wallet-account-selector-wrapper ${shareWalletDropdownOpen ? 'is-open' : ''}`} ref={shareWalletDropdownRef}>
	                        {/* Visible pill */}
                          <button
                            type="button"
                            onClick={hasMultipleWallets ? () => setShareWalletDropdownOpen((prev) => !prev) : undefined}
                            className={`shimmer-seq shimmer-seq-3 relative flex w-fit flex-col items-center gap-1 ${shareWalletDropdownOpen ? 'bg-[#0f1314]' : 'bg-[#232829]'} px-6 py-2 ${shareWalletDropdownOpen ? accountDropdownOpenPillClassName : 'rounded-[28px]'} ${shareWalletDropdownOpen ? 'ring-0' : 'ring-1 ring-white/[0.08]'} ring-inset ${hasMultipleWallets ? 'cursor-pointer' : ''} ${shareWalletDropdownOpen ? (inline ? 'shadow-[0_0_0_1px_rgba(0,0,0,0.75),-14px_-18px_36px_rgba(0,0,0,0.70),14px_-18px_36px_rgba(0,0,0,0.70),0_-10px_28px_rgba(0,0,0,0.68)]' : 'shadow-[0_0_0_1px_rgba(0,0,0,0.9),-12px_-16px_32px_rgba(0,0,0,0.85),12px_-16px_32px_rgba(0,0,0,0.85),0_-8px_24px_rgba(0,0,0,0.80)]') : ''}`}
                            aria-haspopup={hasMultipleWallets ? 'menu' : undefined}
                            aria-expanded={hasMultipleWallets ? shareWalletDropdownOpen : undefined}
                          >
	                          <span className="text-white/70 text-[14px] md:text-[15px] font-medium tracking-wide">
		                            {t('ui_receive_account_info_label', 'Choisissez le compte')}
	                          </span>
	                          <div className="flex items-center gap-2">
	                            <span className="h-2.5 w-2.5 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0" style={{animation:'wallet-dot-pulse 3.5s ease-in-out infinite'}} aria-hidden />
	                            <span className="text-white/95 text-[14px] md:text-[15px] font-semibold">
	                              {activeWalletLabel || t('nav_wallet', 'Wallet')}
	                            </span>
	                            {hasMultipleWallets && (
                                <svg className={`w-3 h-3 text-white/50 transition-transform duration-150 ${shareWalletDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
	                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
	                              </svg>
	                            )}
	                          </div>
	                        </button>

                          {shareWalletDropdownOpen && hasMultipleWallets ? (
                            <div
                              className={`wallet-receive-account-menu absolute left-0 right-0 top-full -mt-[2px] ${accountDropdownMenuClassName}`}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              role="menu"
                            >
                              {/* Addresses toggle (single eye) */}
                              <div className="px-3 pt-0 pb-1.5">
                                {(() => {
                                  const addressesVisible = Object.keys(shareAddressModes || {}).length > 0;
                                  const allAddresses = Array.from(
                                    new Set([
                                      wallet,
                                      ...((shareWalletOptions || [])
                                        .map((opt) => opt?.value)
                                        .filter(Boolean)),
                                    ]),
                                  );

                                  const toggleAll = () => {
                                    setShareAddressModes((prev) => {
                                      const isOn = Object.keys(prev || {}).length > 0;
                                      if (isOn) return {};
                                      const next = {};
                                      for (const addr of allAddresses) next[addr] = 'truncated';
                                      return next;
                                    });
                                  };

                                  const mode = shareAddressModes?.[wallet] || 'truncated';
                                  const displayAddress =
                                    mode === 'full'
                                      ? wallet
                                      : `${wallet.slice(0, 8)}…${wallet.slice(-6)}`;

                                  return (
                                    <>
                                      {addressesVisible ? (
                                        <div className="mb-3 flex items-start gap-2">
                                          <button
                                            type="button"
                                            className={`min-w-0 flex-1 text-left font-mono font-light text-[13px] md:text-[14px] leading-snug text-white/70 ${
                                              mode === 'full'
                                                ? 'whitespace-normal break-all'
                                                : 'truncate'
                                            }`}
                                            title={wallet}
                                            onClick={() =>
                                              setShareAddressModes((prev) => ({
                                                ...(prev || {}),
                                                [wallet]:
                                                  prev?.[wallet] === 'full' ? 'truncated' : 'full',
                                              }))
                                            }
                                          >
                                            {displayAddress}
                                          </button>
                                          <button
                                            type="button"
                                            className="shrink-0 rounded-md p-1 text-white/45 hover:text-white/80 transition-colors"
                                            onClick={async () => {
                                              try {
                                                await navigator.clipboard?.writeText?.(wallet);
                                                showShareDropdownToast(t('ui_address_copied', 'Adresse copiée'));
                                              } catch {
                                                /* ignore */
                                              }
                                            }}
                                            aria-label={t('ui_copy_wallet_address', "Copier l'adresse du wallet")}
                                          >
                                            <CopyIcon className="h-4 w-4" />
                                          </button>
                                        </div>
                                      ) : null}

                                      {addressesVisible ? (
                                        <div className="h-px w-full bg-xcannes-green/40 mb-1.5 transition-colors duration-200" aria-hidden />
                                      ) : null}

                                      <div className="flex items-center justify-between gap-2">
                                        <button
                                          type="button"
                                          className={`min-w-0 flex-1 text-left text-[13px] md:text-[14px] transition-colors duration-200 ${addressesVisible ? 'text-xcannes-green hover:text-xcannes-green/80' : 'text-white/40 hover:text-white/60'}`}
                                          onClick={toggleAll}
                                        >
                                          {addressesVisible
                                            ? t('ui_hide_wallet_addresses', 'Masquer les adresses')
                                            : t('ui_view_wallet_addresses', 'Voir les adresses')}
                                        </button>
                                        <button
                                          type="button"
                                          className={`shrink-0 rounded-md bg-white/[0.06] p-1 transition-colors duration-200 ${addressesVisible ? 'text-xcannes-green hover:text-xcannes-green/80' : 'text-white/35 hover:bg-white/[0.10] hover:text-white/55'}`}
                                          onClick={toggleAll}
                                          aria-label={addressesVisible
                                            ? t('ui_hide_wallet_addresses', 'Masquer les adresses')
                                            : t('ui_view_wallet_addresses', 'Voir les adresses')}
                                        >
                                          <EyeIcon className="h-4 w-4" slashed={addressesVisible} />
                                        </button>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>

                              <div className="px-3">
                                <div className={`h-px w-full transition-colors duration-200 ${Object.keys(shareAddressModes || {}).length > 0 ? 'bg-xcannes-green/40' : 'bg-white/10'}`} aria-hidden />
                              </div>

                              <div className="px-3 pt-1.5">
                                <div
                                  className={`text-[11px] md:text-[12px] text-xcannes-green/80 transition-opacity duration-200 ${
                                    shareDropdownToast ? 'opacity-100' : 'opacity-0'
                                  }`}
                                  role="status"
                                  aria-live="polite"
                                >
                                  {shareDropdownToast || ' '}
                                </div>
                              </div>

                              <div className="px-3 pt-2 pb-1">
                                <div className="wallet-switch-label text-[13px] md:text-[14px]">
                                  {t('ui_switch_wallet', 'Changer de compte')}
                                </div>
                              </div>

                              {/* ── Scrollable wallet list ── */}
                              <div className="overflow-y-auto overscroll-contain touch-pan-y max-h-[220px]">
                                {(shareWalletOptions || [])
                                .filter((opt) => opt?.value && opt.value !== wallet)
                                .map((opt, idx) => {
                                  const addr = opt.value;
                                  const displayName = opt.label || `Compte ${idx + 1}`;
                                  const addressesVisible = Object.keys(shareAddressModes || {}).length > 0;
                                  const mode = shareAddressModes?.[addr] || 'truncated';
                                  const displayAddress =
                                    mode === 'full'
                                      ? addr
                                      : `${addr.slice(0, 8)}…${addr.slice(-6)}`;

                                  return (
                                    <div
                                      key={addr}
                                      className="w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors duration-150 hover:bg-white/[0.06]"
                                      role="menuitem"
                                      tabIndex={0}
                                      onClick={() => {
                                        onSwitchWallet?.(addr);
                                        setShareWalletDropdownOpen(false);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key !== 'Enter' && e.key !== ' ') return;
                                        e.preventDefault();
                                        onSwitchWallet?.(addr);
                                        setShareWalletDropdownOpen(false);
                                      }}
                                    >
                                      <span className="h-2 w-2 rounded-full shrink-0 transition-colors duration-150 bg-white/20 opacity-0" />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2 min-w-0">
                                          <div className="text-[16px] md:text-[17px] font-medium truncate text-white/80 min-w-0">
                                            {displayName}
                                          </div>
                                        </div>

                                        {!addressesVisible ? null : (
                                          <div className="mt-0.5 flex items-start gap-2">
                                            <button
                                              type="button"
                                              className={`min-w-0 flex-1 text-left font-mono font-light text-[13px] md:text-[14px] leading-snug text-white/70 ${
                                                mode === 'full' ? 'whitespace-normal break-all' : 'truncate'
                                              }`}
                                              title={addr}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setShareAddressModes((prev) => ({
                                                  ...(prev || {}),
                                                  [addr]: prev?.[addr] === 'full' ? 'truncated' : 'full',
                                                }));
                                              }}
                                            >
                                              {displayAddress}
                                            </button>
                                            <button
                                              type="button"
                                              className="shrink-0 rounded-md p-1 text-white/45 hover:text-white/80 transition-colors"
                                              onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                try {
                                                  await navigator.clipboard?.writeText?.(addr);
                                                  showShareDropdownToast(t('ui_address_copied', 'Adresse copiée'));
                                                } catch {
                                                  /* ignore */
                                                }
                                              }}
                                              aria-label={t('ui_copy_wallet_address', "Copier l'adresse du wallet")}
                                            >
                                              <CopyIcon className="h-4 w-4" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>{/* end scrollable list */}
                            </div>
                          ) : null}
	                      </div>
	                    </div>

	                    {/* ── QR Code ── */}
	                    <div className="qr-border-animated relative overflow-hidden w-full flex flex-col items-center bg-[#232829] rounded-[20px] pt-10 pb-3 md:pt-20 md:pb-10 shadow-[0_2px_0_rgba(255,255,255,0.04)_inset,0_-2px_0_rgba(0,0,0,0.6)_inset,-10px_28px_55px_rgba(0,0,0,0.72),18px_10px_42px_rgba(0,0,0,0.38),2px_60px_36px_-16px_rgba(0,0,0,0.65),-6px_-14px_28px_rgba(0,0,0,0.22)]">
	                      <span aria-hidden className="share-qr-glass" />
	                        <div
	                          ref={receiveQrContainerRef}
	                          className="w-[280px] md:w-[260px] aspect-square rounded-none p-3 cursor-pointer border-[20px] border-black"
	                          style={{ backgroundColor: '#E8E8E8' }}
	                          onClick={() => setQrZoomValue(receiveQrValue)}
	                        >
	                          <QRCodeCanvas
	                            value={receiveQrValue}
	                            size={qrPixelSize}
	                            style={{ width: '100%', height: '100%' }}
	                            bgColor="#E8E8E8"
	                            fgColor="#000000"
	                            includeMargin={false}
	                            level="M"
	                          />
	                        </div>
	                      <button
	                        type="button"
	                        onClick={() => setQrZoomValue(receiveQrValue)}
	                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[17px] text-white/70 hover:text-white/90 transition-colors duration-150"
	                        aria-label="Agrandir le QR code"
	                      >
	                        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
	                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
	                        </svg>
	                        Agrandir le QR code
	                      </button>
	                    </div>

	                    {/* ── Actions ── */}
	                    <div className="grid grid-cols-2 gap-5">
	                      <button
	                        type="button"
	                        onClick={async e => {
	                          e.stopPropagation();
	                          await handleCopyQr(false);
	                        }}
	                        className={[
									'shimmer-seq shimmer-seq-2 w-full h-11 rounded-[20px] bg-[#232829] ring-1 ring-white/10 ring-inset text-white/85 text-xs font-semibold mt-6 md:mt-[50px] px-2',
	                          'shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:ring-white/20 hover:bg-white/[0.04] transition-all duration-[140ms] active:scale-[0.99]',
	                        ].join(' ')}
	                      >
	                        {t('ui_copy_address', 'Copier l’adresse')}
	                      </button>
	                      <button
	                        type="button"
	                        onClick={async e => {
	                          e.stopPropagation();
	                          await handleShareQr(false);
	                        }}
                          className="shimmer-seq shimmer-seq-1 w-full h-11 rounded-[20px] bg-[#232829] text-white text-[17px] font-bold tracking-wide py-2 px-3 transition-all duration-[140ms] inline-flex items-center justify-center gap-1.5 hover:bg-white/[0.04] scale-[1.04] active:scale-[0.98] mt-6 md:mt-[50px]"
                          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -8px 16px rgba(0,0,0,0.25)' }}
	                      >
	                        <ShareIcon className="w-5 h-5" />
	                        <span>{shareActionLabel}</span>
	                      </button>
	                    </div>
	                  </div>
	                </>
	              ) : null}

	                  {receiveView === 'request' ? (
		                <>
		                  {/* SECTION 2 — CREATE REQUEST */}
                      <div className="flex flex-col gap-2 pt-[18px] flex-1">
	                    {/* ── Centered wallet pill (style "Choisissez le compte") ── */}
                        <div className="flex justify-center pt-1 pb-[15px] relative z-[85]">
	                      <div className={`relative wallet-account-selector-wrapper ${requestWalletDropdownOpen ? 'is-open' : ''}`} ref={requestWalletDropdownRef}>
	                        {/* Visible pill */}
                            <button
                              type="button"
                              onClick={hasMultipleWallets ? () => setRequestWalletDropdownOpen((prev) => !prev) : undefined}
                              className={`relative flex w-fit flex-col items-center gap-1 bg-[#0f1314] px-6 py-2 ${requestWalletDropdownOpen ? accountDropdownOpenPillClassName : 'rounded-[28px]'} ${requestWalletDropdownOpen ? 'ring-0' : 'ring-1 ring-white/[0.08]'} ring-inset ${hasMultipleWallets ? 'cursor-pointer' : ''} ${requestWalletDropdownOpen ? (inline ? 'shadow-[0_0_0_1px_rgba(0,0,0,0.75),-14px_-18px_36px_rgba(0,0,0,0.70),14px_-18px_36px_rgba(0,0,0,0.70),0_-10px_28px_rgba(0,0,0,0.68)]' : 'shadow-[0_0_0_1px_rgba(0,0,0,0.9),-12px_-16px_32px_rgba(0,0,0,0.85),12px_-16px_32px_rgba(0,0,0,0.85),0_-8px_24px_rgba(0,0,0,0.80)]') : ''}`}
                              aria-haspopup={hasMultipleWallets ? 'menu' : undefined}
                              aria-expanded={hasMultipleWallets ? requestWalletDropdownOpen : undefined}
                            >
	                          <span className="text-white/70 text-[14px] md:text-[15px] font-light tracking-wide">
		                            {t('ui_receive_receiving_account_label', 'Compte de réception')}
	                          </span>
	                          <div className="flex items-center gap-2">
	                            <span className="h-2.5 w-2.5 rounded-full bg-[#f5a623] ring-4 ring-[#f5a623]/20 shrink-0" style={{animation:'wallet-dot-pulse 3.5s ease-in-out infinite'}} aria-hidden />
	                            <span className="text-white/80 md:text-white/95 text-[14px] md:text-[15px] font-medium">
	                              {activeWalletLabel || t('nav_wallet', 'Wallet')}
	                            </span>
	                            {hasMultipleWallets && (
	                              <svg className={`w-3 h-3 text-white/50 transition-transform duration-150 ${requestWalletDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
	                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
	                              </svg>
	                            )}
	                          </div>
	                        </button>

                            {requestWalletDropdownOpen && hasMultipleWallets ? (
                              <div
                                className={`wallet-receive-account-menu absolute left-0 right-0 top-full -mt-[2px] ${accountDropdownMenuClassName}`}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                role="menu"
                              >
                                {/* Addresses toggle (single eye) */}
                                <div className="px-3 pt-0 pb-1.5">
                                  {(() => {
                                    const addressesVisible = Object.keys(requestAddressModes || {}).length > 0;
                                    const allAddresses = Array.from(
                                      new Set([
                                        wallet,
                                        ...((shareWalletOptions || [])
                                          .map((opt) => opt?.value)
                                          .filter(Boolean)),
                                      ]),
                                    );

                                    const toggleAll = () => {
                                      setRequestAddressModes((prev) => {
                                        const isOn = Object.keys(prev || {}).length > 0;
                                        if (isOn) return {};
                                        const next = {};
                                        for (const addr of allAddresses) next[addr] = 'truncated';
                                        return next;
                                      });
                                    };

                                    const mode = requestAddressModes?.[wallet] || 'truncated';
                                    const displayAddress =
                                      mode === 'full'
                                        ? wallet
                                        : `${wallet.slice(0, 8)}…${wallet.slice(-6)}`;

                                    return (
                                      <>
                                        {addressesVisible ? (
                                          <div className="mb-3 flex items-start gap-2">
                                            <button
                                              type="button"
                                              className={`min-w-0 flex-1 text-left font-mono font-light text-[13px] md:text-[14px] leading-snug text-white/70 ${
                                                mode === 'full'
                                                  ? 'whitespace-normal break-all'
                                                  : 'truncate'
                                              }`}
                                              title={wallet}
                                              onClick={() =>
                                                setRequestAddressModes((prev) => ({
                                                  ...(prev || {}),
                                                  [wallet]:
                                                    prev?.[wallet] === 'full' ? 'truncated' : 'full',
                                                }))
                                              }
                                            >
                                              {displayAddress}
                                            </button>
                                            <button
                                              type="button"
                                              className="shrink-0 rounded-md p-1 text-white/45 hover:text-white/80 transition-colors"
                                              onClick={async () => {
                                                try {
                                                  await navigator.clipboard?.writeText?.(wallet);
                                                  showRequestDropdownToast(t('ui_address_copied', 'Adresse copiée'));
                                                } catch {
                                                  /* ignore */
                                                }
                                              }}
                                              aria-label={t('ui_copy_wallet_address', "Copier l'adresse du wallet")}
                                            >
                                              <CopyIcon className="h-4 w-4" />
                                            </button>
                                          </div>
                                        ) : null}

                                        {addressesVisible ? (
                                          <div className="h-px w-full bg-[#f5a623]/40 mb-1.5 transition-colors duration-200" aria-hidden />
                                        ) : null}

                                        <div className="flex items-center justify-between gap-2">
                                          <button
                                            type="button"
                                            className={`min-w-0 flex-1 text-left text-[13px] md:text-[14px] font-light transition-colors duration-200 ${addressesVisible ? 'text-[#f5a623] hover:text-[#f5a623]/80' : 'text-white/40 hover:text-white/60'}`}
                                            onClick={toggleAll}
                                          >
                                            {addressesVisible
                                              ? t('ui_hide_wallet_addresses', 'Masquer les adresses')
                                              : t('ui_view_wallet_addresses', 'Voir les adresses')}
                                          </button>
                                          <button
                                            type="button"
                                            className={`shrink-0 rounded-md bg-white/[0.06] p-1 transition-colors duration-200 ${addressesVisible ? 'text-[#f5a623] hover:text-[#f5a623]/80' : 'text-white/35 hover:bg-white/[0.10] hover:text-white/55'}`}
                                            onClick={toggleAll}
                                            aria-label={addressesVisible
                                              ? t('ui_hide_wallet_addresses', 'Masquer les adresses')
                                              : t('ui_view_wallet_addresses', 'Voir les adresses')}
                                          >
                                            <EyeIcon className="h-4 w-4" slashed={addressesVisible} />
                                          </button>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>

                                <div className="px-3">
                                  <div className={`h-px w-full transition-colors duration-200 ${Object.keys(requestAddressModes || {}).length > 0 ? 'bg-[#f5a623]/40' : 'bg-white/10'}`} aria-hidden />
                                </div>

                                <div className="px-3 pt-1.5">
                                  <div
                                    className={`text-[11px] md:text-[12px] text-[#f5a623]/80 transition-opacity duration-200 ${
                                      requestDropdownToast ? 'opacity-100' : 'opacity-0'
                                    }`}
                                    role="status"
                                    aria-live="polite"
                                  >
                                    {requestDropdownToast || ' '}
                                  </div>
                                </div>

                                <div className="px-3 pt-2 pb-1">
                                  <div className="wallet-switch-label text-[13px] md:text-[14px]">
                                    {t('ui_switch_wallet', 'Changer de compte')}
                                  </div>
                                </div>

                                {/* ── Scrollable wallet list ── */}
                                <div className="overflow-y-auto overscroll-contain touch-pan-y max-h-[220px]">
                                  {(shareWalletOptions || [])
                                    .filter((opt) => opt?.value && opt.value !== wallet)
                                    .map((opt, idx) => {
                                      const addr = opt.value;
                                      const displayName = opt.label || `Compte ${idx + 1}`;
                                      const addressesVisible = Object.keys(requestAddressModes || {}).length > 0;
                                      const mode = requestAddressModes?.[addr] || 'truncated';
                                      const displayAddress =
                                        mode === 'full'
                                          ? addr
                                          : `${addr.slice(0, 8)}…${addr.slice(-6)}`;

                                      return (
                                        <div
                                          key={addr}
                                          className="w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors duration-150 hover:bg-white/[0.06]"
                                          role="menuitem"
                                          tabIndex={0}
                                          onClick={() => {
                                            onSwitchWallet?.(addr);
                                            setRequestWalletDropdownOpen(false);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key !== 'Enter' && e.key !== ' ') return;
                                            e.preventDefault();
                                            onSwitchWallet?.(addr);
                                            setRequestWalletDropdownOpen(false);
                                          }}
                                        >
                                          <span className="h-2 w-2 rounded-full shrink-0 transition-colors duration-150 bg-white/20 opacity-0" />
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2 min-w-0">
                                              <div className="text-[16px] md:text-[17px] font-light truncate text-white/80 min-w-0">
                                                {displayName}
                                              </div>
                                            </div>

                                            {!addressesVisible ? null : (
                                              <div className="mt-0.5 flex items-start gap-2">
                                                <button
                                                  type="button"
                                                  className={`min-w-0 flex-1 text-left font-mono font-light text-[13px] md:text-[14px] leading-snug text-white/80 ${
                                                    mode === 'full' ? 'whitespace-normal break-all' : 'truncate'
                                                  }`}
                                                  title={addr}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setRequestAddressModes((prev) => ({
                                                      ...(prev || {}),
                                                      [addr]: prev?.[addr] === 'full' ? 'truncated' : 'full',
                                                    }));
                                                  }}
                                                >
                                                  {displayAddress}
                                                </button>
                                                <button
                                                  type="button"
                                                  className="shrink-0 rounded-md p-1 text-white/45 hover:text-white/80 transition-colors"
                                                  onClick={async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    try {
                                                      await navigator.clipboard?.writeText?.(addr);
                                                      showRequestDropdownToast(t('ui_address_copied', 'Adresse copiée'));
                                                    } catch {
                                                      /* ignore */
                                                    }
                                                  }}
                                                  aria-label={t('ui_copy_wallet_address', "Copier l'adresse du wallet")}
                                                >
                                                  <CopyIcon className="h-4 w-4" />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            ) : null}
	                      </div>
	                    </div>

		                      {/* Currency */}
			                      <div className="pt-2">
		                        <div className="flex items-center justify-between mb-2">
			                          <label className="block text-[11px] tracking-[0.22em] text-white/45">
			                            {t('ui_currency_1ed55673be', 'Devise')}
			                          </label>
			                        </div>
			                        <ModalSelect
		                          value={requestCurrency}
		                          onChange={setRequestCurrency}
  		                          onOpenChange={setRequestCurrencyDropdownOpen}
	                          options={(augmentedTokens || []).map(token => {
                            const currencyUpper = String(token.currency || '').toUpperCase();
                            const _fullName = getCurrencyDescription(currencyUpper) || selectLabelByCurrency?.[token.currency] || selectLabelByCurrency?.[currencyUpper] || token.currency;
                            const labelLeftText = _fullName.length > 15 ? _fullName.slice(0, 15) + '…' : _fullName;
                            const labelLeft = <span className="font-light md:text-[1.12em]">{labelLeftText}</span>;
                              const labelRightRaw =
                              selectLabelRightByCurrency?.[token.currency] ||
                              selectLabelRightByCurrency?.[currencyUpper] ||
                              null;
                              const isSelected =
                                String(token.currency || '').toUpperCase() ===
                                String(requestCurrency || '').toUpperCase();
                              const labelRight =
                                !requestCurrencyDropdownOpen && isSelected
                                  ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] md:text-[11px] text-white/38 tracking-[0.01em] font-light">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="opacity-80">
                                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.7"/>
                                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7"/>
                                      </svg>
                                      <span>{t('ui_balances_short_label_aa12', 'Solde disponible')}</span>
                                    </span>
                                  )
                                  : labelRightRaw;
                            return {
                              value: token.currency,
                              icon:
                                selectIconByCurrency?.[token.currency] || selectIconByCurrency?.[currencyUpper] || null,
                              label: labelLeftText,
                              labelLeft,
                              labelRight,
                              labelMobile:
                                selectLabelMobileByCurrency?.[token.currency] ||
                                selectLabelMobileByCurrency?.[currencyUpper] ||
                                labelLeftText,
                            };
	                          })}
	                          useNativeSelect={false}
	                          portal
	                          portalTarget={overlayListRef.current}
		                          hideSelected
		                          showMobileOptionRight={true}
		                          backdropClassName="bg-black/80 backdrop-blur-[4px] !z-[65]"
		                          iconClassName="text-3xl leading-none opacity-70 md:opacity-100 transition-opacity duration-150"
		                          optionIconClassName="text-2xl leading-none opacity-60"
		                          optionClassName="py-2 md:py-2.5 !text-base md:!text-lg !text-white/60"
	                          menuHeader={t("ui_your_balances_header", "Vos soldes")}
		                          menuClassName={
		                            noticeVariant === 'demo'
                                  ? 'bg-xcannes-surface-demo max-h-[420px] overflow-y-auto overscroll-contain touch-pan-y !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px]'
                                  : 'bg-[#101415] max-h-[420px] overflow-y-auto overscroll-contain touch-pan-y !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px]'
		                          }
                              openButtonClassName="!bg-white/10 !border !border-white/10 !border-b-0 !rounded-b-none !ring-1 !ring-white/10 !shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                              buttonClassName={`wallet-request-currency-reveal [&_path]:[stroke-width:1.2] bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.07] ring-inset rounded-[14px] px-3.5 py-1.5 md:py-2 text-xl md:text-2xl text-white/80 md:text-white outline-none focus:outline-none cursor-pointer transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]`}
                              selectClassName={`xcannes-select w-full ring-1 ring-white/10 ring-inset rounded-[14px] px-3.5 py-1.5 md:py-2 text-xl md:text-2xl text-white focus:outline-none transition-colors duration-150 ${
			                            noticeVariant === 'demo' ? 'bg-xcannes-surface-demo' : 'bg-white/[0.02]'
			                          }`}
			                        />
			                      </div>
	
		                      {/* Amount */}
					                      <div className="pt-4">
					                        <label className="block text-[13px] tracking-normal font-light text-white/75 mb-2">
					                          {t('ui_amount_7668986206', 'Montant')}
					                        </label>
                                  <div className="relative z-[2] bg-[#111518] rounded-[18px]">
                                  <TokenAmountInput
                                    value={requestAmount}
                                    onChange={setRequestAmount}
                                    placeholder="0.00"
                                    token={requestCurrencyCode || 'USD'}
                                    tokenClassName="text-white/70 drop-shadow-sm text-2xl md:text-3xl font-light"
                                    containerClassName="pt-5 pb-5 rounded-[18px] bg-[#111518] ring-1 ring-white/10 ring-inset transition-all duration-200 shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)] focus-within:ring-white/25 focus-within:shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.10),0_0_24px_rgba(255,255,255,0.06)] wallet-request-amount-zoom [&_input]:!text-4xl [&_input]:md:!text-5xl [&_input]:font-light [&_input]:placeholder:text-white/35"
                                  />
                                  </div>
					                      </div>

	                      {/* Message (optional) */}
			                      <div className="pt-4">
			                        <label className="block text-[11px] tracking-[0.22em] text-white/45 mb-2">
			                          {t('ui_message_optional_label', 'Message facultatif')}
			                        </label>
	                        <div className="relative z-[2] bg-[#101415] rounded-[12px] wallet-request-memo-shimmer">
				                        <input
			                          type="text"
				                          value={requestMemo}
				                          onChange={e => setRequestMemo(e.target.value.slice(0, 40))}
				                          maxLength={40}
				                          placeholder={t('ui_request_memo_placeholder', 'Motif de la demande')}
				                          className={`w-full ring-1 ring-white/10 ring-inset rounded-[12px] px-3.5 py-2 text-base font-light text-white placeholder:text-white/25 focus:outline-none transition-colors duration-150 ${
				                            noticeVariant === 'demo' ? 'bg-xcannes-surface-demo' : 'bg-[#101415]'
				                          }`}
				                        />
                        </div>
				                      </div>

                      <div className="mt-auto md:mt-6 pt-6 pb-[85px] md:pb-0">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleGenerateRequest();
                          }}
                          disabled={generateButtonDisabled}
                          className={[
                            'w-full h-14 rounded-[20px] text-[22px] md:text-[24px] font-semibold transition-all duration-200 tracking-[-0.01em]',
                            generateButtonDisabled
                              ? 'text-white/90 cursor-not-allowed ring-[0.5px] ring-[#f5a623]/30 ring-inset'
                              : 'text-white hover:scale-[1.01] active:scale-[0.98]',
                          ].join(' ')}
                          style={{
                            background: generateButtonDisabled
                              ? 'linear-gradient(180deg, rgba(245,166,35,0.34) 0%, rgba(217,140,15,0.34) 100%)'
                              : 'linear-gradient(180deg, #f5a623 0%, #d98c0f 100%)',
                            boxShadow: generateButtonDisabled
                              ? '0 12px 24px rgba(0,0,0,0.44), 0 5px 12px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -10px 16px rgba(0,0,0,0.24)'
                              : '0 22px 42px rgba(0,0,0,0.78), 0 10px 22px rgba(0,0,0,0.55), 0 4px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -16px 26px rgba(0,0,0,0.55), inset 0 12px 22px rgba(0,0,0,0.18)',
                          }}
                        >
                          {generateButtonDisabled
                            ? <span className="inline-flex items-center gap-1.5 text-white/85">
                                <span className="text-[14px] md:text-[16px] font-light">{t('ui_complete_request_cta', 'Compléter votre demande')}</span>
                                <span className="inline-flex items-end gap-[3px] mb-[-1px]">
                                  <span className="receive-req-dot" style={{ animationDelay: '0s' }}>·</span>
                                  <span className="receive-req-dot" style={{ animationDelay: '0.6s' }}>·</span>
                                  <span className="receive-req-dot" style={{ animationDelay: '1.2s' }}>·</span>
                                </span>
                              </span>
                            : t('ui_generate_request_fr', 'Créer la demande')}
                        </button>
                        <style>{`
                          @keyframes receiveReqDotBlink {
                            0%, 100% { opacity: 0.18; }
                            50% { opacity: 0.7; }
                          }
                          .receive-req-dot {
                            animation: receiveReqDotBlink 2.4s ease-in-out infinite;
                            font-size: 1.3em;
                            line-height: 1;
                          }
                        `}</style>
                      </div>

	                      {generateError ? (
	                        <div className="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
	                          {generateError}
	                        </div>
	                      ) : null}
	                  </div>
	                </>
	              ) : null}

	              {receiveView === 'request_qr' ? (
	                <>
	                  {/* Glow ambre — vue request_qr (Demande générée) */}
	                  <div className="pointer-events-none absolute inset-0 z-[-1] overflow-hidden" aria-hidden>
	                    <div className="absolute inset-0 bg-[radial-gradient(400px_circle_at_88%_0%,rgba(255,255,255,0.07),transparent_50%)]" />
	                    <div className="request-qr-glow-a absolute inset-0 md:hidden bg-[radial-gradient(900px_circle_at_100%_75%,rgba(245,166,35,0.30),transparent_60%)]" />
	                    <div className="request-qr-glow-a absolute inset-0 hidden md:block bg-[radial-gradient(1300px_circle_at_100%_75%,rgba(245,166,35,0.30),transparent_60%)]" />
	                    <div className="request-qr-glow-b request-qr-glow-up absolute inset-0 bg-[radial-gradient(700px_circle_at_0%_100%,rgba(245,166,35,0.20),transparent_65%)]" />
	                  </div>
		                  {/* SECTION 3 — REQUEST QR */}
		                  <div className="space-y-5 pt-2 relative z-[2]">

	                    {/* ── Static wallet pill (style "Depuis le compte") ── */}
	                    <div className="flex justify-center pt-1 pb-1">
	                      <div className="shimmer-seq shimmer-seq-4 inline-flex flex-col items-center gap-1 bg-[#232829] px-6 py-2 rounded-[28px] ring-1 ring-white/[0.08] ring-inset">
	                        <span className="text-white/70 text-[14px] md:text-[15px] font-medium tracking-wide">
		                          {t('ui_receive_receiving_account_label', 'Compte de réception')}
	                        </span>
	                        <div className="flex items-center gap-2">
	                          <span className="h-3 w-3 rounded-full bg-[#f5a623] ring-4 ring-[#f5a623]/20 shrink-0 animate-pulse" aria-hidden />
	                          <span className="text-white/95 text-[14px] md:text-[15px] font-semibold">
	                            {activeWalletLabel || t('nav_wallet', 'Wallet')}
	                          </span>
	                        </div>
	                      </div>
	                    </div>
				                    {hasGeneratedRequest ? (
					                      <>
					                        {/* ── QR Code (primary action — first) ── */}
					                        <div className="qr-border-animated shimmer-seq shimmer-seq-1 relative overflow-hidden w-full flex flex-col items-center bg-[#232829] rounded-[20px] pt-5 pb-2 md:pt-8 md:pb-5 shadow-[0_2px_0_rgba(255,255,255,0.04)_inset,0_-2px_0_rgba(0,0,0,0.6)_inset,12px_36px_52px_rgba(0,0,0,0.68),-14px_14px_38px_rgba(0,0,0,0.42),0_64px_30px_-20px_rgba(0,0,0,0.6),8px_-10px_22px_rgba(0,0,0,0.28)]">
					                          <span aria-hidden className="request-qr-glass" />
				                          <div
				                            ref={requestQrContainerRef}
				                            className="w-[240px] md:w-[260px] aspect-square rounded-none p-3 cursor-pointer border-[20px] border-black"
				                            style={{ backgroundColor: '#E8E8E8' }}
				                            onClick={() => setQrZoomValue(requestQrValue)}
				                          >
					                          <QRCodeCanvas
					                            value={requestQrValue}
					                            size={requestQrPixelSize}
					                            style={{ width: '100%', height: '100%' }}
					                            bgColor="#E8E8E8"
					                            fgColor="#000000"
					                            includeMargin={true}
					                            level="M"
					                          />
				                          </div>
				                          <button
				                            type="button"
				                            onClick={() => setQrZoomValue(requestQrValue)}
				                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[17px] text-white/70 hover:text-white/90 transition-colors duration-150"
				                            aria-label="Agrandir le QR code"
				                          >
				                            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
				                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
				                            </svg>
				                            Agrandir le QR code
				                          </button>
					                        </div>

					                        {/* ── Amount (standalone, centered) ── */}
					                        <div className="relative z-10 text-center !mt-2 md:!mt-5">
					                          <div className="request-qr-amount-breathe wallet-request-amount-shimmer text-[40px] md:text-[48px] font-bold tracking-tight leading-none">
					                            {requestDisplayAmountLabel}
					                          </div>
					                        </div>

					                        {/* ── Details (date, message) ── */}
					                        <div className="shimmer-seq shimmer-seq-5 relative overflow-hidden !mt-1.5 md:!mt-5 flex flex-col gap-1 px-3 py-2 rounded-[14px] bg-[#232829] ring-1 ring-white/15 ring-inset">
					                          <span aria-hidden className="request-qr-glass-details" />
					                          <div className="flex items-center justify-between">
					                            <span className="text-[13px] text-white/70 font-medium">{t('ui_date_time_label', 'Date & Heure')}</span>
					                            <span className="text-[13px] text-white/95 font-medium">
					                              {requestDateParts.date && requestDateParts.time
					                                ? `${requestDateParts.date} · ${requestDateParts.time}`
					                                : requestDateLabel || '—'}
					                            </span>
					                          </div>
					                          {generatedRequest?.memo ? (
					                            <div className="flex items-center justify-between">
				                              <span className="text-[13px] text-white/70 font-medium">{t('ui_memo_label', 'Motif')}</span>
					                              <span className="text-[13px] text-white/95 font-medium">
					                                {generatedRequest.memo}
					                              </span>
					                            </div>
					                          ) : null}
					                        </div>

					                        {/* ── Actions ── */}
			                        <div className="grid grid-cols-2 gap-3">
			                          <button
			                            type="button"
	                            onClick={async e => {
	                              e.stopPropagation();
	                              await handleCopyQr(true);
	                            }}
	                            className={[
	                              'shimmer-seq shimmer-seq-3 w-full h-11 rounded-[20px] bg-[#232829] ring-1 ring-white/10 ring-inset text-white/85 text-xs font-semibold',
	                              'shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:ring-white/20 hover:bg-white/[0.04] transition-all duration-[140ms] active:scale-[0.99]',
	                            ].join(' ')}
	                          >
				                            {t('ui_copy_request', 'Copier la demande')}
	                          </button>
	                          <button
	                            type="button"
	                            onClick={async e => {
	                              e.stopPropagation();
	                              await handleShareQr(true);
	                            }}
                              className="shimmer-seq shimmer-seq-2 w-full h-11 rounded-[20px] bg-[#232829] text-white text-[17px] font-bold tracking-wide py-2 px-6 transition-all duration-[140ms] inline-flex items-center justify-center gap-2.5 hover:bg-white/[0.04] scale-[1.04] active:scale-[0.98]"
                              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -8px 16px rgba(0,0,0,0.25)' }}
	                          >
	                            <ShareIcon className="w-5 h-5" />
			                            <span>{shareActionLabel}</span>
			                          </button>
			                        </div>
			                      </>
			                    ) : (
		                      <div className="rounded-[14px] p-4 ring-1 ring-white/10 ring-inset bg-[#101415] text-white/60 text-sm">
		                        {t('ui_request_qr_missing', "Aucune demande n'a encore été générée.")}
		                      </div>
		                    )}
		                  </div>
	                </>
	              ) : null}

              {copyToast ? <div className="mt-3 text-[11px] text-xcannes-green/90 text-center">{copyToast}</div> : null}
            </div>
            {/* Bottom bar – desktop only (visual balance) – Demander un paiement */}
            {receiveView === 'request' ? (
              <div className="hidden md:flex pointer-events-none justify-center pt-2 pb-4" aria-hidden>
                <span className="block w-[120px] h-[4px] rounded-full bg-white/80" />
              </div>
            ) : null}
            {/* Bottom bar – mobile only – Demander un paiement */}
            {receiveView === 'request' && !inline ? (
              <div
                className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
                aria-hidden
              >
                <span className="block w-36 h-1.5 rounded-full bg-white/50" />
              </div>
            ) : null}
            {/* Bottom bar – desktop only (visual balance) – Comment souhaitez-vous recevoir ? */}
            {receiveView === 'choice' ? (
              <div className="hidden md:flex pointer-events-none justify-center pt-2 pb-4" aria-hidden>
                <span className="block w-[120px] h-[4px] rounded-full bg-white/80" />
              </div>
            ) : null}
            {/* Bottom bar – mobile only – Comment souhaitez-vous recevoir ? */}
            {receiveView === 'choice' && !inline ? (
              <div
                className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
                aria-hidden
              >
                <span className="block w-36 h-1.5 rounded-full bg-white/80" />
              </div>
            ) : null}
            {/* Bottom bar – desktop only (visual balance) – Votre adresse de compte */}
            {receiveView === 'share' ? (
              <div className="hidden md:flex pointer-events-none justify-center pt-2 pb-2 relative z-10" aria-hidden>
                <span className="block w-[120px] h-[4px] rounded-full bg-white/80" />
              </div>
            ) : null}
            {/* Bottom bar – mobile only – Votre adresse de compte */}
            {receiveView === 'share' && !inline ? (
              <div
                className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
                aria-hidden
              >
                <span className="block w-36 h-1.5 rounded-full bg-white/80" />
              </div>
            ) : null}
            {/* Bottom bar – desktop only (visual balance) – Demande prête */}
            {receiveView === 'request_qr' ? (
              <div className="hidden md:flex pointer-events-none justify-center pt-10 pb-4 relative z-[5]" aria-hidden>
                <span className="block w-[120px] h-[4px] rounded-full bg-white/80" />
              </div>
            ) : null}
            {/* Bottom bar – mobile only – Demande prête */}
            {receiveView === 'request_qr' && !inline ? (
              <div
                className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
                aria-hidden
              >
                <span className="block w-36 h-1.5 rounded-full bg-white/80" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
