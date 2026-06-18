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
  "rounded-[20px] border border-transparent",
  "bg-xcannes-btn-green text-white font-semibold",
  "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:bg-xcannes-btn-green-hover hover:-translate-y-px",
  "active:translate-y-0 active:scale-[0.97]",
  "disabled:bg-xcannes-btn-green/45 disabled:text-white/75 disabled:border-white/10 disabled:cursor-not-allowed",
  "disabled:hover:translate-y-0 disabled:hover:scale-100",
].join(" ");


/** SimpleSwap blue action button — with disabled states. */
export const simpleSwapBlueActionBtnBase = [
  "rounded-[20px] border border-transparent",
  "bg-[#0870f8] text-white font-semibold",
  "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:bg-[#0765df] hover:-translate-y-px",
  "active:translate-y-0 active:scale-[0.97]",
  "disabled:bg-[#0870f8]/45 disabled:text-white/75 disabled:border-white/10 disabled:cursor-not-allowed",
  "disabled:hover:translate-y-0 disabled:hover:scale-100",
].join(" ");

/** Fire orange action button — with disabled states. */
export const fireOrangeActionBtnBase = [
  "rounded-[20px] border border-transparent",
  "bg-[#ff6a00] text-white font-semibold",
  "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:bg-[#e85f00] hover:-translate-y-px",
  "active:translate-y-0 active:scale-[0.97]",
  "disabled:bg-[#ff6a00]/45 disabled:text-white/75 disabled:border-white/10 disabled:cursor-not-allowed",
  "disabled:hover:translate-y-0 disabled:hover:scale-100",
].join(" ");

/** Binance yellow action button — with disabled states. */
export const binanceYellowActionBtnBase = [
  "rounded-[20px] border border-transparent",
  "bg-[#F0B90B] text-black font-semibold",
  "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:bg-[#D9A80A] hover:-translate-y-px",
  "active:translate-y-0 active:scale-[0.97]",
  "disabled:bg-[#F0B90B]/45 disabled:text-black/70 disabled:border-white/10 disabled:cursor-not-allowed",
  "disabled:hover:translate-y-0 disabled:hover:scale-100",
].join(" ");

/**
 * ── Surface / layout tokens ──────────────────────────────────────────────────
 *
 * Dark surface colours used consistently across wallet modals.
 * Prefer these over inline Tailwind arbitrary values (`bg-[#101415]` etc.).
 */

/**
 * Currency-select trigger button — dark gradient, soft inset ring, depth shadow.
 * Used for the ModalSelect `buttonClassName` in Buy, Sell and Send modals.
 */
export const modalSelectButtonCls =
  "bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.07] ring-inset rounded-[14px] px-3.5 py-1.5 md:py-2 text-xl md:text-2xl font-light text-white outline-none focus:outline-none cursor-pointer transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]";

/**
 * Currency-select dropdown list — flat dark surface, inset ring, scroll cap.
 * Used for the ModalSelect `selectClassName` in Buy, Sell and Send modals.
 */
export const modalSelectListCls =
  "xcannes-select w-full bg-[#101415] ring-1 ring-white/10 ring-inset rounded-[14px] px-3.5 py-1.5 md:py-2 text-xl md:text-2xl font-light text-white outline-none focus:outline-none cursor-pointer transition-colors duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4)]";
