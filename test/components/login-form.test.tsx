import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("LoginForm — auth plumbing", () => {
  beforeEach(() => {
    postMock.mockReset();
    replace.mockReset();
    refresh.mockReset();
  });

  it("posts to the BFF and navigates into the shell on success", async () => {
    postMock.mockResolvedValue({ user: { id: "u1" } });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "admin@ze.test");
    await userEvent.type(screen.getByLabelText(/password/i), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(postMock).toHaveBeenCalledWith("/auth/login", {
      email: "admin@ze.test",
      password: "Passw0rd!",
    });
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("shows a uniform message for INVALID_CREDENTIALS (no enumeration)", async () => {
    postMock.mockRejectedValue(
      new ApiError({ code: "INVALID_CREDENTIALS", message: "whatever", details: null, status: 401 }),
    );
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "nobody@ze.test");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByTestId("login-error")).toHaveTextContent("Invalid email or password.");
    expect(replace).not.toHaveBeenCalled();
  });
});
