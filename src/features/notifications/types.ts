/**
 * FE-53 fe-notifications — DTOs for the NTF surface (SRS §5, contract 18).
 * The Notification resource is emitted by the owning modules (REQ/SAL/CC/HR/AUD/…);
 * this surface only reads and marks read. `severity` is presentation-only
 * (FR-NTF-022); it never conveys authorization. `deepLink` may be `null`
 * (informational rows) — the row is then non-clickable.
 */

export type NotificationSeverity = "HIGH" | "NORMAL" | "LOW";

export interface NotificationDeepLink {
  /** Client route the row navigates to (e.g. "/requisitions/approvals/req-1"). */
  route: string;
  /** Optional query params merged into the route. */
  params?: Record<string, string> | null;
}

export interface Notification {
  id: string;
  /** Type code from the SRS Appendix-A catalogue (e.g. "BUDGET_BREACH"). */
  type: string;
  severity: NotificationSeverity;
  /** Source module code that produced the row (e.g. "CC", "REQ", "SAL"). */
  sourceModule: string;
  /** Rendered title — source-formatted, may contain `৳` money strings verbatim. */
  title: string;
  /** Rendered body — source-formatted, Bangla-safe. */
  body: string;
  /** `null` when the row is purely informational (no navigation). */
  deepLink: NotificationDeepLink | null;
  /** Optional payload metadata; the UI renders any labels verbatim (FR-NTF-026). */
  payload?: Record<string, string> | null;
  /** ISO-8601 UTC creation time. */
  createdAt: string;
  /** ISO-8601 UTC read time (null while unread). */
  readAt: string | null;
}

export interface NotificationsFeedFilters {
  isRead?: boolean | null;
  type?: string | null;
  /** ISO-8601 UTC lower bound (inclusive) for `createdAt`. */
  since?: string | null;
}

export interface FeedMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface NotificationsFeedResponse {
  data: Notification[];
  meta: FeedMeta;
}

/** Options page-size defaults for the two surfaces. */
export const DRAWER_PAGE_SIZE = 25;
export const PAGE_PAGE_SIZE = 25;
