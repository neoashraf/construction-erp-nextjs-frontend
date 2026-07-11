/**
 * Over-budget alerts filter (spec §5/§7). A QUERY selection, not a writing form — this
 * screen is alerts-only by design: the status chips cover ONLY `OVER`/`APPROACHING`
 * (never `OK`/`UNBUDGETED` — those are structurally absent, FR-CC-015). Unchecking both
 * chips is a meaningless query and is blocked client-side with the exact spec §8 message.
 */

export const ALERT_STATUSES = ["OVER", "APPROACHING"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  OVER: "Over",
  APPROACHING: "Approaching",
};

/** Serialise the chip selection into the API's csv `status` — omit when both are on (API default). */
export function alertStatusToApi(status: readonly AlertStatus[]): string | undefined {
  return status.length > 0 && status.length < ALERT_STATUSES.length ? status.join(",") : undefined;
}
