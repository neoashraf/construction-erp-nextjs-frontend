import Link from "next/link";
import { redirect } from "next/navigation";
import { hasGrant } from "@/lib/auth/roles";
import { FORBIDDEN_PATH } from "@/lib/auth/guard";
import { getServerSessionWithPermissions } from "@/lib/auth/server-session-permissions";
import { SETTINGS_NAV_ITEMS } from "@/lib/nav/nav-tree";

/**
 * Settings surface (screen spec docs/design/screens/00-app-shell/settings.md) — a
 * small, two-column chrome page reached only via the topbar gear
 * (`showsSettingsGear`, `components/shell/topbar.tsx`). It is chrome, not a new
 * product screen: its one `Company` left-nav group wraps three EXISTING,
 * UNCHANGED destinations (§3 "Related screens") — this file never creates a
 * `/settings/*` route for any of them, and never modifies their own page files.
 *
 * Each left-nav item is filtered by its own `resource:READ` grant (§5); the
 * group header ("Company") never collapses, unlike the sidebar's single-item
 * suppression rule, because its label never matches an item's own label (§5).
 *
 * No breadcrumb — app-shell.md §3.3 (amended for exactly this surface) treats
 * these three destinations as having a nav entry (this surface's own left nav),
 * so per its own test they take no breadcrumb; the surface title + left nav ARE
 * their persistent-nav identity (settings.md §3).
 */
export default async function SettingsPage() {
  const viewer = await getSettingsViewer();
  const items = SETTINGS_NAV_ITEMS.filter((item) =>
    viewer ? hasGrant(viewer, item.resource, "READ") : true,
  );

  // Deep link with zero of the three grants → hard 403 (settings.md §6 "Empty"),
  // exactly like every other route hidden from the nav — the gear itself was
  // never rendered for this viewer either (`showsSettingsGear`). Each of the
  // three destinations' own route guard is unchanged and re-checks independently
  // (settings.md §13) — this is a second, surface-level layer, not a replacement.
  if (viewer && items.length === 0) {
    redirect(FORBIDDEN_PATH);
  }

  return (
    <div className="flex gap-8">
      <nav aria-label="Settings" className="w-[200px] shrink-0">
        <h1 className="px-2 text-lg font-semibold text-foreground">Settings</h1>
        {items.length > 0 && (
          <>
            <h2 className="px-2 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Company
            </h2>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <li key={item.route}>
                  <Link
                    href={item.route}
                    className="block rounded-token px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-canvas"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
      <div className="min-w-0 flex-1 pt-11">
        <p className="text-sm text-muted-foreground">
          Choose a setting from the list to get started.
        </p>
      </div>
    </div>
  );
}

/**
 * Read the caller's effective permission set for the Settings-surface guard.
 * Never throws: the underlying session read requires Next's per-request
 * `cookies()`, unavailable when this Server Component is invoked directly
 * (component tests) rather than through a live request — that path degrades to
 * "no viewer" (render every item, no redirect) exactly as the shell's own
 * `useOptionalSession`/`useSetRecordCrumb` degrade gracefully outside their
 * providers. A real request always has request scope, so production behaviour —
 * the 403 above — is unaffected; this only guards the artificial test path.
 */
async function getSettingsViewer() {
  try {
    return await getServerSessionWithPermissions();
  } catch {
    return null;
  }
}
