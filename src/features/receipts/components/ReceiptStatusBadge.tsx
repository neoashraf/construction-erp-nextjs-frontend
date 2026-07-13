import { Badge } from "@/components/ui/badge";
import { type ReceiptStatus } from "../types";

/**
 * Receipt status badge — Draft/warning, Posted/success, Cancelled/neutral (spec §5/§8).
 * Text + dot, never colour-only. Shared with `fe-receipt-editor` (FE-43) and
 * `fe-receipt-viewer` (FE-44).
 */
const TONE: Record<ReceiptStatus, "warning" | "success" | "neutral"> = {
  DRAFT: "warning",
  POSTED: "success",
  CANCELLED: "neutral",
};

const LABEL: Record<ReceiptStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

export function ReceiptStatusBadge({
  status,
  className,
}: {
  status: ReceiptStatus;
  className?: string;
}) {
  return (
    <Badge tone={TONE[status]} dot className={className} data-testid={`receipt-status-${status}`}>
      {LABEL[status]}
    </Badge>
  );
}
