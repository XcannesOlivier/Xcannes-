'use client';

import { Buffer } from 'buffer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useIsDesktop from '../hooks/useIsDesktop';
import { QRCodeCanvas } from 'qrcode.react';
import ModalSelect from '@/components/ui/ModalSelect';
import { createPortal } from 'react-dom';
import { useTranslation } from 'next-i18next';
import { XRPL_KNOWN_ISSUERS } from '@/utils/xrpl';

import { useModalTransition } from '@/hooks/useModalTransition';
import { formatAmountWithSymbol } from '../walletDashboardConfig';
import WalletActiveLabel from '../components/WalletActiveLabel';

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

const ChevronLeftIcon = ({ className = '' }) => (
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
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ArrowDownIcon = ({ className = '' }) => (
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
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

const QrIcon = ({ className = '' }) => (
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
    <path d="M7 7h1v1H7V7Z" />
    <path d="M16 7h1v1h-1V7Z" />
    <path d="M7 16h1v1H7v-1Z" />
    <path d="M4 4h6v6H4V4Z" />
    <path d="M14 4h6v6h-6V4Z" />
    <path d="M4 14h6v6H4v-6Z" />
    <path d="M14 14h2v2h-2v-2Z" />
    <path d="M18 14h2v6h-6v-2" />
    <path d="M14 18h2" />
  </svg>
);

const RequestIcon = ({ className = '' }) => (
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
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h5" />
  </svg>
);

const CheckCircleIcon = ({ className = '' }) => (
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
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const CopySmallIcon = ({ className = '' }) => (
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
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
  resetReceiveForm,
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
      setReceiveTabSafe(nextView);
    },
    [setReceiveTabSafe],
  );

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
      if (!setReceiveTab) setLocalReceiveTab('choice');
    }
  }, [open, setReceiveTab]);

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
	    return (walletList || [])
	      .map((w, idx) => {
	        const addr = typeof w === 'string' ? w : w?.address;
	        if (!addr) return null;
	        const labelFromList = typeof w === 'string' ? '' : trimmed(w?.label);
	        const label = addr === wallet ? activeWalletLabel : labelFromList || `Wallet ${idx + 1}`;
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
	          labelRight: shortAddress(addr),
	          labelMobile: label,
	        };
	      })
	      .filter(Boolean);
	  }, [activeWalletLabel, shortAddress, trimmed, wallet, walletList]);

	  const shareWalletOptions = useMemo(() => {
	    return walletOptions.map(opt => ({ ...opt, labelRight: undefined }));
	  }, [walletOptions]);

	  const walletPickerSurfaceClass =
	    receiveView === 'share' ? 'bg-white/[0.02]' : 'bg-transparent';

	  const walletPicker =
	    wallet && hasMultipleWallets ? (
	      <div
	        className={`rounded-[14px] border border-white/10 p-3 space-y-2 ${walletPickerSurfaceClass}`}
	      >
	        <div className="text-[11px] tracking-[0.22em] uppercase text-white/45">
	          {t('ui_receive_wallet_selector_label', 'Compte de réception')}
	        </div>
	        <ModalSelect
	          value={wallet}
	          onChange={next => {
	            const addr = trimmed(next);
	            if (!addr || addr === wallet) return;
	            onSwitchWallet?.(addr);
	          }}
	          options={walletOptions}
	          useNativeSelect={false}
	          iconClassName="inline-flex items-center justify-center leading-none"
	          buttonClassName={`${walletPickerSurfaceClass} hover:bg-white/5 ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer transition-colors duration-150`}
	          menuClassName={
	            noticeVariant === 'demo'
	              ? 'bg-xcannes-surface-demo !max-h-64 overflow-y-auto overscroll-contain touch-pan-y border-white/15 ring-1 ring-white/10'
	              : 'bg-elevated !max-h-64 overflow-y-auto overscroll-contain touch-pan-y border-white/15 ring-1 ring-white/10'
	          }
	          selectClassName={`xcannes-select w-full ${walletPickerSurfaceClass} ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-colors duration-150`}
	        />
	      </div>
	    ) : null;

  const isFxRequest = useMemo(() => {
    if (!selectedRequestToken?.isTrustlineOnly) return false;
    if (!requestCurrencyCode) return false;
    return requestCurrencyCode !== 'XRP' && requestCurrencyCode !== 'RLUSD' && requestCurrencyCode !== 'USD';
  }, [requestCurrencyCode, selectedRequestToken?.isTrustlineOnly]);

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
    const labelFontSize = Math.max(16, Math.round(exportWidth * 0.032));
    const addressFontSize = Math.max(13, Math.round(exportWidth * 0.026));
    const metaFontSize = Math.max(12, Math.round(exportWidth * 0.024));
    const labelFont = `600 ${labelFontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    const addressFont = `${addressFontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
    const metaFont = `${metaFontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;

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

    const labelText = String(
      useRequest
        ? generatedRequest?.beneficiaryLabel || activeWalletLabel || fallbackWalletLabel
        : activeWalletLabel || fallbackWalletLabel,
    ).trim();
    const addressText = String(useRequest ? generatedRequest?.to || wallet || '' : wallet || '').trim();
    const amountLine = useRequest ? `${requestDisplayAmountLabel} ${requestDisplayCurrency}`.trim() : '';
    const dateLine = useRequest ? requestDateLabel : '';

    if (labelText) {
      addLines(labelText, labelFont, '#111111', Math.round(labelFontSize * 1.35));
    }
    if (addressText) {
      addLines(addressText, addressFont, '#333333', Math.round(addressFontSize * 1.35));
    }
    if (amountLine) {
      addLines(amountLine, metaFont, '#444444', Math.round(metaFontSize * 1.35));
    }
    if (dateLine) {
      addLines(dateLine, metaFont, '#555555', Math.round(metaFontSize * 1.35));
    }

    const textGap = textLines.length ? Math.round(labelFontSize * 0.8) : 0;
    const textBlockHeight = textLines.reduce((sum, line) => sum + line.lineHeight, 0);
    exportCanvas.height = baseHeight + textGap + textBlockHeight;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    const offset = margin * scale;
    ctx.drawImage(canvas, offset, offset, srcWidth * scale, srcHeight * scale);
    try {
      const srcCtx = canvas.getContext('2d');
      const srcPixel = srcCtx?.getImageData(0, 0, 1, 1)?.data;
      const isDarkBg = srcPixel && srcPixel.length >= 3 ? srcPixel[0] + srcPixel[1] + srcPixel[2] < 128 * 3 : false;
      if (isDarkBg) {
        const imageData = ctx.getImageData(offset, offset, srcWidth * scale, srcHeight * scale);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        ctx.putImageData(imageData, offset, offset);
      }
    } catch {
      // fallback to raw canvas if pixel access fails
      ctx.drawImage(canvas, offset, offset, srcWidth * scale, srcHeight * scale);
    }

    if (textLines.length > 0) {
      let y = offset + srcHeight * scale + textGap;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      textLines.forEach(line => {
        ctx.font = line.font;
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, exportWidth / 2, y);
        y += line.lineHeight;
      });
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

	  const handleCopyWalletAddress = async () => {
	    const addr = trimmed(wallet);
	    if (!addr) return;
	    if (navigator?.clipboard?.writeText) {
	      try {
	        await navigator.clipboard.writeText(addr);
	        flashCopyToast(t('ui_address_copied', 'Adresse copiée'));
	        return;
	      } catch {
	        // fall through to execCommand
	      }
	    }
	    try {
	      const el = document.createElement('textarea');
	      el.value = addr;
	      el.setAttribute('readonly', '');
	      el.style.position = 'fixed';
	      el.style.left = '-9999px';
	      document.body.appendChild(el);
	      el.focus();
	      el.select();
	      const ok = document.execCommand('copy');
	      document.body.removeChild(el);
	      if (ok) {
	        flashCopyToast(t('ui_address_copied', 'Adresse copiée'));
	        return;
	      }
	    } catch {
	      // fall through
	    }
	    flashCopyToast(t('ui_address_copy_failed', "Impossible de copier l'adresse"));
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
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : formatAmountWithSymbol(locale, 0, requestDisplayCurrency, {
        minimumFractionDigits: 0,
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
    'relative w-full wallet-modal-panel wallet-receive-modal border-white/10 md:border p-4 md:p-5 space-y-4 flex flex-col min-h-0 overflow-y-auto overscroll-contain pointer-events-auto pb-[env(safe-area-inset-bottom)]',
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
  const disableSwipeToClose = !inline && !isDesktop && (receiveView === 'share' || receiveView === 'request');

  const headerTitle =
    receiveView === 'choice'
      ? t('ui_receive_title_short', 'Recevoir')
      : receiveView === 'share'
        ? t('ui_receive_choice_share_title', 'Coordonnées de réception')
        : receiveView === 'request_qr'
          ? t('ui_request_generated_label', 'Demande générée')
        : t('ui_receive_choice_request_title', 'Demander un paiement');
  const headerSubtitle =
    receiveView === 'choice'
      ? t('ui_receive_choice_subtitle', 'Choisissez comment recevoir un paiement.')
      : receiveView === 'share'
        ? t('ui_receive_choice_share_desc', 'Affichez le QR code et l’adresse de réception associés à ce compte.')
        : receiveView === 'request_qr'
          ? t('ui_request_qr_subtitle', 'Scannez ou partagez ce QR code.')
        : t('ui_receive_choice_request_desc', 'Définissez un montant, une devise et un mémo optionnel.');

  const choiceCardBaseClassName =
    // Match the "Convert" action button background (wallet-actions.css).
    'relative w-full text-left rounded-[20px] px-5 py-5 bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.03] ring-1 ring-white/10 ring-inset shadow-[0_14px_46px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.72)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/60';
  // Keep the first choice visually "primary" without changing the base background.
  const choiceCardGreenClassName = `${choiceCardBaseClassName} ring-xcannes-green/15 hover:ring-xcannes-green/25`;
  const choiceCardNeutralClassName = `${choiceCardBaseClassName}`;

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
            className="w-[80vw] max-w-[360px] aspect-square rounded-[20px] p-4 border-[20px] border-black"
            style={{ backgroundColor: '#FFFFFF' }}
            onClick={e => e.stopPropagation()}
          >
            <QRCodeCanvas
              value={qrZoomValue}
              size={1024}
              style={{ width: '100%', height: '100%' }}
              bgColor="#FFFFFF"
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
            {!inline && receiveView === 'choice' ? (
              <div
                className={`md:hidden flex justify-center -mt-1 pt-1 ${receiveView === 'choice' ? 'pb-4' : 'pb-2'}`}
                aria-hidden
                onPointerDown={event => {
                  if (!disableSwipeToClose) maybeStartOverlayDrag(event, 'fixed');
                }}
              >
                <span className="block w-12 h-1.5 rounded-full bg-white/20" />
              </div>
            ) : null}
            {receiveView !== 'choice' ? (
              <div
                className="relative pt-4 pb-3 flex flex-col items-center text-center"
                onPointerDown={event => {
                  if (!disableSwipeToClose) maybeStartOverlayDrag(event, 'fixed');
                }}
              >
	                <button
	                  type="button"
	                  onClick={e => {
	                    e.stopPropagation();
	                    switchReceiveView(receiveView === 'request_qr' ? 'request' : 'choice');
	                  }}
	                  className={`absolute left-0 top-3 shrink-0 h-9 rounded-xl bg-transparent border border-transparent hover:bg-white/5 text-white/80 transition-colors duration-150 inline-flex items-center ${
	                    isDesktop ? 'px-2.5 gap-1.5' : 'w-9 justify-center'
	                  }`}
	                  aria-label={t('ui_back', 'Retour')}
                  title={t('ui_back', 'Retour')}
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                  {isDesktop ? <span className="text-sm text-white/80">{t('ui_back', 'Retour')}</span> : null}
                </button>

                <h2 className="mt-1 text-[22px] md:text-[24px] font-semibold text-white/95 tracking-tight">
                  {headerTitle}
                </h2>

                {noticeVariant === 'demo' ? (
                  <span className="mt-2 inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-1 leading-none">
                    {t('demo_notice_title', 'Mode démo')}
                  </span>
                ) : null}

                <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-[34ch] leading-relaxed">
                  {headerSubtitle}
                </p>
              </div>
            ) : null}
            <div className="flex-1 min-h-0 flex flex-col">
              {receiveView === 'choice' ? (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div
                    className="pt-6 md:pt-5 pb-3 flex flex-col items-center text-center"
                    onPointerDown={event => {
                      maybeStartOverlayDrag(event, 'fixed');
                    }}
                  >
                    <h3 className="mt-1 text-[22px] md:text-[24px] font-semibold text-white/95 tracking-tight">
                      {t('ui_receive_choice_decision_title', 'Comment voulez-vous recevoir ?')}
                    </h3>
                    <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-[34ch] leading-relaxed">
                      {t('ui_receive_choice_decision_subtitle', 'Partagez votre QR ou créez une demande avec montant')}
                    </p>
                    <div
                      className="mt-5 w-12 h-12 rounded-2xl bg-white/5 ring-1 ring-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.45)] flex items-center justify-center text-xcannes-green/90"
                      aria-hidden="true"
                    >
                      <ArrowDownIcon className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col justify-center gap-4 py-6">
                    <button
                      type="button"
                      className={choiceCardGreenClassName}
                      onClick={e => {
                        e.stopPropagation();
                        switchReceiveView('share');
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-xcannes-green/90">
                          <QrIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[16px] md:text-[17px] font-semibold text-white/92">
                              {t('ui_receive_choice_share_title', 'Coordonnées de réception')}
                            </div>
                            <ChevronRightIcon className="w-5 h-5 text-white/30" />
                          </div>
                          <div className="mt-2 text-[13px] md:text-[14px] text-white/55 leading-relaxed">
                            {t(
                              'ui_receive_choice_share_desc',
                              'Affichez le QR code et l’adresse de réception associés à ce compte.',
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={choiceCardNeutralClassName}
                      onClick={e => {
                        e.stopPropagation();
                        switchReceiveView('request');
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-white/85">
                          <RequestIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[16px] md:text-[17px] font-semibold text-white/92">
                              {t('ui_receive_choice_request_title', 'Demander un paiement')}
                            </div>
                            <ChevronRightIcon className="w-5 h-5 text-white/30" />
                          </div>
                          <div className="mt-2 text-[13px] md:text-[14px] text-white/55 leading-relaxed">
                            {t(
                              'ui_receive_choice_request_desc',
                              'Définissez un montant, une devise et un mémo optionnel.',
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
	                  {/* SECTION 1 — RECEIVE FUNDS */}
	                  <div className="space-y-5 pt-2">

	                    {/* ── Header card (match "Demande de paiement" style) ── */}
	                    <div
	                      className={[
	                        'rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset border-b border-white/20 bg-[#101415]',
	                        'shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]',
	                      ].join(' ')}
	                    >
	                      <p className="text-[20px] tracking-[0.14em] font-orbitron font-bold text-white mb-3">
	                        {t('ui_receive_choice_share_title', 'COORDONNÉES DE RÉCEPTION')}
	                      </p>

	                      <div className="my-4 h-px bg-white/10" aria-hidden />

	                      {hasMultipleWallets ? (
	                        <ModalSelect
	                          value={wallet}
	                          onChange={next => {
	                            const addr = trimmed(next);
	                            if (!addr || addr === wallet) return;
	                            onSwitchWallet?.(addr);
	                          }}
	                          options={shareWalletOptions}
	                          useNativeSelect={false}
	                          iconClassName="inline-flex items-center justify-center leading-none"
	                          buttonClassName="w-full bg-transparent rounded-xl pl-0 pr-2 py-2 text-base text-white focus:outline-none cursor-pointer transition-colors duration-150"
	                          menuClassName={
	                            noticeVariant === 'demo'
	                              ? 'bg-xcannes-surface-demo !max-h-64 overflow-y-auto overscroll-contain touch-pan-y border-white/15 ring-1 ring-white/10'
	                              : 'bg-elevated !max-h-64 overflow-y-auto overscroll-contain touch-pan-y border-white/15 ring-1 ring-white/10'
	                          }
	                          selectClassName="xcannes-select w-full bg-transparent rounded-xl pl-0 pr-2 py-2 text-base text-white focus:outline-none transition-colors duration-150"
	                        />
	                      ) : (
	                        <div className="flex items-center gap-2 mb-1">
	                          <span
	                            className="h-3 w-3 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/25 shrink-0 animate-pulse"
	                            aria-hidden
	                          />
	                          <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
	                            {activeWalletLabel || t('nav_wallet', 'Wallet')}
	                          </p>
	                        </div>
	                      )}

	                      {wallet ? (
	                        <div className="mt-0.5 flex items-start gap-2">
	                          <span className="min-w-0 flex-1 text-left font-mono text-[14px] md:text-[15px] text-white/70">
	                            {shortAddress(wallet, 8, 6)}
	                          </span>
	                          <button
	                            type="button"
	                            onClick={async e => {
	                              e.stopPropagation();
	                              await handleCopyWalletAddress();
	                            }}
	                            className="shrink-0 rounded-md px-2 py-1 text-[11px] md:text-xs font-semibold ring-1 ring-white/10 bg-elevated text-white/70 hover:text-white hover:ring-white/20 transition-colors"
	                            aria-label={t('ui_copy_address', "Copier l'adresse")}
	                          >
	                            {t('ui_copy', 'Copier')}
	                          </button>
	                        </div>
	                      ) : null}
	                    </div>

	                    {/* ── QR Code ── */}
	                    <div className="w-full flex flex-col items-center">
	                        <div
	                          ref={receiveQrContainerRef}
	                          className="w-[220px] md:w-[200px] aspect-square rounded-[14px] p-3 cursor-pointer border-[20px] border-black"
	                          style={{ backgroundColor: '#FFFFFF' }}
	                          onClick={() => setQrZoomValue(receiveQrValue)}
	                        >
	                          <QRCodeCanvas
	                            value={receiveQrValue}
	                            size={qrPixelSize}
	                            style={{ width: '100%', height: '100%' }}
	                            bgColor="#FFFFFF"
	                            fgColor="#000000"
	                            includeMargin={true}
	                            level="M"
	                          />
	                        </div>
	                      <button
	                        type="button"
	                        onClick={() => setQrZoomValue(receiveQrValue)}
	                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] text-white/50 hover:text-white/80 transition-colors duration-150"
	                        aria-label="Agrandir le QR code"
	                      >
	                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
	                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
	                        </svg>
	                        Agrandir
	                      </button>
	                    </div>

	                    {/* ── Actions ── */}
	                    <div className="grid grid-cols-2 gap-3">
	                      <button
	                        type="button"
	                        onClick={async e => {
	                          e.stopPropagation();
	                          await handleCopyQr(false);
	                        }}
	                        className={[
	                          'w-full h-12 rounded-xl bg-[#101415] ring-1 ring-white/10 ring-inset text-white/85 text-sm font-semibold',
	                          'shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:ring-white/20 hover:bg-white/[0.04] transition-all duration-[140ms] active:scale-[0.99]',
	                        ].join(' ')}
	                      >
	                        {t('ui_copy', 'Copier')}
	                      </button>
	                      <button
	                        type="button"
	                        onClick={async e => {
	                          e.stopPropagation();
	                          await handleShareQr(false);
	                        }}
	                        className="w-full h-12 rounded-xl text-white font-semibold transition-all duration-150 inline-flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.98]"
	                        style={{ background: 'linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }}
	                      >
	                        <ShareIcon className="w-4 h-4" />
	                        <span>{shareActionLabel}</span>
	                      </button>
	                    </div>
	                  </div>
	                </>
	              ) : null}

		              {receiveView === 'request' ? (
		                <>
		                  {/* SECTION 2 — CREATE REQUEST */}
		                  <div className="space-y-2 pt-2">
	                    {/* ── Header card wallet (match "Coordonnées de réception" style) ── */}
	                    <div
	                      className={[
	                        'rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset border-b border-white/20 bg-[#101415]',
	                        'shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]',
	                      ].join(' ')}
	                    >
	                      <p className="text-[20px] tracking-[0.14em] font-orbitron font-bold text-white mb-3">
	                        {t('ui_request_create_card_title', 'DEMANDER UN PAIEMENT')}
	                      </p>

	                      <div className="my-4 h-px bg-white/10" aria-hidden />

	                      {hasMultipleWallets ? (
	                        <ModalSelect
	                          value={wallet}
	                          onChange={next => {
	                            const addr = trimmed(next);
	                            if (!addr || addr === wallet) return;
	                            onSwitchWallet?.(addr);
	                          }}
	                          options={shareWalletOptions}
	                          useNativeSelect={false}
	                          iconClassName="inline-flex items-center justify-center leading-none"
	                          buttonClassName="w-full bg-transparent rounded-xl pl-0 pr-2 py-2 text-base text-white focus:outline-none cursor-pointer transition-colors duration-150"
	                          menuClassName={
	                            noticeVariant === 'demo'
	                              ? 'bg-xcannes-surface-demo !max-h-64 overflow-y-auto overscroll-contain touch-pan-y border-white/15 ring-1 ring-white/10'
	                              : 'bg-elevated !max-h-64 overflow-y-auto overscroll-contain touch-pan-y border-white/15 ring-1 ring-white/10'
	                          }
	                          selectClassName="xcannes-select w-full bg-transparent rounded-xl pl-0 pr-2 py-2 text-base text-white focus:outline-none transition-colors duration-150"
	                        />
	                      ) : (
	                        <div className="flex items-center gap-2 mb-1">
	                          <span
	                            className="h-3 w-3 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/25 shrink-0 animate-pulse"
	                            aria-hidden
	                          />
	                          <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
	                            {activeWalletLabel || t('nav_wallet', 'Wallet')}
	                          </p>
	                        </div>
	                      )}

	                      {wallet ? (
	                        <div className="mt-0.5 flex items-start gap-2">
	                          <span className="min-w-0 flex-1 text-left font-mono text-[14px] md:text-[15px] text-white/70">
	                            {shortAddress(wallet, 8, 6)}
	                          </span>
	                          <button
	                            type="button"
	                            onClick={async e => {
	                              e.stopPropagation();
	                              await handleCopyWalletAddress();
	                            }}
	                            className="shrink-0 rounded-md px-2 py-1 text-[11px] md:text-xs font-semibold ring-1 ring-white/10 bg-elevated text-white/70 hover:text-white hover:ring-white/20 transition-colors"
	                            aria-label={t('ui_copy_address', "Copier l'adresse")}
	                          >
	                            {t('ui_copy', 'Copier')}
	                          </button>
	                        </div>
	                      ) : null}
	                    </div>

		                      {/* Currency */}
			                      <div className="pt-2">
			                        <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
			                          {t('ui_currency_1ed55673be', 'Currency')}
		                        </label>
			                        <ModalSelect
		                          value={requestCurrency}
		                          onChange={setRequestCurrency}
	                          options={(augmentedTokens || []).map(token => {
                            const currencyUpper = String(token.currency || '').toUpperCase();
                            const labelLeft =
                              selectLabelByCurrency?.[token.currency] ||
                              selectLabelByCurrency?.[currencyUpper] ||
                              token.currency;
                            const labelRight =
                              selectLabelRightByCurrency?.[token.currency] ||
                              selectLabelRightByCurrency?.[currencyUpper] ||
                              null;
                            return {
                              value: token.currency,
                              icon:
                                selectIconByCurrency?.[token.currency] || selectIconByCurrency?.[currencyUpper] || null,
                              label: labelLeft,
                              labelLeft,
                              labelRight,
                              labelMobile:
                                selectLabelMobileByCurrency?.[token.currency] ||
                                selectLabelMobileByCurrency?.[currencyUpper] ||
                                labelLeft,
                            };
	                          })}
	                          useNativeSelect={false}
		                          menuClassName={
		                            noticeVariant === 'demo'
		                              ? 'bg-xcannes-surface-demo !max-h-32 overflow-y-auto overscroll-contain touch-pan-y border-white/15 ring-1 ring-white/10'
		                              : 'bg-elevated !max-h-32 overflow-y-auto overscroll-contain touch-pan-y border-white/15 ring-1 ring-white/10'
		                          }
			                          buttonClassName={`hover:bg-white/5 ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer transition-colors duration-150 ${
			                            noticeVariant === 'demo' ? 'bg-xcannes-surface-demo' : 'bg-white/[0.02]'
			                          }`}
			                          selectClassName={`xcannes-select w-full ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-colors duration-150 ${
			                            noticeVariant === 'demo' ? 'bg-xcannes-surface-demo' : 'bg-white/[0.02]'
			                          }`}
			                        />
			                      </div>
	
		                      {/* Amount */}
					                      <div className="pt-4">
					                        <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
					                          {t('ui_amount_7668986206', 'Amount')}
					                        </label>
					                        <div className="relative">
					                          <input
					                            type="number"
					                            value={requestAmount}
					                            onChange={e => setRequestAmount(e.target.value)}
					                            placeholder="0.00"
					                            className={`xcannes-no-spinner w-full ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 pr-16 text-lg font-semibold text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-colors duration-150 ${
					                              noticeVariant === 'demo' ? 'bg-xcannes-surface-demo' : 'bg-white/[0.02]'
					                            }`}
					                          />
					                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-white/70">
					                            {requestCurrencyCode || 'USD'}
					                          </span>
					                        </div>
					                      </div>

	                      {/* Message (optional) */}
			                      <div className="pt-4">
			                        <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
			                          {t('ui_message_optional_label', 'Message (optional)')}
			                        </label>
				                        <input
			                          type="text"
				                          value={requestMemo}
				                          onChange={e => setRequestMemo(e.target.value)}
				                          placeholder={t('ui_request_memo_placeholder', 'Objet de la demande')}
				                          className={`w-full ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-colors duration-150 ${
				                            noticeVariant === 'demo' ? 'bg-xcannes-surface-demo' : 'bg-white/[0.02]'
				                          }`}
				                        />
				                      </div>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleGenerateRequest();
                        }}
                        className="mt-4 w-full h-12 rounded-xl text-white font-semibold transition-all duration-150 hover:scale-[1.01] active:scale-[0.98]"
                        style={{ background: 'linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }}
                      >
                        {t('ui_generate_request_fr', 'Générer la demande')}
                      </button>

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
		                  {/* SECTION 3 — REQUEST QR */}
		                  <div className="space-y-5 pt-2">
				                    {hasGeneratedRequest ? (
					                      <>
					                        {/* ── Header card (match "Augmenter vos soldes" style) ── */}
					                        <div
					                          className={[
					                            'rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset border-b border-white/20 bg-[#101415]',
					                            'shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]',
					                          ].join(' ')}
					                        >
					                          <p className="text-[20px] tracking-[0.14em] font-orbitron font-bold text-white mb-3">
					                            {t('ui_request_generated_card_title', 'DEMANDE DE PAIEMENT')}
					                          </p>

					                          <div className="text-white text-[36px] md:text-[42px] font-semibold tracking-tight leading-none">
					                            {requestDisplayAmountLabel}
					                          </div>

					                          <div className="mt-3 text-[13px] text-white/55">
					                            {requestDateParts.date && requestDateParts.time
					                              ? `${requestDateParts.date} · ${requestDateParts.time}`
					                              : requestDateLabel || '—'}
					                          </div>

					                          {generatedRequest?.memo ? (
					                            <div className="mt-2 flex items-baseline gap-2">
					                              <span className="shrink-0 text-[11px] tracking-[0.12em] uppercase text-white/40">
					                                {t('ui_memo_label', 'Memo')}
					                              </span>
					                              <span className="min-w-0 flex-1 text-[13px] text-white/70 break-words">
					                                {generatedRequest.memo}
					                              </span>
					                            </div>
					                          ) : null}

					                          <div className="my-4 h-px bg-white/10" aria-hidden />

					                          <div className="flex items-center gap-2 mb-1">
					                            <span
					                              className="h-3 w-3 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/25 shrink-0 animate-pulse"
					                              aria-hidden
					                            />
					                            <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
					                              {activeWalletLabel || t('nav_wallet', 'Wallet')}
					                            </p>
					                          </div>

					                          {wallet ? (
					                            <div className="mt-0.5 flex items-start gap-2">
					                              <span className="min-w-0 flex-1 text-left font-mono text-[14px] md:text-[15px] text-white/70">
					                                {shortAddress(wallet, 8, 6)}
					                              </span>
					                              <button
					                                type="button"
					                                onClick={() => { navigator.clipboard?.writeText(wallet); }}
					                                className="shrink-0 rounded-md px-2 py-1 text-[11px] md:text-xs font-semibold ring-1 ring-white/10 bg-elevated text-white/70 hover:text-white hover:ring-white/20 transition-colors"
					                                aria-label={t('ui_copy_address', "Copier l'adresse")}
					                              >
					                                {t('ui_copy', 'Copier')}
					                              </button>
					                            </div>
					                          ) : null}
					                        </div>

					                        {/* ── QR Code ── */}
					                        <div className="w-full flex flex-col items-center">
				                          <div
				                            ref={requestQrContainerRef}
				                            className="w-[220px] md:w-[200px] aspect-square rounded-[14px] p-3 cursor-pointer border-[20px] border-black"
				                            style={{ backgroundColor: '#FFFFFF' }}
				                            onClick={() => setQrZoomValue(requestQrValue)}
				                          >
					                          <QRCodeCanvas
					                            value={requestQrValue}
					                            size={requestQrPixelSize}
					                            style={{ width: '100%', height: '100%' }}
					                            bgColor="#FFFFFF"
					                            fgColor="#000000"
					                            includeMargin={true}
					                            level="M"
					                          />
				                          </div>
				                          <button
				                            type="button"
				                            onClick={() => setQrZoomValue(requestQrValue)}
				                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] text-white/50 hover:text-white/80 transition-colors duration-150"
				                            aria-label="Agrandir le QR code"
				                          >
				                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
				                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
				                            </svg>
				                            Agrandir
				                          </button>
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
	                              'w-full h-12 rounded-xl bg-[#101415] ring-1 ring-white/10 ring-inset text-white/85 text-sm font-semibold',
	                              'shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:ring-white/20 hover:bg-white/[0.04] transition-all duration-[140ms] active:scale-[0.99]',
	                            ].join(' ')}
	                          >
	                            {t('ui_copy', 'Copier')}
	                          </button>
	                          <button
	                            type="button"
	                            onClick={async e => {
	                              e.stopPropagation();
	                              await handleShareQr(true);
	                            }}
	                            className="w-full h-12 rounded-xl text-white font-semibold transition-all duration-150 inline-flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.98]"
	                            style={{ background: 'linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }}
	                          >
	                            <ShareIcon className="w-4 h-4" />
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
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
