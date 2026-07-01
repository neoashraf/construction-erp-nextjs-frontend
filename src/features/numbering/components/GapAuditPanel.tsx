"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useGapAudit } from "../hooks/useNumberingSeries";
import { type NumberingSeries, voucherTypeLabel } from "../types";

/**
 * Gap-audit panel (spec §6, FR-NUM-021). Read-only continuity diagnostics — lowest/
 * highest/committed/expected counts and a Continuous (green) vs Gap detected (alert)
 * status. Numbers are immutable, so there is deliberately NO fix/remediation control
 * (FR-NUM-018). Optional `asOf` (DD/MM/YYYY) bounds the report. The status is text-
 * labelled, not colour-only, and the alert carries `role="alert"` (spec §10).
 */
export function GapAuditPanel({ series }: { series: NumberingSeries }) {
  // `asOf` is optional; the value is passed straight to the API as an ISO date. The
  // input is left as a native date field so the browser handles locale entry; the
  // API takes ISO. Empty = "now" (default, spec §7).
  const [asOf, setAsOf] = useState<string>("");
  const query = useGapAudit(series.id, asOf || undefined, true);

  return (
    <div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-muted-foreground">
        Continuity check across committed numbers for this series. Read-only diagnostics
        — numbers are immutable, so there is no fix here.
      </p>

      <div className="max-w-[220px]">
        <Label htmlFor="gap-audit-asof">
          As of <span className="font-normal normal-case tracking-normal text-faint">(optional)</span>
        </Label>
        <Input
          id="gap-audit-asof"
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          className="mt-1.5 font-mono tabular-nums"
          data-testid="gap-audit-asof"
        />
      </div>

      <div className="mt-4">
        {query.isLoading ? (
          <div className="grid grid-cols-2 gap-3" data-testid="gap-audit-loading">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <Alert tone="destructive" title="Couldn't run the gap audit.">
            <div className="flex flex-col items-start gap-2">
              <span>Check your connection and try again.</span>
              <Button size="sm" onClick={() => query.refetch()} data-testid="gap-audit-retry">
                Retry
              </Button>
            </div>
          </Alert>
        ) : query.data ? (
          <GapAuditResult
            data={query.data}
            voucherTypeLabel={voucherTypeLabel(series.voucherType)}
          />
        ) : null}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-card border border-border p-3.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 font-mono text-xl font-semibold tabular-nums",
          emphasis ? "text-destructive-ink" : "text-foreground",
        )}
      >
        {value.toLocaleString("en-IN")}
      </div>
    </div>
  );
}

function GapAuditResult({
  data,
  voucherTypeLabel: typeLabel,
}: {
  data: import("../types").GapAudit;
  voucherTypeLabel: string;
}) {
  const gap = data.integrityAlert || !data.continuous;
  return (
    <div data-testid="gap-audit-result" aria-label={`Gap audit for ${typeLabel}`}>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Lowest sequence" value={data.lowestSequence} />
        <Metric label="Highest sequence" value={data.highestSequence} />
        <Metric label="Committed count" value={data.committedCount} emphasis={gap} />
        <Metric label="Expected count" value={data.expectedCount} />
      </div>
      <p className="mt-2 text-[11px] text-faint">
        Expected = highest − lowest + 1 = {data.highestSequence.toLocaleString("en-IN")} −{" "}
        {data.lowestSequence.toLocaleString("en-IN")} + 1 ={" "}
        {data.expectedCount.toLocaleString("en-IN")}.
      </p>

      {gap ? (
        <Alert
          tone="destructive"
          title="Gap detected."
          className="mt-4"
          data-testid="gap-audit-alert"
        >
          {data.committedCount.toLocaleString("en-IN")} committed but{" "}
          {data.expectedCount.toLocaleString("en-IN")} expected for sequence{" "}
          {data.lowestSequence.toLocaleString("en-IN")}–
          {data.highestSequence.toLocaleString("en-IN")}. This needs investigation —
          numbers can&rsquo;t be edited to fix it.
        </Alert>
      ) : (
        <Alert
          tone="success"
          title="Continuous — no gaps."
          className="mt-4"
          data-testid="gap-audit-continuous"
        >
          Committed {data.committedCount.toLocaleString("en-IN")} of{" "}
          {data.expectedCount.toLocaleString("en-IN")} expected (sequence{" "}
          {data.lowestSequence.toLocaleString("en-IN")}–
          {data.highestSequence.toLocaleString("en-IN")}).
        </Alert>
      )}
    </div>
  );
}
