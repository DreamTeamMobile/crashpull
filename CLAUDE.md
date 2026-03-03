# Current Goal

Zero-dependency CLI (`crashpull`) that pulls Firebase Crashlytics data into terminals and agentic coding workflows. Ships as a single `npx`-able binary — list top crashes, inspect stack traces, resolve issues, all with `--format json` for agent consumption.

# Commands

```
npm run build      # tsup → dist/bin.js (ESM, Node 18+)
npm run lint       # oxlint src/
npm run dev        # tsx src/bin.ts (run without building)
bun test           # unit tests (bun test runner)
```

# Architecture

```
src/
├── bin.ts              # Entry point — routes argv to command handlers
├── args.ts             # CLI argument parser (node:util parseArgs)
├── config.ts           # .crashpull.json read/write (project + app IDs)
├── format.ts           # Text table renderer, age formatting, JSON output
├── resolve-id.ts       # Short-prefix → full issue ID resolution
├── api/
│   ├── auth.ts         # Firebase OAuth2 token refresh (reads ~/.config/configstore/firebase-tools.json)
│   ├── client.ts       # HTTP client (apiGet/apiPatch) with auth + URL building
│   ├── crashlytics.ts  # Crashlytics API calls (topIssues, getIssue, listEvents, updateIssueState)
│   ├── error.ts        # ApiError class (status + message)
│   ├── types.ts        # Full Crashlytics API response types
│   └── url.ts          # URL builder (v1alpha base + project/app path)
├── commands/
│   ├── doctor.ts       # Preflight checks (firebase CLI, auth, API, config)
│   ├── init.ts         # Interactive setup — pick project + app via firebase CLI
│   ├── list.ts         # Top issues table with filters (type, signal, since, limit)
│   ├── show.ts         # Issue detail + stack trace
│   ├── resolve.ts      # Mark issue as CLOSED
│   └── help.ts         # Usage text/JSON for all commands
└── __tests__/          # Unit tests (bun test)
```

**Flow:** `bin.ts` → `args.route()` → `commands/*` → `api/client` → Firebase Crashlytics REST API (v1alpha).

**Auth:** Reuses Firebase CLI's stored refresh token (`~/.config/configstore/firebase-tools.json`). The OAuth client ID/secret are Firebase's well-known public credentials (same as firebase-tools itself).

**Config:** `.crashpull.json` in CWD stores `projectNumber` + `appId` after `init`.

# Conventions

- Zero runtime dependencies — only `node:*` built-ins + `fetch`
- ESM (`"type": "module"` in package.json)
- TypeScript strict mode, `.js` extensions in imports
- Every command returns `string` — `bin.ts` just `console.log`s it
- All commands support `--format json` for machine-readable output
- Commands use dependency injection for testability (`DoctorIO`, `InitIO`)
- Tests in `src/__tests__/*.test.ts`, run with `bun test`

# Gotchas

- Uses Firebase Crashlytics **v1alpha** API — may change without notice
- `init` only lists Android apps (Crashlytics API limitation for this endpoint)
- Short issue ID prefix matching (`resolve-id.ts`) fetches up to 100 issues to find a match
- `.crashpull.json` is gitignored — each developer runs `init` locally
- The `SINCE_MAP` in `crashlytics.ts` maps time windows to `filter.eventTimestamp>=<hours>` values
