import { parseArgs } from "node:util";

export type Command = "doctor" | "init" | "list" | "show" | "resolve" | "help" | "llm";

const COMMANDS = new Set<Command>([
  "doctor",
  "init",
  "list",
  "show",
  "resolve",
  "help",
  "llm",
]);

export interface RouteResult {
  command: Command;
  args: Record<string, unknown>;
  _unknown?: string[];
}

const globalOptions = {
  format: { type: "string" as const },
  project: { type: "string" as const },
  app: { type: "string" as const },
  help: { type: "boolean" as const },
} as const;

const listOptions = {
  ...globalOptions,
  type: { type: "string" as const },
  signal: { type: "string" as const },
  since: { type: "string" as const },
  limit: { type: "string" as const },
} as const;

function parseGlobal(argv: string[]) {
  return parseArgs({
    args: argv,
    options: globalOptions,
    allowPositionals: true,
    strict: false,
  });
}

function parseList(argv: string[]) {
  return parseArgs({
    args: argv,
    options: listOptions,
    allowPositionals: true,
    strict: false,
  });
}

function parseWithPositional(argv: string[]) {
  return parseArgs({
    args: argv,
    options: globalOptions,
    allowPositionals: true,
    strict: false,
  });
}

function detectUnknown(argv: string[], knownOptions: Record<string, unknown>): string[] {
  const known = new Set(Object.keys(knownOptions));
  return argv
    .filter((a) => a.startsWith("--"))
    .map((a) => a.split("=")[0])
    .filter((flag) => !known.has(flag.slice(2)));
}

export function route(argv: string[]): RouteResult {
  const { values: preValues, positionals } = parseGlobal(argv);

  // --help flag → route to help command
  if (preValues.help) {
    const cmd = positionals[0];
    return {
      command: "help",
      args: {
        topic: cmd && COMMANDS.has(cmd as Command) ? cmd : undefined,
        format: preValues.format,
      },
    };
  }

  const commandName = positionals[0];

  if (!commandName) {
    return { command: "help", args: {} };
  }

  if (!COMMANDS.has(commandName as Command)) {
    throw new Error(`Unknown command: ${commandName}`);
  }

  const command = commandName as Command;

  // Strip the command name from argv for per-command parsing
  const commandArgv = argv.slice(argv.indexOf(commandName) + 1);

  switch (command) {
    case "list": {
      const { values } = parseList(commandArgv);
      const unknown = detectUnknown(commandArgv, listOptions);
      return {
        command,
        args: {
          format: values.format,
          project: values.project,
          app: values.app,
          type: values.type,
          signal: values.signal,
          since: values.since,
          limit: values.limit ? Number(values.limit) : undefined,
        },
        _unknown: unknown.length ? unknown : undefined,
      };
    }

    case "show":
    case "resolve": {
      const { values, positionals: pos } = parseWithPositional(commandArgv);
      const unknown = detectUnknown(commandArgv, globalOptions);
      return {
        command,
        args: {
          format: values.format,
          project: values.project,
          app: values.app,
          issueId: pos[0],
        },
        _unknown: unknown.length ? unknown : undefined,
      };
    }

    case "help": {
      const { values, positionals: pos } = parseGlobal(commandArgv);
      return {
        command,
        args: { topic: pos[0], format: values.format },
      };
    }

    default: {
      // doctor, init, llm — global options only
      const { values } = parseWithPositional(commandArgv);
      const unknown = detectUnknown(commandArgv, globalOptions);
      return {
        command,
        args: {
          format: values.format,
          project: values.project,
          app: values.app,
        },
        _unknown: unknown.length ? unknown : undefined,
      };
    }
  }
}
