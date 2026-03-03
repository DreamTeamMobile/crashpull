import { getIssue, updateIssueState } from "../api/crashlytics.js";
import { formatJson } from "../format.js";
import { resolveIssueId } from "../resolve-id.js";

export interface ResolveArgs {
  issueId?: string;
  format?: string;
}

export async function runResolve(args: ResolveArgs): Promise<string> {
  if (!args.issueId) {
    throw new Error("Missing issue ID. Usage: crashpull resolve <issue-id>");
  }

  const fullId = await resolveIssueId(args.issueId);
  const current = await getIssue(fullId);
  const shortId = fullId.slice(0, 8);

  if (current.state === "CLOSED") {
    if (args.format === "json") {
      return formatJson(current);
    }
    return `Issue ${shortId} (${current.title}) is already closed`;
  }

  const updated = await updateIssueState(fullId, "CLOSED");

  if (args.format === "json") {
    return formatJson(updated);
  }

  return `Resolved issue ${shortId} (${updated.title})`;
}
