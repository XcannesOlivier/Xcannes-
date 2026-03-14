"use client";

const VARIANTS = {
  blue: {
    btn: "border-[#38BDF8]/40 bg-[#38BDF8]/20 text-white hover:bg-[#38BDF8]/30 active:bg-[#38BDF8]/40",
    disabledBtn: "border-[#38BDF8]/20 bg-[#38BDF8]/10 text-white/50",
  },
  green: {
    btn: "border-[#22C55E]/40 bg-[#22C55E]/20 text-white hover:bg-[#22C55E]/30 active:bg-[#22C55E]/40",
    disabledBtn: "border-[#22C55E]/20 bg-[#22C55E]/10 text-white/50",
  },
  cyan: {
    btn: "border-[#06B6D4]/40 bg-[#06B6D4]/20 text-white hover:bg-[#06B6D4]/30 active:bg-[#06B6D4]/40",
    disabledBtn: "border-[#06B6D4]/20 bg-[#06B6D4]/10 text-white/50",
  },
  xcannesGreen: {
    btn: "border-[#10B981]/40 bg-[#10B981]/20 text-white hover:bg-[#10B981]/30 active:bg-[#10B981]/40",
    disabledBtn: "border-[#10B981]/20 bg-[#10B981]/10 text-white/50",
  },
  orange: {
    btn: "border-orange-400/40 bg-gradient-to-r from-orange-500/20 to-amber-600/20 text-white hover:from-orange-500/30 hover:to-amber-600/30 active:from-orange-500/40 active:to-amber-600/40",
    disabledBtn: "border-orange-400/20 bg-gradient-to-r from-orange-500/10 to-amber-600/10 text-white/50",
  },
};

export default function SwipeConfirmButton({
  label,
  onConfirm,
  disabled = false,
  variant = "blue",
  className = "",
}) {
  const variantStyle = VARIANTS[variant] || VARIANTS.blue;
  const btnClassName = disabled ? variantStyle.disabledBtn : variantStyle.btn;

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onConfirm?.();
        }}
        className={`w-full rounded-lg border py-3.5 text-lg font-semibold transition-colors active:scale-[0.98] ${btnClassName}`}
      >
        {label}
      </button>
    </div>
  );
}
