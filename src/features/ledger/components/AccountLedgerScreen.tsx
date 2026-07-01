"use client";

import { useEffect, useState } from "react";
import { Lock, FileText, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api/errors";
import { useAccountLedger } from "../hooks/useAccountLedger";
import { LedgerFilterBar, EMPTY_LINES_FILTER } from "./LedgerFilterBar";
import { LedgerLinesTable } from "./LedgerLinesTable";
import { EntriesPagination } from "./EntriesPagination";
import {
  type LinesFilterFormValues,
  isAccountLedgerMode,
} from "../schemas/lines-filter.schema";
import { type LedgerLinesFilter } from "../api/lines";

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

function toApiFilter(form: LinesFilterFormValues, page: number): LedgerLinesFilter {
  return {
    accountId: form.accountId || undefined,
    dateFrom: form.dateFrom || undefined,
    dateTo: form.dateTo || undefined,
    voucherType: form.voucherType || undefined,
    projectId: form.projectId || undefined,
    costCentreId: form.costCentreId || undefined,
    purposeId: form.purposeId || undefined,
    godownId: form.godownId || undefined,
    partyId: form.partyId || undefined,
    page,
  };
}

function hasAnyFilter(f: LinesFilterFormValues): boolean {
  return Object.values(f).some((v) => !!v);
}

/**
 * Account ledger + dimension drill-down (FR-LED-031/006/012/030/007; spec). READ-ONLY:
 * it never edits the ledger — corrections are reverse/repost in the source module.
 * Two modes, driven by `accountId` + date range: account-ledger (opening-balance row +
 * running balance) vs drill-down (both omitted, titled "Ledger drill-down"). Full
 * state matrix (spec §6): default · loading · empty · no-account prompt · error+retry ·
 * 403 permission-denied · offline. Accepts an inbound account/date scope via
 * `initialFilter` (from a Trial-balance drill).
 */
export function AccountLedgerScreen({
  initialFilter,
}: {
  initialFilter?: Partial<LinesFilterFormValues>;
}) {
  const online = useOnline();
  const [applied, setApplied] = useState<LinesFilterFormValues>({
    ...EMPTY_LINES_FILTER,
    ...initialFilter,
  });
  const [page, setPage] = useState(1);

  const ledgerMode = isAccountLedgerMode(applied);
  // Query only once the user has chosen an account OR a drill-down dimension/filter.
  const enabled = hasAnyFilter(applied);
  const query = useAccountLedger(toApiFilter(applied, page), enabled);

  const result = enabled ? query.data : undefined;
  const lines = result?.data ?? [];

  const err = enabled && query.isError ? asApiError(query.error) : null;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;

  function apply(values: LinesFilterFormValues) {
    setPage(1);
    setApplied(values);
  }
  function clear() {
    setPage(1);
    setApplied(EMPTY_LINES_FILTER);
  }

  const title = ledgerMode ? "Account ledger" : "Ledger drill-down";

  if (forbidden) {
    return (
      <div className="mx-auto max-w-6xl" data-testid="ledger-forbidden">
        <Breadcrumb label={title} />
        <h1 className="text-[23px] font-bold tracking-[-0.02em]">{title}</h1>
        <Card className="mt-4 p-8">
          <EmptyState
            icon={Lock}
            title="You don't have access to the ledger."
            description="If you're a project manager, you can only view lines that touch your assigned projects."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb label={title} />
      <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="ledger-title">
        {title}
      </h1>
      <p className="mb-4 mt-1 text-[12.5px] text-faint">
        {ledgerMode
          ? "Read-only ledger — running balance carries across pages."
          : "Select an account and a date range to show a running balance."}
      </p>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-3" data-testid="ledger-offline">
          Showing the last loaded lines. Applying filters is disabled until you reconnect.
        </Alert>
      )}

      <LedgerFilterBar defaults={applied} offline={!online} onApply={apply} onClear={clear} />

      <Card className="mt-4 flex flex-col overflow-hidden">
        <div className={cn("min-h-0 overflow-auto", enabled && query.isFetching && !query.isLoading && "opacity-60")}>
          {!enabled ? (
            <div className="p-8">
              <EmptyState
                icon={Layers}
                title="Select an account to view its ledger."
                description="Select an account and a date range to show a running balance."
              />
            </div>
          ) : query.isLoading ? (
            <div className="flex flex-col gap-2 p-4" data-testid="ledger-loading">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="p-4">
              <Alert tone="destructive" title="Couldn't load the account ledger. Please try again.">
                <div className="flex flex-col items-start gap-2">
                  <span>Check your connection and try again.</span>
                  <Button size="sm" onClick={() => query.refetch()} data-testid="ledger-retry">
                    Retry
                  </Button>
                </div>
              </Alert>
            </div>
          ) : lines.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={FileText}
                title="No ledger lines for the selected filters."
                description="Try a wider date range, or clear a dimension filter."
                action={
                  <Button size="md" variant="outline" onClick={clear} data-testid="ledger-empty-clear">
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <LedgerLinesTable
              lines={lines}
              openingBalance={result?.openingBalance}
              accountLedgerMode={ledgerMode}
            />
          )}
        </div>

        {enabled && result && lines.length > 0 && !query.isError && (
          <div className="flex-none border-t border-border">
            <EntriesPagination
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              onPage={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function Breadcrumb({ label }: { label: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1.5 text-xs text-muted-foreground">
      Ledger <span className="text-border-strong">/</span>{" "}
      <span className="font-medium text-foreground">{label}</span>
    </nav>
  );
}
