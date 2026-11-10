import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { HealthResponse } from "@/api/types";

export function useHealth() {
  return useQuery<HealthResponse, Error>({
    queryKey: ["health"],
    queryFn: () => apiFetch<HealthResponse>("/api/health"),
    refetchInterval: 10000,
    retry: 1,
  });
}
