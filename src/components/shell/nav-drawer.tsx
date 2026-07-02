"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  visibleTreeForRole,
  matchNav,
  CHIP_CLASS,
  type NavModule,
  type NavSubItem,
  type Role,
} from "@/lib/nav/nav-tree";
import { NAV_ICON } from "./nav-icons";
import { useShellChrome } from "./shell-chrome-context";
import { cn } from "@/lib/utils";

/**
 * Mobile navigation drawer (screen spec §4 responsive · §10). At <768 the sidebar is
 * replaced by a topbar hamburger opening this full-height left **drawer** (Radix
 * Dialog — focus-trap, Esc, scroll-lock, focus restored on close) with the same
 * role-filtered tree, sections as headers, all groups pre-expanded. Tapping a built
 * sub-item navigates + closes; unbuilt items render de-emphasised + non-navigating.
 */
export function NavDrawer({ role }: { role: Role }) {
  const pathname = usePathname();
  const { drawerOpen, setDrawerOpen } = useShellChrome();
  const tree = visibleTreeForRole(role);
  const activeItemRoute = matchNav(pathname)?.item.route ?? null;

  // Close the drawer whenever the route changes (a nav tap navigated).
  useEffect(() => {
    setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
              <div className="grid h-8 w-8 place-items-center rounded-md bg-accent text-[11px] font-extrabold text-accent-foreground">
                ZE
              </div>
              <DialogPrimitive.Title className="text-sm font-bold text-sidebar-active-foreground">
                Zakir Enterprise
              </DialogPrimitive.Title>
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

          <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 pb-4">
            {tree.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-sidebar-muted">No modules available for your role.</p>
            ) : (
              tree.map((group) => (
                <div key={group.section} className="mb-2">
                  <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-sidebar-muted">
                    {group.section}
                  </div>
                  {group.modules.map((module) => (
                    <DrawerModule key={module.id} module={module} activeItemRoute={activeItemRoute} />
                  ))}
                </div>
              ))
            )}
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DrawerModule({ module, activeItemRoute }: { module: NavModule; activeItemRoute: string | null }) {
  const Icon = NAV_ICON[module.icon];
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2.5 px-2.5 py-1.5">
        <span className={cn("grid h-[22px] w-[22px] place-items-center rounded-md", CHIP_CLASS[module.chip])} aria-hidden>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-sidebar-muted">{module.label}</span>
      </div>
      <ul className="ml-[26px] flex flex-col border-l border-sidebar-border pl-1.5">
        {module.items.map((item) => (
          <li key={item.route}>
            <DrawerSubItem item={item} active={item.route === activeItemRoute} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DrawerSubItem({ item, active }: { item: NavSubItem; active: boolean }) {
  if (!item.built) {
    return (
      <span
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
