"use client";

import { MoneyInput } from "@/components/ui/money-input";
import { formatMoney } from "@/lib/money";
import { isInvalidLimit, LIMIT_VALIDATION_MESSAGE } from "../schemas/role-permissions";

/**
 * The role's approval-limit field (spec §5/§7; FR-AUD-016). Empty = escalate-by-
 * default ("No approval authority"), never "unlimited" (SRS §16). Shares the
 * platform's uniform focus/error field states via `MoneyInput`.
 */
export function ApprovalLimitInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const invalid = isInvalidLimit(value);
  const hintId = "approval-limit-hint";

  let hint: string;
  if (invalid) {
    hint = LIMIT_VALIDATION_MESSAGE;
  } else if (value.trim() === "") {
    hint = "No approval authority — every approval for this role escalates.";
  } else {
    hint = `Approvals above ${formatMoney(value)} escalate for additional sign-off.`;
  }

  return (
    <div className="w-[300px] flex-none">
      <label
        htmlFor="approval-limit"
        className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Approval limit{" "}
        <span className="font-medium normal-case tracking-normal text-faint">· per approval</span>
      </label>
      <MoneyInput
        id="approval-limit"
        value={value}
        placeholder="No limit"
        invalid={invalid}
        aria-describedby={hintId}
        onChange={(e) => onChange(e.target.value)}
        data-testid="approval-limit-input"
      />
      <p
        id={hintId}
        data-testid="approval-limit-hint"
        className={
          invalid
            ? "mt-1.5 text-[11.5px] text-destructive"
            : "mt-1.5 text-[11.5px] text-muted-foreground"
        }
      >
        {hint}
      </p>
    </div>
  );
}
