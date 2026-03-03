# crashpull

Pull Firebase Crashlytics data into your terminal and agentic coding workflows.

## Why

Crash data lives in the Firebase console. Your coding agent lives in the terminal. **crashpull** bridges the gap — list top crashes, inspect stack traces, and resolve issues without leaving your workflow. Output as human-readable tables or `--format json` for agents.

## Install

```sh
npx crashpull@latest
```

Requires Node 18+. Zero runtime dependencies. Uses your existing Firebase CLI login — no extra auth setup.

## Quick Start

```sh
# 1. Check prerequisites (firebase CLI, auth, API access)
npx crashpull doctor

# 2. Link a Firebase project and Android app
npx crashpull init

# 3. List top crashes (last 30 days)
npx crashpull list

# 4. Inspect a specific crash with full stack trace
npx crashpull show a1b2c3d4

# 5. Resolve an issue
npx crashpull resolve a1b2c3d4
```

## Agentic Workflow

All commands support `--format json` for machine-readable output:

```sh
# Top fatal crashes from the last 7 days
npx crashpull list --type fatal --since 7d --format json

# Full stack trace as JSON
npx crashpull show a1b2c3d4 --format json

# Pipe into your agent's context
npx crashpull list --format json | claude -p "Which crash should we fix first?"
```

### CLAUDE.md Integration

Add this to your project's `CLAUDE.md` to give your agent access to crash data:

```markdown
# Crash data
- Run `npx crashpull list --format json` to see current top crashes
- Run `npx crashpull show <id> --format json` to get full stack trace
- Run `npx crashpull resolve <id>` after fixing a crash
```

## Commands

| Command   | Description                                      |
|-----------|--------------------------------------------------|
| `doctor`  | Preflight checks — firebase CLI, auth, API, config |
| `init`    | Interactive setup — links Firebase project + app |
| `list`    | Top issues with `--type`, `--signal`, `--since`, `--limit` filters |
| `show`    | Issue detail + full stack trace                  |
| `resolve` | Mark an issue as resolved                        |
| `help`    | Usage info (also supports `--format json`)       |

## License

MIT
