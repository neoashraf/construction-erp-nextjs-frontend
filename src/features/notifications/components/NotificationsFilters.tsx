"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type NotificationsFeedFilters } from "../types";

/**
 * FE-53 filter bar for `/notifications` — single row: read-state segmented
 * (All · Unread), Type select (catalogue codes), Since date, Apply + Clear.
 * AND-combined; a caller applies them to the paginated feed hook.
 */
export interface NotificationsFiltersValue {
  readState: "ALL" | "UNREAD";
  type: string;
  since: string; // yyyy-mm-dd; empty = no bound
}

export const DEFAULT_FILTERS: NotificationsFiltersValue = {
  readState: "ALL",
  type: "",
  since: "",
};

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "BUDGET_BREACH", label: "Budget breach" },
  { value: "REQUISITION_APPROVAL", label: "Requisition approval" },
  { value: "IPC_SUBMITTED", label: "IPC submitted" },
  { value: "GRN_MISMATCH", label: "GRN mismatch" },
  { value: "PAYMENT_POSTED", label: "Payment posted" },
];

export function toApiFilters(v: NotificationsFiltersValue): NotificationsFeedFilters {
  return {
    isRead: v.readState === "UNREAD" ? false : null,
    type: v.type || null,
    since: v.since ? new Date(`${v.since}T00:00:00Z`).toISOString() : null,
  };
}

export function NotificationsFilters({
  value,
  onApply,
  onClear,
}: {
  value: NotificationsFiltersValue;
  onApply: (v: NotificationsFiltersValue) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<NotificationsFiltersValue>(value);
  return (
    <Card className="p-4" data-testid="notifications-filter-bar">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Read state
          </Label>
          <div className="mt-1 inline-flex overflow-hidden rounded-token border border-border-strong">
            {(["ALL", "UNREAD"] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setDraft((d) => ({ ...d, readState: v }))}
                data-testid={`filter-read-${v.toLowerCase()}`}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  draft.readState === v
                    ? "bg-foreground text-background"
                    : "bg-surface text-muted-foreground hover:bg-canvas",
                )}
              >
                {v === "ALL" ? "All" : "Unread"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="filter-type" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Type
          </Label>
          <select
            id="filter-type"
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
            className="mt-1 block h-9 rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
            data-testid="filter-type"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="filter-since" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Since
          </Label>
          <Input
            id="filter-since"
            type="date"
            value={draft.since}
            onChange={(e) => setDraft((d) => ({ ...d, since: e.target.value }))}
            data-testid="filter-since"
            className="mt-1 w-[170px]"
          />
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            size="md"
            onClick={() => onApply(draft)}
            data-testid="filter-apply"
          >
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => {
              setDraft(DEFAULT_FILTERS);
              onClear();
            }}
            data-testid="filter-clear"
          >
            Clear filters
          </Button>
        </div>
      </div>
    </Card>
  );
}
