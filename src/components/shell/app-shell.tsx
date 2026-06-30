"use client";

import { type ReactNode } from "react";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * The role-based app shell (design-system §5.2, skill §2.1). Full-height navy sidebar
 * + a light topbar over the content. Desktop-first (≥1024 primary); the sidebar is
 * hidden on the minimal-mobile surface. No screens render here — module segments are
 * filled by per-screen briefs.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const user = useAuthenticatedUser();
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 p-5 lg:p-6" data-testid="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
