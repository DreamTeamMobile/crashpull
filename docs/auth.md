# Authentication

crashpull reuses the Firebase CLI's stored credentials — no separate login needed.

## How It Works

1. You run `firebase login` once (standard Firebase CLI setup)
2. Firebase CLI stores a refresh token at:
   ```
   ~/.config/configstore/firebase-tools.json
   ```
3. On every invocation, crashpull reads `tokens.refresh_token` from that file
4. Exchanges it for a short-lived access token via Google's OAuth2 endpoint
5. Uses the access token to call the Crashlytics API

No tokens are cached by crashpull — a fresh access token is obtained each run.

## Config Storage

| File | Location | Contents |
|------|----------|----------|
| Firebase tokens | `~/.config/configstore/firebase-tools.json` | Managed by `firebase` CLI |
| Project config | `./.crashpull.json` (cwd) | `{ projectNumber, appId }` — created by `crashpull init` |

`.crashpull.json` is gitignored by default.

## Troubleshooting

### "Run firebase login first"

The Firebase config file is missing or has no `tokens.refresh_token`.

**Fix:** Run `firebase login` and complete the browser auth flow.

### "Re-run firebase login"

The stored refresh token has been revoked or expired (Google returned `invalid_grant`).

**Fix:** Run `firebase login` again. This happens if you:
- Revoked access in your Google account security settings
- Changed your Google password
- Hit Google's limit on active refresh tokens per account

### "Token refresh failed (HTTP status)"

Network issue or unexpected OAuth error.

**Fix:** Check your internet connection. If persistent, try `firebase login` again.

### Wrong account / wrong project

crashpull uses whichever Google account is logged into `firebase`. If you see
permission errors or unexpected data:

```sh
# Check which account is active
firebase login --list

# Switch accounts
firebase login --reauth
```

### Multiple Google accounts

Firebase CLI supports one active login at a time. To switch:

```sh
firebase login --reauth          # re-authenticate as a different user
firebase logout && firebase login # or logout first
```

After switching, re-run `crashpull init` if the new account has different
projects.

### Verifying auth works

```sh
crashpull doctor
```

Check 3 ("token") shows your email and whether the token refreshes successfully.
Check 4 ("api") confirms API access to your configured project.
