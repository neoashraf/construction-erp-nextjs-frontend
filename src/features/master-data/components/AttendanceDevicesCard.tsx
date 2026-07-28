"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import {
  useAttendanceDevices,
  useCreateAttendanceDevice,
  useUpdateAttendanceDevice,
  useDeleteAttendanceDevice,
  useProjectOptions,
} from "../hooks/useAttendanceDevices";
import { type AttendanceDevice } from "../api/attendance-devices";

const HEADING_ID = "attendance-devices-heading";

/**
 * A device is considered LIVE if it checked in within this window. ZKTeco units poll
 * `/iclock/getrequest` every 30-60s, so two minutes is comfortably longer than one missed poll
 * but short enough that unplugging a device shows up quickly.
 */
const LIVE_WINDOW_MS = 2 * 60 * 1000;

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function isLive(device: AttendanceDevice): boolean {
  if (!device.isActive || !device.lastSeenAt) return false;
  const seen = new Date(device.lastSeenAt).getTime();
  return !Number.isNaN(seen) && Date.now() - seen < LIVE_WINDOW_MS;
}

/**
 * Attendance devices card — the serial→company registry, on the company-settings screen.
 *
 * WHY IT MATTERS: push ingestion (`/iclock/cdata`) resolves the tenant from the device's `?SN=`
 * serial. An unregistered serial has its punches DROPPED, and the device is still answered `OK`
 * (ZKTeco firmware retries forever on anything else), so nothing surfaces the loss — the punches
 * simply never appear. Registering the device here is what prevents that.
 *
 * NO COMPANY PICKER: a device registers to the company whose settings you are viewing. The
 * screen is single-company by design (Phase-1), and a picker would only add a way to file a
 * device under the wrong tenant.
 */
export function AttendanceDevicesCard({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const query = useAttendanceDevices();
  const { projects } = useProjectOptions();
  const create = useCreateAttendanceDevice();
  const update = useUpdateAttendanceDevice();
  const remove = useDeleteAttendanceDevice();

  const [adding, setAdding] = useState(false);
  const [deviceSn, setDeviceSn] = useState("");
  const [label, setLabel] = useState("");
  const [projectId, setProjectId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AttendanceDevice | null>(null);

  const devices = query.data ?? [];

  function resetForm() {
    setDeviceSn("");
    setLabel("");
    setProjectId("");
    setFormError(null);
  }

  function submit() {
    const serial = deviceSn.trim();
    if (!serial) {
      setFormError("Serial number is required");
      return;
    }
    setFormError(null);

    create.mutate(
      {
        deviceSn: serial,
        label: label.trim() || null,
        defaultProjectId: projectId || null,
      },
      {
        onSuccess: () => {
          toast("Device registered.", "success");
          setAdding(false);
          resetForm();
        },
        // The backend owns these messages (duplicate serial, cross-company project); showing
        // them verbatim is what tells an admin a serial is already claimed elsewhere.
        onError: (error) => setFormError(asApiError(error).message),
      },
    );
  }

  function toggleActive(device: AttendanceDevice) {
    update.mutate(
      { id: device.id, input: { isActive: !device.isActive } },
      {
        onSuccess: () =>
          toast(device.isActive ? "Device deactivated." : "Device activated.", "success"),
        onError: (error) => toast(asApiError(error).message, "error"),
      },
    );
  }

  function changeProject(device: AttendanceDevice, value: string) {
    update.mutate(
      { id: device.id, input: { defaultProjectId: value || null } },
      {
        onSuccess: () => toast("Default project updated.", "success"),
        onError: (error) => toast(asApiError(error).message, "error"),
      },
    );
  }

  function doDelete() {
    if (!confirmDelete) return;
    remove.mutate(confirmDelete.id, {
      onSuccess: () => {
        toast("Device removed.", "success");
        setConfirmDelete(null);
      },
      onError: (error) => {
        // Refused when punches exist — the message names the count and says to deactivate.
        toast(asApiError(error).message, "error");
        setConfirmDelete(null);
      },
    });
  }

  return (
    <Card role="region" aria-labelledby={HEADING_ID} data-testid="attendance-devices-card">
      <div className="flex items-start justify-between gap-4 border-b border-border px-[22px] py-[18px]">
        <div className="min-w-0">
          <h2 id={HEADING_ID} className="text-base font-semibold text-foreground">
            Attendance devices
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Fingerprint machines that send punches to this company. A device must be registered
            here before its punches are accepted.
          </p>
        </div>
        {canEdit && !adding && (
          <Button variant="outline" onClick={() => setAdding(true)}>
            Add device
          </Button>
        )}
      </div>

      <div className="px-[22px] py-[18px]">
        {query.isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {query.isError && (
          <Alert tone="destructive">
            Could not load devices.{" "}
            <button type="button" className="underline" onClick={() => query.refetch()}>
              Retry
            </button>
          </Alert>
        )}

        {/* Add form */}
        {adding && (
          <div className="mb-4 rounded-md border border-border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="device-sn">Serial number *</Label>
                <Input
                  id="device-sn"
                  value={deviceSn}
                  onChange={(e) => setDeviceSn(e.target.value)}
                  placeholder="QWC5242500055"
                  className="mt-1.5 font-mono"
                  autoFocus
                />
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  As printed on the device, or in its System Info menu.
                </p>
              </div>
              <div>
                <Label htmlFor="device-label">Label</Label>
                <Input
                  id="device-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Main gate"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="device-project">Default project</Label>
                <Select
                  id="device-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-1.5"
                >
                  <option value="">None — use each employee&apos;s own project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectCode} — {p.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  Only used for employees who have no project of their own.
                </p>
              </div>
            </div>

            {formError && (
              <div className="mt-3">
                <Alert tone="destructive">{formError}</Alert>
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Register device"}
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        {!query.isLoading && !query.isError && devices.length === 0 && !adding && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">No devices registered yet.</p>
            <p className="mt-1 text-[12.5px] text-faint">
              Until a device is registered, punches it sends are discarded.
            </p>
          </div>
        )}

        {devices.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    Serial
                  </th>
                  <th className="pb-2 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    Label
                  </th>
                  <th className="pb-2 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    Default project
                  </th>
                  <th className="pb-2 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    Status
                  </th>
                  <th className="pb-2 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    Last seen
                  </th>
                  {canEdit && <th className="pb-2" />}
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-3 font-mono text-[13px]">{device.deviceSn}</td>
                    <td className="py-3 pr-3">{device.label || "—"}</td>
                    <td className="py-3 pr-3">
                      {canEdit ? (
                        <Select
                          aria-label={`Default project for ${device.deviceSn}`}
                          value={device.defaultProjectId ?? ""}
                          onChange={(e) => changeProject(device, e.target.value)}
                          className="min-w-[190px]"
                        >
                          <option value="">None</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.projectCode} — {p.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        (device.defaultProjectName ?? "—")
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {!device.isActive ? (
                        <Badge tone="neutral">Inactive</Badge>
                      ) : isLive(device) ? (
                        <Badge tone="success" dot>
                          Live
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Idle</Badge>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">
                      {relativeTime(device.lastSeenAt)}
                    </td>
                    {canEdit && (
                      <td className="py-3 text-right whitespace-nowrap">
                        <Button variant="ghost" onClick={() => toggleActive(device)}>
                          {device.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirmDelete(device)}>
                          Remove
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogTitle>Remove device?</DialogTitle>
          <DialogDescription>
            {confirmDelete?.deviceSn} will stop being accepted. Punches already recorded are kept.
            If this device has any recorded punches the removal is refused — deactivate it instead.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={remove.isPending}>
              {remove.isPending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
