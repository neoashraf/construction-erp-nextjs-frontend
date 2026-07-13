"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Printer, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { usePayslips, PAYROLL_PERIOD } from "../hooks/usePayroll";
import { displayMoney, displayMoneyBare } from "../lib";

const isBn = (s: string) => /[ঀ-৿]/.test(s);
const SALARY_PATH = "/hr/salary-sheets";

function safeDate(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/**
 * Payslips list (FR-HR-017; Payslip.dc.html). Payslips exist only after a salary
 * sheet is posted — this lists the June-2025 posted run with a run-context bar, a
 * name/code search, and per-row View / Print. Read-only; corrections happen upstream.
 */
export function PayslipsScreen() {
  const [q, setQ] = useState("");
  const { items, totalCount, shownNet, totalNet } = usePayslips(q);
  const noMatch = items.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb
        items={[
          { label: "Salary sheets", href: SALARY_PATH },
          { label: PAYROLL_PERIOD.label, href: `${SALARY_PATH}/sh-2025-06` },
          { label: "Payslips" },
        ]}
      />

      {/* title row */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]">
          Payslips — {PAYROLL_PERIOD.label}
        </h1>
        <Badge tone="success" dot>
          Posted
        </Badge>
        <span className="inline-flex h-[23px] items-center whitespace-nowrap rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
          {totalCount} payslips
        </span>
        <div className="ml-auto flex flex-none gap-2.5">
          <Button variant="outline" size="md" asChild>
            <Link href={`${SALARY_PATH}/sh-2025-06`}>Back to salary sheet</Link>
          </Button>
          <Button size="md" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden />
            Print all
          </Button>
        </div>
      </div>

      {/* run-context bar */}
      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Stat label="Period">
            {PAYROLL_PERIOD.label} · {safeDate(PAYROLL_PERIOD.periodStart)}–
            {safeDate(PAYROLL_PERIOD.periodEnd)}
          </Stat>
          <Stat label="Payslips">{totalCount} employees</Stat>
          <Stat label="Net payable">
            <span className="font-mono tabular-nums">{displayMoney(totalNet)}</span>
          </Stat>
          <div className="ml-auto flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-token border border-border-strong bg-surface px-3 transition-colors focus-within:border-accent focus-within:shadow-focus sm:max-w-[300px] sm:flex-none">
            <Search className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by employee name or code"
              aria-label="Search payslips"
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-faint"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="grid h-5 w-5 flex-none place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden p-3 sm:p-4">
        {noMatch ? (
          <EmptyState
            icon={Search}
            title="No employees match this search."
            description="Try a different name or employee code."
            action={
              <Button variant="outline" onClick={() => setQ("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px]">Emp. code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden lg:table-cell">Designation</TableHead>
                    <TableHead className="text-right">Paid days</TableHead>
                    <TableHead className="text-right">Gross ৳</TableHead>
                    <TableHead className="text-right">Net ৳</TableHead>
                    <TableHead className="w-[120px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.employeeCode}>
                      <TableCell>
                        <Link
                          href={`/hr/payslips/${p.employeeCode}`}
                          className="font-mono text-[12.5px] font-semibold text-accent-ink hover:underline"
                        >
                          {p.employeeCode}
                        </Link>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-[13.5px] font-semibold text-foreground",
                          isBn(p.name) && "font-sans",
                        )}
                      >
                        {p.name}
                      </TableCell>
                      <TableCell className="hidden text-[13px] text-muted-foreground lg:table-cell">
                        {p.designation}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                        {p.paidDays} / {p.workingDays}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] tabular-nums text-foreground">
                        {displayMoneyBare(p.grossAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
                        {displayMoneyBare(p.netAmount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/hr/payslips/${p.employeeCode}`}>View</Link>
                          </Button>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            title="Print this payslip"
                            aria-label={`Print payslip for ${p.name}`}
                            className="grid h-8 w-8 flex-none place-items-center rounded-token border border-border-strong text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Printer className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="flex flex-col gap-2.5 md:hidden">
              {items.map((p) => (
                <li key={p.employeeCode} className="rounded-card border border-border bg-surface p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/hr/payslips/${p.employeeCode}`}
                        className={cn(
                          "text-[14.5px] font-semibold text-foreground hover:underline",
                          isBn(p.name) && "font-sans",
                        )}
                      >
                        {p.name}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px]">
                        <span className="font-mono font-semibold text-accent-ink">
                          {p.employeeCode}
                        </span>
                        <span className="text-border-strong">·</span>
                        <span className="text-muted-foreground">{p.designation}</span>
                      </div>
                    </div>
                    <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
                      ৳ {displayMoneyBare(p.netAmount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border px-1 pt-3">
              <span className="text-[12.5px] text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{items.length}</span> of{" "}
                <span className="font-semibold text-foreground">{totalCount}</span> payslips
              </span>
              <span className="text-[12.5px] text-muted-foreground">
                Net payable{" "}
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {displayMoney(shownNet)}
                </span>
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
        {label}
      </span>
      <span className="text-[13px] font-medium text-foreground">{children}</span>
    </div>
  );
}
