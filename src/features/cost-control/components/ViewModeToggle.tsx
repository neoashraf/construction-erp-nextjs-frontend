import { cn } from "@/lib/utils";
import { type ViewMode } from "../types";

/**
 * "By project" / "By cost centre" segmented control (FR-CC-008; spec §3/§10). A proper
 * `role="radiogroup"`; switching mode swaps the grouping column and clears the now-invalid
 * fixed filter (handled by the screen). Shared with the CC sibling screens.
 */
const MODES: { value: ViewMode; label: string }[] = [
  { value: "project", label: "By project" },
  { value: "cost_centre", label: "By cost centre" },
];

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className="inline-flex rounded-token bg-muted p-0.5"
      data-testid="bva-view-mode"
    >
      {MODES.map((m) => {
        const active = m.value === value;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m.value)}
            data-testid={`bva-mode-${m.value}`}
            className={cn(
              "h-8 rounded-[6px] px-3 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:shadow-focus",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
