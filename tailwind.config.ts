import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Estilo Champions League: azul-marinho profundo, azul elétrico e ciano.
        base: "#050A2C",
        panel: {
          DEFAULT: "#0A1145",
          light: "#0E185C",
        },
        // token 'gremio' mantido por compatibilidade = azul elétrico da Champions
        gremio: {
          DEFAULT: "#3B5BFF",
          dark: "#1E2E8C",
        },
        cyan: "#25E4FF", // ciano de destaque (zona de classificação)
        branco: "#FFFFFF",
        ink: {
          DEFAULT: "#EAF0FF",
          muted: "#8FA0D0",
        },
        danger: "#FF5B62",
        line: "rgba(255,255,255,0.10)",
      },
      fontFamily: {
        display: ["var(--font-manrope)", "system-ui", "sans-serif"],
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
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
        pulseAzul: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(59,91,255,0.0)" },
          "50%": { boxShadow: "0 0 0 3px rgba(37,228,255,0.35)" },
        },
      },
      animation: {
        reveal: "reveal 0.35s ease-out both",
        pulseAzul: "pulseAzul 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
