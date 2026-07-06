/**
 * FE-SHELL v3 toolbar (screen spec §4/§5/§6/§7/§9). Company·FY switcher
 * name-resolution + degrade + FY-switch query invalidation, alerts-bell gating +
 * degrade, the sidebar-footer user menu (identity header incl. email / Change
 * password / Sign out, upward), and the Ctrl+K nav palette behind the icon-box
 * search trigger. The topbar quick-create is GONE in v3 (creates live in each
 * page's content header).
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompanyFyProvider } from "@/providers/company-fy-provider";
import { ToastProvider } from "@/components/ui/toast";
import { CompanyFySwitcher } from "@/components/shell/company-fy-switcher";
import { AlertsBell } from "@/components/shell/alerts-bell";
import { UserMenu } from "@/components/shell/user-menu";
import { NavCommand } from "@/components/shell/nav-command";
import * as shellData from "@/lib/shell/shell-data";

const pushMock = jest.fn();
const replaceMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, refresh: jest.fn() }),
  usePathname: () => "/dashboard",
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/lib/shell/shell-data", () => ({
  useShellMasters: jest.fn(),
  useAlertCount: jest.fn(),
}));

const useShellMasters = shellData.useShellMasters as jest.Mock;
const useAlertCount = shellData.useAlertCount as jest.Mock;

function Providers({ children, client }: { children: React.ReactNode; client?: QueryClient }) {
  const qc = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <CompanyFyProvider initial={{ companyId: "c1", financialYearId: "fy-2025" }}>
        <ToastProvider>{children}</ToastProvider>
      </CompanyFyProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  pushMock.mockClear();
  replaceMock.mockClear();
  useShellMasters.mockReturnValue({
    data: {
      company: { id: "c1", name: "Zakir Enterprise" },
      financialYears: [
        { id: "fy-2025", label: "FY 2025–26", isActive: true },
        { id: "fy-2024", label: "FY 2024–25", isActive: false },
      ],
    },
    isLoading: false,
    isError: false,
  });
  useAlertCount.mockReturnValue({ count: null });
});

describe("Company·FY switcher (spec §5/§6/§7)", () => {
  it("chip shows resolved company name + FY label (not UUID slices)", async () => {
    render(
      <Providers>
        <CompanyFySwitcher />
      </Providers>,
    );
    await waitFor(() => {
      const chip = screen.getByTestId("company-fy");
      expect(chip).toHaveTextContent("Zakir Enterprise");
      expect(chip).toHaveTextContent("FY 2025–26");
    });
  });

  it("degrades to short IDs + a 'Names unavailable' tooltip when masters fails", () => {
    useShellMasters.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(
      <Providers>
        <CompanyFySwitcher />
      </Providers>,
    );
    const chip = screen.getByTestId("company-fy");
    expect(chip).toHaveAttribute("title", "Names unavailable");
    expect(chip).toHaveTextContent("Co c1");
    expect(chip).toHaveTextContent("FY fy-2025");
  });

  it("company select is read-only (single-company setup)", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <CompanyFySwitcher />
      </Providers>,
    );
    await user.click(screen.getByTestId("company-fy"));
    const popover = screen.getByTestId("company-fy-popover");
    expect(within(popover).getByLabelText(/single-company setup/i)).toBeDisabled();
  });

  it("switching FY invalidates all queries + toasts", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = jest.spyOn(qc, "invalidateQueries");
    render(
      <Providers client={qc}>
        <CompanyFySwitcher />
      </Providers>,
    );
    await user.click(screen.getByTestId("company-fy"));
    await user.selectOptions(screen.getByTestId("switcher-fy-select"), "fy-2024");
    await user.click(screen.getByTestId("switcher-apply"));
    expect(invalidate).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Financial year switched to FY 2024–25\./)).toBeInTheDocument());
  });

  it("Apply is disabled until the FY selection changes", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <CompanyFySwitcher />
      </Providers>,
    );
    await user.click(screen.getByTestId("company-fy"));
    expect(screen.getByTestId("switcher-apply")).toBeDisabled();
    await user.selectOptions(screen.getByTestId("switcher-fy-select"), "fy-2024");
    expect(screen.getByTestId("switcher-apply")).toBeEnabled();
  });
});

describe("Quick-create (+ New) — dropped from the topbar in v3 (spec §5/§5a)", () => {
  it("the quick-create-menu component no longer exists (creates live in page headers)", () => {
    // The module was deleted; requiring it must fail. This pins the v3 reversal.
    expect(() => require("@/components/shell/quick-create-menu")).toThrow();
  });
});

describe("Alerts bell (spec §5/§6/§14-2)", () => {
  it("renders for a CC role and degrades to a plain bell (no badge) while CC unbuilt", () => {
    useAlertCount.mockReturnValue({ count: null });
    render(
      <Providers>
        <AlertsBell role="ACCOUNTS_TEAM" />
      </Providers>,
    );
    expect(screen.getByTestId("alerts-bell")).toBeInTheDocument();
    expect(screen.queryByTestId("alerts-badge")).not.toBeInTheDocument();
  });

  it("does NOT render for a non-CC role (Site Engineer)", () => {
    render(
      <Providers>
        <AlertsBell role="SITE_ENGINEER" />
      </Providers>,
    );
    expect(screen.queryByTestId("alerts-bell")).not.toBeInTheDocument();
  });
});

describe("User menu — sidebar footer, opens upward (v3 spec §5/§8/§10)", () => {
  const menuUser = { name: "Sadia Rahman", role: "ACCOUNTS_TEAM" as const, email: "sadia@ze.test" };

  it("identity header shows name · role · email; Change password navigates", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <UserMenu user={menuUser} />
      </Providers>,
    );
    const trigger = screen.getByTestId("user-menu");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await user.click(trigger);
    expect(await screen.findByTestId("user-menu-email")).toHaveTextContent("sadia@ze.test");
    await user.click(screen.getByTestId("user-menu-change-password"));
    expect(pushMock).toHaveBeenCalledWith("/change-password");
  });

  it("rail variant collapses to the avatar only (no name/role text on the trigger)", () => {
    render(
      <Providers>
        <UserMenu user={menuUser} variant="rail" />
      </Providers>,
    );
    const trigger = screen.getByTestId("user-menu");
    expect(trigger).not.toHaveTextContent("Sadia Rahman");
    expect(trigger).toHaveAttribute("aria-label", "Account — Sadia Rahman");
  });
});

describe("Ctrl+K nav palette (spec §5/§9/§14-1)", () => {
  it("opens on the trigger, filters nav items, and navigates on click", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <NavCommand role="ADMIN" />
      </Providers>,
    );
    await user.click(screen.getByTestId("nav-search-trigger"));
    const input = await screen.findByTestId("nav-command-input");
    await user.type(input, "trial");
    await user.click(await screen.findByTestId("nav-command-item-/ledger/trial-balance"));
    expect(pushMock).toHaveBeenCalledWith("/ledger/trial-balance");
  });

  it("surfaces every navigable nav destination (incl. Coming-soon placeholders)", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <NavCommand role="ADMIN" />
      </Providers>,
    );
    await user.click(screen.getByTestId("nav-search-trigger"));
    await user.type(await screen.findByTestId("nav-command-input"), "IPC");
    // /sales/ipcs is now navigable (routes to its Coming-soon page) → the palette
    // lists it rather than showing "No matches."
    expect(await screen.findByTestId("nav-command-item-/sales/ipcs")).toBeInTheDocument();
  });
});
