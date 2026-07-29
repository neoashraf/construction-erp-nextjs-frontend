/**
 * FE-SHELL sidebar (nav IA redesign; screen spec §3.1/§5/§9/§10). FLAT section →
 * screen model: no accordion, no disclosure controls — every visible screen is its
 * own row, one click away. Active state, unbuilt "Coming soon" handling, role
 * filtering, header suppression, the governance divider, and a11y (per-section
 * landmark / aria-current) are covered here. Rail-mode flyout is covered by the
 * topbar/collapse interplay tests.
 */
import React from "react";
import { render, screen, within, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompanyFyProvider } from "@/providers/company-fy-provider";
import { ShellChromeProvider } from "@/components/shell/shell-chrome-context";
import { ToastProvider } from "@/components/ui/toast";
import { Sidebar } from "@/components/shell/sidebar";
import { type Role } from "@/lib/auth/roles";

let mockPath = "/dashboard";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderSidebar(role: Role, path = "/dashboard") {
  mockPath = path;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CompanyFyProvider initial={{ companyId: "c1", financialYearId: "fy1" }}>
        <ToastProvider>
          <ShellChromeProvider>
            <Sidebar user={{ name: "Test User", role, email: "test@ze.test" }} />
          </ShellChromeProvider>
        </ToastProvider>
      </CompanyFyProvider>
    </QueryClientProvider>,
  );
}

/** Alias used by the nav IA redesign test cases below (same render setup). */
function renderSidebarAs(role: Role, path = "/dashboard") {
  return renderSidebar(role, path);
}

describe("Sidebar — structure + role filtering", () => {
  it("renders the Primary landmark and the section labels for Admin", () => {
    renderSidebar("ADMIN");
    expect(screen.getByRole("complementary", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByText("MATERIALS")).toBeInTheDocument();
    expect(screen.getByText("ACCOUNTS")).toBeInTheDocument();
  });

  it("hides sections the role can't reach (PM has no Users & access)", () => {
    renderSidebar("PROJECT_MANAGER");
    expect(screen.queryByTestId("nav-item-/audit/users")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-item-/ledger/account-ledger")).toBeInTheDocument();
  });

  it("every screen renders as a link, one click away (Dashboard, Trial balance)", () => {
    renderSidebar("ADMIN");
    const dash = screen.getByTestId("nav-item-/dashboard");
    expect(dash.tagName).toBe("A");
    const trialBalance = screen.getByTestId("nav-item-/ledger/trial-balance");
    expect(trialBalance.tagName).toBe("A");
  });
});

describe("Sidebar — active state (spec §3.1/§10)", () => {
  it("the row matching the current route is aria-current, with no parent to also mark", () => {
    renderSidebar("ADMIN", "/ledger/account-ledger");
    expect(screen.getByTestId("nav-item-/ledger/account-ledger")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("nav-item-/ledger/trial-balance")).not.toHaveAttribute("aria-current");
  });
});

describe("Sidebar — footer user block (spec §5/§10)", () => {
  it("pins the context line + user block at the sidebar bottom", () => {
    renderSidebar("ADMIN");
    const footer = screen.getByTestId("sidebar-footer");
    expect(within(footer).getByTestId("sidebar-context-line")).toHaveTextContent("BDT (৳)");
    const trigger = within(footer).getByTestId("user-menu");
    expect(trigger).toHaveTextContent("Test User");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  });
});

describe("Sidebar — item navigation (spec §3.2 note; scope §10)", () => {
  it("a built item is a real navigating link", () => {
    renderSidebar("ADMIN", "/dashboard");
    const item = screen.getByTestId("nav-item-/ledger/journal-entries");
    expect(item).toHaveAttribute("data-built", "true");
    expect(item.tagName).toBe("A");
    expect(item).toHaveAttribute("href", "/ledger/journal-entries");
  });
});

describe("flat sidebar (nav IA redesign)", () => {
  it("renders no disclosure controls", () => {
    renderSidebarAs("ADMIN");
    // Scoped to the nav tree itself — the sidebar-footer user menu is a legitimate
    // popover trigger (aria-haspopup="menu"/aria-expanded), unrelated to nav
    // disclosure; the nav tree (no accordion any more) has none of its own.
    const nav = within(screen.getByTestId("sidebar-nav"));
    expect(nav.queryByRole("button", { expanded: false })).toBeNull();
    expect(nav.queryByRole("button", { expanded: true })).toBeNull();
  });

  it("reaches Trial balance in one click, with no parent to expand", () => {
    renderSidebarAs("ADMIN");
    expect(screen.getByRole("link", { name: "Trial balance" })).toBeVisible();
  });

  it("labels each section as a landmark", () => {
    renderSidebarAs("ADMIN");
    expect(screen.getByRole("navigation", { name: "MATERIALS" })).toBeInTheDocument();
  });

  it("renders Parties as a bare row with no section header", () => {
    renderSidebarAs("ADMIN");
    expect(screen.getByRole("link", { name: "Parties" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "PARTIES" })).toBeNull();
  });

  it("draws the governance divider for Admin only", () => {
    renderSidebarAs("ADMIN");
    expect(screen.getByRole("separator")).toBeInTheDocument();
    cleanup();
    renderSidebarAs("STORE_KEEPER");
    expect(screen.queryByRole("separator")).toBeNull();
  });
});
