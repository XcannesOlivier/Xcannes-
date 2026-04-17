'use client';

import { createPortal } from 'react-dom';
import { useTranslation } from 'next-i18next';
import { useModalTransition } from '@/hooks/useModalTransition';
import { useEffect, useRef, useState } from 'react';

export default function WalletDashboardSendChoiceModal({
  open,
  onClose,
  onChooseQuickScan,
  onChooseSimpleSend,
  onChoosePayRequest,
  inline = false,
}) {
  const { t } = useTranslation('common');
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  // ── Icons ────────────────────────────────────────────────────
  const QuickScanIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden>
      {/* QR-code frame */}
      <rect x="10" y="10" width="12" height="12" rx="2" className="stroke-xcannes-green/70" strokeWidth="1.5" fill="none" />
      <rect x="13" y="13" width="6" height="6" rx="1" className="fill-xcannes-green/50" />
      <rect x="26" y="10" width="12" height="12" rx="2" className="stroke-white/50" strokeWidth="1.5" fill="none" />
      <rect x="29" y="13" width="6" height="6" rx="1" className="fill-white/30" />
      <rect x="10" y="26" width="12" height="12" rx="2" className="stroke-white/50" strokeWidth="1.5" fill="none" />
      <rect x="13" y="29" width="6" height="6" rx="1" className="fill-white/30" />
      {/* scan lines */}
      <path d="M26 30h4m4 0h4" className="stroke-xcannes-green/60" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M26 36h12" className="stroke-white/30" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const SimpleSendIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="16" className="fill-xcannes-green/10 stroke-xcannes-green/40" strokeWidth="1.5" />
      <line x1="24" y1="32" x2="24" y2="16" className="stroke-xcannes-green" strokeWidth="2.5" strokeLinecap="round" />
      <polyline points="18 22 24 16 30 22" className="stroke-xcannes-green" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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

  const cardClassName =
    'w-full text-left rounded-[20px] px-4 py-4 bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.03] ring-1 ring-white/10 ring-inset shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]';

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
    'relative w-full wallet-modal-panel wallet-cash-modal wallet-modal-no-top-highlight-mobile border-white/10 md:border overflow-hidden flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]',
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
              <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_12%_0%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(850px_circle_at_95%_92%,rgba(0,255,150,0.06),transparent_55%)]" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
            </div>

            <div className="relative z-10 flex flex-col flex-1 min-h-0">
              {/* Header (draggable) */}
              <div
                className="border-b border-white/10"
                onPointerDown={event => { maybeStartOverlayDrag(event, 'fixed'); }}
              >
                {!inline ? (
                  <div className="md:hidden flex justify-center pt-3 pb-0" aria-hidden>
                    <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                  </div>
                ) : null}
                <div className="pt-6 md:pt-5 pb-3 flex flex-col items-center text-center px-4">
                  <h3 className="mt-1 text-[22px] md:text-[24px] font-semibold text-white/95 tracking-tight">
                    {t('ui_send_choice_title', 'Envoyer')}
                  </h3>
                  <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-[34ch] leading-relaxed">
                    {t('ui_send_choice_subtitle', 'Choisissez comment envoyer vos fonds')}
                  </p>
                </div>
              </div>

              {/* Cards list */}
              <div
                ref={overlayListRef}
                className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5"
                onPointerDown={event => { maybeStartOverlayDrag(event, 'list'); }}
              >
                <div className="flex flex-col gap-5 pb-2">

                  {/* ── 1. Quick Scan ───────────────────────── */}
                  <button type="button" onClick={onChooseQuickScan} className={cardClassName}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                        <QuickScanIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[18px] md:text-[19px] text-white font-semibold truncate">
                            {t('ui_send_quick_scan_title', 'Quick Scan')}
                          </p>
                          <svg className="w-5 h-5 text-white/45" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <p className="mt-1 text-[15px] md:text-sm leading-snug text-xcannes-green/90">
                          {t('ui_send_quick_scan_hint', 'Scannez un QR code pour envoyer instantanément')}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* ── 2. Envoi simple ──────────────────────── */}
                  <button type="button" onClick={onChooseSimpleSend} className={cardClassName}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                        <SimpleSendIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[18px] md:text-[19px] text-white font-semibold truncate">
                            {t('ui_send_simple_title', 'Envoi simple')}
                          </p>
                          <svg className="w-5 h-5 text-white/45" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <p className="mt-1 text-[15px] md:text-sm leading-snug text-white/60">
                          {t('ui_send_simple_hint', 'Saisissez une adresse et un montant manuellement')}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* ── 3. Payer une demande ─────────────────── */}
                  <button type="button" onClick={onChoosePayRequest} className={cardClassName}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                        <PayRequestIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[18px] md:text-[19px] text-white font-semibold truncate">
                            {t('ui_send_pay_request_title', 'Payer une demande')}
                          </p>
                          <svg className="w-5 h-5 text-white/45" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <p className="mt-1 text-[15px] md:text-sm leading-snug text-white/60">
                          {t('ui_send_pay_request_hint', 'Réglez une demande de paiement reçue')}
                        </p>
                      </div>
                    </div>
                  </button>

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
