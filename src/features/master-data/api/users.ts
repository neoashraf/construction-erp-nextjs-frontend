import { apiClient } from "@/lib/api";
import { type UserRef } from "../types";

/**
 * Users read for the project-manager picker (AUD `GET /api/users`). Central
 * `{ data, meta }` envelope, so the caller unwraps `res.data`.
 *
 * Defensive: the PM picker is a non-critical helper on the Projects screen, so a
 * malformed/empty response (or the users endpoint being unavailable) must degrade to
 * an empty option list — never crash the whole screen. We therefore return `[]`
 * whenever `res.data` isn't an array instead of handing a non-iterable to the caller's
 * `.map` (which previously threw "(…).map is not a function").
 */
export async function listUsers(): Promise<UserRef[]> {
  const res = await apiClient.get<{ data?: UserRef[] }>("/users?pageSize=200");
  return Array.isArray(res?.data) ? res.data : [];
}
