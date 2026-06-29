import "server-only";
import { cookies } from "next/headers";
import { parseSessionUser, SESSION_COOKIE, type SafeUser } from "./session";

/**
 * Read the current session on the server (shell layout, route handlers, server
 * components). Returns the safe user or null. NEVER returns tokens — those are in
 * httpOnly cookies the BFF manages (ADR-0003 F5, skill §4).
 */
export async function getServerSession(): Promise<SafeUser | null> {
  const store = await cookies();
  return parseSessionUser(store.get(SESSION_COOKIE)?.value);
}
