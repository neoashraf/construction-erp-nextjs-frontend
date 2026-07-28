import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  listAttendanceDevices,
  createAttendanceDevice,
  updateAttendanceDevice,
  deleteAttendanceDevice,
  type CreateAttendanceDeviceInput,
  type UpdateAttendanceDeviceInput,
} from "../api/attendance-devices";

const KEY = ["master-data", "attendance-devices"] as const;

/** Registered fingerprint devices for the session's company. */
export function useAttendanceDevices() {
  return useQuery({
    queryKey: KEY,
    queryFn: listAttendanceDevices,
  });
}

export function useCreateAttendanceDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAttendanceDeviceInput) => createAttendanceDevice(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    retry: false,
  });
}

export function useUpdateAttendanceDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAttendanceDeviceInput }) =>
      updateAttendanceDevice(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    retry: false,
  });
}

export function useDeleteAttendanceDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAttendanceDevice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    retry: false,
  });
}

interface ProjectOption {
  id: string;
  projectCode: string;
  name: string;
}

interface Paged<T> {
  data?: T[];
}

/**
 * Projects for the default-project picker.
 *
 * `useMasterLookups` in lib/masters resolves id→name but does not expose the LIST, which a
 * <select> needs. Same endpoint and page size, kept on its own query key so it can be cached
 * independently of the lookup maps. Degrades to an empty list rather than throwing — an
 * unavailable project list must not block registering a device, since the field is optional.
 */
export function useProjectOptions() {
  const query = useQuery({
    queryKey: ["masters", "projects", "options"],
    queryFn: async (): Promise<ProjectOption[]> => {
      try {
        const res = await apiClient.get<Paged<ProjectOption>>(
          "/masters/projects?page=1&pageSize=500",
        );
        return res.data ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const projects = useMemo(() => {
    const rows = query.data ?? [];
    return [...rows].sort((a, b) =>
      a.projectCode.localeCompare(b.projectCode, undefined, { numeric: true }),
    );
  }, [query.data]);

  return { projects, isLoading: query.isLoading };
}
