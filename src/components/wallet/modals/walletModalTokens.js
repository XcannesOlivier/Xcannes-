/**
 * Shared design tokens for wallet modals.
 *
 * Single source of truth for action-button classes and modal layout
 * constants used across Send, Receive, Swap, Payreq and Cash modals.
 *
 * Colours reference the Tailwind tokens defined in tailwind.config.js
 * (`xcannes-btn-green`, `xcannes-btn-green-hover`).
 */

/** Primary green action button — with disabled states. */
export const greenActionBtnBase = [
  "rounded-lg border border-transparent",
  "bg-xcannes-btn-green text-white font-semibold",
  "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:bg-xcannes-btn-green-hover hover:-translate-y-px",
  "active:translate-y-0 active:scale-[0.97]",
  "disabled:bg-xcannes-btn-green/40 disabled:text-white/50 disabled:cursor-not-allowed",
  "disabled:hover:translate-y-0 disabled:hover:scale-100",
].join(" ");

/** Same green action button without disabled-state classes (e.g. Receive). */
export const greenActionBtnMuted = [
  "rounded-lg border border-transparent",
  "bg-xcannes-btn-green text-white font-semibold",
  "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:bg-xcannes-btn-green-hover hover:-translate-y-px",
  "active:translate-y-0 active:scale-[0.97]",
].join(" ");

/** Standard modal max-height on desktop. */
export const MODAL_MAX_H = "md:max-h-[100vh]";
