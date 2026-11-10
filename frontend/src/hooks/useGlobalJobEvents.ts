import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { GlobalJobEvent, Job } from "@/api/types";

export function useGlobalJobEvents() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource("/api/jobs/events");
      eventSourceRef.current = es;

      const handleUpdate = (data: GlobalJobEvent) => {
        // Invalidate active queries
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        queryClient.invalidateQueries({ queryKey: ["batches"] });
        queryClient.invalidateQueries({ queryKey: ["health"] });

        if (data.event === "done" && data.job) {
          const job: Job = data.job;
          queryClient.invalidateQueries({ queryKey: ["results"] });
          queryClient.setQueryData(["jobs", job.id], job);

          const queryText = job.request?.query || "búsqueda";

          switch (job.status) {
            case "succeeded":
              toast.success(`✔ ${queryText}: ${job.progress.collected} anuncios recolectados`, {
                action: job.result_file
                  ? {
                      label: "Ver resultados",
                      onClick: () => navigate(`/results/${encodeURIComponent(job.result_file!)}`),
                    }
                  : {
                      label: "Ver detalle",
                      onClick: () => navigate(`/jobs/${job.id}`),
                    },
              });
              break;

            case "empty":
              toast.info(`ℹ ${queryText}: Sin anuncios que coincidan`, {
                action: {
                  label: "Ver detalle",
                  onClick: () => navigate(`/jobs/${job.id}`),
                },
              });
              break;

            case "failed":
              toast.error(`✖ ${queryText}: ${job.error || "Falló la ejecución"}`, {
                action: {
                  label: "Reintentar",
                  onClick: () => navigate(`/jobs/${job.id}`),
                },
              });
              break;

            case "cancelled":
              toast(`⛔ ${queryText}: Ejecución cancelada`, {
                action: {
                  label: "Ver detalle",
                  onClick: () => navigate(`/jobs/${job.id}`),
                },
              });
              break;
          }
        }
      };

      es.addEventListener("job_update", (e) => {
        try {
          const parsed = JSON.parse(e.data) as GlobalJobEvent;
          handleUpdate(parsed);
        } catch (err) {
          console.error("Error parsing global job_update event:", err);
        }
      });

      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as GlobalJobEvent;
          handleUpdate(parsed);
        } catch {
          // Ignore ping or unparsed messages
        }
      };

      es.onerror = () => {
        // SSE auto-reconnects, but if disconnected, we can let browser handle reconnect
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [queryClient, navigate]);
}
