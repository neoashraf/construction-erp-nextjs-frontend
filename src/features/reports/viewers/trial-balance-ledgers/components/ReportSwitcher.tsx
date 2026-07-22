"use client";

import { ReportTypeSwitcher, type ReportChip } from "../../../components/ReportTypeSwitcher";
import { type ReportTab } from "../types";

/**
 * FE-56 four-report chip row (spec §3/§9). Trial balance is a balance/as-of report
 * (violet dot); the three flow reports (ledger / daybook / cash-bank) are date-range
 * reports (blue dot). Rendered as the shared design chip row.
 */
const CHIPS: ReadonlyArray<ReportChip<ReportTab>> = [
  { id: "TB", label: "Trial balance", tone: "violet" },
  { id: "LEDGER", label: "Account ledger", tone: "blue" },
  { id: "DAYBOOK", label: "Journal register", tone: "blue" },
  { id: "CASH_BANK", label: "Cash & bank book", tone: "blue" },
];

export function ReportSwitcher({
  value,
  onChange,
}: {
  value: ReportTab;
  onChange: (tab: ReportTab) => void;
}) {
  return (
    <ReportTypeSwitcher
      ariaLabel="Register report"
      chips={CHIPS}
      value={value}
      onChange={onChange}
      testId="tb-ledger-switcher"
      chipTestId={(id) => `tb-tab-${id}`}
    />
  );
}
