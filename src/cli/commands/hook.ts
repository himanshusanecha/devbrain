import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { ObsidianClient } from '../../obsidian/client.js';
import { VaultOps } from '../../obsidian/vault-ops.js';

export async function hookCommand(hookName: string, ...args: string[]) {
  const envFile = path.join(os.homedir(), '.devbrain.env');
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^export\s+([A-Z_]+)="([^"]+)"$/);
      if (match) process.env[match[1]] = match[2];
    }
  }

  const apiKey = process.env.OBSIDIAN_API_KEY;
  if (!apiKey) {
    return; // Silently fail if not configured, don't break git workflows
  }

  const port = parseInt(process.env.OBSIDIAN_PORT ?? "27124", 10);
  const client = new ObsidianClient({ host: "localhost", port, apiKey, ssl: true });
  const ops = new VaultOps(client);

  const reachable = await client.isReachable();
  if (!reachable) {
    return; // Silently fail if obsidian is closed
  }

  let repoName = "";
  try {
    repoName = path.basename(execSync('git rev-parse --show-toplevel').toString().trim());
  } catch {
    return;
  }

  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

  try {
    if (hookName === 'post-checkout') {
      const isBranchCheckout = process.argv[5]; // args[2] technically, but commander drops them
      // args from commander is actually the `process.argv` slice
      // Wait, commander action args are (hookName, ...cmdArgs). 
      // Actually we should just read from process.argv
      // process.argv: node, script, hook, post-checkout, prev, new, isBranchCheckout
      const prevBranch = process.argv[4];
      const newBranch = process.argv[5];
      const isBranch = process.argv[6];

      if (isBranch === "1") {
        await ops.createBranchNote(repoName, currentBranch);
        await ops.updateActiveContext(repoName, currentBranch);
        
        // Open in Obsidian
        const notePath = encodeURIComponent(`Projects/${repoName}/branch-${currentBranch.replace(/[/\\:]/g, '-')}.md`);
        const vaultQuery = process.env.DEVBRAIN_VAULT_PATH 
          ? `&vault=${encodeURIComponent(path.basename(process.env.DEVBRAIN_VAULT_PATH))}`
          : "";
        try {
          execSync(`open "obsidian://open?file=${notePath}${vaultQuery}"`);
        } catch {}
      }
    } 
    else if (hookName === 'post-commit') {
      const hash = execSync('git log -1 --format=%h').toString().trim();
      const msg = execSync('git log -1 --format=%s').toString().trim();
      await ops.appendToProgressLog(repoName, currentBranch, `- [${hash}] ${msg}`);
    }
    else if (hookName === 'post-merge') {
      if (['main', 'master', 'release'].includes(currentBranch)) {
        console.log("========================================================");
        console.log("MERGE DETECTED: Syncing devbrain");
        console.log("Copy this prompt to Claude Code / Cursor to update docs:");
        console.log("========================================================");
        console.log(`The feature branch was just merged into ${currentBranch}. Please run \`mark_branch_merged\` for the feature branch, and then use \`update_plan\` to update PLAN.md or \`write_custom_doc\` for custom docs.`);
        console.log("========================================================");
      }
    }
  } catch (err) {
    // Fail silently
  }
}
