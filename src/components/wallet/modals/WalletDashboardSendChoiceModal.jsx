'use client';

import { createPortal } from 'react-dom';
import { useTranslation } from 'next-i18next';
import { useModalTransition } from '@/hooks/useModalTransition';
import { useEffect, useRef, useState, useCallback } from 'react';
import { normalizeQrImageFile } from '@/utils/qrImage';

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
}) {
  const { t } = useTranslation('common');
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  // ── Accordion state ──────────────────────────────────────────
  const [expandedCard, setExpandedCard] = useState(null); // 'quickscan' | 'payreq' | null
  const [showSteps, setShowSteps] = useState(false);
  const [showPayreqSteps, setShowPayreqSteps] = useState(false);
  const [payreqPasteValue, setPayreqPasteValue] = useState('');
  const [quickscanPasteValue, setQuickscanPasteValue] = useState('');
  const [showQuickscanSavedPicker, setShowQuickscanSavedPicker] = useState(false);
  const normalizedCurrentWallet = String(currentWalletAddress || '').trim();
  const quickscanFileInputId = 'quickscan-choice-qr-file';
  const payreqFileInputId = 'payreq-choice-qr-file';
  const manualQrReaderIdRef = useRef(
    `choice-qr-reader-${Math.random().toString(36).slice(2, 10)}`,
  );
  const manualQrScannerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setExpandedCard(null);
      setShowSteps(false);
      setShowPayreqSteps(false);
      setPayreqPasteValue('');
      setQuickscanPasteValue('');
      setShowQuickscanSavedPicker(false);
    }
  }, [open]);

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
          handlePaymentRequestScan?.(decodedText);
          onChoosePayRequest?.();
        } else {
          // Check if it looks like a payment request or just an address
          const looksLikePayreq = /^(xcannes-payreq|xcannes-request)(?::\/\/|:)/i.test(decodedText) ||
            (decodedText.startsWith('{') && /"to"|"targetCurrency"|"schema"|"payreq"/i.test(decodedText));
          if (looksLikePayreq) {
            handlePaymentRequestScan?.(decodedText);
            onChoosePayRequest?.();
          } else {
            setSendDestination?.(decodedText);
            setSendDestinationLabel?.('');
            onChooseSimpleSend?.();
          }
        }
      }
    } catch {
      toast?.error(t('ui_qr_decode_failed_3b5d7f9a2c', 'Unable to decode this image. Try a clearer screenshot.'));
    }
  }, [handlePaymentRequestScan, setSendDestination, setSendDestinationLabel, onChooseSimpleSend, onChoosePayRequest, toast, t]);

  const handleFileUpload = useCallback((inputId, isPayreq) => {
    const input = document.getElementById(inputId);
    input?.click();
  }, []);

  // ── Paste handler for "Quick Scan" accordion ────────────────
  const looksLikeXrplAddress = (v) => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(v);

  const handleQuickscanPasteSubmit = useCallback(() => {
    const raw = quickscanPasteValue.trim();
    if (!raw) return;
    if (looksLikeXrplAddress(raw)) {
      setSendDestination?.(raw);
      setSendDestinationLabel?.('');
      onChooseSimpleSend?.();
    } else {
      const result = handlePaymentRequestScan?.(raw);
      if (result?.relayChallenge || result?.navigate) {
        onClose?.();
        return;
      }
      setSendDestination?.(raw);
      setSendDestinationLabel?.('');
      onChooseSimpleSend?.();
    }
  }, [quickscanPasteValue, setSendDestination, setSendDestinationLabel, onChooseSimpleSend, handlePaymentRequestScan, onClose]);

  // ── Paste handler for "Payer une demande" ────────────────────
  const handlePayreqPasteSubmit = useCallback(() => {
    const raw = payreqPasteValue.trim();
    if (!raw) return;
    handlePaymentRequestScan?.(raw);
    onChoosePayRequest?.();
  }, [payreqPasteValue, handlePaymentRequestScan, onChoosePayRequest]);

  // ── Icons ────────────────────────────────────────────────────
  const QuickScanIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden>
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
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden>
      <rect x="10" y="12" width="28" height="24" rx="5" className="fill-white/5 stroke-white/40" strokeWidth="1.5" />
      <path d="M16 22h16" className="stroke-white/50" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 28h10" className="stroke-white/35" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="34" cy="30" r="6" className="fill-[#f5a623]/15 stroke-[#f5a623]/60" strokeWidth="1.4" />
      <path d="M34 27v6m-2-4c0-.7.9-1.2 2-1.2s2 .5 2 1.2-.9 1.2-2 1.2-2 .5-2 1.2.9 1.2 2 1.2 2-.5 2-1.2"
        className="stroke-[#f5a623]/90" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const ChevronIcon = ({ expanded }) => (
    <svg
      className="w-5 h-5 text-white/30 flex-shrink-0"
      viewBox="0 0 24 24" fill="none" aria-hidden
    >
      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const cardClassName =
    'w-full text-left rounded-[20px] px-4 py-4 bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.03] ring-1 ring-white/10 ring-inset shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]';

  const accordionBtnClass =
    'flex items-center justify-center gap-2.5 w-full rounded-[20px] px-3 py-2.5 bg-elevated hover:bg-white/[0.07] active:bg-white/[0.04] transition-colors duration-100';

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
    'relative w-full wallet-modal-panel wallet-cash-modal wallet-modal-no-top-highlight-mobile border-white/10 md:border overflow-hidden flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)]',
    inline ? 'h-full max-h-none rounded-xl' : 'h-screen md:h-auto md:max-w-lg md:max-h-[100vh] rounded-none md:rounded-2xl',
    'bg-elevated',
    inline ? 'wallet-inline-zoom-in' : '',
    liftAnimClass,
  ].join(' ');

  const content = (
    <>
      {/* Backdrop */}
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${backdropAnimClass}`}
          onClick={onClose}
          style={
            overlayTranslateY > 0
              ? { opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) }
              : undefined
          }
        />
      ) : null}

      {/* Modal */}
      <div className={wrapperClass}>
        <div
          ref={overlayRef}
          className={inline ? 'w-full h-full flex' : 'pointer-events-auto w-full'}
          style={{
            transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
            transition: overlayDragging ? 'none' : 'transform 220ms cubic-bezier(0.2,0,0,1)',
            willChange: overlayTranslateY ? 'transform' : undefined,
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
              <div className="absolute inset-0 bg-[radial-gradient(850px_circle_at_95%_92%,rgba(0,255,150,0.06),transparent_55%)]" />
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

              {/* Wallet meta pill */}
              <div
                className="pt-4 md:pt-3 pb-0 flex justify-center px-4"
                onPointerDown={event => { maybeStartOverlayDrag(event, 'fixed'); }}
              >
                {renderWalletMeta?.({
                  variant: "pill",
                  className:
                    "w-full flex justify-center wallet-meta--plus-4 wallet-meta--desktop-gap",
                  prefix: t("moonpay_from_account", "Depuis le compte"),
                  labelWrap: false,
                  pillClassName:
                    "bg-elevated px-6 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)] gap-6",
                  prefixClassName:
                    "!text-white/70 text-[14px] md:text-[15px] font-medium tracking-wide mr-6",
                  labelClassName:
                    "!text-white/95 text-[14px] md:text-[15px] font-semibold",
                  dotClassName: "!h-3 !w-3 ring-xcannes-green/20 self-center",
                })}
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                {/* Title + subtitle + arrow */}
                <div
                  className={`pt-6 md:pt-5 pb-3 flex flex-col items-center text-center transition-all duration-300 ${expandedCard ? 'blur-[4px] opacity-20 pointer-events-none' : ''}`}
                  onPointerDown={event => { maybeStartOverlayDrag(event, 'fixed'); }}
                >
                  <h3 className="mt-1 text-[22px] md:text-[24px] font-semibold text-white/95 tracking-tight">
                    {t('ui_send_choice_subtitle', 'Choisissez comment envoyer vos fonds')}
                  </h3>
                  <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-[34ch] leading-relaxed">
                    {t('ui_send_choice_hint', 'Scannez, collez, importez ou choisissez une adresse dans votre liste.')}
                  </p>
                  {/* Action chips */}
                  <div className="mt-8 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onChooseQuickScan}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/[0.10] active:scale-[0.97] transition-all text-[13px] text-white/80 font-medium"
                    >
                      <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      {t('ui_scan_label', 'Scanner')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        /* Focus the paste input inside the quickscan accordion */
                        setExpandedCard('quickscan');
                        setTimeout(() => {
                          document.getElementById('quickscan-paste-input')?.focus();
                        }, 220);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/[0.10] active:scale-[0.97] transition-all text-[13px] text-white/80 font-medium"
                    >
                      <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {t('ui_paste_label', 'Coller')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFileUpload(quickscanFileInputId, false)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/[0.10] active:scale-[0.97] transition-all text-[13px] text-white/80 font-medium"
                    >
                      <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" />
                      </svg>
                      {t('ui_import_label', 'Importer')}
                    </button>
                  </div>
                </div>

                {/* Cards — vertically centred in remaining space */}
                <div
                  ref={overlayListRef}
                  className="flex-1 min-h-0 flex flex-col justify-start gap-3 mt-8 px-4 md:px-5 overflow-y-auto [--list-pad:1rem] md:[--list-pad:1.25rem]"
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

                  {/* ── 1. Envoi simple (accordion) ── */}
                  <div
                    className={`w-full bg-white/[0.02] rounded-[20px] ring-1 ring-inset ring-white/10 hover:ring-white/20 shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-300 ${expandedCard === 'payreq' ? 'blur-[4px] opacity-20 pointer-events-none' : ''}`}
                  >
                    {/* Header */}
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedCard(prev => prev === 'quickscan' ? null : 'quickscan');
                      }}
                      className="w-full text-left px-4 py-5 flex items-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                        <QuickScanIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] md:text-[17px] text-white/92 font-semibold">
                          {t('ui_send_simple_title', 'Envoi simple')}
                        </p>
                        <p className="mt-1 text-[13px] md:text-[14px] leading-snug text-white/55">
                          {t('ui_send_simple_hint_long', 'Saisissez une adresse, indiquez la devise et le montant.')}
                        </p>
                        {expandedCard === 'quickscan' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowSteps(s => !s); }}
                            className="mt-1.5 text-[12px] text-xcannes-green/80 hover:text-xcannes-green transition-colors duration-150 font-medium"
                          >
                            {showSteps
                              ? t('ui_hide_steps', 'Masquer les étapes')
                              : t('ui_show_steps', 'Voir les étapes')}
                          </button>
                        )}
                      </div>
                      <ChevronIcon />
                    </button>

                    {/* Accordion body */}
                    <div
                      className="overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                      style={{
                        maxHeight: expandedCard === 'quickscan' ? '800px' : '0px',
                        opacity: expandedCard === 'quickscan' ? 1 : 0,
                      }}
                    >
                      <div className="px-4 pb-4 pt-1 space-y-3">

                        {/* Steps guide (collapsible) */}
                        <div
                          className="overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                          style={{
                            maxHeight: showSteps ? '300px' : '0px',
                            opacity: showSteps ? 1 : 0,
                          }}
                        >
                          <ol className="space-y-2 text-[12px] leading-relaxed pb-1">
                            <li className="flex gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">1</span>
                              <span className="text-white/60">{t('ui_step_1', 'Renseignez l\'adresse du destinataire — scannez, collez, importez ou choisissez dans votre liste.')}</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">2</span>
                              <span className="text-white/60">{t('ui_step_2', 'Sélectionnez la devise parmi celles disponibles sur votre compte.')}</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">3</span>
                              <span className="text-white/60">{t('ui_step_3', 'Indiquez le montant à envoyer.')}</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">4</span>
                              <span className="text-white/60">{t('ui_step_4', 'Vérifiez et validez en toute sécurité.')}</span>
                            </li>
                          </ol>
                        </div>

                        {/* Sub-action buttons row */}
                        <div className="flex gap-2">
                          {/* Scan QR */}
                          <button
                            type="button"
                            onClick={onChooseQuickScan}
                            className={`${accordionBtnClass} text-white`}
                            style={{
                              background: 'linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)',
                              boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)',
                            }}
                            title={t('ui_scan_qr_code_12fa63d927', 'Scan QR Code')}
                          >
                            <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            <span className="text-[13px] text-white font-medium">{t('ui_scan_label', 'Scanner')}</span>
                          </button>

                          {/* Import QR image */}
                          <button
                            type="button"
                            onClick={() => handleFileUpload(quickscanFileInputId, false)}
                            className={accordionBtnClass}
                            title={t('ui_or_upload_a_qr_image_works_e_df6baa8039', 'Charger une image qrcode')}
                          >
                            <svg className="w-5 h-5 text-white/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" />
                            </svg>
                            <span className="text-[13px] text-white/70">{t('ui_import_label', 'Importer')}</span>
                          </button>
                        </div>

                        {/* Paste input */}
                        <div className="relative">
                          <input
                            id="quickscan-paste-input"
                            type="text"
                            value={quickscanPasteValue}
                            onChange={(e) => {
                              setQuickscanPasteValue(e.target.value);
                              setShowQuickscanSavedPicker(false);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickscanPasteSubmit(); }}
                            onPaste={(e) => {
                              const text = (e.clipboardData?.getData('text') || '').trim();
                              if (text) {
                                e.preventDefault();
                                setQuickscanPasteValue(text);
                                setShowQuickscanSavedPicker(false);
                                setTimeout(() => {
                                  setSendDestination?.(text);
                                  setSendDestinationLabel?.('');
                                  onChooseSimpleSend?.();
                                }, 50);
                              }
                            }}
                            placeholder={t('ui_paste_address_placeholder', 'Coller ou saisir une adresse')}
                            className="w-full bg-elevated ring-1 ring-white/15 ring-inset rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.4)] pl-4 pr-12 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-xcannes-green/60"
                          />
                          {quickscanPasteValue.trim() ? (
                            <button
                              type="button"
                              onClick={handleQuickscanPasteSubmit}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green transition-colors"
                              title={t('ui_go_label', 'Valider')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </button>
                          ) : null}
                        </div>

                        {/* Destination selector (saved addresses) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowQuickscanSavedPicker(prev => !prev)}
                            className="w-full flex items-center gap-2 bg-elevated ring-1 ring-white/15 ring-inset rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.4)] px-3 py-2.5 text-sm text-white/70 hover:bg-white/[0.03] transition-colors"
                          >
                            <svg className="w-4 h-4 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                            <span className="flex-1 text-left truncate">
                              {quickscanPasteValue.trim()
                                ? quickscanPasteValue.trim()
                                : t('ui_choose_recipient', 'Choose address')}
                            </span>
                          </button>

                          {/* Saved addresses dropdown */}
                          {showQuickscanSavedPicker ? (
                            <div className="absolute left-0 right-0 top-full mt-1 z-[100] rounded-[20px] ring-1 ring-white/15 ring-inset overflow-hidden shadow-lg bg-elevated">
                              <div className="max-h-44 overflow-y-auto">
                                {(() => {
                                  const filtered = (savedAddresses || []).filter(entry => {
                                    const addr = String(entry?.address || '').trim();
                                    if (!addr) return false;
                                    if (normalizedCurrentWallet && addr === normalizedCurrentWallet) return false;
                                    return true;
                                  });
                                  return filtered.length > 0 ? (
                                    filtered.map((addr, idx) => (
                                      <button
                                        key={`qs-${addr.address}-${idx}`}
                                        type="button"
                                        onClick={() => {
                                          const value = String(addr?.address || '').trim();
                                          if (!value) return;
                                          const label = String(addr?.onChainLabel || addr?.label || '').trim();
                                          setQuickscanPasteValue(value);
                                          setSendDestination?.(value);
                                          setSendDestinationLabel?.(label);
                                          setShowQuickscanSavedPicker(false);
                                          onChooseSimpleSend?.();
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5 transition-colors"
                                      >
                                        <span className="block font-semibold">
                                          {String(addr?.onChainLabel || addr?.label || '').trim() || t('ui_wallet_unknown', 'Unknown wallet')}
                                        </span>
                                        <span className="block font-mono text-xs text-white/60 truncate">
                                          {addr.address}
                                        </span>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-3 py-2 text-xs text-white/60">
                                      {t('ui_no_saved_addresses', 'No saved addresses yet')}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          ) : null}
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* ── 2. Payer une demande (accordion) ─────── */}
                  <div className={`w-full bg-white/[0.02] rounded-[20px] ring-1 ring-inset ring-white/10 hover:ring-white/20 shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-300 ${expandedCard === 'quickscan' ? 'blur-[4px] opacity-20 pointer-events-none' : ''}`}>
                    {/* Header */}
                    <button
                      type="button"
                      onClick={() => setExpandedCard(prev => prev === 'payreq' ? null : 'payreq')}
                      className="w-full text-left px-4 py-5 flex items-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                        <PayRequestIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] md:text-[17px] text-white/92 font-semibold">
                          {t('ui_send_pay_request_title', 'Payer une demande')}
                        </p>
                        <p className="mt-1 text-[13px] md:text-[14px] leading-snug text-white/55">
                          {t('ui_send_pay_request_hint', 'Réglez une demande reçue après vérification.')}
                        </p>
                        {expandedCard === 'payreq' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowPayreqSteps(s => !s); }}
                            className="mt-1.5 text-[12px] text-[#f5a623]/80 hover:text-[#f5a623] transition-colors duration-150 font-medium"
                          >
                            {showPayreqSteps
                              ? t('ui_hide_steps', 'Masquer les étapes')
                              : t('ui_show_steps', 'Voir les étapes')}
                          </button>
                        )}
                      </div>
                      <ChevronIcon />
                    </button>

                    {/* Accordion body */}
                    <div
                      className="overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                      style={{
                        maxHeight: expandedCard === 'payreq' ? '400px' : '0px',
                        opacity: expandedCard === 'payreq' ? 1 : 0,
                      }}
                    >
                      <div className="px-4 pb-4 pt-1 space-y-3">

                        {/* Steps guide (collapsible) */}
                        <div
                          className="overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                          style={{
                            maxHeight: showPayreqSteps ? '200px' : '0px',
                            opacity: showPayreqSteps ? 1 : 0,
                          }}
                        >
                          <ol className="space-y-2 text-[12px] leading-relaxed pb-1">
                            <li className="flex gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f5a623]/15 text-[#f5a623] text-[11px] font-bold flex items-center justify-center">1</span>
                              <span className="text-white/60">{t('ui_payreq_step_1', 'Renseignez le code ou QR code — scannez, collez, importez.')}</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f5a623]/15 text-[#f5a623] text-[11px] font-bold flex items-center justify-center">2</span>
                              <span className="text-white/60">{t('ui_payreq_step_2', 'Vérifiez et validez en toute sécurité.')}</span>
                            </li>
                          </ol>
                        </div>

                        {/* Sub-action buttons row */}
                        <div className="flex gap-2">
                          {/* Scan QR */}
                          <button
                            type="button"
                            onClick={onChooseQuickScan}
                            className={accordionBtnClass}
                            title={t('ui_scan_qr_code_12fa63d927', 'Scan QR Code')}
                          >
                            <svg className="w-5 h-5 text-[#f5a623]/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            <span className="text-[13px] text-white/70">{t('ui_scan_label', 'Scanner')}</span>
                          </button>

                          {/* Import QR image */}
                          <button
                            type="button"
                            onClick={() => handleFileUpload(payreqFileInputId, true)}
                            className={accordionBtnClass}
                            title={t('ui_or_upload_a_qr_image_works_e_df6baa8039', 'Charger une image qrcode')}
                          >
                            <svg className="w-5 h-5 text-white/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" />
                            </svg>
                            <span className="text-[13px] text-white/70">{t('ui_import_label', 'Importer')}</span>
                          </button>
                        </div>

                        {/* Paste input */}
                        <div className="relative">
                          <input
                            type="text"
                            value={payreqPasteValue}
                            onChange={(e) => setPayreqPasteValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handlePayreqPasteSubmit(); }}
                            onPaste={(e) => {
                              const text = (e.clipboardData?.getData('text') || '').trim();
                              if (text) {
                                e.preventDefault();
                                setPayreqPasteValue(text);
                                setTimeout(() => {
                                  handlePaymentRequestScan?.(text);
                                  onChoosePayRequest?.();
                                }, 50);
                              }
                            }}
                            placeholder={t('ui_paste_payreq_placeholder', 'Coller une demande de paiement')}
                            className="w-full bg-elevated ring-1 ring-white/15 ring-inset rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.4)] pl-4 pr-12 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-[#f5a623]/50"
                          />
                          {payreqPasteValue.trim() ? (
                            <button
                              type="button"
                              onClick={handlePayreqPasteSubmit}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#f5a623]/20 hover:bg-[#f5a623]/30 text-[#f5a623] transition-colors"
                              title={t('ui_go_label', 'Valider')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </button>
                          ) : null}
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Hidden div for html5-qrcode reader */}
                  <div id={manualQrReaderIdRef.current} className="hidden" />

                  {/* Footer note */}
                  <p className={`text-center text-[12px] text-white/40 leading-relaxed mt-2 transition-all duration-200 ${showSteps ? 'opacity-0 h-0 mt-0 overflow-hidden' : ''}`}>
                    {t('ui_send_fees_note', 'Les détails seront affichés avant confirmation.')}
                  </p>
                </div>
              </div>
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
