'use client';

import { createPortal } from 'react-dom';
import { useTranslation } from 'next-i18next';
import { useModalTransition } from '@/hooks/useModalTransition';
import { useEffect, useRef, useState } from 'react';

export default function WalletDashboardCashChoiceModal({
  open,
  onClose,
  onChooseBuy,
  onChooseSell,
  onChooseUsdSwapOut,
  onChooseUsdSwapIn,
  noticeVariant = 'preview',
  inline = false,
}) {
  const { t } = useTranslation('common');
  const addHintText = t('ui_funds_add_hint', 'Par carte ou virement bancaire');
  const withdrawHintText = t('ui_funds_withdraw_hint', 'Vers votre compte bancaire');
  const highlightWithdraw = value => {
    const input = String(value || '');
    if (!input) return input;
    const parts = input.split(/(compte bancaire)/i);
    return parts.map((part, idx) =>
      /^compte bancaire$/i.test(part) ? (
        <span key={`${idx}-${part}`} className="text-xcannes-green/90">
          {part}
        </span>
      ) : (
        <span key={`${idx}-${part}`}>{part}</span>
      ),
    );
  };
  const swapOutHintText = t('ui_funds_swap_out_hint', 'Depuis un portefeuille externe (USDC, USDT, RLUSD, ...)');
  const swapOutSubhintText = t('ui_funds_swap_out_subhint', 'Ajoutés automatiquement à votre solde');
  const swapInHintText = t('ui_funds_swap_in_hint', 'Vers un portefeuille externe');
  const swapInSubhintText = t('ui_funds_swap_in_subhint', 'Conversion automatique si nécessaire');
  const stablecoinLiquidityNote = t(
    'ui_funds_stablecoin_liquidity_note',
    'Transactions optimisées via les stablecoins en USD et le réseau XRP.',
  );
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  const FundsCardAddIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden>
      <rect
        x="6"
        y="14"
        width="32"
        height="22"
        rx="6"
        className="fill-xcannes-green/15 stroke-xcannes-green/45"
        strokeWidth="1.5"
      />
      <rect x="10" y="18" width="18" height="4" rx="2" className="fill-xcannes-green/35" />
      <rect x="10" y="26" width="12" height="3" rx="1.5" className="fill-xcannes-green/25" />
      <path d="M36 24v8m-4-4h8" className="stroke-xcannes-green" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );

  const FundsCardBankIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden>
      <path
        d="M10 18l14-8 14 8"
        className="stroke-white/80"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 18h20" className="stroke-white/80" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 18v16m6-16v16m6-16v16m6-16v16" className="stroke-white/60" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 34h24" className="stroke-white/80" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 38h28" className="stroke-white/75" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  const FundsCardWalletIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden>
      <path
        d="M14 18c0-2.2 1.8-4 4-4h16c2.2 0 4 1.8 4 4v16c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V18Z"
        className="fill-[#0870f8]/8 stroke-white/35"
        strokeWidth="1.5"
      />
      <path
        d="M14 20h20c2.2 0 4 1.8 4 4v0H28c-2.2 0-4 1.8-4 4v0H14"
        className="stroke-white/55"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="30.5" cy="27" r="5.5" className="fill-[#0870f8]/15" />
      <path
        d="M30.5 23.6v6.8m-2.4-4.4c0-.8 1-1.4 2.4-1.4s2.4.6 2.4 1.4-1 1.4-2.4 1.4-2.4.6-2.4 1.4 1 1.4 2.4 1.4 2.4-.6 2.4-1.4"
        className="stroke-white/85"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const FundsCardSendIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden>
      <path
        d="M10 22l28-12-10 28-6-10-12-6Z"
        className="fill-[#ff6a00]/8 stroke-white/45"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M38 10L22 28" className="stroke-white/75" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22 28l0 10" className="stroke-white/45" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const sectionHeader = label => (
    <div className="flex items-center gap-3 px-1">
      <div className="text-[13px] tracking-[0.22em] text-white/45">{label}</div>
      <div className="h-px flex-1 bg-white/10" aria-hidden />
    </div>
  );

  // Match the "Convert" action button background (wallet-actions.css).
  const cardClassName =
    'w-full text-left rounded-[20px] px-4 py-4 bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.03] ring-1 ring-white/10 ring-inset shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]';

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
  const liftAnimClass = closeRequestedRef.current
    ? ''
    : !inline
      ? isClosing
        ? 'wallet-modal-lift-out'
        : 'wallet-modal-lift-in'
      : '';
  const backdropAnimClass = closeRequestedRef.current
    ? ''
    : isClosing
      ? 'wallet-modal-backdrop-out'
      : 'wallet-modal-backdrop-in';
  const panelClass = [
    'relative w-full wallet-modal-panel wallet-cash-modal wallet-modal-no-top-highlight-mobile border-white/10 md:border overflow-hidden flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]',
    inline
      ? 'h-full max-h-none rounded-xl'
      : 'h-screen md:h-auto md:max-w-lg md:max-h-[100vh] rounded-none md:rounded-2xl',
    noticeVariant === 'demo' ? 'bg-xcannes-surface-demo' : 'bg-elevated',
    noticeVariant === 'demo' ? 'demo-wallet-tooltip-scope' : '',
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
              ? {
                  opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)),
                }
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
            opacity: overlayTranslateY > 0 ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) : undefined,
            willChange: overlayTranslateY ? 'transform' : undefined,
          }}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerEnd}
          onPointerCancel={handleOverlayPointerEnd}
        >
          <div
            className={panelClass}
            onClick={e => {
              if (!inline) e.stopPropagation();
            }}
          >
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_12%_0%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(850px_circle_at_95%_92%,rgba(0,255,150,0.06),transparent_55%)]" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
            </div>

            <div className="relative z-10 flex flex-col flex-1 min-h-0">
	              <div
	                className="border-b border-white/10"
	                onPointerDown={event => {
	                  maybeStartOverlayDrag(event, 'fixed');
	                }}
	              >
                {!inline ? (
                  <div className="md:hidden flex justify-center pt-3 pb-0" aria-hidden>
                    <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                  </div>
                ) : null}
	                <div className="pt-6 md:pt-5 pb-3 flex flex-col items-center text-center px-4">
                    <h3 className="mt-1 text-[30px] md:text-[32px] font-semibold text-white/95 tracking-tight">
                      {t('ui_funds_manage_title', 'Gérer vos fonds')}
                    </h3>
                    {noticeVariant === 'demo' ? (
                      <span className="mt-2 inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-1 leading-none">
                        {t('demo_notice_title', 'Mode démo')}
                      </span>
                    ) : null}
                    <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-[34ch] leading-relaxed">
                      {t('ui_funds_manage_subtitle', 'Ajoutez, retirez ou transférez vos fonds facilement.')}
                    </p>
                    
	                </div>
	              </div>

              <div
                ref={overlayListRef}
                className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5"
                onPointerDown={event => {
                  maybeStartOverlayDrag(event, 'list');
                }}
              >
                <div className="flex flex-col gap-7 pb-2">
                  <div className="space-y-4">
                    {sectionHeader(t('ui_funds_section_agent', 'Compte bancaire'))}

                    <button type="button" onClick={onChooseBuy} className={cardClassName}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                          <FundsCardAddIcon />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[18px] md:text-[19px] text-white font-semibold truncate">
                              {t('ui_funds_increase_balances_title', 'Ajouter des fonds')}
                            </p>
                            <svg className="w-5 h-5 text-white/45" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M9 18L15 12L9 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <p className="mt-1 text-[15px] md:text-sm leading-snug text-xcannes-green/90">
                            {(() => {
                              const parts = String(addHintText || '').split(' ou ');
                              if (parts.length === 2) {
                                return (
                                  <>
                                    {parts[0]} <span className="text-white/60">ou</span> {parts[1]}
                                  </>
                                );
                              }
                              return addHintText;
                            })()}
                          </p>
                        </div>
                      </div>
                    </button>

                    <button type="button" onClick={onChooseSell} className={cardClassName}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                          <FundsCardBankIcon />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[18px] md:text-[19px] text-white font-semibold truncate">
                              {t('ui_funds_withdraw_title', 'Retirer vers un compte bancaire')}
                            </p>
                            <svg className="w-5 h-5 text-white/45" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M9 18L15 12L9 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <p className="mt-1 text-[15px] md:text-sm leading-snug text-xcannes-green/90">
                            {(() => {
                              const text = String(withdrawHintText || '');
                              const prefix = 'Vers votre ';
                              if (text.startsWith(prefix)) {
                                return (
                                  <>
                                    <span className="text-white/60">Vers votre </span>
                                    {highlightWithdraw(text.slice(prefix.length))}
                                  </>
                                );
                              }
                              return highlightWithdraw(withdrawHintText);
                            })()}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {sectionHeader(t('ui_funds_section_digital_dollars', 'Stablecoins en USD'))}

                    <button type="button" onClick={onChooseUsdSwapOut} className={cardClassName}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                          <FundsCardWalletIcon />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[18px] md:text-[19px] text-white font-semibold truncate">
                              {t('ui_funds_swap_out_title', 'Recevoir')}
                            </p>
                            <svg className="w-5 h-5 text-white/45" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M9 18L15 12L9 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <p className="mt-1 text-[15px] md:text-sm leading-snug text-white/60">
                            {String(swapOutHintText || '')
                              .split('\n')
                              .map((line, lineIdx, lines) => {
                                const text = String(line || '');
                                const highlightStablecoin = value => {
                                  const input = String(value || '');
                                  if (!input) return input;
                                  const parts = input.split(/(stablecoins?\s+USD)/i);
                                  return parts.map((part, idx) =>
                                    /^stablecoins?\s+usd$/i.test(part) || /USDC|USDT|RLUSD/i.test(part) ? (
                                      <span key={`${lineIdx}-${idx}-${part}`} className="text-xcannes-green/90">
                                        {part}
                                      </span>
                                    ) : (
                                      <span key={`${lineIdx}-${idx}-${part}`}>{part}</span>
                                    ),
                                  );
                                };
                                const openIdx = text.indexOf('(');
                                const closeIdx = text.lastIndexOf(')');
                                const hasParens = openIdx >= 0 && closeIdx > openIdx;
                                const before = hasParens ? text.slice(0, openIdx) : text;
                                const parens = hasParens ? text.slice(openIdx, closeIdx + 1) : '';
                                const after = hasParens ? text.slice(closeIdx + 1) : '';
                                return (
                                  <span key={`${lineIdx}-${text}`}>
                                    {highlightStablecoin(before)}
                                    {parens ? <span className="text-xcannes-green/90">{parens}</span> : null}
                                    {highlightStablecoin(after)}
                                    {lineIdx < lines.length - 1 ? <br /> : null}
                                  </span>
                                );
                              })}
                          </p>
                          <p className="mt-2 text-[12px] md:text-xs text-white/50">{swapOutSubhintText}</p>
                        </div>
                      </div>
                    </button>
                    <div className="mb-5" />

                    <button type="button" onClick={onChooseUsdSwapIn} className={cardClassName}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                          <FundsCardSendIcon />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[18px] md:text-[19px] text-white font-semibold truncate">
                              {t('ui_funds_swap_in_title', 'Envoyer')}
                            </p>
                            <svg className="w-5 h-5 text-white/45" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M9 18L15 12L9 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <p className="mt-1 text-[15px] md:text-sm leading-snug text-white/60">
                            {String(swapInHintText || '')
                              .split('\n')
                              .map((line, lineIdx, lines) => {
                                const input = String(line || '');
                                const parts = input.split(/(stablecoins?\s+USD|wallet)/i);
                                return (
                                  <span key={`${lineIdx}-${input}`}>
                                    {parts.map((part, idx) =>
                                      /^stablecoins?\s+usd$/i.test(part) || /^wallet$/i.test(part) ? (
                                        <span key={`${lineIdx}-${idx}-${part}`} className="text-xcannes-green/90">
                                          {part}
                                        </span>
                                      ) : (
                                        <span key={`${lineIdx}-${idx}-${part}`}>{part}</span>
                                      ),
                                    )}
                                    {lineIdx < lines.length - 1 ? <br /> : null}
                                  </span>
                                );
                              })}
                          </p>
                          <p className="mt-2 text-[12px] md:text-xs text-white/50">{swapInSubhintText}</p>
                        </div>
                      </div>
                    </button>
                    <div className="h-0.5" />

                    <p className="pt-3 px-2 w-full md:max-w-[520px] mx-auto text-center text-[11px] md:text-[12px] text-white/65 leading-snug">
                      {stablecoinLiquidityNote}
                    </p>
                  </div>
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
