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
  "disabled:bg-xcannes-btn-green/45 disabled:text-white/75 disabled:border-white/10 disabled:cursor-not-allowed",
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

/** Neutral blue action button — with disabled states. */
export const blueNeutralActionBtnBase = [
  "rounded-lg border border-transparent",
  "bg-xcannes-blue text-white font-semibold",
  "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:bg-xcannes-blue/40 hover:-translate-y-px",
  "active:translate-y-0 active:scale-[0.97]",
  "disabled:bg-xcannes-blue/45 disabled:text-white/75 disabled:border-white/10 disabled:cursor-not-allowed",
  "disabled:hover:translate-y-0 disabled:hover:scale-100",
].join(" ");

/** Violet action button (MoonPay vibe) — with disabled states. */
export const violetActionBtnBase = [
  "rounded-lg border border-transparent",
  "bg-xcannes-violet text-white font-semibold",
  "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:bg-xcannes-violet-weight hover:-translate-y-px",
  "active:translate-y-0 active:scale-[0.97]",
  "disabled:bg-xcannes-violet/45 disabled:text-white/75 disabled:border-white/10 disabled:cursor-not-allowed",
  "disabled:hover:translate-y-0 disabled:hover:scale-100",
].join(" ");

/** SimpleSwap blue action button — with disabled states. */
export const simpleSwapBlueActionBtnBase = [
  "rounded-lg border border-transparent",
  "bg-[#0870f8] text-white font-semibold",
  "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:bg-[#0765df] hover:-translate-y-px",
  "active:translate-y-0 active:scale-[0.97]",
  "disabled:bg-[#0870f8]/45 disabled:text-white/75 disabled:border-white/10 disabled:cursor-not-allowed",
  "disabled:hover:translate-y-0 disabled:hover:scale-100",
].join(" ");

/** Standard modal max-height on desktop. */
export const MODAL_MAX_H = "md:max-h-[100vh]";
