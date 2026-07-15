import { Badge } from "@/components/ui/badge";
import { type VoucherType } from "../types";

/** Voucher type badge — contra · journal · opening (spec §5, design "Type" column). */
const TONE: Record<VoucherType, "info" | "accent" | "warning"> = {
  CONTRA: "info",
  JOURNAL: "accent",
  OPENING: "warning",
};
const LABEL: Record<VoucherType, string> = {
  CONTRA: "Contra",
  JOURNAL: "Journal",
  OPENING: "Opening",
};

export function voucherTypeLabel(t: VoucherType): string {
  return LABEL[t];
}

export function VoucherTypeBadge({ type, className }: { type: VoucherType; className?: string }) {
  return (
    <Badge
      tone={TONE[type]}
      className={className}
      data-testid={`voucher-type-${type}`}
      aria-label={`Type: ${LABEL[type]}`}
    >
      {LABEL[type]}
    </Badge>
  );
}
