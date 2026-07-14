import { Badge } from "@/components/ui/badge";
import { type PayableType } from "../types";

/** Payable-type badge — supplier bill · daily-labour payable · salary payable. */
const TONE: Record<PayableType, "info" | "accent" | "warning"> = {
  PURCHASE_BILL: "info",
  LABOUR_PAYABLE: "warning",
  SALARY: "accent",
};
const LABEL: Record<PayableType, string> = {
  PURCHASE_BILL: "Bill",
  LABOUR_PAYABLE: "Labour",
  SALARY: "Salary",
};

export function payableTypeLabel(t: PayableType): string {
  return LABEL[t];
}

export function PayableTypeBadge({ type, className }: { type: PayableType; className?: string }) {
  return (
    <Badge
      tone={TONE[type]}
      className={className}
      data-testid={`payable-type-${type}`}
      aria-label={`Payable type: ${LABEL[type]}`}
    >
      {LABEL[type]}
    </Badge>
  );
}
