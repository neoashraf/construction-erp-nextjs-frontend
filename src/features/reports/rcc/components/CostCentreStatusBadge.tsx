"use client";

import { Badge } from "@/components/ui/badge";
import { type CostCentreVarianceStatus } from "../types";

/**
 * FE-59 CC variance status badge (spec §8) — CC's classification rendered
 * verbatim (FR-CC-015; FR-RPT-004): label + colour, never colour-only (WCAG
 * 1.4.1). Same visual language as the CC Budget-vs-actual monitor.
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
    <Badge tone={TONE[status]} dot data-testid={`rcc-status-${status}`}>
      {LABEL[status]}
    </Badge>
  );
}
