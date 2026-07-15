"use client";

import { Badge } from "@/components/ui/badge";
import { type CostCentreVarianceStatus } from "../types";

/**
 * FE-57 CC variance status badge (spec §8) — the same visual language as the
 * live Budget-vs-actual monitor (FE-24). Verbatim from CC — RPT never
 * reclassifies (FR-RPT-004).
 */
const LABEL: Record<CostCentreVarianceStatus, string> = {
  OK: "OK",
  APPROACHING: "Approaching",
  OVER: "Over budget",
  UNBUDGETED: "Unbudgeted",
};
const TONE: Record<CostCentreVarianceStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  OK: "success",
  APPROACHING: "warning",
  OVER: "destructive",
  UNBUDGETED: "neutral",
};

export function CostCentreStatusBadge({ status }: { status: CostCentreVarianceStatus }) {
  return (
    <Badge tone={TONE[status]} dot data-testid={`cc-status-${status}`}>
      {LABEL[status]}
    </Badge>
  );
}
