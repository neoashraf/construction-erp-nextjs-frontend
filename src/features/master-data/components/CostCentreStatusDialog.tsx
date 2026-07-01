"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { useToast } from "@/components/ui/toast";
import { type CostCentre } from "../types";
import { useDeactivateCostCentre, useReactivateCostCentre } from "../hooks/useCostCentres";

type Mode = "deactivate" | "reactivate";

const COPY: Record<
  Mode,
  { title: string; body: string; cta: string; done: (n: string) => string }
> = {
  deactivate: {
    title: "Deactivate this cost centre?",
    body: "It stays on historical postings and budgets but won't appear in new dropdowns.",
    cta: "Deactivate",
    done: (n) => `‘${n}’ deactivated.`,
  },
  reactivate: {
    title: "Reactivate this cost centre?",
    body: "It will appear again in dropdowns. Historical postings are unchanged.",
    cta: "Reactivate",
    done: (n) => `‘${n}’ reactivated.`,
  },
};

/** Deactivate/reactivate cost-centre confirm (FR-MAS-029/033, spec §8). Sends version. */
export function CostCentreStatusDialog({
  centre,
  mode,
  onClose,
  onReload,
}: {
  centre: CostCentre | null;
  mode: Mode;
  onClose: () => void;
  onReload: () => void;
}) {
  const { toast } = useToast();
  const deactivate = useDeactivateCostCentre();
  const reactivate = useReactivateCostCentre();
  const active = mode === "deactivate" ? deactivate : reactivate;
  const copy = COPY[mode];

  function confirm() {
    if (!centre) return;
    active.mutate(
      { id: centre.id, version: centre.version },
      {
        onSuccess: () => {
          toast(copy.done(centre.name), "success");
          onClose();
        },
        onError: (err) => {
          const e = asApiError(err);
          if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
            toast("This cost centre was changed by someone else. Reload and try again.", "error");
            onReload();
          } else if (e.code === "NOT_FOUND") {
            toast("This cost centre no longer exists. Refresh the list.", "error");
            onReload();
          } else if (e.code === "NETWORK_ERROR") {
            toast("You're offline. Try again when reconnected.", "error");
          } else if (e.code === "FORBIDDEN") {
            toast("You don't have permission to do that.", "error");
          } else {
            toast(e.message || "Couldn't update the cost centre.", "error");
          }
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open={centre !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose data-testid="cost-centre-status-dialog">
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription className="mt-2">{copy.body}</DialogDescription>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onClose} disabled={active.isPending}>
            Cancel
          </Button>
          <Button
            variant={mode === "deactivate" ? "destructive" : "primary"}
            size="md"
            onClick={confirm}
            disabled={active.isPending}
            data-testid="cost-centre-status-confirm"
          >
            {active.isPending ? "Working…" : copy.cta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
