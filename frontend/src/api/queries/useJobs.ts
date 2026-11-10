import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { Job, JobsListResponse, JobStatus, LogEntry, ScrapeRequest } from "@/api/types";

export interface JobsQueryParams {
  status?: JobStatus;
  limit?: number;
  offset?: number;
}

export function useJobs(params?: JobsQueryParams) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit !== undefined) searchParams.set("limit", params.limit.toString());
  if (params?.offset !== undefined) searchParams.set("offset", params.offset.toString());

  const queryStr = searchParams.toString();
  const path = queryStr ? `/api/jobs?${queryStr}` : "/api/jobs";

  return useQuery<JobsListResponse, Error>({
    queryKey: ["jobs", params],
    queryFn: () => apiFetch<JobsListResponse>(path),
  });
}

export function useJob(jobId: string | null | undefined) {
  return useQuery<Job, Error>({
    queryKey: ["jobs", jobId],
    queryFn: () => apiFetch<Job>(`/api/jobs/${jobId}`),
    enabled: !!jobId,
  });
}

export function useJobLogs(jobId: string | null | undefined, format: "text" | "json" = "text") {
  return useQuery<string | LogEntry[], Error>({
    queryKey: ["jobs", jobId, "logs", format],
    queryFn: () => apiFetch<string | LogEntry[]>(`/api/jobs/${jobId}/logs?format=${format}`),
    enabled: !!jobId,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation<Job, Error, ScrapeRequest>({
    mutationFn: (request: ScrapeRequest) =>
      apiFetch<Job>("/api/jobs", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    onSuccess: (newJob) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["health"] });
      queryClient.setQueryData(["jobs", newJob.id], newJob);
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation<Job, Error, string>({
    mutationFn: (jobId: string) =>
      apiFetch<Job>(`/api/jobs/${jobId}/cancel`, {
        method: "POST",
      }),
    onSuccess: (updatedJob) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.setQueryData(["jobs", updatedJob.id], updatedJob);
    },
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();

  return useMutation<Job, Error, string>({
    mutationFn: (jobId: string) =>
      apiFetch<Job>(`/api/jobs/${jobId}/retry`, {
        method: "POST",
      }),
    onSuccess: (newJob) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.setQueryData(["jobs", newJob.id], newJob);
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (jobId: string) =>
      apiFetch<void>(`/api/jobs/${jobId}`, {
        method: "DELETE",
      }),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.removeQueries({ queryKey: ["jobs", deletedId] });
    },
  });
}
