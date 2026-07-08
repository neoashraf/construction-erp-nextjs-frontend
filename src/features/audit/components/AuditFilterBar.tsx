"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AUDIT_ACTIONS, AUDIT_ACTION_TONE, type AuditAction, type AuditActionTone } from "../types";
import { EMPTY_AUDIT_LOG_FILTER, type AuditLogFilterFormValues } from "../schemas/audit-log-filter";

/**
 * Audit-log filter bar (screen spec §4/§7/§9; design file filter card). Filters
 * apply ON CHANGE, debounced (spec §9 "Filters apply on change (debounced)"); the
 * design's "Apply" button is present for visual parity and force-applies the draft
 * immediately (it does not gate the auto-apply). Actor/entity type/entity id/project
 * are free-text id inputs (master-data comboboxes are owned by MAS; this feature
 * never imports `features/master-data`, skill §2.4 — mirrors `TrialBalanceFilterBar`'s
 * established pattern). Action is a dropdown multi-select (design file — a collapsed
 * field showing the selected badge chips + a "+N" overflow, opening a checkbox menu).
 * Date range validates client-side (`dateTo < dateFrom` -> inline "End date must be
 * after start date.") and is not applied until valid.
 *
 * Layout matches the design's single dense row of FIVE fields — Actor · Action ·
 * Entity type · Date from · Date to — then the button cluster (Filters · Apply ·
 * Clear filters). Entity id + Project are the "advanced" filters: hidden by default
 * and revealed in an expandable panel toggled by the "Filters" button (design file).
 */

const DEBOUNCE_MS = 350;

/**
 * Filter micro-label, matched to the design file exactly: 10.5px / weight 600 /
 * 0.4px tracking / uppercase / muted (#697079). The shared `Label` primitive is a
 * hair larger (12px, wider tracking); overriding here keeps this bar pixel-true to
 * the mock without changing the app-wide primitive.
 */
const FILTER_LABEL = "text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground";

/** Per-action chip tones for the collapsed Action trigger (matches `ActionBadge`). */
const ACTION_CHIP: Record<AuditActionTone, string> = {
  positive: "bg-success-soft text-success-ink",
  info: "bg-info-soft text-info-ink",
  negative: "bg-destructive-soft text-destructive-ink",
  brand: "bg-accent-soft text-accent-ink",
  warning: "bg-warning-soft text-warning-ink",
};

export function AuditFilterBar({
  value,
  onChange,
  offline,
}: {
  value: AuditLogFilterFormValues;
  onChange: (next: AuditLogFilterFormValues) => void;
  offline: boolean;
}) {
  const [draft, setDraft] = useState<AuditLogFilterFormValues>(value);
  // Advanced filters (Entity id + Project) live behind the "Filters" toggle (design
  // file). Open it automatically if either arrives already set (e.g. a deep link).
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(
    () => !!value.entityId || !!value.projectId,
  );
  const advancedCount = (draft.entityId ? 1 : 0) + (draft.projectId ? 1 : 0);
  const dateError =
    draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo
      ? "End date must be after start date."
      : null;

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (dateError) return; // don't fire an invalid range
    if (offline) return;
    const t = setTimeout(() => {
      if (JSON.stringify(draft) !== JSON.stringify(value)) onChange(draft);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, offline]);

  function set<K extends keyof AuditLogFilterFormValues>(key: K, v: AuditLogFilterFormValues[K]) {
    setDraft((d) => ({ ...d, [key]: v }));
  }

  function toggleAction(action: AuditAction) {
    setDraft((d) => ({
      ...d,
      actions: d.actions.includes(action)
        ? d.actions.filter((a) => a !== action)
        : [...d.actions, action],
    }));
  }

  function clearAll() {
    setDraft(EMPTY_AUDIT_LOG_FILTER);
    onChange(EMPTY_AUDIT_LOG_FILTER);
  }

  /** Force-apply the current draft now (design "Apply" button; auto-apply still runs). */
  function applyNow() {
    if (dateError || offline) return;
    onChange(draft);
  }

  return (
    <Card className="p-4" data-testid="audit-filter-bar" aria-label="Filter audit log">
      {/* Primary row — the five design fields, then the button cluster. */}
      <div className="flex flex-wrap items-end gap-2">
        {/* actor */}
        <div className="flex min-w-[150px] flex-[1.3] flex-col gap-1.5">
          <Label htmlFor="audit-filter-actor" className={FILTER_LABEL}>
            Actor
          </Label>
          <Input
            id="audit-filter-actor"
            className="font-mono"
            placeholder="All users"
            value={draft.userId}
            onChange={(e) => set("userId", e.target.value)}
          />
        </div>

        {/* action — dropdown multi-select */}
        <div className="flex min-w-[168px] flex-[1.5] flex-col gap-1.5">
          <Label id="audit-filter-actions-label" className={FILTER_LABEL}>
            Action
          </Label>
          <ActionMultiSelect
            selected={draft.actions}
            onToggle={toggleAction}
            onClear={() => set("actions", [])}
          />
        </div>

        {/* entity type */}
        <div className="flex min-w-[140px] flex-[1.2] flex-col gap-1.5">
          <Label htmlFor="audit-filter-entity-type" className={FILTER_LABEL}>
            Entity type
          </Label>
          <Input
            id="audit-filter-entity-type"
            placeholder="All types"
            value={draft.entityType}
            onChange={(e) => set("entityType", e.target.value)}
          />
        </div>

        {/* date from */}
        <div className="flex min-w-[124px] flex-[1] flex-col gap-1.5">
          <Label htmlFor="audit-filter-date-from" className={FILTER_LABEL}>
            Date from
          </Label>
          <Input
            id="audit-filter-date-from"
            type="date"
            className="tabular-nums"
            invalid={!!dateError}
            value={draft.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
          />
        </div>

        {/* date to */}
        <div className="flex min-w-[124px] flex-[1] flex-col gap-1.5">
          <Label htmlFor="audit-filter-date-to" className={FILTER_LABEL}>
            Date to
          </Label>
          <Input
            id="audit-filter-date-to"
            type="date"
            className="tabular-nums"
            invalid={!!dateError}
            aria-describedby={dateError ? "audit-filter-date-error" : undefined}
            value={draft.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
          />
        </div>

        {/* button cluster (design: Filters · Apply · Clear filters) */}
        <div className="flex items-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="md"
            className="gap-1.5"
            aria-expanded={advancedOpen}
            aria-controls="audit-advanced-filters"
            onClick={() => setAdvancedOpen((o) => !o)}
            data-testid="audit-filters-toggle"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {advancedCount > 0 && (
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent-soft px-1 text-[10.5px] font-bold text-accent-ink">
                {advancedCount}
              </span>
            )}
          </Button>
          <Button
            type="button"
            size="md"
            onClick={applyNow}
            disabled={offline || !!dateError}
            data-testid="audit-apply"
          >
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={clearAll}
            data-testid="audit-clear"
          >
            Clear filters
          </Button>
        </div>
      </div>

      {/* Advanced filters — Entity id + Project (design: revealed by the "Filters" button). */}
      {advancedOpen && (
        <div
          id="audit-advanced-filters"
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
          data-testid="audit-advanced-filters"
        >
          <div className="flex min-w-[200px] flex-[1.2] flex-col gap-1.5">
            <Label htmlFor="audit-filter-entity-id" className={FILTER_LABEL}>
              Entity id
            </Label>
            <Input
              id="audit-filter-entity-id"
              className="font-mono"
              placeholder="Entity id (UUID)"
              value={draft.entityId}
              onChange={(e) => set("entityId", e.target.value)}
            />
          </div>
          <div className="flex min-w-[160px] flex-[1] flex-col gap-1.5">
            <Label htmlFor="audit-filter-project" className={FILTER_LABEL}>
              Project
            </Label>
            <Input
              id="audit-filter-project"
              className="font-mono"
              placeholder="Project id"
              value={draft.projectId}
              onChange={(e) => set("projectId", e.target.value)}
            />
          </div>
        </div>
      )}

      {dateError && (
        <p
          id="audit-filter-date-error"
          className="mt-2 text-[11.5px] text-destructive-ink"
          data-testid="audit-date-error"
        >
          {dateError}
        </p>
      )}
    </Card>
  );
}

/**
 * Action multi-select (design file — the collapsed field shows the selected action
 * badge chips inline plus a "+N" overflow, and a ▾ affordance; clicking opens a
 * checkbox menu of every action). Kept feature-local (a lightweight popover, not the
 * shared native `Select`, which can't render chips or multi-select). Each option is a
 * `role="checkbox"` button carrying `data-testid="audit-action-{ACTION}"` and
 * `aria-checked` so the toggle contract is stable for tests and screen readers.
 */
function ActionMultiSelect({
  selected,
  onToggle,
  onClear,
}: {
  selected: AuditAction[];
  onToggle: (action: AuditAction) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape (menu semantics; focus stays reachable).
  useEffect(() => {
    if (!open) return;
    function onDocDown(ev: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The design shows up to two chips inline, then a "+N" overflow count.
  const VISIBLE = 2;
  const shown = selected.slice(0, VISIBLE);
  const overflow = selected.length - shown.length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-labelledby="audit-filter-actions-label"
        onClick={() => setOpen((o) => !o)}
        data-testid="audit-action-trigger"
        className={cn(
          "flex h-9 w-full items-center justify-between gap-1.5 rounded-token border bg-background px-2.5 text-left transition-colors",
          "focus:outline-none focus:shadow-focus",
          open ? "border-accent shadow-focus" : "border-border-strong hover:bg-surface-2",
        )}
      >
        {selected.length === 0 ? (
          <span className="truncate text-sm text-faint">All actions</span>
        ) : (
          <span className="flex min-w-0 items-center gap-1">
            {shown.map((action) => {
              const tone = AUDIT_ACTION_TONE[action] ?? "info";
              return (
                <span
                  key={action}
                  className={cn(
                    "inline-flex h-[21px] items-center rounded-pill px-2 text-[11px] font-semibold",
                    ACTION_CHIP[tone],
                  )}
                >
                  {action}
                </span>
              );
            })}
            {overflow > 0 && (
              <span className="text-[11.5px] text-faint">+{overflow}</span>
            )}
          </span>
        )}
        <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div
          role="group"
          aria-labelledby="audit-filter-actions-label"
          data-testid="audit-filter-actions"
          className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-full rounded-lg border border-border-strong bg-surface p-1.5 shadow-md"
        >
          {AUDIT_ACTIONS.map((action) => {
            const checked = selected.includes(action);
            const tone = AUDIT_ACTION_TONE[action] ?? "info";
            return (
              <button
                key={action}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => onToggle(action)}
                data-testid={`audit-action-${action}`}
                className={cn(
                  "flex h-[34px] w-full items-center gap-2.5 rounded-token px-2 text-left outline-none transition-colors",
                  "hover:bg-muted focus-visible:bg-muted focus-visible:shadow-focus",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 flex-none items-center justify-center rounded-[5px] border",
                    checked ? "border-accent bg-accent text-white" : "border-border-strong",
                  )}
                  aria-hidden
                >
                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "inline-flex h-[21px] items-center rounded-pill px-2 text-[11px] font-semibold",
                    ACTION_CHIP[tone],
                  )}
                >
                  {action}
                </span>
              </button>
            );
          })}

          {selected.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              data-testid="audit-action-clear"
              className="mt-1 flex h-8 w-full items-center rounded-token border-t border-border px-2 pt-1 text-[12px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-focus"
            >
              Clear actions
            </button>
          )}
        </div>
      )}
    </div>
  );
}
