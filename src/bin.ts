#!/usr/bin/env node

import { route } from "./args.js";
import { runDoctor } from "./commands/doctor.js";
import { runHelp } from "./commands/help.js";
import { runInit } from "./commands/init.js";
import { runList } from "./commands/list.js";
import { runResolve } from "./commands/resolve.js";
import { runShow } from "./commands/show.js";
import { runLlm } from "./commands/llm.js";

async function main(): Promise<void> {
  const { command, args, _unknown } = route(process.argv.slice(2));

  if (_unknown?.length) {
    console.error(`Warning: unknown option(s) ignored: ${_unknown.join(", ")}`);
  }

  let output: string;
  switch (command) {
    case "doctor":
      output = await runDoctor(args);
      break;
    case "help":
      output = runHelp(args);
      break;
    case "init": {
      const initParams = (args.project || args.app)
        ? { project: args.project as string | undefined, app: args.app as string | undefined }
        : undefined;
      output = await runInit(undefined, initParams);
      break;
    }
    case "list":
      output = await runList(args);
      break;
    case "resolve":
      output = await runResolve(args);
      break;
    case "show":
      output = await runShow(args);
      break;
    case "llm":
      output = runLlm();
      break;
  }

  console.log(output);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const format = process.argv.includes("--format")
    ? process.argv[process.argv.indexOf("--format") + 1]
    : undefined;

  if (format === "json") {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(message);
  }
  process.exit(1);
});
