import { apiClient } from "@/lib/api";
import { type Paginated } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type Item, type ItemUomConversion } from "../types";

/**
 * Item + UoM-conversion API bindings (API contract 01 §§ Items). Central
 * `{ data, meta }` envelope; CSRF on writes. Conversions are a sub-resource.
 */

const BASE = "/masters/items";

interface Envelope<T> {
  data: T;
}
function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface ItemFilter {
  isActive?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ItemWriteInput {
  code?: string;
  name: string;
  baseUom: string;
  hsCode?: string | null;
  defaultAccountId?: string | null;
}

export async function listItems(filter: ItemFilter = {}): Promise<Paginated<Item>> {
  const p = new URLSearchParams();
  if (filter.isActive !== undefined) p.set("isActive", String(filter.isActive));
  if (filter.q) p.set("q", filter.q);
  p.set("page", String(filter.page ?? 1));
  p.set("pageSize", String(filter.pageSize ?? 25));
  const res = await apiClient.get<{
    data: Item[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${p.toString()}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? filter.page ?? 1,
    pageSize: meta.pageSize ?? filter.pageSize ?? 25,
    total: meta.total ?? res.data.length,
  };
}

export async function getItem(id: string): Promise<Item> {
  const res = await apiClient.get<Envelope<Item>>(`${BASE}/${id}`);
  return res.data;
}

export async function createItem(input: ItemWriteInput): Promise<{ id: string }> {
  const res = await apiClient.post<Envelope<{ id: string }>>(BASE, input, csrf());
  return res.data;
}

export async function updateItem(
  id: string,
  input: ItemWriteInput & { version: number },
): Promise<Item> {
  const res = await apiClient.patch<Envelope<Item>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

export async function deactivateItem(id: string, version: number): Promise<Item> {
  const res = await apiClient.post<Envelope<Item>>(`${BASE}/${id}/deactivate`, { version }, csrf());
  return res.data;
}

export async function reactivateItem(id: string, version: number): Promise<Item> {
  const res = await apiClient.post<Envelope<Item>>(`${BASE}/${id}/reactivate`, { version }, csrf());
  return res.data;
}

// ── UoM conversions (sub-resource) ─────────────────────────────────────────────

export async function listConversions(itemId: string): Promise<ItemUomConversion[]> {
  const res = await apiClient.get<Envelope<ItemUomConversion[]>>(
    `${BASE}/${itemId}/uom-conversions`,
  );
  return res.data;
}

/** PUT upsert on (item, uom) — re-adding an existing unit collapses to an edit. */
export async function upsertConversion(
  itemId: string,
  input: { uom: string; factorToBase: string },
): Promise<ItemUomConversion> {
  const res = await apiClient.put<Envelope<ItemUomConversion>>(
    `${BASE}/${itemId}/uom-conversions`,
    input,
    csrf(),
  );
  return res.data;
}

export async function removeConversion(itemId: string, id: string): Promise<void> {
  await apiClient.delete<void>(`${BASE}/${itemId}/uom-conversions/${id}`, csrf());
}
