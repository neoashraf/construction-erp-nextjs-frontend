import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  listAccountGroups,
  listAccounts,
  createAccountGroup,
  updateAccountGroup,
  createAccount,
  updateAccount,
  deactivateAccount,
  reactivateAccount,
  type AccountGroupInput,
  type AccountInput,
} from "../api/chart-of-accounts";

export const COA_KEY = ["master-data", "chart-of-accounts"] as const;

/** All account groups (full tree). */
export function useAccountGroups() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: [...COA_KEY, "groups", user.companyId],
    queryFn: () => listAccountGroups(),
  });
}

/** All accounts (full set). */
export function useAccounts() {
  const user = useAuthenticatedUser();
  return useQuery({
    queryKey: [...COA_KEY, "accounts", user.companyId],
    queryFn: () => listAccounts(),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: COA_KEY });
}

export function useCreateAccountGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (i: AccountGroupInput) => createAccountGroup(i),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useUpdateAccountGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { name?: string; parentGroupId?: string | null; version: number };
    }) => updateAccountGroup(id, input),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useCreateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (i: AccountInput) => createAccount(i),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<AccountInput> & { version: number };
    }) => updateAccount(id, input),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useDeactivateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      deactivateAccount(id, version),
    onSuccess: invalidate,
    retry: false,
  });
}

export function useReactivateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      reactivateAccount(id, version),
    onSuccess: invalidate,
    retry: false,
  });
}
