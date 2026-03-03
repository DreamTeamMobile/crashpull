import { execFile } from "node:child_process";
import { createInterface } from "node:readline";
import { writeConfig } from "../config.js";

interface FirebaseProject {
  projectId: string;
  projectNumber: string;
  displayName: string;
}

interface FirebaseApp {
  appId: string;
  displayName: string;
  platform: string;
}

export interface InitIO {
  execFile: typeof execFile;
  createReadlineInterface: () => {
    question: (prompt: string, cb: (answer: string) => void) => void;
    close: () => void;
  };
  writeConfig: typeof writeConfig;
}

const defaultIO: InitIO = {
  execFile,
  createReadlineInterface: () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return {
      question: (prompt: string, cb: (answer: string) => void) => rl.question(prompt, cb),
      close: () => rl.close(),
    };
  },
  writeConfig,
};

function execJson<T>(io: InitIO, cmd: string, args: string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    io.execFile(cmd, args, (err, stdout) => {
      if (err) {
        reject(new Error(`Command failed: ${cmd} ${args.join(" ")}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.toString()) as T);
      } catch {
        reject(new Error(`Failed to parse JSON from: ${cmd} ${args.join(" ")}`));
      }
    });
  });
}

function ask(io: InitIO, prompt: string): Promise<string> {
  const rl = io.createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function parseChoice(input: string, max: number): number | null {
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

export async function runInit(io: InitIO = defaultIO): Promise<string> {
  // Step 1: List Firebase projects
  let projects: FirebaseProject[];
  try {
    const result = await execJson<{ result: FirebaseProject[] }>(
      io,
      "firebase",
      ["projects:list", "--json"],
    );
    projects = result.result;
  } catch {
    throw new Error(
      "Could not list Firebase projects. Is firebase CLI installed and authenticated?",
    );
  }

  if (projects.length === 0) {
    throw new Error("No Firebase projects found. Create one at https://console.firebase.google.com");
  }

  // Step 2: User picks a project
  const projectLines = projects.map(
    (p, i) => `  ${i + 1}) ${p.displayName} (${p.projectId})`,
  );
  const projectPrompt = [
    "Firebase projects:",
    ...projectLines,
    "",
    `Choose project (1-${projects.length}): `,
  ].join("\n");

  const projectAnswer = await ask(io, projectPrompt);
  const projectIdx = parseChoice(projectAnswer, projects.length);
  if (projectIdx === null) {
    throw new Error(`Invalid choice: ${projectAnswer}`);
  }
  const project = projects[projectIdx - 1];

  // Step 3: List apps for chosen project
  let apps: FirebaseApp[];
  try {
    const result = await execJson<{ result: FirebaseApp[] }>(
      io,
      "firebase",
      ["apps:list", "--project", project.projectId, "--json"],
    );
    apps = result.result;
  } catch {
    throw new Error(`Could not list apps for project ${project.projectId}`);
  }

  // Filter to Android apps only
  const androidApps = apps.filter((a) => a.platform === "ANDROID");
  if (androidApps.length === 0) {
    throw new Error(
      `No Android apps found in project ${project.displayName}. Add one in Firebase Console.`,
    );
  }

  // Step 4: User picks an app
  const appLines = androidApps.map(
    (a, i) => `  ${i + 1}) ${a.displayName || a.appId} (${a.appId})`,
  );
  const appPrompt = [
    "Android apps:",
    ...appLines,
    "",
    `Choose app (1-${androidApps.length}): `,
  ].join("\n");

  const appAnswer = await ask(io, appPrompt);
  const appIdx = parseChoice(appAnswer, androidApps.length);
  if (appIdx === null) {
    throw new Error(`Invalid choice: ${appAnswer}`);
  }
  const app = androidApps[appIdx - 1];

  // Step 5: Write config
  await io.writeConfig({
    projectNumber: project.projectNumber,
    appId: app.appId,
  });

  return `Saved .crashpull.json (project: ${project.displayName}, app: ${app.appId})`;
}
