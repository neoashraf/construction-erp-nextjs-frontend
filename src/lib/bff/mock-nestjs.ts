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
  // SAL IPC editor reads the resolved customer + remaining mobilization advance off the project
  // option (fe-ipc-editor) so it can preview them the instant a project is chosen.
  customerId: string;
  customerName: string;
  remainingAdvance: string;
  hasMobilizationAdvance: boolean;
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
  { id: "proj-a", projectCode: "BR-04", name: "Bridge-04 — Buriganga", status: "ACTIVE", isActive: true, version: 1, customerId: "pa-8", customerName: "National Housing Authority", remainingAdvance: "800000.0000", hasMobilizationAdvance: true },
  { id: "proj-b", projectCode: "TW-A", name: "Tower-A — Gulshan", status: "ACTIVE", isActive: true, version: 1, customerId: "pa-4", customerName: "Tower-A Developments Ltd.", remainingAdvance: "5000000.0000", hasMobilizationAdvance: true },
  { id: "proj-c", projectCode: "RD-12", name: "Road-12 — Savar", status: "ACTIVE", isActive: true, version: 1, customerId: "pa-7", customerName: "করিম এন্টারপ্রাইজ", remainingAdvance: "0.0000", hasMobilizationAdvance: false },
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
  {
    // APPROVED with a rebar line whose balance (20) exceeds gd-a on-hand (18) — the negative-stock
    // override path (fe-requisition-issue e2e). requiredDate is latest so it never displaces the
    // happy-path row at the top of the issues worklist.
    id: "req-7", requisitionNo: "REQ/2526/0044", projectId: "proj-a", costCentreId: "cc-mat", purposeId: "pp-1",
    fromGodownId: "gd-a", requiredDate: "2026-07-30", priority: "HIGH", status: "APPROVED",
    estimatedValue: null, approvalTier: "PM", submittedAt: "2026-07-11T08:00:00Z", submittedById: "u-rafiq",
    closedAt: null, closedReason: null, narration: "Rebar top-up for the deck lift", version: 2,
    lines: [mkLine("rl-9", 1, "it-rebar", "20", "0", "gd-a")],
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

interface MockReqIssueLine {
  requisitionLineId: string; stockMovementId: string; issuedQuantity: string; rate: string; value: string;
}
interface MockReqIssue {
  requisitionId: string; requisitionIssueId: string; issueNo: number; journalEntryId: string; entryNo: string;
  issuedValue: string; fromGodownId: string; lines: MockReqIssueLine[]; requisitionStatus: MockRequisition["status"];
  issuedAt: string; reversedAt: string | null; reversedById: string | null;
}
const MOCK_REQ_ISSUES: MockReqIssue[] = [];
let reqIssueSeq = 30;
let reqIssueNoSeq = 0;

/** On-hand for a `(godown, item)` from the stock-ledger projection (0 when unknown). */
function reqOnHand(godownId: string, itemId: string): number {
  const row = MOCK_STOCK_LEDGER.find((r) => r.godownId === godownId && r.itemId === itemId);
  return row ? Number(row.quantityOnHand) : 0;
}
/** Outstanding total indicative value = Σ(balance × indicative rate). */
function reqOutstandingValue(r: MockRequisition): string {
  let sum = 0;
  for (const l of r.lines) {
    const rate = reqIndicativeRate(l.itemId, r.fromGodownId);
    if (rate) sum += Number(l.balanceQuantity) * Number(rate);
  }
  return sum.toFixed(4);
}

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

// ── Sales / IPC sample (dev/preview only) — the fe-ipc-editor voucher store ──
interface MockIpc {
  id: string;
  projectId: string;
  customerId: string;
  ipcSeqNo: number;
  ipcDate: string;
  billDate: string;
  dueDate: string;
  workCompletedPct: string;
  certifiedAmount: string;
  costCentreId: string;
  purposeId: string;
  outputVatAmount: string;
  aitTdsAmount: string;
  retentionAmount: string;
  advanceRecoveredAmount: string;
  retentionRatePct: string;
  advanceRatePct: string;
  narration: string | null;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  entryNo: string | null;
  journalEntryId: string | null;
  reversalEntryNo: string | null;
  postedAt: string | null;
  postedBy: string | null;
  version: number;
}
const IPC_VAT_RATE = 0.075;
const IPC_RETENTION_RATE = 0.1;
const IPC_ADVANCE_RATE = 0.15;

function ipcCurrentlyDue(i: Pick<MockIpc, "certifiedAmount" | "outputVatAmount" | "retentionAmount" | "advanceRecoveredAmount" | "aitTdsAmount">): string {
  const raw =
    Number(i.certifiedAmount) + Number(i.outputVatAmount) - Number(i.retentionAmount) - Number(i.advanceRecoveredAmount) - Number(i.aitTdsAmount);
  return (raw < 0 ? 0 : raw).toFixed(4);
}
function mkIpc(o: Partial<MockIpc> & Pick<MockIpc, "id" | "projectId" | "customerId" | "ipcSeqNo" | "certifiedAmount">): MockIpc {
  const certified = o.certifiedAmount;
  const vat = o.outputVatAmount ?? (Number(certified) * IPC_VAT_RATE).toFixed(4);
  const retention = o.retentionAmount ?? (Number(certified) * IPC_RETENTION_RATE).toFixed(4);
  const advance = o.advanceRecoveredAmount ?? (Number(certified) * IPC_ADVANCE_RATE).toFixed(4);
  return {
    id: o.id,
    projectId: o.projectId,
    customerId: o.customerId,
    ipcSeqNo: o.ipcSeqNo,
    ipcDate: o.ipcDate ?? "2026-07-12",
    billDate: o.billDate ?? "2026-07-12",
    dueDate: o.dueDate ?? "2026-08-11",
    workCompletedPct: o.workCompletedPct ?? "45.0000",
    certifiedAmount: certified,
    costCentreId: o.costCentreId ?? "cc-mat",
    purposeId: o.purposeId ?? "pp-1",
    outputVatAmount: vat,
    aitTdsAmount: o.aitTdsAmount ?? "0.0000",
    retentionAmount: retention,
    advanceRecoveredAmount: advance,
    retentionRatePct: o.retentionRatePct ?? "10.0000",
    advanceRatePct: o.advanceRatePct ?? "15.0000",
    narration: o.narration ?? null,
    status: o.status ?? "DRAFT",
    entryNo: o.entryNo ?? null,
    journalEntryId: o.journalEntryId ?? null,
    reversalEntryNo: o.reversalEntryNo ?? null,
    postedAt: o.postedAt ?? null,
    postedBy: o.postedBy ?? null,
    version: o.version ?? 1,
  };
}
const MOCK_IPCS: MockIpc[] = [
  mkIpc({ id: "ipc-7", projectId: "proj-a", customerId: "pa-8", ipcSeqNo: 7, ipcDate: "2026-07-12", certifiedAmount: "1000000.0000", outputVatAmount: "75000.0000", aitTdsAmount: "50000.0000", retentionAmount: "100000.0000", advanceRecoveredAmount: "150000.0000", narration: "৪৫% অগ্রগতি — সুপারস্ট্রাকচার পর্যায়।", status: "POSTED", entryNo: "IPC/2526/0007", journalEntryId: "je-ipc-7", postedAt: "2026-07-12T05:30:00Z", postedBy: "00000000-0000-0000-0000-000000000001", version: 2 }),
  mkIpc({ id: "ipc-draft", projectId: "proj-b", customerId: "pa-4", ipcSeqNo: 1, ipcDate: "2026-07-11", certifiedAmount: "2400000.0000", status: "DRAFT" }),
  mkIpc({ id: "ipc-6", projectId: "proj-a", customerId: "pa-8", ipcSeqNo: 6, ipcDate: "2026-07-05", certifiedAmount: "1500000.0000", aitTdsAmount: "75000.0000", retentionAmount: "150000.0000", advanceRecoveredAmount: "225000.0000", status: "POSTED", entryNo: "IPC/2526/0006", journalEntryId: "je-ipc-6", postedAt: "2026-07-05T05:30:00Z", postedBy: "00000000-0000-0000-0000-000000000001", version: 2 }),
  mkIpc({ id: "ipc-5", projectId: "proj-a", customerId: "pa-8", ipcSeqNo: 5, ipcDate: "2026-06-28", certifiedAmount: "800000.0000", aitTdsAmount: "40000.0000", retentionAmount: "80000.0000", advanceRecoveredAmount: "120000.0000", status: "POSTED", entryNo: "IPC/2526/0005", journalEntryId: "je-ipc-5", postedAt: "2026-06-28T05:30:00Z", postedBy: "00000000-0000-0000-0000-000000000001", version: 2 }),
  mkIpc({ id: "ipc-4", projectId: "proj-b", customerId: "pa-4", ipcSeqNo: 4, ipcDate: "2026-06-20", certifiedAmount: "1200000.0000", aitTdsAmount: "60000.0000", retentionAmount: "120000.0000", advanceRecoveredAmount: "180000.0000", status: "CANCELLED", entryNo: "IPC/2526/0004", journalEntryId: "je-ipc-4", reversalEntryNo: "IPC/2526/0009", postedAt: "2026-06-20T05:30:00Z", postedBy: "00000000-0000-0000-0000-000000000001", version: 3 }),
  mkIpc({ id: "ipc-3", projectId: "proj-c", customerId: "pa-7", ipcSeqNo: 3, ipcDate: "2026-07-10", certifiedAmount: "650000.0000", aitTdsAmount: "0.0000", retentionAmount: "65000.0000", advanceRecoveredAmount: "0.0000", status: "DRAFT" }),
];
let ipcSeq = 100;
let ipcNumberSeq = 9; // next gapless IPC/2526/00xx allocated at post (0004..0009 already used)

/**
 * Posted retention releases (fe-ipc-register-retention). Module-scoped so state persists
 * across requests in the single-process mock backend — used by both `/release-retention`
 * (write) and the register `retainedHeld` computation (read).
 */
interface MockRelease { id: string; ipcId: string; releaseDate: string; releasedAmount: string; entryNo: string; status: "POSTED"; postedAt: string; postedBy: string; }
const MOCK_RELEASES: MockRelease[] = [];

function ipcResource(i: MockIpc) {
  const currentlyDue = ipcCurrentlyDue(i);
  return {
    ...i,
    currentlyDueAmount: currentlyDue,
    outstandingAmount: i.status === "CANCELLED" ? "0.0000" : currentlyDue,
    retentionHeldAmount: i.status === "CANCELLED" ? "0.0000" : i.retentionAmount,
    linkage:
      i.status === "DRAFT"
        ? null
        : {
            hasHistory: i.status === "CANCELLED",
            currentEntryNo: i.entryNo,
            originalEntryNo: i.entryNo,
            entries: [],
          },
  };
}
function ipcSummary(i: MockIpc) {
  return {
    id: i.id,
    ipcSeqNo: i.ipcSeqNo,
    entryNo: i.entryNo,
    projectId: i.projectId,
    customerId: i.customerId,
    ipcDate: i.ipcDate,
    certifiedAmount: i.certifiedAmount,
    currentlyDueAmount: ipcCurrentlyDue(i),
    outstandingAmount: i.status === "CANCELLED" ? "0.0000" : ipcCurrentlyDue(i),
    retentionHeldAmount: i.status === "CANCELLED" ? "0.0000" : i.retentionAmount,
    advanceRecoveredAmount: i.advanceRecoveredAmount,
    status: i.status,
  };
}

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

  // GET /masters/companies/:id — the single company profile (Mushak print BIN/TIN source).
  const companyMatch = /^\/masters\/companies(?:\/([^/]+))?$/.exec(pathname ?? "");
  if (companyMatch && req.method === "GET") {
    return {
      status: 200,
      body: success({
        id: user.companyId,
        name: "Zakir Enterprise",
        legalName: "Zakir Enterprise Ltd.",
        bin: "004123456-0203",
        tin: "512345678901",
        address: "House 42, Road 11, Banani, Dhaka-1213, Bangladesh",
      }),
    };
  }

  // GET /ledger/entries/:id — the posted journal entry with balanced lines (SAL IPC viewer
  // reads this via `sales-ipc/api/ledger.ts` for the ledger-lines panel). Guarded by
  // `ledger.journal_entries:READ`; PMs get 403 (brief G3). Synthesises a canonical
  // AR + Retention + Advance + AIT (Dr) / Revenue + Output VAT (Cr) split from the IPC.
  const entryMatch = /^\/ledger\/entries\/([^/]+)$/.exec(pathname ?? "");
  if (entryMatch && req.method === "GET") {
    if (user.role === "PROJECT_MANAGER") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to the ledger detail for this IPC.") };
    }
    const entryId = entryMatch[1]!;
    const ipc = MOCK_IPCS.find((i) => i.journalEntryId === entryId || `je-${i.id}` === entryId || `je-${i.id}-v2` === entryId);
    if (!ipc) return { status: 404, body: envelope("NOT_FOUND", "Journal entry not found") };
    const zero = "0.0000";
    const lines = [
      { id: `${entryId}-l1`, lineNo: 1, accountId: "1200", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: ipc.customerId, debit: ipcCurrentlyDue(ipc), credit: zero, narration: null },
      { id: `${entryId}-l2`, lineNo: 2, accountId: "1210", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: ipc.customerId, debit: ipc.retentionAmount, credit: zero, narration: null },
      { id: `${entryId}-l3`, lineNo: 3, accountId: "1310", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: ipc.customerId, debit: ipc.advanceRecoveredAmount, credit: zero, narration: null },
      { id: `${entryId}-l4`, lineNo: 4, accountId: "1450", projectId: null, costCentreId: null, purposeId: null, godownId: null, partyId: null, debit: ipc.aitTdsAmount, credit: zero, narration: null },
      { id: `${entryId}-l5`, lineNo: 5, accountId: "4100", projectId: ipc.projectId, costCentreId: ipc.costCentreId, purposeId: ipc.purposeId, godownId: null, partyId: null, debit: zero, credit: ipc.certifiedAmount, narration: null },
      { id: `${entryId}-l6`, lineNo: 6, accountId: "2310", projectId: ipc.projectId, costCentreId: ipc.costCentreId, purposeId: ipc.purposeId, godownId: null, partyId: null, debit: zero, credit: ipc.outputVatAmount, narration: null },
    ];
    const totalDr = lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
    const totalCr = lines.reduce((s, l) => s + Number(l.credit), 0).toFixed(4);
    return {
      status: 200,
      body: {
        id: entryId,
        entryNo: ipc.entryNo ?? "",
        voucherType: "SALES_IPC",
        voucherDate: ipc.ipcDate,
        postedAt: ipc.postedAt ?? new Date().toISOString(),
        totalDebit: totalDr,
        totalCredit: totalCr,
        lines,
      },
    };
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

  // GET /masters/accounts — chart-of-accounts list (Mushak print + IPC viewer + LED entry
  // viewer feed off this via `lib/masters/lookups`). A small seeded slice covering the
  // canonical IPC posting lines (1200 AR, 1210 Retention Receivable, 1310 Advance Recovered,
  // 1450 AIT/TDS Receivable, 4100 Sales Revenue, 2310 Output VAT Payable) plus a couple of
  // cash/expense accounts that other Done screens reference. Same envelope shape as parties.
  if (pathname === "/masters/accounts" && req.method === "GET") {
    return {
      status: 200,
      body: pageEnvelope([
        { id: "1200", code: "1200", name: "Accounts Receivable", accountType: "ASSET", isActive: true },
        { id: "1210", code: "1210", name: "Retention Receivable", accountType: "ASSET", isActive: true },
        { id: "1310", code: "1310", name: "Advance to Contractor (recovery)", accountType: "ASSET", isActive: true },
        { id: "1450", code: "1450", name: "AIT / TDS Receivable", accountType: "ASSET", isActive: true },
        { id: "4100", code: "4100", name: "Contract Revenue", accountType: "REVENUE", isActive: true },
        { id: "2310", code: "2310", name: "Output VAT Payable", accountType: "LIABILITY", isActive: true },
        { id: "1010", code: "1010", name: "Cash in Hand", accountType: "ASSET", isActive: true },
        { id: "1020", code: "1020", name: "Bank — Operating", accountType: "ASSET", isActive: true },
        { id: "5100", code: "5100", name: "Material Expense", accountType: "EXPENSE", isActive: true },
      ]),
    };
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

  // ── Sales / IPC (fe-ipc-editor) — voucher lifecycle ──
  if (pathname === "/sales/ipc" && req.method === "GET") {
    let rows = MOCK_IPCS.filter((i) => scopeOk(i.projectId));
    const projectId = params.get("projectId");
    const customerId = params.get("customerId");
    const statusCsv = params.get("status");
    const entryNo = params.get("entryNo");
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    if (projectId) rows = rows.filter((i) => i.projectId === projectId);
    if (customerId) rows = rows.filter((i) => i.customerId === customerId);
    if (statusCsv) {
      const wanted = new Set(statusCsv.split(","));
      rows = rows.filter((i) => wanted.has(i.status));
    }
    if (entryNo) rows = rows.filter((i) => i.entryNo === entryNo);
    if (dateFrom) rows = rows.filter((i) => i.ipcDate >= dateFrom);
    if (dateTo) rows = rows.filter((i) => i.ipcDate <= dateTo);
    rows = rows.slice().sort((a, b) => (a.ipcDate < b.ipcDate ? 1 : -1)); // newest-first
    return { status: 200, body: pageEnvelope(rows.map(ipcSummary)) };
  }

  if (pathname === "/sales/ipc" && req.method === "POST") {
    const b = body as Partial<MockIpc> & { version?: number };
    const project = MOCK_PROJECTS.find((p) => p.id === b.projectId);
    if (!project) return { status: 404, body: envelope("NOT_FOUND", "Project not found") };
    if (!scopeOk(project.id)) return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    if (project.status === "CLOSED") return { status: 409, body: envelope("PROJECT_CLOSED", "This project is closed and can't accept new IPCs.") };
    const seqNo = Number(b.ipcSeqNo ?? 0);
    if (Number(b.certifiedAmount ?? 0) <= 0) return { status: 400, body: envelope("VALIDATION_ERROR", "Certified amount must be greater than zero.") };
    if ((b.dueDate ?? "") < (b.billDate ?? "")) return { status: 400, body: envelope("VALIDATION_ERROR", "Due date can't be before the bill date.") };
    if (MOCK_IPCS.some((i) => i.projectId === project.id && i.ipcSeqNo === seqNo)) {
      return { status: 409, body: envelope("DUPLICATE_IPC_SEQ_NO", `This project already has IPC #${seqNo}.`) };
    }
    if (Number(b.advanceRecoveredAmount ?? 0) > Number(project.remainingAdvance)) {
      return { status: 409, body: envelope("ADVANCE_EXCEEDS_REMAINING", "Advance recovered exceeds the remaining project advance.") };
    }
    const draft = mkIpc({
      id: `ipc-${(ipcSeq += 1)}`,
      projectId: project.id,
      customerId: project.customerId,
      ipcSeqNo: seqNo,
      ipcDate: b.ipcDate,
      billDate: b.billDate,
      dueDate: b.dueDate,
      workCompletedPct: b.workCompletedPct,
      certifiedAmount: String(b.certifiedAmount),
      costCentreId: b.costCentreId,
      purposeId: b.purposeId,
      outputVatAmount: b.outputVatAmount,
      aitTdsAmount: b.aitTdsAmount,
      retentionAmount: b.retentionAmount,
      advanceRecoveredAmount: b.advanceRecoveredAmount,
      narration: b.narration ?? null,
      status: "DRAFT",
    });
    if (Number(ipcCurrentlyDue(draft)) === 0 && Number(draft.certifiedAmount) > 0 &&
      Number(draft.certifiedAmount) + Number(draft.outputVatAmount) - Number(draft.retentionAmount) - Number(draft.advanceRecoveredAmount) - Number(draft.aitTdsAmount) < 0) {
      return { status: 400, body: envelope("CURRENTLY_DUE_NEGATIVE", "These figures make the currently-due amount negative.") };
    }
    MOCK_IPCS.unshift(draft);
    return { status: 201, body: success({ id: draft.id }) };
  }

  // ── SAL register + retention releases (fe-ipc-register-retention) ──
  //
  // `retentionHeldAmount` = gross − released; the register's `totals.retainedHeld` = Σ per
  // posted IPC. `MOCK_RELEASES` is declared at module scope above so state persists across
  // requests (a per-request local was the earlier bug that made releases invisible on refetch).
  const releasedTotal = (ipcId: string) =>
    MOCK_RELEASES.filter((r) => r.ipcId === ipcId).reduce((sum, r) => sum + Number(r.releasedAmount), 0);
  const ipcHeldNet = (i: MockIpc) => {
    if (i.status !== "POSTED") return "0.0000";
    return (Number(i.retentionAmount) - releasedTotal(i.id)).toFixed(4);
  };

  const registerMatch = /^\/sales\/projects\/([^/]+)\/register$/.exec(pathname ?? "");
  if (registerMatch && req.method === "GET") {
    const projectId = registerMatch[1]!;
    const project = MOCK_PROJECTS.find((p) => p.id === projectId);
    if (!project) return { status: 404, body: envelope("NOT_FOUND", "Project not found") };
    if (!scopeOk(project.id)) return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project's register.") };
    const posted = MOCK_IPCS
      .filter((i) => i.projectId === projectId && i.status === "POSTED")
      .slice()
      .sort((a, b) => a.ipcSeqNo - b.ipcSeqNo);
    let cumC = 0, cumD = 0, cumR = 0, cumA = 0, cumRec = 0;
    const rows = posted.map((i) => {
      const cert = Number(i.certifiedAmount);
      const due = Number(ipcCurrentlyDue(i));
      const ret = Number(i.retentionAmount);
      const adv = Number(i.advanceRecoveredAmount);
      // Mock: no receipts wired — the last row for proj-a surfaces a "Pending sync" partial
      // (null receivedAmount) to exercise the state matrix; the rest resolve to "0.0000".
      const isPending = i.id === "ipc-7";
      const rec = isPending ? null : 0;
      cumC += cert; cumD += due; cumR += ret; cumA += adv;
      if (rec !== null) cumRec += rec;
      return {
        ipcId: i.id,
        ipcSeqNo: i.ipcSeqNo,
        ipcDate: i.ipcDate,
        entryNo: i.entryNo!,
        certifiedAmount: cert.toFixed(4),
        currentlyDueAmount: due.toFixed(4),
        retentionAmount: ret.toFixed(4),
        advanceRecoveredAmount: adv.toFixed(4),
        receivedAmount: rec === null ? null : rec.toFixed(4),
        outstandingAmount: (due - (rec ?? 0)).toFixed(4),
        cumCertified: cumC.toFixed(4),
        cumBilledDue: cumD.toFixed(4),
        cumRetainedHeld: cumR.toFixed(4),
        cumAdvanceRecovered: cumA.toFixed(4),
        cumReceived: rec === null ? null : cumRec.toFixed(4),
      };
    });
    const heldNet = posted.reduce((sum, i) => sum + Number(ipcHeldNet(i)), 0);
    const totals = {
      certified: cumC.toFixed(4),
      billedDue: cumD.toFixed(4),
      retainedHeld: heldNet.toFixed(4),
      advanceRecovered: cumA.toFixed(4),
      received: cumRec.toFixed(4),
      outstanding: (cumD - cumRec).toFixed(4),
    };
    return { status: 200, body: success({ rows, totals }) };
  }

  const releaseMatch = /^\/sales\/ipc\/([^/]+)\/(release-retention|retention-releases)$/.exec(pathname ?? "");
  if (releaseMatch) {
    const id = releaseMatch[1]!;
    const kind = releaseMatch[2]!;
    const ipc = MOCK_IPCS.find((i) => i.id === id);
    if (!ipc) return { status: 404, body: envelope("NOT_FOUND", "IPC not found") };
    if (!scopeOk(ipc.projectId)) return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this IPC.") };

    if (kind === "retention-releases" && req.method === "GET") {
      return { status: 200, body: success(MOCK_RELEASES.filter((r) => r.ipcId === id)) };
    }

    if (kind === "release-retention" && req.method === "POST") {
      if (ipc.status !== "POSTED") {
        return { status: 409, body: envelope("VOUCHER_NOT_POSTED", "This IPC isn't posted yet — retention can only be released from a posted IPC.") };
      }
      const project = MOCK_PROJECTS.find((p) => p.id === ipc.projectId);
      if (project?.status === "CLOSED") {
        return { status: 409, body: envelope("PROJECT_CLOSED", "This project is closed — release isn't allowed.") };
      }
      const b = body as { releaseDate?: string; releasedAmount?: string; narration?: string };
      if (!b.releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.releaseDate)) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a valid release date.") };
      }
      const held = Number(ipcHeldNet(ipc));
      const requested = b.releasedAmount != null && String(b.releasedAmount).trim() !== "" ? Number(b.releasedAmount) : held;
      if (requested <= 0) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Enter an amount greater than zero.") };
      }
      if (requested > held + 1e-6) {
        return { status: 409, body: envelope("OVER_RELEASE", `You can't release more than the retention held (৳${held.toFixed(4)}).`) };
      }
      const entryNo = `IPC/2526/${String((ipcNumberSeq += 1)).padStart(4, "0")}`;
      const release: MockRelease = {
        id: `rel-${MOCK_RELEASES.length + 1}`,
        ipcId: id,
        releaseDate: b.releaseDate,
        releasedAmount: requested.toFixed(4),
        entryNo,
        status: "POSTED",
        postedAt: new Date().toISOString(),
        postedBy: user.id,
      };
      MOCK_RELEASES.push(release);
      return {
        status: 201,
        body: success({ id: release.id, ipcId: id, entryNo, releasedAmount: release.releasedAmount, status: "POSTED" }),
      };
    }
  }

  const ipcMatch = /^\/sales\/ipc\/([^/]+)(?:\/(post|cancel|repost))?$/.exec(pathname ?? "");
  if (ipcMatch) {
    const id = ipcMatch[1]!;
    const action = ipcMatch[2];
    const ipc = MOCK_IPCS.find((i) => i.id === id);
    if (!ipc) return { status: 404, body: envelope("NOT_FOUND", "IPC not found") };
    if (!scopeOk(ipc.projectId)) return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this IPC.") };
    const b = body as Partial<MockIpc> & { version?: number; reason?: string };

    if (req.method === "GET" && !action) {
      return { status: 200, body: success(ipcResource(ipc)) };
    }

    if (req.method === "PATCH" && !action) {
      if (ipc.status !== "DRAFT") return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This IPC has been posted and can no longer be edited.") };
      if (b.version !== undefined && b.version !== ipc.version) return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This IPC was just changed by someone else.") };
      const project = MOCK_PROJECTS.find((p) => p.id === (b.projectId ?? ipc.projectId));
      if (b.ipcSeqNo !== undefined && MOCK_IPCS.some((i) => i.id !== ipc.id && i.projectId === (b.projectId ?? ipc.projectId) && i.ipcSeqNo === Number(b.ipcSeqNo))) {
        return { status: 409, body: envelope("DUPLICATE_IPC_SEQ_NO", `This project already has IPC #${Number(b.ipcSeqNo)}.`) };
      }
      Object.assign(ipc, {
        projectId: b.projectId ?? ipc.projectId,
        customerId: project?.customerId ?? ipc.customerId,
        ipcSeqNo: b.ipcSeqNo !== undefined ? Number(b.ipcSeqNo) : ipc.ipcSeqNo,
        ipcDate: b.ipcDate ?? ipc.ipcDate,
        billDate: b.billDate ?? ipc.billDate,
        dueDate: b.dueDate ?? ipc.dueDate,
        workCompletedPct: b.workCompletedPct ?? ipc.workCompletedPct,
        certifiedAmount: b.certifiedAmount != null ? String(b.certifiedAmount) : ipc.certifiedAmount,
        costCentreId: b.costCentreId ?? ipc.costCentreId,
        purposeId: b.purposeId ?? ipc.purposeId,
        outputVatAmount: b.outputVatAmount ?? ipc.outputVatAmount,
        aitTdsAmount: b.aitTdsAmount ?? ipc.aitTdsAmount,
        retentionAmount: b.retentionAmount ?? ipc.retentionAmount,
        advanceRecoveredAmount: b.advanceRecoveredAmount ?? ipc.advanceRecoveredAmount,
        narration: b.narration !== undefined ? b.narration : ipc.narration,
        version: ipc.version + 1,
      });
      return { status: 200, body: success(ipcResource(ipc)) };
    }

    if (req.method === "DELETE" && !action) {
      if (ipc.status !== "DRAFT") return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "Only a draft IPC can be discarded.") };
      MOCK_IPCS.splice(MOCK_IPCS.indexOf(ipc), 1);
      return { status: 204, body: null };
    }

    if (req.method === "POST" && action === "post") {
      if (ipc.status !== "DRAFT") return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This IPC has already been posted.") };
      if (b.version !== undefined && b.version !== ipc.version) return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This IPC was just changed by someone else.") };
      const entryNo = `IPC/2526/${String((ipcNumberSeq += 1)).padStart(4, "0")}`;
      Object.assign(ipc, {
        status: "POSTED",
        entryNo,
        journalEntryId: `je-${ipc.id}`,
        postedAt: new Date().toISOString(),
        postedBy: user.id,
        version: ipc.version + 1,
      });
      return { status: 200, body: success({ id: ipc.id, entryNo, journalEntryId: ipc.journalEntryId, status: "POSTED", currentlyDueAmount: ipcCurrentlyDue(ipc) }) };
    }

    if (req.method === "POST" && action === "cancel") {
      if (ipc.status === "DRAFT") return { status: 409, body: envelope("VOUCHER_NOT_POSTED", "This IPC isn't posted, so it can't be cancelled.") };
      if (ipc.status === "CANCELLED") return { status: 409, body: envelope("ALREADY_REVERSED", "This IPC has already been cancelled.") };
      if (!String(b.reason ?? "").trim()) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a reason for cancelling this IPC.") };
      const reversalEntryNo = `IPC/2526/${String((ipcNumberSeq += 1)).padStart(4, "0")}`;
      Object.assign(ipc, { status: "CANCELLED", reversalEntryNo, version: ipc.version + 1 });
      return { status: 200, body: success({ id: ipc.id, status: "CANCELLED", reversalEntryId: `je-${ipc.id}-rev`, reversalEntryNo }) };
    }

    if (req.method === "POST" && action === "repost") {
      if (ipc.status === "DRAFT") return { status: 409, body: envelope("VOUCHER_NOT_POSTED", "This IPC isn't posted, so it can't be reposted.") };
      if (ipc.status === "CANCELLED") return { status: 409, body: envelope("ALREADY_REVERSED", "This IPC has already been cancelled.") };
      if (!String(b.reason ?? "").trim()) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a reason for correcting this IPC.") };
      const reversalEntryNo = `IPC/2526/${String((ipcNumberSeq += 1)).padStart(4, "0")}`;
      const entryNo = `IPC/2526/${String((ipcNumberSeq += 1)).padStart(4, "0")}`;
      Object.assign(ipc, {
        certifiedAmount: b.certifiedAmount != null ? String(b.certifiedAmount) : ipc.certifiedAmount,
        workCompletedPct: b.workCompletedPct ?? ipc.workCompletedPct,
        outputVatAmount: b.outputVatAmount ?? ipc.outputVatAmount,
        aitTdsAmount: b.aitTdsAmount ?? ipc.aitTdsAmount,
        retentionAmount: b.retentionAmount ?? ipc.retentionAmount,
        advanceRecoveredAmount: b.advanceRecoveredAmount ?? ipc.advanceRecoveredAmount,
        narration: b.narration !== undefined ? b.narration : ipc.narration,
        status: "POSTED",
        entryNo,
        reversalEntryNo,
        journalEntryId: `je-${ipc.id}-v2`,
        version: ipc.version + 1,
      });
      return { status: 200, body: success({ id: ipc.id, status: "POSTED", entryNo, reversalEntryNo, currentlyDueAmount: ipcCurrentlyDue(ipc) }) };
    }
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

  // ── Requisition /:id/issues/:issueId/reverse (FR-REQ-017) ──
  const rev = /^\/requisition\/([^/]+)\/issues\/([^/]+)\/reverse$/.exec(pathname ?? "");
  if (rev && req.method === "POST") {
    const [, reqId, issueId] = rev;
    const r = MOCK_REQUISITIONS.find((x) => x.id === reqId);
    if (!r) return { status: 404, body: envelope("NOT_FOUND", "Requisition not found") };
    const iss = MOCK_REQ_ISSUES.find((i) => i.requisitionIssueId === issueId && i.requisitionId === reqId);
    if (!iss) return { status: 404, body: envelope("NOT_FOUND", "Issue not found") };
    if (iss.reversedAt) return { status: 409, body: envelope("ALREADY_REVERSED", "This issue has already been reversed.") };
    const b = body as Record<string, unknown>;
    if (!String(b.reason ?? "").trim()) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a reason for reversing this issue.") };
    // Restore each line's balance.
    for (const il of iss.lines) {
      const line = r.lines.find((l) => l.id === il.requisitionLineId);
      if (line) {
        line.issuedQuantity = (Number(line.issuedQuantity) - Number(il.issuedQuantity)).toFixed(4);
        line.balanceQuantity = (Number(line.requestedQuantity) - Number(line.issuedQuantity)).toFixed(4);
      }
    }
    iss.reversedAt = new Date().toISOString();
    iss.reversedById = user.id;
    const anyIssued = r.lines.some((l) => Number(l.issuedQuantity) > 0);
    r.status = anyIssued ? "PARTIALLY_ISSUED" : "APPROVED";
    r.version += 1;
    return { status: 200, body: success(r) };
  }

  // ── Requisition /:id [/submit|approve|reject|approvals|issue|close|outstanding|issues] ──
  const rm = /^\/requisition\/([^/]+)(?:\/(submit|approve|reject|approvals|issue|close|outstanding|issues))?$/.exec(pathname ?? "");
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

    // Outstanding balance (FR-REQ-021).
    if (req.method === "GET" && action === "outstanding") {
      return {
        status: 200,
        body: success({
          requisitionId: id,
          status: r.status,
          lines: r.lines.map((l) => ({
            requisitionLineId: l.id, itemId: l.itemId, requestedQuantity: l.requestedQuantity,
            issuedQuantity: l.issuedQuantity, balanceQuantity: l.balanceQuantity, uom: l.uom,
          })),
          totalOutstandingValueIndicative: reqOutstandingValue(r),
        }),
      };
    }

    // Issue history (FR-REQ-013…-019).
    if (req.method === "GET" && action === "issues") {
      return { status: 200, body: success(MOCK_REQ_ISSUES.filter((i) => i.requisitionId === id)) };
    }

    // Issue material — atomic stock deduct + consumption post (FR-REQ-012…-016).
    if (req.method === "POST" && action === "issue") {
      if (r.status !== "APPROVED" && r.status !== "PARTIALLY_ISSUED") {
        return { status: 409, body: envelope("REQUISITION_NOT_APPROVED", "This requisition can no longer be issued.") };
      }
      const fromGodown = String(b.fromGodownId ?? "");
      const allowNeg = b.allowNegativeStock === true;
      const bodyLines = (Array.isArray(b.lines) ? b.lines : []) as Array<{ requisitionLineId: string; issueQuantity: string; godownId?: string }>;
      const resultLines: MockReqIssueLine[] = [];
      let issuedValue = 0;
      for (const bl of bodyLines) {
        const line = r.lines.find((l) => l.id === bl.requisitionLineId);
        if (!line) return { status: 400, body: envelope("VALIDATION_ERROR", "Unknown requisition line.") };
        const qty = Number(bl.issueQuantity);
        if (qty <= 0 || qty > Number(line.balanceQuantity)) {
          return { status: 400, body: envelope("ISSUE_EXCEEDS_BALANCE", `This exceeds the outstanding balance (${line.balanceQuantity}).`) };
        }
        const godown = bl.godownId ?? fromGodown;
        if (!allowNeg && user.role !== "ADMIN" && qty > reqOnHand(godown, line.itemId)) {
          return { status: 409, body: envelope("NEGATIVE_STOCK_BLOCKED", "Not enough stock on hand.") };
        }
        const rate = reqIndicativeRate(line.itemId, godown) ?? "0.0000";
        const value = qty * Number(rate);
        issuedValue += value;
        resultLines.push({ requisitionLineId: line.id, stockMovementId: `mv-req-${reqIssueSeq}-${resultLines.length}`, issuedQuantity: qty.toFixed(4), rate, value: value.toFixed(4) });
        line.issuedQuantity = (Number(line.issuedQuantity) + qty).toFixed(4);
        line.balanceQuantity = (Number(line.requestedQuantity) - Number(line.issuedQuantity)).toFixed(4);
      }
      const fullyIssued = r.lines.every((l) => Number(l.balanceQuantity) <= 0);
      r.status = fullyIssued ? "ISSUED" : "PARTIALLY_ISSUED";
      r.version += 1;
      const issue: MockReqIssue = {
        requisitionId: id, requisitionIssueId: `ri-${(reqIssueSeq += 1)}`, issueNo: (reqIssueNoSeq += 1),
        journalEntryId: `je-${reqIssueSeq}`, entryNo: `SJ/2526/${String(reqIssueSeq).padStart(4, "0")}`,
        issuedValue: issuedValue.toFixed(4), fromGodownId: fromGodown, lines: resultLines,
        requisitionStatus: r.status, issuedAt: new Date().toISOString(), reversedAt: null, reversedById: null,
      };
      MOCK_REQ_ISSUES.push(issue);
      return { status: 200, body: success(issue) };
    }

    // Manual close — abandon the outstanding balance (FR-REQ-020).
    if (req.method === "POST" && action === "close") {
      if (r.status !== "APPROVED" && r.status !== "PARTIALLY_ISSUED") {
        return { status: 409, body: envelope("NO_OUTSTANDING_BALANCE", "There's no outstanding balance left to close.") };
      }
      const totalBalance = r.lines.reduce((s, l) => s + Number(l.balanceQuantity), 0);
      if (totalBalance <= 0) return { status: 409, body: envelope("NO_OUTSTANDING_BALANCE", "There's no outstanding balance left to close.") };
      const reason = String(b.reason ?? "").trim();
      if (!reason) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a reason for closing this requisition.") };
      r.status = "CLOSED";
      r.closedAt = new Date().toISOString();
      r.closedReason = reason;
      r.version += 1;
      return { status: 200, body: success(r) };
    }
  }

  // ── HR / Employees (fe-employee-master) ─────────────────────────────────────
  // Company-global master; project scope does not apply (Employee master is company-wide,
  // API contract 12 § common note). Every read masks `bankAccountName`/`bankAccountNo` to
  // `•••• {last4}` (NFR-002); a `?reveal=true` GET returns the raw values ONLY for the
  // HR_MANAGER / ADMIN write scope and is audited server-side. Deactivate/Reactivate flip
  // status without deleting history (FR-HR-003). Reassign appends an EmployeeAssignment row
  // (append-only — FR-HR-002).
  interface MockEmployee {
    id: string;
    employeeCode: string;
    name: string;
    designation: string | null;
    defaultProjectId: string | null;
    department: string | null;
    workBase: "HEAD_OFFICE" | "SITE";
    wageType: "MONTHLY" | "DAILY";
    wageAmount: string;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNo: string | null;
    pfApplicable: boolean;
    gratuityApplicable: boolean;
    wppfApplicable: boolean;
    tin: string | null;
    joiningDate: string;
    status: "ACTIVE" | "INACTIVE";
    hasReferences: boolean;
    version: number;
  }
  interface MockAssignment {
    id: string;
    employeeId: string;
    projectId: string;
    effectiveDate: string;
    note: string | null;
  }

  const g = globalThis as unknown as { __ZE_MOCK_HR__?: { employees: MockEmployee[]; assignments: MockAssignment[]; seq: number } };
  if (!g.__ZE_MOCK_HR__) {
    const mkEmp = (o: Partial<MockEmployee> & Pick<MockEmployee, "id" | "employeeCode" | "name" | "workBase" | "wageType" | "wageAmount" | "joiningDate">): MockEmployee => ({
      designation: null, defaultProjectId: null, department: null,
      bankName: null, bankAccountName: null, bankAccountNo: null,
      pfApplicable: false, gratuityApplicable: false, wppfApplicable: false,
      tin: null, status: "ACTIVE", hasReferences: false, version: 1,
      ...o,
    });
    const employees: MockEmployee[] = [
      mkEmp({ id: "emp-1", employeeCode: "EMP-001", name: "মোঃ রফিকুল ইসলাম", designation: "Site Accountant", defaultProjectId: "proj-a", department: "Accounts", workBase: "SITE", wageType: "MONTHLY", wageAmount: "45000.0000", bankName: "Dutch-Bangla Bank", bankAccountName: "Md Rafiqul Islam", bankAccountNo: "1234567890", pfApplicable: true, gratuityApplicable: true, tin: "123456789012", joiningDate: "2024-03-01", hasReferences: true, version: 3 }),
      mkEmp({ id: "emp-2", employeeCode: "EMP-002", name: "Farzana Akter", designation: "Site Engineer", defaultProjectId: "proj-a", department: "Engineering", workBase: "SITE", wageType: "MONTHLY", wageAmount: "60000.0000", bankName: "BRAC Bank", bankAccountName: "Farzana Akter", bankAccountNo: "9988771234", pfApplicable: true, gratuityApplicable: true, tin: "223344556677", joiningDate: "2023-06-15", version: 2 }),
      mkEmp({ id: "emp-3", employeeCode: "EMP-003", name: "Ashraful Alam", designation: "Project Coordinator", defaultProjectId: "proj-b", department: "Operations", workBase: "HEAD_OFFICE", wageType: "MONTHLY", wageAmount: "72000.0000", bankName: "City Bank", bankAccountName: "Ashraful Alam", bankAccountNo: "5566779988", pfApplicable: true, gratuityApplicable: true, joiningDate: "2022-11-01", version: 4 }),
      mkEmp({ id: "emp-4", employeeCode: "EMP-004", name: "Nusrat Jahan", designation: "HR Assistant", department: "HR", workBase: "HEAD_OFFICE", wageType: "MONTHLY", wageAmount: "38000.0000", bankName: "Dutch-Bangla Bank", bankAccountName: "Nusrat Jahan", bankAccountNo: "1122334455", joiningDate: "2025-01-10", version: 1 }),
      mkEmp({ id: "emp-5", employeeCode: "EMP-005", name: "Kamal Hossain", designation: "Storekeeper", defaultProjectId: "proj-c", department: "Store", workBase: "SITE", wageType: "DAILY", wageAmount: "1200.0000", joiningDate: "2024-08-20", status: "INACTIVE", version: 2 }),
      mkEmp({ id: "emp-6", employeeCode: "EMP-006", name: "Salma Begum", designation: "Accounts Officer", defaultProjectId: null, department: "Accounts", workBase: "HEAD_OFFICE", wageType: "MONTHLY", wageAmount: "42000.0000", bankName: "Prime Bank", bankAccountName: "Salma Begum", bankAccountNo: "7788994455", tin: "998877665544", joiningDate: "2024-05-05", version: 1 }),
    ];
    const assignments: MockAssignment[] = [
      { id: "asg-1", employeeId: "emp-1", projectId: "proj-a", effectiveDate: "2024-03-01", note: "Initial assignment" },
      { id: "asg-2", employeeId: "emp-2", projectId: "proj-a", effectiveDate: "2023-06-15", note: "Initial assignment" },
      { id: "asg-3", employeeId: "emp-3", projectId: "proj-b", effectiveDate: "2022-11-01", note: "Initial assignment" },
      { id: "asg-4", employeeId: "emp-5", projectId: "proj-c", effectiveDate: "2024-08-20", note: "Initial assignment" },
      { id: "asg-5", employeeId: "emp-6", projectId: null as unknown as string, effectiveDate: "2024-05-05", note: "Initial assignment" },
    ].filter((a) => a.projectId != null);
    g.__ZE_MOCK_HR__ = { employees, assignments, seq: 100 };
  }
  const HR = g.__ZE_MOCK_HR__;

  function maskBank(e: MockEmployee): { bankAccountName: string | null; bankAccountNo: string | null; bankMasked: boolean } {
    if (!e.bankAccountNo && !e.bankAccountName) return { bankAccountName: null, bankAccountNo: null, bankMasked: true };
    const last4 = (v: string | null) => (v && v.length >= 4 ? `•••• ${v.slice(-4)}` : v);
    return { bankAccountName: last4(e.bankAccountName), bankAccountNo: last4(e.bankAccountNo), bankMasked: true };
  }
  function employeeResource(e: MockEmployee, reveal: boolean) {
    if (reveal) {
      return {
        id: e.id, employeeCode: e.employeeCode, name: e.name, designation: e.designation,
        defaultProjectId: e.defaultProjectId, department: e.department, workBase: e.workBase,
        wageType: e.wageType, wageAmount: e.wageAmount, bankName: e.bankName,
        bankAccountName: e.bankAccountName, bankAccountNo: e.bankAccountNo, bankMasked: false,
        pfApplicable: e.pfApplicable, gratuityApplicable: e.gratuityApplicable, wppfApplicable: e.wppfApplicable,
        tin: e.tin, joiningDate: e.joiningDate, status: e.status, hasReferences: e.hasReferences, version: e.version,
      };
    }
    const mask = maskBank(e);
    return {
      id: e.id, employeeCode: e.employeeCode, name: e.name, designation: e.designation,
      defaultProjectId: e.defaultProjectId, department: e.department, workBase: e.workBase,
      wageType: e.wageType, wageAmount: e.wageAmount, bankName: e.bankName,
      bankAccountName: mask.bankAccountName, bankAccountNo: mask.bankAccountNo, bankMasked: mask.bankMasked,
      pfApplicable: e.pfApplicable, gratuityApplicable: e.gratuityApplicable, wppfApplicable: e.wppfApplicable,
      tin: e.tin, joiningDate: e.joiningDate, status: e.status, hasReferences: e.hasReferences, version: e.version,
    };
  }
  function employeeSummary(e: MockEmployee) {
    return {
      id: e.id, employeeCode: e.employeeCode, name: e.name, designation: e.designation,
      defaultProjectId: e.defaultProjectId, workBase: e.workBase, wageType: e.wageType,
      wageAmount: e.wageAmount, status: e.status, hasReferences: e.hasReferences,
    };
  }
  const hrUserRole = user?.role;
  function hrCanWrite() {
    return hrUserRole === "ADMIN" || hrUserRole === "HR_MANAGER";
  }

  // GET /hr/employees — list
  if (pathname === "/hr/employees" && req.method === "GET") {
    let rows = HR.employees.slice();
    const status = params.get("status");
    const projectId = params.get("defaultProjectId");
    const wageType = params.get("wageType");
    const q = (params.get("q") ?? "").trim().toLowerCase();
    if (status) rows = rows.filter((e) => status.split(",").includes(e.status));
    if (projectId) rows = rows.filter((e) => e.defaultProjectId === projectId);
    if (wageType) rows = rows.filter((e) => e.wageType === wageType);
    if (q) rows = rows.filter((e) => e.employeeCode.toLowerCase().includes(q) || e.name.toLowerCase().includes(q));
    return { status: 200, body: pageEnvelope(rows.map(employeeSummary)) };
  }

  // POST /hr/employees — create
  if (pathname === "/hr/employees" && req.method === "POST") {
    if (!hrCanWrite()) return { status: 403, body: envelope("FORBIDDEN", "You don't have permission to create employees.") };
    const b = body as Partial<MockEmployee>;
    if (!b.employeeCode || String(b.employeeCode).trim() === "") return { status: 400, body: envelope("VALIDATION_ERROR", "Enter an employee code.") };
    if (!b.name || String(b.name).trim() === "") return { status: 400, body: envelope("VALIDATION_ERROR", "Enter the employee's name.") };
    if (!b.workBase) return { status: 400, body: envelope("VALIDATION_ERROR", "Select a work base.") };
    if (!b.wageType) return { status: 400, body: envelope("VALIDATION_ERROR", "Select a wage type.") };
    if (!b.joiningDate) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a joining date.") };
    if (Number(b.wageAmount ?? "0") < 0) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a wage amount of ৳0 or more.") };
    if (b.tin && !/^\d{12}$/.test(String(b.tin))) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a valid TIN.") };
    if (HR.employees.some((e) => e.employeeCode === b.employeeCode)) {
      return { status: 409, body: envelope("DUPLICATE_CODE", "This employee code is already in use.") };
    }
    if (b.defaultProjectId && !MOCK_PROJECTS.some((p) => p.id === b.defaultProjectId)) {
      return { status: 400, body: envelope("CROSS_COMPANY_REFERENCE", "That project belongs to a different company.") };
    }
    const now = new Date().toISOString().slice(0, 10);
    const emp: MockEmployee = {
      id: `emp-new-${(HR.seq += 1)}`,
      employeeCode: String(b.employeeCode).trim(),
      name: String(b.name).trim(),
      designation: b.designation ?? null,
      defaultProjectId: b.defaultProjectId ?? null,
      department: b.department ?? null,
      workBase: b.workBase,
      wageType: b.wageType,
      wageAmount: String(b.wageAmount ?? "0"),
      bankName: b.bankName ?? null,
      bankAccountName: b.bankAccountName ?? null,
      bankAccountNo: b.bankAccountNo ?? null,
      pfApplicable: b.pfApplicable ?? false,
      gratuityApplicable: b.gratuityApplicable ?? false,
      wppfApplicable: b.wppfApplicable ?? false,
      tin: b.tin ?? null,
      joiningDate: String(b.joiningDate ?? now),
      status: "ACTIVE",
      hasReferences: false,
      version: 1,
    };
    HR.employees.unshift(emp);
    if (emp.defaultProjectId) {
      HR.assignments.unshift({
        id: `asg-new-${HR.seq}`,
        employeeId: emp.id,
        projectId: emp.defaultProjectId,
        effectiveDate: emp.joiningDate,
        note: "Initial assignment",
      });
    }
    return { status: 201, body: success({ id: emp.id }) };
  }

  // /hr/employees/:id + subactions
  const empMatch = /^\/hr\/employees\/([^/]+)(?:\/(reassign|deactivate|reactivate|assignments))?$/.exec(pathname ?? "");
  if (empMatch) {
    const id = empMatch[1]!;
    const action = empMatch[2];
    const emp = HR.employees.find((e) => e.id === id);
    if (!emp) return { status: 404, body: envelope("NOT_FOUND", "Employee not found.") };
    const b = body as Partial<MockEmployee> & { version?: number; projectId?: string; effectiveDate?: string; note?: string | null };

    if (req.method === "GET" && !action) {
      const reveal = params.get("reveal") === "true";
      if (reveal && !hrCanWrite()) {
        return { status: 403, body: envelope("FORBIDDEN", "You don't have permission to reveal bank details.") };
      }
      return { status: 200, body: success(employeeResource(emp, reveal)) };
    }

    if (req.method === "GET" && action === "assignments") {
      const rows = HR.assignments.filter((a) => a.employeeId === id).slice().sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1));
      return { status: 200, body: success(rows) };
    }

    if (req.method === "PATCH" && !action) {
      if (!hrCanWrite()) return { status: 403, body: envelope("FORBIDDEN", "You don't have permission to edit employees.") };
      if (typeof b.version !== "number" || b.version !== emp.version) {
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This employee was just changed by someone else. Reload and try again.") };
      }
      if ((b as { employeeCode?: string }).employeeCode && (b as { employeeCode?: string }).employeeCode !== emp.employeeCode) {
        if (emp.hasReferences) {
          return { status: 409, body: envelope("IMMUTABLE_EMPLOYEE_CODE", "This employee code can't be changed — it's already used in attendance or salary.") };
        }
      }
      if (b.defaultProjectId && !MOCK_PROJECTS.some((p) => p.id === b.defaultProjectId)) {
        return { status: 400, body: envelope("CROSS_COMPANY_REFERENCE", "That project belongs to a different company.") };
      }
      if (b.wageAmount !== undefined && Number(b.wageAmount) < 0) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a wage amount of ৳0 or more.") };
      }
      if (b.tin && !/^\d{12}$/.test(String(b.tin))) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a valid TIN.") };
      }
      Object.assign(emp, {
        name: b.name ?? emp.name,
        designation: b.designation === undefined ? emp.designation : b.designation,
        defaultProjectId: b.defaultProjectId === undefined ? emp.defaultProjectId : b.defaultProjectId,
        department: b.department === undefined ? emp.department : b.department,
        workBase: b.workBase ?? emp.workBase,
        wageType: b.wageType ?? emp.wageType,
        wageAmount: b.wageAmount ?? emp.wageAmount,
        bankName: b.bankName === undefined ? emp.bankName : b.bankName,
        bankAccountName: b.bankAccountName === undefined ? emp.bankAccountName : b.bankAccountName,
        bankAccountNo: b.bankAccountNo === undefined ? emp.bankAccountNo : b.bankAccountNo,
        pfApplicable: b.pfApplicable ?? emp.pfApplicable,
        gratuityApplicable: b.gratuityApplicable ?? emp.gratuityApplicable,
        wppfApplicable: b.wppfApplicable ?? emp.wppfApplicable,
        tin: b.tin === undefined ? emp.tin : b.tin,
        version: emp.version + 1,
      });
      return { status: 200, body: success(employeeResource(emp, false)) };
    }

    if (req.method === "POST" && action === "reassign") {
      if (!hrCanWrite()) return { status: 403, body: envelope("FORBIDDEN", "You don't have permission to reassign employees.") };
      if (typeof b.version !== "number" || b.version !== emp.version) {
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This employee was just changed by someone else. Reload and try again.") };
      }
      const projectId = String(b.projectId ?? "");
      const effectiveDate = String(b.effectiveDate ?? "");
      if (!projectId) return { status: 400, body: envelope("VALIDATION_ERROR", "Select a project.") };
      if (!MOCK_PROJECTS.some((p) => p.id === projectId)) {
        return { status: 400, body: envelope("CROSS_COMPANY_REFERENCE", "That project belongs to a different company.") };
      }
      if (!effectiveDate) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter an effective date.") };
      if (effectiveDate < emp.joiningDate) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Effective date can't be before the joining date.") };
      }
      HR.assignments.unshift({
        id: `asg-new-${(HR.seq += 1)}`,
        employeeId: emp.id,
        projectId,
        effectiveDate,
        note: b.note ?? null,
      });
      emp.defaultProjectId = projectId;
      emp.version += 1;
      return { status: 200, body: success(employeeResource(emp, false)) };
    }

    if (req.method === "POST" && action === "deactivate") {
      if (!hrCanWrite()) return { status: 403, body: envelope("FORBIDDEN", "You don't have permission.") };
      if (typeof b.version !== "number" || b.version !== emp.version) {
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This employee was just changed by someone else. Reload and try again.") };
      }
      emp.status = "INACTIVE";
      emp.version += 1;
      return { status: 200, body: success(employeeResource(emp, false)) };
    }

    if (req.method === "POST" && action === "reactivate") {
      if (!hrCanWrite()) return { status: 403, body: envelope("FORBIDDEN", "You don't have permission.") };
      if (typeof b.version !== "number" || b.version !== emp.version) {
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This employee was just changed by someone else. Reload and try again.") };
      }
      emp.status = "ACTIVE";
      emp.version += 1;
      return { status: 200, body: success(employeeResource(emp, false)) };
    }
  }

  // ── HR Attendance (fe-attendance) ──
  // Three modes (office / daily-labour / subcontractor). Only daily-labour has a
  // Confirm/Reverse lifecycle — that is the accrual post. Subcontractor is GL-free
  // (SRS §5.2; overview §5.1 matrix). Simulated period-closed for dates ≤ 2025-03-31.
  interface MockAttendance {
    id: string;
    mode: "OFFICE" | "DAILY_LABOUR" | "SUBCONTRACTOR";
    attendanceDate: string;
    projectId: string;
    costCentreId: string | null;
    purposeId: string | null;
    employeeId: string | null;
    checkIn: string | null;
    checkOut: string | null;
    dayStatus: string | null;
    overtimeHours: string | null;
    partyId: string | null;
    headCount: number | null;
    labourCategory: string | null;
    dailyRate: string | null;
    source: "MANUAL" | "BIOMETRIC_IMPORT";
    isConfirmed: boolean;
    accrualEntryId: string | null;
    entryNo: string | null;
    accruedAmount: string | null;
    postedAt: string | null;
    postedBy: string | null;
    reversalEntryNo: string | null;
    reversalEntryId: string | null;
    version: number;
  }
  const ga = globalThis as unknown as { __ZE_MOCK_ATT__?: { rows: MockAttendance[]; seq: number; dlaSeq: number } };
  if (!ga.__ZE_MOCK_ATT__) {
    const seed: MockAttendance[] = [
      // Office (2 rows for today)
      {
        id: "att-off-1", mode: "OFFICE", attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a", costCentreId: null, purposeId: null,
        employeeId: "emp-1", checkIn: "09:15", checkOut: "18:05", dayStatus: "PRESENT", overtimeHours: "1.500",
        partyId: null, headCount: null, labourCategory: null, dailyRate: null,
        source: "MANUAL", isConfirmed: false, accrualEntryId: null, entryNo: null, accruedAmount: null,
        postedAt: null, postedBy: null, reversalEntryNo: null, reversalEntryId: null, version: 1,
      },
      {
        id: "att-off-2", mode: "OFFICE", attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a", costCentreId: null, purposeId: null,
        employeeId: "emp-2", checkIn: "09:02", checkOut: "17:58", dayStatus: "PRESENT", overtimeHours: "0.000",
        partyId: null, headCount: null, labourCategory: null, dailyRate: null,
        source: "BIOMETRIC_IMPORT", isConfirmed: false, accrualEntryId: null, entryNo: null, accruedAmount: null,
        postedAt: null, postedBy: null, reversalEntryNo: null, reversalEntryId: null, version: 1,
      },
      // Daily labour (one CONFIRMED with entryNo, two UNCONFIRMED)
      {
        id: "att-dl-1", mode: "DAILY_LABOUR", attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a", costCentreId: "cc-lab", purposeId: "pp-1",
        employeeId: null, checkIn: null, checkOut: null, dayStatus: null, overtimeHours: null,
        partyId: null, headCount: 20, labourCategory: "Mason", dailyRate: "650.0000",
        source: "MANUAL", isConfirmed: true,
        accrualEntryId: "je-dla-42", entryNo: "SJ/2526/0042",
        accruedAmount: "13000.0000",
        postedAt: new Date().toISOString(),
        postedBy: "00000000-0000-0000-0000-000000000001",
        reversalEntryNo: null, reversalEntryId: null, version: 2,
      },
      {
        id: "att-dl-2", mode: "DAILY_LABOUR", attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a", costCentreId: "cc-lab", purposeId: null,
        employeeId: null, checkIn: null, checkOut: null, dayStatus: null, overtimeHours: null,
        partyId: null, headCount: 12, labourCategory: "Helper", dailyRate: "450.0000",
        source: "MANUAL", isConfirmed: false, accrualEntryId: null, entryNo: null, accruedAmount: null,
        postedAt: null, postedBy: null, reversalEntryNo: null, reversalEntryId: null, version: 1,
      },
      {
        id: "att-dl-3", mode: "DAILY_LABOUR", attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a", costCentreId: "cc-tmp", purposeId: null,
        employeeId: null, checkIn: null, checkOut: null, dayStatus: null, overtimeHours: null,
        partyId: null, headCount: 8, labourCategory: "Formwork", dailyRate: "700.0000",
        source: "MANUAL", isConfirmed: false, accrualEntryId: null, entryNo: null, accruedAmount: null,
        postedAt: null, postedBy: null, reversalEntryNo: null, reversalEntryId: null, version: 1,
      },
      // Subcontractor (2 rows)
      {
        id: "att-sub-1", mode: "SUBCONTRACTOR", attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a", costCentreId: "cc-sub", purposeId: null,
        employeeId: null, checkIn: null, checkOut: null, dayStatus: null, overtimeHours: null,
        partyId: "pa-4", headCount: 25, labourCategory: null, dailyRate: null,
        source: "MANUAL", isConfirmed: false, accrualEntryId: null, entryNo: null, accruedAmount: null,
        postedAt: null, postedBy: null, reversalEntryNo: null, reversalEntryId: null, version: 1,
      },
      {
        id: "att-sub-2", mode: "SUBCONTRACTOR", attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a", costCentreId: "cc-sub", purposeId: null,
        employeeId: null, checkIn: null, checkOut: null, dayStatus: null, overtimeHours: null,
        partyId: "pa-7", headCount: 15, labourCategory: null, dailyRate: null,
        source: "MANUAL", isConfirmed: false, accrualEntryId: null, entryNo: null, accruedAmount: null,
        postedAt: null, postedBy: null, reversalEntryNo: null, reversalEntryId: null, version: 1,
      },
    ];
    ga.__ZE_MOCK_ATT__ = { rows: seed, seq: 100, dlaSeq: 42 };
  }
  const ATT = ga.__ZE_MOCK_ATT__;

  function modeFromQuery(m: string | null): MockAttendance["mode"] | null {
    if (m === "office" || m === "OFFICE") return "OFFICE";
    if (m === "daily-labour" || m === "DAILY_LABOUR") return "DAILY_LABOUR";
    if (m === "subcontractor" || m === "SUBCONTRACTOR") return "SUBCONTRACTOR";
    return null;
  }

  function isPeriodClosed(date: string): boolean {
    // Simulated: any attendance date on or before FY 24–25 close (2025-03-31) is closed.
    return date <= "2025-03-31";
  }

  // GET /attendance?mode=…&attendanceDate=…&projectId=…&costCentreId=…
  if (pathname === "/attendance" && req.method === "GET") {
    const mode = modeFromQuery(params.get("mode"));
    if (!mode) return { status: 400, body: envelope("VALIDATION_ERROR", "mode is required") };
    const date = params.get("attendanceDate") ?? "";
    const projectId = params.get("projectId") ?? "";
    const costCentreId = params.get("costCentreId") ?? "";
    let rows = ATT.rows.filter((r) => r.mode === mode && (!date || r.attendanceDate === date));
    if (projectId) rows = rows.filter((r) => r.projectId === projectId);
    if (costCentreId) rows = rows.filter((r) => r.costCentreId === costCentreId);
    return { status: 200, body: pageEnvelope(rows) };
  }

  // POST /attendance/office — bulk save
  if (pathname === "/attendance/office" && req.method === "POST") {
    const b = body as { rows?: unknown };
    if (!Array.isArray(b.rows)) return { status: 400, body: envelope("VALIDATION_ERROR", "rows[] is required") };
    const ids: string[] = [];
    for (const raw of b.rows as Array<Record<string, unknown>>) {
      const employeeId = String(raw.employeeId ?? "");
      const attendanceDate = String(raw.attendanceDate ?? "");
      const projectId = String(raw.projectId ?? "");
      const dayStatus = String(raw.dayStatus ?? "");
      if (!employeeId || !attendanceDate || !projectId || !dayStatus) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Some fields need attention. Please check and try again.") };
      }
      // Upsert per (employeeId, attendanceDate).
      const existing = ATT.rows.find(
        (r) => r.mode === "OFFICE" && r.employeeId === employeeId && r.attendanceDate === attendanceDate,
      );
      if (existing) {
        existing.checkIn = (raw.checkIn as string) ?? null;
        existing.checkOut = (raw.checkOut as string) ?? null;
        existing.dayStatus = dayStatus;
        existing.overtimeHours = (raw.overtimeHours as string) ?? null;
        existing.version += 1;
        ids.push(existing.id);
      } else {
        const id = `att-off-${(ATT.seq += 1)}`;
        ATT.rows.push({
          id, mode: "OFFICE", attendanceDate, projectId,
          costCentreId: null, purposeId: null,
          employeeId,
          checkIn: (raw.checkIn as string) ?? null,
          checkOut: (raw.checkOut as string) ?? null,
          dayStatus,
          overtimeHours: (raw.overtimeHours as string) ?? null,
          partyId: null, headCount: null, labourCategory: null, dailyRate: null,
          source: "MANUAL", isConfirmed: false, accrualEntryId: null,
          entryNo: null, accruedAmount: null, postedAt: null, postedBy: null,
          reversalEntryNo: null, reversalEntryId: null, version: 1,
        });
        ids.push(id);
      }
    }
    return { status: 201, body: success({ ids }) };
  }

  // POST /attendance/office/import — biometric feed with reconciliation
  if (pathname === "/attendance/office/import" && req.method === "POST") {
    const b = body as { deviceFeed?: unknown; rows?: unknown };
    const feed = Array.isArray(b.deviceFeed) ? b.deviceFeed : Array.isArray(b.rows) ? b.rows : [];
    if (!Array.isArray(feed)) {
      return { status: 400, body: envelope("VALIDATION_ERROR", "Paste a JSON array of rows or drop a CSV/XLSX file.") };
    }
    const conflicts: Array<Record<string, unknown>> = [];
    const accepted: Array<Record<string, unknown>> = [];
    for (const raw of feed as Array<Record<string, unknown>>) {
      const employeeId = String(raw.employeeId ?? "");
      const attendanceDate = String(raw.attendanceDate ?? "");
      const existing = ATT.rows.find(
        (r) => r.mode === "OFFICE" && r.employeeId === employeeId && r.attendanceDate === attendanceDate,
      );
      if (existing && existing.source === "MANUAL") {
        conflicts.push({
          employeeId, attendanceDate,
          reason: "Manual entry already exists for this day.",
          manual: {
            employeeId, attendanceDate, projectId: existing.projectId,
            checkIn: existing.checkIn, checkOut: existing.checkOut,
            dayStatus: existing.dayStatus, overtimeHours: existing.overtimeHours,
          },
          imported: raw,
        });
      } else {
        accepted.push(raw);
      }
    }
    return {
      status: 200,
      body: success({
        imported: accepted.length + conflicts.length,
        reconciled: accepted.length,
        accepted,
        conflicts,
      }),
    };
  }

  // POST /attendance/subcontractor — bulk save
  if (pathname === "/attendance/subcontractor" && req.method === "POST") {
    const b = body as { rows?: unknown };
    if (!Array.isArray(b.rows)) return { status: 400, body: envelope("VALIDATION_ERROR", "rows[] is required") };
    const ids: string[] = [];
    for (const raw of b.rows as Array<Record<string, unknown>>) {
      const partyId = String(raw.partyId ?? "");
      const projectId = String(raw.projectId ?? "");
      const costCentreId = String(raw.costCentreId ?? "");
      const headCount = Number(raw.headCount ?? 0);
      const attendanceDate = String(raw.attendanceDate ?? "");
      if (!partyId || !projectId || !costCentreId || headCount < 1 || !attendanceDate) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Some fields need attention. Please check and try again.") };
      }
      const id = `att-sub-${(ATT.seq += 1)}`;
      ATT.rows.push({
        id, mode: "SUBCONTRACTOR", attendanceDate, projectId,
        costCentreId, purposeId: (raw.purposeId as string) ?? null,
        employeeId: null, checkIn: null, checkOut: null, dayStatus: null, overtimeHours: null,
        partyId, headCount, labourCategory: null, dailyRate: null,
        source: "MANUAL", isConfirmed: false, accrualEntryId: null,
        entryNo: null, accruedAmount: null, postedAt: null, postedBy: null,
        reversalEntryNo: null, reversalEntryId: null, version: 1,
      });
      ids.push(id);
    }
    return { status: 201, body: success({ ids }) };
  }

  // POST /attendance/daily-labour — bulk create UNCONFIRMED rows
  if (pathname === "/attendance/daily-labour" && req.method === "POST") {
    const b = body as { rows?: unknown };
    if (!Array.isArray(b.rows)) return { status: 400, body: envelope("VALIDATION_ERROR", "rows[] is required") };
    const ids: string[] = [];
    for (const raw of b.rows as Array<Record<string, unknown>>) {
      const attendanceDate = String(raw.attendanceDate ?? "");
      const projectId = String(raw.projectId ?? "");
      const costCentreId = String(raw.costCentreId ?? "");
      const headCount = Number(raw.headCount ?? 0);
      const dailyRate = String(raw.dailyRate ?? "0");
      if (!attendanceDate || !projectId || !costCentreId || headCount < 1 || Number(dailyRate) < 0) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Some fields need attention. Please check and try again.") };
      }
      const id = `att-dl-${(ATT.seq += 1)}`;
      ATT.rows.push({
        id, mode: "DAILY_LABOUR", attendanceDate, projectId,
        costCentreId, purposeId: (raw.purposeId as string) ?? null,
        employeeId: null, checkIn: null, checkOut: null, dayStatus: null, overtimeHours: null,
        partyId: null, headCount, labourCategory: (raw.labourCategory as string) ?? null,
        dailyRate,
        source: "MANUAL", isConfirmed: false, accrualEntryId: null,
        entryNo: null, accruedAmount: null, postedAt: null, postedBy: null,
        reversalEntryNo: null, reversalEntryId: null, version: 1,
      });
      ids.push(id);
    }
    return { status: 201, body: success({ ids }) };
  }

  // /attendance/daily-labour/:id[/(confirm|reverse)]
  const dlm = /^\/attendance\/daily-labour\/([^/]+)(?:\/(confirm|reverse))?$/.exec(pathname ?? "");
  if (dlm) {
    const id = dlm[1]!;
    const action = dlm[2];
    const row = ATT.rows.find((r) => r.id === id && r.mode === "DAILY_LABOUR");
    if (!row) return { status: 404, body: envelope("NOT_FOUND", "Attendance row not found.") };
    const b = body as Record<string, unknown>;

    if (req.method === "PATCH" && !action) {
      if (row.isConfirmed) {
        return { status: 409, body: envelope("ATTENDANCE_CONFIRMED_IMMUTABLE", "This row has been confirmed and can no longer be edited — use Reverse to correct it.") };
      }
      if (typeof b.version !== "number" || b.version !== row.version) {
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This row was just changed by someone else. Reload and try again.") };
      }
      if (b.headCount !== undefined) {
        const hc = Number(b.headCount);
        if (!Number.isFinite(hc) || hc < 1) {
          return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a head count of 1 or more.") };
        }
        row.headCount = hc;
      }
      if (b.dailyRate !== undefined) {
        if (Number(b.dailyRate) < 0) {
          return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a daily rate of ৳0 or more.") };
        }
        row.dailyRate = String(b.dailyRate);
      }
      if (b.labourCategory !== undefined) row.labourCategory = (b.labourCategory as string) ?? null;
      if (b.purposeId !== undefined) row.purposeId = (b.purposeId as string) ?? null;
      row.version += 1;
      return { status: 200, body: success(row) };
    }

    if (req.method === "POST" && action === "confirm") {
      if (row.isConfirmed) {
        return { status: 409, body: envelope("ALREADY_CONFIRMED", "This row has already been confirmed.") };
      }
      const purposeId = row.purposeId || (b.purposeId as string) || null;
      if (!purposeId) {
        return { status: 400, body: envelope("MISSING_REQUIRED_DIMENSION", "A purpose is required to post the accrual.") };
      }
      if (!row.costCentreId) {
        return { status: 400, body: envelope("MISSING_REQUIRED_DIMENSION", "A cost centre is required to post the accrual.") };
      }
      if (isPeriodClosed(row.attendanceDate)) {
        return { status: 409, body: envelope("PERIOD_CLOSED", "This accounting period is closed — posting isn't allowed.") };
      }
      const project = MOCK_PROJECTS.find((p) => p.id === row.projectId);
      if (project && project.status === "CLOSED") {
        return { status: 409, body: envelope("PROJECT_CLOSED", "This project is closed — posting isn't allowed.") };
      }
      row.purposeId = purposeId;
      const hc = row.headCount ?? 0;
      const rate = row.dailyRate ?? "0";
      const accrued = (Number(rate) * hc).toFixed(4);
      const seq = (ATT.dlaSeq += 1);
      row.entryNo = `SJ/2526/${String(seq).padStart(4, "0")}`;
      row.accrualEntryId = `je-dla-${seq}`;
      row.accruedAmount = accrued;
      row.isConfirmed = true;
      row.postedAt = new Date().toISOString();
      row.postedBy = user.id;
      row.version += 1;
      return {
        status: 200,
        body: success({
          attendanceId: row.id,
          accrualEntryId: row.accrualEntryId,
          entryNo: row.entryNo,
          accruedAmount: row.accruedAmount,
          isConfirmed: true,
          postedAt: row.postedAt,
          postedBy: row.postedBy,
          version: row.version,
        }),
      };
    }

    if (req.method === "POST" && action === "reverse") {
      if (!row.isConfirmed) {
        return { status: 409, body: envelope("NOT_CONFIRMED", "There's nothing to reverse — this row isn't confirmed.") };
      }
      if (row.reversalEntryNo) {
        return { status: 409, body: envelope("ALREADY_REVERSED", "This accrual has already been reversed.") };
      }
      const reason = String((b as { reason?: unknown }).reason ?? "").trim();
      if (!reason) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a reason for reversing this accrual.") };
      }
      if (isPeriodClosed(row.attendanceDate)) {
        return { status: 409, body: envelope("PERIOD_CLOSED", "This accounting period is closed — posting isn't allowed.") };
      }
      const seq = (ATT.dlaSeq += 1);
      row.reversalEntryNo = `SJ/2526/${String(seq).padStart(4, "0")}`;
      row.reversalEntryId = `je-dla-${seq}`;
      row.version += 1;
      return {
        status: 200,
        body: success({
          reversalEntryId: row.reversalEntryId,
          reversalEntryNo: row.reversalEntryNo,
          originalEntryId: row.accrualEntryId,
        }),
      };
    }
  }

  // ── HR Salary (fe-salary-sheet, FE-37) ──
  // Server-computed DRAFT sheets from the seeded HR.employees (ACTIVE only). Second
  // Generate for the same period returns 409 DUPLICATE_DRAFT_SHEET. PATCH lines/components
  // are DRAFT-only; Post allocates a gapless SAL/YYFY/#### number; Reverse produces a
  // linked reversal. Money is Decimal(18,4); dates YYYY-MM-DD. Same simulated
  // period-closed (≤ 2025-03-31) as attendance.
  interface MockSalaryLine {
    id: string;
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    designation: string | null;
    pfApplicable: boolean;
    projectId: string | null;
    costCentreId: string | null;
    purposeId: string | null;
    paidDays: string;
    grossAmount: string;
    allowances: string;
    tdsAmount: string;
    tdsRate: string | null;
    pfAmount: string;
    advanceRecovery: string;
    otherDeductions: string;
    netAmount: string;
    version: number;
  }
  interface MockSalarySheet {
    id: string;
    financialYearId: string;
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    status: "DRAFT" | "POSTED" | "REVERSED";
    salaryEntryId: string | null;
    entryNo: string | null;
    reversalEntryId: string | null;
    reversalEntryNo: string | null;
    totalGross: string;
    totalDeductions: string;
    totalNet: string;
    postedAt: string | null;
    postedBy: string | null;
    version: number;
    lines: MockSalaryLine[];
    projectId: string | null;
  }
  const gs = globalThis as unknown as { __ZE_MOCK_SAL__?: { sheets: MockSalarySheet[]; seq: number; noSeq: number } };
  function recomputeSheet(s: MockSalarySheet) {
    let g = 0;
    let d = 0;
    let n = 0;
    for (const l of s.lines) {
      const gross = Number(l.grossAmount);
      const allow = Number(l.allowances);
      const tds = Number(l.tdsAmount);
      const pf = Number(l.pfAmount);
      const adv = Number(l.advanceRecovery);
      const oth = Number(l.otherDeductions);
      const net = gross + allow - (tds + pf + adv + oth);
      l.netAmount = net.toFixed(4);
      g += gross + allow;
      d += tds + pf + adv + oth;
      n += net;
    }
    s.totalGross = g.toFixed(4);
    s.totalDeductions = d.toFixed(4);
    s.totalNet = n.toFixed(4);
  }
  if (!gs.__ZE_MOCK_SAL__) {
    // Seed one POSTED + one DRAFT + one REVERSED so the runs list is never empty in dev.
    const seededDraft: MockSalarySheet = {
      id: "sal-draft-1",
      financialYearId: "22222222-2222-2222-2222-222222222222",
      periodLabel: "2026-07",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      status: "DRAFT",
      salaryEntryId: null,
      entryNo: null,
      reversalEntryId: null,
      reversalEntryNo: null,
      totalGross: "0",
      totalDeductions: "0",
      totalNet: "0",
      postedAt: null,
      postedBy: null,
      version: 1,
      projectId: null,
      lines: [
        {
          id: "sl-draft-1", employeeId: "emp-1", employeeCode: "EMP-001", employeeName: "মোঃ রফিকুল ইসলাম",
          designation: "Site Accountant", pfApplicable: true, projectId: "proj-a", costCentreId: "cc-lab", purposeId: "pp-1",
          paidDays: "30.000", grossAmount: "45000.0000", allowances: "0", tdsAmount: "0", tdsRate: null,
          pfAmount: "2000.0000", advanceRecovery: "0", otherDeductions: "0", netAmount: "0", version: 1,
        },
        {
          id: "sl-draft-2", employeeId: "emp-2", employeeCode: "EMP-002", employeeName: "Farzana Akter",
          designation: "Site Engineer", pfApplicable: true, projectId: "proj-a", costCentreId: "cc-lab", purposeId: "pp-1",
          paidDays: "30.000", grossAmount: "60000.0000", allowances: "0", tdsAmount: "0", tdsRate: null,
          pfAmount: "3000.0000", advanceRecovery: "0", otherDeductions: "0", netAmount: "0", version: 1,
        },
      ],
    };
    recomputeSheet(seededDraft);
    const seededPosted: MockSalarySheet = {
      ...seededDraft,
      id: "sal-posted-1",
      periodLabel: "2026-06",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      status: "POSTED",
      salaryEntryId: "je-sal-1",
      entryNo: "SAL/2526/0001",
      postedAt: "2026-07-05T10:00:00Z",
      postedBy: user.id,
      version: 2,
      lines: seededDraft.lines.map((l) => ({ ...l, id: `sl-p-${l.employeeId}`, version: 1 })),
    };
    recomputeSheet(seededPosted);
    const seededReversed: MockSalarySheet = {
      ...seededPosted,
      id: "sal-rev-1",
      periodLabel: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      status: "REVERSED",
      salaryEntryId: "je-sal-0",
      entryNo: "SAL/2526/0002",
      reversalEntryId: "je-sal-r0",
      reversalEntryNo: "SAL/2526/0003",
      lines: seededDraft.lines.map((l) => ({ ...l, id: `sl-r-${l.employeeId}`, version: 1 })),
    };
    recomputeSheet(seededReversed);
    gs.__ZE_MOCK_SAL__ = { sheets: [seededDraft, seededPosted, seededReversed], seq: 100, noSeq: 3 };
  }
  const SAL = gs.__ZE_MOCK_SAL__;
  function projectionOfSheet(s: MockSalarySheet, includeLines: boolean) {
    const base = {
      id: s.id, financialYearId: s.financialYearId, periodLabel: s.periodLabel,
      periodStart: s.periodStart, periodEnd: s.periodEnd, status: s.status,
      salaryEntryId: s.salaryEntryId, entryNo: s.entryNo,
      reversalEntryId: s.reversalEntryId, reversalEntryNo: s.reversalEntryNo,
      totalGross: s.totalGross, totalDeductions: s.totalDeductions, totalNet: s.totalNet,
      postedAt: s.postedAt, postedBy: s.postedBy, version: s.version,
    };
    return includeLines ? { ...base, lines: s.lines } : base;
  }
  function isSalaryPeriodClosed(end: string): boolean {
    return end <= "2025-03-31";
  }

  // POST /salary/sheets/generate
  if (pathname === "/salary/sheets/generate" && req.method === "POST") {
    const b = body as { financialYearId?: string; periodLabel?: string; periodStart?: string; periodEnd?: string; projectId?: string | null };
    if (!b.financialYearId) return { status: 400, body: envelope("VALIDATION_ERROR", "Select a financial year.") };
    if (!b.periodLabel) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a period label.") };
    if (!b.periodStart || !b.periodEnd) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a period range.") };
    if (b.periodEnd < b.periodStart) return { status: 400, body: envelope("VALIDATION_ERROR", "Period end can't be before period start.") };
    const dup = SAL.sheets.find((s) => s.periodLabel === b.periodLabel && s.status === "DRAFT");
    if (dup) {
      return {
        status: 409,
        body: {
          error: {
            code: "DUPLICATE_DRAFT_SHEET",
            message: "A draft salary sheet already exists for this period. Edit it instead of generating a new one.",
            details: { existingId: dup.id },
          },
          meta: { requestId: `mock-${Date.now()}` },
        },
      };
    }
    // Build a DRAFT from ACTIVE employees (INACTIVE excluded — FR-HR-003).
    const employees = ((globalThis as unknown as { __ZE_MOCK_HR__?: { employees: MockEmployee[] } }).__ZE_MOCK_HR__?.employees ?? []).filter(
      (e) => e.status === "ACTIVE",
    );
    const activeEmps = b.projectId ? employees.filter((e) => e.defaultProjectId === b.projectId) : employees;
    const newSheet: MockSalarySheet = {
      id: `sal-new-${(SAL.seq += 1)}`,
      financialYearId: String(b.financialYearId),
      periodLabel: String(b.periodLabel),
      periodStart: String(b.periodStart),
      periodEnd: String(b.periodEnd),
      status: "DRAFT",
      salaryEntryId: null, entryNo: null, reversalEntryId: null, reversalEntryNo: null,
      totalGross: "0", totalDeductions: "0", totalNet: "0",
      postedAt: null, postedBy: null, version: 1,
      projectId: b.projectId ?? null,
      lines: activeEmps.map((e, i) => ({
        id: `sl-${SAL.seq}-${i}`,
        employeeId: e.id,
        employeeCode: e.employeeCode,
        employeeName: e.name,
        designation: e.designation,
        pfApplicable: e.pfApplicable,
        projectId: e.defaultProjectId,
        costCentreId: "cc-lab",
        purposeId: "pp-1",
        paidDays: "30.000",
        grossAmount: String(e.wageAmount),
        allowances: "0",
        tdsAmount: "0",
        tdsRate: null,
        pfAmount: e.pfApplicable ? (Number(e.wageAmount) * 0.05).toFixed(4) : "0",
        advanceRecovery: "0",
        otherDeductions: "0",
        netAmount: "0",
        version: 1,
      })),
    };
    recomputeSheet(newSheet);
    SAL.sheets.unshift(newSheet);
    return { status: 201, body: success({ id: newSheet.id, status: newSheet.status, periodLabel: newSheet.periodLabel }) };
  }

  // GET /salary/sheets — list
  if (pathname === "/salary/sheets" && req.method === "GET") {
    let rows = SAL.sheets.slice();
    const fy = params.get("financialYearId");
    const status = params.get("status");
    const period = params.get("periodLabel");
    if (fy) rows = rows.filter((r) => r.financialYearId === fy);
    if (status) rows = rows.filter((r) => r.status === status);
    if (period) rows = rows.filter((r) => r.periodLabel.includes(period));
    return { status: 200, body: pageEnvelope(rows.map((s) => projectionOfSheet(s, false))) };
  }

  // /salary/sheets/:id[/(lines/:lineId|components|post|reverse|payslips)]
  const smA = /^\/salary\/sheets\/([^/]+)$/.exec(pathname ?? "");
  const smL = /^\/salary\/sheets\/([^/]+)\/lines\/([^/]+)$/.exec(pathname ?? "");
  const smC = /^\/salary\/sheets\/([^/]+)\/components$/.exec(pathname ?? "");
  const smP = /^\/salary\/sheets\/([^/]+)\/post$/.exec(pathname ?? "");
  const smR = /^\/salary\/sheets\/([^/]+)\/reverse$/.exec(pathname ?? "");
  const smPS = /^\/salary\/sheets\/([^/]+)\/payslips$/.exec(pathname ?? "");
  const sheetId = smA?.[1] ?? smL?.[1] ?? smC?.[1] ?? smP?.[1] ?? smR?.[1] ?? smPS?.[1];
  if (sheetId) {
    const sheet = SAL.sheets.find((s) => s.id === sheetId);
    if (!sheet) return { status: 404, body: envelope("NOT_FOUND", "Salary sheet not found.") };

    if (smA && req.method === "GET") {
      const includeLines = params.get("includeLines") === "true";
      return { status: 200, body: success(projectionOfSheet(sheet, includeLines)) };
    }

    if (smL && req.method === "PATCH") {
      if (sheet.status !== "DRAFT") {
        return { status: 409, body: envelope("SALARY_NOT_DRAFT", "This salary sheet is already posted and can't be edited or posted again.") };
      }
      const lineId = smL[2]!;
      const line = sheet.lines.find((l) => l.id === lineId);
      if (!line) return { status: 404, body: envelope("NOT_FOUND", "Line not found.") };
      const b = body as { version?: number; allowances?: string; tdsAmount?: string; tdsRate?: string; pfAmount?: string; advanceRecovery?: string; otherDeductions?: string };
      if (typeof b.version !== "number" || b.version !== line.version) {
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This salary sheet was just changed by someone else. Reload and try again.") };
      }
      const nonNeg = (v: string | undefined, name: string): string | null => {
        if (v === undefined) return null;
        if (!/^\d*\.?\d*$/.test(v) || v === "" || Number(v) < 0) return `${name} can't be negative.`;
        return null;
      };
      for (const [name, v] of [["Allowances", b.allowances], ["TDS", b.tdsAmount], ["PF", b.pfAmount], ["Advance recovery", b.advanceRecovery], ["Other deductions", b.otherDeductions]] as const) {
        const err = nonNeg(v, name);
        if (err) return { status: 400, body: envelope("VALIDATION_ERROR", err) };
      }
      if (b.allowances !== undefined) line.allowances = b.allowances;
      if (b.tdsAmount !== undefined) line.tdsAmount = b.tdsAmount;
      if (b.tdsRate !== undefined) line.tdsRate = b.tdsRate;
      if (b.pfAmount !== undefined) line.pfAmount = b.pfAmount;
      if (b.advanceRecovery !== undefined) line.advanceRecovery = b.advanceRecovery;
      if (b.otherDeductions !== undefined) line.otherDeductions = b.otherDeductions;
      line.version += 1;
      recomputeSheet(sheet);
      sheet.version += 1;
      return {
        status: 200,
        body: success({
          line,
          totals: { totalGross: sheet.totalGross, totalDeductions: sheet.totalDeductions, totalNet: sheet.totalNet },
          version: sheet.version,
        }),
      };
    }

    if (smC && req.method === "PATCH") {
      if (sheet.status !== "DRAFT") {
        return { status: 409, body: envelope("SALARY_NOT_DRAFT", "This salary sheet is already posted and can't be edited or posted again.") };
      }
      const b = body as { apply?: { allowances?: string; tdsRate?: string; pfAmount?: string; advanceRecovery?: string }; employeeIds?: string[] | null; version?: number };
      if (typeof b.version !== "number" || b.version !== sheet.version) {
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This salary sheet was just changed by someone else. Reload and try again.") };
      }
      const apply = b.apply ?? {};
      const targetLines = b.employeeIds && b.employeeIds.length > 0 ? sheet.lines.filter((l) => b.employeeIds!.includes(l.employeeId)) : sheet.lines;
      let changed = 0;
      for (const l of targetLines) {
        if (apply.allowances !== undefined) l.allowances = apply.allowances;
        if (apply.pfAmount !== undefined) l.pfAmount = apply.pfAmount;
        if (apply.advanceRecovery !== undefined) l.advanceRecovery = apply.advanceRecovery;
        if (apply.tdsRate !== undefined) {
          const rate = Number(apply.tdsRate);
          if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
            return { status: 400, body: envelope("VALIDATION_ERROR", "TDS rate must be between 0 and 100.") };
          }
          l.tdsAmount = ((Number(l.grossAmount) * rate) / 100).toFixed(4);
          l.tdsRate = String(apply.tdsRate);
        }
        changed += 1;
        l.version += 1;
      }
      recomputeSheet(sheet);
      sheet.version += 1;
      return {
        status: 200,
        body: success({
          totals: { totalGross: sheet.totalGross, totalDeductions: sheet.totalDeductions, totalNet: sheet.totalNet },
          changedLineCount: changed,
          version: sheet.version,
        }),
      };
    }

    if (smP && req.method === "POST") {
      if (sheet.status !== "DRAFT") {
        return { status: 409, body: envelope("SALARY_NOT_DRAFT", "This salary sheet is already posted and can't be edited or posted again.") };
      }
      const b = body as { version?: number };
      if (typeof b.version !== "number" || b.version !== sheet.version) {
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This salary sheet was just changed by someone else. Reload and try again.") };
      }
      if (isSalaryPeriodClosed(sheet.periodEnd)) {
        return { status: 409, body: envelope("PERIOD_CLOSED", "This period is closed — the salary run can't be posted.") };
      }
      for (const l of sheet.lines) {
        if (!l.projectId || !l.costCentreId || !l.purposeId) {
          return { status: 400, body: envelope("MISSING_REQUIRED_DIMENSION", "One or more lines is missing a project, cost centre, or purpose — fix the line before posting.") };
        }
        const project = MOCK_PROJECTS.find((p) => p.id === l.projectId);
        if (project && project.status === "CLOSED") {
          return { status: 409, body: envelope("PROJECT_CLOSED", "This project is closed — the salary run can't be posted.") };
        }
      }
      const seq = (SAL.noSeq += 1);
      sheet.status = "POSTED";
      sheet.entryNo = `SAL/2526/${String(seq).padStart(4, "0")}`;
      sheet.salaryEntryId = `je-sal-${seq}`;
      sheet.postedAt = new Date().toISOString();
      sheet.postedBy = user.id;
      sheet.version += 1;
      return {
        status: 200,
        body: success({
          salarySheetId: sheet.id,
          salaryEntryId: sheet.salaryEntryId,
          entryNo: sheet.entryNo,
          status: sheet.status,
          postedAt: sheet.postedAt,
          postedBy: sheet.postedBy,
          version: sheet.version,
        }),
      };
    }

    if (smR && req.method === "POST") {
      if (sheet.status === "REVERSED" || sheet.reversalEntryNo) {
        return { status: 409, body: envelope("ALREADY_REVERSED", "This salary run has already been reversed.") };
      }
      if (sheet.status !== "POSTED") {
        return { status: 409, body: envelope("SALARY_NOT_POSTED", "This salary sheet isn't posted, so it can't be reversed.") };
      }
      const b = body as { reason?: string; version?: number };
      const reason = String(b.reason ?? "").trim();
      if (!reason) return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a reason for reversing this salary run.") };
      const seq = (SAL.noSeq += 1);
      sheet.status = "REVERSED";
      sheet.reversalEntryNo = `SAL/2526/${String(seq).padStart(4, "0")}`;
      sheet.reversalEntryId = `je-sal-r${seq}`;
      sheet.version += 1;
      return {
        status: 200,
        body: success({
          reversalEntryId: sheet.reversalEntryId,
          reversalEntryNo: sheet.reversalEntryNo,
          originalEntryId: sheet.salaryEntryId,
          status: sheet.status,
          version: sheet.version,
        }),
      };
    }

    if (smPS && req.method === "GET") {
      if (sheet.status !== "POSTED" && sheet.status !== "REVERSED") {
        return { status: 409, body: envelope("SALARY_NOT_POSTED", "This salary sheet isn't posted, so it can't be reversed.") };
      }
      const employeeIdFilter = params.get("employeeId");
      const list = sheet.lines
        .filter((l) => !employeeIdFilter || l.employeeId === employeeIdFilter)
        .map((l) => ({
          employeeId: l.employeeId,
          employeeCode: l.employeeCode,
          name: l.employeeName,
          designation: l.designation,
          periodLabel: sheet.periodLabel,
          paidDays: l.paidDays,
          grossAmount: l.grossAmount,
          allowances: l.allowances,
          deductions: { tds: l.tdsAmount, pf: l.pfAmount, advanceRecovery: l.advanceRecovery, other: l.otherDeductions },
          netAmount: l.netAmount,
        }));
      return { status: 200, body: success(list) };
    }
  }

  return { status: 200, body: success({ ok: true, path: req.path }) };
}
