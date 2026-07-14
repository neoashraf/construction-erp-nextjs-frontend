"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, WifiOff, ArrowUpRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { formatMoney } from "@/lib/money";
import { useReportCatalog, useRunReport } from "../hooks/useReportCatalog";
import { type ReportDescriptor, type ReportParams } from "../types";
import { ReportCatalogList } from "./ReportCatalogList";
import { ReportParameterPanel } from "./ReportParameterPanel";
import { ReportExportControl } from "./ReportExportControl";
import { ReportResultTable, type ReportColumn } from "./ReportResultTable";

/**
 * FE-54 `/reports` hub — the catalog + shared parameter panel + Export control
 * + a demo inline result table for the Trial-balance sample. Selecting any
 * other catalog entry routes to its viewer (implemented by the sibling viewer
 * briefs). Read-only: no post/edit/delete anywhere in this module.
 */
export function ReportCatalogScreen() {
  const online = useOnline();
  const user = useAuthenticatedUser();
  const catalog = useReportCatalog();
  const router = useRouter();
  const [selected, setSelected] = useState<ReportDescriptor | null>(null);
  const [params, setParams] = useState<ReportParams>({
    financialYearId: user.financialYearId ?? "",
  });
  const [ran, setRan] = useState(false);

  // Inline demo runner — only for the sample "trial-balance" entry; every
  // other entry routes to its viewer brief.
  const inlineEnabled = selected?.name === "trial-balance" && ran;
  const run = useRunReport<TrialBalanceRow>(inlineEnabled ? selected : null, inlineEnabled ? params : null, inlineEnabled);

  function onSelect(d: ReportDescriptor) {
    setSelected(d);
    setRan(false);
    // Reset filters (retain FY only) so parameters entered against one report
    // never bleed into another. The seed FY comes from the shell (spec §5).
    setParams({ financialYearId: user.financialYearId ?? "" });
    // Route straight to the viewer for every real report (spec §3). The demo
    // "trial-balance" catalog entry stays inline so the hub renders a result
    // even before the viewer briefs land.
    if (d.name !== "trial-balance") {
      router.push(d.viewerRoute);
    }
  }

  function onRun(p: ReportParams) {
    setParams(p);
    setRan(true);
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6" data-testid="report-catalog-screen">
      <Breadcrumb items={[{ label: "Reports" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="reports-title">
            Reports
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Every read-only report in one place. Pick a report on the left, set parameters, and Run.
          </p>
        </div>
      </div>

      {!online && (
        <Alert
          tone="warning"
          title="You're offline."
          className="mb-4"
          data-testid="reports-offline"
        >
          <span className="text-[12.5px]">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Run and Export are disabled until you reconnect.
          </span>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          {catalog.isLoading ? (
            <Card className="space-y-2 p-4" data-testid="catalog-loading">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </Card>
          ) : catalog.isError ? (
            <Card className="p-6" data-testid="catalog-error">
              <EmptyState
                icon={AlertCircle}
                title="Couldn't load the report list."
                action={
                  <Button size="sm" onClick={() => catalog.refetch()} data-testid="catalog-retry">
                    Retry
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card className="p-3">
              <ReportCatalogList
                reports={catalog.data ?? []}
                selected={selected?.name ?? null}
                onSelect={onSelect}
              />
            </Card>
          )}
        </aside>

        <section className="min-w-0 space-y-4">
          {!selected ? (
            <Card className="p-10" data-testid="reports-idle">
              <EmptyState
                icon={ArrowUpRight}
                title="Select a report to begin."
                description="Every report opens the same parameter panel — Financial year, project scope, dates, plus report-specific filters."
              />
            </Card>
          ) : (
            <>
              <ReportParameterPanel
                descriptor={selected}
                value={params}
                onChange={setParams}
                onRun={onRun}
                running={run.isFetching}
                disabled={!online}
              />

              {selected.name === "trial-balance" && (
                <Card className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                    <div>
                      <h2 className="text-[14px] font-bold text-foreground">{selected.title}</h2>
                      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                        {selected.description}
                      </p>
                    </div>
                    <ReportExportControl
                      reportName={selected.name}
                      params={params}
                      disabled={!online}
                    />
                  </div>
                  <ReportResultTable<TrialBalanceRow>
                    columns={TRIAL_BALANCE_COLUMNS}
                    rows={run.data?.rows}
                    isLoading={run.isFetching}
                    isError={run.isError}
                    onRetry={() => run.refetch()}
                    generatedAt={run.data?.meta.generatedAt}
                    captionId="report-generated-caption"
                    totalsFooter={
                      run.data
                        ? (
                            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 text-[12.5px] font-semibold">
                              <span className="text-muted-foreground">Totals</span>
                              <span className="tabular-nums">
                                {formatMoney(String(run.data.meta.totals?.debit ?? "0"))}
                              </span>
                              <span className="tabular-nums">
                                {formatMoney(String(run.data.meta.totals?.credit ?? "0"))}
                              </span>
                            </div>
                          )
                        : null
                    }
                  />
                </Card>
              )}

              {selected.name !== "trial-balance" && (
                <Card className="p-8" data-testid="reports-viewer-redirect">
                  <EmptyState
                    icon={ArrowUpRight}
                    title="Opening the viewer…"
                    description="The dedicated viewer for this report handles its columns + totals."
                    action={
                      <Button asChild variant="outline">
                        <Link href={selected.viewerRoute}>Go to viewer</Link>
                      </Button>
                    }
                  />
                </Card>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Trial-balance row shape + columns (demo of the shared shell) ─────────────
interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string | null;
  debit: string;
  credit: string;
}
const TRIAL_BALANCE_COLUMNS: ReportColumn<TrialBalanceRow>[] = [
  { key: "code", header: "Code", render: (r) => r.accountCode },
  {
    key: "account",
    header: "Account",
    render: (r) =>
      r.accountName ? (
        r.accountName
      ) : (
        <span className="text-muted-foreground">
          {r.accountId}
          <span className="ml-1 text-[10.5px] italic">(name unavailable)</span>
        </span>
      ),
  },
  {
    key: "debit",
    header: "Debit",
    align: "right",
    numeric: true,
    render: (r) => formatMoney(r.debit),
  },
  {
    key: "credit",
    header: "Credit",
    align: "right",
    numeric: true,
    render: (r) => formatMoney(r.credit),
  },
];
