import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server-session";

/**
 * Session read for the UI (skill §4). Returns the safe `user` from the httpOnly
 * session cookie, or 401 when unauthenticated. NEVER returns tokens. Client code
 * uses this (or the server-rendered session in the shell) to read role + scope.
 */
export async function GET() {
  const user = await getServerSession();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated", details: null } },
      { status: 401 },
    );
  }
  return NextResponse.json({ user }, { status: 200 });
}
