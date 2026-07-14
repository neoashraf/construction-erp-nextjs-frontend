import { Badge } from "@/components/ui/badge";
import { GRN_STATUS_LABEL } from "../schemas/grn.schema";
import { type GrnStatus } from "../types";

/**
 * GRN status badge — DRAFT/warning, POSTED/success, CANCELLED/neutral (FR-PUR-024;
 * spec §5/§10). Text + dot, never colour-only.
 */
const TONE: Record<GrnStatus, "warning" | "success" | "neutral"> = {
  DRAFT: "warning",
  POSTED: "success",
  CANCELLED: "neutral",
};

export function GrnStatusBadge({ status, className }: { status: GrnStatus; className?: string }) {
  return (
    <Badge tone={TONE[status]} dot className={className} data-testid={`grn-status-${status}`}>
      {GRN_STATUS_LABEL[status]}
    </Badge>
  );
}
