import { describe, expect, test, mock, beforeEach } from "bun:test";

// Mock config
const mockRequireConfig = mock(() =>
  Promise.resolve({ projectNumber: "123456", appId: "1:123456:ios:abcdef" }),
);
mock.module("../config.js", () => ({
  requireConfig: mockRequireConfig,
}));

// Mock auth
const mockGetAccessToken = mock(() => Promise.resolve("test-token"));
mock.module("../api/auth.js", () => ({
  getAccessToken: mockGetAccessToken,
}));

// Mock fetch
const mockFetch = mock(() => Promise.resolve(new Response()));
globalThis.fetch = mockFetch as unknown as typeof fetch;

const { apiGet, apiPatch, ApiError } = await import("../api/client.js");

beforeEach(() => {
  mockRequireConfig.mockReset();
  mockGetAccessToken.mockReset();
  mockFetch.mockReset();

  mockRequireConfig.mockResolvedValue({
    projectNumber: "123456",
    appId: "1:123456:ios:abcdef",
  });
  mockGetAccessToken.mockResolvedValue("test-token");
});

describe("apiGet", () => {
  test("builds correct URL with path prefix", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await apiGet("issues");

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://firebasecrashlytics.googleapis.com/v1alpha/projects/123456/apps/1:123456:ios:abcdef/issues",
    );
  });

  test("encodes query params", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );

    await apiGet("issues", { pageSize: "10", pageToken: "abc" });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("pageSize=10");
    expect(url).toContain("pageToken=abc");
  });

  test("injects Authorization header", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await apiGet("issues");

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token",
    );
  });

  test("uses GET method", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await apiGet("issues");

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(opts.method).toBe("GET");
  });

  test("returns parsed JSON", async () => {
    const data = { issues: [{ id: "1" }] };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(data), { status: 200 }),
    );

    const result = await apiGet("issues");
    expect(result).toEqual(data);
  });
});

describe("apiPatch", () => {
  test("uses PATCH method with JSON body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ updated: true }), { status: 200 }),
    );

    await apiPatch("issues/123", { state: "CLOSED" });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(opts.method).toBe("PATCH");
    expect((opts.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(opts.body).toBe(JSON.stringify({ state: "CLOSED" }));
  });

  test("includes query params when provided", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await apiPatch("issues/123", { state: "CLOSED" }, { updateMask: "state" });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("updateMask=state");
  });
});

describe("error handling", () => {
  test("throws ApiError with status and parsed message on 401", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401, statusText: "Unauthorized" },
      ),
    );

    try {
      await apiGet("issues");
      expect(true).toBe(false); // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(401);
      expect((e as ApiError).message).toBe("401: Unauthorized");
    }
  });

  test("throws ApiError on 403", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: "Forbidden" } }),
        { status: 403, statusText: "Forbidden" },
      ),
    );

    expect(apiGet("issues")).rejects.toThrow("403: Forbidden");
  });

  test("throws ApiError on 404", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: "Not Found" } }),
        { status: 404, statusText: "Not Found" },
      ),
    );

    expect(apiGet("issues")).rejects.toThrow("404: Not Found");
  });

  test("throws ApiError on 500 with non-JSON body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    try {
      await apiGet("issues");
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(500);
      expect((e as ApiError).message).toBe("500: Internal Server Error");
    }
  });

  test("ApiError has correct name", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Bad" } }), {
        status: 400,
      }),
    );

    try {
      await apiGet("issues");
      expect(true).toBe(false);
    } catch (e) {
      expect((e as ApiError).name).toBe("ApiError");
    }
  });
});
