"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AUDIT_ACTIONS, type AuditAction } from "../types";
import { EMPTY_AUDIT_LOG_FILTER, type AuditLogFilterFormValues } from "../schemas/audit-log-filter";

/**
 * Audit-log filter bar (screen spec §4/§7/§9; design file filter card). Unlike the
 * ledger filter bars (apply-on-submit), this one applies ON CHANGE, debounced
 * (spec §9 "Filters apply on change (debounced)") — there is no Apply button, only
 * Clear filters. Actor/entity type/entity id/project are free-text id inputs
 * (master-data comboboxes are owned by MAS; this feature never imports
 * `features/master-data`, skill §2.4 — mirrors `TrialBalanceFilterBar`'s
 * established pattern). Action is a multi-select of badge chips. Date range
 * validates client-side (`dateTo < dateFrom` -> inline "End date must be after
 * start date.") and is not applied until valid.
 */

const DEBOUNCE_MS = 350;

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

  return (
    <Card className="p-4" data-testid="audit-filter-bar" aria-label="Filter audit log">
      <div className="flex flex-wrap items-end gap-3">
        {/* actor */}
        <div className="flex min-w-[170px] flex-1 flex-col gap-1.5">
          <Label htmlFor="audit-filter-actor">Actor</Label>
          <Input
            id="audit-filter-actor"
            className="font-mono"
            placeholder="User id"
            value={draft.userId}
            onChange={(e) => set("userId", e.target.value)}
          />
        </div>

        {/* entity type */}
        <div className="flex min-w-[150px] flex-col gap-1.5">
          <Label htmlFor="audit-filter-entity-type">Entity type</Label>
          <Input
            id="audit-filter-entity-type"
            placeholder="e.g. Project"
            value={draft.entityType}
            onChange={(e) => set("entityType", e.target.value)}
          />
        </div>

        {/* entity id */}
        <div className="flex min-w-[170px] flex-col gap-1.5">
          <Label htmlFor="audit-filter-entity-id">Entity id</Label>
          <Input
            id="audit-filter-entity-id"
            className="font-mono"
            placeholder="Entity id (UUID)"
            value={draft.entityId}
            onChange={(e) => set("entityId", e.target.value)}
          />
        </div>

        {/* project */}
        <div className="flex min-w-[150px] flex-col gap-1.5">
          <Label htmlFor="audit-filter-project">Project</Label>
          <Input
            id="audit-filter-project"
            className="font-mono"
            placeholder="Project id"
            value={draft.projectId}
            onChange={(e) => set("projectId", e.target.value)}
          />
        </div>

        {/* date from */}
        <div className="flex min-w-[140px] flex-col gap-1.5">
          <Label htmlFor="audit-filter-date-from">Date from</Label>
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
        <div className="flex min-w-[140px] flex-col gap-1.5">
          <Label htmlFor="audit-filter-date-to">Date to</Label>
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

        <div className="flex items-end">
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

      {/* action multi-select */}
      <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
        <Label id="audit-filter-actions-label" className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Action
        </Label>
        <div
          role="group"
          aria-labelledby="audit-filter-actions-label"
          className="flex flex-wrap gap-1.5"
          data-testid="audit-filter-actions"
        >
          {AUDIT_ACTIONS.map((action) => {
            const checked = draft.actions.includes(action);
            return (
              <button
                key={action}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleAction(action)}
                data-testid={`audit-action-${action}`}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-[11px] font-bold uppercase tracking-wide transition-colors",
                  "focus-visible:outline-none focus-visible:shadow-focus",
                  checked
                    ? "border-accent-soft bg-accent-soft text-accent-ink"
                    : "border-border-strong bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {action}
              </button>
            );
          })}
        </div>
      </div>

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
