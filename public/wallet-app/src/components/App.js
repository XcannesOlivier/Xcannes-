/**
 * Xcannes Wallet — Main App (PWA)
 * 
 * Vanilla JS app — no framework dependency, minimal footprint.
 * Orchestrates: wallet creation, biometric auth, QR scanning, signing.
 */

import { generateWallet, walletFromSeed, signTransaction, signChallenge, clearWalletFromMemory, isValidSeed } from '../services/walletService.js';
import { encryptSeed, decryptSeed } from '../services/cryptoService.js';
import { registerBiometric, promptBiometric, isBiometricAvailable } from '../services/webauthnService.js';
import { saveWallet, getLastUsedWallet, hasWallets, getAllWallets, deleteWallet } from '../services/storageService.js';
import { createQRScanner, parseQRCode } from '../services/qrService.js';
import { setRelayUrl, fetchChallenge, submitConnect, submitTransaction, pingRelay } from '../services/relayService.js';

// --- State ---
let currentWallet = null;  // { address, wallet (xrpl instance), publicKey }
let isUnlocked = false;

// --- Config ---
// Auto-detect relay URL: same host as the page, port 3001 (apiServer)
const RELAY_URL = window.__XCANNES_RELAY_URL__ || (() => {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  // If served from apiServer (port 3001), relay is on same origin
  if (port === '3001') return `${proto}//${host}:${port}`;
  // Dev: assume apiServer on port 3001
  if (host === 'localhost' || host === '127.0.0.1') return `${proto}//${host}:3001`;
  // Prod on Vercel: empty = relative URLs, Next.js rewrites proxy /wallet-relay to VPS
  return '';
})();
setRelayUrl(RELAY_URL);

// --- DOM References ---
const screens = {
  loading: () => document.getElementById('screen-loading'),
  welcome: () => document.getElementById('screen-welcome'),
  create: () => document.getElementById('screen-create'),
  backup: () => document.getElementById('screen-backup'),
  import_: () => document.getElementById('screen-import'),
  unlock: () => document.getElementById('screen-unlock'),
  scanner: () => document.getElementById('screen-scanner'),
  success: () => document.getElementById('screen-success'),
  error: () => document.getElementById('screen-error'),
};

/**
 * Show a screen, hide all others.
 */
function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const screen = screens[screenName]?.();
  if (screen) screen.classList.remove('hidden');
}

/**
 * Initialize the app.
 */
export async function init() {
  showScreen('loading');

  // Check biometric support
  const biometricOk = await isBiometricAvailable();
  if (!biometricOk) {
    showError('Ce navigateur ne supporte pas Face ID / Touch ID. Utilisez Safari sur iOS ou Chrome sur Android.');
    return;
  }

  // Check relay connectivity
  const relayOk = await pingRelay();
  if (!relayOk) {
    showError('Impossible de se connecter au serveur Xcannes. Vérifiez votre connexion internet.');
    return;
  }

  // Check if a wallet exists
  const existingWallets = await hasWallets();
  if (existingWallets) {
    showScreen('unlock');
    setupUnlockScreen();
  } else {
    showScreen('welcome');
    setupWelcomeScreen();
  }
}

// ==========================================
// WELCOME SCREEN
// ==========================================

function setupWelcomeScreen() {
  const btnCreate = document.getElementById('btn-create-wallet');
  const btnImport = document.getElementById('btn-import-wallet');

  btnCreate?.addEventListener('click', () => startCreateWallet());
  btnImport?.addEventListener('click', () => {
    showScreen('import_');
    setupImportScreen();
  });
}

// ==========================================
// CREATE WALLET
// ==========================================

async function startCreateWallet() {
  showScreen('create');
  const statusEl = document.getElementById('create-status');

  try {
    updateStatus(statusEl, 'Génération du wallet...');

    // 1. Generate wallet locally
    const { address, seed, publicKey } = generateWallet();

    updateStatus(statusEl, 'Enregistrement Face ID / Touch ID...');

    // 2. Register biometric (Face ID / Touch ID)
    const { credentialId, signature } = await registerBiometric(address);

    updateStatus(statusEl, 'Chiffrement et sauvegarde...');

    // 3. Encrypt seed with WebAuthn-derived key
    const encryptedSeed = await encryptSeed(seed, signature);

    // 4. Save encrypted wallet to IndexedDB
    await saveWallet({
      address,
      credentialId,
      encryptedSeed,
    });

    // 5. Show backup screen with seed (ONCE — user must write it down)
    showBackupScreen(seed, address);

  } catch (err) {
    console.error('Error creating wallet:', err);
    showError(`Erreur lors de la création du wallet: ${err.message}`);
  }
}

// ==========================================
// BACKUP SCREEN
// ==========================================

function showBackupScreen(seed, address) {
  showScreen('backup');

  const seedEl = document.getElementById('backup-seed');
  const addressEl = document.getElementById('backup-address');
  const confirmInput = document.getElementById('backup-confirm-input');
  const btnConfirm = document.getElementById('btn-backup-confirm');

  if (seedEl) seedEl.textContent = seed;
  if (addressEl) addressEl.textContent = address;

  // User must type last 4 characters of seed to confirm backup
  const last4 = seed.slice(-4);

  btnConfirm?.addEventListener('click', () => {
    const input = confirmInput?.value?.trim();
    if (input === last4) {
      // Backup confirmed — clear seed from DOM
      if (seedEl) seedEl.textContent = '••••••••••••••••••••••••••••••';
      showScreen('unlock');
      setupUnlockScreen();
    } else {
      confirmInput?.classList.add('error');
      setTimeout(() => confirmInput?.classList.remove('error'), 1000);
    }
  });
}

// ==========================================
// IMPORT WALLET
// ==========================================

function setupImportScreen() {
  const seedInput = document.getElementById('import-seed-input');
  const btnImport = document.getElementById('btn-import-confirm');
  const statusEl = document.getElementById('import-status');

  btnImport?.addEventListener('click', async () => {
    const seed = seedInput?.value?.trim();
    if (!seed) return;

    if (!isValidSeed(seed)) {
      updateStatus(statusEl, '❌ Seed invalide. Vérifiez et réessayez.', true);
      return;
    }

    try {
      updateStatus(statusEl, 'Restauration du wallet...');
      const { address, publicKey } = walletFromSeed(seed);

      updateStatus(statusEl, 'Enregistrement Face ID / Touch ID...');
      const { credentialId, signature } = await registerBiometric(address);

      updateStatus(statusEl, 'Chiffrement et sauvegarde...');
      const encryptedSeed = await encryptSeed(seed, signature);
      await saveWallet({ address, credentialId, encryptedSeed });

      // Clear input
      if (seedInput) seedInput.value = '';

      showScreen('unlock');
      setupUnlockScreen();
    } catch (err) {
      console.error('Import error:', err);
      showError(`Erreur d'import: ${err.message}`);
    }
  });
}

// ==========================================
// UNLOCK SCREEN
// ==========================================

function setupUnlockScreen() {
  const btnUnlock = document.getElementById('btn-unlock');
  const addressEl = document.getElementById('unlock-address');

  // Show last used wallet address
  getLastUsedWallet().then(wallet => {
    if (wallet && addressEl) {
      addressEl.textContent = `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`;
    }
  });

  btnUnlock?.addEventListener('click', () => unlockWallet());

  // Auto-trigger biometric on load
  setTimeout(() => unlockWallet(), 500);
}

async function unlockWallet() {
  const statusEl = document.getElementById('unlock-status');

  try {
    updateStatus(statusEl, 'Authentification biométrique...');

    const walletData = await getLastUsedWallet();
    if (!walletData) {
      showScreen('welcome');
      return;
    }

    // Prompt Face ID / Touch ID
    const signature = await promptBiometric(walletData.credentialId);

    // Decrypt seed
    updateStatus(statusEl, 'Déverrouillage...');
    const seed = await decryptSeed(walletData.encryptedSeed, signature);

    // Load wallet into memory
    const { wallet, address, publicKey } = walletFromSeed(seed);
    currentWallet = { wallet, address, publicKey };
    isUnlocked = true;

    // Ready — show scanner
    updateStatus(statusEl, '');
    showScreen('scanner');
    setupScannerScreen();

  } catch (err) {
    console.error('Unlock error:', err);
    if (err.name === 'NotAllowedError') {
      updateStatus(statusEl, 'Authentification annulée. Réessayez.', true);
    } else {
      showError(`Erreur de déverrouillage: ${err.message}`);
    }
  }
}

// ==========================================
// SCANNER SCREEN
// ==========================================

let qrScanner = null;

function setupScannerScreen() {
  const video = document.getElementById('scanner-video');
  const statusEl = document.getElementById('scanner-status');
  const addressEl = document.getElementById('scanner-address');

  if (addressEl && currentWallet) {
    addressEl.textContent = `${currentWallet.address.slice(0, 8)}...${currentWallet.address.slice(-6)}`;
  }

  updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran');

  if (qrScanner) qrScanner.stop();

  qrScanner = createQRScanner(
    video,
    (rawQR) => handleQRScanned(rawQR, statusEl),
    (err) => {
      console.error('QR scanner error:', err);
      updateStatus(statusEl, '❌ Erreur caméra. Vérifiez les permissions.', true);
    }
  );

  qrScanner.start();

  // Lock button
  const btnLock = document.getElementById('btn-lock');
  btnLock?.addEventListener('click', () => {
    lockWallet();
  });
}

async function handleQRScanned(rawQR, statusEl) {
  const parsed = parseQRCode(rawQR);

  if (!parsed) {
    updateStatus(statusEl, '❌ QR code non reconnu. Réessayez.', true);
    setTimeout(() => {
      updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran');
      qrScanner?.start();
    }, 2000);
    return;
  }

  try {
    // Fetch challenge from relay
    updateStatus(statusEl, 'Récupération de la demande...');
    const challenge = await fetchChallenge(parsed.challengeId);

    if (challenge.type === 'connect') {
      await handleConnect(challenge, statusEl);
    } else if (challenge.type === 'sign') {
      await handleSign(challenge, statusEl);
    }
  } catch (err) {
    console.error('QR handling error:', err);
    updateStatus(statusEl, `❌ ${err.message}`, true);
    setTimeout(() => {
      updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran');
      qrScanner?.start();
    }, 3000);
  }
}

// ==========================================
// CONNECT FLOW
// ==========================================

async function handleConnect(challenge, statusEl) {
  updateStatus(statusEl, 'Connexion en cours...');

  // For connect, we just prove we own the address
  const proof = {
    address: currentWallet.address,
    publicKey: currentWallet.publicKey,
    signature: '', // Connect doesn't need a crypto signature — the WebAuthn already proved presence
  };

  await submitConnect(challenge.challengeId, proof);

  showSuccess('Connecté !', `Wallet ${currentWallet.address.slice(0, 8)}... relié à Xcannes.`);

  // Return to scanner after delay
  setTimeout(() => {
    showScreen('scanner');
    qrScanner?.start();
  }, 3000);
}

// ==========================================
// SIGN FLOW
// ==========================================

async function handleSign(challenge, statusEl) {
  updateStatus(statusEl, `Demande de signature: ${challenge.action || 'Transaction'}`);

  // Show transaction details to user
  const txDetails = formatTxDetails(challenge.txjson);
  const detailsEl = document.getElementById('scanner-tx-details');
  if (detailsEl) {
    detailsEl.textContent = txDetails;
    detailsEl.classList.remove('hidden');
  }

  // Require biometric confirmation for signing
  updateStatus(statusEl, 'Confirmez avec Face ID / Touch ID...');

  const walletData = await getLastUsedWallet();
  try {
    const signature = await promptBiometric(walletData.credentialId);
    // Biometric confirmed — sign the transaction
  } catch (err) {
    updateStatus(statusEl, 'Signature annulée.', true);
    if (detailsEl) detailsEl.classList.add('hidden');
    setTimeout(() => {
      updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran');
      qrScanner?.start();
    }, 2000);
    return;
  }

  updateStatus(statusEl, 'Signature en cours...');

  // Sign locally with xrpl.js  
  const { tx_blob, hash } = signTransaction(currentWallet.wallet, challenge.txjson);

  updateStatus(statusEl, 'Envoi de la transaction...');

  // Submit signed blob to relay → XRPL
  const result = await submitTransaction(challenge.challengeId, {
    tx_blob,
    hash,
    address: currentWallet.address,
  });

  if (detailsEl) detailsEl.classList.add('hidden');

  if (result.success) {
    showSuccess('Transaction signée ✓', `Hash: ${hash.slice(0, 12)}...`);
  } else {
    showError(`Erreur XRPL: ${result.txResult?.resultCode || 'Unknown'}`);
  }

  // Return to scanner
  setTimeout(() => {
    showScreen('scanner');
    updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran');
    qrScanner?.start();
  }, 4000);
}

// ==========================================
// HELPERS
// ==========================================

function lockWallet() {
  if (currentWallet) {
    clearWalletFromMemory(currentWallet);
    currentWallet = null;
  }
  isUnlocked = false;
  if (qrScanner) qrScanner.stop();
  showScreen('unlock');
  setupUnlockScreen();
}

function showSuccess(title, message) {
  showScreen('success');
  const titleEl = document.getElementById('success-title');
  const msgEl = document.getElementById('success-message');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
}

function showError(message) {
  showScreen('error');
  const msgEl = document.getElementById('error-message');
  if (msgEl) msgEl.textContent = message;

  const btnRetry = document.getElementById('btn-error-retry');
  btnRetry?.addEventListener('click', () => init());
}

function updateStatus(el, text, isError = false) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function formatTxDetails(txjson) {
  if (!txjson) return '';
  const type = txjson.TransactionType || 'Unknown';
  const dest = txjson.Destination ? ` → ${txjson.Destination.slice(0, 8)}...` : '';
  const amount = txjson.Amount ? ` | ${typeof txjson.Amount === 'string' ? (Number(txjson.Amount) / 1000000).toFixed(2) + ' XRP' : txjson.Amount.value + ' ' + txjson.Amount.currency}` : '';
  return `${type}${dest}${amount}`;
}

// --- Auto-init ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
