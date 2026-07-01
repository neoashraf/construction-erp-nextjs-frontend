"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { type FinancialYear } from "../types";
import { useSetActiveFinancialYear } from "../hooks/useFinancialYearMutations";

/**
 * Set-active confirm dialog (FR-MAS-003, spec §8/§9). Server-confirmed: changing
 * the active FY re-points the company-wide default posting context and the shell
 * FY switcher — so it asks first. On success: toast + refresh the shell switcher.
 * `NOT_FOUND` → the year was removed elsewhere; nudge a list refresh.
 */
export function SetActiveDialog({
  fy,
  onClose,
  onSuccess,
  onError,
}: {
  fy: FinancialYear | null;
  onClose: () => void;
  onSuccess: (label: string) => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const { mutate, isPending } = useSetActiveFinancialYear();

  function confirm() {
    if (!fy) return;
    mutate(fy.id, {
      onSuccess: () => {
        onSuccess(fy.label);
        router.refresh(); // re-render the shell so the topbar FY switcher reflects the change
        onClose();
      },
      onError: (err) => {
        const e = asApiError(err);
        const message =
          e.code === "NOT_FOUND"
            ? "This financial year no longer exists. Refresh the list."
            : e.code === "NETWORK_ERROR"
              ? "You're offline. Try again when reconnected."
              : e.message || "Couldn't set the active financial year.";
        onError(message);
        onClose();
      },
    });
  }

  return (
    <Dialog open={fy !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose data-testid="set-active-dialog">
        <div className="flex gap-3.5">
          <div className="grid h-10 w-10 flex-none place-items-center rounded-md bg-success-soft text-success">
            <Check className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <DialogTitle>Set active financial year?</DialogTitle>
            <DialogDescription className="mt-1.5">
              Posting will default to{" "}
              <span className="font-mono font-semibold text-foreground">‘{fy?.label}’</span>. This
              doesn&apos;t change any posted data.
            </DialogDescription>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button size="md" onClick={confirm} disabled={isPending} data-testid="set-active-confirm">
            {isPending ? "Setting…" : "Set active"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
