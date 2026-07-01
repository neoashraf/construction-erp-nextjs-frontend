/**
 * FE-16 change-password screen tests — ChangePasswordCard.
 * FR-AUD-006 (change own password), FR-AUD-002 (never displayed/stored/logged).
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChangePasswordCard } from "@/features/audit/components/ChangePasswordCard";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockBack = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh, back: mockBack }),
}));

jest.mock("@/lib/api/client", () => ({
  apiClient: { post: jest.fn() },
}));

const postMock = apiClient.post as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────

function renderCard(props: { forced?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ChangePasswordCard {...props} />
    </QueryClientProvider>,
  );
}

const GOOD_CURRENT = "oldpass2024";
const GOOD_NEW = "Buriganga2026";

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Current password"), GOOD_CURRENT);
  await user.type(screen.getByLabelText("New password"), GOOD_NEW);
  await user.type(screen.getByLabelText("Confirm new password"), GOOD_NEW);
}

function updateButton() {
  return screen.getByRole("button", { name: /^update password$/i });
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe("ChangePasswordCard", () => {
  beforeEach(() => {
    postMock.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockBack.mockReset();
  });

  afterEach(() => {
    // Safety net: a test that resolved the mutation may have scheduled the
    // 1.2s forced-sign-out setTimeout. Force real timers back on and let jest
    // clear any of ITS OWN fake timers via useRealTimers (idempotent when
    // already real) so nothing fires mockReplace during a later test.
    jest.useRealTimers();
  });

  // ── Rendering / layout (spec §3/§4) ──
  it("renders as a centred card with current/new/confirm fields and no sidebar/topbar", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: /change password/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
    expect(updateButton()).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows a Cancel button in self-service mode (spec §1)", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });

  // ── Default state — Update disabled until valid (spec §6, AC) ──
  it("disables Update password until all three fields are non-empty", async () => {
    const user = userEvent.setup();
    renderCard();
    expect(updateButton()).toBeDisabled();
    await user.type(screen.getByLabelText("Current password"), GOOD_CURRENT);
    expect(updateButton()).toBeDisabled();
    await user.type(screen.getByLabelText("New password"), GOOD_NEW);
    expect(updateButton()).toBeDisabled();
    await user.type(screen.getByLabelText("Confirm new password"), GOOD_NEW);
    expect(updateButton()).toBeEnabled();
  });

  it("focuses the current-password field on open (a11y §10)", () => {
    renderCard();
    expect(screen.getByLabelText("Current password")).toHaveFocus();
  });

  // ── Confirm mismatch (client-only, blocks submit before any request) ──
  it("shows 'Passwords don't match.' and blocks submit before any request", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText("Current password"), GOOD_CURRENT);
    await user.type(screen.getByLabelText("New password"), GOOD_NEW);
    await user.type(screen.getByLabelText("Confirm new password"), "different1");
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
    expect(updateButton()).toBeDisabled();
    expect(postMock).not.toHaveBeenCalled();
  });

  // ── Live strength meter + policy checklist (spec §5/§9) ──
  it("updates the strength meter and policy checklist live as the user types", async () => {
    const user = userEvent.setup();
    renderCard();
    const newField = screen.getByLabelText("New password");

    // Unticked initially.
    expect(screen.getByTestId("policy-item-length")).toHaveAttribute("data-met", "false");
    expect(screen.getByTestId("policy-item-complexity")).toHaveAttribute("data-met", "false");
    expect(screen.getByText("—")).toBeInTheDocument();

    await user.type(newField, GOOD_NEW);
    expect(screen.getByTestId("policy-item-length")).toHaveAttribute("data-met", "true");
    expect(screen.getByTestId("policy-item-complexity")).toHaveAttribute("data-met", "true");
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("does not render any password-reuse/history checklist item (SRS §16, spec §14)", () => {
    renderCard();
    expect(screen.queryByText(/differ from your current|recent password|reuse/i)).not.toBeInTheDocument();
  });

  // ── Submit posts the right payload; confirm never sent (AC, FR-AUD-006) ──
  it("posts { currentPassword, newPassword } only — confirm is never sent", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      postMock.mockResolvedValue(undefined);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderCard();
      await fillValid(user);
      await user.click(updateButton());
      await waitFor(() =>
        expect(postMock).toHaveBeenCalledWith(
          "/auth/change-password",
          { currentPassword: GOOD_CURRENT, newPassword: GOOD_NEW },
          expect.any(Object),
        ),
      );
      // Drain the post-success forced sign-out so its timer can't fire mid-way
      // through a later test.
      await screen.findByText("Password updated. You'll be signed out of all devices.");
      await jest.advanceTimersByTimeAsync(1500);
    } finally {
      jest.useRealTimers();
    }
  });

  // ── Saving / in-flight state (spec §6) ──
  it("shows 'Updating…' and disables all fields while in flight", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      let resolve!: () => void;
      postMock.mockReturnValue(
        new Promise<void>((r) => {
          resolve = r;
        }),
      );
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderCard();
      await fillValid(user);
      await user.click(updateButton());

      expect(await screen.findByText("Updating…")).toBeInTheDocument();
      expect(screen.getByLabelText("Current password")).toBeDisabled();
      expect(screen.getByLabelText("New password")).toBeDisabled();
      expect(screen.getByLabelText("Confirm new password")).toBeDisabled();
      expect(screen.getByRole("button", { name: /updating/i })).toBeDisabled();

      // Resolve and let the success banner + forced sign-out fully drain (fake
      // timers) so nothing leaks a real setTimeout into a later test.
      resolve();
      await screen.findByText("Password updated. You'll be signed out of all devices.");
      await jest.advanceTimersByTimeAsync(1500);
      expect(mockReplace).toHaveBeenCalledWith("/login");
    } finally {
      jest.useRealTimers();
    }
  });

  // ── Success → banner → forced sign-out (spec §6/§9, AC) ──
  it("on success shows the sign-out banner then calls logout and routes to /login", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      postMock.mockResolvedValueOnce(undefined); // change-password
      postMock.mockResolvedValueOnce(undefined); // logout
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderCard();
      await fillValid(user);
      await user.click(updateButton());

      expect(
        await screen.findByText("Password updated. You'll be signed out of all devices."),
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("signed out of all devices");

      await jest.advanceTimersByTimeAsync(1500);
      expect(postMock).toHaveBeenCalledWith("/auth/logout", undefined, expect.any(Object));
      expect(mockReplace).toHaveBeenCalledWith("/login");
      expect(mockRefresh).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("routes to /login even if the logout call itself fails (tokens already revoked server-side)", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      postMock.mockResolvedValueOnce(undefined); // change-password succeeds
      postMock.mockRejectedValueOnce(new Error("network down")); // logout fails
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderCard();
      await fillValid(user);
      await user.click(updateButton());
      await screen.findByText("Password updated. You'll be signed out of all devices.");

      await jest.advanceTimersByTimeAsync(1500);
      expect(mockReplace).toHaveBeenCalledWith("/login");
      expect(mockRefresh).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  // ── Current password wrong (spec §6/§8, AC) ──
  it("maps INVALID_CREDENTIALS to 'Current password is incorrect.' inline on the current field", async () => {
    postMock.mockRejectedValue(
      new ApiError({ code: "INVALID_CREDENTIALS", message: "wrong", details: null, status: 401 }),
    );
    const user = userEvent.setup();
    renderCard();
    await fillValid(user);
    await user.click(updateButton());
    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // ── Policy fail (server VALIDATION_ERROR) (spec §6/§8, AC) ──
  it("maps VALIDATION_ERROR to the policy message inline on the new-password field", async () => {
    postMock.mockRejectedValue(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: { newPassword: ["Password must include letters and numbers."] },
        status: 400,
      }),
    );
    const user = userEvent.setup();
    renderCard();
    await fillValid(user);
    await user.click(updateButton());
    expect(
      await screen.findByText("Password must include letters and numbers."),
    ).toBeInTheDocument();
  });

  it("highlights unticked checklist items after a policy-fail response", async () => {
    postMock.mockRejectedValue(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: { newPassword: ["Password must be at least 10 characters."] },
        status: 400,
      }),
    );
    const user = userEvent.setup();
    renderCard();
    await fillValid(user);
    await user.click(updateButton());
    await screen.findByText("Password must be at least 10 characters.");
    // Both checklist items are met by GOOD_NEW, so nothing is highlighted red here,
    // but the error path must still exercise `highlightUnmet` without throwing.
    expect(screen.getByTestId("policy-checklist")).toBeInTheDocument();
  });

  // ── Offline / network failure (spec §6/§8, AC) ──
  it("shows the offline banner for a network error without a partial success", async () => {
    postMock.mockRejectedValue(
      new ApiError({ code: "NETWORK_ERROR", message: "Network request failed", details: null, status: 0 }),
    );
    const user = userEvent.setup();
    renderCard();
    await fillValid(user);
    await user.click(updateButton());
    expect(
      await screen.findByText("Can't reach the server. Check your connection and try again."),
    ).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByText(/signed out/i)).not.toBeInTheDocument();
  });

  // ── Forced-change mode (SRS §16, _open-questions.md AUD 4, AC) ──
  it("forced mode shows the required banner and copy, and suppresses Cancel", () => {
    renderCard({ forced: true });
    expect(
      screen.getByText("Required: choose a new password before you can use the app."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your password was reset by an administrator. Set a new one to continue."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();
  });

  it("forced-mode banner is role=status (not an error)", () => {
    renderCard({ forced: true });
    const banner = screen.getByText(
      "Required: choose a new password before you can use the app.",
    ).closest('[role="status"]');
    expect(banner).toBeInTheDocument();
  });

  // ── Show/hide toggle (spec §9/§10) ──
  it("show/hide toggle reveals both new and confirm fields together", async () => {
    const user = userEvent.setup();
    renderCard();
    const newField = screen.getByLabelText("New password");
    const confirmField = screen.getByLabelText("Confirm new password");
    expect(newField).toHaveAttribute("type", "password");
    expect(confirmField).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show new password/i }));
    expect(newField).toHaveAttribute("type", "text");
    expect(confirmField).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide new password/i }));
    expect(newField).toHaveAttribute("type", "password");
    expect(confirmField).toHaveAttribute("type", "password");
  });

  // ── a11y (spec §10) ──
  it("ties field errors to their input via aria-describedby", async () => {
    postMock.mockRejectedValue(
      new ApiError({ code: "INVALID_CREDENTIALS", message: "wrong", details: null, status: 401 }),
    );
    const user = userEvent.setup();
    renderCard();
    await fillValid(user);
    await user.click(updateButton());
    await screen.findByText("Current password is incorrect.");
    const currentField = screen.getByLabelText("Current password");
    expect(currentField).toHaveAttribute("aria-describedby", "cp-current-error");
  });

  it("tab order is current -> new -> show/hide -> confirm -> Update -> Cancel (spec §10)", async () => {
    const user = userEvent.setup();
    renderCard();
    const current = screen.getByLabelText("Current password");
    const newField = screen.getByLabelText("New password");
    const toggle = screen.getByRole("button", { name: /show new password/i });
    const confirm = screen.getByLabelText("Confirm new password");

    current.focus();
    await user.tab();
    expect(newField).toHaveFocus();
    await user.tab();
    expect(toggle).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
  });

  it("checklist items announce ticked/unticked via role=checkbox + aria-checked", async () => {
    const user = userEvent.setup();
    renderCard();
    const items = screen.getAllByRole("checkbox");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("aria-checked", "false");
    await user.type(screen.getByLabelText("New password"), GOOD_NEW);
    expect(items[0]).toHaveAttribute("aria-checked", "true");
  });
});
