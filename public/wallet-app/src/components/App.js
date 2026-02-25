/**
 * Xcannes Wallet — Main App (PWA)
 *
 * Xumm-style onboarding flow:
 *   Splash → Welcome → Terms → Choice (Create / Import)
 *   → Create: Generate → PIN Creation → Optional Face ID → Mnemonic Backup → Verify 12 words → Home
 *   → Import: Mnemonic (BIP39) / Seed / Secret Numbers → PIN Creation → Optional Face ID → Home
 *   Returning user: Face ID instant (if enabled) or PIN → Home
 *
 * Auth: PIN primary (PBKDF2 → AES-256-GCM) + WebAuthn/Face ID optional.
 * Vanilla JS — no framework dependency, minimal footprint.
 */

import { generateWallet, walletFromSeed, walletFromMnemonic, walletFromSecretNumbers, signTransaction, signChallenge, clearWalletFromMemory, isValidSeed } from '../services/walletService.js';
import { encryptSeed, decryptSeed } from '../services/cryptoService.js';
import { registerBiometric, promptBiometric, isBiometricAvailable } from '../services/webauthnService.js';
import { saveWallet, getLastUsedWallet, getWallet, hasWallets, saveSetting, getSetting, updateWalletAuth, clearAllData } from '../services/storageService.js';
import { encryptSeedWithPIN, decryptSeedWithPIN, checkPINLockout, getNextLockoutDelay } from '../services/pinService.js';
import { createQRScanner, parseQRCode } from '../services/qrService.js';
import { setRelayUrl, fetchChallenge, submitConnect, submitTransaction, pingRelay } from '../services/relayService.js';

// --- Production: silence console (keep error for critical failures) ---
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  console.log = () => {};
  console.warn = () => {};
  // console.error kept active for debugging critical issues
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

document.addEventListener('visibilitychange', async () => {
  if (document.hidden && isUnlocked) {
    lockWallet();
  } else if (!document.hidden && !isUnlocked) {
    // App came back to foreground — check auth mode before auto-triggering
    const walletScreen = document.getElementById('screen-unlock');
    if (walletScreen && !walletScreen.classList.contains('hidden')) {
      // Only auto-trigger Face ID if wallet has valid WebAuthn credentials
      try {
        const walletData = await getLastUsedWallet();
        const authMode = walletData?.authMode;
        if (authMode && authMode.includes('webauthn') && walletData?.credentialId) {
          setTimeout(() => {
            const btn = document.getElementById('btn-unlock');
            if (btn && btn.style.display !== 'none') btn.click();
          }, 500);
        }
      } catch { /* ignore */ }
    }
    // For PIN screen — auto-focus the input
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
    // Check immediately if returning user (during splash)
    const existingWallets = await hasWallets();
    const onboarded = existingWallets ? await getSetting(SETTING_ONBOARDED) : false;

    if (existingWallets && onboarded) {
      // Returning user — check auth mode
      const walletData = await getLastUsedWallet();
      const authMode = walletData?.authMode; // undefined for legacy wallets

      // --- LEGACY WALLET DETECTION ---
      // Wallets created before the PIN system have no authMode field.
      // They were encrypted with WebAuthn PRF — if the passkey was deleted
      // or Face ID fails, the user is permanently locked out.
      // → Force reset + start fresh with PIN.
      if (!authMode) {
        console.warn('[init] Legacy wallet detected (no authMode). Directing to reset.');
        await delay(800);
        showScreen('unlock');
        setupLegacyWalletScreen(walletData);
        return;
      }

      if (authMode.includes('webauthn') && walletData?.credentialId) {
        // Has Face ID — try instant unlock during splash
        const unlockResult = await attemptInstantUnlock();

        if (unlockResult.success) {
          showScreen('home');
          setupHomeScreen();
          resetInactivityTimer();
          return;
        }

        // Face ID failed — show unlock screen with retry + PIN fallback
        showScreen('unlock');
        setupUnlockScreenManual(unlockResult.error);
        return;
      }

      // PIN-only mode — show PIN screen after short splash
      await delay(800);
      showScreen('pin-unlock');
      setupEnterPINScreen();
      return;
    }

    // First-time user → wait for splash then welcome
    await delay(1800);
    showScreen('welcome');
    setupWelcomeScreen();

  } catch (err) {
    console.error('[init] Critical error:', err);
    // Fallback: show unlock if wallets exist, otherwise welcome
    try {
      const hasW = await hasWallets();
      if (hasW) {
        showScreen('unlock');
        setupUnlockScreenManual(err);
      } else {
        showScreen('welcome');
        setupWelcomeScreen();
      }
    } catch {
      showScreen('welcome');
      setupWelcomeScreen();
    }
  }
}

/**
 * Attempt instant unlock during splash — Face ID fires before app is visible.
 * Only used when authMode includes 'webauthn'.
 * Returns { success: true } or { success: false, error }.
 */
async function attemptInstantUnlock() {
  try {
    const walletData = await getLastUsedWallet();
    if (!walletData) return { success: false, error: 'no_wallet' };

    if (!walletData.credentialId) {
      return { success: false, error: 'no_webauthn' };
    }

    // Trigger Face ID immediately (user sees it over the splash)
    const prfOutput = await promptBiometric(walletData.credentialId);

    // Choose the right encrypted seed for WebAuthn decryption
    const authMode = walletData.authMode || 'webauthn';
    let encryptedData;
    if (authMode === 'pin+webauthn' && walletData.encryptedSeedWebAuthn) {
      encryptedData = walletData.encryptedSeedWebAuthn;
    } else {
      // Legacy mode: encryptedSeed was encrypted with WebAuthn
      encryptedData = walletData.encryptedSeed;
    }

    const seed = await decryptSeed(encryptedData, prfOutput);

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
    showScreen('choice');
    setupChoiceScreen();
  }, { once: true });
}

// ==========================================
// 4. CHOICE — Create or Import
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

    // 2. Keep xrpl wallet instance in memory for direct use after backup
    const walletInstance = walletFromMnemonic(walletData.mnemonic);
    pendingWalletData = { ...walletData, wallet: walletInstance.wallet };
    pendingMnemonic = walletData.mnemonic;

    // 3. Show PIN creation screen
    showScreen('pin-create');
    setupCreatePINScreen(async (pin) => {
      try {
        // 4. Encrypt seed with PIN
        const encryptedSeed = await encryptSeedWithPIN(walletData.seed, pin);

        // 5. Save to IndexedDB (PIN auth initially)
        await saveWallet({
          address: walletData.address,
          encryptedSeed,
          authMode: 'pin',
          credentialId: null,
          encryptedSeedWebAuthn: null,
        });

        // 6. Offer Face ID if biometric is available
        const biometricOk = await isBiometricAvailable();
        if (biometricOk) {
          showScreen('faceid-setup');
          setupEnableFaceIDScreen(walletData, () => {
            showScreen('backup');
            setupBackupScreen(pendingWalletData);
          });
        } else {
          showScreen('backup');
          setupBackupScreen(pendingWalletData);
        }
      } catch (err) {
        showError(`Erreur : ${err.message}`);
      }
    });

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
      const newWalletInstance = walletFromMnemonic(newWalletData.mnemonic);

      // 2. PIN is needed — show PIN creation again
      showScreen('pin-create');
      setupCreatePINScreen(async (pin) => {
        try {
          // 3. Encrypt with PIN
          const encryptedSeed = await encryptSeedWithPIN(newWalletData.seed, pin);

          // 4. Overwrite in IndexedDB
          await saveWallet({
            address: newWalletData.address,
            encryptedSeed,
            authMode: 'pin',
            credentialId: null,
            encryptedSeedWebAuthn: null,
          });

          // 5. Offer Face ID again
          const biometricOk = await isBiometricAvailable();

          // 6. Update in-memory refs
          pendingMnemonic = newWalletData.mnemonic;
          pendingWalletData = { ...newWalletData, wallet: newWalletInstance.wallet };

          if (biometricOk) {
            showScreen('faceid-setup');
            setupEnableFaceIDScreen(newWalletData, () => {
              btnRegenerate.disabled = false;
              btnRegenerate.textContent = '🔄 Nouvelle liste';
              showScreen('backup');
              setupBackupScreen(pendingWalletData);
            });
          } else {
            btnRegenerate.disabled = false;
            btnRegenerate.textContent = '🔄 Nouvelle liste';
            showScreen('backup');
            setupBackupScreen(pendingWalletData);
          }
        } catch (err) {
          btnRegenerate.disabled = false;
          btnRegenerate.textContent = '🔄 Nouvelle liste';
          showError(`Erreur : ${err.message}`);
        }
      });

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
    // Clear mnemonic from memory (no longer needed)
    pendingMnemonic = null;

    // Set wallet directly from pending data — no need to re-authenticate
    currentWallet = {
      wallet: pendingWalletData.wallet,
      address: pendingWalletData.address,
      publicKey: pendingWalletData.publicKey,
    };
    isUnlocked = true;
    pendingWalletData = null;

    // Mark onboarding complete
    await saveSetting(SETTING_ONBOARDED, true);

    // Show success then go to home
    showSuccess('Wallet créé !', 'Votre wallet est prêt. Conservez votre phrase de récupération en lieu sûr.');
    await delay(2500);

    showScreen('home');
    setupHomeScreen();
    resetInactivityTimer();
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

    // Clear inputs
    document.getElementById('import-seed-input') && (document.getElementById('import-seed-input').value = '');
    document.getElementById('import-mnemonic-input') && (document.getElementById('import-mnemonic-input').value = '');
    document.querySelectorAll('#secret-numbers-grid input').forEach(inp => inp.value = '');

    // Keep wallet instance for direct use after setup
    const importedWallet = walletResult;
    const importedSeed = seedForStorage;

    // Show PIN creation screen
    showScreen('pin-create');
    setupCreatePINScreen(async (pin) => {
      try {
        // Encrypt seed with PIN
        const encryptedSeed = await encryptSeedWithPIN(importedSeed, pin);

        // Save to IndexedDB (PIN auth initially)
        await saveWallet({
          address: importedWallet.address,
          encryptedSeed,
          authMode: 'pin',
          credentialId: null,
          encryptedSeedWebAuthn: null,
        });

        // Offer Face ID if available
        const biometricOk = await isBiometricAvailable();
        if (biometricOk) {
          showScreen('faceid-setup');
          setupEnableFaceIDScreen({ address: importedWallet.address, seed: importedSeed }, async () => {
            await finishImport(importedWallet);
          });
        } else {
          await finishImport(importedWallet);
        }
      } catch (err) {
        showError(`Erreur : ${err.message}`);
      }
    });

  } catch (err) {
    updateStatus(statusEl, `❌ ${err.message}`, true);
    rearmImport(statusEl);
  }
}

/**
 * Complete the import flow: set wallet in memory, mark onboarded, go to home.
 */
async function finishImport(walletResult) {
  await saveSetting(SETTING_ONBOARDED, true);

  currentWallet = {
    wallet: walletResult.wallet,
    address: walletResult.address,
    publicKey: walletResult.publicKey,
  };
  isUnlocked = true;

  showSuccess('Wallet importé !', `Adresse : ${walletResult.address.slice(0, 10)}…${walletResult.address.slice(-6)}`);
  await delay(2500);
  showScreen('home');
  setupHomeScreen();
  resetInactivityTimer();
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
// 10b. PIN-BASED AUTH SCREENS
// ==========================================

/**
 * Setup the "Create PIN" screen.
 * Two-step flow: enter 6 digits, then confirm.
 * Calls onComplete(pin) when both entries match.
 *
 * @param {function(string): void} onComplete - Called with the confirmed PIN
 */
function setupCreatePINScreen(onComplete) {
  const titleEl = document.getElementById('pin-create-title');
  const subtitleEl = document.getElementById('pin-create-subtitle');
  const dotsContainer = document.getElementById('pin-create-dots');
  const input = document.getElementById('pin-create-input');
  const statusEl = document.getElementById('pin-create-status');

  let firstPIN = null;
  let isConfirming = false;

  function resetDots() {
    dotsContainer.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
  }
  function updateDots(length) {
    dotsContainer.querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('filled', i < length));
  }
  function resetForEntry() {
    input.value = '';
    resetDots();
    updateStatus(statusEl, '');
    setTimeout(() => input.focus(), 100);
  }

  // Initial state
  titleEl.textContent = 'Créez votre code PIN';
  subtitleEl.textContent = 'Ce code à 6 chiffres protège votre wallet.';
  resetForEntry();

  // Remove old listeners by replacing input
  const freshInput = input.cloneNode(true);
  input.replaceWith(freshInput);
  const pinInput = document.getElementById('pin-create-input');

  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
    updateDots(pinInput.value.length);

    if (pinInput.value.length === 6) {
      setTimeout(() => handlePINComplete(pinInput.value), 200);
    }
  });

  function handlePINComplete(pin) {
    if (!isConfirming) {
      // First entry — store and ask to confirm
      firstPIN = pin;
      isConfirming = true;
      titleEl.textContent = 'Confirmez votre code PIN';
      subtitleEl.textContent = 'Entrez le même code à 6 chiffres.';
      pinInput.value = '';
      resetDots();
      updateStatus(statusEl, '');
      setTimeout(() => pinInput.focus(), 100);
    } else {
      // Confirm entry
      if (pin === firstPIN) {
        // Match — continue flow
        onComplete(pin);
      } else {
        // Mismatch — shake and restart
        dotsContainer.classList.add('shake');
        setTimeout(() => dotsContainer.classList.remove('shake'), 500);
        updateStatus(statusEl, '❌ Les codes ne correspondent pas. Recommencez.', true);
        firstPIN = null;
        isConfirming = false;
        titleEl.textContent = 'Créez votre code PIN';
        subtitleEl.textContent = 'Ce code à 6 chiffres protège votre wallet.';
        pinInput.value = '';
        resetDots();
        setTimeout(() => pinInput.focus(), 800);
      }
    }
  }

  // Focus input when user taps the dots area
  dotsContainer?.addEventListener('click', () => pinInput.focus());
}

/**
 * Setup the "Enter PIN" screen for unlock.
 * Decrypts the seed with the entered PIN, handles lockout.
 */
function setupEnterPINScreen() {
  const dotsContainer = document.getElementById('pin-unlock-dots');
  const input = document.getElementById('pin-unlock-input');
  const statusEl = document.getElementById('pin-unlock-status');
  const addressEl = document.getElementById('pin-unlock-address');
  const btnFaceID = document.getElementById('btn-pin-unlock-faceid');
  const btnReset = document.getElementById('btn-reset-wallet-pin');

  function resetDots() {
    dotsContainer.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
  }
  function updateDots(length) {
    dotsContainer.querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('filled', i < length));
  }

  // Show address + configure Face ID link
  getLastUsedWallet().then(wallet => {
    if (wallet && addressEl) {
      addressEl.textContent = `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`;
    }
    // Show Face ID toggle link if available
    const authMode = wallet?.authMode || 'webauthn';
    if (authMode.includes('webauthn') && wallet?.credentialId && btnFaceID) {
      btnFaceID.classList.remove('hidden');
      // Remove old listeners
      const freshBtn = btnFaceID.cloneNode(true);
      btnFaceID.replaceWith(freshBtn);
      document.getElementById('btn-pin-unlock-faceid')?.addEventListener('click', () => {
        showScreen('unlock');
        setupUnlockScreen();
      }, { once: true });
    }

    // Check lockout state on load
    if (wallet) {
      const lockout = checkPINLockout(wallet);
      if (lockout.locked) {
        updateStatus(statusEl, `⏳ Trop de tentatives. Réessayez dans ${lockout.remainingSec}s.`, true);
        pinInput.disabled = true;
        setTimeout(() => {
          pinInput.disabled = false;
          updateStatus(statusEl, '');
          pinInput.focus();
        }, lockout.remainingSec * 1000);
      }
    }
  });

  // Reset state
  const freshInput = input.cloneNode(true);
  input.replaceWith(freshInput);
  const pinInput = document.getElementById('pin-unlock-input');

  pinInput.value = '';
  resetDots();
  updateStatus(statusEl, '');
  setTimeout(() => pinInput.focus(), 100);

  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
    updateDots(pinInput.value.length);

    if (pinInput.value.length === 6) {
      setTimeout(() => attemptPINUnlock(pinInput.value), 200);
    }
  });

  async function attemptPINUnlock(pin) {
    try {
      const walletData = await getLastUsedWallet();
      if (!walletData) { showScreen('welcome'); setupWelcomeScreen(); return; }

      // Check lockout
      const lockout = checkPINLockout(walletData);
      if (lockout.locked) {
        updateStatus(statusEl, `⏳ Trop de tentatives. Réessayez dans ${lockout.remainingSec}s.`, true);
        pinInput.value = '';
        resetDots();
        return;
      }

      // Attempt decrypt
      const seed = await decryptSeedWithPIN(walletData.encryptedSeed, pin);

      // Success — reset attempts
      await updateWalletAuth(walletData.address, { pinAttempts: 0, pinLockedUntil: null });

      // Restore wallet
      let wallet, address, publicKey;
      if (seed.includes(' ')) {
        const result = walletFromMnemonic(seed);
        wallet = result.wallet; address = result.address; publicKey = result.publicKey;
      } else {
        const result = walletFromSeed(seed);
        wallet = result.wallet; address = result.address; publicKey = result.publicKey;
      }

      currentWallet = { wallet, address, publicKey };
      isUnlocked = true;

      showScreen('home');
      setupHomeScreen();
      resetInactivityTimer();

    } catch (err) {
      // AES-GCM throws OperationError on wrong key (wrong PIN)
      const walletData = await getLastUsedWallet();
      const attempts = (walletData?.pinAttempts || 0) + 1;

      let lockedUntil = null;
      if (attempts >= 5) {
        const lockDelay = getNextLockoutDelay(attempts);
        lockedUntil = Date.now() + lockDelay;
      }

      await updateWalletAuth(walletData.address, { pinAttempts: attempts, pinLockedUntil: lockedUntil });

      // Visual feedback
      dotsContainer.classList.add('shake');
      setTimeout(() => dotsContainer.classList.remove('shake'), 500);

      if (lockedUntil) {
        const delaySec = Math.ceil((lockedUntil - Date.now()) / 1000);
        updateStatus(statusEl, `❌ PIN incorrect. Verrouillé pendant ${delaySec}s.`, true);
      } else {
        const remaining = 5 - attempts;
        updateStatus(statusEl, `❌ PIN incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`, true);
      }

      pinInput.value = '';
      resetDots();

      // Disable input during lockout
      pinInput.disabled = true;
      setTimeout(() => {
        pinInput.disabled = false;
        pinInput.focus();
      }, lockedUntil ? Math.min(lockedUntil - Date.now(), 30000) : 1000);
    }
  }

  // Focus input on dots tap
  dotsContainer?.addEventListener('click', () => pinInput.focus());

  // Setup reset button
  if (btnReset) {
    const freshReset = btnReset.cloneNode(true);
    btnReset.replaceWith(freshReset);
    document.getElementById('btn-reset-wallet-pin')?.addEventListener('click', () => performFullReset(), { once: true });
  }
}

/**
 * Setup the "Enable Face ID" optional screen.
 * Registers WebAuthn + encrypts seed with PRF, or skips.
 *
 * @param {{ address: string, seed: string }} walletData - Wallet address + plaintext seed
 * @param {function(): void} onComplete - Called after Face ID setup or skip
 */
function setupEnableFaceIDScreen(walletData, onComplete) {
  const btnActivate = document.getElementById('btn-faceid-activate');
  const btnSkip = document.getElementById('btn-faceid-skip');
  const statusEl = document.getElementById('faceid-setup-status');

  // Remove old listeners
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

      // 1. Register biometric
      const { credentialId, signature } = await registerBiometric(walletData.address);

      // 2. Encrypt seed with WebAuthn PRF
      const encryptedSeedWebAuthn = await encryptSeed(walletData.seed, signature);

      // 3. Update wallet in IndexedDB
      await updateWalletAuth(walletData.address, {
        credentialId,
        encryptedSeedWebAuthn,
        authMode: 'pin+webauthn',
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

  newSkip?.addEventListener('click', () => {
    onComplete();
  }, { once: true });
}

// ==========================================
// 11. UNLOCK SCREEN
// ==========================================

function setupUnlockScreen() {
  const btnUnlock = document.getElementById('btn-unlock');
  const addressEl = document.getElementById('unlock-address');
  const statusEl = document.getElementById('unlock-status');

  // Hide button initially — Face ID will auto-trigger
  if (btnUnlock) btnUnlock.style.display = 'none';

  getLastUsedWallet().then(wallet => {
    if (wallet && addressEl) {
      addressEl.textContent = `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`;
    }
    // Show PIN fallback link if wallet has PIN auth
    const authMode = wallet?.authMode || 'webauthn';
    const btnUsePIN = document.getElementById('btn-unlock-use-pin');
    if (btnUsePIN) {
      if (authMode.includes('pin')) {
        btnUsePIN.classList.remove('hidden');
        btnUsePIN.addEventListener('click', () => {
          showScreen('pin-unlock');
          setupEnterPINScreen();
        }, { once: true });
      } else {
        btnUsePIN.classList.add('hidden');
      }
    }
  });

  // Auto-trigger Face ID (Xumm-style)
  setTimeout(async () => {
    try {
      await doUnlock();
    } catch {
      // Face ID failed → show retry button
      showRetryButton();
    }
  }, 300);

  // Setup reset button (available even before Face ID attempt)
  setupResetButton();
}

/**
 * Show unlock screen in manual retry mode (after instant unlock failed).
 * Button is immediately visible, no auto-trigger.
 */
function setupUnlockScreenManual(error) {
  const btnUnlock = document.getElementById('btn-unlock');
  const addressEl = document.getElementById('unlock-address');
  const statusEl = document.getElementById('unlock-status');

  getLastUsedWallet().then(wallet => {
    if (wallet && addressEl) {
      addressEl.textContent = `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`;
    }
    // Show PIN fallback link if wallet has PIN auth
    const authMode = wallet?.authMode || 'webauthn';
    const btnUsePIN = document.getElementById('btn-unlock-use-pin');
    if (btnUsePIN) {
      if (authMode.includes('pin')) {
        btnUsePIN.classList.remove('hidden');
        btnUsePIN.addEventListener('click', () => {
          showScreen('pin-unlock');
          setupEnterPINScreen();
        }, { once: true });
      } else {
        btnUsePIN.classList.add('hidden');
      }
    }
  });

  // Show error from instant attempt
  if (error && error !== 'no_wallet') {
    if (error.name === 'NotAllowedError') {
      updateStatus(statusEl, 'Authentification annulée. Réessayez.', true);
    } else if (error.message) {
      updateStatus(statusEl, `Erreur : ${error.message}`, true);
    }
  }

  // Button visible immediately for manual retry
  showRetryButton();

  // Setup reset button
  setupResetButton();
}

function showRetryButton() {
  const btn = document.getElementById('btn-unlock');
  if (btn) {
    btn.style.display = '';
    btn.addEventListener('click', () => doUnlock(), { once: true });
  }
}

/**
 * Setup the reset wallet button on the unlock screen.
 * Shows a confirmation before wiping all data.
 */
function setupResetButton() {
  const btnReset = document.getElementById('btn-reset-wallet');
  if (!btnReset) return;

  // Remove old listeners
  const newBtn = btnReset.cloneNode(true);
  btnReset.replaceWith(newBtn);

  newBtn.addEventListener('click', () => performFullReset(), { once: true });
}

/**
 * Full wallet reset — shared by all reset buttons.
 * Deletes IndexedDB, caches, service workers, and reloads.
 */
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
    // 1. Clear IndexedDB (wallets + settings)
    await clearAllData();

    // 2. Clear Service Worker cache
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // 3. Unregister service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }

    // 4. Clear in-memory state
    currentWallet = null;
    isUnlocked = false;
    pendingMnemonic = null;
    pendingWalletData = null;

    // 5. Hard reload to get a completely fresh start
    window.location.reload();

  } catch (err) {
    alert(`Erreur lors de la réinitialisation : ${err.message}`);
  }
}

/**
 * Show a special unlock screen for legacy wallets (pre-PIN system).
 * These wallets cannot be unlocked reliably (WebAuthn passkey may be deleted).
 * Shows the address + explanation + reset button. No Face ID auto-trigger.
 */
function setupLegacyWalletScreen(walletData) {
  const addressEl = document.getElementById('unlock-address');
  const statusEl = document.getElementById('unlock-status');
  const btnUnlock = document.getElementById('btn-unlock');
  const btnUsePIN = document.getElementById('btn-unlock-use-pin');

  if (addressEl && walletData) {
    addressEl.textContent = `${walletData.address.slice(0, 8)}…${walletData.address.slice(-6)}`;
  }

  // Hide Face ID button — legacy credentials are likely invalid
  if (btnUnlock) btnUnlock.style.display = 'none';

  // Hide PIN link — legacy wallets have no PIN
  if (btnUsePIN) btnUsePIN.classList.add('hidden');

  updateStatus(statusEl,
    '⚠️ Ce wallet utilise un ancien format de sécurité.\n'
    + 'Réinitialisez pour utiliser le nouveau système PIN.',
    true
  );

  // Setup reset button
  setupResetButton();
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

    // Choose the right encrypted seed for WebAuthn decryption
    const authMode = walletData.authMode || 'webauthn';
    let encryptedData;
    if (authMode === 'pin+webauthn' && walletData.encryptedSeedWebAuthn) {
      encryptedData = walletData.encryptedSeedWebAuthn;
    } else {
      encryptedData = walletData.encryptedSeed;
    }

    const seed = await decryptSeed(encryptedData, prfOutput);

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
    // Show retry button (only place that does this — no double)
    showRetryButton();
  }
}

/**
 * unlockAndGoHome — Legacy fallback. Only used for backward-compat edge cases.
 * New flows (create/import) set currentWallet directly from memory.
 */
async function unlockAndGoHome() {
  try {
    const walletData = await getLastUsedWallet();
    if (!walletData) return;

    const authMode = walletData.authMode || 'webauthn';

    if (authMode.includes('webauthn') && walletData.credentialId) {
      const prfOutput = await promptBiometric(walletData.credentialId);
      const encryptedData = (authMode === 'pin+webauthn' && walletData.encryptedSeedWebAuthn)
        ? walletData.encryptedSeedWebAuthn
        : walletData.encryptedSeed;
      const seed = await decryptSeed(encryptedData, prfOutput);

      let wallet, address, publicKey;
      if (seed.includes(' ')) {
        const result = walletFromMnemonic(seed);
        wallet = result.wallet; address = result.address; publicKey = result.publicKey;
      } else {
        const result = walletFromSeed(seed);
        wallet = result.wallet; address = result.address; publicKey = result.publicKey;
      }

      currentWallet = { wallet, address, publicKey };
      isUnlocked = true;
      showScreen('home');
      setupHomeScreen();
      resetInactivityTimer();
    } else {
      // PIN-only — show PIN screen
      showScreen('pin-unlock');
      setupEnterPINScreen();
    }
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

  // Require confirmation before signing
  const walletData = await getLastUsedWallet();
  const authMode = walletData?.authMode || 'webauthn';

  if (authMode.includes('webauthn') && walletData?.credentialId) {
    // Face ID confirmation
    updateStatus(statusEl, 'Confirmez avec Face ID / Touch ID…');
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
  } else {
    // PIN-only: wallet already authenticated — confirm via dialog
    const confirmed = confirm('Confirmer la signature de cette transaction ?');
    if (!confirmed) {
      updateStatus(statusEl, 'Signature annulée.', true);
      if (detailsEl) detailsEl.classList.add('hidden');
      setTimeout(() => {
        updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran');
        qrScanner?.start();
      }, 2000);
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

  setTimeout(() => {
    showScreen('home');
    setupHomeScreen();
  }, 4000);
}

// ==========================================
// HELPERS
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
  if (qrScanner) qrScanner.stop();

  // Choose unlock screen based on authMode
  try {
    const walletData = await getLastUsedWallet();
    const authMode = walletData?.authMode || 'webauthn';

    if (authMode.includes('webauthn') && walletData?.credentialId) {
      // Has Face ID — show unlock screen (auto-trigger disabled, manual retry)
      showScreen('unlock');
      setupUnlockScreenManual();
    } else {
      // PIN-only
      showScreen('pin-unlock');
      setupEnterPINScreen();
    }
  } catch {
    showScreen('unlock');
    setupUnlockScreenManual();
  }
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

// ==========================================
// BIOMETRIC ENROLLMENT ERROR DETECTION
// ==========================================

/**
 * Detect if a WebAuthn error is caused by missing biometric/passcode enrollment.
 * This happens when the device has Face ID hardware but no passcode is configured.
 * The browser shows its own confusing fallback UI (QR code, etc.).
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isBiometricEnrollmentError(err) {
  // NotAllowedError: user cancelled OR no biometric/passcode enrolled
  // SecurityError: some browsers use this when no authenticator is available
  // AbortError: timeout or abort due to missing enrollment
  if (['NotAllowedError', 'SecurityError', 'AbortError'].includes(err.name)) {
    // Exclude PRF-specific errors (already handled by webauthnService)
    if (err.message?.includes('PRF')) return false;
    return true;
  }
  return false;
}

/**
 * Show the "Biometric Setup Required" screen.
 * Displayed when the device has no passcode/Face ID/Touch ID configured.
 *
 * @param {string} returnScreen - Screen to go back to ('choice' | 'import')
 */
function showBiometricSetupRequired(returnScreen) {
  showScreen('biometric-required');

  const btnRetry = document.getElementById('btn-biometric-required-retry');
  const btnBack = document.getElementById('btn-biometric-required-back');

  btnRetry?.replaceWith(btnRetry.cloneNode(true)); // Remove old listeners
  btnBack?.replaceWith(btnBack.cloneNode(true));

  const newBtnRetry = document.getElementById('btn-biometric-required-retry');
  const newBtnBack = document.getElementById('btn-biometric-required-back');

  newBtnRetry?.addEventListener('click', () => {
    // Return to choice screen — user can retry Face ID from there
    showScreen('choice');
    setupChoiceScreen();
  }, { once: true });

  newBtnBack?.addEventListener('click', () => {
    if (returnScreen === 'import') {
      showScreen('import');
      setupImportScreen();
    } else if (returnScreen === 'choice') {
      showScreen('choice');
      setupChoiceScreen();
    } else {
      showScreen('welcome');
      setupWelcomeScreen();
    }
  }, { once: true });
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
