"use client";

import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Admin-only 403 view (spec §6/§11). Non-Admin never sees the nav item (route
 * guard, defence-in-depth); a direct nav to the URL renders this exact copy —
 * the server re-checks `403` on every `/api/roles*` / `/api/permissions*` call.
 */
export function RolesForbiddenView() {
  return (
    <div className="mx-auto max-w-3xl" data-testid="roles-forbidden">
      <Card className="mt-4 p-10">
        <EmptyState
          icon={Lock}
          title="You don't have access to roles & permissions."
          description="This area is restricted to Admin. Every request to roles & permissions is re-checked on the server."
        />
      </Card>
    </div>
  );
}
