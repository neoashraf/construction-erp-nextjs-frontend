import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import {
  type UserProjectAssignment,
  type AssignedProject,
  type ReplaceAssignedProjectsInput,
} from "../types";

/**
 * User <-> Project assignment API bindings (API contract 05 § User <-> Project
 * assignment, Admin only). `GET` returns either the assigned list or `{ scope:
 * "ALL" }` for an unscoped role; `PUT` is an idempotent full-set replace with
 * **no** `version` field on the join (SRS §16 — last-writer-wins on the whole
 * set by design; do not add one here).
 */

const BASE = "/users";

interface Envelope<T> {
  data: T;
}

interface AssignedProjectWire {
  projectId: string;
  projectName?: string | null;
}

type GetProjectsWire = AssignedProjectWire[] | { scope: "ALL" };

function toAssignment(wire: GetProjectsWire): UserProjectAssignment {
  if (!Array.isArray(wire)) {
    return { scope: "ALL" };
  }
  const projects: AssignedProject[] = wire.map((p) => ({
    projectId: p.projectId,
    projectName: p.projectName ?? null,
  }));
  return { scope: "ASSIGNED", projects };
}

function csrf() {
  return { csrfToken: readCsrfToken() };
}

/** GET the user's assigned-project set (or the all-projects scope marker). */
export async function getAssignedProjects(userId: string): Promise<UserProjectAssignment> {
  const res = await apiClient.get<Envelope<GetProjectsWire>>(`${BASE}/${userId}/projects`);
  return toAssignment(res.data);
}

/**
 * PUT the full replacement set (spec §9 — replace, not append). Returns the
 * resulting set as confirmed by the server. No `version` is sent — the join has
 * no per-row optimistic lock by design (SRS §16).
 */
export async function replaceAssignedProjects(
  userId: string,
  input: ReplaceAssignedProjectsInput,
): Promise<AssignedProject[]> {
  const res = await apiClient.put<Envelope<AssignedProjectWire[]>>(
    `${BASE}/${userId}/projects`,
    input,
    csrf(),
  );
  return res.data.map((p) => ({ projectId: p.projectId, projectName: p.projectName ?? null }));
}
