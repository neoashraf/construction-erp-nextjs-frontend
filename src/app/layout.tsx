import type { Metadata } from "next";
import { Inter, Hind_Siliguri, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Design-system type stack (docs/design/design-files/Zakir ERP Design System.dc.html
 * §Type): Inter for Latin text, Hind Siliguri as the Bangla-safe fallback so Bangla
 * text never clips (overview §9 / NFR-009), and JetBrains Mono for tabular figures
 * (codes, dates, money) — the mono face the design mockups render. All exposed as CSS
 * variables that --font-sans / --font-mono (src/styles/tokens.css) consume —
 * self-hosted via next/font, no runtime Google Fonts request.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "600"],
  variable: "--font-hind-siliguri",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zakir Enterprise — Construction ERP",
  description: "Project-centric construction & engineering ERP.",
};

/**
 * Root layout. Renders <html>/<body> and the global stylesheet (which imports the
 * placeholder design tokens). Client providers are mounted per route group: the
 * (app) shell wraps its tree in AppProviders with the server-read session.
 *
 * `suppressHydrationWarning` on <html>/<body>: browser extensions (Grammarly's
 * `data-gr-*`/`data-new-gr-*`, `cz-shortcut-listen`, theme togglers, etc.) mutate
 * these top-level elements before React hydrates, which otherwise trips a spurious
 * hydration-mismatch warning. React scopes this suppression to the element's OWN
 * attributes only (it does NOT cascade to children), so real mismatches inside the
 * app are still reported.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${inter.variable} ${hindSiliguri.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen bg-canvas text-foreground antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
