'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Default swipe-to-close thresholds.
 * Previously scattered (and inconsistent) across 3 modal files.
 */
const DRAG_CONFIG = {
  minDistance: 220,
  maxDistance: 320,
  heightRatio: 0.28,
  velocityThreshold: 1.25,
  closedFraction: 0.6,   // velocity check kicks in at this fraction of closeDistance
  activationThreshold: 8, // px of movement before drag is "active"
};

const RESET_META = Object.freeze({
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

/**
 * useModalDragToClose — swipe-down-to-close for bottom-sheet modals.
 *
 * @param {object}               opts
 * @param {boolean}              opts.open               modal open state
 * @param {boolean}              opts.inline             in-panel mode (drag disabled)
 * @param {function}             opts.onClose            callback to close the modal
 * @param {React.RefObject}      opts.scrollContainerRef ref to the inner scrollable list
 * @param {object}              [opts.config]            override DRAG_CONFIG entries
 * @param {function}            [opts.extraGuard]        () => boolean — skip drag when true (e.g. () => scanActive)
 * @param {boolean}             [opts.blockButtons]      also block drags starting on <button>
 *
 * @returns {{ dragging, translateY, overlayRef, closeRequestedRef, maybeStartDrag, handlePointerMove, handlePointerEnd }}
 */
export function useModalDragToClose({
  open,
  inline,
  onClose,
  scrollContainerRef,
  config: configOverride,
  extraGuard,
  blockButtons = false,
}) {
  const cfg = { ...DRAG_CONFIG, ...configOverride };

  const [dragging, setDragging] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const overlayRef = useRef(null);
  const metaRef = useRef({ ...RESET_META });
  const closeRequestedRef = useRef(false);

  // Reset drag state on open/close transition
  useEffect(() => {
    if (open) {
      closeRequestedRef.current = false;
      setDragging(false);
      setTranslateY(0);
      metaRef.current = { ...RESET_META };
      return;
    }
    try {
      const listEl = scrollContainerRef?.current;
      const meta = metaRef.current;
      if (listEl && meta?.scrollLocked) listEl.style.overflowY = meta.lockedOverflowY;
    } catch { /* ignore */ }
    setDragging(false);
    if (!closeRequestedRef.current) setTranslateY(0);
    metaRef.current = { ...RESET_META };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const releaseScrollLock = () => {
    const meta = metaRef.current;
    if (meta?.source !== 'list') return;
    if (!meta?.scrollLocked) return;
    const listEl = scrollContainerRef?.current;
    if (!listEl) return;
    try { listEl.style.overflowY = meta.lockedOverflowY; } catch { /* ignore */ }
    meta.scrollLocked = false;
    meta.lockedOverflowY = '';
  };

  const maybeStartDrag = (event, source) => {
    if (inline) return false;
    if (extraGuard?.()) return false;
    if (!event?.isPrimary) return false;
    if (event.pointerType === 'mouse') return false;
    const selector = blockButtons
      ? 'input,textarea,select,button'
      : 'input,textarea,select';
    if (event.target?.closest?.(selector)) return false;
    if (source === 'list') {
      const listEl = scrollContainerRef?.current;
      if (!listEl || listEl.scrollTop > 0) return false;
    }
    metaRef.current = {
      ...RESET_META,
      startY: event.clientY,
      startAt: Date.now(),
      pointerId: event.pointerId,
      pending: true,
      source,
    };
    return true;
  };

  const handlePointerMove = (event) => {
    if (inline) return;
    if (extraGuard?.()) return;
    const meta = metaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;
    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;
    if (!meta.dragging) {
      if (delta < cfg.activationThreshold) return;
      try { overlayRef.current?.setPointerCapture?.(event.pointerId); } catch { /* ignore */ }
      if (meta.source === 'list') {
        const listEl = scrollContainerRef?.current;
        if (listEl && listEl.scrollTop <= 0) {
          try {
            meta.lockedOverflowY = listEl.style.overflowY;
            meta.scrollLocked = true;
            listEl.style.overflowY = 'hidden';
            listEl.scrollTop = 0;
          } catch { /* ignore */ }
        }
      }
      meta.dragging = true;
      setDragging(true);
    }
    meta.lastDelta = delta;
    setTranslateY(delta);
  };

  const handlePointerEnd = (event) => {
    if (inline) return;
    const meta = metaRef.current;
    if (meta.pointerId !== event.pointerId) return;
    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration; // px/ms
    const height = typeof window !== 'undefined' ? window.innerHeight : 800;
    const closeDistance = Math.max(cfg.minDistance, Math.min(cfg.maxDistance, height * cfg.heightRatio));
    const shouldClose =
      delta > closeDistance ||
      (delta > closeDistance * cfg.closedFraction && velocity > cfg.velocityThreshold);
    metaRef.current.pending = false;
    metaRef.current.dragging = false;
    setDragging(false);
    releaseScrollLock();
    if (shouldClose) {
      if (!closeRequestedRef.current) {
        closeRequestedRef.current = true;
        setTranslateY(Math.max(delta, height));
        window.setTimeout(() => { onClose?.(); }, 180);
      }
      return;
    }
    setTranslateY(0);
    metaRef.current = { ...RESET_META };
  };

  return {
    dragging,
    translateY,
    overlayRef,
    closeRequestedRef,
    maybeStartDrag,
    handlePointerMove,
    handlePointerEnd,
  };
}
