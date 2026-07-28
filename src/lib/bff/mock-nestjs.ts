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
  // Master-data list/detail contract (see `Project` in master-data/types.ts). The
  // dated fields are `YYYY-MM-DD` date-only strings the UI renders as `DD/MM/YYYY`.
  location: string | null;
  projectManagerId: string | null;
  startDate: string;
  expectedEndDate: string;
  actualEndDate: string | null;
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
  {
    id: "proj-a",
    projectCode: "BR-04",
    name: "Bridge-04 — Buriganga",
    status: "ACTIVE",
    isActive: true,
    version: 1,
    location: "Buriganga, Dhaka",
    projectManagerId: "pa-pm-1",
    startDate: "2025-08-01",
    expectedEndDate: "2027-01-31",
    actualEndDate: null,
    customerId: "pa-8",
    customerName: "National Housing Authority",
    remainingAdvance: "800000.0000",
    hasMobilizationAdvance: true,
  },
  {
    id: "proj-b",
    projectCode: "TW-A",
    name: "Tower-A — Gulshan",
    status: "ACTIVE",
    isActive: true,
    version: 1,
    location: "Gulshan, Dhaka",
    projectManagerId: "pa-pm-2",
    startDate: "2025-04-15",
    expectedEndDate: "2026-12-31",
    actualEndDate: null,
    customerId: "pa-4",
    customerName: "Tower-A Developments Ltd.",
    remainingAdvance: "5000000.0000",
    hasMobilizationAdvance: true,
  },
  {
    id: "proj-c",
    projectCode: "RD-12",
    name: "Road-12 — Savar",
    status: "ACTIVE",
    isActive: true,
    version: 1,
    location: "Savar, Dhaka",
    projectManagerId: "pa-pm-1",
    startDate: "2024-11-10",
    expectedEndDate: "2026-05-31",
    actualEndDate: null,
    customerId: "pa-7",
    customerName: "করিম এন্টারপ্রাইজ",
    remainingAdvance: "0.0000",
    hasMobilizationAdvance: false,
  },
];
// Sequence for ids of projects created through the mock's POST handler.
let mockProjectSeq = 900;

// Per-cost-centre project budgets (FR-MAS-007/008). Mutated in place by the
// budgets PUT/DELETE handlers so the Budgets tab behaves like the real backend
// under USE_MOCK_NESTJS. `budgetedAmount` is a Decimal(18,4) string.
interface MockProjectBudget {
  id: string;
  projectId: string;
  costCentreId: string;
  budgetedAmount: string;
  version: number;
}
const MOCK_PROJECT_BUDGETS: MockProjectBudget[] = [
  { id: "bud-a-mat", projectId: "proj-a", costCentreId: "cc-mat", budgetedAmount: "1200000000.0000", version: 1 },
  { id: "bud-a-lab", projectId: "proj-a", costCentreId: "cc-lab", budgetedAmount: "450000000.0000", version: 1 },
  { id: "bud-a-fuel", projectId: "proj-a", costCentreId: "cc-fuel", budgetedAmount: "120000000.0000", version: 1 },
];
let mockBudgetSeq = 500;

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

// Bangladesh financial year runs July → June. Rows carry startDate/endDate/version
// so the FY master screen (FinancialYearsTable) can render the period and edit with
// optimistic concurrency — omitting them made formatDate() throw on undefined.
const MOCK_FINANCIAL_YEARS = [
  { id: "fy-2025-26", label: "FY 2025–26", startDate: "2025-07-01", endDate: "2026-06-30", isActive: true, version: 1 },
  { id: "fy-2024-25", label: "FY 2024–25", startDate: "2024-07-01", endDate: "2025-06-30", isActive: false, version: 1 },
  // FE-52 — the auth-mock USER carries this UUID as its default FY; include it
  // so the profile screen resolves `financialYearId` → label (rather than
  // falling back to the raw UUID). Not shown in the FY switcher (`isActive`
  // + FY switch list still keys off the two shorter ids above).
  {
    id: "22222222-2222-2222-2222-222222222222",
    label: "FY 2025–26 · Zakir Enterprise",
    startDate: "2025-07-01",
    endDate: "2026-06-30",
    isActive: false,
    version: 1,
  },
];
// Sequence for mock-created FY ids (create/edit/set-active mutate MOCK_FINANCIAL_YEARS
// in place so the FY master screen behaves like the real backend under USE_MOCK_NESTJS).
let mockFinancialYearSeq = 100;

/** Budget-vs-actual rows for Bridge-04 (proj-a) — mirrors the design sample. */
const MOCK_BVA_ROWS = [
  {
    costCentreId: "cc-mat",
    budgetedAmount: "1200000000.0000",
    actualCost: "1296000000.0000",
    variance: "-96000000.0000",
    utilisationPct: "108.0000",
    status: "OVER",
  },
  {
    costCentreId: "cc-lab",
    budgetedAmount: "450000000.0000",
    actualCost: "418500000.0000",
    variance: "31500000.0000",
    utilisationPct: "93.0000",
    status: "APPROACHING",
  },
  {
    costCentreId: "cc-fuel",
    budgetedAmount: "120000000.0000",
    actualCost: "111000000.0000",
    variance: "9000000.0000",
    utilisationPct: "92.5000",
    status: "APPROACHING",
  },
  {
    costCentreId: "cc-sub",
    budgetedAmount: "900000000.0000",
    actualCost: "612000000.0000",
    variance: "288000000.0000",
    utilisationPct: "68.0000",
    status: "OK",
  },
  {
    costCentreId: "cc-tmp",
    budgetedAmount: "80000000.0000",
    actualCost: "54400000.0000",
    variance: "25600000.0000",
    utilisationPct: "68.0000",
    status: "OK",
  },
  {
    costCentreId: "cc-equip",
    budgetedAmount: "300000000.0000",
    actualCost: "195000000.0000",
    variance: "105000000.0000",
    utilisationPct: "65.0000",
    status: "OK",
  },
  {
    costCentreId: "cc-survey",
    budgetedAmount: "50000000.0000",
    actualCost: "31000000.0000",
    variance: "19000000.0000",
    utilisationPct: "62.0000",
    status: "OK",
  },
  {
    costCentreId: "cc-transport",
    budgetedAmount: "150000000.0000",
    actualCost: "88500000.0000",
    variance: "61500000.0000",
    utilisationPct: "59.0000",
    status: "OK",
  },
  {
    costCentreId: "cc-overhead",
    budgetedAmount: "180000000.0000",
    actualCost: "97200000.0000",
    variance: "82800000.0000",
    utilisationPct: "54.0000",
    status: "OK",
  },
  {
    costCentreId: "cc-safety",
    budgetedAmount: "60000000.0000",
    actualCost: "25800000.0000",
    variance: "34200000.0000",
    utilisationPct: "43.0000",
    status: "OK",
  },
  {
    costCentreId: "cc-power",
    budgetedAmount: null,
    actualCost: "12000000.0000",
    variance: null,
    utilisationPct: null,
    status: "UNBUDGETED",
  },
];
/** Profitability rows by cost centre (dev/preview) — one loss row (cc-mat) + an inactive CC. */
const MOCK_PROFITABILITY = [
  {
    costCentreId: "cc-mat",
    revenue: "480000000.0000",
    cost: "618000000.0000",
    profit: "-138000000.0000",
  },
  {
    costCentreId: "cc-lab",
    revenue: "320000000.0000",
    cost: "176000000.0000",
    profit: "144000000.0000",
  },
  {
    costCentreId: "cc-tmp",
    revenue: "82000000.0000",
    cost: "67600000.0000",
    profit: "14400000.0000",
  },
  {
    costCentreId: "cc-sub",
    revenue: "960000000.0000",
    cost: "772000000.0000",
    profit: "188000000.0000",
  },
  {
    costCentreId: "cc-equip",
    revenue: "220000000.0000",
    cost: "195000000.0000",
    profit: "25000000.0000",
  },
  {
    costCentreId: "cc-transport",
    revenue: "150000000.0000",
    cost: "88500000.0000",
    profit: "61500000.0000",
  },
];
/** Profitability rows by project (dev/preview) — proj-b runs at a loss. */
const MOCK_PROFITABILITY_BY_PROJECT = [
  {
    projectId: "proj-a",
    revenue: "1400000000.0000",
    cost: "1230000000.0000",
    profit: "170000000.0000",
  },
  {
    projectId: "proj-b",
    revenue: "620000000.0000",
    cost: "705000000.0000",
    profit: "-85000000.0000",
  },
  {
    projectId: "proj-c",
    revenue: "310000000.0000",
    cost: "240000000.0000",
    profit: "70000000.0000",
  },
];

// ── Inventory sample (dev/preview only) ──
// `location` + `version` mirror the frontend `Godown` type so the project Godowns
// tab renders the address column and can deactivate/reactivate (which round-trips
// `version` for optimistic concurrency). Mutated in place by the write handlers.
interface MockGodown {
  id: string;
  code: string;
  name: string;
  projectId: string;
  location: string | null;
  isActive: boolean;
  version: number;
}
const MOCK_GODOWNS: MockGodown[] = [
  { id: "gd-a", code: "G-Site-A", name: "Site A store", projectId: "proj-a", location: "Buriganga site, Dhaka", isActive: true, version: 1 },
  { id: "gd-b", code: "G-Site-B", name: "Site B store", projectId: "proj-a", location: "Buriganga site (east), Dhaka", isActive: true, version: 1 },
  { id: "gd-c", code: "G-Central", name: "Central warehouse", projectId: "proj-b", location: "Gulshan, Dhaka", isActive: true, version: 1 },
  { id: "gd-d", code: "G-Yard", name: "Yard — Savar", projectId: "proj-c", location: "Savar, Dhaka", isActive: true, version: 1 },
];
// Sequence for ids/codes of godowns created through the mock's POST handler.
let mockGodownSeq = 700;
interface MockItem {
  id: string;
  code: string;
  name: string;
  uom: string;
  isActive: boolean;
}
const MOCK_ITEMS: MockItem[] = [
  {
    id: "it-cement",
    code: "IT-01",
    name: "Cement — 50kg bag (Shah Cement)",
    uom: "bag",
    isActive: true,
  },
  { id: "it-rebar", code: "IT-02", name: "Rebar 12mm", uom: "ton", isActive: true },
  { id: "it-sand", code: "IT-03", name: "বালু — Sand", uom: "cft", isActive: true },
  { id: "it-brick", code: "IT-04", name: "ইট — Brick", uom: "pcs", isActive: true },
  { id: "it-fuel", code: "IT-05", name: "Fuel — Diesel", uom: "ltr", isActive: false },
];
const MOCK_USER_LIST = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Admin User", role: "ADMIN" },
  { id: "u-rafiq", name: "Rafiqul Islam", role: "PROJECT_MANAGER" },
  { id: "u-farzana", name: "ফারজানা আক্তার", role: "PROJECT_MANAGER" },
  { id: "u-ashraf", name: "Ashraful Alam", role: "SITE_ENGINEER" },
];
const MOCK_STOCK_LEDGER: Array<{
  godownId: string;
  itemId: string;
  quantityOnHand: string;
  totalValue: string;
  weightedAverageRate: string | null;
}> = [
  {
    godownId: "gd-a",
    itemId: "it-cement",
    quantityOnHand: "1240.0000",
    totalValue: "672080.0000",
    weightedAverageRate: "542.0000",
  },
  {
    godownId: "gd-b",
    itemId: "it-cement",
    quantityOnHand: "300.0000",
    totalValue: "162600.0000",
    weightedAverageRate: "542.0000",
  },
  {
    godownId: "gd-a",
    itemId: "it-rebar",
    quantityOnHand: "18.0000",
    totalValue: "1764000.0000",
    weightedAverageRate: "98000.0000",
  },
  {
    godownId: "gd-a",
    itemId: "it-sand",
    quantityOnHand: "90.0000",
    totalValue: "3780.0000",
    weightedAverageRate: "42.0000",
  },
  {
    godownId: "gd-a",
    itemId: "it-brick",
    quantityOnHand: "5000.0000",
    totalValue: "62500.0000",
    weightedAverageRate: "12.5000",
  },
  // Zero on hand → weightedAverageRate null (renders "—", never ৳0.0000) — spec §5/§13-10.
  {
    godownId: "gd-b",
    itemId: "it-rebar",
    quantityOnHand: "0.0000",
    totalValue: "0.0000",
    weightedAverageRate: null,
  },
];

// Append-only movement history behind a balance (keyed `godownId:itemId`). Exercises every
// source type + a reversal (additive mirror row, original untouched — FR-INV-020).
interface MockMovement {
  id: string;
  godownId: string;
  itemId: string;
  sourceType: "STOCK_JOURNAL" | "GRN" | "REQ_ISSUE";
  sourceId: string | null;
  direction: "IN" | "OUT";
  quantity: string;
  rate: string;
  value: string;
  balanceQtyAfter: string;
  balanceValueAfter: string;
  avgRateAfter: string;
  isReversal: boolean;
  reversalOf: string | null;
  voucherDate: string;
  postedAt: string;
}
const MOCK_STOCK_MOVEMENTS: Record<string, MockMovement[]> = {
  "gd-a:it-cement": [
    {
      id: "mv-1",
      godownId: "gd-a",
      itemId: "it-cement",
      sourceType: "GRN",
      sourceId: "grn-201",
      direction: "IN",
      quantity: "1000.0000",
      rate: "540.0000",
      value: "540000.0000",
      balanceQtyAfter: "1000.0000",
      balanceValueAfter: "540000.0000",
      avgRateAfter: "540.0000",
      isReversal: false,
      reversalOf: null,
      voucherDate: "2026-06-01",
      postedAt: "2026-06-01T05:00:00Z",
    },
    {
      id: "mv-2",
      godownId: "gd-a",
      itemId: "it-cement",
      sourceType: "STOCK_JOURNAL",
      sourceId: "sj-4",
      direction: "OUT",
      quantity: "200.0000",
      rate: "540.0000",
      value: "108000.0000",
      balanceQtyAfter: "800.0000",
      balanceValueAfter: "432000.0000",
      avgRateAfter: "540.0000",
      isReversal: false,
      reversalOf: null,
      voucherDate: "2026-06-10",
      postedAt: "2026-06-10T06:30:00Z",
    },
    {
      id: "mv-3",
      godownId: "gd-a",
      itemId: "it-cement",
      sourceType: "GRN",
      sourceId: "grn-214",
      direction: "IN",
      quantity: "640.0000",
      rate: "545.0000",
      value: "348800.0000",
      balanceQtyAfter: "1440.0000",
      balanceValueAfter: "780800.0000",
      avgRateAfter: "542.2222",
      isReversal: false,
      reversalOf: null,
      voucherDate: "2026-06-18",
      postedAt: "2026-06-18T04:15:00Z",
    },
    {
      id: "mv-4",
      godownId: "gd-a",
      itemId: "it-cement",
      sourceType: "REQ_ISSUE",
      sourceId: "req-330",
      direction: "OUT",
      quantity: "200.0000",
      rate: "542.2222",
      value: "108444.4400",
      balanceQtyAfter: "1240.0000",
      balanceValueAfter: "672355.5600",
      avgRateAfter: "542.2222",
      isReversal: false,
      reversalOf: null,
      voucherDate: "2026-06-28",
      postedAt: "2026-06-28T09:15:00Z",
    },
    {
      id: "mv-5",
      godownId: "gd-a",
      itemId: "it-cement",
      sourceType: "STOCK_JOURNAL",
      sourceId: "sj-4",
      direction: "IN",
      quantity: "200.0000",
      rate: "542.2222",
      value: "108444.4400",
      balanceQtyAfter: "1440.0000",
      balanceValueAfter: "780800.0000",
      avgRateAfter: "542.2222",
      isReversal: true,
      reversalOf: "mv-4",
      voucherDate: "2026-06-29",
      postedAt: "2026-06-29T03:00:00Z",
    },
  ],
  "gd-a:it-rebar": [
    {
      id: "mv-10",
      godownId: "gd-a",
      itemId: "it-rebar",
      sourceType: "GRN",
      sourceId: "grn-190",
      direction: "IN",
      quantity: "18.0000",
      rate: "98000.0000",
      value: "1764000.0000",
      balanceQtyAfter: "18.0000",
      balanceValueAfter: "1764000.0000",
      avgRateAfter: "98000.0000",
      isReversal: false,
      reversalOf: null,
      voucherDate: "2026-05-20",
      postedAt: "2026-05-20T05:00:00Z",
    },
  ],
};

interface MockSjLine {
  lineNo: number;
  side: "OUT" | "IN";
  godownId: string;
  itemId: string;
  quantity: string;
  rate: string | null;
  value: string | null;
  projectId: string;
  costCentreId: string;
  purposeId: string;
}
interface MockSJ {
  id: string;
  entryNo: string | null;
  voucherDate: string;
  mode: "TRANSFER" | "ISSUE" | "ADJUSTMENT";
  status: "DRAFT" | "APPROVED" | "POSTED" | "CANCELLED";
  fromGodownId: string | null;
  toGodownId: string | null;
  itemId: string;
  quantity: string;
  rate: string | null;
  value: string | null;
  projectId: string | null;
  costCentreId: string | null;
  purposeId: string | null;
  issuedById: string | null;
  receivedById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  negativeStockAuthorisedById: string | null;
  negativeStockReason: string | null;
  journalEntryId: string | null;
  narration: string | null;
  postedAt: string | null;
  postedById: string | null;
  version: number;
  lines: MockSjLine[];
}
let sjSeq = 100;
let sjNumberSeq = 12;
function seedSj(
  p: Partial<MockSJ> &
    Pick<MockSJ, "id" | "mode" | "status" | "itemId" | "quantity" | "fromGodownId">,
): MockSJ {
  const posted = p.status === "POSTED" || p.status === "CANCELLED";
  return {
    entryNo: null,
    voucherDate: "2026-06-20",
    toGodownId: null,
    rate: null,
    value: null,
    projectId: "proj-a",
    costCentreId: "cc-mat",
    purposeId: "pp-1",
    issuedById: "u-rafiq",
    receivedById: "u-farzana",
    approvedById: posted || p.status === "APPROVED" ? "u-ashraf" : null,
    approvedAt: posted || p.status === "APPROVED" ? "2026-06-20T09:12:00Z" : null,
    negativeStockAuthorisedById: null,
    negativeStockReason: null,
    journalEntryId: null,
    narration: "Day 20 slab pour",
    postedAt: posted ? "2026-06-20T09:15:00Z" : null,
    postedById: posted ? "u-rafiq" : null,
    version: 1,
    lines: [
      {
        lineNo: 1,
        side: "OUT",
        godownId: p.fromGodownId ?? "gd-a",
        itemId: p.itemId,
        quantity: p.quantity,
        rate: p.rate ?? null,
        value: p.value ?? null,
        projectId: "proj-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
      },
    ],
    ...p,
  } as MockSJ;
}
const MOCK_STOCK_JOURNALS: MockSJ[] = [
  seedSj({
    id: "sj-1",
    entryNo: "SJ/2526/0012",
    voucherDate: "2026-07-06",
    mode: "TRANSFER",
    status: "POSTED",
    fromGodownId: "gd-a",
    toGodownId: "gd-b",
    itemId: "it-rebar",
    quantity: "8.5000",
    rate: "98500.0000",
    value: "837250.0000",
    journalEntryId: null,
  }),
  seedSj({
    id: "sj-2",
    voucherDate: "2026-07-07",
    mode: "ISSUE",
    status: "DRAFT",
    fromGodownId: "gd-a",
    itemId: "it-cement",
    quantity: "50.0000",
  }),
  seedSj({
    id: "sj-3",
    entryNo: "SJ/2526/0011",
    voucherDate: "2026-07-05",
    mode: "ADJUSTMENT",
    status: "POSTED",
    fromGodownId: "gd-a",
    itemId: "it-sand",
    quantity: "120.0000",
    rate: "42.0000",
    value: "5040.0000",
    journalEntryId: "je-11",
  }),
  seedSj({
    id: "sj-4",
    entryNo: "SJ/2526/0010",
    voucherDate: "2026-06-28",
    mode: "ISSUE",
    status: "POSTED",
    fromGodownId: "gd-a",
    itemId: "it-cement",
    quantity: "200.0000",
    rate: "542.0000",
    value: "108400.0000",
    journalEntryId: "je-10",
  }),
  seedSj({
    id: "sj-5",
    voucherDate: "2026-07-05",
    mode: "ISSUE",
    status: "APPROVED",
    fromGodownId: "gd-a",
    itemId: "it-cement",
    quantity: "180.0000",
  }),
  seedSj({
    id: "sj-6",
    entryNo: "SJ/2526/0008",
    voucherDate: "2026-06-25",
    mode: "ISSUE",
    status: "CANCELLED",
    fromGodownId: "gd-a",
    itemId: "it-sand",
    quantity: "300.0000",
    rate: "42.0000",
    value: "12600.0000",
  }),
];

// ── Requisition sample (dev/preview only) ──
interface MockReqLine {
  id: string;
  lineNo: number;
  itemId: string;
  requestedQuantity: string;
  issuedQuantity: string;
  balanceQuantity: string;
  indicativeRate: string | null;
  uom: string;
}
interface MockRequisition {
  id: string;
  requisitionNo: string | null;
  projectId: string;
  costCentreId: string;
  purposeId: string;
  fromGodownId: string | null;
  requiredDate: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status:
    "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PARTIALLY_ISSUED" | "ISSUED" | "CLOSED";
  estimatedValue: string | null;
  approvalTier: "PM" | "ACCOUNTS" | null;
  submittedAt: string | null;
  submittedById: string | null;
  closedAt: string | null;
  closedReason: string | null;
  narration: string | null;
  lines: MockReqLine[];
  version: number;
}
/** Indicative rate for an item at a godown (falls back to any-godown last-known). */
function reqIndicativeRate(itemId: string, godownId: string | null): string | null {
  const at = godownId
    ? MOCK_STOCK_LEDGER.find((r) => r.itemId === itemId && r.godownId === godownId)
    : undefined;
  const any = at ?? MOCK_STOCK_LEDGER.find((r) => r.itemId === itemId);
  return any?.weightedAverageRate ?? null;
}
function reqUom(itemId: string): string {
  return MOCK_ITEMS.find((i) => i.id === itemId)?.uom ?? "";
}
function mkLine(
  id: string,
  lineNo: number,
  itemId: string,
  requested: string,
  issued: string,
  godownId: string | null,
): MockReqLine {
  const rate = reqIndicativeRate(itemId, godownId);
  const bal = (Number(requested) - Number(issued)).toFixed(4);
  return {
    id,
    lineNo,
    itemId,
    requestedQuantity: `${Number(requested).toFixed(4)}`,
    issuedQuantity: `${Number(issued).toFixed(4)}`,
    balanceQuantity: bal,
    indicativeRate: rate,
    uom: reqUom(itemId),
  };
}
function reqEstimate(lines: MockReqLine[]): string {
  let sum = 0;
  for (const l of lines)
    if (l.indicativeRate) sum += Number(l.requestedQuantity) * Number(l.indicativeRate);
  return sum.toFixed(4);
}
let reqSeq = 200;
let reqNoSeq = 42;
const MOCK_REQUISITIONS: MockRequisition[] = [
  {
    id: "req-1",
    requisitionNo: null,
    projectId: "proj-a",
    costCentreId: "cc-mat",
    purposeId: "pp-1",
    fromGodownId: "gd-a",
    requiredDate: "2026-07-20",
    priority: "NORMAL",
    status: "DRAFT",
    estimatedValue: null,
    approvalTier: null,
    submittedAt: null,
    submittedById: null,
    closedAt: null,
    closedReason: null,
    narration: "Slab pour materials",
    version: 1,
    lines: [
      mkLine("rl-1", 1, "it-cement", "100", "0", "gd-a"),
      mkLine("rl-2", 2, "it-rebar", "2", "0", "gd-a"),
    ],
  },
  {
    id: "req-2",
    requisitionNo: "REQ/2526/0042",
    projectId: "proj-a",
    costCentreId: "cc-mat",
    purposeId: "pp-1",
    fromGodownId: "gd-a",
    requiredDate: "2026-07-18",
    priority: "HIGH",
    status: "SUBMITTED",
    estimatedValue: null,
    approvalTier: "PM",
    submittedAt: "2026-07-10T08:00:00Z",
    submittedById: "u-rafiq",
    closedAt: null,
    closedReason: null,
    narration: "Column casting — block C",
    version: 2,
    lines: [
      mkLine("rl-3", 1, "it-cement", "80", "0", "gd-a"),
      mkLine("rl-4", 2, "it-sand", "300", "0", "gd-a"),
    ],
  },
  {
    id: "req-3",
    requisitionNo: "REQ/2526/0041",
    projectId: "proj-a",
    costCentreId: "cc-fuel",
    purposeId: "pp-1",
    fromGodownId: "gd-a",
    requiredDate: "2026-07-15",
    priority: "URGENT",
    status: "APPROVED",
    estimatedValue: null,
    approvalTier: "PM",
    submittedAt: "2026-07-08T08:00:00Z",
    submittedById: "u-farzana",
    closedAt: null,
    closedReason: null,
    narration: null,
    version: 3,
    lines: [mkLine("rl-5", 1, "it-brick", "5000", "0", "gd-a")],
  },
  {
    id: "req-4",
    requisitionNo: "REQ/2526/0040",
    projectId: "proj-a",
    costCentreId: "cc-mat",
    purposeId: "pp-1",
    fromGodownId: "gd-a",
    requiredDate: "2026-07-12",
    priority: "NORMAL",
    status: "PARTIALLY_ISSUED",
    estimatedValue: null,
    approvalTier: "PM",
    submittedAt: "2026-07-05T08:00:00Z",
    submittedById: "u-rafiq",
    closedAt: null,
    closedReason: null,
    narration: "Ongoing pour",
    version: 5,
    lines: [mkLine("rl-6", 1, "it-cement", "200", "120", "gd-a")],
  },
  {
    id: "req-5",
    requisitionNo: "REQ/2526/0039",
    projectId: "proj-a",
    costCentreId: "cc-sub",
    purposeId: "pp-1",
    fromGodownId: null,
    requiredDate: "2026-07-09",
    priority: "LOW",
    status: "REJECTED",
    estimatedValue: null,
    approvalTier: "ACCOUNTS",
    submittedAt: "2026-07-02T08:00:00Z",
    submittedById: "u-farzana",
    closedAt: null,
    closedReason: null,
    narration: "Over threshold — rejected",
    version: 3,
    lines: [mkLine("rl-7", 1, "it-rebar", "40", "0", null)],
  },
  {
    id: "req-6",
    requisitionNo: "REQ/2526/0038",
    projectId: "proj-a",
    costCentreId: "cc-mat",
    purposeId: "pp-1",
    fromGodownId: "gd-a",
    requiredDate: "2026-07-06",
    priority: "NORMAL",
    status: "ISSUED",
    estimatedValue: null,
    approvalTier: "PM",
    submittedAt: "2026-06-30T08:00:00Z",
    submittedById: "u-rafiq",
    closedAt: null,
    closedReason: null,
    narration: null,
    version: 6,
    lines: [mkLine("rl-8", 1, "it-sand", "300", "300", "gd-a")],
  },
  {
    // APPROVED with a rebar line whose balance (20) exceeds gd-a on-hand (18) — the negative-stock
    // override path (fe-requisition-issue e2e). requiredDate is latest so it never displaces the
    // happy-path row at the top of the issues worklist.
    id: "req-7",
    requisitionNo: "REQ/2526/0044",
    projectId: "proj-a",
    costCentreId: "cc-mat",
    purposeId: "pp-1",
    fromGodownId: "gd-a",
    requiredDate: "2026-07-30",
    priority: "HIGH",
    status: "APPROVED",
    estimatedValue: null,
    approvalTier: "PM",
    submittedAt: "2026-07-11T08:00:00Z",
    submittedById: "u-rafiq",
    closedAt: null,
    closedReason: null,
    narration: "Rebar top-up for the deck lift",
    version: 2,
    lines: [mkLine("rl-9", 1, "it-rebar", "20", "0", "gd-a")],
  },
];
// Seed submitted+ estimates.
for (const r of MOCK_REQUISITIONS)
  if (r.status !== "DRAFT") r.estimatedValue = reqEstimate(r.lines);

interface MockReqApproval {
  id: string;
  requisitionId: string;
  decision: "APPROVED" | "REJECTED";
  tier: "PM" | "ACCOUNTS";
  thresholdEvaluated: string | null;
  estimatedValueAtReview: string | null;
  reason: string | null;
  decidedById: string;
  decidedAt: string;
}
const MOCK_REQ_APPROVALS: MockReqApproval[] = [];

interface MockReqIssueLine {
  requisitionLineId: string;
  stockMovementId: string;
  issuedQuantity: string;
  rate: string;
  value: string;
}
interface MockReqIssue {
  requisitionId: string;
  requisitionIssueId: string;
  issueNo: number;
  journalEntryId: string;
  entryNo: string;
  issuedValue: string;
  fromGodownId: string;
  lines: MockReqIssueLine[];
  requisitionStatus: MockRequisition["status"];
  issuedAt: string;
  reversedAt: string | null;
  reversedById: string | null;
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
  {
    id: "pp-6",
    projectId: "proj-a",
    name: "Mobilization Advance · গতিশীলতা অগ্রিম",
    isActive: true,
    version: 1,
  },
  { id: "pp-7", projectId: "proj-a", name: "Subcontractor Payment", isActive: true, version: 1 },
  {
    id: "pp-8",
    projectId: "proj-a",
    name: "Safety Equipment · নিরাপত্তা সরঞ্জাম",
    isActive: true,
    version: 1,
  },
  {
    id: "pp-9",
    projectId: "proj-a",
    name: "Temporary Fencing (legacy)",
    isActive: false,
    version: 1,
  },
  { id: "pp-10", projectId: "proj-b", name: "Finishing Works", isActive: true, version: 1 },
  { id: "pp-11", projectId: "proj-b", name: "Lift & MEP", isActive: true, version: 1 },
];
let mockPurposeSeq = 500;

// Mirrors the Parties design-file sample so the list renders populated against the mock.
const MOCK_PARTIES: MockParty[] = [
  {
    id: "pa-1",
    name: "ABC Cement Co.",
    isCustomer: true,
    isSupplier: true,
    tin: "123456789012",
    bin: "001234567-0101",
    address: "Plot 7, Tejgaon I/A, Dhaka 1208",
    phone: "+8801712345678",
    email: "accounts@abccement.com.bd",
    paymentTermsDays: 30,
    openingBalance: "0.0000",
    isActive: true,
    version: 1,
  },
  {
    id: "pa-2",
    name: "Shah Cement Ltd.",
    isCustomer: false,
    isSupplier: true,
    tin: "556677889900",
    bin: "004455667-0202",
    address: null,
    phone: "+8801811223344",
    email: null,
    paymentTermsDays: 15,
    openingBalance: "0.0000",
    isActive: true,
    version: 1,
  },
  {
    id: "pa-3",
    name: "মেঘনা স্টিল মিলস",
    isCustomer: false,
    isSupplier: true,
    tin: "778899001122",
    bin: null,
    address: null,
    phone: "+8801999887766",
    email: null,
    paymentTermsDays: 45,
    openingBalance: "0.0000",
    isActive: true,
    version: 1,
  },
  {
    id: "pa-4",
    name: "Tower-A Developments Ltd.",
    isCustomer: true,
    isSupplier: false,
    tin: "334455667788",
    bin: "009988776-0303",
    address: "Gulshan Avenue, Dhaka 1212",
    phone: "+8801712009988",
    email: "finance@tower-a.com",
    paymentTermsDays: 0,
    openingBalance: "0.0000",
    isActive: true,
    version: 1,
  },
  {
    id: "pa-5",
    name: "M/s Rahman Traders",
    isCustomer: false,
    isSupplier: true,
    tin: null,
    bin: null,
    address: null,
    phone: "+8801677554433",
    email: null,
    paymentTermsDays: 7,
    openingBalance: "0.0000",
    isActive: false,
    version: 1,
  },
  {
    id: "pa-6",
    name: "Bashundhara Group",
    isCustomer: false,
    isSupplier: true,
    tin: "990011223344",
    bin: "003322110-0404",
    address: null,
    phone: "+8801511990022",
    email: null,
    paymentTermsDays: 30,
    openingBalance: "0.0000",
    isActive: true,
    version: 1,
  },
  {
    id: "pa-7",
    name: "করিম এন্টারপ্রাইজ",
    isCustomer: true,
    isSupplier: false,
    tin: "445566778899",
    bin: null,
    address: "১২/বি, নিউ মার্কেট, ঢাকা ১২০৫",
    phone: "+8801733221100",
    email: null,
    paymentTermsDays: 60,
    openingBalance: "0.0000",
    isActive: true,
    version: 1,
  },
  {
    id: "pa-8",
    name: "National Housing Authority",
    isCustomer: true,
    isSupplier: false,
    tin: "112233445566",
    bin: "006677889-0505",
    address: null,
    phone: "+8801866003311",
    email: null,
    paymentTermsDays: 90,
    openingBalance: "0.0000",
    isActive: true,
    version: 1,
  },
  {
    id: "pa-9",
    name: "Padma Aggregates Ltd.",
    isCustomer: false,
    isSupplier: true,
    tin: "667788990011",
    bin: null,
    address: null,
    phone: "+8801799112233",
    email: null,
    paymentTermsDays: 14,
    openingBalance: "0.0000",
    isActive: false,
    version: 1,
  },
  {
    id: "pa-10",
    name: "Zenith Interiors",
    isCustomer: true,
    isSupplier: true,
    tin: "220033445566",
    bin: "001122334-0606",
    address: null,
    phone: "+8801600224466",
    email: null,
    paymentTermsDays: 30,
    openingBalance: "0.0000",
    isActive: true,
    version: 1,
  },
];
let mockPartySeq = 800;

// ── Purchase / Orders sample (dev/preview only) — the fe-purchase-orders store ──
//
// A PO is a NON-posting commitment (FR-PUR-001/-002): no ledger write, no gapless number.
// `poRefNo` is the PO's own reference (allocated at Approve here for simplicity).
// `lineAmount`/`billedQty`/`receivedQty` are derived. Draft-only edits; Approve locks;
// Cancel needs a reason. Supplier ids ending in "-bills" simulate the PO_HAS_BILLS block.
interface MockPoLine {
  lineNo?: number;
  itemId: string;
  orderedQty: string;
  rate: string;
  lineAmount?: string;
  godownId: string;
  costCentreId: string;
  purposeId: string;
  billedQty?: string;
  receivedQty?: string;
}
interface MockPo {
  id: string;
  projectId: string;
  supplierId: string;
  poRefNo: string | null;
  poDate: string;
  expectedDeliveryDate: string | null;
  status: "DRAFT" | "APPROVED" | "PARTIALLY_BILLED" | "PARTIALLY_RECEIVED" | "CLOSED" | "CANCELLED";
  narration: string | null;
  lines: MockPoLine[];
  approvedBy: string | null;
  approvedAt: string | null;
  version: number;
}
function mkPo(p: Partial<MockPo> & Pick<MockPo, "id" | "projectId">): MockPo {
  return {
    poRefNo: null,
    supplierId: "pa-1",
    poDate: "2026-07-10",
    expectedDeliveryDate: null,
    status: "DRAFT",
    narration: null,
    lines: [],
    approvedBy: null,
    approvedAt: null,
    version: 1,
    ...p,
  };
}
const MOCK_POS: MockPo[] = [
  mkPo({
    id: "po-101",
    projectId: "proj-a",
    supplierId: "pa-1",
    poRefNo: "PO-2026-0101",
    poDate: "2026-07-08",
    expectedDeliveryDate: "2026-07-20",
    status: "APPROVED",
    narration: "Slab materials",
    approvedBy: "u-admin",
    approvedAt: "2026-07-08T10:00:00Z",
    lines: [
      {
        lineNo: 1,
        itemId: "it-cement",
        orderedQty: "100.0000",
        rate: "500.0000",
        lineAmount: "50000.0000",
        godownId: "gd-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
        billedQty: "0.0000",
        receivedQty: "0.0000",
      },
    ],
  }),
  mkPo({
    id: "po-102",
    projectId: "proj-a",
    supplierId: "pa-2",
    poRefNo: null,
    poDate: "2026-07-09",
    status: "DRAFT",
    lines: [
      {
        lineNo: 1,
        itemId: "it-cement",
        orderedQty: "50.0000",
        rate: "540.0000",
        lineAmount: "27000.0000",
        godownId: "gd-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
      },
    ],
  }),
  mkPo({
    id: "po-103",
    projectId: "proj-b",
    supplierId: "pa-6",
    poRefNo: "PO-2026-0088",
    poDate: "2026-06-25",
    status: "CANCELLED",
    lines: [
      {
        lineNo: 1,
        itemId: "it-cement",
        orderedQty: "10.0000",
        rate: "520.0000",
        lineAmount: "5200.0000",
        godownId: "gd-c",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
      },
    ],
  }),
];
let poSeq = 200;

/** Summary shape returned in the PO list (contract 08 GET /orders response). */
// ── Purchase Bills seed (dev/preview only) — the fe-purchase-bills store ─────
//
// Bills are the AP posting voucher. Draft → Post (atomic — the mock allocates a
// gapless-style entryNo + a synthetic journalEntryId) → Cancel (mandatory reason;
// supplier id ending in "-payments" simulates BILL_HAS_APPLIED_PAYMENTS).
// `netPayableAmount` is derived (Σ lineAmount + Σ vat − Σ tds − Σ ait), stored on
// the record so the list running-totals strip has fresh values without the FE
// recomputing (the real backend also derives it server-side).
interface MockBillLine {
  lineNo?: number;
  itemId?: string | null;
  expenseAccountId?: string | null;
  isStockLine: boolean;
  billedQty: string;
  rate: string;
  lineAmount?: string;
  vatInputAmount: string;
  tdsAmount: string;
  aitAmount: string;
  godownId?: string | null;
  costCentreId: string;
  purposeId: string;
  receivedQty?: string;
  matchStatus?: "MATCHED" | "OVER_RECEIVED" | "UNDER_RECEIVED" | "PENDING_RECEIPT";
}
interface MockBill {
  id: string;
  projectId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  supplierInvoiceRef: string | null;
  billDate: string;
  dueDate: string;
  grossAmount: string;
  vatInputAmount: string;
  tdsAmount: string;
  aitAmount: string;
  netPayableAmount: string;
  narration: string | null;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  entryNo: string | null;
  journalEntryId: string | null;
  outstandingAmount: string;
  lines: MockBillLine[];
  postedAt: string | null;
  postedBy: string | null;
  version: number;
}
function normalizeBillLine(l: MockBillLine, idx: number): MockBillLine {
  const qty = Number(l.billedQty || (l.isStockLine ? "0" : "1"));
  const rate = Number(l.rate ?? "0");
  const lineAmount = (qty * rate).toFixed(4);
  return {
    lineNo: idx + 1,
    itemId: l.isStockLine ? (l.itemId ?? null) : null,
    expenseAccountId: !l.isStockLine ? (l.expenseAccountId ?? null) : null,
    isStockLine: !!l.isStockLine,
    billedQty: String(l.billedQty || (l.isStockLine ? "0" : "1")),
    rate: String(l.rate ?? "0"),
    lineAmount,
    vatInputAmount: String(l.vatInputAmount ?? "0"),
    tdsAmount: String(l.tdsAmount ?? "0"),
    aitAmount: String(l.aitAmount ?? "0"),
    godownId: l.isStockLine ? (l.godownId ?? null) : null,
    costCentreId: l.costCentreId,
    purposeId: l.purposeId,
    receivedQty: l.isStockLine ? (l.receivedQty ?? "0.0000") : undefined,
    matchStatus: l.matchStatus,
  };
}
function recomputeBill(b: MockBill): void {
  let gross = 0;
  let vat = 0;
  let tds = 0;
  let ait = 0;
  for (const l of b.lines) {
    gross += Number(l.lineAmount ?? "0");
    vat += Number(l.vatInputAmount ?? "0");
    tds += Number(l.tdsAmount ?? "0");
    ait += Number(l.aitAmount ?? "0");
  }
  b.grossAmount = gross.toFixed(4);
  b.vatInputAmount = vat.toFixed(4);
  b.tdsAmount = tds.toFixed(4);
  b.aitAmount = ait.toFixed(4);
  b.netPayableAmount = (gross + vat - tds - ait).toFixed(4);
}
function mkBill(
  p: Partial<MockBill> &
    Pick<MockBill, "id" | "projectId" | "supplierId" | "billDate" | "dueDate" | "lines">,
): MockBill {
  const bill: MockBill = {
    purchaseOrderId: null,
    supplierInvoiceRef: null,
    grossAmount: "0.0000",
    vatInputAmount: "0.0000",
    tdsAmount: "0.0000",
    aitAmount: "0.0000",
    netPayableAmount: "0.0000",
    narration: null,
    status: "DRAFT",
    entryNo: null,
    journalEntryId: null,
    outstandingAmount: "0.0000",
    postedAt: null,
    postedBy: null,
    version: 1,
    ...p,
  };
  recomputeBill(bill);
  return bill;
}
const MOCK_BILLS: MockBill[] = [
  mkBill({
    id: "bill-201",
    projectId: "proj-a",
    supplierId: "pa-1",
    billDate: "2026-07-01",
    dueDate: "2026-08-01",
    supplierInvoiceRef: "INV-7741",
    narration: "Cement + Rod — Slab",
    status: "POSTED",
    entryNo: "PUR/2526/0001",
    journalEntryId: "je-bill-201",
    postedAt: "2026-07-01T10:22:11Z",
    postedBy: "u-admin",
    lines: [
      {
        lineNo: 1,
        itemId: "it-cement",
        expenseAccountId: null,
        isStockLine: true,
        billedQty: "100.0000",
        rate: "500.0000",
        lineAmount: "50000.0000",
        vatInputAmount: "3750.0000",
        tdsAmount: "2500.0000",
        aitAmount: "1000.0000",
        godownId: "gd-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
        receivedQty: "100.0000",
        matchStatus: "MATCHED",
      },
    ],
  }),
];
let billSeq = 300;
function billSummary(b: MockBill) {
  return {
    id: b.id,
    entryNo: b.entryNo,
    projectId: b.projectId,
    supplierId: b.supplierId,
    billDate: b.billDate,
    grossAmount: b.grossAmount,
    vatInputAmount: b.vatInputAmount,
    tdsAmount: b.tdsAmount,
    aitAmount: b.aitAmount,
    netPayableAmount: b.netPayableAmount,
    outstandingAmount: b.outstandingAmount,
    status: b.status,
  };
}
function billResource(b: MockBill) {
  return { ...b };
}
function billToJournalEntry(b: MockBill) {
  const stockLines = b.lines
    .filter((l) => l.isStockLine)
    .map((l, i) => ({
      id: `l-inv-${b.id}-${i}`,
      lineNo: i + 1,
      accountId: "5100",
      projectId: b.projectId,
      costCentreId: l.costCentreId,
      purposeId: l.purposeId,
      godownId: l.godownId,
      partyId: null,
      debit: l.lineAmount ?? "0.0000",
      credit: "0.0000",
      narration: null,
    }));
  const expenseLines = b.lines
    .filter((l) => !l.isStockLine)
    .map((l, i) => ({
      id: `l-exp-${b.id}-${i}`,
      lineNo: stockLines.length + i + 1,
      accountId: l.expenseAccountId ?? "5100",
      projectId: b.projectId,
      costCentreId: l.costCentreId,
      purposeId: l.purposeId,
      godownId: null,
      partyId: null,
      debit: l.lineAmount ?? "0.0000",
      credit: "0.0000",
      narration: null,
    }));
  const nextLineNo = stockLines.length + expenseLines.length + 1;
  const nonBaseLines = [
    ...(Number(b.vatInputAmount) > 0
      ? [
          {
            id: `l-vat-${b.id}`,
            lineNo: nextLineNo,
            accountId: "1440",
            projectId: b.projectId,
            costCentreId: b.lines[0]?.costCentreId ?? null,
            purposeId: b.lines[0]?.purposeId ?? null,
            godownId: null,
            partyId: null,
            debit: b.vatInputAmount,
            credit: "0.0000",
            narration: null,
          },
        ]
      : []),
    {
      id: `l-ap-${b.id}`,
      lineNo: nextLineNo + 1,
      accountId: "2100",
      projectId: b.projectId,
      costCentreId: b.lines[0]?.costCentreId ?? null,
      purposeId: b.lines[0]?.purposeId ?? null,
      godownId: null,
      partyId: b.supplierId,
      debit: "0.0000",
      credit: b.netPayableAmount,
      narration: null,
    },
    ...(Number(b.tdsAmount) > 0
      ? [
          {
            id: `l-tds-${b.id}`,
            lineNo: nextLineNo + 2,
            accountId: "2210",
            projectId: b.projectId,
            costCentreId: b.lines[0]?.costCentreId ?? null,
            purposeId: b.lines[0]?.purposeId ?? null,
            godownId: null,
            partyId: null,
            debit: "0.0000",
            credit: b.tdsAmount,
            narration: null,
          },
        ]
      : []),
    ...(Number(b.aitAmount) > 0
      ? [
          {
            id: `l-ait-${b.id}`,
            lineNo: nextLineNo + 3,
            accountId: "2220",
            projectId: b.projectId,
            costCentreId: b.lines[0]?.costCentreId ?? null,
            purposeId: b.lines[0]?.purposeId ?? null,
            godownId: null,
            partyId: null,
            debit: "0.0000",
            credit: b.aitAmount,
            narration: null,
          },
        ]
      : []),
  ];
  const lines = [...stockLines, ...expenseLines, ...nonBaseLines];
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0).toFixed(4);
  return {
    id: b.journalEntryId ?? `je-${b.id}`,
    entryNo: b.entryNo ?? b.id,
    financialYearId: "fy-1",
    voucherType: "PURCHASE",
    voucherDate: b.billDate,
    sourceType: "purchase.bills",
    sourceId: b.id,
    isReversal: false,
    reversalOf: null,
    isReversed: b.status === "CANCELLED",
    reversedByEntryId: null,
    reversedBy: null,
    narration: b.narration,
    postedAt: b.postedAt ?? "2026-07-01T10:22:11Z",
    postedBy: b.postedBy,
    totalDebit,
    totalCredit,
    lines,
  };
}

/**
 * Synthesize a balanced journal entry for a posted/cancelled receipt (fe-receipt-viewer
 * G2). IPC-linked: Dr deposit + Dr tax-recoverable / Cr Accounts Receivable (party-
 * tagged); General: Dr deposit / Cr general target (party-tagged for advance liabilities).
 * The mock has no ledger-write layer — the receipt POST allocates a `journalEntryId`
 * synthetically, so this hydration is what the viewer reads back.
 */
function receiptToJournalEntry(r: MockReceipt, entryId: string) {
  const zero = "0.0000";
  const settled = r.amountSettled;
  const cash = r.cashReceived ?? r.amountSettled;
  const tds = r.taxDeductedAtSource ?? zero;
  const lines: Array<{
    id: string;
    lineNo: number;
    accountId: string;
    projectId: string | null;
    costCentreId: string | null;
    purposeId: string | null;
    godownId: null;
    partyId: string | null;
    debit: string;
    credit: string;
    narration: null;
  }> = [];
  // Dr deposit
  lines.push({
    id: `${entryId}-l1`,
    lineNo: 1,
    accountId: r.depositAccountId ?? "1010",
    projectId: null,
    costCentreId: null,
    purposeId: null,
    godownId: null,
    partyId: null,
    debit: cash,
    credit: zero,
    narration: null,
  });
  if (r.receiptType === "IPC_LINKED") {
    if (Number(tds) > 0) {
      lines.push({
        id: `${entryId}-l2`,
        lineNo: 2,
        accountId: "1450",
        projectId: r.projectId ?? null,
        costCentreId: r.costCentreId ?? null,
        purposeId: r.purposeId ?? null,
        godownId: null,
        partyId: null,
        debit: tds,
        credit: zero,
        narration: null,
      });
    }
    lines.push({
      id: `${entryId}-lar`,
      lineNo: lines.length + 1,
      accountId: "1200",
      projectId: null,
      costCentreId: null,
      purposeId: null,
      godownId: null,
      partyId: r.partyId,
      debit: zero,
      credit: settled,
      narration: null,
    });
  } else {
    lines.push({
      id: `${entryId}-lgen`,
      lineNo: 2,
      accountId: r.generalTargetAccountId ?? "4100",
      projectId: r.projectId ?? null,
      costCentreId: r.costCentreId ?? null,
      purposeId: r.purposeId ?? null,
      godownId: null,
      partyId: r.partyId,
      debit: zero,
      credit: settled,
      narration: null,
    });
  }
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0).toFixed(4);
  return {
    id: entryId,
    entryNo: r.entryNo ?? r.id,
    financialYearId: "fy-1",
    voucherType: "RECEIPT",
    voucherDate: r.receiptDate,
    sourceType: "receipts",
    sourceId: r.id,
    isReversal: false,
    reversalOf: null,
    isReversed: r.status === "CANCELLED",
    reversedByEntryId: null,
    reversedBy: null,
    narration: r.narration ?? null,
    postedAt: r.postedAt ?? "2026-07-01T10:22:11Z",
    postedBy: r.postedBy ?? null,
    totalDebit,
    totalCredit,
    lines,
  };
}

/**
 * Synthesize a balanced journal entry for a posted/cancelled payment (fe-payment-viewer
 * G2). One control/liability debit per allocation (AP for supplier bills, Labour Payable
 * for labour, Salary Payable for salary — never re-expensed), an optional bank-charge
 * debit, and the bank/cash/MFS credit for the remainder. The mock synthesises this on
 * demand from MOCK_PAYMENTS (no ledger-write layer).
 */
function paymentToJournalEntry(
  p: {
    id: string;
    partyId: string;
    paymentDate: string;
    paymentAccountId: string;
    paymentAmount: string;
    bankChargesAmount: string;
    allocations: Array<{
      payableType: string;
      payableId: string;
      amountAllocated: string;
      partyId: string | null;
    }>;
    entryNo: string | null;
    journalEntryId: string | null;
    postedAt: string | null;
    postedBy: string | null;
    narration: string | null;
    status: string;
  },
  entryId: string,
) {
  const zero = "0.0000";
  const CONTROL: Record<string, string> = {
    PURCHASE_BILL: "2100", // Accounts Payable
    LABOUR_PAYABLE: "2110", // Labour Payable
    SALARY: "2120", // Salary Payable
  };
  const lines: Array<{
    id: string;
    lineNo: number;
    accountId: string;
    projectId: string | null;
    costCentreId: string | null;
    purposeId: string | null;
    godownId: null;
    partyId: string | null;
    debit: string;
    credit: string;
    narration: null;
  }> = [];
  let ln = 1;
  for (const a of p.allocations) {
    lines.push({
      id: `${entryId}-l${ln}`,
      lineNo: ln,
      accountId: CONTROL[a.payableType] ?? "2100",
      projectId: null,
      costCentreId: null,
      purposeId: null,
      godownId: null,
      partyId: a.partyId ?? p.partyId,
      debit: a.amountAllocated,
      credit: zero,
      narration: null,
    });
    ln += 1;
  }
  if (Number(p.bankChargesAmount) > 0) {
    lines.push({
      id: `${entryId}-lbc`,
      lineNo: ln++,
      accountId: "5300", // Bank charges (expense)
      projectId: null,
      costCentreId: null,
      purposeId: null,
      godownId: null,
      partyId: null,
      debit: p.bankChargesAmount,
      credit: zero,
      narration: null,
    });
  }
  // Cash out = Σ allocations + bank charges (matches paymentAmount because the FE gates
  // Post on full allocation — Phase-1 rule).
  const totalDr = lines.reduce((s, l) => s + Number(l.debit), 0);
  lines.push({
    id: `${entryId}-lcash`,
    lineNo: ln,
    accountId: p.paymentAccountId,
    projectId: null,
    costCentreId: null,
    purposeId: null,
    godownId: null,
    partyId: null,
    debit: zero,
    credit: totalDr.toFixed(4),
    narration: null,
  });
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0).toFixed(4);
  return {
    id: entryId,
    entryNo: p.entryNo ?? p.id,
    financialYearId: "fy-1",
    voucherType: "PAYMENT",
    voucherDate: p.paymentDate,
    sourceType: "payments",
    sourceId: p.id,
    isReversal: false,
    reversalOf: null,
    isReversed: p.status === "CANCELLED",
    reversedByEntryId: null,
    reversedBy: null,
    narration: p.narration,
    postedAt: p.postedAt ?? "2026-07-01T10:22:11Z",
    postedBy: p.postedBy,
    totalDebit,
    totalCredit,
    lines,
  };
}

// ── GRN seed (dev/preview only) — the fe-grn-matching store ───────────────────
//
// A GRN records goods physically received against a PO/Bill; Post drives INV
// `receiveIn` per line for the received qty (no ledger write, no PURCHASE number
// — SRS §16). The mock keeps a couple of drafts + a posted GRN so the list has
// something to render. Correction is via the parent bill; there is no cancel/repost.
interface MockGrnLine {
  lineNo?: number;
  itemId: string;
  orderedQty: string;
  billedQty: string;
  receivedQty: string;
  rate: string;
  receivedValue?: string;
  godownId: string;
  costCentreId: string;
  purposeId: string;
  matchStatus?: "MATCHED" | "OVER_RECEIVED" | "UNDER_RECEIVED" | "PENDING_RECEIPT";
}
interface MockGrn {
  id: string;
  projectId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  purchaseBillId: string | null;
  grnRefNo: string | null;
  receiptDate: string;
  narration: string | null;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  lines: MockGrnLine[];
  receivedBy: string | null;
  postedAt: string | null;
  version: number;
}
function mkGrn(
  p: Partial<MockGrn> & Pick<MockGrn, "id" | "projectId" | "supplierId" | "receiptDate" | "lines">,
): MockGrn {
  return {
    purchaseOrderId: null,
    purchaseBillId: null,
    grnRefNo: null,
    narration: null,
    status: "DRAFT",
    receivedBy: null,
    postedAt: null,
    version: 1,
    ...p,
  };
}
const MOCK_GRNS: MockGrn[] = [
  mkGrn({
    id: "grn-501",
    projectId: "proj-a",
    supplierId: "pa-1",
    purchaseOrderId: "po-101",
    purchaseBillId: null,
    grnRefNo: "GRN-2526/0001",
    receiptDate: "2026-07-08",
    narration: null,
    status: "POSTED",
    receivedBy: "u-rafiq",
    postedAt: "2026-07-08T05:00:00Z",
    lines: [
      {
        lineNo: 1,
        itemId: "it-cement",
        orderedQty: "100.0000",
        billedQty: "100.0000",
        receivedQty: "100.0000",
        rate: "500.0000",
        receivedValue: "50000.0000",
        godownId: "gd-a",
        costCentreId: "cc-mat",
        purposeId: "pp-1",
        matchStatus: "MATCHED",
      },
    ],
  }),
];
let grnSeq = 500;
function grnSummary(g: MockGrn) {
  return {
    id: g.id,
    grnRefNo: g.grnRefNo,
    projectId: g.projectId,
    supplierId: g.supplierId,
    purchaseOrderId: g.purchaseOrderId,
    purchaseBillId: g.purchaseBillId,
    receiptDate: g.receiptDate,
    status: g.status,
  };
}
function grnResource(g: MockGrn) {
  return { ...g };
}

function poSummary(o: MockPo) {
  // orderTotalAmount = Σ line amounts (the PO commitment value); mirrors the real
  // backend's derived summary field (contract 08 GET /orders).
  const orderTotal = o.lines.reduce(
    (sum, l) => sum + Number(l.lineAmount ?? Number(l.orderedQty) * Number(l.rate)),
    0,
  );
  return {
    id: o.id,
    poRefNo: o.poRefNo,
    projectId: o.projectId,
    supplierId: o.supplierId,
    poDate: o.poDate,
    expectedDeliveryDate: o.expectedDeliveryDate,
    orderTotalAmount: orderTotal.toFixed(4),
    status: o.status,
  };
}
/** Full PO resource (contract 08 GET /orders/:id). */
function poResource(o: MockPo) {
  // Per-line advisory budgetStatus, derived on the read only (contract 08 GET /orders/:id;
  // FR-PUR-019) — one classification per distinct cost centre, mapped back onto the lines,
  // so the read-only APPROVED PO renders the same per-line badge the draft editor shows.
  const byCostCentre = new Map<string, string>(
    poBudgetWarnings(o).map((w) => [w.costCentreId, w.status]),
  );
  return {
    id: o.id,
    projectId: o.projectId,
    supplierId: o.supplierId,
    poRefNo: o.poRefNo,
    poDate: o.poDate,
    expectedDeliveryDate: o.expectedDeliveryDate,
    status: o.status,
    narration: o.narration,
    lines: o.lines.map((l) => ({
      ...l,
      budgetStatus: byCostCentre.get(l.costCentreId) ?? null,
    })),
    approvedBy: o.approvedBy,
    approvedAt: o.approvedAt,
    version: o.version,
  };
}
/**
 * Compute per-(project, costCentre) advisory budget warnings for a PO (FR-PUR-019).
 * Purely illustrative: one entry per distinct cost centre on the PO, cycling through
 * OK/APPROACHING/OVER/UNBUDGETED so the badges have something interesting to render.
 * Never blocks a Save/Approve.
 */
function poBudgetWarnings(
  o: MockPo,
): Array<{ projectId: string; costCentreId: string; status: string }> {
  const cycle = ["OK", "APPROACHING", "OVER", "UNBUDGETED"] as const;
  const seen = new Set<string>();
  const out: Array<{ projectId: string; costCentreId: string; status: string }> = [];
  o.lines.forEach((l, i) => {
    if (seen.has(l.costCentreId)) return;
    seen.add(l.costCentreId);
    out.push({
      projectId: o.projectId,
      costCentreId: l.costCentreId,
      status: cycle[i % cycle.length]!,
    });
  });
  return out;
}

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

function ipcCurrentlyDue(
  i: Pick<
    MockIpc,
    | "certifiedAmount"
    | "outputVatAmount"
    | "retentionAmount"
    | "advanceRecoveredAmount"
    | "aitTdsAmount"
  >,
): string {
  const raw =
    Number(i.certifiedAmount) +
    Number(i.outputVatAmount) -
    Number(i.retentionAmount) -
    Number(i.advanceRecoveredAmount) -
    Number(i.aitTdsAmount);
  return (raw < 0 ? 0 : raw).toFixed(4);
}
function mkIpc(
  o: Partial<MockIpc> &
    Pick<MockIpc, "id" | "projectId" | "customerId" | "ipcSeqNo" | "certifiedAmount">,
): MockIpc {
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
  mkIpc({
    id: "ipc-7",
    projectId: "proj-a",
    customerId: "pa-8",
    ipcSeqNo: 7,
    ipcDate: "2026-07-12",
    certifiedAmount: "1000000.0000",
    outputVatAmount: "75000.0000",
    aitTdsAmount: "50000.0000",
    retentionAmount: "100000.0000",
    advanceRecoveredAmount: "150000.0000",
    narration: "৪৫% অগ্রগতি — সুপারস্ট্রাকচার পর্যায়।",
    status: "POSTED",
    entryNo: "IPC/2526/0007",
    journalEntryId: "je-ipc-7",
    postedAt: "2026-07-12T05:30:00Z",
    postedBy: "00000000-0000-0000-0000-000000000001",
    version: 2,
  }),
  mkIpc({
    id: "ipc-draft",
    projectId: "proj-b",
    customerId: "pa-4",
    ipcSeqNo: 1,
    ipcDate: "2026-07-11",
    certifiedAmount: "2400000.0000",
    status: "DRAFT",
  }),
  mkIpc({
    id: "ipc-6",
    projectId: "proj-a",
    customerId: "pa-8",
    ipcSeqNo: 6,
    ipcDate: "2026-07-05",
    certifiedAmount: "1500000.0000",
    aitTdsAmount: "75000.0000",
    retentionAmount: "150000.0000",
    advanceRecoveredAmount: "225000.0000",
    status: "POSTED",
    entryNo: "IPC/2526/0006",
    journalEntryId: "je-ipc-6",
    postedAt: "2026-07-05T05:30:00Z",
    postedBy: "00000000-0000-0000-0000-000000000001",
    version: 2,
  }),
  mkIpc({
    id: "ipc-5",
    projectId: "proj-a",
    customerId: "pa-8",
    ipcSeqNo: 5,
    ipcDate: "2026-06-28",
    certifiedAmount: "800000.0000",
    aitTdsAmount: "40000.0000",
    retentionAmount: "80000.0000",
    advanceRecoveredAmount: "120000.0000",
    status: "POSTED",
    entryNo: "IPC/2526/0005",
    journalEntryId: "je-ipc-5",
    postedAt: "2026-06-28T05:30:00Z",
    postedBy: "00000000-0000-0000-0000-000000000001",
    version: 2,
  }),
  mkIpc({
    id: "ipc-4",
    projectId: "proj-b",
    customerId: "pa-4",
    ipcSeqNo: 4,
    ipcDate: "2026-06-20",
    certifiedAmount: "1200000.0000",
    aitTdsAmount: "60000.0000",
    retentionAmount: "120000.0000",
    advanceRecoveredAmount: "180000.0000",
    status: "CANCELLED",
    entryNo: "IPC/2526/0004",
    journalEntryId: "je-ipc-4",
    reversalEntryNo: "IPC/2526/0009",
    postedAt: "2026-06-20T05:30:00Z",
    postedBy: "00000000-0000-0000-0000-000000000001",
    version: 3,
  }),
  mkIpc({
    id: "ipc-3",
    projectId: "proj-c",
    customerId: "pa-7",
    ipcSeqNo: 3,
    ipcDate: "2026-07-10",
    certifiedAmount: "650000.0000",
    aitTdsAmount: "0.0000",
    retentionAmount: "65000.0000",
    advanceRecoveredAmount: "0.0000",
    status: "DRAFT",
  }),
];
let ipcSeq = 100;
let ipcNumberSeq = 9; // next gapless IPC/2526/00xx allocated at post (0004..0009 already used)

/**
 * Posted retention releases (fe-ipc-register-retention). Module-scoped so state persists
 * across requests in the single-process mock backend — used by both `/release-retention`
 * (write) and the register `retainedHeld` computation (read).
 */
interface MockRelease {
  id: string;
  ipcId: string;
  releaseDate: string;
  releasedAmount: string;
  entryNo: string;
  status: "POSTED";
  postedAt: string;
  postedBy: string;
}
const MOCK_RELEASES: MockRelease[] = [];

// ── Receipts sample (fe-receipt-list, dev/preview only) ──────────────────────────
// A read-only collection register — both IPC-linked (references a POSTED IPC,
// reduces its outstanding) and general/non-project receipts, one `RECEIPT` number
// space per FY. `entryNo` is null while DRAFT (FR-REC-013). Party ids reuse the
// shared MOCK_PARTIES pool; IPC-linked rows reference the posted IPCs above.
interface MockReceipt {
  id: string;
  receiptType: "IPC_LINKED" | "GENERAL";
  receiptDate: string;
  paymentMode: "CASH" | "MFS" | "BANK_TRANSFER" | "CHEQUE";
  depositAccountId?: string;
  partyId: string;
  projectId: string | null;
  costCentreId?: string | null;
  purposeId?: string | null;
  ipcId: string | null;
  generalTargetAccountId?: string | null;
  amountSettled: string;
  cashReceived?: string;
  taxDeductedAtSource: string;
  chequeTxnRef?: string | null;
  narration?: string | null;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  entryNo: string | null;
  journalEntryId?: string | null;
  ipcOutstandingAfter?: string | null;
  postedAt?: string | null;
  postedBy?: string | null;
  version?: number;
}
const MOCK_RECEIPTS: MockReceipt[] = [
  {
    id: "rec-1",
    receiptType: "IPC_LINKED",
    receiptDate: "2026-07-10",
    paymentMode: "BANK_TRANSFER",
    partyId: "pa-8",
    projectId: "proj-a",
    ipcId: "ipc-6",
    amountSettled: "1162500.0000",
    taxDeductedAtSource: "58125.0000",
    status: "POSTED",
    entryNo: "RCT/2526/0048",
  },
  {
    id: "rec-2",
    receiptType: "GENERAL",
    receiptDate: "2026-07-08",
    paymentMode: "MFS",
    partyId: "pa-1",
    projectId: null,
    ipcId: null,
    amountSettled: "240000.0000",
    taxDeductedAtSource: "0.0000",
    status: "POSTED",
    entryNo: "RCT/2526/0047",
  },
  {
    id: "rec-3",
    receiptType: "IPC_LINKED",
    receiptDate: "2026-07-07",
    paymentMode: "CHEQUE",
    partyId: "pa-8",
    projectId: "proj-a",
    ipcId: "ipc-6",
    amountSettled: "775000.0000",
    taxDeductedAtSource: "38750.0000",
    status: "DRAFT",
    entryNo: null,
  },
  {
    id: "rec-4",
    receiptType: "IPC_LINKED",
    receiptDate: "2026-07-05",
    paymentMode: "BANK_TRANSFER",
    partyId: "pa-8",
    projectId: "proj-a",
    ipcId: "ipc-5",
    amountSettled: "500000.0000",
    taxDeductedAtSource: "25000.0000",
    status: "POSTED",
    entryNo: "RCT/2526/0046",
  },
  {
    id: "rec-5",
    receiptType: "GENERAL",
    receiptDate: "2026-07-03",
    paymentMode: "CASH",
    partyId: "pa-7",
    projectId: null,
    ipcId: null,
    amountSettled: "120000.0000",
    taxDeductedAtSource: "0.0000",
    status: "POSTED",
    entryNo: "RCT/2526/0045",
  },
  {
    id: "rec-6",
    receiptType: "IPC_LINKED",
    receiptDate: "2026-07-01",
    paymentMode: "BANK_TRANSFER",
    partyId: "pa-8",
    projectId: "proj-a",
    ipcId: "ipc-6",
    amountSettled: "930000.0000",
    taxDeductedAtSource: "46500.0000",
    status: "CANCELLED",
    entryNo: "RCT/2526/0044",
  },
  {
    id: "rec-7",
    receiptType: "GENERAL",
    receiptDate: "2026-06-28",
    paymentMode: "CHEQUE",
    partyId: "pa-10",
    projectId: null,
    ipcId: null,
    amountSettled: "350000.0000",
    taxDeductedAtSource: "0.0000",
    status: "POSTED",
    entryNo: "RCT/2526/0043",
  },
  {
    id: "rec-8",
    receiptType: "GENERAL",
    receiptDate: "2026-06-25",
    paymentMode: "CASH",
    partyId: "pa-nonexistent",
    projectId: "proj-b",
    ipcId: null,
    amountSettled: "85000.0000",
    taxDeductedAtSource: "0.0000",
    status: "POSTED",
    entryNo: "RCT/2526/0041",
  },
  {
    id: "rec-9",
    receiptType: "GENERAL",
    receiptDate: "2026-06-20",
    paymentMode: "BANK_TRANSFER",
    partyId: "pa-4",
    projectId: "proj-b",
    ipcId: null,
    amountSettled: "200000.0000",
    taxDeductedAtSource: "0.0000",
    status: "POSTED",
    entryNo: "RCT/2526/0040",
  },
];

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

/**
 * The safe `user` payload for `/auth/login` and `/auth/me` (contract 05).
 *
 * `avatarUrl` is read from the FE-52 profile store — the SAME store the avatar
 * endpoints write — because the shell's sidebar-footer avatar reads it off the
 * session projection, not `GET /api/profile` (FR-AUD-038). Sourcing it from the
 * static `USERS` row instead would leave the mock sidebar stuck on initials after
 * an upload, exactly the real-backend bug this fixes.
 */
function safeUser(u: MockUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    companyId: u.companyId,
    financialYearId: u.financialYearId,
    companyName: "Zakir Enterprise",
    financialYearLabel: "FY 2025-26",
    isActive: u.isActive,
    lastLoginAt: null,
    avatarUrl: mockGetProfile(u.email).avatarUrl,
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

// ── FE-53 notifications store (mock) ─────────────────────────────────────────
interface MockNotification {
  id: string;
  type: string;
  severity: "HIGH" | "NORMAL" | "LOW";
  sourceModule: string;
  title: string;
  body: string;
  deepLink: { route: string; params?: Record<string, string> | null } | null;
  payload: Record<string, string> | null;
  createdAt: string;
  readAt: string | null;
}
interface MockNotifStore {
  rows: MockNotification[];
}
const gNtf = globalThis as unknown as { __MOCK_NOTIFS__?: Record<string, MockNotifStore> };
function getMockNotifStore(userKey: string): MockNotifStore {
  if (!gNtf.__MOCK_NOTIFS__) gNtf.__MOCK_NOTIFS__ = {};
  if (!gNtf.__MOCK_NOTIFS__[userKey]) {
    const now = Date.now();
    const mk = (
      i: number,
      seed: Omit<MockNotification, "id" | "createdAt" | "readAt"> & { agoMin: number; read?: boolean },
    ): MockNotification => ({
      id: `ntf-${userKey}-${i}`,
      type: seed.type,
      severity: seed.severity,
      sourceModule: seed.sourceModule,
      title: seed.title,
      body: seed.body,
      deepLink: seed.deepLink,
      payload: seed.payload,
      createdAt: new Date(now - seed.agoMin * 60_000).toISOString(),
      readAt: seed.read ? new Date(now - seed.agoMin * 30_000).toISOString() : null,
    });
    gNtf.__MOCK_NOTIFS__[userKey] = {
      rows: [
        mk(1, {
          type: "BUDGET_BREACH",
          severity: "HIGH",
          sourceModule: "CC",
          title: "Budget breach — Flooring, Tower A",
          body: "Actuals ৳ 12,45,000 exceed the budget ৳ 10,00,000 (+24.5%). Review the cost centre.",
          deepLink: { route: "/cost-control/budget-vs-actual", params: { costCentre: "cc-mat" } },
          payload: null,
          agoMin: 4,
        }),
        mk(2, {
          type: "REQUISITION_APPROVAL",
          severity: "NORMAL",
          sourceModule: "REQ",
          title: "Requisition REQ-2025/0324 — Awaiting your approval",
          body: "Rahim Uddin submitted for Bridge-04 · 12 items · ৳ 5,20,000.",
          deepLink: { route: "/requisitions/approvals" },
          payload: null,
          agoMin: 22,
        }),
        mk(3, {
          type: "IPC_SUBMITTED",
          severity: "NORMAL",
          sourceModule: "SAL",
          title: "IPC IPC/2526/0018 submitted",
          body: "National Housing Authority · Bridge-04 · ৳ 92,00,000 certified this month.",
          deepLink: { route: "/sales/ipcs" },
          payload: null,
          agoMin: 65,
        }),
        mk(4, {
          type: "GRN_MISMATCH",
          severity: "NORMAL",
          sourceModule: "PUR",
          title: "GRN mismatch — PO-2025/0141",
          body: "Received 480 bags vs ordered 500. Short-received 20 bags of cement.",
          deepLink: { route: "/purchase/grn" },
          payload: null,
          agoMin: 130,
        }),
        mk(5, {
          type: "PAYMENT_POSTED",
          severity: "LOW",
          sourceModule: "PAY",
          title: "কর্মচারী বেতন পোস্ট হয়েছে",
          body: "Salary payment posted for the July 2025 cycle · ৳ 18,45,000 disbursed.",
          deepLink: { route: "/payments" },
          payload: null,
          agoMin: 300,
          read: true,
        }),
        mk(6, {
          type: "AUDIT_EVENT",
          severity: "LOW",
          sourceModule: "AUD",
          title: "New sign-in on your account",
          body: "A new session started from Dhaka, Bangladesh at 14/07/2026 09:12.",
          deepLink: null,
          payload: null,
          agoMin: 900,
          read: true,
        }),
        mk(7, {
          type: "IPC_REVERSED",
          severity: "NORMAL",
          sourceModule: "SAL",
          title: "IPC IPC/2526/0007 reversed",
          body: "This IPC has been reversed; the underlying record was replaced.",
          deepLink: { route: "/sales/ipcs/ipc-gone" },
          payload: null,
          agoMin: 1500,
          read: true,
        }),
      ],
    };
  }
  return gNtf.__MOCK_NOTIFS__[userKey]!;
}

// ── FE-52 profile store (mock) ────────────────────────────────────────────────
interface MockProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  isUnscoped: boolean;
  isActive: boolean;
  financialYearId: string;
  lastLoginAt: string | null;
  version: number;
}

const gProfile = globalThis as unknown as { __MOCK_PROFILES__?: Record<string, MockProfile> };

function seedProfile(u: MockUser): MockProfile {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.email === "admin@ze.test" ? "+8801712345678" : null,
    avatarUrl: null,
    role: u.role,
    isUnscoped: u.assignedProjectIds.length === 0,
    isActive: u.isActive,
    financialYearId: u.financialYearId,
    lastLoginAt: u.email === "admin@ze.test" ? "2026-07-14T10:15:00Z" : null,
    version: 1,
  };
}

export function mockGetProfile(userKey: string): MockProfile {
  if (!gProfile.__MOCK_PROFILES__) gProfile.__MOCK_PROFILES__ = {};
  if (!gProfile.__MOCK_PROFILES__[userKey]) {
    const u = USERS[userKey];
    if (!u) throw new Error(`Unknown mock user: ${userKey}`);
    gProfile.__MOCK_PROFILES__[userKey] = seedProfile(u);
  }
  return gProfile.__MOCK_PROFILES__[userKey]!;
}

export function mockProfileSetAvatar(accessToken: string, dataUri: string): unknown | null {
  const parsed = readAccess(accessToken);
  if (!parsed || parsed.expired) return null;
  const profile = mockGetProfile(parsed.userKey);
  profile.avatarUrl = dataUri;
  profile.version += 1;
  return profileToView(profile);
}

const MOCK_PROJECT_NAMES: Record<string, string> = {
  "proj-a": "Bridge-04 (Meghna river approach)",
  "proj-b": "টাওয়ার-১২ (Uttara)",
};

function profileToView(p: MockProfile) {
  const assignedProjects = p.isUnscoped
    ? { scope: "ALL" as const }
    : (USERS[p.email]?.assignedProjectIds ?? []).map((id) => ({
        projectId: id,
        projectName: MOCK_PROJECT_NAMES[id] ?? id,
      }));
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    phone: p.phone,
    avatarUrl: p.avatarUrl,
    role: p.role,
    isUnscoped: p.isUnscoped,
    isActive: p.isActive,
    financialYearId: p.financialYearId,
    lastLoginAt: p.lastLoginAt,
    assignedProjects,
    version: p.version,
  };
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
      return {
        status: 401,
        body: envelope("INVALID_CREDENTIALS", "Refresh token invalid or revoked"),
      };
    }
    const user = USERS[parsed.userKey];
    if (!user)
      return { status: 401, body: envelope("INVALID_CREDENTIALS", "Refresh token invalid") };
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
    if (access.expired)
      return { status: 401, body: envelope("TOKEN_EXPIRED", "Access token expired") };
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
  if (access.expired)
    return { status: 401, body: envelope("TOKEN_EXPIRED", "Access token expired") };
  const user = USERS[access.userKey];
  if (!user) return { status: 401, body: envelope("UNAUTHORIZED", "Unknown subject") };
  if (!user.isActive) return { status: 403, body: envelope("FORBIDDEN", "Account deactivated") };

  // A tiny sample protected resource for the proxy/refresh e2e.
  if (req.path === "/auth/me") {
    return { status: 200, body: success({ user: safeUser(user) }) };
  }

  // ── FE-54 fe-report-catalog — /reports/catalog + /reports/<name> ──
  if (req.path === "/reports/catalog" && req.method === "GET") {
    return {
      status: 200,
      body: success([
        {
          name: "trial-balance",
          title: "Trial balance",
          description: "Debit + credit balance per account for the period; must tie.",
          category: "LEDGERS_REGISTERS",
          viewerRoute: "/reports/trial-balance-ledgers",
          requiredPermission: "reports",
          parameters: [],
          projectScoped: false,
          supportsAsOf: true,
          supportsDateRange: true,
        },
        {
          name: "profit-and-loss",
          title: "Profit & loss",
          description: "Revenue vs cost of services + operating expenses for the period.",
          category: "FINANCIAL_STATEMENTS",
          viewerRoute: "/reports/financial-statements",
          requiredPermission: "reports",
          parameters: [],
          supportsDateRange: true,
        },
        {
          name: "balance-sheet",
          title: "Balance sheet",
          description: "Assets = Liabilities + Equity as at a date.",
          category: "FINANCIAL_STATEMENTS",
          viewerRoute: "/reports/financial-statements",
          requiredPermission: "reports",
          parameters: [],
          supportsAsOf: true,
        },
        {
          // Machine name is `daybook` per the API contract (§GET /api/reports/daybook)
          // and the real backend catalog; "Journal register" is only its display title.
          name: "daybook",
          title: "Journal register",
          description: "Every posted journal entry over the period, oldest first.",
          category: "LEDGERS_REGISTERS",
          viewerRoute: "/reports/trial-balance-ledgers",
          requiredPermission: "reports",
          parameters: [],
          supportsDateRange: true,
        },
        {
          name: "account-ledger",
          title: "Account ledger",
          description: "Every posting on one account with a running balance.",
          category: "LEDGERS_REGISTERS",
          viewerRoute: "/reports/trial-balance-ledgers",
          requiredPermission: "reports",
          parameters: [],
          supportsDateRange: true,
        },
        {
          name: "cash-bank-book",
          title: "Cash & bank book",
          description: "Receipts and payments per cash/bank account with a running balance.",
          category: "LEDGERS_REGISTERS",
          viewerRoute: "/reports/trial-balance-ledgers",
          requiredPermission: "reports",
          parameters: [],
          supportsDateRange: true,
        },
        {
          name: "project-pnl",
          title: "Project P&L",
          description: "Revenue vs cost per project; PM sees assigned only.",
          category: "PROJECT_IPC",
          viewerRoute: "/reports/project-ipc",
          requiredPermission: "reports",
          parameters: [],
          projectScoped: true,
          supportsDateRange: true,
        },
        {
          name: "ipc-billing",
          title: "IPC report",
          description: "Per-IPC certified / billed / received / outstanding + ageing.",
          category: "PROJECT_IPC",
          viewerRoute: "/reports/project-ipc",
          requiredPermission: "reports",
          parameters: [],
          projectScoped: true,
          supportsDateRange: true,
        },
        {
          name: "outstanding",
          title: "Outstanding",
          description: "Per-IPC outstanding grouped by project, as-of a date.",
          category: "PROJECT_IPC",
          viewerRoute: "/reports/project-ipc",
          requiredPermission: "reports",
          parameters: [],
          projectScoped: true,
          supportsAsOf: true,
        },
        {
          name: "material-consumption-vs-budget",
          title: "Material consumption vs budget",
          description: "Consumed material cost vs CC budget per cost centre.",
          category: "PROJECT_IPC",
          viewerRoute: "/reports/project-ipc",
          requiredPermission: "reports",
          parameters: [],
          projectScoped: true,
          supportsDateRange: true,
        },
        {
          name: "labour-cost",
          title: "Labour cost",
          description: "Labour EXPENSE grouped by cost centre.",
          category: "PROJECT_IPC",
          viewerRoute: "/reports/project-ipc",
          requiredPermission: "reports",
          parameters: [],
          projectScoped: true,
          supportsDateRange: true,
        },
        {
          name: "stock-valuation",
          title: "Stock valuation",
          description: "Qty on hand, total value + weighted-avg rate per godown/item, as-of a date.",
          category: "INVENTORY",
          viewerRoute: "/reports/inventory",
          requiredPermission: "reports",
          parameters: [],
          supportsAsOf: true,
        },
        {
          name: "low-stock",
          title: "Low-stock / re-order",
          description: "Items at or below their re-order level.",
          category: "INVENTORY",
          viewerRoute: "/reports/inventory",
          requiredPermission: "reports",
          parameters: [],
          supportsAsOf: true,
        },
        {
          name: "stock-transfer-summary",
          title: "Stock transfer summary",
          description: "Posted transfers/issues over a period, with from → to godown.",
          category: "INVENTORY",
          viewerRoute: "/reports/inventory",
          requiredPermission: "reports",
          parameters: [],
          supportsDateRange: true,
        },
        {
          name: "requisition-vs-issue",
          title: "Requisition vs issue",
          description: "Requested / issued / variance per requisition line.",
          category: "REQUISITION_COST_CONTROL",
          viewerRoute: "/reports/requisition-cost-control",
          requiredPermission: "reports",
          parameters: [],
          projectScoped: true,
          supportsDateRange: true,
        },
        {
          name: "cost-centre-variance",
          title: "Cost-centre variance",
          description: "Budgeted vs actual per cost centre + status.",
          category: "REQUISITION_COST_CONTROL",
          viewerRoute: "/reports/requisition-cost-control",
          requiredPermission: "reports",
          parameters: [],
          projectScoped: true,
          supportsDateRange: true,
        },
        {
          name: "attendance-summary",
          title: "Attendance summary",
          description: "Monthly present / leave / absent + head count per project.",
          category: "HR",
          viewerRoute: "/reports/hr",
          requiredPermission: "reports",
          parameters: [],
        },
        {
          name: "salary-register",
          title: "Salary register",
          description: "Salary sheet lines with earnings + deductions per employee.",
          category: "HR",
          viewerRoute: "/reports/hr",
          requiredPermission: "reports",
          parameters: [],
        },
        {
          name: "employee-payment-history",
          title: "Employee payment history",
          description: "Per-employee salary / payable settlements over a date range.",
          category: "HR",
          viewerRoute: "/reports/hr",
          requiredPermission: "reports",
          parameters: [],
          supportsDateRange: true,
        },
      ]),
    };
  }
  if (req.path.startsWith("/reports/trial-balance") && req.method === "GET") {
    // Any query string is accepted; the mock returns a canonical, ties-out dataset.
    const baseRows = [
      { accountId: "1010", accountCode: "1010", accountName: "Cash on hand", debit: "500000.0000", credit: "0.0000" },
      { accountId: "1201", accountCode: "1201", accountName: "HSBC Current 001", debit: "8500000.0000", credit: "0.0000" },
      { accountId: "1200", accountCode: "1200", accountName: "Accounts Receivable", debit: "2500000.0000", credit: "0.0000" },
      { accountId: "2100", accountCode: "2100", accountName: "Accounts payable", debit: "0.0000", credit: "800000.0000" },
      { accountId: "3100", accountCode: "3100", accountName: "Opening balance equity", debit: "0.0000", credit: "10800000.0000" },
      { accountId: "gone-42", accountCode: "9999", accountName: null, debit: "100000.0000", credit: "100000.0000" },
    ];
    const rows = baseRows.map((r) => ({
      ...r,
      net: (Number(r.debit) - Number(r.credit)).toFixed(4),
    }));
    const totals = rows.reduce(
      (acc, r) => ({
        debit: (Number(acc.debit) + Number(r.debit)).toFixed(4),
        credit: (Number(acc.credit) + Number(r.credit)).toFixed(4),
      }),
      { debit: "0.0000", credit: "0.0000" },
    );
    return {
      status: 200,
      body: success({
        reportName: "trial-balance",
        parameters: {},
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
          totals,
        },
      }),
    };
  }
  // FE-56 fe-trial-balance-ledgers — account ledger
  if (req.path.startsWith("/reports/account-ledger") && req.method === "GET") {
    const [, rawQ = ""] = req.path.split("?");
    const qs = new URLSearchParams(rawQ);
    const accountId = qs.get("accountId");
    const page = Math.max(1, Number(qs.get("page") ?? "1"));
    const pageSize = Math.max(1, Number(qs.get("pageSize") ?? "25"));
    if (!accountId) {
      return {
        status: 400,
        body: envelope("VALIDATION_ERROR", "accountId is required"),
      };
    }
    const allRows = [
      { entryId: "je-1001", journalEntryId: "je-1001", entryNo: "JV/2526/0001", voucherDate: "2026-04-02", voucherType: "Journal", accountId, accountCode: "1200", accountName: "Accounts Receivable", partyId: "party-1", partyName: "National Housing Authority", debit: "250000.0000", credit: "0.0000", runningBalance: "1250000.0000" },
      { entryId: "je-1002", journalEntryId: "je-1002", entryNo: "RV/2526/0007", voucherDate: "2026-04-15", voucherType: "Receipt", accountId, accountCode: "1200", accountName: "Accounts Receivable", partyId: "party-1", partyName: "National Housing Authority", debit: "0.0000", credit: "150000.0000", runningBalance: "1100000.0000" },
      { entryId: "je-1003", journalEntryId: "je-1003", entryNo: "PV/2526/0011", voucherDate: "2026-05-01", voucherType: "Payment", accountId, accountCode: "1200", accountName: "Accounts Receivable", partyId: "party-2", partyName: "M/s Rahman Traders", debit: "80000.0000", credit: "0.0000", runningBalance: "1180000.0000", isReversal: true },
      { entryId: "je-1004", entryNo: "JV/2526/0021", voucherDate: "2026-05-20", voucherType: "Journal", accountId, accountCode: "1200", accountName: null, debit: "45000.0000", credit: "0.0000", runningBalance: "1225000.0000" },
    ];
    const rows = allRows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    return {
      status: 200,
      body: success({
        reportName: "account-ledger",
        parameters: {},
        rows,
        meta: {
          page,
          pageSize,
          total: allRows.length,
          generatedAt: new Date().toISOString(),
          openingBalance: "1000000.0000",
          openingAsOf: "2026-04-01",
          dateFrom: qs.get("dateFrom") ?? "2026-04-01",
          dateTo: qs.get("dateTo") ?? "2026-06-30",
        },
      }),
    };
  }
  // FE-56 — daybook
  if (req.path.startsWith("/reports/daybook") && req.method === "GET") {
    const rows = [
      { entryId: "je-1001", journalEntryId: "je-1001", entryNo: "JV/2526/0001", voucherDate: "2026-04-02", voucherType: "Journal", accountId: "1200", accountCode: "1200", accountName: "Accounts Receivable", debit: "250000.0000", credit: "0.0000", runningBalance: "0.0000" },
      { entryId: "je-1002", journalEntryId: "je-1002", entryNo: "RV/2526/0007", voucherDate: "2026-04-15", voucherType: "Receipt", accountId: "1101", accountCode: "1101", accountName: "HSBC Current 001", debit: "150000.0000", credit: "0.0000", runningBalance: "0.0000" },
      { entryId: "je-1003", journalEntryId: "je-1003", entryNo: "PV/2526/0011", voucherDate: "2026-05-01", voucherType: "Payment", accountId: "2100", accountCode: "2100", accountName: "Accounts payable", debit: "0.0000", credit: "80000.0000", runningBalance: "0.0000" },
    ];
    return {
      status: 200,
      body: success({
        reportName: "daybook",
        parameters: {},
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
        },
      }),
    };
  }
  // FE-56 — cash & bank book
  if (req.path.startsWith("/reports/cash-bank-book") && req.method === "GET") {
    const [, rawQ = ""] = req.path.split("?");
    const qs = new URLSearchParams(rawQ);
    const rows = [
      { entryId: "je-2001", journalEntryId: "je-2001", entryNo: "RV/2526/0007", voucherDate: "2026-04-15", voucherType: "Receipt", accountId: "1101", accountCode: "1101", accountName: "HSBC Current 001", partyId: "party-1", partyName: "National Housing Authority", debit: "150000.0000", credit: "0.0000", runningBalance: "8650000.0000" },
      { entryId: "je-2002", journalEntryId: "je-2002", entryNo: "PV/2526/0011", voucherDate: "2026-05-01", voucherType: "Payment", accountId: "1101", accountCode: "1101", accountName: "HSBC Current 001", partyId: "party-2", partyName: "M/s Rahman Traders", debit: "0.0000", credit: "80000.0000", runningBalance: "8570000.0000" },
    ];
    return {
      status: 200,
      body: success({
        reportName: "cash-bank-book",
        parameters: {},
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
          openingBalance: "8500000.0000",
          openingAsOf: "2026-04-01",
          dateFrom: qs.get("dateFrom") ?? "2026-04-01",
          dateTo: qs.get("dateTo") ?? "2026-06-30",
        },
      }),
    };
  }
  // FE-55 fe-financial-statements — P&L
  if (req.path.startsWith("/reports/profit-and-loss") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    const projectId = qs.get("projectId");
    const groupBy = qs.get("groupBy") ?? "account";
    // Two dataset shapes so the tab exercises both a profit (consolidated) and
    // a loss (single project) surface.
    const rows = projectId
      ? [
          { accountId: "4000", accountCode: "4000", accountName: "Contract revenue", section: "INCOME", amount: "2500000.0000", projectId, projectName: "Bridge-04" },
          { accountId: "5100", accountCode: "5100", accountName: "Materials", section: "EXPENSE", amount: "2200000.0000", projectId, projectName: "Bridge-04", ...(groupBy.includes("cost_centre") ? { costCentreId: "cc-mat", costCentreName: "Materials CC" } : {}) },
          { accountId: "5200", accountCode: "5200", accountName: "Labour", section: "EXPENSE", amount: "600000.0000", projectId, projectName: "Bridge-04", ...(groupBy.includes("cost_centre") ? { costCentreId: "cc-lab", costCentreName: "Labour CC" } : {}) },
          { accountId: "5300", accountCode: "5300", accountName: null, section: "EXPENSE", amount: "100000.0000", projectId, projectName: "Bridge-04" },
        ]
      : [
          { accountId: "4000", accountCode: "4000", accountName: "Contract revenue", section: "INCOME", amount: "18500000.0000" },
          { accountId: "4200", accountCode: "4200", accountName: "Other income", section: "INCOME", amount: "150000.0000" },
          { accountId: "5100", accountCode: "5100", accountName: "Materials", section: "EXPENSE", amount: "9200000.0000" },
          { accountId: "5200", accountCode: "5200", accountName: "Labour", section: "EXPENSE", amount: "3400000.0000" },
          { accountId: "5300", accountCode: "5300", accountName: "Fuel & operating", section: "EXPENSE", amount: "760000.0000" },
          { accountId: "5400", accountCode: "5400", accountName: "কর্মচারী বেতন", section: "EXPENSE", amount: "1900000.0000", isActive: false },
        ];
    const revenue = rows.filter((r) => r.section === "INCOME").reduce((a, r) => a + Number(r.amount), 0);
    const cost = rows.filter((r) => r.section === "EXPENSE").reduce((a, r) => a + Number(r.amount), 0);
    return {
      status: 200,
      body: success({
        reportName: "profit-and-loss",
        parameters: {},
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: {
            revenue: revenue.toFixed(4),
            cost: cost.toFixed(4),
            profit: (revenue - cost).toFixed(4),
          },
        },
      }),
    };
  }
  // FE-55 fe-financial-statements — Balance sheet
  if (req.path.startsWith("/reports/balance-sheet") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    const projectId = qs.get("projectId");
    const rows = projectId
      ? [
          { accountId: "1200", accountCode: "1200", accountName: "Retention receivable — Bridge-04", groupKind: "ASSET", groupLabel: "Current assets", amount: "620000.0000" },
          { accountId: "1201", accountCode: "1201", accountName: "Advance from customer — Bridge-04", groupKind: "LIABILITY", groupLabel: "Current liabilities", amount: "1200000.0000" },
        ]
      : [
          { accountId: "1010", accountCode: "1010", accountName: "Cash on hand", groupKind: "ASSET", groupLabel: "Current assets", amount: "500000.0000" },
          { accountId: "1101", accountCode: "1101", accountName: "HSBC Current 001", groupKind: "ASSET", groupLabel: "Current assets", amount: "8500000.0000" },
          { accountId: "1200", accountCode: "1200", accountName: "Accounts Receivable", groupKind: "ASSET", groupLabel: "Current assets", amount: "12400000.0000" },
          { accountId: "1500", accountCode: "1500", accountName: "Plant & equipment", groupKind: "ASSET", groupLabel: "Non-current assets", amount: "9600000.0000" },
          { accountId: "2100", accountCode: "2100", accountName: "Accounts payable", groupKind: "LIABILITY", groupLabel: "Current liabilities", amount: "3400000.0000" },
          { accountId: "2200", accountCode: "2200", accountName: "Retention payable", groupKind: "LIABILITY", groupLabel: "Current liabilities", amount: "600000.0000" },
          { accountId: "3100", accountCode: "3100", accountName: "Opening equity", groupKind: "EQUITY", groupLabel: "Equity", amount: "22500000.0000" },
          { accountId: "3200", accountCode: "3200", accountName: "Retained earnings", groupKind: "EQUITY", groupLabel: "Equity", amount: "4500000.0000" },
        ];
    const totals = rows.reduce(
      (acc, r) => {
        const n = Number(r.amount);
        if (r.groupKind === "ASSET") acc.assets += n;
        else if (r.groupKind === "LIABILITY") acc.liabilities += n;
        else acc.equity += n;
        return acc;
      },
      { assets: 0, liabilities: 0, equity: 0 },
    );
    return {
      status: 200,
      body: success({
        reportName: "balance-sheet",
        parameters: {},
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: {
            assets: totals.assets.toFixed(4),
            liabilities: totals.liabilities.toFixed(4),
            equity: totals.equity.toFixed(4),
          },
        },
      }),
    };
  }
  // FE-57 fe-project-ipc-reports — Project P&L
  if (req.path.startsWith("/reports/project-pnl") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    const projectId = qs.get("projectId");
    if (!projectId) {
      return {
        status: 400,
        body: envelope("VALIDATION_ERROR", "projectId is required"),
      };
    }
    if (projectId === "proj-forbidden") {
      return {
        status: 403,
        body: envelope("FORBIDDEN", "You don't have access to this project."),
      };
    }
    const rows = [
      { costCentreId: "cc-mat", costCentreCode: "CC-01", costCentreName: "Materials — Cement & Steel", revenue: "480000000.0000", cost: "618000000.0000", profit: "-138000000.0000" },
      { costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", revenue: "320000000.0000", cost: "176000000.0000", profit: "144000000.0000" },
      { costCentreId: "cc-sub", costCentreCode: "CC-04", costCentreName: "Subcontractor Works", revenue: "960000000.0000", cost: "772000000.0000", profit: "188000000.0000" },
      { costCentreId: "cc-equip", costCentreCode: "CC-06", costCentreName: "Equipment Rental & Hire", revenue: "240000000.0000", cost: "185000000.0000", profit: "55000000.0000" },
      { costCentreId: "gone-cc", costCentreCode: "CC-99", costCentreName: null, revenue: "10000000.0000", cost: "7500000.0000", profit: "2500000.0000" },
      // The project-total row (costCentreId=null) — FE renders as a distinct row.
      { costCentreId: null, costCentreCode: null, costCentreName: "Project total", revenue: "2010000000.0000", cost: "1758500000.0000", profit: "251500000.0000" },
    ];
    return {
      status: 200,
      body: success({
        reportName: "project-pnl",
        parameters: { projectId },
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: { revenue: "2010000000.0000", cost: "1758500000.0000", profit: "251500000.0000" },
        },
      }),
    };
  }
  // FE-57 — IPC billing report (per-IPC billing + ageing badge + cumulative)
  if (req.path.startsWith("/reports/ipc-billing") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    const projectId = qs.get("projectId");
    if (projectId === "proj-forbidden") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    if (projectId === "proj-empty") {
      return {
        status: 200,
        body: success({
          reportName: "ipc-billing",
          parameters: { projectId },
          rows: [],
          meta: {
            page: 1,
            pageSize: 25,
            total: 0,
            generatedAt: new Date().toISOString(),
            totals: { certified: "0.0000", billed: "0.0000", received: "0.0000", outstanding: "0.0000", retentionHeld: "0.0000" },
          },
        }),
      };
    }
    const rows = [
      { ipcId: "ipc-1", ipcNo: "IPC-2026-000007", ipcDate: "2026-04-05", dueDate: "2026-05-05", status: "OPEN", certifiedAmount: "12000000.0000", billedAmount: "12000000.0000", receivedAmount: "6000000.0000", outstandingAmount: "6000000.0000", retentionHeldAmount: "1200000.0000", ageingBucket: "CURRENT" },
      { ipcId: "ipc-2", ipcNo: "IPC-2026-000006", ipcDate: "2026-03-20", dueDate: "2026-04-20", status: "OPEN", certifiedAmount: "8500000.0000", billedAmount: "8500000.0000", receivedAmount: "4000000.0000", outstandingAmount: "4500000.0000", retentionHeldAmount: "850000.0000", ageingBucket: "D31_60" },
      { ipcId: "ipc-3", ipcNo: "IPC-2026-000005", ipcDate: "2026-02-14", dueDate: "2026-03-14", status: "OPEN", certifiedAmount: "10500000.0000", billedAmount: "10500000.0000", receivedAmount: "3500000.0000", outstandingAmount: "7000000.0000", retentionHeldAmount: "1050000.0000", ageingBucket: "D61_90" },
      { ipcId: "ipc-4", ipcNo: "IPC-2026-000004", ipcDate: "2025-12-30", dueDate: "2026-01-30", status: "OPEN", certifiedAmount: "6000000.0000", billedAmount: "6000000.0000", receivedAmount: "0.0000", outstandingAmount: "6000000.0000", retentionHeldAmount: "600000.0000", ageingBucket: "D90_PLUS" },
      // Row without a projectId/name resolved (partial state)
      { ipcId: "ipc-5", ipcNo: "IPC-2026-000003", ipcDate: "2025-11-10", dueDate: "2025-12-10", status: "OPEN", projectId: "gone", projectName: null, certifiedAmount: "4500000.0000", billedAmount: "4500000.0000", receivedAmount: "500000.0000", outstandingAmount: "4000000.0000", retentionHeldAmount: "450000.0000", ageingBucket: "D90_PLUS" },
    ];
    return {
      status: 200,
      body: success({
        reportName: "ipc-billing",
        parameters: { projectId },
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: {
            certified: "41500000.0000",
            billed: "41500000.0000",
            received: "14000000.0000",
            outstanding: "27500000.0000",
            retentionHeld: "4150000.0000",
          },
        },
      }),
    };
  }
  // FE-57 — Outstanding (as-of; grouped by project)
  if (req.path.startsWith("/reports/outstanding") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    if (qs.get("projectId") === "proj-forbidden") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    const rows = [
      { ipcId: "ipc-1", ipcNo: "IPC-2026-000007", ipcDate: "2026-04-05", dueDate: "2026-05-05", projectId: "proj-a", projectName: "Bridge-04 — Buriganga", certifiedAmount: "12000000.0000", billedAmount: "12000000.0000", receivedAmount: "6000000.0000", outstandingAmount: "6000000.0000", retentionHeldAmount: "1200000.0000", ageingBucket: "CURRENT" },
      { ipcId: "ipc-2", ipcNo: "IPC-2026-000006", ipcDate: "2026-03-20", dueDate: "2026-04-20", projectId: "proj-a", projectName: "Bridge-04 — Buriganga", certifiedAmount: "8500000.0000", billedAmount: "8500000.0000", receivedAmount: "4000000.0000", outstandingAmount: "4500000.0000", retentionHeldAmount: "850000.0000", ageingBucket: "D31_60" },
      { ipcId: "ipc-6", ipcNo: "IPC-2026-000011", ipcDate: "2026-04-10", dueDate: "2026-05-10", projectId: "proj-b", projectName: "Tower-A — Gulshan", certifiedAmount: "15000000.0000", billedAmount: "15000000.0000", receivedAmount: "10000000.0000", outstandingAmount: "5000000.0000", retentionHeldAmount: "1500000.0000", ageingBucket: "CURRENT" },
    ];
    return {
      status: 200,
      body: success({
        reportName: "outstanding",
        parameters: {},
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: {
            outstanding: "15500000.0000",
            certified: "35500000.0000",
            billed: "35500000.0000",
            received: "20000000.0000",
            retentionHeld: "3550000.0000",
          },
          projectTotals: {
            "proj-a": { outstanding: "10500000.0000", certified: "20500000.0000", billed: "20500000.0000", received: "10000000.0000", retentionHeld: "2050000.0000" },
            "proj-b": { outstanding: "5000000.0000", certified: "15000000.0000", billed: "15000000.0000", received: "10000000.0000", retentionHeld: "1500000.0000" },
          },
        },
      }),
    };
  }
  // FE-57 — Material consumption vs budget
  if (req.path.startsWith("/reports/material-consumption-vs-budget") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    if (qs.get("projectId") === "proj-forbidden") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    const statusFilter = qs.get("status");
    const allRows = [
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-mat", costCentreCode: "CC-01", costCentreName: "Materials — Cement & Steel", budgetedAmount: "1200000000.0000", actualAmount: "1296000000.0000", variance: "-96000000.0000", utilisationPct: "108.0000", status: "OVER" },
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", budgetedAmount: "450000000.0000", actualAmount: "418500000.0000", variance: "31500000.0000", utilisationPct: "93.0000", status: "APPROACHING" },
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-sub", costCentreCode: "CC-04", costCentreName: "Subcontractor Works", budgetedAmount: "900000000.0000", actualAmount: "612000000.0000", variance: "288000000.0000", utilisationPct: "68.0000", status: "OK" },
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-power", costCentreCode: "CC-11", costCentreName: "Utilities & Site Power", budgetedAmount: null, actualAmount: "12000000.0000", variance: null, utilisationPct: null, status: "UNBUDGETED" },
    ];
    const rows = statusFilter
      ? allRows.filter((r) => statusFilter.split(",").includes(r.status))
      : allRows;
    return {
      status: 200,
      body: success({
        reportName: "material-consumption-vs-budget",
        parameters: {},
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: {
            budgeted: "2550000000.0000",
            actual: "2338500000.0000",
            variance: "211500000.0000",
          },
        },
      }),
    };
  }
  // FE-57 — Labour cost
  if (req.path.startsWith("/reports/labour-cost") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    if (qs.get("projectId") === "proj-forbidden") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    const rows = [
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", labourCost: "418500000.0000" },
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-transport", costCentreCode: "CC-08", costCentreName: "Transport & Logistics", labourCost: "18000000.0000" },
      { projectId: "proj-b", projectName: "Tower-A — Gulshan", costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", labourCost: "220000000.0000" },
    ];
    return {
      status: 200,
      body: success({
        reportName: "labour-cost",
        parameters: {},
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: { labourCost: "656500000.0000" },
        },
      }),
    };
  }
  // FE-58 fe-inventory-reports — Stock valuation (as-of)
  if (req.path.startsWith("/reports/stock-valuation") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    const asOf = qs.get("asOf") ?? "2026-06-30";
    if (qs.get("projectId") === "proj-forbidden") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    if (qs.get("godownId") === "gd-empty") {
      return {
        status: 200,
        body: success({
          reportName: "stock-valuation",
          parameters: { asOf },
          rows: [],
          meta: {
            page: 1,
            pageSize: 25,
            total: 0,
            generatedAt: new Date().toISOString(),
            totals: { totalValue: "0.0000" },
          },
        }),
      };
    }
    const rows = [
      { godownId: "gd-a", godownCode: "G-Site-A", godownName: "Site A store", itemId: "it-1", itemCode: "IT-101", itemName: "Cement — 50 kg bag", quantityOnHand: "1200.000", totalValue: "780000.0000", weightedAverageRate: "650.0000", asOf },
      { godownId: "gd-a", godownCode: "G-Site-A", godownName: "Site A store", itemId: "it-2", itemCode: "IT-102", itemName: "MS Rod 12mm", quantityOnHand: "8500.000", totalValue: "6970000.0000", weightedAverageRate: "820.0000", asOf },
      { godownId: "gd-a", godownCode: "G-Site-A", godownName: "Site A store", itemId: "it-3", itemCode: "IT-103", itemName: "Sand — cft", quantityOnHand: "0.000", totalValue: "0.0000", weightedAverageRate: null, asOf },
      { godownId: "gd-b", godownCode: "G-Site-B", godownName: "Site B store", itemId: "it-1", itemCode: "IT-101", itemName: "Cement — 50 kg bag", quantityOnHand: "450.000", totalValue: "292500.0000", weightedAverageRate: "650.0000", asOf },
      { godownId: "gd-b", godownCode: "G-Site-B", godownName: "Site B store", itemId: "gone", itemCode: "IT-999", itemName: null, quantityOnHand: "100.000", totalValue: "50000.0000", weightedAverageRate: "500.0000", asOf, itemInactive: true },
    ];
    return {
      status: 200,
      body: success({
        reportName: "stock-valuation",
        parameters: { asOf },
        rows,
        meta: {
          page: 1,
          pageSize: rows.length,
          total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: { totalValue: "8092500.0000" },
        },
      }),
    };
  }
  // FE-58 — Low-stock / re-order
  if (req.path.startsWith("/reports/low-stock") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    if (qs.get("projectId") === "proj-forbidden") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    const reorderLevel = qs.get("reorderLevel") ?? "500";
    const asOf = qs.get("asOf") ?? "2026-06-30";
    // Filter to rows where qty <= reorderLevel — mock fixture.
    const all = [
      { godownId: "gd-a", godownCode: "G-Site-A", godownName: "Site A store", itemId: "it-3", itemCode: "IT-103", itemName: "Sand — cft", quantityOnHand: "0.000", totalValue: "0.0000", weightedAverageRate: null, reorderLevel: reorderLevel, asOf },
      { godownId: "gd-b", godownCode: "G-Site-B", godownName: "Site B store", itemId: "it-1", itemCode: "IT-101", itemName: "Cement — 50 kg bag", quantityOnHand: "450.000", totalValue: "292500.0000", weightedAverageRate: "650.0000", reorderLevel: reorderLevel, asOf },
      { godownId: "gd-c", godownCode: "G-Central", godownName: "Central warehouse", itemId: "it-4", itemCode: "IT-104", itemName: "Nails — kg", quantityOnHand: "150.000", totalValue: "22500.0000", weightedAverageRate: "150.0000", reorderLevel: reorderLevel, asOf },
      { godownId: "gd-a", godownCode: "G-Site-A", godownName: "Site A store", itemId: "it-5", itemCode: "IT-105", itemName: "Paint — 20 L bucket", quantityOnHand: "80.000", totalValue: "560000.0000", weightedAverageRate: "7000.0000", reorderLevel: reorderLevel, asOf },
    ];
    return {
      status: 200,
      body: success({
        reportName: "low-stock",
        parameters: { asOf, reorderLevel },
        rows: all,
        meta: {
          page: 1,
          pageSize: all.length,
          total: all.length,
          generatedAt: new Date().toISOString(),
          totals: { totalValue: "875000.0000", breachedCount: all.length },
        },
      }),
    };
  }
  // FE-58 — Stock transfer summary (flow)
  if (req.path.startsWith("/reports/stock-transfer-summary") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    if (qs.get("projectId") === "proj-forbidden") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    if (qs.get("itemId") === "it-empty") {
      return {
        status: 200,
        body: success({
          reportName: "stock-transfer-summary",
          parameters: {},
          rows: [],
          meta: {
            page: 1, pageSize: 25, total: 0,
            generatedAt: new Date().toISOString(),
            totals: { totalValueMoved: "0.0000" },
          },
        }),
      };
    }
    const rows = [
      { stockJournalId: "sj-1", voucherNo: "SJ/2526/000001", voucherDate: "2026-04-05", fromGodownId: "gd-a", fromGodownName: "Site A store", toGodownId: "gd-b", toGodownName: "Site B store", itemId: "it-1", itemName: "Cement — 50 kg bag", quantity: "200.000", value: "130000.0000", mode: "TRANSFER", approverId: "u-1", approverName: "Store Manager" },
      { stockJournalId: "sj-2", voucherNo: "SJ/2526/000002", voucherDate: "2026-04-12", fromGodownId: "gd-b", fromGodownName: "Site B store", toGodownId: null, toGodownName: null, itemId: "it-2", itemName: "MS Rod 12mm", quantity: "500.000", value: "410000.0000", mode: "ISSUE", approverId: "u-2", approverName: "Project Manager" },
      { stockJournalId: "sj-3", voucherNo: "SJ/2526/000003", voucherDate: "2026-05-01", fromGodownId: "gd-c", fromGodownName: "Central warehouse", toGodownId: "gd-a", toGodownName: "Site A store", itemId: "gone", itemName: null, quantity: "100.000", value: "50000.0000", mode: "TRANSFER", approverId: "u-3", approverName: null },
    ];
    return {
      status: 200,
      body: success({
        reportName: "stock-transfer-summary",
        parameters: {},
        rows,
        meta: {
          page: 1, pageSize: rows.length, total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: { totalValueMoved: "590000.0000" },
        },
      }),
    };
  }
  // FE-59 fe-requisition-cost-control-reports — Requisition vs issue
  if (req.path.startsWith("/reports/requisition-vs-issue") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    if (qs.get("projectId") === "proj-forbidden") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    if (qs.get("requisitionId") === "req-empty") {
      return {
        status: 200,
        body: success({
          reportName: "requisition-vs-issue",
          parameters: {},
          rows: [],
          meta: {
            page: 1, pageSize: 25, total: 0,
            generatedAt: new Date().toISOString(),
            totals: { lineCount: 0, fullyIssued: 0, outstanding: 0 },
          },
        }),
      };
    }
    const rows = [
      { requisitionId: "req-1", requisitionNo: "RQ/2526/000001", projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-mat", costCentreCode: "CC-01", costCentreName: "Materials — Cement & Steel", itemId: "it-1", itemCode: "IT-101", itemName: "Cement — 50 kg bag", unit: "bag", requestedQty: "500.000", issuedQty: "500.000", varianceQty: "0.000" },
      { requisitionId: "req-1", requisitionNo: "RQ/2526/000001", projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-mat", costCentreCode: "CC-01", costCentreName: "Materials — Cement & Steel", itemId: "it-2", itemCode: "IT-102", itemName: "MS Rod 12mm", unit: "kg", requestedQty: "1000.000", issuedQty: "800.000", varianceQty: "200.000" },
      { requisitionId: "req-2", requisitionNo: "RQ/2526/000002", projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", itemId: "it-3", itemCode: "IT-103", itemName: "Sand — cft", unit: "cft", requestedQty: "200.000", issuedQty: "250.000", varianceQty: "-50.000" },
      { requisitionId: "req-3", requisitionNo: "RQ/2526/000003", projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "gone-cc", costCentreCode: "CC-99", costCentreName: null, itemId: "it-4", itemCode: "IT-104", itemName: "Nails — kg", unit: "kg", requestedQty: "100.000", issuedQty: "50.000", varianceQty: "50.000", costCentreInactive: true },
    ];
    return {
      status: 200,
      body: success({
        reportName: "requisition-vs-issue",
        parameters: {},
        rows,
        meta: {
          page: 1, pageSize: rows.length, total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: { lineCount: 4, fullyIssued: 1, outstanding: 3 },
        },
      }),
    };
  }
  // FE-59 — Cost-centre variance
  if (req.path.startsWith("/reports/cost-centre-variance") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    if (qs.get("projectId") === "proj-forbidden") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    const statusFilter = qs.get("status");
    const all = [
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-mat", costCentreCode: "CC-01", costCentreName: "Materials — Cement & Steel", budgetedAmount: "1200000000.0000", actualCost: "1296000000.0000", variance: "-96000000.0000", utilisationPct: "108.0000", status: "OVER" },
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", budgetedAmount: "450000000.0000", actualCost: "418500000.0000", variance: "31500000.0000", utilisationPct: "93.0000", status: "APPROACHING" },
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-sub", costCentreCode: "CC-04", costCentreName: "Subcontractor Works", budgetedAmount: "900000000.0000", actualCost: "612000000.0000", variance: "288000000.0000", utilisationPct: "68.0000", status: "OK" },
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-power", costCentreCode: "CC-11", costCentreName: "Utilities & Site Power", budgetedAmount: null, actualCost: "12000000.0000", variance: null, utilisationPct: null, status: "UNBUDGETED" },
    ];
    const rows = statusFilter ? all.filter((r) => statusFilter.split(",").includes(r.status)) : all;
    return {
      status: 200,
      body: success({
        reportName: "cost-centre-variance",
        parameters: {},
        rows,
        meta: {
          page: 1, pageSize: rows.length, total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: { budgeted: "2550000000.0000", actual: "2338500000.0000", variance: "223500000.0000" },
        },
      }),
    };
  }
  // FE-60 fe-hr-reports — Attendance summary
  if (req.path.startsWith("/reports/attendance-summary") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    const month = qs.get("month");
    if (!month) {
      return { status: 400, body: envelope("VALIDATION_ERROR", "month is required (YYYY-MM)") };
    }
    if (qs.get("employeeId") === "emp-empty") {
      return {
        status: 200,
        body: success({
          reportName: "attendance-summary",
          parameters: { month },
          rows: [],
          meta: { page: 1, pageSize: 25, total: 0, generatedAt: new Date().toISOString(), totals: { present: 0, paidLeave: 0, unpaidLeave: 0, absent: 0, headCount: 0 } },
        }),
      };
    }
    const rows = [
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", employeeId: "emp-1", employeeName: "Ashraf Uddin", partyId: null, partyName: null, costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", present: 22, paidLeave: 1, unpaidLeave: 0, absent: 3, headCount: 1, mode: "OFFICE" },
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", employeeId: "emp-2", employeeName: "Rahim Ali", partyId: null, partyName: null, costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", present: 24, paidLeave: 2, unpaidLeave: 0, absent: 0, headCount: 1, mode: "OFFICE", employeeInactive: true },
      { projectId: "proj-a", projectName: "Bridge-04 — Buriganga", employeeId: null, employeeName: null, partyId: "sub-1", partyName: "Star Subcontractors", costCentreId: "cc-sub", costCentreCode: "CC-04", costCentreName: "Subcontractor Works", present: 40, paidLeave: 0, unpaidLeave: 0, absent: 5, headCount: 8, mode: "SUBCONTRACTOR" },
      { projectId: "proj-b", projectName: "Tower-A — Gulshan", employeeId: null, employeeName: null, partyId: null, partyName: null, costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", present: 380, paidLeave: 0, unpaidLeave: 0, absent: 20, headCount: 15, mode: "DAILY_LABOUR" },
      // Partial: unresolved employee name
      { projectId: "proj-b", projectName: "Tower-A — Gulshan", employeeId: "emp-gone", employeeName: null, partyId: null, partyName: null, costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", present: 15, paidLeave: 0, unpaidLeave: 2, absent: 1, headCount: 1, mode: "OFFICE" },
    ];
    return {
      status: 200,
      body: success({
        reportName: "attendance-summary",
        parameters: { month },
        rows,
        meta: {
          page: 1, pageSize: rows.length, total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: { present: 481, paidLeave: 3, unpaidLeave: 2, absent: 29, headCount: 26 },
        },
      }),
    };
  }
  // FE-60 — Salary register
  if (req.path.startsWith("/reports/salary-register") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    const salaryRunId = qs.get("salaryRunId");
    const month = qs.get("month");
    if (!salaryRunId && !month) {
      return {
        status: 400,
        body: envelope("VALIDATION_ERROR", "Provide either salaryRunId, or financialYearId + month."),
      };
    }
    const rows = [
      { salaryRunId: salaryRunId ?? "run-1", journalEntryId: "je-sal-1", journalEntryNo: "JV/2526/0089", employeeId: "emp-1", employeeName: "Ashraf Uddin", projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", grossPay: "60000.0000", allowances: "5000.0000", tds: "6000.0000", pf: "3000.0000", advanceRecovery: "2000.0000", otherDeductions: "500.0000", netPay: "53500.0000" },
      { salaryRunId: salaryRunId ?? "run-1", journalEntryId: "je-sal-1", journalEntryNo: "JV/2526/0089", employeeId: "emp-2", employeeName: "Rahim Ali", projectId: "proj-a", projectName: "Bridge-04 — Buriganga", costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", grossPay: "45000.0000", allowances: "3000.0000", tds: "4500.0000", pf: "2250.0000", advanceRecovery: "0.0000", otherDeductions: "250.0000", netPay: "41000.0000" },
      { salaryRunId: salaryRunId ?? "run-1", journalEntryId: "je-sal-1", journalEntryNo: "JV/2526/0089", employeeId: "emp-3", employeeName: "Karim Sheikh", projectId: "proj-b", projectName: "Tower-A — Gulshan", costCentreId: "cc-lab", costCentreCode: "CC-02", costCentreName: "শ্রমিক মজুরি — Site Labour", grossPay: "70000.0000", allowances: "6000.0000", tds: "7000.0000", pf: "3500.0000", advanceRecovery: "0.0000", otherDeductions: "0.0000", netPay: "65500.0000" },
    ];
    return {
      status: 200,
      body: success({
        reportName: "salary-register",
        parameters: {},
        rows,
        meta: {
          page: 1, pageSize: rows.length, total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: { gross: "175000.0000", net: "160000.0000" },
        },
      }),
    };
  }
  // FE-60 — Employee payment history
  if (req.path.startsWith("/reports/employee-payment-history") && req.method === "GET") {
    const query = req.path.split("?")[1] ?? "";
    const qs = new URLSearchParams(query);
    const dateFrom = qs.get("dateFrom");
    const dateTo = qs.get("dateTo");
    if (!dateFrom || !dateTo) {
      return { status: 400, body: envelope("VALIDATION_ERROR", "dateFrom and dateTo are required.") };
    }
    const rows = [
      { paymentId: "pmt-1", paymentVoucherId: "pv-1", payableRef: "PV/2526/0121", employeeId: "emp-1", employeeName: "Ashraf Uddin", paymentDate: "2026-05-05", paidAmount: "53500.0000" },
      { paymentId: "pmt-2", paymentVoucherId: "pv-2", payableRef: "PV/2526/0122", employeeId: "emp-2", employeeName: "Rahim Ali", paymentDate: "2026-05-05", paidAmount: "41000.0000" },
      { paymentId: "pmt-3", paymentVoucherId: "pv-3", payableRef: "PV/2526/0124", employeeId: "emp-3", employeeName: "Karim Sheikh", paymentDate: "2026-06-05", paidAmount: "65500.0000" },
    ];
    return {
      status: 200,
      body: success({
        reportName: "employee-payment-history",
        parameters: {},
        rows,
        meta: {
          page: 1, pageSize: rows.length, total: rows.length,
          generatedAt: new Date().toISOString(),
          totals: { paidCount: rows.length, totalPaid: "160000.0000" },
        },
      }),
    };
  }
  // Every other /reports/<name> — return an empty well-formed result until the
  // viewer brief for that report lands.
  if (req.path.startsWith("/reports/") && req.method === "GET") {
    const name = req.path.slice("/reports/".length).split("?")[0]!;
    return {
      status: 200,
      body: success({
        reportName: name,
        parameters: {},
        rows: [],
        meta: {
          page: 1,
          pageSize: 25,
          total: 0,
          generatedAt: new Date().toISOString(),
          totals: {},
        },
      }),
    };
  }

  // ── FE-61 fe-dashboard — /api/dashboard (full tile set) + /tiles/{key} ──
  const [dashPathRaw, dashRawQuery = ""] = req.path.split("?");
  const dashPath = dashPathRaw ?? "";
  const dashQs = new URLSearchParams(dashRawQuery);
  const dashProjectId = dashQs.get("projectId");
  if (dashProjectId === "proj-forbidden") {
    if (dashPath === "/dashboard" && req.method === "GET") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
  }
  function buildTile(key: string, role: string, projectId: string | null): Record<string, unknown> | null {
    const gen = new Date().toISOString();
    const fyId = dashQs.get("financialYearId") ?? "fy-1";
    const scopedProject = projectId ?? "proj-a";
    switch (key) {
      case "project-cash-flow":
        return {
          key,
          title: "Project Cash Flow",
          kpi: { netInflow: "1250000.0000", cashBalance: "320000.0000", bankBalance: "4100000.0000" },
          status: null,
          drillTo: {
            report: "cash-bank-book",
            params: { financialYearId: fyId, projectId: scopedProject, dateFrom: "2026-06-01", dateTo: "2026-06-30" },
          },
          generatedAt: gen,
        };
      case "pending-ipcs":
        return {
          key,
          title: "Pending IPCs",
          kpi: { count: 4, totalOutstanding: "1875000.0000" },
          status: null,
          drillTo: { report: "ipc-billing", params: { financialYearId: fyId, projectId: scopedProject } },
          generatedAt: gen,
        };
      case "retention-held":
        return {
          key,
          title: "Retention Held",
          kpi: { totalRetentionHeld: "412500.0000" },
          status: null,
          drillTo: {
            report: "ipc-billing",
            params: { financialYearId: fyId, projectId: scopedProject, view: "retention" },
          },
          generatedAt: gen,
        };
      case "low-stock":
        return {
          key,
          title: "Low-stock Alerts",
          kpi: { count: 3 },
          status: "BREACH",
          drillTo: { report: "low-stock", params: { financialYearId: fyId } },
          generatedAt: gen,
        };
      case "over-budget":
        return {
          key,
          title: "Over-budget Alerts",
          kpi: { overCount: 2, approachingCount: 5 },
          status: "OVER",
          drillTo: {
            report: "cost-centre-variance",
            params: { financialYearId: fyId, projectId: scopedProject, status: "OVER,APPROACHING" },
          },
          generatedAt: gen,
        };
      case "attendance-summary":
        return {
          key,
          title: "Attendance Summary",
          kpi: { period: "2026-06", presentDays: 1840, headCountTotal: "560.0000" },
          status: null,
          drillTo: { report: "attendance-summary", params: { month: "2026-06", projectId: scopedProject } },
          generatedAt: gen,
        };
      case "top-receivables-payables":
        return {
          key,
          title: "Top Receivables / Payables",
          kpi: {
            topReceivables: [
              { partyId: "pa-8", partyName: "National Housing Authority", outstanding: "920000.0000" },
              { partyId: "pa-4", partyName: "Tower-A Developments Ltd.", outstanding: "530000.0000" },
              { partyId: "pa-7", partyName: "করিম এন্টারপ্রাইজ", outstanding: "180000.0000" },
            ],
            topPayables: [
              { partyId: "pa-11", partyName: "Padma Cement Ltd", outstanding: "640000.0000" },
              { partyId: "pa-12", partyName: "Star Steel Traders", outstanding: "310000.0000" },
            ],
          },
          status: null,
          drillTo: { report: "account-ledger", params: { financialYearId: fyId } },
          generatedAt: gen,
        };
      default:
        return null;
    }
  }
  function tilesForRole(role: string): string[] {
    // Simplified role→tile map (server-authoritative — the FE renders whatever is returned).
    switch (role) {
      case "STORE_KEEPER":
        return ["low-stock"];
      case "HR_MANAGER":
        return ["attendance-summary"];
      case "PROJECT_MANAGER":
      case "SITE_ENGINEER":
        return ["project-cash-flow", "pending-ipcs", "low-stock", "over-budget", "attendance-summary"];
      case "ACCOUNTS_TEAM":
      case "ACCOUNTS_MANAGER":
      case "ADMIN":
      default:
        return [
          "project-cash-flow",
          "pending-ipcs",
          "retention-held",
          "low-stock",
          "over-budget",
          "attendance-summary",
          "top-receivables-payables",
        ];
    }
  }
  if (dashPath === "/dashboard" && req.method === "GET") {
    const keys = tilesForRole(user.role);
    const tiles = keys.map((k) => buildTile(k, user.role, dashProjectId)).filter(Boolean);
    return { status: 200, body: success(tiles) };
  }
  const tileMatch = /^\/dashboard\/tiles\/([^/?]+)/.exec(dashPath);
  if (tileMatch && req.method === "GET") {
    const key = tileMatch[1]!;
    const allowed = tilesForRole(user.role);
    if (!allowed.includes(key)) {
      const tile = buildTile(key, user.role, dashProjectId);
      if (!tile) return { status: 404, body: envelope("NOT_FOUND", "Unknown tile key") };
      return { status: 403, body: envelope("FORBIDDEN", "You don't have permission to view this tile.") };
    }
    if (dashProjectId === "proj-forbidden") {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    const tile = buildTile(key, user.role, dashProjectId);
    if (!tile) return { status: 404, body: envelope("NOT_FOUND", "Unknown tile key") };
    return { status: 200, body: success(tile) };
  }

  // ── FE-53 fe-notifications — /notifications feed + unread-count + mark-read ──
  const notifStore = getMockNotifStore(access.userKey);
  const [notifPath, notifRawQuery = ""] = req.path.split("?");
  const notifParams = new URLSearchParams(notifRawQuery);
  if (notifPath === "/notifications" && req.method === "GET") {
    const isReadRaw = notifParams.get("isRead");
    const isRead = isReadRaw === "true" ? true : isReadRaw === "false" ? false : null;
    const typeF = notifParams.get("type");
    const since = notifParams.get("since");
    const page = Math.max(1, Number(notifParams.get("page") ?? "1"));
    const pageSize = Math.max(1, Math.min(100, Number(notifParams.get("pageSize") ?? "25")));
    const filtered = notifStore.rows.filter((n) => {
      if (isRead === true && n.readAt === null) return false;
      if (isRead === false && n.readAt !== null) return false;
      if (typeF && n.type !== typeF) return false;
      if (since && n.createdAt <= since) return false;
      return true;
    });
    const start = (page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    return {
      status: 200,
      body: {
        data: slice,
        meta: { requestId: `mock-ntf-${jtiCounterSeed}`, page, pageSize, total: filtered.length },
      },
    };
  }
  if (req.path === "/notifications/unread-count" && req.method === "GET") {
    const unread = notifStore.rows.filter((n) => n.readAt === null).length;
    return { status: 200, body: success({ unreadCount: unread }) };
  }
  const singleMatch = /^\/notifications\/([^/]+)(\/read)?$/.exec(notifPath ?? "");
  if (singleMatch && singleMatch[1] !== "unread-count" && singleMatch[1] !== "read-all") {
    const id = singleMatch[1]!;
    const row = notifStore.rows.find((n) => n.id === id);
    if (req.method === "GET") {
      if (!row) return { status: 404, body: envelope("NOT_FOUND", "Notification not found") };
      return { status: 200, body: success(row) };
    }
    if (req.method === "POST" && singleMatch[2] === "/read") {
      if (!row) return { status: 404, body: envelope("NOT_FOUND", "Notification not found") };
      if (row.readAt === null) row.readAt = new Date().toISOString();
      return { status: 200, body: success(row) };
    }
  }
  if (req.path === "/notifications/read-all" && req.method === "POST") {
    let updated = 0;
    const now = new Date().toISOString();
    for (const row of notifStore.rows) {
      if (row.readAt === null) {
        row.readAt = now;
        updated += 1;
      }
    }
    return { status: 200, body: success({ updated }) };
  }

  // ── FE-52 fe-account-profile — /profile self-service surface ──
  // Reads the caller's own profile (self-scoped from the token; no :id) and
  // permits name/phone-only edits. Avatar upload (POST /profile/image) is
  // handled by the dedicated multipart route at app/api/profile/image/route.ts;
  // DELETE /profile/image is idempotent here.
  const profile = mockGetProfile(access.userKey);
  if (req.path === "/profile" && req.method === "GET") {
    return { status: 200, body: success(profileToView(profile)) };
  }
  if (req.path === "/profile" && req.method === "PATCH") {
    const patch = body as { name?: unknown; phone?: unknown; version?: unknown };
    // Privilege-escalation guard (FR-AUD-033): reject any authorization-bearing key.
    const forbiddenKeys = ["role", "email", "isActive", "financialYearId", "assignedProjects", "avatarUrl", "permissions", "approvalLimit"] as const;
    for (const key of forbiddenKeys) {
      if (key in (patch as Record<string, unknown>)) {
        return { status: 400, body: envelope("VALIDATION_ERROR", `Field "${key}" cannot be changed here.`) };
      }
    }
    const versionOk = typeof patch.version === "number" && patch.version === profile.version;
    if (typeof patch.version !== "number") {
      return { status: 400, body: envelope("VALIDATION_ERROR", "version is required") };
    }
    if (!versionOk) {
      return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "Your profile was updated elsewhere") };
    }
    if ("name" in patch) {
      const name = String(patch.name ?? "").trim();
      if (!name) return { status: 400, body: envelope("VALIDATION_ERROR", "Name can't be empty.") };
      profile.name = name;
    }
    if ("phone" in patch) {
      if (patch.phone === null) profile.phone = null;
      else if (typeof patch.phone === "string") {
        const phone = patch.phone.trim();
        if (phone && !/^\+[1-9]\d{1,14}$/.test(phone)) {
          return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a valid phone number, e.g. +8801712345678.") };
        }
        profile.phone = phone || null;
      }
    }
    profile.version += 1;
    return { status: 200, body: success(profileToView(profile)) };
  }
  if (req.path === "/profile/image" && req.method === "DELETE") {
    profile.avatarUrl = null;
    profile.version += 1;
    return { status: 200, body: success(profileToView(profile)) };
  }

  // ── Master-data sample endpoints (dev/preview only) ──
  // Split path from the querystring (the proxy forwards `?page=…` verbatim).
  const [pathname, rawQuery = ""] = req.path.split("?");
  const params = new URLSearchParams(rawQuery);
  const pageEnvelope = (rows: unknown[]) => ({
    data: rows,
    meta: {
      requestId: `mock-${jtiCounterSeed}`,
      page: 1,
      pageSize: rows.length || 25,
      total: rows.length,
    },
  });

  // GET /masters/projects — list (PM sees only assigned projects; Admin sees all).
  if (pathname === "/masters/projects" && req.method === "GET") {
    const scoped =
      user.assignedProjectIds.length > 0
        ? MOCK_PROJECTS.filter((p) => user.assignedProjectIds.includes(p.id))
        : MOCK_PROJECTS;
    return { status: 200, body: pageEnvelope(scoped) };
  }

  // POST /masters/projects — create. New projects start PLANNED (FR-MAS-005). Returns
  // the created row so the UI can route to its detail.
  if (pathname === "/masters/projects" && req.method === "POST") {
    const b = body as Partial<{
      projectCode: string;
      name: string;
      location: string | null;
      customerId: string;
      projectManagerId: string;
      startDate: string;
      expectedEndDate: string;
    }>;
    const code = String(b.projectCode ?? "").trim();
    const name = String(b.name ?? "").trim();
    if (!code) return { status: 400, body: envelope("VALIDATION_ERROR", "projectCode is required") };
    if (!name) return { status: 400, body: envelope("VALIDATION_ERROR", "name is required") };
    if (MOCK_PROJECTS.some((p) => p.projectCode.toLowerCase() === code.toLowerCase())) {
      return { status: 409, body: envelope("DUPLICATE_CODE", "This project code is already used.") };
    }
    const customerId = String(b.customerId ?? "");
    const created: MockProject = {
      id: `proj-${(mockProjectSeq += 1)}`,
      projectCode: code,
      name,
      status: "PLANNED",
      isActive: true,
      version: 1,
      location: b.location ? String(b.location) : null,
      projectManagerId: b.projectManagerId ? String(b.projectManagerId) : null,
      startDate: String(b.startDate ?? ""),
      expectedEndDate: String(b.expectedEndDate ?? ""),
      actualEndDate: null,
      customerId,
      customerName:
        (MOCK_PARTIES.find((p) => p.id === customerId)?.name ?? "—"),
      remainingAdvance: "0.0000",
      hasMobilizationAdvance: false,
    };
    MOCK_PROJECTS.push(created);
    return { status: 201, body: success(created) };
  }

  // GET/PATCH /masters/projects/:id and POST …/:id/status — detail, edit, transitions.
  // (Guarded to a single segment so `/:id/purposes` below still matches first.)
  const projectStatusMatch = /^\/masters\/projects\/([^/]+)\/status$/.exec(pathname ?? "");
  if (projectStatusMatch && req.method === "POST") {
    const target = MOCK_PROJECTS.find((p) => p.id === projectStatusMatch[1]);
    if (!target) return { status: 404, body: envelope("NOT_FOUND", "Project not found") };
    const action = String((body as { action?: unknown }).action ?? "");
    const next: Record<string, string> = {
      activate: "ACTIVE",
      hold: "ON_HOLD",
      resume: "ACTIVE",
      close: "CLOSED",
      reopen: "ACTIVE",
    };
    const ns = next[action];
    if (!ns) return { status: 400, body: envelope("VALIDATION_ERROR", "Unknown status action") };
    target.status = ns;
    target.isActive = ns !== "CLOSED";
    target.actualEndDate = ns === "CLOSED" ? "2026-06-30" : null;
    target.version += 1;
    return { status: 200, body: success(target) };
  }
  // ── Project budgets (FR-MAS-007/008) — list / upsert / delete. Matched BEFORE the
  // single-segment project matcher below (deeper path wins). ──
  const budgetItemMatch = /^\/masters\/projects\/([^/]+)\/budgets\/([^/]+)$/.exec(pathname ?? "");
  if (budgetItemMatch && req.method === "DELETE") {
    const [, , budgetId] = budgetItemMatch;
    const idx = MOCK_PROJECT_BUDGETS.findIndex((x) => x.id === budgetId);
    if (idx === -1) return { status: 404, body: envelope("NOT_FOUND", "Budget not found.") };
    MOCK_PROJECT_BUDGETS.splice(idx, 1);
    return { status: 204, body: null };
  }
  const budgetsMatch = /^\/masters\/projects\/([^/]+)\/budgets$/.exec(pathname ?? "");
  if (budgetsMatch) {
    const projectId = budgetsMatch[1]!;
    if (req.method === "GET") {
      const rows = MOCK_PROJECT_BUDGETS.filter((x) => x.projectId === projectId);
      return { status: 200, body: pageEnvelope(rows) };
    }
    // PUT — upsert on (project, cost centre). Existing row → update (+bump version);
    // new pair → insert. Optimistic-locked on `version` when the client sends it.
    if (req.method === "PUT") {
      const b = body as Partial<{ costCentreId: string; budgetedAmount: string; version: number }>;
      const costCentreId = String(b.costCentreId ?? "").trim();
      const amount = String(b.budgetedAmount ?? "").trim();
      if (!costCentreId) return { status: 400, body: envelope("VALIDATION_ERROR", "Cost centre is required.") };
      if (!amount) return { status: 400, body: envelope("VALIDATION_ERROR", "Budget amount is required.") };
      const existing = MOCK_PROJECT_BUDGETS.find(
        (x) => x.projectId === projectId && x.costCentreId === costCentreId,
      );
      if (existing) {
        if (b.version !== undefined && b.version !== existing.version)
          return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This budget was changed by someone else.") };
        existing.budgetedAmount = amount;
        existing.version += 1;
        return { status: 200, body: success(existing) };
      }
      const created: MockProjectBudget = {
        id: `bud-${(mockBudgetSeq += 1)}`,
        projectId,
        costCentreId,
        budgetedAmount: amount,
        version: 1,
      };
      MOCK_PROJECT_BUDGETS.push(created);
      return { status: 200, body: success(created) };
    }
  }

  const projectIdMatch = /^\/masters\/projects\/([^/]+)$/.exec(pathname ?? "");
  if (projectIdMatch) {
    const target = MOCK_PROJECTS.find((p) => p.id === projectIdMatch[1]);
    if (req.method === "GET") {
      if (!target) return { status: 404, body: envelope("NOT_FOUND", "Project not found") };
      return { status: 200, body: success(target) };
    }
    if (req.method === "PATCH") {
      if (!target) return { status: 404, body: envelope("NOT_FOUND", "Project not found") };
      const b = body as Partial<{
        name: string;
        location: string | null;
        customerId: string;
        projectManagerId: string;
        expectedEndDate: string;
      }>;
      if (b.name !== undefined) target.name = String(b.name).trim();
      if (b.location !== undefined) target.location = b.location ? String(b.location) : null;
      if (b.customerId !== undefined) target.customerId = String(b.customerId);
      if (b.projectManagerId !== undefined) target.projectManagerId = String(b.projectManagerId);
      if (b.expectedEndDate !== undefined) target.expectedEndDate = String(b.expectedEndDate);
      target.version += 1;
      return { status: 200, body: success(target) };
    }
  }

  // GET /masters/cost-centres — company-global list (active + inactive-with-history).
  if (pathname === "/masters/cost-centres" && req.method === "GET") {
    return { status: 200, body: pageEnvelope(MOCK_COST_CENTRES) };
  }

  // GET /masters/financial-years — the company's financial years (optional ?isActive=true).
  if (pathname === "/masters/financial-years" && req.method === "GET") {
    const rows = params.get("isActive") === "true"
      ? MOCK_FINANCIAL_YEARS.filter((fy) => fy.isActive)
      : MOCK_FINANCIAL_YEARS;
    return { status: 200, body: pageEnvelope(rows) };
  }

  // POST /masters/financial-years — create (FR-MAS-002). New years aren't active until
  // set active; overlap is allowed. Returns the new id so the screen can refresh.
  if (pathname === "/masters/financial-years" && req.method === "POST") {
    const b = body as Partial<{ label: string; startDate: string; endDate: string }>;
    const label = String(b.label ?? "").trim();
    const startDate = String(b.startDate ?? "");
    const endDate = String(b.endDate ?? "");
    if (!label) return { status: 400, body: envelope("VALIDATION_ERROR", "Label is required.") };
    if (!startDate || !endDate)
      return { status: 400, body: envelope("VALIDATION_ERROR", "Start and end dates are required.") };
    if (endDate <= startDate)
      return { status: 400, body: envelope("VALIDATION_ERROR", "End date must be after the start date.") };
    if (MOCK_FINANCIAL_YEARS.some((fy) => fy.label.toLowerCase() === label.toLowerCase()))
      return { status: 409, body: envelope("DUPLICATE_LABEL", "A financial year with this label already exists.") };
    const created = {
      id: `fy-${(mockFinancialYearSeq += 1)}`,
      label,
      startDate,
      endDate,
      isActive: false,
      version: 1,
    };
    MOCK_FINANCIAL_YEARS.push(created);
    return { status: 201, body: success(created) };
  }

  // POST /masters/financial-years/:id/set-active — flip the active year (FR-MAS-003).
  // Exactly one year is active: clear the rest, activate the target.
  const fySetActiveMatch = /^\/masters\/financial-years\/([^/]+)\/set-active$/.exec(pathname ?? "");
  if (fySetActiveMatch && req.method === "POST") {
    const target = MOCK_FINANCIAL_YEARS.find((fy) => fy.id === fySetActiveMatch[1]);
    if (!target) return { status: 404, body: envelope("NOT_FOUND", "Financial year not found.") };
    for (const fy of MOCK_FINANCIAL_YEARS) fy.isActive = fy.id === target.id;
    target.version += 1;
    return { status: 200, body: success(target) };
  }

  // PATCH /masters/financial-years/:id — edit (FR-MAS-002), optimistic-locked on version.
  const fyIdMatch = /^\/masters\/financial-years\/([^/]+)$/.exec(pathname ?? "");
  if (fyIdMatch && req.method === "PATCH") {
    const target = MOCK_FINANCIAL_YEARS.find((fy) => fy.id === fyIdMatch[1]);
    if (!target) return { status: 404, body: envelope("NOT_FOUND", "Financial year not found.") };
    const b = body as Partial<{ label: string; startDate: string; endDate: string; version: number }>;
    if (b.version !== undefined && b.version !== target.version)
      return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This financial year was changed by someone else.") };
    const nextStart = b.startDate !== undefined ? String(b.startDate) : target.startDate;
    const nextEnd = b.endDate !== undefined ? String(b.endDate) : target.endDate;
    if (nextEnd <= nextStart)
      return { status: 400, body: envelope("VALIDATION_ERROR", "End date must be after the start date.") };
    if (b.label !== undefined) {
      const label = String(b.label).trim();
      if (!label) return { status: 400, body: envelope("VALIDATION_ERROR", "Label is required.") };
      if (MOCK_FINANCIAL_YEARS.some((fy) => fy.id !== target.id && fy.label.toLowerCase() === label.toLowerCase()))
        return { status: 409, body: envelope("DUPLICATE_LABEL", "A financial year with this label already exists.") };
      target.label = label;
    }
    target.startDate = nextStart;
    target.endDate = nextEnd;
    target.version += 1;
    return { status: 200, body: success(target) };
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
      return {
        status: 403,
        body: envelope("FORBIDDEN", "You don't have access to the ledger detail for this IPC."),
      };
    }
    const entryId = entryMatch[1]!;
    const ipc = MOCK_IPCS.find(
      (i) =>
        i.journalEntryId === entryId || `je-${i.id}` === entryId || `je-${i.id}-v2` === entryId,
    );
    if (!ipc) {
      // Bill viewer's balanced-lines panel reads the same LED endpoint (fe-purchase-bills).
      const bill = MOCK_BILLS.find((b) => b.journalEntryId === entryId);
      if (bill) return { status: 200, body: billToJournalEntry(bill) };
      // Receipt viewer's balanced-lines panel reads the same LED endpoint (fe-receipt-viewer).
      const receipt = MOCK_RECEIPTS.find(
        (r) => r.journalEntryId === entryId || `je-${r.id}` === entryId || `je-${r.id}-v2` === entryId,
      );
      if (receipt) return { status: 200, body: receiptToJournalEntry(receipt, entryId) };
      // Payment viewer's balanced-lines panel reads the same LED endpoint (fe-payment-viewer).
      // MOCK_PAYMENTS lives inside the fetch scope further down; read the stashed store.
      const payStore = (globalThis as unknown as { __MOCK_PAYMENTS__?: unknown }).__MOCK_PAYMENTS__;
      if (Array.isArray(payStore)) {
        const p = (payStore as Array<{ id: string; journalEntryId: string | null }>).find(
          (r) => r.journalEntryId === entryId || `je-${r.id}` === entryId || `je-${r.id}-v2` === entryId,
        );
        if (p) {
          return {
            status: 200,
            body: paymentToJournalEntry(
              p as unknown as {
                id: string;
                partyId: string;
                paymentDate: string;
                paymentAccountId: string;
                paymentAmount: string;
                bankChargesAmount: string;
                allocations: Array<{ payableType: string; payableId: string; amountAllocated: string; partyId: string | null }>;
                entryNo: string | null;
                journalEntryId: string | null;
                postedAt: string | null;
                postedBy: string | null;
                narration: string | null;
                status: string;
              },
              entryId,
            ),
          };
        }
      }
      return { status: 404, body: envelope("NOT_FOUND", "Journal entry not found") };
    }
    const zero = "0.0000";
    const lines = [
      {
        id: `${entryId}-l1`,
        lineNo: 1,
        accountId: "1200",
        projectId: null,
        costCentreId: null,
        purposeId: null,
        godownId: null,
        partyId: ipc.customerId,
        debit: ipcCurrentlyDue(ipc),
        credit: zero,
        narration: null,
      },
      {
        id: `${entryId}-l2`,
        lineNo: 2,
        accountId: "1210",
        projectId: null,
        costCentreId: null,
        purposeId: null,
        godownId: null,
        partyId: ipc.customerId,
        debit: ipc.retentionAmount,
        credit: zero,
        narration: null,
      },
      {
        id: `${entryId}-l3`,
        lineNo: 3,
        accountId: "1310",
        projectId: null,
        costCentreId: null,
        purposeId: null,
        godownId: null,
        partyId: ipc.customerId,
        debit: ipc.advanceRecoveredAmount,
        credit: zero,
        narration: null,
      },
      {
        id: `${entryId}-l4`,
        lineNo: 4,
        accountId: "1450",
        projectId: null,
        costCentreId: null,
        purposeId: null,
        godownId: null,
        partyId: null,
        debit: ipc.aitTdsAmount,
        credit: zero,
        narration: null,
      },
      {
        id: `${entryId}-l5`,
        lineNo: 5,
        accountId: "4100",
        projectId: ipc.projectId,
        costCentreId: ipc.costCentreId,
        purposeId: ipc.purposeId,
        godownId: null,
        partyId: null,
        debit: zero,
        credit: ipc.certifiedAmount,
        narration: null,
      },
      {
        id: `${entryId}-l6`,
        lineNo: 6,
        accountId: "2310",
        projectId: ipc.projectId,
        costCentreId: ipc.costCentreId,
        purposeId: ipc.purposeId,
        godownId: null,
        partyId: null,
        debit: zero,
        credit: ipc.outputVatAmount,
        narration: null,
      },
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
    if (
      projectId &&
      user.assignedProjectIds.length > 0 &&
      !user.assignedProjectIds.includes(projectId)
    ) {
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
    if (
      projectId &&
      user.assignedProjectIds.length > 0 &&
      !user.assignedProjectIds.includes(projectId)
    ) {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    const scopedProject = projectId || user.assignedProjectIds[0] || "proj-a";
    let rows = MOCK_BVA_ROWS.filter((r) => r.status === "OVER" || r.status === "APPROACHING").map(
      (r) => ({
        projectId: scopedProject,
        ...r,
      }),
    );
    rows = rows.filter((r) => wanted.has(r.status));
    // Sort OVER before APPROACHING, then utilisation descending (spec §5).
    const rank = (s: string) => (s === "OVER" ? 0 : 1);
    rows.sort(
      (a, b) =>
        rank(a.status) - rank(b.status) || Number(b.utilisationPct) - Number(a.utilisationPct),
    );
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
      return {
        status: 400,
        body: envelope("VALIDATION_ERROR", "'Date from' must be before 'Date to'."),
      };
    }
    if (
      projectId &&
      user.assignedProjectIds.length > 0 &&
      !user.assignedProjectIds.includes(projectId)
    ) {
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    }
    let rows: Array<Record<string, unknown>>;
    if (groupBy === "project") {
      rows = MOCK_PROFITABILITY_BY_PROJECT.map((r) => ({ costCentreId: null, ...r }));
    } else if (groupBy === "project_cost_centre") {
      rows = MOCK_PROFITABILITY.slice(0, 4).map((r) => ({
        projectId: projectId || "proj-a",
        ...r,
      }));
    } else {
      rows = MOCK_PROFITABILITY.map((r) => ({ projectId: null, ...r }));
    }
    if (costCentreId) rows = rows.filter((r) => r.costCentreId === costCentreId);
    if (projectId && groupBy !== "cost_centre")
      rows = rows.filter((r) => r.projectId === projectId);
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
        openingBalance: b.openingBalance !== undefined ? b.openingBalance : target.openingBalance,
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
        {
          id: "1200",
          code: "1200",
          name: "Accounts Receivable",
          accountType: "ASSET",
          isActive: true,
        },
        {
          id: "1210",
          code: "1210",
          name: "Retention Receivable",
          accountType: "ASSET",
          isActive: true,
        },
        {
          id: "1310",
          code: "1310",
          name: "Advance to Contractor (recovery)",
          accountType: "ASSET",
          isActive: true,
        },
        {
          id: "1450",
          code: "1450",
          name: "AIT / TDS Receivable",
          accountType: "ASSET",
          isActive: true,
        },
        {
          id: "4100",
          code: "4100",
          name: "Contract Revenue",
          accountType: "REVENUE",
          isActive: true,
        },
        {
          id: "2310",
          code: "2310",
          name: "Output VAT Payable",
          accountType: "LIABILITY",
          isActive: true,
        },
        { id: "1010", code: "1010", name: "Cash in Hand", accountType: "ASSET", isActive: true },
        {
          id: "1020",
          code: "1020",
          name: "Bank — Operating",
          accountType: "ASSET",
          isActive: true,
        },
        {
          id: "5100",
          code: "5100",
          name: "Material Expense",
          accountType: "EXPENSE",
          isActive: true,
        },
        // Purchase-posting accounts — resolve the bill viewer's balanced ledger lines to names.
        {
          id: "1440",
          code: "1440",
          name: "VAT Input (recoverable)",
          accountType: "ASSET",
          isActive: true,
        },
        {
          id: "2100",
          code: "2100",
          name: "Accounts Payable",
          accountType: "LIABILITY",
          isActive: true,
        },
        {
          id: "2210",
          code: "2210",
          name: "TDS Payable",
          accountType: "LIABILITY",
          isActive: true,
        },
        {
          id: "2220",
          code: "2220",
          name: "AIT Payable",
          accountType: "LIABILITY",
          isActive: true,
        },
      ]),
    };
  }

  // ── Inventory master lookups ──
  if (pathname === "/masters/godowns" && req.method === "GET") {
    const projectId = params.get("projectId");
    const rows = projectId ? MOCK_GODOWNS.filter((g) => g.projectId === projectId) : MOCK_GODOWNS;
    return { status: 200, body: pageEnvelope(rows) };
  }

  // POST /masters/godowns — create a project-scoped godown (FR-MAS-014). Name is unique
  // per project (case-insensitive). Returns the new id so the tab can refresh.
  if (pathname === "/masters/godowns" && req.method === "POST") {
    const b = body as Partial<{ projectId: string; name: string; location: string | null }>;
    const projectId = String(b.projectId ?? "").trim();
    const name = String(b.name ?? "").trim();
    if (!projectId) return { status: 400, body: envelope("VALIDATION_ERROR", "projectId is required.") };
    if (!name) return { status: 400, body: envelope("VALIDATION_ERROR", "name is required.") };
    if (
      MOCK_GODOWNS.some(
        (g) => g.projectId === projectId && g.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      return { status: 409, body: envelope("DUPLICATE_NAME", "A godown with this name already exists for this project.") };
    }
    const seq = (mockGodownSeq += 1);
    const created: MockGodown = {
      id: `gd-${seq}`,
      code: `G-${seq}`,
      name,
      projectId,
      location: b.location ? String(b.location) : null,
      isActive: true,
      version: 1,
    };
    MOCK_GODOWNS.push(created);
    return { status: 201, body: success(created) };
  }

  // POST /masters/godowns/:id/deactivate | /reactivate — soft delete / restore
  // (FR-MAS-015/016). Optimistic-locked on `version`. Matched BEFORE the bare :id PATCH.
  const godownActionMatch = /^\/masters\/godowns\/([^/]+)\/(deactivate|reactivate)$/.exec(pathname ?? "");
  if (godownActionMatch && req.method === "POST") {
    const [, godownId, action] = godownActionMatch;
    const target = MOCK_GODOWNS.find((g) => g.id === godownId);
    if (!target) return { status: 404, body: envelope("NOT_FOUND", "Godown not found.") };
    const ver = (body as { version?: number }).version;
    if (ver !== undefined && ver !== target.version)
      return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This godown was changed by someone else.") };
    target.isActive = action === "reactivate";
    target.version += 1;
    return { status: 200, body: success(target) };
  }

  // PATCH /masters/godowns/:id — edit name/location (FR-MAS-014), optimistic-locked.
  const godownIdMatch = /^\/masters\/godowns\/([^/]+)$/.exec(pathname ?? "");
  if (godownIdMatch && req.method === "PATCH") {
    const target = MOCK_GODOWNS.find((g) => g.id === godownIdMatch[1]);
    if (!target) return { status: 404, body: envelope("NOT_FOUND", "Godown not found.") };
    const b = body as Partial<{ name: string; location: string | null; version: number }>;
    if (b.version !== undefined && b.version !== target.version)
      return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This godown was changed by someone else.") };
    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name) return { status: 400, body: envelope("VALIDATION_ERROR", "name is required.") };
      if (
        MOCK_GODOWNS.some(
          (g) =>
            g.id !== target.id &&
            g.projectId === target.projectId &&
            g.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        return { status: 409, body: envelope("DUPLICATE_NAME", "A godown with this name already exists for this project.") };
      }
      target.name = name;
    }
    if (b.location !== undefined) target.location = b.location ? String(b.location) : null;
    target.version += 1;
    return { status: 200, body: success(target) };
  }

  if (pathname === "/masters/items" && req.method === "GET") {
    return { status: 200, body: pageEnvelope(MOCK_ITEMS) };
  }
  if (pathname === "/users" && req.method === "GET") {
    return { status: 200, body: pageEnvelope(MOCK_USER_LIST) };
  }

  // ── Stock ledger reads (matched BEFORE /stock-journal/:id) ──
  const godownProject = (gid: string): string | null =>
    MOCK_GODOWNS.find((g) => g.id === gid)?.projectId ?? null;
  const inScope = (projectId: string | null) =>
    user.assignedProjectIds.length === 0 ||
    (projectId ? user.assignedProjectIds.includes(projectId) : true);

  if (pathname === "/stock-journal/stock-ledger" && req.method === "GET") {
    const godownId = params.get("godownId");
    const itemId = params.get("itemId");
    const projectId = params.get("projectId");
    const asOf = params.get("asOfDate") ?? "2026-07-07";
    if (projectId && !inScope(projectId)) {
      return {
        status: 403,
        body: envelope("FORBIDDEN", "You can only view your assigned projects' godowns."),
      };
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
      return {
        status: 400,
        body: envelope("VALIDATION_ERROR", "godownId and itemId are required."),
      };
    }
    if (!inScope(godownProject(godownId))) {
      return {
        status: 403,
        body: envelope("FORBIDDEN", "You can only view your assigned projects' godowns."),
      };
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
    user.assignedProjectIds.length === 0 ||
    (projectId ? user.assignedProjectIds.includes(projectId) : true);

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
      return {
        status: 400,
        body: envelope("SAME_GODOWN_TRANSFER", "Source and destination can't be the same godown."),
      };
    }
    const id = `sj-${(sjSeq += 1)}`;
    const nj: MockSJ = {
      id,
      entryNo: null,
      voucherDate: String(b.voucherDate ?? ""),
      mode: b.mode as MockSJ["mode"],
      status: "DRAFT",
      fromGodownId: out.godownId ?? null,
      toGodownId: inn?.godownId ?? null,
      itemId: String(b.itemId ?? ""),
      quantity: String(b.quantity ?? "0"),
      rate: null,
      value: null,
      projectId: out.projectId ?? null,
      costCentreId: out.costCentreId ?? null,
      purposeId: out.purposeId ?? null,
      issuedById: (b.issuedById as string) ?? null,
      receivedById: (b.receivedById as string) ?? null,
      approvedById: null,
      approvedAt: null,
      negativeStockAuthorisedById: null,
      negativeStockReason: null,
      journalEntryId: null,
      narration: (b.narration as string) ?? null,
      postedAt: null,
      postedById: null,
      version: 1,
      lines: lines.map((l, i) => ({
        lineNo: i + 1,
        side: l.side as "OUT" | "IN",
        godownId: l.godownId ?? "",
        itemId: String(b.itemId ?? ""),
        quantity: String(b.quantity ?? "0"),
        rate: null,
        value: null,
        projectId: l.projectId ?? "",
        costCentreId: l.costCentreId ?? "",
        purposeId: l.purposeId ?? "",
      })),
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
    if (!scopeOk(j.projectId))
      return {
        status: 403,
        body: envelope("FORBIDDEN", "You don't have access to this Stock Journal."),
      };
    const b = body as Record<string, unknown>;

    if (req.method === "GET" && !action) return { status: 200, body: success(j) };

    if (req.method === "PATCH" && !action) {
      if (j.status !== "DRAFT")
        return {
          status: 409,
          body: envelope("VOUCHER_POSTED_IMMUTABLE", "Posted Stock Journals can't be edited."),
        };
      const lines = (Array.isArray(b.lines) ? b.lines : j.lines) as Array<Record<string, string>>;
      const out = lines.find((l) => l.side === "OUT") ?? {};
      const inn = lines.find((l) => l.side === "IN");
      if (b.mode === "TRANSFER" && out.godownId && inn?.godownId && out.godownId === inn.godownId) {
        return {
          status: 400,
          body: envelope(
            "SAME_GODOWN_TRANSFER",
            "Source and destination can't be the same godown.",
          ),
        };
      }
      Object.assign(j, {
        voucherDate: b.voucherDate ?? j.voucherDate,
        mode: b.mode ?? j.mode,
        itemId: b.itemId ?? j.itemId,
        quantity: b.quantity ?? j.quantity,
        issuedById: b.issuedById ?? j.issuedById,
        receivedById: b.receivedById ?? j.receivedById,
        narration: b.narration ?? j.narration,
        fromGodownId: out.godownId ?? j.fromGodownId,
        toGodownId: inn?.godownId ?? null,
        projectId: out.projectId ?? j.projectId,
        costCentreId: out.costCentreId ?? j.costCentreId,
        purposeId: out.purposeId ?? j.purposeId,
        version: j.version + 1,
      });
      return { status: 200, body: success(j) };
    }

    if (req.method === "DELETE" && !action) {
      if (j.status !== "DRAFT")
        return {
          status: 409,
          body: envelope("VOUCHER_POSTED_IMMUTABLE", "Posted Stock Journals can't be deleted."),
        };
      const idx = MOCK_STOCK_JOURNALS.indexOf(j);
      MOCK_STOCK_JOURNALS.splice(idx, 1);
      return { status: 204, body: null };
    }

    if (req.method === "POST" && action === "approve") {
      if (j.status !== "DRAFT")
        return {
          status: 409,
          body: envelope("INVALID_STOCK_JOURNAL_TRANSITION", "Only a draft can be approved."),
        };
      j.status = "APPROVED";
      j.approvedById = user.id;
      j.approvedAt = new Date().toISOString();
      j.version += 1;
      return { status: 200, body: success(j) };
    }

    if (req.method === "POST" && action === "post") {
      if (j.status !== "APPROVED")
        return {
          status: 409,
          body: envelope(
            "STOCK_JOURNAL_NOT_APPROVED",
            "This Stock Journal must be approved before it can be posted.",
          ),
        };
      const bal = MOCK_STOCK_LEDGER.find(
        (r) => r.godownId === j.fromGodownId && r.itemId === j.itemId,
      );
      const onHand = bal ? Number(bal.quantityOnHand) : 0;
      const allow = b.allowNegativeStock === true;
      if (Number(j.quantity) > onHand) {
        if (!allow || user.role !== "ADMIN") {
          return {
            status: 409,
            body: envelope(
              "NEGATIVE_STOCK_BLOCKED",
              "This would take the item below zero. You don't have authorisation to allow negative stock.",
            ),
          };
        }
        j.negativeStockAuthorisedById = user.id;
        j.negativeStockReason = (b.negativeStockReason as string) ?? null;
      }
      const rate = bal?.weightedAverageRate ?? "0.0000";
      j.status = "POSTED";
      j.postedAt = new Date().toISOString();
      j.postedById = user.id;
      j.rate = rate;
      j.value = (Number(rate) * Number(j.quantity)).toFixed(4);
      if (j.mode === "TRANSFER") {
        j.entryNo = null;
        j.journalEntryId = null;
      } // value-neutral
      else {
        j.entryNo = `SJ/2526/${String((sjNumberSeq += 1)).padStart(4, "0")}`;
        j.journalEntryId = `je-${j.id}`;
      }
      j.version += 1;
      return { status: 200, body: success(j) };
    }

    if (req.method === "POST" && action === "reverse") {
      if (j.status === "CANCELLED")
        return {
          status: 409,
          body: envelope("ALREADY_REVERSED", "This Stock Journal has already been reversed."),
        };
      if (j.status !== "POSTED")
        return {
          status: 409,
          body: envelope(
            "INVALID_STOCK_JOURNAL_TRANSITION",
            "Only a posted journal can be reversed.",
          ),
        };
      j.status = "CANCELLED";
      j.version += 1;
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
    if (!scopeOk(project.id))
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this project.") };
    if (project.status === "CLOSED")
      return {
        status: 409,
        body: envelope("PROJECT_CLOSED", "This project is closed and can't accept new IPCs."),
      };
    const seqNo = Number(b.ipcSeqNo ?? 0);
    if (Number(b.certifiedAmount ?? 0) <= 0)
      return {
        status: 400,
        body: envelope("VALIDATION_ERROR", "Certified amount must be greater than zero."),
      };
    if ((b.dueDate ?? "") < (b.billDate ?? ""))
      return {
        status: 400,
        body: envelope("VALIDATION_ERROR", "Due date can't be before the bill date."),
      };
    if (MOCK_IPCS.some((i) => i.projectId === project.id && i.ipcSeqNo === seqNo)) {
      return {
        status: 409,
        body: envelope("DUPLICATE_IPC_SEQ_NO", `This project already has IPC #${seqNo}.`),
      };
    }
    if (Number(b.advanceRecoveredAmount ?? 0) > Number(project.remainingAdvance)) {
      return {
        status: 409,
        body: envelope(
          "ADVANCE_EXCEEDS_REMAINING",
          "Advance recovered exceeds the remaining project advance.",
        ),
      };
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
    if (
      Number(ipcCurrentlyDue(draft)) === 0 &&
      Number(draft.certifiedAmount) > 0 &&
      Number(draft.certifiedAmount) +
        Number(draft.outputVatAmount) -
        Number(draft.retentionAmount) -
        Number(draft.advanceRecoveredAmount) -
        Number(draft.aitTdsAmount) <
        0
    ) {
      return {
        status: 400,
        body: envelope(
          "CURRENTLY_DUE_NEGATIVE",
          "These figures make the currently-due amount negative.",
        ),
      };
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
    MOCK_RELEASES.filter((r) => r.ipcId === ipcId).reduce(
      (sum, r) => sum + Number(r.releasedAmount),
      0,
    );
  const ipcHeldNet = (i: MockIpc) => {
    if (i.status !== "POSTED") return "0.0000";
    return (Number(i.retentionAmount) - releasedTotal(i.id)).toFixed(4);
  };

  const registerMatch = /^\/sales\/projects\/([^/]+)\/register$/.exec(pathname ?? "");
  if (registerMatch && req.method === "GET") {
    const projectId = registerMatch[1]!;
    const project = MOCK_PROJECTS.find((p) => p.id === projectId);
    if (!project) return { status: 404, body: envelope("NOT_FOUND", "Project not found") };
    if (!scopeOk(project.id))
      return {
        status: 403,
        body: envelope("FORBIDDEN", "You don't have access to this project's register."),
      };
    const posted = MOCK_IPCS.filter((i) => i.projectId === projectId && i.status === "POSTED")
      .slice()
      .sort((a, b) => a.ipcSeqNo - b.ipcSeqNo);
    let cumC = 0,
      cumD = 0,
      cumR = 0,
      cumA = 0,
      cumRec = 0;
    const rows = posted.map((i) => {
      const cert = Number(i.certifiedAmount);
      const due = Number(ipcCurrentlyDue(i));
      const ret = Number(i.retentionAmount);
      const adv = Number(i.advanceRecoveredAmount);
      // Mock: no receipts wired — the last row for proj-a surfaces a "Pending sync" partial
      // (null receivedAmount) to exercise the state matrix; the rest resolve to "0.0000".
      const isPending = i.id === "ipc-7";
      const rec = isPending ? null : 0;
      cumC += cert;
      cumD += due;
      cumR += ret;
      cumA += adv;
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

  const releaseMatch = /^\/sales\/ipc\/([^/]+)\/(release-retention|retention-releases)$/.exec(
    pathname ?? "",
  );
  if (releaseMatch) {
    const id = releaseMatch[1]!;
    const kind = releaseMatch[2]!;
    const ipc = MOCK_IPCS.find((i) => i.id === id);
    if (!ipc) return { status: 404, body: envelope("NOT_FOUND", "IPC not found") };
    if (!scopeOk(ipc.projectId))
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this IPC.") };

    if (kind === "retention-releases" && req.method === "GET") {
      return { status: 200, body: success(MOCK_RELEASES.filter((r) => r.ipcId === id)) };
    }

    if (kind === "release-retention" && req.method === "POST") {
      if (ipc.status !== "POSTED") {
        return {
          status: 409,
          body: envelope(
            "VOUCHER_NOT_POSTED",
            "This IPC isn't posted yet — retention can only be released from a posted IPC.",
          ),
        };
      }
      const project = MOCK_PROJECTS.find((p) => p.id === ipc.projectId);
      if (project?.status === "CLOSED") {
        return {
          status: 409,
          body: envelope("PROJECT_CLOSED", "This project is closed — release isn't allowed."),
        };
      }
      const b = body as { releaseDate?: string; releasedAmount?: string; narration?: string };
      if (!b.releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.releaseDate)) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a valid release date.") };
      }
      const held = Number(ipcHeldNet(ipc));
      const requested =
        b.releasedAmount != null && String(b.releasedAmount).trim() !== ""
          ? Number(b.releasedAmount)
          : held;
      if (requested <= 0) {
        return {
          status: 400,
          body: envelope("VALIDATION_ERROR", "Enter an amount greater than zero."),
        };
      }
      if (requested > held + 1e-6) {
        return {
          status: 409,
          body: envelope(
            "OVER_RELEASE",
            `You can't release more than the retention held (৳${held.toFixed(4)}).`,
          ),
        };
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
        body: success({
          id: release.id,
          ipcId: id,
          entryNo,
          releasedAmount: release.releasedAmount,
          status: "POSTED",
        }),
      };
    }
  }

  const ipcMatch = /^\/sales\/ipc\/([^/]+)(?:\/(post|cancel|repost))?$/.exec(pathname ?? "");
  if (ipcMatch) {
    const id = ipcMatch[1]!;
    const action = ipcMatch[2];
    const ipc = MOCK_IPCS.find((i) => i.id === id);
    if (!ipc) return { status: 404, body: envelope("NOT_FOUND", "IPC not found") };
    if (!scopeOk(ipc.projectId))
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this IPC.") };
    const b = body as Partial<MockIpc> & { version?: number; reason?: string };

    if (req.method === "GET" && !action) {
      return { status: 200, body: success(ipcResource(ipc)) };
    }

    if (req.method === "PATCH" && !action) {
      if (ipc.status !== "DRAFT")
        return {
          status: 409,
          body: envelope(
            "VOUCHER_POSTED_IMMUTABLE",
            "This IPC has been posted and can no longer be edited.",
          ),
        };
      if (b.version !== undefined && b.version !== ipc.version)
        return {
          status: 409,
          body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This IPC was just changed by someone else."),
        };
      const project = MOCK_PROJECTS.find((p) => p.id === (b.projectId ?? ipc.projectId));
      if (
        b.ipcSeqNo !== undefined &&
        MOCK_IPCS.some(
          (i) =>
            i.id !== ipc.id &&
            i.projectId === (b.projectId ?? ipc.projectId) &&
            i.ipcSeqNo === Number(b.ipcSeqNo),
        )
      ) {
        return {
          status: 409,
          body: envelope(
            "DUPLICATE_IPC_SEQ_NO",
            `This project already has IPC #${Number(b.ipcSeqNo)}.`,
          ),
        };
      }
      Object.assign(ipc, {
        projectId: b.projectId ?? ipc.projectId,
        customerId: project?.customerId ?? ipc.customerId,
        ipcSeqNo: b.ipcSeqNo !== undefined ? Number(b.ipcSeqNo) : ipc.ipcSeqNo,
        ipcDate: b.ipcDate ?? ipc.ipcDate,
        billDate: b.billDate ?? ipc.billDate,
        dueDate: b.dueDate ?? ipc.dueDate,
        workCompletedPct: b.workCompletedPct ?? ipc.workCompletedPct,
        certifiedAmount:
          b.certifiedAmount != null ? String(b.certifiedAmount) : ipc.certifiedAmount,
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
      if (ipc.status !== "DRAFT")
        return {
          status: 409,
          body: envelope("VOUCHER_POSTED_IMMUTABLE", "Only a draft IPC can be discarded."),
        };
      MOCK_IPCS.splice(MOCK_IPCS.indexOf(ipc), 1);
      return { status: 204, body: null };
    }

    if (req.method === "POST" && action === "post") {
      if (ipc.status !== "DRAFT")
        return {
          status: 409,
          body: envelope("VOUCHER_POSTED_IMMUTABLE", "This IPC has already been posted."),
        };
      if (b.version !== undefined && b.version !== ipc.version)
        return {
          status: 409,
          body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This IPC was just changed by someone else."),
        };
      const entryNo = `IPC/2526/${String((ipcNumberSeq += 1)).padStart(4, "0")}`;
      Object.assign(ipc, {
        status: "POSTED",
        entryNo,
        journalEntryId: `je-${ipc.id}`,
        postedAt: new Date().toISOString(),
        postedBy: user.id,
        version: ipc.version + 1,
      });
      return {
        status: 200,
        body: success({
          id: ipc.id,
          entryNo,
          journalEntryId: ipc.journalEntryId,
          status: "POSTED",
          currentlyDueAmount: ipcCurrentlyDue(ipc),
        }),
      };
    }

    if (req.method === "POST" && action === "cancel") {
      if (ipc.status === "DRAFT")
        return {
          status: 409,
          body: envelope("VOUCHER_NOT_POSTED", "This IPC isn't posted, so it can't be cancelled."),
        };
      if (ipc.status === "CANCELLED")
        return {
          status: 409,
          body: envelope("ALREADY_REVERSED", "This IPC has already been cancelled."),
        };
      if (!String(b.reason ?? "").trim())
        return {
          status: 400,
          body: envelope("VALIDATION_ERROR", "Enter a reason for cancelling this IPC."),
        };
      const reversalEntryNo = `IPC/2526/${String((ipcNumberSeq += 1)).padStart(4, "0")}`;
      Object.assign(ipc, { status: "CANCELLED", reversalEntryNo, version: ipc.version + 1 });
      return {
        status: 200,
        body: success({
          id: ipc.id,
          status: "CANCELLED",
          reversalEntryId: `je-${ipc.id}-rev`,
          reversalEntryNo,
        }),
      };
    }

    if (req.method === "POST" && action === "repost") {
      if (ipc.status === "DRAFT")
        return {
          status: 409,
          body: envelope("VOUCHER_NOT_POSTED", "This IPC isn't posted, so it can't be reposted."),
        };
      if (ipc.status === "CANCELLED")
        return {
          status: 409,
          body: envelope("ALREADY_REVERSED", "This IPC has already been cancelled."),
        };
      if (!String(b.reason ?? "").trim())
        return {
          status: 400,
          body: envelope("VALIDATION_ERROR", "Enter a reason for correcting this IPC."),
        };
      const reversalEntryNo = `IPC/2526/${String((ipcNumberSeq += 1)).padStart(4, "0")}`;
      const entryNo = `IPC/2526/${String((ipcNumberSeq += 1)).padStart(4, "0")}`;
      Object.assign(ipc, {
        certifiedAmount:
          b.certifiedAmount != null ? String(b.certifiedAmount) : ipc.certifiedAmount,
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
      return {
        status: 200,
        body: success({
          id: ipc.id,
          status: "POSTED",
          entryNo,
          reversalEntryNo,
          currentlyDueAmount: ipcCurrentlyDue(ipc),
        }),
      };
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
    if (outF === "true")
      rows = rows.filter((r) => r.lines.some((l) => Number(l.balanceQuantity) > 0));
    return { status: 200, body: pageEnvelope(rows) };
  }

  if (pathname === "/requisition" && req.method === "POST") {
    const b = body as Record<string, unknown>;
    const projectId = String(b.projectId ?? "");
    const purposeId = String(b.purposeId ?? "");
    const purpose = MOCK_PURPOSES.find((p) => p.id === purposeId);
    if (purpose && purpose.projectId !== projectId) {
      return {
        status: 400,
        body: envelope(
          "CROSS_PROJECT_DIMENSION",
          "This purpose doesn't belong to the selected project.",
        ),
      };
    }
    const bodyLines = (Array.isArray(b.lines) ? b.lines : []) as Array<{
      itemId: string;
      requestedQuantity: string;
    }>;
    const inactive = bodyLines.find(
      (l) => MOCK_ITEMS.find((i) => i.id === l.itemId)?.isActive === false,
    );
    if (inactive)
      return { status: 400, body: envelope("INACTIVE_MASTER_REFERENCE", "This item is inactive.") };
    const godownId = (b.fromGodownId as string) ?? null;
    const id = `req-${(reqSeq += 1)}`;
    const nr: MockRequisition = {
      id,
      requisitionNo: null,
      projectId,
      costCentreId: String(b.costCentreId ?? ""),
      purposeId,
      fromGodownId: godownId,
      requiredDate: String(b.requiredDate ?? ""),
      priority: (b.priority as MockRequisition["priority"]) ?? "NORMAL",
      status: "DRAFT",
      estimatedValue: null,
      approvalTier: null,
      submittedAt: null,
      submittedById: null,
      closedAt: null,
      closedReason: null,
      narration: (b.narration as string) ?? null,
      version: 1,
      lines: bodyLines.map((l, i) =>
        mkLine(`rl-${id}-${i}`, i + 1, l.itemId, l.requestedQuantity, "0", godownId),
      ),
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
    const iss = MOCK_REQ_ISSUES.find(
      (i) => i.requisitionIssueId === issueId && i.requisitionId === reqId,
    );
    if (!iss) return { status: 404, body: envelope("NOT_FOUND", "Issue not found") };
    if (iss.reversedAt)
      return {
        status: 409,
        body: envelope("ALREADY_REVERSED", "This issue has already been reversed."),
      };
    const b = body as Record<string, unknown>;
    if (!String(b.reason ?? "").trim())
      return {
        status: 400,
        body: envelope("VALIDATION_ERROR", "Enter a reason for reversing this issue."),
      };
    // Restore each line's balance.
    for (const il of iss.lines) {
      const line = r.lines.find((l) => l.id === il.requisitionLineId);
      if (line) {
        line.issuedQuantity = (Number(line.issuedQuantity) - Number(il.issuedQuantity)).toFixed(4);
        line.balanceQuantity = (
          Number(line.requestedQuantity) - Number(line.issuedQuantity)
        ).toFixed(4);
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
  const rm =
    /^\/requisition\/([^/]+)(?:\/(submit|approve|reject|approvals|issue|close|outstanding|issues))?$/.exec(
      pathname ?? "",
    );
  if (rm) {
    const id = rm[1]!;
    const action = rm[2];
    const r = MOCK_REQUISITIONS.find((x) => x.id === id);
    if (!r) return { status: 404, body: envelope("NOT_FOUND", "Requisition not found") };
    if (!scopeOk(r.projectId))
      return {
        status: 403,
        body: envelope("FORBIDDEN", "You don't have access to this requisition."),
      };
    const b = body as Record<string, unknown>;

    if (req.method === "GET" && !action) return { status: 200, body: success(r) };

    if (req.method === "PATCH") {
      if (r.status !== "DRAFT")
        return {
          status: 409,
          body: envelope(
            "VOUCHER_POSTED_IMMUTABLE",
            "This requisition has been submitted and can't be edited here.",
          ),
        };
      const purposeId = b.purposeId !== undefined ? String(b.purposeId) : r.purposeId;
      const projectId = b.projectId !== undefined ? String(b.projectId) : r.projectId;
      const purpose = MOCK_PURPOSES.find((p) => p.id === purposeId);
      if (purpose && purpose.projectId !== projectId) {
        return {
          status: 400,
          body: envelope(
            "CROSS_PROJECT_DIMENSION",
            "This purpose doesn't belong to the selected project.",
          ),
        };
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
        const inactive = bl.find(
          (l) => MOCK_ITEMS.find((i) => i.id === l.itemId)?.isActive === false,
        );
        if (inactive)
          return {
            status: 400,
            body: envelope("INACTIVE_MASTER_REFERENCE", "This item is inactive."),
          };
        r.lines = bl.map((l, i) =>
          mkLine(`rl-${id}-${i}`, i + 1, l.itemId, l.requestedQuantity, "0", r.fromGodownId),
        );
      }
      r.version += 1;
      return { status: 200, body: success(r) };
    }

    if (req.method === "DELETE") {
      if (r.status !== "DRAFT")
        return {
          status: 409,
          body: envelope("VOUCHER_POSTED_IMMUTABLE", "Only a draft can be deleted."),
        };
      MOCK_REQUISITIONS.splice(MOCK_REQUISITIONS.indexOf(r), 1);
      return { status: 204, body: null };
    }

    if (req.method === "POST" && action === "submit") {
      if (r.status !== "DRAFT")
        return {
          status: 409,
          body: envelope(
            "INVALID_REQUISITION_TRANSITION",
            "This requisition can no longer be submitted.",
          ),
        };
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
      return {
        status: 200,
        body: success(MOCK_REQ_APPROVALS.filter((a) => a.requisitionId === id)),
      };
    }

    // Escalate-by-default authority gate (FR-REQ-010/-011): a PM may decide only a PM-tier
    // requisition; an ACCOUNTS-tier (escalated) one needs Accounts; Admin decides anything.
    const canDecideTier =
      user.role === "ADMIN" ||
      (r.approvalTier === "ACCOUNTS"
        ? user.role === "ACCOUNTS_MANAGER" || user.role === "ACCOUNTS_TEAM"
        : user.role === "PROJECT_MANAGER");

    if (req.method === "POST" && action === "approve") {
      if (r.status !== "SUBMITTED")
        return {
          status: 409,
          body: envelope("REQUISITION_NOT_SUBMITTED", "This requisition has already been decided."),
        };
      if (!canDecideTier)
        return {
          status: 403,
          body: envelope(
            "APPROVAL_BEYOND_AUTHORITY",
            "This requisition is above your approval limit.",
          ),
        };
      r.status = "APPROVED";
      r.version += 1;
      MOCK_REQ_APPROVALS.push({
        id: `ra-${MOCK_REQ_APPROVALS.length + 1}`,
        requisitionId: id,
        decision: "APPROVED",
        tier: r.approvalTier ?? "PM",
        thresholdEvaluated: r.approvalTier === "ACCOUNTS" ? "2500000.0000" : "500000.0000",
        estimatedValueAtReview: r.estimatedValue,
        reason: (b.note as string) ?? null,
        decidedById: user.id,
        decidedAt: new Date().toISOString(),
      });
      return { status: 200, body: success(r) };
    }

    if (req.method === "POST" && action === "reject") {
      if (r.status !== "SUBMITTED")
        return {
          status: 409,
          body: envelope("REQUISITION_NOT_SUBMITTED", "This requisition has already been decided."),
        };
      if (!canDecideTier)
        return {
          status: 403,
          body: envelope(
            "APPROVAL_BEYOND_AUTHORITY",
            "This requisition is above your approval limit.",
          ),
        };
      const reason = String(b.reason ?? "").trim();
      if (!reason)
        return {
          status: 400,
          body: envelope("MISSING_REJECT_REASON", "Enter a reason for rejecting this requisition."),
        };
      r.status = "REJECTED";
      r.version += 1;
      MOCK_REQ_APPROVALS.push({
        id: `ra-${MOCK_REQ_APPROVALS.length + 1}`,
        requisitionId: id,
        decision: "REJECTED",
        tier: r.approvalTier ?? "PM",
        thresholdEvaluated: r.approvalTier === "ACCOUNTS" ? "2500000.0000" : "500000.0000",
        estimatedValueAtReview: r.estimatedValue,
        reason,
        decidedById: user.id,
        decidedAt: new Date().toISOString(),
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
            requisitionLineId: l.id,
            itemId: l.itemId,
            requestedQuantity: l.requestedQuantity,
            issuedQuantity: l.issuedQuantity,
            balanceQuantity: l.balanceQuantity,
            uom: l.uom,
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
        return {
          status: 409,
          body: envelope("REQUISITION_NOT_APPROVED", "This requisition can no longer be issued."),
        };
      }
      const fromGodown = String(b.fromGodownId ?? "");
      const allowNeg = b.allowNegativeStock === true;
      const bodyLines = (Array.isArray(b.lines) ? b.lines : []) as Array<{
        requisitionLineId: string;
        issueQuantity: string;
        godownId?: string;
      }>;
      const resultLines: MockReqIssueLine[] = [];
      let issuedValue = 0;
      for (const bl of bodyLines) {
        const line = r.lines.find((l) => l.id === bl.requisitionLineId);
        if (!line)
          return { status: 400, body: envelope("VALIDATION_ERROR", "Unknown requisition line.") };
        const qty = Number(bl.issueQuantity);
        if (qty <= 0 || qty > Number(line.balanceQuantity)) {
          return {
            status: 400,
            body: envelope(
              "ISSUE_EXCEEDS_BALANCE",
              `This exceeds the outstanding balance (${line.balanceQuantity}).`,
            ),
          };
        }
        const godown = bl.godownId ?? fromGodown;
        if (!allowNeg && user.role !== "ADMIN" && qty > reqOnHand(godown, line.itemId)) {
          return {
            status: 409,
            body: envelope("NEGATIVE_STOCK_BLOCKED", "Not enough stock on hand."),
          };
        }
        const rate = reqIndicativeRate(line.itemId, godown) ?? "0.0000";
        const value = qty * Number(rate);
        issuedValue += value;
        resultLines.push({
          requisitionLineId: line.id,
          stockMovementId: `mv-req-${reqIssueSeq}-${resultLines.length}`,
          issuedQuantity: qty.toFixed(4),
          rate,
          value: value.toFixed(4),
        });
        line.issuedQuantity = (Number(line.issuedQuantity) + qty).toFixed(4);
        line.balanceQuantity = (
          Number(line.requestedQuantity) - Number(line.issuedQuantity)
        ).toFixed(4);
      }
      const fullyIssued = r.lines.every((l) => Number(l.balanceQuantity) <= 0);
      r.status = fullyIssued ? "ISSUED" : "PARTIALLY_ISSUED";
      r.version += 1;
      const issue: MockReqIssue = {
        requisitionId: id,
        requisitionIssueId: `ri-${(reqIssueSeq += 1)}`,
        issueNo: (reqIssueNoSeq += 1),
        journalEntryId: `je-${reqIssueSeq}`,
        entryNo: `SJ/2526/${String(reqIssueSeq).padStart(4, "0")}`,
        issuedValue: issuedValue.toFixed(4),
        fromGodownId: fromGodown,
        lines: resultLines,
        requisitionStatus: r.status,
        issuedAt: new Date().toISOString(),
        reversedAt: null,
        reversedById: null,
      };
      MOCK_REQ_ISSUES.push(issue);
      return { status: 200, body: success(issue) };
    }

    // Manual close — abandon the outstanding balance (FR-REQ-020).
    if (req.method === "POST" && action === "close") {
      if (r.status !== "APPROVED" && r.status !== "PARTIALLY_ISSUED") {
        return {
          status: 409,
          body: envelope("NO_OUTSTANDING_BALANCE", "There's no outstanding balance left to close."),
        };
      }
      const totalBalance = r.lines.reduce((s, l) => s + Number(l.balanceQuantity), 0);
      if (totalBalance <= 0)
        return {
          status: 409,
          body: envelope("NO_OUTSTANDING_BALANCE", "There's no outstanding balance left to close."),
        };
      const reason = String(b.reason ?? "").trim();
      if (!reason)
        return {
          status: 400,
          body: envelope("VALIDATION_ERROR", "Enter a reason for closing this requisition."),
        };
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

  const g = globalThis as unknown as {
    __ZE_MOCK_HR__?: { employees: MockEmployee[]; assignments: MockAssignment[]; seq: number };
  };
  if (!g.__ZE_MOCK_HR__) {
    const mkEmp = (
      o: Partial<MockEmployee> &
        Pick<
          MockEmployee,
          "id" | "employeeCode" | "name" | "workBase" | "wageType" | "wageAmount" | "joiningDate"
        >,
    ): MockEmployee => ({
      designation: null,
      defaultProjectId: null,
      department: null,
      bankName: null,
      bankAccountName: null,
      bankAccountNo: null,
      pfApplicable: false,
      gratuityApplicable: false,
      wppfApplicable: false,
      tin: null,
      status: "ACTIVE",
      hasReferences: false,
      version: 1,
      ...o,
    });
    const employees: MockEmployee[] = [
      mkEmp({
        id: "emp-1",
        employeeCode: "EMP-001",
        name: "মোঃ রফিকুল ইসলাম",
        designation: "Site Accountant",
        defaultProjectId: "proj-a",
        department: "Accounts",
        workBase: "SITE",
        wageType: "MONTHLY",
        wageAmount: "45000.0000",
        bankName: "Dutch-Bangla Bank",
        bankAccountName: "Md Rafiqul Islam",
        bankAccountNo: "1234567890",
        pfApplicable: true,
        gratuityApplicable: true,
        tin: "123456789012",
        joiningDate: "2024-03-01",
        hasReferences: true,
        version: 3,
      }),
      mkEmp({
        id: "emp-2",
        employeeCode: "EMP-002",
        name: "Farzana Akter",
        designation: "Site Engineer",
        defaultProjectId: "proj-a",
        department: "Engineering",
        workBase: "SITE",
        wageType: "MONTHLY",
        wageAmount: "60000.0000",
        bankName: "BRAC Bank",
        bankAccountName: "Farzana Akter",
        bankAccountNo: "9988771234",
        pfApplicable: true,
        gratuityApplicable: true,
        tin: "223344556677",
        joiningDate: "2023-06-15",
        version: 2,
      }),
      mkEmp({
        id: "emp-3",
        employeeCode: "EMP-003",
        name: "Ashraful Alam",
        designation: "Project Coordinator",
        defaultProjectId: "proj-b",
        department: "Operations",
        workBase: "HEAD_OFFICE",
        wageType: "MONTHLY",
        wageAmount: "72000.0000",
        bankName: "City Bank",
        bankAccountName: "Ashraful Alam",
        bankAccountNo: "5566779988",
        pfApplicable: true,
        gratuityApplicable: true,
        joiningDate: "2022-11-01",
        version: 4,
      }),
      mkEmp({
        id: "emp-4",
        employeeCode: "EMP-004",
        name: "Nusrat Jahan",
        designation: "HR Assistant",
        department: "HR",
        workBase: "HEAD_OFFICE",
        wageType: "MONTHLY",
        wageAmount: "38000.0000",
        bankName: "Dutch-Bangla Bank",
        bankAccountName: "Nusrat Jahan",
        bankAccountNo: "1122334455",
        joiningDate: "2025-01-10",
        version: 1,
      }),
      mkEmp({
        id: "emp-5",
        employeeCode: "EMP-005",
        name: "Kamal Hossain",
        designation: "Storekeeper",
        defaultProjectId: "proj-c",
        department: "Store",
        workBase: "SITE",
        wageType: "DAILY",
        wageAmount: "1200.0000",
        joiningDate: "2024-08-20",
        status: "INACTIVE",
        version: 2,
      }),
      mkEmp({
        id: "emp-6",
        employeeCode: "EMP-006",
        name: "Salma Begum",
        designation: "Accounts Officer",
        defaultProjectId: null,
        department: "Accounts",
        workBase: "HEAD_OFFICE",
        wageType: "MONTHLY",
        wageAmount: "42000.0000",
        bankName: "Prime Bank",
        bankAccountName: "Salma Begum",
        bankAccountNo: "7788994455",
        tin: "998877665544",
        joiningDate: "2024-05-05",
        version: 1,
      }),
    ];
    const assignments: MockAssignment[] = [
      {
        id: "asg-1",
        employeeId: "emp-1",
        projectId: "proj-a",
        effectiveDate: "2024-03-01",
        note: "Initial assignment",
      },
      {
        id: "asg-2",
        employeeId: "emp-2",
        projectId: "proj-a",
        effectiveDate: "2023-06-15",
        note: "Initial assignment",
      },
      {
        id: "asg-3",
        employeeId: "emp-3",
        projectId: "proj-b",
        effectiveDate: "2022-11-01",
        note: "Initial assignment",
      },
      {
        id: "asg-4",
        employeeId: "emp-5",
        projectId: "proj-c",
        effectiveDate: "2024-08-20",
        note: "Initial assignment",
      },
      {
        id: "asg-5",
        employeeId: "emp-6",
        projectId: null as unknown as string,
        effectiveDate: "2024-05-05",
        note: "Initial assignment",
      },
    ].filter((a) => a.projectId != null);
    g.__ZE_MOCK_HR__ = { employees, assignments, seq: 100 };
  }
  const HR = g.__ZE_MOCK_HR__;

  function maskBank(e: MockEmployee): {
    bankAccountName: string | null;
    bankAccountNo: string | null;
    bankMasked: boolean;
  } {
    if (!e.bankAccountNo && !e.bankAccountName)
      return { bankAccountName: null, bankAccountNo: null, bankMasked: true };
    const last4 = (v: string | null) => (v && v.length >= 4 ? `•••• ${v.slice(-4)}` : v);
    return {
      bankAccountName: last4(e.bankAccountName),
      bankAccountNo: last4(e.bankAccountNo),
      bankMasked: true,
    };
  }
  function employeeResource(e: MockEmployee, reveal: boolean) {
    if (reveal) {
      return {
        id: e.id,
        employeeCode: e.employeeCode,
        name: e.name,
        designation: e.designation,
        defaultProjectId: e.defaultProjectId,
        department: e.department,
        workBase: e.workBase,
        wageType: e.wageType,
        wageAmount: e.wageAmount,
        bankName: e.bankName,
        bankAccountName: e.bankAccountName,
        bankAccountNo: e.bankAccountNo,
        bankMasked: false,
        pfApplicable: e.pfApplicable,
        gratuityApplicable: e.gratuityApplicable,
        wppfApplicable: e.wppfApplicable,
        tin: e.tin,
        joiningDate: e.joiningDate,
        status: e.status,
        hasReferences: e.hasReferences,
        version: e.version,
      };
    }
    const mask = maskBank(e);
    return {
      id: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      designation: e.designation,
      defaultProjectId: e.defaultProjectId,
      department: e.department,
      workBase: e.workBase,
      wageType: e.wageType,
      wageAmount: e.wageAmount,
      bankName: e.bankName,
      bankAccountName: mask.bankAccountName,
      bankAccountNo: mask.bankAccountNo,
      bankMasked: mask.bankMasked,
      pfApplicable: e.pfApplicable,
      gratuityApplicable: e.gratuityApplicable,
      wppfApplicable: e.wppfApplicable,
      tin: e.tin,
      joiningDate: e.joiningDate,
      status: e.status,
      hasReferences: e.hasReferences,
      version: e.version,
    };
  }
  function employeeSummary(e: MockEmployee) {
    return {
      id: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      designation: e.designation,
      defaultProjectId: e.defaultProjectId,
      workBase: e.workBase,
      wageType: e.wageType,
      wageAmount: e.wageAmount,
      status: e.status,
      hasReferences: e.hasReferences,
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
    if (q)
      rows = rows.filter(
        (e) => e.employeeCode.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
      );
    return { status: 200, body: pageEnvelope(rows.map(employeeSummary)) };
  }

  // POST /hr/employees — create
  if (pathname === "/hr/employees" && req.method === "POST") {
    if (!hrCanWrite())
      return {
        status: 403,
        body: envelope("FORBIDDEN", "You don't have permission to create employees."),
      };
    const b = body as Partial<MockEmployee>;
    if (!b.employeeCode || String(b.employeeCode).trim() === "")
      return { status: 400, body: envelope("VALIDATION_ERROR", "Enter an employee code.") };
    if (!b.name || String(b.name).trim() === "")
      return { status: 400, body: envelope("VALIDATION_ERROR", "Enter the employee's name.") };
    if (!b.workBase)
      return { status: 400, body: envelope("VALIDATION_ERROR", "Select a work base.") };
    if (!b.wageType)
      return { status: 400, body: envelope("VALIDATION_ERROR", "Select a wage type.") };
    if (!b.joiningDate)
      return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a joining date.") };
    if (Number(b.wageAmount ?? "0") < 0)
      return {
        status: 400,
        body: envelope("VALIDATION_ERROR", "Enter a wage amount of ৳0 or more."),
      };
    if (b.tin && !/^\d{12}$/.test(String(b.tin)))
      return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a valid TIN.") };
    if (HR.employees.some((e) => e.employeeCode === b.employeeCode)) {
      return {
        status: 409,
        body: envelope("DUPLICATE_CODE", "This employee code is already in use."),
      };
    }
    if (b.defaultProjectId && !MOCK_PROJECTS.some((p) => p.id === b.defaultProjectId)) {
      return {
        status: 400,
        body: envelope("CROSS_COMPANY_REFERENCE", "That project belongs to a different company."),
      };
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
  const empMatch =
    /^\/hr\/employees\/([^/]+)(?:\/(reassign|deactivate|reactivate|assignments))?$/.exec(
      pathname ?? "",
    );
  if (empMatch) {
    const id = empMatch[1]!;
    const action = empMatch[2];
    const emp = HR.employees.find((e) => e.id === id);
    if (!emp) return { status: 404, body: envelope("NOT_FOUND", "Employee not found.") };
    const b = body as Partial<MockEmployee> & {
      version?: number;
      projectId?: string;
      effectiveDate?: string;
      note?: string | null;
    };

    if (req.method === "GET" && !action) {
      const reveal = params.get("reveal") === "true";
      if (reveal && !hrCanWrite()) {
        return {
          status: 403,
          body: envelope("FORBIDDEN", "You don't have permission to reveal bank details."),
        };
      }
      return { status: 200, body: success(employeeResource(emp, reveal)) };
    }

    if (req.method === "GET" && action === "assignments") {
      const rows = HR.assignments
        .filter((a) => a.employeeId === id)
        .slice()
        .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1));
      return { status: 200, body: success(rows) };
    }

    if (req.method === "PATCH" && !action) {
      if (!hrCanWrite())
        return {
          status: 403,
          body: envelope("FORBIDDEN", "You don't have permission to edit employees."),
        };
      if (typeof b.version !== "number" || b.version !== emp.version) {
        return {
          status: 409,
          body: envelope(
            "OPTIMISTIC_LOCK_CONFLICT",
            "This employee was just changed by someone else. Reload and try again.",
          ),
        };
      }
      if (
        (b as { employeeCode?: string }).employeeCode &&
        (b as { employeeCode?: string }).employeeCode !== emp.employeeCode
      ) {
        if (emp.hasReferences) {
          return {
            status: 409,
            body: envelope(
              "IMMUTABLE_EMPLOYEE_CODE",
              "This employee code can't be changed — it's already used in attendance or salary.",
            ),
          };
        }
      }
      if (b.defaultProjectId && !MOCK_PROJECTS.some((p) => p.id === b.defaultProjectId)) {
        return {
          status: 400,
          body: envelope("CROSS_COMPANY_REFERENCE", "That project belongs to a different company."),
        };
      }
      if (b.wageAmount !== undefined && Number(b.wageAmount) < 0) {
        return {
          status: 400,
          body: envelope("VALIDATION_ERROR", "Enter a wage amount of ৳0 or more."),
        };
      }
      if (b.tin && !/^\d{12}$/.test(String(b.tin))) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a valid TIN.") };
      }
      Object.assign(emp, {
        name: b.name ?? emp.name,
        designation: b.designation === undefined ? emp.designation : b.designation,
        defaultProjectId:
          b.defaultProjectId === undefined ? emp.defaultProjectId : b.defaultProjectId,
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
      if (!hrCanWrite())
        return {
          status: 403,
          body: envelope("FORBIDDEN", "You don't have permission to reassign employees."),
        };
      if (typeof b.version !== "number" || b.version !== emp.version) {
        return {
          status: 409,
          body: envelope(
            "OPTIMISTIC_LOCK_CONFLICT",
            "This employee was just changed by someone else. Reload and try again.",
          ),
        };
      }
      const projectId = String(b.projectId ?? "");
      const effectiveDate = String(b.effectiveDate ?? "");
      if (!projectId)
        return { status: 400, body: envelope("VALIDATION_ERROR", "Select a project.") };
      if (!MOCK_PROJECTS.some((p) => p.id === projectId)) {
        return {
          status: 400,
          body: envelope("CROSS_COMPANY_REFERENCE", "That project belongs to a different company."),
        };
      }
      if (!effectiveDate)
        return { status: 400, body: envelope("VALIDATION_ERROR", "Enter an effective date.") };
      if (effectiveDate < emp.joiningDate) {
        return {
          status: 400,
          body: envelope("VALIDATION_ERROR", "Effective date can't be before the joining date."),
        };
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
      if (!hrCanWrite())
        return { status: 403, body: envelope("FORBIDDEN", "You don't have permission.") };
      if (typeof b.version !== "number" || b.version !== emp.version) {
        return {
          status: 409,
          body: envelope(
            "OPTIMISTIC_LOCK_CONFLICT",
            "This employee was just changed by someone else. Reload and try again.",
          ),
        };
      }
      emp.status = "INACTIVE";
      emp.version += 1;
      return { status: 200, body: success(employeeResource(emp, false)) };
    }

    if (req.method === "POST" && action === "reactivate") {
      if (!hrCanWrite())
        return { status: 403, body: envelope("FORBIDDEN", "You don't have permission.") };
      if (typeof b.version !== "number" || b.version !== emp.version) {
        return {
          status: 409,
          body: envelope(
            "OPTIMISTIC_LOCK_CONFLICT",
            "This employee was just changed by someone else. Reload and try again.",
          ),
        };
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
  const ga = globalThis as unknown as {
    __ZE_MOCK_ATT__?: { rows: MockAttendance[]; seq: number; dlaSeq: number };
  };
  if (!ga.__ZE_MOCK_ATT__) {
    const seed: MockAttendance[] = [
      // Office (2 rows for today)
      {
        id: "att-off-1",
        mode: "OFFICE",
        attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a",
        costCentreId: null,
        purposeId: null,
        employeeId: "emp-1",
        checkIn: "09:15",
        checkOut: "18:05",
        dayStatus: "PRESENT",
        overtimeHours: "1.500",
        partyId: null,
        headCount: null,
        labourCategory: null,
        dailyRate: null,
        source: "MANUAL",
        isConfirmed: false,
        accrualEntryId: null,
        entryNo: null,
        accruedAmount: null,
        postedAt: null,
        postedBy: null,
        reversalEntryNo: null,
        reversalEntryId: null,
        version: 1,
      },
      {
        id: "att-off-2",
        mode: "OFFICE",
        attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a",
        costCentreId: null,
        purposeId: null,
        employeeId: "emp-2",
        checkIn: "09:02",
        checkOut: "17:58",
        dayStatus: "PRESENT",
        overtimeHours: "0.000",
        partyId: null,
        headCount: null,
        labourCategory: null,
        dailyRate: null,
        source: "BIOMETRIC_IMPORT",
        isConfirmed: false,
        accrualEntryId: null,
        entryNo: null,
        accruedAmount: null,
        postedAt: null,
        postedBy: null,
        reversalEntryNo: null,
        reversalEntryId: null,
        version: 1,
      },
      // Daily labour (one CONFIRMED with entryNo, two UNCONFIRMED)
      {
        id: "att-dl-1",
        mode: "DAILY_LABOUR",
        attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a",
        costCentreId: "cc-lab",
        purposeId: "pp-1",
        employeeId: null,
        checkIn: null,
        checkOut: null,
        dayStatus: null,
        overtimeHours: null,
        partyId: null,
        headCount: 20,
        labourCategory: "Mason",
        dailyRate: "650.0000",
        source: "MANUAL",
        isConfirmed: true,
        accrualEntryId: "je-dla-42",
        entryNo: "SJ/2526/0042",
        accruedAmount: "13000.0000",
        postedAt: new Date().toISOString(),
        postedBy: "00000000-0000-0000-0000-000000000001",
        reversalEntryNo: null,
        reversalEntryId: null,
        version: 2,
      },
      {
        id: "att-dl-2",
        mode: "DAILY_LABOUR",
        attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a",
        costCentreId: "cc-lab",
        purposeId: null,
        employeeId: null,
        checkIn: null,
        checkOut: null,
        dayStatus: null,
        overtimeHours: null,
        partyId: null,
        headCount: 12,
        labourCategory: "Helper",
        dailyRate: "450.0000",
        source: "MANUAL",
        isConfirmed: false,
        accrualEntryId: null,
        entryNo: null,
        accruedAmount: null,
        postedAt: null,
        postedBy: null,
        reversalEntryNo: null,
        reversalEntryId: null,
        version: 1,
      },
      {
        id: "att-dl-3",
        mode: "DAILY_LABOUR",
        attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a",
        costCentreId: "cc-tmp",
        purposeId: null,
        employeeId: null,
        checkIn: null,
        checkOut: null,
        dayStatus: null,
        overtimeHours: null,
        partyId: null,
        headCount: 8,
        labourCategory: "Formwork",
        dailyRate: "700.0000",
        source: "MANUAL",
        isConfirmed: false,
        accrualEntryId: null,
        entryNo: null,
        accruedAmount: null,
        postedAt: null,
        postedBy: null,
        reversalEntryNo: null,
        reversalEntryId: null,
        version: 1,
      },
      // Subcontractor (2 rows)
      {
        id: "att-sub-1",
        mode: "SUBCONTRACTOR",
        attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a",
        costCentreId: "cc-sub",
        purposeId: null,
        employeeId: null,
        checkIn: null,
        checkOut: null,
        dayStatus: null,
        overtimeHours: null,
        partyId: "pa-4",
        headCount: 25,
        labourCategory: null,
        dailyRate: null,
        source: "MANUAL",
        isConfirmed: false,
        accrualEntryId: null,
        entryNo: null,
        accruedAmount: null,
        postedAt: null,
        postedBy: null,
        reversalEntryNo: null,
        reversalEntryId: null,
        version: 1,
      },
      {
        id: "att-sub-2",
        mode: "SUBCONTRACTOR",
        attendanceDate: new Date().toISOString().slice(0, 10),
        projectId: "proj-a",
        costCentreId: "cc-sub",
        purposeId: null,
        employeeId: null,
        checkIn: null,
        checkOut: null,
        dayStatus: null,
        overtimeHours: null,
        partyId: "pa-7",
        headCount: 15,
        labourCategory: null,
        dailyRate: null,
        source: "MANUAL",
        isConfirmed: false,
        accrualEntryId: null,
        entryNo: null,
        accruedAmount: null,
        postedAt: null,
        postedBy: null,
        reversalEntryNo: null,
        reversalEntryId: null,
        version: 1,
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
    if (!Array.isArray(b.rows))
      return { status: 400, body: envelope("VALIDATION_ERROR", "rows[] is required") };
    const ids: string[] = [];
    for (const raw of b.rows as Array<Record<string, unknown>>) {
      const employeeId = String(raw.employeeId ?? "");
      const attendanceDate = String(raw.attendanceDate ?? "");
      const projectId = String(raw.projectId ?? "");
      const dayStatus = String(raw.dayStatus ?? "");
      if (!employeeId || !attendanceDate || !projectId || !dayStatus) {
        return {
          status: 400,
          body: envelope(
            "VALIDATION_ERROR",
            "Some fields need attention. Please check and try again.",
          ),
        };
      }
      // Upsert per (employeeId, attendanceDate).
      const existing = ATT.rows.find(
        (r) =>
          r.mode === "OFFICE" && r.employeeId === employeeId && r.attendanceDate === attendanceDate,
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
          id,
          mode: "OFFICE",
          attendanceDate,
          projectId,
          costCentreId: null,
          purposeId: null,
          employeeId,
          checkIn: (raw.checkIn as string) ?? null,
          checkOut: (raw.checkOut as string) ?? null,
          dayStatus,
          overtimeHours: (raw.overtimeHours as string) ?? null,
          partyId: null,
          headCount: null,
          labourCategory: null,
          dailyRate: null,
          source: "MANUAL",
          isConfirmed: false,
          accrualEntryId: null,
          entryNo: null,
          accruedAmount: null,
          postedAt: null,
          postedBy: null,
          reversalEntryNo: null,
          reversalEntryId: null,
          version: 1,
        });
        ids.push(id);
      }
    }
    return { status: 201, body: success({ ids }) };
  }

  // POST /attendance/office/import — biometric feed reconciled to one OFFICE row/employee/day.
  // Mirrors the real backend: a top-level projectId (applied to every row), an employeeCode-keyed
  // deviceFeed, direct insert of non-conflicting rows, and info-only conflicts.
  if (pathname === "/attendance/office/import" && req.method === "POST") {
    const b = body as { projectId?: unknown; deviceFeed?: unknown; rows?: unknown };
    const projectId = String(b.projectId ?? "");
    if (!projectId) {
      return { status: 400, body: envelope("VALIDATION_ERROR", "projectId must be a UUID") };
    }
    const feed = Array.isArray(b.deviceFeed) ? b.deviceFeed : Array.isArray(b.rows) ? b.rows : [];
    const conflicts: Array<Record<string, unknown>> = [];
    let reconciled = 0;
    for (const raw of feed as Array<Record<string, unknown>>) {
      const employeeCode = String(raw.employeeCode ?? raw.employeeId ?? "");
      const attendanceDate = String(raw.attendanceDate ?? "");
      const existing = ATT.rows.find(
        (r) =>
          r.mode === "OFFICE" && r.employeeId === employeeCode && r.attendanceDate === attendanceDate,
      );
      if (existing) {
        conflicts.push({ employeeId: employeeCode, attendanceDate, reason: "ALREADY_RECORDED" });
        continue;
      }
      ATT.rows.push({
        id: `att-off-${(ATT.seq += 1)}`,
        mode: "OFFICE",
        attendanceDate,
        projectId,
        costCentreId: null,
        purposeId: null,
        employeeId: employeeCode,
        checkIn: (raw.checkIn as string) ?? null,
        checkOut: (raw.checkOut as string) ?? null,
        dayStatus: (raw.dayStatus as string) ?? "PRESENT",
        overtimeHours: (raw.overtimeHours as string) ?? "0",
        partyId: null,
        headCount: null,
        labourCategory: null,
        dailyRate: null,
        source: "BIOMETRIC_IMPORT",
        isConfirmed: false,
        accrualEntryId: null,
        entryNo: null,
        accruedAmount: null,
        postedAt: null,
        postedBy: null,
        reversalEntryNo: null,
        reversalEntryId: null,
        version: 1,
      });
      reconciled += 1;
    }
    return {
      status: 200,
      body: success({ imported: feed.length, reconciled, conflicts }),
    };
  }

  // POST /attendance/subcontractor — bulk save
  if (pathname === "/attendance/subcontractor" && req.method === "POST") {
    const b = body as { rows?: unknown };
    if (!Array.isArray(b.rows))
      return { status: 400, body: envelope("VALIDATION_ERROR", "rows[] is required") };
    const ids: string[] = [];
    for (const raw of b.rows as Array<Record<string, unknown>>) {
      const partyId = String(raw.partyId ?? "");
      const projectId = String(raw.projectId ?? "");
      const costCentreId = String(raw.costCentreId ?? "");
      const headCount = Number(raw.headCount ?? 0);
      const attendanceDate = String(raw.attendanceDate ?? "");
      if (!partyId || !projectId || !costCentreId || headCount < 1 || !attendanceDate) {
        return {
          status: 400,
          body: envelope(
            "VALIDATION_ERROR",
            "Some fields need attention. Please check and try again.",
          ),
        };
      }
      const id = `att-sub-${(ATT.seq += 1)}`;
      ATT.rows.push({
        id,
        mode: "SUBCONTRACTOR",
        attendanceDate,
        projectId,
        costCentreId,
        purposeId: (raw.purposeId as string) ?? null,
        employeeId: null,
        checkIn: null,
        checkOut: null,
        dayStatus: null,
        overtimeHours: null,
        partyId,
        headCount,
        labourCategory: null,
        dailyRate: null,
        source: "MANUAL",
        isConfirmed: false,
        accrualEntryId: null,
        entryNo: null,
        accruedAmount: null,
        postedAt: null,
        postedBy: null,
        reversalEntryNo: null,
        reversalEntryId: null,
        version: 1,
      });
      ids.push(id);
    }
    return { status: 201, body: success({ ids }) };
  }

  // POST /attendance/daily-labour — bulk create UNCONFIRMED rows
  if (pathname === "/attendance/daily-labour" && req.method === "POST") {
    const b = body as { rows?: unknown };
    if (!Array.isArray(b.rows))
      return { status: 400, body: envelope("VALIDATION_ERROR", "rows[] is required") };
    const ids: string[] = [];
    for (const raw of b.rows as Array<Record<string, unknown>>) {
      const attendanceDate = String(raw.attendanceDate ?? "");
      const projectId = String(raw.projectId ?? "");
      const costCentreId = String(raw.costCentreId ?? "");
      const headCount = Number(raw.headCount ?? 0);
      const dailyRate = String(raw.dailyRate ?? "0");
      if (
        !attendanceDate ||
        !projectId ||
        !costCentreId ||
        headCount < 1 ||
        Number(dailyRate) < 0
      ) {
        return {
          status: 400,
          body: envelope(
            "VALIDATION_ERROR",
            "Some fields need attention. Please check and try again.",
          ),
        };
      }
      const id = `att-dl-${(ATT.seq += 1)}`;
      ATT.rows.push({
        id,
        mode: "DAILY_LABOUR",
        attendanceDate,
        projectId,
        costCentreId,
        purposeId: (raw.purposeId as string) ?? null,
        employeeId: null,
        checkIn: null,
        checkOut: null,
        dayStatus: null,
        overtimeHours: null,
        partyId: null,
        headCount,
        labourCategory: (raw.labourCategory as string) ?? null,
        dailyRate,
        source: "MANUAL",
        isConfirmed: false,
        accrualEntryId: null,
        entryNo: null,
        accruedAmount: null,
        postedAt: null,
        postedBy: null,
        reversalEntryNo: null,
        reversalEntryId: null,
        version: 1,
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
        return {
          status: 409,
          body: envelope(
            "ATTENDANCE_CONFIRMED_IMMUTABLE",
            "This row has been confirmed and can no longer be edited — use Reverse to correct it.",
          ),
        };
      }
      if (typeof b.version !== "number" || b.version !== row.version) {
        return {
          status: 409,
          body: envelope(
            "OPTIMISTIC_LOCK_CONFLICT",
            "This row was just changed by someone else. Reload and try again.",
          ),
        };
      }
      if (b.headCount !== undefined) {
        const hc = Number(b.headCount);
        if (!Number.isFinite(hc) || hc < 1) {
          return {
            status: 400,
            body: envelope("VALIDATION_ERROR", "Enter a head count of 1 or more."),
          };
        }
        row.headCount = hc;
      }
      if (b.dailyRate !== undefined) {
        if (Number(b.dailyRate) < 0) {
          return {
            status: 400,
            body: envelope("VALIDATION_ERROR", "Enter a daily rate of ৳0 or more."),
          };
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
        return {
          status: 409,
          body: envelope("ALREADY_CONFIRMED", "This row has already been confirmed."),
        };
      }
      const purposeId = row.purposeId || (b.purposeId as string) || null;
      if (!purposeId) {
        return {
          status: 400,
          body: envelope(
            "MISSING_REQUIRED_DIMENSION",
            "A purpose is required to post the accrual.",
          ),
        };
      }
      if (!row.costCentreId) {
        return {
          status: 400,
          body: envelope(
            "MISSING_REQUIRED_DIMENSION",
            "A cost centre is required to post the accrual.",
          ),
        };
      }
      if (isPeriodClosed(row.attendanceDate)) {
        return {
          status: 409,
          body: envelope(
            "PERIOD_CLOSED",
            "This accounting period is closed — posting isn't allowed.",
          ),
        };
      }
      const project = MOCK_PROJECTS.find((p) => p.id === row.projectId);
      if (project && project.status === "CLOSED") {
        return {
          status: 409,
          body: envelope("PROJECT_CLOSED", "This project is closed — posting isn't allowed."),
        };
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
        return {
          status: 409,
          body: envelope("NOT_CONFIRMED", "There's nothing to reverse — this row isn't confirmed."),
        };
      }
      if (row.reversalEntryNo) {
        return {
          status: 409,
          body: envelope("ALREADY_REVERSED", "This accrual has already been reversed."),
        };
      }
      const reason = String((b as { reason?: unknown }).reason ?? "").trim();
      if (!reason) {
        return {
          status: 400,
          body: envelope("VALIDATION_ERROR", "Enter a reason for reversing this accrual."),
        };
      }
      if (isPeriodClosed(row.attendanceDate)) {
        return {
          status: 409,
          body: envelope(
            "PERIOD_CLOSED",
            "This accounting period is closed — posting isn't allowed.",
          ),
        };
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
  const gs = globalThis as unknown as {
    __ZE_MOCK_SAL__?: { sheets: MockSalarySheet[]; seq: number; noSeq: number };
  };
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
          id: "sl-draft-1",
          employeeId: "emp-1",
          employeeCode: "EMP-001",
          employeeName: "মোঃ রফিকুল ইসলাম",
          designation: "Site Accountant",
          pfApplicable: true,
          projectId: "proj-a",
          costCentreId: "cc-lab",
          purposeId: "pp-1",
          paidDays: "30.000",
          grossAmount: "45000.0000",
          allowances: "0",
          tdsAmount: "0",
          tdsRate: null,
          pfAmount: "2000.0000",
          advanceRecovery: "0",
          otherDeductions: "0",
          netAmount: "0",
          version: 1,
        },
        {
          id: "sl-draft-2",
          employeeId: "emp-2",
          employeeCode: "EMP-002",
          employeeName: "Farzana Akter",
          designation: "Site Engineer",
          pfApplicable: true,
          projectId: "proj-a",
          costCentreId: "cc-lab",
          purposeId: "pp-1",
          paidDays: "30.000",
          grossAmount: "60000.0000",
          allowances: "0",
          tdsAmount: "0",
          tdsRate: null,
          pfAmount: "3000.0000",
          advanceRecovery: "0",
          otherDeductions: "0",
          netAmount: "0",
          version: 1,
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
    gs.__ZE_MOCK_SAL__ = {
      sheets: [seededDraft, seededPosted, seededReversed],
      seq: 100,
      noSeq: 3,
    };
  }
  const SAL = gs.__ZE_MOCK_SAL__;
  function projectionOfSheet(s: MockSalarySheet, includeLines: boolean) {
    const base = {
      id: s.id,
      financialYearId: s.financialYearId,
      periodLabel: s.periodLabel,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      status: s.status,
      salaryEntryId: s.salaryEntryId,
      entryNo: s.entryNo,
      reversalEntryId: s.reversalEntryId,
      reversalEntryNo: s.reversalEntryNo,
      totalGross: s.totalGross,
      totalDeductions: s.totalDeductions,
      totalNet: s.totalNet,
      postedAt: s.postedAt,
      postedBy: s.postedBy,
      version: s.version,
    };
    return includeLines ? { ...base, lines: s.lines } : base;
  }
  function isSalaryPeriodClosed(end: string): boolean {
    return end <= "2025-03-31";
  }

  // POST /salary/sheets/generate
  if (pathname === "/salary/sheets/generate" && req.method === "POST") {
    const b = body as {
      financialYearId?: string;
      periodLabel?: string;
      periodStart?: string;
      periodEnd?: string;
      projectId?: string | null;
    };
    if (!b.financialYearId)
      return { status: 400, body: envelope("VALIDATION_ERROR", "Select a financial year.") };
    if (!b.periodLabel)
      return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a period label.") };
    if (!b.periodStart || !b.periodEnd)
      return { status: 400, body: envelope("VALIDATION_ERROR", "Enter a period range.") };
    if (b.periodEnd < b.periodStart)
      return {
        status: 400,
        body: envelope("VALIDATION_ERROR", "Period end can't be before period start."),
      };
    const dup = SAL.sheets.find((s) => s.periodLabel === b.periodLabel && s.status === "DRAFT");
    if (dup) {
      return {
        status: 409,
        body: {
          error: {
            code: "DUPLICATE_DRAFT_SHEET",
            message:
              "A draft salary sheet already exists for this period. Edit it instead of generating a new one.",
            details: { existingId: dup.id },
          },
          meta: { requestId: `mock-${Date.now()}` },
        },
      };
    }
    // Build a DRAFT from ACTIVE employees (INACTIVE excluded — FR-HR-003).
    const employees = (
      (globalThis as unknown as { __ZE_MOCK_HR__?: { employees: MockEmployee[] } }).__ZE_MOCK_HR__
        ?.employees ?? []
    ).filter((e) => e.status === "ACTIVE");
    const activeEmps = b.projectId
      ? employees.filter((e) => e.defaultProjectId === b.projectId)
      : employees;
    const newSheet: MockSalarySheet = {
      id: `sal-new-${(SAL.seq += 1)}`,
      financialYearId: String(b.financialYearId),
      periodLabel: String(b.periodLabel),
      periodStart: String(b.periodStart),
      periodEnd: String(b.periodEnd),
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
    return {
      status: 201,
      body: success({
        id: newSheet.id,
        status: newSheet.status,
        periodLabel: newSheet.periodLabel,
      }),
    };
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
        return {
          status: 409,
          body: envelope(
            "SALARY_NOT_DRAFT",
            "This salary sheet is already posted and can't be edited or posted again.",
          ),
        };
      }
      const lineId = smL[2]!;
      const line = sheet.lines.find((l) => l.id === lineId);
      if (!line) return { status: 404, body: envelope("NOT_FOUND", "Line not found.") };
      const b = body as {
        version?: number;
        allowances?: string;
        tdsAmount?: string;
        tdsRate?: string;
        pfAmount?: string;
        advanceRecovery?: string;
        otherDeductions?: string;
      };
      if (typeof b.version !== "number" || b.version !== line.version) {
        return {
          status: 409,
          body: envelope(
            "OPTIMISTIC_LOCK_CONFLICT",
            "This salary sheet was just changed by someone else. Reload and try again.",
          ),
        };
      }
      const nonNeg = (v: string | undefined, name: string): string | null => {
        if (v === undefined) return null;
        if (!/^\d*\.?\d*$/.test(v) || v === "" || Number(v) < 0)
          return `${name} can't be negative.`;
        return null;
      };
      for (const [name, v] of [
        ["Allowances", b.allowances],
        ["TDS", b.tdsAmount],
        ["PF", b.pfAmount],
        ["Advance recovery", b.advanceRecovery],
        ["Other deductions", b.otherDeductions],
      ] as const) {
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
          totals: {
            totalGross: sheet.totalGross,
            totalDeductions: sheet.totalDeductions,
            totalNet: sheet.totalNet,
          },
          version: sheet.version,
        }),
      };
    }

    if (smC && req.method === "PATCH") {
      if (sheet.status !== "DRAFT") {
        return {
          status: 409,
          body: envelope(
            "SALARY_NOT_DRAFT",
            "This salary sheet is already posted and can't be edited or posted again.",
          ),
        };
      }
      const b = body as {
        apply?: {
          allowances?: string;
          tdsRate?: string;
          pfAmount?: string;
          advanceRecovery?: string;
        };
        employeeIds?: string[] | null;
        version?: number;
      };
      if (typeof b.version !== "number" || b.version !== sheet.version) {
        return {
          status: 409,
          body: envelope(
            "OPTIMISTIC_LOCK_CONFLICT",
            "This salary sheet was just changed by someone else. Reload and try again.",
          ),
        };
      }
      const apply = b.apply ?? {};
      const targetLines =
        b.employeeIds && b.employeeIds.length > 0
          ? sheet.lines.filter((l) => b.employeeIds!.includes(l.employeeId))
          : sheet.lines;
      let changed = 0;
      for (const l of targetLines) {
        if (apply.allowances !== undefined) l.allowances = apply.allowances;
        if (apply.pfAmount !== undefined) l.pfAmount = apply.pfAmount;
        if (apply.advanceRecovery !== undefined) l.advanceRecovery = apply.advanceRecovery;
        if (apply.tdsRate !== undefined) {
          const rate = Number(apply.tdsRate);
          if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
            return {
              status: 400,
              body: envelope("VALIDATION_ERROR", "TDS rate must be between 0 and 100."),
            };
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
          totals: {
            totalGross: sheet.totalGross,
            totalDeductions: sheet.totalDeductions,
            totalNet: sheet.totalNet,
          },
          changedLineCount: changed,
          version: sheet.version,
        }),
      };
    }

    if (smP && req.method === "POST") {
      if (sheet.status !== "DRAFT") {
        return {
          status: 409,
          body: envelope(
            "SALARY_NOT_DRAFT",
            "This salary sheet is already posted and can't be edited or posted again.",
          ),
        };
      }
      const b = body as { version?: number };
      if (typeof b.version !== "number" || b.version !== sheet.version) {
        return {
          status: 409,
          body: envelope(
            "OPTIMISTIC_LOCK_CONFLICT",
            "This salary sheet was just changed by someone else. Reload and try again.",
          ),
        };
      }
      if (isSalaryPeriodClosed(sheet.periodEnd)) {
        return {
          status: 409,
          body: envelope(
            "PERIOD_CLOSED",
            "This period is closed — the salary run can't be posted.",
          ),
        };
      }
      for (const l of sheet.lines) {
        if (!l.projectId || !l.costCentreId || !l.purposeId) {
          return {
            status: 400,
            body: envelope(
              "MISSING_REQUIRED_DIMENSION",
              "One or more lines is missing a project, cost centre, or purpose — fix the line before posting.",
            ),
          };
        }
        const project = MOCK_PROJECTS.find((p) => p.id === l.projectId);
        if (project && project.status === "CLOSED") {
          return {
            status: 409,
            body: envelope(
              "PROJECT_CLOSED",
              "This project is closed — the salary run can't be posted.",
            ),
          };
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
        return {
          status: 409,
          body: envelope("ALREADY_REVERSED", "This salary run has already been reversed."),
        };
      }
      if (sheet.status !== "POSTED") {
        return {
          status: 409,
          body: envelope(
            "SALARY_NOT_POSTED",
            "This salary sheet isn't posted, so it can't be reversed.",
          ),
        };
      }
      const b = body as { reason?: string; version?: number };
      const reason = String(b.reason ?? "").trim();
      if (!reason)
        return {
          status: 400,
          body: envelope("VALIDATION_ERROR", "Enter a reason for reversing this salary run."),
        };
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
        return {
          status: 409,
          body: envelope(
            "SALARY_NOT_POSTED",
            "This salary sheet isn't posted, so it can't be reversed.",
          ),
        };
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
          deductions: {
            tds: l.tdsAmount,
            pf: l.pfAmount,
            advanceRecovery: l.advanceRecovery,
            other: l.otherDeductions,
          },
          netAmount: l.netAmount,
        }));
      return { status: 200, body: success(list) };
    }
  }

  // ── Purchase / Orders (fe-purchase-orders) — non-posting commitment lifecycle ──
  //
  // Draft-only edits + Approve (server-confirmed) + Cancel (mandatory reason). No ledger
  // write, no gapless number — the PO carries its own `poRefNo` (FR-PUR-001/-002/-024).
  // Seed carries three POs so the list renders populated on first visit.
  if (pathname?.startsWith("/purchase/orders")) {
    const orderMatch = /^\/purchase\/orders(?:\/([^/]+))?(?:\/(approve|cancel))?$/.exec(pathname);
    if (orderMatch) {
      const id = orderMatch[1];
      const action = orderMatch[2];

      if (!id && req.method === "GET") {
        let rows = MOCK_POS.slice().filter((o) => scopeOk(o.projectId));
        const projectId = params.get("projectId");
        const supplierId = params.get("supplierId");
        const statusCsv = params.get("status");
        const dateFrom = params.get("dateFrom");
        const dateTo = params.get("dateTo");
        if (projectId) rows = rows.filter((r) => r.projectId === projectId);
        if (supplierId) rows = rows.filter((r) => r.supplierId === supplierId);
        if (statusCsv) {
          const wanted = new Set(statusCsv.split(","));
          rows = rows.filter((r) => wanted.has(r.status));
        }
        if (dateFrom) rows = rows.filter((r) => r.poDate >= dateFrom);
        if (dateTo) rows = rows.filter((r) => r.poDate <= dateTo);
        rows.sort((a, b) => (a.poDate < b.poDate ? 1 : -1));
        const summaries = rows.map(poSummary);
        return { status: 200, body: pageEnvelope(summaries) };
      }

      if (!id && req.method === "POST") {
        const b = body as Partial<MockPo> & { lines?: MockPoLine[] };
        const project = MOCK_PROJECTS.find((p) => p.id === b.projectId);
        if (!project) return { status: 404, body: envelope("NOT_FOUND", "Project not found.") };
        if (!scopeOk(project.id))
          return {
            status: 403,
            body: envelope("FORBIDDEN", "You don't have access to this project."),
          };
        const lines = Array.isArray(b.lines) ? b.lines : [];
        if (lines.length === 0)
          return { status: 400, body: envelope("VALIDATION_ERROR", "Add at least one line.") };
        for (const [i, l] of lines.entries()) {
          if (!(Number(l.orderedQty) > 0)) {
            return {
              status: 400,
              body: envelope(
                "VALIDATION_ERROR",
                `Line ${i + 1}: ordered quantity must be greater than zero.`,
              ),
            };
          }
          const g = MOCK_GODOWNS.find((x) => x.id === l.godownId);
          if (g && g.projectId !== project.id) {
            return {
              status: 400,
              body: {
                error: {
                  code: "CROSS_PROJECT_DIMENSION",
                  message: "This godown doesn't belong to the selected project.",
                  details: { path: ["lines", i, "godownId"] },
                },
              },
            };
          }
        }
        const po = mkPo({
          id: `po-${(poSeq += 1)}`,
          projectId: project.id,
          supplierId: String(b.supplierId ?? ""),
          poDate: String(b.poDate ?? ""),
          expectedDeliveryDate: (b.expectedDeliveryDate as string | null | undefined) ?? null,
          narration: (b.narration as string | null | undefined) ?? null,
          lines: lines.map((l, idx) => ({
            lineNo: idx + 1,
            itemId: l.itemId,
            orderedQty: String(l.orderedQty),
            rate: String(l.rate),
            lineAmount: (Number(l.orderedQty) * Number(l.rate)).toFixed(4),
            godownId: l.godownId,
            costCentreId: l.costCentreId,
            purposeId: l.purposeId,
            billedQty: "0.0000",
            receivedQty: "0.0000",
          })),
          status: "DRAFT",
        });
        MOCK_POS.unshift(po);
        return {
          status: 201,
          body: {
            data: { id: po.id },
            meta: { requestId: "mock-po", budgetWarnings: poBudgetWarnings(po) },
          },
        };
      }

      // Below here: id-based reads / updates / actions.
      if (!id) return { status: 200, body: success({ ok: true, path: req.path }) };
      const po = MOCK_POS.find((p) => p.id === id);
      if (!po) return { status: 404, body: envelope("NOT_FOUND", "Purchase order not found.") };
      if (!scopeOk(po.projectId))
        return {
          status: 403,
          body: envelope("FORBIDDEN", "You don't have access to this purchase order."),
        };

      if (!action && req.method === "GET") {
        return { status: 200, body: success(poResource(po)) };
      }

      if (!action && req.method === "PATCH") {
        const b = body as Partial<MockPo> & { version?: number; lines?: MockPoLine[] };
        if (po.status !== "DRAFT") {
          return {
            status: 409,
            body: envelope("INVALID_PO_TRANSITION", "This purchase order is no longer a draft."),
          };
        }
        if (typeof b.version !== "number" || b.version !== po.version) {
          return {
            status: 409,
            body: envelope(
              "OPTIMISTIC_LOCK_CONFLICT",
              "This purchase order was just changed by someone else.",
            ),
          };
        }
        po.supplierId = String(b.supplierId ?? po.supplierId);
        po.poDate = String(b.poDate ?? po.poDate);
        po.expectedDeliveryDate =
          (b.expectedDeliveryDate as string | null | undefined) ?? po.expectedDeliveryDate;
        po.narration = (b.narration as string | null | undefined) ?? po.narration;
        if (Array.isArray(b.lines)) {
          po.lines = b.lines.map((l, idx) => ({
            lineNo: idx + 1,
            itemId: l.itemId,
            orderedQty: String(l.orderedQty),
            rate: String(l.rate),
            lineAmount: (Number(l.orderedQty) * Number(l.rate)).toFixed(4),
            godownId: l.godownId,
            costCentreId: l.costCentreId,
            purposeId: l.purposeId,
            billedQty: "0.0000",
            receivedQty: "0.0000",
          }));
        }
        po.version += 1;
        return {
          status: 200,
          body: {
            data: poResource(po),
            meta: { requestId: "mock-po", budgetWarnings: poBudgetWarnings(po) },
          },
        };
      }

      if (action === "approve" && req.method === "POST") {
        const b = body as { version?: number };
        if (po.status !== "DRAFT") {
          return {
            status: 409,
            body: envelope("INVALID_PO_TRANSITION", "This purchase order is not a draft."),
          };
        }
        if (typeof b.version !== "number" || b.version !== po.version) {
          return {
            status: 409,
            body: envelope(
              "OPTIMISTIC_LOCK_CONFLICT",
              "This purchase order was just changed by someone else.",
            ),
          };
        }
        po.status = "APPROVED";
        po.approvedBy = "u-admin";
        po.approvedAt = "2026-07-13T09:00:00Z";
        po.poRefNo = po.poRefNo ?? `PO-2026-${String(poSeq).padStart(4, "0")}`;
        po.version += 1;
        return {
          status: 200,
          body: success({
            id: po.id,
            status: po.status,
            approvedBy: po.approvedBy,
            approvedAt: po.approvedAt,
          }),
        };
      }

      if (action === "cancel" && req.method === "POST") {
        const b = body as { reason?: string; version?: number };
        if (po.status !== "DRAFT" && po.status !== "APPROVED") {
          return {
            status: 409,
            body: envelope(
              "INVALID_PO_TRANSITION",
              "This purchase order can no longer be cancelled.",
            ),
          };
        }
        if (!String(b.reason ?? "").trim()) {
          return {
            status: 400,
            body: envelope("VALIDATION_ERROR", "Enter a reason for the cancellation."),
          };
        }
        if (typeof b.version !== "number" || b.version !== po.version) {
          return {
            status: 409,
            body: envelope(
              "OPTIMISTIC_LOCK_CONFLICT",
              "This purchase order was just changed by someone else.",
            ),
          };
        }
        // e2e marker: a supplier id ending in "-bills" simulates the PO_HAS_BILLS block.
        if (po.supplierId.endsWith("-bills")) {
          return {
            status: 409,
            body: envelope(
              "PO_HAS_BILLS",
              "This PO already has a bill raised against it and can't be cancelled.",
            ),
          };
        }
        po.status = "CANCELLED";
        po.version += 1;
        return { status: 200, body: success({ id: po.id, status: po.status }) };
      }
    }
  }

  // ── Purchase / Bills (fe-purchase-bills) — POSTING voucher lifecycle ─────────
  //
  // Draft → Post (atomic; the mock allocates a gapless-style entryNo + a synthetic
  // journalEntryId) → Cancel (mandatory reason; supplier id ending in "-payments"
  // simulates the BILL_HAS_APPLIED_PAYMENTS block). No inventory-in modelling in the
  // mock — the FE viewer's inventory panel just displays the stock lines as posted.
  if (pathname?.startsWith("/purchase/bills")) {
    const billMatch = /^\/purchase\/bills(?:\/([^/]+))?(?:\/(post|cancel|repost))?$/.exec(pathname);
    if (billMatch) {
      const id = billMatch[1];
      const action = billMatch[2];

      if (!id && req.method === "GET") {
        let rows = MOCK_BILLS.slice().filter((b) => scopeOk(b.projectId));
        const projectId = params.get("projectId");
        const supplierId = params.get("supplierId");
        const statusCsv = params.get("status");
        const dateFrom = params.get("dateFrom");
        const dateTo = params.get("dateTo");
        if (projectId) rows = rows.filter((r) => r.projectId === projectId);
        if (supplierId) rows = rows.filter((r) => r.supplierId === supplierId);
        if (statusCsv) {
          const wanted = new Set(statusCsv.split(","));
          rows = rows.filter((r) => wanted.has(r.status));
        }
        if (dateFrom) rows = rows.filter((r) => r.billDate >= dateFrom);
        if (dateTo) rows = rows.filter((r) => r.billDate <= dateTo);
        rows.sort((a, b) => (a.billDate < b.billDate ? 1 : -1));
        return { status: 200, body: pageEnvelope(rows.map(billSummary)) };
      }

      if (!id && req.method === "POST") {
        const b = body as Partial<MockBill> & { lines?: MockBillLine[] };
        const project = MOCK_PROJECTS.find((p) => p.id === b.projectId);
        if (!project) return { status: 404, body: envelope("NOT_FOUND", "Project not found.") };
        if (!scopeOk(project.id))
          return {
            status: 403,
            body: envelope("FORBIDDEN", "You don't have access to this project."),
          };
        const lines = Array.isArray(b.lines) ? b.lines : [];
        if (lines.length === 0)
          return { status: 400, body: envelope("VALIDATION_ERROR", "Add at least one line.") };
        for (const [i, l] of lines.entries()) {
          const stock = !!l.isStockLine;
          if (stock && !(Number(l.billedQty) > 0)) {
            return {
              status: 400,
              body: envelope(
                "VALIDATION_ERROR",
                `Line ${i + 1}: billed quantity must be greater than zero.`,
              ),
            };
          }
          if (stock && !l.godownId) {
            return {
              status: 400,
              body: envelope(
                "VALIDATION_ERROR",
                `Line ${i + 1}: godown is required on a stock line.`,
              ),
            };
          }
          const g = MOCK_GODOWNS.find((x) => x.id === l.godownId);
          if (g && g.projectId !== project.id) {
            return {
              status: 400,
              body: {
                error: {
                  code: "CROSS_PROJECT_DIMENSION",
                  message: "This godown doesn't belong to the selected project.",
                  details: { path: ["lines", i, "godownId"] },
                },
              },
            };
          }
        }
        const built = mkBill({
          id: `bill-${(billSeq += 1)}`,
          projectId: project.id,
          supplierId: String(b.supplierId ?? ""),
          purchaseOrderId: (b.purchaseOrderId as string | null | undefined) ?? null,
          supplierInvoiceRef: (b.supplierInvoiceRef as string | null | undefined) ?? null,
          billDate: String(b.billDate ?? ""),
          dueDate: String(b.dueDate ?? ""),
          narration: (b.narration as string | null | undefined) ?? null,
          lines: lines.map((l, idx) => normalizeBillLine(l, idx)),
          status: "DRAFT",
        });
        if (Number(built.netPayableAmount) < 0) {
          return {
            status: 400,
            body: envelope(
              "NET_PAYABLE_NEGATIVE",
              "TDS and AIT together are larger than the gross plus VAT input — net payable can't be negative.",
            ),
          };
        }
        MOCK_BILLS.unshift(built);
        return {
          status: 201,
          body: { data: { id: built.id }, meta: { requestId: "mock-bill", budgetWarnings: [] } },
        };
      }

      if (!id) return { status: 200, body: success({ ok: true, path: req.path }) };
      const bill = MOCK_BILLS.find((b) => b.id === id);
      if (!bill) return { status: 404, body: envelope("NOT_FOUND", "Purchase bill not found.") };
      if (!scopeOk(bill.projectId))
        return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this bill.") };

      if (!action && req.method === "GET") {
        return { status: 200, body: success(billResource(bill)) };
      }

      if (!action && req.method === "PATCH") {
        const b = body as Partial<MockBill> & { version?: number; lines?: MockBillLine[] };
        if (bill.status !== "DRAFT") {
          return {
            status: 409,
            body: envelope(
              "VOUCHER_POSTED_IMMUTABLE",
              "This bill has been posted and can't be edited.",
            ),
          };
        }
        if (typeof b.version !== "number" || b.version !== bill.version) {
          return {
            status: 409,
            body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This bill was changed elsewhere."),
          };
        }
        bill.supplierId = String(b.supplierId ?? bill.supplierId);
        bill.billDate = String(b.billDate ?? bill.billDate);
        bill.dueDate = String(b.dueDate ?? bill.dueDate);
        bill.narration = (b.narration as string | null | undefined) ?? bill.narration;
        bill.supplierInvoiceRef =
          (b.supplierInvoiceRef as string | null | undefined) ?? bill.supplierInvoiceRef;
        bill.purchaseOrderId =
          (b.purchaseOrderId as string | null | undefined) ?? bill.purchaseOrderId;
        if (Array.isArray(b.lines)) {
          bill.lines = b.lines.map((l, idx) => normalizeBillLine(l, idx));
        }
        recomputeBill(bill);
        if (Number(bill.netPayableAmount) < 0) {
          return {
            status: 400,
            body: envelope(
              "NET_PAYABLE_NEGATIVE",
              "TDS and AIT together are larger than the gross plus VAT input — net payable can't be negative.",
            ),
          };
        }
        bill.version += 1;
        return {
          status: 200,
          body: { data: billResource(bill), meta: { requestId: "mock-bill", budgetWarnings: [] } },
        };
      }

      if (action === "post" && req.method === "POST") {
        const b = body as { version?: number };
        if (bill.status !== "DRAFT") {
          return {
            status: 409,
            body: envelope(
              "VOUCHER_POSTED_IMMUTABLE",
              "This bill has already been posted or cancelled.",
            ),
          };
        }
        if (typeof b.version !== "number" || b.version !== bill.version) {
          return {
            status: 409,
            body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This bill was changed elsewhere."),
          };
        }
        bill.status = "POSTED";
        bill.entryNo = bill.entryNo ?? `PUR/2526/${String(billSeq).padStart(4, "0")}`;
        bill.journalEntryId = bill.journalEntryId ?? `je-${bill.id}`;
        bill.postedAt = "2026-07-13T09:00:00Z";
        bill.postedBy = "u-admin";
        bill.outstandingAmount = bill.netPayableAmount;
        bill.version += 1;
        return {
          status: 200,
          body: success({
            id: bill.id,
            entryNo: bill.entryNo,
            journalEntryId: bill.journalEntryId,
            status: bill.status,
            netPayableAmount: bill.netPayableAmount,
          }),
        };
      }

      if (action === "cancel" && req.method === "POST") {
        const b = body as { reason?: string; version?: number };
        if (bill.status !== "POSTED") {
          return {
            status: 409,
            body: envelope("VOUCHER_NOT_POSTED", "This bill isn't posted — nothing to cancel."),
          };
        }
        if (!String(b.reason ?? "").trim()) {
          return {
            status: 400,
            body: envelope("VALIDATION_ERROR", "Enter a reason for this cancellation."),
          };
        }
        if (typeof b.version !== "number" || b.version !== bill.version) {
          return {
            status: 409,
            body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This bill was changed elsewhere."),
          };
        }
        // e2e marker: a supplier id ending in "-payments" simulates the applied-payments block.
        if (bill.supplierId.endsWith("-payments")) {
          return {
            status: 409,
            body: envelope(
              "BILL_HAS_APPLIED_PAYMENTS",
              "This bill has payments applied to it. Reverse or reallocate those payments first before cancelling.",
            ),
          };
        }
        bill.status = "CANCELLED";
        bill.version += 1;
        return {
          status: 200,
          body: success({
            id: bill.id,
            status: bill.status,
            reversalEntryId: `je-rev-${bill.id}`,
            reversalEntryNo: `PUR/2526/${String(billSeq + 100).padStart(4, "0")}`,
          }),
        };
      }
    }
  }

  // ── Purchase / Orders / {id}/match (fe-grn-matching, read-only) ─────────────
  //
  // Reconciles ordered vs billed vs received vs open per PO line, exposing the
  // per-line `matchStatus`. Read-only — no mutation. Bills and GRNs contribute
  // billed / received quantities (aggregated by itemId within the PO).
  {
    const matchM = pathname ? /^\/purchase\/orders\/([^/]+)\/match$/.exec(pathname) : null;
    if (matchM && req.method === "GET") {
      const poId = matchM[1]!;
      const po = MOCK_POS.find((p) => p.id === poId);
      if (!po) return { status: 404, body: envelope("NOT_FOUND", "Purchase order not found.") };
      if (!scopeOk(po.projectId)) {
        return {
          status: 403,
          body: envelope("FORBIDDEN", "You don't have access to this purchase order's match view."),
        };
      }
      const billedByItem = new Map<string, number>();
      for (const b of MOCK_BILLS) {
        if (b.purchaseOrderId !== poId) continue;
        if (b.status !== "POSTED") continue;
        for (const l of b.lines) {
          if (!l.itemId || !l.isStockLine) continue;
          billedByItem.set(
            l.itemId,
            (billedByItem.get(l.itemId) ?? 0) + Number(l.billedQty || "0"),
          );
        }
      }
      const receivedByItem = new Map<string, number>();
      for (const g of MOCK_GRNS) {
        if (g.purchaseOrderId !== poId) continue;
        if (g.status !== "POSTED") continue;
        for (const l of g.lines) {
          receivedByItem.set(
            l.itemId,
            (receivedByItem.get(l.itemId) ?? 0) + Number(l.receivedQty || "0"),
          );
        }
      }
      // Representative POSTED bill / GRN per item (most recent), for the drill-down links.
      const billRefByItem = new Map<string, { id: string; ref: string | null }>();
      for (const b of MOCK_BILLS) {
        if (b.purchaseOrderId !== poId || b.status !== "POSTED") continue;
        for (const l of b.lines) {
          if (l.itemId && !billRefByItem.has(l.itemId)) {
            billRefByItem.set(l.itemId, { id: b.id, ref: b.entryNo ?? null });
          }
        }
      }
      const grnRefByItem = new Map<string, { id: string; ref: string | null }>();
      for (const g of MOCK_GRNS) {
        if (g.purchaseOrderId !== poId || g.status !== "POSTED") continue;
        for (const l of g.lines) {
          if (!grnRefByItem.has(l.itemId)) {
            grnRefByItem.set(l.itemId, { id: g.id, ref: g.grnRefNo ?? null });
          }
        }
      }
      const counts = { matched: 0, underReceived: 0, overReceived: 0, pendingReceipt: 0 };
      const lines = po.lines.map((l, i) => {
        const ordered = Number(l.orderedQty || "0");
        const billed = billedByItem.get(l.itemId) ?? 0;
        const received = receivedByItem.get(l.itemId) ?? 0;
        const open = Math.max(ordered - received, 0);
        let matchStatus: "MATCHED" | "OVER_RECEIVED" | "UNDER_RECEIVED" | "PENDING_RECEIPT" =
          "PENDING_RECEIPT";
        if (received > 0) {
          if (Math.abs(received - ordered) < 0.0001) matchStatus = "MATCHED";
          else if (received > ordered) matchStatus = "OVER_RECEIVED";
          else matchStatus = "UNDER_RECEIVED";
        }
        if (matchStatus === "MATCHED") counts.matched += 1;
        else if (matchStatus === "UNDER_RECEIVED") counts.underReceived += 1;
        else if (matchStatus === "OVER_RECEIVED") counts.overReceived += 1;
        else counts.pendingReceipt += 1;
        const bref = billRefByItem.get(l.itemId);
        const gref = grnRefByItem.get(l.itemId);
        return {
          lineNo: l.lineNo ?? i + 1,
          itemId: l.itemId,
          orderedQty: ordered.toFixed(4),
          billedQty: billed.toFixed(4),
          receivedQty: received.toFixed(4),
          openQty: open.toFixed(4),
          matchStatus,
          billRef: bref?.ref ?? null,
          billId: bref?.id ?? null,
          grnRef: gref?.ref ?? null,
          grnId: gref?.id ?? null,
        };
      });
      return {
        status: 200,
        body: success({
          poId: po.id,
          poRefNo: po.poRefNo,
          projectId: po.projectId,
          supplierId: po.supplierId,
          status: po.status,
          lines,
          counts,
        }),
      };
    }
  }

  // ── Purchase / GRNs (fe-grn-matching) — receipt-only voucher, no ledger ─────
  //
  // A GRN records goods physically received against a PO and/or Bill. Draft →
  // Post (INV `receiveIn` per line for the received quantity; no ledger, no
  // `PURCHASE` number — SRS §16). Cancellation is NOT exposed (correction is via
  // the parent bill). Received-qty may be less than, equal to, or more than the
  // reference — never blocked; `matchStatus` is computed at Post.
  if (pathname?.startsWith("/purchase/grns")) {
    const grnMatch = /^\/purchase\/grns(?:\/([^/]+))?(?:\/(post))?$/.exec(pathname);
    if (grnMatch) {
      const id = grnMatch[1];
      const action = grnMatch[2];

      if (!id && req.method === "GET") {
        let rows = MOCK_GRNS.slice().filter((g) => scopeOk(g.projectId));
        const projectId = params.get("projectId");
        const supplierId = params.get("supplierId");
        const statusCsv = params.get("status");
        const purchaseOrderId = params.get("purchaseOrderId");
        const purchaseBillId = params.get("purchaseBillId");
        const dateFrom = params.get("dateFrom");
        const dateTo = params.get("dateTo");
        if (projectId) rows = rows.filter((r) => r.projectId === projectId);
        if (supplierId) rows = rows.filter((r) => r.supplierId === supplierId);
        if (purchaseOrderId) rows = rows.filter((r) => r.purchaseOrderId === purchaseOrderId);
        if (purchaseBillId) rows = rows.filter((r) => r.purchaseBillId === purchaseBillId);
        if (statusCsv) {
          const wanted = new Set(statusCsv.split(","));
          rows = rows.filter((r) => wanted.has(r.status));
        }
        if (dateFrom) rows = rows.filter((r) => r.receiptDate >= dateFrom);
        if (dateTo) rows = rows.filter((r) => r.receiptDate <= dateTo);
        rows.sort((a, b) => (a.receiptDate < b.receiptDate ? 1 : -1));
        return { status: 200, body: pageEnvelope(rows.map(grnSummary)) };
      }

      if (!id && req.method === "POST") {
        const b = body as Partial<MockGrn> & { lines?: MockGrnLine[] };
        const project = MOCK_PROJECTS.find((p) => p.id === b.projectId);
        if (!project) return { status: 404, body: envelope("NOT_FOUND", "Project not found.") };
        if (!scopeOk(project.id))
          return {
            status: 403,
            body: envelope("FORBIDDEN", "You don't have access to this project."),
          };
        if (!b.purchaseOrderId && !b.purchaseBillId) {
          return {
            status: 400,
            body: envelope("VALIDATION_ERROR", "Choose a PO or Bill to receive against."),
          };
        }
        const lines = Array.isArray(b.lines) ? b.lines : [];
        if (lines.length === 0)
          return {
            status: 400,
            body: envelope("VALIDATION_ERROR", "Nothing left to receive on this reference."),
          };
        for (const [i, l] of lines.entries()) {
          if (!(Number(l.receivedQty) > 0)) {
            return {
              status: 400,
              body: envelope(
                "VALIDATION_ERROR",
                `Line ${i + 1}: received quantity must be greater than zero.`,
              ),
            };
          }
          const g = MOCK_GODOWNS.find((x) => x.id === l.godownId);
          if (g && g.projectId !== project.id) {
            return {
              status: 400,
              body: {
                error: {
                  code: "CROSS_PROJECT_DIMENSION",
                  message: "This godown doesn't belong to the selected project.",
                  details: { path: ["lines", i, "godownId"] },
                },
              },
            };
          }
          const pp = MOCK_PURPOSES.find((x) => x.id === l.purposeId);
          if (pp && pp.projectId !== project.id) {
            return {
              status: 400,
              body: {
                error: {
                  code: "CROSS_PROJECT_DIMENSION",
                  message: "This purpose doesn't belong to the selected project.",
                  details: { path: ["lines", i, "purposeId"] },
                },
              },
            };
          }
        }
        const grn = mkGrn({
          id: `grn-${(grnSeq += 1)}`,
          projectId: project.id,
          supplierId: String(b.supplierId ?? ""),
          purchaseOrderId: (b.purchaseOrderId as string | null | undefined) ?? null,
          purchaseBillId: (b.purchaseBillId as string | null | undefined) ?? null,
          receiptDate: String(b.receiptDate ?? ""),
          narration: (b.narration as string | null | undefined) ?? null,
          status: "DRAFT",
          lines: lines.map((l, idx) => ({
            lineNo: idx + 1,
            itemId: l.itemId,
            orderedQty: String(l.orderedQty ?? "0"),
            billedQty: String(l.billedQty ?? "0"),
            receivedQty: String(l.receivedQty),
            rate: String(l.rate ?? "0"),
            receivedValue: (Number(l.receivedQty) * Number(l.rate ?? "0")).toFixed(4),
            godownId: l.godownId,
            costCentreId: l.costCentreId,
            purposeId: l.purposeId,
          })),
        });
        MOCK_GRNS.unshift(grn);
        return { status: 201, body: { data: { id: grn.id }, meta: { requestId: "mock-grn" } } };
      }

      if (!id) return { status: 200, body: success({ ok: true, path: req.path }) };
      const grn = MOCK_GRNS.find((g) => g.id === id);
      if (!grn) return { status: 404, body: envelope("NOT_FOUND", "GRN not found.") };
      if (!scopeOk(grn.projectId))
        return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this GRN.") };

      if (!action && req.method === "GET") {
        return { status: 200, body: success(grnResource(grn)) };
      }

      if (!action && req.method === "PATCH") {
        const b = body as Partial<MockGrn> & { version?: number; lines?: MockGrnLine[] };
        if (grn.status !== "DRAFT") {
          return {
            status: 409,
            body: envelope(
              "VOUCHER_POSTED_IMMUTABLE",
              "This GRN has been posted and can't be edited.",
            ),
          };
        }
        if (typeof b.version !== "number" || b.version !== grn.version) {
          return {
            status: 409,
            body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This GRN was changed elsewhere."),
          };
        }
        grn.receiptDate = String(b.receiptDate ?? grn.receiptDate);
        grn.narration = (b.narration as string | null | undefined) ?? grn.narration;
        if (Array.isArray(b.lines)) {
          grn.lines = b.lines.map((l, idx) => ({
            lineNo: idx + 1,
            itemId: l.itemId,
            orderedQty: String(l.orderedQty ?? "0"),
            billedQty: String(l.billedQty ?? "0"),
            receivedQty: String(l.receivedQty),
            rate: String(l.rate ?? "0"),
            receivedValue: (Number(l.receivedQty) * Number(l.rate ?? "0")).toFixed(4),
            godownId: l.godownId,
            costCentreId: l.costCentreId,
            purposeId: l.purposeId,
          }));
        }
        grn.version += 1;
        return { status: 200, body: { data: grnResource(grn), meta: { requestId: "mock-grn" } } };
      }

      if (action === "post" && req.method === "POST") {
        const b = body as { version?: number };
        if (grn.status !== "DRAFT") {
          return {
            status: 409,
            body: envelope("VOUCHER_POSTED_IMMUTABLE", "This GRN has already been posted."),
          };
        }
        if (typeof b.version !== "number" || b.version !== grn.version) {
          return {
            status: 409,
            body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This GRN was changed elsewhere."),
          };
        }
        grn.status = "POSTED";
        grn.grnRefNo = grn.grnRefNo ?? `GRN-2526/${String(grnSeq).padStart(4, "0")}`;
        grn.postedAt = "2026-07-13T09:00:00Z";
        grn.receivedBy = "u-rafiq";
        // Compute per-line matchStatus.
        for (const l of grn.lines) {
          const ref = Number(l.orderedQty || l.billedQty || "0");
          const rec = Number(l.receivedQty || "0");
          if (rec <= 0) l.matchStatus = "PENDING_RECEIPT";
          else if (ref <= 0 || rec > ref + 0.0001) l.matchStatus = "OVER_RECEIVED";
          else if (Math.abs(rec - ref) < 0.0001) l.matchStatus = "MATCHED";
          else l.matchStatus = "UNDER_RECEIVED";
        }
        grn.version += 1;
        return {
          status: 200,
          body: success({
            id: grn.id,
            grnRefNo: grn.grnRefNo,
            status: grn.status,
            postedAt: grn.postedAt,
          }),
        };
      }
    }
  }

  // ── Receipts (fe-receipt-editor) — voucher write surface ───────────────────
  //
  // Minimum viable write mocks for FE-43 e2e: create a DRAFT (no number, no ledger),
  // GET/PATCH/DELETE that DRAFT, then POST it — allocating a gapless `RCT/2526/nnnn`
  // number and flipping status POSTED. Cancel/repost belong to FE-44's viewer and are
  // not implemented here.
  let nextReceiptSeq = MOCK_RECEIPTS.reduce((m, r) => {
    const n = r.entryNo ? Number(r.entryNo.split("/").pop()) : 0;
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  function allocateReceiptEntryNo(): string {
    nextReceiptSeq += 1;
    return `RCT/2526/${String(nextReceiptSeq).padStart(4, "0")}`;
  }

  function receiptResource(r: MockReceipt) {
    return {
      id: r.id,
      receiptType: r.receiptType,
      receiptDate: r.receiptDate,
      paymentMode: r.paymentMode,
      depositAccountId: r.depositAccountId ?? null,
      partyId: r.partyId,
      projectId: r.projectId,
      costCentreId: r.costCentreId ?? null,
      purposeId: r.purposeId ?? null,
      ipcId: r.ipcId,
      generalTargetAccountId: r.generalTargetAccountId ?? null,
      amountSettled: r.amountSettled,
      cashReceived: r.cashReceived ?? r.amountSettled,
      taxDeductedAtSource: r.taxDeductedAtSource,
      chequeTxnRef: r.chequeTxnRef ?? null,
      narration: r.narration ?? null,
      status: r.status,
      entryNo: r.entryNo,
      // Seed receipts have no explicit journalEntryId; synthesize one for POSTED/CANCELLED
      // so the viewer's LED lines fetch resolves — the LED entries endpoint recognises the
      // `je-<id>` shape and hydrates receipt lines from receiptToJournalEntry.
      journalEntryId:
        r.journalEntryId ?? (r.status !== "DRAFT" ? `je-${r.id}` : null),
      ipcOutstandingAfter: r.ipcOutstandingAfter ?? null,
      postedAt: r.postedAt ?? null,
      postedBy: r.postedBy ?? null,
      version: r.version ?? 1,
      linkage: r.status === "DRAFT" ? null : {
        hasHistory: false,
        currentEntryNo: r.entryNo,
        originalEntryNo: r.entryNo,
        entries: [],
      },
    };
  }

  if (pathname === "/receipt" && req.method === "POST") {
    const b = (body ?? {}) as {
      receiptType?: "IPC_LINKED" | "GENERAL";
      receiptDate?: string;
      paymentMode?: MockReceipt["paymentMode"];
      depositAccountId?: string;
      ipcId?: string;
      partyId?: string;
      generalTargetAccountId?: string;
      projectId?: string | null;
      costCentreId?: string;
      purposeId?: string | null;
      amountSettled?: string;
      taxDeductedAtSource?: string;
      chequeTxnRef?: string | null;
      narration?: string | null;
    };
    if (!b.receiptType) return { status: 400, body: envelope("VALIDATION_ERROR", "Missing receiptType.") };
    if (Number(b.amountSettled ?? 0) <= 0)
      return { status: 400, body: envelope("VALIDATION_ERROR", "Amount settled must be greater than zero.") };
    if (b.paymentMode !== "CASH" && !b.chequeTxnRef)
      return { status: 400, body: envelope("CHEQUE_REF_REQUIRED", "Enter a reference for this payment mode.") };
    const id = `rec-new-${MOCK_RECEIPTS.length + 1}`;
    let receipt: MockReceipt;
    if (b.receiptType === "IPC_LINKED") {
      if (!b.ipcId) return { status: 400, body: envelope("REFERENCE_XOR_VIOLATION", "ipcId required.") };
      const ipc = MOCK_IPCS.find((i) => i.id === b.ipcId);
      if (!ipc) return { status: 404, body: envelope("NOT_FOUND", "IPC not found.") };
      if (ipc.status !== "POSTED")
        return { status: 409, body: envelope("IPC_NOT_POSTED", "This IPC is no longer posted.") };
      const settled = Number(b.amountSettled);
      const tds = Number(b.taxDeductedAtSource ?? 0);
      if (tds > settled)
        return { status: 400, body: envelope("VALIDATION_ERROR", "Tax deducted can't exceed the amount settled.") };
      const due = Number(ipcCurrentlyDue(ipc));
      const applied = MOCK_RECEIPTS.filter((r) => r.ipcId === ipc.id && r.status === "POSTED")
        .reduce((s, r) => s + Number(r.amountSettled), 0);
      if (settled > due - applied)
        return { status: 409, body: envelope("RECEIPT_EXCEEDS_OUTSTANDING", `This exceeds the IPC's remaining outstanding of ৳${(due - applied).toFixed(4)}.`) };
      receipt = {
        id,
        receiptType: "IPC_LINKED",
        receiptDate: String(b.receiptDate ?? ""),
        paymentMode: b.paymentMode!,
        depositAccountId: b.depositAccountId,
        partyId: ipc.customerId,
        projectId: ipc.projectId,
        costCentreId: ipc.costCentreId,
        purposeId: ipc.purposeId,
        ipcId: ipc.id,
        amountSettled: String(b.amountSettled),
        cashReceived: (settled - tds).toFixed(4),
        taxDeductedAtSource: tds.toFixed(4),
        chequeTxnRef: b.chequeTxnRef ?? null,
        narration: b.narration ?? null,
        status: "DRAFT",
        entryNo: null,
        version: 1,
      };
    } else {
      if (!b.generalTargetAccountId)
        return { status: 400, body: envelope("VALIDATION_ERROR", "Choose an income account or the advance-from-customer liability.") };
      if (!b.partyId)
        return { status: 400, body: envelope("VALIDATION_ERROR", "Choose a party.") };
      if (!b.costCentreId)
        return { status: 400, body: envelope("VALIDATION_ERROR", "Choose a cost centre.") };
      receipt = {
        id,
        receiptType: "GENERAL",
        receiptDate: String(b.receiptDate ?? ""),
        paymentMode: b.paymentMode!,
        depositAccountId: b.depositAccountId,
        partyId: b.partyId,
        projectId: b.projectId ?? null,
        costCentreId: b.costCentreId,
        purposeId: b.purposeId ?? null,
        ipcId: null,
        generalTargetAccountId: b.generalTargetAccountId,
        amountSettled: String(b.amountSettled),
        cashReceived: String(b.amountSettled),
        taxDeductedAtSource: "0.0000",
        chequeTxnRef: b.chequeTxnRef ?? null,
        narration: b.narration ?? null,
        status: "DRAFT",
        entryNo: null,
        version: 1,
      };
    }
    MOCK_RECEIPTS.unshift(receipt);
    return { status: 201, body: success({ id }) };
  }

  const receiptMatch = /^\/receipt\/([^/]+)(?:\/(post|cancel|repost))?$/.exec(pathname ?? "");
  if (receiptMatch && !pathname?.startsWith("/receipt/ipc/")) {
    const id = receiptMatch[1]!;
    const action = receiptMatch[2];
    const receipt = MOCK_RECEIPTS.find((r) => r.id === id);
    if (!receipt) return { status: 404, body: envelope("NOT_FOUND", "Receipt not found.") };
    if (receipt.projectId != null && !scopeOk(receipt.projectId))
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this receipt.") };

    if (req.method === "GET" && !action) {
      return { status: 200, body: success(receiptResource(receipt)) };
    }
    if (req.method === "PATCH" && !action) {
      if (receipt.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This receipt has been posted and can no longer be edited.") };
      const b = (body ?? {}) as Record<string, unknown> & { version?: number };
      if (b.version !== undefined && b.version !== (receipt.version ?? 1))
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This receipt was just changed by someone else.") };
      Object.assign(receipt, {
        receiptDate: (b.receiptDate as string | undefined) ?? receipt.receiptDate,
        amountSettled: (b.amountSettled as string | undefined) ?? receipt.amountSettled,
        taxDeductedAtSource: (b.taxDeductedAtSource as string | undefined) ?? receipt.taxDeductedAtSource,
        chequeTxnRef: (b.chequeTxnRef as string | undefined) ?? receipt.chequeTxnRef ?? null,
        narration: (b.narration as string | undefined) ?? receipt.narration ?? null,
        depositAccountId: (b.depositAccountId as string | undefined) ?? receipt.depositAccountId,
        version: (receipt.version ?? 1) + 1,
      });
      const settled = Number(receipt.amountSettled);
      const tds = Number(receipt.taxDeductedAtSource);
      receipt.cashReceived = (settled - tds).toFixed(4);
      return { status: 200, body: success(receiptResource(receipt)) };
    }
    if (req.method === "DELETE" && !action) {
      if (receipt.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This receipt has been posted and can no longer be deleted.") };
      const idx = MOCK_RECEIPTS.findIndex((r) => r.id === id);
      MOCK_RECEIPTS.splice(idx, 1);
      return { status: 204, body: null };
    }
    if (req.method === "POST" && action === "post") {
      if (receipt.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This receipt has already been posted.") };
      // Re-check outstanding for IPC-linked (edge case 8).
      let outstandingAfter: string | null = null;
      if (receipt.receiptType === "IPC_LINKED" && receipt.ipcId) {
        const ipc = MOCK_IPCS.find((i) => i.id === receipt.ipcId);
        if (!ipc || ipc.status !== "POSTED")
          return { status: 409, body: envelope("IPC_NOT_POSTED", "This IPC is no longer posted.") };
        const due = Number(ipcCurrentlyDue(ipc));
        const applied = MOCK_RECEIPTS.filter(
          (r) => r.ipcId === ipc.id && r.status === "POSTED" && r.id !== receipt.id,
        ).reduce((s, r) => s + Number(r.amountSettled), 0);
        if (Number(receipt.amountSettled) > due - applied)
          return { status: 409, body: envelope("RECEIPT_EXCEEDS_OUTSTANDING", `The IPC's remaining outstanding has changed since you started — refresh and re-check the amount.`) };
        outstandingAfter = (due - applied - Number(receipt.amountSettled)).toFixed(4);
      }
      const entryNo = allocateReceiptEntryNo();
      receipt.status = "POSTED";
      receipt.entryNo = entryNo;
      receipt.journalEntryId = `je-${id}`;
      receipt.ipcOutstandingAfter = outstandingAfter;
      receipt.postedAt = new Date().toISOString();
      receipt.postedBy = user.id;
      receipt.version = (receipt.version ?? 1) + 1;
      return { status: 200, body: success({
        id,
        entryNo,
        journalEntryId: receipt.journalEntryId,
        status: "POSTED",
        ipcOutstandingAfter: outstandingAfter,
      }) };
    }
    if (req.method === "POST" && action === "cancel") {
      if (receipt.status === "DRAFT")
        return { status: 409, body: envelope("VOUCHER_NOT_POSTED", "This receipt isn't posted, so it can't be cancelled or reposted.") };
      if (receipt.status === "CANCELLED")
        return { status: 409, body: envelope("ALREADY_REVERSED", "This receipt has already been cancelled.") };
      const reversalNo = allocateReceiptEntryNo();
      const reversalId = `je-rev-${id}`;
      receipt.status = "CANCELLED";
      receipt.version = (receipt.version ?? 1) + 1;
      // Restore IPC outstanding (adding the receipt back) — surface the higher balance.
      let restoredOutstanding: string | null = null;
      if (receipt.receiptType === "IPC_LINKED" && receipt.ipcId) {
        const ipc = MOCK_IPCS.find((i) => i.id === receipt.ipcId);
        if (ipc) {
          const due = Number(ipcCurrentlyDue(ipc));
          const applied = MOCK_RECEIPTS.filter(
            (r) => r.ipcId === ipc.id && r.status === "POSTED",
          ).reduce((s, r) => s + Number(r.amountSettled), 0);
          restoredOutstanding = (due - applied).toFixed(4);
        }
      }
      return { status: 200, body: success({
        id,
        status: "CANCELLED",
        reversalEntryId: reversalId,
        reversalEntryNo: reversalNo,
        ipcOutstandingAfter: restoredOutstanding,
      }) };
    }
    if (req.method === "POST" && action === "repost") {
      if (receipt.status === "DRAFT")
        return { status: 409, body: envelope("VOUCHER_NOT_POSTED", "This receipt isn't posted, so it can't be reposted.") };
      if (receipt.status === "CANCELLED")
        return { status: 409, body: envelope("ALREADY_REVERSED", "This receipt has already been cancelled.") };
      const b = (body ?? {}) as Record<string, unknown> & {
        amountSettled?: string;
        taxDeductedAtSource?: string;
        reason?: string;
        version?: number;
      };
      if (!b.reason || !String(b.reason).trim())
        return { status: 400, body: envelope("VALIDATION_ERROR", "Reason is required.") };
      if (b.version !== undefined && b.version !== (receipt.version ?? 1))
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This receipt was just changed by someone else.") };
      // Over-application re-check for IPC-linked (edge case 8).
      if (receipt.receiptType === "IPC_LINKED" && receipt.ipcId) {
        const ipc = MOCK_IPCS.find((i) => i.id === receipt.ipcId);
        if (ipc) {
          const due = Number(ipcCurrentlyDue(ipc));
          const applied = MOCK_RECEIPTS.filter(
            (r) => r.ipcId === ipc.id && r.status === "POSTED" && r.id !== receipt.id,
          ).reduce((s, r) => s + Number(r.amountSettled), 0);
          if (Number(b.amountSettled ?? receipt.amountSettled) > due - applied) {
            return { status: 409, body: envelope("RECEIPT_EXCEEDS_OUTSTANDING", "This exceeds the IPC's remaining outstanding.") };
          }
        }
      }
      const reversalNo = allocateReceiptEntryNo();
      const newEntryNo = allocateReceiptEntryNo();
      const settled = String(b.amountSettled ?? receipt.amountSettled);
      const tds = String(b.taxDeductedAtSource ?? receipt.taxDeductedAtSource);
      receipt.amountSettled = settled;
      receipt.taxDeductedAtSource = tds;
      receipt.cashReceived = (Number(settled) - Number(tds)).toFixed(4);
      receipt.entryNo = newEntryNo;
      receipt.journalEntryId = `je-${id}-v2`;
      receipt.version = (receipt.version ?? 1) + 1;
      return { status: 200, body: success({
        id,
        status: "POSTED",
        entryNo: newEntryNo,
        reversalEntryNo: reversalNo,
        ipcOutstandingAfter: null,
      }) };
    }
  }

  // ── Receipts (fe-receipt-list) — read-only collection register ─────────────
  //
  // GET /receipt: paginated + AND-combined filters (contract 11). PM is scoped to
  // assigned-project receipts; a general no-project receipt is excluded for PM, and
  // a direct out-of-scope `projectId` filter is `403 FORBIDDEN` (spec §11).
  if (pathname === "/receipt" && req.method === "GET") {
    const projectId = params.get("projectId");
    if (
      projectId &&
      user.assignedProjectIds.length > 0 &&
      !user.assignedProjectIds.includes(projectId)
    ) {
      return {
        status: 403,
        body: envelope("FORBIDDEN", "You can only view your assigned projects."),
      };
    }
    let rows = MOCK_RECEIPTS.slice();
    if (user.assignedProjectIds.length > 0) {
      rows = rows.filter((r) => r.projectId && user.assignedProjectIds.includes(r.projectId));
    }
    const receiptType = params.get("receiptType");
    const customerId = params.get("customerId");
    const ipcId = params.get("ipcId");
    const paymentModeCsv = params.get("paymentMode");
    const statusCsv = params.get("status");
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const entryNo = params.get("entryNo");
    if (projectId) rows = rows.filter((r) => r.projectId === projectId);
    if (receiptType) rows = rows.filter((r) => r.receiptType === receiptType);
    if (customerId) rows = rows.filter((r) => r.partyId === customerId);
    if (ipcId) rows = rows.filter((r) => r.ipcId === ipcId);
    if (paymentModeCsv) {
      const wanted = new Set(paymentModeCsv.split(","));
      rows = rows.filter((r) => wanted.has(r.paymentMode));
    }
    if (statusCsv) {
      const wanted = new Set(statusCsv.split(","));
      rows = rows.filter((r) => wanted.has(r.status));
    }
    if (dateFrom) rows = rows.filter((r) => r.receiptDate >= dateFrom);
    if (dateTo) rows = rows.filter((r) => r.receiptDate <= dateTo);
    if (entryNo) rows = rows.filter((r) => r.entryNo === entryNo);
    rows.sort((a, b) => (a.receiptDate < b.receiptDate ? 1 : -1)); // newest-first
    return { status: 200, body: pageEnvelope(rows) };
  }

  // GET /receipt/ipc/{ipcId} — receipts applied to one IPC + its resulting balance due
  // (FR-REC-016/-018). A live query, not a stored balance.
  const receiptIpcMatch = /^\/receipt\/ipc\/([^/]+)$/.exec(pathname ?? "");
  if (receiptIpcMatch && req.method === "GET") {
    const ipcId = receiptIpcMatch[1]!;
    const ipc = MOCK_IPCS.find((i) => i.id === ipcId);
    if (!ipc) return { status: 404, body: envelope("NOT_FOUND", "IPC not found.") };
    if (!scopeOk(ipc.projectId))
      return { status: 403, body: envelope("FORBIDDEN", "You don't have access to this IPC.") };
    const applied = MOCK_RECEIPTS.filter((r) => r.ipcId === ipcId && r.status === "POSTED");
    const totalApplied = applied.reduce((s, r) => s + Number(r.amountSettled), 0);
    const due = Number(ipcCurrentlyDue(ipc));
    return {
      status: 200,
      body: success({
        rows: applied.map((r) => ({
          receiptId: r.id,
          entryNo: r.entryNo,
          receiptDate: r.receiptDate,
          paymentMode: r.paymentMode,
          amountApplied: r.amountSettled,
          status: r.status,
        })),
        ipcCurrentlyDue: due.toFixed(4),
        totalApplied: totalApplied.toFixed(4),
        balanceDue: (due - totalApplied).toFixed(4),
      }),
    };
  }

  // ── Payments (fe-payment-list) — read/navigate + delete-draft ───────────────
  //
  // Minimum viable payment endpoints for FE-45 e2e/RTL: GET /payment (paginated,
  // filtered), GET /payment/{id}, DELETE /payment/{id} (DRAFT only),
  // GET /payment/open-payables (open PUR bills + HR labour/salary payables),
  // GET /payment/payables/{type}/{id}/applied. Create/patch/post/cancel/repost
  // arrive with FE-46/FE-47. Seed a small mix of DRAFT/POSTED/CANCELLED payments
  // + a couple of open PUR bills against the seed suppliers so the Outstanding
  // view has something to render.
  interface MockPaymentAllocation {
    lineNo: number;
    payableType: "PURCHASE_BILL" | "LABOUR_PAYABLE" | "SALARY";
    payableId: string;
    amountAllocated: string;
    accruedAmount: string | null;
    partyId: string | null;
    projectId: string | null;
    costCentreId: string | null;
    purposeId: string | null;
  }
  interface MockPayment {
    id: string;
    partyId: string;
    paymentDate: string;
    paymentMode: "CASH" | "MFS" | "BANK_TRANSFER" | "CHEQUE" | "RTGS";
    paymentAccountId: string;
    chequeTxnRef: string | null;
    bankChargesAmount: string;
    paymentAmount: string;
    narration: string | null;
    status: "DRAFT" | "POSTED" | "CANCELLED";
    entryNo: string | null;
    journalEntryId: string | null;
    postedAt: string | null;
    postedBy: string | null;
    version: number;
    allocations: MockPaymentAllocation[];
  }
  // A stable seed on first pass so hot-reload doesn't multiply rows.
  const gPay = globalThis as unknown as { __MOCK_PAYMENTS__?: MockPayment[] };
  if (!gPay.__MOCK_PAYMENTS__) {
    gPay.__MOCK_PAYMENTS__ = [
      {
        id: "pay-1",
        partyId: "pa-1",
        paymentDate: "2026-07-11",
        paymentMode: "RTGS",
        paymentAccountId: "1201",
        chequeTxnRef: "RTGS-99815",
        bankChargesAmount: "150.0000",
        paymentAmount: "200150.0000",
        narration: "Part-payment — Sup-A bill 0042",
        status: "POSTED",
        entryNo: "PAY/2526/0031",
        journalEntryId: "je-pay-1",
        postedAt: "2026-07-11T10:22:11Z",
        postedBy: "u1",
        version: 2,
        allocations: [
          {
            lineNo: 1,
            payableType: "PURCHASE_BILL",
            payableId: "bill-1",
            amountAllocated: "200000.0000",
            accruedAmount: null,
            partyId: "pa-1",
            projectId: null,
            costCentreId: null,
            purposeId: null,
          },
        ],
      },
      {
        id: "pay-2",
        partyId: "pa-1",
        paymentDate: "2026-07-09",
        paymentMode: "CHEQUE",
        paymentAccountId: "1201",
        chequeTxnRef: "CHQ-0912",
        bankChargesAmount: "0.0000",
        paymentAmount: "50000.0000",
        narration: null,
        status: "DRAFT",
        entryNo: null,
        journalEntryId: null,
        postedAt: null,
        postedBy: null,
        version: 1,
        allocations: [
          {
            lineNo: 1,
            payableType: "PURCHASE_BILL",
            payableId: "bill-2",
            amountAllocated: "50000.0000",
            accruedAmount: null,
            partyId: "pa-1",
            projectId: null,
            costCentreId: null,
            purposeId: null,
          },
        ],
      },
      {
        id: "pay-3",
        partyId: "pa-2",
        paymentDate: "2026-06-30",
        paymentMode: "BANK_TRANSFER",
        paymentAccountId: "1201",
        chequeTxnRef: "TXN-88170",
        bankChargesAmount: "0.0000",
        paymentAmount: "120000.0000",
        narration: "Advance payment",
        status: "CANCELLED",
        entryNo: "PAY/2526/0028",
        journalEntryId: "je-pay-3",
        postedAt: "2026-06-30T09:00:00Z",
        postedBy: "u1",
        version: 3,
        allocations: [
          {
            lineNo: 1,
            payableType: "PURCHASE_BILL",
            payableId: "bill-3",
            amountAllocated: "120000.0000",
            accruedAmount: null,
            partyId: "pa-2",
            projectId: null,
            costCentreId: null,
            purposeId: null,
          },
        ],
      },
    ];
  }
  const MOCK_PAYMENTS: MockPayment[] = gPay.__MOCK_PAYMENTS__;

  function paymentAllocated(p: MockPayment): string {
    return p.allocations
      .reduce((s, a) => s + Number(a.amountAllocated), 0)
      .toFixed(4);
  }
  function paymentUnallocated(p: MockPayment): string {
    return (Number(p.paymentAmount) - Number(paymentAllocated(p))).toFixed(4);
  }
  function paymentSummary(p: MockPayment) {
    return {
      id: p.id,
      entryNo: p.entryNo,
      partyId: p.partyId,
      paymentDate: p.paymentDate,
      paymentMode: p.paymentMode,
      paymentAccountId: p.paymentAccountId,
      chequeTxnRef: p.chequeTxnRef,
      paymentAmount: p.paymentAmount,
      allocatedAmount: paymentAllocated(p),
      unallocatedAmount: paymentUnallocated(p),
      status: p.status,
    };
  }
  function paymentResource(p: MockPayment) {
    return {
      id: p.id,
      partyId: p.partyId,
      paymentDate: p.paymentDate,
      paymentMode: p.paymentMode,
      paymentAccountId: p.paymentAccountId,
      chequeTxnRef: p.chequeTxnRef,
      bankChargesAmount: p.bankChargesAmount,
      bankChargesProjectId: null,
      bankChargesCostCentreId: null,
      bankChargesPurposeId: null,
      paymentAmount: p.paymentAmount,
      narration: p.narration,
      status: p.status,
      entryNo: p.entryNo,
      journalEntryId: p.journalEntryId,
      allocatedAmount: paymentAllocated(p),
      unallocatedAmount: paymentUnallocated(p),
      allocations: p.allocations,
      postedAt: p.postedAt,
      postedBy: p.postedBy,
      version: p.version,
      linkage: p.status === "DRAFT" ? null : {
        hasHistory: p.status === "CANCELLED",
        currentEntryNo: p.entryNo,
        originalEntryNo: p.entryNo,
        entries: [],
      },
    };
  }

  if (pathname === "/payment" && req.method === "GET") {
    let rows = MOCK_PAYMENTS.slice();
    const partyId = params.get("partyId");
    const paymentMode = params.get("paymentMode");
    const statusCsv = params.get("status");
    const paymentAccountId = params.get("paymentAccountId");
    const entryNo = params.get("entryNo");
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    if (partyId) rows = rows.filter((r) => r.partyId === partyId);
    if (paymentMode) {
      const wanted = new Set(paymentMode.split(","));
      rows = rows.filter((r) => wanted.has(r.paymentMode));
    }
    if (statusCsv) {
      const wanted = new Set(statusCsv.split(","));
      rows = rows.filter((r) => wanted.has(r.status));
    }
    if (paymentAccountId) rows = rows.filter((r) => r.paymentAccountId === paymentAccountId);
    if (entryNo) rows = rows.filter((r) => r.entryNo === entryNo);
    if (dateFrom) rows = rows.filter((r) => r.paymentDate >= dateFrom);
    if (dateTo) rows = rows.filter((r) => r.paymentDate <= dateTo);
    rows.sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1)); // newest-first
    return { status: 200, body: pageEnvelope(rows.map(paymentSummary)) };
  }

  // /payment/open-payables — synthesised from a small fixed catalogue that mirrors
  // the seed suppliers. Real PAY BE queries `payment_allocation` + owning modules'
  // payables; the mock only needs to feed the Outstanding view + drill-in.
  if (pathname === "/payment/open-payables" && req.method === "GET") {
    const partyId = params.get("partyId");
    const payableTypeCsv = params.get("payableType");
    const seed: Array<{
      payableType: "PURCHASE_BILL" | "LABOUR_PAYABLE" | "SALARY";
      payableId: string;
      reference: string;
      partyId: string | null;
      originalAmount: string;
      payableDate: string;
      accruedAmount: string | null;
    }> = [
      {
        payableType: "PURCHASE_BILL",
        payableId: "bill-1",
        reference: "PUR/2526/0042",
        partyId: "pa-1",
        originalAmount: "231150.0000",
        payableDate: "2026-06-29",
        accruedAmount: null,
      },
      {
        payableType: "PURCHASE_BILL",
        payableId: "bill-2",
        reference: "PUR/2526/0055",
        partyId: "pa-1",
        originalAmount: "150000.0000",
        payableDate: "2026-07-01",
        accruedAmount: null,
      },
      {
        payableType: "PURCHASE_BILL",
        payableId: "bill-3",
        reference: "PUR/2526/0060",
        partyId: "pa-2",
        originalAmount: "120000.0000",
        payableDate: "2026-06-25",
        accruedAmount: null,
      },
      {
        payableType: "LABOUR_PAYABLE",
        payableId: "lbr-1",
        reference: "LBR/2026-07-10",
        partyId: null,
        originalAmount: "45000.0000",
        payableDate: "2026-07-10",
        accruedAmount: "45000.0000",
      },
      {
        payableType: "SALARY",
        payableId: "sal-1",
        reference: "SAL/2026-06",
        partyId: null,
        originalAmount: "820000.0000",
        payableDate: "2026-06-30",
        accruedAmount: null,
      },
    ];
    const wantedTypes = payableTypeCsv ? new Set(payableTypeCsv.split(",")) : null;
    const rows = seed
      .filter((s) => (partyId ? s.partyId === partyId : true))
      .filter((s) => (wantedTypes ? wantedTypes.has(s.payableType) : true))
      .map((s) => {
        const applied = MOCK_PAYMENTS.filter((p) => p.status === "POSTED").reduce(
          (sum, p) =>
            sum +
            p.allocations
              .filter((a) => a.payableType === s.payableType && a.payableId === s.payableId)
              .reduce((x, a) => x + Number(a.amountAllocated), 0),
          0,
        );
        return {
          payableType: s.payableType,
          payableId: s.payableId,
          reference: s.reference,
          partyId: s.partyId,
          originalAmount: s.originalAmount,
          appliedAmount: applied.toFixed(4),
          remainingOutstanding: (Number(s.originalAmount) - applied).toFixed(4),
          accruedAmount: s.accruedAmount,
          payableDate: s.payableDate,
        };
      })
      .filter((r) => Number(r.remainingOutstanding) > 0);
    return { status: 200, body: success(rows) };
  }

  const payAppliedMatch = /^\/payment\/payables\/([^/]+)\/([^/]+)\/applied$/.exec(
    pathname ?? "",
  );
  if (payAppliedMatch && req.method === "GET") {
    const [, payableType, payableId] = payAppliedMatch;
    const applications = MOCK_PAYMENTS.filter(
      (p) =>
        p.status === "POSTED" &&
        p.allocations.some((a) => a.payableType === payableType && a.payableId === payableId),
    ).map((p) => {
      const alloc = p.allocations.find(
        (a) => a.payableType === payableType && a.payableId === payableId,
      );
      return {
        paymentId: p.id,
        entryNo: p.entryNo ?? "",
        paymentDate: p.paymentDate,
        amountAllocated: alloc?.amountAllocated ?? "0.0000",
        status: p.status,
      };
    });
    // Cross-ref the open-payables seed for the totals.
    const seedOpen = {
      "bill-1": "231150.0000",
      "bill-2": "150000.0000",
      "bill-3": "120000.0000",
      "lbr-1": "45000.0000",
      "sal-1": "820000.0000",
    } as Record<string, string>;
    const originalAmount = seedOpen[payableId ?? ""] ?? "0.0000";
    const appliedAmount = applications
      .reduce((s, a) => s + Number(a.amountAllocated), 0)
      .toFixed(4);
    return {
      status: 200,
      body: success({
        payableType,
        payableId,
        originalAmount,
        appliedAmount,
        remainingOutstanding: (Number(originalAmount) - Number(appliedAmount)).toFixed(4),
        applications,
      }),
    };
  }

  // Allocate the next gapless PAYMENT number from a stable counter.
  const gPaySeq = globalThis as unknown as { __MOCK_PAY_SEQ__?: number };
  if (typeof gPaySeq.__MOCK_PAY_SEQ__ !== "number") {
    gPaySeq.__MOCK_PAY_SEQ__ = MOCK_PAYMENTS.reduce((m, r) => {
      const n = r.entryNo ? Number(r.entryNo.split("/").pop()) : 0;
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
  }
  function allocatePaymentEntryNo(): string {
    gPaySeq.__MOCK_PAY_SEQ__ = (gPaySeq.__MOCK_PAY_SEQ__ ?? 0) + 1;
    return `PAY/2526/${String(gPaySeq.__MOCK_PAY_SEQ__).padStart(4, "0")}`;
  }

  interface PaymentAllocationInputBody {
    payableType: MockPaymentAllocation["payableType"];
    payableId: string;
    amountAllocated?: string;
  }
  interface PaymentWriteBody {
    partyId?: string;
    paymentDate?: string;
    paymentMode?: MockPayment["paymentMode"];
    paymentAccountId?: string;
    chequeTxnRef?: string | null;
    bankChargesAmount?: string;
    bankChargesProjectId?: string | null;
    bankChargesCostCentreId?: string | null;
    bankChargesPurposeId?: string | null;
    paymentAmount?: string;
    narration?: string | null;
    allocations?: PaymentAllocationInputBody[];
    version?: number;
    reason?: string;
  }

  function applyBody(target: MockPayment, b: PaymentWriteBody): void {
    if (b.partyId !== undefined) target.partyId = b.partyId;
    if (b.paymentDate !== undefined) target.paymentDate = b.paymentDate;
    if (b.paymentMode !== undefined) target.paymentMode = b.paymentMode;
    if (b.paymentAccountId !== undefined) target.paymentAccountId = b.paymentAccountId;
    if (b.chequeTxnRef !== undefined) target.chequeTxnRef = b.chequeTxnRef;
    if (b.bankChargesAmount !== undefined) target.bankChargesAmount = b.bankChargesAmount;
    if (b.paymentAmount !== undefined) target.paymentAmount = b.paymentAmount;
    if (b.narration !== undefined) target.narration = b.narration;
    if (b.allocations !== undefined) {
      target.allocations = b.allocations.map((a, i) => ({
        lineNo: i + 1,
        payableType: a.payableType,
        payableId: a.payableId,
        amountAllocated: a.amountAllocated ?? "0.0000",
        accruedAmount: a.payableType === "LABOUR_PAYABLE" ? "0.0000" : null,
        partyId: target.partyId,
        projectId: null,
        costCentreId: null,
        purposeId: null,
      }));
    }
  }

  function validateWrite(b: PaymentWriteBody): { status: number; body: unknown } | null {
    if (b.paymentMode !== undefined && b.paymentMode !== "CASH" && !b.chequeTxnRef) {
      return { status: 400, body: envelope("CHEQUE_REF_REQUIRED", "Enter a reference for this payment mode.") };
    }
    if (b.paymentAmount !== undefined && Number(b.paymentAmount) < 0) {
      return { status: 400, body: envelope("VALIDATION_ERROR", "Payment amount can't be negative.") };
    }
    if (b.allocations) {
      const sum = b.allocations.reduce((s, a) => s + Number(a.amountAllocated ?? 0), 0);
      const total = Number(b.paymentAmount ?? 0);
      if (total > 0 && sum > total)
        return { status: 400, body: envelope("OVER_ALLOCATION", "Total allocations exceed the payment amount.") };
    }
    if (b.bankChargesAmount !== undefined && Number(b.bankChargesAmount) < 0) {
      return { status: 400, body: envelope("VALIDATION_ERROR", "Bank charges can't be negative.") };
    }
    if (b.bankChargesAmount !== undefined && Number(b.bankChargesAmount) > 0) {
      if (!b.bankChargesProjectId || !b.bankChargesCostCentreId || !b.bankChargesPurposeId) {
        return { status: 400, body: envelope("VALIDATION_ERROR", "Bank charges need project, cost centre and purpose.") };
      }
    }
    return null;
  }

  if (pathname === "/payment" && req.method === "POST") {
    const b = (body ?? {}) as PaymentWriteBody;
    const err = validateWrite(b);
    if (err) return err;
    const id = `pay-new-${MOCK_PAYMENTS.length + 1}`;
    const draft: MockPayment = {
      id,
      partyId: b.partyId ?? "",
      paymentDate: b.paymentDate ?? "",
      paymentMode: b.paymentMode ?? "BANK_TRANSFER",
      paymentAccountId: b.paymentAccountId ?? "",
      chequeTxnRef: b.chequeTxnRef ?? null,
      bankChargesAmount: b.bankChargesAmount ?? "0.0000",
      paymentAmount: b.paymentAmount ?? "0.0000",
      narration: b.narration ?? null,
      status: "DRAFT",
      entryNo: null,
      journalEntryId: null,
      postedAt: null,
      postedBy: null,
      version: 1,
      allocations: [],
    };
    applyBody(draft, b);
    MOCK_PAYMENTS.unshift(draft);
    return { status: 201, body: success({ id }) };
  }

  const paymentActionMatch = /^\/payment\/([^/]+)(?:\/(post|cancel|repost))?$/.exec(pathname ?? "");
  if (
    paymentActionMatch &&
    !pathname?.startsWith("/payment/payables/") &&
    !pathname?.startsWith("/payment/open")
  ) {
    const id = paymentActionMatch[1]!;
    const action = paymentActionMatch[2];
    const p = MOCK_PAYMENTS.find((r) => r.id === id);
    if (!p) return { status: 404, body: envelope("NOT_FOUND", "Payment not found.") };
    if (req.method === "GET" && !action) {
      return { status: 200, body: success(paymentResource(p)) };
    }
    if (req.method === "PATCH" && !action) {
      if (p.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This payment has been posted and can no longer be edited.") };
      const b = (body ?? {}) as PaymentWriteBody;
      if (b.version !== undefined && b.version !== p.version)
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This payment was just changed by someone else.") };
      const err = validateWrite(b);
      if (err) return err;
      applyBody(p, b);
      p.version += 1;
      return { status: 200, body: success(paymentResource(p)) };
    }
    if (req.method === "DELETE" && !action) {
      if (p.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This payment has been posted and can no longer be deleted.") };
      const idx = MOCK_PAYMENTS.findIndex((r) => r.id === id);
      MOCK_PAYMENTS.splice(idx, 1);
      return { status: 204, body: null };
    }
    if (req.method === "POST" && action === "post") {
      if (p.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This payment has already been posted.") };
      const sum = p.allocations.reduce((s, a) => s + Number(a.amountAllocated), 0);
      if (sum > Number(p.paymentAmount))
        return { status: 400, body: envelope("OVER_ALLOCATION", "Total allocations exceed the payment amount.") };
      const entryNo = allocatePaymentEntryNo();
      p.status = "POSTED";
      p.entryNo = entryNo;
      p.journalEntryId = `je-${id}`;
      p.postedAt = new Date().toISOString();
      p.postedBy = user.id;
      p.version += 1;
      return {
        status: 200,
        body: success({
          id,
          entryNo,
          journalEntryId: p.journalEntryId,
          status: "POSTED",
          paymentAmount: p.paymentAmount,
          allocatedAmount: sum.toFixed(4),
        }),
      };
    }
    if (req.method === "POST" && action === "cancel") {
      if (p.status === "DRAFT")
        return { status: 409, body: envelope("VOUCHER_NOT_POSTED", "This payment isn't posted, so it can't be cancelled.") };
      if (p.status === "CANCELLED")
        return { status: 409, body: envelope("ALREADY_REVERSED", "This payment has already been cancelled.") };
      const reversalNo = allocatePaymentEntryNo();
      p.status = "CANCELLED";
      p.version += 1;
      return {
        status: 200,
        body: success({
          id,
          status: "CANCELLED",
          reversalEntryId: `je-rev-${id}`,
          reversalEntryNo: reversalNo,
        }),
      };
    }
    if (req.method === "POST" && action === "repost") {
      if (p.status === "DRAFT")
        return { status: 409, body: envelope("VOUCHER_NOT_POSTED", "This payment isn't posted, so it can't be reposted.") };
      if (p.status === "CANCELLED")
        return { status: 409, body: envelope("ALREADY_REVERSED", "This payment has already been cancelled.") };
      const b = (body ?? {}) as PaymentWriteBody;
      if (!b.reason || !String(b.reason).trim())
        return { status: 400, body: envelope("VALIDATION_ERROR", "Reason is required.") };
      const err = validateWrite(b);
      if (err) return err;
      const reversalNo = allocatePaymentEntryNo();
      const newEntryNo = allocatePaymentEntryNo();
      applyBody(p, b);
      p.entryNo = newEntryNo;
      p.journalEntryId = `je-${id}-v2`;
      p.version += 1;
      return {
        status: 200,
        body: success({
          id,
          status: "POSTED",
          entryNo: newEntryNo,
          reversalEntryNo: reversalNo,
          paymentAmount: p.paymentAmount,
        }),
      };
    }
  }

  // ── Contra & Journal (fe-voucher-list) — read-only unified list ─────────────
  //
  // Minimum viable read for FE-48: seeded contra + journal + opening vouchers,
  // filtered by status + date + entry number (+ voucherType for journals). Sibling
  // briefs (FE-49/FE-50/FE-51) will add create/patch/delete/post/reverse.
  interface MockContraSeed {
    id: string;
    voucherType: "CONTRA";
    voucherDate: string;
    narration: string | null;
    status: "DRAFT" | "POSTED" | "CANCELLED";
    entryNo: string | null;
    journalEntryId: string | null;
    totalDebit: string;
    version: number;
  }
  interface MockJournalSeed {
    id: string;
    voucherType: "JOURNAL" | "OPENING";
    voucherDate: string;
    narration: string | null;
    status: "DRAFT" | "POSTED" | "CANCELLED";
    entryNo: string | null;
    journalEntryId: string | null;
    totalDebit: string;
    version: number;
  }
  const gCJ = globalThis as unknown as {
    __MOCK_CONTRA__?: MockContraSeed[];
    __MOCK_JOURNAL__?: MockJournalSeed[];
  };
  if (!gCJ.__MOCK_CONTRA__) {
    gCJ.__MOCK_CONTRA__ = [
      {
        id: "ctr-1",
        voucherType: "CONTRA",
        voucherDate: "2026-07-10",
        narration: "Cash deposited to City Bank A/C",
        status: "POSTED",
        entryNo: "CTR/2526/0007",
        journalEntryId: "je-ctr-1",
        totalDebit: "500000.0000",
        version: 2,
      },
      {
        id: "ctr-2",
        voucherType: "CONTRA",
        voucherDate: "2026-07-08",
        narration: "Bank to petty cash",
        status: "DRAFT",
        entryNo: null,
        journalEntryId: null,
        totalDebit: "50000.0000",
        version: 1,
      },
    ];
  }
  if (!gCJ.__MOCK_JOURNAL__) {
    gCJ.__MOCK_JOURNAL__ = [
      {
        id: "jnl-1",
        voucherType: "JOURNAL",
        voucherDate: "2026-07-05",
        narration: "Accrue June electricity",
        status: "POSTED",
        entryNo: "JNL/2526/0022",
        journalEntryId: "je-jnl-1",
        totalDebit: "18500.0000",
        version: 2,
      },
      {
        id: "jnl-2",
        voucherType: "JOURNAL",
        voucherDate: "2026-06-30",
        narration: "Reclassify prepayment",
        status: "CANCELLED",
        entryNo: "JNL/2526/0019",
        journalEntryId: "je-jnl-2",
        totalDebit: "12000.0000",
        version: 3,
      },
      {
        id: "opn-1",
        voucherType: "OPENING",
        voucherDate: "2025-07-01",
        narration: "Go-live opening balances",
        status: "POSTED",
        entryNo: "OPN/2526/0001",
        journalEntryId: "je-opn-1",
        totalDebit: "12500000.0000",
        version: 1,
      },
    ];
  }
  const MOCK_CONTRA = gCJ.__MOCK_CONTRA__;
  const MOCK_JOURNAL = gCJ.__MOCK_JOURNAL__;

  function applyCommonFilters<T extends { status: string; voucherDate: string; entryNo: string | null }>(
    rows: T[],
  ): T[] {
    let out = rows.slice();
    const statusCsv = params.get("status");
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const entryNo = params.get("entryNo");
    if (statusCsv) {
      const wanted = new Set(statusCsv.split(","));
      out = out.filter((r) => wanted.has(r.status));
    }
    if (dateFrom) out = out.filter((r) => r.voucherDate >= dateFrom);
    if (dateTo) out = out.filter((r) => r.voucherDate <= dateTo);
    if (entryNo) out = out.filter((r) => r.entryNo === entryNo);
    out.sort((a, b) => (a.voucherDate < b.voucherDate ? 1 : -1));
    return out;
  }

  // Allocate the next gapless CTR number.
  const gCtrSeq = globalThis as unknown as { __MOCK_CTR_SEQ__?: number };
  if (typeof gCtrSeq.__MOCK_CTR_SEQ__ !== "number") {
    gCtrSeq.__MOCK_CTR_SEQ__ = MOCK_CONTRA.reduce((m, r) => {
      const n = r.entryNo ? Number(r.entryNo.split("/").pop()) : 0;
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
  }
  function allocateCtrEntryNo(): string {
    gCtrSeq.__MOCK_CTR_SEQ__ = (gCtrSeq.__MOCK_CTR_SEQ__ ?? 0) + 1;
    return `CTR/2526/${String(gCtrSeq.__MOCK_CTR_SEQ__).padStart(4, "0")}`;
  }

  interface MockContraLine {
    lineNo: number;
    accountId: string;
    debit: string;
    credit: string;
    narration: string | null;
  }
  interface MockContraFull extends MockContraSeed {
    lines: MockContraLine[];
  }
  const gCtrFull = globalThis as unknown as { __MOCK_CONTRA_FULL__?: Record<string, MockContraFull> };
  if (!gCtrFull.__MOCK_CONTRA_FULL__) {
    gCtrFull.__MOCK_CONTRA_FULL__ = {
      "ctr-1": {
        ...MOCK_CONTRA[0]!,
        lines: [
          { lineNo: 1, accountId: "1201", debit: "500000.0000", credit: "0.0000", narration: null },
          { lineNo: 2, accountId: "1010", debit: "0.0000", credit: "500000.0000", narration: null },
        ],
      },
      "ctr-2": {
        ...MOCK_CONTRA[1]!,
        lines: [
          { lineNo: 1, accountId: "1010", debit: "50000.0000", credit: "0.0000", narration: null },
          { lineNo: 2, accountId: "1201", debit: "0.0000", credit: "50000.0000", narration: null },
        ],
      },
    };
  }
  const MOCK_CONTRA_FULL = gCtrFull.__MOCK_CONTRA_FULL__;

  function contraResource(r: MockContraFull) {
    return {
      id: r.id,
      voucherType: r.voucherType,
      voucherDate: r.voucherDate,
      narration: r.narration,
      status: r.status,
      entryNo: r.entryNo,
      journalEntryId: r.journalEntryId,
      postedAt: r.status !== "DRAFT" ? "2026-07-11T10:22:11Z" : null,
      postedBy: r.status !== "DRAFT" ? user?.id ?? null : null,
      lines: r.lines,
      version: r.version,
      createdAt: "2026-07-10T10:00:00Z",
      updatedAt: "2026-07-10T10:00:00Z",
      totalDebit: r.totalDebit,
    };
  }

  if (pathname === "/contra" && req.method === "GET") {
    const rows = applyCommonFilters(MOCK_CONTRA);
    return { status: 200, body: pageEnvelope(rows) };
  }
  if (pathname === "/contra" && req.method === "POST") {
    const b = (body ?? {}) as { voucherDate?: string; narration?: string | null; lines?: MockContraLine[] };
    const id = `ctr-new-${Object.keys(MOCK_CONTRA_FULL).length + 1}`;
    const lines = (b.lines ?? []).map((l, i) => ({
      lineNo: i + 1,
      accountId: l.accountId,
      debit: l.debit ?? "0.0000",
      credit: l.credit ?? "0.0000",
      narration: l.narration ?? null,
    }));
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
    const rec: MockContraFull = {
      id,
      voucherType: "CONTRA",
      voucherDate: b.voucherDate ?? "2026-07-11",
      narration: b.narration ?? null,
      status: "DRAFT",
      entryNo: null,
      journalEntryId: null,
      totalDebit,
      version: 1,
      lines,
    };
    MOCK_CONTRA_FULL[id] = rec;
    MOCK_CONTRA.unshift({
      id,
      voucherType: "CONTRA",
      voucherDate: rec.voucherDate,
      narration: rec.narration,
      status: rec.status,
      entryNo: rec.entryNo,
      journalEntryId: rec.journalEntryId,
      totalDebit,
      version: 1,
    });
    return { status: 201, body: success({ id }) };
  }

  const contraIdMatch = /^\/contra\/([^/]+)(?:\/(post|reverse))?$/.exec(pathname ?? "");
  if (contraIdMatch) {
    const id = contraIdMatch[1]!;
    const action = contraIdMatch[2];
    const r = MOCK_CONTRA_FULL[id];
    if (!r) return { status: 404, body: envelope("NOT_FOUND", "Contra voucher not found.") };
    if (req.method === "GET" && !action) return { status: 200, body: success(contraResource(r)) };
    if (req.method === "PATCH" && !action) {
      if (r.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This voucher has been posted and can no longer be edited.") };
      const b = (body ?? {}) as { voucherDate?: string; narration?: string | null; lines?: MockContraLine[]; version?: number };
      if (b.version !== undefined && b.version !== r.version)
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This voucher was changed by someone else.") };
      if (b.voucherDate) r.voucherDate = b.voucherDate;
      if (b.narration !== undefined) r.narration = b.narration ?? null;
      if (b.lines)
        r.lines = b.lines.map((l, i) => ({
          lineNo: i + 1,
          accountId: l.accountId,
          debit: l.debit ?? "0.0000",
          credit: l.credit ?? "0.0000",
          narration: l.narration ?? null,
        }));
      r.totalDebit = r.lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
      r.version += 1;
      const summary = MOCK_CONTRA.find((c) => c.id === id);
      if (summary) {
        summary.voucherDate = r.voucherDate;
        summary.narration = r.narration;
        summary.totalDebit = r.totalDebit;
        summary.version = r.version;
      }
      return { status: 200, body: success(contraResource(r)) };
    }
    if (req.method === "DELETE" && !action) {
      if (r.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This voucher has been posted and can no longer be deleted.") };
      delete MOCK_CONTRA_FULL[id];
      const idx = MOCK_CONTRA.findIndex((c) => c.id === id);
      if (idx >= 0) MOCK_CONTRA.splice(idx, 1);
      return { status: 204, body: null };
    }
    if (req.method === "POST" && action === "post") {
      if (r.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This voucher has already been posted.") };
      const sumDr = r.lines.reduce((s, l) => s + Number(l.debit), 0);
      const sumCr = r.lines.reduce((s, l) => s + Number(l.credit), 0);
      if (Math.abs(sumDr - sumCr) > 0.0001)
        return { status: 400, body: envelope("UNBALANCED_ENTRY", "Σ debit ≠ Σ credit.") };
      const entryNo = allocateCtrEntryNo();
      r.status = "POSTED";
      r.entryNo = entryNo;
      r.journalEntryId = `je-${id}`;
      r.version += 1;
      const summary = MOCK_CONTRA.find((c) => c.id === id);
      if (summary) {
        summary.status = "POSTED";
        summary.entryNo = entryNo;
        summary.journalEntryId = r.journalEntryId;
        summary.version = r.version;
      }
      return {
        status: 200,
        body: success({ id, entryNo, journalEntryId: r.journalEntryId, status: "POSTED" }),
      };
    }
    if (req.method === "POST" && action === "reverse") {
      if (r.status === "DRAFT")
        return { status: 409, body: envelope("VOUCHER_NOT_POSTED", "This voucher isn't posted, so it can't be reversed.") };
      if (r.status === "CANCELLED")
        return { status: 409, body: envelope("ALREADY_REVERSED", "This voucher has already been reversed.") };
      const b = (body ?? {}) as { reason?: string; version?: number };
      if (!b.reason || !String(b.reason).trim())
        return { status: 400, body: envelope("VALIDATION_ERROR", "Reason is required.") };
      if (b.version !== undefined && b.version !== r.version)
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This voucher was changed by someone else.") };
      const reversalNo = allocateCtrEntryNo();
      r.status = "CANCELLED";
      r.version += 1;
      const summary = MOCK_CONTRA.find((c) => c.id === id);
      if (summary) {
        summary.status = "CANCELLED";
        summary.version = r.version;
      }
      return {
        status: 200,
        body: success({
          id,
          status: "CANCELLED",
          reversalEntryId: `je-rev-${id}`,
          reversalEntryNo: reversalNo,
        }),
      };
    }
  }

  // Allocate the next gapless JNL number.
  const gJnlSeq = globalThis as unknown as { __MOCK_JNL_SEQ__?: number };
  if (typeof gJnlSeq.__MOCK_JNL_SEQ__ !== "number") {
    gJnlSeq.__MOCK_JNL_SEQ__ = MOCK_JOURNAL.reduce((m, r) => {
      const n = r.entryNo ? Number(r.entryNo.split("/").pop()) : 0;
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
  }
  function allocateJnlEntryNo(): string {
    gJnlSeq.__MOCK_JNL_SEQ__ = (gJnlSeq.__MOCK_JNL_SEQ__ ?? 0) + 1;
    return `JNL/2526/${String(gJnlSeq.__MOCK_JNL_SEQ__).padStart(4, "0")}`;
  }

  interface MockJournalLine {
    lineNo: number;
    accountId: string;
    debit: string;
    credit: string;
    partyId: string | null;
    projectId: string | null;
    costCentreId: string | null;
    purposeId: string | null;
    narration: string | null;
  }
  interface MockJournalFull extends MockJournalSeed {
    lines: MockJournalLine[];
  }
  const gJnlFull = globalThis as unknown as { __MOCK_JOURNAL_FULL__?: Record<string, MockJournalFull> };
  if (!gJnlFull.__MOCK_JOURNAL_FULL__) {
    gJnlFull.__MOCK_JOURNAL_FULL__ = {
      "jnl-1": {
        ...MOCK_JOURNAL[0]!,
        lines: [
          { lineNo: 1, accountId: "5100", debit: "18500.0000", credit: "0.0000", partyId: null, projectId: "proj-a", costCentreId: "cc-1", purposeId: "pp-1", narration: null },
          { lineNo: 2, accountId: "2100", debit: "0.0000", credit: "18500.0000", partyId: "pa-1", projectId: null, costCentreId: null, purposeId: null, narration: null },
        ],
      },
      "jnl-2": {
        ...MOCK_JOURNAL[1]!,
        lines: [
          { lineNo: 1, accountId: "1500", debit: "12000.0000", credit: "0.0000", partyId: null, projectId: null, costCentreId: null, purposeId: null, narration: null },
          { lineNo: 2, accountId: "1010", debit: "0.0000", credit: "12000.0000", partyId: null, projectId: null, costCentreId: null, purposeId: null, narration: null },
        ],
      },
      "opn-1": {
        ...MOCK_JOURNAL[2]!,
        lines: [],
      },
    };
  }
  const MOCK_JOURNAL_FULL = gJnlFull.__MOCK_JOURNAL_FULL__;

  function journalResource(r: MockJournalFull) {
    return {
      id: r.id,
      voucherType: r.voucherType,
      voucherDate: r.voucherDate,
      narration: r.narration,
      status: r.status,
      entryNo: r.entryNo,
      journalEntryId: r.journalEntryId,
      postedAt: r.status !== "DRAFT" ? "2026-07-05T10:22:11Z" : null,
      postedBy: r.status !== "DRAFT" ? user?.id ?? null : null,
      lines: r.lines,
      version: r.version,
      createdAt: "2026-07-05T10:00:00Z",
      updatedAt: "2026-07-05T10:00:00Z",
      totalDebit: r.totalDebit,
    };
  }

  // ── Opening journal (fe-opening-journal) — preview + one-time post ──────────
  //
  // Phase-1 mock shim: /journal/opening/preview returns a derived-lines fixture; the
  // real backend either supplies a preview endpoint or the FE derives from MAS
  // `opening_balance` (SRS §15/§16 — PENDING). POST /journal/opening posts once per
  // company and stores the derived voucher in MOCK_JOURNAL + MOCK_JOURNAL_FULL.
  if (pathname === "/journal/opening/preview" && req.method === "GET") {
    // If an OPENING already exists, the wizard renders the recap instead — the preview
    // is still useful for tests, so we return an empty (posted) shape here.
    const alreadyPosted = MOCK_JOURNAL.some((j) => j.voucherType === "OPENING");
    const lines = alreadyPosted
      ? []
      : [
          { lineNo: 1, section: "ACCOUNT", accountLabel: "1010 · Cash on hand", partyLabel: null, debit: "500000.0000", credit: "0.0000" },
          { lineNo: 2, section: "ACCOUNT", accountLabel: "1201 · HSBC Current 001", partyLabel: null, debit: "8500000.0000", credit: "0.0000" },
          { lineNo: 3, section: "ACCOUNT", accountLabel: "2100 · Accounts payable", partyLabel: null, debit: "0.0000", credit: "1200000.0000" },
          { lineNo: 4, section: "PARTY_AR", accountLabel: "1200 · Accounts Receivable", partyLabel: "National Housing Authority", debit: "2500000.0000", credit: "0.0000" },
          { lineNo: 5, section: "PARTY_AP", accountLabel: "2100 · Accounts payable", partyLabel: "M/s Rahman Traders", debit: "0.0000", credit: "800000.0000" },
          { lineNo: 6, section: "EQUITY", accountLabel: "3100 · Opening balance equity", partyLabel: null, debit: "0.0000", credit: "9500000.0000" },
        ];
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0).toFixed(4);
    return {
      status: 200,
      body: success({ lines, totalDebit, totalCredit, configGap: false }),
    };
  }
  if (pathname === "/journal/opening" && req.method === "POST") {
    if (MOCK_JOURNAL.some((j) => j.voucherType === "OPENING")) {
      return { status: 409, body: envelope("OPENING_ALREADY_EXISTS", "An opening journal already exists for this company.") };
    }
    const b = (body ?? {}) as { voucherDate?: string; narration?: string | null };
    const id = `opn-new-${Object.keys(MOCK_JOURNAL_FULL).length + 1}`;
    const entryNo = allocateJnlEntryNo();
    const lines = [
      { lineNo: 1, accountId: "1010", debit: "500000.0000", credit: "0.0000", partyId: null, projectId: null, costCentreId: null, purposeId: null, narration: null },
      { lineNo: 2, accountId: "1201", debit: "8500000.0000", credit: "0.0000", partyId: null, projectId: null, costCentreId: null, purposeId: null, narration: null },
      { lineNo: 3, accountId: "2100", debit: "0.0000", credit: "1200000.0000", partyId: null, projectId: null, costCentreId: null, purposeId: null, narration: null },
      { lineNo: 4, accountId: "1200", debit: "2500000.0000", credit: "0.0000", partyId: "pa-8", projectId: null, costCentreId: null, purposeId: null, narration: null },
      { lineNo: 5, accountId: "2100", debit: "0.0000", credit: "800000.0000", partyId: "pa-1", projectId: null, costCentreId: null, purposeId: null, narration: null },
      { lineNo: 6, accountId: "3100", debit: "0.0000", credit: "9500000.0000", partyId: null, projectId: null, costCentreId: null, purposeId: null, narration: null },
    ];
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
    const rec: MockJournalFull = {
      id,
      voucherType: "OPENING",
      voucherDate: b.voucherDate ?? "2025-07-01",
      narration: b.narration ?? "Go-live opening balances",
      status: "POSTED",
      entryNo,
      journalEntryId: `je-${id}`,
      totalDebit,
      version: 1,
      lines,
    };
    MOCK_JOURNAL_FULL[id] = rec;
    MOCK_JOURNAL.unshift({
      id,
      voucherType: "OPENING",
      voucherDate: rec.voucherDate,
      narration: rec.narration,
      status: rec.status,
      entryNo: rec.entryNo,
      journalEntryId: rec.journalEntryId,
      totalDebit,
      version: 1,
    });
    return { status: 201, body: success(journalResource(rec)) };
  }

  if (pathname === "/journal" && req.method === "GET") {
    let rows = applyCommonFilters(MOCK_JOURNAL);
    const voucherType = params.get("voucherType");
    if (voucherType) rows = rows.filter((r) => r.voucherType === voucherType);
    return { status: 200, body: pageEnvelope(rows) };
  }
  if (pathname === "/journal" && req.method === "POST") {
    const b = (body ?? {}) as { voucherDate?: string; narration?: string | null; lines?: MockJournalLine[] };
    const id = `jnl-new-${Object.keys(MOCK_JOURNAL_FULL).length + 1}`;
    const lines = (b.lines ?? []).map((l, i) => ({
      lineNo: i + 1,
      accountId: l.accountId,
      debit: l.debit ?? "0.0000",
      credit: l.credit ?? "0.0000",
      partyId: l.partyId ?? null,
      projectId: l.projectId ?? null,
      costCentreId: l.costCentreId ?? null,
      purposeId: l.purposeId ?? null,
      narration: l.narration ?? null,
    }));
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
    const rec: MockJournalFull = {
      id,
      voucherType: "JOURNAL",
      voucherDate: b.voucherDate ?? "2026-07-05",
      narration: b.narration ?? null,
      status: "DRAFT",
      entryNo: null,
      journalEntryId: null,
      totalDebit,
      version: 1,
      lines,
    };
    MOCK_JOURNAL_FULL[id] = rec;
    MOCK_JOURNAL.unshift({
      id,
      voucherType: "JOURNAL",
      voucherDate: rec.voucherDate,
      narration: rec.narration,
      status: rec.status,
      entryNo: rec.entryNo,
      journalEntryId: rec.journalEntryId,
      totalDebit,
      version: 1,
    });
    return { status: 201, body: success({ id }) };
  }

  const journalIdMatch = /^\/journal\/([^/]+)(?:\/(post|reverse))?$/.exec(pathname ?? "");
  if (journalIdMatch) {
    const id = journalIdMatch[1]!;
    const action = journalIdMatch[2];
    const r = MOCK_JOURNAL_FULL[id];
    if (!r) return { status: 404, body: envelope("NOT_FOUND", "Journal voucher not found.") };
    if (req.method === "GET" && !action) return { status: 200, body: success(journalResource(r)) };
    if (req.method === "PATCH" && !action) {
      if (r.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This voucher has been posted and can no longer be edited.") };
      const b = (body ?? {}) as { voucherDate?: string; narration?: string | null; lines?: MockJournalLine[]; version?: number };
      if (b.version !== undefined && b.version !== r.version)
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This voucher was changed by someone else.") };
      if (b.voucherDate) r.voucherDate = b.voucherDate;
      if (b.narration !== undefined) r.narration = b.narration ?? null;
      if (b.lines)
        r.lines = b.lines.map((l, i) => ({
          lineNo: i + 1,
          accountId: l.accountId,
          debit: l.debit ?? "0.0000",
          credit: l.credit ?? "0.0000",
          partyId: l.partyId ?? null,
          projectId: l.projectId ?? null,
          costCentreId: l.costCentreId ?? null,
          purposeId: l.purposeId ?? null,
          narration: l.narration ?? null,
        }));
      r.totalDebit = r.lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
      r.version += 1;
      const summary = MOCK_JOURNAL.find((j) => j.id === id);
      if (summary) {
        summary.voucherDate = r.voucherDate;
        summary.narration = r.narration;
        summary.totalDebit = r.totalDebit;
        summary.version = r.version;
      }
      return { status: 200, body: success(journalResource(r)) };
    }
    if (req.method === "DELETE" && !action) {
      if (r.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This voucher has been posted and can no longer be deleted.") };
      delete MOCK_JOURNAL_FULL[id];
      const idx = MOCK_JOURNAL.findIndex((j) => j.id === id);
      if (idx >= 0) MOCK_JOURNAL.splice(idx, 1);
      return { status: 204, body: null };
    }
    if (req.method === "POST" && action === "post") {
      if (r.status !== "DRAFT")
        return { status: 409, body: envelope("VOUCHER_POSTED_IMMUTABLE", "This voucher has already been posted.") };
      const sumDr = r.lines.reduce((s, l) => s + Number(l.debit), 0);
      const sumCr = r.lines.reduce((s, l) => s + Number(l.credit), 0);
      if (Math.abs(sumDr - sumCr) > 0.0001)
        return { status: 400, body: envelope("UNBALANCED_ENTRY", "Σ debit ≠ Σ credit.") };
      const entryNo = allocateJnlEntryNo();
      r.status = "POSTED";
      r.entryNo = entryNo;
      r.journalEntryId = `je-${id}`;
      r.version += 1;
      const summary = MOCK_JOURNAL.find((j) => j.id === id);
      if (summary) {
        summary.status = "POSTED";
        summary.entryNo = entryNo;
        summary.journalEntryId = r.journalEntryId;
        summary.version = r.version;
      }
      return {
        status: 200,
        body: success({ id, entryNo, journalEntryId: r.journalEntryId, status: "POSTED" }),
      };
    }
    if (req.method === "POST" && action === "reverse") {
      if (r.status === "DRAFT")
        return { status: 409, body: envelope("VOUCHER_NOT_POSTED", "This voucher isn't posted, so it can't be reversed.") };
      if (r.status === "CANCELLED")
        return { status: 409, body: envelope("ALREADY_REVERSED", "This voucher has already been reversed.") };
      const b = (body ?? {}) as { reason?: string; version?: number };
      if (!b.reason || !String(b.reason).trim())
        return { status: 400, body: envelope("VALIDATION_ERROR", "Reason is required.") };
      if (b.version !== undefined && b.version !== r.version)
        return { status: 409, body: envelope("OPTIMISTIC_LOCK_CONFLICT", "This voucher was changed by someone else.") };
      const reversalNo = allocateJnlEntryNo();
      r.status = "CANCELLED";
      r.version += 1;
      const summary = MOCK_JOURNAL.find((j) => j.id === id);
      if (summary) {
        summary.status = "CANCELLED";
        summary.version = r.version;
      }
      return {
        status: 200,
        body: success({
          id,
          status: "CANCELLED",
          reversalEntryId: `je-rev-${id}`,
          reversalEntryNo: reversalNo,
        }),
      };
    }
  }

  return { status: 200, body: success({ ok: true, path: req.path }) };
}
