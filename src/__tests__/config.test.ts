import { describe, expect, test, mock, beforeEach } from "bun:test";
import { join } from "node:path";

const mockReadFile = mock(() => Promise.resolve(""));
const mockWriteFile = mock(() => Promise.resolve());

mock.module("node:fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

const { readConfig, writeConfig, requireConfig } = await import("../config.js");

const VALID_CONFIG = { projectNumber: "123456789", appId: "1:123:android:abc" };

beforeEach(() => {
  mockReadFile.mockReset();
  mockWriteFile.mockReset();
});

describe("readConfig", () => {
  test("returns parsed config when .crashpull.json exists", async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify(VALID_CONFIG));

    const config = await readConfig();
    expect(config).toEqual(VALID_CONFIG);
    expect(mockReadFile).toHaveBeenCalledWith(
      join(process.cwd(), ".crashpull.json"),
      "utf-8",
    );
  });

  test("returns null when file is missing", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

    const config = await readConfig();
    expect(config).toBeNull();
  });
});

describe("writeConfig", () => {
  test("writes pretty-printed JSON to .crashpull.json", async () => {
    mockWriteFile.mockResolvedValueOnce(undefined);

    await writeConfig(VALID_CONFIG);

    expect(mockWriteFile).toHaveBeenCalledWith(
      join(process.cwd(), ".crashpull.json"),
      JSON.stringify(VALID_CONFIG, null, 2) + "\n",
      "utf-8",
    );
  });
});

describe("requireConfig", () => {
  test("returns config when it exists", async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify(VALID_CONFIG));

    const config = await requireConfig();
    expect(config).toEqual(VALID_CONFIG);
  });

  test("throws when config is missing", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

    expect(requireConfig()).rejects.toThrow(
      "No .crashpull.json found. Run crashpull init first.",
    );
  });
});
