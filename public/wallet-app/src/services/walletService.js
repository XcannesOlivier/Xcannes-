/**
 * Xcannes Wallet — XRPL Wallet Service
 * 
 * Handles wallet generation, seed-based wallet restoration,
 * and LOCAL transaction signing.
 * 
 * Uses the xrpl.js library loaded from CDN in the PWA.
 * The seed NEVER leaves this module unencrypted.
 * The seed is NEVER sent to any server.
 * 
 * xrpl.js functions used:
 *   Wallet.generate, Wallet.fromSeed, Wallet.fromMnemonic, Wallet.fromEntropy
 *   wallet.sign, wallet.verifyTransaction, wallet.getXAddress
 *   verifySignature, isValidAddress, isValidClassicAddress, isValidSecret
 *   deriveKeypair, deriveAddress, keyToRFC1751Mnemonic, rfc1751MnemonicToKey
 *   walletFromSecretNumbers, validate
 *   xrpToDrops, dropsToXrp, convertStringToHex, convertHexToString
 */

/**
 * Generate a new XRPL wallet.
 * Returns the seed + address + mnemonic backup.
 * The seed must be encrypted immediately by the caller using cryptoService.encryptSeed().
 *
 * @returns {{ address: string, seed: string, publicKey: string, mnemonic: string, xAddress: string }}
 */
export function generateWallet() {
  // xrpl is loaded globally via CDN <script> tag
  const wallet = xrpl.Wallet.generate();

  // Generate RFC1751 mnemonic (12 words) for human-readable backup
  let mnemonic = '';
  try {
    mnemonic = xrpl.keyToRFC1751Mnemonic(wallet.privateKey);
  } catch {
    // Fallback: seed itself is the backup
  }

  return {
    address: wallet.classicAddress,
    seed: wallet.seed,
    publicKey: wallet.publicKey,
    mnemonic,
    xAddress: wallet.getXAddress(),
  };
}

/**
 * Restore a wallet from a seed (sXXX format).
 * Used after biometric unlock to load the wallet into memory.
 *
 * @param {string} seed - The decrypted seed
 * @returns {{ address: string, publicKey: string, wallet: object, xAddress: string }}
 */
export function walletFromSeed(seed) {
  const wallet = xrpl.Wallet.fromSeed(seed);
  return {
    address: wallet.classicAddress,
    publicKey: wallet.publicKey,
    wallet, // Keep in memory only — never persist unencrypted
    xAddress: wallet.getXAddress(),
  };
}

/**
 * Restore a wallet from a BIP39 mnemonic (12/24 words).
 * Compatible with wallets that use BIP39 standard (Trust Wallet, etc.).
 * Note: BIP39 wallets do NOT have a traditional XRPL seed.
 *
 * @param {string} mnemonic - Space-separated 12 or 24 words
 * @returns {{ address: string, publicKey: string, wallet: object, xAddress: string }}
 */
export function walletFromMnemonic(mnemonic) {
  const wallet = xrpl.Wallet.fromMnemonic(mnemonic.trim());
  return {
    address: wallet.classicAddress,
    publicKey: wallet.publicKey,
    wallet,
    xAddress: wallet.getXAddress(),
  };
}

/**
 * Restore a wallet from RFC1751 mnemonic (12 words — Xcannes backup format).
 *
 * @param {string} mnemonic - Space-separated 12 RFC1751 words
 * @returns {{ address: string, publicKey: string, wallet: object, seed: string }}
 */
export function walletFromRFC1751Mnemonic(mnemonic) {
  const keyBytes = xrpl.rfc1751MnemonicToKey(mnemonic.trim());
  const hexKey = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const seed = xrpl.encodeSeed(keyBytes, 'ed25519');
  const wallet = xrpl.Wallet.fromSeed(seed);
  return {
    address: wallet.classicAddress,
    publicKey: wallet.publicKey,
    wallet,
    seed,
  };
}

/**
 * Restore a wallet from Xaman/XUMM "secret numbers" format.
 * For users migrating FROM Xumm to Xcannes Wallet.
 *
 * @param {string} secretNumbers - e.g. "123456 234567 345678 456789 567890 678901 789012 890123"
 * @returns {{ address: string, publicKey: string, wallet: object }}
 */
export function walletFromSecretNumbers(secretNumbers) {
  const wallet = xrpl.walletFromSecretNumbers(secretNumbers);
  return {
    address: wallet.classicAddress,
    publicKey: wallet.publicKey,
    wallet,
  };
}

/**
 * Generate a wallet from raw entropy.
 *
 * @param {Uint8Array} entropy - 16 bytes of cryptographic randomness
 * @returns {{ address: string, seed: string, publicKey: string, wallet: object }}
 */
export function walletFromEntropy(entropy) {
  const wallet = xrpl.Wallet.fromEntropy(entropy);
  return {
    address: wallet.classicAddress,
    seed: wallet.seed,
    publicKey: wallet.publicKey,
    wallet,
  };
}

/**
 * Sign a transaction locally.
 * The seed is already decrypted and held in memory.
 * Validates the transaction structure before signing.
 * Verifies the signature after signing.
 *
 * @param {object} wallet - The xrpl.Wallet instance (from walletFromSeed)
 * @param {object} txJson - The transaction JSON to sign
 * @returns {{ tx_blob: string, hash: string }}
 * @throws {Error} If transaction is invalid or signature verification fails
 */
export function signTransaction(wallet, txJson) {
  // Ensure the transaction has the correct Account field
  const tx = {
    ...txJson,
    Account: wallet.classicAddress,
  };

  // Validate transaction structure before signing
  try {
    xrpl.validate(tx);
  } catch (validationErr) {
    throw new Error(`Transaction invalide: ${validationErr.message}`);
  }

  // Sign locally
  const signed = wallet.sign(tx);

  // Verify our own signature (defense in depth)
  const isValid = wallet.verifyTransaction(signed.tx_blob);
  if (!isValid) {
    throw new Error('Signature verification failed — something is critically wrong');
  }

  return {
    tx_blob: signed.tx_blob,
    hash: signed.hash,
  };
}

/**
 * Sign a transaction for a connect/auth challenge.
 * This proves ownership of the wallet without making an on-chain transaction.
 * Signs a dummy "SignIn" message — the signature proves the address.
 *
 * @param {object} wallet - The xrpl.Wallet instance
 * @param {string} challengeHex - Hex challenge from the relay server
 * @returns {{ signature: string, publicKey: string }}
 */
export function signChallenge(wallet, challengeHex) {
  // Sign the challenge bytes to prove wallet ownership
  const signature = wallet.sign(challengeHex);
  return {
    signature,
    publicKey: wallet.publicKey,
  };
}

/**
 * Validate that a seed produces the expected address.
 * Uses deriveKeypair + deriveAddress for independent verification.
 *
 * @param {string} seed - The seed to validate  
 * @param {string} expectedAddress - The expected XRPL address
 * @returns {boolean}
 */
export function validateSeed(seed, expectedAddress) {
  try {
    const wallet = xrpl.Wallet.fromSeed(seed);
    if (wallet.classicAddress !== expectedAddress) return false;

    // Double-check via independent key derivation
    const keypair = xrpl.deriveKeypair(seed);
    const derivedAddress = xrpl.deriveAddress(keypair.publicKey);
    return derivedAddress === expectedAddress;
  } catch {
    return false;
  }
}

/**
 * Check if a string is a valid XRPL seed.
 * Uses xrpl.isValidSecret() for proper validation.
 *
 * @param {string} seed
 * @returns {boolean}
 */
export function isValidSeed(seed) {
  return xrpl.isValidSecret(seed);
}

/**
 * Check if a string is a valid XRPL address (classic or X-address).
 *
 * @param {string} address
 * @returns {boolean}
 */
export function isValidAddress(address) {
  return xrpl.isValidAddress(address);
}

/**
 * Check if a string is a valid classic XRPL address (rXXX format).
 *
 * @param {string} address
 * @returns {boolean}
 */
export function isValidClassicAddress(address) {
  return xrpl.isValidClassicAddress(address);
}

/**
 * Check if a string is a valid X-address.
 *
 * @param {string} address
 * @returns {boolean}
 */
export function isValidXAddress(address) {
  return xrpl.isValidXAddress(address);
}

/**
 * Convert X-address to classic address.
 *
 * @param {string} xAddress
 * @returns {{ classicAddress: string, tag: number | false }}
 */
export function xAddressToClassic(xAddress) {
  return xrpl.xAddressToClassicAddress(xAddress);
}

/**
 * Verify a signed transaction blob (standalone, no wallet needed).
 * Useful for the relay server to verify tx_blobs.
 *
 * @param {string} txBlob - The signed transaction blob
 * @returns {boolean}
 */
export function verifyTransactionSignature(txBlob) {
  return xrpl.verifySignature(txBlob);
}

// ==========================================
// AMOUNT UTILITIES
// ==========================================

/**
 * Convert XRP to drops (1 XRP = 1,000,000 drops).
 * @param {string|number} xrp
 * @returns {string}
 */
export function xrpToDrops(xrp) {
  return xrpl.xrpToDrops(String(xrp));
}

/**
 * Convert drops to XRP.
 * @param {string|number} drops
 * @returns {string}
 */
export function dropsToXrp(drops) {
  return xrpl.dropsToXrp(String(drops));
}

// ==========================================
// MEMO / HEX UTILITIES
// ==========================================

/**
 * Convert a string to hex (for memo fields).
 * @param {string} str
 * @returns {string}
 */
export function stringToHex(str) {
  return xrpl.convertStringToHex(str);
}

/**
 * Convert hex to string (for reading memo fields).
 * @param {string} hex
 * @returns {string}
 */
export function hexToString(hex) {
  return xrpl.convertHexToString(hex);
}

// ==========================================
// TRANSACTION DISPLAY HELPERS 
// ==========================================

/**
 * Format a transaction amount for display.
 * Handles both XRP (string drops) and IOU (object) amounts.
 *
 * @param {string|object} amount - XRPL amount (drops string or {value, currency, issuer})
 * @returns {string} Human-readable amount
 */
export function formatAmount(amount) {
  if (typeof amount === 'string') {
    return `${xrpl.dropsToXrp(amount)} XRP`;
  }
  if (amount && typeof amount === 'object') {
    const currency = amount.currency?.length === 40
      ? xrpl.convertHexToString(amount.currency).replace(/\0/g, '')
      : amount.currency;
    return `${amount.value} ${currency}`;
  }
  return 'Unknown';
}

/**
 * Parse and format memos from a transaction for display.
 *
 * @param {Array} memos - Transaction Memos array
 * @returns {Array<{ type: string, data: string }>}
 */
export function parseMemos(memos) {
  if (!Array.isArray(memos)) return [];
  return memos.map(m => {
    const memo = m.Memo || m;
    return {
      type: memo.MemoType ? xrpl.convertHexToString(memo.MemoType) : '',
      data: memo.MemoData ? xrpl.convertHexToString(memo.MemoData) : '',
    };
  });
}

// ==========================================
// MEMORY SECURITY
// ==========================================

/**
 * Wipe the wallet from memory (clear references).
 * Call this on lock/disconnect.
 *
 * @param {object} walletRef - Object containing { wallet } — will be nullified
 */
export function clearWalletFromMemory(walletRef) {
  if (walletRef) {
    walletRef.wallet = null;
    walletRef.seed = null;
    walletRef.mnemonic = null;
  }
}
