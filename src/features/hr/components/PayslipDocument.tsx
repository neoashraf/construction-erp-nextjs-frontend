"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { roleMatches } from "@/lib/auth/roles";
import { usePayslips } from "../hooks/usePayslips";
import { PayslipPrintActions } from "./PayslipPrintActions";
import { ReversedRunBanner } from "./ReversedRunBanner";
import { NotPostedGuard } from "./NotPostedGuard";
import { PAYSLIP_COPY, PAYSLIP_LABELS } from "../schemas/payslip.schema";
import type { Payslip } from "../api/salary";

/**
 * Single-payslip document view (spec §4/§5/§8; FR-HR-017). Read-only, printable.
 * Renders: masthead (company / period) → **Earnings** block (paid days, gross, allowances) →
 * **Deductions** block (TDS, PF, advance recovery, other) → **Net pay** as the document's
 * bolded summary value (heading level, so screen readers announce it as the primary — spec §10).
 *
 * Print stylesheet: chrome carries `.print-hide` (breadcrumb, actions, banner); the paper
 * (`.print-paper`) stays. Both `@media print` rules + the marker class are asserted by the
 * Jest test to prove the print flow will preserve text and hide chrome (brief non-negotiable).
 */
export function PayslipDocument({
  sheetId,
  employeeId,
}: {
  sheetId: string;
  employeeId: string;
}) {
  const user = useAuthenticatedUser();
  const denied = roleMatches(["SITE_ENGINEER", "STORE_KEEPER", "PROJECT_MANAGER"], user.role);
  const q = usePayslips(sheetId);

  if (denied) {
    return (
      <div className="mx-auto max-w-3xl">
        <Breadcrumb
          items={[
            { label: "HR" },
            { label: "Salary sheet", href: "/hr/salary-sheets" },
            { label: "Payslip" },
          ]}
        />
        <Alert tone="destructive" title={PAYSLIP_COPY.forbidden} data-testid="payslip-forbidden" />
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="payslip-doc-loading">
        <Breadcrumb
          items={[
            { label: "HR" },
            { label: "Salary sheet", href: "/hr/salary-sheets" },
            { label: "Payslip" },
          ]}
        />
        <Skeleton className="mb-3 h-8 w-64" />
        <Card className="p-6">
          <Skeleton className="mb-4 h-6 w-1/2" />
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="mt-4 h-10 w-full" />
        </Card>
      </div>
    );
  }

  if (q.isError || !q.sheet) {
    return (
      <div className="mx-auto max-w-3xl">
        <Breadcrumb
          items={[
            { label: "HR" },
            { label: "Salary sheet", href: "/hr/salary-sheets" },
            { label: "Payslip" },
          ]}
        />
        <Alert tone="destructive" title={PAYSLIP_COPY.errorLoad} data-testid="payslip-doc-error">
          <div className="mt-2">
            <Button size="sm" onClick={() => q.refetch()} data-testid="payslip-doc-retry">
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const sheet = q.sheet;
  if (sheet.status === "DRAFT") {
    return (
      <div className="mx-auto max-w-3xl" data-testid="payslip-doc-guard">
        <Breadcrumb
          items={[
            { label: "HR" },
            { label: "Salary sheet", href: "/hr/salary-sheets" },
            { label: sheet.periodLabel, href: `/hr/salary-sheets/${sheet.id}` },
            { label: "Payslip" },
          ]}
        />
        <NotPostedGuard sheetId={sheet.id} />
      </div>
    );
  }

  const payslips = q.payslips ?? [];
  const payslip = payslips.find((p) => p.employeeId === employeeId);
  const isReversed = sheet.status === "REVERSED";

  if (!payslip) {
    return (
      <div className="mx-auto max-w-3xl">
        <Breadcrumb
          items={[
            { label: "HR" },
            { label: "Salary sheet", href: "/hr/salary-sheets" },
            { label: sheet.periodLabel, href: `/hr/salary-sheets/${sheet.id}` },
            { label: "Payslip" },
          ]}
        />
        <Alert tone="destructive" title="Payslip not found." data-testid="payslip-doc-notfound">
          <div className="mt-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/hr/salary-sheets/${sheet.id}/payslips`}>Back to payslips</Link>
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl" data-testid="payslip-doc">
      <div className="print-hide">
        <Breadcrumb
          items={[
            { label: "HR" },
            { label: "Salary sheet", href: "/hr/salary-sheets" },
            { label: sheet.periodLabel, href: `/hr/salary-sheets/${sheet.id}` },
            { label: "Payslips", href: `/hr/salary-sheets/${sheet.id}/payslips` },
            { label: payslip.name },
          ]}
        />

        <div className="mb-3 mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[21px] font-bold tracking-[-0.02em]" data-testid="payslip-doc-title">
            Payslip — {payslip.name}, {payslip.periodLabel}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm" data-testid="payslip-doc-back">
              <Link href={`/hr/salary-sheets/${sheet.id}/payslips`}>Back</Link>
            </Button>
            <PayslipPrintActions variant="single" />
          </div>
        </div>
      </div>

      {isReversed && <ReversedRunBanner sheetId={sheet.id} />}

      {/* The paper. `.print-paper` is the DOM node that survives @media print; chrome above uses .print-hide. */}
      <Card className="print-paper overflow-hidden" data-testid="payslip-paper">
        {/* Masthead */}
        <div className="border-b border-border px-6 py-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Payslip</p>
          <p className="mt-1 text-[16px] font-bold text-foreground" data-testid="payslip-period">
            {payslip.periodLabel}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {formatDate(sheet.periodStart)} — {formatDate(sheet.periodEnd)}
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
            <div>
              <dt className="text-faint">Employee code</dt>
              <dd className="font-mono font-medium text-foreground" data-testid="payslip-emp-code">
                {payslip.employeeCode}
              </dd>
            </div>
            <div>
              <dt className="text-faint">Name</dt>
              <dd className="font-medium text-foreground" data-testid="payslip-emp-name">
                {payslip.name}
              </dd>
            </div>
            <div>
              <dt className="text-faint">Designation</dt>
              <dd className="text-foreground" data-testid="payslip-emp-designation">
                {payslip.designation ?? ""}
              </dd>
            </div>
            <div>
              <dt className="text-faint">{PAYSLIP_LABELS.paidDaysLabel}</dt>
              <dd className="text-foreground" data-testid="payslip-paid-days">
                {`${PAYSLIP_LABELS.paidDaysLabel}: ${payslip.paidDays}`}
              </dd>
            </div>
          </dl>
        </div>

        {/* Earnings + Deductions two-column (single-column on tablet/mobile) */}
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:divide-x md:divide-border">
          <PayslipBlock
            title={PAYSLIP_LABELS.earnings}
            testId="payslip-earnings"
            rows={[
              { label: PAYSLIP_LABELS.grossSalary, value: payslip.grossAmount, testId: "gross" },
              { label: PAYSLIP_LABELS.allowances, value: payslip.allowances, testId: "allowances" },
            ]}
          />
          <PayslipBlock
            title={PAYSLIP_LABELS.deductions}
            testId="payslip-deductions"
            rows={[
              { label: PAYSLIP_LABELS.tds, value: payslip.deductions.tds, testId: "tds" },
              { label: PAYSLIP_LABELS.pf, value: payslip.deductions.pf, testId: "pf" },
              {
                label: PAYSLIP_LABELS.advanceRecovery,
                value: payslip.deductions.advanceRecovery,
                testId: "advance",
              },
              {
                label: PAYSLIP_LABELS.otherDeductions,
                value: payslip.deductions.other,
                testId: "other",
              },
            ]}
          />
        </div>

        {/* Net pay — bolded + heading level so it's announced as the document's summary value. */}
        <div
          className="flex items-center justify-between border-t border-border bg-surface-2 px-6 py-4"
          data-testid="payslip-net-row"
        >
          <h2
            className="text-[13px] font-bold uppercase tracking-wide text-foreground"
            data-testid="payslip-net-label"
          >
            {PAYSLIP_LABELS.netPay}
          </h2>
          <span
            className="text-[19px] font-bold tabular-nums text-foreground"
            data-testid="payslip-net-value"
            aria-label={`${PAYSLIP_LABELS.netPay} ৳${formatMoney(payslip.netAmount, {
              withSymbol: false,
              fractionDigits: 2,
            })}`}
          >
            {formatMoney(payslip.netAmount, { fractionDigits: 2 })}
          </span>
        </div>
      </Card>

      {/* Print stylesheet — hides chrome, keeps the paper. Text-based (not an image), so
          printed/exported payslips remain accessible & text-searchable (spec §10). */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
          }
          body {
            background: white !important;
          }
          .print-hide {
            display: none !important;
          }
          .print-paper {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function PayslipBlock({
  title,
  rows,
  testId,
}: {
  title: string;
  rows: Array<{ label: string; value: string; testId: string }>;
  testId: string;
}) {
  return (
    <div className="px-6 py-4" data-testid={testId}>
      <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-foreground">
        {title}
      </h2>
      <dl className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div
            key={r.testId}
            className="flex items-baseline justify-between text-[12.5px]"
            data-testid={`${testId}-${r.testId}`}
          >
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd
              className="tabular-nums font-medium text-foreground"
              aria-label={`${r.label} ৳${formatMoney(r.value, {
                withSymbol: false,
                fractionDigits: 2,
              })}`}
            >
              {formatMoney(r.value, { fractionDigits: 2 })}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Ambient re-export so the list test can typecheck. */
export type { Payslip };
