import { NotificationsPage } from "@/features/notifications/components/NotificationsPage";

/**
 * FE-53 fe-notifications — the /notifications history + filters page. No
 * breadcrumb (top-level surface); every authenticated user has a feed, so no
 * module-grant guard beyond the standard auth check.
 */
export const dynamic = "force-dynamic";

export default function NotificationsPageRoute() {
  return <NotificationsPage />;
}
