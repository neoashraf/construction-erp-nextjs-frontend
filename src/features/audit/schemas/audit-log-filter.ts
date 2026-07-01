import { z } from "zod";
import { AUDIT_ACTIONS } from "../types";

/**
 * Audit-log filter form (screen spec §7/§8). A QUERY form, not a writing form —
 * filters apply on change (debounced), never a mutation. Client validation mirrors
 * the API's `VALIDATION_ERROR` (400 — bad `action` or `dateFrom`/`dateTo` range):
 * `dateFrom` must not be after `dateTo`, shown inline with the exact spec copy
 * "End date must be after start date." Dates are `YYYY-MM-DD` (native date inputs);
 * rendered `DD/MM/YYYY` elsewhere.
 *
 * `actions` is a multi-select (design file), but the live `GET /api/audit-logs`
 * only accepts a single `action` query param (confirmed against the merged
 * backend controller — `@Query('action') action?: string`, validated against one
 * value). `useAuditLogs` honours a multi-select by issuing one request per
 * selected action and merging + re-sorting newest-first client-side when more
 * than one is chosen (see hooks/use-audit-logs.ts); the common 0-or-1-selected
 * case is a single server-side call, unchanged from every other filter.
 */
export const auditLogFilterSchema = z
  .object({
    userId: z.string().trim().optional().or(z.literal("")),
    entityType: z.string().trim().optional().or(z.literal("")),
    entityId: z.string().trim().optional().or(z.literal("")),
    actions: z.array(z.enum(AUDIT_ACTIONS)).default([]),
    projectId: z.string().trim().optional().or(z.literal("")),
    dateFrom: z.string().optional().or(z.literal("")),
    dateTo: z.string().optional().or(z.literal("")),
  })
  .refine(
    (v) => {
      if (!v.dateFrom || !v.dateTo) return true;
      return v.dateFrom <= v.dateTo; // ISO YYYY-MM-DD compares lexicographically
    },
    { path: ["dateTo"], message: "End date must be after start date." },
  );

export type AuditLogFilterFormValues = z.infer<typeof auditLogFilterSchema>;

export const EMPTY_AUDIT_LOG_FILTER: AuditLogFilterFormValues = {
  userId: "",
  entityType: "",
  entityId: "",
  actions: [],
  projectId: "",
  dateFrom: "",
  dateTo: "",
};
