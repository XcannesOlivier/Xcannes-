import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWalletRecentActivityBanner } from './useWalletRecentActivityBanner';

const RECENT_ACTIVITY_CACHE_VERSION = 1;
const RECENT_ACTIVITY_CACHE_MAX_STALE_MS = 24 * 60 * 60 * 1000; // 24h

function recentActivityCacheKey(address) {
  const addr = String(address || '').trim();
  return addr ? `xcannes_wallet_recent_activity:${addr}` : '';
}

/**
 * Encapsulates all "recent activity banner" state, effects and derived values.
 *
 * Handles:
 * - State: message, kind, movement, createdAt, summaryOpen, tooltipOpen, highlightTxId
 * - Effects: reset on wallet change, click-outside tooltip
 * - External hook: useWalletRecentActivityBanner
 * - Derived memos: when, messageParts, receiveParts, sendParts, icon, label
 */
export function useActivityBanner({ backendWalletAddress, rlusdPerUnitRates, savedAddresses, locale, t }) {
  const [recentActivityMessage, setRecentActivityMessage] = useState('');
  const [recentActivityCreatedAt, setRecentActivityCreatedAt] = useState('');
  const [recentActivityKind, setRecentActivityKind] = useState('');
  const [recentActivityMovement, setRecentActivityMovement] = useState(null);
  const [highlightTransactionId, setHighlightTransactionId] = useState(null);
  const [recentSummaryOpen, setRecentSummaryOpen] = useState(false);
  const [activityTooltipOpen, setActivityTooltipOpen] = useState(false);
  const activityTooltipTriggerRef = useRef(null);

  // Reset all banner state when the connected wallet changes
  useEffect(() => {
    setRecentActivityMessage('');
    setRecentActivityCreatedAt('');
    setRecentActivityKind('');
    setRecentActivityMovement(null);
    setHighlightTransactionId(null);
    setRecentSummaryOpen(false);
    setActivityTooltipOpen(false);
  }, [backendWalletAddress]);

  // SWR hydration: show last known activity immediately from localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!backendWalletAddress) return;
    try {
      const key = recentActivityCacheKey(backendWalletAddress);
      if (!key) return;
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== RECENT_ACTIVITY_CACHE_VERSION) return;
      const ageMs = Date.now() - Number(parsed.ts || 0);
      if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > RECENT_ACTIVITY_CACHE_MAX_STALE_MS) return;

      const message = String(parsed.message || '').trim();
      if (!message) return;
      setRecentActivityMessage(message);
      setRecentActivityCreatedAt(String(parsed.createdAt || '').trim());
      setRecentActivityKind(String(parsed.kind || '').trim());
      setRecentActivityMovement(parsed.movement || null);
    } catch {
      // ignore cache hydration errors
    }
  }, [backendWalletAddress]);

  // Close tooltip on click / touch outside the trigger element
  useEffect(() => {
    if (!activityTooltipOpen) return;

    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target) return;
      if (activityTooltipTriggerRef.current && activityTooltipTriggerRef.current.contains(target)) return;
      setActivityTooltipOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [activityTooltipOpen]);

  const flashRecentActivity = useCallback((message, movement) => {
    const text = String(message || '').trim();
    if (!text) return;
    setRecentActivityMessage(text);
    setRecentActivityCreatedAt(String(movement?.createdAt || '').trim());
    setRecentActivityKind(String(movement?.kind || '').trim());
    setRecentActivityMovement(movement || null);

    try {
      if (typeof window === 'undefined' || !backendWalletAddress) return;
      const key = recentActivityCacheKey(backendWalletAddress);
      if (!key) return;
      window.localStorage.setItem(
        key,
        JSON.stringify({
          v: RECENT_ACTIVITY_CACHE_VERSION,
          ts: Date.now(),
          message: text,
          createdAt: String(movement?.createdAt || '').trim(),
          kind: String(movement?.kind || '').trim(),
          movement: movement || null,
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [backendWalletAddress]);

  useWalletRecentActivityBanner({
    backendWalletAddress,
    rlusdPerUnitRates,
    savedAddresses,
    onActivity: ({ movement, message }) => flashRecentActivity(message, movement),
  });

  // ── Derived values ──────────────────────────────────────────

  const recentActivityWhen = useMemo(() => {
    const raw = String(recentActivityCreatedAt || '').trim();
    if (!raw) return { mobile: '', desktop: '' };
    const parsed = new Date(raw);
    if (!Number.isFinite(parsed.getTime())) return { mobile: '', desktop: '' };

    const dateLocale = String(locale || '').toLowerCase().startsWith('fr') ? 'fr-FR' : locale;

    const date = new Intl.DateTimeFormat(dateLocale, {
      day: 'numeric',
      month: 'short',
    }).format(parsed);
    const time = new Intl.DateTimeFormat(dateLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parsed);

    return { label: `${date} • ${time}`, date, time };
  }, [locale, recentActivityCreatedAt]);

  const recentActivityMessageParts = useMemo(() => {
    const text = String(recentActivityMessage || '').trim();
    if (!text) return { isConversion: false, text: '' };
    const match = text.match(/^(.*?)(?:\s*)(→|->)(?:\s*)(.+)$/);
    if (!match) return { isConversion: false, text };
    return {
      isConversion: true,
      left: match[1].trim(),
      arrow: match[2] === '->' ? '→' : match[2],
      right: match[3].trim(),
    };
  }, [recentActivityMessage]);

  const recentActivityReceiveParts = useMemo(() => {
    const text = String(recentActivityMessage || '').trim();
    if (!text) return null;
    const match = text.match(/^Vous avez reçu\s+([0-9][0-9\s.,]*?)\s+([A-Z0-9]{2,10})(.*)$/i);
    if (!match) return null;
    return {
      prefix: 'Vous avez reçu',
      amount: match[1].trim(),
      currency: match[2].trim(),
      suffix: String(match[3] || ''),
    };
  }, [recentActivityMessage]);

  const recentActivitySendParts = useMemo(() => {
    const text = String(recentActivityMessage || '').trim();
    if (!text) return null;
    const match = text.match(/^Vous avez envoyé\s+([0-9][0-9\s.,]*?)\s+([A-Z0-9]{2,10})(.*)$/i);
    if (!match) return null;
    return {
      prefix: 'Vous avez envoyé',
      amount: match[1].trim(),
      currency: match[2].trim(),
      suffix: String(match[3] || ''),
    };
  }, [recentActivityMessage]);

  const recentActivityIcon = useMemo(() => {
    const kind = String(recentActivityKind || '').trim().toUpperCase();
    if (kind === 'CONVERSION') return 'convert';
    if (kind === 'PAYMENT_IN' || kind === 'XRPL_PAYMENT_IN') return 'receive';
    if (kind === 'PAYMENT_OUT' || kind === 'XRPL_PAYMENT_OUT') return 'send';
    return null;
  }, [recentActivityKind]);

  const recentActivityLabel =
    recentActivityIcon === 'convert'
      ? t('ui_recent_conversion_banner', 'Conversion récente')
      : recentActivityIcon === 'receive'
        ? t('ui_recent_receive_banner', 'Réception récente')
        : recentActivityIcon === 'send'
          ? t('ui_recent_send_banner', 'Envoi récent')
          : t('ui_recent_activity_banner', 'Activité récente');

  return {
    recentActivityMessage,
    recentActivityMovement,
    recentSummaryOpen,
    setRecentSummaryOpen,
    activityTooltipOpen,
    setActivityTooltipOpen,
    activityTooltipTriggerRef,
    highlightTransactionId,
    setHighlightTransactionId,
    flashRecentActivity,
    recentActivityWhen,
    recentActivityMessageParts,
    recentActivityReceiveParts,
    recentActivitySendParts,
    recentActivityIcon,
    recentActivityLabel,
  };
}
