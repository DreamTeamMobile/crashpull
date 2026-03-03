import { describe, expect, test } from "bun:test";

describe("smoke", () => {
  test("project loads", async () => {
    const pkg = await import("../../package.json");
    expect(pkg.name).toBe("crashpull");
  });

  test("true is true", () => {
    expect(true).toBe(true);
  });
});
