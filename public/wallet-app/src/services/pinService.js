/**
 * Xcannes Wallet — PIN Service (App-level Master Key)
 *
 * Architecture:
 *   1. User creates a 6-digit PIN on first launch
 *   2. PBKDF2 derives a master AES-256-GCM key from PIN + salt
 *   3. Master key encrypts ALL wallet seeds (multi-wallet)
 *   4. Master key is held in memory while app is unlocked
 *   5. On lock/close, master key is wiped from memory
 *
 * The PIN is NEVER stored. A verification hash (separate PBKDF2 derivation)
 * is stored to validate the PIN without needing to attempt decryption.
 *
 * Brute-force protection: progressive lockout after 5 failed attempts.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;   // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 310000; // OWASP 2023

// Brute-force protection
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
const LOCKOUT_DELAYS_MS = [30000, 60000, 300000, 600000, 1800000]; // 30s, 1m, 5m, 10m, 30m

// --- In-memory master key (wiped on lock) ---
let _masterKey = null;

/**
 * Get the current master key (available only while unlocked).
 * @returns {CryptoKey|null}
 */
export function getMasterKey() {
  return _masterKey;
}

/**
 * Set the master key in memory (after successful PIN entry or Face ID unlock).
 * @param {CryptoKey} key
 */
export function setMasterKey(key) {
  _masterKey = key;
}

/**
 * Wipe the master key from memory (on lock/close).
 */
export function clearMasterKey() {
  _masterKey = null;
}

/**
 * Derive an AES-256-GCM master key from a 6-digit PIN.
 * Uses PBKDF2 with high iteration count to resist brute-force.
 *
 * @param {string} pin - 6-digit PIN string
 * @param {Uint8Array} salt - Random salt (stored in app settings)
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
    true, // extractable — needed for Face ID wrapping
    ['encrypt', 'decrypt']
  );
}

/**
 * Create a PIN verification hash (separate from the encryption key).
 * Uses a different salt so the verification hash cannot be used to derive the master key.
 *
 * @param {string} pin - 6-digit PIN
 * @param {Uint8Array} verifySalt - Separate salt for verification
 * @returns {Promise<string>} Base64-encoded hash
 */
export async function createPINVerifyHash(pin, verifySalt) {
  const pinBuffer = new TextEncoder().encode(pin);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', pinBuffer, 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: verifySalt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return arrayBufferToBase64(bits);
}

/**
 * Verify a PIN against the stored verification hash.
 *
 * @param {string} pin - 6-digit PIN to verify
 * @param {string} storedHash - Base64 hash from createPINVerifyHash
 * @param {string} verifySaltB64 - Base64 salt used for verification
 * @returns {Promise<boolean>}
 */
export async function verifyPIN(pin, storedHash, verifySaltB64) {
  const verifySalt = base64ToUint8Array(verifySaltB64);
  const hash = await createPINVerifyHash(pin, verifySalt);
  return hash === storedHash;
}

/**
 * Encrypt a seed using the master key.
 *
 * @param {string} seed - The XRPL seed or mnemonic
 * @param {CryptoKey} masterKey - The AES-256-GCM master key
 * @returns {Promise<{ iv: string, ciphertext: string }>}
 */
export async function encryptWithMasterKey(seed, masterKey) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(seed);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, masterKey, encoded);
  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Decrypt a seed using the master key.
 *
 * @param {{ iv: string, ciphertext: string }} encryptedData
 * @param {CryptoKey} masterKey - The AES-256-GCM master key
 * @returns {Promise<string>} The decrypted seed
 */
export async function decryptWithMasterKey(encryptedData, masterKey) {
  const iv = base64ToUint8Array(encryptedData.iv);
  const ciphertext = base64ToUint8Array(encryptedData.ciphertext);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    masterKey,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Export the master key as raw bytes, then encrypt those bytes with WebAuthn PRF output.
 * This allows Face ID to restore the master key without the PIN.
 *
 * @param {CryptoKey} masterKey - The master key to wrap
 * @param {ArrayBuffer} prfOutput - WebAuthn PRF output (used as wrapping key material)
 * @returns {Promise<{ iv: string, wrappedKey: string }>}
 */
export async function wrapMasterKeyWithPRF(masterKey, prfOutput) {
  // Derive a wrapping key from the PRF output
  const wrappingKeyMaterial = await crypto.subtle.importKey(
    'raw', prfOutput, 'HKDF', false, ['deriveKey']
  );
  const wrappingKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('xcannes-masterkey-wrap') },
    wrappingKeyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['wrapKey', 'unwrapKey']
  );

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const wrappedKey = await crypto.subtle.wrapKey('raw', masterKey, wrappingKey, { name: ALGORITHM, iv });

  return {
    iv: arrayBufferToBase64(iv),
    wrappedKey: arrayBufferToBase64(wrappedKey),
  };
}

/**
 * Unwrap the master key using WebAuthn PRF output (Face ID unlock).
 *
 * @param {{ iv: string, wrappedKey: string }} wrappedData
 * @param {ArrayBuffer} prfOutput - WebAuthn PRF output
 * @returns {Promise<CryptoKey>} The restored master key
 */
export async function unwrapMasterKeyWithPRF(wrappedData, prfOutput) {
  const wrappingKeyMaterial = await crypto.subtle.importKey(
    'raw', prfOutput, 'HKDF', false, ['deriveKey']
  );
  const wrappingKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('xcannes-masterkey-wrap') },
    wrappingKeyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['wrapKey', 'unwrapKey']
  );

  const iv = base64ToUint8Array(wrappedData.iv);
  const wrappedKey = base64ToUint8Array(wrappedData.wrappedKey);

  return crypto.subtle.unwrapKey(
    'raw', wrappedKey, wrappingKey,
    { name: ALGORITHM, iv },
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // not extractable after unwrap (except for re-wrap if needed)
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a fresh random salt.
 * @returns {string} Base64-encoded salt
 */
export function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return arrayBufferToBase64(salt);
}

/**
 * Check if PIN entry is locked due to too many failed attempts.
 *
 * @param {{ pinAttempts: number, pinLockedUntil: number }} authData - App auth settings
 * @returns {{ locked: boolean, remainingSec: number, attempts: number }}
 */
export function checkPINLockout(authData) {
  const attempts = authData?.pinAttempts || 0;
  const lockedUntil = authData?.pinLockedUntil || 0;

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
 * Convert base64 string to Uint8Array.
 * @param {string} b64
 * @returns {Uint8Array}
 */
export function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
