"use client";

import { cn } from "@/lib/utils";

export type PaymentsView = "PAYMENTS" | "OUTSTANDING";

/**
 * Segmented control tablist over the two Payments views (spec §3, §5; design "Segmented"
 * frame). `role="tablist"` with `aria-selected`; each tab is a real `<button>`.
 */
export function PaymentsSegmentedControl({
  value,
  onChange,
}: {
  value: PaymentsView;
  onChange: (v: PaymentsView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Payments views"
      className="inline-flex rounded-token border border-border-strong bg-surface p-0.5"
      data-testid="payments-segmented"
    >
      <Tab active={value === "PAYMENTS"} onClick={() => onChange("PAYMENTS")} testId="payments-tab-payments">
        Payments
      </Tab>
      <Tab active={value === "OUTSTANDING"} onClick={() => onChange("OUTSTANDING")} testId="payments-tab-outstanding">
        Outstanding
      </Tab>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "rounded-token px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
