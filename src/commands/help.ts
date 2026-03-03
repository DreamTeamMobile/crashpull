import type { Command } from "../args.js";

const BIN = "crashpull";

interface CommandDef {
  name: Command;
  summary: string;
  usage: string;
  flags: { flag: string; description: string; default?: string }[];
  examples: string[];
}

const GLOBAL_FLAGS = [
  { flag: "--format <text|json>", description: "Output format", default: "text" },
  { flag: "--project <number>", description: "Firebase project number (overrides .crashpull.json)" },
  { flag: "--app <id>", description: "Firebase app ID (overrides .crashpull.json)" },
  { flag: "--help", description: "Show help" },
];

const COMMANDS: CommandDef[] = [
  {
    name: "doctor",
    summary: "Preflight checks (firebase auth, API access, config)",
    usage: `${BIN} doctor`,
    flags: [],
    examples: [`${BIN} doctor`, `${BIN} doctor --format json`],
  },
  {
    name: "init",
    summary: "Link a Firebase project and app to this directory",
    usage: `${BIN} init [options]`,
    flags: [
      { flag: "--project <id>", description: "Firebase project ID or number (skip interactive prompt)" },
      { flag: "--app <id>", description: "Firebase app ID (skip interactive prompt)" },
    ],
    examples: [
      `${BIN} init`,
      `${BIN} init --project my-app-prod --app 1:123:android:abc`,
    ],
  },
  {
    name: "list",
    summary: "List top crash issues",
    usage: `${BIN} list [options]`,
    flags: [
      { flag: "--type <fatal|non-fatal|anr>", description: "Error type filter" },
      { flag: "--signal <fresh|regressed|repetitive>", description: "Signal filter" },
      { flag: "--since <7d|30d|90d>", description: "Time window", default: "30d" },
      { flag: "--limit <n>", description: "Max results", default: "10" },
    ],
    examples: [
      `${BIN} list`,
      `${BIN} list --type fatal --since 30d`,
      `${BIN} list --signal regressed --limit 5 --format json`,
    ],
  },
  {
    name: "show",
    summary: "Show issue detail and stack trace",
    usage: `${BIN} show <issueId>`,
    flags: [],
    examples: [`${BIN} show a1b2c3d4`, `${BIN} show a1b2c3d4 --format json`],
  },
  {
    name: "resolve",
    summary: "Resolve (close) an issue",
    usage: `${BIN} resolve <issueId>`,
    flags: [],
    examples: [`${BIN} resolve a1b2c3d4`],
  },
  {
    name: "help",
    summary: "Show help for a command",
    usage: `${BIN} help [command]`,
    flags: [],
    examples: [`${BIN} help`, `${BIN} help list`],
  },
];

const COMMAND_MAP = new Map(COMMANDS.map((c) => [c.name, c]));

function topLevelText(): string {
  const lines: string[] = [];
  lines.push(`USAGE`);
  lines.push(`  ${BIN} <command> [options]`);
  lines.push("");
  lines.push("COMMANDS");
  const maxName = Math.max(...COMMANDS.map((c) => c.name.length));
  for (const cmd of COMMANDS) {
    lines.push(`  ${cmd.name.padEnd(maxName + 2)}${cmd.summary}`);
  }
  lines.push("");
  lines.push("GLOBAL OPTIONS");
  for (const f of GLOBAL_FLAGS) {
    const def = f.default ? ` (default: ${f.default})` : "";
    lines.push(`  ${f.flag.padEnd(24)}${f.description}${def}`);
  }
  lines.push("");
  lines.push("EXAMPLES");
  lines.push(`  ${BIN} doctor`);
  lines.push(`  ${BIN} list --type fatal --since 30d`);
  lines.push(`  ${BIN} show a1b2c3d4 --format json`);
  return lines.join("\n");
}

function commandText(cmd: CommandDef): string {
  const lines: string[] = [];
  lines.push(`USAGE`);
  lines.push(`  ${cmd.usage}`);
  lines.push("");
  lines.push(`${cmd.summary}`);

  const allFlags = [...cmd.flags, ...GLOBAL_FLAGS];
  if (allFlags.length > 0) {
    lines.push("");
    lines.push("OPTIONS");
    for (const f of allFlags) {
      const def = f.default ? ` (default: ${f.default})` : "";
      lines.push(`  ${f.flag.padEnd(24)}${f.description}${def}`);
    }
  }

  if (cmd.examples.length > 0) {
    lines.push("");
    lines.push("EXAMPLES");
    for (const ex of cmd.examples) {
      lines.push(`  ${ex}`);
    }
  }

  return lines.join("\n");
}

function topLevelJson() {
  return {
    usage: `${BIN} <command> [options]`,
    commands: COMMANDS.map((c) => ({ name: c.name, summary: c.summary })),
    globalOptions: GLOBAL_FLAGS.map((f) => ({
      flag: f.flag,
      description: f.description,
      ...(f.default ? { default: f.default } : {}),
    })),
  };
}

function commandJson(cmd: CommandDef) {
  return {
    command: cmd.name,
    usage: cmd.usage,
    flags: [...cmd.flags, ...GLOBAL_FLAGS].map((f) => ({
      flag: f.flag,
      description: f.description,
      ...(f.default ? { default: f.default } : {}),
    })),
    examples: cmd.examples,
  };
}

export interface HelpArgs {
  topic?: string;
  format?: string;
}

export function runHelp(args: HelpArgs): string {
  const isJson = args.format === "json";
  const topic = args.topic as Command | undefined;

  if (topic) {
    const cmd = COMMAND_MAP.get(topic);
    if (!cmd) {
      throw new Error(`Unknown command: ${topic}`);
    }
    return isJson ? JSON.stringify(commandJson(cmd), null, 2) : commandText(cmd);
  }

  return isJson ? JSON.stringify(topLevelJson(), null, 2) : topLevelText();
}
