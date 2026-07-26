"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useSaveWeeklyOffDays, useWeeklyOffDays } from "../hooks/useHolidays";
import { WEEKDAY_ORDER, sameWeekdaySet } from "../lib/holiday-types";

/**
 * Company-wide weekly off-days.
 *
 * Toggles render Monday-first (the Bangladeshi working week) but carry JS weekday values,
 * so display order and wire value never have to agree — see `WEEKDAY_ORDER`.
 *
 * Save stays disabled until the selection actually differs from what was last saved,
 * compared order-insensitively: re-selecting the same days in a different order is not a
 * change, and offering Save for it invites a pointless write that invalidates the whole
 * attendance cache.
 */
export function WeeklyOffDaysPanel() {
  const { toast } = useToast();
  const query = useWeeklyOffDays();
  const save = useSaveWeeklyOffDays();

  const [selected, setSelected] = useState<number[]>([]);
  const [savedSet, setSavedSet] = useState<number[]>([]);

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

  function handleSave() {
    save.mutate(selected, {
      onSuccess: (result) => {
        setSavedSet(result.weekdays ?? selected);
        toast("Weekly off-days saved", "success");
      },
      onError: (error) => {
        toast(error instanceof ApiError ? error.message : "Could not save off-days", "error");
      },
    });
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-0.5">
        <CardTitle>Weekly off-days</CardTitle>
        <CardDescription>
          Days marked off are excluded from working-day and attendance calculations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex gap-2" role="status" aria-live="polite">
            <span className="sr-only">Loading weekly off-days</span>
            {WEEKDAY_ORDER.map((day) => (
              <Skeleton key={day.value} className="h-9 w-[68px]" />
            ))}
          </div>
        ) : query.isError ? (
          <p role="alert" className="text-[12.5px] text-destructive-ink">
            {query.error instanceof ApiError ? query.error.message : "Could not load off-days"}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Weekly off-days">
              {WEEKDAY_ORDER.map((day) => {
                const active = selected.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={active}
                    aria-label={day.label}
                    disabled={save.isPending}
                    onClick={() => toggle(day.value)}
                    className={cn(
                      "h-9 min-w-[68px] rounded-token border px-3 text-[12.5px] font-semibold transition-colors",
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
              <Button size="sm" onClick={handleSave} disabled={!dirty || save.isPending}>
                {save.isPending ? "Saving…" : "Save off-days"}
              </Button>
              <span className="text-[11.5px] text-muted-foreground">
                {selected.length} day{selected.length === 1 ? "" : "s"} per week
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
