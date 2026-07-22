"use client";

import { ReportTypeSwitcher, type ReportChip } from "../../components/ReportTypeSwitcher";
import { type RccReportTab } from "../types";

/** FE-59 REQ + CC chip row — both are date-range flow reports (blue dot). */
const CHIPS: ReadonlyArray<ReportChip<RccReportTab>> = [
  { id: "REQUISITION_VS_ISSUE", label: "Requisition vs issue", tone: "blue" },
  { id: "COST_CENTRE_VARIANCE", label: "Cost-centre variance", tone: "blue" },
];

export function RccReportSwitcher({
  value,
  onChange,
}: {
  value: RccReportTab;
  onChange: (next: RccReportTab) => void;
}) {
  return (
    <ReportTypeSwitcher
      ariaLabel="Requisition & cost-control report"
      chips={CHIPS}
      value={value}
      onChange={onChange}
      testId="rcc-switcher"
      chipTestId={(id) => `rcc-tab-${id}`}
    />
  );
}
