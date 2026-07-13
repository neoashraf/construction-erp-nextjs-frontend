"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
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
        setLineErrors((s) => ({ ...s, [lineId]: mapSalaryError(String(code)) }));
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
      setBulkError(mapSalaryError(String(code)));
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
      setPostError(mapSalaryError(String(code)));
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
      setReverseError(mapSalaryError(String(code)));
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

      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="salary-editor-title">
          {sheet.periodLabel}
        </h1>
        <SalaryStatusBadge status={sheet.status} />
        {sheet.entryNo && (
          <Link
            href={`/ledger/entry-viewer?id=${encodeURIComponent(sheet.salaryEntryId ?? sheet.entryNo)}`}
            className="font-mono text-[12.5px] text-accent-ink underline-offset-2 hover:underline"
            data-testid="salary-entry-link"
          >
            {sheet.entryNo}
          </Link>
        )}
        {sheet.reversalEntryNo && (
          <span className="text-[12px] text-muted-foreground" data-testid="salary-reversal-info">
            Reversed by{" "}
            <Link
              href={`/ledger/entry-viewer?id=${encodeURIComponent(sheet.reversalEntryId ?? sheet.reversalEntryNo)}`}
              className="font-mono text-accent-ink underline-offset-2 hover:underline"
              data-testid="salary-reversal-link"
            >
              {sheet.reversalEntryNo}
            </Link>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2" data-testid="salary-editor-actions">
          {sheet.status === "POSTED" && (
            <Button asChild={false} size="sm" variant="outline" data-testid="view-payslips">
              <Link href={`/hr/salary-sheets/${sheet.id}/payslips`}>View payslips</Link>
            </Button>
          )}
          {sheet.status === "POSTED" && canPost && !sheet.reversalEntryNo && (
            <Button size="sm" variant="outline" onClick={() => setReverseDialogOpen(true)} data-testid="reverse-open">
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
      </div>

      {sheet.status === "DRAFT" && (
        <p className="mb-2 text-[12px] text-muted-foreground" data-testid="salary-inactive-note">
          Inactive employees are excluded automatically.
        </p>
      )}
      {sheet.status === "DRAFT" && !canEdit && (
        <Alert
          tone="info"
          className="mb-2"
          title="You can view this draft, but editing is limited to HR Manager or Admin."
          data-testid="salary-noedit-note"
        />
      )}

      {lockedForPost && (
        <Alert
          tone="info"
          className="mb-3"
          data-testid="posting-banner"
          role="status"
          aria-live="assertive"
          title={isPosting ? "Posting…" : "Reversing…"}
        >
          The sheet is locked while the server writes the ledger entry. Please wait for confirmation.
        </Alert>
      )}

      <Card className="overflow-hidden" data-testid="salary-editor-card">
        <div className="border-b border-border bg-surface-2 px-4 py-2">
          <div className="grid grid-cols-3 gap-3 text-[12px] text-muted-foreground">
            <div>
              <div className="text-faint">Period</div>
              <div className="font-medium text-foreground">
                {sheet.periodStart} → {sheet.periodEnd}
              </div>
            </div>
            <div>
              <div className="text-faint">Lines</div>
              <div className="font-medium text-foreground">{sheet.lines.length}</div>
            </div>
            <div>
              <div className="text-faint">Version</div>
              <div className="font-mono text-foreground">v{sheet.version}</div>
            </div>
          </div>
        </div>

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

      {status === "DRAFT" && canEdit && !lockedForPost && sheet.lines.length > 0 && (
        <BulkComponentPanel
          lines={sheet.lines}
          sheetVersion={sheet.version}
          disabled={false}
          onApply={handleBulkApply}
          isApplying={applyBulk.isPending}
          serverError={bulkError}
        />
      )}

      {status === "DRAFT" && canPost && sheet.lines.length > 0 && (
        <PostPreviewPanel
          sheet={sheet}
          confirmed={previewConfirmed}
          onConfirmChange={setPreviewConfirmed}
          serverError={postError}
        />
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

/** Formatted currency helper — inline to allow the header block to render `৳` totals inline if wanted later. */
export function _formatSheetMoney(v: string): string {
  return formatMoney(v, { withSymbol: true, fractionDigits: 2 });
}
