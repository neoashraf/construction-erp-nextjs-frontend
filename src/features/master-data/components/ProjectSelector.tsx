"use client";

import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { type Project } from "../types";

/** Project picker (PM sees assigned projects only — filtered by the server). */
export function ProjectSelector({
  projects,
  value,
  onChange,
  loading,
}: {
  projects: Project[];
  value: string | null;
  onChange: (id: string) => void;
  loading?: boolean;
}) {
  return (
    <div className="w-full max-w-sm">
      <Label htmlFor="project-select" className="mb-1.5 block text-[10.5px]">
        Project
      </Label>
      <Select
        id="project-select"
        value={value ?? ""}
        disabled={loading}
        onChange={(e) => onChange(e.target.value)}
        data-testid="project-select"
      >
        <option value="">Select a project…</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.projectCode} — {p.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
