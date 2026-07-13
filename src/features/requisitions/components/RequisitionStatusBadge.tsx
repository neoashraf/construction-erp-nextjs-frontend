import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "../schemas/requisition.schema";
import { type RequisitionStatus } from "../types";

/**
 * Requisition status badge covering all seven lifecycle states (FR-REQ-022; spec §5).
 * Text + dot, never colour-only (§10). Shared with fe-requisition-approval / -issue.
 */
const TONE: Record<RequisitionStatus, "warning" | "info" | "success" | "destructive" | "accent" | "neutral"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  APPROVED: "success",
  REJECTED: "destructive",
  PARTIALLY_ISSUED: "warning",
  ISSUED: "accent",
  CLOSED: "neutral",
};

export function RequisitionStatusBadge({ status, className }: { status: RequisitionStatus; className?: string }) {
  return (
    <Badge tone={TONE[status]} dot className={className} data-testid={`req-status-${status}`}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
