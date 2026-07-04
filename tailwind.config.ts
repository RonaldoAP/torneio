import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#0A0F1C",
        panel: {
          DEFAULT: "#111a2e",
          light: "#16223c",
        },
        grass: "#2FD27C",
        gold: "#F5C451",
        ink: {
          DEFAULT: "#EEF2F8",
          muted: "#8A97AD",
        },
        danger: "#FF5B62",
        line: "rgba(255,255,255,0.08)",
      },
      fontFamily: {
        display: ["var(--font-bebas)", "Impact", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      keyframes: {
        reveal: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGrass: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(47,210,124,0.0)" },
          "50%": { boxShadow: "0 0 0 3px rgba(47,210,124,0.25)" },
        },
      },
      animation: {
        reveal: "reveal 0.35s ease-out both",
        pulseGrass: "pulseGrass 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
