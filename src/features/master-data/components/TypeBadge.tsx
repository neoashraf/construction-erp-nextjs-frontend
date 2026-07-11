import { type AccountType } from "../types";
import { ACCOUNT_TYPE_LABEL } from "../schemas/chart-of-accounts.schema";
import { cn } from "@/lib/utils";

/**
 * Account-type visual meta — a categorical TONE + TEXT label (a11y: never colour-only).
 * The five account types map onto the design-system's categorical tokens
 * (info/warning/violet/success/destructive), so the chart-of-accounts pills build from
 * those token utilities — never raw hex. Spec §5 / design file `Chart-of-Accounts.dc.html`.
 */
export type AccountTypeTone = "info" | "warning" | "violet" | "success" | "destructive";

export const TYPE_META: Record<AccountType, { label: string; tone: AccountTypeTone }> = {
  ASSET: { label: "Asset", tone: "info" },
  LIABILITY: { label: "Liability", tone: "warning" },
  EQUITY: { label: "Equity", tone: "violet" },
  INCOME: { label: "Income", tone: "success" },
  EXPENSE: { label: "Expense", tone: "destructive" },
};

/** Soft-bg + ink-text pill classes per tone (type pills + mobile code chips). */
export const TYPE_PILL: Record<AccountTypeTone, string> = {
  info: "bg-info-soft text-info-ink",
  warning: "bg-warning-soft text-warning-ink",
  violet: "bg-violet-soft text-violet-ink",
  success: "bg-success-soft text-success-ink",
  destructive: "bg-destructive-soft text-destructive-ink",
};

/** Solid dot-fill class per tone (the type-filter colour dots). */
export const TYPE_DOT: Record<AccountTypeTone, string> = {
  info: "bg-info",
  warning: "bg-warning",
  violet: "bg-violet",
  success: "bg-success",
  destructive: "bg-destructive",
};

/** Balance-sheet vs P&L statement of an account type (design: top-level group tag). */
export function statementOf(type: AccountType): "BS" | "P&L" {
  return type === "INCOME" || type === "EXPENSE" ? "P&L" : "BS";
}

/** Account-type pill (dot + soft bg + ink label) matching the design's tree/columns. */
export function TypeBadge({
  type,
  size = "md",
}: {
  type: AccountType;
  /** md = tree/column pill (22px); sm = dropdown-option pill (18px). */
  size?: "md" | "sm";
}) {
  const m = TYPE_META[type];
  const sm = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill font-semibold tracking-[0.2px]",
        TYPE_PILL[m.tone],
        sm ? "h-[18px] gap-[5px] px-[7px] text-[10px]" : "h-[22px] gap-1.5 px-[9px] text-[11px]",
      )}
    >
      <span
        className={cn("rounded-full", TYPE_DOT[m.tone], sm ? "h-[5px] w-[5px]" : "h-1.5 w-1.5")}
        aria-hidden
      />
      {m.label ?? ACCOUNT_TYPE_LABEL[type]}
    </span>
  );
}
