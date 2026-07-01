import { Badge, type BadgeProps } from "@/components/ui/badge";
import { type AccountType } from "../types";
import { ACCOUNT_TYPE_LABEL } from "../schemas/chart-of-accounts.schema";

/** Account-type badge — colour + TEXT label (a11y: never colour-only). Spec §5. */
const TONE: Record<AccountType, NonNullable<BadgeProps["tone"]>> = {
  ASSET: "info",
  LIABILITY: "warning",
  EQUITY: "accent",
  INCOME: "success",
  EXPENSE: "destructive",
};

export function TypeBadge({ type }: { type: AccountType }) {
  return (
    <Badge tone={TONE[type]} className="normal-case">
      {ACCOUNT_TYPE_LABEL[type]}
    </Badge>
  );
}
