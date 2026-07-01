import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { type AccountGroup, type Account, type AccountType } from "../types";

/**
 * Chart-of-accounts API bindings (API contract 01 §§ Account Groups + Accounts).
 * The full tree is fetched unpaginated (groups + accounts) and nested client-side.
 * Central `{ data, meta }` envelope unwrapped here; state-changing calls echo CSRF.
 */

const GROUPS = "/masters/account-groups";
const ACCOUNTS = "/masters/accounts";

interface Envelope<T> {
  data: T;
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface AccountGroupInput {
  name: string;
  parentGroupId: string | null;
  type: AccountType;
}

export interface AccountInput {
  code: string;
  name: string;
  accountGroupId: string;
  type: AccountType;
  openingBalance?: string | null;
}

/** GET all account groups (full tree — no pagination). */
export async function listAccountGroups(): Promise<AccountGroup[]> {
  const res = await apiClient.get<Envelope<AccountGroup[]>>(GROUPS);
  return res.data;
}

/** GET all accounts (full set — no pagination). */
export async function listAccounts(): Promise<Account[]> {
  const res = await apiClient.get<Envelope<Account[]>>(ACCOUNTS);
  return res.data;
}

export async function createAccountGroup(input: AccountGroupInput): Promise<{ id: string }> {
  const res = await apiClient.post<Envelope<{ id: string }>>(GROUPS, input, csrf());
  return res.data;
}

export async function updateAccountGroup(
  id: string,
  input: { name?: string; parentGroupId?: string | null; version: number },
): Promise<AccountGroup> {
  const res = await apiClient.patch<Envelope<AccountGroup>>(`${GROUPS}/${id}`, input, csrf());
  return res.data;
}

export async function createAccount(input: AccountInput): Promise<{ id: string }> {
  const res = await apiClient.post<Envelope<{ id: string }>>(ACCOUNTS, input, csrf());
  return res.data;
}

export async function updateAccount(
  id: string,
  input: Partial<AccountInput> & { version: number },
): Promise<Account> {
  const res = await apiClient.patch<Envelope<Account>>(`${ACCOUNTS}/${id}`, input, csrf());
  return res.data;
}

export async function deactivateAccount(id: string, version: number): Promise<Account> {
  const res = await apiClient.post<Envelope<Account>>(
    `${ACCOUNTS}/${id}/deactivate`,
    { version },
    csrf(),
  );
  return res.data;
}

export async function reactivateAccount(id: string, version: number): Promise<Account> {
  const res = await apiClient.post<Envelope<Account>>(
    `${ACCOUNTS}/${id}/reactivate`,
    { version },
    csrf(),
  );
  return res.data;
}
