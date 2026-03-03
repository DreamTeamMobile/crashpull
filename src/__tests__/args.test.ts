import { describe, expect, test } from "bun:test";
import { route } from "../args.js";

describe("route", () => {
  describe("command routing", () => {
    test("routes doctor command", () => {
      const result = route(["doctor"]);
      expect(result.command).toBe("doctor");
    });

    test("routes init command", () => {
      const result = route(["init"]);
      expect(result.command).toBe("init");
    });

    test("routes list command", () => {
      const result = route(["list"]);
      expect(result.command).toBe("list");
    });

    test("routes show command", () => {
      const result = route(["show", "abc123"]);
      expect(result.command).toBe("show");
      expect(result.args.issueId).toBe("abc123");
    });

    test("routes resolve command", () => {
      const result = route(["resolve", "abc123"]);
      expect(result.command).toBe("resolve");
      expect(result.args.issueId).toBe("abc123");
    });

    test("routes help command", () => {
      const result = route(["help"]);
      expect(result.command).toBe("help");
    });

    test("routes help with topic", () => {
      const result = route(["help", "list"]);
      expect(result.command).toBe("help");
      expect(result.args.topic).toBe("list");
    });

    test("no command defaults to help", () => {
      const result = route([]);
      expect(result.command).toBe("help");
    });
  });

  describe("unknown command", () => {
    test("throws on unknown command", () => {
      expect(() => route(["foobar"])).toThrow("Unknown command: foobar");
    });

    test("throws on unknown command with flags", () => {
      expect(() => route(["nope", "--format", "json"])).toThrow(
        "Unknown command: nope",
      );
    });
  });

  describe("--help redirect", () => {
    test("--help alone routes to help", () => {
      const result = route(["--help"]);
      expect(result.command).toBe("help");
    });

    test("--help on list routes to help with topic", () => {
      const result = route(["list", "--help"]);
      expect(result.command).toBe("help");
      expect(result.args.topic).toBe("list");
    });

    test("--help on doctor routes to help with topic", () => {
      const result = route(["doctor", "--help"]);
      expect(result.command).toBe("help");
      expect(result.args.topic).toBe("doctor");
    });

    test("--help before command routes to help with topic", () => {
      const result = route(["--help", "show"]);
      expect(result.command).toBe("help");
      expect(result.args.topic).toBe("show");
    });
  });

  describe("global flags", () => {
    test("--format json", () => {
      const result = route(["doctor", "--format", "json"]);
      expect(result.args.format).toBe("json");
    });

    test("--format text", () => {
      const result = route(["doctor", "--format", "text"]);
      expect(result.args.format).toBe("text");
    });

    test("--project", () => {
      const result = route(["list", "--project", "12345"]);
      expect(result.args.project).toBe("12345");
    });

    test("--app", () => {
      const result = route(["list", "--app", "com.example.app"]);
      expect(result.args.app).toBe("com.example.app");
    });
  });

  describe("list flags", () => {
    test("--type fatal", () => {
      const result = route(["list", "--type", "fatal"]);
      expect(result.args.type).toBe("fatal");
    });

    test("--signal fresh", () => {
      const result = route(["list", "--signal", "fresh"]);
      expect(result.args.signal).toBe("fresh");
    });

    test("--since 30d", () => {
      const result = route(["list", "--since", "30d"]);
      expect(result.args.since).toBe("30d");
    });

    test("--limit parses as number", () => {
      const result = route(["list", "--limit", "25"]);
      expect(result.args.limit).toBe(25);
    });

    test("all list flags combined", () => {
      const result = route([
        "list",
        "--type",
        "anr",
        "--signal",
        "regressed",
        "--since",
        "90d",
        "--limit",
        "10",
        "--format",
        "json",
        "--project",
        "99",
        "--app",
        "myapp",
      ]);
      expect(result.command).toBe("list");
      expect(result.args).toEqual({
        type: "anr",
        signal: "regressed",
        since: "90d",
        limit: 10,
        format: "json",
        project: "99",
        app: "myapp",
      });
    });
  });

  describe("show/resolve positional", () => {
    test("show captures issue id", () => {
      const result = route(["show", "issue-xyz"]);
      expect(result.args.issueId).toBe("issue-xyz");
    });

    test("resolve captures issue id", () => {
      const result = route(["resolve", "issue-xyz"]);
      expect(result.args.issueId).toBe("issue-xyz");
    });

    test("show with global flags", () => {
      const result = route([
        "show",
        "id123",
        "--format",
        "json",
        "--project",
        "5",
      ]);
      expect(result.command).toBe("show");
      expect(result.args.issueId).toBe("id123");
      expect(result.args.format).toBe("json");
      expect(result.args.project).toBe("5");
    });
  });
});
