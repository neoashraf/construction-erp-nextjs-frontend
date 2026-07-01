import { apiClient } from "@/lib/api";
import { type ProjectOption } from "../types";

/**
 * Project options for the add-projects picker (API contract 01 § Projects,
 * read-only here — MAS owns the entity). A thin local binding rather than
 * importing `features/master-data` (skill §2.4 import boundary). The backend
 * scopes the list to the caller's company from the token (FR-AUD-027) — never
 * sent as a client param.
 */

interface ProjectWire {
  id: string;
  name: string;
  projectCode: string;
}

/** GET every project in this company, mapped down to `{ id, name, projectCode }` picker options. */
export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{
    data: ProjectWire[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>("/masters/projects?page=1&pageSize=500");
  return res.data.map((p) => ({ id: p.id, name: p.name, projectCode: p.projectCode }));
}
