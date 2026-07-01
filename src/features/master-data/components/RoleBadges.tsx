import { Badge } from "@/components/ui/badge";
import { type Party } from "../types";

/** Customer / Supplier role badges (spec §5). A party may carry both. */
export function RoleBadges({ party }: { party: Pick<Party, "isCustomer" | "isSupplier"> }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {party.isCustomer && (
        <Badge tone="info" className="normal-case">
          Customer
        </Badge>
      )}
      {party.isSupplier && (
        <Badge tone="accent" className="normal-case">
          Supplier
        </Badge>
      )}
      {!party.isCustomer && !party.isSupplier && <span className="text-faint">—</span>}
    </span>
  );
}
