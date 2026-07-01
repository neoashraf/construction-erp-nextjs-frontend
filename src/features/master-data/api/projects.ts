import { apiClient } from "@/lib/api";
import { type Paginated } from "@/lib/api/pagination";
import { type Project } from "../types";

/**
 * Project API bindings (API contract 01 § Projects). Currently just the list read
 * used by project selectors (purposes, godowns); the full projects screen extends this.
 */

const BASE = "/masters/projects";

export interface ProjectListFilter {
  status?: string;
  isActive?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** GET the company's projects (paginated; project pickers use a large page). */
export async function listProjects(filter: ProjectListFilter = {}): Promise<Paginated<Project>> {
  const p = new URLSearchParams();
  if (filter.status) p.set("status", filter.status);
  if (filter.isActive !== undefined) p.set("isActive", String(filter.isActive));
  if (filter.q) p.set("q", filter.q);
  p.set("page", String(filter.page ?? 1));
  p.set("pageSize", String(filter.pageSize ?? 100));
  const res = await apiClient.get<{
    data: Project[];
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
