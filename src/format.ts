// Format helpers: text table rendering, age formatting, JSON output

export interface Column {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right";
}

const TIME_UNITS: [number, string][] = [
  [365 * 24 * 60 * 60_000, "y"],
  [30 * 24 * 60 * 60_000, "mo"],
  [7 * 24 * 60 * 60_000, "w"],
  [24 * 60 * 60_000, "d"],
  [60 * 60_000, "h"],
  [60_000, "m"],
];

export function formatAge(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 0) return "just now";

  for (const [ms, unit] of TIME_UNITS) {
    const value = Math.floor(diff / ms);
    if (value >= 1) return `${value}${unit} ago`;
  }
  return "just now";
}

function pad(text: string, width: number, align: "left" | "right"): string {
  if (text.length >= width) return text.slice(0, width);
  return align === "right" ? text.padStart(width) : text.padEnd(width);
}

export function textTable(
  rows: Record<string, unknown>[],
  columns: Column[],
): string {
  // Compute widths: max of label length, explicit width, or data length
  const widths = columns.map((col) => {
    const dataMax = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? "");
      return Math.max(max, val.length);
    }, 0);
    return col.width ?? Math.max(col.label.length, dataMax);
  });

  const sep = "  ";

  // Header
  const header = columns
    .map((col, i) => pad(col.label, widths[i], col.align ?? "left"))
    .join(sep);

  // Divider
  const divider = widths.map((w) => "─".repeat(w)).join(sep);

  // Rows
  const body = rows.map((row) =>
    columns
      .map((col, i) => {
        const val = String(row[col.key] ?? "");
        return pad(val, widths[i], col.align ?? "left");
      })
      .join(sep),
  );

  return [header, divider, ...body].join("\n");
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
