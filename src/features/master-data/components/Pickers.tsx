"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { type Party, type UserRef, type CostCentre } from "../types";

/**
 * Company-scoped reference pickers (native selects → keyboard type-ahead). Customer =
 * customer parties; PM = users; cost centre = ACTIVE cost centres (+ an inactive
 * option kept for existing budget rows). Cross-company/stale refs surface as
 * CROSS_COMPANY_REFERENCE on the field.
 */

export const CustomerPicker = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { customers: Party[]; invalid?: boolean }
>(({ customers, invalid, ...props }, ref) => (
  <Select ref={ref} invalid={invalid} aria-label="Customer" {...props}>
    <option value="">Select a customer…</option>
    {customers.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name}
      </option>
    ))}
  </Select>
));
CustomerPicker.displayName = "CustomerPicker";

export const ProjectManagerPicker = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { users: UserRef[]; invalid?: boolean }
>(({ users, invalid, ...props }, ref) => (
  <Select ref={ref} invalid={invalid} aria-label="Project manager" {...props}>
    <option value="">Select a project manager…</option>
    {users.map((u) => (
      <option key={u.id} value={u.id}>
        {u.name}
      </option>
    ))}
  </Select>
));
ProjectManagerPicker.displayName = "ProjectManagerPicker";

export const CostCentrePicker = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { centres: CostCentre[]; invalid?: boolean }
>(({ centres, invalid, ...props }, ref) => (
  <Select ref={ref} invalid={invalid} aria-label="Cost centre" {...props}>
    <option value="">Select a cost centre…</option>
    {centres
      .filter((c) => c.isActive)
      .map((c) => (
        <option key={c.id} value={c.id}>
          {c.code} — {c.name}
        </option>
      ))}
  </Select>
));
CostCentrePicker.displayName = "CostCentrePicker";
