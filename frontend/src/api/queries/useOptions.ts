import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { OptionsResponse } from "@/api/types";

export function useOptions() {
  return useQuery<OptionsResponse, Error>({
    queryKey: ["options"],
    queryFn: () => apiFetch<OptionsResponse>("/api/options"),
    staleTime: Infinity,
  });
}
