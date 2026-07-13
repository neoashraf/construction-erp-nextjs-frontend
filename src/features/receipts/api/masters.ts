import { apiClient } from "@/lib/api";
import { type CustomerOption, type ProjectOption } from "../types";

/**
 * Read-only picker options for the Receipt list filter bar. Thin local bindings to
 * the MAS list endpoints (nextjs-author skill §2.4 import boundary — REC owns these
 * rather than importing `features/master-data`, mirroring the PUR/SAL precedent).
 * Company implicit from the JWT; the server scopes a project-scoped reader (PM) to
 * assigned projects regardless of what this picker shows. Customers come from the
 * shared Parties list filtered by `isCustomer=true`.
 */

export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{ data: ProjectOption[] }>(
    "/masters/projects?page=1&pageSize=500",
  );
  return res.data;
}

export async function listCustomerOptions(): Promise<CustomerOption[]> {
  const res = await apiClient.get<{
    data: Array<{ id: string; name: string; isActive?: boolean }>;
  }>("/masters/parties?isCustomer=true&page=1&pageSize=500");
  return res.data.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive ?? true }));
}
