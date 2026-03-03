const GUIDE = `crashpull — Firebase Crashlytics CLI for terminals & agents.
Prereqs: firebase login, then crashpull init in project dir.
Run via: npx -y crashpull@latest <command> (aliased as "cp" below)

WORKFLOW (always pass --format json):
  cp list --format json                          # top crashes, last 30d
  cp list --type fatal --since 7d --format json
  cp show <issueId> --format json                # stack trace + details
  cp resolve <issueId>                            # close issue

FILTERS (list): --type fatal|non-fatal|anr  --signal fresh|regressed|repetitive
  --since 7d|30d|90d  --limit <n>

JQ: cp list --format json | jq '.[].id'
    cp show <id> --format json | jq '.callstack'
    cp list --format json | jq 'sort_by(.eventCount)|reverse|.[0]'

NOTE: cp = npx -y crashpull@latest`;

export function runLlm(): string {
  return GUIDE;
}
