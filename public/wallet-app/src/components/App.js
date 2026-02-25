/**
 * Xcannes Wallet — Main App (PWA)
 *
 * Architecture: App-level master key + multi-wallet
 *
 * First launch:
 *   Splash → Welcome → Terms → PIN Creation → Choice (Create / Import)
 *   → Create: Generate → Mnemonic Backup → Verify → Optional Face ID → Home
 *   → Import: Mnemonic/Seed/SecretNumbers → Home
 *
 * Returning user:
 *   Splash → Face ID (instant) or PIN → Home (wallet list)
 *
 * Auth: PIN derives a master AES-256-GCM key. All wallets are encrypted with the same master key.
 *        Face ID wraps/unwraps the master key via WebAuthn PRF.
 *
 * Vanilla JS — no framework dependency, minimal footprint.
 */

import { generateWallet, walletFromSeed, walletFromMnemonic, walletFromSecretNumbers, signTransaction, signChallenge, clearWalletFromMemory, isValidSeed } from '../services/walletService.js';
import { registerBiometric, promptBiometric, isBiometricAvailable } from '../services/webauthnService.js';
import {
  saveWallet, getWallet, getAllWallets, getLastUsedWallet, hasWallets, deleteWallet, touchWallet,
  saveSetting,
  saveAuthConfig, getAuthConfig, isAppSetup,
  clearAllData,
} from '../services/storageService.js';
import {
  deriveKeyFromPIN, createPINVerifyHash, verifyPIN,
  encryptWithMasterKey, decryptWithMasterKey,
  wrapMasterKeyWithPRF, unwrapMasterKeyWithPRF,
  generateSalt, checkPINLockout, getNextLockoutDelay,
  getMasterKey, setMasterKey, clearMasterKey,
  base64ToUint8Array,
} from '../services/pinService.js';
import { createQRScanner, parseQRCode } from '../services/qrService.js';
import { setRelayUrl, fetchChallenge, submitConnect, submitTransaction } from '../services/relayService.js';

// --- Production: silence console (keep error for critical failures) ---
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  console.log = () => {};
  console.warn = () => {};
}

// --- State ---
let currentWallet = null;  // { address, wallet (xrpl instance), publicKey }
let isUnlocked = false;
let pendingMnemonic = null;
let pendingWalletData = null; // { address, seed, publicKey, mnemonic, wallet }

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

document.addEventListener('visibilitychange', async () => {
  if (document.hidden && isUnlocked) {
    lockWallet();
  } else if (!document.hidden && !isUnlocked) {
    // App came back — try Face ID auto-unlock if on unlock screen
    const unlockScreen = document.getElementById('screen-unlock');
    if (unlockScreen && !unlockScreen.classList.contains('hidden')) {
      try {
        const authConfig = await getAuthConfig();
        if (authConfig?.credentialId && authConfig?.wrappedMasterKey) {
          setTimeout(() => {
            const btn = document.getElementById('btn-unlock');
            if (btn && btn.style.display !== 'none') btn.click();
          }, 500);
        }
      } catch { /* ignore */ }
    }
    // For PIN screen — auto-focus input
    const pinScreen = document.getElementById('screen-pin-unlock');
    if (pinScreen && !pinScreen.classList.contains('hidden')) {
      setTimeout(() => {
        const pinInput = document.getElementById('pin-unlock-input');
        if (pinInput && !pinInput.disabled) pinInput.focus();
      }, 300);
    }
  }
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

  try {
    const appSetup = await isAppSetup();

    if (appSetup) {
      // Returning user — app has a PIN set up
      const authConfig = await getAuthConfig();

      // Try Face ID instant unlock if configured
      if (authConfig?.credentialId && authConfig?.wrappedMasterKey) {
        const unlockResult = await attemptInstantUnlock(authConfig);

        if (unlockResult.success) {
          await goToHome();
          return;
        }
        // Face ID failed — show unlock screen with retry + PIN fallback
        showScreen('unlock');
        setupUnlockScreenManual(unlockResult.error);
        return;
      }

      // PIN-only — show PIN screen after short splash
      await delay(800);
      showScreen('pin-unlock');
      setupEnterPINScreen();
      return;
    }

    // Check for legacy wallets (pre-master-key system)
    const hasLegacy = await hasWallets();
    if (hasLegacy) {
      await delay(800);
      showScreen('unlock');
      setupLegacyWalletScreen();
      return;
    }

    // First-time user → welcome
    await delay(1800);
    showScreen('welcome');
    setupWelcomeScreen();

  } catch (err) {
    console.error('[init] Critical error:', err);
    showScreen('welcome');
    setupWelcomeScreen();
  }
}

/**
 * Attempt instant Face ID unlock during splash.
 * Unwraps the master key using WebAuthn PRF.
 */
async function attemptInstantUnlock(authConfig) {
  try {
    if (!authConfig?.credentialId || !authConfig?.wrappedMasterKey) {
      return { success: false, error: 'no_faceid' };
    }

    const prfOutput = await promptBiometric(authConfig.credentialId);
    const masterKey = await unwrapMasterKeyWithPRF(authConfig.wrappedMasterKey, prfOutput);
    setMasterKey(masterKey);
    isUnlocked = true;

    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
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

  const toggle = () => { btnAccept.disabled = !checkbox.checked; };
  checkbox?.addEventListener('change', toggle);

  btnBack?.addEventListener('click', () => {
    showScreen('welcome');
    setupWelcomeScreen();
  }, { once: true });

  btnAccept?.addEventListener('click', async () => {
    await saveSetting(SETTING_TERMS_ACCEPTED, Date.now());
    // First-time: create PIN before anything else
    showScreen('pin-create');
    setupCreatePINScreen(async (pin) => {
      try {
        // Derive master key + save auth config
        const masterSalt = generateSalt();
        const verifySalt = generateSalt();
        const masterKey = await deriveKeyFromPIN(pin, base64ToUint8Array(masterSalt));
        const verifyHash = await createPINVerifyHash(pin, base64ToUint8Array(verifySalt));

        setMasterKey(masterKey);

        const authConfig = {
          masterSalt,
          verifySalt,
          verifyHash,
          credentialId: null,
          wrappedMasterKey: null,
          pinAttempts: 0,
          pinLockedUntil: 0,
        };
        await saveAuthConfig(authConfig);

        // Go directly to choice — Face ID will be offered after first wallet verification
        goToChoice();
      } catch (err) {
        showError(`Erreur : ${err.message}`);
      }
    });
  }, { once: true });
}

// ==========================================
// 4. CHOICE — Create or Import
// ==========================================

function goToChoice() {
  isUnlocked = true;
  showScreen('choice');
  setupChoiceScreen();
}

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
// 5. CREATE WALLET
// ==========================================

async function startCreateWallet() {
  showScreen('creating');
  const statusEl = document.getElementById('creating-status');

  try {
    updateStatus(statusEl, 'Génération des clés…');
    await delay(400);

    const walletData = await generateWallet();
    const walletInstance = walletFromMnemonic(walletData.mnemonic);
    pendingWalletData = { ...walletData, wallet: walletInstance.wallet };
    pendingMnemonic = walletData.mnemonic;

    // DO NOT save wallet yet — wait for mnemonic verification
    // Go to backup screen
    showScreen('backup');
    setupBackupScreen(pendingWalletData);

  } catch (err) {
    showError(`Erreur lors de la création : ${err.message}`);
  }
}

// ==========================================
// 6. BACKUP — Show Mnemonic
// ==========================================

function setupBackupScreen(walletData) {
  const grid = document.getElementById('mnemonic-grid');
  const addressEl = document.getElementById('backup-address');
  const btnContinue = document.getElementById('btn-backup-continue');
  const btnRegenerate = document.getElementById('btn-backup-regenerate');

  const words = walletData.mnemonic.trim().split(/\s+/);

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

  btnRegenerate?.addEventListener('click', async () => {
    btnRegenerate.disabled = true;
    btnRegenerate.textContent = '⏳ Génération…';
    try {
      // Generate new wallet (in memory only — not saved until verified)
      const newWalletData = await generateWallet();
      const newWalletInstance = walletFromMnemonic(newWalletData.mnemonic);

      pendingMnemonic = newWalletData.mnemonic;
      pendingWalletData = { ...newWalletData, wallet: newWalletInstance.wallet };

      btnRegenerate.disabled = false;
      btnRegenerate.textContent = '🔄 Nouvelle liste';
      showScreen('backup');
      setupBackupScreen(pendingWalletData);
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
// 7. BACKUP — Verify ALL 12 Words
// ==========================================

function setupBackupVerifyScreen(words) {
  const container = document.getElementById('verify-sequential');
  const statusEl = document.getElementById('verify-status');
  const progressText = document.getElementById('verify-progress-text');
  const progressFill = document.getElementById('verify-progress-fill');
  const btnConfirm = document.getElementById('btn-verify-confirm');
  const btnBack = document.getElementById('btn-verify-back');

  let currentIndex = 0;
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

  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      const row = rows[i];
      if (row.classList.contains('error')) {
        row.classList.remove('error');
        row.classList.add('active');
        row.querySelector('.row-status').textContent = '';
      }
    });

    const handleValidate = () => {
      if (i !== currentIndex) return;
      const val = inp.value.trim().toLowerCase();
      const expected = words[i].toLowerCase();
      const row = rows[i];
      if (!val) return;

      if (val === expected) {
        row.className = 'verify-row done';
        row.querySelector('.row-status').textContent = '✔';
        row.querySelector('.row-error-msg').style.display = 'none';
        // Mask the validated word with asterisks
        inp.value = '•'.repeat(expected.length);
        inp.disabled = true;

        if (i === 11) {
          updateProgress(12);
          btnConfirm.disabled = false;
          updateStatus(statusEl, '');
        } else {
          activateRow(i + 1);
        }
      } else {
        row.className = 'verify-row error';
        row.querySelector('.row-status').textContent = '✖';
        updateStatus(statusEl, `❌ Le mot #${i + 1} est incorrect. Réessayez.`, true);
        inp.select();
      }
    };

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleValidate(); }
    });
    inp.addEventListener('blur', () => {
      setTimeout(() => { if (i === currentIndex && inp.value.trim()) handleValidate(); }, 100);
    });
  });

  setTimeout(() => inputs[0]?.focus(), 200);

  btnBack?.addEventListener('click', () => {
    showScreen('backup');
    setupBackupScreen(pendingWalletData);
  }, { once: true });

  btnConfirm?.addEventListener('click', async () => {
    try {
      // Verification complete — NOW encrypt and save the wallet
      const masterKey = getMasterKey();
      const encryptedSeed = await encryptWithMasterKey(pendingWalletData.seed, masterKey);

      await saveWallet({
        address: pendingWalletData.address,
        encryptedSeed,
        label: null,
      });

      await saveSetting(SETTING_ONBOARDED, true);

      // Set wallet in memory
      currentWallet = {
        wallet: pendingWalletData.wallet,
        address: pendingWalletData.address,
        publicKey: pendingWalletData.publicKey,
      };
      isUnlocked = true;
      await touchWallet(currentWallet.address);
      pendingMnemonic = null;
      pendingWalletData = null;

      // Offer Face ID if not yet configured
      const authConfig = await getAuthConfig();
      if (!authConfig?.credentialId) {
        const biometricOk = await isBiometricAvailable();
        if (biometricOk) {
          showScreen('faceid-setup');
          setupEnableFaceIDScreen(async () => {
            showSuccess('Wallet créé !', 'Votre wallet est prêt. Conservez votre phrase de récupération en lieu sûr.');
            await delay(2500);
            await goToHome();
          });
          return;
        }
      }

      showSuccess('Wallet créé !', 'Votre wallet est prêt. Conservez votre phrase de récupération en lieu sûr.');
      await delay(2500);
      await goToHome();
    } catch (err) {
      showError(`Erreur lors de la sauvegarde : ${err.message}`);
    }
  }, { once: true });
}

// ==========================================
// 8. IMPORT
// ==========================================

let importWordCount = 12;

function setupImportScreen() {
  const tabs = document.querySelectorAll('#import-tabs .tab');
  const panels = document.querySelectorAll('.tab-panel');
  const btnBack = document.getElementById('btn-import-back');
  const btnConfirm = document.getElementById('btn-import-confirm');
  const statusEl = document.getElementById('import-status');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`)?.classList.add('active');
    });
  });

  // Build mnemonic grid
  buildMnemonicImportGrid(importWordCount);

  // 12/24 toggle
  const toggleBtns = document.querySelectorAll('.word-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      importWordCount = parseInt(btn.dataset.words, 10);
      buildMnemonicImportGrid(importWordCount);
    });
  });

  const snInputs = document.querySelectorAll('#secret-numbers-grid input');
  snInputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(0, 6);
      if (inp.value.length === 6 && i < snInputs.length - 1) snInputs[i + 1].focus();
    });
  });

  btnBack?.addEventListener('click', () => {
    showScreen('choice');
    setupChoiceScreen();
  }, { once: true });

  btnConfirm?.addEventListener('click', () => handleImport(statusEl), { once: true });
}

function buildMnemonicImportGrid(count) {
  const grid = document.getElementById('import-mnemonic-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'import-word-cell';
    cell.innerHTML = `
      <span class="import-word-num">${i + 1}</span>
      <input class="import-word-input" type="text"
             autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
             placeholder="mot ${i + 1}" data-index="${i}">
    `;
    grid.appendChild(cell);
  }

  // Auto-advance on space or tab
  const inputs = grid.querySelectorAll('.import-word-input');
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      // If user pastes all words at once
      const val = inp.value.trim();
      if (val.includes(' ')) {
        const words = val.split(/\s+/).filter(Boolean);
        words.forEach((w, j) => {
          if (inputs[i + j]) inputs[i + j].value = w;
        });
        const nextIdx = Math.min(i + words.length, inputs.length - 1);
        inputs[nextIdx].focus();
        return;
      }
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        if (i < inputs.length - 1) inputs[i + 1].focus();
      }
      if (e.key === 'Backspace' && inp.value === '' && i > 0) {
        e.preventDefault();
        inputs[i - 1].focus();
      }
    });
  });

  setTimeout(() => inputs[0]?.focus(), 100);
}

async function handleImport(statusEl) {
  const activeTab = document.querySelector('#import-tabs .tab.active')?.dataset.tab;

  try {
    let walletResult, seedForStorage;

    if (activeTab === 'seed') {
      const seed = document.getElementById('import-seed-input')?.value?.trim();
      if (!seed) { updateStatus(statusEl, '❌ Veuillez entrer un seed.', true); rearmImport(statusEl); return; }
      if (!isValidSeed(seed)) { updateStatus(statusEl, '❌ Seed invalide. Format : sXXXX…', true); rearmImport(statusEl); return; }
      updateStatus(statusEl, 'Restauration…');
      walletResult = walletFromSeed(seed);
      seedForStorage = seed;

    } else if (activeTab === 'mnemonic') {
      const inputs = document.querySelectorAll('#import-mnemonic-grid .import-word-input');
      const words = [];
      let emptyCount = 0;
      inputs.forEach(inp => {
        const w = inp.value.trim().toLowerCase();
        if (!w) emptyCount++;
        words.push(w);
      });
      if (emptyCount > 0) { updateStatus(statusEl, `❌ ${emptyCount} mot${emptyCount > 1 ? 's' : ''} manquant${emptyCount > 1 ? 's' : ''}.`, true); rearmImport(statusEl); return; }
      const mnemonic = words.join(' ');
      updateStatus(statusEl, 'Restauration…');
      walletResult = walletFromMnemonic(mnemonic);
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
      seedForStorage = walletResult.wallet?.seed || secretNumbers;

    } else {
      updateStatus(statusEl, '❌ Onglet inconnu.', true);
      rearmImport(statusEl);
      return;
    }

    // Clear inputs
    document.getElementById('import-seed-input') && (document.getElementById('import-seed-input').value = '');
    document.querySelectorAll('#import-mnemonic-grid .import-word-input').forEach(inp => inp.value = '');
    document.querySelectorAll('#secret-numbers-grid input').forEach(inp => inp.value = '');

    // Encrypt with master key
    const masterKey = getMasterKey();
    const encryptedSeed = await encryptWithMasterKey(seedForStorage, masterKey);

    // Save wallet
    await saveWallet({
      address: walletResult.address,
      encryptedSeed,
      label: null,
    });

    await saveSetting(SETTING_ONBOARDED, true);

    // Set as current wallet
    currentWallet = {
      wallet: walletResult.wallet,
      address: walletResult.address,
      publicKey: walletResult.publicKey,
    };
    isUnlocked = true;
    await touchWallet(currentWallet.address);

    showSuccess('Wallet importé !', `Adresse : ${walletResult.address.slice(0, 10)}…${walletResult.address.slice(-6)}`);
    await delay(2500);
    await goToHome();

  } catch (err) {
    updateStatus(statusEl, `❌ ${err.message}`, true);
    rearmImport(statusEl);
  }
}

function rearmImport(statusEl) {
  const btn = document.getElementById('btn-import-confirm');
  btn?.addEventListener('click', () => handleImport(statusEl), { once: true });
}

// ==========================================
// 9. HOME SCREEN (Multi-wallet)
// ==========================================

async function goToHome() {
  // Load last used wallet if not already set
  if (!currentWallet) {
    const wallets = await getAllWallets();
    if (wallets.length > 0) {
      const lastUsed = wallets.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))[0];
      const masterKey = getMasterKey();
      try {
        const seed = await decryptWithMasterKey(lastUsed.encryptedSeed, masterKey);
        let w;
        if (seed.includes(' ')) { w = walletFromMnemonic(seed); } else { w = walletFromSeed(seed); }
        currentWallet = { wallet: w.wallet, address: w.address, publicKey: w.publicKey };
      } catch {
        // Cannot decrypt — show choice
        showScreen('choice');
        setupChoiceScreen();
        return;
      }
    }
  }

  showScreen('home');
  setupHomeScreen();
  resetInactivityTimer();
}

function setupHomeScreen() {
  const btnScan = document.getElementById('btn-scan');
  const btnLock = document.getElementById('btn-lock');
  const btnAddWallet = document.getElementById('btn-add-wallet');

  if (currentWallet) {
    const addr = currentWallet.address;
    setText('home-address', addr);
    setText('home-wallet-label', 'Mon Wallet');
    setText('home-balance-amount', '0');
    checkBalance(addr);
  }

  // Render wallet list
  renderWalletList();

  btnScan?.addEventListener('click', () => {
    showScreen('scanner');
    setupScannerScreen();
  }, { once: true });

  btnLock?.addEventListener('click', () => lockWallet(), { once: true });

  // Add wallet button
  if (btnAddWallet) {
    const freshBtn = btnAddWallet.cloneNode(true);
    btnAddWallet.replaceWith(freshBtn);
    document.getElementById('btn-add-wallet')?.addEventListener('click', () => {
      showScreen('choice');
      setupChoiceScreen();
    }, { once: true });
  }
}

/**
 * Render the wallet list at the bottom of the home screen.
 * Highlights the active wallet, shows all wallets, allows switching.
 */
async function renderWalletList() {
  const container = document.getElementById('wallet-list');
  if (!container) return;

  const wallets = await getAllWallets();
  container.innerHTML = '';

  if (wallets.length <= 1) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  // Sort by lastUsedAt desc
  wallets.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));

  wallets.forEach((w) => {
    const isActive = currentWallet && w.address === currentWallet.address;
    const item = document.createElement('div');
    item.className = `wallet-list-item${isActive ? ' active' : ''}`;
    item.innerHTML = `
      <div class="wl-info">
        <span class="wl-label">${w.label || 'Wallet'}</span>
        <span class="wl-address">${w.address.slice(0, 8)}…${w.address.slice(-6)}</span>
      </div>
      ${isActive ? '<span class="wl-active-badge">●</span>' : ''}
    `;

    if (!isActive) {
      item.addEventListener('click', () => switchWallet(w.address));
    }

    container.appendChild(item);
  });
}

async function switchWallet(address) {
  try {
    const walletData = await getWallet(address);
    if (!walletData) return;

    const masterKey = getMasterKey();
    const seed = await decryptWithMasterKey(walletData.encryptedSeed, masterKey);

    let w;
    if (seed.includes(' ')) { w = walletFromMnemonic(seed); } else { w = walletFromSeed(seed); }

    if (currentWallet) clearWalletFromMemory(currentWallet);
    currentWallet = { wallet: w.wallet, address: w.address, publicKey: w.publicKey };
    await touchWallet(address);

    showScreen('home');
    setupHomeScreen();
  } catch (err) {
    console.error('[switchWallet] Error:', err);
  }
}

async function checkBalance(address) {
  try {
    const res = await fetch(`${RELAY_URL}/xumm/balance?address=${address}`);
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.xrp !== undefined) {
      setText('home-balance-amount', parseFloat(data.xrp).toFixed(2));
      document.getElementById('home-badge-inactive')?.classList.add('hidden');
      document.getElementById('home-badge-active')?.classList.remove('hidden');
      document.getElementById('activation-notice')?.classList.add('hidden');
    } else if (res.status === 404) {
      setText('home-balance-amount', '0');
      document.getElementById('home-badge-inactive')?.classList.remove('hidden');
      document.getElementById('home-badge-active')?.classList.add('hidden');
      document.getElementById('activation-notice')?.classList.remove('hidden');
    }
  } catch { /* offline */ }
}

// ==========================================
// 10. PIN SCREENS
// ==========================================

/**
 * Create PIN screen — two-step (enter + confirm).
 * @param {function(string): void} onComplete
 */
function setupCreatePINScreen(onComplete) {
  const titleEl = document.getElementById('pin-create-title');
  const subtitleEl = document.getElementById('pin-create-subtitle');
  const dotsContainer = document.getElementById('pin-create-dots');
  const input = document.getElementById('pin-create-input');
  const statusEl = document.getElementById('pin-create-status');

  let firstPIN = null;
  let isConfirming = false;

  function resetDots() { dotsContainer.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled')); }
  function updateDots(len) { dotsContainer.querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('filled', i < len)); }
  function resetForEntry() { input.value = ''; resetDots(); updateStatus(statusEl, ''); setTimeout(() => input.focus(), 100); }

  titleEl.textContent = 'Créez votre code PIN';
  subtitleEl.textContent = 'Ce code à 6 chiffres protège tous vos wallets.';
  resetForEntry();

  // Fresh input (remove old listeners)
  const freshInput = input.cloneNode(true);
  input.replaceWith(freshInput);
  const pinInput = document.getElementById('pin-create-input');

  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
    updateDots(pinInput.value.length);
    if (pinInput.value.length === 6) setTimeout(() => handlePINComplete(pinInput.value), 200);
  });

  function handlePINComplete(pin) {
    if (!isConfirming) {
      firstPIN = pin;
      isConfirming = true;
      titleEl.textContent = 'Confirmez votre code PIN';
      subtitleEl.textContent = 'Entrez le même code à 6 chiffres.';
      pinInput.value = '';
      resetDots();
      updateStatus(statusEl, '');
      setTimeout(() => pinInput.focus(), 100);
    } else {
      if (pin === firstPIN) {
        onComplete(pin);
      } else {
        dotsContainer.classList.add('shake');
        setTimeout(() => dotsContainer.classList.remove('shake'), 500);
        updateStatus(statusEl, '❌ Les codes ne correspondent pas. Recommencez.', true);
        firstPIN = null;
        isConfirming = false;
        titleEl.textContent = 'Créez votre code PIN';
        subtitleEl.textContent = 'Ce code à 6 chiffres protège tous vos wallets.';
        pinInput.value = '';
        resetDots();
        setTimeout(() => pinInput.focus(), 800);
      }
    }
  }

  dotsContainer?.addEventListener('click', () => pinInput.focus());
}

/**
 * PIN unlock screen — verify PIN, derive master key.
 */
function setupEnterPINScreen() {
  const dotsContainer = document.getElementById('pin-unlock-dots');
  const input = document.getElementById('pin-unlock-input');
  const statusEl = document.getElementById('pin-unlock-status');
  const addressEl = document.getElementById('pin-unlock-address');
  const btnFaceID = document.getElementById('btn-pin-unlock-faceid');
  const btnReset = document.getElementById('btn-reset-wallet-pin');

  // Show most recent wallet address
  getLastUsedWallet().then(wallet => {
    if (wallet && addressEl) {
      addressEl.textContent = `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`;
    }
  });

  // Show Face ID link if available
  getAuthConfig().then(authConfig => {
    if (authConfig?.credentialId && authConfig?.wrappedMasterKey && btnFaceID) {
      btnFaceID.classList.remove('hidden');
      const freshBtn = btnFaceID.cloneNode(true);
      btnFaceID.replaceWith(freshBtn);
      document.getElementById('btn-pin-unlock-faceid')?.addEventListener('click', () => {
        showScreen('unlock');
        setupUnlockScreen();
      }, { once: true });
    }

    // Check lockout
    if (authConfig) {
      const lockout = checkPINLockout(authConfig);
      if (lockout.locked) {
        updateStatus(statusEl, `⏳ Trop de tentatives. Réessayez dans ${lockout.remainingSec}s.`, true);
        pinInput.disabled = true;
        setTimeout(() => { pinInput.disabled = false; updateStatus(statusEl, ''); pinInput.focus(); }, lockout.remainingSec * 1000);
      }
    }
  });

  // Fresh input
  const freshInput = input.cloneNode(true);
  input.replaceWith(freshInput);
  const pinInput = document.getElementById('pin-unlock-input');

  function resetDots() { dotsContainer.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled')); }
  function updateDots(len) { dotsContainer.querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('filled', i < len)); }

  pinInput.value = '';
  resetDots();
  updateStatus(statusEl, '');
  setTimeout(() => pinInput.focus(), 100);

  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
    updateDots(pinInput.value.length);
    if (pinInput.value.length === 6) setTimeout(() => attemptPINUnlock(pinInput.value), 200);
  });

  async function attemptPINUnlock(pin) {
    try {
      const authConfig = await getAuthConfig();
      if (!authConfig) { showScreen('welcome'); setupWelcomeScreen(); return; }

      // Lockout check
      const lockout = checkPINLockout(authConfig);
      if (lockout.locked) {
        updateStatus(statusEl, `⏳ Trop de tentatives. Réessayez dans ${lockout.remainingSec}s.`, true);
        pinInput.value = ''; resetDots();
        return;
      }

      // Verify PIN
      const pinOk = await verifyPIN(pin, authConfig.verifyHash, authConfig.verifySalt);
      if (!pinOk) throw new Error('wrong_pin');

      // Success — derive master key
      const masterKey = await deriveKeyFromPIN(pin, base64ToUint8Array(authConfig.masterSalt));
      setMasterKey(masterKey);
      isUnlocked = true;

      // Reset attempts
      await saveAuthConfig({ ...authConfig, pinAttempts: 0, pinLockedUntil: 0 });

      await goToHome();

    } catch (err) {
      // Wrong PIN
      const authConfig = await getAuthConfig();
      const attempts = (authConfig?.pinAttempts || 0) + 1;
      let lockedUntil = 0;
      if (attempts >= 5) {
        const lockDelay = getNextLockoutDelay(attempts);
        lockedUntil = Date.now() + lockDelay;
      }
      await saveAuthConfig({ ...authConfig, pinAttempts: attempts, pinLockedUntil: lockedUntil });

      dotsContainer.classList.add('shake');
      setTimeout(() => dotsContainer.classList.remove('shake'), 500);

      if (lockedUntil) {
        const delaySec = Math.ceil((lockedUntil - Date.now()) / 1000);
        updateStatus(statusEl, `❌ PIN incorrect. Verrouillé pendant ${delaySec}s.`, true);
      } else {
        const remaining = 5 - attempts;
        updateStatus(statusEl, `❌ PIN incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`, true);
      }

      pinInput.value = ''; resetDots();
      pinInput.disabled = true;
      setTimeout(() => { pinInput.disabled = false; pinInput.focus(); }, lockedUntil ? Math.min(lockedUntil - Date.now(), 30000) : 1000);
    }
  }

  dotsContainer?.addEventListener('click', () => pinInput.focus());

  // Reset button
  if (btnReset) {
    const freshReset = btnReset.cloneNode(true);
    btnReset.replaceWith(freshReset);
    document.getElementById('btn-reset-wallet-pin')?.addEventListener('click', () => performFullReset(), { once: true });
  }
}

/**
 * Enable Face ID — wraps the master key with WebAuthn PRF.
 * @param {function(): void} onComplete
 */
function setupEnableFaceIDScreen(onComplete) {
  const btnActivate = document.getElementById('btn-faceid-activate');
  const btnSkip = document.getElementById('btn-faceid-skip');
  const statusEl = document.getElementById('faceid-setup-status');

  const freshActivate = btnActivate.cloneNode(true);
  const freshSkip = btnSkip.cloneNode(true);
  btnActivate.replaceWith(freshActivate);
  btnSkip.replaceWith(freshSkip);

  const newActivate = document.getElementById('btn-faceid-activate');
  const newSkip = document.getElementById('btn-faceid-skip');

  newActivate?.addEventListener('click', async () => {
    try {
      updateStatus(statusEl, 'Enregistrement Face ID…');
      newActivate.disabled = true;

      // Use a stable user ID for the credential
      const userId = 'xcannes-wallet-user';

      // Register biometric
      const { credentialId, signature: prfOutput } = await registerBiometric(userId);

      // Wrap master key with PRF
      const masterKey = getMasterKey();
      const wrappedMasterKey = await wrapMasterKeyWithPRF(masterKey, prfOutput);

      // Update auth config
      const authConfig = await getAuthConfig();
      await saveAuthConfig({
        ...authConfig,
        credentialId,
        wrappedMasterKey,
      });

      updateStatus(statusEl, '✅ Face ID activé !');
      await delay(1000);
      onComplete();

    } catch (err) {
      if (isBiometricEnrollmentError(err)) {
        updateStatus(statusEl, 'Face ID non disponible. Vous pourrez l\'activer plus tard.', true);
        await delay(2000);
        onComplete();
      } else {
        updateStatus(statusEl, `Erreur : ${err.message}`, true);
        newActivate.disabled = false;
      }
    }
  }, { once: true });

  newSkip?.addEventListener('click', () => onComplete(), { once: true });
}

// ==========================================
// 11. UNLOCK SCREEN (Face ID)
// ==========================================

function setupUnlockScreen() {
  const btnUnlock = document.getElementById('btn-unlock');
  const addressEl = document.getElementById('unlock-address');
  const statusEl = document.getElementById('unlock-status');

  if (btnUnlock) btnUnlock.style.display = 'none';

  getLastUsedWallet().then(wallet => {
    if (wallet && addressEl) addressEl.textContent = `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`;
  });

  // PIN fallback link
  const btnUsePIN = document.getElementById('btn-unlock-use-pin');
  if (btnUsePIN) {
    btnUsePIN.classList.remove('hidden');
    const freshBtn = btnUsePIN.cloneNode(true);
    btnUsePIN.replaceWith(freshBtn);
    document.getElementById('btn-unlock-use-pin')?.addEventListener('click', () => {
      showScreen('pin-unlock');
      setupEnterPINScreen();
    }, { once: true });
  }

  // Auto-trigger Face ID
  setTimeout(async () => {
    try { await doUnlock(); } catch { showRetryButton(); }
  }, 300);

  setupResetButton();
}

function setupUnlockScreenManual(error) {
  const btnUnlock = document.getElementById('btn-unlock');
  const addressEl = document.getElementById('unlock-address');
  const statusEl = document.getElementById('unlock-status');

  getLastUsedWallet().then(wallet => {
    if (wallet && addressEl) addressEl.textContent = `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`;
  });

  // PIN fallback
  const btnUsePIN = document.getElementById('btn-unlock-use-pin');
  if (btnUsePIN) {
    btnUsePIN.classList.remove('hidden');
    const freshBtn = btnUsePIN.cloneNode(true);
    btnUsePIN.replaceWith(freshBtn);
    document.getElementById('btn-unlock-use-pin')?.addEventListener('click', () => {
      showScreen('pin-unlock');
      setupEnterPINScreen();
    }, { once: true });
  }

  if (error && error !== 'no_faceid') {
    if (error.name === 'NotAllowedError') {
      updateStatus(statusEl, 'Authentification annulée. Réessayez.', true);
    } else if (error.message) {
      updateStatus(statusEl, `Erreur : ${error.message}`, true);
    }
  }

  showRetryButton();
  setupResetButton();
}

function showRetryButton() {
  const btn = document.getElementById('btn-unlock');
  if (btn) {
    btn.style.display = '';
    btn.addEventListener('click', () => doUnlock(), { once: true });
  }
}

async function doUnlock() {
  const statusEl = document.getElementById('unlock-status');
  try {
    updateStatus(statusEl, 'Authentification biométrique…');

    const authConfig = await getAuthConfig();
    if (!authConfig?.credentialId || !authConfig?.wrappedMasterKey) {
      showScreen('pin-unlock');
      setupEnterPINScreen();
      return;
    }

    const prfOutput = await promptBiometric(authConfig.credentialId);
    updateStatus(statusEl, 'Déverrouillage…');

    const masterKey = await unwrapMasterKeyWithPRF(authConfig.wrappedMasterKey, prfOutput);
    setMasterKey(masterKey);
    isUnlocked = true;

    updateStatus(statusEl, '');
    await goToHome();

  } catch (err) {
    if (err.name === 'NotAllowedError') {
      updateStatus(statusEl, 'Authentification annulée. Réessayez.', true);
    } else {
      updateStatus(statusEl, `Erreur : ${err.message}`, true);
    }
    showRetryButton();
  }
}

// ==========================================
// LEGACY WALLET HANDLING
// ==========================================

function setupLegacyWalletScreen() {
  const addressEl = document.getElementById('unlock-address');
  const statusEl = document.getElementById('unlock-status');
  const btnUnlock = document.getElementById('btn-unlock');
  const btnUsePIN = document.getElementById('btn-unlock-use-pin');

  getLastUsedWallet().then(wallet => {
    if (wallet && addressEl) addressEl.textContent = `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`;
  });

  if (btnUnlock) btnUnlock.style.display = 'none';
  if (btnUsePIN) btnUsePIN.classList.add('hidden');

  updateStatus(statusEl,
    '⚠️ Ce wallet utilise un ancien format de sécurité.\nRéinitialisez pour utiliser le nouveau système PIN.',
    true
  );

  setupResetButton();
}

// ==========================================
// RESET
// ==========================================

function setupResetButton() {
  const btnReset = document.getElementById('btn-reset-wallet');
  if (!btnReset) return;
  const newBtn = btnReset.cloneNode(true);
  btnReset.replaceWith(newBtn);
  newBtn.addEventListener('click', () => performFullReset(), { once: true });
}

async function performFullReset() {
  const confirmed = confirm(
    '⚠️ Réinitialiser le wallet ?\n\n'
    + 'Toutes les données locales seront supprimées :\n'
    + '• Wallets chiffrés\n'
    + '• Paramètres\n'
    + '• Cache de l\'application\n\n'
    + 'Vous pourrez recréer ou importer un wallet ensuite.\n\n'
    + 'Assurez-vous d\'avoir votre phrase de récupération (12 mots) avant de continuer.'
  );

  if (!confirmed) return;

  try {
    await clearAllData();
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    currentWallet = null;
    isUnlocked = false;
    pendingMnemonic = null;
    pendingWalletData = null;
    clearMasterKey();
    window.location.reload();
  } catch (err) {
    alert(`Erreur lors de la réinitialisation : ${err.message}`);
  }
}

// ==========================================
// LOCK
// ==========================================

async function lockWallet() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (currentWallet) {
    clearWalletFromMemory(currentWallet);
    currentWallet = null;
  }
  isUnlocked = false;
  pendingMnemonic = null;
  pendingWalletData = null;
  clearMasterKey();
  if (qrScanner) qrScanner.stop();

  // Choose unlock screen
  try {
    const authConfig = await getAuthConfig();
    if (authConfig?.credentialId && authConfig?.wrappedMasterKey) {
      showScreen('unlock');
      setupUnlockScreenManual();
    } else {
      showScreen('pin-unlock');
      setupEnterPINScreen();
    }
  } catch {
    showScreen('pin-unlock');
    setupEnterPINScreen();
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
    setTimeout(() => { updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran'); qrScanner?.start(); }, 2000);
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
    setTimeout(() => { updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran'); qrScanner?.start(); }, 3000);
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
  setTimeout(() => { showScreen('home'); setupHomeScreen(); }, 3000);
}

// ==========================================
// SIGN FLOW
// ==========================================

async function handleSign(challenge, statusEl) {
  updateStatus(statusEl, `Signature : ${challenge.action || 'Transaction'}`);

  const txDetails = formatTxDetails(challenge.txjson);
  const detailsEl = document.getElementById('scanner-tx-details');
  if (detailsEl) { detailsEl.textContent = txDetails; detailsEl.classList.remove('hidden'); }

  // Require confirmation
  const authConfig = await getAuthConfig();
  if (authConfig?.credentialId) {
    updateStatus(statusEl, 'Confirmez avec Face ID / Touch ID…');
    try {
      await promptBiometric(authConfig.credentialId);
    } catch {
      updateStatus(statusEl, 'Signature annulée.', true);
      if (detailsEl) detailsEl.classList.add('hidden');
      setTimeout(() => { updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran'); qrScanner?.start(); }, 2000);
      return;
    }
  } else {
    const confirmed = confirm('Confirmer la signature de cette transaction ?');
    if (!confirmed) {
      updateStatus(statusEl, 'Signature annulée.', true);
      if (detailsEl) detailsEl.classList.add('hidden');
      setTimeout(() => { updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran'); qrScanner?.start(); }, 2000);
      return;
    }
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

  setTimeout(() => { showScreen('home'); setupHomeScreen(); }, 4000);
}

// ==========================================
// HELPERS
// ==========================================

function showSuccess(title, message) {
  showScreen('success');
  setText('success-title', title);
  setText('success-message', message);
}

function showError(message) {
  showScreen('error');
  setText('error-message', message);
  document.getElementById('btn-error-retry')?.addEventListener('click', () => init(), { once: true });
}

function isBiometricEnrollmentError(err) {
  if (['NotAllowedError', 'SecurityError', 'AbortError'].includes(err.name)) {
    if (err.message?.includes('PRF')) return false;
    return true;
  }
  return false;
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
