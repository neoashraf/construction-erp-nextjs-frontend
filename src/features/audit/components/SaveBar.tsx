"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * The save/discard bar (spec §4/§8/§9). Save is disabled until a pending edit
 * exists; both are disabled while saving. Batches every accumulated edit into
 * one write against the role's `version` — no per-toggle immediate persistence.
 */
export function SaveBar({
  dirty,
  saving,
  changeCount,
  roleVersion,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  changeCount: number;
  roleVersion: number;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const statusText = saving
    ? "Saving…"
    : dirty
      ? `${changeCount} unsaved ${changeCount === 1 ? "change" : "changes"}`
      : "All changes saved";

  return (
    <div
      className="flex flex-none items-center gap-3.5 border-t border-border bg-surface px-6 py-0"
      style={{ height: 64 }}
    >
      <span
        className={cn(
          "inline-flex items-center gap-2 text-[12.5px] font-semibold",
          saving ? "text-primary" : dirty ? "text-warning-ink" : "text-success-ink",
        )}
        data-testid="save-bar-status"
      >
        <span
          className={cn(
            "h-2 w-2 flex-none rounded-full",
            saving ? "bg-primary" : dirty ? "bg-warning" : "bg-success",
          )}
          aria-hidden
        />
        {statusText}
      </span>
      <span className="text-[11.5px] text-faint">
        Edits save together in one optimistic-lock check (v{roleVersion}).
      </span>
      <div className="ml-auto flex gap-2.5">
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || saving}
          onClick={onDiscard}
          data-testid="discard-changes"
        >
          Discard changes
        </Button>
        <Button
          type="button"
          disabled={!dirty || saving}
          onClick={onSave}
          data-testid="save-changes"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
