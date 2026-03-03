import { describe, expect, test, mock, beforeEach } from "bun:test";
import type {
  EnrichedIssue,
  Event,
  ListEventsResponse,
  TopIssuesResponse,
} from "../api/types.js";

const mockGetIssue = mock(() => Promise.resolve({} as EnrichedIssue));
const mockGetTopIssues = mock(() =>
  Promise.resolve({ issues: [] } as TopIssuesResponse),
);
const mockListEvents = mock(() =>
  Promise.resolve({ events: [] } as ListEventsResponse),
);

mock.module("../api/crashlytics.js", () => ({
  getIssue: mockGetIssue,
  getTopIssues: mockGetTopIssues,
  listEvents: mockListEvents,
}));

const { runShow } = await import("../commands/show.js");

// --- Fixtures ---

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
    createTime: "2025-01-15T10:00:00Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    name: "projects/123/events/ev1",
    platform: "android",
    eventId: "ev1",
    eventTime: "2025-01-20T12:00:00Z",
    device: {
      model: "Pixel 7",
      manufacturer: "Google",
      architecture: "arm64-v8a",
    },
    operatingSystem: {
      displayVersion: "14",
      os: "Android",
      type: "ANDROID",
      displayName: "Android 14",
    },
    version: {
      displayVersion: "2.1.0",
      buildVersion: "210",
    },
    blameFrame: {
      line: "42",
      file: "Main.java",
      symbol: "com.app.Main.run",
      library: "com.app",
      owner: "DEVELOPER",
      blamed: true,
    },
    exceptions: [
      {
        type: "java.lang.NullPointerException",
        exceptionMessage: "Attempt to invoke virtual method on null object",
        frames: [
          {
            line: "42",
            file: "Main.java",
            symbol: "com.app.Main.run",
            library: "com.app",
            owner: "DEVELOPER",
            blamed: true,
          },
          {
            line: "100",
            file: "Activity.java",
            symbol: "android.app.Activity.onCreate",
            library: "android.app",
            owner: "PLATFORM",
          },
        ],
        rawStackTrace: "at com.app.Main.run(Main.java:42)",
      },
    ],
    threads: [],
    memory: { used: "100000", free: "50000" },
    customKeys: [],
    logs: "",
    ...overrides,
  };
}

beforeEach(() => {
  mockGetIssue.mockReset();
  mockGetTopIssues.mockReset();
  mockListEvents.mockReset();

  mockGetIssue.mockResolvedValue(makeIssue());
  mockGetTopIssues.mockResolvedValue({ issues: [] });
  mockListEvents.mockResolvedValue({ events: [makeEvent()] });
});

// --- Tests ---

describe("runShow", () => {
  describe("argument validation", () => {
    test("throws when no issue ID provided", async () => {
      await expect(runShow({})).rejects.toThrow("Missing issue ID");
    });

    test("throws when issueId is undefined", async () => {
      await expect(runShow({ issueId: undefined })).rejects.toThrow(
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
      mockGetIssue.mockResolvedValueOnce(
        makeIssue({ id: "abcdef1234567890" }),
      );

      await runShow({ issueId: "abcdef12" });

      expect(mockGetTopIssues).toHaveBeenCalledWith({ pageSize: 100 });
      expect(mockGetIssue).toHaveBeenCalledWith("abcdef1234567890");
    });

    test("throws when no issue matches short prefix", async () => {
      mockGetTopIssues.mockResolvedValueOnce({ issues: [] });

      await expect(runShow({ issueId: "nomatch1" })).rejects.toThrow(
        'No issue found matching prefix "nomatch1"',
      );
    });

    test("uses full ID directly when longer than 8 chars", async () => {
      await runShow({ issueId: "abcdef1234567890" });

      expect(mockGetTopIssues).not.toHaveBeenCalled();
      expect(mockGetIssue).toHaveBeenCalledWith("abcdef1234567890");
    });
  });

  describe("API calls", () => {
    test("fetches issue and events in parallel", async () => {
      await runShow({ issueId: "abcdef1234567890" });

      expect(mockGetIssue).toHaveBeenCalledWith("abcdef1234567890");
      expect(mockListEvents).toHaveBeenCalledWith("abcdef1234567890", 1);
    });
  });

  describe("text output", () => {
    test("renders condensed header with title and subtitle", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("NullPointerException — com.app.Main.run");
    });

    test("renders type, state, version range on one line", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("FATAL | OPEN | 1.0.0→1.2.0");
    });

    test("renders blame frame", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("Blame: com.app.Main.run (Main.java:42)");
    });

    test("renders stack trace with exception header", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain(
        "java.lang.NullPointerException: Attempt to invoke virtual method on null object",
      );
    });

    test("marks blamed frame with > prefix", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("> com.app.Main.run (Main.java:42)");
    });

    test("non-blamed frame has space prefix", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("  android.app.Activity.onCreate (Activity.java:100)");
    });

    test("renders multiple exceptions with separator", async () => {
      mockListEvents.mockResolvedValueOnce({
        events: [
          makeEvent({
            exceptions: [
              {
                type: "java.lang.RuntimeException",
                exceptionMessage: "Outer",
                frames: [],
                rawStackTrace: "",
              },
              {
                type: "java.lang.NullPointerException",
                exceptionMessage: "Inner cause",
                frames: [],
                rawStackTrace: "",
              },
            ],
          }),
        ],
      });
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("java.lang.RuntimeException: Outer");
      expect(out).toContain("--- java.lang.NullPointerException: Inner cause ---");
    });

    test("omits stack trace when no exceptions", async () => {
      mockListEvents.mockResolvedValueOnce({
        events: [makeEvent({ exceptions: [] })],
      });
      const out = await runShow({ issueId: "abcdef1234567890" });
      const lines = out.split("\n");
      // Only header lines, no callstack
      expect(lines.length).toBeLessThanOrEqual(3);
    });

    test("omits blame when no blameFrame", async () => {
      mockListEvents.mockResolvedValueOnce({
        events: [
          makeEvent({
            blameFrame: undefined as unknown as Event["blameFrame"],
          }),
        ],
      });
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).not.toContain("Blame:");
    });

    test("no LATEST CRASH section (removed noise)", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).not.toContain("LATEST CRASH");
      expect(out).not.toContain("Device:");
    });
  });

  describe("JSON output", () => {
    test("returns flat compact structure", async () => {
      const out = await runShow({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);
      expect(json.id).toBe("abcdef1234567890");
      expect(json.title).toBe("NullPointerException");
      expect(json.subtitle).toBe("com.app.Main.run");
      expect(json.type).toBe("FATAL");
      expect(json.state).toBe("OPEN");
      expect(json.uri).toBe("https://console.firebase.google.com/issue/abc");
    });

    test("returns blameFrame as string", async () => {
      const out = await runShow({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);
      expect(json.blameFrame).toBe("com.app.Main.run (Main.java:42)");
    });

    test("returns callstack as string array", async () => {
      const out = await runShow({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);
      expect(Array.isArray(json.callstack)).toBe(true);
      expect(json.callstack[0]).toBe(
        "java.lang.NullPointerException: Attempt to invoke virtual method on null object",
      );
      expect(json.callstack[1]).toBe("> com.app.Main.run (Main.java:42)");
      expect(json.callstack[2]).toBe("  android.app.Activity.onCreate (Activity.java:100)");
    });

    test("returns null blameFrame and empty callstack when no events", async () => {
      mockListEvents.mockResolvedValueOnce({ events: [] });
      const out = await runShow({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);
      expect(json.blameFrame).toBeNull();
      expect(json.callstack).toEqual([]);
    });

    test("does not include raw issue/event objects", async () => {
      const out = await runShow({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);
      expect(json.issue).toBeUndefined();
      expect(json.latestEvent).toBeUndefined();
      expect(json.device).toBeUndefined();
      expect(json.threads).toBeUndefined();
    });
  });
});
