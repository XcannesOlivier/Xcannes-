// Utilitaires client MoonPay — sell-flow & buy-resume
// Extraits de WalletDashboard pour alléger le composant principal.

export const MOONPAY_ORIGIN_SUFFIX = '.moonpay.com';
export const MOONPAY_ACTIVE_STORAGE_KEY = 'xcannes_moonpay_active';
export const MOONPAY_BUY_RESUME_KEY = 'xcannes_moonpay_resume_buy_v1';
export const MOONPAY_SELL_RESUME_KEY = 'xcannes_moonpay_resume_sell_v1';
export const MOONPAY_AUTOOPEN_TAB_KEY = 'xcannes_moonpay_autoopen_tab';
export const MOONPAY_SELL_FLOW_KEY = 'xcannes_moonpay_sell_flow_v1';
export const MOONPAY_SELL_SOURCE_KEY = 'xcannes_moonpay_sell_source_v1';
export const MOONPAY_WALLET_ADDRESS_KEY = 'xcannes_moonpay_wallet_address_v1';
export const MOONPAY_BUY_RESUME_MAX_AGE_MS = 5 * 60 * 1000;

export function readMoonpayBuyResumeState(walletAddress) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage?.getItem(MOONPAY_BUY_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || parsed.kind !== 'buy') return null;
    if (!parsed.awaitingXrpSwap) return null;
    if (String(parsed.walletAddress || '') !== String(walletAddress || '')) return null;
    const ageMs = Date.now() - Number(parsed.ts || 0);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MOONPAY_BUY_RESUME_MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveMoonpayBuyResumeState(nextState) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.setItem(
      MOONPAY_BUY_RESUME_KEY,
      JSON.stringify({ ...nextState, v: 1, kind: 'buy', ts: Date.now() }),
    );
  } catch {
    // ignore
  }
}

export function isTrustedMoonpayUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = String(url.hostname || '').toLowerCase();
    return host === 'moonpay.com' || host.endsWith(MOONPAY_ORIGIN_SUFFIX);
  } catch {
    return false;
  }
}

export function clearMoonpaySellClientState() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.removeItem(MOONPAY_ACTIVE_STORAGE_KEY);
    window.sessionStorage?.removeItem(MOONPAY_AUTOOPEN_TAB_KEY);
    window.sessionStorage?.removeItem(MOONPAY_SELL_RESUME_KEY);
    window.sessionStorage?.removeItem(MOONPAY_SELL_FLOW_KEY);
    window.localStorage?.removeItem(MOONPAY_SELL_SOURCE_KEY);
    window.localStorage?.removeItem(MOONPAY_WALLET_ADDRESS_KEY);
    window.__XCANNES_MOONPAY_ACTIVE__ = false;
    window.dispatchEvent(new CustomEvent('xcannes:moonpay-active', { detail: { active: false } }));
  } catch {
    // ignore
  }
}

export function returnToMoonpaySellWidget(returnUrl) {
  if (typeof window === 'undefined') return;
  clearMoonpaySellClientState();
  if (isTrustedMoonpayUrl(returnUrl)) {
    window.location.href = returnUrl;
    return;
  }
  if (window.history.length > 1) {
    window.history.back();
  }
}
