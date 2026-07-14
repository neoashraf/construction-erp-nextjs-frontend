import { Badge } from "@/components/ui/badge";
import { type VoucherStatus } from "../types";

/**
 * Voucher status badge — shared with FE-49/FE-50/FE-51. Text label + tone dot (never
 * colour alone — spec §10, WCAG 2.1 AA).
 */
const TONE: Record<VoucherStatus, "warning" | "success" | "neutral"> = {
  DRAFT: "warning",
  POSTED: "success",
  CANCELLED: "neutral",
};
const LABEL: Record<VoucherStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

export function voucherStatusLabel(s: VoucherStatus): string {
  return LABEL[s];
}

export function VoucherStatusBadge({ status, className }: { status: VoucherStatus; className?: string }) {
  return (
    <Badge
      tone={TONE[status]}
      dot
      className={className}
      data-testid={`voucher-status-${status}`}
      aria-label={`Status: ${LABEL[status]}`}
    >
      {LABEL[status]}
    </Badge>
  );
}
