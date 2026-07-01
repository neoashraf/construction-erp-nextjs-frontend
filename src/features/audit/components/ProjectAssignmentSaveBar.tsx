"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Save/cancel bar for project assignment (spec §4/§8/§9). Save commits ONE
 * full-set-replace `PUT` — no `version` (SRS §16). Blocked on an empty
 * selection with the exact inline validation string.
 */
export function ProjectAssignmentSaveBar({
  dirty,
  saving,
  selectionError,
  onSave,
  onCancel,
}: {
  dirty: boolean;
  saving: boolean;
  selectionError: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const statusText = saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved";

  return (
    <div
      className="flex flex-none items-center gap-3.5 border-t border-border bg-surface px-6"
      style={{ height: 64 }}
      data-testid="save-bar"
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

      {selectionError ? (
        <span className="text-xs font-semibold text-destructive-ink" data-testid="selection-error">
          Select at least one project.
        </span>
      ) : (
        <span className="text-[11.5px] text-faint">
          Save replaces this user&rsquo;s whole project set via PUT /api/users/:id/projects.
        </span>
      )}

      <div className="ml-auto flex gap-2.5">
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || saving}
          onClick={onCancel}
          data-testid="cancel-changes"
        >
          Cancel
        </Button>
        <Button type="button" disabled={saving} onClick={onSave} data-testid="save-changes">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
