import { describe, expect, test, mock, beforeEach } from "bun:test";

const mockApiGet = mock(() => Promise.resolve({}));
const mockApiPatch = mock(() => Promise.resolve({}));

mock.module("../api/client.js", () => ({
  apiGet: mockApiGet,
  apiPatch: mockApiPatch,
}));

const { getTopIssues, getIssue, listEvents, updateIssueState } = await import(
  "../api/crashlytics.js"
);

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPatch.mockReset();
  mockApiGet.mockResolvedValue({});
  mockApiPatch.mockResolvedValue({});
});

describe("getTopIssues", () => {
  test("calls reports/topIssues with no params by default", async () => {
    await getTopIssues();
    expect(mockApiGet).toHaveBeenCalledWith("reports/topIssues", {});
  });

  test("passes page_size param", async () => {
    await getTopIssues({ pageSize: 25 });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params.page_size).toBe("25");
  });

  test("passes errorTypes as filter.issue.error_types", async () => {
    await getTopIssues({ errorTypes: ["FATAL", "ANR"] });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params["filter.issue.error_types"]).toBe("FATAL,ANR");
  });

  test("passes signals as filter.issue.signals", async () => {
    await getTopIssues({ signals: ["SIGNAL_FRESH", "SIGNAL_REGRESSED"] });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params["filter.issue.signals"]).toBe("SIGNAL_FRESH,SIGNAL_REGRESSED");
  });

  test("maps since=7d to ISO interval params", async () => {
    const before = Date.now();
    await getTopIssues({ since: "7d" });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    const start = new Date(params["filter.interval.start_time"]).getTime();
    const end = new Date(params["filter.interval.end_time"]).getTime();
    // start should be ~7 days ago (within 1 second tolerance)
    expect(before - start).toBeGreaterThan(7 * 24 * 60 * 60_000 - 1000);
    expect(before - start).toBeLessThan(7 * 24 * 60 * 60_000 + 1000);
    // end should be ~now
    expect(end).toBeGreaterThanOrEqual(before);
  });

  test("maps since=30d to interval params", async () => {
    const before = Date.now();
    await getTopIssues({ since: "30d" });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    const start = new Date(params["filter.interval.start_time"]).getTime();
    expect(before - start).toBeGreaterThan(30 * 24 * 60 * 60_000 - 1000);
    expect(before - start).toBeLessThan(30 * 24 * 60 * 60_000 + 1000);
  });

  test("maps since=90d to interval params", async () => {
    const before = Date.now();
    await getTopIssues({ since: "90d" });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    const start = new Date(params["filter.interval.start_time"]).getTime();
    expect(before - start).toBeGreaterThan(90 * 24 * 60 * 60_000 - 1000);
    expect(before - start).toBeLessThan(90 * 24 * 60 * 60_000 + 1000);
  });

  test("combines multiple filters as separate query params", async () => {
    await getTopIssues({ errorTypes: ["FATAL"], since: "7d" });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params["filter.issue.error_types"]).toBe("FATAL");
    expect(params["filter.interval.start_time"]).toBeDefined();
    expect(params["filter.interval.end_time"]).toBeDefined();
  });

  test("transforms raw groups response into issues array", async () => {
    const raw = {
      groups: [
        {
          issue: { id: "abc", title: "NPE" },
          metrics: [{ eventsCount: "42", impactedUsersCount: "5" }],
        },
      ],
      nextPageToken: "tok",
    };
    mockApiGet.mockResolvedValueOnce(raw);
    const result = await getTopIssues();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].id).toBe("abc");
    expect(result.issues[0].eventCount).toBe(42);
    expect(result.issues[0].impactedDevicesCount).toBe(5);
    expect(result.nextPageToken).toBe("tok");
  });

  test("handles empty groups", async () => {
    mockApiGet.mockResolvedValueOnce({});
    const result = await getTopIssues();
    expect(result.issues).toEqual([]);
  });
});

describe("getIssue", () => {
  test("calls issues/{id}", async () => {
    await getIssue("abc123");
    expect(mockApiGet).toHaveBeenCalledWith("issues/abc123");
  });

  test("returns issue data", async () => {
    const issue = { id: "abc123", title: "NullPointerException" };
    mockApiGet.mockResolvedValueOnce(issue);
    const result = await getIssue("abc123");
    expect(result).toEqual(issue);
  });
});

describe("listEvents", () => {
  test("calls events with issue id filter", async () => {
    await listEvents("abc123");
    const [path, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(path).toBe("events");
    expect(params["filter.issue.id"]).toBe("abc123");
  });

  test("passes page_size when provided", async () => {
    await listEvents("abc123", 10);
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params.page_size).toBe("10");
  });

  test("omits page_size when not provided", async () => {
    await listEvents("abc123");
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params.page_size).toBeUndefined();
  });

  test("returns events data", async () => {
    const data = { events: [{ eventId: "e1" }] };
    mockApiGet.mockResolvedValueOnce(data);
    const result = await listEvents("abc123");
    expect(result).toEqual(data);
  });
});

describe("updateIssueState", () => {
  test("patches issues/{id} with state body and updateMask", async () => {
    await updateIssueState("abc123", "CLOSED");
    expect(mockApiPatch).toHaveBeenCalledWith(
      "issues/abc123",
      { state: "CLOSED" },
      { updateMask: "state" },
    );
  });

  test("works with OPEN state", async () => {
    await updateIssueState("abc123", "OPEN");
    expect(mockApiPatch).toHaveBeenCalledWith(
      "issues/abc123",
      { state: "OPEN" },
      { updateMask: "state" },
    );
  });

  test("returns updated issue", async () => {
    const issue = { id: "abc123", state: "CLOSED" };
    mockApiPatch.mockResolvedValueOnce(issue);
    const result = await updateIssueState("abc123", "CLOSED");
    expect(result).toEqual(issue);
  });
});
