import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark tricolor: preto/azul-marinho de fundo, azul celeste e branco do Grêmio.
        base: "#080D18",
        panel: {
          DEFAULT: "#0E1930",
          light: "#14243F",
        },
        // azul do Grêmio (celeste) como cor primária
        gremio: {
          DEFAULT: "#1B9DE0",
          dark: "#0A5FA5",
        },
        // branco como cor secundária/destaque
        branco: "#FFFFFF",
        ink: {
          DEFAULT: "#EEF2F8",
          muted: "#8FA3BE",
        },
        danger: "#FF5B62",
        line: "rgba(255,255,255,0.09)",
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
        pulseAzul: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(27,157,224,0.0)" },
          "50%": { boxShadow: "0 0 0 3px rgba(27,157,224,0.30)" },
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
