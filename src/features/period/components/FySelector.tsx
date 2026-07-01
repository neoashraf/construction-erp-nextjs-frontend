"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { type FinancialYearOption } from "../types";

/**
 * The required in-page financial-year selector (spec §3/§7). Drives
 * `GET /api/periods?financialYearId=`; defaults to the shell's active FY
 * (screen wires the default, this component is presentation only). Shares the
 * standard focus/error field states (skill §8) via the `Select` primitive.
 */
export function FySelector({
  options,
  value,
  onChange,
  disabled,
}: {
  options: FinancialYearOption[];
  value: string;
  onChange: (financialYearId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="period-fy-selector">
        Financial year <span className="text-destructive">*</span>
      </Label>
      <Select
        id="period-fy-selector"
        data-testid="fy-selector"
        className="w-[300px] font-mono"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.length === 0 && <option value="">—</option>}
        {options.map((fy) => (
          <option key={fy.id} value={fy.id}>
            {fy.label} · {formatDate(fy.startDate)} – {formatDate(fy.endDate)}
          </option>
        ))}
      </Select>
    </div>
  );
}
