/**
 * FE-SHELL app shell integration (screen spec §4/§6/§10). Skip-link, landmarks,
 * role-filtered nav inside the real frame, the user menu (replacing the old Sign-out
 * button), and the breadcrumb. Sub-component behaviour is covered by sidebar/toolbar
 * tests; this asserts the assembled shell.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
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

  it("replaces the standalone Sign-out button with the user menu (name shown)", () => {
    renderShell(baseUser);
    expect(screen.queryByTestId("logout-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("user-menu")).toHaveTextContent("Test User");
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

describe("AppShell v2 — breadcrumb (spec §3.3)", () => {
  it("renders the Module › Screen trail derived from the active route", () => {
    renderShell(baseUser, "/ledger/trial-balance");
    const crumb = screen.getByTestId("breadcrumb");
    expect(crumb).toHaveTextContent("Ledger");
    expect(crumb).toHaveTextContent("Trial balance");
  });
});
