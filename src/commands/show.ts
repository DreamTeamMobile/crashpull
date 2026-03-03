import { getIssue, getTopIssues, listEvents } from "../api/crashlytics.js";
import type { Event, Exception, Frame, Issue } from "../api/types.js";
import { formatAge, formatJson } from "../format.js";

export interface ShowArgs {
  issueId?: string;
  format?: string;
}

async function resolveIssueId(idArg: string): Promise<string> {
  // Full ID — use as-is
  if (idArg.length > 8) return idArg;

  // Short prefix — search top issues for a match
  const response = await getTopIssues({ pageSize: 100 });
  const issues = response.issues ?? [];
  const match = issues.find((i) => i.id.startsWith(idArg));
  if (!match) {
    throw new Error(`No issue found matching prefix "${idArg}"`);
  }
  return match.id;
}

function formatIssueHeader(issue: Issue, now: number): string {
  const lines: string[] = [];
  lines.push("ISSUE");
  lines.push(`  ${issue.title}`);
  lines.push(`  ${issue.subtitle}`);
  lines.push("");

  const age = issue.createTime ? formatAge(issue.createTime, now) : "—";
  const events = issue.eventCount ?? 0;
  const users = issue.impactedDevicesCount ?? 0;
  const versions = `${issue.firstSeenVersion} → ${issue.lastSeenVersion}`;

  lines.push(`  Type:     ${issue.errorType}`);
  lines.push(`  State:    ${issue.state}`);
  lines.push(`  Events:   ${events}`);
  lines.push(`  Users:    ${users}`);
  lines.push(`  Versions: ${versions}`);
  lines.push(`  Age:      ${age}`);
  lines.push(`  Console:  ${issue.uri}`);

  return lines.join("\n");
}

function formatLatestCrash(event: Event): string {
  const lines: string[] = [];
  lines.push("LATEST CRASH");
  lines.push(`  Device:  ${event.device.manufacturer} ${event.device.model} (${event.device.architecture})`);
  lines.push(`  OS:      ${event.operatingSystem.name} ${event.operatingSystem.displayVersion}`);
  lines.push(`  Version: ${event.version.displayVersion} (${event.version.buildVersion})`);
  return lines.join("\n");
}

function formatFrame(frame: Frame): string {
  const marker = frame.blamed ? ">" : " ";
  const location = frame.file && frame.line ? `(${frame.file}:${frame.line})` : "";
  return `${marker}   ${frame.library} ${frame.symbol} ${location}`.trimEnd();
}

function formatStackTrace(exceptions: Exception[]): string {
  const lines: string[] = [];
  lines.push("STACK TRACE");

  for (const ex of exceptions) {
    lines.push(`  ${ex.type}: ${ex.reason}`);
    for (const frame of ex.frames) {
      lines.push(`  ${formatFrame(frame)}`);
    }
    lines.push("");
  }

  // Remove trailing empty line
  if (lines.at(-1) === "") lines.pop();

  return lines.join("\n");
}

function formatBlameFrame(frame: Frame): string {
  const location = frame.file && frame.line ? `${frame.file}:${frame.line}` : frame.library;
  return `BLAME FRAME: ${frame.symbol} ${location}`;
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

  if (args.format === "json") {
    return formatJson({ issue, latestEvent: latestEvent ?? null });
  }

  const now = Date.now();
  const sections: string[] = [formatIssueHeader(issue, now)];

  if (latestEvent) {
    sections.push(formatLatestCrash(latestEvent));

    if (latestEvent.exceptions?.length) {
      sections.push(formatStackTrace(latestEvent.exceptions));
    }

    if (latestEvent.blameFrame) {
      sections.push(formatBlameFrame(latestEvent.blameFrame));
    }
  }

  return sections.join("\n\n");
}
