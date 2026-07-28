"use client";

import { cn } from "@/lib/utils";

export type PaymentsView = "PAYMENTS" | "OUTSTANDING";

/**
 * Segmented control tablist over the two Payments views (spec §3, §5; design "Segmented"
 * frame). `role="tablist"` with `aria-selected`; each tab is a real `<button>`.
 *
 * Selecting a tab NAVIGATES to that view's own route, so focus stays on the newly
 * selected tab rather than being lost to `<body>` across the URL change (spec §10).
 * `showOutstanding={false}` HIDES the Outstanding tab for an actor without
 * `payments.open_payables:READ` — hiding, never disabling; the server's 403 is the gate.
 */
export function PaymentsSegmentedControl({
  value,
  onChange,
  showOutstanding = true,
}: {
  value: PaymentsView;
  onChange: (v: PaymentsView) => void;
  showOutstanding?: boolean;
}) {
  /**
   * Keep focus on the tab the user just activated. Selecting a tab triggers a client-side
   * route change; without this the focused element can be torn down and focus falls back
   * to `<body>`, silently relocating a keyboard/screen-reader user to a different URL.
   */
  function select(e: React.MouseEvent<HTMLButtonElement>, next: PaymentsView) {
    e.currentTarget.focus();
    onChange(next);
  }

  return (
    <div
      role="tablist"
      aria-label="Payments views"
      className="inline-flex rounded-token border border-border bg-surface-2 p-0.5"
      data-testid="payments-segmented"
    >
      <Tab
        active={value === "PAYMENTS"}
        onClick={(e) => select(e, "PAYMENTS")}
        testId="payments-tab-payments"
      >
        Payments
      </Tab>
      {showOutstanding && (
        <Tab
          active={value === "OUTSTANDING"}
          onClick={(e) => select(e, "OUTSTANDING")}
          testId="payments-tab-outstanding"
        >
          Outstanding
        </Tab>
      )}
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
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
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
        "rounded-[6px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
        active
          ? "bg-surface text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
