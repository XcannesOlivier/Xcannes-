/**
 * Xcannes Wallet — Relay Service
 * 
 * Communication with the Xcannes backend relay server.
 * The relay is the bridge between the desktop browser and the mobile wallet.
 * 
 * Protocol:
 *   1. Desktop creates a challenge → shows QR code
 *   2. Mobile scans QR → fetches challenge payload
 *   3. Mobile signs locally → submits signed tx_blob
 *   4. Server submits tx_blob to XRPL + notifies desktop via WebSocket
 * 
 * The relay NEVER sees seeds or private keys.
 * It only receives: public address + signed transaction blobs.
 */

const DEFAULT_RELAY_URL = '';  // Will be set from config

let relayBaseUrl = DEFAULT_RELAY_URL;

/**
 * Configure the relay server URL.
 * @param {string} url - e.g. "https://api.xcannes.com" or "http://localhost:3001"
 */
export function setRelayUrl(url) {
  relayBaseUrl = url.replace(/\/$/, ''); // Strip trailing slash
}

/**
 * Fetch a challenge payload from the relay server.
 * Called after scanning a QR code on the desktop.
 *
 * @param {string} challengeId - The challenge UUID from the QR code
 * @returns {Promise<{
 *   type: "connect" | "sign",
 *   challengeId: string,
 *   txjson?: object,
 *   action?: string,
 *   expiresAt: number
 * }>}
 */
export async function fetchChallenge(challengeId) {
  const response = await fetch(`${relayBaseUrl}/wallet-relay/challenge/${challengeId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Challenge fetch failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Submit a signed connect proof to the relay.
 * Proves wallet ownership without an on-chain transaction.
 *
 * @param {string} challengeId
 * @param {{ address: string, publicKey: string, signature: string }} proof
 * @returns {Promise<{ success: boolean }>}
 */
export async function submitConnect(challengeId, proof) {
  const response = await fetch(`${relayBaseUrl}/wallet-relay/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId,
      address: proof.address,
      publicKey: proof.publicKey,
      signature: proof.signature,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Connect submit failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Submit a signed transaction blob to the relay for XRPL submission.
 *
 * @param {string} challengeId
 * @param {{ tx_blob: string, hash: string, address: string }} signedTx
 * @returns {Promise<{ success: boolean, txResult?: object }>}
 */
export async function submitTransaction(challengeId, signedTx) {
  const response = await fetch(`${relayBaseUrl}/wallet-relay/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId,
      tx_blob: signedTx.tx_blob,
      hash: signedTx.hash,
      address: signedTx.address,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Transaction submit failed: ${response.status}`);
  }

  return response.json();
}


