"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  visibleTreeForRole,
  matchNav,
  isDirectLink,
  directLinkRoute,
  CHIP_CLASS,
  type NavModule,
  type NavSubItem,
  type Role,
} from "@/lib/nav/nav-tree";
import { NAV_ICON } from "./nav-icons";
import { useShellChrome } from "./shell-chrome-context";
import { useCompanyFy } from "@/providers/company-fy-provider";
import { UserMenu, type UserMenuUser } from "./user-menu";
import { type SessionPermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

/** The sidebar's viewer: identity for the footer + the grant set for nav filtering. */
export type SidebarUser = UserMenuUser & { permissions?: SessionPermission[] | null };

/**
 * App Shell v3 sidebar navbar (screen spec §3.1/§5/§9/§10). Two levels: section
 * labels → module rows (accordion disclosure) → indented sub-item links; single-item
 * modules are direct links (no chevron). One module open at a time (accordion); the
 * active route's module auto-expands on load and never auto-collapses. User-toggled
 * collapse narrows to a 56px icon rail with hover/click flyouts. Role-filtered
 * (defence-in-depth UI — guards + backend re-check). The FOOTER pins the working
 * context line (`FY … · BDT (৳)`) and the user/profile block (upward menu) — the
 * profile lives here, not the topbar (v3). `aside[aria-label="Primary"]`.
 */
export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const { collapsed } = useShellChrome();
  // FE-21: permission-driven filtering when the projection is present; role fallback otherwise.
  const tree = visibleTreeForRole(user);
  const match = matchNav(pathname);
  const activeModuleId = match?.module.id ?? null;

  // Accordion: which module is expanded. Seed with the active route's module.
  const [openId, setOpenId] = useState<string | null>(activeModuleId);
  // Keep the active module expanded across client navigations (never auto-collapse it).
  useEffect(() => {
    if (activeModuleId) setOpenId(activeModuleId);
  }, [activeModuleId]);

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
      {/* brand — pinned top chrome (shrink-0 so a short viewport can't compress it) */}
      <div className={cn("flex shrink-0 items-center gap-2.5 px-4 py-4", collapsed && "justify-center px-0")}>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent text-[11px] font-extrabold text-accent-foreground">
          ZE
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-none text-sidebar-active-foreground">
              Zakir Enterprise
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-sidebar-muted">
              Construction ERP
            </div>
          </div>
        )}
      </div>

      {/* nav tree — the only scrolling region; min-h-0 lets it shrink below its
          content height so overflow engages and the pinned footer isn't clipped.
          scrollbar-thin keeps the gutter subtle (thumb only on hover) so a nav that
          barely overflows doesn't show a heavy always-on scrollbar. */}
      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {tree.length === 0 ? (
          <p className="px-3 py-2 text-[13px] text-sidebar-muted" data-testid="sidebar-empty">
            No modules available for your role.
          </p>
        ) : (
          tree.map((group) => (
            <div key={group.section} className="mb-1">
              {!collapsed && (
                <div className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wide text-sidebar-muted">
                  {group.section}
                </div>
              )}
              {collapsed && <div className="mx-2 my-2 border-t border-sidebar-border" aria-hidden />}
              {group.modules.map((module) =>
                collapsed ? (
                  <RailModule
                    key={module.id}
                    module={module}
                    activePath={pathname}
                    isActiveModule={module.id === activeModuleId}
                  />
                ) : isDirectLink(module) ? (
                  <DirectLinkRow
                    key={module.id}
                    module={module}
                    active={module.id === activeModuleId}
                  />
                ) : (
                  <AccordionModule
                    key={module.id}
                    module={module}
                    open={openId === module.id}
                    onToggle={() => setOpenId((prev) => (prev === module.id ? null : module.id))}
                    activePath={pathname}
                    hasActiveChild={module.id === activeModuleId}
                  />
                ),
              )}
            </div>
          ))
        )}
      </nav>

      {/* footer — pinned below the scrolling tree: context line + user block (v3) */}
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

function ModuleChip({ module, className }: { module: NavModule; className?: string }) {
  const Icon = NAV_ICON[module.icon];
  return (
    <span
      className={cn(
        "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md",
        CHIP_CLASS[module.chip],
        className,
      )}
      aria-hidden
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/** A single-screen module: a plain link that takes the active rail itself. */
function DirectLinkRow({ module, active }: { module: NavModule; active: boolean }) {
  const route = directLinkRoute(module);
  return (
    <Link
      href={route}
      data-testid={`nav-module-${module.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative my-0.5 flex items-center gap-2.5 rounded-token px-2.5 py-2 text-[13px] transition-colors",
        active
          ? "bg-sidebar-active font-semibold text-sidebar-active-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-hover",
      )}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent" aria-hidden />}
      <ModuleChip module={module} />
      {module.label}
    </Link>
  );
}

/** A multi-screen module: a disclosure button controlling its sub-item list. */
function AccordionModule({
  module,
  open,
  onToggle,
  activePath,
  hasActiveChild,
}: {
  module: NavModule;
  open: boolean;
  onToggle: () => void;
  activePath: string;
  hasActiveChild: boolean;
}) {
  const listId = `nav-sub-${module.id}`;
  return (
    <div>
      <button
        type="button"
        data-testid={`nav-module-${module.id}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className={cn(
          "my-0.5 flex w-full items-center gap-2.5 rounded-token px-2.5 py-2 text-left text-[13px] transition-colors",
          hasActiveChild
            ? "font-semibold text-sidebar-active-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-hover",
        )}
      >
        <ModuleChip module={module} />
        <span className="flex-1 truncate">{module.label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-sidebar-muted transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <ul id={listId} className="mb-1 ml-[26px] flex flex-col border-l border-sidebar-border pl-1.5">
          {module.items.map((item) => (
            <li key={item.route}>
              <SubItemLink item={item} activePath={activePath} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Whether a sub-item is the active route (exact or a nested detail route). */
function isItemActive(item: NavSubItem, pathname: string): boolean {
  return pathname === item.route || pathname.startsWith(`${item.route}/`);
}

/** A sub-item link (or a de-emphasised, non-navigating "Coming soon" for unbuilt). */
function SubItemLink({ item, activePath }: { item: NavSubItem; activePath: string }) {
  const active = isItemActive(item, activePath);

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

/**
 * Collapsed-rail module icon + hover/click flyout (spec §4/§9). Hover (desktop) or
 * click (touch/keyboard) opens a flyout with the module title + sub-items; Esc or
 * focus-out closes; the active module icon keeps the lime rail.
 */
function RailModule({
  module,
  activePath,
  isActiveModule,
}: {
  module: NavModule;
  activePath: string;
  isActiveModule: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const Icon = NAV_ICON[module.icon];
  const direct = isDirectLink(module);

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
    isActiveModule ? "bg-sidebar-active text-sidebar-active-foreground" : "text-sidebar-foreground hover:bg-sidebar-hover",
  );

  return (
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
          href={directLinkRoute(module)}
          data-testid={`nav-rail-${module.id}`}
          aria-label={module.label}
          aria-current={isActiveModule ? "page" : undefined}
          className={iconBtnClass}
        >
          {isActiveModule && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent" aria-hidden />}
          <ModuleChip module={module} />
        </Link>
      ) : (
        <button
          type="button"
          data-testid={`nav-rail-${module.id}`}
          aria-label={module.label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={iconBtnClass}
        >
          {isActiveModule && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent" aria-hidden />}
          <ModuleChip module={module} />
        </button>
      )}

      {open && !direct && (
        <div
          role="menu"
          data-testid={`nav-flyout-${module.id}`}
          className="absolute left-full top-0 z-50 ml-1 w-56 rounded-lg border border-sidebar-border bg-sidebar p-2 shadow-lg"
        >
          <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
            <Icon className="h-3.5 w-3.5 text-sidebar-muted" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">
              {module.label}
            </span>
          </div>
          <ul className="flex flex-col">
            {module.items.map((item) => (
              <li key={item.route}>
                <SubItemLink item={item} activePath={activePath} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
