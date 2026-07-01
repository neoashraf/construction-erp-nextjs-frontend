/**
 * FE-5 financial-year manager tests (FR-MAS-002, FR-MAS-003).
 * Covers the state matrix, role show/hide, form validation + server error mapping,
 * and the set-active confirm. The full ⋯-menu → create → set-active flow is exercised
 * end-to-end in Playwright (test/e2e/financial-years.spec.ts).
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
import { type FinancialYear } from "@/features/master-data/types";
import { FinancialYearsScreen } from "@/features/master-data/components/FinancialYearsScreen";
import { FinancialYearFormModal } from "@/features/master-data/components/FinancialYearFormModal";
import { SetActiveDialog } from "@/features/master-data/components/SetActiveDialog";
import * as api from "@/features/master-data/api/financial-years";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/features/master-data/api/financial-years", () => ({
  listFinancialYears: jest.fn(),
  createFinancialYear: jest.fn(),
  updateFinancialYear: jest.fn(),
  setActiveFinancialYear: jest.fn(),
}));

const listMock = api.listFinancialYears as jest.Mock;
const createMock = api.createFinancialYear as jest.Mock;
const updateMock = api.updateFinancialYear as jest.Mock;
const setActiveMock = api.setActiveFinancialYear as jest.Mock;

// ── Fixtures ─────────────────────────────────────────────────────────────────
const YEARS: FinancialYear[] = [
  {
    id: "fy1",
    label: "2024-25",
    startDate: "2024-07-01",
    endDate: "2025-06-30",
    isActive: false,
    version: 1,
  },
  {
    id: "fy2",
    label: "2025-26",
    startDate: "2025-07-01",
    endDate: "2026-06-30",
    isActive: true,
    version: 3,
  },
  {
    id: "fy3",
    label: "2026-27",
    startDate: "2026-07-01",
    endDate: "2027-06-30",
    isActive: false,
    version: 1,
  },
];
// Individually-typed handles (avoids `| undefined` from noUncheckedIndexedAccess at prop sites).
const [FY_INACTIVE, FY_ACTIVE, FY_OTHER] = YEARS as [FinancialYear, FinancialYear, FinancialYear];

function user(role: Role): SafeUser {
  return {
    id: "u1",
    email: "x@ze.test",
    name: "X",
    role,
    companyId: "c1",
    financialYearId: "fy2",
    isActive: true,
  };
}

function renderScreen(role: Role = "ADMIN") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <ToastProvider>
          <FinancialYearsScreen />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

function renderWithClient(ui: React.ReactElement) {
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
  updateMock.mockReset();
  setActiveMock.mockReset();
});

// ── State matrix ─────────────────────────────────────────────────────────────
describe("FinancialYearsScreen — state matrix", () => {
  it("shows the loading skeleton first (spec §6)", () => {
    listMock.mockReturnValue(new Promise(() => {})); // never resolves
    renderScreen();
    expect(screen.getByTestId("fy-loading")).toBeInTheDocument();
  });

  it("renders the empty state + CTA when there are no years (FR-MAS-002)", async () => {
    listMock.mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByText("No financial years yet.")).toBeInTheDocument();
    expect(screen.getByTestId("empty-new-fy")).toBeInTheDocument();
  });

  it("renders the error state + Retry, and retries on click (spec §6)", async () => {
    listMock.mockRejectedValueOnce(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    listMock.mockResolvedValueOnce(YEARS);
    renderScreen();
    expect(await screen.findByText("Couldn't load financial years.")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("fy-retry"));
    expect(await screen.findByTestId("fy-desktop")).toBeInTheDocument();
  });

  it("lists the FR fields and badges exactly one active row (FR-MAS-002/003)", async () => {
    listMock.mockResolvedValue(YEARS);
    renderScreen();
    const table = await screen.findByTestId("fy-desktop");
    expect(within(table).getByText("2025-26")).toBeInTheDocument();
    // Dates rendered DD/MM/YYYY.
    expect(within(table).getByText("01/07/2025")).toBeInTheDocument();
    // Exactly one "Active financial year" badge in the table.
    expect(within(table).getAllByLabelText("Active financial year")).toHaveLength(1);
  });
});

// ── Role-based visibility ───────────────────────────────────────────────────
describe("FinancialYearsScreen — role visibility", () => {
  it("Admin sees New + row actions (FR-MAS-003)", async () => {
    listMock.mockResolvedValue(YEARS);
    renderScreen("ADMIN");
    const table = await screen.findByTestId("fy-desktop");
    expect(screen.getByTestId("new-fy")).toBeInTheDocument();
    expect(within(table).getByTestId("fy-actions-fy1")).toBeInTheDocument();
  });

  it("a non-Admin role gets a read-only table (no New, no row actions)", async () => {
    listMock.mockResolvedValue(YEARS);
    renderScreen("ACCOUNTS_TEAM");
    const table = await screen.findByTestId("fy-desktop");
    expect(screen.queryByTestId("new-fy")).not.toBeInTheDocument();
    expect(within(table).queryByTestId("fy-actions-fy1")).not.toBeInTheDocument();
  });
});

// ── Filter ──────────────────────────────────────────────────────────────────
describe("FinancialYearsScreen — active/all filter", () => {
  it("re-queries with isActive when switching to Active", async () => {
    listMock.mockResolvedValue(YEARS);
    renderScreen();
    await screen.findByTestId("fy-desktop");
    await userEvent.click(screen.getByRole("button", { name: "active" }));
    await waitFor(() => expect(listMock).toHaveBeenCalledWith({ isActive: true }));
  });
});

// ── Form validation + error mapping ─────────────────────────────────────────
describe("FinancialYearFormModal — validation + error mapping", () => {
  const noop = () => {};

  it("blocks save with inline messages when fields are empty/invalid (spec §7)", async () => {
    renderWithClient(
      <FinancialYearFormModal
        mode={{ kind: "create" }}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.click(screen.getByTestId("fy-save"));
    expect(await screen.findByText("Label is required.")).toBeInTheDocument();
    expect(screen.getByText("Start date is required.")).toBeInTheDocument();
    expect(screen.getByText("End date is required.")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects end <= start with the date-order message; overlap is allowed (FR-MAS-002)", async () => {
    renderWithClient(
      <FinancialYearFormModal
        mode={{ kind: "create" }}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/label/i), "2026-27");
    await userEvent.type(screen.getByLabelText(/start date/i), "01/07/2026");
    await userEvent.type(screen.getByLabelText(/end date/i), "30/06/2026");
    await userEvent.click(screen.getByTestId("fy-save"));
    expect(await screen.findByText("End date must be after the start date.")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();

    // The informational overlap note is present (never an error).
    expect(screen.getByText(/Financial years may overlap/i)).toBeInTheDocument();
  });

  it("posts a valid create and reports success (FR-MAS-002)", async () => {
    createMock.mockResolvedValue({ id: "new" });
    const onSuccess = jest.fn();
    renderWithClient(
      <FinancialYearFormModal
        mode={{ kind: "create" }}
        onClose={noop}
        onSuccess={onSuccess}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/label/i), "2027-28");
    await userEvent.type(screen.getByLabelText(/start date/i), "01/07/2027");
    await userEvent.type(screen.getByLabelText(/end date/i), "30/06/2028");
    await userEvent.click(screen.getByTestId("fy-save"));
    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        label: "2027-28",
        startDate: "2027-07-01",
        endDate: "2028-06-30",
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith("Financial year created.");
  });

  it("edit sends the row version and maps VALIDATION_ERROR details to the field (FR-MAS-032)", async () => {
    updateMock.mockRejectedValue(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "bad",
        details: { endDate: ["End date must be after the start date."] },
        status: 400,
      }),
    );
    renderWithClient(
      <FinancialYearFormModal
        mode={{ kind: "edit", fy: FY_ACTIVE }}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    // Prefilled from the row (dates shown DD/MM/YYYY).
    expect(screen.getByLabelText(/start date/i)).toHaveValue("01/07/2025");
    await userEvent.click(screen.getByTestId("fy-save"));
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        "fy2",
        expect.objectContaining({ version: 3, startDate: "2025-07-01" }),
      ),
    );
    expect(await screen.findByTestId("end-error")).toHaveTextContent(
      "End date must be after the start date.",
    );
  });

  it("maps OPTIMISTIC_LOCK_CONFLICT to the conflict handler (spec §13)", async () => {
    updateMock.mockRejectedValue(
      new ApiError({
        code: "OPTIMISTIC_LOCK_CONFLICT",
        message: "stale",
        details: null,
        status: 409,
      }),
    );
    const onConflict = jest.fn();
    renderWithClient(
      <FinancialYearFormModal
        mode={{ kind: "edit", fy: FY_INACTIVE }}
        onClose={noop}
        onSuccess={noop}
        onConflict={onConflict}
        onError={noop}
      />,
    );
    await userEvent.click(screen.getByTestId("fy-save"));
    await waitFor(() => expect(onConflict).toHaveBeenCalled());
  });
});

// ── Set-active dialog ───────────────────────────────────────────────────────
describe("SetActiveDialog — confirm (FR-MAS-003)", () => {
  it("calls set-active with the id and reports success", async () => {
    setActiveMock.mockResolvedValue({ ...YEARS[2], isActive: true });
    const onSuccess = jest.fn();
    renderWithClient(
      <SetActiveDialog
        fy={FY_OTHER}
        onClose={jest.fn()}
        onSuccess={onSuccess}
        onError={jest.fn()}
      />,
    );
    const dialog = await screen.findByTestId("set-active-dialog");
    await userEvent.click(within(dialog).getByTestId("set-active-confirm"));
    await waitFor(() => expect(setActiveMock).toHaveBeenCalledWith("fy3"));
    expect(onSuccess).toHaveBeenCalledWith("2026-27");
  });

  it("maps NOT_FOUND to the refresh-list message (spec §13)", async () => {
    setActiveMock.mockRejectedValue(
      new ApiError({ code: "NOT_FOUND", message: "gone", details: null, status: 404 }),
    );
    const onError = jest.fn();
    renderWithClient(
      <SetActiveDialog
        fy={FY_INACTIVE}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
        onError={onError}
      />,
    );
    const dialog = await screen.findByTestId("set-active-dialog");
    await userEvent.click(within(dialog).getByTestId("set-active-confirm"));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "This financial year no longer exists. Refresh the list.",
      ),
    );
  });
});
