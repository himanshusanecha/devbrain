#!/usr/bin/env node
const origEmitWarning = process.emitWarning;
process.emitWarning = function (...args: any[]) {
  if (typeof args[0] === 'string' && args[0].includes('NODE_TLS_REJECT_UNAUTHORIZED')) return;
  origEmitWarning.apply(process, args as any);
};

import { Command } from "commander";
import { startMcpServer } from "../mcp-server/index.js";
import { initCommand } from "./commands/init.js";
import { setupRepoCommand } from "./commands/setup-repo.js";
import { hookCommand } from "./commands/hook.js";
import { buildSchemasCommand } from "./commands/build-schemas.js";

const program = new Command();

program
  .name("devbrain")
  .description("Git-aware context switching layer for AI coding agents via Obsidian vault")
  .version("1.0.0");

program
  .command("init")
  .description("Setup environment and configure agents")
  .action(initCommand);

program
  .command("setup-repo")
  .description("Inject git hooks into the current repository")
  .argument("[path]", "Path to repository", ".")
  .action(setupRepoCommand);

program
  .command("hook")
  .description("Execute git hook logic")
  .argument("<hook-name>", "Name of the hook to run (post-checkout, post-commit, post-merge)")
  .argument("[git-args...]", "Additional arguments passed by git")
  .action(hookCommand);

program
  .command("build-schemas")
  .description("Build Antigravity IDE static MCP schemas")
  .action(buildSchemasCommand);

program
  .command("mcp")
  .description("Start the MCP server over stdio")
  .action(async () => {
    await startMcpServer();
  });

program.parse(process.argv);
