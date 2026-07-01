/**
 * Backward-compat test: LoginForm re-exports LoginCard — verifies the alias works.
 * Full behavioral coverage is in test/components/login-card.test.tsx.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

const replace = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));
jest.mock("@/lib/api/client", () => ({
  apiClient: { post: jest.fn() },
}));

const postMock = apiClient.post as jest.Mock;

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

describe("LoginForm — alias shim", () => {
  beforeEach(() => {
    postMock.mockReset();
    replace.mockReset();
    refresh.mockReset();
  });

  it("posts to the BFF and navigates into the shell on success", async () => {
    postMock.mockResolvedValue({
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
    });
    renderForm();
    await userEvent.type(screen.getByLabelText("Email"), "admin@ze.test");
    await userEvent.type(screen.getByLabelText("Password"), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/auth/login", {
        email: "admin@ze.test",
        password: "Passw0rd!",
      }),
    );
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("shows a uniform generic message for INVALID_CREDENTIALS (no enumeration)", async () => {
    postMock.mockRejectedValue(
      new ApiError({
        code: "INVALID_CREDENTIALS",
        message: "whatever",
        details: null,
        status: 401,
      }),
    );
    renderForm();
    await userEvent.type(screen.getByLabelText("Email"), "nobody@ze.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(replace).not.toHaveBeenCalled();
  });
});
