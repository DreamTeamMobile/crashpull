import { describe, expect, test } from "bun:test";
import { runHelp } from "../commands/help.js";

describe("runHelp", () => {
  describe("top-level help", () => {
    test("includes USAGE section", () => {
      const out = runHelp({});
      expect(out).toContain("USAGE");
      expect(out).toContain("crashpull <command> [options]");
    });

    test("includes COMMANDS section with all commands", () => {
      const out = runHelp({});
      expect(out).toContain("COMMANDS");
      for (const cmd of ["doctor", "init", "list", "show", "resolve", "help"]) {
        expect(out).toContain(cmd);
      }
    });

    test("includes GLOBAL OPTIONS section", () => {
      const out = runHelp({});
      expect(out).toContain("GLOBAL OPTIONS");
      expect(out).toContain("--format");
      expect(out).toContain("--project");
      expect(out).toContain("--app");
      expect(out).toContain("--help");
    });

    test("includes EXAMPLES section", () => {
      const out = runHelp({});
      expect(out).toContain("EXAMPLES");
      expect(out).toContain("crashpull doctor");
    });

    test("is plain text with no markdown", () => {
      const out = runHelp({});
      expect(out).not.toContain("#");
      expect(out).not.toContain("```");
      expect(out).not.toContain("**");
    });
  });

  describe("per-command help", () => {
    test("list command shows usage and flags", () => {
      const out = runHelp({ topic: "list" });
      expect(out).toContain("USAGE");
      expect(out).toContain("crashpull list [options]");
      expect(out).toContain("--type");
      expect(out).toContain("--signal");
      expect(out).toContain("--since");
      expect(out).toContain("--limit");
    });

    test("list command shows defaults", () => {
      const out = runHelp({ topic: "list" });
      expect(out).toContain("(default: 7d)");
      expect(out).toContain("(default: 10)");
    });

    test("list command includes global flags", () => {
      const out = runHelp({ topic: "list" });
      expect(out).toContain("--format");
      expect(out).toContain("--project");
    });

    test("show command shows usage with issueId", () => {
      const out = runHelp({ topic: "show" });
      expect(out).toContain("crashpull show <issueId>");
    });

    test("doctor command shows summary", () => {
      const out = runHelp({ topic: "doctor" });
      expect(out).toContain("Preflight checks");
    });

    test("includes EXAMPLES section", () => {
      const out = runHelp({ topic: "list" });
      expect(out).toContain("EXAMPLES");
      expect(out).toContain("crashpull list --type fatal --since 30d");
    });

    test("throws on unknown topic", () => {
      expect(() => runHelp({ topic: "bogus" })).toThrow("Unknown command: bogus");
    });
  });

  describe("JSON format", () => {
    test("top-level JSON is valid", () => {
      const out = runHelp({ format: "json" });
      const json = JSON.parse(out);
      expect(json.usage).toBe("crashpull <command> [options]");
      expect(json.commands).toBeArray();
      expect(json.commands.length).toBe(6);
      expect(json.globalOptions).toBeArray();
    });

    test("top-level JSON lists all command names", () => {
      const out = runHelp({ format: "json" });
      const json = JSON.parse(out);
      const names = json.commands.map((c: { name: string }) => c.name);
      expect(names).toContain("doctor");
      expect(names).toContain("list");
      expect(names).toContain("show");
      expect(names).toContain("resolve");
      expect(names).toContain("help");
    });

    test("per-command JSON has correct structure", () => {
      const out = runHelp({ topic: "list", format: "json" });
      const json = JSON.parse(out);
      expect(json.command).toBe("list");
      expect(json.usage).toBe("crashpull list [options]");
      expect(json.flags).toBeArray();
      expect(json.examples).toBeArray();
    });

    test("per-command JSON includes command-specific and global flags", () => {
      const out = runHelp({ topic: "list", format: "json" });
      const json = JSON.parse(out);
      const flagNames = json.flags.map((f: { flag: string }) => f.flag);
      expect(flagNames).toContain("--type <fatal|non-fatal|anr>");
      expect(flagNames).toContain("--format <text|json>");
    });

    test("per-command JSON includes defaults where set", () => {
      const out = runHelp({ topic: "list", format: "json" });
      const json = JSON.parse(out);
      const sinceFlag = json.flags.find((f: { flag: string }) => f.flag.includes("--since"));
      expect(sinceFlag.default).toBe("7d");
    });

    test("JSON for command with no specific flags still has global flags", () => {
      const out = runHelp({ topic: "doctor", format: "json" });
      const json = JSON.parse(out);
      expect(json.flags.length).toBe(4); // 4 global flags
    });
  });
});
