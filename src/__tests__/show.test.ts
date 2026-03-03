import { describe, expect, test, mock, beforeEach } from "bun:test";
import type {
  Event,
  Issue,
  ListEventsResponse,
  TopIssuesResponse,
} from "../api/types.js";

const mockGetIssue = mock(() => Promise.resolve({} as Issue));
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
      name: "Android",
      type: "ANDROID",
    },
    version: {
      displayVersion: "2.1.0",
      buildVersion: "210",
    },
    blameFrame: {
      line: 42,
      file: "Main.java",
      symbol: "com.app.Main.run",
      library: "com.app",
      owner: "DEVELOPER",
      blamed: true,
    },
    exceptions: [
      {
        type: "java.lang.NullPointerException",
        reason: "Attempt to invoke virtual method on null object",
        frames: [
          {
            line: 42,
            file: "Main.java",
            symbol: "com.app.Main.run",
            library: "com.app",
            owner: "DEVELOPER",
            blamed: true,
          },
          {
            line: 100,
            file: "Activity.java",
            symbol: "android.app.Activity.onCreate",
            library: "android.app",
            owner: "PLATFORM",
            blamed: false,
          },
        ],
        rawStackTrace: "at com.app.Main.run(Main.java:42)",
      },
    ],
    threads: [],
    memory: { used: 100_000, free: 50_000 },
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

  describe("text output — ISSUE header", () => {
    test("renders issue title and subtitle", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("ISSUE");
      expect(out).toContain("NullPointerException");
      expect(out).toContain("com.app.Main.run");
    });

    test("renders type, state, events, users", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("Type:     FATAL");
      expect(out).toContain("State:    OPEN");
      expect(out).toContain("Events:   42");
      expect(out).toContain("Users:    15");
    });

    test("renders version range", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("1.0.0 → 1.2.0");
    });

    test("renders console URL", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain(
        "Console:  https://console.firebase.google.com/issue/abc",
      );
    });

    test("renders age from createTime", async () => {
      mockGetIssue.mockResolvedValueOnce(
        makeIssue({ createTime: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString() }),
      );
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("Age:      3d ago");
    });

    test("renders — when createTime is missing", async () => {
      mockGetIssue.mockResolvedValueOnce(
        makeIssue({ createTime: undefined }),
      );
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("Age:      —");
    });

    test("renders 0 for missing counts", async () => {
      mockGetIssue.mockResolvedValueOnce(
        makeIssue({ eventCount: undefined, impactedDevicesCount: undefined }),
      );
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("Events:   0");
      expect(out).toContain("Users:    0");
    });
  });

  describe("text output — LATEST CRASH", () => {
    test("renders device info", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("LATEST CRASH");
      expect(out).toContain("Google Pixel 7 (arm64-v8a)");
    });

    test("renders OS info", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("OS:      Android 14");
    });

    test("renders app version", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("Version: 2.1.0 (210)");
    });

    test("omits crash section when no events", async () => {
      mockListEvents.mockResolvedValueOnce({ events: [] });
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).not.toContain("LATEST CRASH");
    });
  });

  describe("text output — STACK TRACE", () => {
    test("renders exception type and reason", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("STACK TRACE");
      expect(out).toContain(
        "java.lang.NullPointerException: Attempt to invoke virtual method on null object",
      );
    });

    test("renders frames with file and line", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("com.app com.app.Main.run (Main.java:42)");
    });

    test("marks blamed frame with > marker", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      // Blamed frame should have > marker
      expect(out).toMatch(/>.*com\.app\.Main\.run/);
    });

    test("non-blamed frame has space marker", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      // Non-blamed frame should have space
      const lines = out.split("\n");
      const platformFrame = lines.find((l) =>
        l.includes("android.app.Activity.onCreate"),
      );
      expect(platformFrame).toBeDefined();
      expect(platformFrame!.trimStart().startsWith(">")).toBe(false);
    });

    test("renders multiple exceptions", async () => {
      mockListEvents.mockResolvedValueOnce({
        events: [
          makeEvent({
            exceptions: [
              {
                type: "java.lang.RuntimeException",
                reason: "Outer",
                frames: [],
                rawStackTrace: "",
              },
              {
                type: "java.lang.NullPointerException",
                reason: "Inner cause",
                frames: [],
                rawStackTrace: "",
              },
            ],
          }),
        ],
      });
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("java.lang.RuntimeException: Outer");
      expect(out).toContain("java.lang.NullPointerException: Inner cause");
    });

    test("omits stack trace section when no exceptions", async () => {
      mockListEvents.mockResolvedValueOnce({
        events: [makeEvent({ exceptions: [] })],
      });
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).not.toContain("STACK TRACE");
    });
  });

  describe("text output — BLAME FRAME", () => {
    test("renders blame frame summary", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("BLAME FRAME: com.app.Main.run Main.java:42");
    });

    test("omits blame frame when not present", async () => {
      mockListEvents.mockResolvedValueOnce({
        events: [
          makeEvent({
            blameFrame: undefined as unknown as Event["blameFrame"],
          }),
        ],
      });
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).not.toContain("BLAME FRAME");
    });
  });

  describe("JSON output", () => {
    test("returns combined issue and latestEvent", async () => {
      const out = await runShow({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);
      expect(json.issue).toBeDefined();
      expect(json.issue.id).toBe("abcdef1234567890");
      expect(json.latestEvent).toBeDefined();
      expect(json.latestEvent.eventId).toBe("ev1");
    });

    test("returns null latestEvent when no events", async () => {
      mockListEvents.mockResolvedValueOnce({ events: [] });
      const out = await runShow({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);
      expect(json.issue).toBeDefined();
      expect(json.latestEvent).toBeNull();
    });

    test("includes full issue data", async () => {
      const out = await runShow({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);
      expect(json.issue.errorType).toBe("FATAL");
      expect(json.issue.title).toBe("NullPointerException");
      expect(json.issue.state).toBe("OPEN");
    });

    test("includes full event data", async () => {
      const out = await runShow({
        issueId: "abcdef1234567890",
        format: "json",
      });
      const json = JSON.parse(out);
      expect(json.latestEvent.device.model).toBe("Pixel 7");
      expect(json.latestEvent.exceptions).toHaveLength(1);
    });
  });

  describe("sections structure", () => {
    test("sections separated by double newlines", async () => {
      const out = await runShow({ issueId: "abcdef1234567890" });
      expect(out).toContain("ISSUE");
      expect(out).toContain("LATEST CRASH");
      expect(out).toContain("STACK TRACE");
      expect(out).toContain("BLAME FRAME");
      // Sections separated by \n\n
      const sections = out.split("\n\n");
      expect(sections.length).toBeGreaterThanOrEqual(4);
    });
  });
});
