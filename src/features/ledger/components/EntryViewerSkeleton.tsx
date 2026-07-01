import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Entry-viewer loading state (spec §6): header skeleton + ≈4 line-row skeletons +
 * totals/linkage skeleton blocks. Rendered while `useJournalEntry` is loading.
 */
export function EntryViewerSkeleton() {
  return (
    <div data-testid="entry-viewer-loading">
      <Skeleton className="mb-2 h-3 w-64" />
      <Skeleton className="h-7 w-80" />

      {/* header skeleton */}
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap gap-7">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </Card>

      {/* lines skeleton */}
      <Card className="mt-4 overflow-hidden">
        <div className="h-11 border-b border-border bg-surface-2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-5 border-t border-muted px-4 py-3.5">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-3 flex-[2]" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
        <div className="flex justify-end gap-6 border-t border-border-strong bg-surface-2 px-4 py-3.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </Card>

      {/* linkage skeleton */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-8 w-8 flex-none rounded-token" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-2/5" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
