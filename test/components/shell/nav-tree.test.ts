/**
 * FE-SHELL nav model (screen spec §3.2 / §11). Pure role-filtering, quick-create and
 * bell gating, unbuilt retention, and route matching — the data contract the sidebar,
 * drawer, quick-create menu, bell, and Ctrl+K palette all render from.
 */
import {
  NAV_TREE,
  visibleTreeForRole,
  hasAnyNav,
  navDestinationsForRole,
  quickCreateForRole,
  showsAlertsBell,
  costControlBuilt,
  matchNav,
  isDirectLink,
} from "@/lib/nav/nav-tree";
import { type Role } from "@/lib/auth/roles";

function sectionsFor(role: Role): string[] {
  return visibleTreeForRole(role).map((g) => g.section);
}
function moduleIdsFor(role: Role): string[] {
  return visibleTreeForRole(role).flatMap((g) => g.modules.map((m) => m.id));
}

describe("nav tree — role-filtered visibility (spec §11)", () => {
  it("Admin sees every section and all 16 modules", () => {
    expect(sectionsFor("ADMIN")).toEqual([
      "OVERVIEW",
      "TRANSACTIONS",
      "PEOPLE",
      "LEDGER & REPORTS",
      "ADMINISTRATION",
    ]);
    expect(moduleIdsFor("ADMIN")).toHaveLength(16);
  });

  it("Site Engineer sees only Dashboard · Requisitions · Attendance (HR)", () => {
    const ids = moduleIdsFor("SITE_ENGINEER");
    expect(ids).toContain("dashboard");
    expect(ids).toContain("requisitions");
    expect(ids).toContain("hr"); // Attendance lives under HR & Payroll
    expect(ids).not.toContain("ledger");
    expect(ids).not.toContain("master-data");
    // HR module is shown but only the Attendance sub-item is reachable.
    const hr = visibleTreeForRole("SITE_ENGINEER")
      .flatMap((g) => g.modules)
      .find((m) => m.id === "hr");
    expect(hr?.items.map((i) => i.label)).toEqual(["Attendance"]);
  });

  it("HR Manager sees PEOPLE + Reports, not TRANSACTIONS/ADMINISTRATION", () => {
    const sections = sectionsFor("HR_MANAGER");
    expect(sections).toContain("PEOPLE");
    expect(sections).toContain("LEDGER & REPORTS"); // Reports (HR set)
    expect(sections).not.toContain("TRANSACTIONS");
    expect(sections).not.toContain("ADMINISTRATION");
  });

  it("Project Manager sees Ledger→Account ledger but NOT Journal entries or Profitability", () => {
    const modules = visibleTreeForRole("PROJECT_MANAGER").flatMap((g) => g.modules);
    const ledger = modules.find((m) => m.id === "ledger");
    expect(ledger?.items.map((i) => i.label)).toEqual(["Account ledger"]);
    const cc = modules.find((m) => m.id === "cost-control");
    expect(cc?.items.map((i) => i.label)).toEqual(["Budget vs actual", "Over-budget alerts"]);
    expect(cc?.items.map((i) => i.label)).not.toContain("Profitability");
  });

  it("a module renders only if ≥1 sub-item is reachable; a section only if ≥1 module", () => {
    // Store Keeper: no PEOPLE, no LEDGER&REPORTS ledger; has Purchases(GRN)+Inventory+Requisitions
    const ids = moduleIdsFor("STORE_KEEPER");
    expect(ids).toContain("purchases");
    expect(ids).toContain("inventory");
    expect(ids).not.toContain("ledger");
    expect(sectionsFor("STORE_KEEPER")).not.toContain("PEOPLE");
  });

  it("every role has at least the Dashboard (no empty nav in Phase 1)", () => {
    const roles: Role[] = ["ADMIN", "ACCOUNTS_TEAM", "PROJECT_MANAGER", "SITE_ENGINEER", "STORE_KEEPER", "HR_MANAGER"];
    for (const r of roles) {
      expect(hasAnyNav(r)).toBe(true);
      expect(moduleIdsFor(r)).toContain("dashboard");
    }
  });
});

describe("nav tree — item retention + direct links", () => {
  it("keeps Tier-2/3 items in the tree (filtered by role, not by built)", () => {
    // Every Tier-2/3 nav item is now navigable (its route lands on a Coming-soon
    // placeholder page), so the sidebar links to a real page, never a dead link.
    const sales = visibleTreeForRole("ADMIN")
      .flatMap((g) => g.modules)
      .find((m) => m.id === "sales");
    expect(sales?.items.length).toBeGreaterThan(0);
    expect(sales?.items.every((i) => i.built === true)).toBe(true);
  });

  it("single-screen modules are direct links; multi-screen are not", () => {
    const all = NAV_TREE.flatMap((g) => g.modules);
    expect(isDirectLink(all.find((m) => m.id === "dashboard")!)).toBe(true);
    expect(isDirectLink(all.find((m) => m.id === "numbering")!)).toBe(true);
    expect(isDirectLink(all.find((m) => m.id === "ledger")!)).toBe(false);
    expect(isDirectLink(all.find((m) => m.id === "master-data")!)).toBe(false);
  });
});

describe("quick-create + alerts-bell gating (spec §5/§11)", () => {
  it("quick-create lists only built && role-permitted targets (Requisition is built as of FE-29)", () => {
    // The Requisition entry form (FE-29) is the first built quick-create target.
    const admin = quickCreateForRole("ADMIN");
    expect(admin.map((t) => t.route)).toContain("/requisitions/new");
    const se = quickCreateForRole("SITE_ENGINEER");
    expect(se.map((t) => t.route)).toContain("/requisitions/new");
    // Every listed target is built + role-permitted.
    expect(admin.every((t) => t.built)).toBe(true);
  });

  it("alerts bell shows for CC actors only (Accounts, Admin, PM)", () => {
    expect(showsAlertsBell("ADMIN")).toBe(true);
    expect(showsAlertsBell("ACCOUNTS_TEAM")).toBe(true);
    expect(showsAlertsBell("PROJECT_MANAGER")).toBe(true);
    expect(showsAlertsBell("SITE_ENGINEER")).toBe(false);
    expect(showsAlertsBell("STORE_KEEPER")).toBe(false);
    expect(showsAlertsBell("HR_MANAGER")).toBe(false);
  });

  it("cost-control is data-backed (FE-25 alerts screen shipped) → bell fires the live count fetch", () => {
    // The Over-budget alerts screen + its `GET /api/cost-control/alerts` endpoint now exist,
    // so the bell's fetch gate is on (it still degrades to a plain bell on error).
    expect(costControlBuilt()).toBe(true);
  });
});

describe("Ctrl+K destinations + route matching", () => {
  it("nav destinations are built + role-permitted (every nav route is now navigable)", () => {
    const dests = navDestinationsForRole("ADMIN");
    const routes = dests.map((d) => d.route);
    expect(routes).toContain("/ledger/journal-entries");
    expect(routes).toContain("/numbering");
    expect(routes).toContain("/sales/ipcs"); // now navigable (Coming-soon placeholder)
  });

  it("matchNav picks the deepest matching sub-item (detail route → its list item)", () => {
    expect(matchNav("/ledger/journal-entries")?.item.label).toBe("Journal entries");
    expect(matchNav("/master-data/items/abc-123")?.item.label).toBe("Items");
    expect(matchNav("/numbering")?.module.label).toBe("Numbering");
    expect(matchNav("/nope")).toBeNull();
  });
});
