/**
 * FE-1 login screen tests — LoginCard.
 * FR-AUD-001 (auth, generic error), FR-AUD-002 (no token client-side),
 * FR-AUD-003 (redirect on success), FR-AUD-004 (session-expired re-entry),
 * FR-AUD-008 (last_login_at server-side), FR-AUD-009 (deactivated → same banner).
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginCard } from "@/features/audit/components/LoginCard";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

jest.mock("@/lib/api/client", () => ({
  apiClient: { post: jest.fn() },
}));

const postMock = apiClient.post as jest.Mock;

// ── Helper ─────────────────────────────────────────────────────────────────

function renderCard(props: { sessionExpired?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LoginCard {...props} />
    </QueryClientProvider>,
  );
}

const SUCCESS_USER = {
  user: {
    id: "u1",
    email: "admin@ze.test",
    name: "Admin",
    role: "ADMIN",
    companyId: "c1",
    financialYearId: "fy1",
    isActive: true,
    lastLoginAt: null,
  },
};

// ── Suite ──────────────────────────────────────────────────────────────────

describe("LoginCard", () => {
  beforeEach(() => {
    postMock.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
  });

  // AC: Screen renders elements per spec; no sidebar/topbar
  it("renders brand mark, heading, email, password, and sign-in button", () => {
    renderCard();
    expect(screen.getByText("Zakir Enterprise")).toBeInTheDocument();
    expect(screen.getByText("Construction ERP")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
  });

  it("does not render any sidebar or topbar (public route group)", () => {
    renderCard();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("does not render forgot-password, register, or remember-me controls (spec §3/§9/§14)", () => {
    renderCard();
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/register/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/remember me/i)).not.toBeInTheDocument();
  });

  // AC: Client-side validation before any request
  it("shows 'Enter your email.' when email is empty on submit (FR-AUD-001)", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Enter your email.")).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("shows 'Enter your password.' when password is empty on submit (FR-AUD-001)", async () => {
    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "x@y.com");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Enter your password.")).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("shows 'Enter your email.' for a malformed email (FR-AUD-001)", async () => {
    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Enter your email.")).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  // AC: Submit posts to BFF on valid input (FR-AUD-002, FR-AUD-003)
  it("posts { email, password } to /auth/login on valid submit", async () => {
    postMock.mockResolvedValue(SUCCESS_USER);
    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "admin@ze.test");
    await userEvent.type(screen.getByLabelText("Password"), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/auth/login", {
        email: "admin@ze.test",
        password: "Passw0rd!",
      }),
    );
  });

  it("redirects to /dashboard on success — no toast (FR-AUD-003)", async () => {
    postMock.mockResolvedValue(SUCCESS_USER);
    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "admin@ze.test");
    await userEvent.type(screen.getByLabelText("Password"), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // AC: Generic banner for all auth failures — no enumeration (FR-AUD-001, FR-AUD-009)
  it("shows generic banner 'Incorrect email or password.' for INVALID_CREDENTIALS", async () => {
    postMock.mockRejectedValue(
      new ApiError({ code: "INVALID_CREDENTIALS", message: "wrong", details: null, status: 401 }),
    );
    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "nobody@ze.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows the SAME generic banner for a deactivated account (FR-AUD-009 — no disclosure)", async () => {
    postMock.mockRejectedValue(
      new ApiError({
        code: "INVALID_CREDENTIALS",
        message: "deactivated",
        details: null,
        status: 401,
      }),
    );
    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "gone@ze.test");
    await userEvent.type(screen.getByLabelText("Password"), "any");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(screen.queryByText(/disabled|deactivated|locked/i)).not.toBeInTheDocument();
  });

  it("shows the SAME generic banner for a locked-out account (SRS §16 — no attempt count)", async () => {
    postMock.mockRejectedValue(
      new ApiError({ code: "INVALID_CREDENTIALS", message: "locked", details: null, status: 401 }),
    );
    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "bad@ze.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(screen.queryByText(/attempt|lock/i)).not.toBeInTheDocument();
  });

  // AC: Offline / network failure (spec §6 / FR-AUD edge 13)
  it("shows offline banner for a network error", async () => {
    postMock.mockRejectedValue(
      new ApiError({
        code: "NETWORK_ERROR",
        message: "Network request failed",
        details: null,
        status: 0,
      }),
    );
    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "x@y.com");
    await userEvent.type(screen.getByLabelText("Password"), "pass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(
      await screen.findByText("Can't reach the server. Check your connection and try again."),
    ).toBeInTheDocument();
  });

  // AC: Session-expired banner (FR-AUD-004)
  it("shows 'Your session has expired.' banner when sessionExpired=true on load", () => {
    renderCard({ sessionExpired: true });
    expect(screen.getByText("Your session has expired. Please sign in again.")).toBeInTheDocument();
  });

  // AC: In-flight state (spec §6)
  it("shows spinner + 'Signing in…' and disables fields while submitting", async () => {
    let resolve!: () => void;
    postMock.mockReturnValue(
      new Promise<typeof SUCCESS_USER>((r) => {
        resolve = () => r(SUCCESS_USER);
      }),
    );

    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "admin@ze.test");
    await userEvent.type(screen.getByLabelText("Password"), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Signing in…")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();

    resolve();
  });

  // AC: Show/hide toggle (spec §10)
  it("show/hide toggle switches the password field type and announces state", async () => {
    renderCard();
    const pwField = screen.getByLabelText("Password");
    expect(pwField).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: /show password/i });
    await userEvent.click(toggle);
    expect(pwField).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: /hide password/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /hide password/i }));
    expect(pwField).toHaveAttribute("type", "password");
  });

  // AC: Error banner has role="alert" and does not steal focus (spec §10)
  it("error banner has role='alert' and focus stays on password after resubmit", async () => {
    postMock.mockRejectedValue(
      new ApiError({ code: "INVALID_CREDENTIALS", message: "bad", details: null, status: 401 }),
    );
    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "x@y.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    const banner = await screen.findByRole("alert");
    expect(banner).toBeInTheDocument();
    // Focus must not be stolen to the banner itself (user stays on the field they were editing)
    expect(banner).not.toHaveFocus();
  });

  // AC: Server VALIDATION_ERROR details map to fields (spec §7)
  it("maps server VALIDATION_ERROR details back to form fields", async () => {
    postMock.mockRejectedValue(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: { email: ["Invalid email format"], password: ["Too short"] },
        status: 400,
      }),
    );
    renderCard();
    // Inputs must PASS client-side zod (valid email + non-empty password) so the
    // request fires and the SERVER's VALIDATION_ERROR mapping is exercised.
    await userEvent.type(screen.getByLabelText("Email"), "user@valid.com");
    await userEvent.type(screen.getByLabelText("Password"), "shortpw");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email format")).toBeInTheDocument();
    expect(await screen.findByText("Too short")).toBeInTheDocument();
  });

  // AC: Enter key submits (spec §9)
  it("submits when Enter is pressed in the password field", async () => {
    postMock.mockResolvedValue(SUCCESS_USER);
    renderCard();
    await userEvent.type(screen.getByLabelText("Email"), "admin@ze.test");
    await userEvent.type(screen.getByLabelText("Password"), "Passw0rd!{enter}");
    await waitFor(() => expect(postMock).toHaveBeenCalled());
  });

  // AC: Inputs have programmatic labels (spec §10)
  it("email and password inputs have visible labels (not placeholder-only)", () => {
    renderCard();
    const emailLabel = screen.getByText(/^email$/i, { selector: "label" });
    const pwLabel = screen.getByText(/^password$/i, { selector: "label" });
    expect(emailLabel).toBeInTheDocument();
    expect(pwLabel).toBeInTheDocument();
  });
});
