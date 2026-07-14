import { apiClient } from "@/lib/api";

/**
 * Company + party name/address/BIN/TIN reads for the Mushak 6.3 print preview (brief §5.7,
 * FR-SAL-024). Thin local bindings rather than importing `features/master-data` (skill §2.4
 * import boundary). READ-ONLY. Neither read denormalises names onto the IPC/ledger — the
 * Mushak preview resolves them here and shows "Not on file" for a missing statutory
 * identifier (Open item 3) instead of fabricating one on the document.
 */

interface Envelope<T> {
  data: T;
}

export interface CompanyProfile {
  id: string;
  name: string;
  legalName: string | null;
  bin: string | null;
  tin: string | null;
  address: string | null;
}

export interface PartyProfile {
  id: string;
  name: string;
  bin: string | null;
  tin: string | null;
  address: string | null;
}

export async function getCompanyProfile(id: string): Promise<CompanyProfile> {
  const res = await apiClient.get<Envelope<CompanyProfile>>(`/masters/companies/${id}`);
  return res.data;
}

export async function getPartyProfile(id: string): Promise<PartyProfile> {
  const res = await apiClient.get<Envelope<PartyProfile>>(`/masters/parties/${id}`);
  return res.data;
}
