const TONES = {
  green: {
    soft: "bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green border-xcannes-green/40 focus:ring-xcannes-green/30",
    solid: "bg-xcannes-green hover:bg-xcannes-green/90 text-white border-xcannes-green/40 focus:ring-xcannes-green/30",
  },
  blue: {
    soft: "bg-[#0f7fe1]/20 hover:bg-[#0f7fe1]/30 text-[#0f7fe1] border-[#0f7fe1]/40 focus:ring-[#0f7fe1]/25",
    solid: "bg-[#0f7fe1] hover:bg-[#0b6fc6] text-white border-[#0f7fe1]/40 focus:ring-[#0f7fe1]/25",
  },
  neutral: {
    soft: "bg-white/5 hover:bg-white/10 text-white border-white/15 focus:ring-white/15",
    solid: "bg-white/10 hover:bg-white/15 text-white border-white/20 focus:ring-white/15",
  },
};

const SIZES = {
  sm: "px-4 py-2 text-xs",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-3 text-sm",
};

export function bankButtonClassName({
  tone = "green",
  variant = "soft",
  size = "md",
  className = "",
} = {}) {
  const resolvedTone = TONES[tone] || TONES.green;
  const resolvedVariant = resolvedTone[variant] || resolvedTone.soft;
  const resolvedSize = SIZES[size] || SIZES.md;

  return [
    "inline-flex items-center justify-center rounded-lg border font-medium",
    "transition-all duration-200 hover:scale-105",
    "focus:outline-none focus:ring-2",
    resolvedSize,
    resolvedVariant,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

