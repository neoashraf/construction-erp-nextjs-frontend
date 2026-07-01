"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { useToast } from "@/components/ui/toast";
import { mapUserActionError } from "../schemas/user";
import { useActivateUser, useDeactivateUser } from "../hooks/use-users";
import { type UserListItem } from "../types";

type Mode = "deactivate" | "activate";

/**
 * Activate / deactivate confirm dialog (spec §8/§9; FR-AUD-009/018). Server-
 * confirmed — no optimistic flip; the row/badge only updates once the mutation
 * resolves (list invalidation). Exact §8 copy; traps focus and returns it to the
 * trigger on close (Radix Dialog).
 */
export function UserStatusDialog({
  user,
  mode,
  onClose,
}: {
  user: UserListItem | null;
  mode: Mode;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const activate = useActivateUser();
  const deactivate = useDeactivateUser();
  const active = mode === "deactivate" ? deactivate : activate;

  const title = mode === "deactivate" ? "Deactivate this user?" : "Activate this user?";
  const body =
    mode === "deactivate"
      ? `${user?.name ?? "This user"} will be signed out and can't sign in until reactivated. Their data is unchanged.`
      : `${user?.name ?? "This user"} will be able to sign in again. Their data is unchanged.`;
  const cta = mode === "deactivate" ? "Deactivate" : "Activate";

  function confirm() {
    if (!user) return;
    active.mutate(user.id, {
      onSuccess: () => {
        toast(
          mode === "deactivate"
            ? "User deactivated. They'll be signed out and can't sign in."
            : "User activated.",
          "success",
        );
        onClose();
      },
      onError: (err) => {
        toast(mapUserActionError(asApiError(err)), "error");
        onClose();
      },
    });
  }

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose data-testid="user-status-dialog">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2">{body}</DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onClose} disabled={active.isPending}>
            Cancel
          </Button>
          <Button
            variant={mode === "deactivate" ? "destructive" : "primary"}
            size="md"
            onClick={confirm}
            disabled={active.isPending}
            aria-busy={active.isPending || undefined}
            data-testid="user-status-confirm"
          >
            {active.isPending ? "Working…" : cta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
