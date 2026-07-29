"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  visibleTreeForRole,
  matchNav,
  suppressesHeader,
  CHIP_CLASS,
  type NavSectionGroup,
  type NavItem,
} from "@/lib/nav/nav-tree";
import { NAV_ICON } from "./nav-icons";
import { BrandLogo } from "./brand-logo";
import { BRAND_NAME } from "@/lib/brand";
import { useShellChrome } from "./shell-chrome-context";
import { UserMenu, type UserMenuUser } from "./user-menu";
import { cn } from "@/lib/utils";

/**
 * Mobile navigation drawer (nav IA redesign; screen spec §3.1/§4 responsive · §9/§10).
 * At <768 the sidebar is replaced by a topbar hamburger opening this full-height left
 * **drawer** (Radix Dialog — focus-trap, Esc, scroll-lock, focus restored on close)
 * with the SAME flat, role-filtered tree as the desktop sidebar: sections as headers,
 * screen rows listed flat beneath — nothing pre-expanded because nothing collapses.
 * A section resolving to a single label-matching item renders as a bare row
 * (`suppressesHeader`), and the governance sections sit below a single divider. The
 * user block is pinned at the drawer bottom (same upward profile menu). Tapping a
 * built item navigates + closes; unbuilt items render de-emphasised + non-navigating.
 */
export function NavDrawer({ user }: { user: UserMenuUser & { permissions?: import("@/lib/auth/session").SessionPermission[] | null } }) {
  const pathname = usePathname();
  const { drawerOpen, setDrawerOpen } = useShellChrome();
  // FE-21: permission-driven filtering when the projection is present; role fallback otherwise.
  const tree = visibleTreeForRole(user);
  const match = matchNav(pathname);
  const activeRoute = match?.item.route ?? null;

  // Close the drawer whenever the route changes (a nav tap navigated).
  useEffect(() => {
    setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  let dividerRendered = false;

  return (
    <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-[fadeIn_0.2s_ease] md:hidden" />
        <DialogPrimitive.Content
          data-testid="nav-drawer"
          className={cn(
            "fixed left-0 top-0 z-50 flex h-full w-[280px] max-w-[86%] flex-col bg-sidebar shadow-lg md:hidden",
            "data-[state=open]:animate-[slideInRight_0.24s_ease] focus:outline-none",
          )}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2.5">
              <BrandLogo className="h-14" alt={BRAND_NAME} />
              {/* Radix requires an accessible Title; hidden since the logo shows alone. */}
              <DialogPrimitive.Title className="sr-only">{BRAND_NAME}</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Close menu"
              className="grid h-8 w-8 place-items-center rounded-token text-sidebar-foreground hover:bg-sidebar-hover"
            >
              <X className="h-4 w-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            Primary navigation
          </DialogPrimitive.Description>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {tree.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-sidebar-muted">No screens available for your role.</p>
            ) : (
              tree.map((group) => {
                const showDivider = !!group.belowDivider && !dividerRendered;
                if (showDivider) dividerRendered = true;
                return (
                  <div key={group.section}>
                    {showDivider && (
                      <hr role="separator" className="mx-2 my-2 border-t border-sidebar-border" />
                    )}
                    {suppressesHeader(group) ? (
                      <div className="mb-2">
                        <DrawerItem item={group.items[0]!} active={group.items[0]!.route === activeRoute} />
                      </div>
                    ) : (
                      <DrawerSection group={group} activeRoute={activeRoute} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* user block pinned at the drawer bottom */}
          <div data-testid="drawer-footer" className="shrink-0 border-t border-sidebar-border px-2 py-2">
            <UserMenu user={user} variant="drawer" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SectionChip({ group }: { group: NavSectionGroup }) {
  const Icon = NAV_ICON[group.icon];
  return (
    <span
      className={cn("grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md", CHIP_CLASS[group.chip])}
      aria-hidden
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/** A headed section: heading + its flat item rows (no disclosure — nothing collapses). */
function DrawerSection({ group, activeRoute }: { group: NavSectionGroup; activeRoute: string | null }) {
  const headingId = `drawer-section-${group.icon}`;
  return (
    <nav aria-labelledby={headingId} className="mb-2">
      <div
        id={headingId}
        className="flex items-center gap-2.5 px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-sidebar-muted"
      >
        <SectionChip group={group} />
        <span>{group.section}</span>
      </div>
      {group.items.map((item) => (
        <DrawerItem key={item.route} item={item} active={item.route === activeRoute} />
      ))}
    </nav>
  );
}

function DrawerItem({ item, active }: { item: NavItem; active: boolean }) {
  if (!item.built) {
    return (
      <span
        data-testid={`nav-item-${item.route}`}
        aria-disabled="true"
        title="Coming soon"
        className="my-0.5 flex items-center gap-2 rounded-token px-2.5 py-2 text-[13px] text-sidebar-muted/70"
      >
        <span className="truncate">{item.label}</span>
        <span className="ml-auto rounded-sm bg-sidebar-hover px-1.5 py-px text-[9px] font-semibold uppercase text-sidebar-muted">
          Soon
        </span>
      </span>
    );
  }
  return (
    <Link
      href={item.route}
      data-testid={`nav-item-${item.route}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative my-0.5 flex items-center gap-2 rounded-token px-2.5 py-2 text-[13px] transition-colors",
        active
          ? "bg-sidebar-active font-semibold text-sidebar-active-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-hover",
      )}
    >
      {active && <span className="absolute inset-y-1.5 -left-[7px] w-[3px] rounded-r bg-accent" aria-hidden />}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
