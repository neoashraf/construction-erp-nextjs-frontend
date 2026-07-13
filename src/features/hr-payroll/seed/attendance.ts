/**
 * Local seed for the Attendance screen — the fictional 11/07/2026 capture rows from
 * `Attendance.dc.html` across the three modes (office · daily labour · subcontractor),
 * typed for the screen's working state. Daily labour is the only mode that touches the
 * ledger (Dr Labour Cost / Cr Labour Payable at Confirm). Realistic but fictional.
 */

import { type DayStatus } from "../types";

export const ATTENDANCE_DATE = "2026-07-11";
export const DEFAULT_PROJECT = "Bridge-04 — Buriganga";
export const PURPOSES = ["Civil works", "Shuttering & formwork", "Site development"];

/** A daily-labour capture row. `confirmedEntryNo` set → locked (posted accrual). */
export interface DailyLabourRow {
  id: string;
  costCentre: string;
  category: string;
  purpose: string | null;
  headCount: number;
  /** Daily rate as an integer taka amount (kept simple for the stepper mockup). */
  rate: number;
  confirmedEntryNo?: string;
  reversedEntryNo?: string;
}

export const DAILY_LABOUR_SEED: DailyLabourRow[] = [
  { id: "r1", costCentre: "CC-02 · Piling", category: "রাজমিস্ত্রি (Mason)", purpose: "Civil works", headCount: 18, rate: 950 },
  { id: "r2", costCentre: "CC-02 · Piling", category: "Helper", purpose: null, headCount: 24, rate: 650 },
  { id: "r3", costCentre: "CC-05 · Deck girder", category: "রড মিস্ত্রি (Rod binder)", purpose: "Civil works", headCount: 12, rate: 850 },
  { id: "r4", costCentre: "CC-05 · Deck girder", category: "Carpenter", purpose: "Shuttering & formwork", headCount: 8, rate: 900 },
  { id: "c1", costCentre: "CC-02 · Piling", category: "Mason", purpose: "Civil works", headCount: 20, rate: 950, confirmedEntryNo: "JV-2026-000418" },
  { id: "c2", costCentre: "CC-01 · Earthwork", category: "Helper", purpose: "Site development", headCount: 15, rate: 600, confirmedEntryNo: "JV-2026-000395", reversedEntryNo: "JV-2026-000402" },
];

/** An office-staff roster row (manual or biometric source). */
export interface OfficeRow {
  employeeCode: string;
  name: string;
  checkIn: string | null;
  checkOut: string | null;
  dayStatus: DayStatus;
  overtimeHours: string;
  source: "MANUAL" | "BIOMETRIC_IMPORT";
}

export const OFFICE_SEED: OfficeRow[] = [
  { employeeCode: "EMP-0001", name: "Ashraf Uddin", checkIn: "08:30", checkOut: "17:45", dayStatus: "PRESENT", overtimeHours: "1.5", source: "MANUAL" },
  { employeeCode: "EMP-0002", name: "ফারজানা আক্তার", checkIn: "09:02", checkOut: "18:10", dayStatus: "PRESENT", overtimeHours: "0.0", source: "BIOMETRIC_IMPORT" },
  { employeeCode: "EMP-0003", name: "Mohammad Hasan", checkIn: null, checkOut: null, dayStatus: "PAID_LEAVE", overtimeHours: "0.0", source: "MANUAL" },
  { employeeCode: "EMP-0004", name: "Imran Chowdhury", checkIn: "08:15", checkOut: "17:30", dayStatus: "PRESENT", overtimeHours: "0.0", source: "BIOMETRIC_IMPORT" },
  { employeeCode: "EMP-0006", name: "রুবেল মিয়া", checkIn: null, checkOut: null, dayStatus: "ABSENT", overtimeHours: "0.0", source: "MANUAL" },
  { employeeCode: "EMP-0007", name: "Kamrul Islam", checkIn: "08:40", checkOut: "19:05", dayStatus: "PRESENT", overtimeHours: "2.0", source: "MANUAL" },
];

/** A subcontractor head-count row (tracking only — never posts). */
export interface SubcontractorRow {
  id: string;
  partyCode: string;
  partyName: string;
  costCentre: string;
  purpose: string | null;
  headCount: number;
}

export const SUBCONTRACTOR_SEED: SubcontractorRow[] = [
  { id: "s1", partyCode: "PTY-0031", partyName: "M/s Rahman Traders", costCentre: "CC-02 · Piling", purpose: "Civil works", headCount: 35 },
  { id: "s2", partyCode: "PTY-0044", partyName: "Meghna Steel Erectors", costCentre: "CC-05 · Deck girder", purpose: null, headCount: 22 },
  { id: "s3", partyCode: "PTY-0052", partyName: "নিউ যমুনা কনস্ট্রাকশন", costCentre: "CC-01 · Earthwork", purpose: "Site development", headCount: 40 },
];

export const DAY_STATUS_META: Record<
  DayStatus,
  { label: string; tone: "success" | "info" | "warning" | "destructive" }
> = {
  PRESENT: { label: "Present", tone: "success" },
  PAID_LEAVE: { label: "Paid leave", tone: "info" },
  UNPAID_LEAVE: { label: "Unpaid leave", tone: "warning" },
  ABSENT: { label: "Absent", tone: "destructive" },
};
