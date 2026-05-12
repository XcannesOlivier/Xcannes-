import { useEffect, useRef } from 'react';
import { apiUrl } from '@/lib/runtimeConfig';
import xcannesApi from '@/lib/xcannesApi';
import { readMoonpayBuyResumeState, saveMoonpayBuyResumeState } from '../moonpayClientUtils';
import { normalizeMovementKind, resolveIncomingXrpAmount } from '../utils/movementUtils';

/**
 * Handles the two MoonPay Buy settlement effects:
 * 1. Auto-opens the cash modal when a resume state already has enough info.
 * 2. Polls the XRPL statement to detect an incoming XRP payment and
 *    prepares the inbound swap, then auto-opens the cash modal.
 */
export function useMoonpayBuySettlement({ wallet, isConnected, activeAction, setActiveAction, setCashModalTab }) {
  const moonpayBuyAutoOpenRef = useRef('');

  // Effect 1 — Auto-open when resume state is already complete
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isConnected || !wallet) return;
    if (window.self !== window.top) return;

    const resume = readMoonpayBuyResumeState(wallet);
    if (!resume) {
      moonpayBuyAutoOpenRef.current = '';
      return;
    }

    const shouldAutoOpen =
      !activeAction &&
      Number.isFinite(Number(resume.detectedXrpAmount)) &&
      Number(resume.detectedXrpAmount) > 0 &&
      resume.preparedInboundSwap?.txjson;
    if (!shouldAutoOpen) return;

    const resumeKey =
      String(resume.detectedXrpTxHash || '').trim() ||
      String(resume.flowId || '').trim() ||
      String(resume.ts || '').trim();
    if (!resumeKey || moonpayBuyAutoOpenRef.current === resumeKey) return;

    moonpayBuyAutoOpenRef.current = resumeKey;
    setCashModalTab('buy');
    setActiveAction('cash');
  }, [activeAction, isConnected, setActiveAction, setCashModalTab, wallet]);

  // Effect 2 — Poll XRPL statement to detect incoming XRP then prepare swap
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isConnected || !wallet) return;
    if (activeAction === 'cash') return;

    const resume = readMoonpayBuyResumeState(wallet);
    if (!resume) return;
    if (
      Number.isFinite(Number(resume.detectedXrpAmount)) &&
      Number(resume.detectedXrpAmount) > 0 &&
      resume.preparedInboundSwap?.txjson
    ) {
      return;
    }

    let cancelled = false;
    const seenMovementIdRef = { current: '' };

    const pollMoonpayBuySettlement = async () => {
      if (cancelled) return;
      const freshResume = readMoonpayBuyResumeState(wallet);
      if (!freshResume) return;
      if (
        Number.isFinite(Number(freshResume.detectedXrpAmount)) &&
        Number(freshResume.detectedXrpAmount) > 0 &&
        freshResume.preparedInboundSwap?.txjson
      ) {
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set('address', String(wallet || ''));
        params.set('limit', '10');
        params.set('source', 'onchain');
        const response = await fetch(apiUrl(`/wallet/statement?${params.toString()}`));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;

        const movements = Array.isArray(data?.movements) ? data.movements : [];
        const incomingXrp = movements.find(movement => {
          const kind = normalizeMovementKind(movement?.kind);
          if (kind !== 'PAYMENT_IN' && kind !== 'XRPL_PAYMENT_IN') return false;
          const currencyCode = String(
            movement?.toCurrencyCode || movement?.fromCurrencyCode || movement?.displayCurrency || '',
          )
            .trim()
            .toUpperCase();
          if (currencyCode !== 'XRP') return false;
          const movementId = String(movement?.movementId || movement?._id || movement?.txHash || '').trim();
          if (movementId && movementId === seenMovementIdRef.current) return false;
          const createdAtMs = movement?.createdAt ? new Date(movement.createdAt).getTime() : Number.NaN;
          const awaitingXrpSince = Number(freshResume.awaitingXrpSince);
          if (Number.isFinite(awaitingXrpSince) && Number.isFinite(createdAtMs) && createdAtMs < awaitingXrpSince) {
            return false;
          }
          return Number.isFinite(resolveIncomingXrpAmount(movement));
        });

        if (!incomingXrp) return;

        const movementId = String(incomingXrp?.movementId || incomingXrp?._id || incomingXrp?.txHash || '').trim();
        if (movementId) {
          seenMovementIdRef.current = movementId;
        }

        const detectedAmount = resolveIncomingXrpAmount(incomingXrp);
        if (!Number.isFinite(detectedAmount) || detectedAmount <= 0) return;

        const preparedInboundSwap = await xcannesApi.prepareRlusdXrpSwap({
          address: wallet,
          direction: 'XRP_TO_RLUSD',
          amountXrp: detectedAmount,
        });
        if (cancelled) return;

        const nextResume = {
          ...freshResume,
          detectedXrpAmount: detectedAmount,
          detectedXrpTxHash: String(incomingXrp?.txHash || '').trim(),
          preparedInboundSwap,
        };
        saveMoonpayBuyResumeState(nextResume);

        if (!activeAction && window.self === window.top) {
          const resumeKey =
            String(nextResume.detectedXrpTxHash || '').trim() ||
            String(nextResume.flowId || '').trim() ||
            String(Date.now());
          moonpayBuyAutoOpenRef.current = resumeKey;
          setCashModalTab('buy');
          setActiveAction('cash');
        }
      } catch {
        // ignore transient partner/XRPL errors; next poll retries
      }
    };

    pollMoonpayBuySettlement();
    const intervalId = window.setInterval(pollMoonpayBuySettlement, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeAction, isConnected, setActiveAction, setCashModalTab, wallet]);
}
