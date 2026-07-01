/**
 * FE-18 role-permission-editor component tests (FR-AUD-011/012/013/016/019/020).
 * Covers the state matrix (loading/empty/error/success/403/saving/conflict),
 * matrix grant/revoke + scope/limit editing, batched save (grant/revoke/patch
 * ops), optimistic-lock conflict with pending edits preserved, duplicate-
 * permission silent reconciliation, unscoped-role scope clash, approval-limit
 * escalate-by-default copy, a11y (accessible cell names, conflict banner focus),
 * and the responsive summary markup.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type RoleListItem, type RoleDetail } from "@/features/audit/types";
import { RolePermissionEditorScreen } from "@/features/audit/components/RolePermissionEditorScreen";
import * as rolesApi from "@/features/audit/api/roles";
import * as permissionsApi from "@/features/audit/api/permissions";

jest.mock("@/features/audit/api/roles", () => ({
  listRoles: jest.fn(),
  getRole: jest.fn(),
  updateRole: jest.fn(),
}));
jest.mock("@/features/audit/api/permissions", () => ({
  createPermission: jest.fn(),
  updatePermission: jest.fn(),
  deletePermission: jest.fn(),
}));

const listRolesMock = rolesApi.listRoles as jest.Mock;
const getRoleMock = rolesApi.getRole as jest.Mock;
const updateRoleMock = rolesApi.updateRole as jest.Mock;
const createPermissionMock = permissionsApi.createPermission as jest.Mock;
const updatePermissionMock = permissionsApi.updatePermission as jest.Mock;
const deletePermissionMock = permissionsApi.deletePermission as jest.Mock;

const ROLE_LIST: RoleListItem[] = [
  { id: "r-admin", name: "ADMIN", approvalLimit: "10000000", isUnscoped: true, version: 7 },
  {
    id: "r-accounts",
    name: "ACCOUNTS_TEAM",
    approvalLimit: "2000000",
    isUnscoped: true,
    version: 4,
  },
  { id: "r-pm", name: "PROJECT_MANAGER", approvalLimit: "500000", isUnscoped: false, version: 12 },
  { id: "r-site", name: "SITE_ENGINEER", approvalLimit: null, isUnscoped: false, version: 3 },
  { id: "r-store", name: "STORE_KEEPER", approvalLimit: "300000", isUnscoped: false, version: 9 },
  { id: "r-hr", name: "HR_MANAGER", approvalLimit: null, isUnscoped: false, version: 5 },
];

function pmDetail(overrides: Partial<RoleDetail> = {}): RoleDetail {
  return {
    id: "r-pm",
    name: "PROJECT_MANAGER",
    approvalLimit: "500000",
    isUnscoped: false,
    version: 12,
    permissions: [
      {
        id: "p1",
        module: "PUR",
        action: "APPROVE",
        projectScope: "ASSIGNED",
        valueLimit: "200000",
      },
      { id: "p2", module: "REQ", action: "CREATE", projectScope: "ASSIGNED", valueLimit: null },
    ],
    ...overrides,
  };
}

function emptyRoleDetail(): RoleDetail {
  return {
    id: "r-site",
    name: "SITE_ENGINEER",
    approvalLimit: null,
    isUnscoped: false,
    version: 3,
    permissions: [],
  };
}

function unscopedAdminDetail(): RoleDetail {
  return {
    id: "r-admin",
    name: "ADMIN",
    approvalLimit: "10000000",
    isUnscoped: true,
    version: 7,
    permissions: [
      { id: "pa1", module: "MAS", action: "CREATE", projectScope: "ALL", valueLimit: null },
    ],
  };
}

function user(role: Role): SafeUser {
  return {
    id: "session-user",
    email: "x@ze.test",
    name: "X",
    role,
    companyId: "c1",
    financialYearId: "fy1",
    isActive: true,
  };
}

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderScreen(role: Role = "ADMIN") {
  return render(
    <QueryClientProvider client={client()}>
      <SessionProvider user={user(role)}>
        <ToastProvider>
          <RolePermissionEditorScreen />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listRolesMock.mockReset();
  getRoleMock.mockReset();
  updateRoleMock.mockReset();
  createPermissionMock.mockReset();
  updatePermissionMock.mockReset();
  deletePermissionMock.mockReset();
});

// ── Admin-only / 403 (spec §11) ──────────────────────────────────────────────
describe("RolePermissionEditorScreen — Admin-only (spec §6/§11)", () => {
  it("non-Admin sees the inline 403 view and never calls the API", async () => {
    renderScreen("ACCOUNTS_TEAM");
    expect(
      await screen.findByText("You don't have access to roles & permissions."),
    ).toBeInTheDocument();
    expect(listRolesMock).not.toHaveBeenCalled();
  });
});

// ── State matrix (spec §6) ───────────────────────────────────────────────────
describe("RolePermissionEditorScreen — state matrix (spec §6)", () => {
  it("shows the loading skeleton first", () => {
    listRolesMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId("roles-loading")).toBeInTheDocument();
  });

  it("loads the first role by default, ticks its grants, and shows its approval limit", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(unscopedAdminDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    expect(screen.getByTestId("cell-MAS-CREATE")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("approval-limit-input")).toHaveValue("10000000");
  });

  it("empty role shows the exact empty-state hint (spec §8)", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(emptyRoleDetail());
    renderScreen();
    await userEvent.click(await screen.findByTestId("role-tab-SITE_ENGINEER"));
    expect(await screen.findByTestId("matrix-empty-hint")).toHaveTextContent(
      "This role has no permissions yet.",
    );
  });

  it("null approvalLimit shows 'No approval authority — every approval for this role escalates.' (escalate-by-default)", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(emptyRoleDetail());
    renderScreen();
    await userEvent.click(await screen.findByTestId("role-tab-SITE_ENGINEER"));
    expect(await screen.findByTestId("approval-limit-hint")).toHaveTextContent(
      "No approval authority — every approval for this role escalates.",
    );
  });

  it("a granted permission with no valueLimit is labelled 'Role limit' when opened", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-REQ-CREATE"));
    expect(await screen.findByTestId("value-limit-input-REQ|CREATE")).toHaveAttribute(
      "placeholder",
      "Role limit",
    );
    expect(screen.getByTestId("value-limit-hint-REQ|CREATE")).toHaveTextContent(
      "Blank inherits the role limit",
    );
  });

  it("load error shows 'Couldn't load this role.' with Retry", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(await screen.findByText("Couldn't load this role.")).toBeInTheDocument();
    expect(screen.getByTestId("role-retry")).toBeInTheDocument();
  });

  it("Save is disabled until an edit is made, then enabled", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    expect(screen.getByTestId("save-changes")).toBeDisabled();
    await userEvent.click(screen.getByTestId("cell-GEN-POST"));
    expect(screen.getByTestId("save-changes")).not.toBeDisabled();
  });
});

// ── Grant / revoke / scope / limit editing (spec §5/§7) ─────────────────────
describe("RolePermissionEditorScreen — matrix editing (FR-AUD-012/013)", () => {
  it("clicking an ungranted cell grants it and opens the scope/limit editor", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-GEN-POST"));
    expect(screen.getByTestId("cell-GEN-POST")).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByTestId("editor-row-GEN-POST")).toBeInTheDocument();
  });

  it("each cell's accessible name combines module and action (spec §10)", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    expect(screen.getByRole("checkbox", { name: "PUR — APPROVE" })).toBeInTheDocument();
  });

  it("Revoke on the editor row un-grants and closes the editor", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-PUR-APPROVE"));
    await userEvent.click(await screen.findByTestId("revoke-PUR-APPROVE"));
    expect(screen.getByTestId("cell-PUR-APPROVE")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("editor-row-PUR-APPROVE")).not.toBeInTheDocument();
  });

  it("changing scope to ASSIGNED on a scoped role updates the pending cell", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-REQ-CREATE"));
    await userEvent.click(await screen.findByTestId("scope-all"));
    expect(screen.getByTestId("scope-all")).toHaveAttribute("aria-pressed", "true");
  });

  it("the value-limit field rejects a negative amount inline", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-REQ-CREATE"));
    const input = await screen.findByTestId("value-limit-input-REQ|CREATE");
    await userEvent.type(input, "-5");
    expect(await screen.findByTestId("value-limit-hint-REQ|CREATE")).toHaveTextContent(
      "Enter an amount of 0 or more.",
    );
  });

  it("on an unscoped role, the scope control is disabled (ROLE_SCOPE_CONFLICT prevention)", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(unscopedAdminDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-MAS-CREATE"));
    expect(await screen.findByTestId("scope-assigned")).toBeDisabled();
  });
});

// ── Batched save (spec §9) ───────────────────────────────────────────────────
describe("RolePermissionEditorScreen — batched save (FR-AUD-013/016/019)", () => {
  it("grants POST, revokes DELETE, and edits PATCH — all in one save, carrying version", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    createPermissionMock.mockResolvedValue({
      id: "new1",
      module: "GEN",
      action: "POST",
      projectScope: "ASSIGNED",
      valueLimit: null,
    });
    deletePermissionMock.mockResolvedValue(undefined);
    updatePermissionMock.mockResolvedValue({
      id: "p1",
      module: "PUR",
      action: "APPROVE",
      projectScope: "ALL",
      valueLimit: "200000",
    });
    updateRoleMock.mockResolvedValue(pmDetail({ approvalLimit: "600000", version: 13 }));

    renderScreen();
    await screen.findByTestId("permission-matrix");

    // grant a new cell
    await userEvent.click(screen.getByTestId("cell-GEN-POST"));
    await userEvent.click(screen.getByTestId("done-GEN-POST"));

    // revoke an existing grant
    await userEvent.click(screen.getByTestId("cell-REQ-CREATE"));
    await userEvent.click(await screen.findByTestId("revoke-REQ-CREATE"));

    // change scope on an existing grant
    await userEvent.click(screen.getByTestId("cell-PUR-APPROVE"));
    await userEvent.click(await screen.findByTestId("scope-all"));
    await userEvent.click(screen.getByTestId("done-PUR-APPROVE"));

    // change the approval limit
    const approvalInput = screen.getByTestId("approval-limit-input");
    await userEvent.clear(approvalInput);
    await userEvent.type(approvalInput, "600000");

    await userEvent.click(screen.getByTestId("save-changes"));

    await waitFor(() =>
      expect(createPermissionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          roleId: "r-pm",
          module: "GEN",
          action: "POST",
          projectScope: "ASSIGNED",
        }),
      ),
    );
    expect(deletePermissionMock).toHaveBeenCalledWith("p2");
    expect(updatePermissionMock).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ projectScope: "ALL", version: 12 }),
    );
    await waitFor(() =>
      expect(updateRoleMock).toHaveBeenCalledWith("r-pm", { approvalLimit: "600000", version: 12 }),
    );
    expect(await screen.findByText("Permissions saved.")).toBeInTheDocument();
  });

  it("DUPLICATE_PERMISSION on a grant is reconciled silently as on (spec §6)", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    createPermissionMock.mockRejectedValue(
      new ApiError({ code: "DUPLICATE_PERMISSION", message: "dup", details: null, status: 409 }),
    );
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-GEN-POST"));
    await userEvent.click(screen.getByTestId("done-GEN-POST"));
    await userEvent.click(screen.getByTestId("save-changes"));
    expect(await screen.findByText("Permissions saved.")).toBeInTheDocument();
    expect(screen.getByTestId("cell-GEN-POST")).toHaveAttribute("aria-checked", "true");
  });

  it("ROLE_SCOPE_CONFLICT surfaces the exact unscoped-clash toast (spec §6/§13)", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    updatePermissionMock.mockRejectedValue(
      new ApiError({ code: "ROLE_SCOPE_CONFLICT", message: "clash", details: null, status: 409 }),
    );
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-PUR-APPROVE"));
    await userEvent.click(await screen.findByTestId("scope-all"));
    await userEvent.click(screen.getByTestId("done-PUR-APPROVE"));
    await userEvent.click(screen.getByTestId("save-changes"));
    expect(
      await screen.findByText(
        "This role applies to all projects, so project scope can't be restricted.",
      ),
    ).toBeInTheDocument();
  });

  it("discarding pending edits restores the loaded grants (spec §8 confirm copy)", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-GEN-POST"));
    await userEvent.click(screen.getByTestId("discard-changes"));
    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    expect(screen.getByText("Unsaved permission changes will be lost.")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("discard-permissions-confirm"));
    await waitFor(() =>
      expect(screen.getByTestId("cell-GEN-POST")).toHaveAttribute("aria-checked", "false"),
    );
    expect(screen.getByTestId("save-changes")).toBeDisabled();
  });
});

// ── Optimistic-lock conflict (spec §6/§9/§13; FR-AUD-019) ───────────────────
describe("RolePermissionEditorScreen — optimistic-lock conflict", () => {
  it("OPTIMISTIC_LOCK_CONFLICT shows the banner, preserves pending edits, and moves focus to Reload", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    updateRoleMock.mockRejectedValue(
      new ApiError({
        code: "OPTIMISTIC_LOCK_CONFLICT",
        message: "stale",
        details: null,
        status: 409,
      }),
    );
    renderScreen();
    await screen.findByTestId("permission-matrix");

    const approvalInput = screen.getByTestId("approval-limit-input");
    await userEvent.clear(approvalInput);
    await userEvent.type(approvalInput, "999999");
    await userEvent.click(screen.getByTestId("cell-GEN-POST"));
    await userEvent.click(screen.getByTestId("save-changes"));

    const banner = await screen.findByTestId("conflict-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent("This role was changed by someone else.");
    expect(banner).toHaveTextContent("Reload to see the latest, then reapply your changes.");
    await waitFor(() => expect(screen.getByTestId("conflict-reload")).toHaveFocus());

    // Pending edits are preserved (not overwritten) after the conflict.
    expect(screen.getByTestId("approval-limit-input")).toHaveValue("999999");
    expect(screen.getByTestId("cell-GEN-POST")).toHaveAttribute("aria-checked", "true");
  });
});

// ── Responsive (spec §4) ─────────────────────────────────────────────────────
describe("RolePermissionEditorScreen — responsive reflow (spec §4)", () => {
  it("renders both the full matrix (desktop/tablet, lg:flex) and the read-only mobile summary (lg:hidden)", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    const matrix = await screen.findByTestId("permission-matrix");
    const summary = screen.getByTestId("roles-mobile-summary");
    expect(matrix.closest(".lg\\:flex")).toBeTruthy();
    expect(summary.closest(".lg\\:hidden")).toBeTruthy();
  });

  it("the mobile summary lists granted actions per module and shows the 'Edit on a larger screen' notice", async () => {
    listRolesMock.mockResolvedValue(ROLE_LIST);
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    const summary = await screen.findByTestId("roles-mobile-summary");
    expect(within(summary).getByText(/Edit on a larger screen/)).toBeInTheDocument();
    expect(within(summary).getByTestId("mobile-row-PUR")).toHaveTextContent("Approve");
  });
});
