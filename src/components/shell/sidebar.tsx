"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  BookOpenText,
  Hash,
  CalendarRange,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { modulesForRole, moduleLabel, type ModuleKey, type Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

/**
 * Role-based navy sidebar (design-system §5.2, skill §2.1/§5). Nav slots derive from
 * the session role's allowed modules (defence-in-depth — guards + backend also
 * enforce). Each module gets a colour-coded icon chip; the active item gets the lime
 * accent rail. Desktop-first: persistent column ≥768, hidden on the minimal-mobile
 * surface (a later brief adds a drawer for the few site tasks).
 */
const NAV: Record<ModuleKey, { icon: LucideIcon; chip: string }> = {
  "master-data": { icon: Database, chip: "bg-info-soft text-info" },
  ledger: { icon: BookOpenText, chip: "bg-violet-soft text-violet" },
  numbering: { icon: Hash, chip: "bg-warning-soft text-warning" },
  period: { icon: CalendarRange, chip: "bg-success-soft text-success" },
  audit: { icon: ShieldCheck, chip: "bg-teal-soft text-teal" },
};

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const modules = modulesForRole(role);

  return (
    <aside
      aria-label="Primary"
      data-testid="sidebar"
      className="hidden w-[230px] shrink-0 flex-col bg-sidebar md:flex"
    >
      {/* brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-accent text-[11px] font-extrabold text-accent-foreground">
          ZE
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-none text-sidebar-active-foreground">
            Zakir Enterprise
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-sidebar-muted">
            Construction ERP
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <NavItem
          href="/dashboard"
          label="Dashboard"
          icon={LayoutDashboard}
          chip="bg-accent-soft text-accent-ink"
          active={pathname === "/dashboard"}
        />

        <div className="px-3 pb-1.5 pt-4 text-[10px] uppercase tracking-wide text-sidebar-muted">
          Modules
        </div>

        {modules.length === 0 ? (
          <p className="px-3 py-2 text-[13px] text-sidebar-muted" data-testid="sidebar-empty">
            No modules available for your role.
          </p>
        ) : (
          modules.map((module) => (
            <NavItem
              key={module}
              href={`/${module}`}
              label={moduleLabel(module)}
              icon={NAV[module].icon}
              chip={NAV[module].chip}
              active={pathname.startsWith(`/${module}`)}
              testId={`nav-${module}`}
            />
          ))
        )}
      </nav>

      {/* footer */}
      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-muted">
        FY 2025–26 · BDT (৳)
      </div>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  chip,
  active,
  testId,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  chip: string;
  active: boolean;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative my-0.5 flex items-center gap-2.5 rounded-token px-2.5 py-2 text-[13px] transition-colors",
        active
          ? "bg-sidebar-active font-semibold text-sidebar-active-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-hover",
      )}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent" aria-hidden />
      )}
      <span className={cn("grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md", chip)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      {label}
    </Link>
  );
}
