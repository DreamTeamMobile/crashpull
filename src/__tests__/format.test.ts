import { describe, expect, test } from "bun:test";
import { textTable, formatAge, formatJson, type Column } from "../format.js";

const COLS: Column[] = [
  { key: "id", label: "ID", width: 6 },
  { key: "type", label: "TYPE", width: 6 },
  { key: "events", label: "EVENTS", width: 6, align: "right" },
  { key: "title", label: "TITLE" },
];

const ROWS = [
  { id: "abc1", type: "FATAL", events: 42, title: "NullPointerException" },
  { id: "abc2", type: "ANR", events: 7, title: "DeadlockDetected" },
];

describe("textTable", () => {
  test("renders header, divider, and data rows", () => {
    const out = textTable(ROWS, COLS);
    const lines = out.split("\n");

    expect(lines.length).toBe(4); // header + divider + 2 rows
    expect(lines[0]).toContain("ID");
    expect(lines[0]).toContain("TITLE");
    expect(lines[1]).toMatch(/^[─\s]+$/);
  });

  test("aligns columns consistently", () => {
    const out = textTable(ROWS, COLS);
    const lines = out.split("\n");

    // All content lines should be the same length
    const lengths = lines.map((l) => l.length);
    expect(new Set(lengths).size).toBe(1);
  });

  test("right-aligns numeric columns", () => {
    const out = textTable(ROWS, COLS);
    const lines = out.split("\n");
    // The events column (right-aligned) should have leading spaces for "7"
    const dataRow = lines[3]; // second data row, events=7
    expect(dataRow).toContain("     7");
  });

  test("truncates values exceeding column width", () => {
    const cols: Column[] = [{ key: "name", label: "NAME", width: 4 }];
    const rows = [{ name: "Alexander" }];
    const out = textTable(rows, cols);
    const lines = out.split("\n");
    expect(lines[2]).toBe("Alex");
  });

  test("handles empty rows", () => {
    const out = textTable([], COLS);
    const lines = out.split("\n");
    expect(lines.length).toBe(2); // header + divider only
  });

  test("handles missing keys gracefully", () => {
    const out = textTable([{ id: "x" }], COLS);
    const lines = out.split("\n");
    expect(lines.length).toBe(3);
  });
});

describe("formatAge", () => {
  const NOW = new Date("2025-06-15T12:00:00Z").getTime();

  test("returns 'just now' for times less than a minute ago", () => {
    const iso = new Date(NOW - 30_000).toISOString(); // 30s ago
    expect(formatAge(iso, NOW)).toBe("just now");
  });

  test("returns minutes", () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString();
    expect(formatAge(iso, NOW)).toBe("5m ago");
  });

  test("returns hours", () => {
    const iso = new Date(NOW - 3 * 60 * 60_000).toISOString();
    expect(formatAge(iso, NOW)).toBe("3h ago");
  });

  test("returns days", () => {
    const iso = new Date(NOW - 5 * 24 * 60 * 60_000).toISOString();
    expect(formatAge(iso, NOW)).toBe("5d ago");
  });

  test("returns weeks", () => {
    const iso = new Date(NOW - 14 * 24 * 60 * 60_000).toISOString();
    expect(formatAge(iso, NOW)).toBe("2w ago");
  });

  test("returns months", () => {
    const iso = new Date(NOW - 65 * 24 * 60 * 60_000).toISOString();
    expect(formatAge(iso, NOW)).toBe("2mo ago");
  });

  test("returns years", () => {
    const iso = new Date(NOW - 400 * 24 * 60 * 60_000).toISOString();
    expect(formatAge(iso, NOW)).toBe("1y ago");
  });

  test("returns 'just now' for future dates", () => {
    const iso = new Date(NOW + 60_000).toISOString();
    expect(formatAge(iso, NOW)).toBe("just now");
  });
});

describe("formatJson", () => {
  test("returns valid indented JSON", () => {
    const data = { id: "abc", count: 42 };
    const out = formatJson(data);
    expect(JSON.parse(out)).toEqual(data);
    expect(out).toContain("\n");
    expect(out).toContain("  ");
  });

  test("handles arrays", () => {
    const data = [1, 2, 3];
    const out = formatJson(data);
    expect(JSON.parse(out)).toEqual(data);
  });

  test("handles null and primitives", () => {
    expect(formatJson(null)).toBe("null");
    expect(formatJson(42)).toBe("42");
    expect(formatJson("hello")).toBe('"hello"');
  });
});
