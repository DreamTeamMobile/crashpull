# crashpull

Zero-dependency TypeScript CLI that pulls crash data from Firebase Crashlytics into your terminal and agentic coding workflows.

## Project Goal

Build a zero-dependency TypeScript CLI tool (`npx crashpull@latest`) that pulls crash/issue data from Firebase Crashlytics v1alpha API. Reuses firebase-tools OAuth tokens for auth. Targets Android apps. Designed to feed crash data into agentic coding workflows (Claude Code, Codex, etc.).

## What It Does

crashpull reads your existing Firebase CLI login tokens and talks directly to the Crashlytics API — no extra auth setup, no SDK dependencies. List top crashes, inspect stack traces, resolve issues, all from the command line. Output as text tables for humans or JSON for agents.

## Architecture

```
src/
├── bin.ts              # Entry point — shebang, argv routing, error handling
├── args.ts             # parseArgs config per command, routing logic
├── config.ts           # Read/write .crashpull.json (project+app linking)
├── format.ts           # Text table + JSON output helpers
├── commands/
│   ├── doctor.ts       # Preflight checks (firebase, auth, API, config)
│   ├── init.ts         # Interactive project/app setup via firebase CLI
│   ├── list.ts         # Top issues with filtering (type, signal, since)
│   ├── show.ts         # Issue detail + full stack trace
│   ├── resolve.ts      # PATCH issue state → CLOSED
│   └── help.ts         # Plain-text help, per-command, --format json
└── api/
    ├── auth.ts         # Read firebase token, refresh via Google OAuth
    ├── client.ts       # Fetch wrapper: base URL + Bearer + error handling
    ├── crashlytics.ts  # Typed API calls (topIssues, getIssue, listEvents, etc.)
    └── types.ts        # Response types (Issue, Event, Frame, Exception, etc.)
```

**Auth flow:** Reads `~/.config/configstore/firebase-tools.json` → refreshes OAuth token via Google's token endpoint using Firebase CLI's public client credentials → injects Bearer token into Crashlytics API requests.

**Config:** `.crashpull.json` in project root links a Firebase project number and Android app ID. Created by `crashpull init`.

## Components

| Module | Purpose |
|--------|---------|
| `api/auth` | Firebase token refresh, error messages for missing/expired auth |
| `api/client` | Generic GET/PATCH wrapper for Crashlytics v1alpha API |
| `api/crashlytics` | Typed functions: topIssues, getIssue, listEvents, updateIssue |
| `api/types` | TypeScript interfaces for all API responses |
| `config` | Read/write `.crashpull.json` project config |
| `format` | Text table rendering, relative time formatting, JSON output |
| `args` | Command routing and flag parsing via `node:util parseArgs` |
| `commands/*` | One file per command: doctor, init, list, show, resolve, help |

## Technology Stack

- **TypeScript 7** — strict mode, ES2022 target, NodeNext modules
- **Node 18+** — only built-ins (`parseArgs`, `fetch`, `fs`, `os`, `path`)
- **tsup** — bundle to single `dist/bin.js`
- **oxlint / oxfmt** — linting and formatting
- **bun test** — test runner
- **Zero runtime dependencies**

## Getting Started

```sh
# Check your setup
npx crashpull@latest doctor

# Link a Firebase project and Android app
npx crashpull@latest init

# List top crashes (last 30 days)
npx crashpull@latest list

# Inspect a specific crash
npx crashpull@latest show a1b2c3d4

# Resolve an issue
npx crashpull@latest resolve a1b2c3d4
```

### Agentic Usage

All commands support `--format json` for machine-readable output:

```sh
# Feed crash data into an agent's context
npx crashpull@latest list --type fatal --since 7d --format json

# Get full stack trace as JSON
npx crashpull@latest show a1b2c3d4 --format json
```

Add to your project's `CLAUDE.md`:

```
# Crash data
Run `npx crashpull@latest list --format json` to see current crashes.
Run `npx crashpull@latest show <id> --format json` for stack traces.
```

## License

MIT