import { useCallback, useEffect, useReducer, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Job, JobProgress, JobStatusEvent, LogEntry, WarningEvent } from "@/api/types";

export const MAX_EVENT_LOGS = 5000;

export interface JobEventsState {
  job: Job | null;
  logs: LogEntry[];
  warnings: WarningEvent[];
  connected: boolean;
  error: string | null;
}

export type JobEventAction =
  | { type: "CONNECT" }
  | { type: "DISCONNECT" }
  | { type: "ERROR"; payload: string }
  | { type: "SNAPSHOT"; payload: Job; replayLogs?: LogEntry[] }
  | { type: "STATUS"; payload: JobStatusEvent }
  | { type: "PROGRESS"; payload: JobProgress }
  | { type: "LOG"; payload: LogEntry }
  | { type: "WARNING"; payload: WarningEvent }
  | { type: "DONE"; payload: Job };

export const initialJobEventsState: JobEventsState = {
  job: null,
  logs: [],
  warnings: [],
  connected: false,
  error: null,
};

export function jobEventsReducer(state: JobEventsState, action: JobEventAction): JobEventsState {
  switch (action.type) {
    case "CONNECT":
      return { ...state, connected: true, error: null };

    case "DISCONNECT":
      return { ...state, connected: false };

    case "ERROR":
      return { ...state, connected: false, error: action.payload };

    case "SNAPSHOT": {
      const incomingJob = action.payload;
      const initialLogs = action.replayLogs || state.logs;
      return {
        ...state,
        job: incomingJob,
        logs: initialLogs.slice(-MAX_EVENT_LOGS),
        error: null,
      };
    }

    case "STATUS": {
      if (!state.job) return state;
      const updatedJob: Job = {
        ...state.job,
        status: action.payload.status,
        phase: action.payload.phase ?? state.job.phase,
        started_at: action.payload.started_at ?? state.job.started_at,
        finished_at: action.payload.finished_at ?? state.job.finished_at,
      };
      return {
        ...state,
        job: updatedJob,
      };
    }

    case "PROGRESS": {
      if (!state.job) return state;
      return {
        ...state,
        job: {
          ...state.job,
          progress: action.payload,
        },
      };
    }

    case "LOG": {
      const newLogs = state.logs.length >= MAX_EVENT_LOGS
        ? [...state.logs.slice(state.logs.length - MAX_EVENT_LOGS + 1), action.payload]
        : [...state.logs, action.payload];
      return {
        ...state,
        logs: newLogs,
      };
    }

    case "WARNING": {
      return {
        ...state,
        warnings: [...state.warnings, action.payload],
      };
    }

    case "DONE": {
      return {
        ...state,
        job: action.payload,
        connected: false,
      };
    }

    default:
      return state;
  }
}

export function useJobEvents(jobId: string | null | undefined, initialJob?: Job | null) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(
    jobEventsReducer,
    initialJobEventsState,
    (init) => (initialJob ? { ...init, job: initialJob } : init)
  );

  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!jobId || typeof window === "undefined") return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = `/api/jobs/${jobId}/events`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      dispatch({ type: "CONNECT" });
    };

    es.onerror = () => {
      dispatch({ type: "ERROR", payload: "Error en la conexión con el flujo de eventos" });
      es.close();
      dispatch({ type: "DISCONNECT" });
    };

    es.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse(e.data) as Job;
        dispatch({ type: "SNAPSHOT", payload: data });
      } catch (err) {
        console.error("Failed to parse snapshot SSE event:", err);
      }
    });

    es.addEventListener("status", (e) => {
      try {
        const data = JSON.parse(e.data) as JobStatusEvent;
        dispatch({ type: "STATUS", payload: data });
      } catch (err) {
        console.error("Failed to parse status SSE event:", err);
      }
    });

    es.addEventListener("progress", (e) => {
      try {
        const data = JSON.parse(e.data) as JobProgress;
        dispatch({ type: "PROGRESS", payload: data });
      } catch (err) {
        console.error("Failed to parse progress SSE event:", err);
      }
    });

    es.addEventListener("log", (e) => {
      try {
        const data = JSON.parse(e.data) as LogEntry;
        dispatch({ type: "LOG", payload: data });
      } catch (err) {
        console.error("Failed to parse log SSE event:", err);
      }
    });

    es.addEventListener("warning", (e) => {
      try {
        const data = JSON.parse(e.data) as WarningEvent;
        dispatch({ type: "WARNING", payload: data });
      } catch (err) {
        console.error("Failed to parse warning SSE event:", err);
      }
    });

    es.addEventListener("done", (e) => {
      try {
        const finalJob = JSON.parse(e.data) as Job;
        dispatch({ type: "DONE", payload: finalJob });

        // Update react-query cache
        queryClient.setQueryData(["jobs", finalJob.id], finalJob);
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        queryClient.invalidateQueries({ queryKey: ["results"] });
        queryClient.invalidateQueries({ queryKey: ["health"] });

        es.close();
      } catch (err) {
        console.error("Failed to parse done SSE event:", err);
      }
    });
  }, [jobId, queryClient]);

  useEffect(() => {
    // If the job is already finished, do not open an SSE stream unless forced
    if (
      initialJob &&
      ["succeeded", "empty", "failed", "cancelled"].includes(initialJob.status)
    ) {
      dispatch({ type: "SNAPSHOT", payload: initialJob });
      return;
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [jobId, initialJob, connect]);

  return {
    ...state,
    reconnect: connect,
  };
}
