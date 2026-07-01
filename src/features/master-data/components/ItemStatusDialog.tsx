"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { useToast } from "@/components/ui/toast";
import { type Item } from "../types";
import { useDeactivateItem, useReactivateItem } from "../hooks/useItems";

type Mode = "deactivate" | "reactivate";

const COPY: Record<
  Mode,
  { title: string; body: string; cta: string; done: (c: string) => string }
> = {
  deactivate: {
    title: "Deactivate this item?",
    body: "It stays on requisitions and stock history but won't appear in new pickers.",
    cta: "Deactivate",
    done: (c) => `Item ${c} deactivated.`,
  },
  reactivate: {
    title: "Reactivate this item?",
    body: "It will appear again in item pickers. Historical references are unchanged.",
    cta: "Reactivate",
    done: (c) => `Item ${c} reactivated.`,
  },
};

/** Deactivate/reactivate item confirm (FR-MAS-029/033). Sends version. */
export function ItemStatusDialog({
  item,
  mode,
  onClose,
  onReload,
}: {
  item: Item | null;
  mode: Mode;
  onClose: () => void;
  onReload: () => void;
}) {
  const { toast } = useToast();
  const deactivate = useDeactivateItem();
  const reactivate = useReactivateItem();
  const active = mode === "deactivate" ? deactivate : reactivate;
  const copy = COPY[mode];

  function confirm() {
    if (!item) return;
    active.mutate(
      { id: item.id, version: item.version },
      {
        onSuccess: () => {
          toast(copy.done(item.code), "success");
          onClose();
        },
        onError: (err) => {
          const e = asApiError(err);
          if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
            toast("This item was changed by someone else. Reload and try again.", "error");
            onReload();
          } else if (e.code === "NETWORK_ERROR") {
            toast("You're offline. Try again when reconnected.", "error");
          } else if (e.code === "FORBIDDEN") {
            toast("You don't have permission to do that.", "error");
          } else {
            toast(e.message || "Couldn't update the item.", "error");
          }
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose data-testid="item-status-dialog">
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
            data-testid="item-status-confirm"
          >
            {active.isPending ? "Working…" : copy.cta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
