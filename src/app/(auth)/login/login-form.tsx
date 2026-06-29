"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { asApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";

/**
 * Login PLUMBING (not a designed screen — skill §2/§4, brief scope). Posts to the
 * BFF /api/auth/login, which sets the httpOnly cookies and returns only the safe
 * user; on success we navigate into the app shell. INVALID_CREDENTIALS is shown
 * as one generic message (no enumeration). The designed login screen is a later brief.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post("/auth/login", { email, password });
      // Cookies are now set by the BFF; route into the shell.
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const apiError = asApiError(err);
      // Uniform message for INVALID_CREDENTIALS (no email enumeration).
      setError(
        apiError.code === "INVALID_CREDENTIALS"
          ? "Invalid email or password."
          : apiError.message || "Login failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="login-form" noValidate>
      <h1 className="text-lg font-semibold">Sign in</h1>
      <label className="flex flex-col gap-1 text-sm">
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-token border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded-token border border-border bg-background px-3 py-2"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive" data-testid="login-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
