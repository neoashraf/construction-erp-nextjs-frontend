import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body
        className="min-h-screen bg-canvas text-foreground antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
