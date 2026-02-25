/**
 * Xcannes Wallet — PIN Service
 *
 * PIN-based AES-256-GCM encryption for seed protection.
 * Uses PBKDF2 with 310k iterations (OWASP 2023 recommendation).
 * Includes brute-force protection with progressive lockout.
 *
 * The PIN is NEVER stored anywhere — it is used to derive an AES key,
 * then immediately discarded from memory.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;   // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 310000; // OWASP 2023

// Brute-force protection
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
const LOCKOUT_DELAYS_MS = [30000, 60000, 300000, 600000, 1800000]; // 30s, 1m, 5m, 10m, 30m

/**
 * Derive an AES-256-GCM key from a 6-digit PIN.
 * Uses PBKDF2 with high iteration count to resist brute-force.
 *
 * @param {string} pin - 6-digit PIN string
 * @param {Uint8Array} salt - Random salt (stored alongside ciphertext)
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKeyFromPIN(pin, salt) {
  const pinBuffer = new TextEncoder().encode(pin);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', pinBuffer, 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt the seed using a PIN-derived AES-256-GCM key.
 *
 * @param {string} seed - The XRPL seed or mnemonic
 * @param {string} pin - 6-digit PIN
 * @returns {Promise<{ iv: string, salt: string, ciphertext: string }>}
 */
export async function encryptSeedWithPIN(seed, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKeyFromPIN(pin, salt);
  const encoded = new TextEncoder().encode(seed);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
  return {
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Decrypt the seed using a PIN-derived AES-256-GCM key.
 * If the PIN is wrong, AES-GCM will throw an OperationError
 * (authentication tag mismatch).
 *
 * @param {{ iv: string, salt: string, ciphertext: string }} encryptedData
 * @param {string} pin - 6-digit PIN
 * @returns {Promise<string>} The decrypted seed
 */
export async function decryptSeedWithPIN(encryptedData, pin) {
  const salt = base64ToArrayBuffer(encryptedData.salt);
  const iv = base64ToArrayBuffer(encryptedData.iv);
  const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);
  const key = await deriveKeyFromPIN(pin, salt);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/**
 * Check if PIN entry is locked due to too many failed attempts.
 *
 * @param {object} walletData - Wallet record from IndexedDB
 * @returns {{ locked: boolean, remainingSec: number, attempts: number }}
 */
export function checkPINLockout(walletData) {
  const attempts = walletData.pinAttempts || 0;
  const lockedUntil = walletData.pinLockedUntil || 0;

  if (attempts >= MAX_ATTEMPTS_BEFORE_LOCKOUT && Date.now() < lockedUntil) {
    return {
      locked: true,
      remainingSec: Math.ceil((lockedUntil - Date.now()) / 1000),
      attempts,
    };
  }
  return { locked: false, remainingSec: 0, attempts };
}

/**
 * Get the lockout delay for the current failed attempt count.
 *
 * @param {number} attempts - Total failed attempts
 * @returns {number} Delay in milliseconds
 */
export function getNextLockoutDelay(attempts) {
  const idx = Math.min(
    attempts - MAX_ATTEMPTS_BEFORE_LOCKOUT,
    LOCKOUT_DELAYS_MS.length - 1
  );
  return LOCKOUT_DELAYS_MS[Math.max(0, idx)];
}

/**
 * Validate PIN format (exactly 6 digits).
 * @param {string} pin
 * @returns {boolean}
 */
export function isValidPIN(pin) {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

// --- Base64 helpers ---

function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
