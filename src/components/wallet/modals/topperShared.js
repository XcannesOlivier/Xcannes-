/**
 * topperShared.js — Constantes et helpers partagés entre TopperBuyModal et TopperSellModal.
 */

export const TOPPER_ACTIVE_STORAGE_KEY = "xcannes_topper_active";

export const setTopperActive = (active) => {
  if (typeof window === "undefined") return;
  try {
    window.__XCANNES_TOPPER_ACTIVE__ = Boolean(active);
    if (active) {
      window.sessionStorage?.setItem(TOPPER_ACTIVE_STORAGE_KEY, "1");
    } else {
      window.sessionStorage?.removeItem(TOPPER_ACTIVE_STORAGE_KEY);
    }
    window.dispatchEvent(
      new CustomEvent("xcannes:topper-active", { detail: { active: Boolean(active) } }),
    );
  } catch {
    // ignore storage errors
  }
};
