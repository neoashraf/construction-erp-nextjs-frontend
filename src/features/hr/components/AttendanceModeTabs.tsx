"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { type AttendanceMode } from "../api/attendance";

/**
 * `role="tablist"` mode switcher (spec §4/§10). Three tabs — Office / Daily labour /
 * Subcontractor — with arrow-key navigation. The active tab controls the visible mode
 * panel in `AttendanceShell`. Every tab carries `role="tab"` + `aria-controls`; the
 * corresponding panel is `role="tabpanel"` inside the shell.
 */
export interface ModeTab {
  key: AttendanceMode;
  label: string;
}

export const ATTENDANCE_MODE_TABS: readonly ModeTab[] = [
  { key: "OFFICE", label: "Office staff" },
  { key: "DAILY_LABOUR", label: "Daily labour" },
  { key: "SUBCONTRACTOR", label: "Subcontractor" },
];

export function AttendanceModeTabs({
  active,
  onChange,
}: {
  active: AttendanceMode;
  onChange: (m: AttendanceMode) => void;
}) {
  const refs = useRef<Record<AttendanceMode, HTMLButtonElement | null>>({
    OFFICE: null,
    DAILY_LABOUR: null,
    SUBCONTRACTOR: null,
  });

  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const total = ATTENDANCE_MODE_TABS.length;
      let next = index;
      if (e.key === "ArrowLeft") next = (index - 1 + total) % total;
      else if (e.key === "ArrowRight") next = (index + 1) % total;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = total - 1;
      const t = ATTENDANCE_MODE_TABS[next]!;
      onChange(t.key);
      refs.current[t.key]?.focus();
    },
    [onChange],
  );

  return (
    <div
      role="tablist"
      aria-label="Attendance mode"
      className="inline-flex items-center gap-1 rounded-token border border-border bg-surface p-1"
      data-testid="attendance-tabs"
    >
      {ATTENDANCE_MODE_TABS.map((t, i) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[t.key] = el;
            }}
            type="button"
            role="tab"
            id={`att-tab-${t.key}`}
            aria-selected={isActive}
            aria-controls={`att-panel-${t.key}`}
            tabIndex={isActive ? 0 : -1}
            data-testid={`attendance-tab-${t.key}`}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "inline-flex h-9 min-w-[110px] items-center justify-center rounded-token px-3 text-[13px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
