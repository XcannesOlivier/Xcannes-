const WALLET_SESSION_TOKEN_KEY = "xcannes_wallet_session_token";

export function getWalletSessionToken() {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(WALLET_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getWalletSessionHeaders() {
  const token = getWalletSessionToken();
  if (!token) return {};
  return { "x-wallet-session": token };
}
