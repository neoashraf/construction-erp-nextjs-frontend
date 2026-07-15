"use client";

import { Badge } from "@/components/ui/badge";
import { type AgeingBucket } from "../types";

/**
 * FE-57 IPC ageing badge (FR-RPT-017, spec §8). Label + colour, never colour
 * alone — WCAG 1.4.1. Buckets → design-system tones so an ageing pill is
 * indistinguishable from any other status pill on shape/spacing.
 */
const LABEL: Record<AgeingBucket, string> = {
  CURRENT: "Current",
  D31_60: "31–60 days",
  D61_90: "61–90 days",
  D90_PLUS: "90+ days",
};
const TONE: Record<AgeingBucket, React.ComponentProps<typeof Badge>["tone"]> = {
  CURRENT: "success",
  D31_60: "warning",
  D61_90: "warning",
  D90_PLUS: "destructive",
};

export function IpcAgeingBadge({ bucket }: { bucket: AgeingBucket }) {
  return (
    <Badge tone={TONE[bucket]} dot data-testid={`ipc-ageing-${bucket}`}>
      {LABEL[bucket]}
    </Badge>
  );
}
