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
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body className="min-h-screen bg-canvas text-foreground antialiased">{children}</body>
    </html>
  );
}
