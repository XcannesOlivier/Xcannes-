/**
 * 🔧 Frontend runtime configuration helpers (API + WebSocket)
 * Centralise la résolution des URLs pour éviter les duplications et incohérences.
 */

const RAW_API_URL = (process.env.NEXT_PUBLIC_XCANNES_API_URL || "").trim();
const RAW_WS_URL = (process.env.NEXT_PUBLIC_XCANNES_WS_URL || "").trim();

const DEFAULT_API_PORT = (process.env.NEXT_PUBLIC_API_PORT || process.env.API_PORT || "3001").trim();
const DEFAULT_WS_PORT = (process.env.NEXT_PUBLIC_WS_PORT || process.env.WS_PORT || "3002").trim();

const stripTrailingSlash = (value = "") => value.replace(/\/$/, "");

const isBrowser = () => typeof window !== "undefined";

function baseProtocol(defaultProto = "http") {
  if (!isBrowser()) return defaultProto;
  return window.location.protocol === "https:" ? "https" : defaultProto;
}

function buildHost(protocol, port) {
  const host = isBrowser() ? window.location.hostname : "localhost";
  const portPart = port ? `:${port}` : "";
  return `${protocol}://${host}${portPart}`;
}

/**
 * Résout l'URL de base pour l'API (port 3001 par défaut).
 */
export function getApiBaseUrl() {
  const trimmed = stripTrailingSlash(RAW_API_URL);
  if (trimmed) {
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
  }

  return buildHost(baseProtocol("http"), DEFAULT_API_PORT);
}

/**
 * Résout l'URL WebSocket (port 3002 par défaut).
 */
export function getWsUrl() {
  const trimmed = stripTrailingSlash(RAW_WS_URL);
  if (trimmed) {
    if (/^wss?:\/\//i.test(trimmed)) return trimmed;
    // Supporter un éventuel http(s) en le convertissant
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed.replace(/^http/i, "ws");
    }
    return `ws://${trimmed}`;
  }

  const protocol = isBrowser() && window.location.protocol === "https:" ? "wss" : "ws";
  return buildHost(protocol, DEFAULT_WS_PORT);
}

/**
 * Concatène une route à l'API de façon fiable.
 */
export function apiUrl(path = "") {
  const base = getApiBaseUrl();
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
