import fs from 'fs';
import path from 'path';
import os from 'os';
import { input } from '@inquirer/prompts';
import { ObsidianClient } from '../../obsidian/client.js';
import { buildSchemasCommand } from './build-schemas.js';

export async function initCommand() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║        DevBrain setup                  ║");
  console.log("╚════════════════════════════════════════╝\n");

  const HOME = os.homedir();
  let apiKey = process.env.OBSIDIAN_API_KEY;

  if (!apiKey) {
    console.log("Prerequisite: Obsidian must be open with the Local REST API plugin enabled.");
    console.log("Copy the API key shown in Settings → Local REST API\n");
    apiKey = await input({ message: "Obsidian API key:" });
    if (!apiKey) {
      console.error("❌ API key cannot be empty.");
      process.exit(1);
    }
  } else {
    console.log("✅ Using existing OBSIDIAN_API_KEY");
  }

  const port = parseInt(process.env.OBSIDIAN_PORT ?? "27124", 10);
  const client = new ObsidianClient({ host: "localhost", port, apiKey, ssl: true });

  console.log("→ Checking Obsidian connection...");
  const reachable = await client.isReachable();
  if (reachable) {
    console.log("✅ Obsidian connected\n");
  } else {
    console.log("⚠️  Obsidian not reachable.");
    console.log("   Make sure Obsidian is open and the plugin is enabled.\n");
  }

  console.log("→ Detecting Obsidian vaults...");
  let detectedVaults: string[] = [];
  const candidates = [
    path.join(HOME, 'Library/Application Support/obsidian/obsidian.json'),
    path.join(HOME, '.config/obsidian/obsidian.json'),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
        detectedVaults = Object.values(cfg.vaults || {}).map((v: any) => v.path).filter(Boolean);
        break;
      } catch { }
    }
  }

  let vaultPath = process.env.DEVBRAIN_VAULT_PATH;
  if (!vaultPath) {
    if (detectedVaults.length === 1) {
      vaultPath = detectedVaults[0];
      console.log(`✅ Found vault: ${vaultPath}`);
    } else if (detectedVaults.length > 1) {
      const choice = await input({
        message: `Found ${detectedVaults.length} vaults — pick one (1-${detectedVaults.length}):\n` +
          detectedVaults.map((v, i) => `  ${i + 1}. ${v}`).join('\n') + '\n  Choice:',
        default: "1"
      });
      vaultPath = detectedVaults[parseInt(choice) - 1];
    } else {
      vaultPath = await input({ message: "Vault path:", default: path.join(HOME, "vault") });
    }
  }

  if (!vaultPath) vaultPath = path.join(HOME, "vault");

  const envFile = path.join(HOME, '.devbrain.env');
  const envContent = `export OBSIDIAN_API_KEY="${apiKey}"\nexport OBSIDIAN_PORT="${port}"\nexport DEVBRAIN_VAULT_PATH="${vaultPath}"\n`;
  fs.writeFileSync(envFile, envContent);
  console.log(`✅ Saved config to ${envFile}\n`);

  for (const rc of [path.join(HOME, '.zshrc'), path.join(HOME, '.bashrc')]) {
    if (fs.existsSync(rc)) {
      const content = fs.readFileSync(rc, 'utf8');
      if (!content.includes('devbrain.env')) {
        fs.appendFileSync(rc, `\n# devbrain\n[ -f ${envFile} ] && source ${envFile}\n`);
      }
    }
  }

  const vaultDir = vaultPath.replace(/^~/, HOME);
  const activeContextPath = path.join(vaultDir, 'ACTIVE_CONTEXT.md');
  if (!fs.existsSync(activeContextPath)) {
    fs.writeFileSync(activeContextPath, `---
active_repo: ""
active_branch: ""
switched_at: ""
branch_note: ""
---
> Run \`devbrain setup-repo\` in a repository to initialize context.
`);
  }

  console.log("→ Configuring AI agents...");
  configureAgents(apiKey, vaultPath);

  console.log("════════════════════════════════════════");
  console.log("✅ DevBrain is ready!\n");
  console.log(`Apply to your current shell:\n  source ${envFile}\n`);
  console.log("Link a repo any time:\n  devbrain setup-repo /path/to/repo");
  console.log("════════════════════════════════════════");
}

function configureAgents(apiKey: string, vaultPath: string) {
  const HOME = os.homedir();
  const cliIndex = path.resolve(__dirname, '../index.js');
  const mcpServerEntry = {
    command: 'node',
    args: [cliIndex, 'mcp'],
    env: {
      OBSIDIAN_API_KEY: apiKey,
      OBSIDIAN_PORT: '27124',
      DEVBRAIN_VAULT_PATH: vaultPath,
    },
  };

  // Claude Code
  const claudeConfigPath = path.join(HOME, '.claude', 'settings.json');
  if (fs.existsSync(path.dirname(claudeConfigPath))) {
    let config: any = {};
    if (fs.existsSync(claudeConfigPath)) {
      try { config = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8')); } catch { }
    }
    config.mcpServers = config.mcpServers ?? {};
    config.mcpServers['devbrain'] = mcpServerEntry;
    fs.writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2) + '\n');
    console.log(`✅ Claude Code: configured (${claudeConfigPath})`);
  } else {
    console.log(`⏭️  Claude Code: not installed, skipping`);
  }

  // Antigravity IDE
  if (fs.existsSync(path.join(HOME, '.gemini', 'antigravity-ide'))) {
    buildSchemasCommand();
  }
}
