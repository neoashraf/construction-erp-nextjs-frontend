import { Badge } from "@/components/ui/badge";
import { PO_STATUS_LABEL } from "../schemas/order.schema";
import { type PurchaseOrderStatus } from "../types";

/**
 * PO status badge covering the six lifecycle states (FR-PUR-002/-017; spec §5). Text + dot,
 * never colour-only (spec §10; brief §Scope 13). Shared with fe-purchase-bills +
 * fe-grn-matching for a consistent PUR visual.
 */
const TONE: Record<PurchaseOrderStatus, "warning" | "info" | "success" | "destructive" | "accent" | "neutral"> = {
  DRAFT: "warning",
  APPROVED: "success",
  PARTIALLY_BILLED: "info",
  PARTIALLY_RECEIVED: "accent",
  CLOSED: "neutral",
  CANCELLED: "destructive",
};

export function PurchaseStatusBadge({ status, className }: { status: PurchaseOrderStatus; className?: string }) {
  return (
    <Badge tone={TONE[status]} dot className={className} data-testid={`po-status-${status}`}>
      {PO_STATUS_LABEL[status]}
    </Badge>
  );
}
