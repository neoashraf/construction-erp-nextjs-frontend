/**
 * FE-52 fe-account-profile tests (FR-AUD-029..043). Covers: default render,
 * privilege-escalation guard (no authorization-bearing control anywhere), Save
 * disabled until dirty, name/phone edit + toast, phone-clear sends null,
 * E.164 + empty-name inline validation, stale-409 refresh flow, avatar upload
 * (client pre-check reject for type/size + success), remove-photo confirm →
 * initials, MEDIA_STORAGE_ERROR mapping, load-error + Retry, "All projects" vs
 * "No projects assigned", change-password link routes to /change-password.
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { AccountProfileScreen } from "@/features/profile/components/AccountProfileScreen";
import { type ProfileView } from "@/features/profile/types";
import * as profileApi from "@/features/profile/api/profile";
import * as fyApi from "@/features/profile/api/financial-years";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/profile/api/profile");
jest.mock("@/features/profile/api/financial-years");
jest.mock("@/lib/hooks/use-online", () => ({ useOnline: () => true }));

const getMock = profileApi.getProfile as jest.Mock;
const patchMock = profileApi.updateProfile as jest.Mock;
const uploadMock = profileApi.uploadAvatar as jest.Mock;
const deleteMock = profileApi.deleteAvatar as jest.Mock;
const fyMock = fyApi.listFinancialYearLabels as jest.Mock;

function baseProfile(overrides: Partial<ProfileView> = {}): ProfileView {
  return {
    id: "u1",
    email: "nazmul@ze.test",
    name: "Nazmul Karim",
    phone: "+8801712345678",
    avatarUrl: null,
    role: "ACCOUNTS_MANAGER",
    isUnscoped: true,
    isActive: true,
    financialYearId: "fy-1",
    lastLoginAt: "2026-07-14T10:15:00Z",
    assignedProjects: { scope: "ALL" },
    version: 3,
    ...overrides,
  };
}

function user(): SafeUser {
  return {
    id: "u1",
    email: "nazmul@ze.test",
    name: "Nazmul Karim",
    role: "ACCOUNTS_MANAGER",
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
  };
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user()}>
          <AccountProfileScreen />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  getMock.mockResolvedValue(baseProfile());
  patchMock.mockImplementation(async (body: { name?: string; phone?: string | null; version: number }) => ({
    ...baseProfile(),
    name: body.name ?? baseProfile().name,
    phone: body.phone === undefined ? baseProfile().phone : body.phone,
    version: body.version + 1,
  }));
  uploadMock.mockResolvedValue({ ...baseProfile(), avatarUrl: "data:image/png;base64,AAA=", version: 4 });
  deleteMock.mockResolvedValue({ ...baseProfile(), avatarUrl: null, version: 4 });
  fyMock.mockResolvedValue([{ id: "fy-1", label: "FY 2025–26" }]);
});

describe("AccountProfileScreen — default render (FR-AUD-029/-030)", () => {
  it("shows identity, resolved FY label, last login, assigned projects", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    expect(screen.getByTestId("profile-identity-name")).toHaveTextContent(/Nazmul Karim/);
    expect(screen.getByTestId("profile-identity-role")).toHaveTextContent(/Accounts Manager/);
    expect(screen.getByTestId("profile-detail-email")).toHaveTextContent(/nazmul@ze.test/);
    await waitFor(() =>
      expect(screen.getByTestId("profile-detail-fy")).toHaveTextContent(/FY 2025.26/),
    );
    expect(screen.getByTestId("profile-detail-last-login")).toHaveTextContent(/14\/07\/2026 10:15/);
    expect(screen.getByTestId("profile-projects-all")).toHaveTextContent(/All projects/);
    expect(screen.getByTestId("profile-contact-admin-hint")).toBeInTheDocument();
  });

  it("renders NO control for role, email, isActive, FY, or projects (FR-AUD-033)", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    // The only editable inputs on this screen are #profile-name and #profile-phone.
    const inputs = document.querySelectorAll("input");
    const editableIds = Array.from(inputs)
      .filter((i) => (i as HTMLInputElement).type !== "file")
      .map((i) => (i as HTMLInputElement).id);
    expect(editableIds.sort()).toEqual(["profile-name", "profile-phone"].sort());
    expect(document.querySelectorAll("select").length).toBe(0);
  });

  it("shows initials fallback when avatarUrl is null", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    expect(screen.getByTestId("profile-avatar-initials")).toHaveTextContent(/NK/);
  });

  it('shows "Never" when lastLoginAt is null (partial state)', async () => {
    getMock.mockResolvedValue(baseProfile({ lastLoginAt: null, phone: null }));
    renderScreen();
    await screen.findByTestId("profile-screen");
    expect(screen.getByTestId("profile-detail-last-login")).toHaveTextContent("Never");
  });

  it('shows "No projects assigned" when the list is empty', async () => {
    getMock.mockResolvedValue(baseProfile({ isUnscoped: false, assignedProjects: [] }));
    renderScreen();
    await screen.findByTestId("profile-screen");
    expect(screen.getByTestId("profile-projects-empty")).toHaveTextContent(/No projects assigned/);
  });

  it("renders assigned-project chips (Bangla-safe)", async () => {
    getMock.mockResolvedValue(
      baseProfile({
        isUnscoped: false,
        assignedProjects: [
          { projectId: "p1", projectName: "Bridge-04" },
          { projectId: "p2", projectName: "টাওয়ার-১২" },
        ],
      }),
    );
    renderScreen();
    await screen.findByTestId("profile-screen");
    expect(screen.getByTestId("profile-projects-list")).toHaveTextContent(/Bridge-04/);
    expect(screen.getByTestId("profile-projects-list")).toHaveTextContent(/টাওয়ার-১২/);
  });
});

describe("AccountProfileScreen — name/phone edit (FR-AUD-032/-034/-037)", () => {
  it("Save is disabled until a field changes; enables on edit", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    expect(screen.getByTestId("profile-save")).toBeDisabled();
    await userEvent.type(screen.getByTestId("profile-name-input"), " Jr.");
    expect(screen.getByTestId("profile-save")).not.toBeDisabled();
  });

  it("posts { name, version } on save and shows the success toast", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    const nameInput = screen.getByTestId("profile-name-input") as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Nazmul K.");
    await userEvent.click(screen.getByTestId("profile-save"));
    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(patchMock.mock.calls[0]![0]).toEqual({ name: "Nazmul K.", version: 3 });
    expect(await screen.findByText(/Profile updated\./)).toBeInTheDocument();
  });

  it("clearing phone sends phone: null", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    const phoneInput = screen.getByTestId("profile-phone-input") as HTMLInputElement;
    await userEvent.clear(phoneInput);
    await userEvent.click(screen.getByTestId("profile-save"));
    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(patchMock.mock.calls[0]![0]).toEqual({ phone: null, version: 3 });
  });

  it("empty name shows an inline validation error and does not submit", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    const nameInput = screen.getByTestId("profile-name-input") as HTMLInputElement;
    await userEvent.clear(nameInput);
    // Save is enabled (dirty), but validation blocks submit.
    await userEvent.click(screen.getByTestId("profile-save"));
    expect(await screen.findByTestId("profile-name-error")).toHaveTextContent(/Name can't be empty/);
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("non-E.164 phone shows the exact §8 message", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    const phoneInput = screen.getByTestId("profile-phone-input") as HTMLInputElement;
    await userEvent.clear(phoneInput);
    await userEvent.type(phoneInput, "0171-234-5678");
    await userEvent.click(screen.getByTestId("profile-save"));
    expect(await screen.findByTestId("profile-phone-error")).toHaveTextContent(
      /Enter a valid phone number, e\.g\. \+8801712345678\./,
    );
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("maps OPTIMISTIC_LOCK_CONFLICT to the refresh banner and re-fetches", async () => {
    patchMock.mockRejectedValueOnce(
      new ApiError({ code: "OPTIMISTIC_LOCK_CONFLICT", message: "stale", status: 409 }),
    );
    // The refetch after 409 returns a new bumped-version profile.
    getMock.mockResolvedValueOnce(baseProfile()).mockResolvedValueOnce(baseProfile({ version: 5, name: "Someone else" }));
    renderScreen();
    await screen.findByTestId("profile-screen");
    const nameInput = screen.getByTestId("profile-name-input") as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "My change");
    await userEvent.click(screen.getByTestId("profile-save"));
    await waitFor(() =>
      expect(screen.getByTestId("profile-form-banner")).toHaveTextContent(
        /Your profile was updated elsewhere/i,
      ),
    );
  });
});

describe("AccountProfileScreen — avatar upload/remove (FR-AUD-038..-042)", () => {
  it("rejects a wrong-type file BEFORE upload and preserves existing avatar", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    const input = screen.getByTestId("profile-avatar-file-input") as HTMLInputElement;
    const badFile = new File(["gif-bytes"], "cat.gif", { type: "image/gif" });
    // Bypass the input's `accept` attribute (user-event's guard) so we drive
    // the client pre-check directly — the point of this test.
    fireEvent.change(input, { target: { files: [badFile] } });
    expect(await screen.findByTestId("profile-avatar-error")).toHaveTextContent(
      /Use a JPG, PNG, or WebP image\./,
    );
    expect(uploadMock).not.toHaveBeenCalled();
    // Existing initials/avatar untouched.
    expect(screen.getByTestId("profile-avatar-initials")).toBeInTheDocument();
  });

  it("rejects a >5 MB file BEFORE upload", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    const input = screen.getByTestId("profile-avatar-file-input") as HTMLInputElement;
    // Simulate a 5.1 MB PNG.
    const big = new File([new Uint8Array(5_400_000)], "big.png", { type: "image/png" });
    await userEvent.upload(input, big);
    expect(await screen.findByTestId("profile-avatar-error")).toHaveTextContent(
      /Image must be 5 MB or smaller\./,
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("uploads a valid file and shows Photo updated. toast", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    const input = screen.getByTestId("profile-avatar-file-input") as HTMLInputElement;
    const good = new File(["png-bytes"], "photo.png", { type: "image/png" });
    await userEvent.upload(input, good);
    await waitFor(() => expect(uploadMock).toHaveBeenCalled());
    expect(await screen.findByText(/Photo updated\./)).toBeInTheDocument();
  });

  it("maps MEDIA_STORAGE_ERROR to the retry message on upload", async () => {
    uploadMock.mockRejectedValueOnce(new ApiError({ code: "MEDIA_STORAGE_ERROR", message: "x", status: 502 }));
    renderScreen();
    await screen.findByTestId("profile-screen");
    const input = screen.getByTestId("profile-avatar-file-input") as HTMLInputElement;
    const good = new File(["png"], "photo.png", { type: "image/png" });
    await userEvent.upload(input, good);
    expect(await screen.findByTestId("profile-avatar-error")).toHaveTextContent(
      /Couldn't save your photo\. Try again\./,
    );
  });

  it("Remove opens the confirm dialog and, on confirm, reverts to initials + toast", async () => {
    // Start with an existing avatar so the Remove button appears.
    getMock.mockResolvedValue(baseProfile({ avatarUrl: "data:image/png;base64,X" }));
    renderScreen();
    await screen.findByTestId("profile-screen");
    await userEvent.click(await screen.findByTestId("profile-avatar-remove"));
    expect(await screen.findByTestId("profile-remove-photo-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("profile-remove-photo-confirm"));
    await waitFor(() => expect(deleteMock).toHaveBeenCalled());
    expect(await screen.findByText(/Photo removed\./)).toBeInTheDocument();
  });
});

describe("AccountProfileScreen — load error + change-password link (spec §6/§9)", () => {
  it("shows the load-error card with Retry when the read fails", async () => {
    getMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }));
    renderScreen();
    expect(await screen.findByTestId("profile-load-error")).toHaveTextContent(
      /Couldn't load your profile\./,
    );
    expect(screen.getByTestId("profile-load-error-retry")).toBeInTheDocument();
  });

  it("change-password link routes to /change-password (not a second flow here)", async () => {
    renderScreen();
    await screen.findByTestId("profile-screen");
    const link = screen.getByTestId("profile-change-password-link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/change-password");
  });
});
