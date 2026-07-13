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
import {
  DAY_STATUS_LABEL,
  DAY_STATUS_OPTIONS,
  mapAttendanceError,
  officeRowSchema,
  type OfficeRowValues,
} from "../schemas/attendance.schema";
import { BiometricImportPanel } from "./BiometricImportPanel";
import { type DayStatus, type OfficeAttendanceRow, type AttendanceRecord } from "../api/attendance";

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

  return (
    <div id="att-panel-OFFICE" role="tabpanel" aria-labelledby="att-tab-OFFICE">
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
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
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="office-table">
                <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Employee</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2">Check-in</th>
                    <th className="px-3 py-2">Check-out</th>
                    <th className="px-3 py-2">Day status</th>
                    <th className="px-3 py-2 text-right">Overtime (h)</th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {rows.map((r) => renderRow(r, draft[r.id], rowErrors[r.id] ?? {}, patch, canCapture))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && canCapture && (
            <div className="flex items-center justify-end border-t border-border px-3 py-3">
              <Button size="sm" onClick={saveAll} disabled={saveOffice.isPending} data-testid="office-save">
                {saveOffice.isPending ? "Saving…" : "Save attendance"}
              </Button>
            </div>
          )}
        </Card>

        <BiometricImportPanel />
      </div>
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
    <tr
      key={r.id}
      className="border-b border-muted"
      data-testid="office-row"
      data-source={r.source}
    >
      <td className="px-3 py-2">
        <div className="text-[12.5px] font-semibold text-foreground">{r.employeeId ?? "—"}</div>
      </td>
      <td className="px-3 py-2">
        <Badge tone={r.source === "BIOMETRIC_IMPORT" ? "info" : "neutral"} data-testid="office-source-badge">
          {r.source === "BIOMETRIC_IMPORT" ? "Biometric" : "Manual"}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <Input
          className="h-8 w-[100px]"
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
      </td>
      <td className="px-3 py-2">
        <Input
          className="h-8 w-[100px]"
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
      </td>
      <td className="px-3 py-2">
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
      </td>
      <td className="px-3 py-2 text-right">
        <Input
          className="h-8 w-[80px] text-right"
          value={v.overtimeHours ?? ""}
          onChange={(e) => patch(r.id, { overtimeHours: e.target.value })}
          placeholder="0"
          invalid={!!errs.overtimeHours}
          disabled={!canCapture}
          data-testid={`office-ot-${r.id}`}
        />
      </td>
    </tr>
  );
}
