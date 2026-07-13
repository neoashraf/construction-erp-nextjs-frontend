/**
 * FE-29 Requisition entry & list tests (FR-REQ-001…-009/-021/-022). List empties + role-gated
 * New CTA; entry-form validation (≥1 line, >0 qty, required fields), the create-draft → submit
 * lifecycle, cross-project / inactive-item error mapping, the advisory (non-blocking) over-
 * budget badge, read-only past-DRAFT, and role/scope gating.
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
import { type Requisition } from "@/features/requisitions/types";
import { RequisitionListScreen } from "@/features/requisitions/components/RequisitionListScreen";
import { RequisitionEntryForm } from "@/features/requisitions/components/RequisitionEntryForm";
import * as reqApi from "@/features/requisitions/api/requisition";
import * as mastersApi from "@/features/requisitions/api/masters";

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
jest.mock("@/features/requisitions/api/requisition");
jest.mock("@/features/requisitions/api/masters");

const listMock = reqApi.listRequisitions as jest.Mock;
const getMock = reqApi.getRequisition as jest.Mock;
const createMock = reqApi.createRequisition as jest.Mock;
const submitMock = reqApi.submitRequisition as jest.Mock;
const rateMock = reqApi.getIndicativeRate as jest.Mock;
const budgetMock = reqApi.checkBudget as jest.Mock;

const PROJECTS = [{ id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04", status: "ACTIVE" }];
const CCS = [{ id: "cc-mat", code: "CC-01", name: "Materials", isActive: true }];
const PURPOSES = [{ id: "pp-1", name: "Concreting", projectId: "proj-a", isActive: true }];
const GODOWNS = [{ id: "gd-a", code: "G-Site-A", name: "Site A store", projectId: "proj-a", isActive: true }];
const ITEMS = [
  { id: "it-cement", code: "IT-01", name: "Cement — 50kg bag", uom: "bag", isActive: true },
  { id: "it-fuel", code: "IT-05", name: "Diesel", uom: "ltr", isActive: false },
];
const USERS = [{ id: "u-rafiq", name: "Rafiqul Islam" }];

function req(over: Partial<Requisition> = {}): Requisition {
  return {
    id: "req-1", requisitionNo: null, projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1",
    fromGodownId: "gd-a", requiredDate: "2026-07-20", priority: "NORMAL", status: "DRAFT",
    estimatedValue: null, approvalTier: null, submittedAt: null, submittedById: null, closedAt: null, closedReason: null,
    narration: "", version: 1,
    lines: [{ id: "rl-1", lineNo: 1, itemId: "it-cement", requestedQuantity: "100.0000", issuedQuantity: "0.0000", balanceQuantity: "100.0000", indicativeRate: "542.0000", uom: "bag" }],
    ...over,
  };
}

function user(role: Role): SafeUser {
  return { id: "u-rafiq", email: "x@ze.test", name: "X", role, companyId: "c1", financialYearId: "fy-1", isActive: true };
}

function renderWith(ui: React.ReactElement, role: Role = "PROJECT_MANAGER") {
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
  (mastersApi.listProjectOptions as jest.Mock).mockResolvedValue(PROJECTS);
  (mastersApi.listCostCentreOptions as jest.Mock).mockResolvedValue(CCS);
  (mastersApi.listPurposeOptions as jest.Mock).mockResolvedValue(PURPOSES);
  (mastersApi.listGodownOptions as jest.Mock).mockResolvedValue(GODOWNS);
  (mastersApi.listItemOptions as jest.Mock).mockResolvedValue(ITEMS);
  (mastersApi.listUserOptions as jest.Mock).mockResolvedValue(USERS);
  rateMock.mockResolvedValue("542.0000");
  budgetMock.mockResolvedValue("OK");
});

// ── List ──
describe("RequisitionListScreen (spec §4/§6)", () => {
  it("renders requisitions with status + priority badges and the New CTA for a PM", async () => {
    listMock.mockResolvedValue({ data: [req({ id: "r1", requisitionNo: "REQ/2526/0042", status: "SUBMITTED", priority: "HIGH", estimatedValue: "54200.0000", submittedById: "u-rafiq" })], page: 1, pageSize: 25, total: 1 });
    renderWith(<RequisitionListScreen />);
    await screen.findByTestId("req-list");
    expect(screen.getAllByTestId("req-status-SUBMITTED").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("req-priority-HIGH").length).toBeGreaterThan(0);
    expect(screen.getByTestId("req-new")).toBeInTheDocument();
  });

  it("hides the New CTA for a read-only actor (Accounts)", async () => {
    listMock.mockResolvedValue({ data: [req()], page: 1, pageSize: 25, total: 1 });
    renderWith(<RequisitionListScreen />, "ACCOUNTS_TEAM");
    await screen.findByTestId("req-list");
    expect(screen.queryByTestId("req-new")).not.toBeInTheDocument();
  });

  it("shows the first-use empty state when nothing is filtered", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<RequisitionListScreen />);
    expect(await screen.findByTestId("req-empty-firstuse")).toBeInTheDocument();
    expect(screen.getByText("You haven't raised any requisitions yet.")).toBeInTheDocument();
  });

  it("shows the filtered empty state after applying a filter", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<RequisitionListScreen />);
    await userEvent.selectOptions(await screen.findByTestId("req-f-status"), "APPROVED");
    await userEvent.click(screen.getByTestId("req-f-apply"));
    expect(await screen.findByTestId("req-empty-filtered")).toBeInTheDocument();
  });
});

// ── Entry form ──
describe("RequisitionEntryForm (spec §4/§6/§7)", () => {
  async function fillNewDraft() {
    renderWith(<RequisitionEntryForm requisitionId={null} />);
    await screen.findByTestId("req-form-title");
    await userEvent.selectOptions(await screen.findByTestId("req-project"), "proj-a");
    await userEvent.selectOptions(screen.getByTestId("req-cost-centre"), "cc-mat");
    await waitFor(() => expect(screen.getByTestId("req-purpose")).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByTestId("req-purpose"), "pp-1");
    await userEvent.type(screen.getByLabelText(/Required date/i), "20/07/2026");
    await userEvent.selectOptions(screen.getAllByTestId("req-line-item")[0]!, "it-cement");
    await userEvent.type(screen.getAllByTestId("req-line-qty")[0]!, "100");
  }

  it("validates a non-positive quantity with the exact message (FR-REQ-004)", async () => {
    renderWith(<RequisitionEntryForm requisitionId={null} />);
    await screen.findByTestId("req-form-title");
    await userEvent.selectOptions(await screen.findByTestId("req-project"), "proj-a");
    await userEvent.click(screen.getAllByTestId("req-save")[0]!);
    expect(await screen.findByText("Enter a quantity greater than zero.")).toBeInTheDocument();
    expect(screen.getByText("Select a cost centre.")).toBeInTheDocument();
  });

  it("saves a draft and navigates to the saved requisition (FR-REQ-006)", async () => {
    createMock.mockResolvedValue({ id: "req-new" });
    await fillNewDraft();
    await userEvent.click(screen.getAllByTestId("req-save")[0]!);
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/requisitions/req-new"));
  });

  it("submits behind a confirm dialog, then redirects to the list (FR-REQ-006/-007)", async () => {
    createMock.mockResolvedValue({ id: "req-new" });
    submitMock.mockResolvedValue(req({ id: "req-new", status: "SUBMITTED", requisitionNo: "REQ/2526/0043" }));
    await fillNewDraft();
    await userEvent.click(screen.getAllByTestId("req-submit")[0]!);
    expect(await screen.findByTestId("req-submit-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("req-submit-confirm"));
    await waitFor(() => expect(submitMock).toHaveBeenCalledWith("req-new", 1));
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/requisitions"));
  });

  it("maps CROSS_PROJECT_DIMENSION to the inline purpose message (FR-REQ-003)", async () => {
    createMock.mockRejectedValue(new ApiError({ code: "CROSS_PROJECT_DIMENSION", message: "x", status: 400 }));
    await fillNewDraft();
    await userEvent.click(screen.getAllByTestId("req-save")[0]!);
    expect((await screen.findAllByText("This purpose doesn't belong to the selected project.")).length).toBeGreaterThan(0);
  });

  it("maps INACTIVE_MASTER_REFERENCE to the item-inactive banner (FR-REQ-004)", async () => {
    createMock.mockRejectedValue(new ApiError({ code: "INACTIVE_MASTER_REFERENCE", message: "x", status: 400 }));
    await fillNewDraft();
    await userEvent.click(screen.getAllByTestId("req-save")[0]!);
    expect(await screen.findByTestId("req-banner")).toHaveTextContent("This item is inactive.");
  });

  it("shows the over-budget badge but keeps Submit enabled (advisory only, FR-REQ-005)", async () => {
    budgetMock.mockResolvedValue("OVER");
    await fillNewDraft();
    expect((await screen.findAllByTestId("req-budget-OVER")).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("req-submit")[0]!).not.toBeDisabled();
  });

  it("renders a SUBMITTED requisition read-only with the submitted banner (FR-REQ-022)", async () => {
    getMock.mockResolvedValue(req({ id: "req-9", status: "SUBMITTED", requisitionNo: "REQ/2526/0042", estimatedValue: "54200.0000", submittedById: "u-rafiq" }));
    renderWith(<RequisitionEntryForm requisitionId="req-9" />);
    expect(await screen.findByTestId("req-readonly-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("req-save")).not.toBeInTheDocument();
    expect(screen.getByTestId("req-lines-readonly")).toBeInTheDocument();
  });

  it("blocks a read-only actor from the new-requisition form with a 403 (spec §6)", async () => {
    renderWith(<RequisitionEntryForm requisitionId={null} />, "ACCOUNTS_TEAM");
    expect(await screen.findByTestId("req-403")).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to raise a requisition.")).toBeInTheDocument();
  });
});
