/**
 * FE-SHELL sidebar (screen spec §3.1/§5/§9/§10). Two-level accordion, active state,
 * unbuilt "Coming soon" handling, role filtering, and a11y (landmark / aria-expanded /
 * aria-current). Rail-mode flyout is covered by the topbar/collapse interplay tests.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompanyFyProvider } from "@/providers/company-fy-provider";
import { ShellChromeProvider } from "@/components/shell/shell-chrome-context";
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
        <ShellChromeProvider>
          <Sidebar role={role} />
        </ShellChromeProvider>
      </CompanyFyProvider>
    </QueryClientProvider>,
  );
}

describe("Sidebar — structure + role filtering", () => {
  it("renders the Primary landmark and the section labels for Admin", () => {
    renderSidebar("ADMIN");
    expect(screen.getByRole("complementary", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByText("TRANSACTIONS")).toBeInTheDocument();
    expect(screen.getByText("ADMINISTRATION")).toBeInTheDocument();
  });

  it("hides modules the role can't reach (PM has no Audit & access)", () => {
    renderSidebar("PROJECT_MANAGER");
    expect(screen.queryByTestId("nav-module-audit")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-module-ledger")).toBeInTheDocument();
  });

  it("single-screen modules render as direct links (Dashboard, Numbering)", () => {
    renderSidebar("ADMIN");
    const dash = screen.getByTestId("nav-module-dashboard");
    expect(dash.tagName).toBe("A");
    const numbering = screen.getByTestId("nav-module-numbering");
    expect(numbering.tagName).toBe("A");
  });
});

describe("Sidebar — accordion (spec §3.1/§9)", () => {
  it("multi-screen module is a disclosure button with aria-expanded", async () => {
    const user = userEvent.setup();
    renderSidebar("ADMIN", "/dashboard"); // ledger group starts collapsed
    const ledger = screen.getByTestId("nav-module-ledger");
    expect(ledger.tagName).toBe("BUTTON");
    expect(ledger).toHaveAttribute("aria-expanded", "false");
    await user.click(ledger);
    expect(ledger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("nav-item-/ledger/journal-entries")).toBeVisible();
  });

  it("opening one module collapses the previously open one (accordion)", async () => {
    const user = userEvent.setup();
    renderSidebar("ADMIN", "/dashboard");
    const ledger = screen.getByTestId("nav-module-ledger");
    const masterData = screen.getByTestId("nav-module-master-data");
    await user.click(ledger);
    expect(ledger).toHaveAttribute("aria-expanded", "true");
    await user.click(masterData);
    expect(masterData).toHaveAttribute("aria-expanded", "true");
    expect(ledger).toHaveAttribute("aria-expanded", "false");
  });

  it("auto-expands the group containing the active route on load", () => {
    renderSidebar("ADMIN", "/ledger/trial-balance");
    const ledger = screen.getByTestId("nav-module-ledger");
    expect(ledger).toHaveAttribute("aria-expanded", "true");
    // active sub-item carries aria-current="page"
    expect(screen.getByTestId("nav-item-/ledger/trial-balance")).toHaveAttribute("aria-current", "page");
  });
});

describe("Sidebar — active state (spec §3.1/§10)", () => {
  it("a direct-link module on its route is aria-current", () => {
    renderSidebar("ADMIN", "/numbering");
    expect(screen.getByTestId("nav-module-numbering")).toHaveAttribute("aria-current", "page");
  });

  it("the active sub-item's parent module row shows active but is NOT itself aria-current", () => {
    renderSidebar("ADMIN", "/ledger/account-ledger");
    const ledger = screen.getByTestId("nav-module-ledger");
    expect(ledger).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("nav-item-/ledger/account-ledger")).toHaveAttribute("aria-current", "page");
  });
});

describe("Sidebar — unbuilt handling (spec §3.2 note; scope §10)", () => {
  it("an unbuilt sub-item renders de-emphasised + non-navigating (no link, Coming soon)", async () => {
    const user = userEvent.setup();
    renderSidebar("ADMIN", "/dashboard");
    await user.click(screen.getByTestId("nav-module-sales")); // expand Sales / IPC (all unbuilt)
    const item = screen.getByTestId("nav-item-/sales/ipcs");
    expect(item).toHaveAttribute("data-built", "false");
    expect(item.tagName).not.toBe("A");
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("title", "Coming soon");
  });

  it("a built sub-item is a real navigating link", async () => {
    const user = userEvent.setup();
    renderSidebar("ADMIN", "/dashboard");
    await user.click(screen.getByTestId("nav-module-ledger"));
    const item = screen.getByTestId("nav-item-/ledger/journal-entries");
    expect(item).toHaveAttribute("data-built", "true");
    expect(item.tagName).toBe("A");
    expect(item).toHaveAttribute("href", "/ledger/journal-entries");
  });
});
