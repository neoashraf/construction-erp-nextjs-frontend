import { Badge } from "@/components/ui/badge";
import { type BvaStatus } from "../types";

/**
 * Cost-control status badge (spec §5/§8; FR-CC-011/012/015). Maps the four
 * classifications onto the shared design-system Badge tones — text + dot, never
 * colour-only (§10). Shared across the three CC read screens.
 */
const TONE: Record<BvaStatus, "success" | "warning" | "destructive" | "neutral"> = {
  OK: "success",
  APPROACHING: "warning",
  OVER: "destructive",
  UNBUDGETED: "neutral",
};

const LABEL: Record<BvaStatus, string> = {
  OK: "OK",
  APPROACHING: "Approaching",
  OVER: "Over budget",
  UNBUDGETED: "Unbudgeted",
};

const TITLE: Partial<Record<BvaStatus, string>> = {
  UNBUDGETED:
    "No budget is set for this cost centre on this project — spend is tracked but not compared against a target.",
};

export function StatusBadge({ status, className }: { status: BvaStatus; className?: string }) {
  return (
    <Badge tone={TONE[status]} dot className={className} title={TITLE[status]} data-testid={`cc-status-${status}`}>
      {LABEL[status]}
    </Badge>
  );
}
