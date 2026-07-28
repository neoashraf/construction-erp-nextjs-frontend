/**
 * Shell session avatar (AUD self-service slice — FR-AUD-038/-043; app-shell spec
 * §5 sidebar-footer user block, §6 states).
 *
 * Regression guard for the reported bug: a user uploaded a profile photo, it showed
 * on My profile, and the sidebar-footer block kept rendering initials. Two defects —
 * the BFF dropped `avatarUrl` out of the session projection, and `UserMenu` had no
 * `<img>` branch at all. These tests pin both ends: the shared `Avatar` primitive's
 * photo/initials/broken-image behaviour, and that `UserMenu` actually renders the
 * session photo in every variant (footer / rail / drawer).
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Avatar, deriveInitials } from "@/components/ui/avatar";
import { UserMenu } from "@/components/shell/user-menu";
import { ToastProvider } from "@/components/ui/toast";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));

const PHOTO = "https://res.cloudinary.com/zakir-erp/image/upload/v1/companies/c1/avatars/u1.webp";

function renderUserMenu(
  props: Partial<React.ComponentProps<typeof UserMenu>["user"]> = {},
  variant: "footer" | "rail" | "drawer" = "footer",
) {
  return render(
    <ToastProvider>
      <UserMenu
        user={{ name: "Admin User", role: "ADMIN", email: "admin@ze.local", ...props }}
        variant={variant}
      />
    </ToastProvider>,
  );
}

describe("Avatar primitive — photo vs initials (FR-AUD-038)", () => {
  it("renders the photo with a descriptive alt when avatarUrl is set", () => {
    render(<Avatar name="Admin User" avatarUrl={PHOTO} testId="a" />);
    const img = screen.getByAltText("Profile photo of Admin User") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe(PHOTO);
    expect(screen.queryByText("AU")).not.toBeInTheDocument();
  });

  it("renders the labelled initials disc when avatarUrl is null", () => {
    render(<Avatar name="Admin User" avatarUrl={null} initialsTestId="i" />);
    expect(screen.getByTestId("i")).toHaveTextContent("AU");
    expect(screen.getByRole("img", { name: "No photo — initials AU" })).toBeInTheDocument();
  });

  it("renders initials when avatarUrl is undefined (session snapshot predating the field)", () => {
    render(<Avatar name="Admin User" avatarUrl={undefined} initialsTestId="i" />);
    expect(screen.getByTestId("i")).toHaveTextContent("AU");
  });

  // Spec §6: a dead CDN URL degrades to initials, never a broken-image glyph.
  it("falls back to initials when the image fails to load", () => {
    render(<Avatar name="Admin User" avatarUrl={PHOTO} initialsTestId="i" />);
    fireEvent.error(screen.getByAltText("Profile photo of Admin User"));
    expect(screen.getByTestId("i")).toHaveTextContent("AU");
    expect(screen.queryByAltText(/Profile photo/)).not.toBeInTheDocument();
  });

  it("uses the requested pixel size and scales the initials with it", () => {
    render(<Avatar name="Admin User" avatarUrl={null} size={96} initialsTestId="i" />);
    const disc = screen.getByTestId("i");
    expect(disc).toHaveStyle({ width: "96px", height: "96px" });
  });
});

describe("deriveInitials — grapheme-safe (overview §9 Bangla is UTF-8, never truncated)", () => {
  it.each([
    ["Admin User", "AU"],
    ["Rafiq", "R"],
    ["  spaced   out  ", "SO"],
    ["Three Part Name", "TP"],
    ["", ""],
  ])("%s → %s", (name, expected) => {
    expect(deriveInitials(name)).toBe(expected);
  });

  // The old shell implementation used `p[0]`, a UTF-16 code-unit slice, which
  // splits Bangla graphemes. `Array.from` iterates code points instead.
  it("keeps a Bangla name's leading characters whole", () => {
    expect(deriveInitials("রফিক আহমেদ")).toBe("রআ");
  });
});

describe("UserMenu — the sidebar-footer block renders the session photo", () => {
  it("footer: shows the photo when the session carries avatarUrl", () => {
    renderUserMenu({ avatarUrl: PHOTO });
    const trigger = screen.getByTestId("user-menu");
    expect(within(trigger).getByAltText("Profile photo of Admin User")).toBeInTheDocument();
  });

  it("footer: shows initials when the user has no photo", () => {
    renderUserMenu({ avatarUrl: null });
    const trigger = screen.getByTestId("user-menu");
    expect(within(trigger).getByRole("img", { name: /initials AU/ })).toBeInTheDocument();
    expect(within(trigger).queryByAltText(/Profile photo/)).not.toBeInTheDocument();
  });

  // Rail = the collapsed 56px sidebar, where the avatar is the trigger's only content.
  it("rail: shows the photo and keeps the account aria-label on the trigger", () => {
    renderUserMenu({ avatarUrl: PHOTO }, "rail");
    const trigger = screen.getByTestId("user-menu");
    expect(trigger).toHaveAccessibleName("Account — Admin User");
    expect(within(trigger).getByAltText("Profile photo of Admin User")).toBeInTheDocument();
  });

  it("drawer: shows the photo (mobile drawer bottom)", () => {
    renderUserMenu({ avatarUrl: PHOTO }, "drawer");
    const trigger = screen.getByTestId("user-menu");
    expect(within(trigger).getByAltText("Profile photo of Admin User")).toBeInTheDocument();
  });

  it("shows the photo in the popover identity header too (spec §5)", async () => {
    renderUserMenu({ avatarUrl: PHOTO });
    await userEvent.click(screen.getByTestId("user-menu"));
    expect(await screen.findByTestId("user-menu-email")).toHaveTextContent("admin@ze.local");
    // Trigger + identity header both render the disc.
    expect(screen.getAllByAltText("Profile photo of Admin User")).toHaveLength(2);
  });

  it("still offers My profile — where the photo is managed", async () => {
    renderUserMenu({ avatarUrl: null });
    await userEvent.click(screen.getByTestId("user-menu"));
    expect(await screen.findByTestId("user-menu-my-profile")).toBeInTheDocument();
  });
});
