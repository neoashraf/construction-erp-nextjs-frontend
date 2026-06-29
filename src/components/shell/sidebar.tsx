"use client";

import Link from "next/link";
import { modulesForRole, moduleLabel, type Role } from "@/lib/auth/roles";

/**
 * Role-based sidebar nav (skill §2.1/§5, ADR-0003 F1). Slots are derived from the
 * session role's allowed modules — a role only sees nav for modules it may reach
 * (defence-in-depth; the route guards + backend also enforce). The links point at
 * the (empty) module segments; per-screen briefs fill in the screens.
 *
 * Desktop-first: persistent column on ≥768, hidden on the minimal-mobile surface
 * (a later brief adds a mobile drawer for the few site tasks).
 */
export function Sidebar({ role }: { role: Role }) {
  const modules = modulesForRole(role);
  return (
    <nav
      aria-label="Primary"
      data-testid="sidebar"
      className="hidden w-60 shrink-0 border-r border-border bg-muted/30 p-4 md:block"
    >
      <ul className="flex flex-col gap-1">
        {modules.length === 0 ? (
          <li className="text-sm text-muted-foreground" data-testid="sidebar-empty">
            No modules available for your role.
          </li>
        ) : (
          modules.map((module) => (
            <li key={module}>
              <Link
                href={`/${module}`}
                className="block rounded-token px-3 py-2 text-sm hover:bg-muted"
                data-testid={`nav-${module}`}
              >
                {moduleLabel(module)}
              </Link>
            </li>
          ))
        )}
      </ul>
    </nav>
  );
}
