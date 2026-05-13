import { WALLET_ACCEPTED_TOKENS } from '../walletDashboardConfig';

export function isAcceptedOnChainToken(currency) {
  const code = String(currency || '').toUpperCase();
  return WALLET_ACCEPTED_TOKENS.has(code);
}

export function normalizeMovementKind(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

export function resolveIncomingXrpAmount(movement) {
  const displayAmount = Number(movement?.displayAmount);
  if (Number.isFinite(displayAmount) && displayAmount > 0) return displayAmount;
  const amountXrp = Number(movement?.amountXrp);
  if (Number.isFinite(amountXrp) && amountXrp > 0) return amountXrp;
  const amount = Number(movement?.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  const amountRlusd = Number(movement?.amountRlusd);
  const fxRate = Number(movement?.fxRate);
  if (Number.isFinite(amountRlusd) && amountRlusd > 0 && Number.isFinite(fxRate) && fxRate > 0) {
    return amountRlusd / fxRate;
  }
  return Number.NaN;
}

/**
 * Trouve dans une liste de mouvements le premier paiement XRP entrant
 * qui n'a pas encore été vu (seenMovementId) et qui est postérieur à awaitingXrpSince.
 *
 * @param {Array} movements
 * @param {{ awaitingXrpSince?: number, seenMovementId?: string }} options
 * @returns {object|undefined}
 */
export function findIncomingXrpMovement(movements, { awaitingXrpSince, seenMovementId } = {}) {
  const list = Array.isArray(movements) ? movements : [];
  return list.find(movement => {
    const kind = normalizeMovementKind(movement?.kind);
    if (kind !== 'PAYMENT_IN' && kind !== 'XRPL_PAYMENT_IN') return false;
    const currencyCode = String(
      movement?.toCurrencyCode || movement?.fromCurrencyCode || movement?.displayCurrency || '',
    )
      .trim()
      .toUpperCase();
    if (currencyCode !== 'XRP') return false;
    const movementId = String(movement?.movementId || movement?._id || movement?.txHash || '').trim();
    if (movementId && movementId === seenMovementId) return false;
    const createdAtMs = movement?.createdAt ? new Date(movement.createdAt).getTime() : Number.NaN;
    if (
      Number.isFinite(awaitingXrpSince) &&
      Number.isFinite(createdAtMs) &&
      createdAtMs < awaitingXrpSince
    ) {
      return false;
    }
    return Number.isFinite(resolveIncomingXrpAmount(movement));
  });
}

export function isVisibleMovement(movement) {
  const kind = normalizeMovementKind(movement?.kind);
  if (!kind) return false;
  if (
    kind === 'ALLOCATE' ||
    kind.startsWith('ALLOCATE_') ||
    kind === 'DEALLOCATE' ||
    kind.startsWith('DEALLOCATE_')
  ) {
    return false;
  }
  if (kind === 'XRPL_TRUSTLINE_ADD' || kind === 'XRPL_TRUSTLINE_REMOVE') {
    return false;
  }
  if (kind === 'WALLET_LABEL') return false;
  return true;
}

export function sortMovementsDesc(list) {
  const sorted = Array.isArray(list) ? list.slice() : [];
  sorted.sort((a, b) => {
    const leftDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const rightDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (leftDate !== rightDate) return rightDate - leftDate;
    const left = Number.isFinite(Number(a?.ledgerIndex)) ? Number(a.ledgerIndex) : -Infinity;
    const right = Number.isFinite(Number(b?.ledgerIndex)) ? Number(b.ledgerIndex) : -Infinity;
    if (left !== right) return right - left;
    return String(b?.txHash || '').localeCompare(String(a?.txHash || ''));
  });
  return sorted;
}
