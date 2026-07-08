import "server-only";
import { cookies } from "next/headers";
import { callUpstream } from "@/lib/bff/upstream";
import { getServerSession } from "./server-session";
import {
  ACCESS_COOKIE,
  type SafeUser,
  type SessionPermission,
  type SessionProjectScope,
} from "./session";
import { type Role } from "./roles";

/**
 * Server-side session ENRICHED with the caller's effective permission set (FE-21 —
 * FR-AUD-031/032/033). The plain cookie session (`getServerSession`) carries only
 * identity + role, so a route guard built on it can only fall back to the static
 * role→module map — which ignores custom grants (e.g. an HR Manager granted the
 * Audit module in Roles & permissions would still be denied). This reads the live
 * projection from the backend `GET /api/auth/me` (bearer from the access cookie) and
 * merges it over the cookie identity, so the guard becomes permission-driven.
 *
 * Degraded fallback: if there's no access token or the upstream call fails, it
 * returns the cookie session ALONE (no `permissions`) — the guard then falls back to
 * the role map, exactly as before. The backend re-checks every call regardless
 * (defence-in-depth), so a too-permissive FE guard can never grant real access.
 */

/** The backend SessionView (API contract 05 § GET /api/auth/me). Mirrors /api/auth/me route. */
interface UpstreamSessionView {
  user?: {
    role?: string;
    name?: string;
    email?: string;
    financialYearId?: string;
    lastLoginAt?: string | null;
    mustChangePassword?: boolean;
  };
  projectScope?: { scope?: "ALL" | "ASSIGNED"; projectIds?: string[] };
  approvalLimit?: string | null;
  permissions?: SessionPermission[];
}

export async function getServerSessionWithPermissions(): Promise<SafeUser | null> {
  const cookieUser = await getServerSession();
  if (!cookieUser) return null;

  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return cookieUser; // degraded → role-map fallback

  const upstream = await callUpstream({ path: "/auth/me", method: "GET", bearer: accessToken });
  if (upstream.status !== 200) return cookieUser; // degraded

  try {
    const body = upstream.body as { data?: UpstreamSessionView } | UpstreamSessionView;
    const view: UpstreamSessionView =
      (body && typeof body === "object" && "data" in body && body.data ? body.data : body) as UpstreamSessionView;

    const scope = view.projectScope;
    const projectScope: SessionProjectScope =
      scope?.scope === "ALL" ? "ALL" : { projectIds: scope?.projectIds ?? [] };

    return {
      ...cookieUser,
      ...(view.user?.role !== undefined && { role: view.user.role as Role }),
      ...(view.user?.name !== undefined && { name: view.user.name }),
      ...(view.user?.email !== undefined && { email: view.user.email }),
      ...(view.user?.financialYearId !== undefined && { financialYearId: view.user.financialYearId }),
      ...(view.user?.lastLoginAt !== undefined && { lastLoginAt: view.user.lastLoginAt }),
      mustChangePassword: view.user?.mustChangePassword ?? false,
      permissions: view.permissions ?? [],
      projectScope,
      approvalLimit: view.approvalLimit ?? null,
      assignedProjectIds:
        projectScope === "ALL" ? (cookieUser.assignedProjectIds ?? []) : projectScope.projectIds,
    };
  } catch {
    return cookieUser; // unparseable → degraded
  }
}
