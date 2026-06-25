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
  onQrScanResult,
  onQrPayreqScanResult,
  onChoosePayreqScan,
  wallet,
}) {
  const { t } = useTranslation('common');
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  // ── Sub-modal state ──────────────────────────────────────────
  const [subModal, setSubModal] = useState(null); // 'quickscan' | 'payreq' | null
  // Staggered entrance animation key — bumped each time modal opens
  const [animKey, setAnimKey] = useState(0);
  const [flowSheet, setFlowSheet] = useState(null); // 'simple' | 'payreq' | null
  const flowSheetRef = useRef(null);
  const [flowSheetTranslateY, setFlowSheetTranslateY] = useState(0);
  const [flowSheetDragging, setFlowSheetDragging] = useState(false);
  const flowSheetSwipeMetaRef = useRef(null);
  // Permet d'ancrer le bottom-sheet `flowSheet` aux bornes du panneau de la
  // modale (au lieu du viewport) sur desktop, pour qu'il apparaisse collé en
  // bas de la modale comme un bottom-sheet classique. Sur mobile la modale
  // est plein écran donc on garde panelRect = null (= inset-0 viewport).
  const panelRef = useRef(null);
  const [panelRect, setPanelRect] = useState(null);
  // Reset la translation du parent quand on ouvre un sous-modal
  const openSubModal = useCallback((name) => {
    setOverlayTranslateY(0);
    setOverlayDragging(false);
    setFlowSheet(null);
    setFlowSheetTranslateY(0);
    setFlowSheetDragging(false);
    flowSheetSwipeMetaRef.current = null;
    setSubModal(name);
  }, []);
  const [payreqPasteValue, setPayreqPasteValue] = useState('');
  const [payreqSelfSendError, setPayreqSelfSendError] = useState(false);
  const [payreqDecodeError, setPayreqDecodeError] = useState(false);
  const [simpleSendSelfError, setSimpleSendSelfError] = useState(false);
  const [quickscanPasteValue, setQuickscanPasteValue] = useState('');
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [payreqManualEntryOpen, setPayreqManualEntryOpen] = useState(false);
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
    if (open) {
      setAnimKey((k) => k + 1);
    }
    if (!open) {
      setSubModal(null);
      setFlowSheet(null);
      setFlowSheetTranslateY(0);
      setFlowSheetDragging(false);
      flowSheetSwipeMetaRef.current = null;
      setPayreqPasteValue('');
      setPayreqSelfSendError(false);
      setPayreqDecodeError(false);
      setSimpleSendSelfError(false);
      setPendingPayreq('');
      setPayreqScannedDisplay('');
      setPayreqImportedDisplay('');
      setQuickscanPasteValue('');
      setManualEntryOpen(false);
      setPayreqManualEntryOpen(false);
      setShowQuickscanSavedPicker(false);
      setSavedAddressesVisible(false);
      setSavedAddressModes({});
    }
  }, [open]);

  // ── Replay animation when wallet changes (inline/desktop only) ──
  const prevWalletRef = useRef(wallet);
  useEffect(() => {
    if (!inline) return;
    if (wallet === prevWalletRef.current) return;
    prevWalletRef.current = wallet;
    if (open) setAnimKey((k) => k + 1);
  }, [wallet, inline, open]);

  const closeFlowSheet = useCallback(() => {
    setFlowSheet(null);
    setFlowSheetTranslateY(0);
    setFlowSheetDragging(false);
    flowSheetSwipeMetaRef.current = null;
  }, []);

  // Mesure les bornes du panneau de la modale pendant que le flowSheet est ouvert
  // (desktop uniquement) afin d'y ancrer la bottom-sheet. Sur mobile / petits
  // écrans, on retombe sur `null` => positionnement plein viewport classique.
  useEffect(() => {
    if (!flowSheet || typeof window === 'undefined') {
      setPanelRect(null);
      return undefined;
    }
    const measure = () => {
      const el = panelRef.current;
      if (!el) {
        setPanelRect(null);
        return;
      }
      const isDesktop = window.matchMedia('(min-width: 768px)').matches;
      if (!isDesktop) {
        setPanelRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setPanelRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && panelRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(panelRef.current);
    }
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      if (ro) ro.disconnect();
    };
  }, [flowSheet]);

  const handleFlowSheetPillDown = useCallback((event) => {
    if (!flowSheet) return;
    if (!event?.isPrimary || event.pointerType === 'mouse') return;
    if (event.target?.closest?.('input,textarea,select,button,a,[role="button"]')) return;
    flowSheetSwipeMetaRef.current = {
      startY: event.clientY,
      startAt: Date.now(),
      pointerId: event.pointerId,
      lastDeltaY: 0,
    };

    const onMove = (e) => {
      const meta = flowSheetSwipeMetaRef.current;
      if (!meta || e.pointerId !== meta.pointerId) return;
      const delta = e.clientY - meta.startY;
      if (delta <= 0) return;
      meta.lastDeltaY = delta;
      setFlowSheetDragging(true);
      setFlowSheetTranslateY(delta);
    };

    const onEnd = (e) => {
      const meta = flowSheetSwipeMetaRef.current;
      if (!meta || e.pointerId !== meta.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);

      const delta = meta.lastDeltaY || 0;
      const duration = Math.max(1, Date.now() - (meta.startAt || 0));
      const velocity = delta / duration;
      const height = typeof window !== 'undefined' ? window.innerHeight : 800;
      const closeDistance = Math.max(140, Math.min(240, height * 0.20));
      const shouldClose = delta > closeDistance || (delta > closeDistance * 0.55 && velocity > 1.15);

      setFlowSheetDragging(false);
      flowSheetSwipeMetaRef.current = null;
      if (shouldClose) {
        setFlowSheetTranslateY(Math.max(delta, height));
        window.setTimeout(() => closeFlowSheet(), 160);
        return;
      }
      setFlowSheetTranslateY(0);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }, [flowSheet, closeFlowSheet]);

  useEffect(() => {
    if (!flowSheet) return;
    const onPointerDown = (event) => {
      const target = event?.target;
      if (!target) return;
      if (flowSheetRef.current && flowSheetRef.current.contains(target)) return;
      closeFlowSheet();
    };
    const onKeyDown = (event) => {
      if (event?.key === 'Escape') closeFlowSheet();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [flowSheet, closeFlowSheet]);

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
          if (isPayreqSelfSend(decodedText)) { setPayreqSelfSendError(true); setPayreqDecodeError(false); return; }
          setPayreqDecodeError(false);
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
      if (isPayreq) setPayreqDecodeError(true);
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
    if (isPayreqSelfSend(raw)) { setPayreqSelfSendError(true); setPayreqDecodeError(false); return; }
    setPayreqSelfSendError(false);
    setPayreqDecodeError(false);
    setPendingPayreq(raw);
  }, [payreqPasteValue, isPayreqSelfSend]);

  // ── Icons ────────────────────────────────────────────────────
  // Envoi simple — two nodes connected by an arrow (direct transfer)
  const QuickScanIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 md:w-10 md:h-10" fill="none" aria-hidden>
      {/* Source node */}
      <circle cx="10" cy="24" r="4" className="stroke-xcannes-green/70" strokeWidth="1.6" fill="none" />
      <circle cx="10" cy="24" r="1.6" className="fill-xcannes-green/55" />
      {/* Arrow shaft */}
      <line x1="15" y1="24" x2="31" y2="24" className="stroke-xcannes-green/60" strokeWidth="1.6" strokeLinecap="round" />
      {/* Arrow head */}
      <path d="M27 19.5L32.5 24L27 28.5" className="stroke-xcannes-green/90" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Destination node */}
      <circle cx="38" cy="24" r="4" className="stroke-xcannes-green/45" strokeWidth="1.6" fill="none" />
      <circle cx="38" cy="24" r="1.6" className="fill-xcannes-green/30" />
      {/* Speed lines above */}
      <line x1="18" y1="18" x2="24" y2="18" className="stroke-xcannes-green/30" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="21" y1="14.5" x2="26" y2="14.5" className="stroke-xcannes-green/18" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );

  // Payer une demande — QR code frame with a scan corner indicator
  const PayRequestIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 md:w-10 md:h-10" fill="none" aria-hidden>
      {/* QR corner brackets */}
      {/* Top-left */}
      <path d="M10 18V11h7" className="stroke-[#f5a623]/80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Top-right */}
      <path d="M38 18V11h-7" className="stroke-[#f5a623]/80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Bottom-left */}
      <path d="M10 30v7h7" className="stroke-[#f5a623]/80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Bottom-right */}
      <path d="M38 30v7h-7" className="stroke-[#f5a623]/55" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Inner QR dots — minimal grid hint */}
      <rect x="17" y="17" width="4" height="4" rx="1" className="fill-[#f5a623]/50" />
      <rect x="27" y="17" width="4" height="4" rx="1" className="fill-[#f5a623]/35" />
      <rect x="17" y="27" width="4" height="4" rx="1" className="fill-[#f5a623]/35" />
      {/* Center checkmark / confirm dot */}
      <circle cx="29.5" cy="29.5" r="3.5" className="fill-[#f5a623]/15 stroke-[#f5a623]/60" strokeWidth="1.3" />
      <path d="M27.8 29.5l1.2 1.4 2.2-2.2" className="stroke-[#f5a623]/90" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const Badge = ({ children, className = '' }) => (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] md:text-[11px] leading-none',
        'bg-white/[0.03] text-white/70 ring-inset',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );

  const OpenFlowIcon = ({ className = '' }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Chemin sinueux du parcours */}
      <path
        d="M4 19c2.5 0 3-3 1.5-4.5S3 12 4 10s3.5-1 5 0 3 2.5 5 1.5 2-3 1-4.5"
        strokeDasharray="0.1 2.4"
      />
      {/* Point de départ */}
      <circle cx="4" cy="19" r="1.6" fill="currentColor" strokeWidth="0" />
      <circle cx="4" cy="19" r="0.5" fill="#0b0f10" strokeWidth="0" />
      {/* Mât du drapeau */}
      <path d="M15 4.2v9.2" strokeWidth="1.2" />
      <circle cx="15" cy="13.6" r="0.6" fill="currentColor" strokeWidth="0" />
      {/* Drapeau ondulé avec détails */}
      <path
        d="M15 4.6c1.4-0.9 2.7 0.6 4.1-0.3 0.5-0.3 0.8-0.1 0.8 0.4v4.2c0 0.4-0.3 0.6-0.7 0.4-1.4-0.8-2.8 0.6-4.2-0.2"
        fill="currentColor"
        strokeWidth="0"
      />
      {/* Plis du drapeau */}
      <path d="M17 4.6v4.4" stroke="#0b0f10" strokeWidth="0.5" opacity="0.45" />
      <path d="M18.6 4.5v4.4" stroke="#0b0f10" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );

  const cardClassName =
    'relative overflow-hidden w-full text-left rounded-[18px] px-4 py-4 md:px-6 md:py-5 bg-white/[0.02] hover:bg-white/[0.035] active:bg-white/[0.03] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px active:translate-y-0 active:scale-[0.99]';

  // Helper: className + style for staggered entrance animation
  const scStyle = (delayMs) => ({ animationDelay: `${delayMs}ms` });

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
    // Do not start a drag from interactive elements (prevents tap → accidental drag cancelling clicks).
    if (event.target?.closest?.('input,textarea,select,button,a,[role="button"]')) return false;
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
            ref={panelRef}
            className={panelClass}
            onClick={e => { if (!inline) e.stopPropagation(); }}
          >
            <div className="relative z-10 flex flex-col flex-1 min-h-0">
              {/* Drag handle (mobile) */}
              {!inline ? (
                <div
                  key={`handle-${animKey}`}
                  className="md:hidden flex justify-center pt-3 pb-0 sc-enter"
                  style={scStyle(0)}
                  aria-hidden
                  onPointerDown={event => { maybeStartOverlayDrag(event, 'fixed'); }}
                >
                  <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                </div>
              ) : null}
              {/* Bottom bar – mobile only */}
              {!inline ? (
                <div
                  className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
                  aria-hidden
                >
                  <span className="block w-36 h-1.5 rounded-full bg-white/80" />
                </div>
              ) : null}

              <div className="flex-1 min-h-0 flex flex-col">
                {/* Title + subtitle + arrow */}
                <div
                  className="pt-[40px] md:pt-[66px] pb-3 flex flex-col items-center text-center"
                  onPointerDown={event => { maybeStartOverlayDrag(event, 'fixed'); }}
                >
                  <h3
                    key={`title-${animKey}`}
                    className="mt-1 px-6 text-[30px] md:text-[34px] font-light text-white tracking-tight sc-enter"
                    style={scStyle(80)}
                  >
                    {t('ui_send_choice_subtitle', "Comment souhaitez-vous envoyer de l'argent ?")}
                  </h3>
                  {/* Wallet meta pill */}
                  <div
                    key={`pill-${animKey}`}
                    className="mt-[40px] flex justify-center px-4 w-full sc-enter"
                    style={scStyle(180)}
                  >
	                    {renderWalletMeta?.({
	                      variant: "pill-column",
	                      className: "flex justify-center",
	                      prefix: t("moonpay_from_account", "Compte source"),
	                      pillClassName:
	                        "bg-elevated-40 xcannes-fade-border-y shadow-none rounded-[20px]",
	                      labelClassName: "!text-white",
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
                  <div
                    key={`card1-${animKey}`}
                    className={`${cardClassName} xcannes-irregular-green-border xcannes-sendchoice-accent-green sc-enter`}
                    style={scStyle(280)}
                  >
                    <div className="pointer-events-none absolute inset-0" aria-hidden>
                      <div className="xcannes-sendchoice-border-fade-green z-10" />
                      {/* Ambient halo — breathing glow */}
                      <div className="sc-halo-green absolute -inset-8 rounded-full blur-[60px] bg-[radial-gradient(ellipse_at_30%_50%,rgba(0,255,150,1)_0%,transparent_65%)]" />
                      {/* Border shimmer sweep */}
                      <div className="absolute inset-0 overflow-hidden rounded-[18px] z-20">
                        <div className="sc-shimmer-green absolute top-0 left-0 w-1/3 h-full bg-[linear-gradient(105deg,transparent_0%,rgba(0,255,150,0.18)_45%,rgba(255,255,255,0.10)_50%,rgba(0,255,150,0.18)_55%,transparent_100%)]" />
                      </div>
                      <div className="absolute inset-0 bg-[radial-gradient(190px_190px_at_-8%_18%,rgba(0,255,150,0.55)_0%,rgba(0,255,150,0.22)_22%,rgba(0,255,150,0.08)_38%,transparent_62%)]" />
                      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-black/40" />
                    </div>
	                    <button
	                      type="button"
	                      onClick={() => openSubModal('quickscan')}
	                      className="relative w-full text-left"
	                    >
                      <div className="grid grid-cols-[48px_1px_1fr_28px] md:grid-cols-[56px_1px_1fr_32px] gap-3 md:gap-4 items-start">
                        <div
                          key={`icon1-${animKey}`}
                          className="relative self-center sc-enter"
                          style={scStyle(350)}
                        >
                          <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-[16px] bg-[#0b0f10] xcannes-irregular-green-border-icon flex items-center justify-center">
                            <QuickScanIcon />
                          </div>
                        </div>
                        <div className="self-stretch w-px opacity-90 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,255,150,0.22)_50%,transparent_100%)]" aria-hidden />
                        <div
                          key={`text1-${animKey}`}
                          className="min-w-0 sc-enter"
                          style={scStyle(380)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[18px] md:text-[22px] text-white font-light tracking-tight truncate md:whitespace-normal md:break-words">
                              {t('ui_send_simple_title', 'Envoi simple')}
                            </p>
                          </div>
                          <p className="mt-1 text-[14px] md:text-[17px] font-light leading-snug text-white/50">
                            {t('ui_send_simple_hint_long', 'Saisissez une adresse, choisissez la devise et indiquez le montant.')}
                          </p>
	                          <div
                              key={`badges1-${animKey}`}
                              className="mt-3 flex flex-wrap items-center gap-2 sc-enter"
                              style={scStyle(430)}
                            >
	                            <Badge className="bg-transparent ring-[0.3px] ring-xcannes-green/70 font-light">{t('ui_send_choice_simple_badge_steps', '4 étapes')}</Badge>
	                            <span className="w-1 h-1 rounded-full bg-xcannes-green/80" aria-hidden />
	                            <span className="inline-flex items-center text-[10px] md:text-[11px] text-white/65 font-light">
	                              {t('ui_send_choice_simple_badge_secure', 'Rapide & sécurisé')}
	                            </span>
	                          </div>
                        </div>
                        <div
                          key={`arrow1-${animKey}`}
                          className="self-center flex justify-end mr-2 md:mr-0 sc-enter"
                          style={scStyle(480)}
                        >
                          <svg className="w-7 h-7 md:w-8 md:h-8 text-xcannes-green/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M7 18L13 12L7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M13 18L19 12L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </button>

	                    <button
	                      type="button"
	                      onClick={() => {
	                        setFlowSheetTranslateY(0);
	                        setFlowSheetDragging(false);
	                        flowSheetSwipeMetaRef.current = null;
	                        setFlowSheet((v) => (v === 'simple' ? null : 'simple'));
	                      }}
	                      className="relative mt-4 pt-3 flex items-center justify-between text-[13px] text-white/75 hover:text-white transition-colors duration-150 w-full"
	                    >
                      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-xcannes-green/45 to-transparent" aria-hidden />
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xcannes-green/85 text-[22px] font-light leading-none">+</span>
                        <span className="text-[14px] font-light text-white">{t('ui_open_flow', 'Voir les étapes')}</span>
                      </span>
	                    </button>
	                  </div>

                  {/* ── 2. Payer une demande ── */}
                  <div
                    key={`card2-${animKey}`}
                    className={`${cardClassName} xcannes-irregular-amber-border xcannes-sendchoice-accent-amber sc-enter`}
                    style={scStyle(440)}
                  >
                    <div className="pointer-events-none absolute inset-0" aria-hidden>
                      <div className="xcannes-sendchoice-border-fade-amber z-10" />
                      {/* Ambient halo — breathing glow */}
                      <div className="sc-halo-amber absolute -inset-8 rounded-full blur-[60px] bg-[radial-gradient(ellipse_at_30%_50%,rgba(245,166,35,1)_0%,transparent_65%)]" />
                      {/* Border shimmer sweep */}
                      <div className="absolute inset-0 overflow-hidden rounded-[18px] z-20">
                        <div className="sc-shimmer-amber absolute top-0 left-0 w-1/3 h-full bg-[linear-gradient(105deg,transparent_0%,rgba(245,166,35,0.16)_45%,rgba(255,255,255,0.09)_50%,rgba(245,166,35,0.16)_55%,transparent_100%)]" />
                      </div>
                      <div className="absolute inset-0 bg-[radial-gradient(190px_190px_at_-8%_18%,rgba(245,166,35,0.46)_0%,rgba(245,166,35,0.20)_22%,rgba(245,166,35,0.08)_38%,transparent_62%)]" />
                      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-black/40" />
                    </div>
	                    <button
	                      type="button"
	                      onClick={() => openSubModal('payreq')}
	                      className="relative w-full text-left"
	                    >
                      <div className="grid grid-cols-[48px_1px_1fr_28px] md:grid-cols-[56px_1px_1fr_32px] gap-3 md:gap-4 items-start">
                        <div
                          key={`icon2-${animKey}`}
                          className="relative self-center sc-enter"
                          style={scStyle(510)}
                        >
                          <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-[16px] bg-[#0b0f10] xcannes-irregular-amber-border-icon flex items-center justify-center">
                            <PayRequestIcon />
                          </div>
                        </div>
                        <div className="self-stretch w-px opacity-90 bg-[linear-gradient(to_bottom,transparent_0%,rgba(245,166,35,0.22)_50%,transparent_100%)]" aria-hidden />
                        <div
                          key={`text2-${animKey}`}
                          className="min-w-0 sc-enter"
                          style={scStyle(540)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[18px] md:text-[22px] text-white font-light tracking-tight truncate md:whitespace-normal md:break-words">
                              {t('ui_send_choice_pay_request_title', 'Payer une demande')}
                            </p>
                          </div>
                          <p className="mt-1 text-[14px] md:text-[17px] font-light leading-snug text-white/50">
                            {t('ui_send_pay_request_hint', 'Scannez, importez un QR code ou saisissez une demande de paiement.')}
                          </p>
	                          <div
                              key={`badges2-${animKey}`}
                              className="mt-3 flex flex-wrap items-center gap-2 sc-enter"
                              style={scStyle(590)}
                            >
	                            <Badge className="bg-transparent ring-[0.3px] ring-[#f5a623]/60 font-light">{t('ui_send_choice_payreq_badge_modes', 'QR, import, saisie')}</Badge>
	                            <span className="w-1 h-1 rounded-full bg-[#f5a623]/80" aria-hidden />
	                            <span className="inline-flex items-center text-[10px] md:text-[11px] text-white/65 font-light">
	                              {t('ui_send_choice_payreq_badge_flexible', 'Flexible & pratique')}
	                            </span>
	                          </div>
                        </div>
                        <div
                          key={`arrow2-${animKey}`}
                          className="self-center flex justify-end mr-2 md:mr-0 sc-enter"
                          style={scStyle(640)}
                        >
                          <svg className="w-7 h-7 md:w-8 md:h-8 text-[#f5a623]/90 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M7 18L13 12L7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M13 18L19 12L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </button>

	                    <button
	                      type="button"
	                      onClick={() => {
	                        setFlowSheetTranslateY(0);
	                        setFlowSheetDragging(false);
	                        flowSheetSwipeMetaRef.current = null;
	                        setFlowSheet((v) => (v === 'payreq' ? null : 'payreq'));
	                      }}
	                      className="relative mt-4 pt-3 flex items-center justify-between text-[13px] text-white/75 hover:text-white transition-colors duration-150 w-full"
	                    >
                      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-[#f5a623]/40 to-transparent" aria-hidden />
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[#f5a623]/85 text-[22px] font-light leading-none">+</span>
                        <span className="text-[14px] font-light text-white">{t('ui_open_flow', 'Voir les étapes')}</span>
                      </span>
	                    </button>
	                  </div>

                  {/* Hidden div for html5-qrcode reader */}
                  <div id={manualQrReaderIdRef.current} className="hidden" />
                </div>
              </div>
              {/* Bottom bar – desktop only (visual balance) */}
              <div className="hidden md:flex pointer-events-none justify-center pt-6 pb-4" aria-hidden>
                <span className="block w-[120px] h-[4px] rounded-full bg-white/10" />
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
                <div className="absolute inset-0 md:hidden bg-[radial-gradient(260px_circle_at_70%_25%,rgba(0,255,150,0.16),transparent_70%)]" />
                <div className="absolute inset-0 hidden md:block bg-[radial-gradient(320px_circle_at_70%_25%,rgba(0,255,150,0.14),transparent_72%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(400px_circle_at_0%_100%,rgba(255,255,255,0.03),transparent_55%)]" />
              </div>
              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                {/* Swipe bar – mobile only */}
                {!inline ? (
                  <div className="md:hidden flex justify-center pt-3 pb-0" aria-hidden>
                    <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                  </div>
                ) : null}
                {/* Bottom bar – mobile only */}
                {!inline ? (
                  <div
                    className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
                    aria-hidden
                  >
                    <span className="block w-36 h-1.5 rounded-full bg-white/80" />
                  </div>
                ) : null}
                <div className={`px-5 ${pendingDestination.address ? 'pt-[3px] md:pt-[34px]' : 'pt-[10px] md:pt-[60px]'} pb-5 flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain`}>
                {/* Title + subtitle */}
                <div className="flex flex-col items-center text-center md:items-start md:text-left mb-[40px]">
                  <h3 className="mt-1 text-[30px] md:text-[34px] font-light text-white tracking-tight">
                    {t('ui_send_choose_recipient_title', 'Envoyer à un destinataire')}
                  </h3>
                  <p className="mt-px md:mt-0 text-[19px] md:text-[20px] font-light text-white/50 max-w-[34ch] md:max-w-[68ch] leading-[22.5px] md:leading-[24px]">
                    <span className="md:hidden">{t("ui_send_choose_recipient_hint_mobile", "Choisissez une adresse enregistrée ou scannez un QR code.")}</span>
                    <span className="hidden md:inline">{t("ui_send_choose_recipient_hint_line_1", "Choisissez une adresse enregistrée,")}{" "}{t("ui_send_choose_recipient_hint_line_2", "scannez un QR code ou saisissez-la manuellement.")}</span>
                  </p>
                  {/* Wallet meta pill */}
                  <div className="mt-6 flex justify-center px-4 w-full">
	                    {renderWalletMeta?.({
	                      variant: 'pill-column',
	                      className: 'flex justify-center',
	                      prefix: t('moonpay_from_account', 'Compte source'),
	                      pillClassName: 'bg-elevated-40 xcannes-fade-border-y shadow-none rounded-[20px]',
	                      labelClassName: '!text-white',
	                    })}
	                  </div>
                </div>

                <div className="rounded-[26px] bg-[#0b0f10]/40 ring-1 ring-white/10 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-26px_46px_rgba(0,0,0,0.55)] p-3 md:p-4">
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
                      className="w-full grid grid-cols-[56px_1fr] gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 text-left"
                    >
                      <div className="w-14 flex items-center justify-center flex-shrink-0">
                        <div className="xcannes-fade-ring-y w-[52px] h-[52px] rounded-full bg-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
                          <svg className="w-[26px] h-[26px] text-xcannes-green" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-light text-white whitespace-nowrap overflow-hidden text-ellipsis">
                          {t('ui_saved_recipient_title', 'Destinataire enregistré')}
                        </p>
                        <div className="relative xcannes-irregular-green-border mt-2 flex items-center justify-between rounded-xl pl-3 pr-2.5 py-2 bg-black/60 shadow-[inset_0_-30px_30px_-20px_rgba(0,0,0,0.92)]">
                          <span className={`text-[11px] md:text-[13px] truncate ${selectedContactDisplay ? 'text-white/85' : 'text-white/55'}`}>
                            {selectedContactDisplay || t('ui_saved_recipient_hint', 'Sélectionnez un destinataire')}
                          </span>
                          <svg className={`w-4 h-4 text-xcannes-green flex-shrink-0 ml-2 transition-transform duration-200 ${showQuickscanSavedPicker ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>
                    </button>
                    <div
                      className={`absolute left-0 right-0 top-full mt-1.5 z-[100] xcannes-irregular-green-border rounded-xl bg-black shadow-[inset_0_-30px_30px_-20px_rgba(0,0,0,0.92)] transition-all duration-200 origin-top ${showQuickscanSavedPicker ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-95 pointer-events-none'}`}
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
                    className="xcannes-fade-border-y w-full grid grid-cols-[56px_1fr_24px] items-center gap-2 md:gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 hover:bg-white/[0.02] transition-colors duration-150 text-left rounded-[20px] shadow-[inset_0_-14px_18px_rgba(0,0,0,0.55)]"
                  >
                    <div className="w-14 flex items-center justify-center flex-shrink-0">
                      <div className="xcannes-fade-ring-y w-[52px] h-[52px] rounded-full bg-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
	                        <svg className="w-[26px] h-[26px] text-xcannes-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-light text-white whitespace-nowrap overflow-hidden text-ellipsis">{t('ui_scan_card_title', 'Scanner un QR code')}</p>
                      {scannedDisplay ? (
                        <div className="flex items-center mt-1.5 bg-black/80 ring-1 ring-white/10 ring-inset rounded-xl pl-3 pr-3 py-2">
                          <span className="text-[13px] truncate text-white/85">{scannedDisplay}</span>
                        </div>
                      ) : (
                        <p className="text-[12px] md:text-[14px] font-light text-white/50 mt-0.5">{t('ui_scan_card_hint', 'Utilisez la caméra pour scanner une adresse')}</p>
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
                  <div className="xcannes-fade-border-y rounded-[20px] shadow-[inset_0_-14px_18px_rgba(0,0,0,0.55)]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickscanSavedPicker(false);
                        setSimpleSendSelfError(false);
                        setManualEntryOpen((prev) => !prev);
                      }}
                      className="w-full grid grid-cols-[56px_1fr_24px] items-center gap-2 md:gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 hover:bg-white/[0.02] transition-colors duration-150 text-left"
                    >
                      <div className="w-14 flex items-center justify-center flex-shrink-0">
                        <div className="xcannes-fade-ring-y w-[52px] h-[52px] rounded-full bg-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
	                          <svg className="w-[26px] h-[26px] text-xcannes-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-light text-white whitespace-nowrap overflow-hidden text-ellipsis">
                          {t('ui_manual_entry_title', 'Entrer une adresse manuellement')}
                        </p>
                        <p className="text-[12px] md:text-[14px] font-light text-white/50 mt-0.5">
                          {t('ui_manual_entry_hint', 'Coller ou saisir une adresse de compte')}
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
                    className="xcannes-fade-border-y w-full grid grid-cols-[56px_1fr_24px] items-center gap-2 md:gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 hover:bg-white/[0.02] transition-colors duration-150 text-left rounded-[20px] shadow-[inset_0_-14px_18px_rgba(0,0,0,0.55)]"
                  >
                    <div className="w-14 flex items-center justify-center flex-shrink-0">
                      <div className="xcannes-fade-ring-y w-[52px] h-[52px] rounded-full bg-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
                        <svg className="w-[26px] h-[26px] text-xcannes-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" /></svg>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-light text-white whitespace-nowrap overflow-hidden text-ellipsis">{t('ui_import_card_title', 'Importer un QR code')}</p>
                      {importedDisplay ? (
                        <div className="flex items-center mt-1.5 bg-black/80 ring-1 ring-white/10 ring-inset rounded-xl pl-3 pr-3 py-2">
                          <span className="text-[13px] truncate text-white/85">{importedDisplay}</span>
                        </div>
                      ) : (
                        <p className="text-[12px] md:text-[14px] font-light text-white/50 mt-0.5">{t('ui_import_card_hint', 'Depuis une image ou un fichier')}</p>
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

                <div className={pendingDestination.address ? 'pt-2 md:pt-6' : 'pt-6 md:pt-12'}>
                  {pendingDestination.address ? (() => {
                    const addr = String(pendingDestination.address || '').trim();
                    const label = String(pendingDestination.label || '').trim();
                    const showLabel = label && label !== addr && label !== t('ui_wallet_unknown', 'Unknown wallet');
                    const addrShort = addr.length > 24 ? `${addr.slice(0, 12)}…${addr.slice(-8)}` : addr;
                    return (
                      <div className="mb-2 px-0 py-0 bg-transparent border-0 ring-0 flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 text-[11px] tracking-wide text-white/45 font-light">
                          {t('ui_recipient_label', 'Destinataire')}
                        </span>
                        <span className="text-white/20">·</span>
                        <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
                          {showLabel ? (
                            <>
                              <span className="min-w-0 truncate text-[13px] text-white/90 font-light">{label}</span>
                              <span className="flex-shrink-0 text-white/30">·</span>
                              <span className="flex-shrink-0 font-mono text-[12px] text-white/70 font-light">{addrShort}</span>
                            </>
                          ) : (
                            <span className="min-w-0 truncate font-mono text-[12px] text-white/80 font-light">{addrShort}</span>
                          )}
                        </div>
                      </div>
                    );
                  })() : null}
                  <button
                    type="button"
                    disabled={!pendingDestination.address}
                    onClick={() => { if (pendingDestination.address) { setSendDestination?.(pendingDestination.address); setSendDestinationLabel?.(pendingDestination.label); onChooseSimpleSend?.(); } }}
                    className={`w-full h-[52px] md:h-[56px] flex items-center justify-center rounded-[14px] text-[22px] md:text-[24px] font-light transition-all duration-200 ${
                      pendingDestination.address
                        ? 'text-white hover:scale-[1.01] active:scale-[0.98]'
                        : 'text-white/90 cursor-not-allowed ring-[0.5px] ring-xcannes-green/30 ring-inset'
                    }`}
                    style={{
                      background: pendingDestination.address
                        ? 'linear-gradient(180deg, rgba(44, 185, 103, 1) 0%, rgba(14, 103, 58, 1) 100%)'
                        : 'linear-gradient(180deg, rgba(44, 185, 103, 0.34) 0%, rgba(14, 103, 58, 0.34) 100%)',
                      boxShadow: pendingDestination.address
                        ? '0 22px 42px rgba(0,0,0,0.78), 0 10px 22px rgba(0,0,0,0.55), 0 4px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -16px 26px rgba(0,0,0,0.55), inset 0 12px 22px rgba(0,0,0,0.18)'
                        : '0 12px 24px rgba(0,0,0,0.44), 0 5px 12px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -10px 16px rgba(0,0,0,0.24)',
                    }}
                  >
                    {pendingDestination.address
                      ? <span>{t('ui_continue', 'Continuer')}</span>
                      : <span className="inline-flex items-center gap-1.5 text-white/85 font-light">
                          <span className="text-[14px] md:text-[16px]">{t('ui_fill_recipient_address', "Renseigner l'adresse du destinataire")}</span>
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
                {/* Bottom bar – desktop only (visual balance) */}
                <div className="hidden md:flex pointer-events-none justify-center pt-6 pb-4" aria-hidden>
                  <span className="block w-[120px] h-[4px] rounded-full bg-white/10" />
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
	                <div className="absolute inset-0 md:hidden bg-[radial-gradient(260px_circle_at_30%_25%,rgba(245,166,35,0.16),transparent_70%)]" />
	                <div className="absolute inset-0 hidden md:block bg-[radial-gradient(320px_circle_at_30%_25%,rgba(245,166,35,0.14),transparent_72%)]" />
	                <div className="absolute inset-0 bg-[radial-gradient(400px_circle_at_0%_100%,rgba(255,255,255,0.03),transparent_55%)]" />
	              </div>
              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                {/* Swipe bar – mobile only */}
	                {!inline ? (
	                  <div className="md:hidden flex justify-center pt-3 pb-0" aria-hidden>
	                    <span className="block w-12 h-1.5 rounded-full bg-white/20" />
	                  </div>
	                ) : null}
	                {/* Bottom bar – mobile only */}
		                {!inline ? (
		                  <div
		                    className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
		                    aria-hidden
		                  >
		                    <span className="block w-36 h-1.5 rounded-full bg-white/80" />
		                  </div>
		                ) : null}
		                <div className="px-5 pt-[70px] md:pt-[90px] pb-5 flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
		                {/* Title + subtitle */}
		                <div className="flex flex-col items-center text-center md:items-start md:text-left mb-[40px]">
                  <h3 className="mt-1 text-[30px] md:text-[34px] font-light text-white tracking-tight">
		                    {t('ui_send_pay_request_title', 'Renseigner une demande ')}
                  </h3>
                  <p className="mt-px md:mt-0 text-[19px] md:text-[20px] font-light text-white/50 max-w-[34ch] md:max-w-[68ch] leading-[22.5px] md:leading-[24px]">
                    {t('ui_send_pay_request_hint', 'Scannez, importez un QR code ou saisissez une demande de paiement.')}
                  </p>
                  {/* Wallet meta pill */}
                  <div className="mt-[40px] flex justify-center px-4 w-full">
		                    {renderWalletMeta?.({
		                      variant: 'pill-column',
		                      className: 'flex justify-center',
		                      prefix: t('moonpay_from_account', 'Compte source'),
		                      pillClassName: 'bg-elevated-40 xcannes-fade-border-y shadow-none rounded-[20px]',
		                      dotClassName: '!bg-[#f5a623] ring-[#f5a623]/20',
		                      labelClassName: '!text-white',
		                    })}
		                  </div>
                </div>

	                <div className="rounded-[26px] bg-[#0b0f10]/40 ring-1 ring-white/10 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-26px_46px_rgba(0,0,0,0.55)] p-3 md:p-4">
	                  <div className="flex flex-col gap-3">

                  {/* 1. Scanner un QR code */}
                  <button
                    type="button"
                    onClick={onChoosePayreqScan || onChooseQuickScan}
                    className="xcannes-fade-border-y w-full grid grid-cols-[56px_1fr_24px] items-center gap-2 md:gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 hover:bg-white/[0.02] transition-colors duration-150 text-left rounded-[20px] shadow-[inset_0_-14px_18px_rgba(0,0,0,0.55)]"
                  >
                    <div className="w-14 flex items-center justify-center flex-shrink-0">
                      <div className="xcannes-fade-ring-y w-[52px] h-[52px] rounded-full bg-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
	                        <svg className="w-[26px] h-[26px] text-[#f5a623]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-light text-white whitespace-nowrap overflow-hidden text-ellipsis">{t('ui_scan_card_title', 'Scanner un QR code')}</p>
                      {payreqScannedDisplay ? (
                        <div className="flex items-center mt-1.5 bg-black/80 ring-1 ring-white/10 ring-inset rounded-xl pl-3 pr-3 py-2">
                          <span className="text-[13px] truncate text-white/85">{payreqScannedDisplay}</span>
                        </div>
                      ) : (
                        <p className="text-[12px] md:text-[14px] font-light text-white/50 mt-0.5">{t('ui_scan_payreq_hint', 'Utilisez la caméra pour scanner une demande de paiement')}</p>
                      )}
                    </div>
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
	                      <svg className="w-5 h-5 text-[#f5a623]" viewBox="0 0 24 24" fill="none" aria-hidden>
	                        <path d="M8 18L14 12L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	                        <path d="M13.5 18L19.5 12L13.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	                      </svg>
                    </div>
                  </button>

                  {/* 3. Saisir une demande */}
                  <div className="xcannes-fade-border-y rounded-[20px] shadow-[inset_0_-14px_18px_rgba(0,0,0,0.55)]">
                    <button
                      type="button"
                      onClick={() => {
                        setPayreqSelfSendError(false);
                        setPayreqDecodeError(false);
                        setPayreqManualEntryOpen((prev) => !prev);
                      }}
                      className="w-full grid grid-cols-[56px_1fr_24px] items-center gap-2 md:gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 hover:bg-white/[0.02] transition-colors duration-150 text-left"
                    >
                      <div className="w-14 flex items-center justify-center flex-shrink-0">
                        <div className="xcannes-fade-ring-y w-[52px] h-[52px] rounded-full bg-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
	                          <svg className="w-[26px] h-[26px] text-[#f5a623]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-light text-white whitespace-nowrap overflow-hidden text-ellipsis">
                          {t('ui_paste_payreq_title', 'Saisir une demande de paiement')}
                        </p>
                        <p className="text-[12px] md:text-[14px] font-light text-white/50 mt-0.5">
                          {t('ui_paste_payreq_hint', 'Coller ou saisir une demande de paiement')}
                        </p>
                      </div>
                      <svg className={`w-5 h-5 text-[#f5a623] flex-shrink-0 transition-transform duration-200 ${payreqManualEntryOpen ? 'rotate-90' : 'rotate-0'}`} viewBox="0 0 24 24" fill="none">
                        <path d="M8 18L14 12L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M13.5 18L19.5 12L13.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {payreqManualEntryOpen ? (
                      <div className="pl-2 pr-3 md:px-6 pb-4 -mt-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={payreqPasteValue}
                            onChange={(e) => {
                              setPayreqPasteValue(e.target.value);
                              setPayreqSelfSendError(false);
                              setPayreqDecodeError(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handlePayreqPasteSubmit();
                            }}
                            onPaste={(e) => {
                              const text = (e.clipboardData?.getData('text') || '').trim();
                              if (text) {
                                e.preventDefault();
                                setPayreqPasteValue(text);
                                if (isPayreqSelfSend(text)) {
                                  setPayreqSelfSendError(true);
                                  setPayreqDecodeError(false);
                                  return;
                                }
                                setPayreqSelfSendError(false);
                                setPayreqDecodeError(false);
                                setPendingPayreq(text);
                              }
                            }}
                            placeholder={t('ui_paste_payreq_placeholder', 'Saisir une demande de paiement')}
                            className="w-full bg-black ring-1 ring-white/10 ring-inset rounded-xl pl-3 pr-10 py-2 text-[13px] text-white placeholder:text-white/55 outline-none focus:ring-white/25 transition-all duration-200"
                          />
                          {payreqPasteValue.trim() ? (
                            <button
                              type="button"
                              onClick={handlePayreqPasteSubmit}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/30 hover:text-white/60 transition-colors"
                              title={t('ui_go_label', 'Valider')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* 4. Importer un QR code */}
                  <button
                    type="button"
                    onClick={() => handleFileUpload(payreqFileInputId, true)}
                    className="xcannes-fade-border-y w-full grid grid-cols-[56px_1fr_24px] items-center gap-2 md:gap-3 pl-2 pr-3 md:px-6 py-4 md:py-5 hover:bg-white/[0.02] transition-colors duration-150 text-left rounded-[20px] shadow-[inset_0_-14px_18px_rgba(0,0,0,0.55)]"
                  >
                    <div className="w-14 flex items-center justify-center flex-shrink-0">
                      <div className="xcannes-fade-ring-y w-[52px] h-[52px] rounded-full bg-black/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-center">
                        <svg className="w-[26px] h-[26px] text-[#f5a623]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" /></svg>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-light text-white whitespace-nowrap overflow-hidden text-ellipsis">{t('ui_import_card_title', 'Importer un QR code')}</p>
                      {payreqImportedDisplay ? (
                        <div className="flex items-center mt-1.5 bg-black/80 ring-1 ring-white/10 ring-inset rounded-xl pl-3 pr-3 py-2">
                          <span className="text-[13px] truncate text-white/85">{payreqImportedDisplay}</span>
                        </div>
                      ) : (
                        <p className="text-[12px] md:text-[14px] font-light text-white/50 mt-0.5">{t('ui_import_payreq_hint', 'Importez une image ou un fichier contenant un QR code')}</p>
                      )}
                    </div>
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#f5a623]" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M8 18L14 12L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M13.5 18L19.5 12L13.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
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
	                        setPayreqDecodeError(false);
	                        handlePaymentRequestScan?.(pendingPayreq);
	                        onChoosePayRequest?.();
	                      }
	                    }}
	                    className={`w-full h-[52px] md:h-[56px] flex items-center justify-center rounded-[14px] text-[17px] md:text-[16px] font-light transition-all duration-200 ${
	                      pendingPayreq
	                        ? 'text-white hover:scale-[1.01] active:scale-[0.98]'
	                        : 'text-white/90 cursor-not-allowed ring-[0.5px] ring-[#f5a623]/30 ring-inset'
	                    }`}
	                    style={{
	                      background: pendingPayreq
	                        ? 'linear-gradient(180deg, rgba(245, 166, 35, 1) 0%, rgba(217, 140, 15, 1) 100%)'
	                        : 'linear-gradient(180deg, rgba(245, 166, 35, 0.34) 0%, rgba(217, 140, 15, 0.34) 100%)',
	                      boxShadow: pendingPayreq
	                        ? '0 22px 42px rgba(0,0,0,0.78), 0 10px 22px rgba(0,0,0,0.55), 0 4px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -16px 26px rgba(0,0,0,0.55), inset 0 12px 22px rgba(0,0,0,0.18)'
	                        : '0 12px 24px rgba(0,0,0,0.44), 0 5px 12px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -10px 16px rgba(0,0,0,0.24)',
	                    }}
	                  >
	                    {pendingPayreq
	                      ? t('ui_validate_payreq', 'Vérifier la demande de paiement')
	                      : payreqSelfSendError
	                        ? <span className="inline-flex items-center gap-2 px-3 text-[13px] md:text-[15px] leading-snug text-white normal-case whitespace-normal">
	                            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 text-white" fill="none" aria-hidden>
	                              <path d="M12 3.5L21.5 20H2.5L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
	                              <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
	                              <circle cx="12" cy="17.25" r="0.9" fill="currentColor" />
	                            </svg>
	                            <span>{t('ui_cannot_send_to_self_short', 'Comptes expéditeur et destinataire identiques.')}</span>
	                          </span>
	                        : payreqDecodeError
	                          ? <span className="inline-flex items-center gap-2 px-3 text-[13px] md:text-[15px] leading-snug text-white normal-case whitespace-normal">
	                              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 text-white" fill="none" aria-hidden>
	                                <path d="M12 3.5L21.5 20H2.5L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
	                                <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
	                                <circle cx="12" cy="17.25" r="0.9" fill="currentColor" />
	                              </svg>
	                              <span>{t('ui_qr_decode_failed_short', 'QR illisible. Réessayez avec une image plus nette.')}</span>
	                            </span>
	                          : <span className="inline-flex items-center gap-1.5 text-white/85 font-light">
	                          <span className="text-[14px] md:text-[16px]">{t('ui_fill_payreq', 'Renseignez la demande de paiement')}</span>
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
                {/* Bottom bar – desktop only (visual balance) */}
                <div className="hidden md:flex pointer-events-none justify-center pt-6 pb-4" aria-hidden>
                  <span className="block w-[120px] h-[4px] rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
	      ) : null}

        {/* Flow dropdown (bottom sheet) */}
        {flowSheet ? (
          <div
            className="fixed inset-0 z-[10006] pointer-events-none"
            style={panelRect ? {
              top: panelRect.top,
              left: panelRect.left,
              width: panelRect.width,
              height: panelRect.height,
              right: 'auto',
              bottom: 'auto',
            } : undefined}
          >
            <div
              className="absolute inset-0 bg-black/35 md:bg-black/20 pointer-events-auto"
              style={flowSheetTranslateY > 0 ? { opacity: Math.max(0, Math.min(1, 1 - flowSheetTranslateY / 320)) } : undefined}
            />
            <div
              ref={flowSheetRef}
              className="absolute left-0 right-0 bottom-0 pointer-events-auto"
              style={{
                transform: flowSheetTranslateY ? `translateY(${Math.max(0, flowSheetTranslateY)}px)` : undefined,
                opacity: flowSheetTranslateY > 0 ? Math.max(0, Math.min(1, 1 - flowSheetTranslateY / 320)) : undefined,
                transition: flowSheetDragging ? 'none' : 'transform 220ms cubic-bezier(0.2,0,0,1)',
                willChange: flowSheetTranslateY ? 'transform' : undefined,
              }}
            >
	              <div className={panelRect ? 'w-full' : 'mx-auto w-full md:max-w-lg'}>
				<div className={`relative rounded-t-[22px] md:rounded-t-[22px] md:rounded-b-2xl bg-elevated shadow-[0_-18px_44px_rgba(0,0,0,0.62)] px-5 md:px-6 pt-5 md:pt-6 pb-[max(env(safe-area-inset-bottom),28px)] md:pb-8 ${flowSheet === 'simple' ? 'xcannes-sheet-fade-border-green' : 'xcannes-sheet-fade-border-orange'}`}>
				  {/* Drag handle + close button */}
				  <div className="relative flex items-center justify-center" onPointerDown={handleFlowSheetPillDown}>
				    <div className="md:hidden" aria-hidden>
				      <span className="block w-12 h-1.5 rounded-full bg-white/15" />
				    </div>
				    <button
				      type="button"
				      onClick={closeFlowSheet}
				      className="absolute right-0 h-9 w-9 rounded-full bg-white/[0.06] hover:bg-white/[0.09] active:bg-white/[0.05] transition-colors flex items-center justify-center"
				      aria-label={t('ui_close', 'Fermer')}
				    >
				      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/70" fill="none" aria-hidden>
				        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
				      </svg>
				    </button>
				  </div>

				  {flowSheet === 'simple' ? (
				    <>
				      {/* Header icon */}
				      <div className="flex justify-center mt-5">
				        <div className="w-[68px] h-[68px] rounded-full border border-xcannes-green/40 bg-xcannes-green/[0.08] flex items-center justify-center">
				          <svg viewBox="0 0 24 24" className="w-7 h-7 text-xcannes-green" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
				            <line x1="22" y1="2" x2="11" y2="13" />
				            <polygon points="22 2 15 22 11 13 2 9 22 2" />
				          </svg>
				        </div>
				      </div>
				      {/* Title + subtitle */}
				      <div className="mt-4 text-center">
				        <div className="text-[22px] md:text-[23px] font-semibold text-white leading-tight tracking-tight">
				          {t('ui_send_simple_title', 'Envoi simple')}
				        </div>
				        <div className="mt-1.5 text-[13px] text-white/45 font-light">
				          {t('ui_send_simple_steps_subtitle', 'Envoyez de l’argent en 4 étapes simples')}
				        </div>
				      </div>
				      {/* Steps with vertical connector */}
				      <div className="mt-7 flex flex-col">
				        {[
				          {
				            title: t('ui_send_simple_step1_title_v3', 'Destinataire'),
				            desc: t('ui_send_simple_step1_desc_v3', 'Ajoutez ou sélectionnez un destinataire.'),
				            icon: (<svg viewBox="0 0 24 24" className="w-5 h-5 text-xcannes-green/80" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>),
				          },
				          {
				            title: t('ui_send_simple_step2_title_v3', 'Paiement'),
				            desc: t('ui_send_simple_step2_desc_v3', 'Choisissez la devise et le montant.'),
				            icon: (<svg viewBox="0 0 24 24" className="w-5 h-5 text-xcannes-green/80" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>),
				          },
				          {
				            title: t('ui_send_simple_step3_title_v3', 'Vérification'),
				            desc: t('ui_send_choice_simple_flow_step3_desc_v2', 'Contrôlez les informations avant de continuer.'),
				            icon: (<svg viewBox="0 0 24 24" className="w-5 h-5 text-xcannes-green/80" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>),
				          },
				          {
				            title: t('ui_send_simple_step4_title_v3', 'Confirmation'),
				            desc: t('ui_send_simple_step4_desc_v3', 'Validez l’envoi en toute sécurité.'),
				            icon: (<svg viewBox="0 0 24 24" className="w-5 h-5 text-xcannes-green/80" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>),
				          },
				        ].map((step, idx, arr) => (
				          <div key={idx} className="flex gap-3.5 items-start">
				            <div className="flex flex-col items-center flex-none" style={{ width: '32px' }}>
				              <div className="w-8 h-8 rounded-full border border-xcannes-green/50 bg-white/[0.05] flex items-center justify-center text-[13px] text-xcannes-green font-light leading-none shrink-0">
				                {idx + 1}
				              </div>
				              {idx < arr.length - 1 && (
				                <div className="flex-1 w-px bg-xcannes-green/20 my-2" style={{ minHeight: '22px' }} />
				              )}
				            </div>
				            <div className="w-9 h-9 rounded-[10px] bg-white/[0.07] flex items-center justify-center flex-none shrink-0">
				              {step.icon}
				            </div>
				            <div className={`flex-1 min-w-0 ${idx < arr.length - 1 ? 'pb-5' : ''}`}>
				              <div className="text-[15px] font-semibold text-white leading-tight">{step.title}</div>
				              <div className="mt-1 text-[13px] text-white/50 font-light leading-relaxed">{step.desc}</div>
				            </div>
				          </div>
				        ))}
				      </div>
				      {/* CTA button */}
				      <button
				        type="button"
				        onClick={closeFlowSheet}
				        className="mt-7 w-full h-[52px] rounded-full bg-xcannes-green hover:brightness-110 active:brightness-90 transition-all flex items-center justify-center text-black font-semibold text-[16px]"
				      >
				        {t('ui_understood', 'Compris')}
				      </button>
				      {/* Security note */}
				      <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[11px] text-white/30 font-light">
				        <svg viewBox="0 0 24 24" className="w-3 h-3 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
				          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
				          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
				        </svg>
				        <span>{t('ui_security_bank_note', 'Vos fonds sont protégés par un chiffrement de niveau bancaire.')}</span>
				      </div>
				    </>
				  ) : (
				    <>
				      {/* Header: icon + title row + close is already above */}
				      <div className="flex items-start gap-3.5 mt-4">
				        <div className="w-10 h-10 rounded-full border border-[#f5a623]/40 bg-[#f5a623]/[0.08] flex items-center justify-center flex-none">
				          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#f5a623]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
				            <line x1="22" y1="2" x2="11" y2="13" />
				            <polygon points="22 2 15 22 11 13 2 9 22 2" />
				          </svg>
				        </div>
				        <div className="flex-1 min-w-0">
				          <div className="text-[19px] md:text-[20px] font-semibold text-white leading-tight">
				            {t('ui_send_choice_pay_request_title', 'Payer une demande')}
				          </div>
				          <div className="mt-1 text-[12px] text-white/40 font-light leading-snug">
				            {t('ui_payreq_steps_subtitle', '3 étapes simples pour régler une demande en toute sécurité.')}
				          </div>
				        </div>
				      </div>
				      {/* Steps with vertical dashed connector */}
				      <div className="mt-6 flex flex-col">
				        {[
				          {
				            title: t('home_v2_essentials_2_modal_flow_1_step_1_title', 'Recevoir la demande'),
				            desc: t('ui_payreq_step1_desc_v3', 'Le destinataire vous envoie le montant, la devise et son compte.'),
				            icon: (<svg viewBox="0 0 24 24" className="w-5 h-5 text-[#f5a623]/80" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>),
				          },
				          {
				            title: t('home_v2_essentials_2_modal_flow_1_step_2_title', 'Charger la demande'),
				            desc: t('ui_payreq_step2_desc_v3', 'Importez la demande en scannant le QR code, une image ou en collant le code reçu.'),
				            icon: (<svg viewBox="0 0 24 24" className="w-5 h-5 text-[#f5a623]/80" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>),
				          },
				          {
				            title: t('home_v2_essentials_2_modal_flow_1_step_3_title', 'Vérifier et confirmer'),
				            desc: t('ui_payreq_step3_desc_v3', 'Vérifiez les informations, puis confirmez la transaction en toute sécurité.'),
				            icon: (<svg viewBox="0 0 24 24" className="w-5 h-5 text-[#f5a623]/80" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>),
				          },
				        ].map((step, idx, arr) => (
				          <div key={idx} className="flex gap-3 items-start">
				            {/* Number + dashed line */}
				            <div className="flex flex-col items-center flex-none" style={{ width: '32px' }}>
				              <div className="w-8 h-8 rounded-full border border-[#f5a623]/50 bg-white/[0.05] flex items-center justify-center text-[13px] text-[#f5a623] font-light leading-none shrink-0">
				                {idx + 1}
				              </div>
				              {idx < arr.length - 1 && (
				                <div className="flex-1 w-px my-2" style={{ minHeight: '22px', background: 'repeating-linear-gradient(to bottom, rgba(245,166,35,0.35) 0px, rgba(245,166,35,0.35) 4px, transparent 4px, transparent 8px)' }} />
				              )}
				            </div>
				            {/* Icon box */}
				            <div className="w-10 h-10 rounded-[10px] bg-white/[0.07] flex items-center justify-center flex-none shrink-0">
				              {step.icon}
				            </div>
				            {/* Text + chevron */}
				            <div className={`flex-1 min-w-0 flex items-center justify-between gap-2 ${idx < arr.length - 1 ? 'pb-5' : ''}`}>
				              <div>
				                <div className="text-[15px] font-semibold text-white leading-tight">{step.title}</div>
				                <div className="mt-1 text-[12px] text-white/45 font-light leading-relaxed">{step.desc}</div>
				              </div>
				              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/25 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
				                <polyline points="9 18 15 12 9 6" />
				              </svg>
				            </div>
				          </div>
				        ))}
				      </div>
				      {/* Security note */}
				      <div className="mt-5 flex items-start gap-2 rounded-[12px] bg-white/[0.04] px-4 py-3">
				        <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/30 flex-none mt-[1px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
				          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
				          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
				        </svg>
				        <span className="text-[12px] text-white/35 font-light leading-relaxed">
				          {t('home_v2_essentials_2_modal_flow_1_step_3_note', 'Chaque paiement nécessite une validation explicite pour garantir sécurité et contrôle.')}
				        </span>
				      </div>
				      {/* CTA button */}
				      <button
				        type="button"
				        onClick={closeFlowSheet}
				        className="mt-5 w-full h-[52px] rounded-full bg-[#f5a623] hover:brightness-110 active:brightness-90 transition-all flex items-center justify-center text-black font-semibold text-[16px]"
				      >
				        {t('ui_understood', 'Compris')}
				      </button>
				    </>
				  )}
				</div>
              </div>
            </div>
          </div>
        ) : null}
        {/* Bottom bar – mobile only (flowSheet) */}
        {flowSheet ? (
          <div className="md:hidden pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-[10010]" aria-hidden>
            <span className="block w-36 h-1.5 rounded-full bg-white/80" />
          </div>
        ) : null}
	    </>
	  );

  if (inline) return content;
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
