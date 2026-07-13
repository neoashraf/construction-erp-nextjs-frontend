import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createEmployee,
  deactivateEmployee,
  reactivateEmployee,
  reassignEmployee,
  updateEmployee,
  type EmployeeCreateInput,
  type EmployeeUpdateInput,
  type ReassignInput,
} from "../api/employees";

/**
 * Employee mutations (FR-HR-001, -002, -003). Every mutation invalidates the list + the
 * affected detail + the assignment history so the UI reconciles to server state — no
 * optimistic updates (server-confirmed). `retry:false` — non-idempotent writes.
 */
export function useEmployeeMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["hr", "employees", "list"] });
    if (id) {
      qc.invalidateQueries({ queryKey: ["hr", "employees", "detail", id] });
      qc.invalidateQueries({ queryKey: ["hr", "employees", "assignments", id] });
    }
  };

  const create = useMutation({
    mutationFn: (input: EmployeeCreateInput) => createEmployee(input),
    onSuccess: () => invalidate(),
    retry: false,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: EmployeeUpdateInput }) => updateEmployee(id, input),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  const reassign = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReassignInput }) => reassignEmployee(id, input),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  const deactivate = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deactivateEmployee(id, version),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  const reactivate = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => reactivateEmployee(id, version),
    onSuccess: (_d, { id }) => invalidate(id),
    retry: false,
  });

  return { create, update, reassign, deactivate, reactivate };
}
