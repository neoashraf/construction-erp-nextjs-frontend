/**
 * FE-SHELL nav model (screen spec §3.1/§3.2/§11; nav IA redesign spec §4/§8). Flat
 * section → item model: role-filtering, header suppression, the governance divider,
 * and route matching — the data contract the sidebar, drawer, quick-create menu,
 * bell, and Ctrl+K palette all render from. There is no module level any more.
 */
import {
  NAV_SECTIONS, NAV_TREE, visibleTreeForRole, suppressesHeader, matchNav,
  type NavSectionGroup,
} from "@/lib/nav/nav-tree";
import { type SessionPermission } from "@/lib/auth/session";

const grant = (resource: string): SessionPermission =>
  ({ resource, action: "READ", projectScope: "ASSIGNED", valueLimit: null });

const rowsOf = (groups: NavSectionGroup[]) => groups.flatMap((g) => g.items);

/**
 * The complete Admin tree, copied verbatim (section, label, route, resource, icon,
 * chip) from nav-tree-admin.md's machine-readable JSON — 11 sections, 37 rows. Ties
 * `NAV_TREE` to the doc at the row level: a typo'd resource code, a swapped section,
 * a dropped row, or a section/icon/chip mismatch all fail this single assertion.
 */
const ADMIN_TREE_FIXTURE: ReadonlyArray<
  readonly [section: string, label: string, route: string, resource: string, icon: string, chip: string]
> = [
  ["HOME", "Dashboard", "/dashboard", "dashboard", "home", "lime"],
  ["PROJECTS", "Projects", "/master-data/projects", "master_data.projects", "projects", "blue"],
  ["PROJECTS", "Cost centres", "/master-data/cost-centres", "master_data.cost_centres", "projects", "blue"],
  ["PROJECTS", "Purposes", "/master-data/purposes", "master_data.purposes", "projects", "blue"],
  ["PARTIES", "Parties", "/master-data/parties", "master_data.parties", "parties", "teal"],
  ["MATERIALS", "Requisitions", "/requisitions", "requisitions.list", "materials", "amber"],
  ["MATERIALS", "Approvals", "/requisitions/approvals", "requisitions.approvals", "materials", "amber"],
  ["MATERIALS", "Issues", "/requisitions/issues", "requisitions.issues", "materials", "amber"],
  ["MATERIALS", "GRN & matching", "/purchase/grn", "purchase.grn", "materials", "amber"],
  ["MATERIALS", "Stock journals", "/inventory/stock-journals", "inventory.stock_journals", "materials", "amber"],
  ["MATERIALS", "Stock ledger", "/inventory/stock-ledger", "inventory.stock_ledger", "materials", "amber"],
  ["MATERIALS", "Items", "/master-data/items", "master_data.items", "materials", "amber"],
  ["PURCHASES & PAYMENTS", "Purchase orders", "/purchase/orders", "purchase.orders", "purchases-payments", "violet"],
  ["PURCHASES & PAYMENTS", "Purchase bills", "/purchase/bills", "purchase.bills", "purchases-payments", "violet"],
  ["PURCHASES & PAYMENTS", "Payments", "/payments", "payments.list", "purchases-payments", "violet"],
  ["PURCHASES & PAYMENTS", "Open payables", "/payments/open-payables", "payments.open_payables", "purchases-payments", "violet"],
  ["BILLING & RECEIPTS", "IPCs", "/sales/ipcs", "sales.ipcs", "billing-receipts", "green"],
  ["BILLING & RECEIPTS", "IPC register & retention", "/sales/ipc-register", "sales.ipc_register", "billing-receipts", "green"],
  ["BILLING & RECEIPTS", "Receipts", "/receipts", "receipts", "billing-receipts", "green"],
  ["PEOPLE", "Employees", "/hr/employees", "hr.employees", "people", "teal"],
  ["PEOPLE", "Attendance", "/hr/attendance", "hr.attendance", "people", "teal"],
  ["PEOPLE", "Holidays", "/hr/holidays", "hr.holidays", "people", "teal"],
  ["PEOPLE", "Salary sheets", "/hr/salary-sheets", "hr.salary_sheets", "people", "teal"],
  ["ACCOUNTS", "Journal & contra vouchers", "/contra-journal/vouchers", "contra_journal.vouchers", "accounts", "violet"],
  ["ACCOUNTS", "Opening balances", "/contra-journal/opening", "contra_journal.opening", "accounts", "violet"],
  ["ACCOUNTS", "Journal entries", "/ledger/journal-entries", "ledger.journal_entries", "accounts", "violet"],
  ["ACCOUNTS", "Account ledger", "/ledger/account-ledger", "ledger.account_ledger", "accounts", "violet"],
  ["ACCOUNTS", "Trial balance", "/ledger/trial-balance", "ledger.trial_balance", "accounts", "violet"],
  ["ACCOUNTS", "Chart of accounts", "/master-data/chart-of-accounts", "master_data.chart_of_accounts", "accounts", "violet"],
  ["ACCOUNTS", "Periods", "/period", "periods", "accounts", "violet"],
  ["REPORTS & ANALYSIS", "Budget vs actual", "/cost-control/budget-vs-actual", "cost_control.budget_vs_actual", "reports", "amber"],
  ["REPORTS & ANALYSIS", "Over-budget alerts", "/cost-control/alerts", "cost_control.alerts", "reports", "amber"],
  ["REPORTS & ANALYSIS", "Profitability", "/cost-control/profitability", "cost_control.profitability", "reports", "amber"],
  ["REPORTS & ANALYSIS", "Reports", "/reports", "reports", "reports", "amber"],
  ["USERS & ACCESS", "Users", "/audit/users", "audit.users", "users-access", "blue"],
  ["USERS & ACCESS", "Roles & permissions", "/audit/roles", "audit.roles", "users-access", "blue"],
  ["AUDIT LOG", "Audit log", "/audit/log", "audit.audit_log", "audit-log", "red"],
];

describe("nav model is flat (nav IA redesign)", () => {
  it("declares the eleven sections in order", () => {
    expect(NAV_SECTIONS).toEqual([
      "HOME", "PROJECTS", "PARTIES", "MATERIALS", "PURCHASES & PAYMENTS",
      "BILLING & RECEIPTS", "PEOPLE", "ACCOUNTS", "REPORTS & ANALYSIS",
      "USERS & ACCESS", "AUDIT LOG",
    ]);
  });

  it("NAV_TREE's section order and completeness match NAV_SECTIONS exactly", () => {
    expect(NAV_TREE.map((g) => g.section)).toEqual([...NAV_SECTIONS]);
  });

  it("matches the canonical 37-row (section, label, route, resource, icon, chip) fixture from nav-tree-admin.md verbatim", () => {
    const actual = NAV_TREE.flatMap((g) =>
      g.items.map((i) => [g.section, i.label, i.route, i.resource, g.icon, g.chip] as const),
    );
    expect(actual).toEqual(ADMIN_TREE_FIXTURE);
  });

  it("renders 37 rows for Admin and no section exceeds 7", () => {
    const tree = visibleTreeForRole({ role: "ADMIN" });
    expect(rowsOf(tree)).toHaveLength(37);
    for (const g of tree) expect(g.items.length).toBeLessThanOrEqual(7);
  });

  it("has no my-work row (deferred, spec 6.1)", () => {
    expect(rowsOf(visibleTreeForRole({ role: "ADMIN" })).map((i) => i.route))
      .not.toContain("/my-work");
  });

  it("keeps the three Settings screens out of the sidebar", () => {
    const routes = rowsOf(visibleTreeForRole({ role: "ADMIN" })).map((i) => i.route);
    expect(routes).not.toContain("/numbering");
    expect(routes).not.toContain("/master-data/company-settings");
    expect(routes).not.toContain("/master-data/financial-years");
  });

  it("suppresses the header only when a lone item's label matches the section", () => {
    const admin = visibleTreeForRole({ role: "ADMIN" });
    expect(suppressesHeader(admin.find((g) => g.section === "PARTIES")!)).toBe(true);
    expect(suppressesHeader(admin.find((g) => g.section === "AUDIT LOG")!)).toBe(true);
    expect(suppressesHeader(admin.find((g) => g.section === "HOME")!)).toBe(false);
  });

  it("marks governance sections as below the divider", () => {
    const below = NAV_TREE.filter((g) => g.belowDivider).map((g) => g.section);
    expect(below).toEqual(["USERS & ACCESS", "AUDIT LOG"]);
  });

  it("matchNav resolves a route to its section and item, with no module", () => {
    const m = matchNav("/inventory/stock-ledger");
    expect(m?.section).toBe("MATERIALS");
    expect(m?.item.label).toBe("Stock ledger");
    expect(m).not.toHaveProperty("module");
  });
});

describe("per-role trees match nav-tree-by-role.md 2", () => {
  it("Accounts Manager: 7 sections, 26 rows (nav-tree-by-role.md 1 seeded grants)", () => {
    const viewer = { role: "ACCOUNTS_MANAGER" as const, permissions: [
      "dashboard", "sales.ipcs", "sales.ipc_register", "receipts",
      "purchase.orders", "purchase.bills", "purchase.grn",
      "payments.list", "payments.open_payables",
      "contra_journal.vouchers", "contra_journal.opening",
      "inventory.stock_journals", "inventory.stock_ledger",
      "requisitions.list", "requisitions.approvals",
      "ledger.journal_entries", "ledger.account_ledger", "ledger.trial_balance",
      "cost_control.budget_vs_actual", "cost_control.alerts", "cost_control.profitability",
      "reports", "master_data.chart_of_accounts", "master_data.parties",
      "master_data.items", "periods",
    ].map(grant) };
    const tree = visibleTreeForRole(viewer);
    expect(tree.map((g) => g.section)).toEqual([
      "HOME", "PARTIES", "MATERIALS", "PURCHASES & PAYMENTS",
      "BILLING & RECEIPTS", "ACCOUNTS", "REPORTS & ANALYSIS",
    ]);
    expect(rowsOf(tree)).toHaveLength(26);
    // Header-suppressed bare row (a single item whose label restates its section).
    expect(suppressesHeader(tree.find((g) => g.section === "PARTIES")!)).toBe(true);
    // Issues is NOT granted — Accounts Manager's MATERIALS excludes it (unlike Store Keeper's).
    expect(rowsOf(tree).map((i) => i.label)).not.toContain("Issues");
  });

  it("Project Manager (scoped): 6 sections, 11 rows (nav-tree-by-role.md 1 seeded grants)", () => {
    const viewer = { role: "PROJECT_MANAGER" as const, permissions: [
      "dashboard", "sales.ipcs", "sales.ipc_register", "inventory.stock_ledger",
      "requisitions.list", "requisitions.approvals", "ledger.account_ledger",
      "cost_control.budget_vs_actual", "cost_control.alerts", "reports",
      "master_data.projects",
    ].map(grant) };
    const tree = visibleTreeForRole(viewer);
    expect(tree.map((g) => g.section)).toEqual([
      "HOME", "PROJECTS", "MATERIALS", "BILLING & RECEIPTS", "ACCOUNTS", "REPORTS & ANALYSIS",
    ]);
    expect(rowsOf(tree)).toHaveLength(11);
    expect(suppressesHeader(tree.find((g) => g.section === "PROJECTS")!)).toBe(true);
    // Deliberately omitted grants (nav-tree-by-role.md 1) stay invisible.
    const labels = rowsOf(tree).map((i) => i.label);
    expect(labels).not.toContain("Profitability");
    expect(labels).not.toContain("Journal entries");
    expect(labels).not.toContain("Trial balance");
  });

  it("Store Keeper: 2 sections, 6 rows, whole job under MATERIALS", () => {
    const viewer = { role: "STORE_KEEPER" as const, permissions: [
      "dashboard", "purchase.grn", "inventory.stock_journals",
      "inventory.stock_ledger", "requisitions.list", "requisitions.issues",
    ].map(grant) };
    const tree = visibleTreeForRole(viewer);
    expect(tree.map((g) => g.section)).toEqual(["HOME", "MATERIALS"]);
    expect(rowsOf(tree)).toHaveLength(6);
  });

  it("Site Engineer no longer sees Holidays (hr.holidays is separate now)", () => {
    const viewer = { role: "SITE_ENGINEER" as const, permissions: [
      "dashboard", "requisitions.list", "hr.attendance",
    ].map(grant) };
    const labels = rowsOf(visibleTreeForRole(viewer)).map((i) => i.label);
    expect(labels).toContain("Attendance");
    expect(labels).not.toContain("Holidays");
    expect(labels).toHaveLength(3);
  });

  it("HR Manager sees Reports under REPORTS & ANALYSIS, never a ledger section", () => {
    const viewer = { role: "HR_MANAGER" as const, permissions: [
      "dashboard", "hr.employees", "hr.attendance", "hr.holidays",
      "hr.salary_sheets", "reports",
    ].map(grant) };
    const tree = visibleTreeForRole(viewer);
    expect(tree.map((g) => g.section)).toEqual(["HOME", "PEOPLE", "REPORTS & ANALYSIS"]);
    expect(rowsOf(tree)).toHaveLength(6);
  });
});
