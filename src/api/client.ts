import { requireConfig } from "../config.js";
import { getAccessToken } from "./auth.js";

const BASE_URL = "https://firebasecrashlytics.googleapis.com/v1alpha";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function buildUrl(
  path: string,
  params?: Record<string, string>,
): Promise<string> {
  const config = await requireConfig();
  const full = `${BASE_URL}/projects/${config.projectNumber}/apps/${config.appId}/${path}`;
  const url = new URL(full);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const [url, token] = await Promise.all([
    buildUrl(path, params),
    getAccessToken(),
  ]);

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    let message: string;
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      message = err?.error?.message ?? res.statusText;
    } catch {
      message = res.statusText;
    }
    throw new ApiError(res.status, `${res.status}: ${message}`);
  }

  return (await res.json()) as T;
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  return request<T>("GET", path, undefined, params);
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  params?: Record<string, string>,
): Promise<T> {
  return request<T>("PATCH", path, body, params);
}
