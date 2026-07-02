/**
 * The App Shell v2 navigation model — the single source of truth for the two-level,
 * role-filtered sidebar/drawer/rail-flyout and the "+ New" quick-create menu
 * (screen spec docs/design/screens/00-app-shell/app-shell.md §3.2/§8/§11).
 *
 * This is the NAV (UI) model. It is deliberately separate from `lib/auth/roles.ts`,
 * which stays the source of truth for the *server route guards* on the built Tier-1
 * segments (`requireModuleAccess("ledger")` etc.). Nav visibility here is
 * defence-in-depth UI only — the backend + the module guards re-check every route.
 *
 * Each sub-item carries a `built` flag: `true` for the 20 shipped Tier-1 screens +
 * Dashboard, `false` for Tier-2/3 screens not yet built. An unbuilt item still
 * renders (so the tree shape is complete + reviewable) but is de-emphasised and
 * non-navigating with a "Coming soon" affordance — never a dead link (§3.2 note).
 * Flipping one `built` flag activates a screen when its per-screen brief ships.
 */

import { type Role } from "@/lib/auth/roles";

export type { Role };

/** The five fixed section labels, in order (spec §8). */
export const NAV_SECTIONS = [
  "OVERVIEW",
  "TRANSACTIONS",
  "PEOPLE",
  "LEDGER & REPORTS",
  "ADMINISTRATION",
] as const;

export type NavSection = (typeof NAV_SECTIONS)[number];

/** The 22px icon-chip tint (wayfinding only — hue carries no status meaning; §3.2). */
export type ChipTint = "lime" | "green" | "blue" | "teal" | "violet" | "amber" | "red";

/** Tailwind token classes for each chip tint (design-system tokens, never raw hex). */
export const CHIP_CLASS: Record<ChipTint, string> = {
  lime: "bg-accent-soft text-accent-ink",
  green: "bg-success-soft text-success-ink",
  blue: "bg-info-soft text-info-ink",
  teal: "bg-teal-soft text-teal",
  violet: "bg-violet-soft text-violet",
  amber: "bg-warning-soft text-warning-ink",
  red: "bg-destructive-soft text-destructive-ink",
};

export interface NavSubItem {
  /** Exact sub-item label (spec §3.2/§8). */
  label: string;
  /** Route stem the sub-item navigates to. */
  route: string;
  /** Roles that can reach this sub-item (spec §3.2/§11). */
  roles: readonly Role[];
  /** `true` only for shipped screens; `false` renders "Coming soon" (non-navigating). */
  built: boolean;
}

export interface NavModule {
  /** Stable id (module key for wayfinding/testids). */
  id: string;
  /** Module label (spec §8). */
  label: string;
  /** Icon-chip tint (spec §3.2). */
  chip: ChipTint;
  /** Lucide icon name key (resolved to a component in the sidebar). */
  icon: NavIconKey;
  /** Sub-items; a single-item module renders as a direct link (no disclosure). */
  items: readonly NavSubItem[];
}

export interface NavSectionGroup {
  section: NavSection;
  modules: readonly NavModule[];
}

/** Icon keys — resolved to lucide components at the render boundary (sidebar/drawer). */
export type NavIconKey =
  | "dashboard"
  | "sales"
  | "receipts"
  | "purchases"
  | "payments"
  | "contra-journal"
  | "inventory"
  | "requisitions"
  | "hr"
  | "ledger"
  | "cost-control"
  | "reports"
  | "master-data"
  | "numbering"
  | "periods"
  | "audit";

const ALL: readonly Role[] = [
  "ADMIN",
  "ACCOUNTS_TEAM",
  "PROJECT_MANAGER",
  "SITE_ENGINEER",
  "STORE_KEEPER",
  "HR_MANAGER",
];

/**
 * The complete nav tree — all 16 modules under the five sections (spec §3.2).
 * Routes continue the built Tier-1 segments; Tier-2/3 stems mirror the module docs
 * and ship `built:false` until their per-screen brief flips the flag.
 */
export const NAV_TREE: readonly NavSectionGroup[] = [
  {
    section: "OVERVIEW",
    modules: [
      {
        id: "dashboard",
        label: "Dashboard",
        chip: "lime",
        icon: "dashboard",
        items: [{ label: "Dashboard", route: "/dashboard", roles: ALL, built: true }],
      },
    ],
  },
  {
    section: "TRANSACTIONS",
    modules: [
      {
        id: "sales",
        label: "Sales / IPC",
        chip: "lime",
        icon: "sales",
        items: [
          { label: "IPCs", route: "/sales/ipcs", roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"], built: true },
          {
            label: "IPC register & retention",
            route: "/sales/ipc-register",
            roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
            built: true,
          },
        ],
      },
      {
        id: "receipts",
        label: "Receipts",
        chip: "green",
        icon: "receipts",
        items: [{ label: "Receipts", route: "/receipts", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true }],
      },
      {
        id: "purchases",
        label: "Purchases",
        chip: "blue",
        icon: "purchases",
        items: [
          { label: "Purchase orders", route: "/purchase/orders", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
          { label: "Purchase bills", route: "/purchase/bills", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
          {
            label: "GRN & matching",
            route: "/purchase/grn",
            roles: ["STORE_KEEPER", "ACCOUNTS_TEAM", "ADMIN"],
            built: true,
          },
        ],
      },
      {
        id: "payments",
        label: "Payments",
        chip: "teal",
        icon: "payments",
        items: [
          { label: "Payments", route: "/payments", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
          { label: "Open payables", route: "/payments/open-payables", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
        ],
      },
      {
        id: "contra-journal",
        label: "Contra & Journal",
        chip: "violet",
        icon: "contra-journal",
        items: [
          { label: "Vouchers", route: "/contra-journal/vouchers", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
          { label: "Opening balances", route: "/contra-journal/opening", roles: ["ADMIN", "ACCOUNTS_TEAM"], built: true },
        ],
      },
      {
        id: "inventory",
        label: "Inventory",
        chip: "amber",
        icon: "inventory",
        items: [
          {
            label: "Stock journals",
            route: "/inventory/stock-journals",
            roles: ["STORE_KEEPER", "ACCOUNTS_TEAM", "ADMIN"],
            built: true,
          },
          {
            label: "Stock ledger",
            route: "/inventory/stock-ledger",
            roles: ["STORE_KEEPER", "ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
            built: true,
          },
        ],
      },
      {
        id: "requisitions",
        label: "Requisitions",
        chip: "blue",
        icon: "requisitions",
        items: [
          {
            label: "Requisitions",
            route: "/requisitions",
            roles: ["PROJECT_MANAGER", "SITE_ENGINEER", "ACCOUNTS_TEAM", "STORE_KEEPER"],
            built: true,
          },
          { label: "Approvals", route: "/requisitions/approvals", roles: ["PROJECT_MANAGER", "ACCOUNTS_TEAM"], built: true },
          { label: "Issues", route: "/requisitions/issues", roles: ["STORE_KEEPER"], built: true },
        ],
      },
    ],
  },
  {
    section: "PEOPLE",
    modules: [
      {
        id: "hr",
        label: "HR & Payroll",
        chip: "teal",
        icon: "hr",
        items: [
          { label: "Employees", route: "/hr/employees", roles: ["HR_MANAGER"], built: true },
          { label: "Attendance", route: "/hr/attendance", roles: ["HR_MANAGER", "SITE_ENGINEER"], built: true },
          { label: "Salary sheets", route: "/hr/salary-sheets", roles: ["HR_MANAGER"], built: true },
        ],
      },
    ],
  },
  {
    section: "LEDGER & REPORTS",
    modules: [
      {
        id: "ledger",
        label: "Ledger",
        chip: "violet",
        icon: "ledger",
        items: [
          { label: "Journal entries", route: "/ledger/journal-entries", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
          {
            label: "Account ledger",
            route: "/ledger/account-ledger",
            roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
            built: true,
          },
          { label: "Trial balance", route: "/ledger/trial-balance", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
        ],
      },
      {
        id: "cost-control",
        label: "Cost control",
        chip: "red",
        icon: "cost-control",
        items: [
          {
            label: "Budget vs actual",
            route: "/cost-control/budget-vs-actual",
            roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
            built: true,
          },
          {
            label: "Over-budget alerts",
            route: "/cost-control/alerts",
            roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
            built: true,
          },
          { label: "Profitability", route: "/cost-control/profitability", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
        ],
      },
      {
        id: "reports",
        label: "Reports",
        chip: "amber",
        icon: "reports",
        items: [
          {
            label: "Reports",
            route: "/reports",
            roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER", "HR_MANAGER"],
            built: true,
          },
        ],
      },
    ],
  },
  {
    section: "ADMINISTRATION",
    modules: [
      {
        id: "master-data",
        label: "Master data",
        chip: "blue",
        icon: "master-data",
        items: [
          { label: "Company settings", route: "/master-data/company-settings", roles: ["ADMIN"], built: true },
          { label: "Financial years", route: "/master-data/financial-years", roles: ["ADMIN"], built: true },
          { label: "Projects", route: "/master-data/projects", roles: ["ADMIN", "PROJECT_MANAGER"], built: true },
          { label: "Cost centres", route: "/master-data/cost-centres", roles: ["ADMIN"], built: true },
          { label: "Purposes", route: "/master-data/purposes", roles: ["ADMIN"], built: true },
          { label: "Chart of accounts", route: "/master-data/chart-of-accounts", roles: ["ADMIN", "ACCOUNTS_TEAM"], built: true },
          { label: "Parties", route: "/master-data/parties", roles: ["ADMIN", "ACCOUNTS_TEAM"], built: true },
          { label: "Items", route: "/master-data/items", roles: ["ADMIN", "STORE_KEEPER", "ACCOUNTS_TEAM"], built: true },
        ],
      },
      {
        id: "numbering",
        label: "Numbering",
        chip: "amber",
        icon: "numbering",
        items: [{ label: "Numbering", route: "/numbering", roles: ["ADMIN"], built: true }],
      },
      {
        id: "periods",
        label: "Periods",
        chip: "green",
        icon: "periods",
        items: [{ label: "Periods", route: "/period", roles: ["ADMIN", "ACCOUNTS_TEAM"], built: true }],
      },
      {
        id: "audit",
        label: "Audit & access",
        chip: "teal",
        icon: "audit",
        items: [
          { label: "Users", route: "/audit/users", roles: ["ADMIN"], built: true },
          { label: "Roles & permissions", route: "/audit/roles", roles: ["ADMIN"], built: true },
          { label: "Audit log", route: "/audit/log", roles: ["ADMIN"], built: true },
        ],
      },
    ],
  },
];

/**
 * A sub-item is reachable by a role when its `roles` list includes that role. Admin is
 * the platform superuser and sees everything (spec §11 "Admin | Everything"), so we
 * don't repeat ADMIN in every item's `roles` list — it's granted here.
 */
export function canReachItem(item: NavSubItem, role: Role): boolean {
  return role === "ADMIN" || item.roles.includes(role);
}

/** A module is visible when the role can reach ≥ 1 of its sub-items (spec §3.1). */
function visibleModule(module: NavModule, role: Role): NavModule | null {
  const items = module.items.filter((it) => canReachItem(it, role));
  return items.length > 0 ? { ...module, items } : null;
}

/**
 * The role-filtered tree: sections with ≥ 1 visible module, each module carrying only
 * the sub-items the role can reach (spec §3.1/§11). Unbuilt items are RETAINED (they
 * render de-emphasised) — filtering is by role, not by `built`.
 */
export function visibleTreeForRole(role: Role): NavSectionGroup[] {
  const groups: NavSectionGroup[] = [];
  for (const group of NAV_TREE) {
    const modules = group.modules
      .map((m) => visibleModule(m, role))
      .filter((m): m is NavModule => m !== null);
    if (modules.length > 0) groups.push({ section: group.section, modules });
  }
  return groups;
}

/** True when the role has at least one visible module anywhere (spec §6 empty-nav). */
export function hasAnyNav(role: Role): boolean {
  return visibleTreeForRole(role).length > 0;
}

/** A module is a single-screen direct link (no disclosure chevron) when it has 1 item. */
export function isDirectLink(module: NavModule): boolean {
  return module.items.length === 1;
}

/** The route a direct-link module points at (its sole sub-item). */
export function directLinkRoute(module: NavModule): string {
  return module.items[0]!.route;
}

/**
 * Flatten the role-visible tree to a searchable list of destinations (Ctrl+K palette,
 * spec §5/§14-1). Built + role-permitted only — unbuilt items aren't navigable.
 */
export interface NavDestination {
  moduleLabel: string;
  label: string;
  route: string;
}

export function navDestinationsForRole(role: Role): NavDestination[] {
  const out: NavDestination[] = [];
  for (const group of visibleTreeForRole(role)) {
    for (const mod of group.modules) {
      for (const item of mod.items) {
        if (item.built) out.push({ moduleLabel: mod.label, label: item.label, route: item.route });
      }
    }
  }
  return out;
}

/**
 * "+ New" quick-create targets (spec §5 list), each pure navigation to an editor's
 * create route. Only `built && role-permitted` targets render; the whole menu is
 * hidden if the role has none (spec §5/§11). All are `built:false` in Phase-1 v2
 * (the voucher editors ship later) — the menu is wired + role-filtered, and each
 * target activates when its editor brief flips `built:true`.
 */
export interface QuickCreateTarget {
  label: string;
  route: string;
  roles: readonly Role[];
  built: boolean;
}

export const QUICK_CREATE: readonly QuickCreateTarget[] = [
  { label: "IPC", route: "/sales/ipcs/new", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: false },
  { label: "Receipt", route: "/receipts/new", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: false },
  { label: "Purchase order", route: "/purchase/orders/new", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: false },
  { label: "Purchase bill", route: "/purchase/bills/new", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: false },
  { label: "GRN", route: "/purchase/grn/new", roles: ["STORE_KEEPER", "ADMIN"], built: false },
  { label: "Payment", route: "/payments/new", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: false },
  { label: "Contra voucher", route: "/contra-journal/vouchers/new?type=contra", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: false },
  { label: "Journal voucher", route: "/contra-journal/vouchers/new?type=journal", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: false },
  { label: "Stock journal", route: "/inventory/stock-journals/new", roles: ["STORE_KEEPER", "ADMIN"], built: false },
  { label: "Requisition", route: "/requisitions/new", roles: ["PROJECT_MANAGER", "SITE_ENGINEER"], built: false },
  { label: "Attendance entry", route: "/hr/attendance/new", roles: ["HR_MANAGER", "SITE_ENGINEER"], built: false },
  { label: "Salary sheet", route: "/hr/salary-sheets/new", roles: ["HR_MANAGER"], built: false },
];

/** Role-filtered quick-create targets that are ready to navigate (built + permitted).
 *  Admin (superuser, spec §11) sees every built target. */
export function quickCreateForRole(role: Role): QuickCreateTarget[] {
  return QUICK_CREATE.filter((t) => t.built && (role === "ADMIN" || t.roles.includes(role)));
}

/** True when the alerts bell renders for a role (CC actors only: Accounts, Admin, PM). */
export function showsAlertsBell(role: Role): boolean {
  return role === "ADMIN" || role === "ACCOUNTS_TEAM" || role === "PROJECT_MANAGER";
}

/**
 * Whether the Cost-control module has a REAL, data-backed screen yet — this gates the
 * live `GET /api/cost-control/alerts` fetch behind the bell. The CC nav items are now
 * navigable, but they resolve to Coming-soon *placeholders* with no backing endpoint,
 * so this stays `false` until the actual CC alerts screen + API ship. Keeping it false
 * means the bell degrades to a plain bell instead of firing a fetch that must fail.
 */
export function costControlBuilt(): boolean {
  return false;
}

/**
 * Find the deepest nav sub-item matching a pathname (longest-route-prefix wins), plus
 * its owning module + section. Drives active-state + the default breadcrumb trail.
 */
export interface NavMatch {
  section: NavSection;
  module: NavModule;
  item: NavSubItem;
}

export function matchNav(pathname: string): NavMatch | null {
  let best: NavMatch | null = null;
  let bestLen = -1;
  for (const group of NAV_TREE) {
    for (const mod of group.modules) {
      for (const item of mod.items) {
        const isMatch = pathname === item.route || pathname.startsWith(`${item.route}/`);
        if (isMatch && item.route.length > bestLen) {
          best = { section: group.section, module: mod, item };
          bestLen = item.route.length;
        }
      }
    }
  }
  return best;
}
