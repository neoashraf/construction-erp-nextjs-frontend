"use client";

import { cn } from "@/lib/utils";
import { pageCount } from "@/lib/api/pagination";

/**
 * Entries pagination (design footer; spec §5). "Showing a–b of total" + Prev / page
 * numbers / Next. Keyboard-focusable buttons; the current page is marked
 * `aria-current`. Server-confirmed — page changes refetch via the query key.
 */
export function EntriesPagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = pageCount({ total, pageSize });
  if (pages <= 1) {
    // Still show the count for a single page (design shows the summary always).
    const only = total === 0 ? 0 : 1;
    return (
      <div className="flex items-center justify-between px-4 py-3" data-testid="entries-pagination">
        <Summary from={total === 0 ? 0 : 1} to={total} total={total} />
        <span className="sr-only">Page {only} of 1</span>
      </div>
    );
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const windowPages = pageWindow(page, pages);

  return (
    <nav
      aria-label="Journal entries pages"
      className="flex items-center justify-between px-4 py-3"
      data-testid="entries-pagination"
    >
      <Summary from={from} to={to} total={total} />
      <div className="flex items-center gap-1.5">
        <PagerButton disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </PagerButton>
        {windowPages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-[12.5px] text-faint">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
              className={cn(
                "h-[30px] min-w-[30px] rounded-token px-2 text-[12.5px] font-semibold",
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "border border-border-strong bg-surface text-foreground hover:bg-muted",
              )}
              data-testid={`entries-page-${p}`}
            >
              {p}
            </button>
          ),
        )}
        <PagerButton disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </PagerButton>
      </div>
    </nav>
  );
}

function Summary({ from, to, total }: { from: number; to: number; total: number }) {
  return (
    <span className="text-[12.5px] text-muted-foreground">
      Showing{" "}
      <span className="font-semibold text-foreground">
        {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")}
      </span>{" "}
      of <span className="font-semibold text-foreground">{total.toLocaleString("en-IN")}</span>
    </span>
  );
}

function PagerButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-[30px] rounded-token border border-border-strong bg-surface px-3 text-[12.5px] font-semibold text-foreground hover:bg-muted disabled:cursor-default disabled:text-faint disabled:hover:bg-surface"
    >
      {children}
    </button>
  );
}

/** A compact page window: 1 … around-current … last (design shows 1 2 3 … 48). */
function pageWindow(page: number, pages: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const push = (n: number) => out.push(n);
  const first = 1;
  const last = pages;
  const around = [page - 1, page, page + 1].filter((p) => p > first && p < last);
  push(first);
  if (around.length && around[0]! > first + 1) out.push("…");
  around.forEach(push);
  if (around.length && around[around.length - 1]! < last - 1) out.push("…");
  else if (!around.length && last > first + 1) out.push("…");
  if (last > first) push(last);
  return out;
}
