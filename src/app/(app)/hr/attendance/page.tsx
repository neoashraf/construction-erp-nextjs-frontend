import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { AttendanceShell } from "@/features/hr/components/AttendanceShell";

/**
 * `/hr/attendance` — the three-mode attendance screen (FR-HR-004…-012, -018).
 *
 * Office staff · Daily labour · Subcontractor on one shell. **Daily labour is the only mode
 * that touches the ledger** — its per-row Confirm posts a Dr Labour Cost / Cr Labour Payable
 * accrual through `PostingService`, and corrections are reverse-and-repost.
 *
 * Inside Office staff the period control selects the view: a single date renders the editable
 * roster; a range or month renders the read-only logs & summary. That review view used to be a
 * separate shell mounted here (`AttendanceLogsShell`), which left the three-mode capture screen
 * — including the ledger-posting Confirm — unreachable from the sidebar. FE-64 merged the two.
 *
 * The module guard redirects roles without HR access to /403; the backend re-checks every
 * call regardless.
 */
export default async function HrAttendancePage() {
  await requireModuleAccess("hr");
  return (
    <div className="mx-auto max-w-6xl">
      <AttendanceShell />
    </div>
  );
}
