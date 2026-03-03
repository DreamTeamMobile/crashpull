import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { EnrichedIssue, TopIssuesResponse } from "../api/types.js";

const mockGetTopIssues = mock(() =>
  Promise.resolve({ issues: [] } as TopIssuesResponse),
);

mock.module("../api/crashlytics.js", () => ({
  getTopIssues: mockGetTopIssues,
}));

const { runList } = await import("../commands/list.js");

beforeEach(() => {
  mockGetTopIssues.mockReset();
  mockGetTopIssues.mockResolvedValue({ issues: [] });
});

// --- Fixtures ---

const TEN_DAYS_AGO = new Date(Date.now() - 10 * 24 * 60 * 60_000).toISOString();

function makeIssue(overrides: Partial<EnrichedIssue> = {}): EnrichedIssue {
  return {
    id: "abcdef1234567890",
    title: "NullPointerException",
    subtitle: "com.app.Main.run",
    errorType: "FATAL",
    state: "OPEN",
    sampleEvent: "ev1",
    uri: "https://console.firebase.google.com/issue/abc",
    firstSeenVersion: "1.0.0",
    lastSeenVersion: "1.2.0",
    signals: [],
    name: "projects/123/issues/abc",
    variants: [],
    eventCount: 42,
    impactedDevicesCount: 15,
    createTime: TEN_DAYS_AGO,
    ...overrides,
  };
}

// --- Tests ---

describe("runList", () => {
  describe("API call parameters", () => {
    test("defaults to since=30d, pageSize=10", async () => {
      await runList({});
      const [opts] = mockGetTopIssues.mock.calls[0] as [Record<string, unknown>];
      expect(opts.since).toBe("30d");
      expect(opts.pageSize).toBe(10);
    });

    test("passes --type as errorTypes", async () => {
      await runList({ type: "fatal" });
      const [opts] = mockGetTopIssues.mock.calls[0] as [Record<string, unknown>];
      expect(opts.errorTypes).toEqual(["FATAL"]);
    });

    test("passes --type non-fatal", async () => {
      await runList({ type: "non-fatal" });
      const [opts] = mockGetTopIssues.mock.calls[0] as [Record<string, unknown>];
      expect(opts.errorTypes).toEqual(["NON_FATAL"]);
    });

    test("passes --type anr", async () => {
      await runList({ type: "anr" });
      const [opts] = mockGetTopIssues.mock.calls[0] as [Record<string, unknown>];
      expect(opts.errorTypes).toEqual(["ANR"]);
    });

    test("passes --signal as signals array", async () => {
      await runList({ signal: "fresh" });
      const [opts] = mockGetTopIssues.mock.calls[0] as [Record<string, unknown>];
      expect(opts.signals).toEqual(["SIGNAL_FRESH"]);
    });

    test("passes --since override", async () => {
      await runList({ since: "7d" });
      const [opts] = mockGetTopIssues.mock.calls[0] as [Record<string, unknown>];
      expect(opts.since).toBe("7d");
    });

    test("passes --limit as pageSize", async () => {
      await runList({ limit: 25 });
      const [opts] = mockGetTopIssues.mock.calls[0] as [Record<string, unknown>];
      expect(opts.pageSize).toBe(25);
    });

    test("unknown type passes undefined errorTypes", async () => {
      await runList({ type: "unknown" });
      const [opts] = mockGetTopIssues.mock.calls[0] as [Record<string, unknown>];
      expect(opts.errorTypes).toBeUndefined();
    });
  });

  describe("text output", () => {
    test("renders table with correct headers", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue()],
      });
      const out = await runList({});
      expect(out).toContain("ID");
      expect(out).toContain("TYPE");
      expect(out).toContain("EVENTS");
      expect(out).toContain("USERS");
      expect(out).toContain("AGE");
      expect(out).toContain("STATE");
      expect(out).toContain("TITLE");
    });

    test("renders issue ID first 8 chars", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue({ id: "abcdef1234567890" })],
      });
      const out = await runList({});
      expect(out).toContain("abcdef12");
      expect(out).not.toContain("abcdef1234567890");
    });

    test("renders error type", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue({ errorType: "ANR" })],
      });
      const out = await runList({});
      expect(out).toContain("ANR");
    });

    test("renders event and user counts", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue({ eventCount: 123, impactedDevicesCount: 45 })],
      });
      const out = await runList({});
      expect(out).toContain("123");
      expect(out).toContain("45");
    });

    test("renders state", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue({ state: "CLOSED" })],
      });
      const out = await runList({});
      expect(out).toContain("CLOSED");
    });

    test("renders title", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue({ title: "ConcurrentModificationException" })],
      });
      const out = await runList({});
      expect(out).toContain("ConcurrentModificationException");
    });

    test("renders table divider", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue()],
      });
      const out = await runList({});
      expect(out).toContain("──");
    });

    test("renders summary line", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue(), makeIssue({ id: "xyz" })],
      });
      const out = await runList({});
      expect(out).toContain("2 issues");
      expect(out).toContain("fresh)");
      expect(out).toContain("last 30d");
    });

    test("summary uses correct window from --since", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue()],
      });
      const out = await runList({ since: "7d" });
      expect(out).toContain("last 7d");
    });

    test("renders 0 for missing event/user counts", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue({ eventCount: undefined, impactedDevicesCount: undefined })],
      });
      const out = await runList({});
      // Should show 0 not undefined
      expect(out).not.toContain("undefined");
    });

    test("renders — for missing createTime", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue({ createTime: undefined })],
      });
      const out = await runList({});
      expect(out).toContain("—");
    });

    test("multiple rows render correctly", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [
          makeIssue({ id: "issue111111111111", title: "NPE" }),
          makeIssue({ id: "issue222222222222", title: "OOM", errorType: "NON_FATAL" }),
          makeIssue({ id: "issue333333333333", title: "ANR Timeout", errorType: "ANR" }),
        ],
      });
      const out = await runList({});
      const lines = out.split("\n");
      // header + divider + 3 rows + empty line + summary = 7
      expect(lines.length).toBe(7);
      expect(out).toContain("3 issues");
    });
  });

  describe("fresh count", () => {
    test("counts issues created within 7 days as fresh", async () => {
      const recent = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
      const old = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [
          makeIssue({ id: "fresh1", createTime: recent }),
          makeIssue({ id: "old1", createTime: old }),
          makeIssue({ id: "old2", createTime: old }),
        ],
      });
      const out = await runList({});
      expect(out).toContain("1 fresh)");
    });

    test("issues without createTime are not fresh", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue({ createTime: undefined })],
      });
      const out = await runList({});
      expect(out).toContain("0 fresh)");
    });
  });

  describe("empty results", () => {
    test("text output shows friendly message", async () => {
      const out = await runList({});
      expect(out).toBe("No issues found.");
    });

    test("handles missing issues array", async () => {
      mockGetTopIssues.mockResolvedValueOnce({} as TopIssuesResponse);
      const out = await runList({});
      expect(out).toBe("No issues found.");
    });

    test("json output returns empty structure", async () => {
      const out = await runList({ format: "json" });
      const json = JSON.parse(out);
      expect(json.issues).toEqual([]);
      expect(json.summary.total).toBe(0);
      expect(json.summary.fresh).toBe(0);
      expect(json.summary.window).toBe("30d");
    });
  });

  describe("JSON output", () => {
    test("returns issues array and summary", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue(), makeIssue({ id: "second" })],
      });
      const out = await runList({ format: "json" });
      const json = JSON.parse(out);
      expect(json.issues).toBeArray();
      expect(json.issues).toHaveLength(2);
      expect(json.summary).toBeDefined();
      expect(json.summary.total).toBe(2);
    });

    test("summary includes window from since arg", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [makeIssue()],
      });
      const out = await runList({ format: "json", since: "90d" });
      const json = JSON.parse(out);
      expect(json.summary.window).toBe("90d");
    });

    test("issues contain full issue data", async () => {
      const issue = makeIssue({ id: "full-data-test" });
      mockGetTopIssues.mockResolvedValueOnce({ issues: [issue] });
      const out = await runList({ format: "json" });
      const json = JSON.parse(out);
      expect(json.issues[0].id).toBe("full-data-test");
      expect(json.issues[0].errorType).toBe("FATAL");
      expect(json.issues[0].title).toBe("NullPointerException");
    });

    test("summary has correct fresh count", async () => {
      const recent = new Date(Date.now() - 1 * 24 * 60 * 60_000).toISOString();
      const old = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [
          makeIssue({ id: "f1", createTime: recent }),
          makeIssue({ id: "f2", createTime: recent }),
          makeIssue({ id: "o1", createTime: old }),
        ],
      });
      const out = await runList({ format: "json" });
      const json = JSON.parse(out);
      expect(json.summary.fresh).toBe(2);
    });
  });
});
