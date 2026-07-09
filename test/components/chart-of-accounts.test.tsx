/**
 * FE-4 chart-of-accounts tests (FR-MAS-017/018/019/020/021/029/033).
 * Tree render/expand + filters/search, account modal (type auto-set, DUPLICATE_CODE,
 * TYPE_MISMATCH, TYPE_IMMUTABLE), group modal, status dialog, state matrix, roles.
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
import { type Account, type AccountGroup } from "@/features/master-data/types";
import { ChartOfAccountsScreen } from "@/features/master-data/components/ChartOfAccountsScreen";
import { AccountModal } from "@/features/master-data/components/AccountModal";
import { GroupModal } from "@/features/master-data/components/GroupModal";
import { AccountStatusDialog } from "@/features/master-data/components/AccountStatusDialog";
import * as api from "@/features/master-data/api/chart-of-accounts";

jest.mock("@/features/master-data/api/chart-of-accounts", () => ({
  listAccountGroups: jest.fn(),
  listAccounts: jest.fn(),
  createAccountGroup: jest.fn(),
  updateAccountGroup: jest.fn(),
  createAccount: jest.fn(),
  updateAccount: jest.fn(),
  deactivateAccount: jest.fn(),
  reactivateAccount: jest.fn(),
}));

const groupsMock = api.listAccountGroups as jest.Mock;
const accountsMock = api.listAccounts as jest.Mock;
const createGroupMock = api.createAccountGroup as jest.Mock;
const createAccountMock = api.createAccount as jest.Mock;
const updateAccountMock = api.updateAccount as jest.Mock;
const deactivateMock = api.deactivateAccount as jest.Mock;

const GROUPS: AccountGroup[] = [
  { id: "g1", name: "Assets", parentGroupId: null, type: "ASSET", version: 1 },
  { id: "g2", name: "Current Assets", parentGroupId: "g1", type: "ASSET", version: 1 },
];
const ACCOUNTS: Account[] = [
  {
    id: "a1",
    code: "1100",
    name: "Cash in Hand",
    accountGroupId: "g2",
    type: "ASSET",
    openingBalance: "0.0000",
    isActive: true,
    version: 1,
  },
];

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

function renderScreen(role: Role = "ADMIN") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <ToastProvider>
          <ChartOfAccountsScreen />
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
  groupsMock.mockReset();
  accountsMock.mockReset();
  createGroupMock.mockReset();
  createAccountMock.mockReset();
  updateAccountMock.mockReset();
  deactivateMock.mockReset();
});

// ── Tree + state matrix ──────────────────────────────────────────────────────
describe("ChartOfAccountsScreen — tree + states", () => {
  it("shows loading skeletons first", () => {
    groupsMock.mockReturnValue(new Promise(() => {}));
    accountsMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId("coa-loading")).toBeInTheDocument();
  });

  it("renders the tree; expanding a group reveals its account leaf (FR-MAS-017/018)", async () => {
    groupsMock.mockResolvedValue(GROUPS);
    accountsMock.mockResolvedValue(ACCOUNTS);
    renderScreen();
    expect(await screen.findByTestId("group-node-g1")).toBeInTheDocument();
    // g2 is nested under g1 (expanded by default); expand g2 to reveal a1.
    // The row has a desktop AND a mobile toggle (CSS-hidden) — either drives the same handler.
    await userEvent.click(screen.getAllByRole("button", { name: /expand current assets/i })[0]!);
    const leaf = await screen.findByTestId("account-leaf-a1");
    // The code renders twice (desktop column + mobile card, toggled by CSS) — assert the row has it.
    expect(within(leaf).getAllByText("1100").length).toBeGreaterThan(0);
  });

  it("type filter switches to a flat account list (spec §5)", async () => {
    groupsMock.mockResolvedValue(GROUPS);
    accountsMock.mockResolvedValue(ACCOUNTS);
    renderScreen();
    await screen.findByTestId("group-node-g1");
    // Custom type-filter dropdown (design): open it, then pick "Asset".
    await userEvent.click(screen.getByTestId("coa-type-filter"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Asset" }));
    expect(await screen.findByTestId("flat-account-a1")).toBeInTheDocument();
  });

  it("search with no match shows 'No accounts match.' + Clear", async () => {
    groupsMock.mockResolvedValue(GROUPS);
    accountsMock.mockResolvedValue(ACCOUNTS);
    renderScreen();
    await screen.findByTestId("group-node-g1");
    await userEvent.type(screen.getByLabelText(/search accounts/i), "zzzz");
    expect(await screen.findByText("No accounts match.")).toBeInTheDocument();
    expect(screen.getByTestId("clear-filters")).toBeInTheDocument();
  });

  it("empty shows 'No accounts yet.' + New group", async () => {
    groupsMock.mockResolvedValue([]);
    accountsMock.mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByText("No accounts yet.")).toBeInTheDocument();
    expect(screen.getByTestId("empty-new-group")).toBeInTheDocument();
  });

  it("error shows Retry", async () => {
    groupsMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    accountsMock.mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByText("Couldn't load the chart of accounts.")).toBeInTheDocument();
    expect(screen.getByTestId("coa-retry")).toBeInTheDocument();
  });

  it("non-Admin sees a read-only tree (no New group/account, no row actions)", async () => {
    groupsMock.mockResolvedValue(GROUPS);
    accountsMock.mockResolvedValue(ACCOUNTS);
    renderScreen("ACCOUNTS_TEAM");
    await screen.findByTestId("group-node-g1");
    expect(screen.queryByTestId("new-group")).not.toBeInTheDocument();
    expect(screen.queryByTestId("new-account")).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: /expand current assets/i })[0]!);
    expect(screen.queryByTestId("account-actions-a1")).not.toBeInTheDocument();
  });
});

// ── Account modal ────────────────────────────────────────────────────────────
describe("AccountModal — type auto-set + error mapping", () => {
  const noop = () => {};

  it("auto-derives the Type from the selected Group (FR-MAS-019)", async () => {
    renderNode(
      <AccountModal
        mode={{ kind: "create" }}
        groups={GROUPS}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText(/group/i), "g2");
    expect(within(screen.getByTestId("derived-type")).getByText("Asset")).toBeInTheDocument();
  });

  it("creates an account carrying the group's type (FR-MAS-018/019)", async () => {
    createAccountMock.mockResolvedValue({ id: "new" });
    const onSuccess = jest.fn();
    renderNode(
      <AccountModal
        mode={{ kind: "create" }}
        groups={GROUPS}
        onClose={noop}
        onSuccess={onSuccess}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/code/i), "1200");
    await userEvent.type(screen.getByLabelText(/name/i), "Receivable");
    await userEvent.selectOptions(screen.getByLabelText(/group/i), "g2");
    await userEvent.click(screen.getByTestId("account-save"));
    await waitFor(() =>
      expect(createAccountMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: "1200", accountGroupId: "g2", type: "ASSET" }),
      ),
    );
    expect(onSuccess).toHaveBeenCalledWith("Account created.");
  });

  it("maps DUPLICATE_CODE to the code field", async () => {
    createAccountMock.mockRejectedValue(
      new ApiError({ code: "DUPLICATE_CODE", message: "dup", details: null, status: 409 }),
    );
    renderNode(
      <AccountModal
        mode={{ kind: "create" }}
        groups={GROUPS}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/code/i), "1100");
    await userEvent.type(screen.getByLabelText(/name/i), "Cash");
    await userEvent.selectOptions(screen.getByLabelText(/group/i), "g2");
    await userEvent.click(screen.getByTestId("account-save"));
    expect(await screen.findByTestId("code-error")).toHaveTextContent(
      "This account code is already used.",
    );
  });

  it("maps ACCOUNT_TYPE_MISMATCH to the group field (FR-MAS-019)", async () => {
    createAccountMock.mockRejectedValue(
      new ApiError({ code: "ACCOUNT_TYPE_MISMATCH", message: "x", details: null, status: 400 }),
    );
    renderNode(
      <AccountModal
        mode={{ kind: "create" }}
        groups={GROUPS}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/code/i), "1300");
    await userEvent.type(screen.getByLabelText(/name/i), "Inventory");
    await userEvent.selectOptions(screen.getByLabelText(/group/i), "g2");
    await userEvent.click(screen.getByTestId("account-save"));
    expect(await screen.findByTestId("group-error")).toHaveTextContent(
      "Account type must match its group's type.",
    );
  });

  it("on an account WITH postings, the group is locked with the immutable note (FR-MAS-021)", () => {
    const posted: Account = { ...ACCOUNTS[0]!, hasPostings: true };
    renderNode(
      <AccountModal
        mode={{ kind: "edit", account: posted }}
        groups={GROUPS}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    expect(screen.getByTestId("type-immutable-note")).toBeInTheDocument();
    expect(screen.getByLabelText(/group/i)).toBeDisabled();
  });

  it("maps ACCOUNT_TYPE_IMMUTABLE from a forced edit (FR-MAS-021, SRS §12.6)", async () => {
    updateAccountMock.mockRejectedValue(
      new ApiError({ code: "ACCOUNT_TYPE_IMMUTABLE", message: "x", details: null, status: 409 }),
    );
    renderNode(
      <AccountModal
        mode={{ kind: "edit", account: ACCOUNTS[0]! }}
        groups={GROUPS}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.click(screen.getByTestId("account-save"));
    expect(await screen.findByTestId("group-error")).toHaveTextContent(
      "This account has postings, so its type can't be changed.",
    );
  });
});

// ── Group modal + status ─────────────────────────────────────────────────────
describe("GroupModal + AccountStatusDialog", () => {
  const noop = () => {};

  it("group name is required", async () => {
    renderNode(
      <GroupModal
        mode={{ kind: "create" }}
        groups={GROUPS}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.click(screen.getByTestId("group-save"));
    expect(await screen.findByText("Group name is required.")).toBeInTheDocument();
    expect(createGroupMock).not.toHaveBeenCalled();
  });

  it("maps a group VALIDATION_ERROR to the Type field", async () => {
    createGroupMock.mockRejectedValue(
      new ApiError({ code: "VALIDATION_ERROR", message: "x", details: null, status: 400 }),
    );
    renderNode(
      <GroupModal
        mode={{ kind: "create" }}
        groups={GROUPS}
        onClose={noop}
        onSuccess={noop}
        onConflict={noop}
        onError={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/group name/i), "Bad Group");
    await userEvent.click(screen.getByTestId("group-save"));
    expect(await screen.findByTestId("group-type-error")).toBeInTheDocument();
  });

  it("deactivate account calls the endpoint with version (FR-MAS-029)", async () => {
    deactivateMock.mockResolvedValue({ ...ACCOUNTS[0]!, isActive: false });
    renderNode(
      <AccountStatusDialog
        account={ACCOUNTS[0]!}
        mode="deactivate"
        onClose={jest.fn()}
        onReload={jest.fn()}
      />,
    );
    const dialog = await screen.findByTestId("account-status-dialog");
    await userEvent.click(within(dialog).getByTestId("account-status-confirm"));
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith("a1", 1));
    expect(await screen.findByText("Account 1100 deactivated.")).toBeInTheDocument();
  });
});
