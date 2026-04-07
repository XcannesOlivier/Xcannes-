"use client";

const VARIANTS = {
  blue: {
    btn: "border-transparent bg-xcannes-btn-green text-white hover:bg-xcannes-btn-green-hover hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
    disabledBtn: "border-transparent bg-xcannes-btn-green/40 text-white/50",
  },
  green: {
    btn: "border-transparent bg-xcannes-btn-green text-white hover:bg-xcannes-btn-green-hover hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
    disabledBtn: "border-transparent bg-xcannes-btn-green/40 text-white/50",
  },
  cyan: {
    btn: "border-transparent bg-xcannes-btn-green text-white hover:bg-xcannes-btn-green-hover hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
    disabledBtn: "border-transparent bg-xcannes-btn-green/40 text-white/50",
  },
  xcannesGreen: {
    btn: "border-transparent bg-xcannes-btn-green text-white hover:bg-xcannes-btn-green-hover hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
    disabledBtn: "border-transparent bg-xcannes-btn-green/40 text-white/50",
  },
  xcannesBlueNeutral: {
    btn: "border-transparent bg-xcannes-blue text-white hover:bg-xcannes-blue/40 hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
    disabledBtn: "border-transparent bg-xcannes-blue/40 text-white/50",
  },
  xcannesViolet: {
    btn: "border-transparent bg-xcannes-violet text-white hover:bg-xcannes-violet-weight hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
    disabledBtn: "border-transparent bg-xcannes-violet/40 text-white/50",
  },
  orange: {
    btn: "border-transparent bg-xcannes-btn-green text-white hover:bg-xcannes-btn-green-hover hover:-translate-y-px active:translate-y-0 active:scale-[0.97]",
    disabledBtn: "border-transparent bg-xcannes-btn-green/40 text-white/50",
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
        className={`w-full rounded-lg border py-4 text-xl font-semibold transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${btnClassName}`}
      >
        {label}
      </button>
    </div>
  );
}
