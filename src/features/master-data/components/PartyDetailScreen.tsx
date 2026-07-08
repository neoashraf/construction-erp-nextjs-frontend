"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useParty } from "../hooks/useParties";
import { RoleBadges } from "./RoleBadges";
import { PartyDetailForm } from "./PartyDetailForm";
import { PartyStatusDialog } from "./PartyStatusDialog";

const LIST_PATH = "/master-data/parties";

/**
 * Party detail screen (FR-MAS-023/029/033). `id="new"` → create; a uuid → edit
 * (fetch). Header carries name + role badges + status + deactivate/reactivate.
 * Admin/Accounts manage; other roles get a read-only form.
 */
export function PartyDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const session = useSession();
  // Permission-driven (FE-21): UPDATE grant admits managing; Admin always has it. Backend re-checks.
  const canManage = session ? hasGrant(session, "master_data.parties", "UPDATE") : false;
  const isNew = id === "new";
  const [statusMode, setStatusMode] = useState<"deactivate" | "reactivate" | null>(null);

  const query = useParty(id, !isNew);
  const party = query.data;

  const backLink = (
    <Link
      href={LIST_PATH}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Parties
    </Link>
  );

  if (!isNew && query.isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        {backLink}
        <Skeleton className="mt-3 h-7 w-56" />
        <Card className="mt-4 p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-2.5 w-2/5" />
                <Skeleton className="mt-2.5 h-9 w-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!isNew && (query.isError || !party)) {
    return (
      <div className="mx-auto max-w-4xl">
        {backLink}
        <div className="mt-4">
          <Alert tone="destructive" title="Couldn't load this party.">
            <div className="flex flex-col items-start gap-2">
              <span>The server returned an error. Check your connection and try again.</span>
              <Button size="sm" onClick={() => query.refetch()} data-testid="party-retry">
                Retry
              </Button>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb
        items={[
          { label: "Master Data" },
          { label: "Parties", href: LIST_PATH },
          { label: isNew ? "New party" : (party?.name ?? "") },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">
            {isNew ? "New party" : party?.name}
          </h1>
          {party && <RoleBadges party={party} />}
          {party &&
            (party.isActive ? (
              <Badge tone="success" dot>
                Active
              </Badge>
            ) : (
              <Badge tone="neutral" dot>
                Inactive
              </Badge>
            ))}
        </div>
        {canManage &&
          party &&
          (party.isActive ? (
            <Button
              variant="outline"
              size="md"
              onClick={() => setStatusMode("deactivate")}
              data-testid="deactivate-party"
            >
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="md"
              onClick={() => setStatusMode("reactivate")}
              data-testid="reactivate-party"
            >
              Reactivate
            </Button>
          ))}
      </div>

      <div className="mt-4">
        <PartyDetailForm
          mode={party ? { kind: "edit", party } : { kind: "create" }}
          readOnly={!canManage}
          onCreated={(newId) => router.replace(`${LIST_PATH}/${newId}`)}
          onUpdated={() => query.refetch()}
          onCancel={() => router.push(LIST_PATH)}
          onReload={() => query.refetch()}
        />
      </div>

      <PartyStatusDialog
        party={statusMode && party ? party : null}
        mode={statusMode ?? "deactivate"}
        onClose={() => setStatusMode(null)}
        onReload={() => query.refetch()}
      />
    </div>
  );
}
