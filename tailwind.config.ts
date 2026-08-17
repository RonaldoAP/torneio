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
        base: "#01040A",
        panel: {
          DEFAULT: "#081426",
          light: "#0E2038",
        },
        // token 'gremio' mantido por compatibilidade = azul elétrico da Champions
        gremio: {
          DEFAULT: "#3B5BFF",
          dark: "#1E2E8C",
        },
        cyan: "#25E4FF", // ciano de destaque (zona de classificação)
        azul: "#3E9BE9", // azul das molduras de foto (referência do Figma)
        branco: "#FFFFFF",
        ink: {
          DEFAULT: "#EAF0FF",
          muted: "#8FA0D0",
        },
        danger: "#FF5B62",
        line: "rgba(255,255,255,0.08)",
      },
      fontFamily: {
        // display = títulos, nomes de participantes, placares e tabelas
        display: ["var(--font-sofia)", "var(--font-manrope)", "system-ui", "sans-serif"],
        // sans = texto de corpo e explicações
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
        floatY: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-7px)" },
        },
      },
      animation: {
        reveal: "reveal 0.35s ease-out both",
        pulseAzul: "pulseAzul 1.6s ease-in-out infinite",
        floatY: "floatY 3.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
