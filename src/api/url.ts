import { requireConfig } from "../config.js";

const BASE_URL = "https://firebasecrashlytics.googleapis.com/v1alpha";

export async function buildUrl(
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
