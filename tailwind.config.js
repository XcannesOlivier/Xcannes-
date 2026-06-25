/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: "0.375rem",
        sm: "0.375rem",
        md: "0.375rem",
        lg: "0.375rem",
        xl: "0.375rem",
        "2xl": "0.375rem",
        "3xl": "0.375rem",
      },
      spacing: {
        18: "4.5rem",
        30: "7.5rem",
      },
      colors: {
        "xcannes-background": "#0a0f0d",
        "xcannes-green": "#16a34a",
        "xcannes-blue-light": "#3b82f6",
        "xcannes-blue": "#1e40af",
        "xcannes-blue-weight": "#1e3a5f",
        "xcannes-green-weight": "#065f46",
        "xcannes-red": "#dc2626",
        "xcannes-red-light": "#ef4444",
        "xcannes-yellow": "#fbbf24",
        "xcannes-yellow-weight": "#92400e",
        "xcannes-gray": "#4b5563",
        "xcannes-gray-light": "#6b7280",
        "xcannes-gray-weight": "#1f2937",
        "xcannes-violet": "#7c3aed",
        "xcannes-violet-weight": "#5b21b6",
        "xcannes-pink": "#ec4899",
        "xcannes-pink-weight": "#be185d",
        "xcannes-btn-green": "#15803d",
        "xcannes-btn-green-hover": "#166534",
        "xcannes-surface-demo": "#0b0f10",
        "xcannes-accent-green": "#22C55E",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        fadeScale: "fadeScale 180ms ease-out forwards",
        "slide-from-left": "slideFromLeft 0.45s cubic-bezier(0.16,1,0.3,1) both",
        "slide-from-right": "slideFromRight 0.45s cubic-bezier(0.16,1,0.3,1) both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        fadeScale: {
          "0%": { opacity: 0, transform: "scale(0.98)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
        slideFromLeft: {
          "0%": { opacity: 0, transform: "translateX(-28px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
        slideFromRight: {
          "0%": { opacity: 0, transform: "translateX(28px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        orbitron: ["var(--font-orbitron)", "system-ui", "sans-serif"],
        montserrat: ["var(--font-montserrat)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
