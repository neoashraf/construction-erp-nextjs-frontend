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
import { useToast } from "@/components/ui/toast";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useItem } from "../hooks/useItems";
import { useUomConversions } from "../hooks/useUomConversions";
import { useAccounts } from "../hooks/useChartOfAccounts";
import { ItemDetailForm } from "./ItemDetailForm";
import { UomConversionsTable } from "./UomConversionsTable";
import { ItemStatusDialog } from "./ItemStatusDialog";

const LIST_PATH = "/master-data/items";

/** Item detail (FR-MAS-025/026/027/029/033/034). `id="new"` → create; a uuid → edit. */
export function ItemDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const session = useSession();
  // Permission-driven (FE-21): UPDATE grant admits managing; Admin always has it. Backend re-checks.
  const canManage = session ? hasGrant(session, "master_data.items", "UPDATE") : false;
  const isNew = id === "new";
  const [statusMode, setStatusMode] = useState<"deactivate" | "reactivate" | null>(null);

  const itemQuery = useItem(id, !isNew);
  const item = itemQuery.data;
  const conversionsQuery = useUomConversions(isNew ? null : id);
  const accountsQuery = useAccounts();
  const accounts = accountsQuery.data ?? [];

  const baseUomLocked = (conversionsQuery.data?.length ?? 0) > 0 || !!item?.hasTransactions;

  const backLink = (
    <Link
      href={LIST_PATH}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Items
    </Link>
  );

  if (!isNew && itemQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
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

  if (!isNew && (itemQuery.isError || !item)) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <div className="mt-4">
          <Alert tone="destructive" title="Couldn't load this item.">
            <Button size="sm" onClick={() => itemQuery.refetch()} data-testid="item-retry">
              Retry
            </Button>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Master Data" },
          { label: "Items", href: LIST_PATH },
          { label: isNew ? "New item" : `${item?.code} — ${item?.name}` },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">
            {isNew ? "New item" : item?.name}
          </h1>
          {item &&
            (item.isActive ? (
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
          item &&
          (item.isActive ? (
            <Button
              variant="outline"
              size="md"
              onClick={() => setStatusMode("deactivate")}
              data-testid="deactivate-item"
            >
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="md"
              onClick={() => setStatusMode("reactivate")}
              data-testid="reactivate-item"
            >
              Reactivate
            </Button>
          ))}
      </div>

      <div className="mt-4 flex flex-col gap-[18px]">
        <ItemDetailForm
          mode={item ? { kind: "edit", item } : { kind: "create" }}
          accounts={accounts}
          baseUomLocked={baseUomLocked}
          readOnly={!canManage}
          onCreated={(newId) => router.replace(`${LIST_PATH}/${newId}`)}
          onUpdated={() => {
            toast("Item updated.", "success");
            itemQuery.refetch();
          }}
          onCancel={() => router.push(LIST_PATH)}
          onReload={() => itemQuery.refetch()}
          onError={(m) => toast(m, "error")}
        />

        {!isNew && item && (
          <UomConversionsTable itemId={item.id} baseUom={item.baseUom} canManage={canManage} />
        )}
      </div>

      <ItemStatusDialog
        item={statusMode && item ? item : null}
        mode={statusMode ?? "deactivate"}
        onClose={() => setStatusMode(null)}
        onReload={() => itemQuery.refetch()}
      />
    </div>
  );
}
