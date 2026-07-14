import { Badge } from "@/components/ui/badge";
import { BILL_STATUS_LABEL } from "../schemas/bill.schema";
import { type PurchaseBillStatus } from "../types";

/**
 * Purchase Bill status badge covering the three lifecycle states (FR-PUR-004/-008/-022;
 * spec §5/§10). Text + dot, never colour-only — DRAFT/warning, POSTED/success,
 * CANCELLED/neutral. Shared list + editor + viewer for a consistent PUR visual.
 */
const TONE: Record<PurchaseBillStatus, "warning" | "success" | "neutral"> = {
  DRAFT: "warning",
  POSTED: "success",
  CANCELLED: "neutral",
};

export function BillStatusBadge({ status, className }: { status: PurchaseBillStatus; className?: string }) {
  return (
    <Badge tone={TONE[status]} dot className={className} data-testid={`bill-status-${status}`}>
      {BILL_STATUS_LABEL[status]}
    </Badge>
  );
}
