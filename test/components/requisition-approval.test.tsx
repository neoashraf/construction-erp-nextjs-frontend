/**
 * FE-30 Requisition approval tests (FR-REQ-005…-011). In-tier PM Approve/Reject enabled;
 * escalated ACCOUNTS-tier disabled with the exact note (PM view); empty-reject-reason block;
 * approve/reject success + redirect to the worklist; already-decided race banner; beyond-
 * authority decision-failure banner; partial "(name unavailable)"; role/scope gating (Site
 * Engineer hidden, Store Keeper read-only); and the mobile sticky action bar (≥360).
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type Requisition } from "@/features/requisitions/types";
import { RequisitionApprovalDetail } from "@/features/requisitions/components/RequisitionApprovalDetail";
import { ApprovalsWorklistScreen } from "@/features/requisitions/components/ApprovalsWorklistScreen";
import * as reqApi from "@/features/requisitions/api/requisition";
import * as mastersApi from "@/features/requisitions/api/masters";

const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: routerPush, refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/requisitions/api/requisition");
jest.mock("@/features/requisitions/api/masters");

const getMock = reqApi.getRequisition as jest.Mock;
const listMock = reqApi.listRequisitions as jest.Mock;
const approveMock = reqApi.approveRequisition as jest.Mock;
const rejectMock = reqApi.rejectRequisition as jest.Mock;
const budgetMock = reqApi.checkBudget as jest.Mock;

const PROJECTS = [
  { id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04", status: "ACTIVE" },
];
const ITEMS = [
  { id: "it-cement", code: "IT-01", name: "Cement — 50kg bag", uom: "bag", isActive: true },
];
const USERS = [{ id: "u-rafiq", name: "Rafiqul Islam" }];

function req(over: Partial<Requisition> = {}): Requisition {
  return {
    id: "req-1",
    requisitionNo: "REQ/2526/0042",
    projectId: "proj-a",
    costCentreId: "cc-mat",
    purposeId: "pp-1",
    fromGodownId: "gd-a",
    requiredDate: "2026-07-20",
    priority: "HIGH",
    status: "SUBMITTED",
    estimatedValue: "470700.0000",
    approvalTier: "PM",
    submittedAt: "2026-07-12T08:00:00Z",
    submittedById: "u-rafiq",
    closedAt: null,
    closedReason: null,
    narration: "Deck slab pour materials",
    version: 3,
    lines: [
      {
        id: "rl-1",
        lineNo: 1,
        itemId: "it-cement",
        requestedQuantity: "300.0000",
        issuedQuantity: "0.0000",
        balanceQuantity: "300.0000",
        indicativeRate: "542.0000",
        uom: "bag",
      },
    ],
    ...over,
  };
}

function user(role: Role): SafeUser {
  return {
    id: "u-me",
    email: "x@ze.test",
    name: "Approver",
    role,
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
    approvalLimit: "500000.0000",
  };
}

function renderWith(ui: React.ReactElement, role: Role = "PROJECT_MANAGER") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
  (mastersApi.listItemOptions as jest.Mock).mockResolvedValue(ITEMS);
  (mastersApi.listUserOptions as jest.Mock).mockResolvedValue(USERS);
  (mastersApi.listCostCentreOptions as jest.Mock).mockResolvedValue([]);
  budgetMock.mockResolvedValue("OK");
});

describe("RequisitionApprovalDetail (spec §4/§6/§9)", () => {
  it("renders an in-tier PM view with the estimated value + Approve/Reject enabled (FR-REQ-005/-009)", async () => {
    getMock.mockResolvedValue(req());
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />);
    await screen.findByTestId("req-approval-title");
    expect(screen.getByTestId("req-tier-banner-in-tier")).toBeInTheDocument();
    expect(screen.getByTestId("req-approval-estimate")).toHaveTextContent("470,700");
    expect(screen.getAllByTestId("req-approve")[0]!).not.toBeDisabled();
    expect(screen.getAllByTestId("req-reject")[0]!).not.toBeDisabled();
  });

  it("approves (optional note) and redirects to the worklist (FR-REQ-008)", async () => {
    getMock.mockResolvedValue(req());
    approveMock.mockResolvedValue(req({ status: "APPROVED" }));
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />);
    await screen.findByTestId("req-approval-title");
    await userEvent.click(screen.getAllByTestId("req-approve")[0]!);
    await waitFor(() =>
      expect(approveMock).toHaveBeenCalledWith("req-1", { note: null, version: 3 }),
    );
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/requisitions/approvals"));
  });

  it("blocks an empty reject reason with the exact message (edge 7; MISSING_REJECT_REASON)", async () => {
    getMock.mockResolvedValue(req());
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />);
    await screen.findByTestId("req-approval-title");
    await userEvent.click(screen.getAllByTestId("req-reject")[0]!);
    await userEvent.click(await screen.findByTestId("req-reject-confirm"));
    expect(screen.getAllByTestId("req-reject-error")[0]!).toHaveTextContent(
      "Enter a reason for rejecting this requisition.",
    );
    expect(rejectMock).not.toHaveBeenCalled();
  });

  it("rejects with a reason and redirects to the worklist (FR-REQ-008)", async () => {
    getMock.mockResolvedValue(req());
    rejectMock.mockResolvedValue(req({ status: "REJECTED" }));
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />);
    await screen.findByTestId("req-approval-title");
    await userEvent.click(screen.getAllByTestId("req-reject")[0]!);
    await userEvent.type(
      screen.getAllByTestId("req-reject-reason")[0]!,
      "Rebar quantity looks high — confirm the BBS.",
    );
    await userEvent.click(screen.getByTestId("req-reject-confirm"));
    await waitFor(() =>
      expect(rejectMock).toHaveBeenCalledWith("req-1", {
        reason: "Rebar quantity looks high — confirm the BBS.",
        version: 3,
      }),
    );
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/requisitions/approvals"));
  });

  it("shows the escalated note with Approve/Reject disabled for a PM on an ACCOUNTS-tier item (FR-REQ-010, edge 1)", async () => {
    getMock.mockResolvedValue(
      req({
        approvalTier: "ACCOUNTS",
        requisitionNo: "REQ/2526/0090",
        estimatedValue: "860000.0000",
      }),
    );
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />, "PROJECT_MANAGER");
    await screen.findByTestId("req-approval-title");
    expect(screen.getByTestId("req-tier-banner-escalated")).toHaveTextContent(
      "It has been escalated to the Accounts team",
    );
    expect(screen.getAllByTestId("req-approve")[0]!).toBeDisabled();
    expect(screen.getAllByTestId("req-reject")[0]!).toBeDisabled();
  });

  it("surfaces a beyond-authority server rejection as the decision-failure banner (FR-REQ-010)", async () => {
    getMock.mockResolvedValue(req());
    approveMock.mockRejectedValue(
      new ApiError({ code: "APPROVAL_BEYOND_AUTHORITY", message: "x", status: 403 }),
    );
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />);
    await screen.findByTestId("req-approval-title");
    await userEvent.click(screen.getAllByTestId("req-approve")[0]!);
    expect(await screen.findByTestId("req-decision-error")).toHaveTextContent(
      "above your approval limit",
    );
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("shows the already-decided race banner on a 409 REQUISITION_NOT_SUBMITTED (FR-REQ-011)", async () => {
    getMock.mockResolvedValue(req());
    approveMock.mockRejectedValue(
      new ApiError({ code: "REQUISITION_NOT_SUBMITTED", message: "x", status: 409 }),
    );
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />);
    await screen.findByTestId("req-approval-title");
    await userEvent.click(screen.getAllByTestId("req-approve")[0]!);
    expect(await screen.findByTestId("req-decided-banner")).toHaveTextContent(
      "This requisition has already been decided.",
    );
  });

  it("renders a partial requester as the id + (name unavailable) (spec §6)", async () => {
    getMock.mockResolvedValue(req({ submittedById: "u-ghost" }));
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />);
    await screen.findByTestId("req-approval-title");
    await waitFor(() => expect(screen.getByText("(name unavailable)")).toBeInTheDocument());
  });

  it("hides the screen from a Site Engineer with the permission-denied view (spec §11)", async () => {
    getMock.mockResolvedValue(req());
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />, "SITE_ENGINEER");
    expect(await screen.findByTestId("req-approval-403")).toBeInTheDocument();
  });

  it("gives a Store Keeper a read-only view (no decision control) (spec §11)", async () => {
    getMock.mockResolvedValue(req());
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />, "STORE_KEEPER");
    await screen.findByTestId("req-approval-title");
    expect(screen.getAllByTestId("req-approve")[0]!).toBeDisabled();
    expect(screen.queryByTestId("req-approval-note")).not.toBeInTheDocument();
  });

  it("renders a decided requisition read-only with the already-decided banner (spec §6)", async () => {
    getMock.mockResolvedValue(req({ status: "APPROVED" }));
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />);
    await screen.findByTestId("req-approval-title");
    expect(screen.getByTestId("req-decided-banner")).toBeInTheDocument();
    expect(screen.getAllByTestId("req-approve")[0]!).toBeDisabled();
  });

  it("shows the centred load-error state with Retry on a fetch failure (spec §6)", async () => {
    getMock.mockRejectedValue(new ApiError({ code: "UNKNOWN", message: "boom", status: 500 }));
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />);
    expect(await screen.findByTestId("req-approval-error")).toHaveTextContent(
      "Couldn't load this requisition.",
    );
  });

  it("keeps the mobile sticky action bar mounted for the site-facing ≥360 case (spec §4)", async () => {
    getMock.mockResolvedValue(req());
    renderWith(<RequisitionApprovalDetail requisitionId="req-1" />);
    await screen.findByTestId("req-approval-title");
    // Desktop footer + mobile sticky bar both render the action bar (breakpoints are CSS-only).
    expect(screen.getAllByTestId("req-action-bar").length).toBeGreaterThanOrEqual(2);
  });
});

describe("ApprovalsWorklistScreen (route reconciliation)", () => {
  it("lists SUBMITTED requisitions and points rows at the approvals detail", async () => {
    listMock.mockResolvedValue({ data: [req()], page: 1, pageSize: 25, total: 1 });
    renderWith(<ApprovalsWorklistScreen />);
    await screen.findByTestId("req-list");
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ status: "SUBMITTED" }));
    expect(screen.getAllByTestId("req-open")[0]!).toHaveAttribute(
      "href",
      "/requisitions/approvals/req-1",
    );
  });

  it("shows the empty queue state when nothing is awaiting review", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<ApprovalsWorklistScreen />);
    expect(await screen.findByTestId("req-approvals-empty")).toBeInTheDocument();
  });

  it("blocks a non-approver (Site Engineer) with the permission-denied view", async () => {
    renderWith(<ApprovalsWorklistScreen />, "SITE_ENGINEER");
    expect(await screen.findByTestId("req-approvals-403")).toBeInTheDocument();
  });
});
