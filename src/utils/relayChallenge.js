/**
 * relayChallenge.js — Detect wallet relay challenge QR codes
 *
 * The wallet-app PWA uses relay challenges for connect/sign flows.
 * QR codes can be in 3 formats:
 *   1. JSON: { challengeId, type, ... }
 *   2. URL:  https://…/wallet-relay/challenge/<uuid>
 *   3. Plain UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *
 * This utility mirrors the parseQRCode() function from the PWA's qrService.js.
 */

const UUID_REGEX =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/**
 * Parse a raw QR code string and return a relay challenge descriptor
 * if it matches one of the known relay-challenge formats.
 *
 * @param {string} raw - The raw QR code content
 * @returns {{ type: string, challengeId: string, relay?: string } | null}
 */
export function parseRelayChallenge(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();

  // 1. JSON with challengeId + type
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.challengeId && parsed.type) {
      return {
        type: parsed.type,
        challengeId: parsed.challengeId,
        relay: parsed.relay || null,
      };
    }
  } catch {
    /* not JSON */
  }

  // 2. URL with /wallet-relay/challenge/<uuid>
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(
      /\/wallet-relay\/challenge\/([a-f0-9-]+)/i,
    );
    if (match) {
      return {
        type: "xcannes:connect",
        challengeId: match[1],
        relay: url.origin,
      };
    }
  } catch {
    /* not a URL */
  }

  // 3. Plain UUID
  if (UUID_REGEX.test(trimmed)) {
    return {
      type: "xcannes:connect",
      challengeId: trimmed,
      relay: null,
    };
  }

  return null;
}

/**
 * Forward a relay challenge to the PWA parent via postMessage.
 * Only works when running inside the PWA iframe.
 *
 * @param {string} rawQR - The raw QR code content
 * @returns {boolean} true if message was sent
 */
export function forwardRelayChallengeToPwa(rawQR) {
  try {
    if (
      typeof window !== "undefined" &&
      window.parent &&
      window.parent !== window
    ) {
      window.parent.postMessage(
        { type: "PROCESS_QR_CHALLENGE", rawQR: String(rawQR || "").trim() },
        "*",
      );
      return true;
    }
  } catch {
    /* cross-origin safety */
  }
  return false;
}
