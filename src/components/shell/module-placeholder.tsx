import { moduleLabel, type ModuleKey } from "@/lib/auth/roles";

/**
 * Empty module-segment placeholder (skill §2.2). The scaffold ships the route
 * segments with the import-boundary-respecting feature folders but NO screens —
 * each per-screen brief replaces this with its real screen.
 */
export function ModulePlaceholder({ module }: { module: ModuleKey }) {
  return (
    <section aria-labelledby={`mod-${module}-h`} data-testid={`module-${module}`}>
      <h1 id={`mod-${module}-h`} className="text-xl font-semibold">
        {moduleLabel(module)}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No screens yet — this module is added by its per-screen briefs.
      </p>
    </section>
  );
}
