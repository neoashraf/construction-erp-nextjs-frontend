/**
 * FE-6 cost-centres tests (FR-MAS-009/010/029/033).
 * State matrix, add/rename + DUPLICATE_CODE mapping, deactivate/reactivate, roles.
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
import { type CostCentre } from "@/features/master-data/types";
import { CostCentresScreen } from "@/features/master-data/components/CostCentresScreen";
import { CostCentreFormModal } from "@/features/master-data/components/CostCentreFormModal";
import { CostCentreStatusDialog } from "@/features/master-data/components/CostCentreStatusDialog";
import * as api from "@/features/master-data/api/cost-centres";

jest.mock("@/features/master-data/api/cost-centres", () => ({
  listCostCentres: jest.fn(),
  createCostCentre: jest.fn(),
  renameCostCentre: jest.fn(),
  deactivateCostCentre: jest.fn(),
  reactivateCostCentre: jest.fn(),
}));

const listMock = api.listCostCentres as jest.Mock;
const createMock = api.createCostCentre as jest.Mock;
const deactivateMock = api.deactivateCostCentre as jest.Mock;
const reactivateMock = api.reactivateCostCentre as jest.Mock;

const CC: CostCentre = {
  id: "cc1",
  code: "CC-100",
  name: "Head Office",
  isActive: true,
  version: 1,
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
function pageOf(...cs: CostCentre[]) {
  return { data: cs, page: 1, pageSize: 100, total: cs.length };
}
function renderScreen(role: Role = "ADMIN") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <ToastProvider>
          <CostCentresScreen />
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
  createMock.mockReset();
  deactivateMock.mockReset();
  reactivateMock.mockReset();
});

describe("CostCentresScreen", () => {
  it("shows loading skeletons first", () => {
    listMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId("cc-loading")).toBeInTheDocument();
  });

  it("renders Code/Name/Status (FR-MAS-009/010)", async () => {
    listMock.mockResolvedValue(pageOf(CC));
    renderScreen();
    const table = await screen.findByTestId("cc-desktop");
    expect(within(table).getByText("CC-100")).toBeInTheDocument();
    expect(within(table).getByText("Head Office")).toBeInTheDocument();
    expect(within(table).getByLabelText("Active cost centre")).toBeInTheDocument();
  });

  it("empty vs filtered-empty (search)", async () => {
    listMock.mockResolvedValue(pageOf());
    renderScreen();
    expect(await screen.findByText("No cost centres found.")).toBeInTheDocument();
    // Filters are draft-until-Apply (design's filter bar), so typing + Apply commits them.
    await userEvent.type(screen.getByLabelText(/search cost centres/i), "zzz");
    await userEvent.click(screen.getByTestId("cc-apply"));
    expect(await screen.findByText("No cost centres match these filters.")).toBeInTheDocument();
    expect(screen.getByTestId("cc-clear")).toBeInTheDocument();
  });

  it("error shows Retry", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(await screen.findByText("Couldn't load cost centres.")).toBeInTheDocument();
    expect(screen.getByTestId("cc-retry")).toBeInTheDocument();
  });

  it("non-Admin read-only (no New, no row actions)", async () => {
    listMock.mockResolvedValue(pageOf(CC));
    renderScreen("ACCOUNTS_TEAM");
    const table = await screen.findByTestId("cc-desktop");
    expect(screen.queryByTestId("new-cost-centre")).not.toBeInTheDocument();
    expect(within(table).queryByTestId("cc-actions-cc1")).not.toBeInTheDocument();
  });
});

describe("CostCentreFormModal", () => {
  const noop = () => {};
  it("code + name required on add", async () => {
    renderNode(
      <CostCentreFormModal
        mode={{ kind: "create" }}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.click(screen.getByTestId("cost-centre-save"));
    expect(await screen.findByText("Code is required.")).toBeInTheDocument();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("maps DUPLICATE_CODE to the code field", async () => {
    createMock.mockRejectedValue(
      new ApiError({ code: "DUPLICATE_CODE", message: "dup", details: null, status: 409 }),
    );
    renderNode(
      <CostCentreFormModal
        mode={{ kind: "create" }}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/code/i), "CC-100");
    await userEvent.type(screen.getByLabelText(/name/i), "Dup");
    await userEvent.click(screen.getByTestId("cost-centre-save"));
    expect(await screen.findByTestId("cc-code-error")).toHaveTextContent(
      "This code is already used.",
    );
  });

  it("creates a cost centre", async () => {
    createMock.mockResolvedValue({ id: "new" });
    const onSuccess = jest.fn();
    renderNode(
      <CostCentreFormModal
        mode={{ kind: "create" }}
        onClose={noop}
        onSuccess={onSuccess}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/code/i), "CC-200");
    await userEvent.type(screen.getByLabelText(/name/i), "Site A");
    await userEvent.click(screen.getByTestId("cost-centre-save"));
    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({ code: "CC-200", name: "Site A" }),
    );
    expect(onSuccess).toHaveBeenCalledWith("Cost centre created.");
  });
});

describe("CostCentreStatusDialog", () => {
  it("deactivate calls the endpoint with version + toasts (FR-MAS-029)", async () => {
    deactivateMock.mockResolvedValue({ ...CC, isActive: false });
    renderNode(
      <CostCentreStatusDialog
        centre={CC}
        mode="deactivate"
        onClose={jest.fn()}
        onReload={jest.fn()}
      />,
    );
    const dialog = await screen.findByTestId("cost-centre-status-dialog");
    await userEvent.click(within(dialog).getByTestId("cost-centre-status-confirm"));
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith("cc1", 1));
    expect(await screen.findByText("‘Head Office’ deactivated.")).toBeInTheDocument();
  });

  it("reactivate calls the endpoint with version (FR-MAS-033)", async () => {
    reactivateMock.mockResolvedValue({ ...CC, isActive: true });
    renderNode(
      <CostCentreStatusDialog
        centre={{ ...CC, isActive: false }}
        mode="reactivate"
        onClose={jest.fn()}
        onReload={jest.fn()}
      />,
    );
    const dialog = await screen.findByTestId("cost-centre-status-dialog");
    await userEvent.click(within(dialog).getByTestId("cost-centre-status-confirm"));
    await waitFor(() => expect(reactivateMock).toHaveBeenCalledWith("cc1", 1));
  });
});
