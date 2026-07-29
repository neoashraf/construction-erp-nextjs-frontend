"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  visibleTreeForRole,
  matchNav,
  suppressesHeader,
  navSectionSlug,
  CHIP_CLASS,
  type NavSectionGroup,
  type NavItem,
} from "@/lib/nav/nav-tree";
import { NAV_ICON } from "./nav-icons";
import { BrandLogo } from "./brand-logo";
import { BRAND_NAME } from "@/lib/brand";
import { useShellChrome } from "./shell-chrome-context";
import { useCompanyFy } from "@/providers/company-fy-provider";
import { UserMenu, type UserMenuUser } from "./user-menu";
import { type SessionPermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

/** The sidebar's viewer: identity for the footer + the grant set for nav filtering. */
export type SidebarUser = UserMenuUser & { permissions?: SessionPermission[] | null };

/**
 * App Shell sidebar navbar (nav IA redesign; screen spec §3.1/§3.2/§5/§9/§10). ONE
 * level: section → screen. Every visible screen is its own row, one click away —
 * there is no module level and nothing discloses/collapses. A section that
 * resolves to a single item whose label restates the section renders as a bare row
 * with no header (`suppressesHeader`). The governance sections (`USERS & ACCESS`,
 * `AUDIT LOG`) render below a single `role="separator"` divider. User-toggled
 * collapse narrows to a 56px icon rail with hover/click flyouts (one per section).
 * Role-filtered (defence-in-depth UI — guards + backend re-check). The FOOTER pins
 * the working context line (`FY … · BDT (৳)`) and the user/profile block (upward
 * menu). `aside[aria-label="Primary"]`.
 */
export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const { collapsed } = useShellChrome();

  // Publish the sidebar's live width as a CSS variable on :root so viewport-fixed
  // chrome (the voucher-editor action bars) can offset its left edge past the sidebar
  // instead of spanning underneath it. 56px rail when collapsed, 230px when expanded;
  // consumers apply it only at md+ (below md the sidebar is hidden and bars go full-width).
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sidebar-w", collapsed ? "56px" : "230px");
    return () => {
      root.style.removeProperty("--sidebar-w");
    };
  }, [collapsed]);

  // FE-21: permission-driven filtering when the projection is present; role fallback otherwise.
  const tree = visibleTreeForRole(user);
  const match = matchNav(pathname);
  const activeRoute = match?.item.route ?? null;

  let dividerRendered = false;

  return (
    <aside
      aria-label="Primary"
      data-testid="sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        // h-screen: self-contained 100vh chrome (spec §4). The nav below scrolls
        // internally; the brand (above) and footer (below) stay pinned.
        "hidden h-screen shrink-0 flex-col bg-sidebar transition-[width] duration-150 md:flex",
        collapsed ? "w-14" : "w-[230px]",
      )}
    >
      {/* brand — pinned top chrome (shrink-0 so a short viewport can't compress it).
          The logo is a wide wordmark, so size by HEIGHT only (width auto) — expanded
          shows the full wordmark; the 56px rail shows a small height-capped crop. */}
      <div className={cn("flex shrink-0 items-center px-4 py-4", collapsed ? "justify-center px-0" : "gap-2.5")}>
        <BrandLogo className={cn(collapsed ? "h-12" : "h-16")} alt={BRAND_NAME} />
      </div>

      {/* nav tree — the only scrolling region; min-h-0 lets it shrink below its
          content height so overflow engages and the pinned footer isn't clipped.
          scrollbar-thin keeps the gutter subtle (thumb only on hover) so a nav that
          barely overflows doesn't show a heavy always-on scrollbar. A plain <div>,
          not a <nav> — each visible section is its OWN navigation landmark below,
          INCLUDING sections whose header is visually suppressed (§10: header
          suppression is a visual fix, not a semantic one — the landmark still
          needs a name for landmark-traversal a11y). */}
      <div data-testid="sidebar-nav" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {tree.length === 0 ? (
          <p className="px-3 py-2 text-[13px] text-sidebar-muted" data-testid="sidebar-empty">
            No screens available for your role.
          </p>
        ) : (
          tree.map((group) => {
            const showDivider = !!group.belowDivider && !dividerRendered;
            if (showDivider) dividerRendered = true;
            return (
              <div key={group.section}>
                {showDivider && (
                  <hr role="separator" className="mx-2 my-2 border-t border-sidebar-border" />
                )}
                {collapsed ? (
                  <RailSection group={group} activeRoute={activeRoute} />
                ) : (
                  <SectionNav group={group} activeRoute={activeRoute} />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* footer — pinned below the scrolling tree: context line + user block */}
      <SidebarFooter user={user} collapsed={collapsed} />
    </aside>
  );
}

function SidebarFooter({ user, collapsed }: { user: UserMenuUser; collapsed: boolean }) {
  const { financialYearLabel } = useCompanyFy();
  return (
    <div
      data-testid="sidebar-footer"
      className={cn("shrink-0 border-t border-sidebar-border", collapsed ? "flex justify-center py-2" : "px-2 py-2")}
    >
      {!collapsed && (
        <div data-testid="sidebar-context-line" className="px-2 pb-1.5 text-[11px] text-sidebar-muted">
          {financialYearLabel ? `${financialYearLabel} · ` : ""}BDT (৳)
        </div>
      )}
      <UserMenu user={user} variant={collapsed ? "rail" : "footer"} />
    </div>
  );
}

/**
 * A section: `nav[aria-labelledby]` naming the landmark after the section label
 * (spec §10), an `h2` heading, then its item rows. Every section is its own
 * landmark, even when `suppressesHeader` is true (`PROJECTS → Projects`) — in
 * that case the heading is visually hidden (`sr-only`) rather than omitted, so
 * the landmark still has an accessible name for landmark-traversal a11y while
 * the VISIBLE result stays a bare row with no header.
 */
function SectionNav({ group, activeRoute }: { group: NavSectionGroup; activeRoute: string | null }) {
  const headingId = `nav-section-${navSectionSlug(group.section)}`;
  const suppressed = suppressesHeader(group);
  return (
    <nav aria-labelledby={headingId} className="mb-1">
      <h2
        id={headingId}
        className={cn(
          "px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wide text-sidebar-muted",
          suppressed && "sr-only",
        )}
      >
        {group.section}
      </h2>
      {group.items.map((item) => (
        <ItemRow key={item.route} item={item} active={item.route === activeRoute} />
      ))}
    </nav>
  );
}

/** A single screen row (or a de-emphasised, non-navigating "Coming soon" for unbuilt). */
function ItemRow({ item, active }: { item: NavItem; active: boolean }) {
  if (!item.built) {
    return (
      <span
        data-testid={`nav-item-${item.route}`}
        data-built="false"
        aria-disabled="true"
        title="Coming soon"
        className="relative my-0.5 flex cursor-default items-center gap-2 rounded-token px-2.5 py-1.5 text-[12.5px] text-sidebar-muted"
      >
        <span className="truncate">{item.label}</span>
        <span className="ml-auto rounded-sm bg-sidebar-hover px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-sidebar-foreground/80">
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.route}
      data-testid={`nav-item-${item.route}`}
      data-built="true"
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative my-0.5 flex items-center gap-2 rounded-token px-2.5 py-1.5 text-[12.5px] transition-colors",
        active
          ? "bg-sidebar-active font-semibold text-sidebar-active-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-hover",
      )}
    >
      {active && <span className="absolute inset-y-1 -left-[7px] w-[3px] rounded-r bg-accent" aria-hidden />}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SectionChip({ group, className }: { group: NavSectionGroup; className?: string }) {
  const Icon = NAV_ICON[group.icon];
  return (
    <span
      className={cn(
        "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md",
        CHIP_CLASS[group.chip],
        className,
      )}
      aria-hidden
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * Collapsed-rail section icon + hover/click flyout (spec §4/§9). A single-item
 * section is a direct link (no flyout, mirroring `suppressesHeader`'s bare row);
 * a multi-item section opens a flyout with the section title + its item rows.
 * Hover (desktop) or click (touch/keyboard) opens it; Esc or focus-out closes; the
 * active section's icon keeps the lime rail.
 */
function RailSection({ group, activeRoute }: { group: NavSectionGroup; activeRoute: string | null }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const Icon = NAV_ICON[group.icon];
  const direct = group.items.length === 1;
  const isActiveSection = group.items.some((i) => i.route === activeRoute);

  // Close on focus leaving the wrapper (blur out) and on Esc.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const iconBtnClass = cn(
    "relative grid h-10 w-10 place-items-center rounded-token transition-colors",
    isActiveSection ? "bg-sidebar-active text-sidebar-active-foreground" : "text-sidebar-foreground hover:bg-sidebar-hover",
  );

  return (
    <nav aria-label={group.section}>
      <div
        ref={wrapRef}
        className="relative my-0.5 flex justify-center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        {direct ? (
          <Link
            href={group.items[0]!.route}
            data-testid={`nav-rail-${group.icon}`}
            /* The DESTINATION's label, not the section's. A one-item section skips the
               flyout, so this link is the only place its item name can be announced — and
               the two differ exactly when §3.1 would have KEPT the header. Otherwise a
               Site Engineer's rail reads "MATERIALS"/"PEOPLE" instead of
               "Requisitions"/"Attendance", with no flyout to recover them. Rail is the
               default at tablet ≥768 (§4), so this is the common case, not an edge one. */
            aria-label={group.items[0]!.label}
            aria-current={isActiveSection ? "page" : undefined}
            className={iconBtnClass}
          >
            {isActiveSection && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent" aria-hidden />}
            <SectionChip group={group} />
          </Link>
        ) : (
          <button
            type="button"
            data-testid={`nav-rail-${group.icon}`}
            aria-label={group.section}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={iconBtnClass}
          >
            {isActiveSection && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent" aria-hidden />}
            <SectionChip group={group} />
          </button>
        )}

        {open && !direct && (
          <div
            role="menu"
            data-testid={`nav-flyout-${group.icon}`}
            className="absolute left-full top-0 z-50 ml-1 w-56 rounded-lg border border-sidebar-border bg-sidebar p-2 shadow-lg"
          >
            <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
              <Icon className="h-3.5 w-3.5 text-sidebar-muted" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">
                {group.section}
              </span>
            </div>
            <ul className="flex flex-col">
              {group.items.map((item) => (
                <li key={item.route}>
                  <ItemRow item={item} active={item.route === activeRoute} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
