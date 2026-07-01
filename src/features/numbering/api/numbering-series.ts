import { apiClient } from "@/lib/api";
import { type Paginated } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type NumberingSeries,
  type NextNumberPreview,
  type GapAudit,
  type SeriesEditInput,
} from "../types";

/**
 * Numbering-series API bindings (API contract 03 § Numbering Series). Company- +
 * FY-scoped admin config and read-only preview/gap-audit. Central `{ data, meta }`
 * envelope; CSRF on the (only) write, `PATCH …/{id}`. Number allocation has NO
 * endpoint — it is internal to the post transaction (FR-NUM-007..011); this surface
 * is config + read only. There is deliberately no create/delete call surfaced here
 * (series auto-provision/seed — SRS §16; rows never deleted — FR-NUM-018).
 */

const BASE = "/masters/numbering-series";

interface Envelope<T> {
  data: T;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface NumberingSeriesFilter {
  companyId: string;
  financialYearId?: string;
  voucherType?: string;
  page?: number;
  pageSize?: number;
}

/** List series for a company (+ optional FY / voucher-type filter). `companyId` required. */
export async function listNumberingSeries(
  filter: NumberingSeriesFilter,
): Promise<Paginated<NumberingSeries>> {
  const p = new URLSearchParams();
  p.set("companyId", filter.companyId);
  if (filter.financialYearId) p.set("financialYearId", filter.financialYearId);
  if (filter.voucherType) p.set("voucherType", filter.voucherType);
  p.set("page", String(filter.page ?? 1));
  p.set("pageSize", String(filter.pageSize ?? 100));
  const res = await apiClient.get<{
    data: NumberingSeries[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${p.toString()}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? filter.page ?? 1,
    pageSize: meta.pageSize ?? filter.pageSize ?? 100,
    total: meta.total ?? res.data.length,
  };
}

/**
 * Edit a series — forward-only, only `prefix` and/or `paddingWidth` (FR-NUM-002,
 * FR-NUM-020). The server rejects any attempt to change the immutable key or
 * lastSequence (`IMMUTABLE_FIELD`, FR-NUM-018). Audit-logged (FR-NUM-022).
 */
export async function updateNumberingSeries(
  id: string,
  input: SeriesEditInput,
): Promise<NumberingSeries> {
  const res = await apiClient.patch<Envelope<NumberingSeries>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/** Non-consuming next-number preview (API `GET …/{id}/next-preview`, FR-NUM-013). */
export async function getNextPreview(id: string): Promise<NextNumberPreview> {
  const res = await apiClient.get<Envelope<NextNumberPreview>>(`${BASE}/${id}/next-preview`);
  return res.data;
}

/** Read-only continuity report (API `GET …/{id}/gap-audit`, FR-NUM-021). `asOf` optional. */
export async function getGapAudit(id: string, asOf?: string): Promise<GapAudit> {
  const suffix = asOf ? `?asOf=${encodeURIComponent(asOf)}` : "";
  const res = await apiClient.get<Envelope<GapAudit>>(`${BASE}/${id}/gap-audit${suffix}`);
  return res.data;
}
