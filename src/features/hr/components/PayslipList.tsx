"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatMoney, toDecimal } from "@/lib/money";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { roleMatches } from "@/lib/auth/roles";
import { usePayslips } from "../hooks/usePayslips";
import { PayslipSearch } from "./PayslipSearch";
import { PayslipPrintActions } from "./PayslipPrintActions";
import { ReversedRunBanner } from "./ReversedRunBanner";
import { NotPostedGuard } from "./NotPostedGuard";
import { PAYSLIP_COPY } from "../schemas/payslip.schema";
import { SalaryStatusBadge } from "./SalaryStatusBadge";
import type { Payslip } from "../api/salary";

type SortKey = "employeeCode" | "name" | "paidDays" | "grossAmount" | "netAmount";

function sortPayslips(rows: Payslip[], sort: { key: SortKey; dir: "asc" | "desc" }): Payslip[] {
  const mul = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sort.key) {
      case "employeeCode":
        return a.employeeCode.localeCompare(b.employeeCode) * mul;
      case "name":
        return a.name.localeCompare(b.name) * mul;
      case "paidDays":
        return toDecimal(a.paidDays).minus(b.paidDays).toNumber() * mul;
      case "grossAmount":
        return toDecimal(a.grossAmount).minus(b.grossAmount).toNumber() * mul;
      case "netAmount":
        return toDecimal(a.netAmount).minus(b.netAmount).toNumber() * mul;
    }
  });
}

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
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "employeeCode",
    dir: "asc",
  });

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

  const sorted = useMemo(() => sortPayslips(filtered, sort), [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "Salary sheets", href: "/hr/salary-sheets" }, { label: "Payslips" }]} />
        <Alert tone="destructive" title={PAYSLIP_COPY.forbidden} data-testid="payslip-forbidden" />
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-6xl" data-testid="payslip-list-loading">
        <Breadcrumb items={[{ label: "Salary sheets", href: "/hr/salary-sheets" }, { label: "Payslips" }]} />
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
        <Breadcrumb items={[{ label: "Salary sheets", href: "/hr/salary-sheets" }, { label: "Payslips" }]} />
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
            { label: "Salary sheets", href: "/hr/salary-sheets" },
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
          { label: "Salary sheets", href: "/hr/salary-sheets" },
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
        <SalaryStatusBadge status={sheet.status} />
        <span
          className="rounded-badge bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground"
          data-testid="payslip-count-pill"
        >
          {payslips.length} payslip{payslips.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5" data-testid="payslip-back">
            <Link href={`/hr/salary-sheets/${sheet.id}`}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {PAYSLIP_COPY.backToSheet}
            </Link>
          </Button>
          {payslips.length > 0 && <PayslipPrintActions variant="all" />}
        </div>
      </div>

      {isReversed && <ReversedRunBanner sheetId={sheet.id} />}

      {payslips.length > 0 && (
        <Card className="mb-4 flex flex-wrap items-center gap-6 p-4 print-hide" data-testid="payslip-run-context">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">Period</p>
            <p className="mt-0.5 text-[13px] font-semibold text-foreground">
              {sheet.periodLabel}{" "}
              <span className="font-mono text-[12px] font-normal text-muted-foreground">
                · {formatDate(sheet.periodStart)}–{formatDate(sheet.periodEnd)}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">Payslips</p>
            <p className="mt-0.5 text-[13px] font-semibold text-foreground">
              {payslips.length} employee{payslips.length === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">Net payable</p>
            <p className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums text-foreground">
              {formatMoney(sheet.totalNet, { fractionDigits: 2 })}
            </p>
          </div>
          <div className="ml-auto">
            <PayslipSearch value={search} onChange={setSearch} />
          </div>
        </Card>
      )}

      <Card className="overflow-hidden" data-testid="payslip-list-card">
        {payslips.length === 0 ? (
          <div className="p-6" data-testid="payslip-empty-no-run">
            <EmptyState title={PAYSLIP_COPY.emptyNoRun} description={PAYSLIP_COPY.emptyNoRunSub} />
          </div>
        ) : sorted.length === 0 ? (
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
          <PayslipTable
            rows={sorted}
            sheetId={sheet.id}
            sort={sort}
            onSort={toggleSort}
            shownCount={sorted.length}
            totalCount={payslips.length}
          />
        )}
      </Card>
    </div>
  );
}

/** Small stacked ▲▼ sort-direction glyph (design spec) — not a lucide icon. */
function SortCarets({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className="inline-flex flex-col text-[8px] leading-[0.6]">
      <span className={active && dir === "asc" ? "text-foreground" : "text-faint"}>▲</span>
      <span className={active && dir === "desc" ? "text-foreground" : "text-faint"}>▼</span>
    </span>
  );
}

function SortHeader({
  sortKey,
  label,
  align,
  active,
  dir,
  onSort,
}: {
  sortKey: SortKey;
  label: string;
  align?: "right";
  active: boolean;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <th className={cn("px-3 py-2", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1.5 hover:text-foreground",
          active ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
        data-testid={`payslip-sort-${sortKey}`}
      >
        {label}
        <SortCarets active={active} dir={dir} />
      </button>
    </th>
  );
}

function PayslipTable({
  rows,
  sheetId,
  sort,
  onSort,
  shownCount,
  totalCount,
}: {
  rows: Payslip[];
  sheetId: string;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  shownCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const netTotal = rows.reduce((acc, p) => acc.plus(p.netAmount), toDecimal("0"));

  function printRow(employeeId: string) {
    router.push(`/hr/salary-sheets/${sheetId}/payslips/${employeeId}?print=1`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" data-testid="payslip-table">
        <thead className="border-b border-border bg-surface-2">
          <tr className="text-left text-[12px] font-medium text-muted-foreground">
            <SortHeader sortKey="employeeCode" label="Code" active={sort.key === "employeeCode"} dir={sort.dir} onSort={onSort} />
            <SortHeader sortKey="name" label="Name" active={sort.key === "name"} dir={sort.dir} onSort={onSort} />
            <th className="hidden px-3 py-2 md:table-cell">Designation</th>
            <SortHeader sortKey="paidDays" label="Paid days" align="right" active={sort.key === "paidDays"} dir={sort.dir} onSort={onSort} />
            <SortHeader sortKey="grossAmount" label="Gross" align="right" active={sort.key === "grossAmount"} dir={sort.dir} onSort={onSort} />
            <SortHeader sortKey="netAmount" label="Net" align="right" active={sort.key === "netAmount"} dir={sort.dir} onSort={onSort} />
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
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-[30px] px-3 text-[12.5px]"
                    data-testid={`payslip-view-${p.employeeId}`}
                  >
                    <Link href={`/hr/salary-sheets/${sheetId}/payslips/${p.employeeId}`}>View</Link>
                  </Button>
                  <button
                    type="button"
                    title="Print this payslip"
                    onClick={() => printRow(p.employeeId)}
                    className="grid h-[30px] w-[30px] place-items-center rounded-token border border-border-strong bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
                    data-testid={`payslip-print-row-${p.employeeId}`}
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-3 px-3 py-3 text-[12.5px] text-muted-foreground">
        <span>
          Showing <span className="font-semibold text-foreground">{shownCount}</span> of{" "}
          <span className="font-semibold text-foreground">{totalCount}</span> payslips
        </span>
        <span>
          Net payable{" "}
          <span className="font-mono font-bold tabular-nums text-foreground">
            {formatMoney(netTotal, { fractionDigits: 2 })}
          </span>
        </span>
      </div>
    </div>
  );
}
