"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CONFLICT_MESSAGE } from "../schemas/role-permissions";

/**
 * Optimistic-lock conflict banner (spec §6/§9/§13; FR-AUD-019). Stale `version`
 * on save -> this banner, with the Admin's pending edits preserved (never
 * silently overwritten) and a Reload control. `role="alert"` + focus moves to
 * Reload on mount (spec §10 a11y).
 */
export function ConflictBanner({ onReload }: { onReload: () => void }) {
  const reloadRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    reloadRef.current?.focus();
  }, []);

  return (
    <div
      role="alert"
      data-testid="conflict-banner"
      className="mb-3.5 flex flex-none items-center gap-3.5 rounded-token border border-destructive/40 bg-destructive-soft px-4 py-3"
    >
      <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-token bg-destructive-soft text-[15px] font-bold text-destructive-ink">
        !
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-foreground">
          This role was changed by someone else.
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">
          Reload to see the latest, then reapply your changes. Your pending edits are preserved
          below.
        </div>
      </div>
      <Button
        ref={reloadRef}
        type="button"
        variant="outline"
        onClick={onReload}
        data-testid="conflict-reload"
      >
        Reload
      </Button>
    </div>
  );
}

export { CONFLICT_MESSAGE };
