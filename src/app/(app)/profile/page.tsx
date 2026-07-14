import { AccountProfileScreen } from "@/features/profile/components/AccountProfileScreen";

/**
 * FE-52 fe-account-profile — the self-service My Profile screen. Opened from
 * the sidebar-footer user popover, **not a nav module**, **no breadcrumb**.
 * Any authenticated user may enter; the shell already handles 403/deactivated
 * route-outs. Self-scoped from the token (no :id, no user picker).
 */
export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return <AccountProfileScreen />;
}
