"use client";

import { Badge } from "@/components/ui/badge";
import { useGapAudit } from "../hooks/useNumberingSeries";

/**
 * Per-row continuity badge (spec §5/§6, FR-NUM-021). Derived from the series'
 * gap-audit — Continuous (green) when `continuous`, Gap detected (alert) otherwise.
 * The audit hasn't-resolved partial state renders a muted "Checking…" placeholder
 * (spec §6 Partial); a failed check renders a muted "Check unavailable" (never an
 * error banner in a table cell). Text-labelled, not colour-only (spec §10).
 */
export function ContinuityBadge({ seriesId }: { seriesId: string }) {
  const query = useGapAudit(seriesId, undefined, true);

  if (query.isLoading) {
    return (
      <span
        className="text-[11.5px] text-faint"
        data-testid={`continuity-checking-${seriesId}`}
      >
        Checking…
      </span>
    );
  }
  if (query.isError || !query.data) {
    return (
      <span
        className="text-[11.5px] text-faint"
        data-testid={`continuity-unknown-${seriesId}`}
      >
        Check unavailable
      </span>
    );
  }

  const gap = query.data.integrityAlert || !query.data.continuous;
  return gap ? (
    <Badge tone="destructive" dot data-testid={`continuity-gap-${seriesId}`}>
      Gap detected
    </Badge>
  ) : (
    <Badge tone="success" dot data-testid={`continuity-ok-${seriesId}`}>
      Continuous
    </Badge>
  );
}
