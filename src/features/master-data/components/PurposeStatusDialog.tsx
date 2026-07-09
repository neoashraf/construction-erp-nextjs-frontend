"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { type Purpose } from "../types";
import { useDeactivatePurpose, useReactivatePurpose } from "../hooks/usePurposes";

type Mode = "deactivate" | "reactivate";

const COPY: Record<
  Mode,
  {
    title: string;
    body: string;
    cta: string;
    done: (n: string) => string;
    icon: typeof AlertTriangle;
    iconBox: string;
  }
> = {
  deactivate: {
    title: "Deactivate this purpose?",
    body: "It stays on past postings but won't appear in new dropdowns.",
    cta: "Deactivate",
    done: (n) => `‘${n}’ deactivated.`,
    icon: AlertTriangle,
    iconBox: "bg-destructive-soft text-destructive-ink",
  },
  reactivate: {
    title: "Reactivate this purpose?",
    body: "It will appear again in new dropdowns. Past postings are unchanged.",
    cta: "Reactivate",
    done: (n) => `‘${n}’ reactivated.`,
    icon: RotateCcw,
    iconBox: "bg-info-soft text-info-ink",
  },
};

/** Deactivate/reactivate purpose confirm (FR-MAS-029/033, spec §9). Sends version. */
export function PurposeStatusDialog({
  projectId,
  purpose,
  mode,
  onClose,
  onReload,
}: {
  projectId: string;
  purpose: Purpose | null;
  mode: Mode;
  onClose: () => void;
  onReload: () => void;
}) {
  const { toast } = useToast();
  const deactivate = useDeactivatePurpose();
  const reactivate = useReactivatePurpose();
  const active = mode === "deactivate" ? deactivate : reactivate;
  const copy = COPY[mode];

  function confirm() {
    if (!purpose) return;
    active.mutate(
      { projectId, id: purpose.id, version: purpose.version },
      {
        onSuccess: () => {
          toast(copy.done(purpose.name), "success");
          onClose();
        },
        onError: (err) => {
          const e = asApiError(err);
          if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
            toast("This purpose was changed by someone else. Reload and try again.", "error");
            onReload();
          } else if (e.code === "NOT_FOUND") {
            toast("This purpose no longer exists. Refresh the list.", "error");
            onReload();
          } else if (e.code === "NETWORK_ERROR") {
            toast("You're offline. Try again when reconnected.", "error");
          } else if (e.code === "FORBIDDEN") {
            toast("You don't have permission to do that.", "error");
          } else {
            toast(e.message || "Couldn't update the purpose.", "error");
          }
          onClose();
        },
      },
    );
  }

  const Icon = copy.icon;

  return (
    <Dialog open={purpose !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose className="max-w-[438px]" data-testid="purpose-status-dialog">
        <div className="flex gap-3.5">
          <div
            className={cn(
              "grid h-10 w-10 flex-none place-items-center rounded-[10px]",
              copy.iconBox,
            )}
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div>
            <DialogTitle className="text-base">{copy.title}</DialogTitle>
            <DialogDescription className="mt-1.5 text-[13px]">{copy.body}</DialogDescription>
          </div>
        </div>
        <div className="mt-[22px] flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onClose} disabled={active.isPending}>
            Cancel
          </Button>
          <Button
            variant={mode === "deactivate" ? "destructive" : "primary"}
            size="md"
            onClick={confirm}
            disabled={active.isPending}
            data-testid="purpose-status-confirm"
          >
            {active.isPending ? "Working…" : copy.cta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
