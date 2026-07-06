"use client";

import { MoneyInput } from "@/components/ui/money-input";
import { formatMoney } from "@/lib/money";
import { isInvalidLimit, LIMIT_VALIDATION_MESSAGE } from "../schemas/role-permissions";

/**
 * Per-permission value-limit input (spec §5/§7; FR-AUD-016; open-questions AUD —
 * limit precedence). Empty inherits the role's `approvalLimit` ("Role limit");
 * an explicit value overrides it for this `(module, action)` only. Labelled
 * distinctly from the role default per spec §9/§14.
 */
export function ValueLimitInput({
  cellKey,
  value,
  roleApprovalLimit,
  isUnscopedRole,
  disabled = false,
  onChange,
}: {
  cellKey: string;
  value: string;
  roleApprovalLimit: string | null;
  isUnscopedRole: boolean;
  /** Anti-lockout (Admin): introducing a limit is a narrow, so the field is locked. */
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const invalid = isInvalidLimit(value);
  const hintId = `value-limit-hint-${cellKey}`;
  const labelId = `value-limit-label-${cellKey}`;

  let hint: string;
  if (invalid) {
    hint = LIMIT_VALIDATION_MESSAGE;
  } else if (isUnscopedRole) {
    hint = "This role applies to all projects, so project scope can't be restricted.";
  } else if (value.trim() === "") {
    hint =
      roleApprovalLimit != null
        ? `Blank inherits the role limit (${formatMoney(roleApprovalLimit)}).`
        : "Role has no limit — blank means every approval escalates.";
  } else {
    hint = "Overrides the role limit for this permission.";
  }

  return (
    <div className="flex w-[230px] flex-none flex-col gap-1.5">
      <span
        id={labelId}
        className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Value limit{" "}
        <span className="font-medium normal-case tracking-normal text-faint">· optional</span>
      </span>
      <MoneyInput
        aria-labelledby={labelId}
        aria-describedby={hintId}
        value={value}
        placeholder="Role limit"
        invalid={invalid}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
        data-testid={`value-limit-input-${cellKey}`}
      />
      <span
        id={hintId}
        data-testid={`value-limit-hint-${cellKey}`}
        className={
          invalid ? "text-[11.5px] text-destructive" : "text-[11.5px] text-muted-foreground"
        }
      >
        {hint}
      </span>
    </div>
  );
}
