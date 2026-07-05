import { useCallback, useMemo, useState } from 'react';
import { apiUrl } from '@/lib/runtimeConfig';
import { returnToMoonpaySellWidget } from '../moonpayClientUtils';

const INITIAL_TX_PROGRESS = {
  visible: false,
  status: 'pending',
  actionLabel: '',
  actionKey: '',
  errorMessage: '',
  details: null,
};

export function useTransactionProgress({ signTransaction, t, setActiveAction }) {
  const [txProgress, setTxProgress] = useState(INITIAL_TX_PROGRESS);

  const TX_ACTION_LABELS = useMemo(
    () => ({
      'wallet:convert': t('ui_tx_label_conversion', 'Conversion'),
      'wallet:swap': t('ui_tx_label_swap', 'Swap XRPL'),
      'wallet:send': t('ui_tx_label_payment', 'Paiement'),
      'moonpay:sell': t('ui_tx_label_moonpay_sell', 'Envoi MoonPay'),
      'wallet:reconcile': t('ui_tx_label_reconciliation', 'Réconciliation'),
      'wallet:activate_xrp': t('ui_tx_label_activation', 'Activation'),
      'wallet:setup': t('ui_tx_label_setup', 'Configuration'),
    }),
    [t],
  );

  const handleTxProgressClose = useCallback(() => {
    let shouldCloseAction = false;
    let shouldReturnToMoonpay = false;
    let moonpayReturnUrl = '';

    setTxProgress(prev => {
      if (prev.status === 'success') {
        shouldCloseAction =
          prev.actionKey === 'wallet:convert' ||
          prev.actionKey === 'wallet:send' ||
          prev.actionKey === 'moonpay:sell';
        shouldReturnToMoonpay = prev.actionKey === 'moonpay:sell';
        moonpayReturnUrl = String(prev.details?.moonpayReturnUrl || '').trim();
      }
      return { ...prev, visible: false };
    });
    if (shouldCloseAction) {
      setActiveAction(null);
    }
    if (shouldReturnToMoonpay) {
      returnToMoonpaySellWidget(moonpayReturnUrl);
    }
  }, [setActiveAction]);

  /**
   * Poll XRPL tx-status endpoint until the transaction is validated
   * on-ledger, or give up after ~12 s.
   */
  const waitForTxValidation = useCallback(async hash => {
    const MAX_POLLS = 12;
    const INTERVAL = 1000; // 1 s
    for (let i = 0; i < MAX_POLLS; i++) {
      try {
        const res = await fetch(apiUrl(`/wallet/tx-status?hash=${encodeURIComponent(hash)}`));
        if (res.ok) {
          const data = await res.json();
          if (data.validated) return true;
        }
      } catch {
        /* network hiccup — keep polling */
      }
      await new Promise(r => setTimeout(r, INTERVAL));
    }
    return false; // timeout — show success anyway (tesSUCCESS was received)
  }, []);

  /**
   * Wrapper around signTransaction — Xumm-style progress overlay
   * AFTER Face ID validation (post-sign). Flow:
   *   1. signTransaction() → QR → Face ID → XRPL submit (no modal yet)
   *   2. signed:true → show "pending" with 3 blinking dots
   *   3. poll XRPL for validated:true on the tx hash (non-blocking)
   *   4. validated → "Validé" + confetti
   *
   * IMPORTANT: polling runs in background — does NOT block the return.
   * Each hook's post-sign logic (toast, form reset, refreshBalance) runs immediately.
   */
  const signTransactionWithProgress = useCallback(
    async (txjson, options) => {
      const actionKey = options?.action || '';
      const label = TX_ACTION_LABELS[actionKey] || t('ui_tx_label_default', 'Transaction');

      try {
        const result = await signTransaction(txjson, options);
        const txHash = result?.hash || '';

        if (result?.signed) {
          setTxProgress({
            visible: true,
            status: 'pending',
            actionLabel: label,
            actionKey: actionKey,
            errorMessage: '',
            details: {
              ...(options?.progressDetails || {}),
              txHash: txHash || null,
            },
          });

          (async () => {
            if (txHash) {
              await waitForTxValidation(txHash);
            }
            setTxProgress(prev => (prev.visible ? { ...prev, status: 'success' } : prev));
          })();
        } else if (result?.rejected) {
          setTxProgress({
            visible: true,
            status: 'error',
            actionLabel: label,
            actionKey: actionKey,
            errorMessage: result.engineMessage || result.engineResult || t('ui_tx_rejected', 'Transaction rejetée'),
            details: options?.progressDetails || null,
          });
        }

        return result;
      } catch (err) {
        setTxProgress({
          visible: true,
          status: 'error',
          actionLabel: label,
          actionKey: actionKey,
          errorMessage: err?.message || String(err),
          details: options?.progressDetails || null,
        });
        throw err;
      }
    },
    [signTransaction, TX_ACTION_LABELS, t, waitForTxValidation],
  );

  return {
    txProgress,
    setTxProgress,
    TX_ACTION_LABELS,
    signTransactionWithProgress,
    handleTxProgressClose,
  };
}
