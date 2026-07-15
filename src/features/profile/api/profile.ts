import { apiClient } from "@/lib/api/client";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { networkError, toApiError } from "@/lib/api/errors";
import { type ProfileUpdate, type ProfileView } from "../types";

/**
 * FE-52 profile API — thin BFF wrappers for the four `/api/profile*` routes
 * (contract 17). GET/PATCH go through `apiClient` (JSON via the proxy);
 * upload/delete-image are one-off — upload uses `fetch` directly because the
 * catch-all proxy assumes JSON, so a dedicated `/api/profile/image` route
 * handles multipart bodies (see `src/app/api/profile/image/route.ts`).
 */

type Envelope<T> = { data: T };

export function getProfile(): Promise<ProfileView> {
  return apiClient.get<Envelope<ProfileView>>("/profile").then((r) => r.data);
}

export function updateProfile(body: ProfileUpdate): Promise<ProfileView> {
  return apiClient
    .patch<Envelope<ProfileView>>("/profile", body, { csrfToken: readCsrfToken() })
    .then((r) => r.data);
}

export function deleteAvatar(): Promise<ProfileView> {
  return apiClient
    .delete<Envelope<ProfileView>>("/profile/image", { csrfToken: readCsrfToken() })
    .then((r) => r.data);
}

/**
 * Multipart upload — bypasses `apiClient` (JSON-only) and hits the dedicated
 * route handler at `/api/profile/image` which reads FormData server-side.
 * The pre-check for type/size runs on the client BEFORE we get here.
 */
export async function uploadAvatar(file: File): Promise<ProfileView> {
  const form = new FormData();
  form.append("image", file);
  const csrf = readCsrfToken();
  let res: Response;
  try {
    res = await fetch("/api/profile/image", {
      method: "POST",
      credentials: "include",
      headers: csrf ? { "x-csrf-token": csrf } : undefined,
      body: form,
    });
  } catch {
    throw networkError();
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) throw toApiError(body, res.status, res.statusText);
  return (body as Envelope<ProfileView>).data;
}
