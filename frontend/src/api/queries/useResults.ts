import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type {
  MergeRequest,
  MergeResponse,
  ResultDetailResponse,
  ResultFile,
} from "@/api/types";

export interface ResultsQueryParams {
  q?: string;
  format?: string;
  ig_only?: boolean;
}

export function useResults(params?: ResultsQueryParams) {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.format) searchParams.set("format", params.format);
  if (params?.ig_only !== undefined) searchParams.set("ig_only", String(params.ig_only));

  const queryStr = searchParams.toString();
  const path = queryStr ? `/api/results?${queryStr}` : "/api/results";

  return useQuery<ResultFile[], Error>({
    queryKey: ["results", params],
    queryFn: () => apiFetch<ResultFile[]>(path),
  });
}

export function useResult(filename: string | null | undefined) {
  return useQuery<ResultDetailResponse, Error>({
    queryKey: ["results", filename],
    queryFn: () => apiFetch<ResultDetailResponse>(`/api/results/${encodeURIComponent(filename!)}`),
    enabled: !!filename,
  });
}

export function useDeleteResult() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (filename: string) =>
      apiFetch<void>(`/api/results/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      }),
    onSuccess: (_, deletedFilename) => {
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.removeQueries({ queryKey: ["results", deletedFilename] });
    },
  });
}

export function useMergeResults() {
  return useMutation<MergeResponse, Error, MergeRequest>({
    mutationFn: (request: MergeRequest) =>
      apiFetch<MergeResponse>("/api/results/merge", {
        method: "POST",
        body: JSON.stringify(request),
      }),
  });
}
