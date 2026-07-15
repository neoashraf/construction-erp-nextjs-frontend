"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { ApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canGenerateSalarySheet } from "../access";
import { useSalarySheets } from "../hooks/useSalarySheets";
import { useSalaryMutations } from "../hooks/useSalaryMutations";
import { SalaryStatusBadge } from "./SalaryStatusBadge";
import { SalaryRunsFilterBar, EMPTY_SALARY_FILTER, type SalaryRunsFilter } from "./SalaryRunsFilterBar";
import { GenerateSheetDialog } from "./GenerateSheetDialog";
import { useProjectOptions } from "../hooks/useProjectOptions";
import { listFinancialYearOptions, type GenerateSheetInput, type SalarySheetSummary } from "../api/salary";
import { mapSalaryError } from "../schemas/salary.schema";

/**
 * Runs list (`/hr/salary-sheets`). Header + filter bar + table of runs. HR Manager +
 * Admin see the "Generate for period" CTA (canGenerateSalarySheet); other roles see the
 * list read-only. Two empty variants (filtered vs first-use). Row → editor page.
 */
export function SalaryRunsList() {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const canGenerate = canGenerateSalarySheet(user);
  const { toast } = useToast();

  const [applied, setApplied] = useState<SalaryRunsFilter>(EMPTY_SALARY_FILTER);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const fyQ = useQuery({
    queryKey: ["hr", "financial-year-options"],
    queryFn: listFinancialYearOptions,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const financialYears = fyQ.data ?? [];

  const projectsQ = useProjectOptions();
  const projects = projectsQ.data ?? [];

  const query = useSalarySheets({
    financialYearId: applied.financialYearId || undefined,
    periodLabel: applied.periodLabel || undefined,
    status: applied.status || undefined,
  });
  const rows = useMemo(() => query.data?.data ?? [], [query.data?.data]);

  const { generate } = useSalaryMutations();

  const filtered = !!(applied.financialYearId || applied.periodLabel || applied.status);

  async function handleGenerate(input: GenerateSheetInput) {
    setGenError(null);
    setDuplicateId(null);
    try {
      const res = await generate.mutateAsync(input);
      setDialogOpen(false);
      toast(`Draft salary sheet created for ${input.periodLabel}.`, "success");
      router.push(`/hr/salary-sheets/${res.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setGenError(mapSalaryError(String(e.code), undefined, e.message));
        const existing =
          (e.details as { existingId?: string } | undefined)?.existingId ??
          (e.details as { existingSheetId?: string } | undefined)?.existingSheetId ??
          null;
        setDuplicateId(existing);
      } else {
        setGenError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl" data-testid="salary-runs-list">
      <Breadcrumb items={[{ label: "HR" }, { label: "Salary sheet" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="salary-runs-title">
          Salary sheet
        </h1>
        {query.data && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden />
            <span className="text-[11.5px] font-semibold text-muted-foreground" data-testid="salary-runs-count">
              {rows.length} run{rows.length === 1 ? "" : "s"}
            </span>
          </span>
        )}
        {canGenerate && (
          <Button
            size="md"
            className="ml-auto gap-1.5"
            onClick={() => {
              setGenError(null);
              setDuplicateId(null);
              setDialogOpen(true);
            }}
            data-testid="salary-generate"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Generate for period
          </Button>
        )}
      </div>

      <SalaryRunsFilterBar
        applied={applied}
        financialYears={financialYears}
        onApply={setApplied}
        onClear={() => setApplied(EMPTY_SALARY_FILTER)}
      />

      <Card className={cn("flex flex-col overflow-hidden", query.isFetching && !query.isLoading && "opacity-60")}>
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="salary-runs-loading">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load salary sheets.">
              <div className="mt-2">
                <Button size="sm" onClick={() => query.refetch()} data-testid="salary-runs-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          filtered ? (
            <div className="p-8" data-testid="salary-runs-empty-filtered">
              <EmptyState
                icon={Wallet}
                title="No runs match these filters."
                description="Try a wider period or clear the status filter."
                action={
                  <Button size="md" variant="outline" onClick={() => setApplied(EMPTY_SALARY_FILTER)} data-testid="salary-empty-clear">
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-8" data-testid="salary-runs-empty-firstuse">
              <EmptyState
                icon={Wallet}
                title="No salary runs yet."
                description="Generate your first salary sheet for a payroll period."
                action={
                  canGenerate ? (
                    <Button size="md" onClick={() => setDialogOpen(true)} data-testid="salary-empty-generate">
                      Generate for period
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <RunsTable rows={rows} />
        )}
      </Card>

      <GenerateSheetDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) {
            setGenError(null);
            setDuplicateId(null);
          }
        }}
        financialYears={financialYears}
        projects={projects}
        onGenerate={handleGenerate}
        isGenerating={generate.isPending}
        errorMessage={genError}
        existingDraftId={duplicateId}
      />
    </div>
  );
}

const GRID = "minmax(110px,1fr) minmax(160px,1.4fr) 120px 120px 120px 110px 130px 30px";
const MONEY = "whitespace-nowrap font-mono text-[12.5px] tabular-nums text-right";

function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

function RunsTable({ rows }: { rows: SalarySheetSummary[] }) {
  return (
    <div data-testid="salary-runs-table">
      {/* ≥lg full grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 980 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-3">Period</div>
            <div className="py-3">Range</div>
            <div className="py-3 text-right">Gross ৳</div>
            <div className="py-3 text-right">Deductions ৳</div>
            <div className="py-3 text-right">Net ৳</div>
            <div className="py-3">Status</div>
            <div className="py-3">Entry no</div>
            <div className="py-3" />
          </div>
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/hr/salary-sheets/${r.id}`}
              role="row"
              data-testid={`salary-run-row-${r.status}`}
              className="grid cursor-pointer items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
              style={{ gridTemplateColumns: GRID }}
            >
              <div className="py-3 font-mono text-[12.5px] font-semibold text-accent-ink">{r.periodLabel}</div>
              <div className="py-3 text-[12px] text-muted-foreground">
                {r.periodStart} → {r.periodEnd}
              </div>
              <div className="py-3">
                <span className={MONEY}>{money(r.totalGross)}</span>
              </div>
              <div className="py-3">
                <span className={MONEY}>{money(r.totalDeductions)}</span>
              </div>
              <div className="py-3">
                <span className={MONEY}>{money(r.totalNet)}</span>
              </div>
              <div className="py-3">
                <SalaryStatusBadge status={r.status} />
              </div>
              <div className="py-3 font-mono text-[12px] text-foreground">
                {r.entryNo ?? "—"}
              </div>
              <div className="py-3 text-right text-[11px] text-muted-foreground" aria-hidden>
                ›
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* <lg stacked cards */}
      <div className="flex flex-col lg:hidden" data-testid="salary-runs-mobile">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/hr/salary-sheets/${r.id}`}
            data-testid={`salary-run-card-${r.status}`}
            className="border-b border-muted px-4 py-3 hover:bg-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-[12px] font-semibold text-accent-ink">{r.periodLabel}</span>
              <SalaryStatusBadge status={r.status} />
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              {r.periodStart} → {r.periodEnd}
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-[12px]">
              <LabelVal label="Gross" value={money(r.totalGross)} />
              <LabelVal label="Deductions" value={money(r.totalDeductions)} />
              <LabelVal label="Net" value={money(r.totalNet)} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LabelVal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">{label}</div>
      <div className="font-mono text-[12px] tabular-nums text-foreground">৳ {value}</div>
    </div>
  );
}
