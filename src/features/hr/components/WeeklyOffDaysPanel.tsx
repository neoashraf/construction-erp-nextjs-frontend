"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useSaveWeeklyOffDays, useWeeklyOffDays } from "../hooks/useHolidays";
import { WEEKDAY_ORDER, sameWeekdaySet } from "../lib/holiday-types";

/**
 * Company-wide weekly off-days (FR-HR-008d) — a direct payroll input under FR-HR-013a.
 *
 * Toggles render Monday-first (display order is separate from the JS weekday values — see
 * `WEEKDAY_ORDER`). Save stays disabled until the selection differs from what was last
 * saved, compared order-insensitively.
 *
 * `PUT /api/holidays/weekly` is a FULL REPLACE, so the destructive cases are confirmed
 * before the request fires: removing a weekday, and clearing all of them, each raise a
 * dialog stating the consequence in working-day terms. On success the panel re-seeds from
 * the server's NORMALISED response, never from what it sent — a value the server dropped
 * must become visible as a toggle that did not stay on.
 *
 * A weekly load failure renders NO toggles (an empty toggle row is indistinguishable from
 * "no off-days configured", a real and different state); zero saved off-days renders a
 * persistent `role="alert"` — the standing condition a freshly-seeded company starts in.
 */
export function WeeklyOffDaysPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { toast } = useToast();
  const query = useWeeklyOffDays();
  const save = useSaveWeeklyOffDays();

  const [selected, setSelected] = useState<number[]>([]);
  const [savedSet, setSavedSet] = useState<number[]>([]);
  const [confirming, setConfirming] = useState<null | { kind: "remove"; removed: number[] } | { kind: "clear" }>(null);

  // Seed local state once the server value arrives (and after any external refetch).
  useEffect(() => {
    if (query.data) {
      setSelected(query.data.weekdays ?? []);
      setSavedSet(query.data.weekdays ?? []);
    }
  }, [query.data]);

  function toggle(value: number) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  const dirty = !sameWeekdaySet(selected, savedSet);
  const loaded = !query.isLoading && !query.isError;

  function commitSave() {
    setConfirming(null);
    save.mutate(selected, {
      onSuccess: (result) => {
        // Re-seed BOTH sets from the normalised response — a value the server dropped
        // shows up as a toggle that did not stay on, not a silently-assumed store.
        setSavedSet(result.weekdays ?? []);
        setSelected(result.weekdays ?? []);
        toast("Weekly off-days saved.", "success");
      },
      onError: (error) => {
        // The local selection is kept and Save stays enabled — the user must not re-pick.
        toast(error instanceof ApiError ? error.message : "Couldn't save off-days.", "error");
      },
    });
  }

  function handleSave() {
    const removed = savedSet.filter((d) => !selected.includes(d));
    if (selected.length === 0 && savedSet.length > 0) {
      setConfirming({ kind: "clear" });
      return;
    }
    if (removed.length > 0) {
      setConfirming({ kind: "remove", removed });
      return;
    }
    commitSave();
  }

  const removedNames =
    confirming?.kind === "remove"
      ? confirming.removed
          .map((v) => WEEKDAY_ORDER.find((d) => d.value === v)?.label ?? "")
          .filter(Boolean)
      : [];
  const removedLabel = removedNames.join(", ");

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-0.5">
        <CardTitle>Weekly off-days</CardTitle>
        <CardDescription>
          Days marked off are excluded from working-day counts — and are paid days inside the
          monthly salary baseline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex flex-wrap gap-2" role="status" aria-live="polite">
            <span className="sr-only">Loading weekly off-days</span>
            {WEEKDAY_ORDER.map((day) => (
              <Skeleton key={day.value} className="h-11 w-[68px]" />
            ))}
          </div>
        ) : query.isError ? (
          // No toggles at all — an empty toggle row would read as "no off-days configured".
          <div role="alert" className="flex items-center gap-3">
            <p className="text-[12.5px] text-destructive-ink">Couldn&apos;t load weekly off-days.</p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {savedSet.length === 0 ? (
              <Alert
                tone="warning"
                className="mb-3"
                title="No weekly off-days are set — every day of the week counts as a working day."
                data-testid="zero-off-days-alert"
              >
                Attendance percentages and monthly salary are calculated against a 7-day week
                until this is set.
              </Alert>
            ) : null}

            <div
              className="grid grid-cols-4 gap-2 lg:flex lg:flex-wrap"
              role="group"
              aria-label="Weekly off-days"
            >
              {WEEKDAY_ORDER.map((day) => {
                const active = selected.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={active}
                    aria-label={day.label}
                    disabled={readOnly || save.isPending}
                    onClick={() => toggle(day.value)}
                    className={cn(
                      "h-11 min-w-[68px] rounded-token border px-3 text-[12.5px] font-semibold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:opacity-60",
                      active
                        ? "border-accent-border bg-accent-soft text-accent-ink"
                        : "border-border-strong bg-surface text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-3">
              {!readOnly ? (
                <Button size="sm" onClick={handleSave} disabled={!dirty || save.isPending}>
                  {save.isPending ? "Saving…" : "Save off-days"}
                </Button>
              ) : null}
              <span className="text-[11.5px] text-muted-foreground">
                {selected.length} day{selected.length === 1 ? "" : "s"} per week
              </span>
            </div>

            <div className="mt-3 border-t border-border pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <p>
                Saving replaces the whole list. A weekday you unselect stops being a holiday
                everywhere, including in months already reported.
              </p>
              <p>
                Weekly off-days apply to every year — the year selector below only filters the
                dated calendar.
              </p>
            </div>
          </>
        )}
      </CardContent>

      {loaded && confirming ? (
        <Dialog open onOpenChange={(next) => !next && setConfirming(null)}>
          <DialogContent hideClose>
            <DialogTitle>
              {confirming.kind === "clear"
                ? "Clear every weekly off-day?"
                : `Remove ${removedLabel} as a weekly off-day?`}
            </DialogTitle>
            <DialogDescription className="mt-2">
              {confirming.kind === "clear"
                ? "Every day of the week will count as a working day. Attendance percentages and monthly salary will be calculated against a 7-day week."
                : `${removedLabel} will count as a working day from now on, in every month — including months already reported. Employees with no attendance record on those days will be counted as unpaid.`}
            </DialogDescription>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={commitSave}>
                {confirming.kind === "clear" ? "Clear all off-days" : "Remove off-day"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}
