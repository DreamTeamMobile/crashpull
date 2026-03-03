import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

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

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function getAccessToken(): Promise<string> {
  let raw: string;
  try {
    raw = await readFile(FIREBASE_CONFIG_PATH, "utf-8");
  } catch {
    throw new Error("Run firebase login first");
  }

  const config = JSON.parse(raw);
  const refreshToken: string | undefined = config?.tokens?.refresh_token;
  if (!refreshToken) {
    throw new Error("Run firebase login first");
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (body.includes("invalid_grant")) {
      throw new Error("Re-run firebase login");
    }
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}
