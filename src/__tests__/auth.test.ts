import { describe, expect, test, mock, beforeEach } from "bun:test";

// Mock fs/promises before importing auth
const mockReadFile = mock(() => Promise.resolve(""));
mock.module("node:fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: mock(() => Promise.resolve()),
}));

// Mock global fetch
const mockFetch = mock(() => Promise.resolve(new Response()));
globalThis.fetch = mockFetch as unknown as typeof fetch;

const { getAccessToken } = await import("../api/auth.js");

const VALID_CONFIG = JSON.stringify({
  tokens: { refresh_token: "fake-refresh-token" },
});

const VALID_TOKEN_RESPONSE = JSON.stringify({
  access_token: "fake-access-token",
  token_type: "Bearer",
  expires_in: 3600,
});

beforeEach(() => {
  mockReadFile.mockReset();
  mockFetch.mockReset();
});

describe("getAccessToken", () => {
  test("returns access_token on success", async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    mockFetch.mockResolvedValueOnce(
      new Response(VALID_TOKEN_RESPONSE, { status: 200 }),
    );

    const token = await getAccessToken();
    expect(token).toBe("fake-access-token");
  });

  test("passes correct params to token endpoint", async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    mockFetch.mockResolvedValueOnce(
      new Response(VALID_TOKEN_RESPONSE, { status: 200 }),
    );

    await getAccessToken();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://www.googleapis.com/oauth2/v3/token");
    expect(opts.method).toBe("POST");

    const body = new URLSearchParams(opts.body as string);
    expect(body.get("refresh_token")).toBe("fake-refresh-token");
    expect(body.get("client_id")).toContain("563584335869");
    expect(body.get("grant_type")).toBe("refresh_token");
  });

  test("throws 'Run firebase login first' when config file missing", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

    expect(getAccessToken()).rejects.toThrow("Run firebase login first");
  });

  test("throws 'Run firebase login first' when refresh_token missing", async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ tokens: {} }));

    expect(getAccessToken()).rejects.toThrow("Run firebase login first");
  });

  test("throws 'Run firebase login first' when tokens key missing", async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({}));

    expect(getAccessToken()).rejects.toThrow("Run firebase login first");
  });

  test("throws 'Re-run firebase login' on invalid_grant", async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "invalid_grant", error_description: "Token has been revoked" }),
        { status: 400 },
      ),
    );

    expect(getAccessToken()).rejects.toThrow("Re-run firebase login");
  });

  test("throws on other HTTP errors", async () => {
    mockReadFile.mockResolvedValueOnce(VALID_CONFIG);
    mockFetch.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    expect(getAccessToken()).rejects.toThrow("Token refresh failed (500)");
  });
});
