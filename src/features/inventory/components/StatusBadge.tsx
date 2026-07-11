import { Badge } from "@/components/ui/badge";
import { type StockJournalStatus } from "../types";

/**
 * Stock Journal status badge (spec §5/§10). Maps the four lifecycle states onto the
 * shared Badge tones — text + dot, never colour-only (§10). Drives which actions are
 * visible in the editor header (§9).
 */
const TONE: Record<StockJournalStatus, "warning" | "info" | "success" | "neutral"> = {
  DRAFT: "warning",
  APPROVED: "info",
  POSTED: "success",
  CANCELLED: "neutral",
};
const LABEL: Record<StockJournalStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

export function StatusBadge({ status, className }: { status: StockJournalStatus; className?: string }) {
  return (
    <Badge tone={TONE[status]} dot className={className} data-testid={`sj-status-${status}`}>
      {LABEL[status]}
    </Badge>
  );
}
