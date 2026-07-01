import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guard-module-page";

/**
 * Voucher Numbering (NUM) segment. The one built screen (fe-numbering-series)
 * lives at /master-data/numbering-series per its brief (breadcrumb "Master Data /
 * Numbering series"); redirect the sidebar's Numbering entry there so the nav
 * link isn't a dead end.
 */
export default async function NumberingPage() {
  await requireModuleAccess("numbering");
  redirect("/master-data/numbering-series");
}
