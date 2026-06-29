import type { Config } from "tailwindcss";

/**
 * Tailwind config. Colours/spacing/radii are wired to CSS variables defined in
 * src/styles/tokens.css — which currently holds PLACEHOLDER tokens (TODO: real
 * design system is a later phase, see ADR-0003 + FE-DOC-TRACK §6/§7). Components
 * must reference these token-backed utilities, never scattered raw hex/spacing.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
    "./src/providers/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Token-backed (see styles/tokens.css). TODO: replace placeholder values.
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        muted: "var(--color-muted)",
        "muted-foreground": "var(--color-muted-foreground)",
        border: "var(--color-border)",
        primary: "var(--color-primary)",
        "primary-foreground": "var(--color-primary-foreground)",
        destructive: "var(--color-destructive)",
        "destructive-foreground": "var(--color-destructive-foreground)",
      },
      borderRadius: {
        token: "var(--radius)",
      },
      fontFamily: {
        // Bangla-safe stack: keep system + Bangla fallbacks so Bangla never clips.
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
