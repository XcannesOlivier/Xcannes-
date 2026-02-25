/**
 * Xcannes Wallet — XRPL Wallet Service
 * 
 * Handles wallet generation, seed-based wallet restoration,
 * and LOCAL transaction signing.
 * 
 * Uses the xrpl.js library loaded from CDN in the PWA.
 * The seed / mnemonic NEVER leaves this module unencrypted.
 * The seed / mnemonic is NEVER sent to any server.
 * 
 * Mnemonic standard: BIP39 (12 words) — compatible with Trust Wallet, Ledger, etc.
 * 
 * xrpl.js functions used:
 *   Wallet.fromMnemonic, Wallet.fromSeed
 *   wallet.sign, wallet.verifyTransaction, wallet.getXAddress
 *   walletFromSecretNumbers, validate, isValidSecret
 *   convertStringToHex
 */

import { generateMnemonic } from './bip39.js';

/**
 * Generate a new XRPL wallet using BIP39 mnemonic.
 * The mnemonic (12 words) IS the master secret — it replaces the traditional seed.
 * The mnemonic must be encrypted immediately by the caller using cryptoService.encryptSeed().
 *
 * Flow: generateMnemonic() → Wallet.fromMnemonic(mnemonic)
 * This ensures the mnemonic is always the canonical backup.
 *
 * @returns {Promise<{ address: string, seed: string, publicKey: string, mnemonic: string, xAddress: string }>}
 */
export async function generateWallet() {
  // 1. Generate a BIP39 12-word mnemonic (128-bit entropy + SHA-256 checksum)
  const mnemonic = await generateMnemonic();

  // 2. Derive XRPL wallet from mnemonic via BIP44 path
  // xrpl is loaded globally via CDN <script> tag
  const wallet = xrpl.Wallet.fromMnemonic(mnemonic);

  return {
    address: wallet.classicAddress,
    seed: mnemonic,      // Store mnemonic as the "seed" — no traditional sXXXX seed
    publicKey: wallet.publicKey,
    mnemonic,            // Same value, explicit for backup display
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

// walletFromRFC1751Mnemonic() removed — Xcannes now uses BIP39 only.
// Legacy RFC1751 wallets can still be imported via seed (sXXXX format).

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
  // Proof of ownership via a non-broadcastable pseudo-transaction.
  // The challenge is embedded in a Memo. Verifiable with xrpl.verifySignature().
  const pseudoTx = {
    TransactionType: 'Payment',
    Account: wallet.classicAddress,
    Destination: wallet.classicAddress,
    Amount: '1',
    Fee: '0',
    Sequence: 0,
    Memos: [{
      Memo: {
        MemoData: xrpl.convertStringToHex(challengeHex),
        MemoType: xrpl.convertStringToHex('xcannes/challenge'),
      }
    }],
  };
  const signed = wallet.sign(pseudoTx);
  return {
    signature: signed.tx_blob,
    publicKey: wallet.publicKey,
  };
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
