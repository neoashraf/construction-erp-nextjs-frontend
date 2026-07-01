"use client";

import { Plus, MinusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * FY-level toolbar (spec §5/§6/§9): "Generate periods" only when the FY has no
 * periods (`period.generate`); "Close all (year-end)" when periods exist with
 * ≥1 OPEN (`period.close`). Both open a confirm dialog first — no API call here.
 */
export function FyToolbar({
  showGenerate,
  showCloseAll,
  closeAllBusy,
  disabled,
  onGenerate,
  onCloseAll,
}: {
  showGenerate: boolean;
  showCloseAll: boolean;
  closeAllBusy: boolean;
  disabled?: boolean;
  onGenerate: () => void;
  onCloseAll: () => void;
}) {
  if (!showGenerate && !showCloseAll) return null;

  return (
    <div className="flex flex-none flex-wrap items-center gap-2">
      {showGenerate && (
        <Button size="md" onClick={onGenerate} disabled={disabled} data-testid="generate-periods">
          <Plus className="h-4 w-4" aria-hidden />
          Generate periods
        </Button>
      )}
      {showCloseAll && (
        <Button
          size="md"
          variant="outline"
          onClick={onCloseAll}
          disabled={disabled || closeAllBusy}
          aria-busy={closeAllBusy || undefined}
          data-testid="close-all"
        >
          <MinusSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
          {closeAllBusy ? "Closing periods…" : "Close all (year-end)"}
        </Button>
      )}
    </div>
  );
}
