"use client";

import { forwardRef, useMemo, useState } from "react";
import { Search, X as XIcon, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { type ProjectOption } from "../types";

/**
 * The searchable add-projects picker (spec §5/§9/§10) — a combobox over this
 * company's projects (MAS lookup, via the AUD-local `project-options` binding).
 * Selecting a row toggles it in the pending set; already-assigned rows show
 * "Assigned". Announces result + selection counts to screen readers (spec §10).
 */
export const AddProjectsPicker = forwardRef<
  HTMLInputElement,
  {
    options: ProjectOption[];
    selectedIds: string[];
    disabled: boolean;
    onToggle: (projectId: string) => void;
  }
>(function AddProjectsPicker({ options, selectedIds, disabled, onToggle }, ref) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (p) => p.name.toLowerCase().includes(q) || p.projectCode.toLowerCase().includes(q),
    );
  }, [search, options]);

  const selectedSet = new Set(selectedIds);
  const announce = `${filtered.length} ${filtered.length === 1 ? "project" : "projects"} found · ${selectedIds.length} selected`;

  return (
    <Card
      className="flex max-h-[560px] min-w-0 flex-col"
      role="combobox"
      aria-expanded="true"
      aria-owns="add-projects-listbox"
      data-testid="add-projects-picker"
    >
      <div className="flex-none border-b border-border px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-[13.5px] font-bold text-foreground">Add projects</span>
          <span className="text-[11px] text-faint">Project (MAS) · this company</span>
        </div>
        <div className="fld mt-2.5 flex h-[38px] items-center gap-2 rounded-token border border-border-strong bg-background px-2.5 focus-within:border-accent focus-within:shadow-focus">
          <Search className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />
          <input
            ref={ref}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
            placeholder="Search projects by name or code"
            aria-label="Search projects by name or code"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-faint"
            data-testid="add-projects-search"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="flex-none text-faint hover:text-foreground"
              aria-label="Clear search"
            >
              <XIcon className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        <div
          aria-live="polite"
          className="mt-2 text-[11.5px] text-muted-foreground"
          data-testid="picker-announce"
        >
          {announce}
        </div>
      </div>

      <div
        id="add-projects-listbox"
        role="listbox"
        aria-label="Projects"
        className="min-h-0 flex-1 overflow-auto p-1.5"
      >
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center px-5 py-9 text-center"
            data-testid="picker-empty"
          >
            <div className="grid h-[42px] w-[42px] place-items-center rounded-full bg-muted text-faint">
              <Search className="h-4 w-4" aria-hidden />
            </div>
            <p className="mt-3 text-[13.5px] font-semibold text-foreground">No projects found.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different name or project code.
            </p>
          </div>
        ) : (
          filtered.map((p) => {
            const selected = selectedSet.has(p.id);
            return (
              <div
                key={p.id}
                role="option"
                aria-selected={selected}
                tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && onToggle(p.id)}
                onKeyDown={(e) => {
                  if (disabled) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(p.id);
                  }
                }}
                className={`flex cursor-pointer items-center gap-2.5 rounded-token px-2.5 py-2 outline-none hover:bg-surface-2 ${
                  selected ? "bg-accent-soft" : ""
                } ${disabled ? "pointer-events-none opacity-60" : ""}`}
                data-testid={`picker-option-${p.id}`}
              >
                <span
                  className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-sm border ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong bg-background"
                  }`}
                  aria-hidden
                >
                  {selected ? <Check className="h-3 w-3" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate whitespace-normal break-words text-[13px] text-foreground ${selected ? "font-semibold" : "font-medium"}`}
                    title={p.name}
                  >
                    {p.name}
                  </div>
                  <div className="truncate font-mono text-[10.5px] text-faint">{p.projectCode}</div>
                </div>
                {selected ? (
                  <span className="flex-none text-[10.5px] font-semibold text-success-ink">
                    Assigned
                  </span>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
});
