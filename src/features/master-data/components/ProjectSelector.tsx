"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type Project } from "../types";

/**
 * Project picker (design file `Purposes.dc.html`; PM sees assigned projects only —
 * filtered by the server). A custom lime-dotted button-popover (not a native select)
 * matching the design: dot · project name (Bangla-safe) · caret, with an "Assigned
 * projects" menu that check-marks the current selection.
 */
export function ProjectSelector({
  projects,
  value,
  onChange,
  loading,
}: {
  projects: Project[];
  value: string | null;
  onChange: (id: string) => void;
  loading?: boolean;
}) {
  const selected = projects.find((p) => p.id === value) ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[10.5px]">
        Project <span className="text-destructive">*</span>
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={loading}
          data-testid="project-select"
          className={cn(
            "flex h-[38px] min-w-[240px] items-center gap-2.5 rounded-token border border-border-strong bg-surface px-3 text-left",
            "transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:shadow-focus",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
          aria-label="Select project"
        >
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-accent" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-foreground">
            {selected ? selected.name : loading ? "Loading projects…" : "Select a project…"}
          </span>
          <ChevronDown className="h-4 w-4 flex-none text-faint" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.4px] text-faint">
            Assigned projects
          </div>
          {projects.map((p) => {
            const isSelected = p.id === value;
            return (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => onChange(p.id)}
                className={cn("h-10 gap-2.5", isSelected && "bg-surface-2")}
                data-testid={`project-option-${p.id}`}
              >
                <span className="h-[7px] w-[7px] flex-none rounded-full bg-accent" aria-hidden />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px] text-foreground",
                    isSelected ? "font-semibold" : "font-medium",
                  )}
                >
                  {p.name}
                </span>
                {isSelected && <Check className="h-4 w-4 flex-none text-accent-ink" aria-hidden />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
