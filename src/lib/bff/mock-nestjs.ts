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
/** Profitability rows by cost centre (dev/preview) — one loss row (cc-mat) + an inactive CC. */
const MOCK_PROFITABILITY = [
  { costCentreId: "cc-mat", revenue: "480000000.0000", cost: "618000000.0000", profit: "-138000000.0000" },
  { costCentreId: "cc-lab", revenue: "320000000.0000", cost: "176000000.0000", profit: "144000000.0000" },
  { costCentreId: "cc-tmp", revenue: "82000000.0000", cost: "67600000.0000", profit: "14400000.0000" },
  { costCentreId: "cc-sub", revenue: "960000000.0000", cost: "772000000.0000", profit: "188000000.0000" },
  { costCentreId: "cc-equip", revenue: "220000000.0000", cost: "195000000.0000", profit: "25000000.0000" },
  { costCentreId: "cc-transport", revenue: "150000000.0000", cost: "88500000.0000", profit: "61500000.0000" },
];
/** Profitability rows by project (dev/preview) — proj-b runs at a loss. */
const MOCK_PROFITABILITY_BY_PROJECT = [
  { projectId: "proj-a", revenue: "1400000000.0000", cost: "1230000000.0000", profit: "170000000.0000" },
  { projectId: "proj-b", revenue: "620000000.0000", cost: "705000000.0000", profit: "-85000000.0000" },
  { projectId: "proj-c", revenue: "310000000.0000", cost: "240000000.0000", profit: "70000000.0000" },
];

// ── Inventory sample (dev/preview only) ──
interface MockGodown { id: string; code: string; name: string; projectId: string; isActive: boolean }
const MOCK_GODOWNS: MockGodown[] = [
  { id: "gd-a", code: "G-Site-A", name: "Site A store", projectId: "proj-a", isActive: true },
  { id: "gd-b", code: "G-Site-B", name: "Site B store", projectId: "proj-a", isActive: true },
  { id: "gd-c", code: "G-Central", name: "Central warehouse", projectId: "proj-b", isActive: true },
  { id: "gd-d", code: "G-Yard", name: "Yard — Savar", projectId: "proj-c", isActive: true },
];
interface MockItem { id: string; code: string; name: string; uom: string; isActive: boolean }
const MOCK_ITEMS: MockItem[] = [
  { id: "it-cement", code: "IT-01", name: "Cement — 50kg bag (Shah Cement)", uom: "bag", isActive: true },
  { id: "it-rebar", code: "IT-02", name: "Rebar 12mm", uom: "ton", isActive: true },
  { id: "it-sand", code: "IT-03", name: "বালু — Sand", uom: "cft", isActive: true },
  { id: "it-brick", code: "IT-04", name: "ইট — Brick", uom: "pcs", isActive: true },
  { id: "it-fuel", code: "IT-05", name: "Fuel — Diesel", uom: "ltr", isActive: false },
];
const MOCK_USER_LIST = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Admin User" },
  { id: "u-rafiq", name: "Rafiqul Islam" },
  { id: "u-farzana", name: "ফারজানা আক্তার" },
  { id: "u-ashraf", name: "Ashraful Alam" },
];
const MOCK_STOCK_LEDGER: Array<{
  godownId: string; itemId: string; quantityOnHand: string; totalValue: string; weightedAverageRate: string | null;
}> = [
  { godownId: "gd-a", itemId: "it-cement", quantityOnHand: "1240.0000", totalValue: "672080.0000", weightedAverageRate: "542.0000" },
  { godownId: "gd-b", itemId: "it-cement", quantityOnHand: "300.0000", totalValue: "162600.0000", weightedAverageRate: "542.0000" },
  { godownId: "gd-a", itemId: "it-rebar", quantityOnHand: "18.0000", totalValue: "1764000.0000", weightedAverageRate: "98000.0000" },
  { godownId: "gd-a", itemId: "it-sand", quantityOnHand: "90.0000", totalValue: "3780.0000", weightedAverageRate: "42.0000" },
  { godownId: "gd-a", itemId: "it-brick", quantityOnHand: "5000.0000", totalValue: "62500.0000", weightedAverageRate: "12.5000" },
  // Zero on hand → weightedAverageRate null (renders "—", never ৳0.0000) — spec §5/§13-10.
  { godownId: "gd-b", itemId: "it-rebar", quantityOnHand: "0.0000", totalValue: "0.0000", weightedAverageRate: null },
];

// Append-only movement history behind a balance (keyed `godownId:itemId`). Exercises every
// source type + a reversal (additive mirror row, original untouched — FR-INV-020).
interface MockMovement {
  id: string; godownId: string; itemId: string; sourceType: "STOCK_JOURNAL" | "GRN" | "REQ_ISSUE"; sourceId: string | null;
  direction: "IN" | "OUT"; quantity: string; rate: string; value: string;
  balanceQtyAfter: string; balanceValueAfter: string; avgRateAfter: string;
  isReversal: boolean; reversalOf: string | null; voucherDate: string; postedAt: string;
}
const MOCK_STOCK_MOVEMENTS: Record<string, MockMovement[]> = {
  "gd-a:it-cement": [
    { id: "mv-1", godownId: "gd-a", itemId: "it-cement", sourceType: "GRN", sourceId: "grn-201", direction: "IN", quantity: "1000.0000", rate: "540.0000", value: "540000.0000", balanceQtyAfter: "1000.0000", balanceValueAfter: "540000.0000", avgRateAfter: "540.0000", isReversal: false, reversalOf: null, voucherDate: "2026-06-01", postedAt: "2026-06-01T05:00:00Z" },
    { id: "mv-2", godownId: "gd-a", itemId: "it-cement", sourceType: "STOCK_JOURNAL", sourceId: "sj-4", direction: "OUT", quantity: "200.0000", rate: "540.0000", value: "108000.0000", balanceQtyAfter: "800.0000", balanceValueAfter: "432000.0000", avgRateAfter: "540.0000", isReversal: false, reversalOf: null, voucherDate: "2026-06-10", postedAt: "2026-06-10T06:30:00Z" },
    { id: "mv-3", godownId: "gd-a", itemId: "it-cement", sourceType: "GRN", sourceId: "grn-214", direction: "IN", quantity: "640.0000", rate: "545.0000", value: "348800.0000", balanceQtyAfter: "1440.0000", balanceValueAfter: "780800.0000", avgRateAfter: "542.2222", isReversal: false, reversalOf: null, voucherDate: "2026-06-18", postedAt: "2026-06-18T04:15:00Z" },
    { id: "mv-4", godownId: "gd-a", itemId: "it-cement", sourceType: "REQ_ISSUE", sourceId: "req-330", direction: "OUT", quantity: "200.0000", rate: "542.2222", value: "108444.4400", balanceQtyAfter: "1240.0000", balanceValueAfter: "672355.5600", avgRateAfter: "542.2222", isReversal: false, reversalOf: null, voucherDate: "2026-06-28", postedAt: "2026-06-28T09:15:00Z" },
    { id: "mv-5", godownId: "gd-a", itemId: "it-cement", sourceType: "STOCK_JOURNAL", sourceId: "sj-4", direction: "IN", quantity: "200.0000", rate: "542.2222", value: "108444.4400", balanceQtyAfter: "1440.0000", balanceValueAfter: "780800.0000", avgRateAfter: "542.2222", isReversal: true, reversalOf: "mv-4", voucherDate: "2026-06-29", postedAt: "2026-06-29T03:00:00Z" },
  ],
  "gd-a:it-rebar": [
    { id: "mv-10", godownId: "gd-a", itemId: "it-rebar", sourceType: "GRN", sourceId: "grn-190", direction: "IN", quantity: "18.0000", rate: "98000.0000", value: "1764000.0000", balanceQtyAfter: "18.0000", balanceValueAfter: "1764000.0000", avgRateAfter: "98000.0000", isReversal: false, reversalOf: null, voucherDate: "2026-05-20", postedAt: "2026-05-20T05:00:00Z" },
  ],
};

interface MockSjLine { lineNo: number; side: "OUT" | "IN"; godownId: string; itemId: string; quantity: string; rate: string | null; value: string | null; projectId: string; costCentreId: string; purposeId: string }
interface MockSJ {
  id: string; entryNo: string | null; voucherDate: string; mode: "TRANSFER" | "ISSUE" | "ADJUSTMENT"; status: "DRAFT" | "APPROVED" | "POSTED" | "CANCELLED";
  fromGodownId: string | null; toGodownId: string | null; itemId: string; quantity: string; rate: string | null; value: string | null;
  projectId: string | null; costCentreId: string | null; purposeId: string | null; issuedById: string | null; receivedById: string | null;
  approvedById: string | null; approvedAt: string | null; negativeStockAuthorisedById: string | null; negativeStockReason: string | null;
  journalEntryId: string | null; narration: string | null; postedAt: string | null; postedById: string | null; version: number; lines: MockSjLine[];
}
let sjSeq = 100;
let sjNumberSeq = 12;
function seedSj(p: Partial<MockSJ> & Pick<MockSJ, "id" | "mode" | "status" | "itemId" | "quantity" | "fromGodownId">): MockSJ {
  const posted = p.status === "POSTED" || p.status === "CANCELLED";
  return {
    entryNo: null, voucherDate: "2026-06-20", toGodownId: null, rate: null, value: null,
    projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1", issuedById: "u-rafiq", receivedById: "u-farzana",
    approvedById: posted || p.status === "APPROVED" ? "u-ashraf" : null, approvedAt: posted || p.status === "APPROVED" ? "2026-06-20T09:12:00Z" : null,
    negativeStockAuthorisedById: null, negativeStockReason: null, journalEntryId: null, narration: "Day 20 slab pour",
    postedAt: posted ? "2026-06-20T09:15:00Z" : null, postedById: posted ? "u-rafiq" : null, version: 1,
    lines: [{ lineNo: 1, side: "OUT", godownId: p.fromGodownId ?? "gd-a", itemId: p.itemId, quantity: p.quantity, rate: p.rate ?? null, value: p.value ?? null, projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1" }],
    ...p,
  } as MockSJ;
}
const MOCK_STOCK_JOURNALS: MockSJ[] = [
  seedSj({ id: "sj-1", entryNo: "SJ/2526/0012", voucherDate: "2026-07-06", mode: "TRANSFER", status: "POSTED", fromGodownId: "gd-a", toGodownId: "gd-b", itemId: "it-rebar", quantity: "8.5000", rate: "98500.0000", value: "837250.0000", journalEntryId: null }),
  seedSj({ id: "sj-2", voucherDate: "2026-07-07", mode: "ISSUE", status: "DRAFT", fromGodownId: "gd-a", itemId: "it-cement", quantity: "50.0000" }),
  seedSj({ id: "sj-3", entryNo: "SJ/2526/0011", voucherDate: "2026-07-05", mode: "ADJUSTMENT", status: "POSTED", fromGodownId: "gd-a", itemId: "it-sand", quantity: "120.0000", rate: "42.0000", value: "5040.0000", journalEntryId: "je-11" }),
  seedSj({ id: "sj-4", entryNo: "SJ/2526/0010", voucherDate: "2026-06-28", mode: "ISSUE", status: "POSTED", fromGodownId: "gd-a", itemId: "it-cement", quantity: "200.0000", rate: "542.0000", value: "108400.0000", journalEntryId: "je-10" }),
  seedSj({ id: "sj-5", voucherDate: "2026-07-05", mode: "ISSUE", status: "APPROVED", fromGodownId: "gd-a", itemId: "it-cement", quantity: "180.0000" }),
  seedSj({ id: "sj-6", entryNo: "SJ/2526/0008", voucherDate: "2026-06-25", mode: "ISSUE", status: "CANCELLED", fromGodownId: "gd-a", itemId: "it-sand", quantity: "300.0000", rate: "42.0000", value: "12600.0000" }),
];

// ── Requisition sample (dev/preview only) ──
interface MockReqLine {
  id: string; lineNo: number; itemId: string; requestedQuantity: string;
  issuedQuantity: string; balanceQuantity: string; indicativeRate: string | null; uom: string;
}
interface MockRequisition {
  id: string; requisitionNo: string | null; projectId: string; costCentreId: string; purposeId: string;
  fromGodownId: string | null; requiredDate: string; priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PARTIALLY_ISSUED" | "ISSUED" | "CLOSED";
  estimatedValue: string | null; approvalTier: "PM" | "ACCOUNTS" | null; submittedAt: string | null;
  submittedById: string | null; closedAt: string | null; closedReason: string | null;
  narration: string | null; lines: MockReqLine[]; version: number;
}
/** Indicative rate for an item at a godown (falls back to any-godown last-known). */
function reqIndicativeRate(itemId: string, godownId: string | null): string | null {
  const at = godownId ? MOCK_STOCK_LEDGER.find((r) => r.itemId === itemId && r.godownId === godownId) : undefined;
  const any = at ?? MOCK_STOCK_LEDGER.find((r) => r.itemId === itemId);
  return any?.weightedAverageRate ?? null;
}
function reqUom(itemId: string): string {
  return MOCK_ITEMS.find((i) => i.id === itemId)?.uom ?? "";
}
function mkLine(id: string, lineNo: number, itemId: string, requested: string, issued: string, godownId: string | null): MockReqLine {
  const rate = reqIndicativeRate(itemId, godownId);
  const bal = (Number(requested) - Number(issued)).toFixed(4);
  return { id, lineNo, itemId, requestedQuantity: `${Number(requested).toFixed(4)}`, issuedQuantity: `${Number(issued).toFixed(4)}`, balanceQuantity: bal, indicativeRate: rate, uom: reqUom(itemId) };
}
function reqEstimate(lines: MockReqLine[]): string {
  let sum = 0;
  for (const l of lines) if (l.indicativeRate) sum += Number(l.requestedQuantity) * Number(l.indicativeRate);
  return sum.toFixed(4);
}
let reqSeq = 200;
let reqNoSeq = 42;
const MOCK_REQUISITIONS: MockRequisition[] = [
  {
    id: "req-1", requisitionNo: null, projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1",
    fromGodownId: "gd-a", requiredDate: "2026-07-20", priority: "NORMAL", status: "DRAFT",
    estimatedValue: null, approvalTier: null, submittedAt: null, submittedById: null, closedAt: null, closedReason: null,
    narration: "Slab pour materials", version: 1,
    lines: [mkLine("rl-1", 1, "it-cement", "100", "0", "gd-a"), mkLine("rl-2", 2, "it-rebar", "2", "0", "gd-a")],
  },
  {
    id: "req-2", requisitionNo: "REQ/2526/0042", projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1",
    fromGodownId: "gd-a", requiredDate: "2026-07-18", priority: "HIGH", status: "SUBMITTED",
    estimatedValue: null, approvalTier: "PM", submittedAt: "2026-07-10T08:00:00Z", submittedById: "u-rafiq",
    closedAt: null, closedReason: null, narration: "Column casting — block C", version: 2,
    lines: [mkLine("rl-3", 1, "it-cement", "80", "0", "gd-a"), mkLine("rl-4", 2, "it-sand", "300", "0", "gd-a")],
  },
  {
    id: "req-3", requisitionNo: "REQ/2526/0041", projectId: "proj-a", costCentreId: "cc-fuel", purposeId: "pp-1",
    fromGodownId: "gd-a", requiredDate: "2026-07-15", priority: "URGENT", status: "APPROVED",
    estimatedValue: null, approvalTier: "PM", submittedAt: "2026-07-08T08:00:00Z", submittedById: "u-farzana",
    closedAt: null, closedReason: null, narration: null, version: 3,
    lines: [mkLine("rl-5", 1, "it-brick", "5000", "0", "gd-a")],
  },
  {
    id: "req-4", requisitionNo: "REQ/2526/0040", projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1",
    fromGodownId: "gd-a", requiredDate: "2026-07-12", priority: "NORMAL", status: "PARTIALLY_ISSUED",
    estimatedValue: null, approvalTier: "PM", submittedAt: "2026-07-05T08:00:00Z", submittedById: "u-rafiq",
    closedAt: null, closedReason: null, narration: "Ongoing pour", version: 5,
    lines: [mkLine("rl-6", 1, "it-cement", "200", "120", "gd-a")],
  },
  {
    id: "req-5", requisitionNo: "REQ/2526/0039", projectId: "proj-a", costCentreId: "cc-sub", purposeId: "pp-1",
    fromGodownId: null, requiredDate: "2026-07-09", priority: "LOW", status: "REJECTED",
    estimatedValue: null, approvalTier: "ACCOUNTS", submittedAt: "2026-07-02T08:00:00Z", submittedById: "u-farzana",
    closedAt: null, closedReason: null, narration: "Over threshold — rejected", version: 3,
    lines: [mkLine("rl-7", 1, "it-rebar", "40", "0", null)],
  },
  {
    id: "req-6", requisitionNo: "REQ/2526/0038", projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1",
    fromGodownId: "gd-a", requiredDate: "2026-07-06", priority: "NORMAL", status: "ISSUED",
    estimatedValue: null, approvalTier: "PM", submittedAt: "2026-06-30T08:00:00Z", submittedById: "u-rafiq",
    closedAt: null, closedReason: null, narration: null, version: 6,
    lines: [mkLine("rl-8", 1, "it-sand", "300", "300", "gd-a")],
  },
];
// Seed submitted+ estimates.
for (const r of MOCK_REQUISITIONS) if (r.status !== "DRAFT") r.estimatedValue = reqEstimate(r.lines);

interface MockReqApproval {
  id: string; requisitionId: string; decision: "APPROVED" | "REJECTED"; tier: "PM" | "ACCOUNTS";
  thresholdEvaluated: string | null; estimatedValueAtReview: string | null; reason: string | null;
  decidedById: string; decidedAt: string;
}
const MOCK_REQ_APPROVALS: MockReqApproval[] = [];

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

  // GET /cost-control/alerts — the current OVER/APPROACHING (project, cost centre) pairs,
  // lifetime-cumulative + live (FR-CC-011/012/016). Same row shape as budget-vs-actual.
  if (pathname === "/cost-control/alerts" && req.method === "GET") {
    const projectId = params.get("projectId") ?? "";
    const statusCsv = params.get("status");
    const wanted = statusCsv ? new Set(statusCsv.split(",")) : new Set(["OVER", "APPROACHING"]);
    // PM scope: reject an unassigned project filter (FR-CC-016).
    if (projectId && user.assignedProjectIds.length > 0 && !user.assignedProjectIds.includes(projectId)) {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    const scopedProject = projectId || user.assignedProjectIds[0] || "proj-a";
    let rows = MOCK_BVA_ROWS.filter((r) => r.status === "OVER" || r.status === "APPROACHING").map((r) => ({
      projectId: scopedProject,
      ...r,
    }));
    rows = rows.filter((r) => wanted.has(r.status));
    // Sort OVER before APPROACHING, then utilisation descending (spec §5).
    const rank = (s: string) => (s === "OVER" ? 0 : 1);
    rows.sort((a, b) => rank(a.status) - rank(b.status) || Number(b.utilisationPct) - Number(a.utilisationPct));
    return { status: 200, body: pageEnvelope(rows) };
  }

  // GET /cost-control/profitability — revenue/cost/profit grouped by cost centre and/or
  // project, a query over the ledger (FR-CC-009). No status/budget concept here.
  if (pathname === "/cost-control/profitability" && req.method === "GET") {
    const groupBy = params.get("groupBy") ?? "cost_centre";
    const projectId = params.get("projectId") ?? "";
    const costCentreId = params.get("costCentreId") ?? "";
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return { status: 400, body: envelope("VALIDATION_ERROR", "'Date from' must be before 'Date to'.") };
    }
    if (projectId && user.assignedProjectIds.length > 0 && !user.assignedProjectIds.includes(projectId)) {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    let rows: Array<Record<string, unknown>>;
    if (groupBy === "project") {
      rows = MOCK_PROFITABILITY_BY_PROJECT.map((r) => ({ costCentreId: null, ...r }));
    } else if (groupBy === "project_cost_centre") {
      rows = MOCK_PROFITABILITY.slice(0, 4).map((r) => ({ projectId: projectId || "proj-a", ...r }));
    } else {
      rows = MOCK_PROFITABILITY.map((r) => ({ projectId: null, ...r }));
    }
    if (costCentreId) rows = rows.filter((r) => r.costCentreId === costCentreId);
    if (projectId && groupBy !== "cost_centre") rows = rows.filter((r) => r.projectId === projectId);
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

  // ── Inventory master lookups ──
  if (pathname === "/masters/godowns" && req.method === "GET") {
    const projectId = params.get("projectId");
    const rows = projectId ? MOCK_GODOWNS.filter((g) => g.projectId === projectId) : MOCK_GODOWNS;
    return { status: 200, body: pageEnvelope(rows) };
  }
  if (pathname === "/masters/items" && req.method === "GET") {
    return { status: 200, body: pageEnvelope(MOCK_ITEMS) };
  }
  if (pathname === "/users" && req.method === "GET") {
    return { status: 200, body: pageEnvelope(MOCK_USER_LIST) };
  }

  // ── Stock ledger reads (matched BEFORE /stock-journal/:id) ──
  const godownProject = (gid: string): string | null => MOCK_GODOWNS.find((g) => g.id === gid)?.projectId ?? null;
  const inScope = (projectId: string | null) =>
    user.assignedProjectIds.length === 0 || (projectId ? user.assignedProjectIds.includes(projectId) : true);

  if (pathname === "/stock-journal/stock-ledger" && req.method === "GET") {
    const godownId = params.get("godownId");
    const itemId = params.get("itemId");
    const projectId = params.get("projectId");
    const asOf = params.get("asOfDate") ?? "2026-07-07";
    if (projectId && !inScope(projectId)) {
      return { status: 403, body: envelope("FORBIDDEN", "You can only view your assigned projects' godowns.") };
    }
    let rows = MOCK_STOCK_LEDGER.filter((r) => inScope(godownProject(r.godownId)));
    if (godownId) rows = rows.filter((r) => r.godownId === godownId);
    if (itemId) rows = rows.filter((r) => r.itemId === itemId);
    if (projectId) rows = rows.filter((r) => godownProject(r.godownId) === projectId);
    return { status: 200, body: pageEnvelope(rows.map((r) => ({ ...r, asOfDate: asOf }))) };
  }

  if (pathname === "/stock-journal/stock-ledger/movements" && req.method === "GET") {
    const godownId = params.get("godownId") ?? "";
    const itemId = params.get("itemId") ?? "";
    if (!godownId || !itemId) {
      return { status: 400, body: envelope("VALIDATION_ERROR", "godownId and itemId are required.") };
    }
    if (!inScope(godownProject(godownId))) {
      return { status: 403, body: envelope("FORBIDDEN", "You can only view your assigned projects' godowns.") };
    }
    let rows = MOCK_STOCK_MOVEMENTS[`${godownId}:${itemId}`] ?? [];
    const from = params.get("dateFrom");
    const to = params.get("dateTo");
    if (from) rows = rows.filter((m) => m.voucherDate >= from);
    if (to) rows = rows.filter((m) => m.voucherDate <= to);
    return { status: 200, body: pageEnvelope(rows) };
  }

  // ── Stock Journal list + create ──
  const scopeOk = (projectId: string | null) =>
    user.assignedProjectIds.length === 0 || (projectId ? user.assignedProjectIds.includes(projectId) : true);

  if (pathname === "/stock-journal" && req.method === "GET") {
    const statusF = params.get("status");
    const modeF = params.get("mode");
    const projectF = params.get("projectId");
    const godownF = params.get("godownId");
    const itemF = params.get("itemId");
    let rows = MOCK_STOCK_JOURNALS.filter((j) => scopeOk(j.projectId));
    if (statusF) rows = rows.filter((j) => statusF.split(",").includes(j.status));
    if (modeF) rows = rows.filter((j) => modeF.split(",").includes(j.mode));
    if (projectF) rows = rows.filter((j) => j.projectId === projectF);
    if (godownF) rows = rows.filter((j) => j.fromGodownId === godownF || j.toGodownId === godownF);
    if (itemF) rows = rows.filter((j) => j.itemId === itemF);
    return { status: 200, body: pageEnvelope(rows) };
  }

  if (pathname === "/stock-journal" && req.method === "POST") {
    const b = body as Record<string, unknown>;
    const lines = (Array.isArray(b.lines) ? b.lines : []) as Array<Record<string, string>>;
    const out = lines.find((l) => l.side === "OUT") ?? {};
    const inn = lines.find((l) => l.side === "IN");
    if (b.mode === "TRANSFER" && out.godownId && inn?.godownId && out.godownId === inn.godownId) {
      return { status: 400, body: envelope("SAME_GODOWN_TRANSFER", "Source and destination can't be the same godown.") };
    }
    const id = `sj-${(sjSeq += 1)}`;
    const nj: MockSJ = {
      id, entryNo: null, voucherDate: String(b.voucherDate ?? ""), mode: b.mode as MockSJ["mode"], status: "DRAFT",
      fromGodownId: out.godownId ?? null, toGodownId: inn?.godownId ?? null, itemId: String(b.itemId ?? ""), quantity: String(b.quantity ?? "0"),
      rate: null, value: null, projectId: out.projectId ?? null, costCentreId: out.costCentreId ?? null, purposeId: out.purposeId ?? null,
      issuedById: (b.issuedById as string) ?? null, receivedById: (b.receivedById as string) ?? null, approvedById: null, approvedAt: null,
      negativeStockAuthorisedById: null, negativeStockReason: null, journalEntryId: null, narration: (b.narration as string) ?? null,
      postedAt: null, postedById: null, version: 1,
      lines: lines.map((l, i) => ({ lineNo: i + 1, side: l.side as "OUT" | "IN", godownId: l.godownId ?? "", itemId: String(b.itemId ?? ""), quantity: String(b.quantity ?? "0"), rate: null, value: null, projectId: l.projectId ?? "", costCentreId: l.costCentreId ?? "", purposeId: l.purposeId ?? "" })),
    };
    MOCK_STOCK_JOURNALS.unshift(nj);
    return { status: 201, body: success(nj) };
  }

  // ── Stock Journal /:id [/(approve|post|reverse)] ──
  const sjm = /^\/stock-journal\/([^/]+)(?:\/(approve|post|reverse))?$/.exec(pathname ?? "");
  if (sjm) {
    const id = sjm[1]!;
    const action = sjm[2];
    const j = MOCK_STOCK_JOURNALS.find((x) => x.id === id);
    if (!j) return { status: 404, body: envelope("NOT_FOUND", "Stock Journal not found") };
    if (!scopeOk(j.projectId)) return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this Stock Journal.") };
    const b = body as Record<string, unknown>;

    if (req.method === "GET" && !action) return { status: 200, body: success(j) };

    if (req.method === "PATCH" && !action) {
      if (j.status !== "DRAFT") return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "Posted Stock Journals can't be edited.") };
      const lines = (Array.isArray(b.lines) ? b.lines : j.lines) as Array<Record<string, string>>;
      const out = lines.find((l) => l.side === "OUT") ?? {};
      const inn = lines.find((l) => l.side === "IN");
      if (b.mode === "TRANSFER" && out.godownId && inn?.godownId && out.godownId === inn.godownId) {
        return { status: 400, body: envelope("SAME_GODOWN_TRANSFER", "Source and destination can't be the same godown.") };
      }
      Object.assign(j, {
        voucherDate: b.voucherDate ?? j.voucherDate, mode: b.mode ?? j.mode, itemId: b.itemId ?? j.itemId, quantity: b.quantity ?? j.quantity,
        issuedById: b.issuedById ?? j.issuedById, receivedById: b.receivedById ?? j.receivedById, narration: b.narration ?? j.narration,
        fromGodownId: out.godownId ?? j.fromGodownId, toGodownId: inn?.godownId ?? null, projectId: out.projectId ?? j.projectId,
        costCentreId: out.costCentreId ?? j.costCentreId, purposeId: out.purposeId ?? j.purposeId, version: j.version + 1,
      });
      return { status: 200, body: success(j) };
    }

    if (req.method === "DELETE" && !action) {
      if (j.status !== "DRAFT") return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "Posted Stock Journals can't be deleted.") };
      const idx = MOCK_STOCK_JOURNALS.indexOf(j);
      MOCK_STOCK_JOURNALS.splice(idx, 1);
      return { status: 204, body: null };
    }

    if (req.method === "POST" && action === "approve") {
      if (j.status !== "DRAFT") return { status: 409, body: envelope("INVALID_STOCK_JOURNAL_TRANSITION", "Only a draft can be approved.") };
      j.status = "APPROVED"; j.approvedById = user.id; j.approvedAt = new Date().toISOString(); j.version += 1;
      return { status: 200, body: success(j) };
    }

    if (req.method === "POST" && action === "post") {
      if (j.status !== "APPROVED") return { status: 409, body: envelope("STOCK_JOURNAL_NOT_APPROVED", "This Stock Journal must be approved before it can be posted.") };
      const bal = MOCK_STOCK_LEDGER.find((r) => r.godownId === j.fromGodownId && r.itemId === j.itemId);
      const onHand = bal ? Number(bal.quantityOnHand) : 0;
      const allow = b.allowNegativeStock === true;
      if (Number(j.quantity) > onHand) {
        if (!allow || user.role !== "ADMIN") {
          return { status: 409, body: envelope("NEGATIVE_STOCK_BLOCKED", "This would take the item below zero. You don't have authorisation to allow negative stock.") };
        }
        j.negativeStockAuthorisedById = user.id; j.negativeStockReason = (b.negativeStockReason as string) ?? null;
      }
      const rate = bal?.weightedAverageRate ?? "0.0000";
      j.status = "POSTED"; j.postedAt = new Date().toISOString(); j.postedById = user.id;
      j.rate = rate; j.value = (Number(rate) * Number(j.quantity)).toFixed(4);
      if (j.mode === "TRANSFER") { j.entryNo = null; j.journalEntryId = null; } // value-neutral
      else { j.entryNo = `SJ/2526/${String((sjNumberSeq += 1)).padStart(4, "0")}`; j.journalEntryId = `je-${j.id}`; }
      j.version += 1;
      return { status: 200, body: success(j) };
    }

    if (req.method === "POST" && action === "reverse") {
      if (j.status === "CANCELLED") return { status: 409, body: envelope("ALREADY_REVERSED", "This Stock Journal has already been reversed.") };
      if (j.status !== "POSTED") return { status: 409, body: envelope("INVALID_STOCK_JOURNAL_TRANSITION", "Only a posted journal can be reversed.") };
      j.status = "CANCELLED"; j.version += 1;
      return { status: 200, body: success(j) };
    }
  }

  // ── CC advisory budget check (never blocks; FR-CC-014) ──
  if (pathname === "/cost-control/budget-check" && req.method === "POST") {
    const v = Number((body as { estimatedValue?: string }).estimatedValue ?? "0");
    const status = v > 4_000_000 ? "OVER" : v > 2_500_000 ? "APPROACHING" : "OK";
    return { status: 200, body: success({ status }) };
  }

  // ── Requisition list + create ──
  if (pathname === "/requisition" && req.method === "GET") {
    const statusF = params.get("status");
    const priorityF = params.get("priority");
    const projectF = params.get("projectId");
    const ccF = params.get("costCentreId");
    const byF = params.get("submittedById");
    const outF = params.get("hasOutstanding");
    let rows = MOCK_REQUISITIONS.filter((r) => scopeOk(r.projectId));
    if (statusF) rows = rows.filter((r) => statusF.split(",").includes(r.status));
    if (priorityF) rows = rows.filter((r) => priorityF.split(",").includes(r.priority));
    if (projectF) rows = rows.filter((r) => r.projectId === projectF);
    if (ccF) rows = rows.filter((r) => r.costCentreId === ccF);
    if (byF) rows = rows.filter((r) => r.submittedById === byF);
    if (outF === "true") rows = rows.filter((r) => r.lines.some((l) => Number(l.balanceQuantity) > 0));
    return { status: 200, body: pageEnvelope(rows) };
  }

  if (pathname === "/requisition" && req.method === "POST") {
    const b = body as Record<string, unknown>;
    const projectId = String(b.projectId ?? "");
    const purposeId = String(b.purposeId ?? "");
    const purpose = MOCK_PURPOSES.find((p) => p.id === purposeId);
    if (purpose && purpose.projectId !== projectId) {
      return { status: 400, body: envelope("CROSS_PROJECT_DIMENSION", "This purpose doesn't belong to the selected project.") };
    }
    const bodyLines = (Array.isArray(b.lines) ? b.lines : []) as Array<{ itemId: string; requestedQuantity: string }>;
    const inactive = bodyLines.find((l) => MOCK_ITEMS.find((i) => i.id === l.itemId)?.isActive === false);
    if (inactive) return { status: 400, body: envelope("INACTIVE_MASTER_REFERENCE", "This item is inactive.") };
    const godownId = (b.fromGodownId as string) ?? null;
    const id = `req-${(reqSeq += 1)}`;
    const nr: MockRequisition = {
      id, requisitionNo: null, projectId, costCentreId: String(b.costCentreId ?? ""), purposeId,
      fromGodownId: godownId, requiredDate: String(b.requiredDate ?? ""), priority: (b.priority as MockRequisition["priority"]) ?? "NORMAL",
      status: "DRAFT", estimatedValue: null, approvalTier: null, submittedAt: null, submittedById: null,
      closedAt: null, closedReason: null, narration: (b.narration as string) ?? null, version: 1,
      lines: bodyLines.map((l, i) => mkLine(`rl-${id}-${i}`, i + 1, l.itemId, l.requestedQuantity, "0", godownId)),
    };
    MOCK_REQUISITIONS.unshift(nr);
    return { status: 201, body: success({ id }) };
  }

  // ── Requisition /:id [/submit|approve|reject|approvals] ──
  const rm = /^\/requisition\/([^/]+)(?:\/(submit|approve|reject|approvals))?$/.exec(pathname ?? "");
  if (rm) {
    const id = rm[1]!;
    const action = rm[2];
    const r = MOCK_REQUISITIONS.find((x) => x.id === id);
    if (!r) return { status: 404, body: envelope("NOT_FOUND", "Requisition not found") };
    if (!scopeOk(r.projectId)) return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this requisition.") };
    const b = body as Record<string, unknown>;

    if (req.method === "GET" && !action) return { status: 200, body: success(r) };

    if (req.method === "PATCH") {
      if (r.status !== "DRAFT") return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This requisition has been submitted and can't be edited here.") };
      const purposeId = b.purposeId !== undefined ? String(b.purposeId) : r.purposeId;
      const projectId = b.projectId !== undefined ? String(b.projectId) : r.projectId;
      const purpose = MOCK_PURPOSES.find((p) => p.id === purposeId);
      if (purpose && purpose.projectId !== projectId) {
        return { status: 400, body: envelope("CROSS_PROJECT_DIMENSION", "This purpose doesn't belong to the selected project.") };
      }
      if (b.projectId !== undefined) r.projectId = projectId;
      if (b.costCentreId !== undefined) r.costCentreId = String(b.costCentreId);
      if (b.purposeId !== undefined) r.purposeId = purposeId;
      if (b.fromGodownId !== undefined) r.fromGodownId = (b.fromGodownId as string) ?? null;
      if (b.requiredDate !== undefined) r.requiredDate = String(b.requiredDate);
      if (b.priority !== undefined) r.priority = b.priority as MockRequisition["priority"];
      if (b.narration !== undefined) r.narration = (b.narration as string) ?? null;
      if (Array.isArray(b.lines)) {
        const bl = b.lines as Array<{ itemId: string; requestedQuantity: string }>;
        const inactive = bl.find((l) => MOCK_ITEMS.find((i) => i.id === l.itemId)?.isActive === false);
        if (inactive) return { status: 400, body: envelope("INACTIVE_MASTER_REFERENCE", "This item is inactive.") };
        r.lines = bl.map((l, i) => mkLine(`rl-${id}-${i}`, i + 1, l.itemId, l.requestedQuantity, "0", r.fromGodownId));
      }
      r.version += 1;
      return { status: 200, body: success(r) };
    }

    if (req.method === "DELETE") {
      if (r.status !== "DRAFT") return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "Only a draft can be deleted.") };
      MOCK_REQUISITIONS.splice(MOCK_REQUISITIONS.indexOf(r), 1);
      return { status: 204, body: null };
    }

    if (req.method === "POST" && action === "submit") {
      if (r.status !== "DRAFT") return { status: 409, body: envelope("INVALID_REQUISITION_TRANSITION", "This requisition can no longer be submitted.") };
      const est = reqEstimate(r.lines);
      r.status = "SUBMITTED";
      r.requisitionNo = `REQ/2526/${String((reqNoSeq += 1)).padStart(4, "0")}`;
      r.estimatedValue = est;
      r.approvalTier = Number(est) > 2_500_000 ? "ACCOUNTS" : "PM";
      r.submittedAt = "2026-07-12T09:00:00Z";
      r.submittedById = user.id;
      r.version += 1;
      return { status: 200, body: success(r) };
    }

    // Approval history (FR-REQ-008).
    if (req.method === "GET" && action === "approvals") {
      return { status: 200, body: success(MOCK_REQ_APPROVALS.filter((a) => a.requisitionId === id)) };
    }

    // Escalate-by-default authority gate (FR-REQ-010/-011): a PM may decide only a PM-tier
    // requisition; an ACCOUNTS-tier (escalated) one needs Accounts; Admin decides anything.
    const canDecideTier =
      user.role === "ADMIN" ||
      (r.approvalTier === "ACCOUNTS"
        ? user.role === "ACCOUNTS_MANAGER" || user.role === "ACCOUNTS_TEAM"
        : user.role === "PROJECT_MANAGER");

    if (req.method === "POST" && action === "approve") {
      if (r.status !== "SUBMITTED") return { status: 409, body: envelope("REQUISITION_NOT_SUBMITTED", "This requisition has already been decided.") };
      if (!canDecideTier) return { status: 403, body: envelope("APPROVAL_BEYOND_AUTHORITY", "This requisition is above your approval limit.") };
      r.status = "APPROVED";
      r.version += 1;
      MOCK_REQ_APPROVALS.push({
        id: `ra-${MOCK_REQ_APPROVALS.length + 1}`, requisitionId: id, decision: "APPROVED",
        tier: r.approvalTier ?? "PM", thresholdEvaluated: r.approvalTier === "ACCOUNTS" ? "2500000.0000" : "500000.0000",
        estimatedValueAtReview: r.estimatedValue, reason: (b.note as string) ?? null, decidedById: user.id, decidedAt: new Date().toISOString(),
      });
      return { status: 200, body: success(r) };
    }

    if (req.method === "POST" && action === "reject") {
      if (r.status !== "SUBMITTED") return { status: 409, body: envelope("REQUISITION_NOT_SUBMITTED", "This requisition has already been decided.") };
      if (!canDecideTier) return { status: 403, body: envelope("APPROVAL_BEYOND_AUTHORITY", "This requisition is above your approval limit.") };
      const reason = String(b.reason ?? "").trim();
      if (!reason) return { status: 400, body: envelope("MISSING_REJECT_REASON", "Enter a reason for rejecting this requisition.") };
      r.status = "REJECTED";
      r.version += 1;
      MOCK_REQ_APPROVALS.push({
        id: `ra-${MOCK_REQ_APPROVALS.length + 1}`, requisitionId: id, decision: "REJECTED",
        tier: r.approvalTier ?? "PM", thresholdEvaluated: r.approvalTier === "ACCOUNTS" ? "2500000.0000" : "500000.0000",
        estimatedValueAtReview: r.estimatedValue, reason, decidedById: user.id, decidedAt: new Date().toISOString(),
      });
      return { status: 200, body: success(r) };
    }
  }

  return { status: 200, body: success({ ok: true, path: req.path }) };
}
