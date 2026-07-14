"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/money";
import { ApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canEditSalaryDraft, canPostSalary } from "../access";
import { useSalarySheet } from "../hooks/useSalarySheet";
import { useSalaryMutations } from "../hooks/useSalaryMutations";
import { SalaryStatusBadge } from "./SalaryStatusBadge";
import { SalaryLinesTable } from "./SalaryLinesTable";
import { SalaryTotalsFooter } from "./SalaryTotalsFooter";
import { BulkComponentPanel } from "./BulkComponentPanel";
import { PostPreviewPanel } from "./PostPreviewPanel";
import { PostConfirmDialog } from "./PostConfirmDialog";
import { ReverseSalaryDialog } from "./ReverseSalaryDialog";
import { listPurposeOptions } from "../api/masters";
import { type SalaryLineUpdateInput, type BulkComponentInput } from "../api/salary";
import { mapSalaryError } from "../schemas/salary.schema";

/**
 * The sheet editor / viewer (spec §3/§4/§6). DRAFT: fully editable — per-line PATCH, bulk
 * apply, Post (gated behind the balanced-preview checkbox). POSTED: every cell renders as
 * static text (`aria-readonly`), Reverse + "View payslips" are the only actions. REVERSED:
 * stays read-only, shows "Reversed by {reversalEntryNo}" beside the original entry link.
 *
 * Post is deliberately non-optimistic — the whole sheet locks (aria-live full-width
 * "Posting…" banner) until the server responds; on success the read-only flip happens IN
 * PLACE (no navigation), the entry link + "View payslips" appear, and a toast confirms.
 */
export function SalarySheetEditor({ id }: { id: string }) {
  const user = useAuthenticatedUser();
  const canEdit = canEditSalaryDraft(user);
  const canPost = canPostSalary(user);
  const { toast } = useToast();

  const query = useSalarySheet(id);
  const sheet = query.data;
  const status = sheet?.status ?? "DRAFT";
  const readOnly = status !== "DRAFT" || !canEdit;

  const { patchLine, applyBulk, post, reverse } = useSalaryMutations(id);

  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  // Project-scoped purpose lookup — a sheet spans projects, so we fetch purposes per project seen.
  const projectIds = useMemo(() => {
    if (!sheet) return [] as string[];
    return Array.from(new Set(sheet.lines.map((l) => l.projectId).filter(Boolean) as string[]));
  }, [sheet]);
  const purposesQ = useQuery({
    queryKey: ["hr", "purposes", "sheet", projectIds.join(",")],
    queryFn: async () => {
      const map = new Map<string, string>();
      await Promise.all(
        projectIds.map(async (pid) => {
          try {
            const rows = await listPurposeOptions(pid);
            for (const p of rows) map.set(p.id, p.name);
          } catch {
            /* ignore */
          }
        }),
      );
      return map;
    },
    enabled: projectIds.length > 0,
    staleTime: 60 * 1000,
    retry: 1,
  });
  const purposeLookup = useCallback(
    (pid: string | null | undefined) => (pid ? purposesQ.data?.get(pid) ?? pid : ""),
    [purposesQ.data],
  );

  const handlePatchLine = useCallback(
    async (lineId: string, input: SalaryLineUpdateInput) => {
      setSavingLineId(lineId);
      setLineErrors((s) => ({ ...s, [lineId]: "" }));
      try {
        await patchLine.mutateAsync({ lineId, input });
      } catch (e) {
        const code = e instanceof ApiError ? e.code : "UNKNOWN";
        const message = e instanceof ApiError ? e.message : undefined;
        setLineErrors((s) => ({ ...s, [lineId]: mapSalaryError(String(code), undefined, message) }));
      } finally {
        setSavingLineId(null);
      }
    },
    [patchLine],
  );

  async function handleBulkApply(input: BulkComponentInput) {
    setBulkError(null);
    try {
      const res = await applyBulk.mutateAsync(input);
      toast(`Changes saved. ${res.changedLineCount} line${res.changedLineCount === 1 ? "" : "s"} updated.`, "success");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      const message = e instanceof ApiError ? e.message : undefined;
      setBulkError(mapSalaryError(String(code), undefined, message));
    }
  }

  async function handlePost() {
    if (!sheet) return;
    setPostError(null);
    try {
      const res = await post.mutateAsync({ version: sheet.version });
      setPostDialogOpen(false);
      toast(`Salary posted — entry ${res.entryNo}.`, "success");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      const message = e instanceof ApiError ? e.message : undefined;
      setPostError(mapSalaryError(String(code), undefined, message));
    }
  }

  async function handleReverse(reason: string) {
    if (!sheet) return;
    setReverseError(null);
    try {
      const res = await reverse.mutateAsync({ reason, version: sheet.version });
      setReverseDialogOpen(false);
      toast(`Salary run reversed — ${res.reversalEntryNo}.`, "success");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      const message = e instanceof ApiError ? e.message : undefined;
      setReverseError(mapSalaryError(String(code), undefined, message));
    }
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl" data-testid="salary-editor-loading">
        <Breadcrumb items={[{ label: "HR" }, { label: "Salary sheet", href: "/hr/salary-sheets" }, { label: "…" }]} />
        <Skeleton className="mb-3 h-8 w-64" />
        <Card className="p-4">
          <div className="flex gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (query.isError || !sheet) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "HR" }, { label: "Salary sheet", href: "/hr/salary-sheets" }, { label: id }]} />
        <Alert tone="destructive" title="Couldn't load this salary sheet.">
          <div className="mt-2">
            <Button size="sm" onClick={() => query.refetch()} data-testid="salary-editor-retry">
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const isPosting = post.isPending;
  const isReversing = reverse.isPending;
  const lockedForPost = isPosting || isReversing;

  const missingDim = sheet.lines.some((l) => !l.projectId || !l.costCentreId || !l.purposeId);
  const canPressPost = status === "DRAFT" && canPost && previewConfirmed && !missingDim && !lockedForPost;

  return (
    <div className="mx-auto max-w-6xl" data-testid="salary-editor">
      <Breadcrumb
        items={[
          { label: "HR" },
          { label: "Salary sheet", href: "/hr/salary-sheets" },
          { label: sheet.periodLabel },
        ]}
      />

      <div className="mt-1.5 flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-[23px] font-bold tracking-[-0.01em]" data-testid="salary-editor-title">
              {sheet.periodLabel}
            </h1>
            <SalaryStatusBadge status={sheet.status} />
          </div>
          <div className="mt-1 text-[12.5px] text-muted-foreground">
            Salary run ·{" "}
            <span className="font-mono text-[12px]">
              {sheet.periodStart} → {sheet.periodEnd}
            </span>{" "}
            · All projects
          </div>
          {sheet.entryNo && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Ledger entry</span>
              <Link
                href={`/ledger/entry-viewer?id=${encodeURIComponent(sheet.salaryEntryId ?? sheet.entryNo)}`}
                className="font-mono text-[12.5px] font-semibold text-accent-ink underline-offset-2 hover:underline"
                data-testid="salary-entry-link"
              >
                {sheet.entryNo}
              </Link>
              {sheet.reversalEntryNo && (
                <>
                  <span className="inline-flex h-5 items-center gap-1.5 rounded-pill bg-muted px-2 text-[10.5px] font-semibold text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-faint" aria-hidden />
                    Reversed by
                  </span>
                  <Link
                    href={`/ledger/entry-viewer?id=${encodeURIComponent(sheet.reversalEntryId ?? sheet.reversalEntryNo)}`}
                    className="font-mono text-[12px] font-semibold text-accent-ink underline-offset-2 hover:underline"
                    data-testid="salary-reversal-link"
                  >
                    {sheet.reversalEntryNo}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex flex-none gap-2.5" data-testid="salary-stat-boxes">
          <StatBox label="Gross earnings" value={sheet.totalGross} />
          <StatBox label="Deductions" value={sheet.totalDeductions} negative />
          <StatBox label="Net payable" value={sheet.totalNet} highlight />
        </div>
      </div>

      <div
        className="mt-3.5 flex flex-none items-center gap-2.5 rounded-card border border-border bg-surface px-3.5 py-2.5 shadow-sm"
        data-testid="salary-editor-actions"
      >
        <span className="text-[12.5px] text-muted-foreground">{sheet.lines.length} lines</span>
        <div className="flex-1" />
        {status === "DRAFT" && canEdit && (
          <Button size="sm" variant="outline" onClick={() => query.refetch()} data-testid="save-changes">
            Save changes
          </Button>
        )}
        {sheet.status === "POSTED" && (
          <Button asChild={false} size="sm" variant="outline" data-testid="view-payslips">
            <Link href={`/hr/salary-sheets/${sheet.id}/payslips`}>View payslips</Link>
          </Button>
        )}
        {sheet.status === "POSTED" && canPost && !sheet.reversalEntryNo && (
          <Button size="sm" variant="destructive-outline" onClick={() => setReverseDialogOpen(true)} data-testid="reverse-open">
            Reverse
          </Button>
        )}
        {sheet.status === "DRAFT" && canPost && (
          <Button
            size="md"
            onClick={() => {
              setPostError(null);
              setPostDialogOpen(true);
            }}
            disabled={!canPressPost}
            data-testid="post-open"
            title={!previewConfirmed ? "Review the balanced preview first" : undefined}
          >
            Post
          </Button>
        )}
      </div>

      {sheet.status === "DRAFT" && (
        <div className="mt-2.5 flex items-center gap-2" data-testid="salary-inactive-note">
          <Info className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />
          <p className="text-[12px] text-muted-foreground">Inactive employees are excluded automatically.</p>
        </div>
      )}
      {sheet.status === "DRAFT" && !canEdit && (
        <Alert
          tone="info"
          className="mt-2.5"
          title="You can view this draft, but editing is limited to HR Manager or Admin."
          data-testid="salary-noedit-note"
        />
      )}

      {lockedForPost && (
        <Alert
          tone="info"
          className="mt-3"
          data-testid="posting-banner"
          role="status"
          aria-live="assertive"
          title={isPosting ? "Posting…" : "Reversing…"}
        >
          The sheet is locked while the server writes the ledger entry. Please wait for confirmation.
        </Alert>
      )}

      <Card className="mt-3.5 overflow-hidden" data-testid="salary-editor-card">
        {sheet.lines.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[13px] text-muted-foreground" data-testid="salary-editor-no-lines">
              No lines on this sheet — every active employee is already excluded for this period.
            </p>
          </div>
        ) : (
          <SalaryLinesTable
            lines={sheet.lines}
            readOnly={readOnly || lockedForPost}
            savingLineId={savingLineId}
            onPatch={handlePatchLine}
            lineErrors={lineErrors}
            purposeLookup={purposeLookup}
          />
        )}

        <SalaryTotalsFooter
          totalGross={sheet.totalGross}
          totalDeductions={sheet.totalDeductions}
          totalNet={sheet.totalNet}
          saving={!!savingLineId || applyBulk.isPending}
        />
      </Card>

      {status === "DRAFT" && sheet.lines.length > 0 && ((canEdit && !lockedForPost) || canPost) && (
        <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
          {canEdit && !lockedForPost && (
            <BulkComponentPanel
              lines={sheet.lines}
              sheetVersion={sheet.version}
              disabled={false}
              onApply={handleBulkApply}
              isApplying={applyBulk.isPending}
              serverError={bulkError}
            />
          )}
          {canPost && (
            <PostPreviewPanel
              sheet={sheet}
              confirmed={previewConfirmed}
              onConfirmChange={setPreviewConfirmed}
              serverError={postError}
            />
          )}
        </div>
      )}

      {status !== "DRAFT" && (
        <p className="mt-3 text-[12px] text-muted-foreground" data-testid="salary-readonly-note">
          {status === "POSTED"
            ? "This sheet is posted and locked. Corrections require a reversal."
            : "This sheet has been reversed. Generate a corrected sheet to reapply payroll."}
        </p>
      )}

      {status === "DRAFT" && sheet.lines.length === 0 && (
        <p className="mt-3 text-[12px] text-muted-foreground" data-testid="salary-payslips-note">
          Payslips will be available once this run is posted.
        </p>
      )}

      <PostConfirmDialog
        open={postDialogOpen}
        onOpenChange={(v) => {
          setPostDialogOpen(v);
          if (!v) setPostError(null);
        }}
        totalGross={sheet.totalGross}
        onConfirm={handlePost}
        isPosting={isPosting}
        errorMessage={postError}
      />

      <ReverseSalaryDialog
        open={reverseDialogOpen}
        onOpenChange={(v) => {
          setReverseDialogOpen(v);
          if (!v) setReverseError(null);
        }}
        entryNo={sheet.entryNo}
        onReverse={handleReverse}
        isReversing={isReversing}
        errorMessage={reverseError}
      />
    </div>
  );
}

/** Header KPI stat box — Gross earnings / Deductions / Net payable (Salary Sheet.dc.html editor header). */
function StatBox({
  label,
  value,
  negative,
  highlight,
}: {
  label: string;
  value: string;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "min-w-[132px] rounded-card border px-3.5 py-2.5 " +
        (highlight ? "border-accent/40 bg-accent-soft" : "border-border bg-surface")
      }
    >
      <div
        className={
          "text-[10px] font-semibold uppercase tracking-[0.5px] " +
          (highlight ? "text-accent-ink" : "text-faint")
        }
      >
        {label}
      </div>
      <div
        className={
          "mt-0.5 font-mono text-[18px] font-bold tabular-nums " +
          (negative ? "text-destructive" : "text-foreground")
        }
      >
        {negative && "− "}
        {formatMoney(value, { withSymbol: false })}
      </div>
    </div>
  );
}
