"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/providers/session-provider";
import { ShellChromeProvider } from "./shell-chrome-context";
import { BreadcrumbProvider } from "./breadcrumb";
import { Sidebar } from "./sidebar";
import { NavDrawer } from "./nav-drawer";
import { Topbar } from "./topbar";
import { ShellSkeleton } from "./shell-skeleton";

/**
 * App Shell v2 (screen spec §4/§6/§10). The persistent frame around every
 * authenticated screen: navy two-level sidebar (or 56px rail) + mobile drawer + a
 * light toolbar over the content outlet. Adds the skip-link (first tabbable →
 * `#app-content`), the offline banner, and the collapse/breadcrumb context. Screens
 * render unchanged inside `<main id="app-content">`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const user = useSession();

  // Session not yet known (defensive — the server layout normally guarantees it):
  // render the whole-shell skeleton rather than flashing wrong-role nav (spec §6).
  if (!user) return <ShellSkeleton />;

  return (
    <ShellChromeProvider>
      <BreadcrumbProvider>
        <a
          href="#app-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[90] focus:rounded-token focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to content
        </a>

        <div className="flex min-h-screen bg-canvas">
          <Sidebar role={user.role} />
          <NavDrawer role={user.role} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar user={user} />
            <OfflineBanner />
            <main id="app-content" className="flex-1 p-5 lg:p-6" data-testid="app-content">
              {children}
            </main>
          </div>
        </div>
      </BreadcrumbProvider>
    </ShellChromeProvider>
  );
}

/** Sticky offline banner under the topbar (spec §6/§8). Dismisses on reconnect. */
function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="border-b border-warning/30 bg-warning-soft px-5 py-2 text-[13px] font-medium text-warning-ink"
    >
      You&apos;re offline. Changes can&apos;t be saved.
    </div>
  );
}
