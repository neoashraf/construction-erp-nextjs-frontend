/**
 * FE-21 session provider (FR-AUD-030/031/033; app-shell §6/§13). On mount the
 * provider re-reads /api/auth/me (the BFF now proxies the backend projection),
 * enriching the cookie identity with the live permission set; a failed read
 * degrades to the cookie session (role-map nav). A `mustChangePassword` session
 * is routed to /change-password (forced mode) and held there.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { SessionProvider, useSession } from "@/providers/session-provider";
import { navigateToForcedChange } from "@/lib/auth/forced-change";
import { type SafeUser } from "@/lib/auth/session";

jest.mock("@/lib/auth/forced-change", () => ({
  ...jest.requireActual("@/lib/auth/forced-change"),
  navigateToForcedChange: jest.fn(),
}));

const forcedNav = navigateToForcedChange as jest.Mock;
const fetchMock = jest.fn();

const baseUser: SafeUser = {
  id: "u1",
  email: "x@ze.test",
  name: "Test User",
  role: "PROJECT_MANAGER",
  companyId: "c1",
  financialYearId: "fy1",
  isActive: true,
};

function Probe() {
  const user = useSession();
  return (
    <div>
      <span data-testid="perm-count">{user?.permissions?.length ?? "none"}</span>
      <span data-testid="name">{user?.name}</span>
    </div>
  );
}

beforeEach(() => {
  forcedNav.mockClear();
  fetchMock.mockReset();
  (global as { fetch?: unknown }).fetch = fetchMock;
});

afterEach(() => {
  delete (global as { fetch?: unknown }).fetch;
});

it("enriches the cookie identity with the live projection on mount (FR-AUD-031)", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      user: {
        ...baseUser,
        permissions: [{ resource: "dashboard", action: "READ", projectScope: "ASSIGNED", valueLimit: null }],
        projectScope: { projectIds: ["p1"] },
      },
    }),
  });

  render(
    <SessionProvider user={baseUser}>
      <Probe />
    </SessionProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("perm-count")).toHaveTextContent("1"));
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", { credentials: "include" });
});

it("degrades to the cookie session when /me fails — shell still renders (spec §6 partial)", async () => {
  fetchMock.mockRejectedValue(new Error("offline"));
  render(
    <SessionProvider user={baseUser}>
      <Probe />
    </SessionProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("Test User"));
  expect(screen.getByTestId("perm-count")).toHaveTextContent("none");
  expect(forcedNav).not.toHaveBeenCalled();
});

it("routes a mustChangePassword session to forced change-password (FR-AUD-030)", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ user: { ...baseUser, mustChangePassword: true, permissions: [] } }),
  });

  render(
    <SessionProvider user={baseUser}>
      <Probe />
    </SessionProvider>,
  );
  await waitFor(() => expect(forcedNav).toHaveBeenCalled());
});

it("a 401 from /me clears the session (re-login)", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
  render(
    <SessionProvider user={baseUser}>
      <Probe />
    </SessionProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent(""));
});
