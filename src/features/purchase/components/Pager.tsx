"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * List pager (Purchase Orders / Bill / GRN list footers). Matches the design's
 * "Prev · 1 2 3 · Next" cluster: a Prev ghost, up to a small window of numbered page
 * buttons (the current page filled dark), then Next. Numbers are elided with an ellipsis
 * when the total page count is large. Shared across the purchase list screens.
 */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  testidPrefix,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (next: number) => void;
  testidPrefix: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pages = pageWindow(page, pageCount);

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="ghost"
        disabled={page <= 1}
        onClick={() => onPage(Math.max(1, page - 1))}
        data-testid={`${testidPrefix}-prev`}
      >
        Prev
      </Button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-[12.5px] text-faint" aria-hidden>
            …
          </span>
        ) : (
          <Button
            key={p}
            size="sm"
            variant={p === page ? "primary" : "outline"}
            aria-current={p === page ? "page" : undefined}
            className={cn("min-w-9 px-0", p === page && "pointer-events-none")}
            onClick={() => onPage(p)}
            data-testid={`${testidPrefix}-page-${p}`}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        data-testid={`${testidPrefix}-next`}
      >
        Next
      </Button>
    </div>
  );
}

/** A compact page window: first · current±1 · last, with … gaps. Max 3 numbers when small. */
function pageWindow(current: number, count: number): (number | "…")[] {
  if (count <= 5) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < count - 1) out.push("…");
  out.push(count);
  return out;
}
