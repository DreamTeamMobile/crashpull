import { getTopIssues } from "../api/crashlytics.js";
import type { ErrorType, Issue } from "../api/types.js";
import { formatAge, formatJson, textTable } from "../format.js";
import type { Column } from "../format.js";

export interface ListArgs {
  type?: string;
  signal?: string;
  since?: string;
  limit?: number;
  format?: string;
}

const COLUMNS: Column[] = [
  { key: "id", label: "ID", width: 8 },
  { key: "type", label: "TYPE", width: 9 },
  { key: "events", label: "EVENTS", width: 7, align: "right" },
  { key: "users", label: "USERS", width: 6, align: "right" },
  { key: "age", label: "AGE", width: 8 },
  { key: "state", label: "STATE", width: 6 },
  { key: "title", label: "TITLE" },
];

const FRESH_THRESHOLD_MS = 7 * 24 * 60 * 60_000; // 7 days

function mapErrorType(type?: string): ErrorType[] | undefined {
  if (!type) return undefined;
  const map: Record<string, ErrorType> = {
    fatal: "FATAL",
    "non-fatal": "NON_FATAL",
    anr: "ANR",
  };
  const mapped = map[type.toLowerCase()];
  return mapped ? [mapped] : undefined;
}

const SIGNAL_MAP: Record<string, string> = {
  early: "SIGNAL_EARLY",
  fresh: "SIGNAL_FRESH",
  regressed: "SIGNAL_REGRESSED",
  repetitive: "SIGNAL_REPETITIVE",
};

function mapSignal(signal?: string): string[] | undefined {
  if (!signal) return undefined;
  const mapped = SIGNAL_MAP[signal.toLowerCase()];
  return mapped ? [mapped] : undefined;
}

function isFresh(issue: Issue, now: number): boolean {
  if (!issue.createTime) return false;
  return now - new Date(issue.createTime).getTime() < FRESH_THRESHOLD_MS;
}

function toRow(issue: Issue, now: number) {
  return {
    id: issue.id.slice(0, 8),
    type: issue.errorType,
    events: String(issue.eventCount ?? 0),
    users: String(issue.impactedDevicesCount ?? 0),
    age: issue.createTime ? formatAge(issue.createTime, now) : "—",
    state: issue.state,
    title: issue.title,
  };
}

export async function runList(args: ListArgs): Promise<string> {
  const since = (args.since ?? "30d") as "7d" | "30d" | "90d";
  const limit = args.limit ?? 10;

  const response = await getTopIssues({
    errorTypes: mapErrorType(args.type),
    signals: mapSignal(args.signal),
    since,
    pageSize: limit,
  });

  const issues = response.issues ?? [];
  const now = Date.now();

  if (issues.length === 0) {
    if (args.format === "json") {
      return formatJson({ issues: [], summary: { total: 0, fresh: 0, window: since } });
    }
    return "No issues found.";
  }

  const freshCount = issues.filter((i) => isFresh(i, now)).length;
  const window = since.replace("d", "");

  if (args.format === "json") {
    return formatJson({
      issues,
      summary: { total: issues.length, fresh: freshCount, window: since },
    });
  }

  const rows = issues.map((i) => toRow(i, now));
  const table = textTable(rows, COLUMNS);
  const summary = `${issues.length} issues (${freshCount} fresh) | last ${window}d`;

  return `${table}\n\n${summary}`;
}
