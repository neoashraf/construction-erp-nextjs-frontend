import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/shell/app-shell";
import { SessionProvider } from "@/providers/session-provider";
import { CompanyFyProvider } from "@/providers/company-fy-provider";
import { type SafeUser } from "@/lib/auth/session";

// next/link → passthrough anchor; next/navigation → router stub (LogoutButton uses useRouter).
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));

function renderShell(user: SafeUser) {
  return render(
    <CompanyFyProvider initial={{ companyId: user.companyId, financialYearId: user.financialYearId }}>
      <SessionProvider user={user}>
        <AppShell>
          <div data-testid="child">content</div>
        </AppShell>
      </SessionProvider>
    </CompanyFyProvider>,
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

describe("AppShell — role-based shell", () => {
  it("renders the topbar with the user + role and the children", () => {
    renderShell(baseUser);
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.getByTestId("topbar-user")).toHaveTextContent("Test User");
    expect(screen.getByTestId("topbar-user")).toHaveTextContent("Admin");
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("shows nav slots for an Admin's modules (and the audit module)", () => {
    renderShell(baseUser);
    expect(screen.getByTestId("nav-audit")).toBeInTheDocument();
    expect(screen.getByTestId("nav-ledger")).toBeInTheDocument();
  });

  it("hides modules a role can't access (PM has no audit nav)", () => {
    renderShell({ ...baseUser, role: "PROJECT_MANAGER", assignedProjectIds: ["p1"] });
    expect(screen.queryByTestId("nav-audit")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-ledger")).toBeInTheDocument();
  });

  it("shows an empty-state when a role has no modules", () => {
    renderShell({ ...baseUser, role: "SITE_ENGINEER" });
    expect(screen.getByTestId("sidebar-empty")).toBeInTheDocument();
  });
});
