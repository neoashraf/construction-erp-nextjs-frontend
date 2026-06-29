import { NextRequest } from "next/server";
import { handleProxy } from "@/lib/bff/proxy";

/**
 * Catch-all BFF proxy. Any `/api/<...>` request that is not one of the dedicated
 * route handlers (auth/login, auth/refresh, auth/logout, auth/me — those are more
 * specific static routes and take precedence) is forwarded to NestJS through the
 * cookie→bearer bridge, with refresh-on-401 + rotation + one retry (skill §4).
 */

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return handleProxy(req, path);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
