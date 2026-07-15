"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canCaptureAttendance, canConfirmAttendance, canReverseAttendance } from "../access";
import { useAttendance } from "../hooks/useAttendance";
import { useAttendanceMutations } from "../hooks/useAttendanceMutations";
import { useDailyLabourConfirm } from "../hooks/useDailyLabourConfirm";
import {
  dailyLabourRowSchema,
  mapAttendanceError,
  type DailyLabourRowValues,
} from "../schemas/attendance.schema";
import { ComputedCostCell } from "./ComputedCostCell";
import { ConfirmAccrualDialog } from "./ConfirmAccrualDialog";
import { ReverseAccrualDialog } from "./ReverseAccrualDialog";
import { ConfirmedRowBadge } from "./ConfirmedRowBadge";
import { HeadCountStepper } from "./HeadCountStepper";
import {
  type AttendanceRecord,
  type DailyLabourRowInput,
} from "../api/attendance";
import { type ProjectOption } from "../types";
import { type CostCentreOption, type PurposeOption } from "../api/masters";

/** Grid template shared by header + every row (Attendance.dc.html §Daily labour). */
const DL_COLUMNS = "160px minmax(0,1.2fr) 140px 116px 116px 128px 176px";

/**
 * Daily-labour bulk grid (FR-HR-006..-012). Rows: cost-centre × labour-category with a
 * head-count stepper, editable daily rate, and live-computed cost = `headCount × dailyRate`
 * in exact Decimal(18,4). UNCONFIRMED rows are editable; CONFIRMED rows are visually
 * separated, locked (no inputs), and expose Reverse. Confirm opens the balanced-preview
 * dialog and posts server-side — non-optimistic ("Posting…" row lock), then flips to
 * CONFIRMED with the linked `entryNo`.
 *
 * 360 support: below md the grid becomes stacked cards with a full-width Confirm at the
 * bottom of each row card (spec §4). Site Engineer captures but cannot Confirm/Reverse.
 */
export function DailyLabourGrid({
  date,
  projectId,
  costCentreId,
  projects,
  costCentres,
  purposeOptions,
  isLoadingMasters,
}: {
  date: string; // YYYY-MM-DD
  projectId: string;
  costCentreId: string;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  purposeOptions: PurposeOption[];
  isLoadingMasters: boolean;
}) {
  const user = useAuthenticatedUser();
  const canCapture = canCaptureAttendance(user);
  const canConfirm = canConfirmAttendance(user);
  const canReverse = canReverseAttendance(user);
  const { toast } = useToast();

  const query = useAttendance(
    { mode: "DAILY_LABOUR", attendanceDate: date, projectId: projectId || undefined, costCentreId: costCentreId || undefined },
    !!date,
  );

  const rows = useMemo(() => query.data?.data ?? [], [query.data?.data]);

  // ── Draft new rows ──
  interface Draft extends DailyLabourRowValues {
    key: string;
    errors: Partial<Record<keyof DailyLabourRowValues, string>>;
  }
  const [drafts, setDrafts] = useState<Draft[]>([]);

  function addDraft() {
    setDrafts((d) => [
      ...d,
      {
        key: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        projectId: projectId || (projects[0]?.id ?? ""),
        costCentreId: costCentreId || (costCentres[0]?.id ?? ""),
        purposeId: null,
        labourCategory: "",
        headCount: 1,
        dailyRate: "0",
        errors: {},
      },
    ]);
  }

  function patchDraft(key: string, patch: Partial<DailyLabourRowValues>) {
    setDrafts((d) =>
      d.map((r) => (r.key === key ? { ...r, ...patch, errors: {} } : r)),
    );
  }

  function removeDraft(key: string) {
    setDrafts((d) => d.filter((r) => r.key !== key));
  }

  const { saveDailyLabour, patchDailyLabour } = useAttendanceMutations();
  const { confirm, reverse } = useDailyLabourConfirm();

  const [confirmTarget, setConfirmTarget] = useState<AttendanceRecord | null>(null);
  const [reverseTarget, setReverseTarget] = useState<AttendanceRecord | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [postingId, setPostingId] = useState<string | null>(null);
  const [confirmServerError, setConfirmServerError] = useState<string | null>(null);
  const [reverseServerError, setReverseServerError] = useState<string | null>(null);

  async function saveDrafts() {
    const inputs: DailyLabourRowInput[] = [];
    const nextDrafts: Draft[] = [];
    let anyErr = false;
    for (const d of drafts) {
      const parsed = dailyLabourRowSchema.safeParse({
        projectId: d.projectId,
        costCentreId: d.costCentreId,
        purposeId: d.purposeId || null,
        labourCategory: d.labourCategory ?? null,
        headCount: Number(d.headCount),
        dailyRate: String(d.dailyRate),
      });
      if (!parsed.success) {
        anyErr = true;
        const errors: Draft["errors"] = {};
        for (const iss of parsed.error.issues) {
          const path = iss.path[0] as keyof DailyLabourRowValues | undefined;
          if (path) errors[path] = iss.message;
        }
        nextDrafts.push({ ...d, errors });
        continue;
      }
      inputs.push({
        attendanceDate: date,
        projectId: parsed.data.projectId,
        costCentreId: parsed.data.costCentreId,
        purposeId: parsed.data.purposeId ?? null,
        labourCategory: parsed.data.labourCategory ?? null,
        headCount: parsed.data.headCount,
        dailyRate: parsed.data.dailyRate,
      });
      nextDrafts.push(d);
    }
    if (anyErr) {
      setDrafts(nextDrafts);
      return;
    }
    try {
      await saveDailyLabour.mutateAsync(inputs);
      setDrafts([]);
      toast("Attendance saved.", "success");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      toast(mapAttendanceError(String(code)), "error");
    }
  }

  async function openConfirmFor(row: AttendanceRecord) {
    setConfirmServerError(null);
    setConfirmTarget(row);
  }

  async function submitConfirm(purposeId: string) {
    if (!confirmTarget) return;
    setPostingId(confirmTarget.id);
    setConfirmServerError(null);
    try {
      const result = await confirm.mutateAsync({
        id: confirmTarget.id,
        input: { purposeId, version: confirmTarget.version },
      });
      toast(`Accrual posted — ${result.entryNo}`, "success");
      setConfirmTarget(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setConfirmServerError(mapAttendanceError(String(e.code)));
      } else {
        setConfirmServerError("Something went wrong. Please try again.");
      }
    } finally {
      setPostingId(null);
    }
  }

  async function submitReverse(reason: string) {
    if (!reverseTarget) return;
    setPostingId(reverseTarget.id);
    setReverseServerError(null);
    try {
      const result = await reverse.mutateAsync({
        id: reverseTarget.id,
        input: { reason },
      });
      toast(`Accrual reversed — ${result.reversalEntryNo}`, "success");
      setReverseTarget(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setReverseServerError(mapAttendanceError(String(e.code)));
      } else {
        setReverseServerError("Something went wrong. Please try again.");
      }
    } finally {
      setPostingId(null);
    }
  }

  async function editHeadCount(row: AttendanceRecord, headCount: number) {
    if (row.isConfirmed) return; // guarded by UI (locked) but defence-in-depth
    setRowError((s) => ({ ...s, [row.id]: "" }));
    try {
      await patchDailyLabour.mutateAsync({
        id: row.id,
        input: { headCount, version: row.version },
      });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      setRowError((s) => ({ ...s, [row.id]: mapAttendanceError(String(code)) }));
    }
  }

  const projectLabel = (id: string | null) => projects.find((p) => p.id === id)?.name ?? id ?? "";
  const ccLabel = (id: string | null) =>
    costCentres.find((c) => c.id === id)?.name ?? id ?? "";

  const isLoading = query.isLoading || isLoadingMasters;

  return (
    <div data-testid="daily-labour-grid" id="att-panel-DAILY_LABOUR" role="tabpanel" aria-labelledby="att-tab-DAILY_LABOUR">
      <Card
        className={cn(
          "flex flex-col overflow-hidden",
          query.isFetching && !query.isLoading && "opacity-60",
        )}
      >
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="daily-labour-loading">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load attendance. Please try again.">
              <div className="flex flex-col items-start gap-2">
                <Button size="sm" onClick={() => query.refetch()} data-testid="daily-labour-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 && drafts.length === 0 ? (
          <div className="p-8" data-testid="daily-labour-empty">
            <EmptyState
              icon={Users}
              title="No daily-labour rows for this day yet."
              description={
                canCapture
                  ? "Add a cost-centre × category row to capture head count."
                  : "Site engineers can add rows for their assigned projects."
              }
              action={
                canCapture ? (
                  <Button size="md" onClick={addDraft} data-testid="daily-labour-add">
                    Add row
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop grid (≥md) — Attendance.dc.html §Daily labour: role=row CSS-grid, not a <table> */}
            <div className="hidden overflow-x-auto md:block" data-testid="daily-labour-table">
              <div
                role="row"
                className="grid border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
                style={{ gridTemplateColumns: DL_COLUMNS }}
              >
                <div className="flex h-11 items-center px-4">Cost centre</div>
                <div className="flex h-11 items-center px-3">Labour category</div>
                <div className="flex h-11 items-center px-3">Purpose</div>
                <div className="flex h-11 items-center px-3">Head count</div>
                <div className="flex h-11 items-center justify-end px-3">Daily rate ৳</div>
                <div className="flex h-11 items-center justify-end px-3.5">Computed cost ৳</div>
                <div className="h-11" />
              </div>

              {rows.map((r) => (
                <div
                  key={r.id}
                  role="row"
                  className={cn(
                    "grid min-h-[58px] items-center border-b border-muted",
                    r.isConfirmed && "bg-success-soft/30",
                    postingId === r.id && "opacity-70",
                  )}
                  style={{ gridTemplateColumns: DL_COLUMNS }}
                  data-testid={`daily-labour-row-${r.isConfirmed ? "confirmed" : "unconfirmed"}`}
                  data-row-id={r.id}
                >
                  <div className="min-w-0 px-4 py-2.5">
                    <span className="inline-flex h-[22px] max-w-full items-center truncate rounded-token bg-accent-soft px-2.5 text-[11px] font-semibold text-accent-ink">
                      {ccLabel(r.costCentreId)}
                    </span>
                  </div>
                  <div className="min-w-0 px-3 py-2.5 text-[13px] font-medium text-foreground [overflow-wrap:anywhere]">
                    {r.labourCategory ?? "—"}
                  </div>
                  <div className="min-w-0 px-3 py-2.5">
                    <span className="text-[12.5px] text-muted-foreground">
                      {purposeOptions.find((p) => p.id === r.purposeId)?.name ?? "— No purpose —"}
                    </span>
                  </div>
                  <div className="px-3 py-2.5">
                    {r.isConfirmed ? (
                      <span className="font-mono text-[13px] font-semibold tabular-nums text-muted-foreground" data-testid="hc-locked">
                        {r.headCount}
                      </span>
                    ) : (
                      <HeadCountStepper
                        value={r.headCount ?? 0}
                        min={1}
                        disabled={!canCapture}
                        onChange={(v) => void editHeadCount(r, v)}
                        testId={`hc-input-${r.id}`}
                      />
                    )}
                  </div>
                  <div className="px-3 py-2.5 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                    {formatMoney(r.dailyRate ?? "0", { withSymbol: false })}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 px-3.5 py-2.5">
                    <ComputedCostCell
                      className="text-[13.5px] font-semibold text-foreground"
                      headCount={r.headCount ?? 0}
                      dailyRate={r.dailyRate}
                    />
                    {r.isConfirmed && <span className="text-[10.5px] text-faint">accrued</span>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 px-3.5 py-2.5">
                    {r.isConfirmed ? (
                      <>
                        <ConfirmedRowBadge
                          entryNo={r.entryNo}
                          journalEntryId={r.accrualEntryId}
                          reversalEntryNo={r.reversalEntryNo}
                          reversalEntryId={r.reversalEntryId}
                        />
                        {canReverse && !r.reversalEntryNo && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReverseServerError(null);
                              setReverseTarget(r);
                            }}
                            disabled={postingId === r.id}
                            data-testid={`row-reverse-${r.id}`}
                          >
                            Reverse
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        {postingId === r.id ? (
                          <span className="text-[12px] font-semibold text-warning" data-testid="posting-state">
                            Posting…
                          </span>
                        ) : (
                          canConfirm && (
                            <Button
                              size="sm"
                              onClick={() => openConfirmFor(r)}
                              disabled={postingId === r.id}
                              data-testid={`row-confirm-${r.id}`}
                            >
                              Confirm
                            </Button>
                          )
                        )}
                      </>
                    )}
                    {rowError[r.id] && (
                      <p className="text-[11.5px] text-destructive" data-testid={`row-err-${r.id}`}>
                        {rowError[r.id]}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Draft rows (unsaved) */}
              {drafts.map((d) => (
                <div
                  key={d.key}
                  role="row"
                  className="grid min-h-[58px] items-center border-b border-muted bg-surface-2/40"
                  style={{ gridTemplateColumns: DL_COLUMNS }}
                  data-testid="daily-labour-draft-row"
                >
                  <div className="px-3 py-2">
                    <Select
                      value={d.costCentreId}
                      onChange={(e) => patchDraft(d.key, { costCentreId: e.target.value })}
                      invalid={!!d.errors.costCentreId}
                      data-testid={`draft-cc-${d.key}`}
                    >
                      <option value="">Choose cost centre…</option>
                      {costCentres.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </Select>
                    {d.errors.costCentreId && (
                      <p className="mt-1 text-[11.5px] text-destructive" data-testid={`draft-cc-err-${d.key}`}>
                        {d.errors.costCentreId}
                      </p>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <Input
                      value={d.labourCategory ?? ""}
                      onChange={(e) => patchDraft(d.key, { labourCategory: e.target.value })}
                      placeholder="e.g. Mason"
                      data-testid={`draft-cat-${d.key}`}
                    />
                  </div>
                  <div className="px-3 py-2">
                    <Select
                      value={d.purposeId ?? ""}
                      onChange={(e) => patchDraft(d.key, { purposeId: e.target.value || null })}
                      data-testid={`draft-purpose-${d.key}`}
                    >
                      <option value="">— No purpose —</option>
                      {purposeOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="px-3 py-2">
                    <HeadCountStepper
                      value={d.headCount}
                      min={1}
                      onChange={(v) => patchDraft(d.key, { headCount: v })}
                      testId={`draft-hc-${d.key}`}
                    />
                    {d.errors.headCount && (
                      <p className="mt-1 text-[11.5px] text-destructive" data-testid={`draft-hc-err-${d.key}`}>
                        {d.errors.headCount}
                      </p>
                    )}
                  </div>
                  <div className="px-3 py-2 text-right">
                    <Input
                      className="text-right"
                      value={d.dailyRate}
                      onChange={(e) => patchDraft(d.key, { dailyRate: e.target.value })}
                      invalid={!!d.errors.dailyRate}
                      data-testid={`draft-rate-${d.key}`}
                    />
                    {d.errors.dailyRate && (
                      <p className="mt-1 text-[11.5px] text-destructive" data-testid={`draft-rate-err-${d.key}`}>
                        {d.errors.dailyRate}
                      </p>
                    )}
                  </div>
                  <div className="px-3.5 py-2 text-right">
                    <ComputedCostCell headCount={d.headCount} dailyRate={d.dailyRate} />
                  </div>
                  <div className="flex items-center justify-end px-3.5 py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeDraft(d.key)}
                      data-testid={`draft-remove-${d.key}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile stacked cards (<md) */}
            <div className="flex flex-col md:hidden" data-testid="daily-labour-mobile">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    "border-b border-muted px-3 py-3",
                    r.isConfirmed && "bg-success-soft/30",
                  )}
                  data-testid={`daily-labour-card-${r.isConfirmed ? "confirmed" : "unconfirmed"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-foreground">{ccLabel(r.costCentreId)}</div>
                      <div className="text-[12px] text-muted-foreground">{r.labourCategory ?? "—"}</div>
                    </div>
                    {r.isConfirmed ? (
                      <ConfirmedRowBadge
                        entryNo={r.entryNo}
                        journalEntryId={r.accrualEntryId}
                        reversalEntryNo={r.reversalEntryNo}
                        reversalEntryId={r.reversalEntryId}
                      />
                    ) : null}
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                    <div>
                      <dt className="text-faint">Head count</dt>
                      <dd className="font-mono tabular-nums">{r.headCount}</dd>
                    </div>
                    <div>
                      <dt className="text-faint">Daily rate</dt>
                      <dd className="font-mono tabular-nums">
                        {formatMoney(r.dailyRate ?? "0", { withSymbol: false, fractionDigits: 2 })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-faint">Computed</dt>
                      <dd>
                        <ComputedCostCell headCount={r.headCount ?? 0} dailyRate={r.dailyRate} />
                      </dd>
                    </div>
                  </dl>
                  {!r.isConfirmed && canConfirm && (
                    <Button
                      className="mt-3 min-h-[44px] w-full"
                      onClick={() => openConfirmFor(r)}
                      disabled={postingId === r.id}
                      data-testid={`row-confirm-mobile-${r.id}`}
                    >
                      {postingId === r.id ? "Posting…" : "Confirm & post accrual"}
                    </Button>
                  )}
                  {r.isConfirmed && canReverse && !r.reversalEntryNo && (
                    <Button
                      className="mt-3 min-h-[44px] w-full"
                      variant="outline"
                      onClick={() => setReverseTarget(r)}
                      disabled={postingId === r.id}
                      data-testid={`row-reverse-mobile-${r.id}`}
                    >
                      Reverse
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {(rows.length > 0 || drafts.length > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground">
              {drafts.length > 0
                ? `${drafts.length} draft row${drafts.length === 1 ? "" : "s"}`
                : "Confirm posts one accrual per row — Dr Labour Cost / Cr Labour Payable. Confirmed rows are corrected by reversal only."}
            </span>
            <div className="flex items-center gap-2">
              {drafts.length > 0 && (
                <Button
                  size="sm"
                  onClick={saveDrafts}
                  disabled={saveDailyLabour.isPending}
                  data-testid="daily-labour-save"
                >
                  {saveDailyLabour.isPending ? "Saving…" : "Save drafts"}
                </Button>
              )}
              {canCapture && (
                <Button size="sm" variant="outline" onClick={addDraft} data-testid="daily-labour-add-more">
                  + Add row
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      <ConfirmAccrualDialog
        open={!!confirmTarget}
        onOpenChange={(v) => (v ? null : setConfirmTarget(null))}
        row={confirmTarget}
        projectLabel={projectLabel(confirmTarget?.projectId ?? null)}
        costCentreLabel={ccLabel(confirmTarget?.costCentreId ?? null)}
        purposeOptions={purposeOptions}
        errorMessage={confirmServerError}
        onConfirm={submitConfirm}
        isPosting={postingId === confirmTarget?.id}
      />

      <ReverseAccrualDialog
        open={!!reverseTarget}
        onOpenChange={(v) => (v ? null : setReverseTarget(null))}
        row={reverseTarget}
        onReverse={submitReverse}
        isReversing={postingId === reverseTarget?.id}
        errorMessage={reverseServerError}
      />
    </div>
  );
}

