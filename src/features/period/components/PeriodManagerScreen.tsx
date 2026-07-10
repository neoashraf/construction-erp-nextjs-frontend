"use client";

import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/providers/session-provider";
import { asApiError } from "@/lib/api/errors";
import { FySelector } from "./FySelector";
import { FyToolbar } from "./FyToolbar";
import { FyLockedBanner } from "./FyLockedBanner";
import { PeriodTable } from "./PeriodTable";
import { ConfirmDialog } from "./ConfirmDialog";
import { useFinancialYearOptions, usePeriods } from "../hooks/usePeriods";
import {
  useGeneratePeriods,
  useClosePeriod,
  useReopenPeriod,
  useCloseFinancialYear,
} from "../hooks/usePeriodMutations";
import { periodCapabilities } from "../schemas/permissions";
import { isConflictRefresh, isFyLocked, mapActionError, mapListError } from "../schemas/errors";
import { type AccountingPeriod, type PeriodDialog } from "../types";

/**
 * Accounting periods screen (spec, FR-PER-001/002/008/009/010). An in-page FY
 * selector (defaulting to the shell's active FY) drives the period list; every
 * close/reopen/generate/close-all is confirm-dialog gated and server-confirmed
 * (no optimistic UI). Full state matrix per spec §6.
 */
export function PeriodManagerScreen() {
  const session = useSession();
  const { toast } = useToast();
  const role = session?.role ?? "SITE_ENGINEER";
  const caps = periodCapabilities(role);

  const fyOptions = useFinancialYearOptions();
  const [financialYearId, setFinancialYearId] = useState<string>(
    session?.financialYearId ?? "",
  );

  // Default to the shell's active FY once options load, if nothing chosen yet.
  useEffect(() => {
    const options = fyOptions.data;
    if (financialYearId || !options || options.length === 0) return;
    const first = options[0];
    if (!first) return;
    const active = options.find((fy) => fy.isActive) ?? first;
    setFinancialYearId(active.id);
  }, [fyOptions.data, financialYearId]);

  const query = usePeriods(financialYearId || null);
  const periods = query.data ?? [];
  const selectedFy = fyOptions.data?.find((fy) => fy.id === financialYearId) ?? null;

  const generate = useGeneratePeriods();
  const close = useClosePeriod();
  const reopen = useReopenPeriod();
  const closeFy = useCloseFinancialYear();

  const [dialog, setDialog] = useState<PeriodDialog | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const isLoading = query.isLoading;
  const isError = query.isError;
  const hasPeriods = periods.length > 0;
  const openCount = periods.filter((p) => p.status === "OPEN").length;
  const closedCount = periods.length - openCount;
  const allClosed = hasPeriods && openCount === 0;

  function closeDialog() {
    setDialog(null);
    setDialogError(null);
  }

  function askGenerate() {
    if (!financialYearId) return;
    setDialog({ kind: "generate", financialYearId });
  }

  function askClose(period: AccountingPeriod) {
    setDialog({ kind: "close", period });
  }

  function askReopen(period: AccountingPeriod) {
    setDialog({ kind: "reopen", period });
  }

  function askCloseFy() {
    if (!financialYearId) return;
    setDialog({ kind: "close-fy", financialYearId, openCount });
  }

  function confirmGenerate() {
    if (dialog?.kind !== "generate") return;
    generate.mutate(dialog.financialYearId, {
      onSuccess: (result) => {
        closeDialog();
        toast(`Generated ${result.count} periods.`, "success");
      },
      onError: (err) => {
        const e = asApiError(err);
        closeDialog();
        toast(mapActionError(e), "error");
      },
    });
  }

  function confirmClose() {
    if (dialog?.kind !== "close") return;
    const { period } = dialog;
    setActingId(period.id);
    close.mutate(period.id, {
      onSuccess: () => {
        setActingId(null);
        closeDialog();
        toast("Period closed.", "success");
      },
      onError: (err) => {
        setActingId(null);
        const e = asApiError(err);
        closeDialog();
        if (isConflictRefresh(e.code)) {
          query.refetch();
        }
        toast(mapActionError(e), "error");
      },
    });
  }

  function confirmReopen() {
    if (dialog?.kind !== "reopen") return;
    const { period } = dialog;
    setActingId(period.id);
    reopen.mutate(period.id, {
      onSuccess: () => {
        setActingId(null);
        closeDialog();
        toast("Period reopened.", "success");
      },
      onError: (err) => {
        setActingId(null);
        const e = asApiError(err);
        if (isFyLocked(e.code)) {
          // Year-locked: keep the dialog open with the inline message (spec §6/§8) —
          // remedy is unlocking the FY elsewhere, not a blind retry.
          setDialogError(mapActionError(e));
          return;
        }
        closeDialog();
        if (isConflictRefresh(e.code)) {
          query.refetch();
        }
        toast(mapActionError(e), "error");
      },
    });
  }

  function confirmCloseFy() {
    if (dialog?.kind !== "close-fy") return;
    closeFy.mutate(dialog.financialYearId, {
      onSuccess: (result) => {
        closeDialog();
        const stillOpen = result.periods.some((p) => p.status === "OPEN");
        toast(
          stillOpen
            ? `Closed ${result.closedCount} periods.`
            : `Closed ${result.closedCount} periods. Financial year locked.`,
          "success",
        );
      },
      onError: (err) => {
        const e = asApiError(err);
        closeDialog();
        if (isConflictRefresh(e.code)) {
          query.refetch();
        }
        toast(mapActionError(e), "error");
      },
    });
  }

  const readOnly = !caps.canClose && !caps.canReopen;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Accounting" }, { label: "Periods" }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Accounting periods</h1>
          <p className="mt-1.5 max-w-[66ch] text-[12.5px] leading-relaxed text-muted-foreground">
            Open or close the monthly periods of the active financial year. Posting, reversing and
            reposting into a <strong className="font-semibold text-foreground">closed</strong>{" "}
            period is rejected on the voucher form — reopen here to allow corrections.
          </p>
        </div>
        <FyToolbar
          showGenerate={caps.canGenerate && !isLoading && !hasPeriods && !isError}
          showCloseAll={caps.canClose && hasPeriods && openCount > 0}
          closeAllBusy={closeFy.isPending}
          disabled={isLoading}
          onGenerate={askGenerate}
          onCloseAll={askCloseFy}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3.5">
        <FySelector
          options={fyOptions.data ?? []}
          value={financialYearId}
          onChange={setFinancialYearId}
          disabled={fyOptions.isLoading}
        />
        <div className="flex h-[38px] items-center gap-2 rounded-token border border-border-strong bg-surface px-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">Co</span>
          <span className="text-[12.5px] font-semibold text-foreground">Active company</span>
        </div>
        <span className="ml-auto self-center text-[11.5px] text-faint">
          {isLoading
            ? "Loading…"
            : isError
              ? ""
              : hasPeriods
                ? `${periods.length} periods · ${closedCount} closed · ${openCount} open`
                : "No periods"}
        </span>
      </div>

      {allClosed && (
        <div className="mt-3.5">
          <FyLockedBanner />
        </div>
      )}

      <Card className="mt-3.5 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="periods-loading">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4">
            <Alert tone="destructive" title={mapListError(asApiError(query.error))}>
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="periods-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : !financialYearId ? (
          <div className="p-8">
            <EmptyState
              icon={CalendarRange}
              title="Select a financial year to view its periods."
            />
          </div>
        ) : !hasPeriods ? (
          <div className="p-8">
            <EmptyState
              icon={CalendarRange}
              title="No periods have been generated for this financial year."
              description={
                caps.canGenerate
                  ? `Generate the standard monthly set to start closing periods at month-end. This creates one Open period per month of ${selectedFy?.label ?? "this financial year"}.`
                  : undefined
              }
              action={
                caps.canGenerate ? (
                  <Button onClick={askGenerate} data-testid="empty-generate-periods">
                    Generate periods
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <PeriodTable
              periods={periods}
              canClose={caps.canClose}
              canReopen={caps.canReopen}
              actingId={actingId}
              onClose={askClose}
              onReopen={askReopen}
            />
            <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
              <span className="text-[12.5px] text-muted-foreground">
                {periods.length} periods · {closedCount} closed · {openCount} open
              </span>
              <span className="text-[11.5px] text-faint">
                Ordered by start date · boundaries inclusive
              </span>
            </div>
          </>
        )}
      </Card>

      {readOnly && hasPeriods && (
        <p className="mt-3 text-[12px] text-muted-foreground" data-testid="read-only-note">
          You have view-only access to accounting periods.
        </p>
      )}

      <ConfirmDialog
        open={dialog?.kind === "generate"}
        testId="generate-dialog"
        title="Generate periods?"
        body={
          selectedFy
            ? `This creates one open period per month across ${selectedFy.label} (${formatFyDate(selectedFy.startDate)} – ${formatFyDate(selectedFy.endDate)}). All periods start open. You can't generate again once periods exist for this year.`
            : "This creates one open period per month across the selected financial year. All periods start open. You can't generate again once periods exist for this year."
        }
        confirmLabel="Generate"
        confirmingLabel="Generating…"
        busy={generate.isPending}
        onConfirm={confirmGenerate}
        onCancel={closeDialog}
      />

      <ConfirmDialog
        open={dialog?.kind === "close"}
        testId="close-dialog"
        title={dialog?.kind === "close" ? `Close ${dialog.period.name}?` : ""}
        body="Closing this period locks it. No vouchers can be posted, reversed, or reposted into a closed period until it is reopened. Draft vouchers are not affected. This action is recorded in the audit log."
        confirmLabel="Close period"
        confirmingLabel="Closing…"
        busy={close.isPending}
        onConfirm={confirmClose}
        onCancel={closeDialog}
      />

      <ConfirmDialog
        open={dialog?.kind === "reopen"}
        testId="reopen-dialog"
        title={dialog?.kind === "reopen" ? `Reopen ${dialog.period.name}?` : ""}
        body="Reopening unlocks this period so corrections can be posted (reverse-and-repost). Remember to close it again after corrections. This action is recorded in the audit log."
        confirmLabel="Reopen period"
        confirmingLabel="Reopening…"
        busy={reopen.isPending}
        error={dialog?.kind === "reopen" ? dialogError : null}
        confirmDisabled={dialog?.kind === "reopen" && !!dialogError}
        onConfirm={confirmReopen}
        onCancel={closeDialog}
      />

      <ConfirmDialog
        open={dialog?.kind === "close-fy"}
        testId="close-fy-dialog"
        title={selectedFy ? `Close all periods for ${selectedFy.label}?` : "Close all periods?"}
        body={`This closes every period that is still open in ${selectedFy?.label ?? "this financial year"} (${dialog?.kind === "close-fy" ? dialog.openCount : openCount} open). After this, no vouchers can be posted into the financial year until a period is reopened. Each close is recorded in the audit log.`}
        confirmLabel="Close all"
        confirmingLabel="Closing…"
        busy={closeFy.isPending}
        onConfirm={confirmCloseFy}
        onCancel={closeDialog}
      />
    </div>
  );
}

/** `YYYY-MM-DD` -> `DD/MM/YYYY` for the Generate-dialog body (spec §8 exact copy). */
function formatFyDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
