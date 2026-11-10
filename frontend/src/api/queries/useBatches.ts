import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { Batch, BatchDetailResponse, BatchRequest } from "@/api/types";

export function useBatches() {
  return useQuery<Batch[], Error>({
    queryKey: ["batches"],
    queryFn: () => apiFetch<Batch[]>("/api/batches"),
    // If the endpoint is not yet supported or returns empty, default gracefully
    retry: false,
  });
}

export function useBatch(batchId: string | null | undefined) {
  return useQuery<BatchDetailResponse, Error>({
    queryKey: ["batches", batchId],
    queryFn: () => apiFetch<BatchDetailResponse>(`/api/batches/${batchId}`),
    enabled: !!batchId,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation<Batch, Error, BatchRequest>({
    mutationFn: (request: BatchRequest) =>
      apiFetch<Batch>("/api/batches", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    onSuccess: (newBatch) => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["health"] });
      queryClient.setQueryData(["batches", newBatch.id], newBatch);
    },
  });
}

export function useCancelBatch() {
  const queryClient = useQueryClient();

  return useMutation<Batch, Error, string>({
    mutationFn: (batchId: string) =>
      apiFetch<Batch>(`/api/batches/${batchId}/cancel`, {
        method: "POST",
      }),
    onSuccess: (updatedBatch) => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.setQueryData(["batches", updatedBatch.id], updatedBatch);
    },
  });
}
