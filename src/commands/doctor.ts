import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { formatJson } from "../format.js";

const FIREBASE_CONFIG_PATH = join(
  homedir(),
  ".config",
  "configstore",
  "firebase-tools.json",
);

const TOKEN_ENDPOINT = "https://www.googleapis.com/oauth2/v3/token";
const CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

export interface DoctorArgs {
  format?: string;
  project?: string;
  app?: string;
}

interface CheckResult {
  name: string;
  ok: boolean;
  value?: string;
  error?: string;
  fix?: string;
}

export interface DoctorIO {
  execFile: typeof execFile;
  readFile: typeof readFile;
  fetch: typeof globalThis.fetch;
}

const defaultIO: DoctorIO = { execFile, readFile, fetch: globalThis.fetch };

function dotLine(name: string, value: string, width = 40): string {
  const dots = ".".repeat(Math.max(2, width - name.length));
  return `${name} ${dots} ${value}`;
}

function whichFirebase(io: DoctorIO): Promise<{ path: string; version: string }> {
  return new Promise((resolve, reject) => {
    io.execFile("which", ["firebase"], (err, stdout) => {
      if (err) {
        reject(new Error("firebase CLI not found on PATH"));
        return;
      }
      const binPath = stdout.trim();
      io.execFile("firebase", ["--version"], (verErr, verOut) => {
        if (verErr) {
          reject(new Error("firebase found but could not get version"));
          return;
        }
        resolve({ path: binPath, version: verOut.trim() });
      });
    });
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT structure");
  const payload = parts[1];
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  const json = Buffer.from(padded, "base64").toString("utf-8");
  return JSON.parse(json);
}

async function refreshToken(
  refreshTok: string,
  fetchFn: typeof globalThis.fetch,
): Promise<{ accessToken: string; idToken?: string }> {
  const res = await fetchFn(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshTok,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (body.includes("invalid_grant")) {
      throw new Error("Token expired. Re-run: firebase login");
    }
    throw new Error(`Token refresh failed (${res.status})`);
  }

  const data = (await res.json()) as { access_token: string; id_token?: string };
  return { accessToken: data.access_token, idToken: data.id_token };
}

export async function runDoctor(args: DoctorArgs, io: DoctorIO = defaultIO): Promise<string> {
  const checks: CheckResult[] = [];
  let accessToken: string | undefined;

  // Check 1: firebase binary on PATH
  try {
    const { path, version } = await whichFirebase(io);
    checks.push({ name: "firebase cli", ok: true, value: `${version} (${path})` });
  } catch {
    checks.push({
      name: "firebase cli",
      ok: false,
      error: "firebase CLI not found on PATH",
      fix: "Install: npm install -g firebase-tools",
    });
    return formatOutput(checks, args.format);
  }

  // Check 2: firebase-tools config file exists
  let firebaseConfigRaw: string;
  try {
    firebaseConfigRaw = await io.readFile(FIREBASE_CONFIG_PATH, "utf-8") as string;
    checks.push({ name: "firebase config", ok: true, value: FIREBASE_CONFIG_PATH });
  } catch {
    checks.push({
      name: "firebase config",
      ok: false,
      error: "firebase-tools config not found",
      fix: "Run: firebase login",
    });
    return formatOutput(checks, args.format);
  }

  // Check 3: Token refresh + decode id_token for email
  try {
    const config = JSON.parse(firebaseConfigRaw);
    const refreshTok = config?.tokens?.refresh_token;
    if (!refreshTok) throw new Error("No refresh token found");

    const { accessToken: at, idToken } = await refreshToken(refreshTok, io.fetch);
    accessToken = at;

    let email = "unknown";
    if (idToken) {
      try {
        const payload = decodeJwtPayload(idToken);
        email = (payload.email as string) ?? "unknown";
      } catch {
        // id_token decode failed, still ok
      }
    }
    checks.push({ name: "auth token", ok: true, value: email });
  } catch (err) {
    checks.push({
      name: "auth token",
      ok: false,
      error: err instanceof Error ? err.message : "Token refresh failed",
      fix: "Run: firebase login --reauth",
    });
    return formatOutput(checks, args.format);
  }

  // Check 4: Crashlytics API reachable
  try {
    const configRaw = await readConfigSafe(io);
    const projectNumber = args.project ?? configRaw?.projectNumber;
    const appId = args.app ?? configRaw?.appId;

    if (!projectNumber || !appId) {
      throw new Error("No project/app configured");
    }

    const url = new URL(
      `https://firebasecrashlytics.googleapis.com/v1alpha/projects/${projectNumber}/apps/${appId}/reports/topIssues`,
    );
    url.searchParams.set("pageSize", "1");

    const res = await io.fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API returned ${res.status}: ${body.slice(0, 100)}`);
    }

    checks.push({ name: "crashlytics api", ok: true, value: "reachable" });
  } catch (err) {
    checks.push({
      name: "crashlytics api",
      ok: false,
      error: err instanceof Error ? err.message : "API request failed",
      fix: "Check project/app IDs. Run: crashpull init",
    });
    return formatOutput(checks, args.format);
  }

  // Check 5: .crashpull.json exists → show project + app
  try {
    const configRaw = await readConfigSafe(io);
    if (!configRaw) throw new Error("File not found");
    checks.push({
      name: "config",
      ok: true,
      value: `project=${configRaw.projectNumber} app=${configRaw.appId}`,
    });
  } catch {
    checks.push({
      name: "config",
      ok: false,
      error: ".crashpull.json not found",
      fix: "Run: crashpull init",
    });
    return formatOutput(checks, args.format);
  }

  return formatOutput(checks, args.format);
}

async function readConfigSafe(
  io: DoctorIO,
): Promise<{ projectNumber: string; appId: string } | null> {
  try {
    const raw = (await io.readFile(join(process.cwd(), ".crashpull.json"), "utf-8")) as string;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatOutput(checks: CheckResult[], format?: string): string {
  if (format === "json") {
    return formatJson(checks);
  }

  const lines: string[] = [];
  for (const check of checks) {
    if (check.ok) {
      lines.push(dotLine(check.name, check.value ?? "ok"));
    } else {
      lines.push(dotLine(check.name, "FAIL"));
      lines.push(`  ${check.error}`);
      if (check.fix) {
        lines.push(`  Fix: ${check.fix}`);
      }
    }
  }
  return lines.join("\n");
}
