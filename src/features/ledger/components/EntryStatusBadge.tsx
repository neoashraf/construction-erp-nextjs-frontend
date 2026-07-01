"use client";

import { Badge } from "@/components/ui/badge";
import { type EntryStatus } from "../types";

/**
 * Entry status badge (spec §5/§13, FR-LED-026). Text-labelled, never colour-only
 * (WCAG colour-independence, spec §10):
 *  - Normal   → neutral
 *  - Reversal → info (this entry is itself a reversal, `isReversal`)
 *  - Reversed → warning (an original a later reversal references, derived `isReversed`)
 */
const STATUS: Record<EntryStatus, { tone: "neutral" | "info" | "warning"; label: string }> = {
  normal: { tone: "neutral", label: "Normal" },
  reversal: { tone: "info", label: "Reversal" },
  reversed: { tone: "warning", label: "Reversed" },
};

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const { tone, label } = STATUS[status];
  return (
    <Badge tone={tone} dot data-testid={`entry-status-${status}`}>
      {label}
    </Badge>
  );
}
