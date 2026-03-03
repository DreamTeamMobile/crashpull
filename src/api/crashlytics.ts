import { apiGet, apiPatch } from "./client.js";
import type {
  ErrorType,
  Issue,
  IssueState,
  ListEventsResponse,
  TopIssuesResponse,
} from "./types.js";

const SINCE_MAP: Record<string, [string, string]> = {
  "7d": ["filter.eventTimestamp>=", "168"],
  "30d": ["filter.eventTimestamp>=", "720"],
  "90d": ["filter.eventTimestamp>=", "2160"],
};

export interface TopIssuesOpts {
  errorTypes?: ErrorType[];
  signals?: string[];
  since?: "7d" | "30d" | "90d";
  pageSize?: number;
}

export function getTopIssues(opts: TopIssuesOpts = {}) {
  const params: Record<string, string> = {};

  if (opts.pageSize) {
    params.pageSize = String(opts.pageSize);
  }

  if (opts.errorTypes?.length) {
    params["filter.errorTypes"] = opts.errorTypes.join(",");
  }

  if (opts.signals?.length) {
    params["filter.signals"] = opts.signals.join(",");
  }

  if (opts.since && SINCE_MAP[opts.since]) {
    const [key, value] = SINCE_MAP[opts.since];
    params[key] = value;
  }

  return apiGet<TopIssuesResponse>("reports/topIssues", params);
}

export function getIssue(issueId: string) {
  return apiGet<Issue>(`issues/${issueId}`);
}

export function listEvents(issueId: string, pageSize?: number) {
  const params: Record<string, string> = {
    "filter.issue.id": issueId,
  };
  if (pageSize) {
    params.pageSize = String(pageSize);
  }
  return apiGet<ListEventsResponse>("events", params);
}

export function updateIssueState(issueId: string, state: IssueState) {
  return apiPatch<Issue>(
    `issues/${issueId}`,
    { state },
    { updateMask: "state" },
  );
}
