"use client";

import { Badge } from "@/components/ui/badge";
import { type TileStatus } from "../types";

/**
 * FE-61 tile status badge (FR-DSH-018) — label + colour, never colour-only
 * (WCAG 1.4.1). `null` renders no badge; `OK` renders neutrally; the risk
 * tones map to the design-system semantics.
 */
const LABEL: Record<Exclude<TileStatus, null>, string> = {
  OK: "OK",
  APPROACHING: "Approaching",
  OVER: "Over",
  BREACH: "Breach",
};
const TONE: Record<Exclude<TileStatus, null>, React.ComponentProps<typeof Badge>["tone"]> = {
  OK: "neutral",
  APPROACHING: "warning",
  OVER: "destructive",
  BREACH: "destructive",
};

export function TileStatusBadge({ status, testId = true }: { status: TileStatus; testId?: boolean }) {
  if (!status) return null;
  return (
    <Badge
      tone={TONE[status]}
      dot
      className="h-[22px] flex-none gap-[5px] px-2.5 text-[11px]"
      data-testid={testId ? `tile-status-${status}` : undefined}
    >
      {LABEL[status]}
    </Badge>
  );
}
