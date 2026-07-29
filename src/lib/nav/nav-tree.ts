/**
 * The App Shell nav model — the single source of truth for the FLAT, role-filtered
 * sidebar/drawer/rail-flyout and the "+ New" quick-create menu (screen spec
 * docs/design/screens/00-app-shell/app-shell.md §3.1/§3.2/§3.3/§4/§5/§8/§10/§11 and
 * the navigation IA redesign spec it implements).
 *
 * Nav IA redesign (29/07/2026): the model is now TWO levels — section → screen.
 * The former module level (`NavModule`/`NavSubItem`, an accordion in between) is
 * gone; every visible screen is its own row, one click from the sidebar. 11
 * sections, 37 rendered rows for Admin (the full tree).
 *
 * This is the NAV (UI) model. It is deliberately separate from `lib/auth/roles.ts`,
 * which stays the source of truth for the *server route guards* on the built Tier-1
 * segments (`requireModuleAccess("ledger")` etc.). Nav visibility here is
 * defence-in-depth UI only — the backend + the module guards re-check every route.
 *
 * Every item carries a `built` flag: `true` for shipped screens, `false` renders a
 * de-emphasised, non-navigating "Coming soon" row — never a dead link.
 */

import { hasGrant, roleMatches, type ActionCode, type Role } from "@/lib/auth/roles";
import { type SessionPermission } from "@/lib/auth/session";

export type { Role };

/**
 * FE-21 (FR-AUD-031/032/033): nav visibility is PERMISSION-DRIVEN. Each item
 * carries its Resource-Catalogue `resource` code (nav-tree-admin.md) and renders
 * iff the session's effective permission set holds `resource:READ`. The per-item
 * `roles` list remains ONLY as the fallback when the projection is unavailable
 * (`permissions` absent — degraded `/me`). Filter entry points accept either a
 * bare `Role` (legacy/fallback) or a `NavViewer` `{ role, permissions? }`.
 */
export interface NavViewer {
  role: Role;
  permissions?: SessionPermission[] | null;
}

type ViewerLike = Role | NavViewer;

function asViewer(v: ViewerLike): NavViewer {
  return typeof v === "string" ? { role: v } : v;
}

/** The eleven fixed section labels, in order (nav IA redesign spec §4, app-shell §8). */
export const NAV_SECTIONS = [
  "HOME",
  "PROJECTS",
  "PARTIES",
  "MATERIALS",
  "PURCHASES & PAYMENTS",
  "BILLING & RECEIPTS",
  "PEOPLE",
  "ACCOUNTS",
  "REPORTS & ANALYSIS",
  "USERS & ACCESS",
  "AUDIT LOG",
] as const;

export type NavSection = (typeof NAV_SECTIONS)[number];

/** The 22px icon-chip tint (wayfinding only — hue carries no status meaning). */
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

/** Icon keys — one per section, resolved to a lucide component in nav-icons.tsx. */
export type NavIconKey =
  | "home"
  | "projects"
  | "parties"
  | "materials"
  | "purchases-payments"
  | "billing-receipts"
  | "people"
  | "accounts"
  | "reports"
  | "users-access"
  | "audit-log";

export interface NavItem {
  /** Exact screen label (spec §3.2/§8). */
  label: string;
  /** Route stem the item navigates to. */
  route: string;
  /** Resource-Catalogue code — visibility is `resource:READ` (FR-AUD-032/035). */
  resource: string;
  /** Fallback roles, used ONLY when the session projection is absent (spec §11 retrofit note). */
  roles: readonly Role[];
  /** `true` only for shipped screens; `false` renders "Coming soon" (non-navigating). */
  built: boolean;
}

export interface NavSectionGroup {
  section: NavSection;
  icon: NavIconKey;
  chip: ChipTint;
  /** Governance sections rendered after the divider (spec §3.1/§9.3). */
  belowDivider?: boolean;
  items: readonly NavItem[];
}

/**
 * A lone item whose label restates its section renders without the header
 * (`PROJECTS → Projects`). When the labels differ the header carries
 * information and is kept (`HOME → Dashboard`). Spec §3.1/§9.2.
 */
export function suppressesHeader(group: NavSectionGroup): boolean {
  return group.items.length === 1 && group.items[0]!.label.toUpperCase() === group.section;
}

const ALL: readonly Role[] = [
  "ADMIN",
  "ACCOUNTS_TEAM",
  "PROJECT_MANAGER",
  "SITE_ENGINEER",
  "STORE_KEEPER",
  "HR_MANAGER",
];

/**
 * The complete nav tree — 11 sections, 37 rendered rows for Admin (nav-tree-admin.md,
 * ported verbatim). Routes and resource codes are unchanged from the pre-rewrite
 * Tier-1/two-level tree; only the shape (section → item, no module) and Holidays'
 * resource code (`hr.attendance` → `hr.holidays`, prerequisite brief
 * `aud-holidays-resource`) changed. `roles` are carried across from the prior
 * `NAV_TREE` per item (the admin JSON deliberately omits them).
 */
export const NAV_TREE: readonly NavSectionGroup[] = [
  {
    section: "HOME",
    icon: "home",
    chip: "lime",
    items: [{ label: "Dashboard", route: "/dashboard", resource: "dashboard", roles: ALL, built: true }],
  },
  {
    section: "PROJECTS",
    icon: "projects",
    chip: "blue",
    items: [
      {
        label: "Projects",
        route: "/master-data/projects",
        resource: "master_data.projects",
        roles: ["ADMIN", "PROJECT_MANAGER"],
        built: true,
      },
      {
        label: "Cost centres",
        route: "/master-data/cost-centres",
        resource: "master_data.cost_centres",
        roles: ["ADMIN"],
        built: true,
      },
      {
        label: "Purposes",
        route: "/master-data/purposes",
        resource: "master_data.purposes",
        roles: ["ADMIN"],
        built: true,
      },
    ],
  },
  {
    section: "PARTIES",
    icon: "parties",
    chip: "teal",
    items: [
      {
        label: "Parties",
        route: "/master-data/parties",
        resource: "master_data.parties",
        roles: ["ADMIN", "ACCOUNTS_TEAM"],
        built: true,
      },
    ],
  },
  {
    section: "MATERIALS",
    icon: "materials",
    chip: "amber",
    items: [
      {
        label: "Requisitions",
        route: "/requisitions",
        resource: "requisitions.list",
        roles: ["PROJECT_MANAGER", "SITE_ENGINEER", "ACCOUNTS_TEAM", "STORE_KEEPER"],
        built: true,
      },
      {
        label: "Approvals",
        route: "/requisitions/approvals",
        resource: "requisitions.approvals",
        roles: ["PROJECT_MANAGER", "ACCOUNTS_TEAM"],
        built: true,
      },
      {
        label: "Issues",
        route: "/requisitions/issues",
        resource: "requisitions.issues",
        roles: ["STORE_KEEPER"],
        built: true,
      },
      {
        label: "GRN & matching",
        route: "/purchase/grn",
        resource: "purchase.grn",
        roles: ["STORE_KEEPER", "ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
      {
        label: "Stock journals",
        route: "/inventory/stock-journals",
        resource: "inventory.stock_journals",
        roles: ["STORE_KEEPER", "ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
      {
        label: "Stock ledger",
        route: "/inventory/stock-ledger",
        resource: "inventory.stock_ledger",
        roles: ["STORE_KEEPER", "ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
        built: true,
      },
      {
        label: "Items",
        route: "/master-data/items",
        resource: "master_data.items",
        roles: ["ADMIN", "STORE_KEEPER", "ACCOUNTS_TEAM"],
        built: true,
      },
    ],
  },
  {
    section: "PURCHASES & PAYMENTS",
    icon: "purchases-payments",
    chip: "violet",
    items: [
      {
        label: "Purchase orders",
        route: "/purchase/orders",
        resource: "purchase.orders",
        roles: ["ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
      {
        label: "Purchase bills",
        route: "/purchase/bills",
        resource: "purchase.bills",
        roles: ["ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
      {
        label: "Payments",
        route: "/payments",
        resource: "payments.list",
        roles: ["ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
      {
        label: "Open payables",
        route: "/payments/open-payables",
        resource: "payments.open_payables",
        roles: ["ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
    ],
  },
  {
    section: "BILLING & RECEIPTS",
    icon: "billing-receipts",
    chip: "green",
    items: [
      {
        label: "IPCs",
        route: "/sales/ipcs",
        resource: "sales.ipcs",
        roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
        built: true,
      },
      {
        label: "IPC register & retention",
        route: "/sales/ipc-register",
        resource: "sales.ipc_register",
        roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
        built: true,
      },
      {
        label: "Receipts",
        route: "/receipts",
        resource: "receipts",
        roles: ["ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
    ],
  },
  {
    section: "PEOPLE",
    icon: "people",
    chip: "teal",
    items: [
      {
        label: "Employees",
        route: "/hr/employees",
        resource: "hr.employees",
        roles: ["HR_MANAGER"],
        built: true,
      },
      {
        label: "Attendance",
        route: "/hr/attendance",
        resource: "hr.attendance",
        roles: ["HR_MANAGER", "SITE_ENGINEER"],
        built: true,
      },
      // Holidays now carries its own resource code — split out of `hr.attendance` to
      // close a permission leak (a Site Engineer's `hr.attendance:READ`, needed for
      // their own attendance, used to also surface the HR Manager's holiday
      // calendar). Prerequisite brief: aud-holidays-resource. `roles` unchanged.
      {
        label: "Holidays",
        route: "/hr/holidays",
        resource: "hr.holidays",
        roles: ["HR_MANAGER"],
        built: true,
      },
      {
        label: "Salary sheets",
        route: "/hr/salary-sheets",
        resource: "hr.salary_sheets",
        roles: ["HR_MANAGER"],
        built: true,
      },
    ],
  },
  {
    section: "ACCOUNTS",
    icon: "accounts",
    chip: "violet",
    items: [
      {
        label: "Journal & contra vouchers",
        route: "/contra-journal/vouchers",
        resource: "contra_journal.vouchers",
        roles: ["ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
      {
        label: "Opening balances",
        route: "/contra-journal/opening",
        resource: "contra_journal.opening",
        roles: ["ADMIN", "ACCOUNTS_TEAM"],
        built: true,
      },
      {
        label: "Journal entries",
        route: "/ledger/journal-entries",
        resource: "ledger.journal_entries",
        roles: ["ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
      {
        label: "Account ledger",
        route: "/ledger/account-ledger",
        resource: "ledger.account_ledger",
        roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
        built: true,
      },
      {
        label: "Trial balance",
        route: "/ledger/trial-balance",
        resource: "ledger.trial_balance",
        roles: ["ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
      {
        label: "Chart of accounts",
        route: "/master-data/chart-of-accounts",
        resource: "master_data.chart_of_accounts",
        roles: ["ADMIN", "ACCOUNTS_TEAM"],
        built: true,
      },
      {
        label: "Periods",
        route: "/period",
        resource: "periods",
        roles: ["ADMIN", "ACCOUNTS_TEAM"],
        built: true,
      },
    ],
  },
  {
    section: "REPORTS & ANALYSIS",
    icon: "reports",
    chip: "amber",
    items: [
      {
        label: "Budget vs actual",
        route: "/cost-control/budget-vs-actual",
        resource: "cost_control.budget_vs_actual",
        roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
        built: true,
      },
      {
        label: "Over-budget alerts",
        route: "/cost-control/alerts",
        resource: "cost_control.alerts",
        roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER"],
        built: true,
      },
      {
        label: "Profitability",
        route: "/cost-control/profitability",
        resource: "cost_control.profitability",
        roles: ["ACCOUNTS_TEAM", "ADMIN"],
        built: true,
      },
      {
        label: "Reports",
        route: "/reports",
        resource: "reports",
        roles: ["ACCOUNTS_TEAM", "ADMIN", "PROJECT_MANAGER", "HR_MANAGER"],
        built: true,
      },
    ],
  },
  {
    section: "USERS & ACCESS",
    icon: "users-access",
    chip: "blue",
    belowDivider: true,
    items: [
      { label: "Users", route: "/audit/users", resource: "audit.users", roles: ["ADMIN"], built: true },
      {
        label: "Roles & permissions",
        route: "/audit/roles",
        resource: "audit.roles",
        roles: ["ADMIN"],
        built: true,
      },
    ],
  },
  {
    section: "AUDIT LOG",
    icon: "audit-log",
    chip: "red",
    belowDivider: true,
    items: [{ label: "Audit log", route: "/audit/log", resource: "audit.audit_log", roles: ["ADMIN"], built: true }],
  },
];

/**
 * An item is reachable when the viewer's effective permission set holds the
 * item's `resource:READ` grant (FR-AUD-032). Admin is the platform superuser and
 * sees everything (spec §11 "Admin | Everything"). When the projection is absent
 * (degraded `/me`), fall back to the item's static `roles` list.
 */
export function canReachItem(item: NavItem, viewerLike: ViewerLike): boolean {
  const viewer = asViewer(viewerLike);
  if (viewer.permissions) return hasGrant(viewer, item.resource, "READ");
  return viewer.role === "ADMIN" || roleMatches(item.roles, viewer.role);
}

/**
 * The permission-filtered tree: sections with ≥ 1 visible item, each carrying only
 * the items the viewer can reach (spec §3.1/§11). Unbuilt items are RETAINED (they
 * render de-emphasised) — filtering is by grant, not `built`.
 */
export function visibleTreeForRole(viewerLike: ViewerLike): NavSectionGroup[] {
  const viewer = asViewer(viewerLike);
  const groups: NavSectionGroup[] = [];
  for (const group of NAV_TREE) {
    const items = group.items.filter((it) => canReachItem(it, viewer));
    if (items.length > 0) groups.push({ ...group, items });
  }
  return groups;
}

/** True when the viewer has at least one visible item anywhere (spec §6 empty-nav). */
export function hasAnyNav(viewerLike: ViewerLike): boolean {
  return visibleTreeForRole(viewerLike).length > 0;
}

/**
 * Find the deepest nav item matching a pathname (longest-route-prefix wins), plus
 * its owning section. Drives active-state + the default breadcrumb trail. There is
 * no module level any more — `NavMatch` carries only `section` and `item`.
 */
export interface NavMatch {
  section: NavSection;
  item: NavItem;
}

export function matchNav(pathname: string): NavMatch | null {
  let best: NavMatch | null = null;
  let bestLen = -1;
  for (const group of NAV_TREE) {
    for (const item of group.items) {
      const isMatch = pathname === item.route || pathname.startsWith(`${item.route}/`);
      if (isMatch && item.route.length > bestLen) {
        best = { section: group.section, item };
        bestLen = item.route.length;
      }
    }
  }
  return best;
}

/**
 * Flatten the role-visible tree to a searchable list of destinations (Ctrl+K palette,
 * spec §5/§14-1). Built + role-permitted only — unbuilt items aren't navigable.
 */
export interface NavDestination {
  section: NavSection;
  label: string;
  route: string;
}

export function navDestinationsForRole(viewerLike: ViewerLike): NavDestination[] {
  const out: NavDestination[] = [];
  for (const group of visibleTreeForRole(viewerLike)) {
    for (const item of group.items) {
      if (item.built) out.push({ section: group.section, label: item.label, route: item.route });
    }
  }
  return out;
}

/**
 * "+ New" quick-create targets (spec §5 list), each pure navigation to an editor's
 * create route. Only `built && role-permitted` targets render; the whole menu is
 * hidden if the role has none (spec §5/§11).
 */
export interface QuickCreateTarget {
  label: string;
  route: string;
  /** The grant the action keys on — `(resource, action)`, not just READ (§11). */
  resource: string;
  action: ActionCode;
  /** Fallback roles (projection absent only). */
  roles: readonly Role[];
  built: boolean;
}

export const QUICK_CREATE: readonly QuickCreateTarget[] = [
  { label: "IPC", route: "/sales/ipcs/new", resource: "sales.ipcs", action: "CREATE", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
  { label: "Receipt", route: "/receipts/new", resource: "receipts", action: "CREATE", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
  { label: "Purchase order", route: "/purchase/orders/new", resource: "purchase.orders", action: "CREATE", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
  { label: "Purchase bill", route: "/purchase/bills/new", resource: "purchase.bills", action: "CREATE", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
  { label: "GRN", route: "/purchase/grn/new", resource: "purchase.grn", action: "CREATE", roles: ["STORE_KEEPER", "ADMIN"], built: true },
  { label: "Payment", route: "/payments/new", resource: "payments.list", action: "CREATE", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: false },
  { label: "Contra voucher", route: "/contra-journal/vouchers/new?type=contra", resource: "contra_journal.vouchers", action: "CREATE", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
  { label: "Journal voucher", route: "/contra-journal/vouchers/new?type=journal", resource: "contra_journal.vouchers", action: "CREATE", roles: ["ACCOUNTS_TEAM", "ADMIN"], built: true },
  { label: "Stock journal", route: "/inventory/stock-journals/new", resource: "inventory.stock_journals", action: "CREATE", roles: ["STORE_KEEPER", "ADMIN"], built: false },
  { label: "Requisition", route: "/requisitions/new", resource: "requisitions.list", action: "CREATE", roles: ["PROJECT_MANAGER", "SITE_ENGINEER"], built: true },
  { label: "Attendance entry", route: "/hr/attendance/new", resource: "hr.attendance", action: "CREATE", roles: ["HR_MANAGER", "SITE_ENGINEER"], built: false },
  { label: "Salary sheet", route: "/hr/salary-sheets/new", resource: "hr.salary_sheets", action: "CREATE", roles: ["HR_MANAGER"], built: false },
];

/** Quick-create targets ready to navigate (built + granted `(resource, CREATE)`;
 *  role-map fallback when the projection is absent). Admin sees every built target. */
export function quickCreateForRole(viewerLike: ViewerLike): QuickCreateTarget[] {
  const viewer = asViewer(viewerLike);
  return QUICK_CREATE.filter((t) => {
    if (!t.built) return false;
    if (viewer.permissions) return hasGrant(viewer, t.resource, t.action);
    return viewer.role === "ADMIN" || roleMatches(t.roles, viewer.role);
  });
}

/**
 * True when the topbar bell renders. FE-53 rebinds this to the NTF surface,
 * which every authenticated user has — the bell shows for **all** roles and
 * opens the notifications drawer (superseding the CC-only over-budget link).
 * The old `cost_control.alerts:READ` check is no longer relevant here.
 */
export function showsAlertsBell(viewerLike: ViewerLike): boolean {
  // Any signed-in viewer with a role; the parameter is retained for callers
  // that still pass a viewer object.
  return !!asViewer(viewerLike).role;
}

/**
 * Whether the Cost-control module has a REAL, data-backed screen yet — this gates the
 * live `GET /api/cost-control/alerts` fetch behind the bell. `true` since FE-25 shipped
 * the Over-budget alerts screen + its backing endpoint (the CC backend sibling is Done):
 * the bell now fires the live count fetch and renders the badge from `meta.total`, still
 * degrading silently to a plain bell on error (alerts-bell.tsx).
 */
export function costControlBuilt(): boolean {
  return true;
}
