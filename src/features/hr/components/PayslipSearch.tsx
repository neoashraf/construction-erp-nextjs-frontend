"use client";

import { Input } from "@/components/ui/input";
import { PAYSLIP_COPY } from "../schemas/payslip.schema";

/**
 * Employee search box (spec §8 placeholder verbatim). The ONLY editable input on the whole
 * payslip surface — everything else is read-only. Uses the shared `shadow-focus` /
 * `shadow-focus-error` treatment via the `Input` primitive (brief rule: only search box
 * uses shared focus shadow).
 */
export function PayslipSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="w-full max-w-sm print-hide">
      <label htmlFor="payslip-search" className="sr-only">
        {PAYSLIP_COPY.searchPlaceholder}
      </label>
      <Input
        id="payslip-search"
        type="search"
        placeholder={PAYSLIP_COPY.searchPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid="payslip-search"
        aria-label={PAYSLIP_COPY.searchPlaceholder}
      />
    </div>
  );
}
