"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { asApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { changePasswordSchema, type ChangePasswordInput } from "../schemas/change-password";
import { estimateStrength, policyChecklist } from "../lib/password-strength";
import { useChangePassword } from "../hooks/use-change-password";
import { ChangePasswordBanner } from "./ChangePasswordBanner";
import { CurrentPasswordField } from "./CurrentPasswordField";
import { NewPasswordField } from "./NewPasswordField";
import { ConfirmPasswordField } from "./ConfirmPasswordField";

export interface ChangePasswordCardProps {
  /**
   * Forced-change entry mode (after an Admin reset / temporary password —
   * SRS §16, _open-questions.md AUD 4). Cancel is suppressed and the user
   * cannot leave until they set a new password (spec §1/§9, AC).
   */
  forced?: boolean;
}

/**
 * Change-password screen card (FE-16 / FR-AUD-006, FR-AUD-002). Centred, no app
 * shell. Full state matrix per spec §6: default / saving / success /
 * current-password-wrong / policy-fail / confirm-mismatch / offline /
 * (loading-skeleton lives at the page level while the client mounts).
 */
export function ChangePasswordCard({ forced = false }: ChangePasswordCardProps) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [banner, setBanner] = useState<"none" | "offline">("none");
  const [success, setSuccess] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const currentRef = useRef<HTMLInputElement | null>(null);

  const { mutate, isPending } = useChangePassword();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitted },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onSubmit",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  // a11y §10: focus the current-password field on open.
  useEffect(() => {
    currentRef.current?.focus();
  }, []);

  const currentValue = watch("currentPassword") ?? "";
  const newPasswordValue = watch("newPassword") ?? "";
  const confirmValue = watch("confirmPassword") ?? "";
  const strength = useMemo(() => estimateStrength(newPasswordValue), [newPasswordValue]);
  const checklist = useMemo(() => policyChecklist(newPasswordValue), [newPasswordValue]);

  const { ref: currentRHFRef, ...currentRest } = register("currentPassword");

  const locked = isPending || success || signingOut;
  // Default state (spec §6): Update disabled until all three fields are
  // non-empty AND confirm matches new — gates the request before it ever fires.
  const allFilled = currentValue.length > 0 && newPasswordValue.length > 0 && confirmValue.length > 0;
  const confirmMatches = confirmValue.length > 0 && confirmValue === newPasswordValue;
  const submitDisabled = locked || !allFilled || !confirmMatches;
  // Live mismatch feedback (spec §6/§7) — shown as soon as both are typed and
  // differ, independent of a submit attempt (the disabled button never fires
  // a request while this holds, satisfying "blocks submit before any request").
  const liveConfirmError =
    confirmValue.length > 0 && !confirmMatches ? "Passwords don't match." : undefined;

  async function forceSignOut() {
    setSigningOut(true);
    try {
      await apiClient.post("/auth/logout", undefined, { csrfToken: readCsrfToken() });
    } catch {
      // Refresh tokens are already revoked server-side by change-password; proceed
      // to login regardless of whether the logout call itself succeeds.
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  function onSubmit(data: ChangePasswordInput) {
    setBanner("none");
    clearErrors("currentPassword");
    mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          setSuccess(true);
          // Server-confirmed only (spec §9) — show the banner, then force sign-out.
          // All refresh tokens are already revoked; never pretend the session is alive.
          window.setTimeout(() => {
            void forceSignOut();
          }, 1200);
        },
        onError: (err) => {
          const apiError = asApiError(err);
          if (apiError.code === "INVALID_CREDENTIALS") {
            setError("currentPassword", { message: "Current password is incorrect." });
          } else if (apiError.isValidation) {
            // Server policy rejection — mirror the §8 policy message on the new field.
            const details = apiError.details as Record<string, string[] | string> | null;
            const newMsg = details?.newPassword;
            const msg = Array.isArray(newMsg) ? newMsg[0] : newMsg;
            setError("newPassword", {
              message: msg ? String(msg) : "Password must include letters and numbers.",
            });
          } else if (apiError.code === "NETWORK_ERROR") {
            setBanner("offline");
          } else {
            setBanner("offline");
          }
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="w-full max-w-[420px] rounded-card border border-border bg-background px-[30px] py-[30px] shadow-md"
      data-testid="change-password-form"
      aria-label="Change password"
    >
      {/* ── Brand mark + heading ── */}
      <div className="flex flex-col items-center gap-[11px]">
        <div
          className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-accent"
          aria-hidden="true"
        >
          <span className="text-[13px] font-bold leading-none tracking-tight text-accent-foreground">
            ZE
          </span>
        </div>
        <h1 className="text-[21px] font-bold tracking-[-0.01em]">Change password</h1>
        {forced && (
          <p className="max-w-[34ch] text-center text-[12.5px] leading-[1.5] text-muted-foreground">
            Your password was reset by an administrator. Set a new one to continue.
          </p>
        )}
      </div>

      {/* ── Forced-change banner (role=status, not an error) ── */}
      {forced && (
        <div className="mt-[18px]">
          <ChangePasswordBanner variant="forced" />
        </div>
      )}

      {/* ── Success / offline banner (role=alert) ── */}
      {success && (
        <div className="mt-[18px]">
          <ChangePasswordBanner variant="success" />
        </div>
      )}
      {!success && banner === "offline" && (
        <div className="mt-[18px]">
          <ChangePasswordBanner variant="offline" />
        </div>
      )}

      <CurrentPasswordField
        error={errors.currentPassword?.message}
        disabled={locked}
        inputRef={(el) => {
          currentRHFRef(el);
          currentRef.current = el;
        }}
        {...currentRest}
      />

      <NewPasswordField
        error={errors.newPassword?.message}
        disabled={locked}
        showPassword={showNew}
        onToggleShow={() => setShowNew((v) => !v)}
        strength={strength}
        checklist={checklist}
        highlightUnmet={isSubmitted && !!errors.newPassword}
        {...register("newPassword")}
      />

      <ConfirmPasswordField
        error={liveConfirmError ?? errors.confirmPassword?.message}
        disabled={locked}
        showPassword={showNew}
        {...register("confirmPassword")}
      />

      {/* ── Actions ── */}
      <div className="mt-[22px] flex gap-[10px]">
        <Button type="submit" disabled={submitDisabled} className="h-11 flex-1 text-[14.5px]" size="md">
          {isPending && (
            <span
              className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-primary-foreground/45 border-t-primary-foreground"
              aria-hidden="true"
            />
          )}
          {isPending ? "Updating…" : "Update password"}
        </Button>
        {!forced && (
          <Button
            type="button"
            variant="ghost"
            disabled={locked}
            className="h-11 px-5 text-[14.5px] text-muted-foreground"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
