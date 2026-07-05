/**
 * Xcannes Wallet — Main App (PWA)
 *
 * Architecture: App-level master key + multi-wallet
 *
 * First launch:
 *   Splash → Welcome → Terms → PIN Creation → Optional Face ID → Choice (Create / Import)
 *   → Create: Generate → Mnemonic Backup → Verify → Home
 *   → Import: Mnemonic → Home
 *
 * Returning user:
 *   Splash → Face ID (instant) or PIN → Home (wallet list)
 *
 * Auth: PIN derives a master AES-256-GCM key. All wallets are encrypted with the same master key.
 *        Face ID wraps/unwraps the master key via WebAuthn PRF.
 *
 * Vanilla JS — no framework dependency, minimal footprint.
 */

import { generateWallet, walletFromSeed, walletFromMnemonic, signTransaction, signChallenge, clearWalletFromMemory } from '../services/walletService.js';
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

// --- Screen Wake Lock (keep screen on during mnemonic backup) ---
// Note: This is supported on Chromium-based browsers (secure context). iOS Safari
// may ignore it — we fail silently.
let wakeLockSentinel = null;
let wakeLockWanted = false;
let wakeLockNeedsUserGesture = false;

function screenWantsWakeLock(screenName) {
  return screenName === 'backup' || screenName === 'backup-verify' || screenName === 'import';
}

function getWakeLockHintTargets() {
  const hintEls = Array.from(document.querySelectorAll('[data-wakelock-hint]'));
  return hintEls
    .map((el) => {
      const textEl = el.querySelector('[data-wakelock-hint-text]');
      if (!textEl) return null;
      return { el, textEl };
    })
    .filter(Boolean);
}

function updateWakeLockHint() {
  const targets = getWakeLockHintTargets();
  if (!targets.length) return;

  if (!wakeLockWanted) {
    targets.forEach(({ el }) => el.classList.add('hidden'));
    return;
  }

  // Unsupported: show guidance to prevent sleep.
  if (!('wakeLock' in navigator)) {
    const html =
      `Astuce : pour éviter la mise en veille pendant cette étape, ` +
      `touchez l’écran de temps en temps pendant que vous notez les 12 mots.`;
    targets.forEach(({ el, textEl }) => {
      textEl.innerHTML = html;
      el.classList.remove('hidden');
    });
    return;
  }

  // Supported + active: no need to distract; keep it hidden.
  if (wakeLockSentinel) {
    targets.forEach(({ el }) => el.classList.add('hidden'));
    return;
  }

  // Supported but not active: either needs a user gesture or request failed.
  const html =
    `Astuce : pour éviter la mise en veille pendant cette étape, ` +
    `touchez l’écran de temps en temps pendant que vous notez les 12 mots.`;
  targets.forEach(({ el, textEl }) => {
    textEl.innerHTML = html;
    el.classList.remove('hidden');
  });
}

async function requestScreenWakeLock() {
  if (!wakeLockWanted) return;
  if (wakeLockSentinel) return;
  if (!('wakeLock' in navigator)) return;
  if (document.visibilityState !== 'visible') return;

  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockNeedsUserGesture = false;
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
      updateWakeLockHint();
    });
    updateWakeLockHint();
  } catch {
    // NotAllowedError / NotSupportedError / etc — ignore.
    wakeLockSentinel = null;
    // On some browsers, wake lock requires a user activation.
    wakeLockNeedsUserGesture = true;
    updateWakeLockHint();
  }
}

async function releaseScreenWakeLock() {
  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  wakeLockNeedsUserGesture = false;
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    /* ignore */
  }
  updateWakeLockHint();
}

function setWakeLockWanted(wanted) {
  wakeLockWanted = Boolean(wanted);
  if (!wakeLockWanted) {
    void releaseScreenWakeLock();
    updateWakeLockHint();
    return;
  }
  // Many browsers require a user gesture; we try immediately, and we also
  // re-try on the next interaction while on the backup screens.
  wakeLockNeedsUserGesture = true;
  updateWakeLockHint();
  void requestScreenWakeLock();
}

// --- Auto-lock ---
const AUTO_LOCK_MS = 5 * 60 * 1000;
let inactivityTimer = null;
const MOONPAY_BACKGROUND_GRACE_MS = 3 * 60 * 1000;
let moonpayActiveInDashboard = false;
let moonpayBackgroundGraceAllowed = false;
let moonpayBackgroundLockTimer = null;
let choiceOpenedFromDashboardSettings = false;

function clearMoonpayBackgroundLockTimer() {
  if (moonpayBackgroundLockTimer) clearTimeout(moonpayBackgroundLockTimer);
  moonpayBackgroundLockTimer = null;
}

function scheduleMoonpayBackgroundLock() {
  clearMoonpayBackgroundLockTimer();
  moonpayBackgroundLockTimer = setTimeout(() => {
    try {
      if (document.hidden && isUnlocked) lockWallet();
    } catch { /* ignore */ }
  }, MOONPAY_BACKGROUND_GRACE_MS);
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (!isUnlocked) return;
  inactivityTimer = setTimeout(() => {
    if (isUnlocked) lockWallet();
  }, AUTO_LOCK_MS);
}

document.addEventListener('visibilitychange', async () => {
  if (document.hidden && isUnlocked) {
    // Wake Lock is released automatically when hidden; keep desired state to
    // re-request when the app becomes visible again.
    if (moonpayActiveInDashboard) {
      // Allow a single background grace window per MoonPay session so native
      // iOS auth (Apple/PayPal sheets) doesn't force an immediate lock, but
      // still locks immediately if the user backgrounds the app again after
      // the MoonPay auth flow completes.
      if (moonpayBackgroundGraceAllowed) {
        moonpayBackgroundGraceAllowed = false;
        scheduleMoonpayBackgroundLock();
        return;
      }
      lockWallet();
      return;
    }
    lockWallet();
  } else if (!document.hidden && !isUnlocked) {
    clearMoonpayBackgroundLockTimer();
    // If we’re on backup screens, re-acquire Wake Lock when returning.
    void requestScreenWakeLock();
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
  } else if (!document.hidden) {
    clearMoonpayBackgroundLockTimer();
    // If we’re on backup screens, re-acquire Wake Lock when returning.
    void requestScreenWakeLock();
  }
});

['touchstart', 'mousedown', 'keydown', 'scroll'].forEach(evt => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// Try to (re)acquire wake lock on first user interaction while on backup screens.
['touchstart', 'mousedown', 'keydown'].forEach(evt => {
  document.addEventListener(evt, () => {
    if (!wakeLockWanted) return;
    void requestScreenWakeLock();
  }, { passive: true });
});

// --- Notify parent iframe if running embedded (for site onboarding) ---
function notifyParentWalletCreated(address, publicKey) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'WALLET_CREATED',
        address: address || '',
        publicKey: publicKey || '',
      }, '*');
    }
  } catch { /* cross-origin safety */ }
}

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

let keyboardAvoidanceInitialized = false;
let keyboardTransitionTimer = null;
let lastKeyboardPx = 0;

function clearKeyboardAvoidanceUI() {
  document.documentElement.style.setProperty('--keyboard-offset', '0px');
  document.body?.classList.remove('keyboard-open');
  document.body?.classList.remove('keyboard-opening');
  document.body?.classList.remove('keyboard-closing');
  if (keyboardTransitionTimer) {
    clearTimeout(keyboardTransitionTimer);
    keyboardTransitionTimer = null;
  }
  lastKeyboardPx = 0;
}

function getPinDotsElForInput(inputEl) {
  const id = inputEl?.id || '';
  if (id === 'pin-create-input') return document.getElementById('pin-create-dots');
  if (id === 'pin-unlock-input') return document.getElementById('pin-unlock-dots');
  if (id === 'confirm-pin-input') return document.getElementById('confirm-pin-dots');
  return null;
}

function setupKeyboardAvoidance() {
  if (keyboardAvoidanceInitialized) return;
  keyboardAvoidanceInitialized = true;

  const viewport = window.visualViewport;

  const update = () => {
    if (!viewport) return;
    const keyboardPx = Math.max(0, window.innerHeight - viewport.height - (viewport.offsetTop || 0));
    const wasOpen = lastKeyboardPx > 0;
    const isOpen = keyboardPx > 0;
    lastKeyboardPx = keyboardPx;

    if (keyboardTransitionTimer) {
      clearTimeout(keyboardTransitionTimer);
      keyboardTransitionTimer = null;
    }

    if (!wasOpen && isOpen) {
      document.body?.classList.remove('keyboard-closing');
      document.body?.classList.add('keyboard-opening');
      requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(keyboardPx)}px`);
        document.body?.classList.add('keyboard-open');
      });
      keyboardTransitionTimer = setTimeout(() => document.body?.classList.remove('keyboard-opening'), 520);
      return;
    }

    if (wasOpen && !isOpen) {
      document.body?.classList.remove('keyboard-opening');
      document.body?.classList.add('keyboard-closing');
      requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--keyboard-offset', '0px');
        document.body?.classList.remove('keyboard-open');
      });
      keyboardTransitionTimer = setTimeout(() => document.body?.classList.remove('keyboard-closing'), 260);
      return;
    }

    // Same state — just keep offset in sync (e.g. keyboard bar changes height)
    document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(keyboardPx)}px`);
    if (isOpen) document.body?.classList.add('keyboard-open');
    else document.body?.classList.remove('keyboard-open');
  };

  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains('pin-hidden-input')) return;

    update();
    const dotsEl = getPinDotsElForInput(target);
    setTimeout(() => {
      (dotsEl || target).scrollIntoView({ block: 'center', inline: 'nearest' });
    }, 60);
  });

  document.addEventListener('focusout', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains('pin-hidden-input')) return;

    setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.classList.contains('pin-hidden-input')) return;
      clearKeyboardAvoidanceUI();
    }, 120);
  });

  if (viewport) {
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
  } else {
    // Fallback — some browsers don’t implement visualViewport well in PWA mode.
    window.addEventListener('resize', clearKeyboardAvoidanceUI);
  }

  window.addEventListener('orientationchange', () => setTimeout(update, 250));
}

function showScreen(screenName) {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && active.classList.contains('pin-hidden-input')) {
    active.blur();
    clearKeyboardAvoidanceUI();
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(`screen-${screenName}`);
  if (el) el.classList.remove('hidden');

  // Keep screen awake only on mnemonic backup/verify screens.
  setWakeLockWanted(screenWantsWakeLock(screenName));
}

/**
 * Animate the splash screen with a letter-by-letter "XCANNES" title
 * followed by "Compte multi-devises" subtitle with a 3D back-forward effect.
 * Mirrors the site header loading animation.
 */
function animateSplash() {
  const titleEl = document.getElementById('splash-title');
  const subtitleEl = document.getElementById('splash-subtitle');
  if (!titleEl) return;

  const text = 'XCANNES';
  const charDelay = 120; // ms per character
  let index = 0;
  titleEl.textContent = '';

  const interval = setInterval(() => {
    if (index < text.length) {
      const span = document.createElement('span');
      span.className = 'splash-char';
      span.textContent = text[index];
      titleEl.appendChild(span);
      index++;
    } else {
      clearInterval(interval);
      // Show subtitle immediately
      if (subtitleEl) {
        subtitleEl.classList.remove('hidden');
        // Back-forward 3D animation
        setTimeout(() => {
          subtitleEl.classList.add('splash-anim-back');
          setTimeout(() => {
            subtitleEl.classList.remove('splash-anim-back');
            subtitleEl.classList.add('splash-anim-forward');
          }, 350);
        }, 200);
      }
    }
  }, charDelay);
}

function updateStatus(el, text, isError = false) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', isError);
}

// ==========================================
// 0. DETECT BROWSER vs PWA STANDALONE
// ==========================================

/**
 * Returns true if running as installed PWA (standalone / fullscreen).
 * Returns false if running in the normal browser tab.
 */
function isRunningAsInstalledApp() {
  // Standard check
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  // iOS Safari standalone
  if (window.navigator.standalone === true) return true;
  // Running inside an iframe (embedded in Xcannes dashboard) counts as "app"
  if (window.parent && window.parent !== window) return true;
  return false;
}

/**
 * Detect if running inside an iframe (embedded in the Xcannes site).
 * When embedded, Face ID is disabled to avoid credential conflicts
 * between the site's IndexedDB context and the standalone PWA context.
 * PIN-only mode in iframe — Face ID is reserved for the installed PWA.
 */
function isRunningInIframe() {
  try {
    return window.parent && window.parent !== window;
  } catch {
    return true; // cross-origin iframe
  }
}

/**
 * Check if URL has ?action=choice — used when the site's settings
 * menu opens wallet-app specifically to create/import another wallet.
 * After unlock, go directly to the choice screen instead of home.
 * Consumes the param (removes it from URL) to prevent re-triggering on reload.
 */
function consumeActionChoice() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'choice') {
      // Clean the URL so it doesn't re-trigger on next visit
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Post-unlock destination: choice screen if ?action=choice, else home.
 */
async function goToPostUnlockDestination() {
  if (consumeActionChoice()) {
    goToChoice();
  } else {
    await goToHome();
  }
}

/**
 * Detect if this is a mobile browser (not the PWA).
 * If so, show a redirect screen suggesting to open the installed app.
 * User can bypass and continue in the browser.
 */
function checkBrowserRedirect() {
  // Don't redirect on desktop — desktop users legitimately use the browser
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) return false;

  // Already running as PWA — no redirect needed
  if (isRunningAsInstalledApp()) return false;

  // User previously chose "continue in browser" this session — don't nag again
  if (sessionStorage.getItem('xcannes_browser_continue') === '1') return false;

  return true;
}

function setupBrowserRedirectScreen() {
  showScreen('browser-redirect');

  const btnContinue = document.getElementById('btn-browser-continue');
  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      sessionStorage.setItem('xcannes_browser_continue', '1');
      // Continue normal init flow
      initApp();
    }, { once: true });
  }
}

// ==========================================
// 1. SPLASH → INIT
// ==========================================

export async function init() {
  // On mobile browser (not PWA), show redirect screen first
  if (checkBrowserRedirect()) {
    setupBrowserRedirectScreen();
    return;
  }

  initApp();
}

async function initApp() {
  showScreen('splash');
  animateSplash();
  setupKeyboardAvoidance();

  try {
    const appSetup = await isAppSetup();

    if (appSetup) {
      // Returning user — app has a PIN set up
      const authConfig = await getAuthConfig();

      // Try Face ID instant unlock if configured
      // Skip Face ID in iframe — use PIN only to avoid credential conflicts
      if (authConfig?.credentialId && authConfig?.wrappedMasterKey && !isRunningInIframe()) {
        const unlockResult = await attemptInstantUnlock(authConfig);

        if (unlockResult.success) {
          await goToPostUnlockDestination();
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

        // Offer Face ID / Touch ID right after PIN creation
        // Skip Face ID in iframe — avoid credential conflicts between site & PWA
        const biometricOk = !isRunningInIframe() && await isBiometricAvailable();
        if (biometricOk) {
          showScreen('faceid-setup');
          setupEnableFaceIDScreen(() => {
            goToChoice();
          });
        } else {
          goToChoice();
        }
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
  const btnClose = document.getElementById('btn-choice-close');

  btnCreate?.addEventListener('click', () => {
    startCreateWallet();
  }, { once: true });

  btnImport?.addEventListener('click', () => {
    showScreen('import');
    setupImportScreen();
  }, { once: true });

  if (!btnClose) return;

  // Always rearm (avoid accumulating listeners when returning to this screen).
  const newBtnClose = btnClose.cloneNode(true);
  btnClose.replaceWith(newBtnClose);

  if (!choiceOpenedFromDashboardSettings) {
    newBtnClose.classList.remove('is-visible');
    return;
  }

  newBtnClose.classList.add('is-visible');
  newBtnClose.addEventListener('click', () => {
    choiceOpenedFromDashboardSettings = false;
    showScreen('wallet-embedded');
    sendToIframe({ type: 'OPEN_SETTINGS_DROPDOWN' });
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
  const btnBack = document.getElementById('btn-backup-back');
  const btnClose = document.getElementById('btn-backup-close');
  const btnContinue = document.getElementById('btn-backup-continue');
  const btnRegenerate = document.getElementById('btn-backup-regenerate');

  const words = walletData.mnemonic.trim().split(/\s+/);

  if (btnBack) {
    const freshBtnBack = btnBack.cloneNode(true);
    btnBack.replaceWith(freshBtnBack);
    document.getElementById('btn-backup-back')?.addEventListener('click', () => {
      if (pendingWalletData) clearWalletFromMemory(pendingWalletData);
      pendingMnemonic = null;
      pendingWalletData = null;
      goToChoice();
    }, { once: true });
  }

  if (btnClose) {
    const freshBtnClose = btnClose.cloneNode(true);
    btnClose.replaceWith(freshBtnClose);
    document.getElementById('btn-backup-close')?.addEventListener('click', async () => {
      if (pendingWalletData) clearWalletFromMemory(pendingWalletData);
      pendingMnemonic = null;
      pendingWalletData = null;
      await goToHome();
    }, { once: true });
  }

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
  const progressBar = document.querySelector('#screen-backup-verify .verify-progress-bar');
  const btnConfirm = document.getElementById('btn-verify-confirm');
  const btnConfirmLabel = document.getElementById('btn-verify-confirm-label');
  const btnBack = document.getElementById('btn-verify-back');
  const btnClose = document.getElementById('btn-verify-close');
  const btnShowWords = document.getElementById('btn-verify-show-words');
  const overlay = document.getElementById('verify-words-overlay');
  const overlayGrid = document.getElementById('verify-mnemonic-grid');
  const btnOverlayClose = document.getElementById('btn-verify-words-close');

  let currentIndex = 0;
  let currentInput = null;
  let isStepTransitioning = false;

  function normalized(value) {
    return (value || '').trim().toLowerCase();
  }

  function updateProgress(stepIndex) {
    const completed = Math.max(0, Math.min(stepIndex, 12));
    const current = Math.min(stepIndex + 1, 12);
    progressText.innerHTML = `<span class="verify-progress-current">${current}</span><span class="verify-progress-total">/12</span>`;
    progressBar?.style.setProperty('--verify-step', `${Math.max(0, Math.min(stepIndex, 11))}`);
    progressFill.style.width = 'var(--segment-w)';
  }

  function updateContinueState() {
    if (isStepTransitioning) {
      btnConfirm.disabled = true;
      return;
    }
    if (!currentInput) {
      btnConfirm.disabled = true;
      return;
    }
    const expected = normalized(words[currentIndex]);
    const entered = normalized(currentInput.value);
    const isValid = entered === expected;
    btnConfirm.disabled = !isValid;
    if (btnConfirmLabel) {
      btnConfirmLabel.textContent = currentIndex === 11 ? 'Confirmer' : 'Continuer';
    }
  }

  function renderCurrentStep({ animateFromRight = false } = {}) {
    const step = currentIndex + 1;
    const mountStepCard = () => {
      container.innerHTML = `
        <div class="verify-step-card">
          <div class="verify-step-pill">${step}</div>
          <h3 class="verify-step-title">Mot n°${step}</h3>
          <p class="verify-step-subtitle">Entrez le mot n°${step} de votre phrase de récupération.</p>
          <label class="verify-step-input-wrap" for="verify-current-word">
            <input
              id="verify-current-word"
              class="verify-step-input"
              type="text"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="Entrez le mot"
            >
          </label>
          <div class="verify-step-note">
            <span class="verify-step-note-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10c-3.5-1.5-7-5-7-10V6l7-3"></path>
                <path d="M9.5 12.2l1.8 1.8l3.4-3.4"></path>
              </svg>
            </span>
            <span>Vérifiez bien l’orthographe et l’ordre du mot.</span>
          </div>
        </div>
      `;

      const card = container.querySelector('.verify-step-card');
      if (animateFromRight) {
        card?.classList.add('is-entering-right');
      }

      currentInput = document.getElementById('verify-current-word');
      updateProgress(currentIndex);
      updateStatus(statusEl, '', false);

      currentInput?.addEventListener('input', () => {
        currentInput.closest('.verify-step-input-wrap')?.classList.remove('is-warn');
        updateStatus(statusEl, '', false);
        updateContinueState();
      });

      currentInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !btnConfirm.disabled) {
          e.preventDefault();
          btnConfirm.click();
        }
      });

      if (animateFromRight) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            card?.classList.remove('is-entering-right');
          });
        });
      }

      setTimeout(() => {
        isStepTransitioning = false;
        updateContinueState();
        currentInput?.focus();
      }, animateFromRight ? 220 : 120);
    };

    const previousCard = container.querySelector('.verify-step-card');
    if (animateFromRight && previousCard) {
      previousCard.classList.add('is-leaving-left');
      setTimeout(mountStepCard, 180);
      return;
    }

    mountStepCard();
  }

  function validateCurrentStep() {
    if (!currentInput) return false;
    const expected = normalized(words[currentIndex]);
    const entered = normalized(currentInput.value);
    if (!entered || entered !== expected) {
      currentInput.closest('.verify-step-input-wrap')?.classList.add('is-warn');
      updateStatus(statusEl, 'Mot incorrect. Vérifiez l’orthographe.', true);
      currentInput.focus();
      currentInput.select();
      btnConfirm.disabled = true;
      return false;
    }
    return true;
  }

  renderCurrentStep();

  // Overlay showing the 12 words again (helps correcting a single typo without restarting).
  if (overlayGrid) {
    overlayGrid.innerHTML = '';
    words.forEach((word, idx) => {
      const div = document.createElement('div');
      div.className = 'mnemonic-word';
      div.innerHTML = `
        <span class="mnemonic-num">${idx + 1}</span>
        <span class="mnemonic-text">${word}</span>
      `;
      overlayGrid.appendChild(div);
    });
  }

  function openVerifyWordsOverlay() {
    if (!overlay) return;
    // Hide keyboard while reading the words.
    currentInput?.blur();
    overlay.classList.remove('hidden');
  }

  function closeVerifyWordsOverlay() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    setTimeout(() => currentInput?.focus(), 80);
  }

  if (btnShowWords) {
    const freshBtn = btnShowWords.cloneNode(true);
    btnShowWords.replaceWith(freshBtn);
    document.getElementById('btn-verify-show-words')?.addEventListener('click', (e) => {
      e.preventDefault();
      openVerifyWordsOverlay();
    }, { once: false });
  }

  if (btnOverlayClose) {
    const freshBtnClose = btnOverlayClose.cloneNode(true);
    btnOverlayClose.replaceWith(freshBtnClose);
    document.getElementById('btn-verify-words-close')?.addEventListener('click', (e) => {
      e.preventDefault();
      closeVerifyWordsOverlay();
    }, { once: false });
  }

  if (overlay && !overlay.dataset.bound) {
    overlay.dataset.bound = '1';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeVerifyWordsOverlay();
    });
  }

  btnBack?.addEventListener('click', () => {
    showScreen('backup');
    setupBackupScreen(pendingWalletData);
  }, { once: true });

  btnClose?.addEventListener('click', async () => {
    await goToHome();
  }, { once: true });

  btnConfirm?.addEventListener('click', async () => {
    try {
      if (!validateCurrentStep()) return;

      if (currentIndex < 11) {
        isStepTransitioning = true;
        btnConfirm.disabled = true;
        currentIndex += 1;
        renderCurrentStep({ animateFromRight: true });
        return;
      }

      // Ask for Face ID or PIN confirmation before saving
      const addr = pendingWalletData?.address;
      const confirmed = await confirmWithAuth(
        'Sécurisez ce compte',
        addr
          ? `Confirmez pour chiffrer et sauvegarder le compte ${addr.slice(0, 8)}…`
          : 'Confirmez votre identité pour chiffrer et sauvegarder ce compte.'
      );
      if (!confirmed) {
        // User cancelled — stay on verify screen
        showScreen('backup-verify');
        setupBackupVerifyScreen(words);
        return;
      }

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

      // Notify parent if embedded in an iframe (site onboarding flow)
      notifyParentWalletCreated(currentWallet.address, currentWallet.publicKey);

      choiceOpenedFromDashboardSettings = false;

      showSuccess('Compte créé !', "Votre compte est prêt. Conservez votre phrase de récupération en lieu sûr.");
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

// Mnemonic import is always 12 words

function setupImportScreen() {
  const btnBack = document.getElementById('btn-import-back');
  const btnClose = document.getElementById('btn-import-close');
  const btnConfirm = document.getElementById('btn-import-confirm');
  const btnHelp = document.getElementById('btn-import-help');
  const statusEl = document.getElementById('import-status');

  // Clear any previous status message
  if (statusEl) statusEl.textContent = '';

  // Build mnemonic grid (always 12 words)
  buildMnemonicImportGrid(12);

  btnBack?.addEventListener('click', () => {
    showScreen('choice');
    setupChoiceScreen();
  }, { once: true });

  btnClose?.addEventListener('click', async () => {
    await goToHome();
  }, { once: true });

  btnConfirm?.addEventListener('click', () => handleImport(statusEl), { once: true });

  btnHelp?.addEventListener('click', () => {
    updateStatus(statusEl, 'Vérifiez votre sauvegarde initiale de 12 mots. Cette phrase a été affichée lors de la création du compte.');
  });
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
              placeholder="Mot ${i + 1}" data-index="${i}">
    `;
    grid.appendChild(cell);
  }

  // Auto-advance on space or tab
  const inputs = grid.querySelectorAll('.import-word-input');
  inputs.forEach((inp, i) => {
    // Block paste for security
    inp.addEventListener('paste', (e) => e.preventDefault());
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
  try {
    let walletResult, seedForStorage;

    // Import from mnemonic (12 words)
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

    // Clear inputs
    document.querySelectorAll('#import-mnemonic-grid .import-word-input').forEach(inp => inp.value = '');

    // Confirm with Face ID or PIN before saving
    const confirmed = await confirmWithAuth('Sécurisez ce compte', `Confirmez pour chiffrer et sauvegarder le compte ${walletResult.address.slice(0, 8)}…`);
    if (!confirmed) {
      showScreen('import');
      setupImportScreen();
      rearmImport(statusEl);
      return;
    }

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

    // Notify parent if embedded in an iframe (site onboarding flow)
    notifyParentWalletCreated(currentWallet.address, currentWallet.publicKey);

    choiceOpenedFromDashboardSettings = false;

    showSuccess('Compte importé !', `Adresse : ${walletResult.address.slice(0, 10)}…${walletResult.address.slice(-6)}`);
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
// CONFIRM WITH AUTH (Face ID + PIN fallback)
// ==========================================

/**
 * Show a confirmation screen: try Face ID first, fallback to PIN.
 * Returns true if confirmed, false if cancelled.
 */
function confirmWithAuth(title, subtitle) {
  return new Promise((resolve) => {
    showScreen('confirm-secure');

    const titleEl = document.getElementById('confirm-secure-title');
    const subtitleEl = document.getElementById('confirm-secure-subtitle');
    const statusEl = document.getElementById('confirm-secure-status');
    const btnBio = document.getElementById('btn-confirm-biometric');
    const btnPIN = document.getElementById('btn-confirm-pin');
    const pinSection = document.getElementById('confirm-pin-section');
    const pinDots = document.getElementById('confirm-pin-dots');
    const pinInput = document.getElementById('confirm-pin-input');

    if (titleEl) titleEl.textContent = title || 'Sécurisez ce compte';
    if (subtitleEl) subtitleEl.textContent = subtitle || '';
    updateStatus(statusEl, '');
    pinSection.classList.add('hidden');

    // Fresh buttons
    const freshBio = btnBio.cloneNode(true);
    const freshPIN = btnPIN.cloneNode(true);
    btnBio.replaceWith(freshBio);
    btnPIN.replaceWith(freshPIN);
    const newBio = document.getElementById('btn-confirm-biometric');
    const newPIN = document.getElementById('btn-confirm-pin');

    // Hide PIN link until Face ID fails
    newPIN.classList.add('hidden');

    // Check if Face ID is available
    getAuthConfig().then(async (authConfig) => {
      if (authConfig?.credentialId) {
        newBio.classList.remove('hidden');

        // Auto-trigger Face ID
        setTimeout(async () => {
          try {
            updateStatus(statusEl, '');
            const prfOutput = await promptBiometric(authConfig.credentialId);
            updateStatus(statusEl, '✅ Confirmé');
            await delay(600);
            resolve(true);
          } catch {
            updateStatus(statusEl, 'Face ID échoué. Utilisez votre code PIN.', true);
            newPIN.classList.remove('hidden');
            showPINFallback();
          }
        }, 400);

        // Manual retry
        newBio.addEventListener('click', async () => {
          try {
            updateStatus(statusEl, '');
            const prfOutput = await promptBiometric(authConfig.credentialId);
            updateStatus(statusEl, '✅ Confirmé');
            await delay(600);
            resolve(true);
          } catch {
            updateStatus(statusEl, 'Face ID échoué. Utilisez votre code PIN.', true);
            newPIN.classList.remove('hidden');
            showPINFallback();
          }
        }, { once: true });
      } else {
        // No Face ID — go straight to PIN
        newBio.classList.add('hidden');
        showPINFallback();
      }
    });

    newPIN.addEventListener('click', () => showPINFallback(), { once: true });

    function showPINFallback() {
      pinSection.classList.remove('hidden');
      const freshInput = pinInput.cloneNode(true);
      pinInput.replaceWith(freshInput);
      const inp = document.getElementById('confirm-pin-input');
      const dots = document.getElementById('confirm-pin-dots');

      inp.value = '';
      dots.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
      setTimeout(() => inp.focus(), 100);

      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 6);
        dots.querySelectorAll('.pin-dot').forEach((d, i) => d.classList.toggle('filled', i < inp.value.length));
        if (inp.value.length === 6) setTimeout(() => checkPIN(inp.value), 200);
      });

      dots?.addEventListener('click', () => inp.focus());
    }

    async function checkPIN(pin) {
      const authConfig = await getAuthConfig();
      const pinOk = await verifyPIN(pin, authConfig.verifyHash, authConfig.verifySalt);

      if (pinOk) {
        updateStatus(statusEl, '✅ Confirmé');
        await delay(600);
        resolve(true);
      } else {
        const dots = document.getElementById('confirm-pin-dots');
        const inp = document.getElementById('confirm-pin-input');
        dots.classList.add('shake');
        setTimeout(() => dots.classList.remove('shake'), 500);
        updateStatus(statusEl, '❌ Code incorrect. Réessayez.', true);
        inp.value = '';
        dots.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
        setTimeout(() => inp.focus(), 800);
      }
    }
  });
}

// ==========================================
// 9. HOME SCREEN → WALLET DASHBOARD (embedded iframe)
// ==========================================

/** Resolve the wallet dashboard URL (same origin) */
function getWalletDashboardUrl() {
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  // In dev (Next.js runs on 3000), point to the Next.js dev server
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${proto}//${host}:3000/wallet?embedded=pwa`;
  }
  // Production: same origin
  return `/wallet?embedded=pwa`;
}

/** Active postMessage bridge cleanup reference */
let _bridgeCleanup = null;

async function goToHome() {
  // Load last used wallet if not already set
  if (!currentWallet) {
    const wallets = await getAllWallets();
    
    // No wallets saved yet — go back to choice screen (create or import)
    if (wallets.length === 0) {
      showScreen('choice');
      setupChoiceScreen();
      return;
    }
    
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

  // Check for URL-based auto-sign or auto-connect (mobile redirect from desktop site)
  const pendingAction = consumePendingUrlAction();
  if (pendingAction && currentWallet) {
    await handleUrlAction(pendingAction);
    return;
  }

  showScreen('wallet-embedded');
  setupWalletEmbedded();
  resetInactivityTimer();
}

/**
 * Check for ?sign=CHALLENGE_ID or ?connect=CHALLENGE_ID in the URL.
 * These are used when the mobile site redirects to wallet-app for signing.
 * Returns the action and cleans the URL.
 */
function consumePendingUrlAction() {
  try {
    const params = new URLSearchParams(window.location.search);
    const signId = params.get('sign');
    const connectId = params.get('connect');
    if (signId || connectId) {
      // Clean URL to prevent re-processing on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('sign');
      url.searchParams.delete('connect');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      if (signId) return { type: 'sign', challengeId: signId };
      if (connectId) return { type: 'connect', challengeId: connectId };
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Handle a URL-triggered sign or connect action.
 * Fetches the challenge from the relay, prompts biometric/PIN, then processes.
 */
async function handleUrlAction(action) {
  showScreen('scanner');
  const statusEl = document.getElementById('scanner-status');
  try {
    updateStatus(statusEl, 'Récupération de la demande…');
    const challenge = await fetchChallenge(action.challengeId);

    if (action.type === 'connect' && challenge.type === 'connect') {
      await handleConnect(challenge, statusEl);
      // URL-based connect → redirect back to the site
      updateStatus(statusEl, 'Redirection vers Xcannes…');
      await delay(1500);
      window.location.href = '/wallet';
      return;
    } else if (action.type === 'sign' && challenge.type === 'sign') {
      await handleSign(challenge, statusEl);
      // URL-based sign → redirect back to the site
      updateStatus(statusEl, 'Retour vers Xcannes…');
      await delay(1500);
      window.location.href = '/wallet';
      return;
    } else {
      updateStatus(statusEl, '❌ Type de demande inattendu.', true);
      setTimeout(() => goToHome(), 3000);
    }
  } catch (err) {
    updateStatus(statusEl, `❌ ${err.message}`, true);
    setTimeout(() => goToHome(), 3000);
  }
}

/**
 * The iframe loads the full WalletDashboard from /wallet?embedded=pwa.
 * Communication:
 *   iframe → PWA: READY, SIGN_TX, DISCONNECT, OPEN_SCANNER
 *   PWA → iframe: INIT, TX_SIGNED, SIGN_ERROR, LOCK, QR_RESULT
 */
function setupWalletEmbedded() {
  const iframe = document.getElementById('wallet-iframe');

  if (!iframe) return;

  // Clean up previous bridge if any
  if (_bridgeCleanup) {
    _bridgeCleanup();
    _bridgeCleanup = null;
  }

  // Load the wallet dashboard
  const dashboardUrl = getWalletDashboardUrl();
  if (iframe.src !== dashboardUrl) {
    iframe.src = dashboardUrl;
  }

  // --- postMessage bridge ---
	  function handleIframeMessage(event) {
	    // Security: only accept messages from same origin or the dashboard URL
	    const data = event.data;
	    if (!data || !data.type) return;

	    switch (data.type) {
	      case 'MOONPAY_ACTIVE':
	        moonpayActiveInDashboard = Boolean(data.active);
	        if (moonpayActiveInDashboard) {
	          moonpayBackgroundGraceAllowed = true;
	        } else {
	          moonpayBackgroundGraceAllowed = false;
	          clearMoonpayBackgroundLockTimer();
	        }
	        break;

	      case 'READY':
	        // iframe loaded — send wallet identity then reveal iframe and hide spinner
	        sendToIframe({
	          type: 'INIT',
	          address: currentWallet?.address || '',
          publicKey: currentWallet?.publicKey || '',
        });
        // Reveal iframe
        if (iframe) iframe.style.opacity = '1';
        // Fade out and remove PWA spinner
        {
          const overlay = document.getElementById('pwa-loading-overlay');
          if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => { if (overlay.parentNode) overlay.style.display = 'none'; }, 420);
          }
        }
        break;

      case 'SIGN_TX':
        handleSignFromIframe(data);
        break;

      case 'DISCONNECT':
        lockWallet();
        break;

      case 'OPEN_SCANNER':
        // The dashboard requests a QR scan — open native scanner
        openScannerFromEmbedded();
        break;

      case 'PROCESS_QR_CHALLENGE':
        // The send modal's QR scanner detected a relay challenge — process it inline
        handleRelayChallengFromIframe(data.rawQR);
        break;

      case 'REQUEST_INIT':
        // Dashboard requests re-init (e.g. after page reload inside iframe)
        sendToIframe({
          type: 'INIT',
          address: currentWallet?.address || '',
          publicKey: currentWallet?.publicKey || '',
        });
        break;

      case 'GET_WALLETS':
        // Dashboard requests the list of all stored wallets
        handleGetWallets();
        break;

      case 'SWITCH_WALLET':
        // Dashboard requests switching to a different wallet
        if (data.address) handleSwitchWalletFromIframe(data.address);
        break;

      case 'GO_TO_CHOICE':
        // Dashboard requests navigation to create/import screen
        // User is already authenticated in the iframe, so go directly
        choiceOpenedFromDashboardSettings = true;
        goToChoice();
        break;

      default:
        break;
    }
  }

  window.addEventListener('message', handleIframeMessage);

  // Store cleanup function
  _bridgeCleanup = () => {
    window.removeEventListener('message', handleIframeMessage);
  };
}

/**
 * Handle a relay challenge forwarded from the iframe's QR scanner.
 * Processes connect/sign without showing the full scanner screen.
 */
async function handleRelayChallengFromIframe(rawQR) {
  const parsed = parseQRCode(rawQR);
  if (!parsed) {
    sendToIframe({ type: 'QR_CHALLENGE_RESULT', success: false, error: 'QR code non reconnu' });
    return;
  }

  try {
    const challenge = await fetchChallenge(parsed.challengeId);

    if (challenge.type === 'connect') {
      await handleConnect(challenge, null);
      sendToIframe({ type: 'QR_CHALLENGE_RESULT', success: true, challengeType: 'connect' });
    } else if (challenge.type === 'sign') {
      await handleSign(challenge, null);
      sendToIframe({ type: 'QR_CHALLENGE_RESULT', success: true, challengeType: 'sign' });
    } else {
      sendToIframe({ type: 'QR_CHALLENGE_RESULT', success: false, error: 'Type de demande inattendu' });
    }
  } catch (err) {
    console.error('[handleRelayChallengFromIframe] Error:', err);
    sendToIframe({ type: 'QR_CHALLENGE_RESULT', success: false, error: err.message });
  }
}

/** Send a message to the wallet iframe */
function sendToIframe(msg) {
  const iframe = document.getElementById('wallet-iframe');
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage(msg, '*');
  }
}

/**
 * Respond to GET_WALLETS — send the list of all stored wallet addresses.
 * Each entry: { address, label, lastUsedAt }
 */
async function handleGetWallets() {
  try {
    const wallets = await getAllWallets();
    sendToIframe({
      type: 'WALLET_LIST',
      wallets: wallets.map(w => ({
        address: w.address,
        label: w.label || null,
        lastUsedAt: w.lastUsedAt || 0,
      })),
      activeAddress: currentWallet?.address || '',
    });
  } catch (err) {
    console.error('[handleGetWallets] Error:', err);
    sendToIframe({ type: 'WALLET_LIST', wallets: [], activeAddress: '' });
  }
}

/**
 * Handle SWITCH_WALLET request from the iframe dashboard.
 * Decrypts the target wallet, updates currentWallet, and sends INIT back.
 */
async function handleSwitchWalletFromIframe(address) {
  try {
    await switchWallet(address);
    // Notify the iframe of the switch (switchWallet already does this,
    // but also re-send the full wallet list)
    handleGetWallets();
  } catch (err) {
    console.error('[handleSwitchWalletFromIframe] Error:', err);
  }
}

/**
 * Handle a SIGN_TX request from the iframe.
 * Signs the transaction locally using the decrypted seed, then sends back
 * the tx_blob. The seed NEVER leaves this PWA.
 */
async function handleSignFromIframe(data) {
  const { txjson, requestId, action } = data;

  if (!currentWallet?.wallet) {
    sendToIframe({ type: 'SIGN_ERROR', error: 'no_wallet', requestId });
    return;
  }

  try {
    // Require Face ID / Touch ID or PIN confirmation for every signature
    const label = action || txjson?.TransactionType || 'Transaction';
    const confirmed = await confirmWithAuth(
      'Confirmer la signature',
      label
    );
    if (!confirmed) {
      sendToIframe({ type: 'SIGN_ERROR', error: 'auth_cancelled', requestId });
      // Return to embedded view
      showScreen('wallet-embedded');
      return;
    }

    // Return to embedded view immediately
    showScreen('wallet-embedded');

    // Sign locally — seed is in memory, never sent to iframe
    const { tx_blob, hash } = signTransaction(currentWallet.wallet, txjson);

    sendToIframe({
      type: 'TX_SIGNED',
      tx_blob,
      hash,
      requestId,
    });
  } catch (err) {
    console.error('[handleSignFromIframe] Error:', err);
    showScreen('wallet-embedded');
    sendToIframe({ type: 'SIGN_ERROR', error: err.message, requestId });
  }
}

/**
 * Open the native scanner screen from embedded mode.
 * When a QR is scanned, process it (connect/sign) then return to embedded.
 */
function openScannerFromEmbedded() {
  showScreen('scanner');
  setupScannerScreen();
  // Override the scanner back button to return to embedded instead of home
  const btnBack = document.getElementById('btn-scanner-back');
  if (btnBack) {
    const freshBtn = btnBack.cloneNode(true);
    btnBack.replaceWith(freshBtn);
    document.getElementById('btn-scanner-back')?.addEventListener('click', () => {
      if (qrScanner) qrScanner.stop();
      showScreen('wallet-embedded');
    }, { once: true });
  }
}

// --- Legacy home functions (kept for scanner success/error return) ---

function setupHomeScreen() {
  // Redirect to embedded dashboard
  showScreen('wallet-embedded');
  setupWalletEmbedded();
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

    // Notify the iframe of the wallet switch
    sendToIframe({ type: 'INIT', address: w.address, publicKey: w.publicKey });
  } catch (err) {
    console.error('[switchWallet] Error:', err);
  }
}

async function checkBalance(address) {
  // Balance is now handled by the embedded wallet dashboard
  // This function is kept for backward compatibility (scanner success screens)
  try {
    const res = await fetch(`${RELAY_URL}/wallet/balance?address=${address}`);
    await res.json().catch(() => ({}));
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
  const btnFaceID = document.getElementById('btn-pin-unlock-faceid');
  const btnReset = document.getElementById('btn-reset-wallet-pin');

  // Address preview removed from UI.
  getLastUsedWallet().then(() => {});

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

      await goToPostUnlockDestination();

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

  // PIN fallback link — hidden until Face ID fails
  const btnUsePIN = document.getElementById('btn-unlock-use-pin');
  if (btnUsePIN) {
    btnUsePIN.classList.add('hidden');
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

  // PIN fallback — hidden until Face ID fails
  const btnUsePIN = document.getElementById('btn-unlock-use-pin');
  if (btnUsePIN) {
    btnUsePIN.classList.add('hidden');
    const freshBtn = btnUsePIN.cloneNode(true);
    btnUsePIN.replaceWith(freshBtn);
    document.getElementById('btn-unlock-use-pin')?.addEventListener('click', () => {
      showScreen('pin-unlock');
      setupEnterPINScreen();
    }, { once: true });
  }

  if (error && error !== 'no_faceid') {
    if (error.name === 'NotAllowedError') {
      updateStatus(statusEl, '');
    } else if (error.message) {
      updateStatus(statusEl, `Erreur : ${error.message}`, true);
    }
    // Face ID already failed — show PIN fallback
    const pinLink = document.getElementById('btn-unlock-use-pin');
    if (pinLink) pinLink.classList.remove('hidden');
  }

  showRetryButton();
  setupResetButton();

  // On mobile, auto-trigger Face ID after a short delay so the user
  // doesn't have to tap the button manually.  The page was loaded from
  // a user click (link in settings menu) so the transient user-activation
  // is usually still valid within ~1 s.
  if (!error || error === 'no_faceid') {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      setTimeout(() => {
        const btn = document.getElementById('btn-unlock');
        if (btn && btn.style.display !== 'none') btn.click();
      }, 400);
    }
  }
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
    updateStatus(statusEl, '');

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
    await goToPostUnlockDestination();

  } catch (err) {
    if (err.name === 'NotAllowedError') {
      updateStatus(statusEl, '');
    } else {
      updateStatus(statusEl, `Erreur : ${err.message}`, true);
    }
    // Show PIN fallback only after Face ID failure
    const btnUsePIN = document.getElementById('btn-unlock-use-pin');
    if (btnUsePIN) btnUsePIN.classList.remove('hidden');
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

  // Notify the iframe before destroying it
  sendToIframe({ type: 'LOCK' });

  // Clean up bridge
  if (_bridgeCleanup) {
    _bridgeCleanup();
    _bridgeCleanup = null;
  }

  // Unload the iframe for security
  const iframe = document.getElementById('wallet-iframe');
  if (iframe) iframe.src = 'about:blank';

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
    showScreen('wallet-embedded');
  }, { once: true });

  btnLock?.addEventListener('click', () => {
    if (qrScanner) qrScanner.stop();
    lockWallet();
  }, { once: true });
}

async function handleQRScanned(rawQR, statusEl) {
  // ── 1. JSON action from desktop dashboard (e.g. "Create or import") ──
  // QR encodes: { "type": "xcannes:navigate", "screen": "choice" }
  try {
    const action = JSON.parse(rawQR);
    if (action && action.type === 'xcannes:navigate') {
      if (qrScanner) { qrScanner.stop(); qrScanner = null; }
      if (action.screen === 'choice') {
        goToChoice();
      }
      return;
    }
  } catch { /* not JSON — continue */ }

  // ── 2. If the QR contains a /wallet-app/ URL, open it in the browser ──
  try {
    const url = new URL(rawQR);
    if (url.pathname.startsWith('/wallet-app')) {
      window.location.href = rawQR;
      return;
    }
  } catch { /* not a URL — continue to relay parsing */ }

  // ── 3. Relay challenge (connect / sign) ──
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

  // Gather all wallet addresses for multi-wallet support on desktop
  let allAddresses = [];
  try {
    const wallets = await getAllWallets();
    allAddresses = wallets.map(w => ({
      address: w.address,
      label: w.label || null,
    }));
  } catch { /* best-effort */ }

  const challengeHex = challenge.challenge || challenge.challengeId;
  const { signature } = signChallenge(currentWallet.wallet, challengeHex);

  await submitConnect(challenge.challengeId, {
    address: currentWallet.address,
    publicKey: currentWallet.publicKey,
    signature,
    addresses: allAddresses,
  });

  // Stop scanner immediately so the camera preview disappears
  if (qrScanner) { qrScanner.stop(); qrScanner = null; }

  showSuccess('Connecté !', `Compte ${currentWallet.address.slice(0, 8)}… lié à Xcannes.`);
  // Quick return — the desktop already transitions on its own
  setTimeout(() => { showScreen('wallet-embedded'); }, 1500);
}

// ==========================================
// SIGN FLOW
// ==========================================

async function handleSign(challenge, statusEl) {
  updateStatus(statusEl, `Signature : ${challenge.action || 'Transaction'}`);

  const txDetails = formatTxDetails(challenge.txjson);
  const detailsEl = document.getElementById('scanner-tx-details');
  if (detailsEl) { detailsEl.textContent = txDetails; detailsEl.classList.remove('hidden'); }

  // Require Face ID / Touch ID or PIN confirmation
  const confirmed = await confirmWithAuth(
    'Confirmer la signature',
    challenge.action || challenge.txjson?.TransactionType || 'Transaction'
  );
  if (!confirmed) {
    updateStatus(statusEl, 'Signature annulée.', true);
    if (detailsEl) detailsEl.classList.add('hidden');
    setTimeout(() => { updateStatus(statusEl, 'Scannez le QR code affiché sur votre écran'); qrScanner?.start(); }, 2000);
    return;
  }

  // Return to scanner screen to show progress
  showScreen('scanner');

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

  setTimeout(() => { showScreen('wallet-embedded'); }, 4000);
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
