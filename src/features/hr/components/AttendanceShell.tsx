"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { formatDate, parseDate } from "@/lib/format";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { AttendanceModeTabs } from "./AttendanceModeTabs";
import { AttendanceFilterBar, type AttendanceFilter } from "./AttendanceFilterBar";
import { DailyLabourGrid } from "./DailyLabourGrid";
import { OfficeRosterGrid } from "./OfficeRosterGrid";
import { SubcontractorGrid } from "./SubcontractorGrid";
import { useProjectOptions } from "../hooks/useProjectOptions";
import {
  listCostCentreOptions,
  listPurposeOptions,
  listSubcontractorPartyOptions,
} from "../api/masters";
import { canCaptureAttendance, canConfirmAttendance } from "../access";
import { type AttendanceMode } from "../api/attendance";

/**
 * `/hr/attendance` shell (spec §4). Renders the breadcrumb, mode tabs, filter bar, and
 * the panel for the active mode. Default mode = OFFICE; the last-used mode persists to
 * `localStorage`. Shared masters (projects · cost centres · subcontractor parties) are
 * fetched here once and passed down so the three panels avoid duplicate hits.
 *
 * Access gating (spec §11):
 * - PM/Store Keeper: the module guard already blocks the route.
 * - Site Engineer: sees all three modes; Confirm/Reverse are hidden inside DailyLabourGrid.
 * - HR Manager / Admin / Accounts: full read/write; HR/Accounts/Admin can Confirm/Reverse.
 */
export function AttendanceShell() {
  const user = useAuthenticatedUser();
  const canCapture = canCaptureAttendance(user);
  const canConfirm = canConfirmAttendance(user);
  const [mode, setMode] = useState<AttendanceMode>("OFFICE");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("hr.attendance.mode");
      if (saved === "OFFICE" || saved === "DAILY_LABOUR" || saved === "SUBCONTRACTOR") {
        setMode(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("hr.attendance.mode", mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const [filter, setFilter] = useState<AttendanceFilter>(() => ({
    date: formatDate(new Date()),
    projectId: "",
    costCentreId: "",
  }));

  const projectsQ = useProjectOptions();
  const projects = projectsQ.data ?? [];

  const costCentresQ = useQuery({
    queryKey: ["hr", "cost-centre-options"],
    queryFn: listCostCentreOptions,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const costCentres = costCentresQ.data ?? [];

  const partiesQ = useQuery({
    queryKey: ["hr", "subcontractor-party-options"],
    queryFn: listSubcontractorPartyOptions,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const parties = partiesQ.data ?? [];

  const purposesQ = useQuery({
    queryKey: ["hr", "purposes", filter.projectId],
    queryFn: () => listPurposeOptions(filter.projectId),
    enabled: !!filter.projectId,
    staleTime: 60 * 1000,
    retry: 1,
  });
  const purposes = purposesQ.data ?? [];

  const isoDate = useMemo(() => {
    try {
      const d = parseDate(filter.date);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    } catch {
      return "";
    }
  }, [filter.date]);

  return (
    <div className="mx-auto max-w-6xl" data-testid="attendance-shell">
      <Breadcrumb items={[{ label: "HR" }, { label: "Attendance" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="attendance-title">
          Attendance
        </h1>
        <div className="ml-auto">
          <AttendanceModeTabs active={mode} onChange={setMode} />
        </div>
      </div>

      {!canCapture && (
        <p className="mb-2 text-[12px] text-muted-foreground" data-testid="attendance-readonly-note">
          You have read-only access to attendance.
        </p>
      )}
      {canCapture && !canConfirm && mode === "DAILY_LABOUR" && (
        <p className="mb-2 text-[12px] text-muted-foreground" data-testid="attendance-noconfirm-note">
          You can capture head count, but HR Manager or Accounts must Confirm the accrual.
        </p>
      )}

      <AttendanceFilterBar
        filter={filter}
        onChange={setFilter}
        projects={projects}
        costCentres={costCentres}
      />

      {mode === "OFFICE" && <OfficeRosterGrid date={isoDate} projectId={filter.projectId} />}
      {mode === "DAILY_LABOUR" && (
        <DailyLabourGrid
          date={isoDate}
          projectId={filter.projectId}
          costCentreId={filter.costCentreId}
          projects={projects}
          costCentres={costCentres}
          purposeOptions={purposes}
          isLoadingMasters={costCentresQ.isLoading || projectsQ.isLoading}
        />
      )}
      {mode === "SUBCONTRACTOR" && (
        <SubcontractorGrid
          date={isoDate}
          projectId={filter.projectId}
          costCentreId={filter.costCentreId}
          projects={projects}
          costCentres={costCentres}
          parties={parties}
          isLoadingMasters={costCentresQ.isLoading || projectsQ.isLoading || partiesQ.isLoading}
        />
      )}
    </div>
  );
}
