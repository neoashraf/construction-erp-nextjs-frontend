/**
 * FE-31 Requisition issue tests (FR-REQ-012…-023). Partial issue → result summary; over-balance
 * block; negative-stock hard block vs authorised override + reason; "Issue all" quick-fill;
 * Manual Close + reason; Reverse + reversed badge; role/scope gating (Store Keeper issue-only,
 * PM close-only, Accounts reverse-only); and the mobile sticky Issue bar (≥360).
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
import {
  type Requisition,
  type RequisitionOutstanding,
  type RequisitionIssue,
} from "@/features/requisitions/types";
import { RequisitionIssueDetail } from "@/features/requisitions/components/RequisitionIssueDetail";
import { IssuesWorklistScreen } from "@/features/requisitions/components/IssuesWorklistScreen";
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
const outstandingMock = reqApi.getRequisitionOutstanding as jest.Mock;
const issuesMock = reqApi.listRequisitionIssues as jest.Mock;
const approvalsMock = reqApi.listRequisitionApprovals as jest.Mock;
const onHandMock = reqApi.getOnHand as jest.Mock;
const issueMock = reqApi.issueRequisition as jest.Mock;
const reverseMock = reqApi.reverseRequisitionIssue as jest.Mock;
const closeMock = reqApi.closeRequisition as jest.Mock;

const PROJECTS = [
  { id: "proj-a", name: "Bridge-04 — Buriganga", projectCode: "BR-04", status: "ACTIVE" },
];
const ITEMS = [
  { id: "it-cement", code: "IT-01", name: "Cement — 50kg bag", uom: "BAG", isActive: true },
];
const USERS = [{ id: "u-rafiq", name: "Rafiqul Islam" }];
const GODOWNS = [
  { id: "gd-a", code: "G-A", name: "Central Store", projectId: "proj-a", isActive: true },
];
const CCS = [{ id: "cc-mat", code: "CC-01", name: "Superstructure", isActive: true }];

function req(over: Partial<Requisition> = {}): Requisition {
  return {
    id: "req-1",
    requisitionNo: "REQ/2526/0042",
    projectId: "proj-a",
    costCentreId: "cc-mat",
    purposeId: "pp-1",
    fromGodownId: "gd-a",
    requiredDate: "2026-07-18",
    priority: "HIGH",
    status: "APPROVED",
    estimatedValue: "54200.0000",
    approvalTier: "PM",
    submittedAt: "2026-07-10T08:00:00Z",
    submittedById: "u-rafiq",
    closedAt: null,
    closedReason: null,
    narration: "Column casting",
    version: 3,
    lines: [
      {
        id: "rl-1",
        lineNo: 1,
        itemId: "it-cement",
        requestedQuantity: "100.0000",
        issuedQuantity: "0.0000",
        balanceQuantity: "100.0000",
        indicativeRate: "542.0000",
        uom: "BAG",
      },
    ],
    ...over,
  };
}

function outstanding(over: Partial<RequisitionOutstanding> = {}): RequisitionOutstanding {
  return {
    requisitionId: "req-1",
    status: "APPROVED",
    lines: [
      {
        requisitionLineId: "rl-1",
        itemId: "it-cement",
        requestedQuantity: "100.0000",
        issuedQuantity: "0.0000",
        balanceQuantity: "100.0000",
        uom: "BAG",
      },
    ],
    totalOutstandingValueIndicative: "54200.0000",
    ...over,
  };
}

function issueResult(over: Partial<RequisitionIssue> = {}): RequisitionIssue {
  return {
    requisitionId: "req-1",
    requisitionIssueId: "ri-1",
    issueNo: 1,
    journalEntryId: "je-1",
    entryNo: "SJ/2526/0031",
    issuedValue: "27100.0000",
    fromGodownId: "gd-a",
    lines: [
      {
        requisitionLineId: "rl-1",
        stockMovementId: "mv-1",
        issuedQuantity: "50.0000",
        rate: "542.0000",
        value: "27100.0000",
      },
    ],
    requisitionStatus: "PARTIALLY_ISSUED",
    issuedAt: "2026-07-12T14:20:00Z",
    reversedAt: null,
    reversedById: null,
    ...over,
  };
}

function pastIssue(over: Partial<RequisitionIssue> = {}): RequisitionIssue {
  return { ...issueResult(), ...over };
}

function user(role: Role): SafeUser {
  return {
    id: "u-me",
    email: "x@ze.test",
    name: "Actor",
    role,
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
  };
}

function renderWith(ui: React.ReactElement, role: Role = "STORE_KEEPER") {
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
  (mastersApi.listGodownOptions as jest.Mock).mockResolvedValue(GODOWNS);
  (mastersApi.listCostCentreOptions as jest.Mock).mockResolvedValue(CCS);
  (mastersApi.listPurposeOptions as jest.Mock).mockResolvedValue([
    { id: "pp-1", name: "Consumption", projectId: "proj-a", isActive: true },
  ]);
  outstandingMock.mockResolvedValue(outstanding());
  issuesMock.mockResolvedValue([]);
  approvalsMock.mockResolvedValue([]);
  onHandMock.mockResolvedValue({
    godownId: "gd-a",
    itemId: "it-cement",
    quantityOnHand: "500.0000",
    weightedAverageRate: "542.0000",
  });
});

async function enterQty(value: string) {
  const inputs = await screen.findAllByTestId("req-line-qty");
  await userEvent.clear(inputs[0]!);
  await userEvent.type(inputs[0]!, value);
}

describe("RequisitionIssueDetail (spec §4/§5/§6)", () => {
  it("issues a partial quantity and renders the result summary with entryNo + value (FR-REQ-013/-014)", async () => {
    getMock.mockResolvedValue(req());
    issueMock.mockResolvedValue(issueResult());
    outstandingMock
      .mockResolvedValueOnce(outstanding())
      .mockResolvedValue(
        outstanding({
          status: "PARTIALLY_ISSUED",
          lines: [
            {
              requisitionLineId: "rl-1",
              itemId: "it-cement",
              requestedQuantity: "100.0000",
              issuedQuantity: "50.0000",
              balanceQuantity: "50.0000",
              uom: "BAG",
            },
          ],
        }),
      );
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />);
    await screen.findByTestId("req-issue-form");
    await enterQty("50");
    await userEvent.click(screen.getByTestId("req-issue"));
    await waitFor(() => expect(issueMock).toHaveBeenCalled());
    const [, input] = issueMock.mock.calls[0]!;
    expect(input.lines[0]).toMatchObject({ requisitionLineId: "rl-1", issueQuantity: "50.0000" });
    expect(await screen.findByTestId("req-issue-result")).toHaveTextContent("SJ/2526/0031");
  });

  it("blocks an over-balance quantity before firing (edge 2; ISSUE_EXCEEDS_BALANCE)", async () => {
    getMock.mockResolvedValue(req());
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />);
    await screen.findByTestId("req-issue-form");
    await enterQty("250");
    await userEvent.click(screen.getByTestId("req-issue"));
    expect((await screen.findAllByTestId("req-line-error"))[0]!).toHaveTextContent(
      "This exceeds the outstanding balance (100.0000).",
    );
    expect(issueMock).not.toHaveBeenCalled();
  });

  it("fills the balance with 'Issue all' (FR-REQ-012)", async () => {
    getMock.mockResolvedValue(req());
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />);
    await screen.findByTestId("req-issue-form");
    await userEvent.click((await screen.findAllByTestId("req-issue-all"))[0]!);
    const input = (await screen.findAllByTestId("req-line-qty"))[0]! as HTMLInputElement;
    expect(input.value).toBe("100.0000");
  });

  it("shows the negative-stock hard block (no override) for an unauthorised Store Keeper (FR-REQ-016)", async () => {
    getMock.mockResolvedValue(req());
    onHandMock.mockResolvedValue({
      godownId: "gd-a",
      itemId: "it-cement",
      quantityOnHand: "10.0000",
      weightedAverageRate: "542.0000",
    });
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />, "STORE_KEEPER");
    await screen.findByTestId("req-issue-form");
    await enterQty("50");
    expect((await screen.findAllByTestId("req-negstock"))[0]!).toHaveTextContent("below zero");
    expect(screen.queryByTestId("req-negstock-toggle")).not.toBeInTheDocument();
  });

  it("offers the authorised override + reason and sends allowNegativeStock (Admin; FR-REQ-016)", async () => {
    getMock.mockResolvedValue(req());
    issueMock.mockResolvedValue(issueResult());
    onHandMock.mockResolvedValue({
      godownId: "gd-a",
      itemId: "it-cement",
      quantityOnHand: "10.0000",
      weightedAverageRate: "542.0000",
    });
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />, "ADMIN");
    await screen.findByTestId("req-issue-form");
    await enterQty("50");
    await userEvent.click((await screen.findAllByTestId("req-negstock-toggle"))[0]!);
    await userEvent.type(
      (await screen.findAllByTestId("req-negstock-reason"))[0]!,
      "GRN in transit — confirmed by phone.",
    );
    await userEvent.click(screen.getByTestId("req-issue"));
    await waitFor(() => expect(issueMock).toHaveBeenCalled());
    const [, input] = issueMock.mock.calls[0]!;
    expect(input.allowNegativeStock).toBe(true);
    expect(input.negativeStockReason).toContain("GRN in transit");
  });

  it("surfaces a closed-period banner on PERIOD_CLOSED (edge 5)", async () => {
    getMock.mockResolvedValue(req());
    issueMock.mockRejectedValue(new ApiError({ code: "PERIOD_CLOSED", message: "x", status: 409 }));
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />);
    await screen.findByTestId("req-issue-form");
    await enterQty("50");
    await userEvent.click(screen.getByTestId("req-issue"));
    expect(await screen.findByTestId("req-issue-banner")).toHaveTextContent(
      "This accounting period is closed.",
    );
  });

  it("refreshes the balance on a concurrent-shrink ISSUE_EXCEEDS_BALANCE (edge 8)", async () => {
    getMock.mockResolvedValue(req());
    issueMock.mockRejectedValue(
      new ApiError({ code: "ISSUE_EXCEEDS_BALANCE", message: "x", status: 400 }),
    );
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />);
    await screen.findByTestId("req-issue-form");
    await enterQty("50");
    await userEvent.click(screen.getByTestId("req-issue"));
    expect(await screen.findByTestId("req-issue-banner")).toHaveTextContent("outstanding balance");
    await waitFor(() => expect(outstandingMock.mock.calls.length).toBeGreaterThan(1));
  });

  it("lets a PM manual-close with a reason and blocks the issue form (spec §11; FR-REQ-020)", async () => {
    getMock.mockResolvedValue(req());
    closeMock.mockResolvedValue(req({ status: "CLOSED" }));
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />, "PROJECT_MANAGER");
    await screen.findByTestId("req-outstanding");
    expect(screen.queryByTestId("req-issue-form")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("req-manual-close"));
    await userEvent.type(
      await screen.findByTestId("req-close-reason"),
      "Pour completed with substitute stock.",
    );
    await userEvent.click(screen.getByTestId("req-close-confirm"));
    await waitFor(() =>
      expect(closeMock).toHaveBeenCalledWith("req-1", {
        reason: "Pour completed with substitute stock.",
        version: 3,
      }),
    );
  });

  it("lets Accounts reverse a posted issue with a reason (FR-REQ-017)", async () => {
    getMock.mockResolvedValue(req({ status: "PARTIALLY_ISSUED" }));
    outstandingMock.mockResolvedValue(outstanding({ status: "PARTIALLY_ISSUED" }));
    issuesMock.mockResolvedValue([pastIssue()]);
    reverseMock.mockResolvedValue(req({ status: "APPROVED" }));
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />, "ACCOUNTS_MANAGER");
    await screen.findByTestId("req-trail");
    await userEvent.click((await screen.findAllByTestId("req-reverse"))[0]!);
    await userEvent.type(
      await screen.findByTestId("req-reverse-reason"),
      "Wrong godown — reissue from Site B.",
    );
    await userEvent.click(screen.getByTestId("req-reverse-confirm"));
    await waitFor(() =>
      expect(reverseMock).toHaveBeenCalledWith("req-1", "ri-1", {
        reason: "Wrong godown — reissue from Site B.",
        version: 3,
      }),
    );
  });

  it("shows a reversed issue struck-through/badged (append-only; FR-REQ-017)", async () => {
    getMock.mockResolvedValue(req({ status: "PARTIALLY_ISSUED" }));
    outstandingMock.mockResolvedValue(outstanding({ status: "PARTIALLY_ISSUED" }));
    issuesMock.mockResolvedValue([
      pastIssue({ reversedAt: "2026-07-12T15:00:00Z", reversedById: "u-me" }),
    ]);
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />, "ACCOUNTS_MANAGER");
    await screen.findByTestId("req-trail");
    expect(screen.getByTestId("req-trail")).toHaveTextContent("Reversed");
    expect(screen.queryByTestId("req-reverse")).not.toBeInTheDocument();
  });

  it("hides Issue/Close from a Store Keeper except the issue form (spec §11)", async () => {
    getMock.mockResolvedValue(req());
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />, "STORE_KEEPER");
    await screen.findByTestId("req-issue-form");
    expect(screen.queryByTestId("req-manual-close")).not.toBeInTheDocument();
  });

  it("collapses the issue form with a fully-issued banner once ISSUED (FR-REQ-019)", async () => {
    getMock.mockResolvedValue(req({ status: "ISSUED" }));
    outstandingMock.mockResolvedValue(
      outstanding({
        status: "ISSUED",
        lines: [
          {
            requisitionLineId: "rl-1",
            itemId: "it-cement",
            requestedQuantity: "100.0000",
            issuedQuantity: "100.0000",
            balanceQuantity: "0.0000",
            uom: "BAG",
          },
        ],
      }),
    );
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />);
    expect(await screen.findByTestId("req-issue-done")).toHaveTextContent("fully issued");
    expect(screen.queryByTestId("req-issue-form")).not.toBeInTheDocument();
  });

  it("keeps the mobile sticky Issue bar mounted for the site-facing ≥360 case (spec §4)", async () => {
    getMock.mockResolvedValue(req());
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />);
    await screen.findByTestId("req-issue-form");
    expect(screen.getByTestId("req-issue-mobile")).toBeInTheDocument();
  });

  it("shows the permission-denied view for a non-viewer (HR)", async () => {
    getMock.mockResolvedValue(req());
    renderWith(<RequisitionIssueDetail requisitionId="req-1" />, "HR_MANAGER");
    expect(await screen.findByTestId("req-issue-403")).toBeInTheDocument();
  });
});

describe("IssuesWorklistScreen (route reconciliation)", () => {
  it("lists APPROVED/PARTIALLY_ISSUED requisitions pointing rows at the issue detail", async () => {
    listMock.mockResolvedValue({ data: [req()], page: 1, pageSize: 25, total: 1 });
    renderWith(<IssuesWorklistScreen />);
    await screen.findByTestId("req-list");
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "APPROVED,PARTIALLY_ISSUED" }),
    );
    expect(within(screen.getByTestId("req-list")).getAllByTestId("req-open")[0]!).toHaveAttribute(
      "href",
      "/requisitions/issues/req-1",
    );
  });

  it("shows the empty queue when nothing is awaiting issue", async () => {
    listMock.mockResolvedValue({ data: [], page: 1, pageSize: 25, total: 0 });
    renderWith(<IssuesWorklistScreen />);
    expect(await screen.findByTestId("req-issues-empty")).toBeInTheDocument();
  });
});
