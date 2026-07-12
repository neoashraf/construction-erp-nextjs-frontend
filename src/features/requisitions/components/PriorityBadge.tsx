import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABEL } from "../schemas/requisition.schema";
import { type RequisitionPriority } from "../types";

/**
 * Requisition priority badge (spec §5). Text + dot, never colour-only (§10). Shared with
 * fe-requisition-approval / -issue.
 */
const TONE: Record<RequisitionPriority, "neutral" | "info" | "warning" | "destructive"> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "destructive",
};

export function PriorityBadge({ priority, className }: { priority: RequisitionPriority; className?: string }) {
  return (
    <Badge tone={TONE[priority]} dot className={className} data-testid={`req-priority-${priority}`}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}
