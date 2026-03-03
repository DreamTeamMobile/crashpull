import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { Issue, TopIssuesResponse } from "../api/types.js";

const mockGetIssue = mock(() => Promise.resolve({} as Issue));
const mockGetTopIssues = mock(() =>
  Promise.resolve({ issues: [] } as TopIssuesResponse),
);
const mockUpdateIssueState = mock(() => Promise.resolve({} as Issue));

mock.module("../api/crashlytics.js", () => ({
  getIssue: mockGetIssue,
  getTopIssues: mockGetTopIssues,
  updateIssueState: mockUpdateIssueState,
}));

const { runResolve } = await import("../commands/resolve.js");

// --- Fixtures ---

function makeIssue(overrides: Partial<Issue> = {}): Issue {
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
    createTime: "2025-01-15T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockGetIssue.mockReset();
  mockGetTopIssues.mockReset();
  mockUpdateIssueState.mockReset();

  mockGetIssue.mockResolvedValue(makeIssue());
  mockGetTopIssues.mockResolvedValue({ issues: [] });
  mockUpdateIssueState.mockResolvedValue(makeIssue({ state: "CLOSED" }));
});

// --- Tests ---

describe("runResolve", () => {
  describe("argument validation", () => {
    test("throws when no issue ID provided", async () => {
      await expect(runResolve({})).rejects.toThrow("Missing issue ID");
    });

    test("throws when issueId is undefined", async () => {
      await expect(runResolve({ issueId: undefined })).rejects.toThrow(
        "Missing issue ID",
      );
    });
  });

  describe("short ID resolution", () => {
    test("resolves 8-char prefix via getTopIssues", async () => {
      mockGetTopIssues.mockResolvedValueOnce({
        issues: [
          makeIssue({ id: "abcdef1234567890" }),
          makeIssue({ id: "xyz12345aaaabbbb" }),
        ],
      });

      await runResolve({ issueId: "abcdef12" });

      expect(mockGetTopIssues).toHaveBeenCalledWith({ pageSize: 100 });
      expect(mockGetIssue).toHaveBeenCalledWith("abcdef1234567890");
    });

    test("throws when no issue matches short prefix", async () => {
      mockGetTopIssues.mockResolvedValueOnce({ issues: [] });

      await expect(runResolve({ issueId: "nomatch1" })).rejects.toThrow(
        'No issue found matching prefix "nomatch1"',
      );
    });

    test("uses full ID directly when longer than 8 chars", async () => {
      await runResolve({ issueId: "abcdef1234567890" });

      expect(mockGetTopIssues).not.toHaveBeenCalled();
      expect(mockGetIssue).toHaveBeenCalledWith("abcdef1234567890");
    });
  });

  describe("API calls", () => {
    test("calls updateIssueState with CLOSED", async () => {
      await runResolve({ issueId: "abcdef1234567890" });

      expect(mockUpdateIssueState).toHaveBeenCalledWith(
        "abcdef1234567890",
        "CLOSED",
      );
    });

    test("fetches issue before updating to check current state", async () => {
      await runResolve({ issueId: "abcdef1234567890" });

      expect(mockGetIssue).toHaveBeenCalledWith("abcdef1234567890");
    });
  });

  describe("text output", () => {
    test("confirms resolution with short ID and title", async () => {
      const out = await runResolve({ issueId: "abcdef1234567890" });

      expect(out).toBe("Resolved issue abcdef12 (NullPointerException)");
    });

    test("uses updated issue title in message", async () => {
      mockUpdateIssueState.mockResolvedValueOnce(
        makeIssue({ state: "CLOSED", title: "OutOfMemoryError" }),
      );

      const out = await runResolve({ issueId: "abcdef1234567890" });

      expect(out).toContain("OutOfMemoryError");
    });
  });

  describe("already closed", () => {
    test("shows already-closed message when issue state is CLOSED", async () => {
      mockGetIssue.mockResolvedValueOnce(makeIssue({ state: "CLOSED" }));

      const out = await runResolve({ issueId: "abcdef1234567890" });

      expect(out).toBe(
        "Issue abcdef12 (NullPointerException) is already closed",
      );
      expect(mockUpdateIssueState).not.toHaveBeenCalled();
    });

    test("does not call updateIssueState when already closed", async () => {
      mockGetIssue.mockResolvedValueOnce(makeIssue({ state: "CLOSED" }));

      await runResolve({ issueId: "abcdef1234567890" });

      expect(mockUpdateIssueState).not.toHaveBeenCalled();
    });
  });

  describe("JSON output", () => {
    test("returns updated issue as JSON", async () => {
      const out = await runResolve({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);

      expect(json.id).toBe("abcdef1234567890");
      expect(json.state).toBe("CLOSED");
    });

    test("returns current issue as JSON when already closed", async () => {
      mockGetIssue.mockResolvedValueOnce(makeIssue({ state: "CLOSED" }));

      const out = await runResolve({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);

      expect(json.state).toBe("CLOSED");
      expect(mockUpdateIssueState).not.toHaveBeenCalled();
    });

    test("includes full issue data", async () => {
      const out = await runResolve({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);

      expect(json.title).toBe("NullPointerException");
      expect(json.errorType).toBe("FATAL");
    });
  });
});
