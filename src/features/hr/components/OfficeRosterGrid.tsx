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
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canCaptureAttendance } from "../access";
import { useAttendance } from "../hooks/useAttendance";
import { useAttendanceMutations } from "../hooks/useAttendanceMutations";
import { useEmployees } from "../hooks/useEmployees";
import { sourceBadgeLabel, sourceBadgeTone } from "../lib/attendance-rows";
import {
  DAY_STATUS_LABEL,
  DAY_STATUS_OPTIONS,
  mapAttendanceError,
  officeRowSchema,
  type OfficeRowValues,
} from "../schemas/attendance.schema";
import { type DayStatus, type OfficeAttendanceRow, type AttendanceRecord } from "../api/attendance";
import { type ProjectOption } from "../types";

/** Grid template shared by header + every row (Attendance.dc.html §Office staff roster). */
const OFFICE_COLUMNS = "minmax(0,1.5fr) 168px 100px 100px 148px 96px 116px";

/**
 * Office-staff roster grid (FR-HR-004; spec §5) — the single-date capture surface.
 *
 * One row per active employee for the filtered project/date: **Location**, check-in /
 * check-out (HH:mm), day status, overtime hours, and the source badge. Bulk save via one
 * `rows[]` submit. Nothing here posts to the ledger.
 *
 * **There is no "Manual entry | Biometric import" mode toggle** — it was removed with FE-64.
 * It was a vestige of a two-mode model the automatic merge deleted: every path (device push,
 * `Sync device` pull, spreadsheet import, keyed entry) now lands in the SAME row through the
 * same pipeline, so there is no mode to switch between. The grid is always directly editable
 * and **Import is an action, not a mode** — it lives in the tab header beside the device badge
 * and Sync. The toggle also duplicated the Import button sitting next to it (spec §5).
 *
 * PM/Store Keeper: hidden by the module guard; Site Engineer can capture (assigned projects).
 */
export function OfficeRosterGrid({
  date,
  projectId,
  projects,
}: {
  date: string; // YYYY-MM-DD
  projectId: string;
  /** MAS Project options — offices AND sites; the Location select's source. */
  projects: ProjectOption[];
}) {
  const user = useAuthenticatedUser();
  const canCapture = canCaptureAttendance(user);
  const { toast } = useToast();

  const query = useAttendance(
    { mode: "OFFICE", attendanceDate: date, projectId: projectId || undefined },
    !!date,
  );

  /*
   * The attendance row carries only `employeeId`, but the design's identity cell reads
   * name-first with the code and designation beneath — a roster is scanned by person, not by id.
   * Resolved from the Employee master and keyed BOTH ways, because `employeeId` holds a UUID on
   * a keyed row and the human employee code on a device/imported one.
   *
   * An unresolved id degrades to the id itself plus "(name unavailable)" (spec §6 partial state)
   * rather than blanking the cell.
   */
  const employeesQuery = useEmployees({ page: 1, pageSize: 500 });
  const employeeById = useMemo(() => {
    const map = new Map<string, { name: string; designation: string | null; employeeCode: string }>();
    for (const e of employeesQuery.data?.data ?? []) {
      map.set(e.id, e);
      map.set(e.employeeCode, e);
    }
    return map;
  }, [employeesQuery.data?.data]);

  const rows = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const [draft, setDraft] = useState<Record<string, OfficeRowValues>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, Partial<Record<keyof OfficeRowValues, string>>>>({});

  useEffect(() => {
    // seed draft from server rows so edits diff correctly
    const seed: Record<string, OfficeRowValues> = {};
    for (const r of rows) {
      seed[r.id] = {
        employeeId: r.employeeId ?? "",
        // Default the Location to the filtered project. The picker always sends an explicit
        // value, which is what makes manual entry rank 1 of the resolution order.
        projectId: r.projectId || projectId || "",
        dayStatus: (r.dayStatus ?? "PRESENT") as DayStatus,
        checkIn: r.checkIn ?? "",
        checkOut: r.checkOut ?? "",
        overtimeHours: r.overtimeHours ?? "",
      };
    }
    setDraft(seed);
  }, [rows, projectId]);

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
      toast(`${rowsPayload.length} entries saved.`, "success");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      toast(mapAttendanceError(String(code)), "error");
    }
  }

  const isLoading = query.isLoading;

  return (
    <div className="relative">
      <Card
        className={cn(
          "flex flex-col overflow-hidden",
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
            <Alert tone="destructive" title="Couldn't save these entries.">
              <Button size="sm" onClick={() => query.refetch()} data-testid="office-retry">
                Retry
              </Button>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8" data-testid="office-empty">
            <EmptyState
              icon={Users}
              title="No active employees assigned to this project."
              description="Check the Employee master or choose a different project."
            />
          </div>
        ) : (
          /*
            `min-w` + `overflow-x-auto` together: without the minimum the fixed track widths
            collapse below ~900px and the columns overlap — a Bangla name shreds to one glyph
            per line and the headers stack on top of each other. The table scrolls sideways
            instead, which spec §4 explicitly allows for the review grid. Below `sm` the rows
            reflow to stacked cards (see `renderRow`), so this never applies on a phone.
          */
          <div className="hidden w-full overflow-x-auto sm:block" data-testid="office-table">
            <div className="min-w-[900px]">
            <div
              role="row"
              className="grid border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
              style={{ gridTemplateColumns: OFFICE_COLUMNS }}
            >
              <div className="flex h-11 items-center px-4">Employee</div>
              <div className="flex h-11 items-center px-3">
                Location <span className="ml-1 text-destructive" aria-hidden>*</span>
              </div>
              <div className="flex h-11 items-center px-3">Check-in</div>
              <div className="flex h-11 items-center px-3">Check-out</div>
              <div className="flex h-11 items-center px-3">Day status</div>
              <div className="flex h-11 items-center justify-end px-3">Overtime h</div>
              <div className="flex h-11 items-center px-4">Source</div>
            </div>
            {rows.map((r) =>
              renderRow(
                r,
                draft[r.id],
                rowErrors[r.id] ?? {},
                patch,
                canCapture,
                projects,
                projectId,
                employeeById.get(r.employeeId ?? ""),
              ),
            )}

            {/*
              The overtime column is captured and STORED, and payroll sums it — but the OT rate
              is still pending client confirmation, so `overtimeAmount` resolves to 0 and these
              hours add ৳0 to gross. A number on a payroll screen reads as compensated unless it
              says otherwise, so this line is not optional polish. Remove it only in the change
              that makes the hours pay (SRS §16; spec §5/§7/§8).
            */}
            <div
              className="grid border-b border-muted"
              style={{ gridTemplateColumns: OFFICE_COLUMNS }}
            >
              <div className="col-start-6 col-end-8 px-3 py-2.5 text-right">
                <p className="text-[11.5px] leading-relaxed text-muted-foreground" data-testid="office-overtime-helper">
                  Overtime is recorded for reference — not yet included in pay.
                </p>
              </div>
            </div>
            </div>
          </div>
        )}

        {/*
          ≥360 is a REAL support tier for this screen, not a degraded fallback (spec §4): a Site
          Engineer captures a day from the field on a phone. One row = one stacked card, primary
          fields always visible, ≥44px targets — never the desktop grid squeezed until a Bangla
          name shreds one glyph per line.
        */}
        {!isLoading && !query.isError && rows.length > 0 ? (
          <div className="flex flex-col divide-y divide-muted sm:hidden" data-testid="office-cards">
            {rows.map((r) =>
              renderCard(
                r,
                draft[r.id],
                rowErrors[r.id] ?? {},
                patch,
                canCapture,
                projects,
                projectId,
                employeeById.get(r.employeeId ?? ""),
              ),
            )}
            <p
              className="px-4 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground"
              data-testid="office-overtime-helper-mobile"
            >
              Overtime is recorded for reference — not yet included in pay.
            </p>
          </div>
        ) : null}

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground">
              A day can carry a status with no times — saving the roster never posts to the ledger.
            </span>
            {canCapture && (
              <Button size="sm" onClick={saveAll} disabled={saveOffice.isPending} data-testid="office-save">
                {saveOffice.isPending ? "Saving…" : "Save entries"}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function renderRow(
  r: AttendanceRecord,
  values: OfficeRowValues | undefined,
  errs: Partial<Record<keyof OfficeRowValues, string>>,
  patch: (id: string, p: Partial<OfficeRowValues>) => void,
  canCapture: boolean,
  projects: ProjectOption[],
  filterProjectId: string,
  employee?: { name: string; designation: string | null; employeeCode: string },
) {
  // Partial state (spec §6): an unresolved id shows the id with a muted "(name unavailable)"
  // and the row stays editable — the ids are still valid even when the lookup isn't.
  const employeeName = employee?.name ?? null;
  const employeeMeta = employee
    ? [employee.employeeCode, employee.designation].filter(Boolean).join(" · ")
    : "(name unavailable)";
  const v = values ?? {
    employeeId: r.employeeId ?? "",
    projectId: r.projectId || filterProjectId || "",
    dayStatus: (r.dayStatus ?? "PRESENT") as DayStatus,
    checkIn: r.checkIn ?? "",
    checkOut: r.checkOut ?? "",
    overtimeHours: r.overtimeHours ?? "",
  };
  const sourceLabel = sourceBadgeLabel(r.source);
  return (
    <div
      key={r.id}
      role="row"
      className="grid min-h-[56px] items-center border-b border-muted"
      style={{ gridTemplateColumns: OFFICE_COLUMNS }}
      data-testid="office-row"
      data-source={r.source}
    >
      {/*
        Two-line identity cell, per the design: the person's name reads first, the code and
        designation beneath it. Bangla names must wrap, never clip.
      */}
      <div className="min-w-0 px-4 py-2.5">
        <div className="text-[13.5px] font-semibold text-foreground [overflow-wrap:anywhere]">
          {employeeName ?? r.employeeId ?? "—"}
        </div>
        {employeeMeta ? (
          <div className="text-[11.5px] text-muted-foreground [overflow-wrap:anywhere]">{employeeMeta}</div>
        ) : null}
      </div>

      {/*
        Labelled **Location**, not "Project": an office day resolves to an office/overhead
        project, so "Project" is the wrong word on this row. Required — the picker always sends
        an explicit value, which is what makes manual entry rank 1 of the resolution order
        (FR-HR-008; spec §5/§7).
      */}
      <div className="px-3 py-2.5">
        <Select
          className="h-8 w-full"
          aria-label={`Location for ${r.employeeId ?? "employee"}`}
          value={v.projectId}
          onChange={(e) => patch(r.id, { projectId: e.target.value })}
          invalid={!!errs.projectId}
          disabled={!canCapture}
          data-testid={`office-location-${r.id}`}
        >
          <option value="">Select a location</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        {errs.projectId && (
          <p className="mt-1 text-[11.5px] text-destructive" data-testid={`office-location-err-${r.id}`}>
            {errs.projectId}
          </p>
        )}
      </div>

      <div className="px-3 py-2.5">
        <Input
          className="h-8 w-[76px] text-center font-mono"
          aria-label={`Check-in for ${r.employeeId ?? "employee"}`}
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
          aria-label={`Check-out for ${r.employeeId ?? "employee"}`}
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
          className="h-8 w-full"
          aria-label={`Day status for ${r.employeeId ?? "employee"}`}
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
          aria-label={`Overtime hours for ${r.employeeId ?? "employee"}`}
          value={v.overtimeHours ?? ""}
          onChange={(e) => patch(r.id, { overtimeHours: e.target.value })}
          placeholder="0"
          invalid={!!errs.overtimeHours}
          disabled={!canCapture}
          data-testid={`office-ot-${r.id}`}
        />
        {errs.overtimeHours && (
          <p className="mt-1 text-[11.5px] text-destructive" data-testid={`office-ot-err-${r.id}`}>
            {errs.overtimeHours}
          </p>
        )}
      </div>
      {/* Readable text, never colour alone (spec §10) — and an unlisted value reads Machine. */}
      <div className="px-4 py-2.5">
        <Badge tone={sourceBadgeTone(r.source)} data-testid="office-source-badge">
          {sourceLabel}
        </Badge>
      </div>
    </div>
  );
}

/**
 * One roster row as a stacked card (≥360).
 *
 * Same fields, same schema, same save — only the layout differs. Full-width controls with
 * ≥44px targets, because this is captured one-handed on a site, and Bangla names wrap rather
 * than being truncated to fit a column that does not exist here.
 */
function renderCard(
  r: AttendanceRecord,
  values: OfficeRowValues | undefined,
  errs: Partial<Record<keyof OfficeRowValues, string>>,
  patch: (id: string, p: Partial<OfficeRowValues>) => void,
  canCapture: boolean,
  projects: ProjectOption[],
  filterProjectId: string,
  employee?: { name: string; designation: string | null; employeeCode: string },
) {
  const employeeName = employee?.name ?? null;
  const employeeMeta = employee
    ? [employee.employeeCode, employee.designation].filter(Boolean).join(" · ")
    : "(name unavailable)";
  const v = values ?? {
    employeeId: r.employeeId ?? "",
    projectId: r.projectId || filterProjectId || "",
    dayStatus: (r.dayStatus ?? "PRESENT") as DayStatus,
    checkIn: r.checkIn ?? "",
    checkOut: r.checkOut ?? "",
    overtimeHours: r.overtimeHours ?? "",
  };

  return (
    <div key={`card-${r.id}`} className="flex flex-col gap-2.5 px-4 py-3.5" data-testid="office-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-foreground [overflow-wrap:anywhere]">
            {employeeName ?? r.employeeId ?? "—"}
          </div>
          <div className="text-[11.5px] text-muted-foreground [overflow-wrap:anywhere]">{employeeMeta}</div>
        </div>
        <Badge tone={sourceBadgeTone(r.source)} className="flex-none">
          {sourceBadgeLabel(r.source)}
        </Badge>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
          Location <span className="text-destructive" aria-hidden>*</span>
        </span>
        <Select
          className="min-h-[44px] w-full"
          aria-label={`Location for ${employeeName ?? r.employeeId ?? "employee"}`}
          value={v.projectId}
          onChange={(e) => patch(r.id, { projectId: e.target.value })}
          invalid={!!errs.projectId}
          disabled={!canCapture}
          data-testid={`office-card-location-${r.id}`}
        >
          <option value="">Select a location</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        {errs.projectId ? (
          <span className="text-[11.5px] text-destructive">{errs.projectId}</span>
        ) : null}
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">Check-in</span>
          <Input
            className="min-h-[44px] text-center font-mono"
            value={v.checkIn ?? ""}
            onChange={(e) => patch(r.id, { checkIn: e.target.value })}
            placeholder="HH:mm"
            invalid={!!errs.checkIn}
            disabled={!canCapture}
            data-testid={`office-card-checkin-${r.id}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">Check-out</span>
          <Input
            className="min-h-[44px] text-center font-mono"
            value={v.checkOut ?? ""}
            onChange={(e) => patch(r.id, { checkOut: e.target.value })}
            placeholder="HH:mm"
            invalid={!!errs.checkOut}
            disabled={!canCapture}
            data-testid={`office-card-checkout-${r.id}`}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">Day status</span>
          <Select
            className="min-h-[44px]"
            value={v.dayStatus}
            onChange={(e) => patch(r.id, { dayStatus: e.target.value as DayStatus })}
            disabled={!canCapture}
            data-testid={`office-card-status-${r.id}`}
          >
            {DAY_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {DAY_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">Overtime h</span>
          <Input
            className="min-h-[44px] text-right font-mono"
            value={v.overtimeHours ?? ""}
            onChange={(e) => patch(r.id, { overtimeHours: e.target.value })}
            placeholder="0"
            invalid={!!errs.overtimeHours}
            disabled={!canCapture}
            data-testid={`office-card-ot-${r.id}`}
          />
        </label>
      </div>
    </div>
  );
}
