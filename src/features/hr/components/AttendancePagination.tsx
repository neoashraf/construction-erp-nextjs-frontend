"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PAGE_SIZE_OPTIONS, pageItems } from "../lib/attendance-filters";

/**
 * Table footer: page-size selector, the `Showing x-y of n` count, and truncated page
 * buttons. Changing page size resets to page 1 — staying on page 9 of 3 would show an
 * empty table with no obvious cause.
 */
export function AttendancePagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
  disabled,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  disabled?: boolean;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const items = pageItems(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <label htmlFor="attendance-page-size" className="text-[12px] text-muted-foreground">
          Rows
        </label>
        <Select
          id="attendance-page-size"
          className="h-8 w-[76px]"
          value={limit}
          disabled={disabled}
          onChange={(e) => onLimitChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-[12px] text-muted-foreground" aria-live="polite">
        Showing {from.toLocaleString()}-{to.toLocaleString()} of {total.toLocaleString()} employees
      </p>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <PageButton
          label="Previous page"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </PageButton>

        {items.map((item, index) =>
          item === null ? (
            <span
              key={`gap-${index}`}
              className="px-1 text-[12px] text-faint"
              aria-hidden
            >
              …
            </span>
          ) : (
            <PageButton
              key={item}
              label={`Page ${item}`}
              active={item === page}
              disabled={disabled}
              onClick={() => onPageChange(item)}
            >
              {item}
            </PageButton>
          ),
        )}

        <PageButton
          label="Next page"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </PageButton>
      </nav>
    </div>
  );
}

function PageButton({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-8 min-w-[32px] place-items-center rounded-token px-2 text-[12.5px] font-semibold tabular-nums transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border-strong bg-surface text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
