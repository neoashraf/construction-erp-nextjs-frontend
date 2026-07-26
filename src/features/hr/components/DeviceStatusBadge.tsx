"use client";

import { Badge } from "@/components/ui/badge";
import { useDeviceStatus } from "../hooks/useAttendanceLogs";

/**
 * Live device heartbeat chip. The poll lives in `useDeviceStatus`; any error is treated as
 * Offline rather than surfaced as an error state — a failed heartbeat *is* the answer, and
 * an error banner for it would be noise beside the working table.
 */
export function DeviceStatusBadge() {
  const { data, isLoading, isError } = useDeviceStatus();

  if (isLoading) {
    return (
      <Badge tone="neutral" dot data-testid="device-status">
        Checking
      </Badge>
    );
  }

  const online = !isError && data?.online === true;
  return (
    <Badge
      tone={online ? "success" : "destructive"}
      dot
      data-testid="device-status"
      title={
        data?.lastSeenAt
          ? `Device last seen ${new Date(data.lastSeenAt).toLocaleString()}`
          : "No device contact recorded"
      }
    >
      {online ? "Live" : "Offline"}
    </Badge>
  );
}
