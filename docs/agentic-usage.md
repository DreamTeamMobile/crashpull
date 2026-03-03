# Agentic Usage

crashpull is designed for both human and AI-agent workflows. Every command
supports `--format json` for structured output that agents can parse directly.

## CLAUDE.md Integration

Add to your project's `CLAUDE.md`:

```markdown
## Crash Triage

Use `crashpull` to investigate crashes. Always use `--format json` for parsing.

- List crashes: `crashpull list --format json`
- Show detail: `crashpull show <id> --format json`
- Resolve: `crashpull resolve <id> --format json`
- Preflight: `crashpull doctor --format json`
```

## Codex / Agent Workflows

### Triage top crashes

```sh
crashpull list --type fatal --since 7d --format json | \
  jq '.issues[] | {id: .id[0:8], title: .title, events: .eventCount}'
```

### Investigate a specific crash

```sh
# Get stack trace and blame frame
crashpull show a1b2c3d4 --format json | jq '.latestEvent.stackTrace'
```

### Batch resolve

```sh
# Resolve all issues from a filtered list
crashpull list --signal repetitive --format json | \
  jq -r '.issues[].id' | \
  xargs -I{} crashpull resolve {} --format json
```

### Doctor as gate

Run doctor before any crash workflow to verify auth and config:

```sh
crashpull doctor --format json | jq 'all(.ok)'
# returns true/false
```

## Piping Patterns

### Feed crashes to an LLM

```sh
crashpull show a1b2c3d4 --format json | \
  jq '{title: .issue.title, trace: .latestEvent.stackTrace}' | \
  claude "Analyze this crash and suggest a fix"
```

### Filter by event count

```sh
crashpull list --since 30d --format json | \
  jq '.issues[] | select(.eventCount > 100)'
```

### Export to CSV

```sh
crashpull list --format json | \
  jq -r '.issues[] | [.id[0:8], .type, .eventCount, .title] | @csv'
```

## JSON Output Shapes

### list

```json
{
  "issues": [{ "id": "...", "title": "...", "type": "FATAL", "eventCount": 42, ... }],
  "summary": { "total": 10, "fresh": 3, "window": "30d" }
}
```

### show

```json
{
  "issue": { "id": "...", "title": "...", ... },
  "latestEvent": { "stackTrace": "...", ... }
}
```

### resolve

Returns the full Issue object (same shape as items in `list`).

### doctor

```json
[
  { "name": "firebase", "ok": true, "value": "13.x.x" },
  { "name": "token", "ok": true, "value": "user@example.com" },
  ...
]
```

### Errors

All commands emit errors to stderr:

```json
{ "error": "Run firebase login first" }
```

Exit code is `1` on failure.
