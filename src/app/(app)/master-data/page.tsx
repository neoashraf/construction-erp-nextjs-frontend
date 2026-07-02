import {
  Building2,
  Users,
  BookOpenText,
  CalendarRange,
  Target,
  Tags,
  Package,
  FolderKanban,
} from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ModuleIndex, type ModuleIndexEntry } from "@/components/shell/module-index";

const ENTRIES: ModuleIndexEntry[] = [
  { href: "/master-data/company-settings", title: "Company settings", description: "Company profile, TIN/BIN, fiscal defaults.", icon: Building2 },
  { href: "/master-data/parties", title: "Parties", description: "Customers, suppliers, and other trading parties.", icon: Users },
  { href: "/master-data/chart-of-accounts", title: "Chart of accounts", description: "The GL account tree by type.", icon: BookOpenText },
  { href: "/master-data/financial-years", title: "Financial years", description: "FY definitions and active-year selection.", icon: CalendarRange },
  { href: "/master-data/cost-centres", title: "Cost centres", description: "Cost-centre list, add/rename, activate/deactivate.", icon: Target },
  { href: "/master-data/purposes", title: "Purposes", description: "Project-scoped spend purposes.", icon: Tags },
  { href: "/master-data/items", title: "Items", description: "Stock items, UoM conversions, base-UoM.", icon: Package },
  { href: "/master-data/projects", title: "Projects", description: "Project master, budgets, and godowns.", icon: FolderKanban },
  // Numbering series is now the canonical ADMINISTRATION → Numbering (`/numbering`) home
  // (screen spec §14-5). The `/master-data/numbering-series` route still resolves as a
  // deep-link fallback but is no longer surfaced here (no double-home).
];

/** Master Data (MAS) segment landing page — links to the module's built screens. */
export default async function MasterDataPage() {
  await requireModuleAccess("master-data");
  return <ModuleIndex module="master-data" entries={ENTRIES} />;
}
