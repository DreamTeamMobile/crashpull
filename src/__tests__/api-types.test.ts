import { describe, expect, test } from "bun:test";
import type {
  ErrorType,
  IssueState,
  FrameOwner,
  Issue,
  Frame,
  Event,
  TopIssuesResponse,
  ListEventsResponse,
  IntervalMetrics,
  Report,
  ReportGroup,
} from "../api/types.js";

describe("API types", () => {
  test("ErrorType union covers all values", () => {
    const vals: ErrorType[] = ["FATAL", "NON_FATAL", "ANR"];
    expect(vals).toHaveLength(3);
  });

  test("IssueState union covers all values", () => {
    const vals: IssueState[] = ["OPEN", "CLOSED", "MUTED"];
    expect(vals).toHaveLength(3);
  });

  test("FrameOwner union covers all values", () => {
    const vals: FrameOwner[] = ["DEVELOPER", "VENDOR", "SYSTEM", "PLATFORM", "RUNTIME"];
    expect(vals).toHaveLength(5);
  });

  test("Issue has expected shape", () => {
    const issue: Issue = {
      id: "abc123",
      title: "NullPointerException",
      subtitle: "at com.example.App.main",
      errorType: "FATAL",
      state: "OPEN",
      sampleEvent: "event123",
      uri: "projects/p/issues/abc123",
      firstSeenVersion: "1.0.0",
      lastSeenVersion: "1.2.0",
      signals: [{ signal: "SIGABRT", description: "Abort signal" }],
      name: "projects/p/issues/abc123",
      variants: [{ id: "v1", sampleEvent: "ev1", uri: "https://example.com/v1" }],
    };
    expect(issue.id).toBe("abc123");
    expect(issue.errorType).toBe("FATAL");
    expect(issue.signals).toHaveLength(1);
    expect(issue.variants).toHaveLength(1);
  });

  test("Event has expected shape", () => {
    const event: Event = {
      name: "projects/p/issues/i/events/e",
      platform: "android",
      eventId: "e123",
      eventTime: "2025-01-01T00:00:00Z",
      device: { model: "Pixel 6", manufacturer: "Google", architecture: "arm64" },
      operatingSystem: { displayVersion: "13", os: "Android", type: "ANDROID" },
      version: { displayVersion: "1.0.0", buildVersion: "100" },
      blameFrame: { line: "42", file: "App.java", symbol: "main", library: "app", owner: "DEVELOPER", blamed: true },
      exceptions: [{
        type: "NullPointerException",
        exceptionMessage: "null ref",
        frames: [],
        rawStackTrace: "...",
      }],
      threads: [{ name: "main", frames: [], crashed: true }],
      memory: { used: "1024", free: "512" },
      customKeys: [{ key: "userId", value: "u1" }],
      logs: "log output",
    };
    expect(event.eventId).toBe("e123");
    expect(event.exceptions).toHaveLength(1);
    expect(event.threads[0].crashed).toBe(true);
  });

  test("Frame has expected shape", () => {
    const frame: Frame = {
      line: "10",
      file: "main.kt",
      symbol: "onCreate",
      library: "app",
      owner: "DEVELOPER",
      blamed: true,
    };
    expect(frame.blamed).toBe(true);
    expect(frame.owner).toBe("DEVELOPER");
  });

  test("TopIssuesResponse wraps issues with pagination", () => {
    const resp: TopIssuesResponse = {
      issues: [],
      nextPageToken: "token123",
    };
    expect(resp.issues).toHaveLength(0);
    expect(resp.nextPageToken).toBe("token123");
  });

  test("ListEventsResponse wraps events with pagination", () => {
    const resp: ListEventsResponse = {
      events: [],
    };
    expect(resp.events).toHaveLength(0);
    expect(resp.nextPageToken).toBeUndefined();
  });

  test("Report and ReportGroup have expected shape", () => {
    const metrics: IntervalMetrics = { date: "2025-01-01", count: 5, impactedDevices: 3 };
    const report: Report = { issueId: "i1", errorType: "NON_FATAL", metrics: [metrics] };
    const group: ReportGroup = { groupKey: "g1", reports: [report] };
    expect(group.reports).toHaveLength(1);
    expect(group.reports[0].metrics[0].count).toBe(5);
  });
});
