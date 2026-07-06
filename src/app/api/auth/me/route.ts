import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";
import { handleProxy } from "@/lib/bff/proxy";
import { type Role } from "@/lib/auth/roles";
import { type SafeUser, type SessionPermission } from "@/lib/auth/session";

/**
 * Session read for the UI (FE-21 — FR-AUD-031/032/033). Proxies the backend
 * `GET /api/auth/me` (through the cookie→bearer bridge with refresh-on-401) and
 * returns the LIVE session projection — identity + `mustChangePassword` +
 * `permissions` + `projectScope` + `approvalLimit` — merged over the cookie
 * identity. On upstream failure it falls back to the cookie's `SafeUser` alone
 * (no `permissions` → the client renders the degraded role-map nav). NEVER
 * returns tokens.
 */

/** The backend SessionView (API contract 05 § GET /api/auth/me). */
interface UpstreamSessionView {
  user?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    companyId?: string;
    financialYearId?: string;
    isActive?: boolean;
    lastLoginAt?: string | null;
    mustChangePassword?: boolean;
  };
  projectScope?: { scope?: "ALL" | "ASSIGNED"; projectIds?: string[] };
  approvalLimit?: string | null;
  permissions?: SessionPermission[];
}

export async function GET(req: NextRequest) {
  const cookieUser = await getServerSession();
  if (!cookieUser) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated", details: null } },
      { status: 401 },
    );
  }

  const upstream = await handleProxy(req, ["auth", "me"]);

  // A hard 401 from upstream (refresh failed → cookies cleared) ends the session.
  if (upstream.status === 401) return upstream;

  if (upstream.status === 200) {
    try {
      const body = (await upstream.json()) as { data?: UpstreamSessionView } | UpstreamSessionView;
      const view: UpstreamSessionView = (body && "data" in body && body.data ? body.data : body) as UpstreamSessionView;
      const scope = view.projectScope;
      const projectScope =
        scope?.scope === "ALL" ? ("ALL" as const) : { projectIds: scope?.projectIds ?? [] };
      const user: SafeUser = {
        ...cookieUser,
        // Live identity fields win over the (login-time) cookie snapshot.
        ...(view.user?.name !== undefined && { name: view.user.name }),
        ...(view.user?.email !== undefined && { email: view.user.email }),
        ...(view.user?.role !== undefined && { role: view.user.role as Role }),
        ...(view.user?.financialYearId !== undefined && { financialYearId: view.user.financialYearId }),
        ...(view.user?.lastLoginAt !== undefined && { lastLoginAt: view.user.lastLoginAt }),
        mustChangePassword: view.user?.mustChangePassword ?? false,
        permissions: view.permissions ?? [],
        projectScope,
        approvalLimit: view.approvalLimit ?? null,
        assignedProjectIds: projectScope === "ALL" ? (cookieUser.assignedProjectIds ?? []) : projectScope.projectIds,
      };
      const res = NextResponse.json({ user }, { status: 200 });
      // Preserve any rotated auth cookies from the refresh-on-401 path.
      for (const cookie of upstream.headers.getSetCookie()) res.headers.append("set-cookie", cookie);
      return res;
    } catch {
      // Unparseable upstream body — fall through to the degraded cookie session.
    }
  }

  // Degraded: upstream unreachable / non-401 error — identity only, no permissions,
  // so the shell still renders with the role-map fallback (spec §6 partial state).
  return NextResponse.json({ user: cookieUser }, { status: 200 });
}
