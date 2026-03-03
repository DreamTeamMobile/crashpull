import { getTopIssues } from "./api/crashlytics.js";

export async function resolveIssueId(idArg: string): Promise<string> {
  // Full ID — use as-is
  if (idArg.length > 12) return idArg;

  // Short prefix — search top issues for a match
  const response = await getTopIssues({ pageSize: 100 });
  const issues = response.issues ?? [];
  const match = issues.find((i) => i.id.startsWith(idArg));
  if (!match) {
    throw new Error(`No issue found matching prefix "${idArg}"`);
  }
  return match.id;
}
