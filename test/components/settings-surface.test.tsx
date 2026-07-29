/**
 * Settings surface (`src/app/(app)/settings/page.tsx`) — the FAIL-CLOSED guard.
 *
 * The previous version of this suite rendered `SettingsPage()` directly, which
 * made `getServerSessionWithPermissions()` throw (no request-scoped `cookies()`
 * outside Next's pipeline). The page's now-deleted `getSettingsViewer` caught
 * that throw and returned `null`, which the old page logic treated as "show
 * everything" — so this suite only ever exercised the fail-open branch, and
 * stayed green even with the gating deleted entirely (verified by mutation).
 *
 * Fixed the same way `test/unit/session-avatar-merge.test.ts` handles a route
 * handler: mock what the Server Component actually depends on
 * (`getServerSessionWithPermissions`, `next/navigation`'s `redirect`) instead of
 * relying on the framework's request scope, and call the component directly.
 */
import { render, screen } from "@testing-library/react";
import { type SafeUser, type SessionPermission } from "@/lib/auth/session";

const redirect = jest.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
jest.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

const getServerSessionWithPermissions = jest.fn();
jest.mock("@/lib/auth/server-session-permissions", () => ({
  getServerSessionWithPermissions: (...args: unknown[]) => getServerSessionWithPermissions(...args),
}));

import SettingsPage from "@/app/(app)/settings/page";

function grant(resource: string): SessionPermission {
  return { resource, action: "READ", projectScope: "ALL", valueLimit: null };
}

function viewer(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: "u1",
    email: "u1@ze.local",
    name: "Test User",
    role: "STORE_KEEPER",
    companyId: "c1",
    financialYearId: "fy1",
    isActive: true,
    permissions: [],
    ...overrides,
  };
}

const ALL_THREE_GRANTS: SessionPermission[] = [
  grant("master_data.company_settings"),
  grant("master_data.financial_years"),
  grant("numbering"),
];

beforeEach(() => {
  redirect.mockClear();
  getServerSessionWithPermissions.mockReset();
});

describe("Settings surface — fail-closed guard", () => {
  it("an Admin sees all three links, each pointing at its existing route", async () => {
    getServerSessionWithPermissions.mockResolvedValue(viewer({ role: "ADMIN", permissions: [] }));

    render(await SettingsPage());

    expect(screen.getByRole("link", { name: "Company settings" })).toHaveAttribute(
      "href",
      "/master-data/company-settings",
    );
    expect(screen.getByRole("link", { name: "Financial years" })).toHaveAttribute(
      "href",
      "/master-data/financial-years",
    );
    expect(screen.getByRole("link", { name: "Numbering" })).toHaveAttribute("href", "/numbering");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("a non-Admin viewer holding all three grants also sees all three links", async () => {
    getServerSessionWithPermissions.mockResolvedValue(viewer({ permissions: ALL_THREE_GRANTS }));

    render(await SettingsPage());

    expect(screen.getByRole("link", { name: "Company settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Financial years" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Numbering" })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("a viewer holding exactly one grant sees exactly that one entry", async () => {
    getServerSessionWithPermissions.mockResolvedValue(viewer({ permissions: [grant("numbering")] }));

    render(await SettingsPage());

    expect(screen.getByRole("link", { name: "Numbering" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Company settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Financial years" })).not.toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("a viewer holding none of the three grants redirects to the forbidden path", async () => {
    getServerSessionWithPermissions.mockResolvedValue(viewer({ permissions: [] }));

    await expect(SettingsPage()).rejects.toThrow("REDIRECT:/403");
    expect(redirect).toHaveBeenCalledWith("/403");
  });

  it("a null viewer (unauthenticated / unparseable cookie) redirects to the login path", async () => {
    getServerSessionWithPermissions.mockResolvedValue(null);

    await expect(SettingsPage()).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
