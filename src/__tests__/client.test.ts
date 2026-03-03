import { describe, expect, test, mock } from "bun:test";
import { ApiError } from "../api/error.js";

// Mock config for buildUrl tests
mock.module("../config.js", () => ({
  requireConfig: () =>
    Promise.resolve({ projectNumber: "123456", appId: "1:123456:ios:abcdef" }),
}));

const { buildUrl } = await import("../api/url.js");

describe("buildUrl", () => {
  test("builds correct URL with path prefix", async () => {
    const url = await buildUrl("issues");
    expect(url).toBe(
      "https://firebasecrashlytics.googleapis.com/v1alpha/projects/123456/apps/1:123456:ios:abcdef/issues",
    );
  });

  test("encodes query params", async () => {
    const url = await buildUrl("issues", { pageSize: "10", pageToken: "abc" });
    expect(url).toContain("pageSize=10");
    expect(url).toContain("pageToken=abc");
  });

  test("handles nested paths", async () => {
    const url = await buildUrl("issues/abc123/events");
    expect(url).toContain("/issues/abc123/events");
  });

  test("works with no params", async () => {
    const url = await buildUrl("reports/topIssues");
    expect(url).not.toContain("?");
  });

  test("handles special characters in params", async () => {
    const url = await buildUrl("issues", { filter: "state=OPEN" });
    expect(url).toContain("filter=state%3DOPEN");
  });
});

describe("ApiError", () => {
  test("has correct name", () => {
    const err = new ApiError(400, "400: Bad Request");
    expect(err.name).toBe("ApiError");
  });

  test("has status and message", () => {
    const err = new ApiError(401, "401: Unauthorized");
    expect(err.status).toBe(401);
    expect(err.message).toBe("401: Unauthorized");
  });

  test("is instanceof Error", () => {
    const err = new ApiError(500, "500: Internal Server Error");
    expect(err).toBeInstanceOf(Error);
  });

  test("works with try/catch", () => {
    try {
      throw new ApiError(403, "403: Forbidden");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(403);
    }
  });
});
