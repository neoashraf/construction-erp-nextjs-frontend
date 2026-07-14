import { Banknote, CreditCard, Landmark, Smartphone, type LucideIcon } from "lucide-react";
import { type PaymentMode } from "../types";

/**
 * Payment-mode icon + label (spec §5: "all four rendered as equally normal" —
 * overview §9, cash/MFS are not edge cases). Shared with FE-43/FE-44.
 */
const ICON: Record<PaymentMode, LucideIcon> = {
  CASH: Banknote,
  MFS: Smartphone,
  BANK_TRANSFER: Landmark,
  CHEQUE: CreditCard,
};

const LABEL: Record<PaymentMode, string> = {
  CASH: "Cash",
  MFS: "MFS",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
};

export function paymentModeLabel(mode: PaymentMode): string {
  return LABEL[mode];
}

export function PaymentModeTag({ mode, className }: { mode: PaymentMode; className?: string }) {
  const Icon = ICON[mode];
  return (
    <span
      className={className ?? "inline-flex items-center gap-1.5 text-[13px] text-foreground"}
      data-testid={`receipt-mode-${mode}`}
    >
      <Icon className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden />
      {LABEL[mode]}
    </span>
  );
}
