/**
 * Xcannes Wallet — Storage Service (Multi-wallet + App-level Auth)
 *
 * IndexedDB storage with two stores:
 *   - wallets: encrypted wallet data (multi-wallet support)
 *   - settings: app-level settings (auth config, preferences)
 *
 * Auth settings (stored in 'settings' store):
 *   auth_config: {
 *     masterSalt: string,       // Base64 — PBKDF2 salt for master key derivation
 *     verifySalt: string,       // Base64 — separate salt for PIN verification hash
 *     verifyHash: string,       // Base64 — PIN verification hash
 *     credentialId: string|null, // WebAuthn credential ID (if Face ID enabled)
 *     wrappedMasterKey: { iv, wrappedKey }|null, // Master key wrapped with PRF
 *     pinAttempts: number,      // Failed PIN attempts counter
 *     pinLockedUntil: number,   // Lockout timestamp
 *   }
 *
 * Wallet schema:
 *   {
 *     address: string (primary key),
 *     encryptedSeed: { iv, ciphertext }, // Encrypted with master key
 *     label: string|null,
 *     createdAt: number,
 *     lastUsedAt: number,
 *   }
 */

const DB_NAME = 'xcannes_wallet';
const DB_VERSION = 2; // Bumped for schema change
const STORE_WALLETS = 'wallets';
const STORE_SETTINGS = 'settings';

/**
 * Open (or create/upgrade) the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_WALLETS)) {
        const store = db.createObjectStore(STORE_WALLETS, { keyPath: 'address' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// WALLET OPERATIONS
// ==========================================

/**
 * Save an encrypted wallet to IndexedDB.
 *
 * @param {{
 *   address: string,
 *   encryptedSeed: { iv: string, ciphertext: string },
 *   label?: string
 * }} walletData
 * @returns {Promise<void>}
 */
export async function saveWallet(walletData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WALLETS, 'readwrite');
    const store = tx.objectStore(STORE_WALLETS);

    store.put({
      ...walletData,
      createdAt: walletData.createdAt || Date.now(),
      lastUsedAt: Date.now(),
      label: walletData.label || null,
    });

    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Get a wallet by address.
 * @param {string} address
 * @returns {Promise<object|null>}
 */
export async function getWallet(address) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WALLETS, 'readonly');
    const store = tx.objectStore(STORE_WALLETS);
    const request = store.get(address);

    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

/**
 * Get all wallets (addresses + metadata, NOT decrypted seeds).
 * @returns {Promise<Array>}
 */
export async function getAllWallets() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WALLETS, 'readonly');
    const store = tx.objectStore(STORE_WALLETS);
    const request = store.getAll();

    request.onsuccess = () => { db.close(); resolve(request.result || []); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

/**
 * Delete a wallet from storage.
 * @param {string} address
 * @returns {Promise<void>}
 */
export async function deleteWallet(address) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WALLETS, 'readwrite');
    const store = tx.objectStore(STORE_WALLETS);
    store.delete(address);

    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Update the lastUsedAt timestamp for a wallet.
 * @param {string} address
 * @returns {Promise<void>}
 */
export async function touchWallet(address) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WALLETS, 'readwrite');
    const store = tx.objectStore(STORE_WALLETS);
    const req = store.get(address);

    req.onsuccess = () => {
      if (req.result) {
        req.result.lastUsedAt = Date.now();
        store.put(req.result);
      }
      tx.oncomplete = () => { db.close(); resolve(); };
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Check if any wallet exists in storage.
 * @returns {Promise<boolean>}
 */
export async function hasWallets() {
  const wallets = await getAllWallets();
  return wallets.length > 0;
}

/**
 * Get the most recently used wallet.
 * @returns {Promise<object|null>}
 */
export async function getLastUsedWallet() {
  const wallets = await getAllWallets();
  if (wallets.length === 0) return null;
  return wallets.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))[0];
}

// ==========================================
// SETTINGS OPERATIONS (App-level)
// ==========================================

/**
 * Save a setting.
 * @param {string} key
 * @param {*} value
 */
export async function saveSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put({ key, value });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Get a setting.
 * @param {string} key
 * @returns {Promise<*>}
 */
export async function getSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const req = tx.objectStore(STORE_SETTINGS).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result?.value ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ==========================================
// AUTH CONFIG HELPERS
// ==========================================

/**
 * Save the complete auth configuration.
 * @param {object} config
 */
export async function saveAuthConfig(config) {
  await saveSetting('auth_config', config);
}

/**
 * Get the auth configuration.
 * @returns {Promise<object|null>}
 */
export async function getAuthConfig() {
  return getSetting('auth_config');
}

/**
 * Check if the app has been set up (PIN created).
 * @returns {Promise<boolean>}
 */
export async function isAppSetup() {
  const config = await getAuthConfig();
  return !!(config && config.masterSalt && config.verifyHash);
}

// ==========================================
// NUCLEAR RESET
// ==========================================

/**
 * Delete the entire IndexedDB database.
 * Removes ALL wallets, ALL settings — complete fresh start.
 *
 * On iOS Safari, deleteDatabase can be blocked if connections are open.
 * We first clear all stores manually, THEN try to delete the DB.
 *
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  // Step 1: Clear all object stores
  try {
    const db = await openDB();
    const storeNames = Array.from(db.objectStoreNames);
    if (storeNames.length > 0) {
      const tx = db.transaction(storeNames, 'readwrite');
      for (const name of storeNames) {
        tx.objectStore(name).clear();
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
  } catch (err) {
    console.warn('[storageService] clearStores failed:', err.message);
  }

  // Step 2: Try to delete the database entirely
  return new Promise((resolve) => {
    try {
      const delReq = indexedDB.deleteDatabase(DB_NAME);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => resolve();
      delReq.onblocked = () => {
        console.warn('[storageService] deleteDatabase blocked — stores already cleared');
        resolve();
      };
    } catch {
      resolve();
    }
  });
}
