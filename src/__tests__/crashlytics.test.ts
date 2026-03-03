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

  test("passes pageSize param", async () => {
    await getTopIssues({ pageSize: 25 });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params.pageSize).toBe("25");
  });

  test("passes errorTypes as separate query param", async () => {
    await getTopIssues({ errorTypes: ["FATAL", "ANR"] });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params["filter.errorTypes"]).toBe("FATAL,ANR");
  });

  test("passes signals as separate query param", async () => {
    await getTopIssues({ signals: ["SIGABRT", "SIGSEGV"] });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params["filter.signals"]).toBe("SIGABRT,SIGSEGV");
  });

  test("maps since=7d to query param", async () => {
    await getTopIssues({ since: "7d" });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params["filter.eventTimestamp>="]).toBe("168");
  });

  test("maps since=30d to query param", async () => {
    await getTopIssues({ since: "30d" });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params["filter.eventTimestamp>="]).toBe("720");
  });

  test("maps since=90d to query param", async () => {
    await getTopIssues({ since: "90d" });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params["filter.eventTimestamp>="]).toBe("2160");
  });

  test("combines multiple filters as separate query params", async () => {
    await getTopIssues({ errorTypes: ["FATAL"], since: "7d" });
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params["filter.errorTypes"]).toBe("FATAL");
    expect(params["filter.eventTimestamp>="]).toBe("168");
    expect(params.filter).toBeUndefined();
  });

  test("returns API response", async () => {
    const data = { issues: [{ id: "abc" }], nextPageToken: "tok" };
    mockApiGet.mockResolvedValueOnce(data);
    const result = await getTopIssues();
    expect(result).toEqual(data);
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

  test("passes pageSize when provided", async () => {
    await listEvents("abc123", 10);
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params.pageSize).toBe("10");
  });

  test("omits pageSize when not provided", async () => {
    await listEvents("abc123");
    const [, params] = mockApiGet.mock.calls[0] as [string, Record<string, string>];
    expect(params.pageSize).toBeUndefined();
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
