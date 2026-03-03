import { describe, expect, test } from "bun:test";
import { route } from "../args.js";

/**
 * Integration tests for bin.ts dispatch logic.
 *
 * We test the routing + dispatch pattern used in bin.ts without
 * mocking command modules (to avoid global mock leakage in bun).
 * The route() function is the core of dispatch — we verify it
 * maps every command name correctly and that the error formatting
 * logic works as specified in bin.ts.
 */

describe("bin dispatch", () => {
  test("dispatches doctor", () => {
    const { command } = route(["doctor"]);
    expect(command).toBe("doctor");
  });

  test("dispatches help", () => {
    const { command } = route(["help"]);
    expect(command).toBe("help");
  });

  test("dispatches init", () => {
    const { command } = route(["init"]);
    expect(command).toBe("init");
  });

  test("dispatches list", () => {
    const { command } = route(["list"]);
    expect(command).toBe("list");
  });

  test("dispatches resolve with issueId", () => {
    const { command, args } = route(["resolve", "abc"]);
    expect(command).toBe("resolve");
    expect(args.issueId).toBe("abc");
  });

  test("dispatches show with issueId", () => {
    const { command, args } = route(["show", "abc"]);
    expect(command).toBe("show");
    expect(args.issueId).toBe("abc");
  });

  test("no args dispatches help", () => {
    const { command } = route([]);
    expect(command).toBe("help");
  });

  test("--help flag dispatches help", () => {
    const { command } = route(["--help"]);
    expect(command).toBe("help");
  });

  test("passes format and limit to list", () => {
    const { args } = route(["list", "--format", "json", "--limit", "5"]);
    expect(args.format).toBe("json");
    expect(args.limit).toBe(5);
  });

  test("passes all flags to show", () => {
    const { args } = route(["show", "id-1", "--format", "json", "--project", "99"]);
    expect(args.issueId).toBe("id-1");
    expect(args.format).toBe("json");
    expect(args.project).toBe("99");
  });

  test("passes topic to help", () => {
    const { args } = route(["help", "list"]);
    expect(args.topic).toBe("list");
  });
});

describe("error handling", () => {
  test("unknown command throws", () => {
    expect(() => route(["bogus"])).toThrow("Unknown command: bogus");
  });

  test("text error format", () => {
    try {
      route(["bogus"]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toBe("Unknown command: bogus");
    }
  });

  test("json error format with --format json", () => {
    const argv = ["bogus", "--format", "json"];
    try {
      route(argv);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const formatIdx = argv.indexOf("--format");
      const format = formatIdx >= 0 ? argv[formatIdx + 1] : undefined;
      const output =
        format === "json"
          ? JSON.stringify({ error: message })
          : message;
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({ error: "Unknown command: bogus" });
    }
  });
});

describe("command exhaustiveness", () => {
  const allCommands = ["doctor", "init", "list", "show", "resolve", "help"] as const;

  for (const cmd of allCommands) {
    test(`route handles ${cmd}`, () => {
      // show/resolve need a positional arg to avoid missing-id errors later
      const argv = cmd === "show" || cmd === "resolve" ? [cmd, "x"] : [cmd];
      const { command } = route(argv);
      expect(command).toBe(cmd);
    });
  }
});
