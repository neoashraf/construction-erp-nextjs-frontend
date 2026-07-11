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

// ── Master-data sample (dev/preview only) ────────────────────────────────────
// A tiny in-memory slice so the master screens render populated when running
// against the mock (USE_MOCK_NESTJS=true) without a live NestJS/DB. Mirrors the
// Purposes design-file sample. NEVER used in production.
interface MockProject {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  isActive: boolean;
  version: number;
}
interface MockPurpose {
  id: string;
  projectId: string;
  name: string;
  isActive: boolean;
  version: number;
}
interface MockParty {
  id: string;
  name: string;
  isCustomer: boolean;
  isSupplier: boolean;
  tin: string | null;
  bin: string | null;
  address: string | null;
  phone: string;
  email: string | null;
  paymentTermsDays: number | null;
  openingBalance: string | null;
  isActive: boolean;
  version: number;
}
const MOCK_PROJECTS: MockProject[] = [
  { id: "proj-a", projectCode: "BR-04", name: "Bridge-04 — Buriganga", status: "ACTIVE", isActive: true, version: 1 },
  { id: "proj-b", projectCode: "TW-A", name: "Tower-A — Gulshan", status: "ACTIVE", isActive: true, version: 1 },
  { id: "proj-c", projectCode: "RD-12", name: "Road-12 — Savar", status: "ACTIVE", isActive: true, version: 1 },
];

// ── Cost-control sample data (dev/preview only) ──
const MOCK_COST_CENTRES = [
  { id: "cc-mat", code: "CC-01", name: "Materials — Cement & Steel", isActive: true },
  { id: "cc-lab", code: "CC-02", name: "শ্রমিক মজুরি — Site Labour", isActive: true },
  { id: "cc-fuel", code: "CC-03", name: "Fuel & Lubricants", isActive: true },
  { id: "cc-sub", code: "CC-04", name: "Subcontractor Works", isActive: true },
  { id: "cc-tmp", code: "CC-05", name: "অস্থায়ী কাজ — Temporary works", isActive: false },
  { id: "cc-equip", code: "CC-06", name: "Equipment Rental & Hire", isActive: true },
  { id: "cc-survey", code: "CC-07", name: "Survey & Testing", isActive: true },
  { id: "cc-transport", code: "CC-08", name: "Transport & Logistics", isActive: true },
  { id: "cc-overhead", code: "CC-09", name: "Site Overheads", isActive: true },
  { id: "cc-safety", code: "CC-10", name: "Safety & Compliance", isActive: true },
  { id: "cc-power", code: "CC-11", name: "Utilities & Site Power", isActive: true },
];

const MOCK_FINANCIAL_YEARS = [
  { id: "fy-2025-26", label: "FY 2025–26", isActive: true },
  { id: "fy-2024-25", label: "FY 2024–25", isActive: false },
];

/** Budget-vs-actual rows for Bridge-04 (proj-a) — mirrors the design sample. */
const MOCK_BVA_ROWS = [
  { costCentreId: "cc-mat", budgetedAmount: "1200000000.0000", actualCost: "1296000000.0000", variance: "-96000000.0000", utilisationPct: "108.0000", status: "OVER" },
  { costCentreId: "cc-lab", budgetedAmount: "450000000.0000", actualCost: "418500000.0000", variance: "31500000.0000", utilisationPct: "93.0000", status: "APPROACHING" },
  { costCentreId: "cc-fuel", budgetedAmount: "120000000.0000", actualCost: "111000000.0000", variance: "9000000.0000", utilisationPct: "92.5000", status: "APPROACHING" },
  { costCentreId: "cc-sub", budgetedAmount: "900000000.0000", actualCost: "612000000.0000", variance: "288000000.0000", utilisationPct: "68.0000", status: "OK" },
  { costCentreId: "cc-tmp", budgetedAmount: "80000000.0000", actualCost: "54400000.0000", variance: "25600000.0000", utilisationPct: "68.0000", status: "OK" },
  { costCentreId: "cc-equip", budgetedAmount: "300000000.0000", actualCost: "195000000.0000", variance: "105000000.0000", utilisationPct: "65.0000", status: "OK" },
  { costCentreId: "cc-survey", budgetedAmount: "50000000.0000", actualCost: "31000000.0000", variance: "19000000.0000", utilisationPct: "62.0000", status: "OK" },
  { costCentreId: "cc-transport", budgetedAmount: "150000000.0000", actualCost: "88500000.0000", variance: "61500000.0000", utilisationPct: "59.0000", status: "OK" },
  { costCentreId: "cc-overhead", budgetedAmount: "180000000.0000", actualCost: "97200000.0000", variance: "82800000.0000", utilisationPct: "54.0000", status: "OK" },
  { costCentreId: "cc-safety", budgetedAmount: "60000000.0000", actualCost: "25800000.0000", variance: "34200000.0000", utilisationPct: "43.0000", status: "OK" },
  { costCentreId: "cc-power", budgetedAmount: null, actualCost: "12000000.0000", variance: null, utilisationPct: null, status: "UNBUDGETED" },
];
const MOCK_PURPOSES: MockPurpose[] = [
  { id: "pp-1", projectId: "proj-a", name: "Material Purchase", isActive: true, version: 1 },
  { id: "pp-2", projectId: "proj-a", name: "Labour Payment", isActive: true, version: 1 },
  { id: "pp-3", projectId: "proj-a", name: "Equipment Rental", isActive: true, version: 1 },
  { id: "pp-4", projectId: "proj-a", name: "Site Office", isActive: true, version: 1 },
  { id: "pp-5", projectId: "proj-a", name: "Transport & Carrying", isActive: true, version: 1 },
  { id: "pp-6", projectId: "proj-a", name: "Mobilization Advance · গতিশীলতা অগ্রিম", isActive: true, version: 1 },
  { id: "pp-7", projectId: "proj-a", name: "Subcontractor Payment", isActive: true, version: 1 },
  { id: "pp-8", projectId: "proj-a", name: "Safety Equipment · নিরাপত্তা সরঞ্জাম", isActive: true, version: 1 },
  { id: "pp-9", projectId: "proj-a", name: "Temporary Fencing (legacy)", isActive: false, version: 1 },
  { id: "pp-10", projectId: "proj-b", name: "Finishing Works", isActive: true, version: 1 },
  { id: "pp-11", projectId: "proj-b", name: "Lift & MEP", isActive: true, version: 1 },
];
let mockPurposeSeq = 500;

// Mirrors the Parties design-file sample so the list renders populated against the mock.
const MOCK_PARTIES: MockParty[] = [
  { id: "pa-1", name: "ABC Cement Co.", isCustomer: true, isSupplier: true, tin: "123456789012", bin: "001234567-0101", address: "Plot 7, Tejgaon I/A, Dhaka 1208", phone: "+8801712345678", email: "accounts@abccement.com.bd", paymentTermsDays: 30, openingBalance: "0.0000", isActive: true, version: 1 },
  { id: "pa-2", name: "Shah Cement Ltd.", isCustomer: false, isSupplier: true, tin: "556677889900", bin: "004455667-0202", address: null, phone: "+8801811223344", email: null, paymentTermsDays: 15, openingBalance: "0.0000", isActive: true, version: 1 },
  { id: "pa-3", name: "মেঘনা স্টিল মিলস", isCustomer: false, isSupplier: true, tin: "778899001122", bin: null, address: null, phone: "+8801999887766", email: null, paymentTermsDays: 45, openingBalance: "0.0000", isActive: true, version: 1 },
  { id: "pa-4", name: "Tower-A Developments Ltd.", isCustomer: true, isSupplier: false, tin: "334455667788", bin: "009988776-0303", address: "Gulshan Avenue, Dhaka 1212", phone: "+8801712009988", email: "finance@tower-a.com", paymentTermsDays: 0, openingBalance: "0.0000", isActive: true, version: 1 },
  { id: "pa-5", name: "M/s Rahman Traders", isCustomer: false, isSupplier: true, tin: null, bin: null, address: null, phone: "+8801677554433", email: null, paymentTermsDays: 7, openingBalance: "0.0000", isActive: false, version: 1 },
  { id: "pa-6", name: "Bashundhara Group", isCustomer: false, isSupplier: true, tin: "990011223344", bin: "003322110-0404", address: null, phone: "+8801511990022", email: null, paymentTermsDays: 30, openingBalance: "0.0000", isActive: true, version: 1 },
  { id: "pa-7", name: "করিম এন্টারপ্রাইজ", isCustomer: true, isSupplier: false, tin: "445566778899", bin: null, address: "১২/বি, নিউ মার্কেট, ঢাকা ১২০৫", phone: "+8801733221100", email: null, paymentTermsDays: 60, openingBalance: "0.0000", isActive: true, version: 1 },
  { id: "pa-8", name: "National Housing Authority", isCustomer: true, isSupplier: false, tin: "112233445566", bin: "006677889-0505", address: null, phone: "+8801866003311", email: null, paymentTermsDays: 90, openingBalance: "0.0000", isActive: true, version: 1 },
  { id: "pa-9", name: "Padma Aggregates Ltd.", isCustomer: false, isSupplier: true, tin: "667788990011", bin: null, address: null, phone: "+8801799112233", email: null, paymentTermsDays: 14, openingBalance: "0.0000", isActive: false, version: 1 },
  { id: "pa-10", name: "Zenith Interiors", isCustomer: true, isSupplier: true, tin: "220033445566", bin: "001122334-0606", address: null, phone: "+8801600224466", email: null, paymentTermsDays: 30, openingBalance: "0.0000", isActive: true, version: 1 },
];
let mockPartySeq = 800;

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

/** Wrap a success payload in the platform's `{ data, meta }` envelope (overview §6). */
function success(data: unknown) {
  return { data, meta: { requestId: `mock-${jtiCounterSeed}` } };
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
      body: success({
        accessToken: makeAccess(email, ttl),
        refreshToken: makeRefresh(email),
        expiresIn: 900,
        user: safeUser(user),
      }),
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
      body: success({
        accessToken: makeAccess(parsed.userKey),
        refreshToken: makeRefresh(parsed.userKey),
        expiresIn: 900,
      }),
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
    return { status: 200, body: success({ user: safeUser(user) }) };
  }

  // ── Master-data sample endpoints (dev/preview only) ──
  // Split path from the querystring (the proxy forwards `?page=…` verbatim).
  const [pathname, rawQuery = ""] = req.path.split("?");
  const params = new URLSearchParams(rawQuery);
  const pageEnvelope = (rows: unknown[]) => ({
    data: rows,
    meta: { requestId: `mock-${jtiCounterSeed}`, page: 1, pageSize: rows.length || 25, total: rows.length },
  });

  // GET /masters/projects — list (PM sees only assigned projects; Admin sees all).
  if (pathname === "/masters/projects" && req.method === "GET") {
    const scoped =
      user.assignedProjectIds.length > 0
        ? MOCK_PROJECTS.filter((p) => user.assignedProjectIds.includes(p.id))
        : MOCK_PROJECTS;
    return { status: 200, body: pageEnvelope(scoped) };
  }

  // GET /masters/cost-centres — company-global list (active + inactive-with-history).
  if (pathname === "/masters/cost-centres" && req.method === "GET") {
    return { status: 200, body: pageEnvelope(MOCK_COST_CENTRES) };
  }

  // GET /masters/financial-years — the company's financial years.
  if (pathname === "/masters/financial-years" && req.method === "GET") {
    return { status: 200, body: pageEnvelope(MOCK_FINANCIAL_YEARS) };
  }

  // GET /cost-control/budget-vs-actual — read projection over LED + MAS budgets.
  if (pathname === "/cost-control/budget-vs-actual" && req.method === "GET") {
    const projectId = params.get("projectId") ?? "";
    const costCentreId = params.get("costCentreId") ?? "";
    const statusCsv = params.get("status");
    const wanted = statusCsv ? new Set(statusCsv.split(",")) : null;
    // PM scope: reject an unassigned project (FR-CC-016).
    if (projectId && user.assignedProjectIds.length > 0 && !user.assignedProjectIds.includes(projectId)) {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    let rows: Array<Record<string, unknown>> = [];
    if (projectId) {
      rows = MOCK_BVA_ROWS.map((r) => ({ projectId, ...r }));
    } else if (costCentreId) {
      // one cost centre across projects (a small cross-project sample).
      const base = MOCK_BVA_ROWS.find((r) => r.costCentreId === costCentreId) ?? MOCK_BVA_ROWS[3];
      rows = MOCK_PROJECTS.slice(0, 2).map((p) => ({ projectId: p.id, ...base, costCentreId }));
    }
    if (wanted) rows = rows.filter((r) => wanted.has(r.status as string));
    return { status: 200, body: pageEnvelope(rows) };
  }

  // /masters/parties[/:id[/(deactivate|reactivate)]]
  const partyMatch = /^\/masters\/parties(?:\/([^/]+)(?:\/(deactivate|reactivate))?)?$/.exec(
    pathname ?? "",
  );
  if (partyMatch) {
    const targetId = partyMatch[1];
    const action = partyMatch[2];

    // GET list (isCustomer/isSupplier/isActive/q filters + naive paging).
    if (req.method === "GET" && !targetId) {
      const wantCustomer = params.get("isCustomer") === "true";
      const wantSupplier = params.get("isSupplier") === "true";
      const activeOnly = params.get("isActive") === "true";
      const q = (params.get("q") ?? "").toLowerCase().trim();
      let rows = MOCK_PARTIES.slice();
      if (wantCustomer) rows = rows.filter((p) => p.isCustomer);
      if (wantSupplier) rows = rows.filter((p) => p.isSupplier);
      if (activeOnly) rows = rows.filter((p) => p.isActive);
      if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q));
      const total = rows.length;
      const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
      const pageSize = Math.max(1, Number(params.get("pageSize") ?? 25) || 25);
      const paged = rows.slice((page - 1) * pageSize, page * pageSize);
      return {
        status: 200,
        body: { data: paged, meta: { requestId: `mock-${jtiCounterSeed}`, page, pageSize, total } },
      };
    }

    // GET one.
    if (req.method === "GET" && targetId && !action) {
      const target = MOCK_PARTIES.find((p) => p.id === targetId);
      if (!target) return { status: 404, body: envelope("NOT_FOUND", "Party not found") };
      return { status: 200, body: success(target) };
    }

    // POST create.
    if (req.method === "POST" && !targetId) {
      const b = body as Partial<MockParty>;
      const name = String(b.name ?? "").trim();
      if (!name) return { status: 400, body: envelope("VALIDATION_ERROR", "name is required") };
      const np: MockParty = {
        id: `pa-${(mockPartySeq += 1)}`,
        name,
        isCustomer: !!b.isCustomer,
        isSupplier: !!b.isSupplier,
        tin: b.tin ?? null,
        bin: b.bin ?? null,
        address: b.address ?? null,
        phone: String(b.phone ?? ""),
        email: b.email ?? null,
        paymentTermsDays: b.paymentTermsDays ?? null,
        openingBalance: b.openingBalance ?? null,
        isActive: true,
        version: 1,
      };
      MOCK_PARTIES.unshift(np);
      return { status: 201, body: success({ id: np.id }) };
    }

    // PATCH update (optimistic version bump).
    if (req.method === "PATCH" && targetId) {
      const target = MOCK_PARTIES.find((p) => p.id === targetId);
      if (!target) return { status: 404, body: envelope("NOT_FOUND", "Party not found") };
      const b = body as Partial<MockParty>;
      Object.assign(target, {
        name: b.name != null ? String(b.name).trim() : target.name,
        isCustomer: b.isCustomer != null ? !!b.isCustomer : target.isCustomer,
        isSupplier: b.isSupplier != null ? !!b.isSupplier : target.isSupplier,
        tin: b.tin !== undefined ? b.tin : target.tin,
        bin: b.bin !== undefined ? b.bin : target.bin,
        address: b.address !== undefined ? b.address : target.address,
        phone: b.phone != null ? String(b.phone) : target.phone,
        email: b.email !== undefined ? b.email : target.email,
        paymentTermsDays:
          b.paymentTermsDays !== undefined ? b.paymentTermsDays : target.paymentTermsDays,
        openingBalance:
          b.openingBalance !== undefined ? b.openingBalance : target.openingBalance,
        version: target.version + 1,
      });
      return { status: 200, body: success(target) };
    }

    // POST deactivate / reactivate.
    if (req.method === "POST" && targetId && action) {
      const target = MOCK_PARTIES.find((p) => p.id === targetId);
      if (!target) return { status: 404, body: envelope("NOT_FOUND", "Party not found") };
      target.isActive = action === "reactivate";
      target.version += 1;
      return { status: 200, body: success(target) };
    }
  }

  // /masters/projects/:id/purposes[/:id/(deactivate|reactivate)]
  const pm = /^\/masters\/projects\/([^/]+)\/purposes(?:\/([^/]+)\/(deactivate|reactivate))?$/.exec(
    pathname ?? "",
  );
  if (pm) {
    const projectId = pm[1]!;
    const targetId = pm[2];
    const action = pm[3];

    if (req.method === "GET") {
      const activeOnly = params.get("isActive") === "true";
      const q = (params.get("q") ?? "").toLowerCase();
      let rows = MOCK_PURPOSES.filter((p) => p.projectId === projectId);
      if (activeOnly) rows = rows.filter((p) => p.isActive);
      if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q));
      return { status: 200, body: pageEnvelope(rows) };
    }
    // POST create (idempotent) — no action segment.
    if (req.method === "POST" && !action) {
      const name = String((body as { name?: unknown }).name ?? "").trim();
      if (!name) return { status: 400, body: envelope("VALIDATION_ERROR", "name is required") };
      const existing = MOCK_PURPOSES.find(
        (p) => p.projectId === projectId && p.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing) return { status: 200, body: success(existing) }; // idempotent
      const np: MockPurpose = {
        id: `pp-${(mockPurposeSeq += 1)}`,
        projectId,
        name,
        isActive: true,
        version: 1,
      };
      MOCK_PURPOSES.push(np);
      return { status: 201, body: success(np) };
    }
    // POST deactivate / reactivate.
    if (req.method === "POST" && action && targetId) {
      const target = MOCK_PURPOSES.find((p) => p.id === targetId);
      if (!target) return { status: 404, body: envelope("NOT_FOUND", "Purpose not found") };
      target.isActive = action === "reactivate";
      target.version += 1;
      return { status: 200, body: success(target) };
    }
    // PATCH rename.
    if (req.method === "PATCH" && targetId) {
      const target = MOCK_PURPOSES.find((p) => p.id === targetId);
      if (!target) return { status: 404, body: envelope("NOT_FOUND", "Purpose not found") };
      target.name = String((body as { name?: unknown }).name ?? target.name).trim();
      target.version += 1;
      return { status: 200, body: success(target) };
    }
  }

  return { status: 200, body: success({ ok: true, path: req.path }) };
}
