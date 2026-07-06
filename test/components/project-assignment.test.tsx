/**
 * FE-19 project-assignment component tests (FR-AUD-014/015/020). Covers the
 * state matrix (loading/empty/error/all-projects/403), replace-set save (batched
 * add/remove -> ONE PUT), remove-last confirm dialog, server-error mapping
 * (VALIDATION_ERROR/ROLE_SCOPE_CONFLICT/NOT_FOUND/NETWORK_ERROR), Bangla no-clip,
 * responsive reflow markup, and a11y (labelled Remove, combobox announce, banner
 * role=alert).
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
import { type UserDetail, type ProjectOption, type AssignedProject } from "@/features/audit/types";
import { ProjectAssignmentScreen } from "@/features/audit/components/ProjectAssignmentScreen";
import * as usersApi from "@/features/audit/api/users";
import * as userProjectsApi from "@/features/audit/api/user-projects";
import * as projectOptionsApi from "@/features/audit/api/project-options";

jest.mock("@/features/audit/api/users", () => ({
  getUser: jest.fn(),
}));
jest.mock("@/features/audit/api/user-projects", () => ({
  getAssignedProjects: jest.fn(),
  replaceAssignedProjects: jest.fn(),
}));
jest.mock("@/features/audit/api/project-options", () => ({
  listProjectOptions: jest.fn(),
}));

const getUserMock = usersApi.getUser as jest.Mock;
const getAssignedMock = userProjectsApi.getAssignedProjects as jest.Mock;
const replaceMock = userProjectsApi.replaceAssignedProjects as jest.Mock;
const listOptionsMock = projectOptionsApi.listProjectOptions as jest.Mock;

const PM_DETAIL: UserDetail = {
  id: "u2",
  email: "m.hasan@zakirent.com",
  name: "Mohammad Hasan",
  role: "PROJECT_MANAGER",
  roleId: "role-pm",
  roleIsSystem: true,
  roleIsUnscoped: false,
  financialYearId: "fy1",
  isActive: true,
  lastLoginAt: null,
  mustChangePassword: false,
  phone: null,
  assignedProjects: [],
  version: 1,
};

const ADMIN_DETAIL: UserDetail = {
  ...PM_DETAIL,
  id: "u1",
  name: "Ashraf Uddin",
  role: "ADMIN",
  roleId: "role-admin",
  roleIsUnscoped: true,
};

const PROJECT_OPTIONS: ProjectOption[] = [
  { id: "p1", name: "Bridge-04 — Buriganga", projectCode: "PRJ-0041" },
  { id: "p2", name: "Tower-A — Gulshan", projectCode: "PRJ-0039" },
  { id: "p3", name: "ফারজানা টাওয়ার — Uttara", projectCode: "PRJ-0022" },
];

function assigned(...projects: AssignedProject[]) {
  return { scope: "ASSIGNED" as const, projects };
}

function sessionUser(role: Role): SafeUser {
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

function renderScreen(userId = "u2", role: Role = "ADMIN") {
  return render(
    <QueryClientProvider client={client()}>
      <SessionProvider user={sessionUser(role)}>
        <ToastProvider>
          <ProjectAssignmentScreen userId={userId} />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getUserMock.mockReset();
  getAssignedMock.mockReset();
  replaceMock.mockReset();
  listOptionsMock.mockReset();
  listOptionsMock.mockResolvedValue(PROJECT_OPTIONS);
});

// ── Admin-only / 403 (spec §6/§11) ──────────────────────────────────────────
describe("ProjectAssignmentScreen — Admin-only (spec §6/§11)", () => {
  it("non-Admin sees the inline 403 view and never calls the API", async () => {
    renderScreen("u2", "PROJECT_MANAGER");
    expect(
      await screen.findByText("You don't have access to project assignment."),
    ).toBeInTheDocument();
    expect(getAssignedMock).not.toHaveBeenCalled();
  });
});

// ── State matrix (spec §6) ───────────────────────────────────────────────────
describe("ProjectAssignmentScreen — state matrix (spec §6)", () => {
  it("shows the loading skeleton first", () => {
    getUserMock.mockReturnValue(new Promise(() => {}));
    getAssignedMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId("screen-loading")).toBeInTheDocument();
  });

  it("loads the assigned list with per-row Remove", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    expect(await screen.findByText("Bridge-04 — Buriganga")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Bridge-04 — Buriganga" })).toBeInTheDocument();
  });

  it("empty scoped user shows the exact empty-state copy (spec §8)", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(assigned());
    renderScreen();
    expect(
      await screen.findByText("No projects assigned. This user can't transact yet."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("empty-add-projects")).toBeInTheDocument();
  });

  it("load error shows 'Couldn't load assigned projects.' with Retry", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(await screen.findByText("Couldn't load assigned projects.")).toBeInTheDocument();
    expect(screen.getByTestId("assigned-list-retry")).toBeInTheDocument();
  });

  it("partial: a missing project name falls back to the id with a refresh hint", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(assigned({ projectId: "p404", projectName: null }));
    renderScreen();
    expect(await screen.findByText("p404")).toBeInTheDocument();
    expect(
      screen.getByText("That project no longer exists in this company."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("refresh-hint-p404")).toBeInTheDocument();
  });

  it("all-projects banner for an unscoped role, editing disabled (spec §5/§6)", async () => {
    getUserMock.mockResolvedValue(ADMIN_DETAIL);
    getAssignedMock.mockResolvedValue({ scope: "ALL" });
    renderScreen("u1");
    const banner = await screen.findByTestId("all-projects-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(
      "This user’s role applies to all projects — no assignment needed.",
    );
    expect(screen.queryByTestId("assigned-projects-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-projects-picker")).not.toBeInTheDocument();
  });

  it("Save is disabled until an edit is made", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");
    expect(screen.getByTestId("cancel-changes")).toBeDisabled();
  });
});

// ── Batched replace-set save (spec §9) ──────────────────────────────────────
describe("ProjectAssignmentScreen — batched replace-set save (FR-AUD-014/015)", () => {
  it("adding a project and saving commits ONE PUT with the full replaced set", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    replaceMock.mockResolvedValue([
      { projectId: "p1", projectName: "Bridge-04 — Buriganga" },
      { projectId: "p2", projectName: "Tower-A — Gulshan" },
    ]);
    renderScreen();
    await screen.findByTestId("assigned-projects-list");

    await userEvent.click(screen.getByTestId("picker-option-p2"));
    await userEvent.click(screen.getByTestId("save-changes"));

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("u2", { projectIds: ["p1", "p2"] }),
    );
    // No version field on the PUT body (SRS §16 — no optimistic lock on this join).
    expect(replaceMock.mock.calls[0][1]).not.toHaveProperty("version");
    expect(await screen.findByText("Project assignments updated.")).toBeInTheDocument();
  });

  it("removing a (non-last) project locally and saving replaces the whole set, not an append", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned(
        { projectId: "p1", projectName: "Bridge-04 — Buriganga" },
        { projectId: "p2", projectName: "Tower-A — Gulshan" },
      ),
    );
    replaceMock.mockResolvedValue([{ projectId: "p2", projectName: "Tower-A — Gulshan" }]);
    renderScreen();
    await screen.findByTestId("assigned-projects-list");

    await userEvent.click(screen.getByRole("button", { name: "Remove Bridge-04 — Buriganga" }));
    await userEvent.click(screen.getByTestId("save-changes"));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("u2", { projectIds: ["p2"] }));
  });

  it("saving with an empty selection is blocked with the exact validation message", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");

    // Removing the only project triggers the remove-last confirm dialog first.
    await userEvent.click(screen.getByRole("button", { name: "Remove Bridge-04 — Buriganga" }));
    await userEvent.click(await screen.findByTestId("remove-last-confirm"));
    await userEvent.click(screen.getByTestId("save-changes"));

    expect(await screen.findByText("Select at least one project.")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("Cancel discards local edits back to the loaded set", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");

    await userEvent.click(screen.getByTestId("picker-option-p2"));
    expect(screen.getByTestId("cancel-changes")).not.toBeDisabled();
    await userEvent.click(screen.getByTestId("cancel-changes"));

    expect(screen.queryByTestId("assigned-row-p2")).not.toBeInTheDocument();
    expect(screen.getByTestId("picker-option-p2")).toHaveAttribute("aria-selected", "false");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

// ── Remove-last confirm (spec §6/§8/§9; SRS §12 edge 14) ────────────────────
describe("ProjectAssignmentScreen — remove-last confirm dialog", () => {
  it("removing the only assigned project opens the confirm dialog with exact copy", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");

    await userEvent.click(screen.getByRole("button", { name: "Remove Bridge-04 — Buriganga" }));
    const dialog = await screen.findByTestId("remove-last-dialog");
    expect(within(dialog).getByText("Remove the last project?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Mohammad Hasan will have no projects and won’t be able to transact until you assign one.",
      ),
    ).toBeInTheDocument();
  });

  it("confirming remove-last empties the pending set locally (saved state then shows the empty warning)", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");

    await userEvent.click(screen.getByRole("button", { name: "Remove Bridge-04 — Buriganga" }));
    await userEvent.click(await screen.findByTestId("remove-last-confirm"));

    expect(screen.getByTestId("assigned-list-empty")).toBeInTheDocument();
  });

  it("Cancel on the confirm dialog keeps the project assigned", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");

    await userEvent.click(screen.getByRole("button", { name: "Remove Bridge-04 — Buriganga" }));
    await userEvent.click(await screen.findByTestId("remove-last-cancel"));

    expect(screen.getByTestId("assigned-row-p1")).toBeInTheDocument();
  });
});

// ── Server-error mapping on save (spec §6/§8/§13) ───────────────────────────
describe("ProjectAssignmentScreen — server-error mapping on save", () => {
  it("ROLE_SCOPE_CONFLICT surfaces the exact unscoped-clash toast", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    replaceMock.mockRejectedValue(
      new ApiError({ code: "ROLE_SCOPE_CONFLICT", message: "clash", details: null, status: 409 }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");
    await userEvent.click(screen.getByTestId("picker-option-p2"));
    await userEvent.click(screen.getByTestId("save-changes"));
    expect(
      await screen.findByText(
        "This role applies to all projects, so individual projects can't be assigned.",
      ),
    ).toBeInTheDocument();
  });

  it("NOT_FOUND removes the offending project id from the selection", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    replaceMock.mockRejectedValue(
      new ApiError({
        code: "NOT_FOUND",
        message: "gone",
        details: { projectId: "p1" },
        status: 404,
      }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");
    await userEvent.click(screen.getByTestId("picker-option-p2"));
    await userEvent.click(screen.getByTestId("save-changes"));
    expect(
      await screen.findByText("That project no longer exists in this company."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("assigned-row-p1")).not.toBeInTheDocument(),
    );
  });

  it("NETWORK_ERROR surfaces the exact offline toast", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    replaceMock.mockRejectedValue(
      new ApiError({ code: "NETWORK_ERROR", message: "down", details: null, status: 0 }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");
    await userEvent.click(screen.getByTestId("picker-option-p2"));
    await userEvent.click(screen.getByTestId("save-changes"));
    expect(
      await screen.findByText("Can't reach the server. Check your connection and try again."),
    ).toBeInTheDocument();
  });
});

// ── Bangla no-clip (spec §12) ────────────────────────────────────────────────
describe("ProjectAssignmentScreen — Bangla localization (spec §12)", () => {
  it("renders a Bangla project name in full (no data clipping) in the assigned list and picker", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p3", projectName: "ফারজানা টাওয়ার — Uttara" }),
    );
    renderScreen();
    const row = await screen.findByTestId("assigned-row-p3");
    expect(within(row).getByText("ফারজানা টাওয়ার — Uttara")).toBeInTheDocument();
    const picker = screen.getByTestId("picker-option-p3");
    expect(within(picker).getByText("ফারজানা টাওয়ার — Uttara")).toBeInTheDocument();
  });
});

// ── Responsive (spec §4) ─────────────────────────────────────────────────────
describe("ProjectAssignmentScreen — responsive reflow (spec §4)", () => {
  it("the two-pane grid collapses to a single column below the lg breakpoint (>=1024 two-pane, else stacked)", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    const list = await screen.findByTestId("assigned-projects-list");
    const grid = list.parentElement as HTMLElement;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("lg:grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)]");
  });

  it("renders both the assigned list and the picker in the same scrollable region at every width (>=360 stacked scrollable)", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    expect(await screen.findByTestId("assigned-projects-list")).toBeInTheDocument();
    expect(screen.getByTestId("add-projects-picker")).toBeInTheDocument();
  });
});

// ── Accessibility (spec §10) ─────────────────────────────────────────────────
describe("ProjectAssignmentScreen — accessibility (spec §10)", () => {
  it("each assigned row has a labelled 'Remove {project}' control", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    expect(
      await screen.findByRole("button", { name: "Remove Bridge-04 — Buriganga" }),
    ).toBeInTheDocument();
  });

  it("the picker is a combobox that announces result and selection counts", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");
    expect(screen.getByTestId("add-projects-picker")).toHaveAttribute("role", "combobox");
    expect(screen.getByTestId("picker-announce")).toHaveTextContent("3 projects found");
    expect(screen.getByTestId("picker-announce")).toHaveTextContent("1 selected");
  });

  it("filtering the picker narrows results and updates the announced count", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");
    await userEvent.type(screen.getByTestId("add-projects-search"), "Gulshan");
    expect(screen.getByTestId("picker-announce")).toHaveTextContent("1 project found");
    expect(screen.queryByTestId("picker-option-p1")).not.toBeInTheDocument();
    expect(screen.getByTestId("picker-option-p2")).toBeInTheDocument();
  });

  it("the remove-last dialog exposes an accessible title/description and closes on cancel (Radix focus-trap; focus-restore verified in a real browser, not jsdom)", async () => {
    getUserMock.mockResolvedValue(PM_DETAIL);
    getAssignedMock.mockResolvedValue(
      assigned({ projectId: "p1", projectName: "Bridge-04 — Buriganga" }),
    );
    renderScreen();
    await screen.findByTestId("assigned-projects-list");
    const removeButton = screen.getByRole("button", { name: "Remove Bridge-04 — Buriganga" });
    await userEvent.click(removeButton);
    const dialog = await screen.findByTestId("remove-last-dialog");
    expect(within(dialog).getByText("Remove the last project?")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("remove-last-cancel"));
    await waitFor(() => expect(screen.queryByTestId("remove-last-dialog")).not.toBeInTheDocument());
  });

  it("the all-projects banner is role=alert", async () => {
    getUserMock.mockResolvedValue(ADMIN_DETAIL);
    getAssignedMock.mockResolvedValue({ scope: "ALL" });
    renderScreen("u1");
    expect(await screen.findByTestId("all-projects-banner")).toHaveAttribute("role", "alert");
  });
});
