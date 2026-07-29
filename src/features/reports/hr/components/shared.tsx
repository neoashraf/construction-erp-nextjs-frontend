"use client";

import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingBody({ testid, rows = 8 }: { testid: string; rows?: number }) {
  return (
    <div className="p-6" data-testid={testid}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-8 w-full" />
      ))}
    </div>
  );
}
export function ErrorBody({ title, onRetry, testid, retryTestid }: { title: string; onRetry: () => void; testid: string; retryTestid: string }) {
  return (
    <div className="p-8" data-testid={testid}>
      <EmptyState
        icon={AlertCircle}
        title={title}
        description="Your parameters are preserved — try Run again."
        action={
          <Button size="md" onClick={onRetry} data-testid={retryTestid}>
            Retry
          </Button>
        }
      />
    </div>
  );
}
export function IdleBody({ testid }: { testid: string }) {
  return (
    <div className="p-8" data-testid={testid}>
      <EmptyState icon={Inbox} title="Set parameters and select Run." />
    </div>
  );
}
export function EmptyBody({ label, testid }: { label: string; testid: string }) {
  return (
    <div className="p-8" data-testid={testid}>
      <EmptyState icon={Inbox} title={label} />
    </div>
  );
}
export function NameUnavailable({ id }: { id: string }) {
  return (
    <span className="text-muted-foreground" data-testid="hr-name-unavailable">
      {id}
      <span className="ml-1 text-[10.5px] italic">(name unavailable)</span>
    </span>
  );
}
export function InactiveTag() {
  return <span className="ml-1 text-[10.5px] italic text-muted-foreground">(inactive)</span>;
}
export function ddMmYyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/* ------------------------------------------------------------------ *
 * FE-66 — attendance cells shared by the Summary / Range / Daily bodies.
 * ------------------------------------------------------------------ */

/**
 * The **Attendance %** cell — the server's `attendancePercentage`, rendered
 * verbatim with the comp's bar meter beneath it.
 *
 * The FE performs **no division**: the figure is attended ÷ working days with
 * holidays EXCLUDED from the denominator (so a full working month reads 100%,
 * not 84%) — the same definition FR-HR-013a deducts pay against, which is why
 * this report and the salary sheet can never disagree about a month. Where the
 * endpoint doesn't serve it the caller omits the column entirely rather than
 * fabricating a number.
 */
export function AttendancePercentCell({ value }: { value: number }) {
  // Colour is a redundant cue only — the number itself is always the signal.
  const tone =
    value >= 95 ? "text-success-ink" : value >= 85 ? "text-foreground" : "text-destructive";
  const bar =
    value >= 95 ? "bg-success" : value >= 85 ? "bg-accent" : "bg-destructive";
  return (
    <div className="flex flex-col items-end gap-1" data-testid="hr-att-percent">
      <span className={`text-[13px] font-bold tabular-nums ${tone}`}>{value}%</span>
      {/* The meter narrows with the viewport so it can never be what pushes the
          column off-screen — the figure is the signal, the bar is the garnish. */}
      <span
        className="h-1 w-[44px] overflow-hidden rounded-pill bg-muted lg:w-[72px]"
        aria-hidden
      >
        <span
          className={`block h-full rounded-pill ${bar}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </span>
    </div>
  );
}

/**
 * The derived day status as a pill + dot — **text, never colour alone** (spec
 * §10), so a "Late" day and an "Absent" day stay distinguishable without colour
 * perception. The vocabulary is the server's six exact title-case strings; an
 * unlisted value renders neutrally rather than being dropped.
 */
export function AttendanceStatusPill({ status }: { status: string }) {
  const tone = (() => {
    switch (status) {
      case "Present": return { dot: "bg-success", cls: "bg-success-soft text-success-ink" };
      case "Late": return { dot: "bg-warning", cls: "bg-warning-soft text-warning-ink" };
      case "Absent": return { dot: "bg-destructive", cls: "bg-destructive-soft text-destructive-ink" };
      case "Paid leave": return { dot: "bg-info", cls: "bg-info-soft text-info-ink" };
      case "Unpaid leave": return { dot: "bg-muted-foreground", cls: "bg-muted text-muted-foreground" };
      default: return { dot: "bg-muted-foreground", cls: "bg-muted text-muted-foreground" };
    }
  })();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${tone.cls}`}
      data-testid="hr-att-status"
    >
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${tone.dot}`} aria-hidden />
      {status}
    </span>
  );
}

/** Machine / Import / Manual — how the day reached us, not where it happened. */
export function AttendanceSourceBadge({ label }: { label: string | null }) {
  if (!label) {
    return (
      <span className="text-muted-foreground" data-testid="hr-att-source">
        —
      </span>
    );
  }
  const cls =
    label === "Manual"
      ? "bg-warning-soft text-warning-ink"
      : label === "Import"
        ? "bg-info-soft text-info-ink"
        : "bg-muted text-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-semibold ${cls}`}
      data-testid="hr-att-source"
    >
      {label}
    </span>
  );
}
