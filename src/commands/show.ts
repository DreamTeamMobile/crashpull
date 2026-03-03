import { getIssue, listEvents } from "../api/crashlytics.js";
import type { Exception, Frame, Issue } from "../api/types.js";
import { formatJson } from "../format.js";
import { resolveIssueId } from "../resolve-id.js";

export interface ShowArgs {
  issueId?: string;
  format?: string;
}

function frameToString(frame: Frame): string {
  const loc = frame.file && frame.line ? `(${frame.file}:${frame.line})` : `(${frame.library})`;
  return `${frame.symbol} ${loc}`;
}

function buildCallstack(exceptions: Exception[]): string[] {
  const lines: string[] = [];
  for (const [i, ex] of exceptions.entries()) {
    const header = `${ex.type}: ${ex.exceptionMessage}`;
    lines.push(i > 0 ? `--- ${header} ---` : header);
    for (const frame of ex.frames) {
      lines.push(`${frame.blamed ? "> " : "  "}${frameToString(frame)}`);
    }
  }
  return lines;
}

function formatText(issue: Issue, callstack: string[], blameFrame: string | null): string {
  const lines: string[] = [];
  lines.push(`${issue.title} — ${issue.subtitle}`);
  lines.push(`${issue.errorType} | ${issue.state} | ${issue.firstSeenVersion}→${issue.lastSeenVersion}`);
  if (blameFrame) lines.push(`Blame: ${blameFrame}`);
  if (callstack.length) {
    lines.push("", ...callstack);
  }
  return lines.join("\n");
}

export async function runShow(args: ShowArgs): Promise<string> {
  if (!args.issueId) {
    throw new Error("Missing issue ID. Usage: crashpull show <issue-id>");
  }

  const fullId = await resolveIssueId(args.issueId);
  const [issue, eventsResponse] = await Promise.all([
    getIssue(fullId),
    listEvents(fullId, 1),
  ]);

  const latestEvent = eventsResponse.events?.[0];
  const exceptions = latestEvent?.exceptions?.length ? latestEvent.exceptions : [];
  const callstack = exceptions.length ? buildCallstack(exceptions) : [];
  const blameFrame = latestEvent?.blameFrame ? frameToString(latestEvent.blameFrame) : null;

  if (args.format === "json") {
    return formatJson({
      id: issue.id,
      title: issue.title,
      subtitle: issue.subtitle,
      type: issue.errorType,
      state: issue.state,
      uri: issue.uri,
      blameFrame,
      callstack,
    });
  }

  return formatText(issue, callstack, blameFrame);
}
