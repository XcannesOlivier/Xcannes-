/**
 * moonpayShared.js — Constantes et helpers partagés entre MoonPayBuyModal et MoonPaySellModal.
 *
 * ⚠️  `isTrustedMoonPayOrigin` est une fonction de sécurité critique :
 *     source unique de vérité pour la validation d'origine iframe MoonPay.
 */

// ── Flags ────────────────────────────────────────────────────────────────────
export const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

// ── Clés localStorage / sessionStorage ───────────────────────────────────────
export const MOONPAY_ORIGIN_SUFFIX = ".moonpay.com";
export const MOONPAY_ACTIVE_STORAGE_KEY = "xcannes_moonpay_active";
export const MOONPAY_AUTOOPEN_TAB_KEY = "xcannes_moonpay_autoopen_tab";
export const MOONPAY_WALLET_ADDRESS_KEY = "xcannes_moonpay_wallet_address_v1";
export const MOONPAY_RESUME_MAX_AGE_MS = 5 * 60 * 1000;
export const MOONPAY_FLOW_MAX_AGE_MS = 8 * 60 * 60 * 1000;

// ── Rendu ─────────────────────────────────────────────────────────────────────
/**
 * Affiche un montant avec l'unité en exposant réduit.
 * Ex : "42.50 EUR" → <span>42.50 <small>EUR</small></span>
 */
export const fmtAmountRight = (raw) => {
  if (!raw) return null;
  const str = String(raw);
  const i = str.lastIndexOf(" ");
  if (i < 0) return <span>{str}</span>;
  return (
    <span className="inline-flex items-baseline gap-[3px]">
      {str.slice(0, i)}
      <span className="text-[0.78em]">{str.slice(i + 1)}</span>
    </span>
  );
};

// ── Utilitaires ───────────────────────────────────────────────────────────────
export const resolvePartnerName = (url) => {
  const raw = String(url || "").toLowerCase();
  if (raw.includes("topper")) return "Topper";
  return "MoonPay";
};

/**
 * Valide qu'une origine postMessage vient bien de MoonPay (https uniquement).
 * Fonction de sécurité — NE PAS dupliquer.
 */
export const isTrustedMoonPayOrigin = (origin) => {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "moonpay.com" || host.endsWith(MOONPAY_ORIGIN_SUFFIX);
  } catch (_) {
    return false;
  }
};

export const notifyPwaMoonpayActive = (active, tab) => {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const isPwaEmbedded =
      params.get("embedded") === "pwa" || Boolean(window.__XCANNES_PWA_EMBEDDED__);
    if (!isPwaEmbedded) return;
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage(
      { type: "MOONPAY_ACTIVE", active: Boolean(active), tab },
      "*",
    );
  } catch {
    // ignore
  }
};

export const normalizeFiatCurrencyCode = (value) => {
  const upper = String(value || "").trim().toUpperCase();
  if (!upper) return "";
  if (upper === "XRP" || upper === "RLUSD") return "";
  return upper;
};

export const truncateMiddle = (value, head = 6, tail = 5) => {
  const str = String(value ?? "");
  if (!str) return "";
  if (str.length <= head + tail + 1) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
};
