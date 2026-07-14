"use client";

import { showsAlertsBell, type NavViewer } from "@/lib/nav/nav-tree";
import { NotificationsBell } from "@/features/notifications/components/NotificationsBell";

/**
 * Topbar bell (FE-53 rebind). Previously the CC-only over-budget count linking
 * to `/cost-control/alerts`; now the NTF badge that opens the notifications
 * drawer for **all** roles. The `showsAlertsBell` predicate stays true for
 * every authenticated viewer (NTF has no per-role permission).
 */
export function AlertsBell({ viewer }: { viewer: NavViewer }) {
  if (!showsAlertsBell(viewer)) return null;
  return <NotificationsBell />;
}
