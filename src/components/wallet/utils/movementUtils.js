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
