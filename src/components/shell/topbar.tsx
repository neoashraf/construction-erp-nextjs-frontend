"use client";

import { PanelLeft, Menu } from "lucide-react";
import { type Role } from "@/lib/auth/roles";
import { useShellChrome } from "./shell-chrome-context";
import { Breadcrumb } from "./breadcrumb";
import { CompanyFySwitcher } from "./company-fy-switcher";
import { NavCommand } from "./nav-command";
import { QuickCreateMenu } from "./quick-create-menu";
import { AlertsBell } from "./alerts-bell";
import { UserMenu } from "./user-menu";

interface TopbarUser {
  name: string;
  role: Role;
}

/**
 * App Shell v2 toolbar (screen spec §5). Left→right: collapse toggle (≥768) /
 * hamburger (<768) · breadcrumb · company·FY switcher chip. Right: nav-search
 * trigger (Ctrl+K) · "+ New" quick-create · alerts bell · user menu. Replaces the
 * bare UUID-slice context + standalone Sign-out button of the FE-0 placeholder.
 * `<header>` landmark.
 */
export function Topbar({ user }: { user: TopbarUser }) {
  const { collapsed, toggleCollapsed, setDrawerOpen } = useShellChrome();

  return (
    <header
      data-testid="topbar"
      className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 md:px-5"
    >
      {/* far-left: collapse toggle (≥768) */}
      <button
        type="button"
        data-testid="collapse-toggle"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={collapsed}
        onClick={toggleCollapsed}
        className="hidden h-9 w-9 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:grid"
      >
        <PanelLeft className="h-[18px] w-[18px]" aria-hidden />
      </button>

      {/* far-left: hamburger (<768) opens the mobile drawer */}
      <button
        type="button"
        data-testid="drawer-toggle"
        aria-label="Open menu"
        onClick={() => setDrawerOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <Breadcrumb />

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />

      <div className="hidden sm:block">
        <CompanyFySwitcher />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NavCommand role={user.role} />
        <QuickCreateMenu role={user.role} />
        <AlertsBell role={user.role} />
        <UserMenu name={user.name} role={user.role} />
      </div>
    </header>
  );
}
