/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "xcannes-background": "#0a0f0d",
        "xcannes-green": "#10b981",
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
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "sans-serif"],
        orbitron: ["var(--font-orbitron)", "sans-serif"],
        montserrat: ["var(--font-montserrat)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
