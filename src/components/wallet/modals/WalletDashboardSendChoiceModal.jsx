'use client';

import { createPortal } from 'react-dom';
import { useTranslation } from 'next-i18next';
import { useModalTransition } from '@/hooks/useModalTransition';
import { useEffect, useRef, useState, useCallback } from 'react';
import { normalizeQrImageFile } from '@/utils/qrImage';

const EyeIcon = ({ className = '', slashed = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
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
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M9 9h10v12H9z" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
);

export default function WalletDashboardSendChoiceModal({
  open,
  onClose,
  onChooseQuickScan,
  onChooseSimpleSend,
  onChoosePayRequest,
  // Props needed for accordion sub-actions
  handlePaymentRequestScan,
  setSendDestination,
  setSendDestinationLabel,
  savedAddresses,
  currentWalletAddress,
  toast,
  renderWalletMeta,
  inline = false,
  onQrScanResult, // callback appelé par le parent quand le scan caméra retourne un résultat
  onQrPayreqScanResult, // callback pour injecter le résultat scan caméra dans le flow payreq
  onChoosePayreqScan, // ouvrir le scanner depuis le sub-modal payreq
}) {
  const { t } = useTranslation('common');
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  // ── Sub-modal state ──────────────────────────────────────────
  const [subModal, setSubModal] = useState(null); // 'quickscan' | 'payreq' | null
  // Reset la translation du parent quand on ouvre un sous-modal
  const openSubModal = useCallback((name) => {
    setOverlayTranslateY(0);
    setOverlayDragging(false);
    setSubModal(name);
  }, []);
  const [showSteps, setShowSteps] = useState(false);
  const [showPayreqSteps, setShowPayreqSteps] = useState(false);
  const [payreqPasteValue, setPayreqPasteValue] = useState('');
  const [payreqSelfSendError, setPayreqSelfSendError] = useState(false);
  const [simpleSendSelfError, setSimpleSendSelfError] = useState(false);
  const [quickscanPasteValue, setQuickscanPasteValue] = useState('');
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [showQuickscanSavedPicker, setShowQuickscanSavedPicker] = useState(false);
  const [selectedContactDisplay, setSelectedContactDisplay] = useState('');
  const [scannedDisplay, setScannedDisplay] = useState('');
  const [importedDisplay, setImportedDisplay] = useState('');
  const [pendingDestination, setPendingDestination] = useState({ address: '', label: '' });
  const [pendingPayreq, setPendingPayreq] = useState('');
  const [payreqScannedDisplay, setPayreqScannedDisplay] = useState('');
  const [payreqImportedDisplay, setPayreqImportedDisplay] = useState('');
  const [savedAddressesVisible, setSavedAddressesVisible] = useState(false);
  const [savedAddressModes, setSavedAddressModes] = useState({});
  const quickscanSavedPickerRef = useRef(null);
  const manualEntryInputRef = useRef(null);
  const normalizedCurrentWallet = String(currentWalletAddress || '').trim();
  const quickscanFileInputId = 'quickscan-choice-qr-file';
  const payreqFileInputId = 'payreq-choice-qr-file';
  const manualQrReaderIdRef = useRef(
    `choice-qr-reader-${Math.random().toString(36).slice(2, 10)}`,
  );
  const manualQrScannerRef = useRef(null);

  // Exposer un handler pour que le parent puisse injecter le résultat du scan caméra
  useEffect(() => {
    if (onQrScanResult) {
      onQrScanResult.__inject = (address) => {
        if (!address) return;
        const addr = address.trim();
        if (normalizedCurrentWallet && addr === normalizedCurrentWallet) { setSimpleSendSelfError(true); return; }
        setScannedDisplay(addr);
        setQuickscanPasteValue(addr);
        setPendingDestination({ address: addr, label: '' });
      };
    }
  }, [onQrScanResult, normalizedCurrentWallet]);

  useEffect(() => {
    if (!open) {
      setSubModal(null);
      setShowSteps(false);
      setShowPayreqSteps(false);
      setPayreqPasteValue('');
      setPayreqSelfSendError(false);
      setSimpleSendSelfError(false);
      setPendingPayreq('');
      setPayreqScannedDisplay('');
      setPayreqImportedDisplay('');
      setQuickscanPasteValue('');
      setManualEntryOpen(false);
      setShowQuickscanSavedPicker(false);
      setSavedAddressesVisible(false);
      setSavedAddressModes({});
    }
  }, [open]);

  useEffect(() => {
    if (!manualEntryOpen) return;
    const id = setTimeout(() => manualEntryInputRef.current?.focus?.(), 0);
    return () => clearTimeout(id);
  }, [manualEntryOpen]);

  useEffect(() => {
    if (!showQuickscanSavedPicker) return;

    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target) return;
      if (quickscanSavedPickerRef.current && quickscanSavedPickerRef.current.contains(target)) return;
      setShowQuickscanSavedPicker(false);
      setSavedAddressesVisible(false);
      setSavedAddressModes({});
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showQuickscanSavedPicker]);

  // ── Extract destination from raw payreq data ─────────────────
  const extractPayreqDestination = useCallback((raw) => {
    const str = String(raw || '').trim();
    // Try prefixed format: xcannes-payreq://BASE64
    const prefixMatch = str.match(/^(xcannes-payreq|xcannes-request)(?:\/\/|:)([\s\S]+)$/i);
    let payload = str;
    if (prefixMatch) {
      try {
        const b64 = String(prefixMatch[2] || '').replace(/\s+/g, '').trim();
        const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
        payload = Buffer.from(padded, 'base64').toString('utf8');
      } catch { /* fallthrough */ }
    }
    try {
      const obj = JSON.parse(payload);
      return String(obj?.to || obj?.t || '').trim();
    } catch { return ''; }
  }, []);

  const isPayreqSelfSend = useCallback((raw) => {
    if (!normalizedCurrentWallet) return false;
    const dest = extractPayreqDestination(raw);
    return Boolean(dest && dest === normalizedCurrentWallet);
  }, [normalizedCurrentWallet, extractPayreqDestination]);

  // Exposer un handler pour injecter le résultat scan caméra dans le flow payreq
  useEffect(() => {
    if (onQrPayreqScanResult) {
      onQrPayreqScanResult.__inject = (raw) => {
        if (!raw) return;
        const str = raw.trim();
        if (isPayreqSelfSend(str)) { setPayreqSelfSendError(true); return; }
        setPayreqSelfSendError(false);
        setPayreqScannedDisplay(str);
        setPendingPayreq(str);
      };
    }
  }, [onQrPayreqScanResult, isPayreqSelfSend]);

  // ── QR file decode (shared) ──────────────────────────────────
  const handleManualQrFile = useCallback(async (file, { isPayreq = false } = {}) => {
    if (!file) return;
    try {
      let scanFile = file;
      try { scanFile = await normalizeQrImageFile(file, { maxDimension: 1600 }); } catch { scanFile = file; }
      const { Html5Qrcode } = await import('html5-qrcode');
      const readerId = manualQrReaderIdRef.current;
      const instance = manualQrScannerRef.current || new Html5Qrcode(readerId);
      manualQrScannerRef.current = instance;
      let decodedText;
      try { decodedText = await instance.scanFile(scanFile, true); }
      catch {
        if (scanFile !== file) decodedText = await instance.scanFile(file, true);
        else throw new Error('decode failed');
      }
      try { await instance.clear(); } catch { /* ignore */ }
      if (decodedText) {
        if (isPayreq) {
          if (isPayreqSelfSend(decodedText)) { setPayreqSelfSendError(true); return; }
          setPayreqImportedDisplay(decodedText.trim());
          setPendingPayreq(decodedText.trim());
        } else {
          // Check if it looks like a payment request or just an address
          const looksLikePayreq = /^(xcannes-payreq|xcannes-request)(?::\/\/|:)/i.test(decodedText) ||
            (decodedText.startsWith('{') && /"to"|"targetCurrency"|"schema"|"payreq"/i.test(decodedText));
          if (looksLikePayreq) {
            if (isPayreqSelfSend(decodedText)) { setPayreqSelfSendError(true); return; }
            handlePaymentRequestScan?.(decodedText);
            onChoosePayRequest?.();
          } else {
            if (normalizedCurrentWallet && decodedText.trim() === normalizedCurrentWallet) { setSimpleSendSelfError(true); return; }
            setImportedDisplay(decodedText.trim());
            setQuickscanPasteValue(decodedText.trim());
            setPendingDestination({ address: decodedText.trim(), label: '' });
          }
        }
      }
    } catch {
      toast?.error(t('ui_qr_decode_failed_3b5d7f9a2c', 'Unable to decode this image. Try a clearer screenshot.'));
    }
  }, [handlePaymentRequestScan, normalizedCurrentWallet, onChoosePayRequest, isPayreqSelfSend, toast, t]);

  const handleFileUpload = useCallback((inputId) => {
    const input = document.getElementById(inputId);
    input?.click();
  }, []);

  // ── Paste handler for "Quick Scan" accordion ────────────────
  const looksLikeXrplAddress = (v) => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(v);

  const handleQuickscanPasteSubmit = useCallback(() => {
    const raw = quickscanPasteValue.trim();
    if (!raw) return;
    if (normalizedCurrentWallet && raw === normalizedCurrentWallet) { setSimpleSendSelfError(true); return; }
    setSimpleSendSelfError(false);
    if (looksLikeXrplAddress(raw)) {
      setPendingDestination({ address: raw, label: '' });
    } else {
      const result = handlePaymentRequestScan?.(raw);
      if (result?.relayChallenge || result?.navigate) {
        onClose?.();
        return;
      }
      setPendingDestination({ address: raw, label: '' });
    }
  }, [quickscanPasteValue, handlePaymentRequestScan, onClose, normalizedCurrentWallet]);

  // ── Paste handler for "Payer une demande" ────────────────────
  const handlePayreqPasteSubmit = useCallback(() => {
    const raw = payreqPasteValue.trim();
    if (!raw) return;
    if (isPayreqSelfSend(raw)) { setPayreqSelfSendError(true); return; }
    setPayreqSelfSendError(false);
    setPendingPayreq(raw);
  }, [payreqPasteValue, isPayreqSelfSend]);

  // ── Icons ────────────────────────────────────────────────────
  const QuickScanIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 md:w-10 md:h-10" fill="none" aria-hidden>
      <rect x="10" y="10" width="12" height="12" rx="2" className="stroke-xcannes-green/70" strokeWidth="1.5" fill="none" />
      <rect x="13" y="13" width="6" height="6" rx="1" className="fill-xcannes-green/50" />
      <rect x="26" y="10" width="12" height="12" rx="2" className="stroke-white/50" strokeWidth="1.5" fill="none" />
      <rect x="29" y="13" width="6" height="6" rx="1" className="fill-white/30" />
      <rect x="10" y="26" width="12" height="12" rx="2" className="stroke-white/50" strokeWidth="1.5" fill="none" />
      <rect x="13" y="29" width="6" height="6" rx="1" className="fill-white/30" />
      <path d="M26 30h4m4 0h4" className="stroke-xcannes-green/60" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M26 36h12" className="stroke-white/30" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const PayRequestIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 md:w-10 md:h-10" fill="none" aria-hidden>
      <rect x="10" y="12" width="28" height="24" rx="5" className="fill-white/5 stroke-white/40" strokeWidth="1.5" />
      <path d="M16 22h16" className="stroke-white/50" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 28h10" className="stroke-white/35" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="34" cy="30" r="6" className="fill-[#f5a623]/15 stroke-[#f5a623]/60" strokeWidth="1.4" />
      <path d="M34 27v6m-2-4c0-.7.9-1.2 2-1.2s2 .5 2 1.2-.9 1.2-2 1.2-2 .5-2 1.2.9 1.2 2 1.2 2-.5 2-1.2"
        className="stroke-[#f5a623]/90" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const cardClassName =
    'w-full text-left rounded-[20px] px-4 py-4 md:px-6 md:py-5 bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.03] ring-1 ring-white/10 ring-inset shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]';

  const accordionBtnClass =
    'flex items-center justify-center gap-2.5 w-full rounded-[20px] px-3 py-2.5 bg-white/[0.07] hover:bg-white/[0.10] active:bg-white/[0.04] transition-colors duration-100';

  // ── Swipe-to-close (mobile) ────────────────────────────────
  const [overlayDragging, setOverlayDragging] = useState(false);
  const [overlayTranslateY, setOverlayTranslateY] = useState(0);
  const overlayRef = useRef(null);
  const overlayListRef = useRef(null);
  const overlayDragMetaRef = useRef({
    startY: 0, startAt: 0, pointerId: null, lastDelta: 0,
    pending: false, source: null, dragging: false,
    scrollLocked: false, lockedOverflowY: '',
  });
  const closeRequestedRef = useRef(false);

  const subModalRef = useRef(null);

  // Swipe natif pour le sous-modal (window listeners – fiable quelle que soit la hiérarchie DOM)
  const subSwipeMeta = useRef(null);
  const handleSubModalPillDown = useCallback((event) => {
    if (inline) return;
    if (!event?.isPrimary || event.pointerType === 'mouse') return;
    if (event.target?.closest?.('input,textarea,select,button,a,[role="button"]')) return;
    subSwipeMeta.current = { startY: event.clientY, startAt: Date.now(), pointerId: event.pointerId, lastDeltaY: 0, dragging: false };

    const onMove = (e) => {
      if (!subSwipeMeta.current || e.pointerId !== subSwipeMeta.current.pointerId) return;
      const delta = e.clientY - subSwipeMeta.current.startY;
      if (delta <= 0) return;
      subSwipeMeta.current.lastDeltaY = delta;
      setOverlayTranslateY(delta);
      setOverlayDragging(true);
    };
    const onEnd = (e) => {
      if (!subSwipeMeta.current || e.pointerId !== subSwipeMeta.current.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      const delta = subSwipeMeta.current.lastDeltaY || 0;
      const duration = Math.max(1, Date.now() - subSwipeMeta.current.startAt);
      const velocity = delta / duration;
      const height = typeof window !== 'undefined' ? window.innerHeight : 800;
      const closeDistance = Math.max(220, Math.min(320, height * 0.28));
      const shouldClose = delta > closeDistance || (delta > closeDistance * 0.6 && velocity > 1.25);
      subSwipeMeta.current = null;
      setOverlayDragging(false);
      if (shouldClose) {
        setOverlayTranslateY(Math.max(delta, height));
        closeRequestedRef.current = true;
        window.setTimeout(() => { onClose?.(); }, 180);
      } else {
        setOverlayTranslateY(0);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }, [inline, onClose]);

  useEffect(() => {
    const resetMeta = {
      startY: 0, startAt: 0, pointerId: null, lastDelta: 0,
      pending: false, source: null, dragging: false,
      scrollLocked: false, lockedOverflowY: '',
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
      if (listEl && meta?.scrollLocked) listEl.style.overflowY = meta.lockedOverflowY;
    } catch { /* ignore */ }
    setOverlayDragging(false);
    if (!closeRequestedRef.current) setOverlayTranslateY(0);
    overlayDragMetaRef.current = resetMeta;
  }, [open]);

  const releaseOverlayScrollLock = () => {
    const meta = overlayDragMetaRef.current;
    if (meta?.source !== 'list' || !meta?.scrollLocked) return;
    const listEl = overlayListRef.current;
    if (!listEl) return;
    try { listEl.style.overflowY = meta.lockedOverflowY; } catch { /* ignore */ }
    meta.scrollLocked = false;
    meta.lockedOverflowY = '';
  };

  const maybeStartOverlayDrag = (event, source) => {
    if (inline) return false;
    if (!event?.isPrimary || event.pointerType === 'mouse') return false;
    if (event.target?.closest?.('input,textarea,select')) return false;
    if (source === 'list') {
      const listEl = overlayListRef.current;
      if (!listEl || listEl.scrollTop > 0) return false;
    }
    overlayDragMetaRef.current = {
      startY: event.clientY, startAt: Date.now(), pointerId: event.pointerId,
      lastDelta: 0, pending: true, source, dragging: false,
      scrollLocked: false, lockedOverflowY: '',
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
      try { overlayRef.current?.setPointerCapture?.(event.pointerId); } catch { /* */ }
      if (meta.source === 'list') {
        const listEl = overlayListRef.current;
        if (listEl && listEl.scrollTop <= 0) {
          try {
            meta.lockedOverflowY = listEl.style.overflowY;
            meta.scrollLocked = true;
            listEl.style.overflowY = 'hidden';
            listEl.scrollTop = 0;
          } catch { /* */ }
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
    const velocity = delta / duration;
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
        setOverlayTranslateY(Math.max(delta, height));
        window.setTimeout(() => { onClose?.(); }, 180);
      }
      return;
    }
    setOverlayTranslateY(0);
    overlayDragMetaRef.current = {
      startY: 0, startAt: 0, pointerId: null, lastDelta: 0,
      pending: false, source: null, dragging: false,
      scrollLocked: false, lockedOverflowY: '',
    };
  };

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? 'relative w-full h-full flex'
    : 'fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none';
  const liftAnimClass = closeRequestedRef.current
    ? ''
    : !inline
      ? isClosing ? 'wallet-modal-lift-out' : 'wallet-modal-lift-in'
      : '';
  const backdropAnimClass = closeRequestedRef.current
    ? ''
    : isClosing ? 'wallet-modal-backdrop-out' : 'wallet-modal-backdrop-in';
  const panelClass = [
    'relative w-full wallet-modal-panel wallet-cash-modal wallet-modal-no-top-highlight-mobile border-white/10 md:border lg:border-0 overflow-hidden flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)]',
    inline ? 'h-full max-h-none rounded-xl' : 'h-screen md:h-auto md:max-w-lg md:max-h-[100vh] rounded-none md:rounded-2xl',
    'bg-elevated',
    inline ? 'wallet-inline-zoom-in' : '',
    liftAnimClass,
  ].join(' ');

  const content = (
    <>
      {/* Backdrop */}
          {!inline ? <div
            className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${backdropAnimClass}`}
            onClick={onClose}
            style={
              subModal
                ? { opacity: overlayTranslateY > 0 ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) : 0 }
                : overlayTranslateY > 0
                  ? { opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) }
                  : undefined
            }
          /> : null}

      {/* Modal */}
      <div className={wrapperClass}>
        <div
          ref={overlayRef}
          className={inline ? 'w-full h-full flex' : 'pointer-events-auto w-full'}
          style={{
            transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
            transition: overlayDragging ? 'none' : 'transform 220ms cubic-bezier(0.2,0,0,1)',
            opacity: overlayTranslateY > 0 ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) : undefined,
            willChange: overlayTranslateY ? 'transform' : undefined,
            visibility: subModal ? 'hidden' : undefined,
          }}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerEnd}
          onPointerCancel={handleOverlayPointerEnd}
        >
          <div
            className={panelClass}
            onClick={e => { if (!inline) e.stopPropagation(); }}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_12%_0%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(600px_circle_at_100%_50%,rgba(0,255,150,0.06),transparent_60%)]" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
            </div>

            <div className="relative z-10 flex flex-col flex-1 min-h-0">
              {/* Drag handle (mobile) */}
              {!inline ? (
                <div
                  className="md:hidden flex justify-center pt-3 pb-0"
                  aria-hidden
                  onPointerDown={event => { maybeStartOverlayDrag(event, 'fixed'); }}
                >
                  <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                </div>
              ) : null}

              <div className="flex-1 min-h-0 flex flex-col">
                {/* Title + subtitle + arrow */}
                <div
                  className="pt-[70px] md:pt-[96px] pb-3 flex flex-col items-center text-center"
                  onPointerDown={event => { maybeStartOverlayDrag(event, 'fixed'); }}
                >
                  <h3 className="mt-1 px-6 text-[30px] md:text-[32px] font-semibold text-white/95 tracking-tight">
                    {t('ui_send_choice_subtitle', "Comment souhaitez-vous envoyer de l'argent ?")}
                  </h3>
                  <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-[34ch] leading-relaxed">
                    {t('ui_send_choice_hint', 'Choisissez le type d’envoi qui correspond à votre besoin.')}
                  </p>
                  {/* Wallet meta pill */}
                  <div className="mt-[40px] flex justify-center px-4 w-full">
                    {renderWalletMeta?.({
                      variant: "pill-column",
                      className: "flex justify-center",
                      prefix: t("moonpay_from_account", "Compte source"),
                      pillClassName:
                        "bg-elevated ring-1 ring-white/10 shadow-none",
                    })}
                  </div>
                </div>

                {/* Cards — vertically centred in remaining space */}
                <div
                  ref={overlayListRef}
                  className={`flex-1 min-h-0 flex flex-col justify-start gap-[32px] mt-8 pt-1 px-4 md:px-5 [--list-pad:1rem] md:[--list-pad:1.25rem] ${showQuickscanSavedPicker ? 'overflow-visible' : 'overflow-y-auto'}`}
                  onPointerDown={event => { maybeStartOverlayDrag(event, 'list'); }}
                >

                  {/* Hidden file inputs for QR image import */}
                  <input
                    id={quickscanFileInputId}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target?.files?.[0];
                      if (file) handleManualQrFile(file, { isPayreq: false });
                      e.target.value = '';
                    }}
                  />
                  <input
                    id={payreqFileInputId}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target?.files?.[0];
                      if (file) handleManualQrFile(file, { isPayreq: true });
                      e.target.value = '';
                    }}
                  />

                  {/* ── 1. Envoi simple ── */}
                  <div className={cardClassName}>
                    <button
                      type="button"
                      onClick={() => openSubModal('quickscan')}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-[16px] bg-transparent ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                          <QuickScanIcon />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[18px] md:text-[22px] text-white font-semibold truncate">
                              {t('ui_send_simple_title', 'Envoi simple')}
                            </p>
                            <svg className="w-5 h-5 md:w-6 md:h-6 text-white/45 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <p className="mt-1 text-[15px] md:text-[16px] leading-snug text-white/60">
                            {t('ui_send_simple_hint_long', 'Saisissez une adresse, choisissez la devise et indiquez le montant.')}
                          </p>
                        </div>
                      </div>
                    </button>
                    {/* Steps toggle */}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowSteps(s => !s); }} className="mt-3 inline-flex items-center gap-1 text-[13px] text-white/80 hover:text-white transition-colors duration-150 font-medium self-start text-left">
                      <span>{showSteps ? t('ui_hide_steps', 'Masquer les étapes') : t('ui_show_steps', "Voir les étapes de l'envoi")}</span>
                      <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${showSteps ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    {/* Steps guide (collapsible) */}
                    <div className="overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ maxHeight: showSteps ? '300px' : '0px', opacity: showSteps ? 1 : 0 }}>
                      <ol className="space-y-2 text-[12px] leading-relaxed pt-3 pb-1">
                        <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">1</span><span className="text-white/60">{t('ui_step_1', 'Renseignez l\'adresse du destinataire — scannez, saisissez, importez ou choisissez dans votre liste.')}</span></li>
                        <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">2</span><span className="text-white/60">{t('ui_step_2', 'Sélectionnez la devise parmi celles disponibles sur votre compte.')}</span></li>
                        <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">3</span><span className="text-white/60">{t('ui_step_3', 'Indiquez le montant à envoyer.')}</span></li>
                        <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">4</span><span className="text-white/60">{t('ui_step_4', 'Vérifiez et validez en toute sécurité.')}</span></li>
                      </ol>
                    </div>
                  </div>

                  {/* ── 2. Payer une demande ── */}
                  <div className={`${cardClassName} md:py-4`}>
                    <button
                      type="button"
                      onClick={() => openSubModal('payreq')}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-[16px] bg-transparent ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                          <PayRequestIcon />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[18px] md:text-[22px] text-white font-semibold truncate md:whitespace-normal md:break-words">
                              {t('ui_send_choice_pay_request_title', 'Payer une demande')}
                            </p>
                            <svg className="w-5 h-5 md:w-6 md:h-6 text-white/45 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <p className="mt-1 text-[15px] md:text-[16px] leading-snug text-white/60">
                            {t('ui_send_pay_request_hint', 'Scannez, importez un QR code ou saisissez une demande de paiement.')}
                          </p>
                        </div>
                      </div>
                    </button>
                    {/* Steps toggle */}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowPayreqSteps(s => !s); }} className="mt-3 inline-flex items-center gap-1 text-[13px] text-white/80 hover:text-white transition-colors duration-150 font-medium self-start text-left">
                      <span>{showPayreqSteps ? t('ui_hide_steps', 'Masquer les étapes') : t('ui_show_steps', 'Voir les étapes de paiement')}</span>
                      <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${showPayreqSteps ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    {/* Steps guide (collapsible) */}
                    <div className="overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ maxHeight: showPayreqSteps ? '200px' : '0px', opacity: showPayreqSteps ? 1 : 0 }}>
                      <ol className="space-y-2 text-[12px] leading-relaxed pt-3 pb-1">
                        <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f5a623]/15 text-[#f5a623] text-[11px] font-bold flex items-center justify-center">1</span><span className="text-white/60">{t('ui_payreq_step_1', 'Renseignez le code ou QR code — scannez, saisissez, importez.')}</span></li>
                        <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f5a623]/15 text-[#f5a623] text-[11px] font-bold flex items-center justify-center">2</span><span className="text-white/60">{t('ui_payreq_step_2', 'Vérifiez et validez en toute sécurité.')}</span></li>
                      </ol>
                    </div>
                  </div>

                  {/* Hidden div for html5-qrcode reader */}
                  <div id={manualQrReaderIdRef.current} className="hidden" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Sub-modal: Envoi simple ═══ */}
      {subModal === 'quickscan' ? (
        <div className={inline ? 'absolute inset-0 z-50 flex' : 'fixed inset-0 z-[10100] flex items-end md:items-center justify-center md:px-4 pointer-events-none'}>
          {!inline ? <div className="fixed inset-0 bg-black/70 md:backdrop-blur-sm pointer-events-auto wallet-modal-backdrop-in" onClick={() => setSubModal(null)} style={overlayTranslateY > 0 ? { opacity: Math.max(0, 1 - overlayTranslateY / 420) } : undefined} /> : null}
          <div className={inline ? 'w-full h-full' : 'relative z-10 pointer-events-auto w-full md:max-w-lg wallet-modal-lift-in'} style={!inline ? { boxShadow: '8px 16px 48px rgba(255,255,255,0.07), 0 0 0 1px rgba(255,255,255,0.06)' } : undefined}>
            <div
              ref={subModalRef}
              className={inline ? 'relative w-full h-full overflow-hidden flex flex-col bg-elevated rounded-xl' : 'relative w-full wallet-modal-panel wallet-cash-modal border-white/10 md:border overflow-hidden flex flex-col bg-elevated h-screen md:h-auto md:max-h-[80vh] rounded-none md:rounded-2xl pb-[env(safe-area-inset-bottom)]'}
              style={!inline && overlayTranslateY ? { transform: `translateY(${Math.max(0, overlayTranslateY)}px)`, transition: overlayDragging ? 'none' : 'transform 220ms cubic-bezier(0.2,0,0,1)', opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) } : undefined}
              onPointerDown={handleSubModalPillDown}
            >
              {/* Glow */}
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                <div className="absolute inset-0 md:hidden bg-[radial-gradient(700px_circle_at_100%_50%,rgba(0,255,150,0.08),transparent_60%)]" />
                <div className="absolute inset-0 hidden md:block bg-[radial-gradient(1000px_circle_at_100%_50%,rgba(0,255,150,0.08),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(400px_circle_at_0%_100%,rgba(255,255,255,0.03),transparent_55%)]" />
              </div>
              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                {/* Swipe bar – mobile only */}
                {!inline ? (
                  <div className="md:hidden flex justify-center pt-3 pb-0" aria-hidden>
                    <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                  </div>
                ) : null}
                <div className="px-5 pt-[30px] md:pt-[60px] pb-5 flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
                {/* Title + subtitle (centered) */}
                <div className="flex flex-col items-center text-center mb-[40px]">
                  <h3 className="mt-1 text-[28px] md:text-[32px] font-bold text-white/95 tracking-tight">
                    {t('ui_send_choose_recipient_title', 'Envoyer à un destinataire')}
                  </h3>
                  <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-[56ch] leading-relaxed">
                    {t('ui_send_choose_recipient_hint', 'Choisissez une adresse enregistrée, scannez un QR code ou saisissez-la manuellement.')}
                  </p>
                  {/* Wallet meta pill */}
                  <div className="mt-6 flex justify-center px-4 w-full">
                    {renderWalletMeta?.({
                      variant: 'pill-column',
                      className: 'flex justify-center',
                      prefix: t('moonpay_from_account', 'Compte source'),
                      pillClassName: 'bg-elevated ring-1 ring-white/10 shadow-none',
                    })}
                  </div>
                </div>

                <div className="rounded-[26px] bg-[linear-gradient(180deg,rgba(16,20,21,0.92)_0%,rgba(9,12,13,0.72)_100%)] ring-1 ring-white/10 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-26px_46px_rgba(0,0,0,0.55)] p-3 md:p-4">
                  <div className="flex flex-col gap-3">

                  {/* 4. Choisir un contact */}
                  <div className="relative" ref={quickscanSavedPickerRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickscanSavedPicker(prev => {
                          const next = !prev;
                          if (!next) {
                            setSavedAddressesVisible(false);
                            setSavedAddressModes({});
                          }
                          return next;
                        });
                      }}
                      className="w-full grid grid-cols-[56px_1fr] gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 hover:bg-white/[0.02] transition-colors duration-150 text-left"
                    >
                      <div className="w-14 flex items-center justify-center flex-shrink-0">
                        <div className="xcannes-fade-ring-y w-14 h-14 rounded-full bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
                          <svg className="w-[26px] h-[26px] text-xcannes-green" fill="none" viewBox="0 0 24 24" strokeWidth={0.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-white/90">
                          {t('ui_saved_recipient_title', 'Destinataire enregistré')}
                        </p>
                        <div className="xcannes-irregular-green-border mt-2 flex items-center justify-between rounded-xl pl-3 pr-2.5 py-2 bg-black/60 shadow-[inset_0_-30px_30px_-20px_rgba(0,0,0,0.92)]">
                          <span className={`text-[13px] truncate ${selectedContactDisplay ? 'text-white/85' : 'text-white/55'}`}>
                            {selectedContactDisplay || t('ui_saved_recipient_hint', 'Sélectionnez un destinataire')}
                          </span>
                          <svg className={`w-4 h-4 text-xcannes-green flex-shrink-0 ml-2 transition-transform duration-200 ${showQuickscanSavedPicker ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>
                    </button>
                    <div
                      className={`absolute left-0 right-0 top-full mt-1.5 z-[100] rounded-[20px] ring-1 ring-white/10 ring-inset overflow-hidden bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] transition-all duration-200 origin-top ${showQuickscanSavedPicker ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-95 pointer-events-none'}`}
                    >
                      <div className="px-4 py-2.5 border-b border-white/[0.04]">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] md:text-[14px] text-white/40 font-normal">
                            {t('ui_saved_addresses_label', 'Adresses enregistrées')}
                          </p>
                          <button
                            type="button"
                            className="shrink-0 rounded-md bg-white/[0.06] p-1 text-white/35 hover:bg-white/[0.10] hover:text-white/55 transition-colors"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSavedAddressesVisible((prev) => !prev);
                              setSavedAddressModes({});
                            }}
                            aria-label={t('ui_toggle_saved_addresses_visibility', 'Afficher les adresses')}
                            title={t('ui_toggle_saved_addresses_visibility', 'Afficher les adresses')}
                          >
                            <EyeIcon className="h-4 w-4" slashed={savedAddressesVisible} />
                          </button>
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto overscroll-contain">
                        {(() => {
                          const filtered = (savedAddresses || []).filter(entry => { const addr = String(entry?.address || '').trim(); if (!addr) return false; if (normalizedCurrentWallet && addr === normalizedCurrentWallet) return false; return true; });
                          return filtered.length > 0 ? filtered.map((addr, idx) => {
                            const addrStr = String(addr?.address || '').trim();
                            const label = String(addr?.onChainLabel || addr?.label || '').trim() || t('ui_wallet_unknown', 'Unknown wallet');
                            const isSelected = quickscanPasteValue.trim() === addrStr;
                            const mode = savedAddressModes?.[addrStr] || 'truncated';
                            const addressLine = !savedAddressesVisible
                              ? '••••••••'
                              : mode === 'full'
                                ? addrStr
                                : (
                                  <>
                                    <span className="md:hidden">{addrStr.length > 18 ? `${addrStr.slice(0, 8)}…${addrStr.slice(-4)}` : addrStr}</span>
                                    <span className="hidden md:inline">{addrStr.length > 26 ? `${addrStr.slice(0, 14)}…${addrStr.slice(-6)}` : addrStr}</span>
                                  </>
                                );
                            return (
                              <button
                                key={`qs-${addrStr}-${idx}`}
                                type="button"
                                onClick={() => { if (!addrStr) return; setQuickscanPasteValue(addrStr); setSelectedContactDisplay(label || addrStr); setShowQuickscanSavedPicker(false); setPendingDestination({ address: addrStr, label: label || addrStr }); }}
                                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isSelected ? 'bg-xcannes-green/10' : 'hover:bg-white/5'} ${idx < filtered.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className={`text-[16px] md:text-[17px] font-semibold truncate ${isSelected ? 'text-xcannes-green' : 'text-white/90'}`}>{label}</p>
                                  {savedAddressesVisible ? (
                                    <div className="mt-0.5 flex items-start gap-2">
                                      <button
                                        type="button"
                                        className={`min-w-0 flex-1 text-left text-[13px] font-mono font-light ${
                                          mode === 'full' ? 'text-white/55 whitespace-normal break-all' : 'text-white/40 truncate'
                                        }`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSavedAddressModes((prev) => ({
                                            ...(prev || {}),
                                            [addrStr]: prev?.[addrStr] === 'full' ? 'truncated' : 'full',
                                          }));
                                        }}
                                        title={addrStr}
                                        aria-label={t('ui_toggle_wallet_address_truncation', "Afficher l'adresse complète")}
                                      >
                                        {addressLine}
                                      </button>
                                      <button
                                        type="button"
                                        className="shrink-0 rounded-md p-1 text-white/45 hover:text-white/80 transition-colors"
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          try {
                                            await navigator.clipboard?.writeText?.(addrStr);
                                          } catch {
                                            /* ignore */
                                          }
                                        }}
                                        aria-label={t('ui_copy_address', "Copier l'adresse")}
                                        title={t('ui_copy_address', "Copier l'adresse")}
                                      >
                                        <CopyIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="text-[13px] font-mono font-light text-white/30 mt-0.5">
                                      {addressLine}
                                    </p>
                                  )}
                                </div>
                                {isSelected ? (
                                  <svg className="w-4 h-4 text-xcannes-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>
                                ) : null}
                              </button>
                            );
                          }) : (
                            <div className="px-4 py-6 text-center">
                              <svg className="w-8 h-8 text-white/20 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
                              <p className="text-[13px] text-white/40">{t('ui_no_saved_addresses', 'Aucune adresse enregistrée')}</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* 1. Scanner un QR code */}
                  <button
                    type="button"
                    onClick={onChooseQuickScan}
                    className="xcannes-fade-border-y w-full grid grid-cols-[56px_1fr_24px] items-center gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 hover:bg-white/[0.02] transition-colors duration-150 text-left rounded-[20px]"
                  >
                    <div className="w-14 flex items-center justify-center flex-shrink-0">
                      <div className="xcannes-fade-ring-y w-14 h-14 rounded-full bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
                        <svg className="w-[26px] h-[26px] text-xcannes-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white/85">{t('ui_scan_card_title', 'Scanner un QR code')}</p>
                      {scannedDisplay ? (
                        <div className="flex items-center mt-1.5 bg-black/80 ring-1 ring-white/10 ring-inset rounded-xl pl-3 pr-3 py-2">
                          <span className="text-[13px] truncate text-white/85">{scannedDisplay}</span>
                        </div>
                      ) : (
                        <p className="text-[13px] text-white/40 mt-0.5">{t('ui_scan_card_hint', 'Utilisez la caméra pour scanner une adresse')}</p>
                      )}
                    </div>
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-xcannes-green" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M8 18L14 12L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M13.5 18L19.5 12L13.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </button>

                  {/* 3. Entrer une adresse manuellement */}
                  <div className="xcannes-fade-border-y rounded-[20px]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickscanSavedPicker(false);
                        setSimpleSendSelfError(false);
                        setManualEntryOpen((prev) => !prev);
                      }}
                      className="w-full grid grid-cols-[56px_1fr_24px] items-center gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 hover:bg-white/[0.02] transition-colors duration-150 text-left"
                    >
                      <div className="w-14 flex items-center justify-center flex-shrink-0">
                        <div className="xcannes-fade-ring-y w-14 h-14 rounded-full bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
                          <svg className="w-[26px] h-[26px] text-xcannes-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-white/85">
                          {t('ui_manual_entry_title', 'Entrer une adresse manuellement')}
                        </p>
                        <p className="text-[13px] text-white/40 mt-0.5">
                          {t('ui_manual_entry_hint', 'Coller ou saisir une adresse de wallet')}
                        </p>
                      </div>
                      <svg className={`w-5 h-5 text-xcannes-green flex-shrink-0 transition-transform duration-200 ${manualEntryOpen ? 'rotate-90' : 'rotate-0'}`} viewBox="0 0 24 24" fill="none">
                        <path d="M8 18L14 12L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M13.5 18L19.5 12L13.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {manualEntryOpen ? (
                      <div className="pl-2 pr-3 md:px-6 pb-4 -mt-2">
                        <div className="relative">
                          <input
                            ref={manualEntryInputRef}
                            id="quickscan-paste-input"
                            type="text"
                            value={quickscanPasteValue}
                            onChange={(e) => {
                              setQuickscanPasteValue(e.target.value);
                              setSimpleSendSelfError(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleQuickscanPasteSubmit();
                            }}
                            onPaste={(e) => {
                              const text = (e.clipboardData?.getData('text') || '').trim();
                              if (!text) return;
                              e.preventDefault();
                              setQuickscanPasteValue(text);
                              if (normalizedCurrentWallet && text === normalizedCurrentWallet) {
                                setSimpleSendSelfError(true);
                                return;
                              }
                              setSimpleSendSelfError(false);
                              setPendingDestination({ address: text, label: '' });
                            }}
                            placeholder={t('ui_paste_address_placeholder', 'Entrez manuellement une adresse')}
                            className="w-full bg-black ring-1 ring-white/10 ring-inset rounded-xl pl-3 pr-10 py-2 text-[13px] text-white placeholder:text-white/55 outline-none focus:ring-white/25 transition-all duration-200"
                          />
                          {quickscanPasteValue.trim() ? (
                            <button
                              type="button"
                              onClick={handleQuickscanPasteSubmit}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/30 hover:text-white/60 transition-colors"
                              title={t('ui_go_label', 'Valider')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>
                            </button>
                          ) : null}
                        </div>
                        {simpleSendSelfError ? (
                          <div className="rounded-lg ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-3 py-2.5 text-xs text-orange-200/90 mt-2">
                            <div className="font-semibold">{t('ui_invalid_recipient_title', 'Destinataire invalide')}</div>
                            <div className="mt-0.5 text-orange-200/70">{t('ui_cannot_send_to_self', 'Vous ne pouvez pas envoyer à votre propre compte.')}</div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {/* 4. Importer un QR code */}
                  <button
                    type="button"
                    onClick={() => handleFileUpload(quickscanFileInputId, false)}
                    className="xcannes-fade-border-y w-full grid grid-cols-[56px_1fr_24px] items-center gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 hover:bg-white/[0.02] transition-colors duration-150 text-left rounded-[20px]"
                  >
                    <div className="w-14 flex items-center justify-center flex-shrink-0">
                      <div className="xcannes-fade-ring-y w-14 h-14 rounded-full bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
                        <svg className="w-[26px] h-[26px] text-xcannes-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" /></svg>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white/85">{t('ui_import_card_title', 'Importer un QR code')}</p>
                      {importedDisplay ? (
                        <div className="flex items-center mt-1.5 bg-black/80 ring-1 ring-white/10 ring-inset rounded-xl pl-3 pr-3 py-2">
                          <span className="text-[13px] truncate text-white/85">{importedDisplay}</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/40 mt-0.5">{t('ui_import_card_hint', 'Depuis une image ou un fichier')}</p>
                      )}
                    </div>
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-xcannes-green" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M8 18L14 12L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M13.5 18L19.5 12L13.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </button>

                  </div>
                </div>

                <div className="pt-6 md:pt-12">
                  <button
                    type="button"
                    disabled={!pendingDestination.address}
                    onClick={() => { if (pendingDestination.address) { setSendDestination?.(pendingDestination.address); setSendDestinationLabel?.(pendingDestination.label); onChooseSimpleSend?.(); } }}
                    className={`w-full py-3.5 rounded-[14px] text-[16px] font-semibold transition-all duration-200 ${
                      pendingDestination.address
                        ? 'text-white hover:scale-[1.01] active:scale-[0.98]'
                        : 'bg-xcannes-green/[0.07] text-xcannes-green/60 cursor-not-allowed ring-[0.5px] ring-xcannes-green/40 ring-inset'
                    }`}
                    style={pendingDestination.address
                      ? { background: 'linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
                      : undefined}
                  >
                    {pendingDestination.address
                      ? t('ui_validate_recipient_address', "Valider l'adresse du destinataire")
                      : <span className="inline-flex items-center gap-1.5 text-white/20">
                          <span className="text-xs">{t('ui_fill_recipient_address', "Renseigner l'adresse du destinataire")}</span>
                          <span className="inline-flex items-end gap-[3px] mb-[-1px]">
                            <span className="send-dot" style={{ animationDelay: '0s' }}>·</span>
                            <span className="send-dot" style={{ animationDelay: '0.6s' }}>·</span>
                            <span className="send-dot" style={{ animationDelay: '1.2s' }}>·</span>
                          </span>
                        </span>
                    }
                  </button>
                  <style>{`
                    @keyframes sendDotBlink {
                      0%, 70%, 100% { opacity: 0.1; }
                      35% { opacity: 0.9; }
                    }
                    .send-dot {
                      font-size: 20px;
                      line-height: 1;
                      animation: sendDotBlink 2.4s ease-in-out infinite;
                      color: inherit;
                    }
                  `}</style>
                </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Sub-modal: Payer une demande ═══ */}
      {subModal === 'payreq' ? (
        <div className={inline ? 'absolute inset-0 z-50 flex' : 'fixed inset-0 z-[10100] flex items-end md:items-center justify-center md:px-4 pointer-events-none'}>
          {!inline ? <div className="fixed inset-0 bg-black/70 md:backdrop-blur-sm pointer-events-auto wallet-modal-backdrop-in" onClick={() => setSubModal(null)} style={overlayTranslateY > 0 ? { opacity: Math.max(0, 1 - overlayTranslateY / 420) } : undefined} /> : null}
          <div className={inline ? 'w-full h-full' : 'relative z-10 pointer-events-auto w-full md:max-w-lg wallet-modal-lift-in'} style={!inline ? { boxShadow: '8px 16px 48px rgba(255,255,255,0.07), 0 0 0 1px rgba(255,255,255,0.06)' } : undefined}>
            <div
              className={inline ? 'relative w-full h-full overflow-hidden flex flex-col bg-elevated rounded-xl' : 'relative w-full wallet-modal-panel wallet-cash-modal border-white/10 md:border overflow-hidden flex flex-col bg-elevated h-screen md:h-auto md:max-h-[80vh] rounded-none md:rounded-2xl pb-[env(safe-area-inset-bottom)]'}
              style={!inline && overlayTranslateY ? { transform: `translateY(${Math.max(0, overlayTranslateY)}px)`, transition: overlayDragging ? 'none' : 'transform 220ms cubic-bezier(0.2,0,0,1)', opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) } : undefined}
              onPointerDown={handleSubModalPillDown}
            >
              {/* Glow */}
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                <div className="absolute inset-0 md:hidden bg-[radial-gradient(700px_circle_at_100%_50%,rgba(245,166,35,0.12),transparent_60%)]" />
                <div className="absolute inset-0 hidden md:block bg-[radial-gradient(1000px_circle_at_100%_50%,rgba(245,166,35,0.12),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(400px_circle_at_0%_100%,rgba(255,255,255,0.03),transparent_55%)]" />
              </div>
              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                {/* Swipe bar – mobile only */}
                {!inline ? (
                  <div className="md:hidden flex justify-center pt-3 pb-0" aria-hidden>
                    <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                  </div>
                ) : null}
                <div className="px-5 pt-[70px] md:pt-[90px] pb-5 flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
                {/* Title + subtitle (centered) */}
                <div className="flex flex-col items-center text-center mb-[40px]">
                  <h3 className="mt-1 text-[30px] md:text-[34px] font-bold text-white/95 tracking-tight">
	                    {t('ui_send_pay_request_title', 'Renseigner une demande ')}
                  </h3>
                  <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-[34ch] leading-relaxed">
                    {t('ui_send_pay_request_hint', 'Scannez, importez un QR code ou saisissez une demande de paiement.')}
                  </p>
                  {/* Wallet meta pill */}
                  <div className="mt-[40px] flex justify-center px-4 w-full">
                    {renderWalletMeta?.({
                      variant: 'pill-column',
                      className: 'flex justify-center',
                      prefix: t('moonpay_from_account', 'Compte source'),
                      pillClassName: 'bg-elevated shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]',
                      dotClassName: '!bg-[#f5a623] ring-[#f5a623]/20',
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-4 md:gap-7">

                  {/* 1. Scanner un QR code */}
                  <div className="rounded-[20px] bg-elevated">
                  <button
                    type="button"
                    onClick={onChoosePayreqScan || onChooseQuickScan}
                    className="w-full flex items-center gap-4 bg-white/5 ring-1 ring-inset ring-white/10 rounded-[20px] shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] px-4 py-4 hover:bg-transparent hover:ring-white/15 transition-colors duration-150 text-left"
                  >
                    <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                      <svg className="w-[36px] h-[36px] text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-white/85">{t('ui_scan_card_title', 'Scanner un QR code')}</p>
                      {payreqScannedDisplay ? (
                        <div className="flex items-center mt-1.5 bg-black/80 ring-1 ring-white/10 ring-inset rounded-xl pl-3 pr-3 py-2">
                          <span className="text-[13px] truncate text-white/85">{payreqScannedDisplay}</span>
                        </div>
                      ) : (
                        <p className="text-[13px] text-white/40 mt-0.5">{t('ui_scan_payreq_hint', 'Utilisez la caméra pour scanner une demande de paiement')}</p>
                      )}
                    </div>
                  </button>
                  </div>

                  {/* 3. Saisir une demande */}
                  <div className="rounded-[20px]">
                  <div className="bg-transparent overflow-hidden">
                    <div className="flex items-center gap-4 px-4 py-3">
                      <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                        <svg className="w-[36px] h-[36px] text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="relative">
                          <input type="text" value={payreqPasteValue} onChange={(e) => { setPayreqPasteValue(e.target.value); setPayreqSelfSendError(false); }} onKeyDown={(e) => { if (e.key === 'Enter') handlePayreqPasteSubmit(); }} onPaste={(e) => { const text = (e.clipboardData?.getData('text') || '').trim(); if (text) { e.preventDefault(); setPayreqPasteValue(text); if (isPayreqSelfSend(text)) { setPayreqSelfSendError(true); return; } setPayreqSelfSendError(false); setPendingPayreq(text); } }} placeholder={t('ui_paste_payreq_placeholder', 'Saisir une demande de paiement')} className="w-full bg-black/80 ring-1 ring-white/10 ring-inset rounded-xl shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)] pl-3 pr-10 py-2 text-[13px] text-white placeholder:text-white/55 outline-none focus:ring-white/25 focus:shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.10),0_0_24px_rgba(255,255,255,0.06)] transition-all duration-200" />
                          {payreqPasteValue.trim() ? (<button type="button" onClick={handlePayreqPasteSubmit} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/30 hover:text-white/60 transition-colors" title={t('ui_go_label', 'Valider')}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg></button>) : null}
                        </div>
                        {payreqSelfSendError && (
                          <div className="rounded-lg ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-3 py-2.5 text-xs text-orange-200/90 mt-2">
                            <div className="font-semibold">{t('ui_invalid_recipient_title', 'Destinataire invalide')}</div>
                            <div className="mt-0.5 text-orange-200/70">{t('ui_cannot_send_to_self', 'Vous ne pouvez pas envoyer à votre propre compte.')}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* 4. Importer un QR code */}
                  <div className="rounded-[20px] bg-elevated">
                  <button
                    type="button"
                    onClick={() => handleFileUpload(payreqFileInputId, true)}
                    className="w-full flex items-center gap-4 bg-white/5 ring-1 ring-inset ring-white/10 rounded-[20px] shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] px-4 py-4 hover:bg-transparent hover:ring-white/15 transition-colors duration-150 text-left"
                  >
                    <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                      <svg className="w-[36px] h-[36px] text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white/85">{t('ui_import_card_title', 'Importer un QR code')}</p>
                      {payreqImportedDisplay ? (
                        <div className="flex items-center mt-1.5 bg-black/80 ring-1 ring-white/10 ring-inset rounded-xl pl-3 pr-3 py-2">
                          <span className="text-[11px] truncate text-white/85">{payreqImportedDisplay}</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/40 mt-0.5">{t('ui_import_payreq_hint', 'Importez une image ou un fichier contenant un QR code')}</p>
                      )}
                    </div>
                  </button>
                  </div>

                </div>

                {/* CTA — Valider la demande de paiement */}
                <div className="pt-[34px] md:pt-12">
                  <button
                    type="button"
                    disabled={!pendingPayreq}
                    onClick={() => {
                      if (pendingPayreq) {
                        setPayreqSelfSendError(false);
                        handlePaymentRequestScan?.(pendingPayreq);
                        onChoosePayRequest?.();
                      }
                    }}
                    className={`w-full py-3.5 rounded-[14px] text-[16px] font-semibold transition-all duration-200 ${
                      pendingPayreq
                        ? 'text-white hover:scale-[1.01] active:scale-[0.98]'
                        : 'cursor-not-allowed ring-[0.5px] ring-[#f5a623]/40 ring-inset'
                    }`}
                    style={pendingPayreq
                      ? { background: 'linear-gradient(180deg, #f5a623 0%, #d98c0f 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
                      : { background: 'rgba(245,166,35,0.07)', color: 'rgba(255,255,255,0.2)' }}
                  >
                    {pendingPayreq
                      ? t('ui_validate_payreq', 'Vérifier la demande de paiement')
                      : <span className="inline-flex items-center gap-1.5">
                          <span className="text-xs">{t('ui_fill_payreq', 'Renseignez la demande de paiement')}</span>
                          <span className="inline-flex items-end gap-[3px] mb-[-1px]">
                            <span className="payreq-cta-dot" style={{ animationDelay: '0s' }}>·</span>
                            <span className="payreq-cta-dot" style={{ animationDelay: '0.6s' }}>·</span>
                            <span className="payreq-cta-dot" style={{ animationDelay: '1.2s' }}>·</span>
                          </span>
                        </span>
                    }
                  </button>
                  <style>{`
                    @keyframes payreqCtaDotBlink { 0%, 70%, 100% { opacity: 0.1; } 35% { opacity: 0.9; } }
                    .payreq-cta-dot { font-size: 20px; line-height: 1; animation: payreqCtaDotBlink 2.4s ease-in-out infinite; color: inherit; }
                  `}</style>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (inline) return content;
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
