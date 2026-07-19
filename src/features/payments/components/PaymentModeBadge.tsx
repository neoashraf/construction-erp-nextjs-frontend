import { cn } from "@/lib/utils";
import { type PaymentMode } from "../types";

/**
 * Payment-mode pill — coloured `soft`/`ink` badge + tone dot, per the design file
 * ("Payments"/viewer mode column): Bank transfer = info(blue) · Cash = neutral(grey) ·
 * MFS = violet · Cheque = warning(amber) · RTGS = teal. Shared with FE-46/FE-47.
 * Colour never carries meaning alone — the label is always present (a11y §10).
 */
const LABEL: Record<PaymentMode, string> = {
  CASH: "Cash",
  MFS: "MFS",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
  RTGS: "RTGS",
};

/** Pill colour classes per mode (design-system tokens only). */
const TONE: Record<PaymentMode, { pill: string; dot: string }> = {
  CASH: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  MFS: { pill: "bg-violet-soft text-violet-ink", dot: "bg-violet" },
  BANK_TRANSFER: { pill: "bg-info-soft text-info-ink", dot: "bg-info" },
  CHEQUE: { pill: "bg-warning-soft text-warning-ink", dot: "bg-warning" },
  RTGS: { pill: "bg-teal-soft text-teal-ink", dot: "bg-teal" },
};

export function paymentModeLabel(mode: PaymentMode): string {
  return LABEL[mode];
}

export function PaymentModeBadge({ mode, className }: { mode: PaymentMode; className?: string }) {
  const tone = TONE[mode];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold",
        tone.pill,
        className,
      )}
      data-testid={`payment-mode-${mode}`}
      aria-label={`Mode: ${LABEL[mode]}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
      {LABEL[mode]}
    </span>
  );
}
