/**
 * FE-22 role-permission-editor v2 tests (RBAC v2 · FR-AUD-011/013/016/019/020/034/035).
 * Admin-only 403, state matrix (incl. catalogue loading/error), catalogue-driven grid
 * (rows only from GET /api/permissions/catalog; undeclared cells disabled), grant/
 * revoke/scope/limit, the single atomic batch save (PATCH /api/roles/:id/permissions),
 * module/resource bulk toggles, custom-role create + delete (incl. ROLE_IN_USE), Admin
 * anti-lockout, optimistic-lock conflict, responsive summary, and a11y.
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
import { type RoleListItem, type RoleDetail, type PermissionCatalog } from "@/features/audit/types";
import { RolePermissionEditorScreen } from "@/features/audit/components/RolePermissionEditorScreen";
import * as rolesApi from "@/features/audit/api/roles";
import * as permissionsApi from "@/features/audit/api/permissions";

jest.mock("@/features/audit/api/roles", () => ({
  listRoles: jest.fn(),
  getRole: jest.fn(),
  createRole: jest.fn(),
  updateRole: jest.fn(),
  deleteRole: jest.fn(),
  replaceRolePermissions: jest.fn(),
}));
jest.mock("@/features/audit/api/permissions", () => ({
  getPermissionCatalog: jest.fn(),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const listRolesMock = rolesApi.listRoles as jest.Mock;
const getRoleMock = rolesApi.getRole as jest.Mock;
const createRoleMock = rolesApi.createRole as jest.Mock;
const updateRoleMock = rolesApi.updateRole as jest.Mock;
const deleteRoleMock = rolesApi.deleteRole as jest.Mock;
const replaceMock = rolesApi.replaceRolePermissions as jest.Mock;
const catalogMock = permissionsApi.getPermissionCatalog as jest.Mock;

const CATALOG: PermissionCatalog = {
  modules: [
    {
      module: "PUR",
      label: "Purchases",
      resources: [
        { resource: "purchase.orders", label: "Purchase orders", actions: ["READ", "CREATE", "UPDATE", "APPROVE", "CANCEL"] },
        { resource: "purchase.grn", label: "GRN & matching", actions: ["READ", "CREATE", "POST"] },
      ],
    },
    {
      module: "REQ",
      label: "Requisitions",
      resources: [{ resource: "requisitions.list", label: "Requisitions", actions: ["READ", "CREATE", "UPDATE", "DELETE"] }],
    },
    {
      module: "AUD",
      label: "Audit & access",
      resources: [{ resource: "audit.roles", label: "Roles & permissions", actions: ["READ", "CREATE", "UPDATE", "DELETE"] }],
    },
  ],
};

const ROLE_LIST: RoleListItem[] = [
  { id: "r-admin", name: "ADMIN", isSystem: true, approvalLimit: "10000000", isUnscoped: true, userCount: 1, version: 7 },
  { id: "r-pm", name: "PROJECT_MANAGER", isSystem: true, approvalLimit: "500000", isUnscoped: false, userCount: 4, version: 12 },
  { id: "r-custom", name: "Site Auditor", isSystem: false, approvalLimit: null, isUnscoped: false, userCount: 0, version: 1 },
  { id: "r-custom-used", name: "Regional Lead", isSystem: false, approvalLimit: null, isUnscoped: false, userCount: 3, version: 2 },
];

function pmDetail(overrides: Partial<RoleDetail> = {}): RoleDetail {
  return {
    id: "r-pm",
    name: "PROJECT_MANAGER",
    isSystem: true,
    approvalLimit: "500000",
    isUnscoped: false,
    userCount: 4,
    version: 12,
    permissions: [
      { id: "p1", resource: "purchase.orders", action: "APPROVE", projectScope: "ASSIGNED", valueLimit: "200000" },
      { id: "p2", resource: "requisitions.list", action: "CREATE", projectScope: "ASSIGNED", valueLimit: null },
    ],
    ...overrides,
  };
}

function adminDetail(): RoleDetail {
  return {
    id: "r-admin",
    name: "ADMIN",
    isSystem: true,
    approvalLimit: "10000000",
    isUnscoped: true,
    userCount: 1,
    version: 7,
    permissions: [
      { id: "pa1", resource: "audit.roles", action: "READ", projectScope: "ALL", valueLimit: null },
      { id: "pa2", resource: "audit.roles", action: "UPDATE", projectScope: "ALL", valueLimit: null },
    ],
  };
}

function customEmptyDetail(): RoleDetail {
  return {
    id: "r-custom",
    name: "Site Auditor",
    isSystem: false,
    approvalLimit: null,
    isUnscoped: false,
    userCount: 0,
    version: 1,
    permissions: [],
  };
}

function user(role: Role): SafeUser {
  return { id: "u", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy1", isActive: true };
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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
  jest.clearAllMocks();
  catalogMock.mockResolvedValue(CATALOG);
  listRolesMock.mockResolvedValue(ROLE_LIST);
});

// ── Admin-only / 403 ──────────────────────────────────────────────────────────
describe("Admin-only (spec §6/§11)", () => {
  it("non-Admin sees the inline 403 view and never calls the API", async () => {
    renderScreen("ACCOUNTS_TEAM");
    expect(await screen.findByText("You don't have access to roles & permissions.")).toBeInTheDocument();
    expect(listRolesMock).not.toHaveBeenCalled();
    expect(catalogMock).not.toHaveBeenCalled();
  });
});

// ── State matrix + catalogue-driven grid ─────────────────────────────────────
describe("state matrix + catalogue grid (spec §5/§6; FR-AUD-035)", () => {
  it("loads the first role, renders rows FROM THE CATALOGUE, and ticks its grants", async () => {
    getRoleMock.mockImplementation((id: string) => Promise.resolve(id === "r-admin" ? adminDetail() : pmDetail()));
    renderScreen();
    await screen.findByTestId("permission-matrix");
    // rows come from the catalogue (module groups + resource rows)
    expect(screen.getByTestId("module-group-PUR")).toBeInTheDocument();
    expect(screen.getByTestId("cell-purchase.orders-APPROVE")).toBeInTheDocument();
    // admin's grant is ticked
    expect(screen.getByTestId("cell-audit.roles-READ")).toHaveAttribute("aria-checked", "true");
  });

  it("undeclared (resource, action) cells are disabled — not grantable (FR-AUD-035)", async () => {
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen("ADMIN");
    await screen.findByTestId("role-tab-PROJECT_MANAGER");
    await userEvent.click(screen.getByTestId("role-tab-PROJECT_MANAGER"));
    await screen.findByTestId("permission-matrix");
    // purchase.grn does NOT declare APPROVE → that cell is non-declared
    const cell = await screen.findByTestId("cell-purchase.grn-APPROVE");
    expect(cell).toHaveAttribute("data-declared", "false");
  });

  it("empty custom role shows the empty-state hint", async () => {
    getRoleMock.mockImplementation((id: string) => Promise.resolve(id === "r-custom" ? customEmptyDetail() : adminDetail()));
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("role-tab-Site Auditor"));
    expect(await screen.findByTestId("matrix-empty-hint")).toHaveTextContent("This role has no permissions yet.");
  });

  it("a catalogue fetch failure blocks the grid with Retry", async () => {
    catalogMock.mockRejectedValue(new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }));
    getRoleMock.mockResolvedValue(adminDetail());
    renderScreen();
    expect(await screen.findByTestId("catalog-retry")).toBeInTheDocument();
    expect(screen.queryByTestId("permission-matrix")).not.toBeInTheDocument();
  });

  it("Save is disabled until an edit is made", async () => {
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await screen.findByTestId("role-tab-PROJECT_MANAGER");
    await userEvent.click(screen.getByTestId("role-tab-PROJECT_MANAGER"));
    await screen.findByTestId("permission-matrix");
    expect(screen.getByTestId("save-changes")).toBeDisabled();
    await userEvent.click(screen.getByTestId("cell-purchase.orders-CREATE"));
    expect(screen.getByTestId("save-changes")).not.toBeDisabled();
  });
});

// ── Batch save (single atomic replace) ───────────────────────────────────────
describe("batch save — one PATCH /roles/:id/permissions (spec §9; FR-AUD-013/019)", () => {
  it("commits the whole grid as ONE full-set replace carrying version; no per-item writes", async () => {
    getRoleMock.mockResolvedValue(pmDetail());
    replaceMock.mockResolvedValue(pmDetail({ version: 13 }));
    renderScreen();
    await userEvent.click(await screen.findByTestId("role-tab-PROJECT_MANAGER"));
    await screen.findByTestId("permission-matrix");

    // grant one cell, revoke an existing one
    await userEvent.click(screen.getByTestId("cell-purchase.orders-CREATE"));
    await userEvent.click(screen.getByTestId("done-purchase.orders-CREATE"));
    await userEvent.click(screen.getByTestId("cell-requisitions.list-CREATE"));
    await userEvent.click(await screen.findByTestId("revoke-requisitions.list-CREATE"));

    await userEvent.click(screen.getByTestId("save-changes"));

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("r-pm", {
        version: 12,
        permissions: [
          { resource: "purchase.orders", action: "APPROVE", projectScope: "ASSIGNED", valueLimit: "200000" },
          { resource: "purchase.orders", action: "CREATE", projectScope: "ASSIGNED", valueLimit: null },
        ],
      }),
    );
    expect(await screen.findByText("Permissions saved.")).toBeInTheDocument();
  });

  it("ROLE_SCOPE_CONFLICT surfaces the exact unscoped-clash toast", async () => {
    getRoleMock.mockResolvedValue(pmDetail());
    replaceMock.mockRejectedValue(new ApiError({ code: "ROLE_SCOPE_CONFLICT", message: "x", details: null, status: 409 }));
    renderScreen();
    await userEvent.click(await screen.findByTestId("role-tab-PROJECT_MANAGER"));
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-purchase.orders-CREATE"));
    await userEvent.click(screen.getByTestId("save-changes"));
    expect(
      await screen.findByText("This role applies to all projects, so project scope can't be restricted."),
    ).toBeInTheDocument();
  });

  it("OPTIMISTIC_LOCK_CONFLICT shows the banner, preserves pending edits, and focuses Reload", async () => {
    getRoleMock.mockResolvedValue(pmDetail());
    replaceMock.mockRejectedValue(new ApiError({ code: "OPTIMISTIC_LOCK_CONFLICT", message: "stale", details: null, status: 409 }));
    renderScreen();
    await userEvent.click(await screen.findByTestId("role-tab-PROJECT_MANAGER"));
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-purchase.orders-CREATE"));
    await userEvent.click(screen.getByTestId("save-changes"));

    const banner = await screen.findByTestId("conflict-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent("This role was changed by someone else.");
    await waitFor(() => expect(screen.getByTestId("conflict-reload")).toHaveFocus());
    // pending edit preserved
    expect(screen.getByTestId("cell-purchase.orders-CREATE")).toHaveAttribute("aria-checked", "true");
  });
});

// ── Bulk toggles ─────────────────────────────────────────────────────────────
describe("bulk grant/clear (spec §5/§9)", () => {
  it("a module tri-state toggle grants every declared (resource, action) in the module", async () => {
    getRoleMock.mockResolvedValue(customEmptyDetail());
    renderScreen();
    await userEvent.click(await screen.findByTestId("role-tab-Site Auditor"));
    await screen.findByTestId("permission-matrix");
    const modBox = screen.getByTestId("bulk-module-REQ");
    expect(modBox).toHaveAttribute("aria-checked", "false");
    await userEvent.click(modBox);
    // all 4 declared REQ actions now granted
    expect(screen.getByTestId("cell-requisitions.list-READ")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("cell-requisitions.list-DELETE")).toHaveAttribute("aria-checked", "true");
    expect(modBox).toHaveAttribute("aria-checked", "true");
  });

  it("a bulk clear over grants carrying value limits warns first", async () => {
    getRoleMock.mockResolvedValue(pmDetail()); // purchase.orders|APPROVE has a 200000 limit
    renderScreen();
    await userEvent.click(await screen.findByTestId("role-tab-PROJECT_MANAGER"));
    await screen.findByTestId("permission-matrix");
    // purchase.orders is mixed (only APPROVE granted, with a limit). A mixed click
    // COMPLETES the set (spec §9); clicking again on the now-checked set CLEARS it,
    // which — because APPROVE carries a value limit — must warn first.
    const resBox = screen.getByTestId("bulk-resource-purchase.orders");
    await userEvent.click(resBox); // complete
    expect(resBox).toHaveAttribute("aria-checked", "true");
    await userEvent.click(resBox); // clear → warning
    expect(await screen.findByTestId("bulk-clear-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-clear-dialog")).toHaveTextContent("with value limit");
  });
});

// ── Admin anti-lockout ───────────────────────────────────────────────────────
describe("Admin anti-lockout (spec §6/§13; FR-AUD-034)", () => {
  it("the Admin role shows the lockout note and its module bulk clear is disabled", async () => {
    getRoleMock.mockResolvedValue(adminDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    expect(screen.getByTestId("admin-lockout-note")).toHaveTextContent("The Admin role must keep full access.");
    // AUD module is fully/partly granted → its bulk toggle (clear direction) is disabled on Admin
    expect(screen.getByTestId("bulk-module-AUD")).toBeDisabled();
  });

  it("a granted Admin cell's editor row offers no Revoke (only the lockout note)", async () => {
    getRoleMock.mockResolvedValue(adminDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("cell-audit.roles-READ"));
    expect(await screen.findByTestId("admin-locked-audit.roles-READ")).toBeInTheDocument();
    expect(screen.queryByTestId("revoke-audit.roles-READ")).not.toBeInTheDocument();
  });
});

// ── Custom-role CRUD ─────────────────────────────────────────────────────────
describe("custom-role CRUD (FR-AUD-034)", () => {
  it("New role creates a custom role and selects it", async () => {
    getRoleMock.mockResolvedValue(adminDetail());
    createRoleMock.mockResolvedValue({ ...customEmptyDetail(), id: "r-new", name: "Auditor 2" });
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("new-role-header"));
    await userEvent.type(screen.getByTestId("new-role-name"), "Auditor 2");
    await userEvent.click(screen.getByTestId("new-role-create"));
    await waitFor(() =>
      expect(createRoleMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Auditor 2", isUnscoped: false })),
    );
    expect(await screen.findByText("Role created.")).toBeInTheDocument();
  });

  it("a duplicate role name maps inline on the name field", async () => {
    getRoleMock.mockResolvedValue(adminDetail());
    createRoleMock.mockRejectedValue(new ApiError({ code: "DUPLICATE_ROLE_NAME", message: "dup", details: null, status: 409 }));
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("new-role-header"));
    await userEvent.type(screen.getByTestId("new-role-name"), "Admin");
    await userEvent.click(screen.getByTestId("new-role-create"));
    expect(await screen.findByTestId("new-role-name-error")).toHaveTextContent("A role with this name already exists.");
  });

  it("built-in roles carry a System badge and no delete affordance", async () => {
    getRoleMock.mockResolvedValue(adminDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    expect(screen.getByTestId("system-badge-ADMIN")).toBeInTheDocument();
    expect(screen.queryByTestId("delete-role-r-admin")).not.toBeInTheDocument();
    // a custom role IS deletable
    expect(screen.getByTestId("delete-role-r-custom")).toBeInTheDocument();
  });

  it("deleting an unused custom role calls DELETE and toasts", async () => {
    getRoleMock.mockResolvedValue(adminDetail());
    deleteRoleMock.mockResolvedValue(undefined);
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("delete-role-r-custom"));
    await userEvent.click(await screen.findByTestId("delete-role-confirm"));
    await waitFor(() => expect(deleteRoleMock).toHaveBeenCalledWith("r-custom"));
    expect(await screen.findByText("Role deleted.")).toBeInTheDocument();
  });

  it("deleting a role held by users is blocked with the reassign message (ROLE_IN_USE)", async () => {
    getRoleMock.mockResolvedValue(adminDetail());
    renderScreen();
    await screen.findByTestId("permission-matrix");
    await userEvent.click(screen.getByTestId("delete-role-r-custom-used"));
    expect(await screen.findByTestId("delete-role-inuse")).toHaveTextContent(
      "This role is assigned to 3 users. Reassign them before deleting.",
    );
    expect(screen.queryByTestId("delete-role-confirm")).not.toBeInTheDocument();
    expect(deleteRoleMock).not.toHaveBeenCalled();
  });
});

// ── Responsive + a11y ────────────────────────────────────────────────────────
describe("responsive + a11y (spec §4/§10)", () => {
  it("renders the full matrix (lg:flex) and the read-only mobile summary (lg:hidden)", async () => {
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await userEvent.click(await screen.findByTestId("role-tab-PROJECT_MANAGER"));
    const matrix = await screen.findByTestId("permission-matrix");
    const summary = screen.getByTestId("roles-mobile-summary");
    expect(matrix.closest(".lg\\:flex")).toBeTruthy();
    expect(summary.closest(".lg\\:hidden")).toBeTruthy();
    expect(within(summary).getByText(/Edit on a larger screen/)).toBeInTheDocument();
  });

  it("each cell's accessible name combines resource and action", async () => {
    getRoleMock.mockResolvedValue(pmDetail());
    renderScreen();
    await userEvent.click(await screen.findByTestId("role-tab-PROJECT_MANAGER"));
    await screen.findByTestId("permission-matrix");
    expect(screen.getByRole("checkbox", { name: "purchase.orders — APPROVE" })).toBeInTheDocument();
  });
});
