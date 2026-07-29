import Link from "next/link";
import { redirect } from "next/navigation";
import { hasGrant } from "@/lib/auth/roles";
import { FORBIDDEN_PATH, LOGIN_PATH } from "@/lib/auth/guard";
import { getServerSessionWithPermissions } from "@/lib/auth/server-session-permissions";
import { SETTINGS_NAV_ITEMS, showsSettingsGear } from "@/lib/nav/nav-tree";

/**
 * Settings surface (screen spec docs/design/screens/00-app-shell/settings.md) — a
 * small launcher reached only via the topbar gear (`showsSettingsGear`,
 * `components/shell/topbar.tsx`). It is chrome, not a new product screen: its one
 * `Company` left-nav group wraps three EXISTING, UNCHANGED destinations (§3
 * "Related screens") — this file never creates a `/settings/*` route for any of
 * them, and never modifies their own page files. Clicking an item navigates AWAY
 * to that destination's own route; this surface has no content pane that swaps
 * in place (§5/§9 — amended to resolve the routing constraint against the
 * original two-pane design).
 *
 * Each left-nav item is filtered by its own `resource:READ` grant (§5); the
 * group header ("Company") never collapses, unlike the sidebar's single-item
 * suppression rule, because its label never matches an item's own label (§5).
 *
 * No breadcrumb — app-shell.md §3.3 (amended for exactly this surface) treats
 * these three destinations as having a nav entry (this surface's own left nav),
 * so per its own test they take no breadcrumb; the surface title + left nav ARE
 * their persistent-nav identity (settings.md §3).
 *
 * Fail-closed guard (defence-in-depth, not a replacement for each destination's
 * own `requireModuleAccess`): a missing/unauthenticated session is sent to
 * login, never rendered — the null-viewer branch used to be treated as
 * "maximally permissive" (render all three items, skip the 403), which is both
 * the inverse of every other guard in this codebase (`guardModule`, guard.ts)
 * and a real information-disclosure path once `getSettingsViewer`'s bare `catch`
 * is gone (see git history) — an upstream `/auth/me` outage can no longer turn
 * an under-privileged viewer's deny into a render. The "any settings grant?"
 * check reuses `showsSettingsGear` — the exact predicate gating the topbar gear
 * — instead of re-deriving it from `items.length`, so the gear and this surface
 * can never diverge.
 */
export default async function SettingsPage() {
  const viewer = await getServerSessionWithPermissions();
  if (!viewer) {
    redirect(LOGIN_PATH);
  }

  // Deep link with zero of the three grants → hard 403 (settings.md §6 "Empty"),
  // exactly like every other route hidden from the nav — the gear itself was
  // never rendered for this viewer either (`showsSettingsGear`). Each of the
  // three destinations' own route guard is unchanged and re-checks independently
  // (settings.md §13) — this is a second, surface-level layer, not a replacement.
  if (!showsSettingsGear(viewer)) {
    redirect(FORBIDDEN_PATH);
  }

  const items = SETTINGS_NAV_ITEMS.filter((item) => hasGrant(viewer, item.resource, "READ"));

  return (
    <div className="flex gap-8">
      <div className="w-[200px] shrink-0">
        <h1 className="px-2 text-lg font-semibold text-foreground">Settings</h1>
        <nav aria-label="Settings">
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
        </nav>
      </div>
      <div className="min-w-0 flex-1 pt-11">
        <p className="text-sm text-muted-foreground">
          Choose a setting from the list to get started.
        </p>
      </div>
    </div>
  );
}
