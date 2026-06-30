import type { Config } from "tailwindcss";

/**
 * Tailwind config — every colour/radius/shadow/font maps to a CSS variable in
 * src/styles/tokens.css (the design-system source of truth). Components use these
 * token utilities (bg-primary, text-accent-ink, bg-success-soft, border-strong,
 * shadow-md, rounded-card, …) — never scattered raw hex/spacing.
 * Full reference: docs/design/design-system.md.
 */
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
    "./src/providers/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // neutrals & surfaces
        canvas: "var(--color-canvas)",
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        foreground: "var(--color-foreground)",
        faint: "var(--color-faint)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },

        // brand layer
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          foreground: "var(--color-primary-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
          ink: "var(--color-accent-ink)",
          soft: "var(--color-accent-soft)",
        },
        sidebar: {
          DEFAULT: "var(--color-sidebar)",
          foreground: "var(--color-sidebar-foreground)",
          muted: "var(--color-sidebar-muted)",
          hover: "var(--color-sidebar-hover)",
          active: "var(--color-sidebar-active)",
          "active-foreground": "var(--color-sidebar-active-foreground)",
          border: "var(--color-sidebar-border)",
          ring: "var(--color-sidebar-ring)",
        },

        // functional / status
        success: {
          DEFAULT: "var(--color-success)",
          foreground: "var(--color-success-foreground)",
          soft: "var(--color-success-soft)",
          ink: "var(--color-success-ink)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          foreground: "var(--color-warning-foreground)",
          soft: "var(--color-warning-soft)",
          ink: "var(--color-warning-ink)",
        },
        destructive: {
          DEFAULT: "var(--color-destructive)",
          foreground: "var(--color-destructive-foreground)",
          soft: "var(--color-destructive-soft)",
          ink: "var(--color-destructive-ink)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          foreground: "var(--color-info-foreground)",
          soft: "var(--color-info-soft)",
          ink: "var(--color-info-ink)",
        },

        // categorical (charts)
        chart: {
          1: "var(--color-chart-1)",
          2: "var(--color-chart-2)",
          3: "var(--color-chart-3)",
          4: "var(--color-chart-4)",
          5: "var(--color-chart-5)",
          6: "var(--color-chart-6)",
        },
      },
      borderRadius: {
        token: "var(--radius)", // default control radius (kept: button uses rounded-token)
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        card: "var(--radius-md)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        // Bangla-safe stack: Bangla fallbacks ensure Bangla never clips.
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
      },
    },
  },
  plugins: [],
};

export default config;
