import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Presentational breadcrumb (design-system §5; shadcn-style). A simple data-driven
 * trail: each item is a `{ label, href? }`; items with an `href` render as links, the
 * LAST item is always the current page (bold, `aria-current`, non-link even if an
 * href is given). Chevron `›` separators, hover on links, Bangla-safe truncation with
 * a `title`. `nav[aria-label="Breadcrumb"]` landmark.
 *
 * Placement is unchanged from before (the project shows a breadcrumb on drill-down/
 * detail screens and on the master/list pages that already had one — this only
 * restyles them; it does not add a breadcrumb where a page had none).
 */

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumb" className={cn("mb-1.5 min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "truncate",
                    isLast ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                  aria-current={isLast ? "page" : undefined}
                  title={item.label}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
