/**
 * FE-SHELL v3 app shell integration (screen spec §3.3/§4/§6/§10). Skip-link,
 * landmarks, role-filtered nav inside the real frame, the GLOBAL-ONLY topbar (no
 * user block / no "+ New" / no list-page breadcrumb), the sidebar-footer profile
 * block, and the detail-only breadcrumb in the content area. Sub-component behaviour
 * is covered by sidebar/toolbar tests; this asserts the assembled shell.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { useSetRecordCrumb } from "@/components/shell/breadcrumb";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/app-shell";
import { SessionProvider } from "@/providers/session-provider";
import { CompanyFyProvider } from "@/providers/company-fy-provider";
import { ToastProvider } from "@/components/ui/toast";
import { type SafeUser } from "@/lib/auth/session";

let mockPath = "/dashboard";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
  usePathname: () => mockPath,
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
  useShellMasters: () => ({
    data: { company: { id: "c1", name: "Zakir Enterprise" }, financialYears: [{ id: "fy1", label: "FY 2025–26", isActive: true }] },
    isLoading: false,
    isError: false,
  }),
  useAlertCount: () => ({ count: null }),
}));

function renderShell(user: SafeUser, path = "/dashboard") {
  mockPath = path;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CompanyFyProvider initial={{ companyId: user.companyId, financialYearId: user.financialYearId }}>
        <SessionProvider user={user}>
          <ToastProvider>
            <AppShell>
              <div data-testid="child">content</div>
            </AppShell>
          </ToastProvider>
        </SessionProvider>
      </CompanyFyProvider>
    </QueryClientProvider>,
  );
}

const baseUser: SafeUser = {
  id: "u1",
  email: "x@ze.test",
  name: "Test User",
  role: "ADMIN",
  companyId: "11111111-1111-1111-1111-111111111111",
  financialYearId: "22222222-2222-2222-2222-222222222222",
  isActive: true,
  assignedProjectIds: [],
};

describe("AppShell v2 — frame + landmarks (spec §4/§10)", () => {
  it("renders the skip link as the first tabbable element → #app-content", () => {
    renderShell(baseUser);
    const skip = screen.getByText("Skip to content");
    expect(skip).toHaveAttribute("href", "#app-content");
  });

  it("exposes the main, header, and Primary sidebar landmarks + renders children", () => {
    renderShell(baseUser);
    expect(screen.getByTestId("app-content")).toBeInTheDocument();
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("docks the user/profile block in the SIDEBAR FOOTER (not the topbar) — v3", () => {
    renderShell(baseUser);
    expect(screen.queryByTestId("logout-button")).not.toBeInTheDocument();
    const footer = screen.getByTestId("sidebar-footer");
    expect(within(footer).getByTestId("user-menu")).toHaveTextContent("Test User");
    expect(within(screen.getByTestId("topbar")).queryByTestId("user-menu")).not.toBeInTheDocument();
  });

  it("topbar is GLOBAL-ONLY: collapse toggle · switcher · search · bell — no '+ New', no user block, no breadcrumb", () => {
    renderShell(baseUser);
    const topbar = screen.getByTestId("topbar");
    expect(within(topbar).getByTestId("collapse-toggle")).toBeInTheDocument();
    expect(within(topbar).getByTestId("company-fy")).toBeInTheDocument();
    expect(within(topbar).getByTestId("nav-search-trigger")).toBeInTheDocument();
    expect(within(topbar).getByTestId("alerts-bell")).toBeInTheDocument();
    expect(within(topbar).queryByTestId("quick-create")).not.toBeInTheDocument();
    expect(within(topbar).queryByTestId("user-menu")).not.toBeInTheDocument();
    expect(within(topbar).queryByTestId("breadcrumb")).not.toBeInTheDocument();
  });
});

describe("AppShell v2 — role-filtered nav in the frame (spec §11)", () => {
  it("Admin sees the Ledger + Audit modules", () => {
    renderShell(baseUser);
    expect(screen.getByTestId("nav-module-ledger")).toBeInTheDocument();
    expect(screen.getByTestId("nav-module-audit")).toBeInTheDocument();
  });

  it("a PM does not see Audit & access, but does see Ledger", () => {
    renderShell({ ...baseUser, role: "PROJECT_MANAGER", assignedProjectIds: ["p1"] }, "/ledger/account-ledger");
    expect(screen.queryByTestId("nav-module-audit")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-module-ledger")).toBeInTheDocument();
  });

  it("every role has Dashboard (no empty-nav in Phase 1) — Site Engineer included", () => {
    renderShell({ ...baseUser, role: "SITE_ENGINEER" });
    expect(screen.getByTestId("nav-module-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-empty")).not.toBeInTheDocument();
  });
});

/** A stand-in detail screen that feeds a record crumb (like a viewer page does). */
function DetailChild() {
  useSetRecordCrumb("PB-2025-000123");
  return <div data-testid="detail-child">detail</div>;
}

describe("AppShell v3 — breadcrumb is detail-only, in the content area (spec §3.3)", () => {
  it("a flat list page renders NO breadcrumb (H1 is the identity)", () => {
    renderShell(baseUser, "/ledger/trial-balance");
    expect(screen.queryByTestId("breadcrumb")).not.toBeInTheDocument();
  });

  it("a detail page's record crumb renders `Screen › Record` inside the content, never starting at a section", () => {
    mockPath = "/ledger/journal-entries/abc";
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <CompanyFyProvider initial={{ companyId: baseUser.companyId, financialYearId: baseUser.financialYearId }}>
          <SessionProvider user={baseUser}>
            <ToastProvider>
              <AppShell>
                <DetailChild />
              </AppShell>
            </ToastProvider>
          </SessionProvider>
        </CompanyFyProvider>
      </QueryClientProvider>,
    );
    const content = screen.getByTestId("app-content");
    const crumb = within(content).getByTestId("breadcrumb");
    expect(crumb).toHaveTextContent("Journal entries");
    expect(crumb).toHaveTextContent("PB-2025-000123");
    expect(crumb).not.toHaveTextContent("LEDGER & REPORTS"); // never a section name
    expect(crumb).not.toHaveTextContent(/^Ledger\s*›/); // nor the module label
  });
});
