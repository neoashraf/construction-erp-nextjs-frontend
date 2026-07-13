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

/** A picker option for a cost centre — used by the attendance daily-labour / subcontractor grids. */
export interface CostCentreOption {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
}

export async function listCostCentreOptions(): Promise<CostCentreOption[]> {
  const res = await apiClient.get<{ data: CostCentreOption[] }>("/masters/cost-centres?page=1&pageSize=500");
  return res.data;
}

/** Purpose option — project-scoped picker for the Confirm dialog + capture. */
export interface PurposeOption {
  id: string;
  name: string;
  isActive?: boolean;
}

export async function listPurposeOptions(projectId: string): Promise<PurposeOption[]> {
  if (!projectId) return [];
  const res = await apiClient.get<{ data: PurposeOption[] }>(
    `/masters/projects/${encodeURIComponent(projectId)}/purposes?page=1&pageSize=500`,
  );
  return res.data;
}

/** Party (subcontractor / vendor) options — used by the subcontractor attendance grid. */
export interface PartyOption {
  id: string;
  name: string;
  isActive?: boolean;
}

export async function listSubcontractorPartyOptions(): Promise<PartyOption[]> {
  const res = await apiClient.get<{ data: PartyOption[] }>(
    "/masters/parties?isSupplier=true&isActive=true&page=1&pageSize=500",
  );
  return res.data;
}
