import { apiClient } from "@/lib/api";
import { type ProjectOption } from "../types";

/**
 * HR-local picker options over the MAS list endpoints. Same import-boundary pattern as
 * the SAL/REQ/INV masters bindings (skill §2.4): HR owns this thin binding rather than
 * importing `features/master-data`. Company implicit from the JWT; PM readers are scoped
 * server-side. Used by the create drawer + Reassign dialog to populate the project select.
 */
export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{ data: ProjectOption[] }>("/masters/projects?page=1&pageSize=500");
  return res.data;
}
