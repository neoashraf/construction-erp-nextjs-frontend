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
import { visibleTreeForRole } from "@/lib/nav/nav-tree";

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

  it("labels EVERY visible section as its own navigation landmark (spec §10)", () => {
    renderSidebarAs("ADMIN");
    const admin = visibleTreeForRole("ADMIN");
    // Loop over the full Admin tree — not just one section — so a future section
    // that regresses (or loses its landmark) fails here rather than slipping
    // through on a single hand-picked example.
    for (const group of admin) {
      expect(screen.getByRole("navigation", { name: group.section })).toBeInTheDocument();
    }
  });

  it("renders Parties as a bare row — but its landmark still exists, visually hidden (spec §10)", () => {
    renderSidebarAs("ADMIN");
    // Visible: still a bare row, no visible header — header suppression (§3.1) is a
    // VISUAL fix only. Semantically the section remains its own `nav` landmark
    // (§10: "a section that suppresses its visible header still carries a
    // visually-hidden label so the landmark name survives") so screen-reader
    // landmark traversal still reaches it.
    expect(screen.getByRole("link", { name: "Parties" })).toBeVisible();
    const partiesNav = screen.getByRole("navigation", { name: "PARTIES" });
    expect(partiesNav).toBeInTheDocument();
    // The heading text is present in the accessibility tree (names the landmark)
    // but not visually rendered — no on-screen "PARTIES" header above the row.
    const heading = within(partiesNav).getByText("PARTIES");
    expect(heading).toHaveClass("sr-only");
  });

  it("draws the governance divider for Admin only", () => {
    renderSidebarAs("ADMIN");
    expect(screen.getByRole("separator")).toBeInTheDocument();
    cleanup();
    renderSidebarAs("STORE_KEEPER");
    expect(screen.queryByRole("separator")).toBeNull();
  });
});

describe("Sidebar — rail mode (collapsed, spec §4/§9/§10)", () => {
  beforeEach(() => {
    // ShellChromeProvider hydrates `collapsed` from localStorage on mount.
    window.localStorage.setItem("ze.shell.sidebarCollapsed", "1");
  });
  afterEach(() => {
    window.localStorage.removeItem("ze.shell.sidebarCollapsed");
  });

  it("every visible section is STILL its own navigation landmark when collapsed to the icon rail", () => {
    renderSidebarAs("ADMIN");
    const admin = visibleTreeForRole("ADMIN");
    for (const group of admin) {
      expect(screen.getByRole("navigation", { name: group.section })).toBeInTheDocument();
    }
  });

  it("a rail section icon is reachable inside its section's landmark", () => {
    renderSidebarAs("ADMIN");
    const materialsNav = screen.getByRole("navigation", { name: "MATERIALS" });
    expect(within(materialsNav).getByTestId("nav-rail-materials")).toBeInTheDocument();
  });

  // A one-item section renders as a direct link with NO flyout, so the rail link is the only
  // place its destination can be announced. It must say the item's name, not the section's —
  // they differ exactly when spec §3.1 would have kept the header.
  it("a one-item section's rail link announces the DESTINATION, not the section label", () => {
    // Site Engineer sees MATERIALS → Requisitions and PEOPLE → Attendance, both one-item.
    renderSidebarAs("SITE_ENGINEER");

    expect(screen.getByRole("link", { name: "Requisitions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Attendance" })).toBeInTheDocument();
    // The section strings must NOT be what the links announce.
    expect(screen.queryByRole("link", { name: "MATERIALS" })).toBeNull();
    expect(screen.queryByRole("link", { name: "PEOPLE" })).toBeNull();
  });
});
