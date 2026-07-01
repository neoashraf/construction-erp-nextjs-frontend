"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { useToast } from "@/components/ui/toast";
import { type Party } from "../types";
import { useDeactivateParty, useReactivateParty } from "../hooks/useParties";

type Mode = "deactivate" | "reactivate";

const COPY: Record<
  Mode,
  { title: string; body: string; cta: string; done: (n: string) => string }
> = {
  deactivate: {
    title: "Deactivate this party?",
    body: "It stays on past vouchers but won't appear in new customer/supplier pickers.",
    cta: "Deactivate",
    done: (n) => `‘${n}’ deactivated.`,
  },
  reactivate: {
    title: "Reactivate this party?",
    body: "It will appear again in customer/supplier pickers. Past vouchers are unchanged.",
    cta: "Reactivate",
    done: (n) => `‘${n}’ reactivated.`,
  },
};

/**
 * Deactivate / reactivate confirm dialog (FR-MAS-029/033, spec §8). Server-confirmed,
 * sends the row `version`; on OPTIMISTIC_LOCK_CONFLICT surfaces the conflict toast +
 * asks for a reload. Mutually exclusive — a party is either active or not.
 */
export function PartyStatusDialog({
  party,
  mode,
  onClose,
  onReload,
}: {
  party: Party | null;
  mode: Mode;
  onClose: () => void;
  onReload: () => void;
}) {
  const { toast } = useToast();
  const deactivate = useDeactivateParty();
  const reactivate = useReactivateParty();
  const active = mode === "deactivate" ? deactivate : reactivate;
  const copy = COPY[mode];

  function confirm() {
    if (!party) return;
    active.mutate(
      { id: party.id, version: party.version },
      {
        onSuccess: () => {
          toast(copy.done(party.name), "success");
          onClose();
        },
        onError: (err) => {
          const e = asApiError(err);
          if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
            toast("This party was changed by someone else. Reload and try again.", "error");
            onReload();
          } else if (e.code === "NETWORK_ERROR") {
            toast("You're offline. Try again when reconnected.", "error");
          } else if (e.code === "FORBIDDEN") {
            toast("You don't have permission to do that.", "error");
          } else {
            toast(e.message || "Couldn't update the party.", "error");
          }
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open={party !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose data-testid="party-status-dialog">
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
            data-testid="party-status-confirm"
          >
            {active.isPending ? "Working…" : copy.cta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
