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
  handlePaymentRequestScan,
  setSendDestination,
  setSendDestinationLabel,
  toast,
  renderWalletMeta,
  inline = false,
}) {
  const { t } = useTranslation('common');
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  const quickscanFileInputId = 'quickscan-choice-qr-file';
  const manualQrReaderIdRef = useRef(
    `choice-qr-reader-${Math.random().toString(36).slice(2, 10)}`,
  );
  const manualQrScannerRef = useRef(null);



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

  const ChevronIcon = () => (
    <svg
      className="w-5 h-5 text-white/30 flex-shrink-0"
      viewBox="0 0 24 24" fill="none" aria-hidden
    >
      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

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
                  className="pt-6 md:pt-5 pb-3 flex flex-col items-center text-center"
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
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard?.readText();
                          if (text?.trim()) {
                            setSendDestination?.(text.trim());
                            setSendDestinationLabel?.('');
                          }
                        } catch { /* clipboard not available */ }
                        onChooseSimpleSend?.();
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
                  className="flex-1 min-h-0 flex flex-col justify-start gap-3 mt-8 px-4 md:px-5 [--list-pad:1rem] md:[--list-pad:1.25rem] overflow-y-auto"
                  onPointerDown={event => { maybeStartOverlayDrag(event, 'list'); }}
                >

                  {/* Hidden file input for QR image import */}
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

                  {/* ── 1. Envoi simple ── */}
                  <button
                    type="button"
                    onClick={() => onChooseSimpleSend?.()}
                    className="w-full text-left bg-white/[0.02] rounded-[20px] ring-1 ring-inset ring-white/10 hover:ring-white/20 shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px active:translate-y-0 active:scale-[0.99] px-4 py-5 flex items-center gap-3"
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
                    </div>
                    <ChevronIcon />
                  </button>

                  {/* ── 2. Payer une demande ── */}
                  <button
                    type="button"
                    onClick={() => onChoosePayRequest?.()}
                    className="w-full text-left bg-white/[0.02] rounded-[20px] ring-1 ring-inset ring-white/10 hover:ring-white/20 shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px active:translate-y-0 active:scale-[0.99] px-4 py-5 flex items-center gap-3"
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
                    </div>
                    <ChevronIcon />
                  </button>

                  {/* Hidden div for html5-qrcode reader */}
                  <div id={manualQrReaderIdRef.current} className="hidden" />

                  {/* Footer note */}
                  <p className="text-center text-[12px] text-white/40 leading-relaxed mt-2">
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
