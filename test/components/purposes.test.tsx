/**
 * FE-7 purposes list tests (FR-MAS-011/013/029/033).
 * Project-scoped list state matrix, add/rename + DUPLICATE_NAME mapping,
 * deactivate/reactivate, role show/hide.
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
import { type Project, type Purpose } from "@/features/master-data/types";
import { PurposesScreen } from "@/features/master-data/components/PurposesScreen";
import { PurposeFormModal } from "@/features/master-data/components/PurposeFormModal";
import { PurposeStatusDialog } from "@/features/master-data/components/PurposeStatusDialog";
import * as papi from "@/features/master-data/api/purposes";
import * as projapi from "@/features/master-data/api/projects";

jest.mock("@/features/master-data/api/purposes", () => ({
  listPurposes: jest.fn(),
  createPurpose: jest.fn(),
  renamePurpose: jest.fn(),
  deactivatePurpose: jest.fn(),
  reactivatePurpose: jest.fn(),
}));
jest.mock("@/features/master-data/api/projects", () => ({ listProjects: jest.fn() }));

const listMock = papi.listPurposes as jest.Mock;
const renameMock = papi.renamePurpose as jest.Mock;
const deactivateMock = papi.deactivatePurpose as jest.Mock;
const reactivateMock = papi.reactivatePurpose as jest.Mock;
const projectsMock = projapi.listProjects as jest.Mock;

const PROJECT: Project = {
  id: "proj1",
  projectCode: "P-001",
  name: "Tower A",
  status: "ACTIVE",
  location: null,
  customerId: null,
  projectManagerId: null,
  startDate: "2025-01-01",
  expectedEndDate: "2026-01-01",
  actualEndDate: null,
  isActive: true,
  version: 1,
};
const PURPOSE: Purpose = {
  id: "pp1",
  projectId: "proj1",
  name: "Foundation",
  isActive: true,
  version: 2,
};

function user(role: Role): SafeUser {
  return {
    id: "u1",
    email: "x@ze.test",
    name: "X",
    role,
    companyId: "c1",
    financialYearId: "fy1",
    isActive: true,
  };
}
function pageOf<T>(...xs: T[]) {
  return { data: xs, page: 1, pageSize: 100, total: xs.length };
}
function renderScreen(role: Role = "ADMIN") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <ToastProvider>
          <PurposesScreen />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}
function renderNode(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listMock.mockReset();
  renameMock.mockReset();
  deactivateMock.mockReset();
  reactivateMock.mockReset();
  projectsMock.mockReset();
  projectsMock.mockResolvedValue(pageOf(PROJECT));
});

describe("PurposesScreen — project-scoped list", () => {
  it("auto-selects the first project and lists its purposes (FR-MAS-011)", async () => {
    listMock.mockResolvedValue(pageOf(PURPOSE));
    renderScreen();
    const table = await screen.findByTestId("purposes-desktop");
    expect(within(table).getByText("Foundation")).toBeInTheDocument();
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith("proj1", expect.objectContaining({ isActive: true })),
    );
  });

  it("empty state for a project with no purposes", async () => {
    listMock.mockResolvedValue(pageOf());
    renderScreen();
    expect(await screen.findByText("No purposes for this project yet.")).toBeInTheDocument();
    expect(screen.getByTestId("empty-new-purpose")).toBeInTheDocument();
  });

  it("error shows Retry", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(await screen.findByText("Couldn't load purposes.")).toBeInTheDocument();
    expect(screen.getByTestId("purposes-retry")).toBeInTheDocument();
  });

  it("a voucher-only role (Site Engineer) sees no manage actions", async () => {
    listMock.mockResolvedValue(pageOf(PURPOSE));
    renderScreen("SITE_ENGINEER");
    const table = await screen.findByTestId("purposes-desktop");
    expect(screen.queryByTestId("new-purpose")).not.toBeInTheDocument();
    expect(within(table).queryByTestId("purpose-actions-pp1")).not.toBeInTheDocument();
  });
});

describe("PurposeFormModal + status", () => {
  const noop = () => {};
  it("name required on add", async () => {
    renderNode(
      <PurposeFormModal
        mode={{ kind: "create" }}
        projectId="proj1"
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.click(screen.getByTestId("purpose-save"));
    expect(await screen.findByText("Purpose name is required.")).toBeInTheDocument();
  });

  it("maps DUPLICATE_NAME on rename to the name field (FR-MAS-013)", async () => {
    renameMock.mockRejectedValue(
      new ApiError({ code: "DUPLICATE_NAME", message: "dup", details: null, status: 409 }),
    );
    renderNode(
      <PurposeFormModal
        mode={{ kind: "edit", purpose: PURPOSE }}
        projectId="proj1"
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.click(screen.getByTestId("purpose-save"));
    await waitFor(() =>
      expect(renameMock).toHaveBeenCalledWith(
        "proj1",
        "pp1",
        expect.objectContaining({ version: 2 }),
      ),
    );
    expect(await screen.findByTestId("purpose-name-error")).toHaveTextContent(
      "A purpose with this name already exists for this project.",
    );
  });

  it("deactivate sends version + toasts (FR-MAS-029)", async () => {
    deactivateMock.mockResolvedValue({ ...PURPOSE, isActive: false });
    renderNode(
      <PurposeStatusDialog
        projectId="proj1"
        purpose={PURPOSE}
        mode="deactivate"
        onClose={jest.fn()}
        onReload={jest.fn()}
      />,
    );
    const dialog = await screen.findByTestId("purpose-status-dialog");
    await userEvent.click(within(dialog).getByTestId("purpose-status-confirm"));
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith("proj1", "pp1", 2));
    expect(await screen.findByText("‘Foundation’ deactivated.")).toBeInTheDocument();
  });

  it("reactivate sends version (FR-MAS-033)", async () => {
    reactivateMock.mockResolvedValue({ ...PURPOSE, isActive: true });
    renderNode(
      <PurposeStatusDialog
        projectId="proj1"
        purpose={{ ...PURPOSE, isActive: false }}
        mode="reactivate"
        onClose={jest.fn()}
        onReload={jest.fn()}
      />,
    );
    const dialog = await screen.findByTestId("purpose-status-dialog");
    await userEvent.click(within(dialog).getByTestId("purpose-status-confirm"));
    await waitFor(() => expect(reactivateMock).toHaveBeenCalledWith("proj1", "pp1", 2));
  });
});
