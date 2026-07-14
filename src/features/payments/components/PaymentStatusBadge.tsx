import { Badge } from "@/components/ui/badge";
import { type PaymentStatus } from "../types";

/**
 * Payment status badge — shared with FE-46/FE-47. Text label + tone dot (never colour
 * alone — spec §10, WCAG 2.1 AA).
 */
const TONE: Record<PaymentStatus, "warning" | "success" | "neutral"> = {
  DRAFT: "warning",
  POSTED: "success",
  CANCELLED: "neutral",
};

const LABEL: Record<PaymentStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <Badge
      tone={TONE[status]}
      dot
      className={className}
      data-testid={`payment-status-${status}`}
      aria-label={`Status: ${LABEL[status]}`}
    >
      {LABEL[status]}
    </Badge>
  );
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return LABEL[status];
}
