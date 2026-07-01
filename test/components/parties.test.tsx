/**
 * FE-3 parties tests (FR-MAS-022/023/024/029/033).
 * List: state matrix, filters, role show/hide. Detail form: validation (name,
 * role group, phone E.164), server error mapping, create/edit. Status dialogs.
 * Full happy path also in Playwright.
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
import { type Party } from "@/features/master-data/types";
import { PartiesScreen } from "@/features/master-data/components/PartiesScreen";
import { PartyDetailForm } from "@/features/master-data/components/PartyDetailForm";
import { PartyStatusDialog } from "@/features/master-data/components/PartyStatusDialog";
import * as api from "@/features/master-data/api/parties";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("@/features/master-data/api/parties", () => ({
  listParties: jest.fn(),
  getParty: jest.fn(),
  createParty: jest.fn(),
  updateParty: jest.fn(),
  deactivateParty: jest.fn(),
  reactivateParty: jest.fn(),
}));

const listMock = api.listParties as jest.Mock;
const createMock = api.createParty as jest.Mock;
const updateMock = api.updateParty as jest.Mock;
const deactivateMock = api.deactivateParty as jest.Mock;
const reactivateMock = api.reactivateParty as jest.Mock;

const PARTY: Party = {
  id: "p1",
  name: "Acme Traders",
  isCustomer: true,
  isSupplier: false,
  tin: "654321987012",
  bin: null,
  address: "Dhaka",
  phone: "+8801712345678",
  email: "acme@x.test",
  paymentTermsDays: 30,
  openingBalance: "15000.0000",
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

function page(...parties: Party[]) {
  return { data: parties, page: 1, pageSize: 25, total: parties.length };
}

function renderList(role: Role = "ADMIN") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <ToastProvider>
          <PartiesScreen />
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
  updateMock.mockReset();
  deactivateMock.mockReset();
  reactivateMock.mockReset();
});

// ── List ─────────────────────────────────────────────────────────────────────
describe("PartiesScreen — list", () => {
  it("shows loading skeletons first", () => {
    listMock.mockReturnValue(new Promise(() => {}));
    renderList();
    expect(screen.getByTestId("parties-loading")).toBeInTheDocument();
  });

  it("renders name, roles, phone, status from the list (FR-MAS-022/024)", async () => {
    listMock.mockResolvedValue(page(PARTY));
    renderList();
    const table = await screen.findByTestId("parties-desktop");
    expect(within(table).getByText("Acme Traders")).toBeInTheDocument();
    expect(within(table).getByText("Customer")).toBeInTheDocument();
    expect(within(table).getByText("+8801712345678")).toBeInTheDocument();
  });

  it("empty (no filters) shows 'No parties yet.' + New; filtered-empty shows Clear filters", async () => {
    listMock.mockResolvedValue(page());
    renderList();
    expect(await screen.findByText("No parties yet.")).toBeInTheDocument();
    // Apply a role filter → filtered-empty
    await userEvent.click(screen.getByRole("button", { name: "Customers" }));
    expect(await screen.findByText("No parties match these filters.")).toBeInTheDocument();
    expect(screen.getByTestId("clear-filters")).toBeInTheDocument();
  });

  it("role filter drives ?isCustomer (FR-MAS-024)", async () => {
    listMock.mockResolvedValue(page(PARTY));
    renderList();
    await screen.findByTestId("parties-desktop");
    await userEvent.click(screen.getByRole("button", { name: "Suppliers" }));
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ isSupplier: true })),
    );
  });

  it("error shows Retry", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderList();
    expect(await screen.findByText("Couldn't load parties.")).toBeInTheDocument();
    expect(screen.getByTestId("parties-retry")).toBeInTheDocument();
  });

  it("non-manager role hides New + row actions", async () => {
    listMock.mockResolvedValue(page(PARTY));
    renderList("SITE_ENGINEER");
    const table = await screen.findByTestId("parties-desktop");
    expect(screen.queryByTestId("new-party")).not.toBeInTheDocument();
    expect(within(table).queryByTestId("party-actions-p1")).not.toBeInTheDocument();
  });
});

// ── Detail form ──────────────────────────────────────────────────────────────
describe("PartyDetailForm — validation + save", () => {
  const noop = () => {};

  it("requires a name and at least one role (group error) (FR-MAS-023, spec §7)", async () => {
    renderNode(
      <PartyDetailForm
        mode={{ kind: "create" }}
        onCreated={noop}
        onUpdated={noop}
        onCancel={noop}
        onReload={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/phone/i), "01712345678");
    await userEvent.click(screen.getByTestId("party-save"));
    expect(await screen.findByText("Party name is required.")).toBeInTheDocument();
    expect(screen.getByTestId("roles-error")).toHaveTextContent(
      "Select at least one role (customer or supplier).",
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects a non-+880 phone (E.164) (SRS §11)", async () => {
    renderNode(
      <PartyDetailForm
        mode={{ kind: "create" }}
        onCreated={noop}
        onUpdated={noop}
        onCancel={noop}
        onReload={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/party name/i), "Acme");
    await userEvent.click(screen.getByLabelText(/customer/i));
    await userEvent.type(screen.getByLabelText(/phone/i), "12345");
    await userEvent.click(screen.getByTestId("party-save"));
    expect(
      await screen.findByText("Enter a valid phone number in +880 format."),
    ).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates a party, normalising the local phone to E.164 (FR-MAS-022/023)", async () => {
    createMock.mockResolvedValue({ id: "new" });
    const onCreated = jest.fn();
    renderNode(
      <PartyDetailForm
        mode={{ kind: "create" }}
        onCreated={onCreated}
        onUpdated={noop}
        onCancel={noop}
        onReload={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/party name/i), "Acme Traders");
    await userEvent.click(screen.getByLabelText(/customer/i));
    await userEvent.type(screen.getByLabelText(/phone/i), "01712345678");
    await userEvent.click(screen.getByTestId("party-save"));
    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Acme Traders",
          isCustomer: true,
          phone: "+8801712345678",
        }),
      ),
    );
    expect(onCreated).toHaveBeenCalledWith("new");
  });

  it("edit sends version and maps server VALIDATION_ERROR to a field (FR-MAS-032)", async () => {
    updateMock.mockRejectedValue(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "bad",
        details: { tin: ["Invalid TIN per NBR"] },
        status: 400,
      }),
    );
    renderNode(
      <PartyDetailForm
        mode={{ kind: "edit", party: PARTY }}
        onCreated={noop}
        onUpdated={noop}
        onCancel={noop}
        onReload={noop}
      />,
    );
    await userEvent.click(screen.getByTestId("party-save"));
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith("p1", expect.objectContaining({ version: 1 })),
    );
    expect(await screen.findByText("Invalid TIN per NBR")).toBeInTheDocument();
  });

  it("read-only mode hides Save (non-manager)", () => {
    renderNode(
      <PartyDetailForm
        mode={{ kind: "edit", party: PARTY }}
        readOnly
        onCreated={noop}
        onUpdated={noop}
        onCancel={noop}
        onReload={noop}
      />,
    );
    expect(screen.queryByTestId("party-save")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to parties/i })).toBeInTheDocument();
  });
});

// ── Status dialogs ───────────────────────────────────────────────────────────
describe("PartyStatusDialog — deactivate / reactivate (FR-MAS-029/033)", () => {
  it("deactivate calls the endpoint with version and toasts", async () => {
    deactivateMock.mockResolvedValue({ ...PARTY, isActive: false });
    renderNode(
      <PartyStatusDialog
        party={PARTY}
        mode="deactivate"
        onClose={jest.fn()}
        onReload={jest.fn()}
      />,
    );
    const dialog = await screen.findByTestId("party-status-dialog");
    await userEvent.click(within(dialog).getByTestId("party-status-confirm"));
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith("p1", 1));
    expect(await screen.findByText("‘Acme Traders’ deactivated.")).toBeInTheDocument();
  });

  it("reactivate calls the endpoint with version", async () => {
    reactivateMock.mockResolvedValue({ ...PARTY, isActive: true });
    renderNode(
      <PartyStatusDialog
        party={{ ...PARTY, isActive: false }}
        mode="reactivate"
        onClose={jest.fn()}
        onReload={jest.fn()}
      />,
    );
    const dialog = await screen.findByTestId("party-status-dialog");
    await userEvent.click(within(dialog).getByTestId("party-status-confirm"));
    await waitFor(() => expect(reactivateMock).toHaveBeenCalledWith("p1", 1));
  });
});
