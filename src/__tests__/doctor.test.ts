import { describe, expect, test } from "bun:test";
import type { DoctorIO } from "../commands/doctor.js";
import { runDoctor } from "../commands/doctor.js";

// --- Helpers ---

const FIREBASE_CONFIG = JSON.stringify({
  tokens: { refresh_token: "fake-refresh-token" },
});

const CRASHPULL_CONFIG = JSON.stringify({
  projectNumber: "123456",
  appId: "1:123:android:abc",
});

const fakePayload = Buffer.from(JSON.stringify({ email: "user@example.com" })).toString("base64url");
const fakeIdToken = `eyJhbGciOiJSUzI1NiJ9.${fakePayload}.fakesig`;

type ExecFileCb = (err: Error | null, stdout: string, stderr: string) => void;

function makeExecFile(behavior: "success" | "not-found" | "no-version") {
  return ((cmd: string, _args: string[], cb: ExecFileCb) => {
    if (cmd === "which") {
      if (behavior === "not-found") return cb(new Error("not found"), "", "");
      return cb(null, "/usr/local/bin/firebase\n", "");
    }
    if (cmd === "firebase") {
      if (behavior === "no-version") return cb(new Error("version failed"), "", "");
      return cb(null, "13.0.0\n", "");
    }
  }) as unknown as DoctorIO["execFile"];
}

function makeReadFile(files: Record<string, string>) {
  return ((path: string) => {
    for (const [pattern, content] of Object.entries(files)) {
      if (path.includes(pattern)) return Promise.resolve(content);
    }
    return Promise.reject(new Error("ENOENT"));
  }) as unknown as DoctorIO["readFile"];
}

function makeFetch(handlers: Record<string, () => Response>) {
  return ((url: string) => {
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) return Promise.resolve(handler());
    }
    return Promise.resolve(new Response("Not Found", { status: 404 }));
  }) as unknown as DoctorIO["fetch"];
}

function okTokenResponse(withIdToken = true) {
  const body = withIdToken
    ? { access_token: "fake-access", id_token: fakeIdToken }
    : { access_token: "fake-access" };
  return new Response(JSON.stringify(body), { status: 200 });
}

function okApiResponse() {
  return new Response(JSON.stringify({ issues: [] }), { status: 200 });
}

// All-pass IO setup
function allPassIO(): DoctorIO {
  return {
    execFile: makeExecFile("success"),
    readFile: makeReadFile({
      "firebase-tools.json": FIREBASE_CONFIG,
      ".crashpull.json": CRASHPULL_CONFIG,
    }),
    fetch: makeFetch({
      oauth2: () => okTokenResponse(),
      topIssues: () => okApiResponse(),
    }),
  };
}

// --- Tests ---

describe("runDoctor", () => {
  describe("all checks pass", () => {
    test("text output shows all checks as ok", async () => {
      const out = await runDoctor({}, allPassIO());
      expect(out).toContain("firebase cli");
      expect(out).toContain("13.0.0");
      expect(out).toContain("firebase config");
      expect(out).toContain("auth token");
      expect(out).toContain("user@example.com");
      expect(out).toContain("crashlytics api");
      expect(out).toContain("reachable");
      expect(out).toContain("config");
      expect(out).toContain("project=123456");
    });

    test("text output uses dotted line alignment", async () => {
      const out = await runDoctor({}, allPassIO());
      const lines = out.split("\n");
      for (const line of lines) {
        if (line.startsWith("  ")) continue;
        expect(line).toMatch(/\.\./);
      }
    });

    test("no FAIL in all-pass output", async () => {
      const out = await runDoctor({}, allPassIO());
      expect(out).not.toContain("FAIL");
    });

    test("json format returns array of checks", async () => {
      const out = await runDoctor({ format: "json" }, allPassIO());
      const json = JSON.parse(out);
      expect(json).toBeArray();
      expect(json).toHaveLength(5);
      expect(json.every((c: { ok: boolean }) => c.ok)).toBe(true);
    });

    test("json checks have name, ok, value fields", async () => {
      const out = await runDoctor({ format: "json" }, allPassIO());
      const json = JSON.parse(out);
      for (const check of json) {
        expect(check).toHaveProperty("name");
        expect(check).toHaveProperty("ok");
        expect(check).toHaveProperty("value");
      }
    });
  });

  describe("firebase CLI not on PATH", () => {
    const io: DoctorIO = { ...allPassIO(), execFile: makeExecFile("not-found") };

    test("stops on first failure", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("firebase cli");
      expect(out).toContain("FAIL");
      expect(out).not.toContain("firebase config");
    });

    test("shows actionable fix", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("npm install -g firebase-tools");
    });

    test("json has 1 check with ok=false", async () => {
      const out = await runDoctor({ format: "json" }, io);
      const json = JSON.parse(out);
      expect(json).toHaveLength(1);
      expect(json[0].ok).toBe(false);
      expect(json[0].fix).toContain("npm install");
    });
  });

  describe("firebase version fails", () => {
    const io: DoctorIO = { ...allPassIO(), execFile: makeExecFile("no-version") };

    test("stops at firebase cli check", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("firebase cli");
      expect(out).toContain("FAIL");
    });
  });

  describe("firebase config missing", () => {
    const io: DoctorIO = {
      ...allPassIO(),
      readFile: makeReadFile({}),
    };

    test("passes firebase cli, fails at config", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("firebase cli");
      expect(out).toContain("firebase config");
      expect(out).toContain("FAIL");
    });

    test("shows fix to run firebase login", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("firebase login");
    });

    test("json shows 2 checks (cli pass, config fail)", async () => {
      const out = await runDoctor({ format: "json" }, io);
      const json = JSON.parse(out);
      expect(json).toHaveLength(2);
      expect(json[0].ok).toBe(true);
      expect(json[1].ok).toBe(false);
    });
  });

  describe("token refresh fails (invalid_grant)", () => {
    const io: DoctorIO = {
      ...allPassIO(),
      fetch: makeFetch({
        oauth2: () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
      }),
    };

    test("passes cli + config, fails at auth", async () => {
      const out = await runDoctor({}, io);
      const lines = out.split("\n");
      expect(lines[0]).toContain("firebase cli");
      expect(lines[0]).not.toContain("FAIL");
      expect(lines[1]).toContain("firebase config");
      expect(lines[1]).not.toContain("FAIL");
      expect(out).toContain("auth token");
      expect(out).toContain("FAIL");
    });

    test("shows fix to reauth", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("firebase login");
    });

    test("json shows 3 checks", async () => {
      const out = await runDoctor({ format: "json" }, io);
      const json = JSON.parse(out);
      expect(json).toHaveLength(3);
      expect(json[2].ok).toBe(false);
      expect(json[2].name).toBe("auth token");
    });
  });

  describe("no refresh token in config", () => {
    const io: DoctorIO = {
      ...allPassIO(),
      readFile: makeReadFile({
        "firebase-tools.json": JSON.stringify({ tokens: {} }),
        ".crashpull.json": CRASHPULL_CONFIG,
      }),
    };

    test("fails at auth token check", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("auth token");
      expect(out).toContain("FAIL");
    });
  });

  describe("API unreachable (403)", () => {
    const io: DoctorIO = {
      ...allPassIO(),
      fetch: makeFetch({
        oauth2: () => okTokenResponse(),
        topIssues: () => new Response("Forbidden", { status: 403 }),
      }),
    };

    test("passes first 3, fails at API", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("crashlytics api");
      expect(out).toContain("FAIL");
      expect(out).toContain("403");
    });

    test("shows fix to check project/app", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("crashpull init");
    });

    test("json shows 4 checks", async () => {
      const out = await runDoctor({ format: "json" }, io);
      const json = JSON.parse(out);
      expect(json).toHaveLength(4);
      expect(json[3].ok).toBe(false);
      expect(json[3].name).toBe("crashlytics api");
    });
  });

  describe("no project/app configured", () => {
    const io: DoctorIO = {
      ...allPassIO(),
      readFile: makeReadFile({
        "firebase-tools.json": FIREBASE_CONFIG,
      }),
      fetch: makeFetch({
        oauth2: () => okTokenResponse(),
      }),
    };

    test("fails at API check with no project", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("crashlytics api");
      expect(out).toContain("FAIL");
      expect(out).toContain("No project/app configured");
    });
  });

  describe("project/app from args override", () => {
    const calls: string[] = [];
    const io: DoctorIO = {
      ...allPassIO(),
      readFile: makeReadFile({
        "firebase-tools.json": FIREBASE_CONFIG,
      }),
      fetch: ((url: string, _init?: RequestInit) => {
        calls.push(url);
        if (url.includes("oauth2")) return Promise.resolve(okTokenResponse());
        if (url.includes("topIssues")) return Promise.resolve(okApiResponse());
        return Promise.resolve(new Response("", { status: 404 }));
      }) as unknown as DoctorIO["fetch"],
    };

    test("uses --project and --app args in API URL", async () => {
      calls.length = 0;
      const out = await runDoctor({ project: "999", app: "1:999:android:xyz" }, io);
      expect(out).toContain("crashlytics api");
      expect(out).toContain("reachable");
      const apiCall = calls.find((c) => c.includes("topIssues"));
      expect(apiCall).toContain("999");
    });
  });

  describe(".crashpull.json missing (last check)", () => {
    const io: DoctorIO = {
      ...allPassIO(),
      readFile: makeReadFile({
        "firebase-tools.json": FIREBASE_CONFIG,
      }),
      fetch: makeFetch({
        oauth2: () => okTokenResponse(),
        topIssues: () => okApiResponse(),
      }),
    };

    test("passes API with args, fails at config check", async () => {
      const out = await runDoctor({ project: "999", app: "1:999:android:xyz" }, io);
      expect(out).toContain("config");
      expect(out).toContain("FAIL");
      expect(out).toContain(".crashpull.json not found");
    });

    test("json shows 5 checks with last failing", async () => {
      const out = await runDoctor({ project: "999", app: "1:999:android:xyz", format: "json" }, io);
      const json = JSON.parse(out);
      expect(json).toHaveLength(5);
      expect(json[4].ok).toBe(false);
      expect(json[4].name).toBe("config");
    });
  });

  describe("id_token missing (still passes)", () => {
    const io: DoctorIO = {
      ...allPassIO(),
      fetch: makeFetch({
        oauth2: () => okTokenResponse(false),
        topIssues: () => okApiResponse(),
      }),
    };

    test("auth passes with unknown email when no id_token", async () => {
      const out = await runDoctor({}, io);
      expect(out).toContain("auth token");
      expect(out).toContain("unknown");
      expect(out).not.toContain("FAIL");
    });
  });
});
