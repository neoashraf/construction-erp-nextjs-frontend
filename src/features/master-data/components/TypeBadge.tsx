import { type AccountType } from "../types";
import { ACCOUNT_TYPE_LABEL } from "../schemas/chart-of-accounts.schema";

/**
 * Account-type visual meta — colour + TEXT label (a11y: never colour-only). The design
 * file `Chart-of-Accounts.dc.html` uses type-specific dot/soft/ink triples that do NOT
 * all map onto the shared semantic tokens (e.g. Equity violet, Liability amber), so the
 * chart-of-accounts pills carry their own palette here. Spec §5.
 */
export const TYPE_META: Record<
  AccountType,
  { label: string; base: string; soft: string; ink: string }
> = {
  ASSET: { label: "Asset", base: "#3B7DF6", soft: "#E6EFFE", ink: "#1F56C4" },
  LIABILITY: { label: "Liability", base: "#E0922A", soft: "#FBEFDD", ink: "#9A6212" },
  EQUITY: { label: "Equity", base: "#7C5CFC", soft: "#EEEAFD", ink: "#5B3FD0" },
  INCOME: { label: "Income", base: "#1FA46B", soft: "#E3F5EC", ink: "#15784F" },
  EXPENSE: { label: "Expense", base: "#E0484D", soft: "#FBE6E7", ink: "#A8282D" },
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
      className="inline-flex items-center rounded-pill font-semibold"
      style={{
        background: m.soft,
        color: m.ink,
        height: sm ? 18 : 22,
        padding: sm ? "0 7px" : "0 9px",
        gap: sm ? 5 : 6,
        fontSize: sm ? 10 : 11,
        letterSpacing: "0.2px",
      }}
    >
      <span
        className="rounded-full"
        style={{ background: m.base, width: sm ? 5 : 6, height: sm ? 5 : 6 }}
        aria-hidden
      />
      {m.label ?? ACCOUNT_TYPE_LABEL[type]}
    </span>
  );
}
