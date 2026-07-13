import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Employee, type WageType } from "../types";
import { WAGE_TYPE_LABEL, WORK_BASE_LABEL } from "../lib";

/** ACTIVE → success pill, INACTIVE → neutral pill (dot + text; never colour alone). */
export function EmployeeStatusBadge({ status }: { status: Employee["status"] }) {
  return status === "ACTIVE" ? (
    <Badge tone="success" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="neutral" dot>
      Inactive
    </Badge>
  );
}

/** Work-base chip (Head office / Site) — a small squared tag, tint is wayfinding only. */
export function WorkBaseChip({ workBase }: { workBase: Employee["workBase"] }) {
  const isSite = workBase === "SITE";
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center rounded-[5px] px-1.5 text-[10px] font-semibold tracking-[0.3px]",
        isSite ? "bg-info-soft text-info-ink" : "bg-muted text-muted-foreground",
      )}
    >
      {WORK_BASE_LABEL[workBase]}
    </span>
  );
}

/** Wage-type pill (Monthly = accent, Daily = teal). */
export function WageTypePill({ wageType }: { wageType: WageType }) {
  const isMonthly = wageType === "MONTHLY";
  return (
    <span
      className={cn(
        "inline-flex h-[21px] items-center rounded-pill px-2.5 text-[11px] font-semibold",
        isMonthly ? "bg-accent-soft text-accent-ink" : "bg-teal-soft text-teal",
      )}
    >
      {WAGE_TYPE_LABEL[wageType]}
    </span>
  );
}
