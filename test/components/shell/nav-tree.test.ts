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

describe("nav model is flat (nav IA redesign)", () => {
  it("declares the eleven sections in order", () => {
    expect(NAV_SECTIONS).toEqual([
      "HOME", "PROJECTS", "PARTIES", "MATERIALS", "PURCHASES & PAYMENTS",
      "BILLING & RECEIPTS", "PEOPLE", "ACCOUNTS", "REPORTS & ANALYSIS",
      "USERS & ACCESS", "AUDIT LOG",
    ]);
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
