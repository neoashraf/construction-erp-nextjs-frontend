import { useQuery } from "@tanstack/react-query";
import { listUsers } from "../api/users";

/** Users for the project-manager picker (AUD `GET /api/users`). */
export function useUsers() {
  return useQuery({ queryKey: ["aud", "users"], queryFn: () => listUsers() });
}
