"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/money";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { roleMatches } from "@/lib/auth/roles";
import { usePayslips } from "../hooks/usePayslips";
import { PayslipSearch } from "./PayslipSearch";
import { PayslipPrintActions } from "./PayslipPrintActions";
import { ReversedRunBanner } from "./ReversedRunBanner";
import { NotPostedGuard } from "./NotPostedGuard";
import { PAYSLIP_COPY } from "../schemas/payslip.schema";
import type { Payslip } from "../api/salary";

/**
 * Payslip list (spec §4/§6). Header (period label · status · Print all) → employee search →
 * per-employee rows. Rows link to `/[employeeId]` for the single-payslip document view.
 * The screen has NO write affordance (asserted in tests) — only the search box uses the
 * shared `shadow-focus` treatment. Not-posted guard renders if the parent sheet is DRAFT.
 *
 * Site Engineer / Store Keeper / PM already 403 at the module guard, but we also client-side
 * shadow-check the role so a permission-denied state is testable without booting the guard.
 */
export function PayslipList({ sheetId }: { sheetId: string }) {
  const user = useAuthenticatedUser();
  const denied = roleMatches(["SITE_ENGINEER", "STORE_KEEPER", "PROJECT_MANAGER"], user.role);

  const q = usePayslips(sheetId);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const rows = q.payslips ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.employeeCode.toLowerCase().includes(s),
    );
  }, [q.payslips, search]);

  if (denied) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "HR" }, { label: "Salary sheet", href: "/hr/salary-sheets" }, { label: "Payslips" }]} />
        <Alert tone="destructive" title={PAYSLIP_COPY.forbidden} data-testid="payslip-forbidden" />
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-6xl" data-testid="payslip-list-loading">
        <Breadcrumb items={[{ label: "HR" }, { label: "Salary sheet", href: "/hr/salary-sheets" }, { label: "Payslips" }]} />
        <Skeleton className="mb-3 h-8 w-64" />
        <Card className="p-4">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (q.isError || !q.sheet) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "HR" }, { label: "Salary sheet", href: "/hr/salary-sheets" }, { label: "Payslips" }]} />
        <Alert tone="destructive" title={PAYSLIP_COPY.errorLoad} data-testid="payslip-list-error">
          <div className="mt-2">
            <Button size="sm" onClick={() => q.refetch()} data-testid="payslip-list-retry">
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
      <div className="mx-auto max-w-6xl" data-testid="payslip-list-guard">
        <Breadcrumb
          items={[
            { label: "HR" },
            { label: "Salary sheet", href: "/hr/salary-sheets" },
            { label: sheet.periodLabel, href: `/hr/salary-sheets/${sheet.id}` },
            { label: "Payslips" },
          ]}
        />
        <NotPostedGuard sheetId={sheet.id} />
      </div>
    );
  }

  const payslips = q.payslips ?? [];
  const isReversed = sheet.status === "REVERSED";

  return (
    <div className="mx-auto max-w-6xl" data-testid="payslip-list">
      <Breadcrumb
        items={[
          { label: "HR" },
          { label: "Salary sheet", href: "/hr/salary-sheets" },
          { label: sheet.periodLabel, href: `/hr/salary-sheets/${sheet.id}` },
          { label: "Payslips" },
        ]}
      />

      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3 print-hide">
        <h1
          className="text-[23px] font-bold tracking-[-0.02em]"
          data-testid="payslip-list-title"
        >
          Payslips — {sheet.periodLabel}
        </h1>
        <span
          className="rounded-badge bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          data-testid={`payslip-status-${sheet.status}`}
        >
          {sheet.status}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="sm" data-testid="payslip-back">
            <Link href={`/hr/salary-sheets/${sheet.id}`}>{PAYSLIP_COPY.backToSheet}</Link>
          </Button>
          {payslips.length > 0 && <PayslipPrintActions variant="all" />}
        </div>
      </div>

      {isReversed && <ReversedRunBanner sheetId={sheet.id} />}

      <div className="mb-3 print-hide">
        <PayslipSearch value={search} onChange={setSearch} />
      </div>

      <Card className="overflow-hidden" data-testid="payslip-list-card">
        {payslips.length === 0 ? (
          <div className="p-6" data-testid="payslip-empty-no-run">
            <EmptyState title={PAYSLIP_COPY.emptyNoRun} description={PAYSLIP_COPY.emptyNoRunSub} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6" data-testid="payslip-empty-filtered">
            <EmptyState
              title={PAYSLIP_COPY.emptyFiltered}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="payslip-clear-search"
                  onClick={() => setSearch("")}
                >
                  {PAYSLIP_COPY.clearSearch}
                </Button>
              }
            />
          </div>
        ) : (
          <PayslipTable rows={filtered} sheetId={sheet.id} />
        )}
      </Card>
    </div>
  );
}

function PayslipTable({ rows, sheetId }: { rows: Payslip[]; sheetId: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" data-testid="payslip-table">
        <thead className="border-b border-border bg-surface-2">
          <tr className="text-left text-[12px] font-medium text-muted-foreground">
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Name</th>
            <th className="hidden px-3 py-2 md:table-cell">Designation</th>
            <th className="px-3 py-2 text-right">Paid days</th>
            <th className="px-3 py-2 text-right">Gross</th>
            <th className="px-3 py-2 text-right">Net</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.employeeId}
              className="border-b border-border last:border-b-0"
              data-testid={`payslip-row-${p.employeeId}`}
            >
              <td className="px-3 py-2 font-mono text-[12.5px]">{p.employeeCode}</td>
              <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
              <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                {p.designation ?? ""}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{p.paidDays}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatMoney(p.grossAmount, { fractionDigits: 2 })}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {formatMoney(p.netAmount, { fractionDigits: 2 })}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/hr/salary-sheets/${sheetId}/payslips/${p.employeeId}`}
                  className="text-[12.5px] text-accent-ink underline-offset-2 hover:underline"
                  data-testid={`payslip-view-${p.employeeId}`}
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
