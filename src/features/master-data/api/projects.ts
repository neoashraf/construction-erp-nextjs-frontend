import { apiClient } from "@/lib/api";
import { type Paginated } from "@/lib/api/pagination";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type Project } from "../types";

/**
 * Project API bindings (API contract 01 § Projects). List + detail + create/edit +
 * the status state-machine. Central `{ data, meta }` envelope; CSRF on writes.
 */

const BASE = "/masters/projects";

interface Envelope<T> {
  data: T;
}
function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface ProjectListFilter {
  status?: string;
  customerId?: string;
  projectManagerId?: string;
  isActive?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ProjectWriteInput {
  projectCode?: string;
  name: string;
  location?: string | null;
  customerId: string;
  projectManagerId: string;
  startDate: string;
  expectedEndDate: string;
}

export type StatusAction = "activate" | "hold" | "resume" | "close" | "reopen";

export async function listProjects(filter: ProjectListFilter = {}): Promise<Paginated<Project>> {
  const p = new URLSearchParams();
  if (filter.status) p.set("status", filter.status);
  if (filter.customerId) p.set("customerId", filter.customerId);
  if (filter.projectManagerId) p.set("projectManagerId", filter.projectManagerId);
  if (filter.isActive !== undefined) p.set("isActive", String(filter.isActive));
  if (filter.q) p.set("q", filter.q);
  p.set("page", String(filter.page ?? 1));
  p.set("pageSize", String(filter.pageSize ?? 25));
  const res = await apiClient.get<{
    data: Project[];
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

export async function getProject(id: string): Promise<Project> {
  const res = await apiClient.get<Envelope<Project>>(`${BASE}/${id}`);
  return res.data;
}

export async function createProject(input: ProjectWriteInput): Promise<{ id: string }> {
  const res = await apiClient.post<Envelope<{ id: string }>>(BASE, input, csrf());
  return res.data;
}

export async function updateProject(
  id: string,
  input: Partial<ProjectWriteInput> & { version: number },
): Promise<Project> {
  const res = await apiClient.patch<Envelope<Project>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

export async function changeProjectStatus(
  id: string,
  action: StatusAction,
  version: number,
): Promise<Project> {
  const res = await apiClient.post<Envelope<Project>>(
    `${BASE}/${id}/status`,
    { action, version },
    csrf(),
  );
  return res.data;
}
