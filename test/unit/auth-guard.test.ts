import { canAccessModule, modulesForRole, isUnscopedRole, isRole } from "@/lib/auth/roles";
import { guardModule, guardAuthenticated, moduleFromPath } from "@/lib/auth/guard";
import {
  canSeeProject,
  filterToAssignedProjects,
  effectiveProjectScope,
} from "@/lib/auth/project-scope";

describe("roles & capability map", () => {
  it("Admin reaches every Tier-1 module; an empty-grant role reaches none", () => {
    expect(canAccessModule("ADMIN", "audit")).toBe(true);
    expect(modulesForRole("ADMIN")).toContain("ledger");
    expect(canAccessModule("SITE_ENGINEER", "audit")).toBe(false);
    expect(modulesForRole("SITE_ENGINEER")).toHaveLength(0);
  });

  it("PM reaches ledger but not audit", () => {
    expect(canAccessModule("PROJECT_MANAGER", "ledger")).toBe(true);
    expect(canAccessModule("PROJECT_MANAGER", "audit")).toBe(false);
  });

  it("classifies scoped vs unscoped roles", () => {
    expect(isUnscopedRole("ADMIN")).toBe(true);
    expect(isUnscopedRole("ACCOUNTS_TEAM")).toBe(true);
    expect(isUnscopedRole("PROJECT_MANAGER")).toBe(false);
  });

  it("validates role strings", () => {
    expect(isRole("ADMIN")).toBe(true);
    expect(isRole("SUPERUSER")).toBe(false);
  });
});

describe("route guards", () => {
  it("redirects an unauthenticated user to login", () => {
    expect(guardAuthenticated(null)).toEqual({
      allow: false,
      reason: "unauthenticated",
      redirectTo: "/login",
    });
  });

  it("403s a role that lacks a module", () => {
    const d = guardModule("PROJECT_MANAGER", "audit");
    expect(d.allow).toBe(false);
    if (!d.allow) {
      expect(d.reason).toBe("forbidden");
      expect(d.redirectTo).toBe("/403");
    }
  });

  it("allows a role into a module it owns", () => {
    expect(guardModule("ADMIN", "audit")).toEqual({ allow: true });
  });

  it("maps a path to its module key", () => {
    expect(moduleFromPath("/ledger/journal-entries")).toBe("ledger");
    expect(moduleFromPath("/dashboard")).toBeNull();
  });
});

describe("project scope", () => {
  const pm = { role: "PROJECT_MANAGER" as const, assignedProjectIds: ["p1", "p2"] };
  const admin = { role: "ADMIN" as const, assignedProjectIds: [] };

  it("scoped user sees only assigned projects; unscoped sees all", () => {
    expect(canSeeProject(pm, "p1")).toBe(true);
    expect(canSeeProject(pm, "p9")).toBe(false);
    expect(canSeeProject(admin, "p9")).toBe(true);
  });

  it("filters a project list to the assigned set", () => {
    const list = [{ projectId: "p1" }, { projectId: "p2" }, { projectId: "p3" }];
    expect(filterToAssignedProjects(pm, list)).toEqual([{ projectId: "p1" }, { projectId: "p2" }]);
    expect(filterToAssignedProjects(admin, list)).toHaveLength(3);
  });

  it("reports the effective scope", () => {
    expect(effectiveProjectScope(admin)).toBe("ALL");
    expect(effectiveProjectScope(pm)).toEqual(["p1", "p2"]);
  });
});
