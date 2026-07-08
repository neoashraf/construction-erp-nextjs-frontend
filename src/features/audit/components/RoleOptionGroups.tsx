"use client";

import { userRoleLabel, type RoleListItem } from "../types";

/**
 * `<optgroup>` options for a role `<Select>` — Built-in vs Custom (spec §7 · RBAC v2).
 * Sourced from `GET /api/roles` (no hardcoded role enum). Custom roles are tagged so
 * the Admin can tell them apart; the option value is the role's `id` (`roleId`).
 * Renders nothing until roles resolve (the parent shows the roles-load state).
 */
export function RoleOptionGroups({ roles }: { roles: RoleListItem[] }) {
  const builtIn = roles.filter((r) => r.isSystem);
  const custom = roles.filter((r) => !r.isSystem);
  return (
    <>
      {builtIn.length > 0 && (
        <optgroup label="Built-in roles">
          {builtIn.map((r) => (
            <option key={r.id} value={r.id}>
              {userRoleLabel(r.name)}
            </option>
          ))}
        </optgroup>
      )}
      {custom.length > 0 && (
        <optgroup label="Custom roles">
          {custom.map((r) => (
            <option key={r.id} value={r.id}>
              {userRoleLabel(r.name)} (Custom)
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
