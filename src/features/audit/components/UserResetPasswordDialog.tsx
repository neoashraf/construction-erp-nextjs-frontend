"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { asApiError } from "@/lib/api/errors";
import { useToast } from "@/components/ui/toast";
import { resetPasswordSchema, mapUserActionError } from "../schemas/user";
import { useResetUserPassword } from "../hooks/use-users";
import { type UserListItem } from "../types";

/**
 * Reset-password confirm dialog (spec §8/§9; FR-AUD-007; _open-questions.md AUD 4).
 * The Admin may type a temporary password or leave it blank to system-generate —
 * either way, the password is NEVER shown in this UI or returned by the API
 * (write-only, 204 no content). Success copy reminds the Admin to share it
 * out-of-band. Server-confirmed; traps focus and returns it to the trigger.
 */
export function UserResetPasswordDialog({
  user,
  onClose,
}: {
  user: UserListItem | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const reset = useResetUserPassword();
  const [pw, setPw] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setPw("");
    setPwVisible(false);
    setError(null);
    onClose();
  }

  function confirm() {
    if (!user) return;
    const parsed = resetPasswordSchema.safeParse({ temporaryPassword: pw || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Password must be at least 10 characters.");
      return;
    }
    setError(null);
    reset.mutate(
      { id: user.id, input: { temporaryPassword: pw || undefined } },
      {
        onSuccess: () => {
          toast(
            "Password reset. The user has been signed out of all devices. Share the temporary password with them directly.",
            "success",
          );
          close();
        },
        onError: (err) => {
          const apiErr = asApiError(err);
          if (apiErr.code === "VALIDATION_ERROR") {
            setError(apiErr.message || "Password must be at least 10 characters.");
          } else {
            toast(mapUserActionError(apiErr), "error");
            close();
          }
        },
      },
    );
  }

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent hideClose data-testid="user-reset-dialog">
        <DialogTitle>Reset this user&rsquo;s password?</DialogTitle>
        <DialogDescription className="mt-2">
          {user?.name ?? "This user"} will be signed out of all devices and must sign in with the
          new password, which you&rsquo;ll need to share with them directly.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="reset-temp-password">Temporary password (optional)</Label>
          <div className="relative">
            <Input
              id="reset-temp-password"
              type={pwVisible ? "text" : "password"}
              className="pr-16 font-mono"
              invalid={!!error}
              disabled={reset.isPending}
              placeholder="Leave blank to auto-generate"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setError(null);
              }}
            />
            <button
              type="button"
              onClick={() => setPwVisible((v) => !v)}
              className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[12px] font-semibold text-muted-foreground"
              aria-label={pwVisible ? "Hide password" : "Show password"}
            >
              {pwVisible ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
              {pwVisible ? "Hide" : "Show"}
            </button>
          </div>
          {error ? (
            <p className="text-[12px] text-destructive-ink" data-testid="reset-password-error">
              {error}
            </p>
          ) : (
            <p className="text-[11px] text-faint">
              Write-only — never shown again. Share it with the user directly.
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={close} disabled={reset.isPending}>
            Cancel
          </Button>
          <Button
            size="md"
            onClick={confirm}
            disabled={reset.isPending}
            aria-busy={reset.isPending || undefined}
            data-testid="user-reset-confirm"
          >
            {reset.isPending ? "Working…" : "Reset password"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
