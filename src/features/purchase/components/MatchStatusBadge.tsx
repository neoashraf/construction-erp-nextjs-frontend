import { Badge } from "@/components/ui/badge";
import { MATCH_STATUS_LABEL } from "../schemas/grn.schema";
import { type PurchaseMatchStatus } from "../types";

/**
 * PO → Bill → GRN per-line match status badge (FR-PUR-017; spec §5/§10). Text +
 * dot, never colour-only — "Matched" / "Over-received" / "Under-received" /
 * "Pending receipt". `aria-label` names the axis so screen readers hear
 * "Match status: Under-received", not just the label (spec §10).
 */
const TONE: Record<PurchaseMatchStatus, "success" | "info" | "warning" | "neutral"> = {
  MATCHED: "success",
  OVER_RECEIVED: "info",
  UNDER_RECEIVED: "warning",
  PENDING_RECEIPT: "neutral",
};

export function MatchStatusBadge({
  status,
  className,
}: {
  status: PurchaseMatchStatus;
  className?: string;
}) {
  const label = MATCH_STATUS_LABEL[status];
  return (
    <Badge
      tone={TONE[status]}
      dot
      className={className}
      data-testid={`match-status-${status}`}
      aria-label={`Match status: ${label}`}
    >
      {label}
    </Badge>
  );
}
