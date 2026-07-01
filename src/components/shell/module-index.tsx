import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { moduleLabel, type ModuleKey } from "@/lib/auth/roles";

export interface ModuleIndexEntry {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Module landing page — lists the screens built under a module segment as link
 * cards. Each per-screen brief owns its own route + guard (defence-in-depth);
 * this page is only a menu, so it never duplicates auth checks the target
 * screen already performs.
 */
export function ModuleIndex({
  module,
  entries,
}: {
  module: ModuleKey;
  entries: ModuleIndexEntry[];
}) {
  return (
    <section aria-labelledby={`mod-${module}-h`} data-testid={`module-${module}`}>
      <h1 id={`mod-${module}-h`} className="text-[23px] font-bold tracking-[-0.02em]">
        {moduleLabel(module)}
      </h1>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <Link key={entry.href} href={entry.href} data-testid={`module-${module}-link-${entry.href}`}>
            <Card className="h-full transition-colors hover:border-accent">
              <CardContent className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-ink">
                  <entry.icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{entry.title}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
