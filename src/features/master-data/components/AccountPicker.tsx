"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { type Account } from "../types";

/**
 * Default-GL-account picker (FR-MAS-027). Shows ACTIVE accounts only. A native
 * select gives keyboard type-ahead; the form registers this via forwardRef.
 */
export const AccountPicker = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { accounts: Account[]; invalid?: boolean }
>(({ accounts, invalid, ...props }, ref) => (
  <Select ref={ref} invalid={invalid} aria-label="Default GL account" {...props}>
    <option value="">Select an account…</option>
    {accounts
      .filter((a) => a.isActive)
      .map((a) => (
        <option key={a.id} value={a.id}>
          {a.code} — {a.name}
        </option>
      ))}
  </Select>
));
AccountPicker.displayName = "AccountPicker";
