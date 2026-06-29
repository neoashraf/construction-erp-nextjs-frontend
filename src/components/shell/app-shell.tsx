"use client";

import { type ReactNode } from "react";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * The role-based app shell (skill §2.1, ADR-0003 F1). Sidebar nav slots are driven
 * by the session role; the topbar shows the active company/FY context + user.
 * Desktop-first (≥1024 primary): the sidebar is persistent on wide screens and
 * collapses on narrow ones. NO screens render here — module segments are empty.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const user = useAuthenticatedUser();
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar user={user} />
      <div className="flex flex-1">
        <Sidebar role={user.role} />
        <main className="flex-1 p-6" data-testid="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
