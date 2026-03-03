# Command Reference

## Synopsis

```
crashpull <command> [options]
```

## Global Options

| Flag | Default | Description |
|------|---------|-------------|
| `--format <text\|json>` | `text` | Output format |
| `--project <number>` | from config | Firebase project number (overrides .crashpull.json) |
| `--app <id>` | from config | Firebase app ID (overrides .crashpull.json) |
| `--help` | | Show help |

All commands support `--format json` for machine-readable output. Errors also
respect this flag — JSON errors go to stderr as `{"error":"…"}`.

---

## doctor

Preflight checks: firebase binary, config file, token validity, API access.

```
crashpull doctor
```

Checks run in order (stops on first failure):

1. `firebase` binary exists and returns a version
2. Firebase config file is readable (`~/.config/configstore/firebase-tools.json`)
3. Token refresh succeeds; displays logged-in email
4. API is reachable (fetches one issue)
5. `.crashpull.json` exists in current directory

**JSON output:** `[{ name, ok, value?, error?, fix? }]`

**Examples:**

```sh
crashpull doctor
crashpull doctor --format json
```

---

## init

Interactive setup — links a Firebase project and Android app to the current directory.

```
crashpull init
```

Flow:

1. Runs `firebase projects:list --json` — prompts you to pick a project
2. Runs `firebase apps:list --project <id> --json` — shows Android apps only
3. Writes `.crashpull.json` with `{ projectNumber, appId }`

Requires `firebase` CLI installed and authenticated.

---

## list

List top crash issues.

```
crashpull list [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--type <fatal\|non-fatal\|anr>` | all | Error type filter |
| `--signal <fresh\|regressed\|repetitive>` | all | Signal filter |
| `--since <7d\|30d\|90d>` | `30d` | Time window |
| `--limit <n>` | `10` | Max results |

**Text output:** table with columns ID (8-char prefix), TYPE, EVENTS, USERS, AGE, STATE, TITLE, plus summary line.

**JSON output:** `{ issues: Issue[], summary: { total, fresh, window } }`

**Examples:**

```sh
crashpull list
crashpull list --type fatal --since 7d
crashpull list --signal regressed --limit 5 --format json
```

---

## show

Show issue detail and latest stack trace.

```
crashpull show <issueId>
```

Accepts a short prefix (1-8 chars) or full issue ID. Short prefixes are resolved
by fetching top 100 issues and matching with `startsWith`.

Fetches the issue and its latest event in parallel.

**Text output:** ISSUE header, LATEST CRASH block, STACK TRACE, BLAME FRAME.

**JSON output:** `{ issue: Issue, latestEvent: Event | null }`

**Examples:**

```sh
crashpull show a1b2c3d4
crashpull show a1b2c3d4 --format json
```

---

## resolve

Resolve (close) an issue.

```
crashpull resolve <issueId>
```

Same short-prefix resolution as `show`. If the issue is already closed, returns
early with a no-op message.

**Text output:** `Resolved issue <id> (<title>)` or `Issue <id> (<title>) is already closed`

**JSON output:** full Issue object

**Examples:**

```sh
crashpull resolve a1b2c3d4
crashpull resolve a1b2c3d4 --format json
```

---

## help

Show help for a command.

```
crashpull help [command]
```

Without arguments: top-level usage with all commands. With a command name:
command-specific flags, defaults, and examples.

**JSON output:** structured command/flag definitions.

```sh
crashpull help
crashpull help list
crashpull help list --format json
```
