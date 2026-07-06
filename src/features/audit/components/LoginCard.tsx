"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { asApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { loginSchema, type LoginInput } from "../schemas/login";
import { type AuthBannerVariant } from "../types";
import { useLogin } from "../hooks/use-login";
import { AuthErrorBanner } from "./AuthErrorBanner";
import { EmailField } from "./EmailField";
import { PasswordField } from "./PasswordField";

interface LoginCardProps {
  /** True when the user was redirected here due to a failed token refresh. */
  sessionExpired?: boolean;
}

/**
 * Designed login screen card (FE-1 / FR-AUD-001..004, 008, 009).
 * Centered on the auth canvas; no app shell. All state transitions per spec §6.
 */
export function LoginCard({ sessionExpired = false }: LoginCardProps) {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [banner, setBanner] = useState<AuthBannerVariant | "none">(
    sessionExpired ? "session" : "none",
  );
  const [signedIn, setSignedIn] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);

  const { mutate, isPending } = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  // Focus the email field on load (spec §10 / AC a11y).
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const { ref: emailRHFRef, ...emailRest } = register("email");

  function onSubmit(data: LoginInput) {
    setBanner("none");
    mutate(data, {
      onSuccess: (result) => {
        setSignedIn(true);
        // Forced change (FR-AUD-030): a temp/reset password holds the user on
        // change-password (forced mode) before any shell route renders.
        const mustChange =
          typeof result === "object" && result !== null && "user" in result
            ? Boolean((result as { user?: { mustChangePassword?: boolean } }).user?.mustChangePassword)
            : false;
        // Cookies are set; route into the shell. refresh() re-renders server components.
        router.replace(mustChange ? "/change-password?forced=1" : "/dashboard");
        router.refresh();
      },
      onError: (err) => {
        const apiError = asApiError(err);
        if (apiError.isValidation && apiError.details) {
          // Map server VALIDATION_ERROR details back onto fields.
          const d = apiError.details as Record<string, string[] | string>;
          const emailMsg = Array.isArray(d.email) ? d.email[0] : d.email;
          const pwMsg = Array.isArray(d.password) ? d.password[0] : d.password;
          if (emailMsg) setError("email", { message: String(emailMsg) });
          if (pwMsg) setError("password", { message: String(pwMsg) });
        } else if (apiError.code === "NETWORK_ERROR") {
          setBanner("offline");
        } else {
          // INVALID_CREDENTIALS (wrong password / unknown email / deactivated / locked-out).
          // All map to the same generic banner — no enumeration (FR-AUD-001, FR-AUD-009).
          setBanner("auth");
        }
      },
    });
  }

  // ── Success state — redirect in progress ───────────────────────────────
  if (signedIn) {
    return (
      <div
        className="w-full max-w-[420px] rounded-card border border-border bg-background px-8 py-11 flex flex-col items-center gap-3 text-center shadow-md"
        data-testid="login-success"
        aria-live="polite"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success text-2xl font-bold">
          ✓
        </div>
        <p className="text-lg font-bold">Signed in</p>
        <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
        <div className="mt-1 h-1 w-[140px] overflow-hidden rounded-pill bg-muted">
          <div className="h-full w-2/5 animate-[slide_1.2s_ease-in-out_infinite] rounded-pill bg-primary" />
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="w-full max-w-[420px] rounded-card border border-border bg-background px-8 py-8 shadow-md"
      data-testid="login-form"
      aria-label="Sign in"
    >
      {/* ── Brand mark ── */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-accent"
          aria-hidden="true"
        >
          <span className="text-[14px] font-bold leading-none tracking-tight text-accent-foreground">
            ZE
          </span>
        </div>
        <div className="text-center">
          <p className="text-[15px] font-bold text-foreground">Zakir Enterprise</p>
          <p className="mt-[3px] text-[10.5px] font-semibold uppercase tracking-[0.6px] text-faint">
            Construction ERP
          </p>
        </div>
      </div>

      {/* ── Heading ── */}
      <h1 className="mt-6 text-[22px] font-bold tracking-[-0.01em]">Sign in</h1>

      {/* ── Server-driven banner (role="alert" — screen-readers announce it) ── */}
      {banner !== "none" && (
        <div className="mt-4">
          <AuthErrorBanner variant={banner} data-testid="auth-error-banner" />
        </div>
      )}

      {/* ── Email ── */}
      <div className="mt-[18px]">
        <EmailField
          error={errors.email?.message}
          disabled={isPending}
          inputRef={(el) => {
            emailRHFRef(el);
            emailRef.current = el;
          }}
          {...emailRest}
        />
      </div>

      {/* ── Password ── */}
      <div className="mt-[14px]">
        <PasswordField
          error={errors.password?.message}
          disabled={isPending}
          showPassword={showPw}
          onToggleShow={() => setShowPw((v) => !v)}
          {...register("password")}
        />
      </div>

      {/* ── Submit ── */}
      <Button
        type="submit"
        disabled={isPending}
        className="mt-[22px] h-[46px] w-full text-[15px] font-semibold"
        size="md"
      >
        {isPending && (
          <span
            className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-primary-foreground/45 border-t-primary-foreground"
            aria-hidden="true"
          />
        )}
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
