import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";

/**
 * Attendance-device API bindings (`/api/attendance/devices`).
 *
 * The registry that maps a fingerprint device's SERIAL to a company. Push ingestion
 * (`/iclock/cdata`) resolves the tenant from the device's `?SN=`; an unregistered serial has its
 * punches dropped silently, so registering the device here is what makes push work at all.
 *
 * Backend answers `{ data }` (NoEnvelope) — unwrapped here. State-changing calls echo the CSRF
 * token (skill §4).
 */

const BASE = "/attendance/devices";

interface Envelope<T> {
  data: T;
}

export interface AttendanceDevice {
  id: string;
  deviceSn: string;
  label: string | null;
  defaultProjectId: string | null;
  /** Resolved server-side so the list needs no second lookup. */
  defaultProjectName: string | null;
  isActive: boolean;
  /** Stamped by every device handshake/poll — the liveness signal. */
  lastSeenAt: string | null;
  createdAt: string;
}

export interface CreateAttendanceDeviceInput {
  deviceSn: string;
  label?: string | null;
  defaultProjectId?: string | null;
}

/** All keys optional — an omitted key leaves the column untouched, `null` clears it. */
export interface UpdateAttendanceDeviceInput {
  label?: string | null;
  defaultProjectId?: string | null;
  isActive?: boolean;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export async function listAttendanceDevices(): Promise<AttendanceDevice[]> {
  const res = await apiClient.get<Envelope<AttendanceDevice[]>>(BASE);
  return res.data ?? [];
}

export async function createAttendanceDevice(
  input: CreateAttendanceDeviceInput,
): Promise<AttendanceDevice> {
  const res = await apiClient.post<Envelope<AttendanceDevice>>(BASE, input, csrf());
  return res.data;
}

/** PATCH, not PUT — `deviceSn` is immutable once punches reference it. */
export async function updateAttendanceDevice(
  id: string,
  input: UpdateAttendanceDeviceInput,
): Promise<AttendanceDevice> {
  const res = await apiClient.patch<Envelope<AttendanceDevice>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/** Refused by the backend once punches exist — deactivate instead. */
export async function deleteAttendanceDevice(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`, csrf());
}
