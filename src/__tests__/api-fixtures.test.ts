import { describe, expect, test } from "bun:test";
import type {
  EnrichedIssue,
  Event,
  Issue,
  TopIssuesRawResponse,
} from "../api/types.js";

import topIssuesRaw from "./fixtures/topIssues.raw.json";
import issueRaw from "./fixtures/issue.raw.json";
import eventRaw from "./fixtures/event.raw.json";

// --- Helpers ---

/** Assert obj has all expected keys (runtime check complementing compile-time types) */
function assertKeys(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    expect(obj).toHaveProperty(key);
  }
}

// --- topIssues fixture ---

describe("topIssues fixture", () => {
  const raw = topIssuesRaw as TopIssuesRawResponse;

  test("has groups array", () => {
    expect(raw.groups).toBeArray();
    expect(raw.groups!.length).toBe(2);
  });

  test("each group has issue and metrics", () => {
    for (const group of raw.groups!) {
      expect(group.issue).toBeDefined();
      expect(group.metrics).toBeArray();
    }
  });

  test("issue has required fields (no eventCount/impactedDevicesCount/createTime)", () => {
    const issue = raw.groups![0].issue;
    assertKeys(issue as unknown as Record<string, unknown>, [
      "id", "title", "subtitle", "errorType", "state",
      "sampleEvent", "uri", "firstSeenVersion", "lastSeenVersion",
      "signals", "name", "variants",
    ]);
    // These should NOT exist on raw issue
    expect((issue as Record<string, unknown>).eventCount).toBeUndefined();
    expect((issue as Record<string, unknown>).impactedDevicesCount).toBeUndefined();
    expect((issue as Record<string, unknown>).createTime).toBeUndefined();
  });

  test("signals have description, not code", () => {
    const signal = raw.groups![0].issue.signals[0];
    expect(signal.signal).toBe("SIGNAL_FRESH");
    expect(signal.description).toBeDefined();
    expect((signal as Record<string, unknown>).code).toBeUndefined();
  });

  test("variants have id and uri, not title/subtitle", () => {
    const variant = raw.groups![0].issue.variants[0];
    expect(variant.id).toBeDefined();
    expect(variant.uri).toBeDefined();
    expect((variant as Record<string, unknown>).title).toBeUndefined();
    expect((variant as Record<string, unknown>).subtitle).toBeUndefined();
  });

  test("metrics have string counts", () => {
    const m = raw.groups![0].metrics[0];
    expect(typeof m.eventsCount).toBe("string");
    expect(typeof m.impactedUsersCount).toBe("string");
  });

  test("topIssues transformation produces EnrichedIssue with counts", () => {
    const enriched: EnrichedIssue[] = (raw.groups ?? []).map((g) => {
      const m = g.metrics?.[0];
      return {
        ...g.issue,
        eventCount: m ? Number(m.eventsCount) : undefined,
        impactedDevicesCount: m ? Number(m.impactedUsersCount) : undefined,
      };
    });

    expect(enriched).toHaveLength(2);
    expect(enriched[0].eventCount).toBe(142);
    expect(enriched[0].impactedDevicesCount).toBe(37);
    expect(enriched[0].title).toBe("NullPointerException");
    expect(enriched[1].eventCount).toBe(58);
  });
});

// --- issue fixture ---

describe("issue fixture", () => {
  const issue = issueRaw as unknown as Issue;

  test("has all required Issue fields", () => {
    assertKeys(issueRaw as Record<string, unknown>, [
      "id", "title", "subtitle", "errorType", "state",
      "sampleEvent", "uri", "firstSeenVersion", "lastSeenVersion",
      "signals", "name", "variants",
    ]);
  });

  test("does not have enrichment fields", () => {
    expect((issueRaw as Record<string, unknown>).eventCount).toBeUndefined();
    expect((issueRaw as Record<string, unknown>).impactedDevicesCount).toBeUndefined();
    expect((issueRaw as Record<string, unknown>).createTime).toBeUndefined();
  });

  test("can access title and subtitle", () => {
    expect(issue.title).toBe("NullPointerException");
    expect(issue.subtitle).toBe("com.example.app.MainActivity.onCreate");
  });
});

// --- event fixture ---

describe("event fixture", () => {
  const event = eventRaw as unknown as Event;

  test("has core event fields", () => {
    assertKeys(eventRaw as Record<string, unknown>, [
      "name", "platform", "eventId", "eventTime",
      "device", "operatingSystem", "version", "blameFrame",
      "exceptions", "threads", "memory", "customKeys", "logs",
    ]);
  });

  test("has extra event fields from real API", () => {
    assertKeys(eventRaw as Record<string, unknown>, [
      "bundleOrPackage", "receivedTime", "issue",
      "installationUuid", "crashlyticsSdkVersion",
      "appOrientation", "deviceOrientation", "storage",
      "processState", "issueVariant",
    ]);
  });

  test("exception uses exceptionMessage not reason", () => {
    const ex = event.exceptions[0];
    expect(ex.exceptionMessage).toContain("null object reference");
    expect((ex as Record<string, unknown>).reason).toBeUndefined();
  });

  test("exception has title, subtitle, blamed", () => {
    const ex = event.exceptions[0];
    expect(ex.title).toBe("NullPointerException");
    expect(ex.subtitle).toBeDefined();
    expect(ex.blamed).toBe(true);
  });

  test("frame.line is string", () => {
    const frame = event.exceptions[0].frames[0];
    expect(typeof frame.line).toBe("string");
    expect(frame.line).toBe("42");
  });

  test("frame.offset exists on blamed frames", () => {
    const frame = event.blameFrame;
    expect(frame.offset).toBe("0x1a");
  });

  test("frame.blamed is optional (missing on non-blamed frames)", () => {
    const platformFrame = event.exceptions[0].frames[1];
    expect(platformFrame.blamed).toBeUndefined();
  });

  test("device has extra fields", () => {
    expect(event.device.displayName).toBe("Pixel 7");
    expect(event.device.formFactor).toBe("PHONE");
  });

  test("OS uses os field not name", () => {
    expect(event.operatingSystem.os).toBe("Android");
    expect((event.operatingSystem as Record<string, unknown>).name).toBeUndefined();
    expect(event.operatingSystem.displayName).toBe("Android 14");
  });

  test("memory values are strings", () => {
    expect(typeof event.memory.used).toBe("string");
    expect(typeof event.memory.free).toBe("string");
  });

  test("thread has title field", () => {
    expect(event.threads[0].title).toBe("main thread");
  });

  test("show.ts field access patterns work against fixture", () => {
    // Device line
    const deviceLine = `${event.device.manufacturer} ${event.device.model} (${event.device.architecture})`;
    expect(deviceLine).toBe("Google Pixel 7 (arm64-v8a)");

    // OS line (using displayName)
    const osLine = event.operatingSystem.displayName ?? `${event.operatingSystem.os} ${event.operatingSystem.displayVersion}`;
    expect(osLine).toBe("Android 14");

    // Exception line
    const ex = event.exceptions[0];
    const exLine = `${ex.type}: ${ex.exceptionMessage}`;
    expect(exLine).toContain("NullPointerException");
    expect(exLine).toContain("null object reference");

    // Frame line (line is string, used in string context)
    const frame = event.exceptions[0].frames[0];
    const frameLoc = `(${frame.file}:${frame.line})`;
    expect(frameLoc).toBe("(MainActivity.java:42)");
  });
});
