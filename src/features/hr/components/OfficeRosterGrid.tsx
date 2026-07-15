"use client";

import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { useMasterLookups } from "@/lib/masters/lookups";
import { canCaptureAttendance } from "../access";
import { useAttendance } from "../hooks/useAttendance";
import { useAttendanceMutations } from "../hooks/useAttendanceMutations";
import {
  DAY_STATUS_LABEL,
  DAY_STATUS_OPTIONS,
  mapAttendanceError,
  officeRowSchema,
  type OfficeRowValues,
} from "../schemas/attendance.schema";
import { BiometricImportPanel } from "./BiometricImportPanel";
import { type DayStatus, type OfficeAttendanceRow, type AttendanceRecord } from "../api/attendance";

/** Grid template shared by header + every row (Attendance.dc.html §Office staff roster). */
const OFFICE_COLUMNS = "minmax(0,1.35fr) 116px 116px 176px 116px 140px";

/**
 * Office-staff roster grid (FR-HR-004; spec §5). One row per active employee for the
 * filtered project/date: check-in / check-out (HH:mm), day status, overtime hours, and a
 * source badge (MANUAL vs BIOMETRIC_IMPORT). Bulk save via one `rows[]` submit. The
 * biometric import + reconciliation panel is embedded here; conflicts open a side panel.
 * PM/Store Keeper: hidden by the module guard; Site Engineer can capture (assigned).
 */
export function OfficeRosterGrid({
  date,
  projectId,
}: {
  date: string; // YYYY-MM-DD
  projectId: string;
}) {
  const user = useAuthenticatedUser();
  const canCapture = canCaptureAttendance(user);
  const { toast } = useToast();
  const lookups = useMasterLookups();
  const [showImportPanel, setShowImportPanel] = useState(false);

  const query = useAttendance(
    { mode: "OFFICE", attendanceDate: date, projectId: projectId || undefined },
    !!date,
  );

  const rows = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const [draft, setDraft] = useState<Record<string, OfficeRowValues>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, Partial<Record<keyof OfficeRowValues, string>>>>({});

  useEffect(() => {
    // seed draft from server rows so edits diff correctly
    const seed: Record<string, OfficeRowValues> = {};
    for (const r of rows) {
      seed[r.id] = {
        employeeId: r.employeeId ?? "",
        projectId: r.projectId,
        dayStatus: (r.dayStatus ?? "PRESENT") as DayStatus,
        checkIn: r.checkIn ?? "",
        checkOut: r.checkOut ?? "",
        overtimeHours: r.overtimeHours ?? "",
      };
    }
    setDraft(seed);
  }, [rows]);

  const { saveOffice } = useAttendanceMutations();

  function patch(id: string, patch: Partial<OfficeRowValues>) {
    setDraft((d) => ({ ...d, [id]: { ...d[id]!, ...patch } }));
    setRowErrors((s) => ({ ...s, [id]: {} }));
  }

  async function saveAll() {
    const rowsPayload: OfficeAttendanceRow[] = [];
    const nextErrors: typeof rowErrors = {};
    let anyErr = false;
    for (const r of rows) {
      const values = draft[r.id];
      if (!values) continue;
      const parsed = officeRowSchema.safeParse(values);
      if (!parsed.success) {
        anyErr = true;
        const errs: Partial<Record<keyof OfficeRowValues, string>> = {};
        for (const iss of parsed.error.issues) {
          const p = iss.path[0] as keyof OfficeRowValues | undefined;
          if (p) errs[p] = iss.message;
        }
        nextErrors[r.id] = errs;
        continue;
      }
      rowsPayload.push({
        employeeId: parsed.data.employeeId,
        attendanceDate: date,
        projectId: parsed.data.projectId,
        checkIn: parsed.data.checkIn || null,
        checkOut: parsed.data.checkOut || null,
        dayStatus: parsed.data.dayStatus,
        overtimeHours: parsed.data.overtimeHours || null,
      });
    }
    if (anyErr) {
      setRowErrors(nextErrors);
      return;
    }
    try {
      await saveOffice.mutateAsync(rowsPayload);
      toast("Office attendance saved.", "success");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      toast(mapAttendanceError(String(code)), "error");
    }
  }

  const isLoading = query.isLoading;
  const projectLabel = projectId ? lookups.project(projectId) : "All assigned projects";

  return (
    <div id="att-panel-OFFICE" role="tabpanel" aria-labelledby="att-tab-OFFICE" className="relative">
      <div className="mt-3.5 flex flex-none items-center gap-3">
        <span className="text-[12.5px] text-muted-foreground">
          Roster — {projectLabel} · <span className="font-mono text-[12px]">{date ? formatDate(date) : "—"}</span>
        </span>
        <div className="flex-1" />
        <div role="group" aria-label="Entry source" className="inline-flex gap-0.5 rounded-token border border-border bg-surface p-[3px]">
          <button
            type="button"
            aria-pressed={!showImportPanel}
            onClick={() => setShowImportPanel(false)}
            className={cn(
              "h-7 rounded-sm px-3 text-[12px] font-semibold transition-colors",
              !showImportPanel ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Manual entry
          </button>
          <button
            type="button"
            aria-pressed={showImportPanel}
            onClick={() => setShowImportPanel(true)}
            className={cn(
              "h-7 rounded-sm px-3 text-[12px] font-semibold transition-colors",
              showImportPanel ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            data-testid="office-toggle-import"
          >
            Biometric import
          </button>
        </div>
      </div>

      <Card
        className={cn(
          "mt-2.5 flex flex-col overflow-hidden",
          query.isFetching && !query.isLoading && "opacity-60",
        )}
        data-testid="office-roster"
      >
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="office-loading">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load the office roster.">
              <Button size="sm" onClick={() => query.refetch()} data-testid="office-retry">
                Retry
              </Button>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8" data-testid="office-empty">
            <EmptyState
              icon={Users}
              title="No active employees on this project."
              description="Assign employees on Employee master, or change the project filter."
            />
          </div>
        ) : (
          <div className="overflow-x-auto" data-testid="office-table">
            <div
              role="row"
              className="grid border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
              style={{ gridTemplateColumns: OFFICE_COLUMNS }}
            >
              <div className="flex h-11 items-center px-4">Employee</div>
              <div className="flex h-11 items-center px-3">Check-in</div>
              <div className="flex h-11 items-center px-3">Check-out</div>
              <div className="flex h-11 items-center px-3">Day status</div>
              <div className="flex h-11 items-center justify-end px-3">Overtime h</div>
              <div className="flex h-11 items-center px-4">Source</div>
            </div>
            {rows.map((r) => renderRow(r, draft[r.id], rowErrors[r.id] ?? {}, patch, canCapture))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground">
              Saving the roster does not post to the ledger — office attendance feeds the salary sheet.
            </span>
            {canCapture && (
              <Button size="sm" onClick={saveAll} disabled={saveOffice.isPending} data-testid="office-save">
                {saveOffice.isPending ? "Saving…" : "Save attendance"}
              </Button>
            )}
          </div>
        )}
      </Card>

      {showImportPanel && (
        <div className="absolute inset-y-0 right-0 z-10 w-[404px] max-w-full">
          <BiometricImportPanel onClose={() => setShowImportPanel(false)} />
        </div>
      )}
    </div>
  );
}

function renderRow(
  r: AttendanceRecord,
  values: OfficeRowValues | undefined,
  errs: Partial<Record<keyof OfficeRowValues, string>>,
  patch: (id: string, p: Partial<OfficeRowValues>) => void,
  canCapture: boolean,
) {
  const v = values ?? {
    employeeId: r.employeeId ?? "",
    projectId: r.projectId,
    dayStatus: (r.dayStatus ?? "PRESENT") as DayStatus,
    checkIn: r.checkIn ?? "",
    checkOut: r.checkOut ?? "",
    overtimeHours: r.overtimeHours ?? "",
  };
  return (
    <div
      key={r.id}
      role="row"
      className="grid min-h-[56px] items-center border-b border-muted"
      style={{ gridTemplateColumns: OFFICE_COLUMNS }}
      data-testid="office-row"
      data-source={r.source}
    >
      <div className="min-w-0 px-4 py-2.5">
        <div className="text-[13.5px] font-semibold text-foreground [overflow-wrap:anywhere]">{r.employeeId ?? "—"}</div>
      </div>
      <div className="px-3 py-2.5">
        <Input
          className="h-8 w-[76px] text-center font-mono"
          value={v.checkIn ?? ""}
          onChange={(e) => patch(r.id, { checkIn: e.target.value })}
          placeholder="HH:mm"
          invalid={!!errs.checkIn}
          disabled={!canCapture}
          data-testid={`office-checkin-${r.id}`}
        />
        {errs.checkIn && (
          <p className="mt-1 text-[11.5px] text-destructive" data-testid={`office-checkin-err-${r.id}`}>
            {errs.checkIn}
          </p>
        )}
      </div>
      <div className="px-3 py-2.5">
        <Input
          className="h-8 w-[76px] text-center font-mono"
          value={v.checkOut ?? ""}
          onChange={(e) => patch(r.id, { checkOut: e.target.value })}
          placeholder="HH:mm"
          invalid={!!errs.checkOut}
          disabled={!canCapture}
          data-testid={`office-checkout-${r.id}`}
        />
        {errs.checkOut && (
          <p className="mt-1 text-[11.5px] text-destructive" data-testid={`office-checkout-err-${r.id}`}>
            {errs.checkOut}
          </p>
        )}
      </div>
      <div className="px-3 py-2.5">
        <Select
          value={v.dayStatus}
          onChange={(e) => patch(r.id, { dayStatus: e.target.value as DayStatus })}
          disabled={!canCapture}
          data-testid={`office-status-${r.id}`}
        >
          {DAY_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {DAY_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="px-3 py-2.5 text-right">
        <Input
          className="h-8 w-[66px] text-right font-mono"
          value={v.overtimeHours ?? ""}
          onChange={(e) => patch(r.id, { overtimeHours: e.target.value })}
          placeholder="0"
          invalid={!!errs.overtimeHours}
          disabled={!canCapture}
          data-testid={`office-ot-${r.id}`}
        />
      </div>
      <div className="px-4 py-2.5">
        <Badge tone={r.source === "BIOMETRIC_IMPORT" ? "info" : "neutral"} data-testid="office-source-badge">
          {r.source === "BIOMETRIC_IMPORT" ? "Biometric" : "Manual"}
        </Badge>
      </div>
    </div>
  );
}
