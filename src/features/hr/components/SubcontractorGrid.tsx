"use client";

import { useMemo, useState } from "react";
import { Trash2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canCaptureAttendance } from "../access";
import { useAttendance } from "../hooks/useAttendance";
import { useAttendanceMutations } from "../hooks/useAttendanceMutations";
import {
  mapAttendanceError,
  subcontractorRowSchema,
  type SubcontractorRowValues,
} from "../schemas/attendance.schema";
import { HeadCountStepper } from "./HeadCountStepper";
import { type SubcontractorRow } from "../api/attendance";
import { type ProjectOption } from "../types";
import { type CostCentreOption, type PartyOption, type PurposeOption } from "../api/masters";

/** Grid template shared by header + every row (Attendance.dc.html §Subcontractor). */
const SUB_COLUMNS = "minmax(0,1.35fr) 196px 196px 190px 56px";

/**
 * Subcontractor tracking-only grid (FR-HR-005). Party × project × cost centre × head count.
 * GL-free — the overview §5.1 matrix — so there is NO Confirm / Reverse control anywhere.
 * A persistent "Tracking only — no accounting impact" banner sits above the grid. Tests
 * assert the absence of any Confirm affordance in the DOM.
 */
export function SubcontractorGrid({
  date,
  projectId,
  costCentreId,
  projects,
  costCentres,
  parties,
  purposeOptions,
  isLoadingMasters,
}: {
  date: string;
  projectId: string;
  costCentreId: string;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  parties: PartyOption[];
  purposeOptions: PurposeOption[];
  isLoadingMasters: boolean;
}) {
  const user = useAuthenticatedUser();
  const canCapture = canCaptureAttendance(user);
  const { toast } = useToast();
  const query = useAttendance(
    { mode: "SUBCONTRACTOR", attendanceDate: date, projectId: projectId || undefined, costCentreId: costCentreId || undefined },
    !!date,
  );
  const rows = useMemo(() => query.data?.data ?? [], [query.data?.data]);

  interface Draft extends SubcontractorRowValues {
    key: string;
    errors: Partial<Record<keyof SubcontractorRowValues, string>>;
  }
  const [drafts, setDrafts] = useState<Draft[]>([]);

  function addDraft() {
    setDrafts((d) => [
      ...d,
      {
        key: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        partyId: parties[0]?.id ?? "",
        projectId: projectId || (projects[0]?.id ?? ""),
        costCentreId: costCentreId || (costCentres[0]?.id ?? ""),
        purposeId: null,
        headCount: 1,
        errors: {},
      },
    ]);
  }

  function patchDraft(key: string, p: Partial<SubcontractorRowValues>) {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...p, errors: {} } : d)));
  }

  function removeDraft(key: string) {
    setDrafts((d) => d.filter((r) => r.key !== key));
  }

  const { saveSubcontractor } = useAttendanceMutations();

  async function save() {
    const payload: SubcontractorRow[] = [];
    const next: Draft[] = [];
    let anyErr = false;
    for (const d of drafts) {
      const parsed = subcontractorRowSchema.safeParse({
        partyId: d.partyId,
        projectId: d.projectId,
        costCentreId: d.costCentreId,
        purposeId: d.purposeId ?? null,
        headCount: Number(d.headCount),
      });
      if (!parsed.success) {
        anyErr = true;
        const errs: Draft["errors"] = {};
        for (const iss of parsed.error.issues) {
          const p = iss.path[0] as keyof SubcontractorRowValues | undefined;
          if (p) errs[p] = iss.message;
        }
        next.push({ ...d, errors: errs });
        continue;
      }
      payload.push({
        partyId: parsed.data.partyId,
        attendanceDate: date,
        projectId: parsed.data.projectId,
        costCentreId: parsed.data.costCentreId,
        purposeId: parsed.data.purposeId ?? null,
        headCount: parsed.data.headCount,
      });
      next.push(d);
    }
    if (anyErr) {
      setDrafts(next);
      return;
    }
    try {
      await saveSubcontractor.mutateAsync(payload);
      toast("Subcontractor attendance saved.", "success");
      setDrafts([]);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      toast(mapAttendanceError(String(code)), "error");
    }
  }

  const isLoading = query.isLoading || isLoadingMasters;

  return (
    <div id="att-panel-SUBCONTRACTOR" role="tabpanel" aria-labelledby="att-tab-SUBCONTRACTOR" data-testid="subcontractor-panel">
      <Alert tone="info" title="Tracking only — no accounting impact." data-testid="subcontractor-banner" />

      <Card
        className={cn(
          "mt-3 flex flex-col overflow-hidden",
          query.isFetching && !query.isLoading && "opacity-60",
        )}
      >
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="subcontractor-loading">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load subcontractor attendance.">
              <Button size="sm" onClick={() => query.refetch()} data-testid="subcontractor-retry">
                Retry
              </Button>
            </Alert>
          </div>
        ) : rows.length === 0 && drafts.length === 0 ? (
          <div className="p-8" data-testid="subcontractor-empty">
            <EmptyState
              icon={Users}
              title="No subcontractor rows for this day yet."
              action={canCapture ? <Button size="md" onClick={addDraft} data-testid="subcontractor-add">Add row</Button> : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto" data-testid="subcontractor-table">
            <div
              role="row"
              className="grid border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
              style={{ gridTemplateColumns: SUB_COLUMNS }}
            >
              <div className="flex h-11 items-center px-4">Subcontractor party</div>
              <div className="flex h-11 items-center px-3">Cost centre</div>
              <div className="flex h-11 items-center px-3">Purpose</div>
              <div className="flex h-11 items-center px-3">Head count</div>
              <div className="h-11" />
            </div>

            {rows.map((r) => (
              <div
                key={r.id}
                role="row"
                className="grid min-h-[58px] items-center border-b border-muted"
                style={{ gridTemplateColumns: SUB_COLUMNS }}
                data-testid="subcontractor-row"
              >
                <div className="min-w-0 px-4 py-2.5">
                  <div className="text-[13.5px] font-semibold text-foreground [overflow-wrap:anywhere]">
                    {parties.find((p) => p.id === r.partyId)?.name ?? r.partyId ?? "—"}
                  </div>
                </div>
                <div className="px-3 py-2.5">
                  <span className="inline-flex h-[22px] items-center rounded-token bg-accent-soft px-2.5 text-[11px] font-semibold text-accent-ink">
                    {costCentres.find((c) => c.id === r.costCentreId)?.name ?? r.costCentreId ?? "—"}
                  </span>
                </div>
                <div className="min-w-0 px-3 py-2.5 text-[12.5px] text-muted-foreground">
                  {purposeOptions.find((p) => p.id === r.purposeId)?.name ?? "— No purpose —"}
                </div>
                <div className="px-3 py-2.5 font-mono text-[13px] font-semibold tabular-nums text-foreground">
                  {r.headCount}
                </div>
                <div />
              </div>
            ))}

            {drafts.map((d) => (
              <div
                key={d.key}
                role="row"
                className="grid min-h-[58px] items-center border-b border-muted bg-surface-2/40"
                style={{ gridTemplateColumns: SUB_COLUMNS }}
                data-testid="subcontractor-draft-row"
              >
                <div className="px-3 py-2">
                  <Select
                    value={d.partyId}
                    onChange={(e) => patchDraft(d.key, { partyId: e.target.value })}
                    invalid={!!d.errors.partyId}
                    data-testid={`sub-party-${d.key}`}
                  >
                    <option value="">Choose subcontractor…</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                  {d.errors.partyId && (
                    <p className="mt-1 text-[11.5px] text-destructive" data-testid={`sub-party-err-${d.key}`}>
                      {d.errors.partyId}
                    </p>
                  )}
                </div>
                <div className="px-3 py-2">
                  <Select
                    value={d.costCentreId}
                    onChange={(e) => patchDraft(d.key, { costCentreId: e.target.value })}
                    invalid={!!d.errors.costCentreId}
                    data-testid={`sub-cc-${d.key}`}
                  >
                    <option value="">Choose cost centre…</option>
                    {costCentres.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </Select>
                  {d.errors.costCentreId && (
                    <p className="mt-1 text-[11.5px] text-destructive" data-testid={`sub-cc-err-${d.key}`}>
                      {d.errors.costCentreId}
                    </p>
                  )}
                </div>
                <div className="px-3 py-2">
                  <Select
                    value={d.purposeId ?? ""}
                    onChange={(e) => patchDraft(d.key, { purposeId: e.target.value || null })}
                    data-testid={`sub-purpose-${d.key}`}
                  >
                    <option value="">— No purpose —</option>
                    {purposeOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="px-3 py-2">
                  <HeadCountStepper
                    value={d.headCount}
                    min={1}
                    onChange={(v) => patchDraft(d.key, { headCount: v })}
                    testId={`sub-hc-${d.key}`}
                  />
                  {d.errors.headCount && (
                    <p className="mt-1 text-[11.5px] text-destructive" data-testid={`sub-hc-err-${d.key}`}>
                      {d.errors.headCount}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    aria-label="Remove row"
                    onClick={() => removeDraft(d.key)}
                    data-testid={`sub-remove-${d.key}`}
                    className="grid h-7 w-7 place-items-center rounded-token text-faint transition-colors hover:bg-destructive-soft hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {(rows.length > 0 || drafts.length > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground">
              No cost, no rate, no Confirm — head counts are saved for site records only.
            </span>
            <div className="flex items-center gap-2">
              {drafts.length > 0 && (
                <Button
                  size="sm"
                  onClick={save}
                  disabled={saveSubcontractor.isPending}
                  data-testid="subcontractor-save"
                >
                  {saveSubcontractor.isPending ? "Saving…" : "Save"}
                </Button>
              )}
              {canCapture && (
                <Button size="sm" variant="outline" onClick={addDraft} data-testid="subcontractor-add-more">
                  + Add row
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
