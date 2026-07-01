import { apiClient } from "@/lib/api";
import { type Paginated } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type Party } from "../types";

/**
 * Party API bindings (API contract 01 § Parties). List is filterable + paginated;
 * detail is create/edit + deactivate/reactivate. Central response model
 * `{ data, meta }` — list rides `meta` for page info. State-changing calls echo CSRF.
 */

const BASE = "/masters/parties";

interface Envelope<T> {
  data: T;
}

export interface PartyListFilter {
  isCustomer?: boolean;
  isSupplier?: boolean;
  isActive?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface PartyWriteInput {
  name: string;
  isCustomer: boolean;
  isSupplier: boolean;
  tin?: string | null;
  bin?: string | null;
  address?: string | null;
  phone: string;
  email?: string | null;
  paymentTermsDays?: number | null;
  openingBalance?: string | null;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

function buildQuery(f: PartyListFilter): string {
  const p = new URLSearchParams();
  if (f.isCustomer) p.set("isCustomer", "true");
  if (f.isSupplier) p.set("isSupplier", "true");
  if (f.isActive !== undefined) p.set("isActive", String(f.isActive));
  if (f.q) p.set("q", f.q);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? 25));
  return p.toString();
}

/** GET a filtered, paginated party list (page info in meta). */
export async function listParties(filter: PartyListFilter = {}): Promise<Paginated<Party>> {
  const res = await apiClient.get<{
    data: Party[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(`${BASE}?${buildQuery(filter)}`);
  const meta = res.meta ?? {};
  return {
    data: res.data,
    page: meta.page ?? filter.page ?? 1,
    pageSize: meta.pageSize ?? filter.pageSize ?? 25,
    total: meta.total ?? res.data.length,
  };
}

/** GET a single party by id. */
export async function getParty(id: string): Promise<Party> {
  const res = await apiClient.get<Envelope<Party>>(`${BASE}/${id}`);
  return res.data;
}

/** POST a new party → new id. */
export async function createParty(input: PartyWriteInput): Promise<{ id: string }> {
  const res = await apiClient.post<Envelope<{ id: string }>>(BASE, input, csrf());
  return res.data;
}

/** PATCH a party (sends version). */
export async function updateParty(
  id: string,
  input: PartyWriteInput & { version: number },
): Promise<Party> {
  const res = await apiClient.patch<Envelope<Party>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/** POST deactivate (isActive=false; sends version). */
export async function deactivateParty(id: string, version: number): Promise<Party> {
  const res = await apiClient.post<Envelope<Party>>(
    `${BASE}/${id}/deactivate`,
    { version },
    csrf(),
  );
  return res.data;
}

/** POST reactivate (isActive=true; sends version). */
export async function reactivateParty(id: string, version: number): Promise<Party> {
  const res = await apiClient.post<Envelope<Party>>(
    `${BASE}/${id}/reactivate`,
    { version },
    csrf(),
  );
  return res.data;
}
