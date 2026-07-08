"use client";

import { useEffect, useState } from "react";
import { Lock, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api/errors";
import { useJournalEntries } from "../hooks/useJournalEntries";
import { EntriesFilterBar, EMPTY_FILTER } from "./EntriesFilterBar";
import { EntriesTable } from "./EntriesTable";
import { EntriesPagination } from "./EntriesPagination";
import { type EntriesFilterFormValues, reversalToApi } from "../schemas/entries-filter.schema";
import { type JournalEntriesFilter } from "../api/entries";

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

function toApiFilter(form: EntriesFilterFormValues, page: number): JournalEntriesFilter {
  return {
    entryNo: form.entryNo || undefined,
    dateFrom: form.dateFrom || undefined,
    dateTo: form.dateTo || undefined,
    voucherType: form.voucherType || undefined,
    isReversal: reversalToApi(form.reversal),
    page,
  };
}

/**
 * Journal entries list — the read-only screen listing posted entry headers with
 * filters, totals, and reversal/reversed status (FR-LED-031/005/030/026; spec).
 * READ-ONLY: it never creates/edits/deletes/exports the ledger. Full state matrix
 * (spec §6): default · loading skeleton · empty · error+retry · partial · 403 ·
 * offline. PM sees only assigned-project entries (server-scoped; a `403` on an
 * unassigned project filter is surfaced).
 */
export function JournalEntriesScreen({ fyLabel = "Active FY" }: { fyLabel?: string }) {
  const online = useOnline();
  const [applied, setApplied] = useState<EntriesFilterFormValues>(EMPTY_FILTER);
  const [page, setPage] = useState(1);

  const query = useJournalEntries(toApiFilter(applied, page));
  const result = query.data;
  const rows = result?.data ?? [];
  const hasFilters =
    !!applied.entryNo || !!applied.dateFrom || !!applied.dateTo || !!applied.voucherType || applied.reversal !== "all";

  const err = query.isError ? asApiError(query.error) : null;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;

  function apply(values: EntriesFilterFormValues) {
    setPage(1);
    setApplied(values);
  }
  function clear() {
    setPage(1);
    setApplied(EMPTY_FILTER);
  }

  // Permission-denied (lacks ledger:read, or PM filtering an unassigned project) — 403 view.
  if (forbidden) {
    return (
      <div className="mx-auto max-w-6xl" data-testid="entries-forbidden">
        <Breadcrumb items={[{ label: "Ledger" }, { label: "Journal entries" }]} />
        <h1 className="text-[23px] font-bold tracking-[-0.02em]">Journal entries</h1>
        <Card className="mt-4 p-8">
          <EmptyState
            icon={Lock}
            title="You don't have access to the ledger."
            description="If you're a project manager, you can only view entries that touch your assigned projects."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Ledger" }, { label: "Journal entries" }]} />
      <h1 className="mb-4 text-[23px] font-bold tracking-[-0.02em]">Journal entries</h1>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-3" data-testid="entries-offline">
          Showing the last loaded entries. Applying filters is disabled until you reconnect.
        </Alert>
      )}

      <EntriesFilterBar
        defaults={applied}
        fyLabel={fyLabel}
        offline={!online}
        onApply={apply}
        onClear={clear}
      />

      <Card className="mt-4 flex flex-col overflow-hidden">
        <div
          className={cn("min-h-0 overflow-auto", query.isFetching && !query.isLoading && "opacity-60")}
        >
          {query.isLoading ? (
            <div className="flex flex-col gap-2 p-4" data-testid="entries-loading">
              {Array.from({ length: 15 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="p-4">
              <Alert tone="destructive" title="Couldn't load journal entries. Please try again.">
                <div className="flex flex-col items-start gap-2">
                  <span>Check your connection and try again.</span>
                  <Button size="sm" onClick={() => query.refetch()} data-testid="entries-retry">
                    Retry
                  </Button>
                </div>
              </Alert>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={FileText}
                title="No journal entries for the selected filters."
                description="Try a wider date range or a different voucher type."
                action={
                  hasFilters ? (
                    <Button size="md" variant="outline" onClick={clear} data-testid="entries-empty-clear">
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <EntriesTable entries={rows} />
          )}
        </div>

        {result && rows.length > 0 && !query.isError && (
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
