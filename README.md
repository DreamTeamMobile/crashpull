# crashpull

Pull Firebase Crashlytics data into your terminal and agentic coding workflows.

## Why

Crash data lives in the Firebase console. Your coding agent lives in the terminal. **crashpull** bridges the gap — list top crashes, inspect stack traces, and resolve issues without leaving your workflow. Output as human-readable tables or `--format json` for agents.

## Install

```sh
npx -y crashpull@latest
```

Requires Node 18+. Zero runtime dependencies. Uses your existing Firebase CLI login — no extra auth setup.

## Quick Start

```sh
# 1. Check prerequisites (firebase CLI, auth, API access)
npx -y crashpull@latest doctor

# 2. Link a Firebase project and Android app
npx -y crashpull@latest init

# 3. List top crashes (last 30 days)
npx -y crashpull@latest list

# 4. Inspect a specific crash with full stack trace
npx -y crashpull@latest show a1b2c3d4

# 5. Resolve an issue
npx -y crashpull@latest resolve a1b2c3d4

# 6. Get compact agent guide for LLM system prompts
npx -y crashpull@latest llm
```

## Agentic Workflow

All commands support `--format json` for machine-readable output:

```sh
# Top fatal crashes from the last 7 days
npx -y crashpull@latest list --type fatal --since 7d --format json

# Full stack trace as JSON
npx -y crashpull@latest show a1b2c3d4 --format json

# Pipe into your agent's context
npx -y crashpull@latest list --format json | claude -p "Which crash should we fix first?"

# Get compact agent guide for LLM system prompts
npx -y crashpull@latest llm | pbcopy
```

### CLAUDE.md Integration

Add this to your project's `CLAUDE.md` to give your agent access to crash data:

```markdown
# Crash data
- Run `npx -y crashpull@latest list --format json` to see current top crashes
- Run `npx -y crashpull@latest show <id> --format json` to get full stack trace
- Run `npx -y crashpull@latest resolve <id>` after fixing a crash
```

## Commands

| Command   | Description                                      |
|-----------|--------------------------------------------------|
| `doctor`  | Preflight checks — firebase CLI, auth, API, config |
| `init`    | Interactive setup — links Firebase project + app |
| `list`    | Top issues with `--type`, `--signal`, `--since`, `--limit` filters |
| `show`    | Issue detail + full stack trace                  |
| `resolve` | Mark an issue as resolved                        |
| `llm`     | Compact agent guide — pipe into LLM system prompts |
| `help`    | Usage info (also supports `--format json`)       |

## License

MIT
