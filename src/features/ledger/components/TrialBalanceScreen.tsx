"use client";

import { useEffect, useState } from "react";
import { Lock, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { asApiError } from "@/lib/api/errors";
import { useTrialBalance } from "../hooks/useTrialBalance";
import { TrialBalanceFilterBar, EMPTY_TRIAL_BALANCE_FILTER } from "./TrialBalanceFilterBar";
import { TrialBalanceTable, type DateScope } from "./TrialBalanceTable";
import { BalanceProofChip } from "./BalanceProofChip";
import { EntriesPagination } from "./EntriesPagination";
import {
  groupByToApi,
  type TrialBalanceFilterFormValues,
} from "../schemas/trial-balance-filter.schema";
import { type TrialBalanceFilter } from "../api/trial-balance";
import { useAuthenticatedUser } from "@/providers/session-provider";

/** Track the browser's online/offline status (spec §6 offline banner). */
function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return online;
}

function toApiFilter(form: TrialBalanceFilterFormValues, page: number): TrialBalanceFilter {
  return {
    financialYearId: form.financialYearId || undefined,
    periodId: form.periodId || undefined,
    // Ignored server-side when periodId is supplied (API contract precedence) —
    // still sent so a cleared period falls straight back to the range (spec §9).
    dateFrom: form.dateFrom || undefined,
    dateTo: form.dateTo || undefined,
    groupBy: groupByToApi(form.groupBy),
    projectId: form.projectId || undefined,
    costCentreId: form.costCentreId || undefined,
    purposeId: form.purposeId || undefined,
    godownId: form.godownId || undefined,
    partyId: form.partyId || undefined,
    accountId: form.accountId || undefined,
    includeReversals: form.includeReversals,
    page,
  };
}

function toDateScope(form: TrialBalanceFilterFormValues): DateScope {
  return {
    financialYearId: form.financialYearId || undefined,
    periodId: form.periodId || undefined,
    dateFrom: form.dateFrom || undefined,
    dateTo: form.dateTo || undefined,
  };
}

/**
 * Trial balance screen (FR-LED-031/001/014/007; spec). READ-ONLY — a query over the
 * single general ledger, proving `Σdebit = Σcredit` (balance-proof chip + sticky
 * totals footer). Filters apply on Apply only (heavy aggregation, no auto-fetch); an
 * as-of Period takes precedence over a date range (date inputs disabled/dimmed while
 * a period is selected). Drill-through carries the applied date scope to the Account
 * ledger. Full state matrix (spec §6): default/loaded · loading · empty · error+retry
 * · 403 permission-denied · offline; no saving/posting state (never writes to the
 * ledger). No Export CTA (owned by the Reporting module).
 */
export function TrialBalanceScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const initial: TrialBalanceFilterFormValues = {
    ...EMPTY_TRIAL_BALANCE_FILTER,
    financialYearId: user.financialYearId,
  };
  const [applied, setApplied] = useState<TrialBalanceFilterFormValues>(initial);
  const [page, setPage] = useState(1);

  const query = useTrialBalance(toApiFilter(applied, page));
  const rows = query.data?.data ?? [];
  const totals = query.data?.totals ?? { debit: "0.0000", credit: "0.0000" };

  const err = query.isError ? asApiError(query.error) : null;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;
  const projectScopeError =
    forbidden && applied.projectId ? "You can only view your assigned projects." : null;

  function apply(values: TrialBalanceFilterFormValues) {
    setPage(1);
    setApplied(values);
  }
  function clear() {
    setPage(1);
    setApplied(initial);
  }

  if (forbidden && !projectScopeError) {
    return (
      <div className="mx-auto max-w-6xl" data-testid="trial-balance-forbidden">
        <Breadcrumb items={[{ label: "Ledger" }, { label: "Trial balance" }]} />
        <h1 className="text-[23px] font-bold tracking-[-0.02em]">Trial balance</h1>
        <Card className="mt-4 p-8">
          <EmptyState
            icon={Lock}
            title="You don't have access to the ledger."
            description="If you're a project manager, the trial balance is limited to your assigned projects."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Ledger" }, { label: "Trial balance" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3.5">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="tb-title">
          Trial balance
        </h1>
        {!query.isLoading && !query.isError && <BalanceProofChip totals={totals} />}
        <span className="ml-auto inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span className="text-[11.5px] font-semibold text-muted-foreground">Read-only ledger query</span>
        </span>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-3" data-testid="tb-offline">
          Showing the last loaded balances. Applying filters is disabled until you reconnect.
        </Alert>
      )}

      {/* Pinned totals summary — mobile only (spec §4 mobile reflow) */}
      {!query.isLoading && !query.isError && (
        <div className="mb-3 flex gap-2 md:hidden" data-testid="tb-mobile-totals">
          <div className="flex-1 rounded-card border border-border bg-surface-2 p-2.5">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">
              Total debit
            </div>
            <div className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-foreground">
              {formatMoney(totals.debit)}
            </div>
          </div>
          <div className="flex-1 rounded-card border border-border bg-surface-2 p-2.5">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">
              Total credit
            </div>
            <div className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-foreground">
              {formatMoney(totals.credit)}
            </div>
          </div>
        </div>
      )}

      <TrialBalanceFilterBar
        defaults={applied}
        activeFyId={user.financialYearId}
        offline={!online}
        projectScopeError={projectScopeError}
        onApply={apply}
        onClear={clear}
      />

      <Card className="mt-4 flex flex-col overflow-hidden">
        <div className={cn("min-h-0 overflow-auto", query.isFetching && !query.isLoading && "opacity-60")}>
          {query.isLoading ? (
            <div className="flex flex-col gap-2 p-4" data-testid="tb-loading">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
              <Skeleton className="h-12 w-full" data-testid="tb-loading-totals" />
            </div>
          ) : query.isError ? (
            <div className="p-4">
              <Alert tone="destructive" title="Couldn't load the trial balance. Please try again.">
                <div className="flex flex-col items-start gap-2">
                  <span>Check your connection and try again.</span>
                  <Button size="sm" onClick={() => query.refetch()} data-testid="tb-retry">
                    Retry
                  </Button>
                </div>
              </Alert>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Scale}
                title="No balances for the selected filters."
                description="Try a wider date range or a different financial year."
                action={
                  <Button size="md" variant="outline" onClick={clear} data-testid="tb-empty-clear">
                    Clear filters
                  </Button>
                }
              />
              <div className="mt-4 flex items-center justify-center gap-2 text-[12.5px] text-faint">
                <span>Totals:</span>
                <span className="font-mono tabular-nums">{formatMoney("0.0000")}</span>
                <span>/</span>
                <span className="font-mono tabular-nums">{formatMoney("0.0000")}</span>
              </div>
            </div>
          ) : (
            <TrialBalanceTable
              rows={rows}
              totals={totals}
              groupBy={applied.groupBy}
              dateScope={toDateScope(applied)}
            />
          )}
        </div>

        {query.data && rows.length > 0 && !query.isError && (
          <div className="flex-none border-t border-border">
            <EntriesPagination
              page={query.data.page}
              pageSize={query.data.pageSize}
              total={query.data.total}
              onPage={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
