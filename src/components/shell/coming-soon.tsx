import { Construction } from "lucide-react";

/**
 * Coming-soon placeholder for a nav route whose real screen (a Tier-2/3 per-screen
 * brief) hasn't shipped yet. The nav item is navigable (built:true in nav-tree) so
 * clicking it always lands somewhere, but the destination is this honest placeholder
 * rather than a blank page or a dead link. Swapped for the real feature screen when
 * the screen's brief lands.
 */
export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <section
      aria-labelledby="coming-soon-h"
      data-testid="coming-soon"
      className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center"
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-ink">
        <Construction className="h-6 w-6" aria-hidden />
      </span>
      <h1 id="coming-soon-h" className="text-xl font-semibold text-foreground">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">
        {description ?? "This screen is coming soon. It will be enabled when its per-screen brief ships."}
      </p>
    </section>
  );
}
