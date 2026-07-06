/**
 * FE-21 permission-driven nav + guards (FR-AUD-031/032/033; app-shell §11).
 * The nav catalogue, quick-create, alerts bell, module guard, and project scope
 * evaluate the session's EFFECTIVE permission set when present, and fall back to
 * the static role map only when the projection is absent (degraded /me).
 */
import {
  visibleTreeForRole,
  canReachItem,
  quickCreateForRole,
  showsAlertsBell,
  navDestinationsForRole,
  NAV_TREE,
  type NavViewer,
} from "@/lib/nav/nav-tree";
import { hasGrant, hasModuleGrant, roleMatches } from "@/lib/auth/roles";
import { guardModule } from "@/lib/auth/guard";
import { canSeeProject, effectiveProjectScope, filterToAssignedProjects } from "@/lib/auth/project-scope";
import { type SessionPermission } from "@/lib/auth/session";

function grant(resource: string, action: SessionPermission["action"] = "READ"): SessionPermission {
  return { resource, action, projectScope: "ASSIGNED", valueLimit: null };
}

const routesOf = (viewer: NavViewer | Parameters<typeof visibleTreeForRole>[0]) =>
  visibleTreeForRole(viewer)
    .flatMap((g) => g.modules)
    .flatMap((m) => m.items)
    .map((i) => i.route);

describe("hasGrant / roleMatches (lib/auth/roles)", () => {
  it("covers an exact (resource, action) pair; ADMIN is superuser", () => {
    const viewer = { role: "PROJECT_MANAGER" as const, permissions: [grant("sales.ipcs")] };
    expect(hasGrant(viewer, "sales.ipcs", "READ")).toBe(true);
    expect(hasGrant(viewer, "sales.ipcs", "CREATE")).toBe(false);
    expect(hasGrant(viewer, "receipts", "READ")).toBe(false);
    expect(hasGrant({ role: "ADMIN", permissions: [] }, "anything.at_all", "DELETE")).toBe(true);
  });

  it("no permissions array → nothing granted (fallbacks handle it upstream)", () => {
    expect(hasGrant({ role: "PROJECT_MANAGER" }, "sales.ipcs", "READ")).toBe(false);
  });

  it("roleMatches treats ACCOUNTS_TEAM and ACCOUNTS_MANAGER as equivalent", () => {
    expect(roleMatches(["ACCOUNTS_TEAM"], "ACCOUNTS_MANAGER")).toBe(true);
    expect(roleMatches(["ACCOUNTS_MANAGER"], "ACCOUNTS_TEAM")).toBe(true);
    expect(roleMatches(["ACCOUNTS_TEAM"], "STORE_KEEPER")).toBe(false);
  });
});

describe("visibleTreeForRole — permission-driven (FR-AUD-032)", () => {
  it("a viewer sees exactly the resources its grant set READs (screen-level exactness)", () => {
    const viewer: NavViewer = {
      role: "PROJECT_MANAGER",
      permissions: [grant("dashboard"), grant("ledger.account_ledger")],
    };
    const routes = routesOf(viewer);
    expect(routes).toContain("/dashboard");
    expect(routes).toContain("/ledger/account-ledger");
    // Sibling screens of the same module are NOT implied (FR-AUD-035).
    expect(routes).not.toContain("/ledger/journal-entries");
    expect(routes).not.toContain("/ledger/trial-balance");
    expect(routes).not.toContain("/audit/users");
  });

  it("a live grant change surfaces on the next projection read — no code change (FR-AUD-033)", () => {
    const before: NavViewer = { role: "PROJECT_MANAGER", permissions: [grant("dashboard")] };
    expect(routesOf(before)).not.toContain("/cost-control/profitability");
    const after: NavViewer = {
      role: "PROJECT_MANAGER",
      permissions: [grant("dashboard"), grant("cost_control.profitability")],
    };
    expect(routesOf(after)).toContain("/cost-control/profitability");
  });

  it("an empty permission set renders no nav (empty-nav state), not the role fallback", () => {
    const viewer: NavViewer = { role: "PROJECT_MANAGER", permissions: [] };
    expect(visibleTreeForRole(viewer)).toHaveLength(0);
  });

  it("falls back to the role map when the projection is ABSENT (degraded /me)", () => {
    const routes = routesOf("PROJECT_MANAGER");
    expect(routes).toContain("/ledger/account-ledger"); // legacy role list
    expect(routes).not.toContain("/audit/users");
  });

  it("ACCOUNTS_MANAGER (backend rename) gets the ACCOUNTS_TEAM fallback tree", () => {
    const managerRoutes = routesOf({ role: "ACCOUNTS_MANAGER" });
    const teamRoutes = routesOf({ role: "ACCOUNTS_TEAM" });
    expect(managerRoutes).toEqual(teamRoutes);
    expect(managerRoutes).toContain("/ledger/trial-balance");
  });

  it("every nav item carries a resource code (catalogue-tagged)", () => {
    for (const group of NAV_TREE) {
      for (const mod of group.modules) {
        for (const item of mod.items) {
          expect(item.resource).toBeTruthy();
        }
      }
    }
  });
});

describe("quick-create + alerts bell + palette (spec §11)", () => {
  it("quick-create keys on (resource, CREATE) — and stays empty while targets are unbuilt", () => {
    const viewer: NavViewer = {
      role: "SITE_ENGINEER",
      permissions: [grant("requisitions.list", "CREATE")],
    };
    // All Phase-1 targets ship built:false — granted or not, nothing renders yet.
    expect(quickCreateForRole(viewer)).toHaveLength(0);
    expect(quickCreateForRole("ADMIN")).toHaveLength(0);
  });

  it("alerts bell renders iff the set holds cost_control.alerts:READ (fallback: CC roles)", () => {
    expect(showsAlertsBell({ role: "STORE_KEEPER", permissions: [grant("cost_control.alerts")] })).toBe(true);
    expect(showsAlertsBell({ role: "PROJECT_MANAGER", permissions: [grant("dashboard")] })).toBe(false);
    expect(showsAlertsBell("ACCOUNTS_TEAM")).toBe(true); // fallback
    expect(showsAlertsBell("SITE_ENGINEER")).toBe(false);
  });

  it("the Ctrl+K palette lists only grant-visible destinations", () => {
    const viewer: NavViewer = { role: "STORE_KEEPER", permissions: [grant("inventory.stock_ledger")] };
    const labels = navDestinationsForRole(viewer).map((d) => d.route);
    expect(labels).toContain("/inventory/stock-ledger");
    expect(labels).not.toContain("/inventory/stock-journals");
  });

  it("canReachItem: grant present → reachable even when the role list would deny", () => {
    const item = NAV_TREE.flatMap((g) => g.modules)
      .flatMap((m) => m.items)
      .find((i) => i.resource === "audit.audit_log")!;
    expect(canReachItem(item, { role: "STORE_KEEPER", permissions: [grant("audit.audit_log")] })).toBe(true);
    expect(canReachItem(item, { role: "STORE_KEEPER", permissions: [] })).toBe(false);
  });
});

describe("guardModule — permission-driven with role fallback (FR-AUD-032)", () => {
  it("any READ grant inside the module admits; none forbids (→ /403)", () => {
    const viewer = { role: "STORE_KEEPER" as const, permissions: [grant("master_data.items")] };
    expect(guardModule(viewer, "master-data")).toEqual({ allow: true });
    const denied = guardModule(viewer, "ledger");
    expect(denied.allow).toBe(false);
    if (!denied.allow) expect(denied.redirectTo).toBe("/403");
  });

  it("falls back to the role map when the projection is absent; unauthenticated → /login", () => {
    expect(guardModule("PROJECT_MANAGER", "ledger")).toEqual({ allow: true });
    const unauth = guardModule(null, "ledger");
    expect(unauth.allow).toBe(false);
    if (!unauth.allow) expect(unauth.redirectTo).toBe("/login");
  });

  it("hasModuleGrant only counts READ actions and respects exact single-code prefixes", () => {
    expect(hasModuleGrant({ role: "STORE_KEEPER", permissions: [grant("numbering")] }, "numbering")).toBe(true);
    expect(
      hasModuleGrant({ role: "STORE_KEEPER", permissions: [grant("master_data.items", "CREATE")] }, "master-data"),
    ).toBe(false);
  });
});

describe("project scope from the projection (FR-AUD-031, edge 19)", () => {
  const items = [{ projectId: "p1" }, { projectId: "p2" }, { projectId: "p3" }];

  it("projection ALL → unrestricted; explicit ids → filtered", () => {
    const all = { role: "STORE_KEEPER" as const, projectScope: "ALL" as const };
    expect(effectiveProjectScope(all)).toBe("ALL");
    expect(filterToAssignedProjects(all, items)).toHaveLength(3);

    const scoped = { role: "ADMIN" as const, projectScope: { projectIds: ["p2"] } };
    expect(effectiveProjectScope(scoped)).toEqual(["p2"]);
    expect(filterToAssignedProjects(scoped, items)).toEqual([{ projectId: "p2" }]);
    expect(canSeeProject(scoped, "p1")).toBe(false);
  });

  it("zero-assignment scoped user sees empty, not everything", () => {
    const none = { role: "PROJECT_MANAGER" as const, projectScope: { projectIds: [] } };
    expect(filterToAssignedProjects(none, items)).toHaveLength(0);
  });

  it("falls back to the role heuristic when the projection is absent", () => {
    expect(effectiveProjectScope({ role: "ACCOUNTS_TEAM" })).toBe("ALL");
    expect(effectiveProjectScope({ role: "PROJECT_MANAGER", assignedProjectIds: ["p1"] })).toEqual(["p1"]);
  });
});
