import { Users, ShieldCheck, ScrollText } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ModuleIndex, type ModuleIndexEntry } from "@/components/shell/module-index";

const ENTRIES: ModuleIndexEntry[] = [
  { href: "/audit/users", title: "Users", description: "Who can sign in — create, edit, activate, reset password.", icon: Users },
  { href: "/audit/roles", title: "Roles & permissions", description: "Per-role module × action permission matrix.", icon: ShieldCheck },
  { href: "/audit/log", title: "Audit log", description: "The append-only, tamper-evident audit trail.", icon: ScrollText },
];

/** Audit, Security & Access (AUD) segment landing page — links to the module's built screens. */
export default async function AuditPage() {
  await requireModuleAccess("audit");
  return <ModuleIndex module="audit" entries={ENTRIES} />;
}
