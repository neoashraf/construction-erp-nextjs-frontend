import { Banknote, CreditCard, Landmark, Smartphone, Zap, type LucideIcon } from "lucide-react";
import { type PaymentMode } from "../types";

/**
 * Payment-mode icon + label (spec §5 "all five rendered as equally normal" — overview
 * §9, cash/MFS are not edge cases). Shared with FE-46/FE-47.
 */
const ICON: Record<PaymentMode, LucideIcon> = {
  CASH: Banknote,
  MFS: Smartphone,
  BANK_TRANSFER: Landmark,
  CHEQUE: CreditCard,
  RTGS: Zap,
};

const LABEL: Record<PaymentMode, string> = {
  CASH: "Cash",
  MFS: "MFS",
  BANK_TRANSFER: "Bank",
  CHEQUE: "Cheque",
  RTGS: "RTGS",
};

export function paymentModeLabel(mode: PaymentMode): string {
  return LABEL[mode];
}

export function PaymentModeBadge({
  mode,
  className,
}: {
  mode: PaymentMode;
  className?: string;
}) {
  const Icon = ICON[mode];
  return (
    <span
      className={
        className ?? "inline-flex items-center gap-1.5 text-[13px] text-foreground"
      }
      data-testid={`payment-mode-${mode}`}
      aria-label={`Mode: ${LABEL[mode]}`}
    >
      <Icon className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden />
      {LABEL[mode]}
    </span>
  );
}
