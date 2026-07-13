"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api";
import { useEmployeeMutations } from "../hooks/useEmployeeMutations";
import { mapEmployeeError } from "../schemas/employee.schema";
import { type Employee } from "../types";

/**
 * Deactivate/Reactivate confirm dialog (FR-HR-003; spec §8). Destructive-feeling but reversible —
 * the copy makes that explicit so HR doesn't hesitate. On success the parent's TanStack cache
 * refetches the employee → the status badge flips in place. `OPTIMISTIC_LOCK_CONFLICT` echoes
 * the exact spec §8 copy so a stale write doesn't fail silently.
 */
export function DeactivateDialog({
  employee,
  open,
  onOpenChange,
  mode,
}: {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "deactivate" flips ACTIVE → INACTIVE; "reactivate" flips INACTIVE → ACTIVE. */
  mode: "deactivate" | "reactivate";
}) {
  const { toast } = useToast();
  const { deactivate, reactivate } = useEmployeeMutations();
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const title =
    mode === "deactivate" ? `Deactivate ${employee.name}?` : `Reactivate ${employee.name}?`;
  const body =
    mode === "deactivate"
      ? "They'll be excluded from new attendance and salary cycles. Their history stays intact, and you can reactivate them anytime."
      : "They'll be eligible for new attendance and salary cycles again.";
  const confirmLabel = mode === "deactivate" ? "Deactivate" : "Reactivate";

  async function onConfirm() {
    setBanner(null);
    setBusy(true);
    try {
      if (mode === "deactivate") {
        await deactivate.mutateAsync({ id: employee.id, version: employee.version });
        toast(`${employee.name} deactivated.`, "success");
      } else {
        await reactivate.mutateAsync({ id: employee.id, version: employee.version });
        toast(`${employee.name} reactivated.`, "success");
      }
      onOpenChange(false);
    } catch (err) {
      const e = asApiError(err);
      setBanner(mapEmployeeError(e.code).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={`${mode}-dialog`}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{body}</DialogDescription>
        {banner && (
          <Alert tone="destructive" className="mt-3" title={banner} data-testid={`${mode}-banner`} />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={mode === "deactivate" ? "destructive" : "primary"}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
            data-testid={`${mode}-confirm`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
