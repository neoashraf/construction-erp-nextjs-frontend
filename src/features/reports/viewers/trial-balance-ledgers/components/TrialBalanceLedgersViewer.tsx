"use client";

import { useMemo, useState } from "react";
import { WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ReportViewerHeader, type ReportScopeTone } from "../../../components/ReportViewerHeader";
import { FieldLabel, REPORT_SELECT_CLASS } from "../../../components/ReportParameterPanel";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { ReportExportControl } from "../../../components/ReportExportControl";
import { ReportParameterPanel } from "../../../components/ReportParameterPanel";
import { type ReportDescriptor, type ReportParams } from "../../../types";
import { REPORT_NAME, readLedgerMeta, useReportForTab } from "../hooks/useTrialBalanceLedgers";
import { type LedgerRow, type ReportTab, type TrialBalanceRow, type TrialBalanceTotals } from "../types";
import { LedgerTable } from "./LedgerTable";
import { ReportSwitcher } from "./ReportSwitcher";
import { TrialBalanceTable } from "./TrialBalanceTable";

/**
 * FE-56 `/reports/trial-balance-ledgers` — hosts the four-report switcher +
 * the shared parameter panel + the per-report body. Common params (FY, date
 * range) are preserved across tab switches; only the report-specific extras
 * reset (spec §9).
 */
/** Per-tab breadcrumb / report label. */
const TAB_LABEL: Record<ReportTab, string> = {
  TB: "Trial balance",
  LEDGER: "Account ledger",
  DAYBOOK: "Journal register",
  CASH_BANK: "Cash & bank book",
};

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
  onReportChange,
}: {
  embedded?: boolean;
  initialReport?: string;
  onReportChange?: (reportName: string, reportLabel: string) => void;
} = {}) {
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
    if (tab === "TB") {
      // Trial balance accepts both; as-of/period takes precedence over the range
      // (matches the panel's precedence note) — drop the range only when an
      // as-of/period is actually set.
      if (p.asOf || p.periodId) {
        p.dateFrom = null;
        p.dateTo = null;
      }
    } else {
      // The three flow registers are date-range only.
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
    onReportChange?.(REPORT_NAME[next], TAB_LABEL[next]);
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

  const breadcrumbLabel = TAB_LABEL[tab];

  // Scope pill: the trial balance is an as-of / period balance report (violet);
  // the three flow registers carry a running balance over a date range (blue).
  const scopeLabel = tab === "TB" ? "Balance · as-of / period" : "Register · running balance";
  const scopeTone: ReportScopeTone = tab === "TB" ? "violet" : "blue";

  const extras = params.extras ?? {};
  const setExtra = (key: string, next: string | null) =>
    setParams({ ...params, extras: { ...extras, [key]: next } });
  const slotDisabled = !online || query.isFetching;

  // Account-first tabs render their account control FIRST in the row (design
  // order), via the panel's leadingSlot: the Account ledger shows Account* + Party;
  // the Cash & bank book shows the Cash / bank account.
  function renderLeadingSlot() {
    if (tab === "LEDGER") {
      return (
        <>
          <div className="min-w-[180px]">
            <FieldLabel htmlFor="ledger-account" required>
              Account
            </FieldLabel>
            <select
              id="ledger-account"
              value={(extras.accountId as string) ?? ""}
              onChange={(e) => setExtra("accountId", e.target.value || null)}
              disabled={slotDisabled}
              className={cn(
                REPORT_SELECT_CLASS,
                accountIdError && "border-destructive focus:shadow-focus-error",
              )}
              data-testid="ledger-accountId"
            >
              <option value="">Select an account…</option>
              {SAMPLE_ACCOUNTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px]">
            <FieldLabel htmlFor="ledger-party">Party</FieldLabel>
            <select
              id="ledger-party"
              value={(extras.partyId as string) ?? ""}
              onChange={(e) => setExtra("partyId", e.target.value || null)}
              disabled={slotDisabled}
              className={REPORT_SELECT_CLASS}
              data-testid="ledger-partyId"
            >
              <option value="">All parties</option>
              {SAMPLE_PARTIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </>
      );
    }
    if (tab === "CASH_BANK") {
      return (
        <div className="min-w-[200px]">
          <FieldLabel htmlFor="cash-account">Cash / bank account</FieldLabel>
          <select
            id="cash-account"
            value={(extras.accountId as string) ?? ""}
            onChange={(e) => setExtra("accountId", e.target.value || null)}
            disabled={slotDisabled}
            className={REPORT_SELECT_CLASS}
            data-testid="cash-bank-accountId"
          >
            <option value="">All cash &amp; bank accounts</option>
            {SAMPLE_CASH_BANK.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    return undefined;
  }

  // Report-specific controls rendered INLINE after the standard fields:
  //   TB → Group by · DAYBOOK → Voucher type.
  //   (Account ledger + Cash & bank book put their account control first — see
  //   renderLeadingSlot.)
  function renderPrimarySlot() {
    if (tab === "TB") {
      return (
        <div className="min-w-[160px]">
          <FieldLabel htmlFor="tb-groupby-select">Group by</FieldLabel>
          <select
            id="tb-groupby-select"
            value={((extras.groupBy as string) ?? "account").split(",")[0] || "account"}
            onChange={(e) => setExtra("groupBy", e.target.value)}
            disabled={slotDisabled}
            className={REPORT_SELECT_CLASS}
            data-testid="tb-groupby"
          >
            {TB_GROUPBYS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (tab === "LEDGER") return undefined;
    if (tab === "DAYBOOK") {
      return (
        <div className="min-w-[180px]">
          <FieldLabel htmlFor="daybook-voucher-type">Voucher type</FieldLabel>
          <select
            id="daybook-voucher-type"
            value={(extras.voucherType as string) ?? ""}
            onChange={(e) => setExtra("voucherType", e.target.value || null)}
            disabled={slotDisabled}
            className={REPORT_SELECT_CLASS}
            data-testid="daybook-voucherType"
          >
            <option value="">All voucher types</option>
            {VOUCHER_TYPES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    // CASH_BANK renders its account control first (leadingSlot) — nothing here.
    return undefined;
  }

  return (
    <div className={embedded ? "" : "mx-auto max-w-[1400px] px-6 py-6"} data-testid="tb-ledgers-viewer">
      {!embedded && (
        <ReportViewerHeader
          breadcrumbLabel={breadcrumbLabel}
          title={breadcrumbLabel}
          scopeLabel={scopeLabel}
          scopeTone={scopeTone}
        />
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
          leadingSlot={renderLeadingSlot()}
          primarySlot={renderPrimarySlot()}
        />

        {tab === "LEDGER" && accountIdError && (
          <p className="text-[12px] text-destructive" role="alert" data-testid="ledger-account-error">
            {accountIdError}
          </p>
        )}
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
    // The trial balance exposes BOTH an as-of/period control and a date range
    // (per the design); the panel shows the as-of-takes-precedence note when both
    // are set. The three flow registers are date-range only.
    supportsAsOf: tab === "TB",
    supportsDateRange: true,
  };
}

// Trial-balance grouping dimensions (single-select, per the design's Group by).
const TB_GROUPBYS: Array<{ value: string; label: string }> = [
  { value: "account", label: "Account" },
  { value: "project", label: "Project" },
  { value: "cost_centre", label: "Cost centre" },
  { value: "purpose", label: "Purpose" },
  { value: "godown", label: "Godown" },
  { value: "party", label: "Party" },
];

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
