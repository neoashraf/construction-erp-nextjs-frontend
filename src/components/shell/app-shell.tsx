"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/providers/session-provider";
import { ShellChromeProvider } from "./shell-chrome-context";
import { BreadcrumbProvider, Breadcrumb } from "./breadcrumb";
import { Sidebar } from "./sidebar";
import { NavDrawer } from "./nav-drawer";
import { Topbar } from "./topbar";
import { ShellSkeleton } from "./shell-skeleton";

/**
 * App Shell v3 (screen spec §3.3/§4/§6/§10). The persistent frame around every
 * authenticated screen: navy two-level sidebar (or 56px rail) with the profile
 * docked in its footer + mobile drawer + a GLOBAL-ONLY toolbar over the content
 * outlet. The detail-only breadcrumb renders in the content area just above the
 * routed screen (never the topbar). Adds the skip-link (first tabbable →
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

        {/* 100vh persistent frame (spec §4 "above-the-fold ≥1024"): sidebar + topbar
            are pinned chrome; only the sidebar nav tree and the <main> outlet scroll
            internally. `h-screen overflow-hidden` clamps the frame to the viewport so
            the page never scrolls as a whole (which would carry the topbar off-screen). */}
        <div className="flex h-screen overflow-hidden bg-canvas">
          <Sidebar user={user} />
          <NavDrawer user={user} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Topbar role={user.role} />
            <OfflineBanner />
            <main
              id="app-content"
              className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5 lg:p-6"
              data-testid="app-content"
            >
              {/* detail-only breadcrumb — content header, above the screen's H1 (v3 §3.3) */}
              <Breadcrumb />
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
