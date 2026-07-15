"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { amountInWords, formatMoney, toDecimal } from "@/lib/money";
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
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const hasPrinted = useRef(false);

  const payslipForPrint = (q.payslips ?? []).find((p) => p.employeeId === employeeId);
  useEffect(() => {
    if (!autoPrint || hasPrinted.current || !payslipForPrint) return;
    // Wait a frame so the just-navigated document has actually painted before print()
    // opens the OS dialog. Only flip the guard once print() actually runs — marking it
    // eagerly (before the raf fires) meant a cleanup-cancelled first run silently ate
    // the request, since the guard already read true when the effect re-ran.
    const raf = window.requestAnimationFrame(() => {
      hasPrinted.current = true;
      window.print();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [autoPrint, payslipForPrint]);

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

  const totalEarnings = toDecimal(payslip.grossAmount).plus(payslip.allowances).toString();
  const totalDeductions = toDecimal(payslip.deductions.tds)
    .plus(payslip.deductions.pf)
    .plus(payslip.deductions.advanceRecovery)
    .plus(payslip.deductions.other)
    .toString();

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
      <Card className="print-paper mx-auto max-w-[780px] overflow-hidden" data-testid="payslip-paper">
        {/* Masthead */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-primary px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="grid h-11 w-11 flex-none place-items-center rounded-token bg-accent text-[15px] font-bold tracking-tight text-accent-foreground"
              aria-hidden
            >
              ZE
            </span>
            <div>
              <p className="text-[16px] font-bold leading-tight text-foreground">Zakir Enterprise</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Construction ERP · Dhaka, Bangladesh
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Payslip</p>
            <p className="mt-0.5 text-[14px] font-bold text-foreground" data-testid="payslip-period">
              {payslip.periodLabel}
            </p>
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatDate(sheet.periodStart)} – {formatDate(sheet.periodEnd)}
            </p>
          </div>
        </div>

        {/* Employee block */}
        <div className="grid grid-cols-1 gap-3 border-b border-border px-6 py-4 sm:grid-cols-2">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">Employee</p>
            <p className="mt-0.5 text-[15px] font-bold text-foreground" data-testid="payslip-emp-name">
              {payslip.name}
            </p>
            <p className="text-[12px] text-muted-foreground" data-testid="payslip-emp-designation">
              {payslip.designation ?? ""}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">Employee code</p>
              <p className="mt-0.5 font-mono text-[13px] font-semibold text-foreground" data-testid="payslip-emp-code">
                {payslip.employeeCode}
              </p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
                {PAYSLIP_LABELS.paidDaysLabel}
              </p>
              <p className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums text-foreground" data-testid="payslip-paid-days">
                {payslip.paidDays}
              </p>
            </div>
          </div>
        </div>

        {/* Earnings + Deductions two-column (single-column on tablet/mobile) */}
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:divide-x md:divide-border">
          <PayslipBlock
            title={PAYSLIP_LABELS.earnings}
            titleClassName="text-success-ink"
            totalClassName="text-success-ink"
            totalLabel="Total earnings"
            total={totalEarnings}
            testId="payslip-earnings"
            rows={[
              { label: PAYSLIP_LABELS.grossSalary, value: payslip.grossAmount, testId: "gross" },
              { label: PAYSLIP_LABELS.allowances, value: payslip.allowances, testId: "allowances" },
            ]}
          />
          <PayslipBlock
            title={PAYSLIP_LABELS.deductions}
            titleClassName="text-destructive-ink"
            totalClassName="text-destructive-ink"
            totalLabel="Total deductions"
            total={totalDeductions}
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
          className="mx-6 mb-5 mt-2 flex items-center justify-between gap-4 rounded-token border border-[#DCE9BD] bg-accent-soft px-5 py-4"
          data-testid="payslip-net-row"
        >
          <div>
            <h2
              className="text-[13px] font-bold uppercase tracking-wide text-accent-ink"
              data-testid="payslip-net-label"
            >
              {PAYSLIP_LABELS.netPay}
            </h2>
            <p className="mt-0.5 text-[11px] text-accent-ink opacity-85">
              {amountInWords(payslip.netAmount)} taka only
            </p>
          </div>
          <span
            className="font-mono text-[24px] font-bold tabular-nums tracking-tight text-accent-ink"
            data-testid="payslip-net-value"
            aria-label={`${PAYSLIP_LABELS.netPay} ৳${formatMoney(payslip.netAmount, {
              withSymbol: false,
              fractionDigits: 2,
            })}`}
          >
            {formatMoney(payslip.netAmount, { fractionDigits: 2 })}
          </span>
        </div>

        {/* Footer note */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border-strong px-6 py-3">
          <p className="max-w-[52ch] text-[10.5px] leading-relaxed text-faint">
            System-generated from the posted {payslip.periodLabel} salary sheet. Figures reflect the
            salary lines captured at posting and match the general ledger to the same precision.
          </p>
          {sheet.postedAt && (
            <p className="whitespace-nowrap font-mono text-[10px] text-faint">
              Posted {formatDate(sheet.postedAt)}
            </p>
          )}
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
  titleClassName,
  rows,
  total,
  totalLabel,
  totalClassName,
  testId,
}: {
  title: string;
  titleClassName?: string;
  rows: Array<{ label: string; value: string; testId: string }>;
  total: string;
  totalLabel: string;
  totalClassName?: string;
  testId: string;
}) {
  return (
    <div className="px-6 py-4" data-testid={testId}>
      <h2
        className={`mb-1 border-b border-border pb-2 text-[12px] font-bold uppercase tracking-wide ${titleClassName ?? "text-foreground"}`}
      >
        {title}
      </h2>
      <dl className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.testId}
            className="flex items-baseline justify-between border-b border-muted py-2 text-[12.5px]"
            data-testid={`${testId}-${r.testId}`}
          >
            <dt className="text-foreground">{r.label}</dt>
            <dd
              className="font-mono tabular-nums text-foreground"
              aria-label={`${r.label} ৳${formatMoney(r.value, {
                withSymbol: false,
                fractionDigits: 2,
              })}`}
            >
              {formatMoney(r.value, { fractionDigits: 2 })}
            </dd>
          </div>
        ))}
        <div
          className="flex items-baseline justify-between pt-2.5 text-[12.5px]"
          data-testid={`${testId}-total`}
        >
          <dt className="font-bold text-foreground">{totalLabel}</dt>
          <dd
            className={`font-mono text-[13.5px] font-bold tabular-nums ${totalClassName ?? "text-foreground"}`}
            aria-label={`${totalLabel} ৳${formatMoney(total, { withSymbol: false, fractionDigits: 2 })}`}
          >
            {formatMoney(total, { fractionDigits: 2 })}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Ambient re-export so the list test can typecheck. */
export type { Payslip };
