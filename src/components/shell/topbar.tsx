"use client";

import { PanelLeft, Menu } from "lucide-react";
import { type NavViewer } from "@/lib/nav/nav-tree";
import { useShellChrome } from "./shell-chrome-context";
import { CompanyFySwitcher } from "./company-fy-switcher";
import { NavCommand } from "./nav-command";
import { AlertsBell } from "./alerts-bell";

/**
 * App Shell v3 toolbar (screen spec §3.3/§4/§5) — GLOBAL context + utilities ONLY.
 * Left group: collapse toggle (36×36 bordered icon box, panel-left glyph — never a
 * hamburger at ≥768) · 1px divider · company·FY switcher chip. Right group: go-to
 * search icon-box (opens the search takeover) · alerts bell icon-box. Nothing
 * page-specific lives here: no "+ New" (creates are in each page's content header),
 * no breadcrumb (detail-only, in the content header), no user block (docked in the
 * sidebar footer). The three utility icons are identical 36×36 bordered boxes.
 * `<header>` landmark.
 */

/** The shared 36×36 bordered icon-box style for the topbar utility trio (spec §4). */
export const TOPBAR_ICON_BOX =
  "grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:border-border-strong hover:bg-canvas hover:text-foreground";

export function Topbar({ viewer }: { viewer: NavViewer }) {
  const { collapsed, toggleCollapsed, setDrawerOpen } = useShellChrome();

  return (
    <header
      data-testid="topbar"
      className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 md:px-5"
    >
      {/* left group — collapse toggle (≥768): panel-left icon box, NOT a hamburger */}
      <button
        type="button"
        data-testid="collapse-toggle"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={collapsed}
        onClick={toggleCollapsed}
        className={`hidden md:grid ${TOPBAR_ICON_BOX}`}
      >
        <PanelLeft className="h-[17px] w-[17px]" aria-hidden />
      </button>

      {/* hamburger only on the mobile frame (<768): opens the nav drawer */}
      <button
        type="button"
        data-testid="drawer-toggle"
        aria-label="Open menu"
        onClick={() => setDrawerOpen(true)}
        className={`md:hidden ${TOPBAR_ICON_BOX}`}
      >
        <Menu className="h-[18px] w-[18px]" aria-hidden />
      </button>

      <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />

      <div className="hidden sm:block">
        <CompanyFySwitcher />
      </div>

      {/* right group — search + bell icon boxes (identical trio with the toggle) */}
      <div className="ml-auto flex items-center gap-2">
        <NavCommand viewer={viewer} />
        <AlertsBell viewer={viewer} />
      </div>
    </header>
  );
}
