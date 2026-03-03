import { describe, expect, mock, test } from "bun:test";
import type { InitIO } from "../commands/init.js";
import { runInit } from "../commands/init.js";

// --- Fixtures ---

const PROJECTS = [
  { projectId: "my-app-prod", projectNumber: "111111", displayName: "My App Prod" },
  { projectId: "my-app-staging", projectNumber: "222222", displayName: "My App Staging" },
];

const APPS = [
  { appId: "1:111111:android:aaa", displayName: "Android App", platform: "ANDROID" },
  { appId: "1:111111:ios:bbb", displayName: "iOS App", platform: "IOS" },
  { appId: "1:111111:android:ccc", displayName: "Android Debug", platform: "ANDROID" },
];

// --- Helpers ---

type ExecFileCb = (err: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void;

function makeExecFile(responses: Record<string, unknown>) {
  return ((cmd: string, args: string[], cb: ExecFileCb) => {
    const key = [cmd, ...args].join(" ");
    for (const [pattern, data] of Object.entries(responses)) {
      if (key.includes(pattern)) {
        if (data instanceof Error) {
          return cb(data, "", "");
        }
        return cb(null, JSON.stringify(data), "");
      }
    }
    return cb(new Error(`Unexpected command: ${key}`), "", "");
  }) as unknown as InitIO["execFile"];
}

function makeReadline(answers: string[]) {
  let idx = 0;
  return () => ({
    question: (_prompt: string, cb: (answer: string) => void) => {
      cb(answers[idx++] ?? "");
    },
    close: () => {},
  });
}

function defaultIO(overrides: Partial<InitIO> = {}): InitIO {
  return {
    execFile: makeExecFile({
      "projects:list": { result: PROJECTS },
      "apps:list": { result: APPS },
    }),
    createReadlineInterface: makeReadline(["1", "1"]),
    writeConfig: mock(() => Promise.resolve()),
    ...overrides,
  };
}

// --- Tests ---

describe("runInit", () => {
  describe("happy path", () => {
    test("writes config with chosen project and app", async () => {
      const io = defaultIO();
      await runInit(io);
      expect(io.writeConfig).toHaveBeenCalledWith({
        projectNumber: "111111",
        appId: "1:111111:android:aaa",
      });
    });

    test("returns confirmation message", async () => {
      const out = await runInit(defaultIO());
      expect(out).toContain("Saved .crashpull.json");
      expect(out).toContain("My App Prod");
      expect(out).toContain("1:111111:android:aaa");
    });

    test("choosing second project picks correct one", async () => {
      const io = defaultIO({
        createReadlineInterface: makeReadline(["2", "1"]),
        execFile: makeExecFile({
          "projects:list": { result: PROJECTS },
          // apps:list for project 2
          "apps:list": { result: [{ appId: "1:222222:android:ddd", displayName: "Staging App", platform: "ANDROID" }] },
        }),
      });
      await runInit(io);
      expect(io.writeConfig).toHaveBeenCalledWith({
        projectNumber: "222222",
        appId: "1:222222:android:ddd",
      });
    });

    test("choosing second android app (skips iOS)", async () => {
      const io = defaultIO({
        createReadlineInterface: makeReadline(["1", "2"]),
      });
      await runInit(io);
      // APPS has 2 android apps: index 0 (aaa) and index 2 (ccc). Second choice = ccc
      expect(io.writeConfig).toHaveBeenCalledWith({
        projectNumber: "111111",
        appId: "1:111111:android:ccc",
      });
    });
  });

  describe("deduplicates apps by appId", () => {
    test("duplicate appIds are shown only once", async () => {
      const dupeApps = [
        { appId: "1:111:android:aaa", displayName: "Smart NoteTaking", platform: "ANDROID" },
        { appId: "1:111:android:aaa", displayName: "Smart NoteTaking", platform: "ANDROID" },
        { appId: "1:111:android:aaa", displayName: "Smart NoteTaking", platform: "ANDROID" },
      ];
      const prompts: string[] = [];
      const io = defaultIO({
        execFile: makeExecFile({
          "projects:list": { result: PROJECTS },
          "apps:list": { result: dupeApps },
        }),
        createReadlineInterface: () => ({
          question: (prompt: string, cb: (answer: string) => void) => {
            prompts.push(prompt);
            cb(prompts.length === 1 ? "1" : "1");
          },
          close: () => {},
        }),
      });
      await runInit(io);
      // App prompt should show only 1 entry, not 3
      const appPrompt = prompts[1];
      expect(appPrompt).toContain("1) Smart NoteTaking");
      expect(appPrompt).not.toContain("2)");
    });
  });

  describe("filters to Android only", () => {
    test("iOS-only project throws no Android apps error", async () => {
      const io = defaultIO({
        execFile: makeExecFile({
          "projects:list": { result: PROJECTS },
          "apps:list": { result: [{ appId: "1:111:ios:bbb", displayName: "iOS", platform: "IOS" }] },
        }),
      });
      await expect(runInit(io)).rejects.toThrow("No Android apps found");
    });
  });

  describe("firebase not available", () => {
    test("throws if projects:list fails", async () => {
      const io = defaultIO({
        execFile: makeExecFile({
          "projects:list": new Error("command not found"),
        }),
      });
      await expect(runInit(io)).rejects.toThrow("Could not list Firebase projects");
    });
  });

  describe("no projects", () => {
    test("throws if project list is empty", async () => {
      const io = defaultIO({
        execFile: makeExecFile({
          "projects:list": { result: [] },
        }),
      });
      await expect(runInit(io)).rejects.toThrow("No Firebase projects found");
    });
  });

  describe("apps:list fails", () => {
    test("throws if apps:list command fails", async () => {
      const io = defaultIO({
        execFile: makeExecFile({
          "projects:list": { result: PROJECTS },
          "apps:list": new Error("network error"),
        }),
      });
      await expect(runInit(io)).rejects.toThrow("Could not list apps");
    });
  });

  describe("invalid user input", () => {
    test("throws on non-numeric project choice", async () => {
      const io = defaultIO({
        createReadlineInterface: makeReadline(["abc", "1"]),
      });
      await expect(runInit(io)).rejects.toThrow("Invalid choice: abc");
    });

    test("throws on out-of-range project choice", async () => {
      const io = defaultIO({
        createReadlineInterface: makeReadline(["99", "1"]),
      });
      await expect(runInit(io)).rejects.toThrow("Invalid choice: 99");
    });

    test("throws on zero project choice", async () => {
      const io = defaultIO({
        createReadlineInterface: makeReadline(["0", "1"]),
      });
      await expect(runInit(io)).rejects.toThrow("Invalid choice: 0");
    });

    test("throws on invalid app choice", async () => {
      const io = defaultIO({
        createReadlineInterface: makeReadline(["1", "abc"]),
      });
      await expect(runInit(io)).rejects.toThrow("Invalid choice: abc");
    });
  });

  describe("prompt content", () => {
    test("project prompt lists all projects with numbers", async () => {
      const prompts: string[] = [];
      const io = defaultIO({
        createReadlineInterface: () => ({
          question: (prompt: string, cb: (answer: string) => void) => {
            prompts.push(prompt);
            cb(prompts.length === 1 ? "1" : "1");
          },
          close: () => {},
        }),
      });
      await runInit(io);
      expect(prompts[0]).toContain("1) My App Prod");
      expect(prompts[0]).toContain("2) My App Staging");
      expect(prompts[0]).toContain("Choose project");
    });

    test("app prompt lists only Android apps", async () => {
      const prompts: string[] = [];
      const io = defaultIO({
        createReadlineInterface: () => ({
          question: (prompt: string, cb: (answer: string) => void) => {
            prompts.push(prompt);
            cb(prompts.length === 1 ? "1" : "1");
          },
          close: () => {},
        }),
      });
      await runInit(io);
      expect(prompts[1]).toContain("Android App");
      expect(prompts[1]).toContain("Android Debug");
      expect(prompts[1]).not.toContain("iOS");
    });
  });

  describe("non-interactive mode (params)", () => {
    test("skips prompts when --project and --app provided", async () => {
      const io = defaultIO();
      await runInit(io, { project: "my-app-prod", app: "1:111111:android:aaa" });
      expect(io.writeConfig).toHaveBeenCalledWith({
        projectNumber: "111111",
        appId: "1:111111:android:aaa",
      });
    });

    test("matches project by projectNumber", async () => {
      const io = defaultIO();
      await runInit(io, { project: "111111", app: "1:111111:android:aaa" });
      expect(io.writeConfig).toHaveBeenCalledWith({
        projectNumber: "111111",
        appId: "1:111111:android:aaa",
      });
    });

    test("throws on unknown project", async () => {
      const io = defaultIO();
      await expect(runInit(io, { project: "nonexistent" })).rejects.toThrow(
        "Project nonexistent not found",
      );
    });

    test("throws on unknown app", async () => {
      const io = defaultIO();
      await expect(
        runInit(io, { project: "my-app-prod", app: "1:111111:android:zzz" }),
      ).rejects.toThrow("App 1:111111:android:zzz not found");
    });

    test("project-only param still prompts for app", async () => {
      const prompts: string[] = [];
      const io = defaultIO({
        createReadlineInterface: () => ({
          question: (prompt: string, cb: (answer: string) => void) => {
            prompts.push(prompt);
            cb("1");
          },
          close: () => {},
        }),
      });
      await runInit(io, { project: "my-app-prod" });
      // Should not prompt for project, only for app
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("Android apps:");
    });
  });

  describe("app with no displayName", () => {
    test("falls back to appId in prompt", async () => {
      const prompts: string[] = [];
      const io = defaultIO({
        execFile: makeExecFile({
          "projects:list": { result: PROJECTS },
          "apps:list": { result: [{ appId: "1:111:android:x", displayName: "", platform: "ANDROID" }] },
        }),
        createReadlineInterface: () => ({
          question: (prompt: string, cb: (answer: string) => void) => {
            prompts.push(prompt);
            cb(prompts.length === 1 ? "1" : "1");
          },
          close: () => {},
        }),
      });
      await runInit(io);
      expect(prompts[1]).toContain("1:111:android:x");
    });
  });
});
