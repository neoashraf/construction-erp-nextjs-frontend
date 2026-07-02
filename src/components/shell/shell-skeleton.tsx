import { Skeleton } from "@/components/ui/skeleton";

/**
 * Whole-shell loading skeleton (screen spec §6 — session/`me` in flight). Navy sidebar
 * with pulse bars, a topbar with chip/avatar skeletons, and a content skeleton — so
 * the shell never flashes wrong-role nav before the role is known.
 */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-canvas" data-testid="shell-skeleton" aria-busy="true">
      <aside className="hidden w-[230px] shrink-0 flex-col bg-sidebar p-4 md:flex" aria-hidden>
        <div className="mb-6 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-sidebar-hover" />
          <div className="h-3 w-28 rounded bg-sidebar-hover" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="my-1.5 h-8 rounded-token bg-sidebar-hover/70" />
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-5">
          <Skeleton className="h-6 w-40" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </header>
        <main className="flex-1 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-4 h-40 w-full" />
        </main>
      </div>
    </div>
  );
}
