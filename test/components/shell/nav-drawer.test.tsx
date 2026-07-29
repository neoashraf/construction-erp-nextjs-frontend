/**
 * FE-SHELL mobile nav drawer (nav IA redesign; screen spec §3.1/§4 responsive/§9/§10).
 * Same flat, role-filtered tree as the desktop sidebar, opened as a Radix Dialog at
 * <768. Covers header suppression (bare row, landmark still present), the divider,
 * per-section landmarks, and the empty-nav copy — mobile is the surface a Site
 * Engineer actually uses, and this file had no coverage at all until now.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShellChromeProvider, useShellChrome } from "@/components/shell/shell-chrome-context";
import { ToastProvider } from "@/components/ui/toast";
import { NavDrawer } from "@/components/shell/nav-drawer";
import { type Role } from "@/lib/auth/roles";
import { visibleTreeForRole } from "@/lib/nav/nav-tree";
import { type SessionPermission } from "@/lib/auth/session";

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

/** Opens the drawer via the same `setDrawerOpen` the topbar hamburger calls. */
function OpenDrawerButton() {
  const { setDrawerOpen } = useShellChrome();
  return (
    <button type="button" onClick={() => setDrawerOpen(true)}>
      Open menu
    </button>
  );
}

async function renderOpenDrawer(
  role: Role,
  path = "/dashboard",
  permissions?: SessionPermission[] | null,
) {
  mockPath = path;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <ShellChromeProvider>
          <OpenDrawerButton />
          <NavDrawer user={{ name: "Test User", role, email: "test@ze.test", permissions }} />
        </ShellChromeProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  // The drawer's own mount effect (`useEffect(() => setDrawerOpen(false), [pathname])`)
  // fires once on mount and closes it; open AFTER mount so the click is the last word.
  await user.click(screen.getByText("Open menu"));
  return { user };
}

describe("NavDrawer — structure + role filtering (spec §4/§9)", () => {
  it("opens as a dialog with the role-filtered tree, same shape as the sidebar", async () => {
    await renderOpenDrawer("ADMIN");
    expect(screen.getByTestId("nav-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-/dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-/ledger/trial-balance")).toBeInTheDocument();
  });

  it("hides sections the role can't reach (Site Engineer: 3 rows, no Users & access)", async () => {
    await renderOpenDrawer("SITE_ENGINEER");
    expect(screen.queryByTestId("nav-item-/audit/users")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-item-/requisitions")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-/hr/attendance")).toBeInTheDocument();
  });
});

describe("NavDrawer — header suppression stays a landmark (spec §3.1/§10)", () => {
  it("PARTIES renders as a bare row visually, but keeps its own nav landmark", async () => {
    await renderOpenDrawer("ADMIN");
    expect(screen.getByRole("link", { name: "Parties" })).toBeVisible();
    const partiesNav = screen.getByRole("navigation", { name: "PARTIES" });
    expect(partiesNav).toBeInTheDocument();
    // The heading is a chip-icon + label row wrapped in one `sr-only` container
    // (nav-drawer.tsx `DrawerSection`) — the class lives on the wrapping div, the
    // text itself is a nested `<span>`.
    expect(within(partiesNav).getByText("PARTIES").parentElement).toHaveClass("sr-only");
  });

  it("labels every visible Admin section as its own navigation landmark", async () => {
    await renderOpenDrawer("ADMIN");
    for (const group of visibleTreeForRole("ADMIN")) {
      expect(screen.getByRole("navigation", { name: group.section })).toBeInTheDocument();
    }
  });
});

describe("NavDrawer — governance divider (spec §3.1/§9.3)", () => {
  it("draws the divider for Admin (governance sections visible) only", async () => {
    await renderOpenDrawer("ADMIN");
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("omits the divider for a role with no governance sections visible", async () => {
    await renderOpenDrawer("STORE_KEEPER");
    expect(screen.queryByRole("separator")).toBeNull();
  });
});

describe("NavDrawer — empty nav (spec §6)", () => {
  it("shows 'No screens available for your role.' when the viewer has zero visible items", async () => {
    await renderOpenDrawer("PROJECT_MANAGER", "/dashboard", []);
    expect(screen.getByText("No screens available for your role.")).toBeInTheDocument();
  });
});
