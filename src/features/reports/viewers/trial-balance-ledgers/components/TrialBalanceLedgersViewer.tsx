"use client";

import { useMemo, useState } from "react";
import { WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { ReportExportControl } from "../../../components/ReportExportControl";
import { ReportParameterPanel } from "../../../components/ReportParameterPanel";
import { type ReportDescriptor, type ReportParams } from "../../../types";
import { REPORT_NAME, readLedgerMeta, useReportForTab } from "../hooks/useTrialBalanceLedgers";
import { type LedgerRow, type ReportTab, type TrialBalanceRow, type TrialBalanceTotals } from "../types";
import { LedgerTable } from "./LedgerTable";
import { ReportSwitcher } from "./ReportSwitcher";
import { TbLedgerFilters } from "./TbLedgerFilters";
import { TrialBalanceTable } from "./TrialBalanceTable";

/**
 * FE-56 `/reports/trial-balance-ledgers` — hosts the four-report switcher +
 * the shared parameter panel + the per-report body. Common params (FY, date
 * range) are preserved across tab switches; only the report-specific extras
 * reset (spec §9).
 */
/** Reverse REPORT_NAME → tab so the hub can open this viewer on a chosen report. */
function reportToTab(name?: string): ReportTab {
  const found = (Object.entries(REPORT_NAME) as [ReportTab, string][]).find(
    ([, n]) => n === name,
  );
  return found?.[0] ?? "TB";
}

export function TrialBalanceLedgersViewer({
  embedded = false,
  initialReport,
}: { embedded?: boolean; initialReport?: string } = {}) {
  const online = useOnline();
  const user = useAuthenticatedUser();
  const [tab, setTab] = useState<ReportTab>(() => reportToTab(initialReport));
  const [params, setParams] = useState<ReportParams>({
    financialYearId: user.financialYearId ?? "",
  });
  const [ran, setRan] = useState(false);
  const [accountIdError, setAccountIdError] = useState<string | null>(null);

  const descriptor: ReportDescriptor = useMemo(() => buildDescriptor(tab), [tab]);

  const effectiveParams = useMemo<ReportParams>(() => {
    const p: ReportParams = { ...params };
    // Trial balance is as-of; the three flow reports are range.
    if (tab === "TB") {
      p.dateFrom = null;
      p.dateTo = null;
    } else {
      p.asOf = null;
      p.periodId = null;
    }
    return p;
  }, [params, tab]);

  const query = useReportForTab(tab, effectiveParams, ran);

  function onTabChange(next: ReportTab) {
    // Retain FY + range + project; clear report-specific extras.
    setParams({
      financialYearId: params.financialYearId,
      projectId: params.projectId ?? null,
      costCentreId: params.costCentreId ?? null,
      dateFrom: params.dateFrom ?? null,
      dateTo: params.dateTo ?? null,
      asOf: params.asOf ?? null,
      periodId: params.periodId ?? null,
      extras: {},
    });
    setAccountIdError(null);
    setRan(false);
    setTab(next);
  }

  function onRun(p: ReportParams) {
    // Ledger tab needs accountId — block otherwise.
    if (tab === "LEDGER" && !(p.extras?.accountId ?? "")) {
      setAccountIdError("Select an account to view its ledger.");
      return;
    }
    setAccountIdError(null);
    setParams(p);
    setRan(true);
  }

  // Extract typed results for the two body shapes.
  const tbTotals = tab === "TB" && query.data
    ? (query.data.meta as { totals?: Partial<TrialBalanceTotals> }).totals ?? null
    : null;

  const ledgerMeta =
    tab !== "TB" && tab !== "DAYBOOK" && query.data
      ? readLedgerMeta(query.data.meta as Parameters<typeof readLedgerMeta>[0])
      : null;

  const breadcrumbLabel = {
    TB: "Trial balance",
    LEDGER: "Account ledger",
    DAYBOOK: "Journal register",
    CASH_BANK: "Cash & bank book",
  }[tab];

  return (
    <div className={embedded ? "" : "mx-auto max-w-[1400px] px-6 py-6"} data-testid="tb-ledgers-viewer">
      {!embedded && (
        <>
          <Breadcrumb
            items={[
              { label: "Reports", href: "/reports" },
              { label: breadcrumbLabel },
            ]}
          />
          <div className="mb-4 mt-1 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="tb-title">
                Ledgers &amp; registers
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Trial balance, account &amp; party ledgers, journal register, cash &amp; bank book — read-only, server-computed.
              </p>
            </div>
          </div>
        </>
      )}

      <ReportSwitcher value={tab} onChange={onTabChange} />

      {!online && (
        <Alert
          tone="warning"
          title="You're offline. This report can't be loaded right now."
          className="mt-4"
          data-testid="tb-offline"
        >
          <span className="text-[12.5px]">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Parameters are preserved — try again when you reconnect.
          </span>
        </Alert>
      )}

      <div className="mt-4 space-y-3">
        <ReportParameterPanel
          descriptor={descriptor}
          value={params}
          onChange={setParams}
          onRun={onRun}
          running={query.isFetching}
          disabled={!online}
        />

        <TbLedgerFilters
          tab={tab}
          value={params}
          onChange={setParams}
          accounts={SAMPLE_ACCOUNTS}
          parties={SAMPLE_PARTIES}
          cashBankAccounts={SAMPLE_CASH_BANK}
          voucherTypes={VOUCHER_TYPES}
          errors={{ accountId: accountIdError ?? undefined }}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-[14px] font-bold text-foreground">{breadcrumbLabel}</h2>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {tab === "TB"
                ? "Balancing snapshot of every account."
                : tab === "LEDGER"
                  ? "Opening balance + a running balance carried across pages."
                  : tab === "DAYBOOK"
                    ? "Every posted line in the period, chronologically."
                    : "Every cash and bank movement in the period."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ReportExportControl
              reportName={REPORT_NAME[tab]}
              params={effectiveParams}
              disabled={!online}
            />
            {tab === "TB" && (
              <span className="text-[11px] text-muted-foreground" data-testid="tb-statutory-note">
                Excel and PDF exports include your company&rsquo;s BIN/TIN for NBR use.
              </span>
            )}
          </div>
        </div>

        {tab === "TB" ? (
          <TrialBalanceTable
            rows={query.data?.rows as TrialBalanceRow[] | undefined}
            totals={
              tbTotals
                ? { debit: tbTotals.debit ?? "0.0000", credit: tbTotals.credit ?? "0.0000" }
                : null
            }
            generatedAt={query.data?.meta.generatedAt}
            isLoading={query.isFetching}
            isError={query.isError}
            onRetry={() => query.refetch()}
          />
        ) : (
          <LedgerTable
            variant={tab}
            rows={query.data?.rows as LedgerRow[] | undefined}
            meta={ledgerMeta}
            generatedAt={query.data?.meta.generatedAt}
            isLoading={query.isFetching}
            isError={query.isError}
            onRetry={() => query.refetch()}
            showParty={tab === "LEDGER" || tab === "CASH_BANK"}
          />
        )}
      </Card>
    </div>
  );
}

function buildDescriptor(tab: ReportTab): ReportDescriptor {
  // These reports accept an optional projectId via the shared panel's dynamic
  // slot rather than the required-project field; leaving `projectScoped: false`
  // means the shared schema doesn't hard-require a project, letting the FE-54
  // panel Run through and this viewer enforce report-specific rules (e.g. the
  // ledger's required accountId).
  return {
    name: REPORT_NAME[tab],
    title: "",
    description: "",
    category: "LEDGERS_REGISTERS",
    viewerRoute: "/reports/trial-balance-ledgers",
    requiredPermission: "reports",
    parameters: [],
    projectScoped: false,
    supportsAsOf: tab === "TB",
    supportsDateRange: tab !== "TB",
  };
}

// Sample master options for the report-specific filters — real data comes
// through hooks the sibling briefs already wire; keep these inline for now.
const SAMPLE_ACCOUNTS = [
  { id: "1010", label: "1010 · Cash on hand" },
  { id: "1101", label: "1101 · HSBC Current 001" },
  { id: "1200", label: "1200 · Accounts Receivable" },
  { id: "2100", label: "2100 · Accounts payable" },
  { id: "5100", label: "5100 · Materials" },
];
const SAMPLE_PARTIES = [
  { id: "party-1", label: "National Housing Authority" },
  { id: "party-2", label: "M/s Rahman Traders" },
];
const SAMPLE_CASH_BANK = [
  { id: "1010", label: "1010 · Cash on hand" },
  { id: "1101", label: "1101 · HSBC Current 001" },
];
const VOUCHER_TYPES = [
  { value: "CONTRA", label: "Contra" },
  { value: "JOURNAL", label: "Journal" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "PAYMENT", label: "Payment" },
  { value: "IPC", label: "IPC" },
  { value: "PURCHASE_BILL", label: "Purchase bill" },
  { value: "GRN", label: "GRN" },
  { value: "SALARY", label: "Salary sheet" },
  { value: "STOCK", label: "Stock journal" },
  { value: "OPENING", label: "Opening" },
];
