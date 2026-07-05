'use client';

import { createPortal } from 'react-dom';
import { useTranslation } from 'next-i18next';
import { useModalTransition } from '@/hooks/useModalTransition';
import { useEffect, useRef, useState } from 'react';
import { useModalDragToClose } from '../hooks/useModalDragToClose';
import useIsDesktop from '../hooks/useIsDesktop';

export default function WalletDashboardCashChoiceModal({
  open,
  onClose,
  onChooseBuy,
  onChooseSell,
  onChooseUsdSwapOut,
  onChooseUsdSwapIn,
  noticeVariant = 'preview',
  inline = false,
  walletLabel = '',
}) {
  const { t } = useTranslation('common');
  const isDesktop = useIsDesktop();
  const addHintText = t('ui_funds_add_hint', 'Par carte ou virement bancaire');
  const withdrawHintText = t('ui_funds_withdraw_hint', 'Vers votre compte bancaire');
  const highlightWithdraw = value => {
    const input = String(value || '');
    return input;
  };
  const swapOutHintText = t('ui_funds_swap_out_hint', 'Créditer votre compte XCannes');
  const swapOutSubhintText = t('ui_funds_swap_out_subhint', 'Ajoutés automatiquement à votre solde');
  const swapInHintText = t('ui_funds_swap_in_hint', 'Envoyer à vos comptes externes');
  const swapInSubhintText = t('ui_funds_swap_in_subhint', 'Conversion automatique si nécessaire');
  const stablecoinLiquidityNote = t(
    'ui_funds_stablecoin_liquidity_note',
    'Transactions optimisées via les stablecoins en USD et le réseau XRP.',
  );
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  const [animKey, setAnimKey] = useState(0);
  useEffect(() => { if (open) setAnimKey(k => k + 1); }, [open]);

  // ── Sparkle border animation ─────────────────────────────────
  const [sparkle, setSparkle] = useState(null);
  const sparkleTimerRef = useRef(null);
  useEffect(() => {
    if (!open) { setSparkle(null); return; }
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Card accent colors: [green, white, gold, gold-light]
    const COLORS = ['rgba(255,255,255,0.90)', 'rgba(255,255,255,0.90)', 'rgba(255,255,255,0.90)', 'rgba(255,255,255,0.90)'];
    let alive = true;

    const fire = () => {
      if (!alive) return;
      const cardIdx = Math.floor(Math.random() * 4);
      const edge = Math.floor(Math.random() * 4); // 0=top,1=right,2=bottom,3=left
      const pct = 12 + Math.random() * 76;
      const top = edge === 0 ? 0 : edge === 2 ? 100 : pct;
      const left = edge === 1 ? 100 : edge === 3 ? 0 : pct;
      const size = 3 + Math.random() * 2.5;
      setSparkle({ cardIdx, top, left, color: COLORS[cardIdx], size, key: Date.now() });
      setTimeout(() => { if (alive) setSparkle(null); }, 950);
      // Schedule next
      sparkleTimerRef.current = setTimeout(fire, 2200 + Math.random() * 2800);
    };

    // Wait for entrance animation to finish, then start
    sparkleTimerRef.current = setTimeout(fire, 1500 + Math.random() * 500);
    return () => {
      alive = false;
      clearTimeout(sparkleTimerRef.current);
      setSparkle(null);
    };
  }, [open]);

  const FundsCardAddIcon = () => (
    <svg viewBox="0 0 48 48" className="w-11 h-11" fill="none" aria-hidden>
      <rect
        x="6"
        y="14"
        width="32"
        height="22"
        rx="6"
        className="fill-xcannes-green/15 stroke-xcannes-green/45"
        strokeWidth="0.9"
      />
      <rect x="10" y="18" width="18" height="4" rx="2" className="fill-xcannes-green/35" />
      <rect x="10" y="26" width="12" height="3" rx="1.5" className="fill-xcannes-green/25" />
      <path d="M36 24v8m-4-4h8" className="stroke-xcannes-green" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );

  const FundsCardBankIcon = () => (
    <svg viewBox="0 0 48 48" className="w-11 h-11" fill="none" aria-hidden>
      <path
        d="M10 18l14-8 14 8"
        className="stroke-white/80"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 18h20" className="stroke-white/80" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M16 18v16m6-16v16m6-16v16m6-16v16" className="stroke-white/60" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M12 34h24" className="stroke-white/80" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M10 38h28" className="stroke-white/75" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );

  const FundsCardWalletIcon = () => (
    <svg viewBox="0 0 48 48" className="w-11 h-11" fill="none" aria-hidden>
      <path
        d="M14 18c0-2.2 1.8-4 4-4h16c2.2 0 4 1.8 4 4v16c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V18Z"
        className="fill-[#0870f8]/8 stroke-white/35"
        strokeWidth="0.9"
      />
      <path
        d="M14 20h20c2.2 0 4 1.8 4 4v0H28c-2.2 0-4 1.8-4 4v0H14"
        className="stroke-white/55"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M25 25h11m0 0-3-3m3 3-3 3"
        className="stroke-white/80"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36 31H25m0 0 3-3m-3 3 3 3"
        className="stroke-white/60"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const FundsCardSendIcon = () => (
    <svg viewBox="0 0 48 48" className="w-11 h-11" fill="none" aria-hidden>
      <path
        d="M10 22l28-12-10 28-6-10-12-6Z"
        className="fill-[#ff6a00]/8 stroke-white/45"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path d="M38 10L22 28" className="stroke-white/75" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M22 28l0 10" className="stroke-white/45" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );

  const sectionHeader = (label, animDelay) => (
    <div key={`sh-${label}-${animKey}`} className="cc-enter flex items-center gap-3 px-1" style={{ animationDelay: `${animDelay}ms` }}>
      <div className="text-[13px] tracking-[0.22em] text-white/45">{label}</div>
      <div className="h-px flex-1 bg-white/10" aria-hidden />
    </div>
  );

  // Sparkle dot — 4-branch star rendered as inline SVG
  const SparkleEl = ({ color, size }) => {
    const s = size * 4;
    return (
      <svg
        width={s} height={s} viewBox="0 0 24 24" fill="none"
        className="cc-sparkle absolute"
        style={{
          transform: 'translate(-50%, -50%)',
          filter: `blur(0.4px) drop-shadow(0 0 ${size * 1.5}px ${color})`,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        {/* 4-branch star */}
        <path d="M12 2L13.2 10.8L22 12L13.2 13.2L12 22L10.8 13.2L2 12L10.8 10.8Z" fill={color} />
      </svg>
    );
  };

  // Wrapper that overlays the sparkle on a card by index
  const CardSpark = ({ idx }) =>
    sparkle?.cardIdx === idx ? (
      <SparkleEl key={sparkle.key} color={sparkle.color} size={sparkle.size} />
    ) : null;

  // Match the "Convert" action button background (wallet-actions.css).
  const cardClassName =
    'w-full text-left rounded-[20px] px-4 py-4 bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.03] ring-1 ring-white/10 ring-inset shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]';

  const overlayListRef = useRef(null);

  const {
    dragging: overlayDragging,
    translateY: overlayTranslateY,
    overlayRef,
    closeRequestedRef,
    maybeStartDrag: maybeStartOverlayDrag,
    handlePointerMove: handleOverlayPointerMove,
    handlePointerEnd: handleOverlayPointerEnd,
  } = useModalDragToClose({
    open,
    inline,
    onClose,
    scrollContainerRef: overlayListRef,
  });

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
    'relative w-full wallet-modal-panel wallet-cash-modal wallet-modal-no-top-highlight-mobile border-white/10 md:border lg:border-0 overflow-hidden flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]',
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
                  <div key={`handle-${animKey}`} className="md:hidden flex justify-center pt-3 pb-0 cc-enter" style={{ animationDelay: '0ms' }} aria-hidden>
                    <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                  </div>
                ) : null}
		                <div className="pt-6 md:pt-[100px] pb-3 flex flex-col items-center text-center px-4">
                        <h3 key={`title-${animKey}`} className="mt-1 md:mt-0 text-[30px] md:text-[34px] font-light text-white tracking-tight cc-enter" style={{ animationDelay: '80ms' }}>
	                      {t('ui_funds_manage_title', 'Gérer vos fonds')}
	                    </h3>
                    {noticeVariant === 'demo' ? (
                      <span className="mt-2 inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-1 leading-none">
                        {t('demo_notice_title', 'Mode démo')}
                      </span>
                    ) : null}
                    <p key={`subtitle-${animKey}`} className="mt-2 text-[19px] md:text-[20px] font-light text-white/50 max-w-[34ch] leading-tight cc-enter" style={{ animationDelay: '160ms' }}>
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
			                    {sectionHeader(t('ui_funds_section_agent', 'Compte bancaire'), 240)}

                    <div className="relative">
                      <button key={`card1-${animKey}`} type="button" onClick={onChooseBuy} className={`cc-enter ${cardClassName}`} style={{ animationDelay: '330ms' }}>
                        <div className="flex items-center gap-3">
                          <div key={`icon1-${animKey}`} className="w-11 h-11 rounded-[16px] bg-transparent flex items-center justify-center flex-shrink-0 cc-enter" style={{ animationDelay: '380ms' }}>
                            <FundsCardAddIcon />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p key={`label1-${animKey}`} className="text-[20px] md:text-[21px] text-white font-light truncate cc-enter" style={{ animationDelay: '400ms' }}>
                                {t('ui_funds_increase_balances_title', 'Ajouter des fonds')}
                              </p>
                              <svg key={`chev1-${animKey}`} className="w-5 h-5 text-white/45 cc-enter" style={{ animationDelay: '460ms' }} viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                            <p className="mt-1 text-[15px] md:text-sm leading-snug text-white/45 flex items-center gap-1.5">
                              <span>{t('ui_funds_add_hint_account', 'À votre compte')}</span>
                              <span className="h-2.5 w-2.5 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0 wallet-dot-active" aria-hidden />
                              <span className="text-white font-light">{walletLabel || 'XCANNES'}</span>
                            </p>
                          </div>
                        </div>
                      </button>
                      {sparkle?.cardIdx === 0 ? (
                        <div key={sparkle.key} className="pointer-events-none absolute z-10" style={{ top: `${sparkle.top}%`, left: `${sparkle.left}%` }}>
                          <SparkleEl color={sparkle.color} size={sparkle.size} />
                        </div>
                      ) : null}
                    </div>
                    <div className="mb-5" />

                    <div className="relative">
                      <button key={`card2-${animKey}`} type="button" onClick={onChooseSell} className={`cc-enter ${cardClassName}`} style={{ animationDelay: '430ms' }}>
                        <div className="flex items-center gap-3">
                          <div key={`icon2-${animKey}`} className="w-11 h-11 rounded-[16px] bg-transparent flex items-center justify-center flex-shrink-0 cc-enter" style={{ animationDelay: '480ms' }}>
                            <FundsCardBankIcon />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p key={`label2-${animKey}`} className="text-[20px] md:text-[21px] text-white font-light truncate cc-enter" style={{ animationDelay: '500ms' }}>
                                {isDesktop
                                  ? t('ui_funds_withdraw_title', 'Transférer vers la banque')
                                  : t('ui_funds_withdraw_title_mobile', 'Transférer vers la banque')}
                              </p>
                              <svg key={`chev2-${animKey}`} className="w-5 h-5 text-white/45 cc-enter" style={{ animationDelay: '560ms' }} viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                            <p className="mt-1 text-[15px] md:text-sm leading-snug text-white/50">
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
                      {sparkle?.cardIdx === 1 ? (
                        <div key={sparkle.key} className="pointer-events-none absolute z-10" style={{ top: `${sparkle.top}%`, left: `${sparkle.left}%` }}>
                          <SparkleEl color={sparkle.color} size={sparkle.size} />
                        </div>
                      ) : null}
                    </div>
			                  </div>

			                  <div>
			                    <div className="space-y-4">
			                      {sectionHeader(t('ui_funds_section_digital_dollars', 'Stablecoins en USD'), 620)}

                    <div className="relative">
                      <button key={`card3-${animKey}`} type="button" onClick={onChooseUsdSwapOut} className={`cc-enter ${cardClassName}`} style={{ animationDelay: '700ms' }}>
                        <div className="flex items-center gap-3">
                          <div key={`icon3-${animKey}`} className="w-11 h-11 rounded-[16px] bg-transparent flex items-center justify-center flex-shrink-0 cc-enter" style={{ animationDelay: '750ms' }}>
                            <FundsCardWalletIcon />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p key={`label3-${animKey}`} className="text-[20px] md:text-[21px] text-white font-light truncate cc-enter" style={{ animationDelay: '770ms' }}>
                                {t('ui_funds_swap_out_title', 'Vendre vos stablecoins')}
                              </p>
                              <svg key={`chev3-${animKey}`} className="w-5 h-5 text-white/45 cc-enter" style={{ animationDelay: '830ms' }} viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                            <p className="mt-1 text-[15px] md:text-sm leading-snug text-white/50">
                              {String(swapOutHintText || '')
                                .split('\n')
                                .map((line, lineIdx, lines) => {
                                  const text = String(line || '');
                                  const renderSwapOutHint = (value) => {
                                    const input = String(value || "");
                                    if (!input) return input;
                                    const brandParts = input.split(/(xcannes)/i);
                                    return brandParts.flatMap((brandPart, brandIdx) => {
                                      if (/^xcannes$/i.test(brandPart)) {
                                        return (<span key={`${lineIdx}-brand-${brandIdx}`} className="uppercase text-[0.9em]">XCANNES</span>);
                                      }
                                      const parts = String(brandPart || "").split(/(stablecoins?\s+USD)/i);
                                      return parts.map((part, idx) =>
                                        /^stablecoins?\s+usd$/i.test(part) || /USDC|USDT|RLUSD/i.test(part) ? (
                                          <span key={`${lineIdx}-${brandIdx}-${idx}-${part}`} className="text-xcannes-green/90">{part}</span>
                                        ) : (
                                          <span key={`${lineIdx}-${brandIdx}-${idx}-${part}`}>{part}</span>
                                        ),
                                      );
                                    });
                                  };
                                  const openIdx = text.indexOf('(');
                                  const closeIdx = text.lastIndexOf(')');
                                  const hasParens = openIdx >= 0 && closeIdx > openIdx;
                                  const before = hasParens ? text.slice(0, openIdx) : text;
                                  const parens = hasParens ? text.slice(openIdx, closeIdx + 1) : '';
                                  const after = hasParens ? text.slice(closeIdx + 1) : '';
                                  return (
                                    <span key={`${lineIdx}-${text}`}>
                                      {renderSwapOutHint(before)}
                                      {parens ? <span className="text-xcannes-green/90">{parens}</span> : null}
                                      {renderSwapOutHint(after)}
                                      {lineIdx < lines.length - 1 ? <br /> : null}
                                    </span>
                                  );
                                })}
                            </p>
                          </div>
                        </div>
                      </button>
                      {sparkle?.cardIdx === 2 ? (
                        <div key={sparkle.key} className="pointer-events-none absolute z-10" style={{ top: `${sparkle.top}%`, left: `${sparkle.left}%` }}>
                          <SparkleEl color={sparkle.color} size={sparkle.size} />
                        </div>
                      ) : null}
                    </div>
                    <div className="mb-5" />

                    <div className="relative">
                      <button key={`card4-${animKey}`} type="button" onClick={onChooseUsdSwapIn} className={`cc-enter ${cardClassName}`} style={{ animationDelay: '800ms' }}>
                        <div className="flex items-center gap-3">
                          <div key={`icon4-${animKey}`} className="w-11 h-11 rounded-[16px] bg-transparent flex items-center justify-center flex-shrink-0 cc-enter" style={{ animationDelay: '850ms' }}>
                            <FundsCardSendIcon />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p key={`label4-${animKey}`} className="text-[20px] md:text-[21px] text-white font-light truncate cc-enter" style={{ animationDelay: '870ms' }}>
                                {t('ui_funds_swap_in_title', 'Acheter des stablecoins')}
                              </p>
                              <svg key={`chev4-${animKey}`} className="w-5 h-5 text-white/45 cc-enter" style={{ animationDelay: '930ms' }} viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                            <p className="mt-1 text-[15px] md:text-sm leading-snug text-white/50">
                              {String(swapInHintText || '')
                                .split('\n')
                                .map((line, lineIdx, lines) => {
                                  const input = String(line || '');
                                  const parts = input.split(/(stablecoins?\s+USD|wallet)/i);
                                  return (
                                    <span key={`${lineIdx}-${input}`}>
                                      {parts.map((part, idx) =>
                                        /^stablecoins?\s+usd$/i.test(part) || /^wallet$/i.test(part) ? (
                                          <span key={`${lineIdx}-${idx}-${part}`} className="text-xcannes-green/90">{part}</span>
                                        ) : (
                                          <span key={`${lineIdx}-${idx}-${part}`}>{part}</span>
                                        ),
                                      )}
                                      {lineIdx < lines.length - 1 ? <br /> : null}
                                    </span>
                                  );
                                })}
                            </p>
                          </div>
                        </div>
                      </button>
                      {sparkle?.cardIdx === 3 ? (
                        <div key={sparkle.key} className="pointer-events-none absolute z-10" style={{ top: `${sparkle.top}%`, left: `${sparkle.left}%` }}>
                          <SparkleEl color={sparkle.color} size={sparkle.size} />
                        </div>
                      ) : null}
                    </div>
		                    </div>

		                    {/* Liquidity note: 14px gap on mobile */}
		                    <div key={`note-${animKey}`} className="mt-[14px] md:mt-4 cc-enter" style={{ animationDelay: '980ms' }}>
		                      <p className="px-2 w-full md:max-w-[520px] mx-auto text-center text-[12px] md:text-[13px] font-light text-white/65 leading-snug">
		                        {stablecoinLiquidityNote}
		                      </p>
		                    </div>
		                  </div>
		                </div>
              </div>
            </div>
            {/* Bottom bar – desktop only (visual balance) */}
            <div className="hidden md:flex pointer-events-none justify-center pt-2 pb-4" aria-hidden>
              <span className="block w-[120px] h-[4px] rounded-full bg-white/30" />
            </div>
            {/* Bottom bar – mobile only */}
            {!inline ? (
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
