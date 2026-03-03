import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CONFIG_FILE = ".crashpull.json";

export interface CrashpullConfig {
  projectNumber: string;
  appId: string;
}

function configPath(): string {
  return join(process.cwd(), CONFIG_FILE);
}

export async function readConfig(): Promise<CrashpullConfig | null> {
  try {
    const raw = await readFile(configPath(), "utf-8");
    return JSON.parse(raw) as CrashpullConfig;
  } catch {
    return null;
  }
}

export async function writeConfig(config: CrashpullConfig): Promise<void> {
  await writeFile(configPath(), JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export async function requireConfig(): Promise<CrashpullConfig> {
  const config = await readConfig();
  if (!config) {
    throw new Error("No .crashpull.json found. Run crashpull init first.");
  }
  return config;
}
