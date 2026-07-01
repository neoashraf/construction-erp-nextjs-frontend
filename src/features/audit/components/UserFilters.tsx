"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { USER_ROLES, userRoleLabel } from "../types";

export type StatusFilter = "all" | "active" | "inactive";

/**
 * Users filter bar (spec §5, design file: Role · Status · debounced search).
 * Filters apply on change — the parent debounces search and re-queries
 * `GET /api/users` server-side (spec §9, overview §6 pagination).
 */
export function UserFilters({
  role,
  onRole,
  status,
  onStatus,
  q,
  onQ,
}: {
  role: string;
  onRole: (r: string) => void;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  q: string;
  onQ: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3.5 shadow-sm">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-filter-role">Role</Label>
        <Select
          id="user-filter-role"
          value={role}
          onChange={(e) => onRole(e.target.value)}
          className="w-[190px]"
        >
          <option value="all">All roles</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {userRoleLabel(r)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-filter-status">Status</Label>
        <Select
          id="user-filter-status"
          value={status}
          onChange={(e) => onStatus(e.target.value as StatusFilter)}
          className="w-[150px]"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor="user-filter-search">Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            id="user-filter-search"
            type="search"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search by name or email"
            className="pl-9"
          />
        </div>
      </div>
    </div>
  );
}
