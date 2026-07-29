import {
  LayoutDashboard,
  Building2,
  Handshake,
  Boxes,
  ShoppingCart,
  FileText,
  Users,
  BookOpenText,
  BarChart3,
  ShieldCheck,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { type NavIconKey } from "@/lib/nav/nav-tree";

/** Resolve a nav section's icon key to its lucide component (design-system iconography). */
export const NAV_ICON: Record<NavIconKey, LucideIcon> = {
  home: LayoutDashboard,
  projects: Building2,
  parties: Handshake,
  materials: Boxes,
  "purchases-payments": ShoppingCart,
  "billing-receipts": FileText,
  people: Users,
  accounts: BookOpenText,
  reports: BarChart3,
  "users-access": ShieldCheck,
  "audit-log": ScrollText,
};
