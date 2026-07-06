/**
 * FE-17 user-management tests (FR-AUD-002/007/008/009/011/018/019/020/027).
 * List: state matrix, filters, Admin-only 403. Create/edit drawer: validation,
 * server-error mapping (CONFLICT email-taken, OPTIMISTIC_LOCK_CONFLICT reload
 * banner, VALIDATION_ERROR). Status + reset-password dialogs: server-confirmed,
 * exact confirm copy, password never shown/returned. Detail panel + NOT_FOUND.
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
import { type UserListItem, type UserDetail } from "@/features/audit/types";
import { UsersScreen } from "@/features/audit/components/UsersScreen";
import { UserDrawer } from "@/features/audit/components/UserDrawer";
import { UserStatusDialog } from "@/features/audit/components/UserStatusDialog";
import { UserResetPasswordDialog } from "@/features/audit/components/UserResetPasswordDialog";
import * as usersApi from "@/features/audit/api/users";
import * as fyApi from "@/features/audit/api/financial-years";

jest.mock("@/features/audit/api/users", () => ({
  listUsers: jest.fn(),
  getUser: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  activateUser: jest.fn(),
  deactivateUser: jest.fn(),
  resetUserPassword: jest.fn(),
}));
jest.mock("@/features/audit/api/financial-years", () => ({
  listFinancialYearOptions: jest.fn(),
}));
// The drawer's role picker now sources from GET /api/roles (RBAC v2) — mock the
// roles api the barrel re-exports. Ids mirror the role names so the option values
// the tests select stay readable.
jest.mock("@/features/audit/api/roles", () => ({
  ...jest.requireActual("@/features/audit/api/roles"),
  listRoles: jest.fn(),
}));
import * as rolesApi from "@/features/audit/api/roles";

const listMock = usersApi.listUsers as jest.Mock;
const getMock = usersApi.getUser as jest.Mock;
const createMock = usersApi.createUser as jest.Mock;
const updateMock = usersApi.updateUser as jest.Mock;
const activateMock = usersApi.activateUser as jest.Mock;
const deactivateMock = usersApi.deactivateUser as jest.Mock;
const resetMock = usersApi.resetUserPassword as jest.Mock;
const fyMock = fyApi.listFinancialYearOptions as jest.Mock;
const rolesListMock = rolesApi.listRoles as jest.Mock;

const SEEDED_ROLES = ["ADMIN", "ACCOUNTS_TEAM", "PROJECT_MANAGER", "SITE_ENGINEER", "STORE_KEEPER", "HR_MANAGER"].map(
  (name) => ({ id: name, name, approvalLimit: null, isUnscoped: name === "ADMIN", version: 1 }),
);

const ADMIN_ROW: UserListItem = {
  id: "u1",
  email: "ashraf.uddin@zakirent.com",
  name: "Ashraf Uddin",
  role: "ADMIN",
  isActive: true,
  lastLoginAt: "2026-06-28T10:00:00.000Z",
  assignedProjectCount: 0,
};
const PM_ROW: UserListItem = {
  id: "u2",
  email: "m.hasan@zakirent.com",
  name: "Mohammad Hasan",
  role: "PROJECT_MANAGER",
  isActive: true,
  lastLoginAt: null,
  assignedProjectCount: 2,
};

const PM_DETAIL: UserDetail = {
  id: "u2",
  email: "m.hasan@zakirent.com",
  name: "Mohammad Hasan",
  role: "PROJECT_MANAGER",
  financialYearId: "fy1",
  isActive: true,
  lastLoginAt: null,
  phone: "+8801819223344",
  assignedProjects: [{ projectId: "p1", projectName: "Bridge-04 — Buriganga" }],
  version: 1,
};

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

function page(...rows: UserListItem[]) {
  return { data: rows, page: 1, pageSize: 25, total: rows.length };
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
          <UsersScreen />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

function renderNode(ui: React.ReactElement) {
  // The audit hooks (use-users/use-roles) read the session for Admin gating, so even
  // bare component renders need a SessionProvider (pre-existing harness gap, surfaced
  // when the hooks gained useAuthenticatedUser).
  return render(
    <QueryClientProvider client={client()}>
      <SessionProvider user={user("ADMIN")}>
        <ToastProvider>{ui}</ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => {
  listMock.mockReset();
  getMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  activateMock.mockReset();
  deactivateMock.mockReset();
  resetMock.mockReset();
  fyMock.mockReset();
  fyMock.mockResolvedValue([{ id: "fy1", label: "2025–26" }]);
  rolesListMock.mockReset();
  rolesListMock.mockResolvedValue(SEEDED_ROLES);
});

// ── List / state matrix ──────────────────────────────────────────────────────
describe("UsersScreen — list + state matrix (spec §6)", () => {
  it("shows loading skeletons first", () => {
    listMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId("users-loading")).toBeInTheDocument();
  });

  it("renders name, role, status, last login (or Never), projects (FR-AUD-008/011)", async () => {
    listMock.mockResolvedValue(page(ADMIN_ROW, PM_ROW));
    renderScreen();
    const table = await screen.findByTestId("users-desktop");
    expect(within(table).getByText("Ashraf Uddin")).toBeInTheDocument();
    expect(within(table).getByText("ashraf.uddin@zakirent.com")).toBeInTheDocument();
    expect(within(table).getByText("28/06/2026")).toBeInTheDocument();
    expect(within(table).getByText("Never")).toBeInTheDocument();
    expect(within(table).getByText("All projects")).toBeInTheDocument();
    expect(within(table).getByText("2 projects")).toBeInTheDocument();
  });

  it("never renders password_hash or any secret field", async () => {
    listMock.mockResolvedValue(page(ADMIN_ROW));
    renderScreen();
    await screen.findByTestId("users-desktop");
    expect(screen.queryByText(/password_hash/i)).not.toBeInTheDocument();
  });

  it("empty (no filters) shows 'No users yet.' + New; filtered-empty shows Clear filters", async () => {
    listMock.mockResolvedValue(page());
    renderScreen();
    expect(await screen.findByText("No users yet.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/search by name or email/i), "zzz");
    expect(await screen.findByText("No users match these filters.")).toBeInTheDocument();
    expect(screen.getByTestId("clear-filters")).toBeInTheDocument();
  });

  it("role/status filters drive the query params (FR-AUD-011, overview §6)", async () => {
    listMock.mockResolvedValue(page(ADMIN_ROW));
    renderScreen();
    await screen.findByTestId("users-desktop");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "ADMIN");
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" })),
    );
    await userEvent.selectOptions(screen.getByLabelText("Status"), "active");
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ isActive: true })),
    );
  });

  it("error shows Retry", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(await screen.findByText("Couldn't load users.")).toBeInTheDocument();
    expect(screen.getByTestId("users-retry")).toBeInTheDocument();
  });
});

// ── Admin-only / 403 ─────────────────────────────────────────────────────────
describe("UsersScreen — Admin-only (spec §11)", () => {
  it("non-Admin sees the inline 403 view and no rows", async () => {
    listMock.mockResolvedValue(page(ADMIN_ROW));
    renderScreen("ACCOUNTS_TEAM");
    expect(
      await screen.findByText("You don't have access to user management."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("user-row-u1")).not.toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });

  it("Admin sees the New user CTA and row actions", async () => {
    listMock.mockResolvedValue(page(ADMIN_ROW));
    renderScreen("ADMIN");
    expect(await screen.findByTestId("new-user")).toBeInTheDocument();
    const table = await screen.findByTestId("users-desktop");
    expect(within(table).getByTestId("user-actions-u1")).toBeInTheDocument();
  });
});

// ── Create / edit drawer ─────────────────────────────────────────────────────
describe("UserDrawer — create (FR-AUD-007, spec §7)", () => {
  const noop = () => {};

  it("requires email, name, role, financial year, and a 10+ char temp password", async () => {
    renderNode(
      <UserDrawer
        mode={{ kind: "create" }}
        onClose={noop}
        onSaved={noop}
        onReloadRequested={noop}
      />,
    );
    await screen.findByLabelText(/financial year/i);
    await userEvent.click(screen.getByTestId("user-save"));
    expect(await screen.findByText("Enter a valid email.")).toBeInTheDocument();
    expect(screen.getByText("Enter the user's name.")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 10 characters.")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates a user with the exact request shape; temp password never re-displayed", async () => {
    createMock.mockResolvedValue({ ...ADMIN_ROW, id: "new" });
    const onSaved = jest.fn();
    renderNode(
      <UserDrawer
        mode={{ kind: "create" }}
        onClose={noop}
        onSaved={onSaved}
        onReloadRequested={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/^email/i), "nazia.rahman@zakirent.com");
    await userEvent.type(screen.getByLabelText(/^name/i), "Nazia Rahman");
    await userEvent.selectOptions(screen.getByLabelText(/^role/i), "STORE_KEEPER");
    await userEvent.selectOptions(await screen.findByLabelText(/financial year/i), "fy1");
    await userEvent.type(screen.getByLabelText(/temporary password/i), "TempPass123");
    await userEvent.click(screen.getByTestId("user-save"));
    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "nazia.rahman@zakirent.com",
          name: "Nazia Rahman",
          roleId: "STORE_KEEPER",
          financialYearId: "fy1",
          temporaryPassword: "TempPass123",
        }),
      ),
    );
    expect(onSaved).toHaveBeenCalledWith("User created.");
    // The mocked response mirrors the real API shape — no temporaryPassword/password_hash field.
    const resolved = await createMock.mock.results[0]?.value;
    expect(resolved).not.toHaveProperty("temporaryPassword");
    expect(resolved).not.toHaveProperty("password_hash");
  });

  it("maps CONFLICT (email taken) inline on the email field (spec §6/§8)", async () => {
    createMock.mockRejectedValue(
      new ApiError({ code: "CONFLICT", message: "dup", details: null, status: 409 }),
    );
    renderNode(
      <UserDrawer
        mode={{ kind: "create" }}
        onClose={noop}
        onSaved={noop}
        onReloadRequested={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/^email/i), "dup@zakirent.com");
    await userEvent.type(screen.getByLabelText(/^name/i), "Dup User");
    await userEvent.selectOptions(screen.getByLabelText(/^role/i), "STORE_KEEPER");
    await userEvent.selectOptions(await screen.findByLabelText(/financial year/i), "fy1");
    await userEvent.type(screen.getByLabelText(/temporary password/i), "TempPass123");
    await userEvent.click(screen.getByTestId("user-save"));
    expect(
      await screen.findByText("A user with this email already exists."),
    ).toBeInTheDocument();
  });
});

describe("UserDrawer — edit (FR-AUD-019, spec §6/§7)", () => {
  const noop = () => {};

  it("has no email or password field", async () => {
    renderNode(
      <UserDrawer
        mode={{ kind: "edit", user: PM_DETAIL }}
        onClose={noop}
        onSaved={noop}
        onReloadRequested={noop}
      />,
    );
    await screen.findByDisplayValue("Mohammad Hasan");
    expect(screen.queryByLabelText(/^email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/temporary password/i)).not.toBeInTheDocument();
  });

  it("sends version and shows the assigned-projects summary + manage-assignment link", async () => {
    updateMock.mockResolvedValue({ ...PM_DETAIL, name: "M. Hasan" });
    const onSaved = jest.fn();
    renderNode(
      <UserDrawer
        mode={{ kind: "edit", user: PM_DETAIL }}
        onClose={noop}
        onSaved={onSaved}
        onReloadRequested={noop}
      />,
    );
    expect(await screen.findByText("Bridge-04 — Buriganga")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage assignment/i })).toHaveAttribute(
      "href",
      "/audit/project-assignment",
    );
    await userEvent.click(screen.getByTestId("user-save"));
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        "u2",
        expect.objectContaining({ version: 1, name: "Mohammad Hasan" }),
      ),
    );
    expect(onSaved).toHaveBeenCalledWith("Changes saved.");
  });

  it("maps OPTIMISTIC_LOCK_CONFLICT to the reload banner (FR-AUD-019)", async () => {
    updateMock.mockRejectedValue(
      new ApiError({ code: "OPTIMISTIC_LOCK_CONFLICT", message: "stale", details: null, status: 409 }),
    );
    const onReloadRequested = jest.fn();
    renderNode(
      <UserDrawer
        mode={{ kind: "edit", user: PM_DETAIL }}
        onClose={noop}
        onSaved={noop}
        onReloadRequested={onReloadRequested}
      />,
    );
    await screen.findByDisplayValue("Mohammad Hasan");
    await userEvent.click(screen.getByTestId("user-save"));
    const banner = await screen.findByTestId("user-conflict-banner");
    expect(banner).toHaveTextContent(
      "This user was changed by someone else. Reload to see the latest, then reapply your changes.",
    );
    await userEvent.click(screen.getByTestId("user-conflict-reload"));
    expect(onReloadRequested).toHaveBeenCalled();
  });
});

// ── Status dialog (activate/deactivate) ──────────────────────────────────────
describe("UserStatusDialog — deactivate / activate (FR-AUD-009/018, spec §8/§9)", () => {
  it("deactivate uses the exact confirm copy and is server-confirmed", async () => {
    deactivateMock.mockResolvedValue({ id: "u1", isActive: false });
    renderNode(<UserStatusDialog user={ADMIN_ROW} mode="deactivate" onClose={jest.fn()} />);
    const dialog = await screen.findByTestId("user-status-dialog");
    expect(within(dialog).getByText("Deactivate this user?")).toBeInTheDocument();
    expect(within(dialog).getByText(/Ashraf Uddin will be signed out and can't sign in/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByTestId("user-status-confirm"));
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith("u1"));
    expect(
      await screen.findByText("User deactivated. They'll be signed out and can't sign in."),
    ).toBeInTheDocument();
  });

  it("activate uses the exact confirm copy", async () => {
    activateMock.mockResolvedValue({ id: "u1", isActive: true });
    renderNode(<UserStatusDialog user={{ ...ADMIN_ROW, isActive: false }} mode="activate" onClose={jest.fn()} />);
    const dialog = await screen.findByTestId("user-status-dialog");
    expect(within(dialog).getByText("Activate this user?")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByTestId("user-status-confirm"));
    await waitFor(() => expect(activateMock).toHaveBeenCalledWith("u1"));
    expect(await screen.findByText("User activated.")).toBeInTheDocument();
  });
});

// ── Reset password dialog ────────────────────────────────────────────────────
describe("UserResetPasswordDialog (FR-AUD-007, _open-questions.md AUD 4)", () => {
  it("uses the exact confirm copy and never shows/returns the password", async () => {
    resetMock.mockResolvedValue(undefined);
    renderNode(<UserResetPasswordDialog user={PM_ROW} onClose={jest.fn()} />);
    const dialog = await screen.findByTestId("user-reset-dialog");
    expect(within(dialog).getByText("Reset this user’s password?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Mohammad Hasan will be signed out of all devices/),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByTestId("user-reset-confirm"));
    await waitFor(() =>
      expect(resetMock).toHaveBeenCalledWith("u2", { temporaryPassword: undefined }),
    );
    const toast = await screen.findByText(
      "Password reset. The user has been signed out of all devices. Share the temporary password with them directly.",
    );
    expect(toast).toBeInTheDocument();
    // The password is never rendered anywhere — success copy carries no secret.
    expect(screen.queryByText(/^[A-Za-z0-9]{10,}$/)).not.toBeInTheDocument();
  });

  it("accepts an Admin-typed temporary password and sends it, but never redisplays it", async () => {
    resetMock.mockResolvedValue(undefined);
    renderNode(<UserResetPasswordDialog user={PM_ROW} onClose={jest.fn()} />);
    await screen.findByTestId("user-reset-dialog");
    await userEvent.type(screen.getByLabelText(/temporary password/i), "AdminChosen123");
    await userEvent.click(screen.getByTestId("user-reset-confirm"));
    await waitFor(() =>
      expect(resetMock).toHaveBeenCalledWith("u2", { temporaryPassword: "AdminChosen123" }),
    );
  });

  it("rejects a too-short typed password inline without calling the API", async () => {
    renderNode(<UserResetPasswordDialog user={PM_ROW} onClose={jest.fn()} />);
    await screen.findByTestId("user-reset-dialog");
    await userEvent.type(screen.getByLabelText(/temporary password/i), "short");
    await userEvent.click(screen.getByTestId("user-reset-confirm"));
    expect(await screen.findByTestId("reset-password-error")).toHaveTextContent(
      "Password must be at least 10 characters.",
    );
    expect(resetMock).not.toHaveBeenCalled();
  });
});

// ── Detail panel / NOT_FOUND ─────────────────────────────────────────────────
describe("UsersScreen — row click opens detail; company-scoped NOT_FOUND (FR-AUD-027, spec §13)", () => {
  it("opens the detail panel from a row click and shows the assigned projects", async () => {
    listMock.mockResolvedValue(page(PM_ROW));
    getMock.mockResolvedValue(PM_DETAIL);
    renderScreen();
    const row = await screen.findByTestId("user-row-u2");
    await userEvent.click(row);
    const panel = await screen.findByTestId("user-detail-panel");
    expect(within(panel).getByText("Bridge-04 — Buriganga")).toBeInTheDocument();
  });

  it("a stale detail shows 'This user no longer exists.' on NOT_FOUND", async () => {
    listMock.mockResolvedValue(page(PM_ROW));
    getMock.mockRejectedValue(
      new ApiError({ code: "NOT_FOUND", message: "gone", details: null, status: 404 }),
    );
    renderScreen();
    const row = await screen.findByTestId("user-row-u2");
    await userEvent.click(row);
    expect(await screen.findByText("This user no longer exists.")).toBeInTheDocument();
  });
});
