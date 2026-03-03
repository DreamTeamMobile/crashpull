import { getAccessToken } from "./auth.js";
import { buildUrl } from "./url.js";

export { ApiError } from "./error.js";
export { buildUrl } from "./url.js";

import { ApiError } from "./error.js";

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
