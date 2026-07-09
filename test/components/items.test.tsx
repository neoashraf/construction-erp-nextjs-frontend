/**
 * FE-8 items tests (FR-MAS-025/026/027/029/033/034).
 * List state matrix + role; detail form (dup code, cross-company, base-UoM lock,
 * BASE_UOM_IMMUTABLE); UoM conversions (factor>0, upsert, remove/referenced); status.
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
import { type Item, type Account, type ItemUomConversion } from "@/features/master-data/types";
import { ItemsScreen } from "@/features/master-data/components/ItemsScreen";
import { ItemFormDrawer } from "@/features/master-data/components/ItemFormDrawer";
import { UomConversionsTable } from "@/features/master-data/components/UomConversionsTable";
import { ItemStatusDialog } from "@/features/master-data/components/ItemStatusDialog";
import * as iapi from "@/features/master-data/api/items";
import * as capi from "@/features/master-data/api/chart-of-accounts";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/master-data/api/items", () => ({
  listItems: jest.fn(),
  getItem: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deactivateItem: jest.fn(),
  reactivateItem: jest.fn(),
  listConversions: jest.fn(),
  upsertConversion: jest.fn(),
  removeConversion: jest.fn(),
}));
jest.mock("@/features/master-data/api/chart-of-accounts", () => ({
  listAccountGroups: jest.fn(),
  listAccounts: jest.fn(),
}));

const listMock = iapi.listItems as jest.Mock;
const createMock = iapi.createItem as jest.Mock;
const updateMock = iapi.updateItem as jest.Mock;
const deactivateMock = iapi.deactivateItem as jest.Mock;
const upsertMock = iapi.upsertConversion as jest.Mock;
const removeMock = iapi.removeConversion as jest.Mock;
const listConvMock = iapi.listConversions as jest.Mock;
const accountsMock = capi.listAccounts as jest.Mock;

const ACCOUNT: Account = {
  id: "acc1",
  code: "5100",
  name: "Material Expense",
  accountGroupId: "g1",
  type: "EXPENSE",
  openingBalance: null,
  isActive: true,
  version: 1,
};
const ITEM: Item = {
  id: "it1",
  code: "MAT-1",
  name: "Cement",
  baseUom: "Bag",
  hsCode: "2523",
  defaultAccountId: "acc1",
  isActive: true,
  version: 2,
};
const CONV: ItemUomConversion = { id: "cv1", itemId: "it1", uom: "Ton", factorToBase: "20.0000" };

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
          <ItemsScreen />
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
  accountsMock.mockResolvedValue([ACCOUNT]);
  listConvMock.mockResolvedValue([]);
});

describe("ItemsScreen — list", () => {
  it("renders Code/Name/Base UoM/Status (FR-MAS-025)", async () => {
    listMock.mockResolvedValue(pageOf(ITEM));
    renderScreen();
    const table = await screen.findByTestId("items-desktop");
    expect(within(table).getByText("MAT-1")).toBeInTheDocument();
    expect(within(table).getByText("Cement")).toBeInTheDocument();
    expect(within(table).getByText("Bag")).toBeInTheDocument();
  });

  it("empty state", async () => {
    listMock.mockResolvedValue(pageOf());
    renderScreen();
    expect(await screen.findByText("No items yet.")).toBeInTheDocument();
    expect(screen.getByTestId("empty-new-item")).toBeInTheDocument();
  });

  it("non-manager read-only (no New, no actions)", async () => {
    listMock.mockResolvedValue(pageOf(ITEM));
    renderScreen("STORE_KEEPER");
    const table = await screen.findByTestId("items-desktop");
    expect(screen.queryByTestId("new-item")).not.toBeInTheDocument();
    expect(within(table).queryByTestId("item-actions-it1")).not.toBeInTheDocument();
  });
});

describe("ItemFormDrawer — validation + mapping", () => {
  const noop = () => {};
  const props = {
    canManage: true,
    onClose: noop,
    onSuccess: noop,
    onConflict: noop,
    onError: noop,
  };

  it("requires code, name, base unit, default account (FR-MAS-025/027)", async () => {
    renderNode(<ItemFormDrawer mode={{ kind: "create" }} {...props} />);
    await userEvent.click(await screen.findByTestId("item-save"));
    expect(await screen.findByText("Item code is required.")).toBeInTheDocument();
    expect(screen.getByText("Base unit is required.")).toBeInTheDocument();
    expect(screen.getByText("Select a default account.")).toBeInTheDocument();
  });

  it("maps DUPLICATE_CODE to the code field", async () => {
    createMock.mockRejectedValue(
      new ApiError({ code: "DUPLICATE_CODE", message: "dup", details: null, status: 409 }),
    );
    renderNode(<ItemFormDrawer mode={{ kind: "create" }} {...props} />);
    await userEvent.type(screen.getByLabelText(/^code/i), "MAT-1");
    await userEvent.type(screen.getByLabelText(/^name/i), "Cement");
    await userEvent.type(screen.getByLabelText(/base uom/i), "Bag");
    await userEvent.selectOptions(await screen.findByLabelText(/default gl account/i), "acc1");
    await userEvent.click(screen.getByTestId("item-save"));
    expect(await screen.findByTestId("item-code-error")).toHaveTextContent(
      "This item code is already used.",
    );
  });

  it("maps CROSS_COMPANY_REFERENCE to the default-account field (FR-MAS-027)", async () => {
    updateMock.mockRejectedValue(
      new ApiError({ code: "CROSS_COMPANY_REFERENCE", message: "x", details: null, status: 400 }),
    );
    renderNode(<ItemFormDrawer mode={{ kind: "edit", item: ITEM }} {...props} />);
    await userEvent.click(await screen.findByTestId("item-save"));
    expect(await screen.findByTestId("item-account-error")).toHaveTextContent(
      "Default account must belong to this company.",
    );
  });

  it("locks the Base unit with a note when conversions exist (FR-MAS-034)", async () => {
    listConvMock.mockResolvedValue([CONV]);
    renderNode(<ItemFormDrawer mode={{ kind: "edit", item: ITEM }} {...props} />);
    expect(await screen.findByTestId("base-uom-locked-note")).toBeInTheDocument();
    expect(screen.getByLabelText(/base uom/i)).toBeDisabled();
  });

  it("maps BASE_UOM_IMMUTABLE to a toast via onError (FR-MAS-034)", async () => {
    updateMock.mockRejectedValue(
      new ApiError({ code: "BASE_UOM_IMMUTABLE", message: "x", details: null, status: 409 }),
    );
    const onError = jest.fn();
    renderNode(<ItemFormDrawer mode={{ kind: "edit", item: ITEM }} {...props} onError={onError} />);
    await userEvent.click(await screen.findByTestId("item-save"));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "This item has conversions or transactions, so its base unit can't be changed.",
      ),
    );
  });
});

describe("UomConversionsTable (FR-MAS-026)", () => {
  it("shows the empty hint naming the base unit", async () => {
    listConvMock.mockResolvedValue([]);
    renderNode(<UomConversionsTable itemId="it1" baseUom="Bag" canManage />);
    expect(await screen.findByTestId("conversions-empty")).toHaveTextContent(
      "The base unit is Bag",
    );
  });

  it("rejects a factor of 0 (factor > 0)", async () => {
    listConvMock.mockResolvedValue([]);
    renderNode(<UomConversionsTable itemId="it1" baseUom="Bag" canManage />);
    await userEvent.type(screen.getByLabelText(/^unit/i), "Ton");
    await userEvent.type(screen.getByLabelText(/factor to/i), "0");
    await userEvent.click(screen.getByTestId("conversion-save"));
    expect(await screen.findByTestId("conversion-error")).toHaveTextContent(
      "Factor must be greater than 0.",
    );
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("upserts a conversion (add/update collapse)", async () => {
    listConvMock.mockResolvedValue([]);
    upsertMock.mockResolvedValue(CONV);
    renderNode(<UomConversionsTable itemId="it1" baseUom="Bag" canManage />);
    await userEvent.type(screen.getByLabelText(/^unit/i), "Ton");
    await userEvent.type(screen.getByLabelText(/factor to/i), "20");
    await userEvent.click(screen.getByTestId("conversion-save"));
    await waitFor(() =>
      expect(upsertMock).toHaveBeenCalledWith("it1", { uom: "Ton", factorToBase: "20.0000" }),
    );
  });

  it("remove: REFERENCED_MASTER shows the in-use message", async () => {
    listConvMock.mockResolvedValue([CONV]);
    removeMock.mockRejectedValue(
      new ApiError({ code: "REFERENCED_MASTER", message: "x", details: null, status: 409 }),
    );
    renderNode(<UomConversionsTable itemId="it1" baseUom="Bag" canManage />);
    await userEvent.click(await screen.findByTestId("conversion-remove-cv1"));
    const dialog = await screen.findByTestId("remove-conversion-dialog");
    await userEvent.click(within(dialog).getByTestId("remove-conversion-confirm"));
    expect(
      await screen.findByText("This unit is in use and can't be removed."),
    ).toBeInTheDocument();
  });
});

describe("ItemStatusDialog", () => {
  it("deactivate sends version + toasts (FR-MAS-029)", async () => {
    deactivateMock.mockResolvedValue({ ...ITEM, isActive: false });
    renderNode(
      <ItemStatusDialog item={ITEM} mode="deactivate" onClose={jest.fn()} onReload={jest.fn()} />,
    );
    const dialog = await screen.findByTestId("item-status-dialog");
    await userEvent.click(within(dialog).getByTestId("item-status-confirm"));
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith("it1", 2));
    expect(await screen.findByText("Item MAT-1 deactivated.")).toBeInTheDocument();
  });
});
