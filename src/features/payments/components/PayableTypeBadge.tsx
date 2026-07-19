import { cn } from "@/lib/utils";
import { type PayableType } from "../types";

/**
 * Payable-type pill — coloured `soft`/`ink` badge + tone dot, per the design file
 * (Outstanding / editor allocation grid): Purchase bill = info(blue) ·
 * Labour payable = warning(amber) · Salary = violet(purple). Full labels, never
 * abbreviated; colour never carries meaning alone (a11y §10).
 */
const TONE: Record<PayableType, { pill: string; dot: string }> = {
  PURCHASE_BILL: { pill: "bg-info-soft text-info-ink", dot: "bg-info" },
  LABOUR_PAYABLE: { pill: "bg-warning-soft text-warning-ink", dot: "bg-warning" },
  SALARY: { pill: "bg-violet-soft text-violet-ink", dot: "bg-violet" },
};
const LABEL: Record<PayableType, string> = {
  PURCHASE_BILL: "Purchase bill",
  LABOUR_PAYABLE: "Labour payable",
  SALARY: "Salary",
};

export function payableTypeLabel(t: PayableType): string {
  return LABEL[t];
}

export function PayableTypeBadge({ type, className }: { type: PayableType; className?: string }) {
  const tone = TONE[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold",
        tone.pill,
        className,
      )}
      data-testid={`payable-type-${type}`}
      aria-label={`Payable type: ${LABEL[type]}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
      {LABEL[type]}
    </span>
  );
}
