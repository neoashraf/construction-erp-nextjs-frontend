"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
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
    <Card className="mt-[18px] p-[13px]" data-testid="notifications-filter-bar">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Read state
          </Label>
          <div className="inline-flex gap-0.5 rounded-token bg-canvas p-[3px]">
            {(["ALL", "UNREAD"] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setDraft((d) => ({ ...d, readState: v }))}
                data-testid={`filter-read-${v.toLowerCase()}`}
                className={cn(
                  "h-[30px] rounded-sm px-3.5 text-[12.5px] font-semibold transition-colors",
                  draft.readState === v
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "ALL" ? "All" : "Unread"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex w-[220px] flex-col gap-1.5">
          <Label
            htmlFor="filter-type"
            className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Type
          </Label>
          <div className="relative">
            <select
              id="filter-type"
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
              className="h-9 w-full appearance-none rounded-token border border-border-strong bg-surface pl-3 pr-8 text-[13px] text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
              data-testid="filter-type"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
              aria-hidden
            />
          </div>
        </div>

        <div className="flex w-[200px] flex-col gap-1.5">
          <Label
            htmlFor="filter-since"
            className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Since
          </Label>
          <Input
            id="filter-since"
            type="date"
            value={draft.since}
            onChange={(e) => setDraft((d) => ({ ...d, since: e.target.value }))}
            data-testid="filter-since"
            className="w-full"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
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
