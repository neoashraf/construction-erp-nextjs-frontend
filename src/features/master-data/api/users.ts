import { apiClient } from "@/lib/api";
import { type UserRef } from "../types";

/** Users read for the project-manager picker (AUD `GET /api/users`). */
export async function listUsers(): Promise<UserRef[]> {
  const res = await apiClient.get<{ data: UserRef[] }>("/users?pageSize=200");
  return res.data;
}
