/**
 * walletAppDetect — Check if the wallet-app (PWA) has a wallet set up.
 *
 * Reads the shared IndexedDB database `xcannes_wallet` (same origin as
 * the Next.js site and the wallet-app).  If the `wallets` store contains
 * at least one entry AND a valid auth_config exists in `settings`, we
 * consider the wallet ready.
 *
 * Works from any page on the same domain — no import from wallet-app needed.
 */

const DB_NAME = "xcannes_wallet";
const DB_VERSION = 2;
const STORE_WALLETS = "wallets";
const STORE_SETTINGS = "settings";

/**
 * Open the wallet-app IndexedDB (read-only, non-destructive).
 * Returns null if the database doesn't exist or can't be opened.
 */
function openWalletDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // If the DB doesn't exist, onupgradeneeded fires.
      // We don't want to CREATE stores — just check if they exist.
      request.onupgradeneeded = (event) => {
        // DB was just created (didn't exist before) → no wallet
        // Abort the transaction so we don't create empty stores
        event.target.transaction.abort();
      };

      request.onsuccess = () => {
        const db = request.result;
        // Verify the required stores exist
        if (
          db.objectStoreNames.contains(STORE_WALLETS) &&
          db.objectStoreNames.contains(STORE_SETTINGS)
        ) {
          resolve(db);
        } else {
          db.close();
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Check if the wallet-app has at least one wallet configured with auth.
 *
 * @returns {Promise<{
 *   hasWallet: boolean,
 *   walletCount: number,
 *   hasAuth: boolean,
 *   lastAddress: string | null
 * }>}
 */
export async function detectWalletApp() {
  const result = {
    hasWallet: false,
    walletCount: 0,
    hasAuth: false,
    lastAddress: null,
  };

  try {
    const db = await openWalletDB();
    if (!db) return result;

    // Count wallets
    const wallets = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WALLETS, "readonly");
      const req = tx.objectStore(STORE_WALLETS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    result.walletCount = wallets.length;
    result.hasWallet = wallets.length > 0;

    if (wallets.length > 0) {
      // Find last used wallet address
      const sorted = wallets.sort(
        (a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0)
      );
      result.lastAddress = sorted[0]?.address || null;
    }

    // Check auth config
    const authConfig = await new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, "readonly");
      const req = tx.objectStore(STORE_SETTINGS).get("auth_config");
      req.onsuccess = () => resolve(req.result?.value || null);
      req.onerror = () => resolve(null);
    });

    result.hasAuth = !!(
      authConfig &&
      authConfig.masterSalt &&
      authConfig.verifyHash
    );

    db.close();
  } catch {
    // Any error → assume no wallet
  }

  return result;
}

/**
 * Quick boolean check: does a wallet exist and is auth configured?
 */
export async function hasConfiguredWallet() {
  const info = await detectWalletApp();
  return info.hasWallet && info.hasAuth;
}
