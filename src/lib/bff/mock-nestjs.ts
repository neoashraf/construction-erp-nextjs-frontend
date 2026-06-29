import "server-only";

/**
 * In-process mock of the NestJS auth API (API contract 05), used only when
 * `USE_MOCK_NESTJS=true` for e2e / local dev without a live backend. It implements
 * exactly the auth slice the scaffold integrates against, with the documented
 * error codes — enough to exercise the BFF: login → bearer-proxied request →
 * refresh-on-401 + rotation → logout. NEVER enabled in production.
 *
 * Token convention (mock-only): an access token encodes its expiry so the proxy
 * can be driven to a TOKEN_EXPIRED path deterministically.
 *   access:<userKey>:<expEpochMs>      refresh:<userKey>:<jti>
 */

interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  financialYearId: string;
  isActive: boolean;
  password: string;
  assignedProjectIds: string[];
}

const USERS: Record<string, MockUser> = {
  "admin@ze.test": {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin@ze.test",
    name: "Admin User",
    role: "ADMIN",
    companyId: "11111111-1111-1111-1111-111111111111",
    financialYearId: "22222222-2222-2222-2222-222222222222",
    isActive: true,
    password: "Passw0rd!",
    assignedProjectIds: [],
  },
  "pm@ze.test": {
    id: "00000000-0000-0000-0000-000000000002",
    email: "pm@ze.test",
    name: "Project Manager",
    role: "PROJECT_MANAGER",
    companyId: "11111111-1111-1111-1111-111111111111",
    financialYearId: "22222222-2222-2222-2222-222222222222",
    isActive: true,
    password: "Passw0rd!",
    assignedProjectIds: ["proj-a", "proj-b"],
  },
};

// Revoked refresh jtis (logout / rotation). Module-scoped — fine for a single
// mock process during e2e.
const revokedJtis = new Set<string>();
let jtiCounterSeed = 1000;

const ACCESS_TTL_MS = 15 * 60 * 1000;

function safeUser(u: MockUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    companyId: u.companyId,
    financialYearId: u.financialYearId,
    isActive: u.isActive,
    lastLoginAt: null,
    assignedProjectIds: u.assignedProjectIds,
  };
}

function envelope(code: string, message: string) {
  return { error: { code, message, details: null } };
}

function makeAccess(userKey: string, ttlMs = ACCESS_TTL_MS): string {
  // The exp is purely deterministic — the mock does not read the clock so e2e is
  // stable. A ttlMs<=0 yields an already-expired token.
  return `access:${userKey}:${ttlMs}`;
}

function makeRefresh(userKey: string): string {
  jtiCounterSeed += 1;
  return `refresh:${userKey}:${jtiCounterSeed}`;
}

/** Parse an access token; returns its userKey, or null if the form/marker says expired. */
function readAccess(token: string): { userKey: string; expired: boolean } | null {
  const m = /^access:([^:]+):(-?\d+)$/.exec(token);
  if (!m) return null;
  const ttl = Number(m[2]);
  return { userKey: m[1]!, expired: ttl <= 0 };
}

function readRefresh(token: string): { userKey: string; jti: string } | null {
  const m = /^refresh:([^:]+):(\d+)$/.exec(token);
  if (!m) return null;
  return { userKey: m[1]!, jti: m[2]! };
}

interface MockReq {
  path: string;
  method: string;
  json?: unknown;
  bearer?: string;
}

interface MockResult {
  status: number;
  body: unknown;
}

export async function mockNestjsFetch(req: MockReq): Promise<MockResult> {
  const body = (req.json ?? {}) as Record<string, unknown>;

  // ── POST /auth/login ──
  if (req.path === "/auth/login" && req.method === "POST") {
    const email = String(body.email ?? "");
    const rawPassword = String(body.password ?? "");
    // e2e marker: a trailing "#expired" requests an already-expired access token.
    // Strip it before the credential check so the real password still matches.
    const wantExpired = rawPassword.endsWith("#expired");
    const password = wantExpired ? rawPassword.slice(0, -"#expired".length) : rawPassword;
    if (!email || !password) {
      return { status: 400, body: envelope("VALIDATION_ERROR", "email and password are required") };
    }
    const user = USERS[email];
    // Uniform failure — no email enumeration (contract 05).
    if (!user || user.password !== password || !user.isActive) {
      return { status: 401, body: envelope("INVALID_CREDENTIALS", "Invalid email or password") };
    }
    // For e2e: an access token that is already expired when the special password
    // marker is used, so the proxy refresh path can be driven. Default = valid.
    const ttl = wantExpired ? -1 : ACCESS_TTL_MS;
    return {
      status: 200,
      body: {
        accessToken: makeAccess(email, ttl),
        refreshToken: makeRefresh(email),
        expiresIn: 900,
        user: safeUser(user),
      },
    };
  }

  // ── POST /auth/refresh ──
  if (req.path === "/auth/refresh" && req.method === "POST") {
    const refreshToken = String(body.refreshToken ?? "");
    const parsed = readRefresh(refreshToken);
    if (!parsed || revokedJtis.has(parsed.jti)) {
      return { status: 401, body: envelope("INVALID_CREDENTIALS", "Refresh token invalid or revoked") };
    }
    const user = USERS[parsed.userKey];
    if (!user) return { status: 401, body: envelope("INVALID_CREDENTIALS", "Refresh token invalid") };
    if (!user.isActive) return { status: 403, body: envelope("FORBIDDEN", "Account deactivated") };
    // Rotate: revoke the old jti, mint a fresh access + refresh.
    revokedJtis.add(parsed.jti);
    return {
      status: 200,
      body: {
        accessToken: makeAccess(parsed.userKey),
        refreshToken: makeRefresh(parsed.userKey),
        expiresIn: 900,
      },
    };
  }

  // ── POST /auth/logout ──
  if (req.path === "/auth/logout" && req.method === "POST") {
    const refreshToken = String(body.refreshToken ?? "");
    const parsed = readRefresh(refreshToken);
    if (parsed) revokedJtis.add(parsed.jti);
    return { status: 204, body: null }; // idempotent
  }

  // ── POST /auth/change-password ──
  if (req.path === "/auth/change-password" && req.method === "POST") {
    if (!req.bearer) return { status: 401, body: envelope("UNAUTHORIZED", "Missing token") };
    const access = readAccess(req.bearer);
    if (!access) return { status: 401, body: envelope("UNAUTHORIZED", "Malformed token") };
    if (access.expired) return { status: 401, body: envelope("TOKEN_EXPIRED", "Access token expired") };
    const current = String(body.currentPassword ?? "");
    const user = USERS[access.userKey];
    if (!user || user.password !== current) {
      return { status: 401, body: envelope("INVALID_CREDENTIALS", "Current password is wrong") };
    }
    return { status: 204, body: null };
  }

  // ── Any other path = a proxied authenticated resource (bearer required) ──
  if (!req.bearer) return { status: 401, body: envelope("UNAUTHORIZED", "Missing access token") };
  const access = readAccess(req.bearer);
  if (!access) return { status: 401, body: envelope("UNAUTHORIZED", "Malformed access token") };
  if (access.expired) return { status: 401, body: envelope("TOKEN_EXPIRED", "Access token expired") };
  const user = USERS[access.userKey];
  if (!user) return { status: 401, body: envelope("UNAUTHORIZED", "Unknown subject") };
  if (!user.isActive) return { status: 403, body: envelope("FORBIDDEN", "Account deactivated") };

  // A tiny sample protected resource for the proxy/refresh e2e.
  if (req.path === "/auth/me") {
    return { status: 200, body: { user: safeUser(user) } };
  }
  return { status: 200, body: { ok: true, path: req.path } };
}
