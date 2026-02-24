/**
 * Xcannes Wallet — Crypto Service
 * 
 * Handles seed generation, AES-256-GCM encryption/decryption.
 * The seed NEVER leaves the device unencrypted.
 * The server NEVER sees the seed.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 310000; // OWASP 2023 recommendation

/**
 * Generate a random encryption key from WebAuthn credential.
 * The WebAuthn assertion response contains a signature that we use as
 * high-entropy input to derive an AES key via PBKDF2.
 *
 * @param {ArrayBuffer} webauthnSignature - The signature from WebAuthn assertion
 * @param {Uint8Array} salt - Stored salt (generated at wallet creation)
 * @returns {Promise<CryptoKey>} AES-256-GCM key
 */
export async function deriveKeyFromWebAuthn(webauthnSignature, salt) {
  // Import the WebAuthn signature as raw key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    webauthnSignature,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-256-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt the seed using AES-256-GCM.
 * Returns { iv, salt, ciphertext } — all needed for decryption.
 *
 * @param {string} seed - The XRPL wallet seed (sXXXXXX or family seed)
 * @param {ArrayBuffer} webauthnSignature - WebAuthn assertion signature
 * @returns {Promise<{ iv: string, salt: string, ciphertext: string }>}
 */
export async function encryptSeed(seed, webauthnSignature) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKeyFromWebAuthn(webauthnSignature, salt);

  const encoded = new TextEncoder().encode(seed);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  return {
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Decrypt the seed using AES-256-GCM.
 *
 * @param {{ iv: string, salt: string, ciphertext: string }} encryptedData
 * @param {ArrayBuffer} webauthnSignature - WebAuthn assertion signature (same credential)
 * @returns {Promise<string>} The decrypted seed
 */
export async function decryptSeed(encryptedData, webauthnSignature) {
  const salt = base64ToArrayBuffer(encryptedData.salt);
  const iv = base64ToArrayBuffer(encryptedData.iv);
  const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);
  const key = await deriveKeyFromWebAuthn(webauthnSignature, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Generate a secure random salt for new wallet creation.
 * @returns {Uint8Array}
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

// --- Utility: Base64 <-> ArrayBuffer ---

export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
