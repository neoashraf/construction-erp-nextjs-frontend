import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type Company } from "../types";

/**
 * Company API bindings (API contract 01 § Companies). The single company is read by
 * id (the session's companyId); identity edits go to PATCH, localization to PUT.
 * Central response model `{ data, meta }` is unwrapped here. State-changing calls
 * echo the CSRF token (skill §4).
 */

const BASE = "/masters/companies";

interface Envelope<T> {
  data: T;
}

export interface UpdateCompanyIdentityInput {
  name: string;
  legalName?: string | null;
  bin?: string | null;
  tin?: string | null;
  address?: string | null;
  version: number;
}

export interface UpdateLocalizationInput {
  currency: string;
  dateFormat: string;
  locale: string;
  version: number;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

/** GET the company by id. */
export async function getCompany(id: string): Promise<Company> {
  const res = await apiClient.get<Envelope<Company>>(`${BASE}/${id}`);
  return res.data;
}

/** PATCH company identity (name/legalName/bin/tin/address + version). */
export async function updateCompanyIdentity(
  id: string,
  input: UpdateCompanyIdentityInput,
): Promise<Company> {
  const res = await apiClient.patch<Envelope<Company>>(`${BASE}/${id}`, input, csrf());
  return res.data;
}

/** PUT company localization (currency/dateFormat/locale + version). */
export async function updateLocalization(
  id: string,
  input: UpdateLocalizationInput,
): Promise<Company> {
  const res = await apiClient.put<Envelope<Company>>(`${BASE}/${id}/localization`, input, csrf());
  return res.data;
}
