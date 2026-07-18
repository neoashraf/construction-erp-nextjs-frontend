"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  classifyAccount,
  listCostCentreOptions,
  listPartyOptions,
  listProjectOptions,
  listPurposeOptions,
  type AccountOption,
} from "../api/masters";
import { type JournalLineErrors, type JournalLineValues } from "../schemas/journal.schema";

/**
 * Per-line conditional cluster (spec §5/§7 decision table; FR-GEN-005/-006/-007). Reads
 * the account's classification and renders exactly the applicable inputs: P&L →
 * project+cost_centre+purpose (all required); AR/AP control → party (required); other
 * balance-sheet → nothing. The parent editor clears the now-inapplicable fields when
 * the account changes (spec §9), so this component only renders + validates.
 *
 * `JournalLineRow` mounts this once inside its `<md` stacked card AND once inside its
 * `>=md` grid row (parallel DOM subtrees, CSS-gated) — `variant` suffixes every id/
 * testid on the mobile copy so element ids and `data-testid`s stay unique in the DOM.
 */
export function LineDimensionCluster({
  line,
  errors,
  accountsIndex,
  disabled,
  onChange,
  variant = "desktop",
}: {
  line: JournalLineValues;
  errors?: JournalLineErrors;
  accountsIndex: Map<string, AccountOption>;
  disabled: boolean;
  onChange: (p: Partial<JournalLineValues>) => void;
  variant?: "desktop" | "mobile";
}) {
  const user = useAuthenticatedUser();
  const scope = useMemo(
    () => ({ companyId: user.companyId, financialYearId: user.financialYearId }),
    [user.companyId, user.financialYearId],
  );
  const account = accountsIndex.get(line.accountId);
  const cls = classifyAccount(account);
  const suffix = variant === "mobile" ? "-mobile" : "";

  const projectsQ = useQuery({
    queryKey: queryKeys.list("contra-journal", "projects", scope, {}),
    queryFn: () => listProjectOptions(),
    enabled: cls === "PL",
    staleTime: 60_000,
  });
  const costCentresQ = useQuery({
    queryKey: queryKeys.list("contra-journal", "cost-centres", scope, {}),
    queryFn: () => listCostCentreOptions(),
    enabled: cls === "PL",
    staleTime: 60_000,
  });
  const purposesQ = useQuery({
    queryKey: queryKeys.list("contra-journal", "purposes", scope, { projectId: line.projectId }),
    queryFn: () => listPurposeOptions(line.projectId),
    enabled: cls === "PL" && !!line.projectId,
    staleTime: 60_000,
  });
  const partiesQ = useQuery({
    queryKey: queryKeys.list("contra-journal", "parties", scope, {}),
    queryFn: () => listPartyOptions(),
    enabled: cls === "CONTROL",
    staleTime: 60_000,
  });

  // Announce cluster reveal / clear via aria-live.
  useEffect(() => {
    /* no-op — parent editor announces via the row's role="status" region. */
  }, [cls]);

  if (cls === "OTHER_BS" || !line.accountId) {
    return (
      <div className="pt-2 text-[11.5px] text-muted-foreground" data-testid={`journal-line-cluster-none-${line.key}${suffix}`}>
        {line.accountId ? "No dimensions — balance-sheet line." : "No tags required."}
      </div>
    );
  }

  if (cls === "CONTROL") {
    return (
      <div className="flex flex-col gap-1" data-testid={`journal-line-cluster-control-${line.key}${suffix}`}>
        <Label htmlFor={`journal-line-party-${line.key}${suffix}`} className="text-[10px] normal-case tracking-normal">
          Party
        </Label>
        <Select
          id={`journal-line-party-${line.key}${suffix}`}
          value={line.partyId}
          onChange={(e) => onChange({ partyId: e.target.value })}
          invalid={!!errors?.partyId}
          disabled={disabled}
          aria-label="Party (control account)"
          data-testid={`journal-line-party-${line.key}${suffix}`}
        >
          <option value="">Choose a party…</option>
          {(partiesQ.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        {errors?.partyId && (
          <p role="alert" className="text-[11.5px] font-medium text-destructive" data-testid={`journal-line-party-err-${line.key}${suffix}`}>
            {errors.partyId}
          </p>
        )}
      </div>
    );
  }

  // PL — project + cost centre + purpose, stacked (the column is narrow at 1024).
  return (
    <div className="flex flex-col gap-1.5" data-testid={`journal-line-cluster-pl-${line.key}${suffix}`}>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`journal-line-project-${line.key}${suffix}`} className="text-[10px] normal-case tracking-normal">
          Project
        </Label>
        <Select
          id={`journal-line-project-${line.key}${suffix}`}
          value={line.projectId}
          onChange={(e) => onChange({ projectId: e.target.value, purposeId: "" })}
          invalid={!!errors?.projectId}
          disabled={disabled}
          aria-label="Project"
          data-testid={`journal-line-project-${line.key}${suffix}`}
        >
          <option value="">Project…</option>
          {(projectsQ.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.projectCode ? `${p.projectCode} · ${p.name}` : p.name}</option>
          ))}
        </Select>
        {errors?.projectId && (
          <p role="alert" className="text-[11.5px] font-medium text-destructive" data-testid={`journal-line-project-err-${line.key}${suffix}`}>
            {errors.projectId}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`journal-line-cost-centre-${line.key}${suffix}`} className="text-[10px] normal-case tracking-normal">
          Cost centre
        </Label>
        <Select
          id={`journal-line-cost-centre-${line.key}${suffix}`}
          value={line.costCentreId}
          onChange={(e) => onChange({ costCentreId: e.target.value })}
          invalid={!!errors?.costCentreId}
          disabled={disabled}
          aria-label="Cost centre"
          data-testid={`journal-line-cost-centre-${line.key}${suffix}`}
        >
          <option value="">Cost centre…</option>
          {(costCentresQ.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        {errors?.costCentreId && (
          <p role="alert" className="text-[11.5px] font-medium text-destructive" data-testid={`journal-line-cost-centre-err-${line.key}${suffix}`}>
            {errors.costCentreId}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`journal-line-purpose-${line.key}${suffix}`} className="text-[10px] normal-case tracking-normal">
          Purpose
        </Label>
        <Select
          id={`journal-line-purpose-${line.key}${suffix}`}
          value={line.purposeId}
          onChange={(e) => onChange({ purposeId: e.target.value })}
          invalid={!!errors?.purposeId}
          disabled={disabled || !line.projectId}
          aria-label="Purpose"
          data-testid={`journal-line-purpose-${line.key}${suffix}`}
        >
          <option value="">{line.projectId ? "Purpose…" : "—"}</option>
          {(purposesQ.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        {errors?.purposeId && (
          <p role="alert" className="text-[11.5px] font-medium text-destructive" data-testid={`journal-line-purpose-err-${line.key}${suffix}`}>
            {errors.purposeId}
          </p>
        )}
      </div>
    </div>
  );
}
