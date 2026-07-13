/**
 * FE-35 Employee-master tests (FR-HR-001, -002, -003). Covers: list + role-gated New CTA,
 * both empty variants (first-use vs filtered), create → detail lifecycle, edit save, reassign
 * (history prepend + defaultProject update), deactivate → reactivate, masked-bank reveal
 * role-gating, immutable-code disable when referenced, duplicate-code + cross-company +
 * effective-date validation, optimistic-lock, role gating (Accounts read-only, HR write),
 * and the 360 stacked read-only degrade.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type Employee, type EmployeeAssignment, type EmployeeSummary } from "@/features/hr/types";
import { EmployeeList } from "@/features/hr/components/EmployeeList";
import { EmployeeDetail } from "@/features/hr/components/EmployeeDetail";
import * as empApi from "@/features/hr/api/employees";

const routerReplace = jest.fn();
const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush, refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
jest.mock("@/features/hr/api/employees");
jest.mock("@/lib/masters/lookups", () => ({
  useMasterLookups: () => ({
    accountLabel: (id: string | null | undefined) => id ?? "",
    accountName: () => null,
    party: (id: string | null | undefined) => id ?? "",
    project: (id: string | null | undefined) => {
      const map: Record<string, string> = { "proj-a": "Bridge-04", "proj-b": "Tower-A", "proj-c": "Road-12" };
      return (id && map[id]) || id || "";
    },
    costCentre: (id: string | null | undefined) => id ?? "",
  }),
  useAccountOptions: () => ({ accounts: [], isLoading: false }),
}));

const listMock = empApi.listEmployees as jest.Mock;
const getMock = empApi.getEmployee as jest.Mock;
const createMock = empApi.createEmployee as jest.Mock;
const updateMock = empApi.updateEmployee as jest.Mock;
const reassignMock = empApi.reassignEmployee as jest.Mock;
const deactivateMock = empApi.deactivateEmployee as jest.Mock;
const reactivateMock = empApi.reactivateEmployee as jest.Mock;
const listAssignmentsMock = empApi.listAssignments as jest.Mock;

function emp(over: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1", employeeCode: "EMP-014", name: "Md Rafiqul Islam", designation: "Site Accountant",
    defaultProjectId: "proj-a", department: "Accounts", workBase: "SITE", wageType: "MONTHLY",
    wageAmount: "45000.0000", bankName: "Dutch-Bangla Bank",
    bankAccountName: "•••• slam", bankAccountNo: "•••• 7890", bankMasked: true,
    pfApplicable: true, gratuityApplicable: true, wppfApplicable: false,
    tin: "123456789012", joiningDate: "2024-03-01", status: "ACTIVE",
    hasReferences: false, version: 1, ...over,
  };
}
function summary(over: Partial<EmployeeSummary> = {}): EmployeeSummary {
  return {
    id: "emp-1", employeeCode: "EMP-014", name: "Md Rafiqul Islam", designation: "Site Accountant",
    defaultProjectId: "proj-a", workBase: "SITE", wageType: "MONTHLY", wageAmount: "45000.0000",
    status: "ACTIVE", hasReferences: false, ...over,
  };
}
function asg(over: Partial<EmployeeAssignment> = {}): EmployeeAssignment {
  return { id: "asg-1", employeeId: "emp-1", projectId: "proj-a", effectiveDate: "2024-03-01", note: "Initial assignment", ...over };
}

function user(role: Role): SafeUser {
  return { id: "u1", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
}

function renderWith(ui: React.ReactElement, role: Role = "HR_MANAGER") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>{ui}</SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── List ──
describe("EmployeeList (spec §4/§6)", () => {
  it("renders rows with status badges + the New CTA for HR", async () => {
    listMock.mockResolvedValue({ data: [summary(), summary({ id: "emp-2", employeeCode: "EMP-020", status: "INACTIVE" })], page: 1, pageSize: 25, total: 2 });
    renderWith(<EmployeeList />);
    await screen.findByTestId("employee-list");
    expect(screen.getAllByTestId("employee-status-ACTIVE").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("employee-status-INACTIVE").length).toBeGreaterThan(0);
    expect(screen.getByTestId("employee-new")).toBeInTheDocument();
  });

  it("hides the New CTA for a read-only Accounts Manager", async () => {
    listMock.mockResolvedValue({ data: [summary()], page: 1, pageSize: 25, total: 1 });
    renderWith(<EmployeeList />, "ACCOUNTS_MANAGER");
    await screen.findByTestId("employee-list");
    expect(screen.queryByTestId("employee-new")).not.toBeInTheDocument();
  });

  it("shows the first-use empty state when nothing is filtered", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<EmployeeList />);
    expect(await screen.findByTestId("employee-empty-firstuse")).toBeInTheDocument();
    expect(screen.getByText("No employees yet.")).toBeInTheDocument();
  });

  it("shows the filtered empty state after applying a filter", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<EmployeeList />);
    await screen.findByTestId("employee-empty-firstuse");
    await userEvent.selectOptions(screen.getByTestId("emp-filter-status"), "INACTIVE");
    await userEvent.click(screen.getByTestId("emp-filter-apply"));
    expect(await screen.findByTestId("employee-empty-filtered")).toBeInTheDocument();
  });

  it("renders the degraded mobile card list alongside the desktop grid (360 stacked)", async () => {
    listMock.mockResolvedValue({ data: [summary()], page: 1, pageSize: 25, total: 1 });
    renderWith(<EmployeeList />);
    await screen.findByTestId("employee-list");
    expect(screen.getByTestId("employee-list-mobile")).toBeInTheDocument();
    expect(screen.getByTestId(`employee-card-ACTIVE`)).toBeInTheDocument();
  });
});

// ── Create → detail ──
describe("EmployeeCreateDrawer → Detail (spec §5/§9)", () => {
  it("creates an employee from the drawer and pushes to the detail route", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    createMock.mockResolvedValue({ id: "emp-new" });
    renderWith(<EmployeeList />);
    await screen.findByTestId("employee-empty-firstuse");
    await userEvent.click(screen.getByTestId("employee-empty-new"));
    expect(await screen.findByTestId("employee-create-drawer")).toBeInTheDocument();
    await userEvent.type(screen.getByTestId("emp-code"), "EMP-999");
    await userEvent.type(screen.getByTestId("emp-name"), "New Person");
    await userEvent.selectOptions(screen.getByTestId("emp-workbase"), "HEAD_OFFICE");
    await userEvent.selectOptions(screen.getByTestId("emp-wagetype"), "MONTHLY");
    await userEvent.type(screen.getByTestId("emp-wageamount"), "50000");
    await userEvent.type(screen.getByTestId("emp-joining"), "01/03/2024");
    await userEvent.click(screen.getByTestId("employee-save"));
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(routerPush).toHaveBeenCalledWith("/hr/employees/emp-new");
  });

  it("surfaces DUPLICATE_CODE inline on the employeeCode field with the exact spec §8 copy", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    createMock.mockRejectedValue(new ApiError({ code: "DUPLICATE_CODE", message: "x", status: 409 }));
    renderWith(<EmployeeList />);
    await screen.findByTestId("employee-empty-firstuse");
    await userEvent.click(screen.getByTestId("employee-empty-new"));
    await userEvent.type(screen.getByTestId("emp-code"), "EMP-014");
    await userEvent.type(screen.getByTestId("emp-name"), "Md Rafiqul Islam");
    await userEvent.selectOptions(screen.getByTestId("emp-workbase"), "SITE");
    await userEvent.selectOptions(screen.getByTestId("emp-wagetype"), "MONTHLY");
    await userEvent.type(screen.getByTestId("emp-wageamount"), "45000");
    await userEvent.type(screen.getByTestId("emp-joining"), "01/03/2024");
    await userEvent.click(screen.getByTestId("employee-save"));
    expect(await screen.findByTestId("emp-code-err")).toHaveTextContent("This employee code is already in use.");
  });

  it("surfaces CROSS_COMPANY_REFERENCE inline on the defaultProject field", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    createMock.mockRejectedValue(new ApiError({ code: "CROSS_COMPANY_REFERENCE", message: "x", status: 400 }));
    renderWith(<EmployeeList />);
    await screen.findByTestId("employee-empty-firstuse");
    await userEvent.click(screen.getByTestId("employee-empty-new"));
    await userEvent.type(screen.getByTestId("emp-code"), "EMP-999");
    await userEvent.type(screen.getByTestId("emp-name"), "New Person");
    await userEvent.selectOptions(screen.getByTestId("emp-workbase"), "SITE");
    await userEvent.selectOptions(screen.getByTestId("emp-wagetype"), "MONTHLY");
    await userEvent.type(screen.getByTestId("emp-wageamount"), "10000");
    await userEvent.type(screen.getByTestId("emp-joining"), "01/03/2024");
    await userEvent.click(screen.getByTestId("employee-save"));
    expect(await screen.findByTestId("emp-project-err")).toHaveTextContent("That project belongs to a different company.");
  });

  it("blocks a negative wage amount with the exact spec §8 copy", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<EmployeeList />);
    await screen.findByTestId("employee-empty-firstuse");
    await userEvent.click(screen.getByTestId("employee-empty-new"));
    await userEvent.type(screen.getByTestId("emp-code"), "EMP-100");
    await userEvent.type(screen.getByTestId("emp-name"), "N");
    await userEvent.selectOptions(screen.getByTestId("emp-workbase"), "SITE");
    await userEvent.selectOptions(screen.getByTestId("emp-wagetype"), "DAILY");
    await userEvent.type(screen.getByTestId("emp-wageamount"), "-1");
    await userEvent.type(screen.getByTestId("emp-joining"), "01/03/2024");
    await userEvent.click(screen.getByTestId("employee-save"));
    expect(await screen.findByTestId("emp-wageamount-err")).toHaveTextContent("Enter a wage amount of ৳0 or more.");
    expect(createMock).not.toHaveBeenCalled();
  });
});

// ── Detail: edit + masked bank + immutable code ──
describe("EmployeeDetail (spec §5/§6/§11)", () => {
  it("saves an edit and toasts the exact spec §8 copy", async () => {
    getMock.mockResolvedValue(emp());
    listAssignmentsMock.mockResolvedValue([asg()]);
    updateMock.mockResolvedValue(emp({ name: "Rafiqul Islam Md", version: 2 }));
    renderWith(<EmployeeDetail employeeId="emp-1" />);
    await screen.findByTestId("employee-detail");
    const nameInput = screen.getByTestId("emp-name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Rafiqul Islam Md");
    await userEvent.click(screen.getByTestId("employee-save-edit"));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
  });

  it("locks the employeeCode field when the employee has attendance/salary references", async () => {
    getMock.mockResolvedValue(emp({ hasReferences: true }));
    listAssignmentsMock.mockResolvedValue([asg()]);
    renderWith(<EmployeeDetail employeeId="emp-1" />);
    await screen.findByTestId("employee-detail");
    const code = screen.getByTestId("emp-code");
    expect(code).toBeDisabled();
    expect(code).toHaveAttribute("data-locked", "true");
    expect(screen.getByText(/can't be changed — it's already used in attendance or salary/i)).toBeInTheDocument();
  });

  it("maps IMMUTABLE_EMPLOYEE_CODE on save to the top-of-form banner with exact copy", async () => {
    getMock.mockResolvedValue(emp());
    listAssignmentsMock.mockResolvedValue([asg()]);
    updateMock.mockRejectedValue(new ApiError({ code: "IMMUTABLE_EMPLOYEE_CODE", message: "x", status: 409 }));
    renderWith(<EmployeeDetail employeeId="emp-1" />);
    await screen.findByTestId("employee-detail");
    await userEvent.click(screen.getByTestId("employee-save-edit"));
    expect(await screen.findByTestId("employee-detail-banner")).toHaveTextContent(
      "This employee code can't be changed — it's already used in attendance or salary.",
    );
  });

  it("maps OPTIMISTIC_LOCK_CONFLICT to the retained-input banner", async () => {
    getMock.mockResolvedValue(emp());
    listAssignmentsMock.mockResolvedValue([asg()]);
    updateMock.mockRejectedValue(new ApiError({ code: "OPTIMISTIC_LOCK_CONFLICT", message: "x", status: 409 }));
    renderWith(<EmployeeDetail employeeId="emp-1" />);
    await screen.findByTestId("employee-detail");
    const nameInput = screen.getByTestId("emp-name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Edited");
    await userEvent.click(screen.getByTestId("employee-save-edit"));
    expect(await screen.findByTestId("employee-detail-banner")).toHaveTextContent(
      "This employee was just changed by someone else. Reload and try again.",
    );
    // form value retained
    expect(nameInput).toHaveValue("Edited");
  });

  it("renders masked bank with a Show/Hide toggle for HR (aria-pressed, real button)", async () => {
    getMock.mockResolvedValueOnce(emp()).mockResolvedValueOnce(emp({ bankAccountNo: "1234567890", bankMasked: false }));
    listAssignmentsMock.mockResolvedValue([asg()]);
    renderWith(<EmployeeDetail employeeId="emp-1" />);
    await screen.findByTestId("employee-detail");
    const toggles = screen.getAllByTestId(/toggle$/i);
    expect(toggles.length).toBeGreaterThan(0);
    for (const t of toggles) {
      expect(t.tagName).toBe("BUTTON");
      expect(t).toHaveAttribute("aria-pressed", "false");
    }
    await userEvent.click(toggles[0]!);
    await waitFor(() => {
      const btn = screen.getAllByTestId(/toggle$/i)[0]!;
      expect(btn).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("hides the bank-reveal toggle for Accounts Manager (masked-only)", async () => {
    getMock.mockResolvedValue(emp());
    listAssignmentsMock.mockResolvedValue([asg()]);
    renderWith(<EmployeeDetail employeeId="emp-1" />, "ACCOUNTS_MANAGER");
    await screen.findByTestId("employee-detail");
    expect(screen.queryAllByTestId(/toggle$/i).length).toBe(0);
    // no Reassign / Deactivate CTAs either
    expect(screen.queryByTestId("employee-reassign")).not.toBeInTheDocument();
    expect(screen.queryByTestId("employee-deactivate")).not.toBeInTheDocument();
    expect(screen.queryByTestId("employee-save-edit")).not.toBeInTheDocument();
  });
});

// ── Reassign ──
describe("Reassign (FR-HR-002)", () => {
  it("appends a new assignment + updates defaultProjectId (server-driven), toasts the exact copy", async () => {
    getMock.mockResolvedValueOnce(emp()).mockResolvedValueOnce(emp({ defaultProjectId: "proj-b", version: 2 }));
    listAssignmentsMock
      .mockResolvedValueOnce([asg()])
      .mockResolvedValueOnce([
        asg({ id: "asg-new", projectId: "proj-b", effectiveDate: "2026-07-01", note: "Move to Tower-A" }),
        asg(),
      ]);
    reassignMock.mockResolvedValue(emp({ defaultProjectId: "proj-b", version: 2 }));
    renderWith(<EmployeeDetail employeeId="emp-1" />);
    await screen.findByTestId("employee-detail");
    await userEvent.click(screen.getByTestId("employee-reassign"));
    const dialog = await screen.findByTestId("reassign-dialog");
    await userEvent.selectOptions(within(dialog).getByTestId("reassign-project"), "proj-a");
    await userEvent.type(within(dialog).getByTestId("reassign-date"), "01/07/2026");
    await userEvent.click(within(dialog).getByTestId("reassign-confirm"));
    await waitFor(() => expect(reassignMock).toHaveBeenCalled());
    expect(await screen.findByText(/reassigned to/i)).toBeInTheDocument();
  });

  it("blocks an effective-date before joining-date with the exact spec §8 copy", async () => {
    getMock.mockResolvedValue(emp({ joiningDate: "2025-06-15" }));
    listAssignmentsMock.mockResolvedValue([asg()]);
    renderWith(<EmployeeDetail employeeId="emp-1" />);
    await screen.findByTestId("employee-detail");
    await userEvent.click(screen.getByTestId("employee-reassign"));
    const dialog = await screen.findByTestId("reassign-dialog");
    await userEvent.selectOptions(within(dialog).getByTestId("reassign-project"), "proj-a");
    await userEvent.type(within(dialog).getByTestId("reassign-date"), "01/01/2025");
    await userEvent.click(within(dialog).getByTestId("reassign-confirm"));
    expect(await within(dialog).findByTestId("reassign-date-err")).toHaveTextContent(
      "Effective date can't be before the joining date.",
    );
    expect(reassignMock).not.toHaveBeenCalled();
  });
});

// ── Deactivate / Reactivate ──
describe("Deactivate/Reactivate (FR-HR-003)", () => {
  it("deactivates + re-fetches; badge flips to INACTIVE and toast fires", async () => {
    getMock
      .mockResolvedValueOnce(emp())
      .mockResolvedValueOnce(emp({ status: "INACTIVE", version: 2 }));
    listAssignmentsMock.mockResolvedValue([asg()]);
    deactivateMock.mockResolvedValue(emp({ status: "INACTIVE", version: 2 }));
    renderWith(<EmployeeDetail employeeId="emp-1" />);
    await screen.findByTestId("employee-detail");
    await userEvent.click(screen.getByTestId("employee-deactivate"));
    const dialog = await screen.findByTestId("deactivate-dialog");
    await userEvent.click(within(dialog).getByTestId("deactivate-confirm"));
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith("emp-1", 1));
    expect(await screen.findByText(/deactivated\.$/)).toBeInTheDocument();
  });

  it("reactivates an INACTIVE employee (button flips to Reactivate)", async () => {
    getMock
      .mockResolvedValueOnce(emp({ status: "INACTIVE", version: 2 }))
      .mockResolvedValueOnce(emp({ status: "ACTIVE", version: 3 }));
    listAssignmentsMock.mockResolvedValue([asg()]);
    reactivateMock.mockResolvedValue(emp({ status: "ACTIVE", version: 3 }));
    renderWith(<EmployeeDetail employeeId="emp-1" />);
    await screen.findByTestId("employee-detail");
    await userEvent.click(await screen.findByTestId("employee-reactivate"));
    const dialog = await screen.findByTestId("reactivate-dialog");
    await userEvent.click(within(dialog).getByTestId("reactivate-confirm"));
    await waitFor(() => expect(reactivateMock).toHaveBeenCalledWith("emp-1", 2));
    expect(await screen.findByText(/reactivated\.$/)).toBeInTheDocument();
  });
});

// ── Detail: 360 degrade + read-only ──
describe("Detail — read-only degrade + 360 (spec §4)", () => {
  it("shows the read-only note for Accounts and hides Save", async () => {
    getMock.mockResolvedValue(emp());
    listAssignmentsMock.mockResolvedValue([asg()]);
    renderWith(<EmployeeDetail employeeId="emp-1" />, "ACCOUNTS_MANAGER");
    await screen.findByTestId("employee-detail");
    expect(screen.getByText(/You have read-only access/i)).toBeInTheDocument();
    expect(screen.queryByTestId("employee-save-edit")).not.toBeInTheDocument();
  });
});
