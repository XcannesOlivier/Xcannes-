/**
 * Xcannes Wallet — Main App (PWA)
 *
 * Xumm-style onboarding flow:
 *   Splash → Welcome → Terms → Biometric Check → Choice (Create / Import)
 *   → Create: Generate → Face ID → Mnemonic Backup → Verify 3 words → Home
 *   → Import: Mnemonic (BIP39) / Seed / Secret Numbers → Face ID → Home
 *   Returning user: Unlock (Face ID) → Home
 *
 * Vanilla JS — no framework dependency, minimal footprint.
 */

import { generateWallet, walletFromSeed, walletFromMnemonic, walletFromSecretNumbers, signTransaction, signChallenge, clearWalletFromMemory, isValidSeed } from '../services/walletService.js';
import { encryptSeed, decryptSeed } from '../services/cryptoService.js';
import { registerBiometric, promptBiometric, isBiometricAvailable } from '../services/webauthnService.js';
import { saveWallet, getLastUsedWallet, hasWallets, saveSetting, getSetting } from '../services/storageService.js';
import { createQRScanner, parseQRCode } from '../services/qrService.js';
import { setRelayUrl, fetchChallenge, submitConnect, submitTransaction, pingRelay } from '../services/relayService.js';

// --- Production: silence console ---
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  console.error = () => {};
  console.log = () => {};
  console.warn = () => {};
}

// --- State ---
let currentWallet = null;  // { address, wallet (xrpl instance), publicKey }
let isUnlocked = false;
let pendingMnemonic = null; // Held in memory during onboarding backup flow
let pendingWalletData = null; // { address, seed, publicKey, mnemonic }

// --- Auto-lock ---
const AUTO_LOCK_MS = 5 * 60 * 1000;
let inactivityTimer = null;

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (!isUnlocked) return;
  inactivityTimer = setTimeout(() => {
    if (isUnlocked) lockWallet();
  }, AUTO_LOCK_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && isUnlocked) lockWallet();
});

['touchstart', 'mousedown', 'keydown', 'scroll'].forEach(evt => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// --- Config ---
const RELAY_URL = window.__XCANNES_RELAY_URL__ || (() => {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  if (port === '3001') return `${proto}//${host}:${port}`;
  if (host === 'localhost' || host === '127.0.0.1') return `${proto}//${host}:3001`;
  return '';
})();
setRelayUrl(RELAY_URL);

// --- Settings keys ---
const SETTING_ONBOARDED = 'onboarding_complete';
const SETTING_TERMS_ACCEPTED = 'terms_accepted';

// ==========================================
// SCREEN MANAGEMENT
// ==========================================

function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(`screen-${screenName}`);
  if (el) el.classList.remove('hidden');
}

function updateStatus(el, text, isError = false) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', isError);
}

// ==========================================
// 1. SPLASH → INIT
// ==========================================

export async function init() {
  showScreen('splash');

  // Animated splash for 1.8s, then route
  await delay(1800);

  // Returning user with wallet → unlock
  const existingWallets = await hasWallets();
  if (existingWallets) {
    const onboarded = await getSetting(SETTING_ONBOARDED);
    if (onboarded) {
      showScreen('unlock');
      setupUnlockScreen();
      return;
    }
  }

  // First-time user → welcome
  showScreen('welcome');
  setupWelcomeScreen();
}

// ==========================================
// 2. WELCOME
// ==========================================

function setupWelcomeScreen() {
  const btn = document.getElementById('btn-welcome-continue');
  btn?.addEventListener('click', () => {
    showScreen('terms');
    setupTermsScreen();
  }, { once: true });
}

// ==========================================
// 3. TERMS
// ==========================================

function setupTermsScreen() {
  const checkbox = document.getElementById('terms-agree');
  const btnAccept = document.getElementById('btn-terms-accept');
  const btnBack = document.getElementById('btn-terms-back');

  const toggle = () => {
    btnAccept.disabled = !checkbox.checked;
  };
  checkbox?.addEventListener('change', toggle);

  btnBack?.addEventListener('click', () => {
    showScreen('welcome');
    setupWelcomeScreen();
  }, { once: true });

  btnAccept?.addEventListener('click', async () => {
    await saveSetting(SETTING_TERMS_ACCEPTED, Date.now());
    showScreen('biometric-check');
    setupBiometricCheckScreen();
  }, { once: true });
}

// ==========================================
// 4. BIOMETRIC CHECK
// ==========================================

async function setupBiometricCheckScreen() {
  const statusEl = document.getElementById('biometric-status');
  const spinner = document.getElementById('biometric-spinner');
  const btn = document.getElementById('btn-biometric-continue');

  spinner?.classList.remove('hidden');
  updateStatus(statusEl, 'Vérification de votre appareil…');

  const biometricOk = await isBiometricAvailable();

  spinner?.classList.add('hidden');

  if (!biometricOk) {
    updateStatus(statusEl, '❌ Face ID / Touch ID non disponible sur ce navigateur.', true);
    btn.textContent = 'Réessayer';
    btn.disabled = false;
    btn.addEventListener('click', () => {
      setupBiometricCheckScreen();
    }, { once: true });
    return;
  }

  updateStatus(statusEl, '✅ Face ID / Touch ID disponible');
  btn.textContent = 'Continuer';
  btn.disabled = false;
  btn.addEventListener('click', () => {
    showScreen('choice');
    setupChoiceScreen();
  }, { once: true });
}

// ==========================================
// 5. CHOICE — Create or Import
// ==========================================

function setupChoiceScreen() {
  const btnCreate = document.getElementById('btn-create-wallet');
  const btnImport = document.getElementById('btn-import-wallet');

  btnCreate?.addEventListener('click', () => startCreateWallet(), { once: true });
  btnImport?.addEventListener('click', () => {
    showScreen('import');
    setupImportScreen();
  }, { once: true });
}

// ==========================================
// 6. CREATE WALLET
// ==========================================

async function startCreateWallet() {
  showScreen('creating');
  const statusEl = document.getElementById('creating-status');

  try {
    updateStatus(statusEl, 'Génération des clés…');
    await delay(400); // UX: let screen paint

    // 1. Generate wallet locally (BIP39 mnemonic → XRPL wallet)
    const walletData = await generateWallet();
    updateStatus(statusEl, 'Enregistrement Face ID / Touch ID…');

    // 2. Register biometric
    const { credentialId, signature } = await registerBiometric(walletData.address);

    updateStatus(statusEl, 'Chiffrement et sauvegarde…');

    // 3. Encrypt mnemonic (stored as "seed" in IndexedDB for backward compat)
    const encryptedSeed = await encryptSeed(walletData.seed, signature);

    // 4. Save to IndexedDB
    await saveWallet({
      address: walletData.address,
      credentialId,
      encryptedSeed,
    });

    // 5. Hold mnemonic in memory for backup flow
    pendingMnemonic = walletData.mnemonic;
    pendingWalletData = walletData;

    // 6. Show backup screen
    showScreen('backup');
    setupBackupScreen(walletData);

  } catch (err) {
    showError(`Erreur lors de la création : ${err.message}`);
  }
}

// ==========================================
// 7. BACKUP — Show Mnemonic
// ==========================================

function setupBackupScreen(walletData) {
  const grid = document.getElementById('mnemonic-grid');
  const addressEl = document.getElementById('backup-address');
  const btnContinue = document.getElementById('btn-backup-continue');
  const btnRegenerate = document.getElementById('btn-backup-regenerate');

  // Parse BIP39 mnemonic into words
  const words = walletData.mnemonic.trim().split(/\s+/);

  // Render 12-word grid
  grid.innerHTML = '';
  words.forEach((word, i) => {
    const div = document.createElement('div');
    div.className = 'mnemonic-word';
    div.innerHTML = `
      <span class="mnemonic-num">${i + 1}</span>
      <span class="mnemonic-text">${word}</span>
    `;
    grid.appendChild(div);
  });

  if (addressEl) addressEl.textContent = walletData.address;

  // --- Regenerate: generate a brand new mnemonic + wallet ---
  btnRegenerate?.addEventListener('click', async () => {
    btnRegenerate.disabled = true;
    btnRegenerate.textContent = '⏳ Génération…';

    try {
      // 1. New wallet
      const newWalletData = await generateWallet();

      // 2. Re-register biometric for new address
      const { credentialId, signature } = await registerBiometric(newWalletData.address);

      // 3. Re-encrypt new mnemonic
      const encryptedSeed = await encryptSeed(newWalletData.seed, signature);

      // 4. Overwrite in IndexedDB
      await saveWallet({
        address: newWalletData.address,
        credentialId,
        encryptedSeed,
      });

      // 5. Update in-memory refs
      pendingMnemonic = newWalletData.mnemonic;
      pendingWalletData = newWalletData;

      // 6. Re-render this screen with new data
      btnRegenerate.disabled = false;
      btnRegenerate.textContent = '🔄 Nouvelle liste';
      setupBackupScreen(newWalletData);

    } catch (err) {
      btnRegenerate.disabled = false;
      btnRegenerate.textContent = '🔄 Nouvelle liste';
      showError(`Erreur : ${err.message}`);
    }
  }, { once: true });

  btnContinue?.addEventListener('click', () => {
    showScreen('backup-verify');
    setupBackupVerifyScreen(words);
  }, { once: true });
}

// ==========================================
// 8. BACKUP — Verify ALL 12 Words (sequential)
// ==========================================

function setupBackupVerifyScreen(words) {
  const container = document.getElementById('verify-sequential');
  const statusEl = document.getElementById('verify-status');
  const progressText = document.getElementById('verify-progress-text');
  const progressFill = document.getElementById('verify-progress-fill');
  const btnConfirm = document.getElementById('btn-verify-confirm');
  const btnBack = document.getElementById('btn-verify-back');

  let currentIndex = 0;

  // Render all 12 rows
  container.innerHTML = '';
  const rows = [];
  const inputs = [];

  words.forEach((word, i) => {
    const row = document.createElement('div');
    row.className = `verify-row ${i === 0 ? 'active' : 'locked'}`;
    row.innerHTML = `
      <span class="row-num">${i + 1}</span>
      <input class="row-input" type="text" autocomplete="off" autocorrect="off" 
             autocapitalize="off" spellcheck="false"
             placeholder="Mot #${i + 1}" ${i !== 0 ? 'disabled' : ''}>
      <span class="row-status"></span>
      <span class="row-error-msg">✖ Incorrect — vérifiez le mot #${i + 1}</span>
    `;
    container.appendChild(row);
    rows.push(row);
    inputs.push(row.querySelector('.row-input'));
  });

  updateProgress(0);

  function updateProgress(validated) {
    progressText.textContent = validated === 12
      ? '✅ 12 / 12 — Tous les mots sont corrects !'
      : `Mot ${validated + 1} / 12`;
    progressFill.style.width = `${(validated / 12) * 100}%`;
  }

  function activateRow(idx) {
    currentIndex = idx;
    rows.forEach((r, i) => {
      if (i < idx) {
        r.className = 'verify-row done';
        r.querySelector('.row-status').textContent = '✔';
      } else if (i === idx) {
        r.className = 'verify-row active';
        r.querySelector('.row-status').textContent = '';
        const inp = inputs[i];
        inp.disabled = false;
        inp.value = '';
        inp.focus();
        // Scroll row into view
        r.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        r.className = 'verify-row locked';
        r.querySelector('.row-status').textContent = '';
        inputs[i].disabled = true;
      }
    });
    updateProgress(idx);
    updateStatus(statusEl, '');
    btnConfirm.disabled = true;
  }

  // Handle input on each field
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      const val = inp.value.trim().toLowerCase();
      const expected = words[i].toLowerCase();
      const row = rows[i];

      // Clear error state while typing
      if (row.classList.contains('error')) {
        row.classList.remove('error');
        row.classList.add('active');
        row.querySelector('.row-status').textContent = '';
      }
    });

    // Validate on Enter key or blur
    const handleValidate = () => {
      if (i !== currentIndex) return;
      const val = inp.value.trim().toLowerCase();
      const expected = words[i].toLowerCase();
      const row = rows[i];

      if (!val) return; // Don't validate empty

      if (val === expected) {
        // Correct!
        row.className = 'verify-row done';
        row.querySelector('.row-status').textContent = '✔';
        row.querySelector('.row-error-msg').style.display = 'none';
        inp.disabled = true;

        if (i === 11) {
          // All 12 done!
          updateProgress(12);
          btnConfirm.disabled = false;
          updateStatus(statusEl, '');
        } else {
          // Advance to next
          activateRow(i + 1);
        }
      } else {
        // Wrong!
        row.className = 'verify-row error';
        row.querySelector('.row-status').textContent = '✖';
        updateStatus(statusEl, `❌ Le mot #${i + 1} est incorrect. Réessayez.`, true);
        // Select the text for easy re-typing
        inp.select();
      }
    };

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleValidate();
      }
    });

    // Also validate on blur (mobile: user taps elsewhere)
    inp.addEventListener('blur', () => {
      // Small delay to avoid conflict with Enter
      setTimeout(() => {
        if (i === currentIndex && inp.value.trim()) handleValidate();
      }, 100);
    });
  });

  // Focus first input
  setTimeout(() => inputs[0]?.focus(), 200);

  btnBack?.addEventListener('click', () => {
    showScreen('backup');
    setupBackupScreen(pendingWalletData);
  }, { once: true });

  btnConfirm?.addEventListener('click', async () => {
    // Clear mnemonic from memory
    pendingMnemonic = null;
    pendingWalletData = null;

    // Mark onboarding complete
    await saveSetting(SETTING_ONBOARDED, true);

    // Show success then go to home
    showSuccess('Wallet créé !', 'Votre wallet est prêt. Conservez votre phrase de récupération en lieu sûr.');
    await delay(2500);

    // Unlock and go home
    await unlockAndGoHome();
  }, { once: true });
}

// ==========================================
// 9. IMPORT
// ==========================================

function setupImportScreen() {
  const tabs = document.querySelectorAll('#import-tabs .tab');
  const panels = document.querySelectorAll('.tab-panel');
  const btnBack = document.getElementById('btn-import-back');
  const btnConfirm = document.getElementById('btn-import-confirm');
  const statusEl = document.getElementById('import-status');

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(`panel-${tab.dataset.tab}`);
      panel?.classList.add('active');
    });
  });

  // Auto-advance secret number inputs
  const snInputs = document.querySelectorAll('#secret-numbers-grid input');
  snInputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(0, 6);
      if (inp.value.length === 6 && i < snInputs.length - 1) {
        snInputs[i + 1].focus();
      }
    });
  });

  btnBack?.addEventListener('click', () => {
    showScreen('choice');
    setupChoiceScreen();
  }, { once: true });

  btnConfirm?.addEventListener('click', () => handleImport(statusEl), { once: true });
}

async function handleImport(statusEl) {
  const activeTab = document.querySelector('#import-tabs .tab.active')?.dataset.tab;

  try {
    let walletResult;
    let seedForStorage;

    if (activeTab === 'seed') {
      const seed = document.getElementById('import-seed-input')?.value?.trim();
      if (!seed) { updateStatus(statusEl, '❌ Veuillez entrer un seed.', true); rearmImport(statusEl); return; }
      if (!isValidSeed(seed)) { updateStatus(statusEl, '❌ Seed invalide. Format : sXXXX…', true); rearmImport(statusEl); return; }
      updateStatus(statusEl, 'Restauration…');
      walletResult = walletFromSeed(seed);
      seedForStorage = seed;

    } else if (activeTab === 'mnemonic') {
      const mnemonic = document.getElementById('import-mnemonic-input')?.value?.trim();
      if (!mnemonic) { updateStatus(statusEl, '❌ Veuillez entrer votre mnemonic.', true); rearmImport(statusEl); return; }
      const wordCount = mnemonic.split(/\s+/).length;
      if (wordCount !== 12) { updateStatus(statusEl, `❌ ${wordCount} mots détectés. Attendu : 12.`, true); rearmImport(statusEl); return; }
      updateStatus(statusEl, 'Restauration…');
      walletResult = walletFromMnemonic(mnemonic);
      // For mnemonic-based wallets, store the mnemonic itself as the "seed" since they don't have a traditional seed
      seedForStorage = mnemonic;

    } else if (activeTab === 'secretnumbers') {
      const inputs = document.querySelectorAll('#secret-numbers-grid input');
      const rows = [];
      let invalid = false;
      inputs.forEach(inp => {
        const val = inp.value.trim();
        if (val.length !== 6 || !/^\d{6}$/.test(val)) invalid = true;
        rows.push(val);
      });
      if (invalid) { updateStatus(statusEl, '❌ Toutes les rangées doivent contenir 6 chiffres.', true); rearmImport(statusEl); return; }
      updateStatus(statusEl, 'Restauration depuis Xumm…');
      const secretNumbers = rows.join(' ');
      walletResult = walletFromSecretNumbers(secretNumbers);
      // Secret numbers wallets: extract seed from the wallet instance
      seedForStorage = walletResult.wallet?.seed || secretNumbers;

    } else {
      updateStatus(statusEl, '❌ Onglet inconnu.', true);
      rearmImport(statusEl);
      return;
    }

    updateStatus(statusEl, 'Enregistrement Face ID / Touch ID…');
    const { credentialId, signature } = await registerBiometric(walletResult.address);

    updateStatus(statusEl, 'Chiffrement et sauvegarde…');
    const encryptedSeed = await encryptSeed(seedForStorage, signature);
    await saveWallet({
      address: walletResult.address,
      credentialId,
      encryptedSeed,
    });

    await saveSetting(SETTING_ONBOARDED, true);

    // Clear inputs
    document.getElementById('import-seed-input') && (document.getElementById('import-seed-input').value = '');
    document.getElementById('import-mnemonic-input') && (document.getElementById('import-mnemonic-input').value = '');
    document.querySelectorAll('#secret-numbers-grid input').forEach(inp => inp.value = '');

    showSuccess('Wallet importé !', `Adresse : ${walletResult.address.slice(0, 10)}…${walletResult.address.slice(-6)}`);
    await delay(2500);
    await unlockAndGoHome();

  } catch (err) {
    updateStatus(statusEl, `❌ ${err.message}`, true);
    rearmImport(statusEl);
  }
}

function rearmImport(statusEl) {
  // Re-attach the click handler since we used { once: true }
  const btn = document.getElementById('btn-import-confirm');
  btn?.addEventListener('click', () => handleImport(statusEl), { once: true });
}

// ==========================================
// 10. HOME SCREEN
// ==========================================

function setupHomeScreen() {
  const btnScan = document.getElementById('btn-scan');
  const btnLock = document.getElementById('btn-lock');

  if (currentWallet) {
    const addr = currentWallet.address;
    setText('home-address', addr);
    setText('home-wallet-label', 'Mon Wallet');
    setText('home-balance-amount', '0');

    // Check relay for balance
    checkBalance(addr);
  }

  btnScan?.addEventListener('click', () => {
    showScreen('scanner');
    setupScannerScreen();
  }, { once: true });

  btnLock?.addEventListener('click', () => lockWallet(), { once: true });
}

async function checkBalance(address) {
  try {
    const res = await fetch(`${RELAY_URL}/xumm/balance?address=${address}`);
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.xrp !== undefined) {
      // Account is activated
      setText('home-balance-amount', parseFloat(data.xrp).toFixed(2));
      document.getElementById('home-badge-inactive')?.classList.add('hidden');
      document.getElementById('home-badge-active')?.classList.remove('hidden');
      document.getElementById('activation-notice')?.classList.add('hidden');
    } else if (res.status === 404) {
      // Not activated
      setText('home-balance-amount', '0');
      document.getElementById('home-badge-inactive')?.classList.remove('hidden');
      document.getElementById('home-badge-active')?.classList.add('hidden');
      document.getElementById('activation-notice')?.classList.remove('hidden');
    }
  } catch {
    // Offline or error — keep defaults
  }
}

// ==========================================
// 11. UNLOCK SCREEN
// ==========================================

function setupUnlockScreen() {
  const btnUnlock = document.getElementById('btn-unlock');
  const addressEl = document.getElementById('unlock-address');

  getLastUsedWallet().then(wallet => {
    if (wallet && addressEl) {
      addressEl.textContent = `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`;
    }
  });

  btnUnlock?.addEventListener('click', () => doUnlock(), { once: true });

  // Auto-trigger biometric after short delay
  setTimeout(() => doUnlock(), 600);
}

async function doUnlock() {
  const statusEl = document.getElementById('unlock-status');

  try {
    updateStatus(statusEl, 'Authentification biométrique…');

    const walletData = await getLastUsedWallet();
    if (!walletData) {
      showScreen('welcome');
      setupWelcomeScreen();
      return;
    }

    const prfOutput = await promptBiometric(walletData.credentialId);

    updateStatus(statusEl, 'Déverrouillage…');
    const seed = await decryptSeed(walletData.encryptedSeed, prfOutput);

    // Check if it's a mnemonic (contains spaces) or a seed
    let wallet, address, publicKey;
    if (seed.includes(' ')) {
      const result = walletFromMnemonic(seed);
      wallet = result.wallet;
      address = result.address;
      publicKey = result.publicKey;
    } else {
      const result = walletFromSeed(seed);
      wallet = result.wallet;
      address = result.address;
      publicKey = result.publicKey;
    }

    currentWallet = { wallet, address, publicKey };
    isUnlocked = true;

    updateStatus(statusEl, '');
    showScreen('home');
    setupHomeScreen();
    resetInactivityTimer();

  } catch (err) {
    if (err.name === 'NotAllowedError') {
      updateStatus(statusEl, 'Authentification annulée. Réessayez.', true);
    } else {
      updateStatus(statusEl, `Erreur : ${err.message}`, true);
    }
    // Re-arm button
    const btn = document.getElementById('btn-unlock');
    btn?.addEventListener('click', () => doUnlock(), { once: true });
  }
}

async function unlockAndGoHome() {
  try {
    const walletData = await getLastUsedWallet();
    if (!walletData) return;

    const prfOutput = await promptBiometric(walletData.credentialId);
    const seed = await decryptSeed(walletData.encryptedSeed, prfOutput);

    let wallet, address, publicKey;
    if (seed.includes(' ')) {
      const result = walletFromMnemonic(seed);
      wallet = result.wallet;
      address = result.address;
      publicKey = result.publicKey;
    } else {
      const result = walletFromSeed(seed);
      wallet = result.wallet;
      address = result.address;
      publicKey = result.publicKey;
    }

    currentWallet = { wallet, address, publicKey };
    isUnlocked = true;

    showScreen('home');
    setupHomeScreen();
    resetInactivityTimer();
  } catch (err) {
    // If biometric fails, go to unlock screen
    showScreen('unlock');
    setupUnlockScreen();
  }
}

// ==========================================
// 12. SCANNER SCREEN
// ==========================================

let qrScanner = null;

function setupScannerScreen() {
  const video = document.getElementById('scanner-video');
  const statusEl = document.getElementById('scanner-status');
  const addressEl = document.getElementById('scanner-address');
  const btnBack = document.getElementById('btn-scanner-back');
  const btnLock = document.getElementById('btn-scanner-lock');

  if (addressEl && currentWallet) {
    addressEl.textContent = `${currentWallet.address.slice(0, 8)}…${currentWallet.address.slice(-6)}`;
  }

  updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran');

  if (qrScanner) qrScanner.stop();

  qrScanner = createQRScanner(
    video,
    (rawQR) => handleQRScanned(rawQR, statusEl),
    (err) => updateStatus(statusEl, '❌ Erreur caméra. Vérifiez les permissions.', true)
  );

  qrScanner.start();

  btnBack?.addEventListener('click', () => {
    if (qrScanner) qrScanner.stop();
    showScreen('home');
    setupHomeScreen();
  }, { once: true });

  btnLock?.addEventListener('click', () => {
    if (qrScanner) qrScanner.stop();
    lockWallet();
  }, { once: true });
}

async function handleQRScanned(rawQR, statusEl) {
  const parsed = parseQRCode(rawQR);

  if (!parsed) {
    updateStatus(statusEl, '❌ QR code non reconnu.', true);
    setTimeout(() => {
      updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran');
      qrScanner?.start();
    }, 2000);
    return;
  }

  try {
    updateStatus(statusEl, 'Récupération de la demande…');
    const challenge = await fetchChallenge(parsed.challengeId);

    if (challenge.type === 'connect') {
      await handleConnect(challenge, statusEl);
    } else if (challenge.type === 'sign') {
      await handleSign(challenge, statusEl);
    }
  } catch (err) {
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
  updateStatus(statusEl, 'Connexion en cours…');

  const challengeHex = challenge.challenge || challenge.challengeId;
  const { signature } = signChallenge(currentWallet.wallet, challengeHex);

  await submitConnect(challenge.challengeId, {
    address: currentWallet.address,
    publicKey: currentWallet.publicKey,
    signature,
  });

  showSuccess('Connecté !', `Wallet ${currentWallet.address.slice(0, 8)}… lié à Xcannes.`);

  setTimeout(() => {
    showScreen('home');
    setupHomeScreen();
  }, 3000);
}

// ==========================================
// SIGN FLOW
// ==========================================

async function handleSign(challenge, statusEl) {
  updateStatus(statusEl, `Signature : ${challenge.action || 'Transaction'}`);

  const txDetails = formatTxDetails(challenge.txjson);
  const detailsEl = document.getElementById('scanner-tx-details');
  if (detailsEl) {
    detailsEl.textContent = txDetails;
    detailsEl.classList.remove('hidden');
  }

  // Require biometric confirmation
  updateStatus(statusEl, 'Confirmez avec Face ID / Touch ID…');

  const walletData = await getLastUsedWallet();
  try {
    await promptBiometric(walletData.credentialId);
  } catch {
    updateStatus(statusEl, 'Signature annulée.', true);
    if (detailsEl) detailsEl.classList.add('hidden');
    setTimeout(() => {
      updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran');
      qrScanner?.start();
    }, 2000);
    return;
  }

  updateStatus(statusEl, 'Signature en cours…');
  const { tx_blob, hash } = signTransaction(currentWallet.wallet, challenge.txjson);

  updateStatus(statusEl, 'Envoi de la transaction…');
  const result = await submitTransaction(challenge.challengeId, {
    tx_blob,
    hash,
    address: currentWallet.address,
  });

  if (detailsEl) detailsEl.classList.add('hidden');

  if (result.success) {
    showSuccess('Transaction signée ✓', `Hash: ${hash.slice(0, 12)}…`);
  } else {
    showError(`Erreur XRPL: ${result.txResult?.resultCode || 'Inconnue'}`);
  }

  setTimeout(() => {
    showScreen('home');
    setupHomeScreen();
  }, 4000);
}

// ==========================================
// HELPERS
// ==========================================

function lockWallet() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (currentWallet) {
    clearWalletFromMemory(currentWallet);
    currentWallet = null;
  }
  isUnlocked = false;
  pendingMnemonic = null;
  pendingWalletData = null;
  if (qrScanner) qrScanner.stop();
  showScreen('unlock');
  setupUnlockScreen();
}

function showSuccess(title, message) {
  showScreen('success');
  setText('success-title', title);
  setText('success-message', message);
}

function showError(message) {
  showScreen('error');
  setText('error-message', message);

  const btn = document.getElementById('btn-error-retry');
  btn?.addEventListener('click', () => init(), { once: true });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTxDetails(txjson) {
  if (!txjson) return '';
  const type = txjson.TransactionType || 'Unknown';
  const dest = txjson.Destination ? ` → ${txjson.Destination.slice(0, 8)}…` : '';
  const amount = txjson.Amount
    ? typeof txjson.Amount === 'string'
      ? ` | ${(Number(txjson.Amount) / 1000000).toFixed(2)} XRP`
      : ` | ${txjson.Amount.value} ${txjson.Amount.currency}`
    : '';
  return `${type}${dest}${amount}`;
}

// --- Auto-init ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
