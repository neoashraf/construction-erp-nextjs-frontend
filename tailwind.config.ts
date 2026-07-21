import type { Config } from "tailwindcss";

/**
 * Tailwind config — every colour/radius/shadow/font maps to a CSS variable in
 * src/styles/tokens.css (the design-system source of truth). Components use these
 * token utilities (bg-primary, text-accent-ink, bg-success-soft, border-strong,
 * shadow-md, rounded-card, …) — never scattered raw hex/spacing.
 * Full reference: docs/design/design-system.md.
 */

/**
 * Wrap a token CSS variable so Tailwind's opacity modifier (`bg-foreground/40`,
 * `bg-canvas/60`, …) resolves to a real colour. The token vars hold hex values, so
 * Tailwind can't compose alpha into them via the usual `rgb(var(--x) / <alpha-value>)`
 * path — that emits invalid CSS and the utility is dropped (no dialog backdrop, no
 * sticky-header mask). `color-mix` mixes the token with `transparent` by the requested
 * alpha; when no modifier is used, `<alpha-value>` is `1` → the solid token colour,
 * so existing non-modified utilities are unchanged. Supported in all evergreen browsers.
 */
function withAlpha(varName: string): string {
  return `color-mix(in srgb, var(${varName}) calc(<alpha-value> * 100%), transparent)`;
}

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
        canvas: withAlpha("--color-canvas"),
        background: withAlpha("--color-background"),
        surface: withAlpha("--color-surface"),
        "surface-2": withAlpha("--color-surface-2"),
        foreground: withAlpha("--color-foreground"),
        faint: withAlpha("--color-faint"),
        border: withAlpha("--color-border"),
        "border-strong": withAlpha("--color-border-strong"),
        "border-hover": withAlpha("--color-border-hover"),
        input: withAlpha("--color-input"),
        ring: withAlpha("--color-ring"),
        muted: {
          DEFAULT: withAlpha("--color-muted"),
          foreground: withAlpha("--color-muted-foreground"),
        },

        // brand layer
        primary: {
          DEFAULT: withAlpha("--color-primary"),
          hover: withAlpha("--color-primary-hover"),
          foreground: withAlpha("--color-primary-foreground"),
        },
        accent: {
          DEFAULT: withAlpha("--color-accent"),
          foreground: withAlpha("--color-accent-foreground"),
          ink: withAlpha("--color-accent-ink"),
          soft: withAlpha("--color-accent-soft"),
          border: withAlpha("--color-accent-border"),
        },
        sidebar: {
          DEFAULT: withAlpha("--color-sidebar"),
          foreground: withAlpha("--color-sidebar-foreground"),
          muted: withAlpha("--color-sidebar-muted"),
          hover: withAlpha("--color-sidebar-hover"),
          active: withAlpha("--color-sidebar-active"),
          "active-foreground": withAlpha("--color-sidebar-active-foreground"),
          border: withAlpha("--color-sidebar-border"),
          ring: withAlpha("--color-sidebar-ring"),
        },

        // functional / status
        success: {
          DEFAULT: withAlpha("--color-success"),
          foreground: withAlpha("--color-success-foreground"),
          soft: withAlpha("--color-success-soft"),
          ink: withAlpha("--color-success-ink"),
        },
        warning: {
          DEFAULT: withAlpha("--color-warning"),
          foreground: withAlpha("--color-warning-foreground"),
          soft: withAlpha("--color-warning-soft"),
          ink: withAlpha("--color-warning-ink"),
        },
        destructive: {
          DEFAULT: withAlpha("--color-destructive"),
          foreground: withAlpha("--color-destructive-foreground"),
          soft: withAlpha("--color-destructive-soft"),
          ink: withAlpha("--color-destructive-ink"),
        },
        info: {
          DEFAULT: withAlpha("--color-info"),
          foreground: withAlpha("--color-info-foreground"),
          soft: withAlpha("--color-info-soft"),
          ink: withAlpha("--color-info-ink"),
        },
        violet: {
          DEFAULT: withAlpha("--color-violet"),
          soft: withAlpha("--color-violet-soft"),
          ink: withAlpha("--color-violet-ink"),
        },
        teal: {
          DEFAULT: withAlpha("--color-teal"),
          soft: withAlpha("--color-teal-soft"),
          ink: withAlpha("--color-teal-ink"),
        },

        // categorical (charts)
        chart: {
          1: withAlpha("--color-chart-1"),
          2: withAlpha("--color-chart-2"),
          3: withAlpha("--color-chart-3"),
          4: withAlpha("--color-chart-4"),
          5: withAlpha("--color-chart-5"),
          6: withAlpha("--color-chart-6"),
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
        focus: "var(--focus-ring)",
        "focus-error": "var(--focus-ring-error)",
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
