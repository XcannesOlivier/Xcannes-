/**
 * Shared design tokens for demo-wallet modals.
 * Intentionally duplicated from the real wallet to keep demo-wallet
 * fully decoupled (no cross-imports).
 */

export const greenActionBtnBase = [
  "rounded-[20px] border border-transparent",
  "bg-xcannes-btn-green text-white font-semibold",
  "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:bg-xcannes-btn-green-hover hover:-translate-y-px",
  "active:translate-y-0 active:scale-[0.97]",
  "disabled:bg-xcannes-btn-green/45 disabled:text-white/75 disabled:border-white/10 disabled:cursor-not-allowed",
  "disabled:hover:translate-y-0 disabled:hover:scale-100",
].join(" ");

export const modalSelectButtonCls =
  "bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.07] ring-inset rounded-[14px] px-3.5 py-1.5 text-xl text-white outline-none focus:outline-none cursor-pointer transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]";

export const modalSelectListCls =
  "xcannes-select w-full bg-[#101415] ring-1 ring-white/10 ring-inset rounded-[14px] px-3.5 py-1.5 text-xl text-white outline-none focus:outline-none cursor-pointer transition-colors duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4)]";
