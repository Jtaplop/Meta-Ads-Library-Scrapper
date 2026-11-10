import { describe, it, expect } from "vitest";
import {
  jobEventsReducer,
  initialJobEventsState,
  MAX_EVENT_LOGS,
  type JobEventsState,
} from "../useJobEvents";
import type { Job, JobProgress, JobStatusEvent, LogEntry, WarningEvent } from "@/api/types";

const mockJob: Job = {
  id: "job123",
  request: { mode: "keyword", query: "test query", limit: 50 },
  command: ["python", "main.py"],
  status: "running",
  phase: "starting",
  progress: {
    collected: 0,
    limit: 50,
    iteration: 0,
    max_iterations: 50,
    stagnant: 0,
    stagnant_threshold: 20,
    unique_ig_profiles: 0,
    retries: 0,
    raw_unique: 0,
    validated: 0,
    discarded: 0,
  },
  created_at: "2026-11-10T12:00:00Z",
};

describe("jobEventsReducer", () => {
  it("handles CONNECT and DISCONNECT", () => {
    let state = jobEventsReducer(initialJobEventsState, { type: "CONNECT" });
    expect(state.connected).toBe(true);
    expect(state.error).toBeNull();

    state = jobEventsReducer(state, { type: "DISCONNECT" });
    expect(state.connected).toBe(false);
  });

  it("handles ERROR", () => {
    const state = jobEventsReducer(initialJobEventsState, {
      type: "ERROR",
      payload: "Connection error",
    });
    expect(state.connected).toBe(false);
    expect(state.error).toBe("Connection error");
  });

  it("handles SNAPSHOT", () => {
    const state = jobEventsReducer(initialJobEventsState, {
      type: "SNAPSHOT",
      payload: mockJob,
    });
    expect(state.job).toEqual(mockJob);
    expect(state.error).toBeNull();
  });

  it("handles STATUS update", () => {
    const prevState: JobEventsState = {
      ...initialJobEventsState,
      job: mockJob,
    };

    const statusPayload: JobStatusEvent = {
      status: "running",
      phase: "collecting",
      started_at: "2026-11-10T12:00:01Z",
    };

    const state = jobEventsReducer(prevState, {
      type: "STATUS",
      payload: statusPayload,
    });

    expect(state.job?.status).toBe("running");
    expect(state.job?.phase).toBe("collecting");
    expect(state.job?.started_at).toBe("2026-11-10T12:00:01Z");
  });

  it("handles PROGRESS update", () => {
    const prevState: JobEventsState = {
      ...initialJobEventsState,
      job: mockJob,
    };

    const progressPayload: JobProgress = {
      ...mockJob.progress,
      collected: 25,
      iteration: 5,
      stagnant: 1,
      unique_ig_profiles: 10,
    };

    const state = jobEventsReducer(prevState, {
      type: "PROGRESS",
      payload: progressPayload,
    });

    expect(state.job?.progress.collected).toBe(25);
    expect(state.job?.progress.iteration).toBe(5);
    expect(state.job?.progress.unique_ig_profiles).toBe(10);
  });

  it("handles LOG appending and respects MAX_EVENT_LOGS limit", () => {
    let state = initialJobEventsState;

    const entry1: LogEntry = {
      seq: 1,
      ts: "12:00:01",
      level: "INFO",
      message: "Browser launched",
      raw: "2026-11-10 12:00:01 INFO Browser launched",
    };

    state = jobEventsReducer(state, { type: "LOG", payload: entry1 });
    expect(state.logs.length).toBe(1);
    expect(state.logs[0].message).toBe("Browser launched");

    // Pre-fill state with MAX_EVENT_LOGS logs
    const fullLogs: LogEntry[] = Array.from({ length: MAX_EVENT_LOGS }, (_, i) => ({
      seq: i,
      ts: "12:00:00",
      level: "DEBUG",
      message: `Log line ${i}`,
      raw: `Raw ${i}`,
    }));

    state = { ...state, logs: fullLogs };
    expect(state.logs.length).toBe(MAX_EVENT_LOGS);

    const newEntry: LogEntry = {
      seq: 99999,
      ts: "12:01:00",
      level: "INFO",
      message: "Newest line",
      raw: "Newest line raw",
    };

    state = jobEventsReducer(state, { type: "LOG", payload: newEntry });
    expect(state.logs.length).toBe(MAX_EVENT_LOGS);
    expect(state.logs[state.logs.length - 1].message).toBe("Newest line");
    expect(state.logs[0].message).toBe("Log line 1");
  });

  it("handles WARNING", () => {
    const warning: WarningEvent = {
      kind: "retry",
      message: "Navigation timeout, retrying...",
      ts: "12:00:10",
    };

    const state = jobEventsReducer(initialJobEventsState, {
      type: "WARNING",
      payload: warning,
    });

    expect(state.warnings.length).toBe(1);
    expect(state.warnings[0].kind).toBe("retry");
  });

  it("handles DONE", () => {
    const doneJob: Job = {
      ...mockJob,
      status: "succeeded",
      phase: "finished",
      result_file: "test_result.csv",
      finished_at: "2026-11-10T12:05:00Z",
    };

    const state = jobEventsReducer(
      { ...initialJobEventsState, connected: true, job: mockJob },
      { type: "DONE", payload: doneJob }
    );

    expect(state.job?.status).toBe("succeeded");
    expect(state.job?.result_file).toBe("test_result.csv");
    expect(state.connected).toBe(false);
  });
});
