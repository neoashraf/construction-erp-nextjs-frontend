"use client";

import { ReportTypeSwitcher, type ReportChip } from "../../components/ReportTypeSwitcher";
import { type InventoryReportTab } from "../types";

/**
 * FE-58 three-report chip row (spec §3, §9). Stock valuation + low-stock are
 * as-of/balance reports (violet dot); the transfer summary is a date-range flow
 * report (blue dot). Rendered as the shared design chip row.
 */
const CHIPS: ReadonlyArray<ReportChip<InventoryReportTab>> = [
  { id: "STOCK_VALUATION", label: "Stock valuation", tone: "violet" },
  { id: "LOW_STOCK", label: "Low-stock", tone: "violet" },
  { id: "TRANSFER_SUMMARY", label: "Stock transfer summary", tone: "blue" },
];

export function InventoryReportsSwitcher({
  value,
  onChange,
}: {
  value: InventoryReportTab;
  onChange: (next: InventoryReportTab) => void;
}) {
  return (
    <ReportTypeSwitcher
      ariaLabel="Inventory report"
      chips={CHIPS}
      value={value}
      onChange={onChange}
      testId="iv-switcher"
      chipTestId={(id) => `iv-tab-${id}`}
    />
  );
}
