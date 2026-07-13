import { Badge } from "@/components/ui/badge";
import { type SalarySheetStatus } from "../types";

const TONE = {
  DRAFT: "warning",
  POSTED: "success",
  REVERSED: "neutral",
} as const;

const LABEL = {
  DRAFT: "Draft",
  POSTED: "Posted",
  REVERSED: "Reversed",
} as const;

/** Salary-run lifecycle badge (Salary Sheet.dc.html): draft→warning, posted→success, reversed→neutral. */
export function SalaryStatusBadge({
  status,
  upper,
}: {
  status: SalarySheetStatus;
  upper?: boolean;
}) {
  const label = LABEL[status];
  return (
    <Badge tone={TONE[status]} dot>
      {upper ? label.toUpperCase() : label}
    </Badge>
  );
}
