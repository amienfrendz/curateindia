import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        ink: {
          50: "#f8f7f4",
          100: "#ece9e0",
          200: "#cfc9b8",
          300: "#a39c87",
          400: "#5d5749",
          500: "#332f26",
          600: "#221f18",
          700: "#181610",
          800: "#0f0e0a",
          900: "#080704",
        },
        sand: {
          400: "#d4b483",
          500: "#c39a5e",
          600: "#a47940",
        },
        spice: {
          400: "#e58a4e",
          500: "#c46a2c",
          600: "#9a4d18",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grain":
          "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      animation: {
        "shimmer": "shimmer 2s linear infinite",
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-up": "slideUp 0.6s ease-out forwards",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
