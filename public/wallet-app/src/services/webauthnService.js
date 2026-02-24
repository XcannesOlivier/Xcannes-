/**
 * Xcannes Wallet — WebAuthn Service
 * 
 * Handles Face ID / Touch ID registration and authentication
 * via the Web Authentication API. Uses the device Secure Enclave.
 * 
 * The WebAuthn credential is used to:
 * 1. Prove biometric identity (Face ID / Touch ID)
 * 2. Generate a deterministic signature used to derive the AES key
 *    that encrypts/decrypts the XRPL seed
 */

const RP_NAME = 'Xcannes Wallet';
const RP_ID_DEFAULT = 'xcannes.com'; // Must match the domain serving the PWA

// Fixed PRF input — the output is already unique per credential
const PRF_SALT = new TextEncoder().encode('xcannes-wallet-prf-v1');

/**
 * Get the Relying Party ID from the current origin.
 * In production: xcannes.com (or wallet.xcannes.com)
 * In dev: localhost
 */
function getRpId() {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return hostname;
    }
    // For subdomains like wallet.xcannes.com, use xcannes.com
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  }
  return RP_ID_DEFAULT;
}

/**
 * Check if WebAuthn is supported on this device.
 * @returns {boolean}
 */
export function isWebAuthnSupported() {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    navigator.credentials.create &&
    navigator.credentials.get
  );
}

/**
 * Check if platform authenticator is available (Face ID / Touch ID).
 * @returns {Promise<boolean>}
 */
export async function isBiometricAvailable() {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Register a new WebAuthn credential (Face ID / Touch ID enrollment).
 * Called once during wallet creation.
 *
 * @param {string} walletAddress - The XRPL address (used as user ID)
 * @returns {Promise<{ credentialId: string, signature: ArrayBuffer }>}
 */
export async function registerBiometric(walletAddress) {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported on this device');
  }

  const biometricAvailable = await isBiometricAvailable();
  if (!biometricAvailable) {
    throw new Error('No biometric authenticator available (Face ID / Touch ID)');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = new TextEncoder().encode(walletAddress);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: RP_NAME,
        id: getRpId(),
      },
      user: {
        id: userId,
        name: walletAddress,
        displayName: `Xcannes Wallet (${walletAddress.slice(0, 8)}...)`,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256 (recommended)
        { alg: -257, type: 'public-key' },  // RS256 (fallback)
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Forces Face ID / Touch ID (not USB keys)
        userVerification: 'required',        // Forces biometric check
        residentKey: 'preferred',            // Discoverable credential
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none', // No attestation needed — we don't send to server
      extensions: { prf: {} }, // Enable PRF for deterministic key derivation
    },
  });

  const credentialId = arrayBufferToBase64(credential.rawId);

  // Verify PRF support (required for AES key derivation)
  const prfEnabled = credential.getClientExtensionResults()?.prf?.enabled;
  if (!prfEnabled) {
    throw new Error('PRF non supporté. Utilisez Chrome 116+, Safari 18+ ou Edge 116+.');
  }

  // Get first PRF output via assertion (deterministic secret)
  const assertion = await authenticateWithCredential(credentialId);

  return {
    credentialId,
    signature: assertion.prfOutput, // Deterministic — safe for AES key derivation
  };
}

/**
 * Authenticate with an existing WebAuthn credential (Face ID / Touch ID prompt).
 * Called every time the user needs to unlock the wallet or sign a transaction.
 *
 * @param {string} credentialId - Base64-encoded credential ID from registration
 * @returns {Promise<{ signature: ArrayBuffer, authenticatorData: ArrayBuffer }>}
 */
export async function authenticateWithCredential(credentialId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: getRpId(),
      allowCredentials: [
        {
          type: 'public-key',
          id: base64ToArrayBuffer(credentialId),
        },
      ],
      userVerification: 'required', // Always require Face ID / Touch ID
      timeout: 60000,
      extensions: {
        prf: { eval: { first: PRF_SALT } }, // Deterministic secret derivation
      },
    },
  });

  const prfOutput = assertion.getClientExtensionResults()?.prf?.results?.first;
  if (!prfOutput) {
    throw new Error('Échec PRF. Le navigateur n\'a pas retourné de secret déterministe.');
  }

  return {
    signature: assertion.response.signature,
    authenticatorData: assertion.response.authenticatorData,
    prfOutput,
  };
}

/**
 * Convenience: prompt biometric and return the signature for key derivation.
 * This is the main entry point for "unlock wallet" and "confirm transaction".
 *
 * @param {string} credentialId - Stored credential ID
 * @returns {Promise<ArrayBuffer>} The WebAuthn signature (used for AES key derivation)
 */
export async function promptBiometric(credentialId) {
  const result = await authenticateWithCredential(credentialId);
  return result.prfOutput; // Deterministic secret for AES key derivation
}

// --- Base64 helpers (duplicated from cryptoService for module independence) ---

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
