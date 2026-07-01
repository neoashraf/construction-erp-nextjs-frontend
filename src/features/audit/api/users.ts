import { apiClient } from "@/lib/api";
import { type Paginated } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type UserListItem,
  type UserDetail,
  type CreateUserInput,
  type UpdateUserInput,
  type ResetPasswordInput,
} from "../types";

/**
 * User-management API bindings (API contract 05 § Users, Admin only). Central
 * `{ data, meta }` envelope — list rides `meta` for page info. State-changing
 * calls echo the double-submit CSRF token (skill §4). Company-scoped from the
 * token server-side (FR-AUD-027) — never sent as a client param.
 *
 * Import boundary: this feature imports `@/lib/api`, never `@/lib/api/generated/*`,
 * and never reaches into `features/master-data` (skill §2.4).
 */

const BASE = "/users";

interface Envelope<T> {
  data: T;
}

export interface UserListFilter {
  role?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

function buildQuery(f: UserListFilter): string {
  const p = new URLSearchParams();
  if (f.role) p.set("role", f.role);
  if (f.isActive !== undefined) p.set("isActive", String(f.isActive));
  if (f.search) p.set("search", f.search);
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? 25));
  return p.toString();
}

/** GET a filtered, paginated user list (page info in meta). Never includes password_hash. */
export async function listUsers(filter: UserListFilter = {}): Promise<Paginated<UserListItem>> {
  const res = await apiClient.get<{
    data: UserListItem[];
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

/** GET a single user by id (company-scoped; NOT_FOUND for another company's id). */
export async function getUser(id: string): Promise<UserDetail> {
  const res = await apiClient.get<Envelope<UserDetail>>(`${BASE}/${id}`);
  return res.data;
}

/** POST a new user. `temporaryPassword` is write-only — never returned. */
export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  const res = await apiClient.post<Envelope<UserListItem>>(BASE, input, csrf());
  return res.data;
}

/** PATCH a user (sends `version` for optimistic concurrency). No email/password here. */
export async function updateUser(id: string, input: UpdateUserInput): Promise<UserDetail> {
  const res = await apiClient.patch<Envelope<UserDetail>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/** POST activate — server-confirmed, no optimistic flip. */
export async function activateUser(id: string): Promise<{ id: string; isActive: boolean }> {
  const res = await apiClient.post<Envelope<{ id: string; isActive: boolean }>>(
    `${BASE}/${id}/activate`,
    {},
    csrf(),
  );
  return res.data;
}

/** POST deactivate — revokes refresh tokens; takes effect on the user's next request. */
export async function deactivateUser(id: string): Promise<{ id: string; isActive: boolean }> {
  const res = await apiClient.post<Envelope<{ id: string; isActive: boolean }>>(
    `${BASE}/${id}/deactivate`,
    {},
    csrf(),
  );
  return res.data;
}

/**
 * POST reset-password — `temporaryPassword` optional (empty/omitted = system-
 * generate). `204` no content: the response NEVER carries the password (spec §9,
 * _open-questions.md AUD 4) — the Admin shares it out-of-band.
 */
export async function resetUserPassword(id: string, input: ResetPasswordInput): Promise<void> {
  await apiClient.post<void>(`${BASE}/${id}/reset-password`, input, csrf());
}
