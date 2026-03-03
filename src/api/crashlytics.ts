import { apiGet, apiPatch } from "./client.js";
import type {
  EnrichedIssue,
  ErrorType,
  Issue,
  IssueState,
  ListEventsResponse,
  TopIssuesRawResponse,
} from "./types.js";

/** Maps human-friendly windows to ISO start_time values. */
function sinceToStartTime(since: string): string | undefined {
  const hours: Record<string, number> = {
    "7d": 7 * 24,
    "30d": 30 * 24,
    "90d": 90 * 24,
  };
  const h = hours[since];
  if (!h) return undefined;
  return new Date(Date.now() - h * 60 * 60_000).toISOString();
}

export interface TopIssuesOpts {
  errorTypes?: ErrorType[];
  signals?: string[];
  since?: "7d" | "30d" | "90d";
  pageSize?: number;
}

export async function getTopIssues(opts: TopIssuesOpts = {}) {
  const params: Record<string, string> = {};

  if (opts.pageSize) {
    params.page_size = String(opts.pageSize);
  }

  if (opts.errorTypes?.length) {
    params["filter.issue.error_types"] = opts.errorTypes.join(",");
  }

  if (opts.signals?.length) {
    params["filter.issue.signals"] = opts.signals.join(",");
  }

  if (opts.since) {
    const startTime = sinceToStartTime(opts.since);
    if (startTime) {
      params["filter.interval.start_time"] = startTime;
      params["filter.interval.end_time"] = new Date().toISOString();
    }
  }

  const raw = await apiGet<TopIssuesRawResponse>("reports/topIssues", params);
  const issues: EnrichedIssue[] = (raw.groups ?? []).map((g) => {
    const m = g.metrics?.[0];
    return {
      ...g.issue,
      eventCount: m ? Number(m.eventsCount) : undefined,
      impactedDevicesCount: m ? Number(m.impactedUsersCount) : undefined,
    };
  });
  return { issues, nextPageToken: raw.nextPageToken };
}

export function getIssue(issueId: string) {
  return apiGet<Issue>(`issues/${issueId}`);
}

export function listEvents(issueId: string, pageSize?: number) {
  const params: Record<string, string> = {
    "filter.issue.id": issueId,
  };
  if (pageSize) {
    params.page_size = String(pageSize);
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
