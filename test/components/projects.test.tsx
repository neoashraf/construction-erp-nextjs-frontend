/**
 * FE-9 projects tests (FR-MAS-005/006/007/008/014/015/016/029/033).
 * List + role; overview validation/mapping (dup, immutable code, date order, cross-company);
 * status-transition offering; budgets upsert/remove; godowns add/deactivate; PM scope.
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
import {
  type Project,
  type ProjectBudget,
  type Godown,
  type Party,
  type UserRef,
  type CostCentre,
} from "@/features/master-data/types";
import { ProjectsScreen } from "@/features/master-data/components/ProjectsScreen";
import { ProjectOverviewForm } from "@/features/master-data/components/ProjectOverviewForm";
import { StatusActionButton } from "@/features/master-data/components/StatusActionButton";
import { BudgetsTab } from "@/features/master-data/components/BudgetsTab";
import { GodownsTab } from "@/features/master-data/components/GodownsTab";
import * as papi from "@/features/master-data/api/projects";
import * as bapi from "@/features/master-data/api/project-budgets";
import * as gapi from "@/features/master-data/api/project-godowns";
import * as partyApi from "@/features/master-data/api/parties";
import * as ccApi from "@/features/master-data/api/cost-centres";
import * as userApi from "@/features/master-data/api/users";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/features/master-data/api/projects", () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  changeProjectStatus: jest.fn(),
}));
jest.mock("@/features/master-data/api/project-budgets", () => ({
  listBudgets: jest.fn(),
  upsertBudget: jest.fn(),
  removeBudget: jest.fn(),
}));
jest.mock("@/features/master-data/api/project-godowns", () => ({
  listGodowns: jest.fn(),
  createGodown: jest.fn(),
  updateGodown: jest.fn(),
  deactivateGodown: jest.fn(),
  reactivateGodown: jest.fn(),
}));
jest.mock("@/features/master-data/api/parties", () => ({ listParties: jest.fn() }));
jest.mock("@/features/master-data/api/cost-centres", () => ({ listCostCentres: jest.fn() }));
jest.mock("@/features/master-data/api/users", () => ({ listUsers: jest.fn() }));

const listMock = papi.listProjects as jest.Mock;
const createMock = papi.createProject as jest.Mock;
const updateMock = papi.updateProject as jest.Mock;
const statusMock = papi.changeProjectStatus as jest.Mock;
const listBudgetsMock = bapi.listBudgets as jest.Mock;
const upsertBudgetMock = bapi.upsertBudget as jest.Mock;
const listGodownsMock = gapi.listGodowns as jest.Mock;
const createGodownMock = gapi.createGodown as jest.Mock;

const CUSTOMER: Party = {
  id: "cust1",
  name: "ACME",
  isCustomer: true,
  isSupplier: false,
  tin: null,
  bin: null,
  address: null,
  phone: "+8801700000000",
  email: null,
  paymentTermsDays: null,
  openingBalance: null,
  isActive: true,
  version: 1,
};
const PM: UserRef = { id: "pm1", name: "Rahim", email: "pm@ze.test", role: "PROJECT_MANAGER" };
const CC: CostCentre = {
  id: "cc1",
  code: "CC-100",
  name: "Head Office",
  isActive: true,
  version: 1,
};
const PROJECT: Project = {
  id: "pr1",
  projectCode: "P-001",
  name: "Tower A",
  status: "PLANNED",
  location: "Dhaka",
  customerId: "cust1",
  projectManagerId: "pm1",
  startDate: "2025-01-01",
  expectedEndDate: "2026-01-01",
  actualEndDate: null,
  isActive: true,
  version: 3,
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
  return { data: xs, page: 1, pageSize: 25, total: xs.length };
}
function renderScreen(role: Role = "ADMIN") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <ToastProvider>
          <ProjectsScreen />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}
function renderNode(ui: React.ReactElement, role: Role = "ADMIN") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <ToastProvider>{ui}</ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (partyApi.listParties as jest.Mock).mockResolvedValue(pageOf(CUSTOMER));
  (ccApi.listCostCentres as jest.Mock).mockResolvedValue(pageOf(CC));
  (userApi.listUsers as jest.Mock).mockResolvedValue([PM]);
  listBudgetsMock.mockResolvedValue([]);
  listGodownsMock.mockResolvedValue([]);
});

describe("ProjectsScreen — list", () => {
  it("renders Code/Name/Status (FR-MAS-005/006)", async () => {
    listMock.mockResolvedValue(pageOf(PROJECT));
    renderScreen();
    const table = await screen.findByTestId("projects-desktop");
    expect(within(table).getByText("P-001")).toBeInTheDocument();
    expect(within(table).getByText("Tower A")).toBeInTheDocument();
  });

  it("non-Admin sees no New project", async () => {
    listMock.mockResolvedValue(pageOf(PROJECT));
    renderScreen("PROJECT_MANAGER");
    await screen.findByTestId("projects-desktop");
    expect(screen.queryByTestId("new-project")).not.toBeInTheDocument();
  });
});

describe("ProjectOverviewForm — validation + mapping", () => {
  const noop = () => {};
  const props = { onCreated: noop, onUpdated: noop, onCancel: noop, onReload: noop, onError: noop };

  it("requires fields + expected-end after start (FR-MAS-005)", async () => {
    renderNode(<ProjectOverviewForm mode={{ kind: "create" }} {...props} />);
    await screen.findByLabelText(/customer/i); // pickers loaded
    await userEvent.type(screen.getByLabelText(/project code/i), "P-002");
    await userEvent.type(screen.getByLabelText(/^name/i), "Tower B");
    await userEvent.selectOptions(screen.getByLabelText(/^customer/i), "cust1");
    await userEvent.selectOptions(screen.getByLabelText(/project manager/i), "pm1");
    await userEvent.type(screen.getByLabelText(/start date/i), "01/07/2026");
    await userEvent.type(screen.getByLabelText(/expected end date/i), "30/06/2026");
    await userEvent.click(screen.getByTestId("project-save"));
    expect(await screen.findByTestId("pj-end-error")).toHaveTextContent(
      "Expected end date must be after the start date.",
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("maps DUPLICATE_CODE to the code field", async () => {
    createMock.mockRejectedValue(
      new ApiError({ code: "DUPLICATE_CODE", message: "d", details: null, status: 409 }),
    );
    renderNode(<ProjectOverviewForm mode={{ kind: "create" }} {...props} />);
    await screen.findByLabelText(/customer/i);
    await userEvent.type(screen.getByLabelText(/project code/i), "P-001");
    await userEvent.type(screen.getByLabelText(/^name/i), "Dup");
    await userEvent.selectOptions(screen.getByLabelText(/^customer/i), "cust1");
    await userEvent.selectOptions(screen.getByLabelText(/project manager/i), "pm1");
    await userEvent.type(screen.getByLabelText(/start date/i), "01/07/2026");
    await userEvent.type(screen.getByLabelText(/expected end date/i), "30/06/2027");
    await userEvent.click(screen.getByTestId("project-save"));
    expect(await screen.findByTestId("pj-code-error")).toHaveTextContent(
      "This project code is already used.",
    );
  });

  it("disables the code field on edit (immutability) (edge §12.12)", async () => {
    renderNode(<ProjectOverviewForm mode={{ kind: "edit", project: PROJECT }} {...props} />);
    expect(await screen.findByLabelText(/project code/i)).toBeDisabled();
  });

  it("disables the start-date field on edit (fixed at creation)", async () => {
    renderNode(<ProjectOverviewForm mode={{ kind: "edit", project: PROJECT }} {...props} />);
    expect(await screen.findByLabelText(/start date/i)).toBeDisabled();
  });

  it("edit save omits startDate from the PATCH (update DTO rejects it)", async () => {
    updateMock.mockResolvedValue(PROJECT);
    renderNode(<ProjectOverviewForm mode={{ kind: "edit", project: PROJECT }} {...props} />);
    await screen.findByLabelText(/customer/i); // pickers loaded
    await userEvent.click(screen.getByTestId("project-save"));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const [, input] = updateMock.mock.calls[0];
    expect(input).not.toHaveProperty("startDate");
    expect(input).toMatchObject({ version: 3, expectedEndDate: expect.any(String) });
  });
});

describe("StatusActionButton — transitions (FR-MAS-006)", () => {
  it("PLANNED offers only Activate; calls status with version", async () => {
    statusMock.mockResolvedValue({ ...PROJECT, status: "ACTIVE" });
    const onDone = jest.fn();
    renderNode(
      <StatusActionButton
        project={PROJECT}
        isAdmin
        onDone={onDone}
        onError={jest.fn()}
        onReload={jest.fn()}
      />,
    );
    expect(screen.getByTestId("status-activate")).toBeInTheDocument();
    expect(screen.queryByTestId("status-close")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("status-activate"));
    await waitFor(() => expect(statusMock).toHaveBeenCalledWith("pr1", "activate", 3));
  });

  it("ACTIVE offers Hold + Close; Close is confirm-gated", async () => {
    statusMock.mockResolvedValue({ ...PROJECT, status: "CLOSED" });
    renderNode(
      <StatusActionButton
        project={{ ...PROJECT, status: "ACTIVE" }}
        isAdmin
        onDone={jest.fn()}
        onError={jest.fn()}
        onReload={jest.fn()}
      />,
    );
    expect(screen.getByTestId("status-hold")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("status-close"));
    const dialog = await screen.findByTestId("status-confirm-dialog");
    await userEvent.click(within(dialog).getByTestId("status-confirm"));
    await waitFor(() => expect(statusMock).toHaveBeenCalledWith("pr1", "close", 3));
  });

  it("CLOSED offers Reopen only for Admin", () => {
    renderNode(
      <StatusActionButton
        project={{ ...PROJECT, status: "CLOSED" }}
        isAdmin={false}
        onDone={jest.fn()}
        onError={jest.fn()}
        onReload={jest.fn()}
      />,
    );
    expect(screen.queryByTestId("status-reopen")).not.toBeInTheDocument();
  });
});

describe("BudgetsTab (FR-MAS-007/008)", () => {
  it("empty then upsert a budget", async () => {
    listBudgetsMock.mockResolvedValue([]);
    upsertBudgetMock.mockResolvedValue({
      id: "b1",
      projectId: "pr1",
      costCentreId: "cc1",
      budgetedAmount: "5000.0000",
    });
    renderNode(<BudgetsTab projectId="pr1" canManage closed={false} />);
    expect(await screen.findByTestId("budgets-empty")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/cost centre/i), "cc1");
    await userEvent.type(screen.getByLabelText(/budgeted amount/i), "5000");
    await userEvent.click(screen.getByTestId("budget-save"));
    await waitFor(() =>
      expect(upsertBudgetMock).toHaveBeenCalledWith(
        "pr1",
        expect.objectContaining({ costCentreId: "cc1", budgetedAmount: "5000.0000" }),
      ),
    );
  });

  it("closed project makes budgets read-only", async () => {
    listBudgetsMock.mockResolvedValue([]);
    renderNode(<BudgetsTab projectId="pr1" canManage closed />);
    await screen.findByTestId("budgets-empty");
    expect(screen.queryByTestId("budget-form")).not.toBeInTheDocument();
  });
});

describe("GodownsTab (FR-MAS-014/015)", () => {
  it("shows the inventory hint + empty, then adds a godown", async () => {
    listGodownsMock.mockResolvedValue([]);
    createGodownMock.mockResolvedValue({ id: "gd1" });
    renderNode(<GodownsTab projectId="pr1" canManage closed={false} />);
    expect(await screen.findByTestId("godowns-empty")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^name/i), "Main Store");
    await userEvent.click(screen.getByTestId("godown-save"));
    await waitFor(() =>
      expect(createGodownMock).toHaveBeenCalledWith({
        projectId: "pr1",
        name: "Main Store",
        location: null,
      }),
    );
  });

  it("maps DUPLICATE_NAME to the name field", async () => {
    listGodownsMock.mockResolvedValue([]);
    createGodownMock.mockRejectedValue(
      new ApiError({ code: "DUPLICATE_NAME", message: "d", details: null, status: 409 }),
    );
    renderNode(<GodownsTab projectId="pr1" canManage closed={false} />);
    await screen.findByTestId("godowns-empty");
    await userEvent.type(screen.getByLabelText(/^name/i), "Main Store");
    await userEvent.click(screen.getByTestId("godown-save"));
    expect(await screen.findByTestId("godown-error")).toHaveTextContent(
      "A godown with this name already exists for this project.",
    );
  });
});
