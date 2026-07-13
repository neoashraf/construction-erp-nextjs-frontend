import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { PAYSLIP_COPY } from "../schemas/payslip.schema";

/**
 * Persistent banner shown when the parent salary run has status `REVERSED` (spec §13).
 * The figures displayed on this screen are the ORIGINAL posted values (immutable from the
 * `SalarySheetLine` at post time) — the banner makes that unmistakable and cross-links back
 * to the sheet's reversal linkage.
 */
export function ReversedRunBanner({ sheetId }: { sheetId: string }) {
  return (
    <Alert
      tone="warning"
      className="mb-3 print-hide"
      title="Reversed run"
      data-testid="payslip-reversed-banner"
      role="status"
    >
      <p className="text-[12.5px]">{PAYSLIP_COPY.reversedBanner}</p>
      <Link
        href={`/hr/salary-sheets/${sheetId}`}
        className="mt-1 inline-block text-[12px] text-accent-ink underline-offset-2 hover:underline"
        data-testid="payslip-reversed-link"
      >
        {PAYSLIP_COPY.backToSheet}
      </Link>
    </Alert>
  );
}
